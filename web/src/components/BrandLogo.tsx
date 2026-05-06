import Image from "next/image";
import Link from "next/link";

type BrandLogoProps = {
  /** Link target; omit for non-clickable mark */
  href?: string;
  className?: string;
  /** Extra classes on the outer link/span */
  wrapperClassName?: string;
  /** Max height of the mark (roughly one line of the wordmark) */
  compact?: boolean;
  /** Larger wordmark for landing hero */
  prominent?: boolean;
  /** Tailwind for “utvoice” (defaults to marketing ink) */
  wordmarkClassName?: string;
};

export function BrandLogo({
  href,
  className = "",
  wrapperClassName = "",
  compact,
  prominent,
  wordmarkClassName = "text-[#1a1917]",
}: BrandLogoProps) {
  const markSize = prominent
    ? "h-[1.6rem] w-[1.6rem] sm:h-[1.8rem] sm:w-[1.8rem] md:h-[2.0rem] md:w-[2.0rem]"
    : compact
      ? "h-[1.4rem] w-[1.4rem]"
      : "h-[1.6rem] w-[1.6rem]";
  const textSize = prominent
    ? "text-[2.125rem] sm:text-[2.375rem] md:text-[2.625rem]"
    : compact
      ? "text-[1.53125rem]"
      : "text-[1.875rem]";

  const mark = (
    <Image
      src="/outvoice.png"
      alt=""
      width={512}
      height={512}
      className={`${markSize} shrink-0 object-contain ${className}`}
      priority
    />
  );

  const type = (
    <span
      className={`${textSize} font-display font-medium leading-none tracking-tight ${wordmarkClassName}`}
    >
      utvoice
    </span>
  );

  if (href != null && href !== "") {
    return (
      <Link
        href={href}
        aria-label="Outvoice"
        className={`inline-flex items-center gap-[0.05rem] rounded-sm ring-offset-2 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[#1a1917]/30 dark:focus-visible:ring-zinc-400/40 ${wrapperClassName}`}
      >
        {mark}
        {type}
      </Link>
    );
  }

  return (
    <span
      className={`inline-flex items-center justify-center gap-[0.1rem] ${wrapperClassName}`}
      role="img"
      aria-label="Outvoice"
    >
      {mark}
      {type}
    </span>
  );
}
