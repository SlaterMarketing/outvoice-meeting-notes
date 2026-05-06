const DEFAULT_BASE = "https://api.tts.ai/v1";

export function getTtsAiBaseUrl() {
  return (process.env.TTS_AI_API_BASE ?? DEFAULT_BASE).replace(/\/$/, "");
}

export function getTtsAiApiKey(
  userKey: string | null | undefined
): string | null {
  const fromUser = userKey?.trim();
  const fromEnv = process.env.TTS_AI_API_KEY?.trim();
  const key = fromUser || fromEnv || "";
  return key || null;
}

const SUMMARY_SYSTEM = `You turn meeting transcripts into structured notes. Reply with ONLY valid JSON (no markdown fences) with keys:
- "notes": string (concise, bullet-style summary using plain text lines starting with - where helpful)
- "actionItems": array of { "task": string, "owner": string | null }
Use an empty array for actionItems if there are none.`;

type SttResponse = {
  text?: string;
  error?: string;
  detail?: string;
};

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
  const blob = new Blob([audioBuffer], { type: mime });
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
  const text = data.text?.trim();
  if (!text) {
    throw new Error("Speech-to-text returned no text.");
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
