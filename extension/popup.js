const CONSENT_KEY = "consentVersion";
const CONSENT_VALUE = "1";

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

/** Origin from extension/library-origin.js (edit that file to change servers). */
function getPackagedLibraryOrigin() {
  const raw =
    typeof window.OUTVOICE_LIBRARY_ORIGIN === "string"
      ? window.OUTVOICE_LIBRARY_ORIGIN
      : "http://localhost:3000";
  return normalizeOrigin(raw);
}

async function loadPrefs() {
  const sync = await chrome.storage.sync.get(["accessToken"]);
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
    /** @type {HTMLButtonElement} */ ($("tab-auth-finish")).hidden = true;
    return;
  }

  connectEl.style.display = "none";
  mainEl.style.display = "block";
  await syncPopupRecordingUi();
}

async function syncPopupRecordingUi() {
  try {
    /** @type {{ recording?: boolean }} */
    const r = await chrome.runtime.sendMessage({ type: "OUTVOICE_GET_STATE" });
    if (r?.recording) {
      /** @type {HTMLButtonElement} */ ($("start")).disabled = true;
      /** @type {HTMLButtonElement} */ ($("stop")).disabled = false;
      setStatus("Capturing… use Stop here or on the meeting page.");
    } else {
      /** @type {HTMLButtonElement} */ ($("start")).disabled = false;
      /** @type {HTMLButtonElement} */ ($("stop")).disabled = true;
      setStatus("Idle. Start from your meeting tab.");
    }
  } catch {
    /** @type {HTMLButtonElement} */ ($("start")).disabled = false;
    /** @type {HTMLButtonElement} */ ($("stop")).disabled = true;
  }
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

/**
 * @param {string} url
 * @returns {Promise<string|undefined>}
 */
function launchWebAuthFlowPromise(url) {
  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow({ url, interactive: true }, (responseUrl) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(responseUrl);
    });
  });
}

/**
 * @param {string} origin
 * @param {string} responseUrl
 * @param {HTMLElement} msg
 * @returns {Promise<boolean>}
 */
async function completeAuthCodeExchange(origin, responseUrl, msg) {
  let code;
  try {
    const u = new URL(responseUrl);
    code = u.searchParams.get("code");
  } catch {
    msg.textContent = "Unexpected response.";
    msg.className = "error";
    return false;
  }
  if (!code) {
    msg.textContent = "No code returned. Try again.";
    msg.className = "error";
    return false;
  }

  const res = await fetch(`${origin}/api/extension/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  const data = /** @type {{ accessToken?: string; error?: string }} */ (await res.json());
  if (!res.ok || !data.accessToken) {
    msg.textContent = data.error || "Could not finish sign-in.";
    msg.className = "error";
    return false;
  }
  await chrome.storage.sync.set({
    accessToken: data.accessToken,
    libraryOrigin: origin,
  });
  msg.textContent = "Connected.";
  msg.className = "ok";
  return true;
}

function findExtensionRedirectInTabs() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({}, (tabs) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      for (const t of tabs || []) {
        const url = t.url;
        if (!url) continue;
        try {
          const u = new URL(url);
          if (!u.hostname.endsWith("chromiumapp.org")) continue;
          const code = u.searchParams.get("code");
          if (code) {
            resolve({ responseUrl: url, tabId: /** @type {number} */ (t.id) });
            return;
          }
        } catch {
          /* ignore */
        }
      }
      resolve(null);
    });
  });
}

$("sign-in").addEventListener("click", async () => {
  const msg = $("connect-msg");
  const tabFinish = /** @type {HTMLButtonElement} */ ($("tab-auth-finish"));
  msg.textContent = "";
  tabFinish.hidden = true;
  const origin = getPackagedLibraryOrigin();
  if (!origin) {
    msg.textContent = "This helper is not set up with a valid web address.";
    msg.className = "error";
    return;
  }

  try {
    await fetch(`${origin}/login`, { method: "GET", cache: "no-store" });
  } catch {
    msg.textContent = "Could not reach your library. Start the web app, then try again.";
    msg.className = "error";
    return;
  }

  const redirectUrl = chrome.identity.getRedirectURL();
  const authUrl = `${origin}/extension/connect?redirect_uri=${encodeURIComponent(redirectUrl)}`;

  const btn = /** @type {HTMLButtonElement} */ ($("sign-in"));
  btn.disabled = true;
  tabFinish.disabled = true;
  try {
    let responseUrl = /** @type {string | undefined} */ (undefined);
    try {
      responseUrl = await launchWebAuthFlowPromise(authUrl);
    } catch (e) {
      const m = e instanceof Error ? e.message : "";
      if (m.includes("Authorization page could not be loaded")) {
        try {
          await new Promise((resolve, reject) => {
            chrome.tabs.create({ url: authUrl, active: true }, () => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
              }
              resolve(undefined);
            });
          });
        } catch (createErr) {
          msg.textContent =
            createErr instanceof Error ? createErr.message : "Could not open sign-in tab.";
          msg.className = "error";
          return;
        }
        msg.textContent =
          "Sign-in opened in a normal tab. After that page finishes, come back here and tap Finish sign-in.";
        msg.className = "small";
        tabFinish.hidden = false;
        return;
      }
      if (
        typeof m === "string" &&
        (m.includes("closed") || m.includes("canceled") || m.includes("cancelled"))
      ) {
        msg.textContent = "Sign-in was cancelled.";
      } else {
        msg.textContent = m;
      }
      msg.className = "error";
      return;
    }

    if (!responseUrl) {
      msg.textContent = "Sign-in was cancelled.";
      msg.className = "error";
      return;
    }

    const ok = await completeAuthCodeExchange(origin, responseUrl, msg);
    if (ok) await showStage();
  } finally {
    btn.disabled = false;
    tabFinish.disabled = false;
  }
});

$("tab-auth-finish").addEventListener("click", async () => {
  const msg = $("connect-msg");
  const tabFinish = /** @type {HTMLButtonElement} */ ($("tab-auth-finish"));
  const origin = getPackagedLibraryOrigin();
  if (!origin) {
    msg.textContent = "This helper is not set up with a valid web address.";
    msg.className = "error";
    return;
  }
  tabFinish.disabled = true;
  try {
    const found = await findExtensionRedirectInTabs();
    if (!found) {
      msg.textContent =
        "No finished sign-in tab found. Finish logging in in the other tab, then try again.";
      msg.className = "error";
      return;
    }
    const ok = await completeAuthCodeExchange(origin, found.responseUrl, msg);
    if (ok) {
      chrome.tabs.remove(found.tabId).catch(() => {});
      tabFinish.hidden = true;
      await showStage();
    }
  } finally {
    tabFinish.disabled = false;
  }
});

$("pair").addEventListener("click", async () => {
  const msg = $("connect-msg");
  msg.textContent = "";
  const origin = getPackagedLibraryOrigin();
  if (!origin) {
    msg.textContent = "This helper is not set up with a valid web address.";
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
      accessToken: data.accessToken,
      libraryOrigin: origin,
    });
    msg.textContent = "Connected.";
    msg.className = "ok";
    await showStage();
  } catch (e) {
    msg.textContent =
      e instanceof Error ? e.message : "Network error. Try again.";
    msg.className = "error";
  } finally {
    btn.disabled = false;
  }
});

function setStatus(text) {
  $("status").textContent = text;
}

$("start").addEventListener("click", async () => {
  const sync = await chrome.storage.sync.get(["accessToken"]);
  if (!sync.accessToken || !getPackagedLibraryOrigin()) {
    setStatus("Sign in first.");
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    setStatus("No active tab.");
    return;
  }

  /** @type {HTMLButtonElement} */ ($("start")).disabled = true;
  try {
    /** @type {{ ok?: boolean; error?: string }} */
    const res = await chrome.runtime.sendMessage({
      type: "OUTVOICE_START_CAPTURE",
      tabId: tab.id,
      tabUrl: tab.url || "",
      tabTitle: tab.title || "",
    });
    if (!res?.ok) {
      setStatus(res?.error || "Could not start.");
      /** @type {HTMLButtonElement} */ ($("start")).disabled = false;
      return;
    }
    /** @type {HTMLButtonElement} */ ($("stop")).disabled = false;
    setStatus("Capturing… use Stop here or on the meeting page.");
  } catch (e) {
    setStatus(e instanceof Error ? e.message : "Could not start.");
    /** @type {HTMLButtonElement} */ ($("start")).disabled = false;
  }
});

$("stop").addEventListener("click", async () => {
  /** @type {HTMLButtonElement} */ ($("stop")).disabled = true;
  setStatus("Processing…");
  try {
    /** @type {{ ok?: boolean; error?: string }} */
    const res = await chrome.runtime.sendMessage({ type: "OUTVOICE_STOP_CAPTURE" });
    if (!res?.ok) {
      setStatus(res?.error || "Stop failed.");
    } else {
      setStatus("Sent. Open your library to read notes.");
    }
  } catch (e) {
    setStatus(e instanceof Error ? e.message : "Stop failed.");
  }
  /** @type {HTMLButtonElement} */ ($("start")).disabled = false;
  /** @type {HTMLButtonElement} */ ($("stop")).disabled = true;
});

async function migrateLibraryOrigin() {
  const o = getPackagedLibraryOrigin();
  if (!o) return;
  const r = await chrome.storage.sync.get("libraryOrigin");
  if (!r.libraryOrigin) {
    await chrome.storage.sync.set({ libraryOrigin: o });
  }
}

void migrateLibraryOrigin();
void showStage();
