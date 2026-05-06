import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <header className="border-b border-zinc-200/80 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <BrandLogo compact href="/" wordmarkClassName="text-zinc-900 dark:text-zinc-50" />
          <Link
            href="/login"
            className="text-sm font-medium text-zinc-600 underline-offset-4 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Sign in
          </Link>
        </div>
      </header>
      {children}
      <footer className="mt-auto border-t border-zinc-200/80 py-6 text-center text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        <p className="mx-auto max-w-lg leading-relaxed">
          You are responsible for following the rules of your calls and any laws where you
          record. Only capture when everyone involved agrees it is appropriate.
        </p>
      </footer>
    </div>
  );
}
