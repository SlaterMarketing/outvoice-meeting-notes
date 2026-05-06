import Image from "next/image";
import Link from "next/link";

type BrandLogoProps = {
  /** Link target; omit for non-clickable mark */
  href?: string;
  className?: string;
  /** Max height in pixels (tailwind h-*) */
  compact?: boolean;
};

export function BrandLogo({ href, className = "", compact }: BrandLogoProps) {
  const h = compact ? "h-7" : "h-8";
  const img = (
    <Image
      src="/outvoice.png"
      alt="Outvoice"
      width={200}
      height={56}
      className={`${h} w-auto ${className}`}
      priority
    />
  );
  if (href != null && href !== "") {
    return (
      <Link href={href} className="inline-flex items-center shrink-0 ring-offset-2 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[#1a1917]/30 rounded-sm">
        {img}
      </Link>
    );
  }
  return <span className="inline-flex items-center justify-center">{img}</span>;
}
