# Cookie Auth & Workspace Setup

The frontend and Pages Functions now expect a Cloudflare D1 binding named `DB`.

## 1. Create and migrate D1

Create a D1 database in Cloudflare, bind it to the Pages project as `DB`, then apply the migration:

```bash
npx wrangler d1 migrations apply <DATABASE_NAME> --remote
```

The repository migration is `migrations/0001_auth_workspace.sql`.

For a separate non-production preview database, create one and apply the same migration to that database before testing preview deployments.

## 2. Add Cloudflare Pages secrets

Add these as encrypted secrets/variables. Use both Preview and Production environments when both deployments need auth.

### Email / Nodemailer SMTP

- `SMTP_HOST`
- `SMTP_PORT` (465 for implicit TLS, or 587 for STARTTLS)
- `SMTP_SECURE` (`true` for 465, `false` for 587)
- `SMTP_USER`
- `SMTP_PASS`
- `EMAIL_FROM`
- Optional: `SMTP_TLS_SERVERNAME`

### OAuth

Google:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

GitHub:
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`

Discord:
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`

### Application

- `APP_URL` = the exact public origin users sign in from

### AI / images

The existing AI configuration remains required:
- `OLLAMA_API_KEY`
- `OLLAMA_URL` (optional; defaults to `https://ollama.com/api/chat`)
- `OPENAI_API_KEY` is required only for Cookie image generation/editing.

## 3. Configure OAuth redirect URLs

For each provider, register the exact callback URL for each environment.

Production:

```
https://YOUR-DOMAIN/api/auth/callback/google
https://YOUR-DOMAIN/api/auth/callback/github
https://YOUR-DOMAIN/api/auth/callback/discord
```

Preview:

```
https://YOUR-PREVIEW.pages.dev/api/auth/callback/google
https://YOUR-PREVIEW.pages.dev/api/auth/callback/github
https://YOUR-PREVIEW.pages.dev/api/auth/callback/discord
```

The redirect URI configured at the provider must match the URI Cookie sends.

## 4. What is now persistent

Once `DB` is bound and migrated, Cookie accounts support:

- email/password authentication
- one-time email verification codes
- one-time verification links
- password reset links
- Google/GitHub/Discord OAuth
- secure session cookies
- account profile persistence
- chat history across sessions
- long-term memory
- persistent Projects and text files
- free-plan credit accounting

Temporary generated response files remain temporary artifacts. Generated images are returned to the chat and are not stored in the D1 chat-history payload.

## 5. Important security notes

Do not put OAuth client secrets, SMTP passwords, Ollama keys, or OpenAI keys in `src/`, `.env` committed to Git, or client-side JavaScript. Keep them in Cloudflare Pages secrets.

The app uses hashed session tokens, HttpOnly/Secure cookies, time-limited one-time email tokens, PBKDF2 password hashing, login-attempt throttling, and OAuth state validation.
