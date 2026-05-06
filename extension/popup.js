const CONSENT_KEY = "consentVersion";
const CONSENT_VALUE = "1";
const DEFAULT_ORIGIN = "http://localhost:3000";

const $ = (id) => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} not found`);
  return el;
};

function normalizeOrigin(raw) {
  try {
    const u = new URL(raw.trim());
    return u.origin.replace(/\/$/, "");
  } catch {
    return "";
  }
}

async function loadPrefs() {
  const sync = await chrome.storage.sync.get(["apiBaseUrl", "accessToken"]);
  const originInput = /** @type {HTMLInputElement} */ ($("origin"));
  originInput.value = (sync.apiBaseUrl || DEFAULT_ORIGIN).replace(/\/$/, "");
  return { accessToken: sync.accessToken };
}

async function showStage() {
  const consentStore = await chrome.storage.sync.get(CONSENT_KEY);
  const agreed = consentStore[CONSENT_KEY] === CONSENT_VALUE;
  const connectEl = $("connect");
  const mainEl = $("main");
  const consentEl = $("consent");
  const { accessToken } = await loadPrefs();

  if (!agreed) {
    consentEl.style.display = "block";
    connectEl.style.display = "none";
    mainEl.style.display = "none";
    return;
  }

  consentEl.style.display = "none";

  if (!accessToken) {
    connectEl.style.display = "block";
    mainEl.style.display = "none";
    return;
  }

  connectEl.style.display = "none";
  mainEl.style.display = "block";
}

const consentCheck = /** @type {HTMLInputElement} */ ($("consent-check"));
const consentBtn = /** @type {HTMLButtonElement} */ ($("consent-continue"));
consentCheck.addEventListener("change", () => {
  consentBtn.disabled = !consentCheck.checked;
});
consentBtn.addEventListener("click", async () => {
  await chrome.storage.sync.set({ [CONSENT_KEY]: CONSENT_VALUE });
  await showStage();
});

$("pair").addEventListener("click", async () => {
  const msg = $("connect-msg");
  msg.textContent = "";
  const origin = normalizeOrigin(/** @type {HTMLInputElement} */ ($("origin")).value);
  if (!origin) {
    msg.textContent = "Enter a valid library address.";
    msg.className = "error";
    return;
  }
  const code = /** @type {HTMLInputElement} */ ($("code")).value.trim();
  if (!/^\d{6}$/.test(code)) {
    msg.textContent = "Enter the six-digit code.";
    msg.className = "error";
    return;
  }

  const btn = /** @type {HTMLButtonElement} */ ($("pair"));
  btn.disabled = true;
  try {
    const res = await fetch(`${origin}/api/extension/pair`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = /** @type {{ accessToken?: string; error?: string }} */ (
      await res.json()
    );
    if (!res.ok) {
      msg.textContent = data.error || "Could not connect.";
      msg.className = "error";
      return;
    }
    if (!data.accessToken) {
      msg.textContent = "Unexpected response.";
      msg.className = "error";
      return;
    }
    await chrome.storage.sync.set({
      apiBaseUrl: origin,
      accessToken: data.accessToken,
    });
    msg.textContent = "Connected.";
    msg.className = "ok";
    await showStage();
  } catch (e) {
    msg.textContent =
      e instanceof Error ? e.message : "Network error. Check the library address.";
    msg.className = "error";
  } finally {
    btn.disabled = false;
  }
});

/** @type {MediaRecorder | null} */
let mediaRecorder = null;
/** @type {BlobPart[]} */
let chunks = [];
/** @type {MediaStream | null} */
let capturedStream = null;
/** @type {string | null} */
let meetingId = null;
/** @type {string | null} */
let accessToken = null;
/** @type {string | null} */
let apiOrigin = null;

function setStatus(text) {
  $("status").textContent = text;
}

$("start").addEventListener("click", async () => {
  const sync = await chrome.storage.sync.get(["apiBaseUrl", "accessToken"]);
  apiOrigin = normalizeOrigin(sync.apiBaseUrl || DEFAULT_ORIGIN);
  accessToken = sync.accessToken || null;
  if (!accessToken || !apiOrigin) {
    setStatus("Connect first.");
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    setStatus("No active tab.");
    return;
  }

  /** @type {MediaStream | undefined} */
  let stream;
  try {
    stream = await chrome.tabCapture.capture({
      targetTabId: tab.id,
      audio: true,
      video: false,
    });
  } catch (e) {
    setStatus(e instanceof Error ? e.message : "Could not capture audio.");
    return;
  }

  if (!stream) {
    setStatus("Could not capture this tab. Focus your meeting tab and try again.");
    return;
  }

  capturedStream = stream;

  const startRes = await fetch(`${apiOrigin}/api/meetings/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      tabUrl: tab.url || "",
      title: tab.title || "",
    }),
  });
  const startJson = /** @type {{ meetingId?: string; error?: string }} */ (
    await startRes.json()
  );
  if (!startRes.ok) {
    stream.getTracks().forEach((t) => t.stop());
    capturedStream = null;
    setStatus(startJson.error || "Could not start session.");
    return;
  }
  meetingId = startJson.meetingId || null;
  if (!meetingId) {
    stream.getTracks().forEach((t) => t.stop());
    capturedStream = null;
    setStatus("Bad response from library.");
    return;
  }

  chunks = [];
  let mime = "audio/webm;codecs=opus";
  if (!MediaRecorder.isTypeSupported(mime)) {
    mime = "audio/webm";
  }
  mediaRecorder = new MediaRecorder(stream, { mimeType: mime });
  mediaRecorder.ondataavailable = (ev) => {
    if (ev.data && ev.data.size > 0) chunks.push(ev.data);
  };
  mediaRecorder.start(2000);

  /** @type {HTMLButtonElement} */ ($("start")).disabled = true;
  /** @type {HTMLButtonElement} */ ($("stop")).disabled = false;
  setStatus("Capturing… keep this window open.");
});

$("stop").addEventListener("click", async () => {
  if (!mediaRecorder || mediaRecorder.state === "inactive") {
    return;
  }
  /** @type {HTMLButtonElement} */ ($("stop")).disabled = true;
  setStatus("Processing…");

  const token = accessToken;
  const origin = apiOrigin;
  const id = meetingId;
  const mr = mediaRecorder;

  mr.addEventListener(
    "stop",
    async () => {
      if (capturedStream) {
        capturedStream.getTracks().forEach((t) => t.stop());
        capturedStream = null;
      }
      if (!token || !origin || !id) {
        setStatus("Lost session. Try again.");
        /** @type {HTMLButtonElement} */ ($("start")).disabled = false;
        return;
      }
      const blob = new Blob(chunks, { type: mr.mimeType || "audio/webm" });
      chunks = [];
      const form = new FormData();
      form.append("audio", blob, "capture.webm");
      try {
        const res = await fetch(`${origin}/api/meetings/${id}/audio`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });
        const data = /** @type {{ error?: string }} */ (await res.json());
        if (!res.ok) {
          setStatus(data.error || "Upload failed.");
        } else {
          setStatus("Sent. Open your library to read notes.");
        }
      } catch (e) {
        setStatus(e instanceof Error ? e.message : "Upload failed.");
      }
      /** @type {HTMLButtonElement} */ ($("start")).disabled = false;
      meetingId = null;
      mediaRecorder = null;
    },
    { once: true }
  );

  mr.stop();
});

void showStage();
