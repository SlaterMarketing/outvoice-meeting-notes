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
/** @type {AudioContext | null} */
let tabAudioMonitor = null;

/* chrome.storage is not available in offscreen documents; the service worker persists state. */
function persistRecordingState(meetingId, tabId) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: "OUTVOICE_INTERNAL_SET_RECORDING", meetingId, tabId },
      (res) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(res);
      }
    );
  });
}

function clearRecordingState() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "OUTVOICE_INTERNAL_CLEAR_RECORDING" }, () => {
      resolve(undefined);
    });
  });
}

/**
 * Chrome expects matching audio + video tab constraints when using a stream id from tabCapture
 * in an offscreen document (video tracks can be stopped immediately; we only record audio).
 * See https://developer.chrome.com/docs/extensions/how-to/web-platform/screen-capture
 *
 * @param {string} streamId
 * @returns {Promise<MediaStream>}
 */
async function getTabAudioStream(streamId) {
  // @ts-ignore chromeMediaSource is extension-specific
  const raw = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: "tab",
        chromeMediaSourceId: streamId,
      },
    },
    video: {
      mandatory: {
        chromeMediaSource: "tab",
        chromeMediaSourceId: streamId,
      },
    },
  });
  raw.getVideoTracks().forEach((t) => t.stop());
  const audioTracks = raw.getAudioTracks();
  return audioTracks.length ? new MediaStream(audioTracks) : raw;
}

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

  if (!streamId?.trim()) {
    throw new Error("No capture stream from the browser.");
  }

  const stream = await getTabAudioStream(streamId);
  capturedStream = stream;

  /* So the meeting keeps playing aloud while we record (Chrome tab capture default). */
  try {
    tabAudioMonitor = new AudioContext();
    tabAudioMonitor.createMediaStreamSource(stream).connect(tabAudioMonitor.destination);
  } catch (e) {
    stream.getTracks().forEach((t) => t.stop());
    capturedStream = null;
    throw e instanceof Error ? e : new Error("Could not open tab audio.");
  }

  const startRes = await fetch(`${apiOrigin}/api/meetings/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ tabUrl, title }),
  });
  let startJson = /** @type {{ meetingId?: string; error?: string }} */ ({});
  try {
    const text = await startRes.text();
    if (text) startJson = JSON.parse(text);
  } catch {
    startJson = {};
  }
  if (!startRes.ok) {
    stream.getTracks().forEach((t) => t.stop());
    capturedStream = null;
    if (tabAudioMonitor) {
      await tabAudioMonitor.close();
      tabAudioMonitor = null;
    }
    throw new Error(startJson.error || "Could not start session.");
  }
  meetingId = startJson.meetingId || null;
  if (!meetingId) {
    stream.getTracks().forEach((t) => t.stop());
    capturedStream = null;
    if (tabAudioMonitor) {
      await tabAudioMonitor.close();
      tabAudioMonitor = null;
    }
    throw new Error("Bad response from library.");
  }

  chunks = [];
  let mime = "audio/webm;codecs=opus";
  if (!MediaRecorder.isTypeSupported(mime)) {
    mime = "audio/webm";
  }
  try {
    try {
      mediaRecorder = new MediaRecorder(stream, {
        mimeType: mime,
        audioBitsPerSecond: 128000,
      });
    } catch {
      mediaRecorder = new MediaRecorder(stream, { mimeType: mime });
    }
    mediaRecorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) chunks.push(ev.data);
    };
    /* No timeslice: one reliable blob on stop (chunked mode often yields empty STT for short clips). */
    mediaRecorder.start();

    await persistRecordingState(meetingId, /** @type {number} */ (captureTabId));
  } catch (e) {
    stream.getTracks().forEach((t) => t.stop());
    capturedStream = null;
    meetingId = null;
    if (tabAudioMonitor) {
      try {
        await tabAudioMonitor.close();
      } catch {
        /* ignore */
      }
      tabAudioMonitor = null;
    }
    mediaRecorder = null;
    throw e instanceof Error ? e : new Error("Could not start recording.");
  }
}

async function handleStop() {
  if (!mediaRecorder || mediaRecorder.state === "inactive") {
    await clearRecordingState();
    return;
  }

  const token = accessToken;
  const origin = apiOrigin;
  const id = meetingId;
  const mr = mediaRecorder;

  if (mr.state === "recording") {
    try {
      mr.requestData();
    } catch {
      /* ignore */
    }
  }

  await new Promise((resolve) => {
    mr.addEventListener(
      "stop",
      async () => {
        if (tabAudioMonitor) {
          try {
            await tabAudioMonitor.close();
          } catch {
            /* ignore */
          }
          tabAudioMonitor = null;
        }
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
            const res = await fetch(`${origin}/api/meetings/${id}/audio`, {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` },
              body: form,
            });
            if (!res.ok) {
              const detail = await res.text().catch(() => "");
              console.warn(
                "[Outvoice] Audio upload failed:",
                res.status,
                detail.slice(0, 300)
              );
            }
          } catch (e) {
            console.warn(
              "[Outvoice] Audio upload error:",
              e instanceof Error ? e.message : e
            );
          }
        }
        meetingId = null;
        mediaRecorder = null;
        accessToken = null;
        apiOrigin = null;
        captureTabId = null;
        await clearRecordingState();
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
        await clearRecordingState();
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
