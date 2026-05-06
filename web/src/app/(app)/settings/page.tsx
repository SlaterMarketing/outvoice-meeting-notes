import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Connect the browser capture helper and optionally add your own processing key if you are
          not using the hosted setup.
        </p>
      </div>
      <SettingsClient />
    </main>
  );
}
