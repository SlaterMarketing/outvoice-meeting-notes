import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col bg-[#f7f5f2] text-[#1a1917]">
      <header className="border-b border-[#1a1917]/10 bg-[#f7f5f2]/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 md:px-8">
          <BrandLogo href="/" />
          <nav className="flex items-center gap-6">
            <Link
              href="/login"
              className="text-sm font-medium text-[#1a1917]/75 transition hover:text-[#1a1917]"
            >
              Sign in
            </Link>
            <Link
              href="/login"
              className="rounded-full bg-[#1a1917] px-4 py-2 text-sm font-medium text-[#f7f5f2] transition hover:bg-[#2d2c29]"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>
      {children}
      <footer className="border-t border-[#1a1917]/10 py-10 text-center text-xs text-[#1a1917]/55">
        <p className="mx-auto max-w-md leading-relaxed">
          You are responsible for following the rules of your calls and any laws where you
          record. Only capture when everyone involved agrees it is appropriate.
        </p>
      </footer>
    </div>
  );
}
