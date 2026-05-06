"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDevCode(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as {
        error?: string;
        devCode?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      if (data.devCode) {
        setDevCode(data.devCode);
        return;
      }
      router.push(`/verify?email=${encodeURIComponent(email.trim().toLowerCase())}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        We will email you a six-digit code. No password to remember.
      </p>
      {devCode && (
        <div className="mt-4 flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          <p>
            Email is not configured in this environment. Use this code:{" "}
            <span className="font-mono font-medium">{devCode}</span>
          </p>
          <button
            type="button"
            onClick={() =>
              router.push(
                `/verify?email=${encodeURIComponent(email.trim().toLowerCase())}`
              )
            }
            className="w-fit rounded-md bg-amber-900 px-3 py-1.5 text-xs font-medium text-amber-50 hover:bg-amber-800 dark:bg-amber-200 dark:text-amber-950 dark:hover:bg-amber-100"
          >
            Enter code
          </button>
        </div>
      )}
      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700 dark:text-zinc-300">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-base outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {busy ? "Sending…" : "Email me a code"}
        </button>
      </form>
    </main>
  );
}
