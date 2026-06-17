# Mezan Chat Worker

Backend proxy for the Mezan AI assistant. It uses Cloudflare Workers AI and stores only a per-user anonymous rate-limit counter in Cloudflare KV.

## Deploy

Run these steps from your own Cloudflare account:

```bash
cd worker
npm install -g wrangler
wrangler login
wrangler kv namespace create mezan-chat-rate-limit
```

Copy the returned `id` into `wrangler.toml` under `[[kv_namespaces]]` locally, then deploy. Do not commit your real Cloudflare namespace id.

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
