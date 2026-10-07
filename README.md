# KONE-MEDIA Africa — pre-rendered site

Your site is now **pre-rendered**: at deploy time, `build.mjs` fetches every post
from WordPress and writes a real, standalone HTML file for each page (home, every
article, every category, contact). The full article text and all SEO tags live in
the **raw HTML**, so Google and any tool sees your content immediately — and pages
load instantly because nothing is fetched in the browser.

The look is unchanged. You still write posts in WordPress.

## Files
- `template.html` — the design (fonts, layout, colours). Edit this to change the look.
- `build.mjs` — the builder. Fetches WordPress and writes the finished pages to `/dist`.
- `assets/` — logos, favicon, and `app.js` (a tiny script for forms + "Read more").
- `robots.txt`, `netlify.toml` — config.
- `/dist` — the built site (generated automatically; not committed).

## How it deploys (Netlify)
Netlify runs `node build.mjs` on every deploy and publishes the `dist` folder.
No manual build needed on your side.

## IMPORTANT — publishing a new post
Because pages are pre-built, a new WordPress post appears on the site **after the
site rebuilds** (not instantly like before). Two ways to rebuild:

1. **Automatic (recommended).** In Netlify: *Site settings → Build & deploy →
   Build hooks → Add build hook* (name it "WordPress publish", branch `main`).
   Copy the URL it gives you. Then in WordPress install a deploy-webhook plugin
   (e.g. "JAMstack Deployments" or "WP Webhooks") and set it to call that URL when
   a post is published or updated. Now every publish triggers a rebuild automatically.
2. **Manual.** In Netlify click *Deploys → Trigger deploy → Deploy site* after publishing.

(You can also set Netlify scheduled builds to rebuild, say, hourly.)

## Category pages & related posts
- Category pages list **every** post in that category; 20 show at once and a
  **Read more** button reveals the rest in batches of 20.
- Each article's sidebar shows up to **10** newest posts from the same category.

## Trailing-slash rules (unchanged)
- All posts end in `/` **except** `best-sites-to-play-aviator-in-kenya-a-ranked-comparison`
  (no slash). This is controlled by the `NO_TRAILING_SLASH` set in `build.mjs`.
- Encoded in the output: `slug/index.html` → `/slug/`; the exception is a flat
  `slug.html` → `/slug`. Categories/contact are flat files (no slash).

## To change the design
Edit `template.html` (CSS is in its `<style>` block). The builder injects each
page's content into `<main id="view">` and fills the per-page `<title>`,
description, canonical and social tags.
