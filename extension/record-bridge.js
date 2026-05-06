/**
 * Extension iframe: tabCapture gesture + optional Meet-native toggle (start/stop).
 */
/** @type {number | null} */
let targetTabId = null;
/** @type {string} */
let targetTabUrl = "";
/** @type {string} */
let targetTabTitle = "";
/** Signed in + consent */
let parentAllows = false;
let isRecording = false;

const btnDefault = /** @type {HTMLButtonElement} */ (document.getElementById("start-default"));
const btnMeet = /** @type {HTMLButtonElement} */ (document.getElementById("start-meet"));

function isMeetUi() {
  return document.documentElement.classList.contains("meet-native");
}

/**
 * @param {boolean} meetStyle
 * @param {boolean} [meetPrejoin]
 */
function applyMeetChrome(meetStyle, meetPrejoin) {
  document.documentElement.classList.toggle("meet-native", meetStyle);
  document.documentElement.classList.toggle(
    "meet-prejoin",
    !!meetStyle && !!meetPrejoin
  );
}

function syncButtons() {
  if (isRecording) {
    btnDefault.disabled = false;
    btnMeet.disabled = false;
    btnMeet.classList.remove("outvoice-action-blocked");
    return;
  }
  const block = !parentAllows || targetTabId == null;
  btnDefault.disabled = block;
  /* Meet: avoid disabled — it kills :hover, cursor, and :active in the toolbar iframe. */
  btnMeet.disabled = false;
  btnMeet.classList.toggle("outvoice-action-blocked", block);
}

function applyRecordingShell() {
  if (isRecording) {
    btnMeet.classList.add("recording");
    const t = "Recording — tap to stop";
    btnMeet.setAttribute("aria-label", t);
    btnMeet.title = t;
    btnDefault.textContent = "Stop";
  } else {
    btnMeet.classList.remove("recording");
    const t = "Record with Outvoice";
    btnMeet.setAttribute("aria-label", t);
    btnMeet.title = t;
    btnDefault.textContent = "Start";
  }
}

/**
 * @param {string} origin
 */
function isAllowedMeetingOrigin(origin) {
  try {
    const u = new URL(origin);
    if (u.protocol !== "https:") return false;
    const h = u.hostname;
    const p = u.pathname;
    if (h === "meet.google.com") {
      if (/^\/[a-z]{3}-[a-z]{4}-[a-z]{3}/i.test(p)) return true;
      if (p !== "/" && !p.startsWith("/landing")) return true;
    }
    if (h === "zoom.us" || h.endsWith(".zoom.us")) {
      if (p.includes("/wc/") || p.includes("/j/") || p.includes("/meet")) return true;
      if (h.startsWith("app.") && p.includes("/wc")) return true;
    }
    if (
      h.includes("teams.microsoft.com") ||
      h === "teams.live.com" ||
      h.endsWith(".teams.live.com")
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function onToggleClick() {
  if (isRecording) {
    chrome.runtime.sendMessage({ type: "OUTVOICE_STOP_CAPTURE" }, (res) => {
      const le = chrome.runtime.lastError;
      if (le) {
        window.parent.postMessage(
          { type: "outvoice-stopped", ok: false, error: le.message },
          "*"
        );
        return;
      }
      window.parent.postMessage(
        { type: "outvoice-stopped", ok: !!res?.ok, error: res?.error },
        "*"
      );
    });
    return;
  }

  if (!parentAllows || targetTabId == null) {
    window.parent.postMessage(
      {
        type: "outvoice-started",
        ok: false,
        error: !parentAllows
          ? "Sign in from the extension first."
          : "This page is not ready yet. Refresh or try again.",
      },
      "*"
    );
    return;
  }

  /* Start: callback form keeps the user-gesture chain Chrome expects for tabCapture. */
  chrome.tabCapture.getMediaStreamId({ targetTabId: /** @type {number} */ (targetTabId) }, (streamId) => {
    const le = chrome.runtime.lastError;
    if (le || !streamId) {
      window.parent.postMessage(
        {
          type: "outvoice-started",
          ok: false,
          error: le?.message || "Could not capture this tab.",
        },
        "*"
      );
      return;
    }
    chrome.runtime.sendMessage(
      {
        type: "OUTVOICE_START_WITH_STREAM",
        streamId,
        tabId: targetTabId,
        tabUrl: targetTabUrl,
        tabTitle: targetTabTitle,
      },
      (res) => {
        const le2 = chrome.runtime.lastError;
        if (le2) {
          window.parent.postMessage(
            { type: "outvoice-started", ok: false, error: le2.message },
            "*"
          );
          return;
        }
        window.parent.postMessage(
          {
            type: "outvoice-started",
            ok: !!res?.ok,
            error: res?.error,
          },
          "*"
        );
      }
    );
  });
}

btnDefault.addEventListener("click", onToggleClick);
btnMeet.addEventListener("click", onToggleClick);

window.addEventListener("message", (ev) => {
  if (ev.data?.type === "outvoice-init") {
    if (!isAllowedMeetingOrigin(ev.origin)) return;
    targetTabId = typeof ev.data.tabId === "number" ? ev.data.tabId : null;
    targetTabUrl = typeof ev.data.tabUrl === "string" ? ev.data.tabUrl : "";
    targetTabTitle = typeof ev.data.tabTitle === "string" ? ev.data.tabTitle : "";
    if (typeof ev.data.meetStyle === "boolean") {
      applyMeetChrome(ev.data.meetStyle, !!ev.data.meetPrejoin);
    }
    syncButtons();
    applyRecordingShell();
    return;
  }
  if (ev.data?.type === "outvoice-state") {
    if (!isAllowedMeetingOrigin(ev.origin)) return;
    parentAllows = !!ev.data.parentAllows;
    isRecording = !!ev.data.recording;
    if (typeof ev.data.meetStyle === "boolean") {
      applyMeetChrome(ev.data.meetStyle, !!ev.data.meetPrejoin);
    }
    syncButtons();
    applyRecordingShell();
  }
});
