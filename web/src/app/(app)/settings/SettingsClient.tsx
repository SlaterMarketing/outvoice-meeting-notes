"use client";

import { useState } from "react";

export default function SettingsClient() {
  const [key, setKey] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkCode, setLinkCode] = useState<string | null>(null);

  async function saveKey(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ttsaiApiKey: key }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMsg(data.error ?? "Could not save.");
        return;
      }
      setMsg("Saved.");
      setKey("");
    } finally {
      setBusy(false);
    }
  }

  async function createLinkCode() {
    setLinkCode(null);
    setLinkBusy(true);
    try {
      const res = await fetch("/api/extension/link-code", { method: "POST" });
      const data = (await res.json()) as { code?: string; error?: string };
      if (!res.ok) {
        setMsg(data.error ?? "Could not create code.");
        return;
      }
      setLinkCode(data.code ?? null);
      setMsg(null);
    } finally {
      setLinkBusy(false);
    }
  }

  return (
    <>
      <section className="flex flex-col gap-4 border-t border-zinc-200 pt-8 dark:border-zinc-800">
        <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Backup: connection code
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          The capture helper can sign you in with the browser. If you need a fallback (some
          self-hosted setups), create a short code here and paste it under &quot;Other
          setup&quot; in the helper. Codes expire in ten minutes.
        </p>
        <button
          type="button"
          onClick={createLinkCode}
          disabled={linkBusy}
          className="w-fit rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {linkBusy ? "Creating…" : "New backup code"}
        </button>
        {linkCode && (
          <p className="font-mono text-2xl font-semibold tracking-[0.2em] text-zinc-900 dark:text-zinc-50">
            {linkCode}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-4 border-t border-zinc-200 pt-8 dark:border-zinc-800">
        <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Optional: your own processing key
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          If your workspace does not supply one automatically, paste the key from your TTS.ai
          account. When the server already has a key configured, that one is used first. Leave
          blank and save to clear.
        </p>
        <form onSubmit={saveKey} className="flex max-w-md flex-col gap-3">
          <input
            type="password"
            autoComplete="off"
            placeholder="sk-tts-…"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
          />
          {msg && <p className="text-sm text-zinc-600 dark:text-zinc-400">{msg}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-fit rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </form>
      </section>
    </>
  );
}
