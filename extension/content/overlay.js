const CONSENT_KEY = "consentVersion";
const CONSENT_VALUE = "1";

/**
 * @param {string} href
 * @returns {"meet" | "zoom" | "teams" | null}
 */
function detectMeetingPlatform(href) {
  try {
    const u = new URL(href);
    const h = u.hostname;
    const p = u.pathname;
    if (h === "meet.google.com") {
      if (/^\/[a-z]{3}-[a-z]{4}-[a-z]{3}/i.test(p)) return "meet";
      if (p !== "/" && !p.startsWith("/landing")) return "meet";
    }
    if (h === "zoom.us" || h.endsWith(".zoom.us")) {
      if (p.includes("/wc/") || p.includes("/j/") || p.includes("/meet")) return "zoom";
      if (h.startsWith("app.") && p.includes("/wc")) return "zoom";
    }
    if (
      h.includes("teams.microsoft.com") ||
      h === "teams.live.com" ||
      h.endsWith(".teams.live.com")
    ) {
      return "teams";
    }
    return null;
  } catch {
    return null;
  }
}

function iconUrl() {
  return chrome.runtime.getURL("outvoice.png");
}

/**
 * @returns {{
 *   panel: HTMLDivElement;
 *   mini: HTMLButtonElement;
 *   status: HTMLDivElement;
 *   btnStart: HTMLButtonElement;
 *   btnStop: HTMLButtonElement;
 *   collapse: HTMLButtonElement;
 *   toggle: HTMLInputElement;
 * }}
 */
function buildOverlay() {
  const existing = document.getElementById("outvoice-overlay-host");
  if (existing) {
    return /** @type {any} */ (existing._outvoiceRefs);
  }

  const host = document.createElement("div");
  host.id = "outvoice-overlay-host";

  const panel = document.createElement("div");
  panel.id = "outvoice-overlay-panel";

  const brand = document.createElement("div");
  brand.id = "outvoice-overlay-brand";
  const img = document.createElement("img");
  img.src = iconUrl();
  img.alt = "";
  const title = document.createElement("span");
  title.id = "outvoice-overlay-title";
  title.textContent = "Outvoice";
  brand.append(img, title);

  const status = document.createElement("div");
  status.id = "outvoice-overlay-status";
  status.textContent = "Ready to record this tab.";

  const actions = document.createElement("div");
  actions.id = "outvoice-overlay-actions";
  const btnStart = document.createElement("button");
  btnStart.type = "button";
  btnStart.textContent = "Start";
  const btnStop = document.createElement("button");
  btnStop.type = "button";
  btnStop.textContent = "Stop";
  btnStop.className = "secondary";
  btnStop.disabled = true;
  actions.append(btnStart, btnStop);

  const toggleLabel = document.createElement("label");
  toggleLabel.id = "outvoice-overlay-toggle";
  const toggle = document.createElement("input");
  toggle.type = "checkbox";
  toggle.id = "outvoice-overlay-autostart";
  const toggleText = document.createElement("span");
  toggleText.textContent = "Start automatically when I join";
  toggleLabel.append(toggle, toggleText);

  const collapse = document.createElement("button");
  collapse.type = "button";
  collapse.id = "outvoice-overlay-collapse";
  collapse.title = "Minimize";
  collapse.textContent = "−";

  panel.append(brand, status, actions, toggleLabel, collapse);
  host.appendChild(panel);

  const mini = document.createElement("button");
  mini.type = "button";
  mini.id = "outvoice-overlay-min";
  const miniImg = document.createElement("img");
  miniImg.src = iconUrl();
  miniImg.alt = "";
  mini.appendChild(miniImg);

  host.appendChild(mini);
  document.documentElement.appendChild(host);

  const refs = { panel, mini, status, btnStart, btnStop, collapse, toggle };
  /** @type {any} */ (host)._outvoiceRefs = refs;
  return refs;
}

/**
 * @param {ReturnType<typeof buildOverlay>} ui
 * @param {boolean} recording
 * @param {boolean} [done]
 */
function applyRecordingUi(ui, recording, done) {
  ui.btnStart.disabled = recording;
  ui.btnStop.disabled = !recording;
  ui.status.classList.remove("recording", "error");
  if (recording) {
    ui.status.classList.add("recording");
    ui.status.textContent =
      "Recording this tab… keep it open. Tap Stop when the meeting ends.";
    ui.mini.classList.add("dot");
  } else {
    ui.mini.classList.remove("dot");
    if (done) {
      ui.status.textContent = "Sent. Open your library for notes.";
    } else {
      ui.status.textContent = "Ready to record this tab.";
    }
  }
}

function main() {
  const platform = detectMeetingPlatform(window.location.href);
  if (!platform) return;

  const ui = buildOverlay();

  chrome.storage.sync.get([CONSENT_KEY, "accessToken", "outvoiceAutostart"], (r) => {
    const consented = r[CONSENT_KEY] === CONSENT_VALUE;
    const signedIn = !!r.accessToken;
    ui.toggle.checked = !!r.outvoiceAutostart;

    if (!consented || !signedIn) {
      ui.status.textContent = consented
        ? "Sign in from the extension icon, then use Start."
        : "Open the extension and continue past the notice, then sign in.";
      ui.btnStart.disabled = true;
    }

    if (!consented || !signedIn) {
      ui.toggle.disabled = true;
    }
  });

  ui.toggle.addEventListener("change", () => {
    chrome.storage.sync.set({ outvoiceAutostart: ui.toggle.checked });
  });

  ui.collapse.addEventListener("click", () => {
    ui.panel.style.display = "none";
    ui.mini.classList.add("visible");
  });

  ui.mini.addEventListener("click", () => {
    ui.mini.classList.remove("visible");
    ui.panel.style.display = "flex";
  });

  ui.btnStart.addEventListener("click", async () => {
    ui.status.classList.remove("error");
    ui.btnStart.disabled = true;
    try {
      /** @type {{ ok?: boolean; error?: string }} */
      const res = await chrome.runtime.sendMessage({ type: "OUTVOICE_START_CAPTURE" });
      if (!res?.ok) {
        ui.status.classList.add("error");
        ui.status.textContent = res?.error || "Could not start.";
        ui.btnStart.disabled = false;
        return;
      }
      const s = await chrome.storage.sync.get([CONSENT_KEY, "accessToken"]);
      if (s[CONSENT_KEY] !== CONSENT_VALUE || !s.accessToken) {
        ui.btnStart.disabled = false;
        return;
      }
      applyRecordingUi(ui, true);
    } catch (e) {
      ui.status.classList.add("error");
      ui.status.textContent = e instanceof Error ? e.message : "Could not start.";
      ui.btnStart.disabled = false;
    }
  });

  ui.btnStop.addEventListener("click", async () => {
    ui.btnStop.disabled = true;
    try {
      await chrome.runtime.sendMessage({ type: "OUTVOICE_STOP_CAPTURE" });
      applyRecordingUi(ui, false, true);
    } catch {
      applyRecordingUi(ui, false);
    }
    ui.btnStart.disabled = false;
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type !== "OUTVOICE_UI") return;
    if (msg.error) {
      ui.status.classList.remove("recording");
      ui.status.classList.add("error");
      ui.status.textContent = msg.error;
      ui.btnStart.disabled = false;
      applyRecordingUi(ui, false);
      return;
    }
    if (msg.recording) {
      applyRecordingUi(ui, true);
    } else {
      applyRecordingUi(ui, false, !!msg.done);
      ui.btnStart.disabled = false;
    }
  });

  /* Autostart once per page session after a short delay */
  function maybeAutostart() {
    chrome.storage.sync.get(
      [CONSENT_KEY, "accessToken", "outvoiceAutostart"],
      (r) => {
        if (r[CONSENT_KEY] !== CONSENT_VALUE || !r.accessToken || !r.outvoiceAutostart) {
          return;
        }
        const key = "outvoice_autostart_attempted";
        try {
          if (sessionStorage.getItem(key)) return;
          sessionStorage.setItem(key, "1");
        } catch {
          return;
        }
        chrome.runtime.sendMessage({ type: "OUTVOICE_GET_STATE" }, (state) => {
          if (chrome.runtime.lastError) return;
          if (state?.recording) return;
          void chrome.runtime.sendMessage({ type: "OUTVOICE_START_CAPTURE" }, (res) => {
            if (res && !res.ok && res.error) {
              ui.status.classList.add("error");
              ui.status.textContent = res.error;
            }
          });
        });
      }
    );
  }
  window.setTimeout(maybeAutostart, 2500);
}

main();
