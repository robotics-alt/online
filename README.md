# Online tutoring platform

Next.js 16 / React 19 application with teacher, student and administrator dashboards, SQLite/Prisma, a Socket.IO classroom service, WebRTC calls, PDF whiteboards, homework, messaging, bookings and wallets.

## Requirements

- Node.js 22 or newer, npm, and Bun for the realtime TypeScript service.
- Persistent writable storage for the SQLite database and uploaded files.
- A public HTTPS domain/reverse proxy for phone camera and microphone access.

## Installation

1. Run `npm ci`.
2. Copy `.env.example` to `.env` and replace its placeholders. Use absolute paths for `DATABASE_URL` and `LOCAL_UPLOAD_ROOT`, and a strong random `SESSION_SECRET` shared by both services.
3. Run `npm run db:push` to create the database schema. This command does not seed real or demo accounts.
4. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in the environment, run `npm run admin:create`, then remove `ADMIN_PASSWORD`.
5. Run `npm run typecheck` and `npm run build`.
6. Start `npm run start:realtime` and `npm start` in separate supervised processes.

The public app listens on port 3000 by default. Its single-port gateway forwards classroom WebSocket traffic to the local realtime service on port 3003. Proxy the app port with WebSocket support and HTTPS; do not expose the realtime port directly. A Caddy example is in `deploy/Caddyfile.example`.

Keep the database and upload directory on persistent storage. Back them up before schema changes. A repository push publishes source code; the server processes and persistent storage must be provisioned on the hosting machine.

On Windows, an absolute SQLite URL looks like `file:C:/path/to/online/db/production.db`. On Linux, use `file:/path/to/online/db/production.db`. Both services must use the same file and session secret. SQLite is intended for a single application host; multiple independent hosts require a different database deployment.

## Translation JSON files

Admin > Settings > Translation JSON files has a language selector and JSON download/upload controls. It exports the complete interface catalogue rather than a short list of menu labels.

Ready-to-edit complete files are in `public/translations/` for English, Arabic, Kurdish Sorani, Turkish and French. Values without an existing translation fall back to English. Edit values, keep keys unchanged, and preserve placeholders such as `{{value1}}`. Upload the edited file and choose Save translations. Existing shorter JSON dictionaries can still be imported; missing entries retain their fallback text.

Interface labels, forms, help text, games, accessibility labels and dashboard controls are included. Names, chat messages, user data and authored CMS content retain their original content. Custom page and hero text is managed in CMS/Homepage.

After adding interface text, use `uiText(...)` in client components and run `npm run translations:refresh`. `src/lib/translation-catalog.json` is the canonical English catalogue. Existing named keys remain supported.

## Checks and local development

- `npm run typecheck`
- `npm run build`
- `npm run dev` for the Next.js development server; run the realtime service separately.
- `scripts/verify-*.cjs` contains local integration/browser checks that create and remove isolated test accounts. Some older scripts expect the local HTTPS development setup; configure their test URLs before running them on a different machine.

The production build copies the PDF.js worker, fonts, CMaps and WebAssembly assets into the standalone output. `npm start` uses the same single-port gateway as local stable builds.

## Repository contents

Environment files, private certificates, databases, uploaded files, logs, generated browser profiles and build output are excluded. `prisma/seed.ts` is an optional development-only demonstration seed with known demo credentials; do not run it for a production installation. Use `npm run admin:create` instead.
