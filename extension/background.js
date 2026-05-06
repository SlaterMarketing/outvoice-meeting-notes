/**
 * Tab capture orchestration + overlay messaging
 */

function normalizeOrigin(raw) {
  try {
    return new URL(raw.trim()).origin.replace(/\/$/, "");
  } catch {
    return "";
  }
}

/** @type {chrome.runtime.Port | null} */
let offscreenPort = null;

async function ensureOffscreen() {
  if (chrome.runtime.getContexts) {
    const ctx = await chrome.runtime.getContexts({
      contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
    });
    if (ctx.length > 0) return;
  }
  const reasons = chrome.offscreen?.Reason?.USER_MEDIA
    ? [chrome.offscreen.Reason.USER_MEDIA]
    : /** @type {chrome.offscreen.Reason[]} */ (["USER_MEDIA"]);
  try {
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons,
      justification: "Record meeting audio from the captured browser tab.",
    });
  } catch (first) {
    const fallback =
      chrome.offscreen?.Reason?.AUDIO_PLAYBACK
        ? [chrome.offscreen.Reason.AUDIO_PLAYBACK]
        : /** @type {chrome.offscreen.Reason[]} */ (["AUDIO_PLAYBACK"]);
    try {
      await chrome.offscreen.createDocument({
        url: "offscreen.html",
        reasons: fallback,
        justification: "Record meeting audio from the captured browser tab.",
      });
    } catch (e) {
      const msg = String(/** @type {Error} */ (e)?.message || e || "");
      if (!/single Offscreen|Only a single offscreen/i.test(msg)) throw first;
    }
  }
}

async function connectOffscreen() {
  if (offscreenPort) return offscreenPort;
  await ensureOffscreen();
  offscreenPort = chrome.runtime.connect({ name: "outvoice-offscreen" });
  offscreenPort.onDisconnect.addListener(() => {
    offscreenPort = null;
  });
  return offscreenPort;
}

/**
 * @param {number} tabId
 * @param {string} tabUrl
 * @param {string} title
 */
async function startCaptureForTab(tabId, tabUrl, title) {
  const sync = await chrome.storage.sync.get(["accessToken", "libraryOrigin"]);
  if (!sync.accessToken) {
    throw new Error("Sign in to Outvoice first (extension icon).");
  }
  let origin = normalizeOrigin(
    typeof sync.libraryOrigin === "string" ? sync.libraryOrigin : "http://localhost:3000"
  );
  if (!origin) origin = "http://localhost:3000";

  const existing = await chrome.storage.local.get("outvoiceRecording");
  if (existing.outvoiceRecording?.active) {
    throw new Error("Already recording.");
  }

  const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });

  const port = await connectOffscreen();
  const id = crypto.randomUUID();

  /** @type {{ ok: boolean; error?: string }} */
  const result = await new Promise((resolve) => {
    function onMsg(/** @type {{ type?: string; id?: string; ok?: boolean; error?: string }} */ m) {
      if (m?.type === "START_DONE" && m.id === id) {
        port.onMessage.removeListener(onMsg);
        resolve({ ok: !!m.ok, error: m.error });
      }
    }
    port.onMessage.addListener(onMsg);
    port.postMessage({
      type: "START",
      id,
      streamId,
      tabUrl: tabUrl || "",
      title: title || "",
      accessToken: sync.accessToken,
      apiOrigin: origin,
      tabId,
    });
  });

  if (!result.ok) {
    try {
      await chrome.tabs.sendMessage(tabId, {
        type: "OUTVOICE_UI",
        recording: false,
        error: result.error || "Could not start.",
      });
    } catch {
      /* no receiver */
    }
    throw new Error(result.error || "Could not start capture.");
  }

  try {
    await chrome.tabs.sendMessage(tabId, {
      type: "OUTVOICE_UI",
      recording: true,
    });
  } catch {
    /* tab might not have content script yet */
  }
}

async function stopCapture() {
  const rec = await chrome.storage.local.get("outvoiceRecording");
  const tabId = rec.outvoiceRecording?.tabId;

  const port = await connectOffscreen();
  const id = crypto.randomUUID();

  await new Promise((resolve) => {
    function onMsg(/** @type {{ type?: string; id?: string }} */ m) {
      if (m?.type === "STOP_DONE" && m.id === id) {
        port.onMessage.removeListener(onMsg);
        resolve(undefined);
      }
    }
    port.onMessage.addListener(onMsg);
    port.postMessage({ type: "STOP", id });
  });

  if (tabId) {
    try {
      await chrome.tabs.sendMessage(tabId, {
        type: "OUTVOICE_UI",
        recording: false,
        done: true,
      });
    } catch {
      /* ignore */
    }
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "OUTVOICE_START_CAPTURE") {
    const tabId = /** @type {number | undefined} */ (msg.tabId) ?? sender.tab?.id;
    const tabUrl =
      /** @type {string} */ (msg.tabUrl ?? sender.tab?.url ?? "");
    const tabTitle =
      /** @type {string} */ (msg.tabTitle ?? sender.tab?.title ?? "");
    if (!tabId) {
      sendResponse({ ok: false, error: "No tab." });
      return false;
    }
    startCaptureForTab(tabId, tabUrl, tabTitle)
      .then(() => sendResponse({ ok: true }))
      .catch((e) =>
        sendResponse({ ok: false, error: e instanceof Error ? e.message : "Failed." })
      );
    return true;
  }

  if (msg?.type === "OUTVOICE_STOP_CAPTURE") {
    stopCapture()
      .then(() => sendResponse({ ok: true }))
      .catch((e) =>
        sendResponse({ ok: false, error: e instanceof Error ? e.message : "Failed." })
      );
    return true;
  }

  if (msg?.type === "OUTVOICE_GET_STATE") {
    chrome.storage.local.get("outvoiceRecording").then((r) => {
      sendResponse({ recording: !!r.outvoiceRecording?.active });
    });
    return true;
  }

  return false;
});
