# Mezan Chat Worker

Backend proxy for the Mezan AI assistant. It uses Cloudflare Workers AI, a SQLite-backed Durable Object for atomic neuron budgeting, and Cloudflare KV for an inexpensive IP pre-filter. The Durable Object reserves a bounded worst-case AI cost before calling the model, enforces the shared 9,000-neuron UTC-day cap, and applies per-verified-`sub` fairness limits. Failed model calls release their reservation.

Every chat request must include a Google ID token in `Authorization: Bearer <token>` (preferred) or `idToken` in the JSON payload. Set `GOOGLE_CLIENT_ID` in `wrangler.toml` to the matching Google OAuth web client ID before deploying.

## Deploy

Run these steps from your own Cloudflare account:

```bash
cd worker
npm install -g wrangler
wrangler login
wrangler kv namespace create mezan-chat-rate-limit
```

Copy the returned `id` into `wrangler.toml` under `[[kv_namespaces]]` locally, then deploy. Do not commit your real Cloudflare namespace id.

The `AI_BUDGET` Durable Object binding and its SQLite migration are already declared in `wrangler.toml`; deploy them with the Worker. To disable AI immediately, set the Worker variable `AI_KILL_SWITCH` to `"true"` in Cloudflare. It is checked before every model request and returns `503` without calling Workers AI.

```bash
wrangler deploy
```

Wrangler prints a Worker URL such as:

```text
https://mezan-chat.<your-subdomain>.workers.dev
```

Update `CHAT_API_URL` in `js/app.js` to that URL with `/chat` appended, then redeploy the app.

The app sends the user's question and a short financial summary only at request time. The Worker does not store financial data.

For local-only deploy settings, you can keep a private copy such as `wrangler.local.toml`; it is ignored by git.
