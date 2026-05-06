/**
 * Holds MediaRecorder for tab audio (required outside the popup for page-triggered capture).
 */
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
/** @type {number | null} */
let captureTabId = null;

/**
 * @param {Record<string, unknown>} msg
 */
async function handleStart(msg) {
  const streamId = /** @type {string} */ (msg.streamId);
  const tabUrl = /** @type {string} */ (msg.tabUrl ?? "");
  const title = /** @type {string} */ (msg.title ?? "");
  accessToken = /** @type {string} */ (msg.accessToken);
  apiOrigin = /** @type {string} */ (msg.apiOrigin);
  captureTabId = /** @type {number} */ (msg.tabId);

  const stream = await new Promise((resolve, reject) => {
    // @ts-ignore chrome-specific constraints
    navigator.mediaDevices
      .getUserMedia({
        audio: {
          mandatory: {
            chromeMediaSource: "tab",
            chromeMediaSourceId: streamId,
          },
        },
        video: false,
      })
      .then(resolve)
      .catch(reject);
  });

  capturedStream = stream;

  const startRes = await fetch(`${apiOrigin}/api/meetings/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ tabUrl, title }),
  });
  const startJson = /** @type {{ meetingId?: string; error?: string }} */ (
    await startRes.json()
  );
  if (!startRes.ok) {
    stream.getTracks().forEach((t) => t.stop());
    capturedStream = null;
    throw new Error(startJson.error || "Could not start session.");
  }
  meetingId = startJson.meetingId || null;
  if (!meetingId) {
    stream.getTracks().forEach((t) => t.stop());
    capturedStream = null;
    throw new Error("Bad response from library.");
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

  await chrome.storage.local.set({
    outvoiceRecording: {
      active: true,
      meetingId,
      tabId: captureTabId,
    },
  });
}

async function handleStop() {
  if (!mediaRecorder || mediaRecorder.state === "inactive") {
    await chrome.storage.local.remove("outvoiceRecording");
    return;
  }

  const token = accessToken;
  const origin = apiOrigin;
  const id = meetingId;
  const mr = mediaRecorder;

  await new Promise((resolve) => {
    mr.addEventListener(
      "stop",
      async () => {
        if (capturedStream) {
          capturedStream.getTracks().forEach((t) => t.stop());
          capturedStream = null;
        }
        if (token && origin && id) {
          const blob = new Blob(chunks, { type: mr.mimeType || "audio/webm" });
          chunks = [];
          const form = new FormData();
          form.append("audio", blob, "capture.webm");
          try {
            await fetch(`${origin}/api/meetings/${id}/audio`, {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` },
              body: form,
            });
          } catch {
            /* ignore */
          }
        }
        meetingId = null;
        mediaRecorder = null;
        accessToken = null;
        apiOrigin = null;
        const tab = captureTabId;
        captureTabId = null;
        await chrome.storage.local.remove("outvoiceRecording");
        resolve(undefined);
      },
      { once: true }
    );
    mr.stop();
  });
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "outvoice-offscreen") return;
  port.onMessage.addListener(async (msg) => {
    if (msg?.type === "START") {
      try {
        await handleStart(msg);
        port.postMessage({ type: "START_DONE", id: msg.id, ok: true });
      } catch (e) {
        await chrome.storage.local.remove("outvoiceRecording");
        port.postMessage({
          type: "START_DONE",
          id: msg.id,
          ok: false,
          error: e instanceof Error ? e.message : "Could not start capture.",
        });
      }
    } else if (msg?.type === "STOP") {
      try {
        await handleStop();
        port.postMessage({ type: "STOP_DONE", id: msg.id, ok: true });
      } catch (e) {
        port.postMessage({
          type: "STOP_DONE",
          id: msg.id,
          ok: false,
          error: e instanceof Error ? e.message : "Stop failed.",
        });
      }
    }
  });
});
