# KONE-MEDIA Africa — website

This is your real website front-end, built to match your design exactly. It is **mobile-friendly**, works in any browser, and is ready to deploy today. It currently shows the **sample articles** (your placeholder stories). When your WordPress is ready, you flip one switch and it fills itself from your real posts.

---

## What's in this folder

```
konemedia-site/
├── index.html      ← the whole website (open this to preview)
├── assets/
│   ├── konemedia_logo.png   ← your main logo (header)
│   └── konemedia.png        ← your circle mark (used as the browser icon)
└── README.md       ← this file
```

You don't need to touch any code except, later, one line to connect WordPress (explained below).

---

## 1. Preview it on your own computer

Just double-click `index.html`. It opens in your browser and works fully offline with the sample stories. Click around — categories, articles, the homepage all work.

---

## 2. Put it online (pick the easiest for you)

### Option A — Netlify Drop (easiest, ~2 minutes, no account-juggling)
1. Go to **app.netlify.com/drop**
2. Drag this whole `konemedia-site` folder onto the page.
3. It gives you a live link instantly. Done. (You can attach your konemedia.co.ke domain in the site settings afterwards.)

### Option B — GitHub Pages (the route you asked about)
1. Create a free account at **github.com**.
2. Click **New repository**, name it `konemedia-site`, make it **Public**, click **Create**.
3. On the next screen click **uploading an existing file**, then drag in `index.html`, the `assets` folder, and `README.md`. Click **Commit changes**.
4. Go to **Settings → Pages**. Under "Build and deployment → Source" choose **Deploy from a branch**, pick branch **main** and folder **/ (root)**, click **Save**.
5. Wait ~1 minute. Your site is live at `https://YOUR-USERNAME.github.io/konemedia-site/`.
6. To use konemedia.co.ke instead: in **Settings → Pages → Custom domain**, type your domain and follow the prompts (you'll add one record at your domain provider).

Either option gives you a fast, free, mobile-friendly live site.

---

## 3. Connect WordPress (do this when WordPress is ready)

This is the "manage content in WordPress, show it on the front-end" setup (called *headless*). Your writing workflow stays the normal WordPress one — write a post, click Publish, and it appears on this site automatically.

### One important layout decision
You can't run WordPress and this static site at the *same* web address. The clean, standard setup:

- **Front-end (this site):** `konemedia.co.ke`
- **WordPress (the writing dashboard):** a subdomain like `cms.konemedia.co.ke`

Ask your host to install WordPress on `cms.konemedia.co.ke` (they do this for free).

### Then flip the switch
1. Open `index.html` in any text editor (Notepad works).
2. Near the bottom, find this block:
   ```js
   const CONFIG = {
     WORDPRESS_URL: "",
   ```
3. Put your WordPress address between the quotes:
   ```js
   const CONFIG = {
     WORDPRESS_URL: "https://cms.konemedia.co.ke",
   ```
4. Save, and re-upload `index.html` to Netlify/GitHub. The site now shows your real posts.

### For each post to look right in WordPress
- Add a **Featured image** (this is the photo on the cards and article cover).
- Tick exactly **one Category** (Sports, Business, Finance, Health, Technology, AI, Guides, or Top 10 — create these under Posts → Categories).
- To put a story in the **Featured Stories** row, add the tag **`featured`** to it.
- The newest post automatically becomes the big "Latest" cover; the Sports and Business sidebars fill themselves; Trending shows your 10 most recent.

### One technical note for your host (CORS)
Because the front-end and WordPress live on different addresses, the browser needs WordPress to allow the connection. WordPress usually allows this for public posts by default. If posts don't appear after connecting, ask your developer or host to *"enable CORS for the WordPress REST API"* — it's a small, standard fix.

---

## 4. Swapping the logo or browser icon later
Replace the files in the `assets` folder with new ones using the **same filenames** (`konemedia_logo.png` and `konemedia.png`), re-upload, and you're done.

---

## Honest notes
- The **search**, **saved**, and **account** buttons and the **newsletter box** are visual placeholders. They can be wired to real services later, but they don't do anything yet.
- The sample photos are temporary stand-ins. Once WordPress is connected, your own featured images replace them.
- This front-end is great for speed and looks. If, down the line, search-engine ranking becomes a top priority, ask a developer about adding "pre-rendering" so each article has its own crawlable page — your content and design stay exactly the same.

---

## Clean URLs & SEO (added)

Articles now use clean paths like `konemedia.co.ke/hello-world` (the post's WordPress slug), and every page sets its own **canonical tag**, title, and social-share tags automatically.

Two extra files make this work:
- `404.html` — lets clean links work on **GitHub Pages** (it hands the path back to the app). Keep it in the repo root.
- `_redirects` — gives fully clean URLs with a proper 200 status if you host on **Netlify or Cloudflare Pages**. GitHub Pages ignores it; it's there for when/if you move.

Note for GitHub Pages: a *direct* visit to `konemedia.co.ke/hello-world` works for people, but the server returns a 404 status for an instant before the page loads, which search engines don't love. For best SEO, host the same files on Netlify or Cloudflare Pages (free, drag-and-drop) — the `_redirects` file then serves clean URLs properly. Normal clicking between pages on the site is always clean and instant on either host.

---

## Update: sitemap, robots, categories, contact, subscriptions

New files: `robots.txt`, `netlify.toml`, `netlify/functions/sitemap.js`.

- **Sitemap**: `https://konemedia.co.ke/sitemap.xml` is generated live from your WordPress posts (posts only), cached for 12 hours so it refreshes twice a day. Submit it once in Google Search Console.
- **robots.txt** points to the sitemap and welcomes all AI crawlers. Category pages carry a `noindex` tag so only posts get indexed (tags aren't exposed as pages).
- **Category URLs** are now clean: `konemedia.co.ke/Business` (old `/category/...` links 301-redirect to the new ones).
- **Menu** now has **Home** and **Contact**; on mobile the full menu wraps onto rows (all items visible, no sideways scroll).
- **Categories** show 10 articles with a **Show more** button that loads the next 10 each time.
- **Contact page** at `/contact` with your details and a message form.

### One manual step on Netlify (to receive subscriptions + contact messages)
Email subscriptions and the contact form use **Netlify Forms**. To get the submissions emailed to you:
1. Netlify dashboard → your site → **Forms**.
2. Open **Form notifications** → **Add notification** → **Email notification**.
3. Send to **cosmastanui25@gmail.com**. Save.

Submissions are also stored under the Forms tab even before you add the email. (Free plan includes 100 submissions/month.)

---

## Update: performance

Speed optimizations (no visual or functional change):
- **Right-sized images** — each spot loads an appropriately scaled photo from WordPress (thumbnails for small cards, medium for grids, large for hero) instead of full-size files. The single biggest speed win.
- **Priority hints** — the main hero image loads first (`fetchpriority="high"`); all other images lazy-load and decode async.
- **Faster CMS connection** — `preconnect` to cms.konemedia.co.ke so the data request starts sooner.
- **Non-blocking fonts** — fonts no longer hold up first paint.
- **Instant repeat visits** — the post list is cached in the browser and refreshed quietly in the background (stale-while-revalidate), so reloads and return visits render immediately.
- **Asset caching** — logos/favicon cached for a week via `netlify.toml`.

Netlify already serves everything over HTTP/2 with Brotli/gzip compression and a global CDN, so no extra setup is needed. After deploying, you can check the score at pagespeed.web.dev.

---

## Update: sitemap now includes everything

The sitemap at `https://konemedia.co.ke/sitemap.xml` now lists:
- the **homepage** (priority 1.0)
- all **category** pages (e.g. /Business, /Top-10) — these are now **indexable** (the earlier noindex was removed so the sitemap and indexing agree)
- the **contact** page
- every published **post**

It still regenerates live (12-hour cache) and uses each post's real `lastmod` date. Tags remain the only thing not exposed as pages. If you later want categories kept out of Google again, tell me and I'll re-add noindex to them and drop them from the sitemap.

---

## Update: correct canonical in raw page source

A Netlify **edge function** (`netlify/edge-functions/canonical.js`, enabled in `netlify.toml`)
rewrites the `<link rel="canonical">` and `og:url` in the HTML *as the page is served*, so the
**raw source** (view-source / SEO crawlers that don't run JavaScript) shows each page's own URL
instead of the homepage. It follows the same URL rules as the site: trailing slash on all posts,
no slash on the one exception post, no slash on categories/contact. To change the exception later,
edit the `NO_TRAILING_SLASH` set in BOTH `index.html` and the two files under `netlify/`.

IMPORTANT: when deploying, upload the whole `netlify/` folder (it now contains `functions/` and
`edge-functions/`) plus `netlify.toml`, or the canonical fix won't activate.
