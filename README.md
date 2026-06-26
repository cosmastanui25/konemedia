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
