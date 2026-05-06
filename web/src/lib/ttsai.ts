const DEFAULT_BASE = "https://api.tts.ai/v1";

export function getTtsAiBaseUrl() {
  return (process.env.TTS_AI_API_BASE ?? DEFAULT_BASE).replace(/\/$/, "");
}

export function getTtsAiApiKey(
  userKey: string | null | undefined
): string | null {
  const fromUser = userKey?.trim();
  const fromEnv = process.env.TTS_AI_API_KEY?.trim();
  /* Env wins so Vercel/host config is never shadowed by an old value in Settings. */
  const key = fromEnv || fromUser || "";
  return key || null;
}

const SUMMARY_SYSTEM = `You turn meeting transcripts into structured notes. Reply with ONLY valid JSON (no markdown fences) with keys:
- "notes": string (concise, bullet-style summary using plain text lines starting with - where helpful)
- "actionItems": array of { "task": string, "owner": string | null }
Use an empty array for actionItems if there are none.`;

type SttSegment = {
  start?: number;
  end?: number;
  text?: string;
  speaker?: string;
};

type SttResponse = {
  text?: string;
  transcription?: string;
  transcript?: string;
  language?: string;
  duration?: number;
  segments?: SttSegment[];
  error?: string;
  detail?: string;
};

function extractSttText(data: Record<string, unknown>): string {
  const tryStr = (v: unknown): string | null => {
    if (typeof v === "string" && v.trim()) return v.trim();
    return null;
  };

  for (const key of ["text", "transcription", "transcript", "output_text"] as const) {
    const t = tryStr(data[key]);
    if (t) return t;
  }

  const dataObj = data.data;
  if (dataObj && typeof dataObj === "object") {
    const inner = dataObj as Record<string, unknown>;
    for (const key of ["text", "transcription", "transcript"] as const) {
      const t = tryStr(inner[key]);
      if (t) return t;
    }
  }
  const nested = data.result;
  if (nested && typeof nested === "object") {
    const r = nested as Record<string, unknown>;
    for (const key of ["text", "transcription", "transcript"] as const) {
      const t = tryStr(r[key]);
      if (t) return t;
    }
  }

  const segs = data.segments;
  if (Array.isArray(segs)) {
    const fromSegments = segs
      .map((s) => {
        if (s && typeof s === "object" && "text" in s)
          return tryStr((s as { text?: unknown }).text);
        return null;
      })
      .filter((t): t is string => Boolean(t))
      .join(" ")
      .trim();
    if (fromSegments) return fromSegments;
  }

  return "";
}

type VoiceChatResponse = {
  ai_text?: string;
  error?: string;
  detail?: string;
};

const STT_POLL_MS = 1800;
const STT_POLL_DEADLINE_MS = 180_000;

/**
 * Some deployments queue STT and return uuid + status before text is ready.
 */
async function resolveSttResponseJson(
  base: string,
  apiKey: string,
  initial: Record<string, unknown>
): Promise<Record<string, unknown>> {
  let data = initial;
  const uuid =
    typeof data.uuid === "string"
      ? data.uuid
      : typeof data.job_id === "string"
        ? data.job_id
        : null;
  const status0 = typeof data.status === "string" ? data.status.toLowerCase() : "";
  const needsPoll =
    uuid &&
    extractSttText(data) === "" &&
    (status0 === "queued" || status0 === "processing" || status0 === "pending");
  if (!needsPoll) {
    return data;
  }

  const deadline = Date.now() + STT_POLL_DEADLINE_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, STT_POLL_MS));
    const pollRes = await fetch(
      `${base}/speech/results/?uuid=${encodeURIComponent(uuid)}`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );
    const pollRaw = await pollRes.text().catch(() => "");
    try {
      data = pollRaw ? (JSON.parse(pollRaw) as Record<string, unknown>) : {};
    } catch {
      continue;
    }
    const st = typeof data.status === "string" ? data.status.toLowerCase() : "";
    if (st === "failed") {
      const err =
        typeof data.error === "string"
          ? data.error
          : typeof data.detail === "string"
            ? data.detail
            : "Speech-to-text job failed";
      throw new Error(err);
    }
    if (extractSttText(data)) {
      return data;
    }
    if (st !== "queued" && st !== "processing" && st !== "pending" && st !== "") {
      return data;
    }
  }
  return initial;
}

export async function transcribeWithTtsAi(
  audioBuffer: Buffer,
  filename: string,
  mime: string,
  apiKey: string
): Promise<string> {
  const base = getTtsAiBaseUrl();
  const form = new FormData();
  /* File (not raw Blob) ensures multipart filename/body are sent reliably in Node fetch. */
  const file = new File([new Uint8Array(audioBuffer)], filename, { type: mime });
  form.append("file", file);
  /* API default is whisper; faster-whisper has regressed on some WebM/opus uploads. */
  form.append("model", process.env.TTS_AI_STT_MODEL ?? "whisper");
  const lang = (process.env.TTS_AI_STT_LANGUAGE ?? "").trim();
  if (lang && lang.toLowerCase() !== "auto") {
    form.append("language", lang);
  }

  const res = await fetch(`${base}/stt/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  const rawText = await res.text().catch(() => "");
  let data: Record<string, unknown> = {};
  if (rawText) {
    try {
      data = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      data = {};
    }
  }

  if (!res.ok) {
    const err =
      typeof (data as SttResponse).error === "string"
        ? (data as SttResponse).error
        : typeof (data as SttResponse).detail === "string"
          ? (data as SttResponse).detail
          : undefined;
    throw new Error(err || `Speech-to-text failed (${res.status})`);
  }

  try {
    data = await resolveSttResponseJson(base, apiKey, data);
  } catch (e) {
    if (e instanceof Error) throw e;
    throw new Error("Speech-to-text polling failed");
  }

  const text = extractSttText(data);
  if (!text) {
    const segLen = Array.isArray(data.segments) ? data.segments.length : 0;
    const keys = data && typeof data === "object" ? Object.keys(data).join(",") : "";
    console.warn("[ttsai/stt] empty transcript", {
      audioBytes: audioBuffer.length,
      duration: data.duration,
      segmentCount: segLen,
      responseKeys: keys || "(unparsed)",
      bodySample: rawText.slice(0, 400),
    });
    throw new Error(
      "No speech was found in this recording. Record a bit longer with the meeting tab unmuted and selected, or try again when others are speaking."
    );
  }
  return text;
}

export async function summarizeWithTtsAiVoiceChat(
  transcript: string,
  apiKey: string
): Promise<{
  notes: string;
  actionItems: { task: string; owner: string | null }[];
}> {
  const base = getTtsAiBaseUrl();
  const voice = process.env.TTS_AI_VOICE_CHAT_VOICE ?? "af_bella";
  const text = transcript.slice(0, 120_000);

  let res = await fetch(`${base}/voice-chat/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      voice,
      system_prompt: SUMMARY_SYSTEM,
    }),
  });

  if (res.status === 415 || res.status === 400) {
    const form = new FormData();
    form.append("text", text);
    form.append("voice", voice);
    form.append("system_prompt", SUMMARY_SYSTEM);
    res = await fetch(`${base}/voice-chat/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
  }

  const data = (await res.json().catch(() => ({}))) as VoiceChatResponse;
  if (!res.ok) {
    throw new Error(
      data.error || data.detail || `Notes step failed (${res.status})`
    );
  }

  const raw = data.ai_text?.trim();
  if (!raw) {
    return {
      notes: "Could not generate structured notes from this transcript.",
      actionItems: [],
    };
  }

  try {
    const parsed = JSON.parse(raw) as {
      notes?: string;
      actionItems?: { task: string; owner: string | null }[];
    };
    return {
      notes: parsed.notes ?? raw,
      actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
    };
  } catch {
    return { notes: raw, actionItems: [] };
  }
}

export async function transcribeAndSummarize(
  audioBuffer: Buffer,
  mime: string,
  filename: string,
  apiKey: string
) {
  const transcript = await transcribeWithTtsAi(
    audioBuffer,
    filename,
    mime,
    apiKey
  );
  const summary = await summarizeWithTtsAiVoiceChat(transcript, apiKey);
  return { transcript, summary };
}
