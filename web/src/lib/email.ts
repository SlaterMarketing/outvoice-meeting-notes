import { Resend } from "resend";

export function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

/** Resend `from`: full override, or built from domain + optional name/local part. */
function resolveFromAddress(): string {
  const full = process.env.EMAIL_FROM?.trim();
  if (full) return full;

  const domain = process.env.EMAIL_FROM_DOMAIN?.trim();
  if (domain) {
    const host = domain.replace(/^https?:\/\//i, "").split("/")[0] ?? domain;
    const local = (process.env.EMAIL_FROM_LOCAL ?? "noreply").trim() || "noreply";
    const name = (process.env.EMAIL_FROM_NAME ?? "Outvoice").trim() || "Outvoice";
    return `${name} <${local}@${host}>`;
  }

  return "Outvoice <onboarding@resend.dev>";
}

export async function sendLoginCodeEmail(email: string, code: string) {
  const resend = getResend();
  const from = resolveFromAddress();

  if (!resend) {
    console.warn("[email] RESEND_API_KEY missing; code for", email, code);
    return { ok: false as const, devCode: code };
  }

  await resend.emails.send({
    from,
    to: email,
    subject: "Your sign-in code",
    text: `Your sign-in code is: ${code}\n\nIt expires in 10 minutes.`,
  });

  return { ok: true as const };
}
