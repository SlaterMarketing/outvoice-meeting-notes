/** Prevent open redirects after sign-in. */
export function safePostLoginPath(next: string | null | undefined): string {
  if (!next || typeof next !== "string") return "/dashboard";
  const t = next.trim();
  if (!t.startsWith("/") || t.startsWith("//")) return "/dashboard";
  return t;
}
