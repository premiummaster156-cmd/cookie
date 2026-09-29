# Cookie Node.js backend

Cookie now has a Node.js backend with:

- SQLite database in data/cookie.db
- Nodemailer SMTP email
- email verification
- password reset
- HttpOnly sessions
- server-side plan checks
- Ollama Cloud chat
- basic rate limiting
- static frontend serving
- no Resend
- no Cloudflare D1

## Start

npm install
npm start

## Gmail + Nodemailer

SMTP_SERVICE=gmail
SMTP_USER=your-cookie-email@gmail.com
SMTP_PASS=your-16-character-google-app-password
AUTH_FROM_EMAIL=Cookie <your-cookie-email@gmail.com>

Google requires 2-Step Verification before an App Password can be created.

## Other SMTP providers

SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your@email.com
SMTP_PASS=your-password
AUTH_FROM_EMAIL=Cookie <your@email.com>

## AI

OLLAMA_API_KEY=your_ollama_key
OLLAMA_MODEL=gpt-oss:120b-cloud

Optional:
COOKIE_PUBLIC_URL=https://your-cookie-domain.kdns.fr
COOKIE_SECURE=true
PORT=3000

Never commit real credentials.

## KataBump

Use Node.js 20 LTS. Keep package.json and index.js at the project root. Set the entry point to index.js. KataBump installs npm dependencies automatically.

The database is created automatically on first start.

Email verification proves control of an email address; it does not prove real-world identity.
