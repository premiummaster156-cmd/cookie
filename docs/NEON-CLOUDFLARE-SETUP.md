# Cookie — Neon + Cloudflare Workers AI

Cookie now supports Neon PostgreSQL as the primary database for Pages Functions and the Cloudflare Workers AI REST API for image generation.

## Required Pages secrets

Set these in Cloudflare Pages → Settings → Variables and Secrets:

- `NEON_DATABASE_URL` — the full Neon PostgreSQL connection string.
- `CLOUDFLARE_ACCOUNT_ID` — your Cloudflare account ID.
- `CLOUDFLARE_AI_API_TOKEN` — a Workers AI API token.

The Neon connection string and API token are secrets. Do not commit them to Git.

## Workers AI token permissions

For direct Workers AI REST API calls, the token needs Workers AI permissions. The current Cloudflare documentation specifies Workers AI Read and Workers AI Edit for a Workers AI API token.

## What happens after deployment

The first database-backed request initializes Cookie's PostgreSQL schema automatically. It creates the account, session, verification, memory, chat, project, sharing, usage, and Code Studio tables and their indexes.

No D1 database binding is required.

## Neon notes

The application uses `@neondatabase/serverless` over HTTP, which is suitable for Cloudflare Workers/Pages Functions. The adapter preserves the existing `env.DB.prepare(...).bind(...)` call sites so the rest of Cookie can continue using the same database interface.

## Existing D1 data

Switching the app to Neon does not copy existing D1 rows. Export/import is a separate migration step.
