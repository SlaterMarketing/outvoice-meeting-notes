# Outvoice (OSS)

Capture meeting audio from **Google Meet**, **Zoom (web)**, or **Microsoft Teams (web)** in Chrome, then open **notes and follow-ups** in your **library** web app.

- **`web/`** — Next.js companion app (sign-in, library, settings, processing API).
- **`extension/`** — Chrome MV3 capture helper (load unpacked in `chrome://extensions`).

## Quick start (development)

1. **Database** — Create a Postgres database (e.g. [Neon](https://neon.tech)). Set `DATABASE_URL` in `web/.env.local`.

2. **Web app**
   ```bash
   cd web
   cp .env.example .env.local
   # Edit .env.local — at minimum DATABASE_URL and AUTH_SECRET (≥16 chars)
   npm run db:push
   npm run dev
   ```

   **Deployed app:** run `npm run db:push` from `web/` with the **production** `DATABASE_URL` in your environment, or run [`web/scripts/init-schema.sql`](web/scripts/init-schema.sql) in Neon’s SQL Editor. Otherwise you may see `relation "login_codes" does not exist` on sign-in.

3. **Email** — Set `RESEND_API_KEY` and a verified sending identity: **`EMAIL_FROM_DOMAIN`** (we send as `noreply@` that domain with optional `EMAIL_FROM_NAME` / `EMAIL_FROM_LOCAL`), or set **`EMAIL_FROM`** to a full `Name <addr>` string to override. If Resend is missing, the API logs the code on the server and the login screen can show a dev fallback after requesting a code.

4. **Processing** — Set `TTS_AI_API_KEY` from [TTS.ai](https://tts.ai/api/) (speech-to-text + notes), or sign in and add your key under **Settings** (BYO).

5. **Extension** — Chrome → Extensions → Developer mode → **Load unpacked** → select the `extension/` folder. Set **Library address** to `http://localhost:3000` (or your deployed URL), then sign in on the web app → **Settings** → **New connection code** and paste the code into the capture helper.

## Self-hosting (advanced)

Same as above, but you deploy `web/` (e.g. Vercel, Docker) and point the capture helper at your public URL. Provide Postgres, `AUTH_SECRET`, optional `RESEND_*` / `EMAIL_FROM_DOMAIN` (or `EMAIL_FROM`), and `TTS_AI_API_KEY` (or leave it unset and rely on per-user keys in Settings).

If you already had data in `openai_api_key`, run `npm run db:push` after pulling, then move those values to `ttsai_api_key` in SQL if needed.

`docker-compose.yml` at the repo root runs Postgres only — use
`postgresql://outvoice:outvoice@localhost:5432/outvoice` as `DATABASE_URL` when you want a local database instead of Neon.

## Consent and use

You are responsible for following meeting policies and applicable laws. The web footer and the capture helper’s first screen state this in plain language.
