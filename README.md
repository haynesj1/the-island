# The Island

A web app (mobile-friendly, installable) of story-based guided relaxation sessions set in places around a fictional island, structured as a gentle 100-day programme. New sessions arrive weekly.

Sessions are evidence-informed relaxation practice, not a treatment or medical device.

Planned stack: Astro + a small Svelte audio player, hosted on Cloudflare. Work in progress (November 2026).

## Sharing the two calm numbers (optional)

After rating a session, a listener can choose to send their two numbers anonymously (`specs/share-rating.md`). The app never shows the question until `PUBLIC_SHARE_URL` is set. The Worker in `worker/share/` stores counts only and has no route that reads them.

Jordan's steps to turn it on:

1. Create a KV namespace: `npx wrangler kv namespace create SHARE_COUNTS`, and put its id in `worker/share/wrangler.toml`.
2. In the same file set `ALLOWED_ORIGIN` to the app's web address (no trailing slash).
3. Deploy: `cd worker/share && npx wrangler deploy`.
4. Set `PUBLIC_SHARE_URL` to the Worker's address as a build variable in Cloudflare Pages, and redeploy the app.
5. Read the counts in the Cloudflare dashboard (Workers KV, keys like `day:3:before:2:after:4`).
