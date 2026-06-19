# Security Notes

Mezan is a static PWA with local browser storage and a small Cloudflare Worker for the AI assistant.

## Do not commit

- Cloudflare account-specific ids or local deploy files.
- `.env`, `.dev.vars`, API keys, tokens, or credentials.
- Generated reports, screenshots, and test artifacts.

## Public by design

- The frontend source is public.
- `CHAT_API_URL` is visible to browsers by design; Worker-side checks must enforce allowed origins and rate limits.
- Cloudflare KV namespace ids are not passwords, but keep real deployment ids out of committed config.

## Local deploy config

Use a private local copy such as `worker/wrangler.local.toml` or edit `worker/wrangler.toml` locally before deploy. Do not commit the real namespace id.

## Current assistant protections

- Worker requests are limited to `https://abed-jarrah.github.io`.
- Requests without an allowed `Origin` are rejected.
- The Worker requires a verified Google ID token and applies a secondary Cloudflare IP limit.
- A SQLite-backed Durable Object atomically reserves the worst-case Workers AI neuron cost before each model call. It enforces a 9,000-neuron UTC-day global budget and a per-verified-`sub` fairness budget; failed model calls release their reservation.
- Set the Worker variable `AI_KILL_SWITCH` to `"true"` to immediately disable AI requests. The Durable Object also persists a kill-switch field so reservations fail closed if it is enabled.
