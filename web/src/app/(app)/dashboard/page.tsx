import Link from "next/link";
import { SignOutButton } from "./SignOutButton";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/db";
import { meetings } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const rows = await db
    .select({
      id: meetings.id,
      title: meetings.title,
      platform: meetings.platform,
      status: meetings.status,
      createdAt: meetings.createdAt,
    })
    .from(meetings)
    .where(eq(meetings.userId, session.sub))
    .orderBy(desc(meetings.createdAt))
    .limit(100);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10">
      <div className="flex flex-col gap-2 border-b border-zinc-200 pb-6 dark:border-zinc-800">
        <h1 className="text-2xl font-semibold tracking-tight">Library</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Signed in as {session.email}. Capture from your browser tab, then open a session
          here for the transcript and follow-ups.
        </p>
        <SignOutButton />
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No sessions yet. Connect capture in Settings, start a call in your browser, then use
          the capture helper to begin.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {rows.map((m) => (
            <li key={m.id} className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Link
                  href={`/meetings/${m.id}`}
                  className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                >
                  {m.title?.trim() || "Untitled session"}
                </Link>
                <p className="text-xs text-zinc-500">
                  {m.platform} · {m.status} ·{" "}
                  {m.createdAt ? new Date(m.createdAt).toLocaleString() : ""}
                </p>
              </div>
              <Link
                href={`/meetings/${m.id}`}
                className="text-sm text-zinc-700 underline-offset-4 hover:underline dark:text-zinc-300"
              >
                Open
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
