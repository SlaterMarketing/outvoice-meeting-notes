import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Outvoice — Meeting notes",
  description: "Capture calls in the browser, then read notes and follow-ups in your library.",
};

function ShellLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-sm text-zinc-700 underline-offset-4 hover:underline dark:text-zinc-300"
    >
      {children}
    </Link>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
        <header className="border-b border-zinc-200/80 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
          <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
            <ShellLink href="/">Outvoice</ShellLink>
            <nav className="flex gap-4">
              <ShellLink href="/dashboard">Library</ShellLink>
              <ShellLink href="/settings">Settings</ShellLink>
            </nav>
          </div>
        </header>
        {children}
        <footer className="mt-auto border-t border-zinc-200/80 py-6 text-center text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          <p className="mx-auto max-w-lg leading-relaxed">
            You are responsible for following the rules of your calls and any laws where you
            record. Only capture when everyone involved agrees it is appropriate.
          </p>
        </footer>
      </body>
    </html>
  );
}
