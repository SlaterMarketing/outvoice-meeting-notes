import { Resend } from "resend";

export function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

/** Brand tokens (aligned with marketing layout). */
const BG = "#f7f5f2";
const INK = "#1a1917";
const INK_MUTED = "rgba(26,25,23,0.62)";
const ACCENT = "#c45c3e";
const CARD = "#ffffff";
const BORDER = "rgba(26,25,23,0.10)";

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

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function loginCodeEmailHtml(code: string) {
  const safe = escapeHtml(code);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>Sign in</title>
</head>
<body style="margin:0;padding:0;background-color:${BG};-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:${BG};border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:40px 20px 48px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;border-collapse:collapse;">
          <tr>
            <td style="padding:0 0 28px;text-align:center;">
              <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:600;letter-spacing:-0.02em;color:${INK};">
                Outvoice
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:${CARD};border-radius:16px;border:1px solid ${BORDER};padding:32px 28px 36px;">
              <p style="margin:0 0 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;color:${ACCENT};">
                Sign in
              </p>
              <h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:500;line-height:1.2;letter-spacing:-0.02em;color:${INK};">
                Your six-digit code
              </h1>
              <p style="margin:0 0 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:16px;line-height:1.55;color:${INK_MUTED};">
                Enter this code on the sign-in screen. It expires in ten minutes.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                <tr>
                  <td align="center" style="background-color:${BG};border-radius:12px;border:1px solid ${BORDER};padding:20px 16px;">
                    <p style="margin:0;font-family:'SF Mono','Segoe UI Mono',Consolas,monospace;font-size:28px;font-weight:600;letter-spacing:0.35em;color:${INK};">
                      ${safe}
                    </p>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:13px;line-height:1.5;color:${INK_MUTED};">
                If you did not request this email, you can ignore it.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 8px 0;text-align:center;">
              <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:12px;line-height:1.5;color:${INK_MUTED};">
                Capture Meet, Zoom, and Teams in Chrome—notes and follow-ups in one library.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
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
    subject: "Your Outvoice sign-in code",
    text: `Your sign-in code is: ${code}\n\nIt expires in 10 minutes.\n\nIf you did not request this, you can ignore this email.`,
    html: loginCodeEmailHtml(code),
  });

  return { ok: true as const };
}
