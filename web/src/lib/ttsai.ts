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
  language?: string;
  duration?: number;
  segments?: SttSegment[];
  error?: string;
  detail?: string;
};

function extractSttText(data: SttResponse): string {
  const direct = data.text?.trim();
  if (direct) return direct;
  const fromSegments = data.segments
    ?.map((s) => s.text?.trim())
    .filter((t): t is string => Boolean(t))
    .join(" ")
    .trim();
  return fromSegments || "";
}

type VoiceChatResponse = {
  ai_text?: string;
  error?: string;
  detail?: string;
};

export async function transcribeWithTtsAi(
  audioBuffer: Buffer,
  filename: string,
  mime: string,
  apiKey: string
): Promise<string> {
  const base = getTtsAiBaseUrl();
  const form = new FormData();
  const blob = new Blob([new Uint8Array(audioBuffer)], { type: mime });
  form.append("file", blob, filename);
  form.append("model", process.env.TTS_AI_STT_MODEL ?? "faster-whisper");
  form.append("language", process.env.TTS_AI_STT_LANGUAGE ?? "auto");

  const res = await fetch(`${base}/stt/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  const data = (await res.json().catch(() => ({}))) as SttResponse;
  if (!res.ok) {
    throw new Error(
      data.error || data.detail || `Speech-to-text failed (${res.status})`
    );
  }
  const text = extractSttText(data);
  if (!text) {
    console.warn("[ttsai/stt] empty transcript", {
      duration: data.duration,
      segmentCount: data.segments?.length ?? 0,
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
