import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/db";
import { meetings } from "@/db/schema";
import { and, eq } from "drizzle-orm";

type Summary = {
  notes?: string;
  actionItems?: { task: string; owner: string | null }[];
};

export default async function MeetingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const row = await db
    .select()
    .from(meetings)
    .where(and(eq(meetings.id, id), eq(meetings.userId, session.sub)))
    .limit(1);
  const m = row[0];
  if (!m) notFound();

  let summary: Summary | null = null;
  if (m.summaryJson) {
    try {
      summary = JSON.parse(m.summaryJson) as Summary;
    } catch {
      summary = null;
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10">
      <div className="flex flex-col gap-2">
        <Link
          href="/dashboard"
          className="text-sm text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400"
        >
          ← Library
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          {m.title?.trim() || "Session"}
        </h1>
        <p className="text-xs text-zinc-500">
          {m.platform} · {m.status}
          {m.updatedAt ? ` · Updated ${new Date(m.updatedAt).toLocaleString()}` : ""}
        </p>
      </div>

      {m.processingError && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
          {m.processingError}
        </p>
      )}

      {summary?.notes && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Short notes</h2>
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
            {summary.notes}
          </div>
        </section>
      )}

      {summary?.actionItems && summary.actionItems.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Follow-ups</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {summary.actionItems.map((item, i) => (
              <li key={i}>
                {item.task}
                {item.owner ? (
                  <span className="text-zinc-500"> — {item.owner}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      )}

      {m.transcript && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Transcript</h2>
          <div className="max-h-[480px] overflow-auto rounded-md border border-zinc-200 bg-white p-4 text-sm leading-relaxed text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
            {m.transcript}
          </div>
        </section>
      )}

      {!m.transcript && m.status !== "failed" && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Transcript will appear here once processing finishes.
        </p>
      )}
    </main>
  );
}
