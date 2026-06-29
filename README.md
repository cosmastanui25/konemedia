# SEO Desk

A task & client manager for an SEO agency, plus a Search Console dashboard and (coming) Ahrefs + Claude integrations. The app itself is a single `index.html`; the `/api` folder holds small serverless functions that talk to external APIs securely.

---

## A. Put it on GitHub (you + your manager)

GitHub gives you version history and lets your manager fix things without anyone overwriting each other.

**One-time setup**
1. Create a free account at github.com (you and your manager each get one).
2. Create a new **private** repository, e.g. `seo-desk`.
3. Upload these files into it. Easiest non-technical way: on the repo page click **Add file → Upload files**, drag in `index.html`, `vercel.json`, `.gitignore`, `.env.example`, and the whole `api` folder, then **Commit**.
   - If you prefer the command line: `git init`, `git add .`, `git commit -m "first version"`, `git branch -M main`, `git remote add origin <repo-url>`, `git push -u origin main`.
4. Add your manager: repo **Settings → Collaborators → Add people**.

**How you both work after that**
- Small fix: edit the file on GitHub (pencil icon) → Commit. It deploys automatically (see section B).
- Safer for bigger changes: your manager creates a **branch**, commits there, opens a **Pull Request**; you review and merge. Vercel even builds a temporary preview link for each PR so you can test before it goes live.

---

## B. Deploy with Vercel (Option A) and keep your own domain

Vercel hosts the page **and** runs the `/api` functions (which is what lets the integrations hold secret keys safely). Your site still lives at your own domain — Vercel just serves it.

1. Go to vercel.com → sign up **with your GitHub account**.
2. **Add New → Project →** pick the `seo-desk` repo → **Deploy**. (No build settings needed; it's a static file plus functions.)
3. You'll get a temporary URL like `seo-desk.vercel.app` to confirm it works.
4. **Use your own domain:** Project → **Settings → Domains** → add e.g. `tasks.ecopulse.co.ke`. Vercel shows you one DNS record to add.
5. Add that record where your DNS is managed (cPanel **Zone Editor**, or your registrar): typically a **CNAME** for `tasks` pointing to the value Vercel gives you. Within a few minutes the domain goes live with automatic HTTPS.

That's the win you wanted: the code lives in GitHub, hosting is portable, and you can move the domain or hand the whole thing over (or sell it) anytime — nothing is locked to one host.

> You can keep your existing cPanel site as-is for your main website. Only the subdomain you choose points to Vercel.

**Every future change** pushed to GitHub auto-deploys. No more manual file uploads.

---

## C. Supabase (sign-in + shared data) — unchanged

This still works exactly as before. Keys are already in the `CONFIG` block of `index.html`, sign-up is locked to `welcometomorrow.io`, and new members join as Manager. See the separate setup guide for the SQL and the domain-restriction trigger.

---

## D. The three integrations — what's possible and what each needs

All three are possible. They all run as `/api` functions so the API keys stay on the server (never in the page). You add the keys in **Vercel → Settings → Environment Variables** (template in `.env.example`). Build them one at a time.

### 1) Google Search Console — pull all properties (the card dashboard)
- **Status:** the dashboard UI is already in the app (the "Search Console" tab), showing sample cards in the exact layout from your screenshot — one card per property with a trend line, headline number, and % change. It calls `/api/gsc`; until that's live it shows sample data.
- **To make it live:** create a Google Cloud project, enable the Search Console API, create OAuth credentials, and do the consent flow once to get a refresh token. Put `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` in Vercel. The function then lists every property your Google account can access and pulls clicks per property — so all your clients appear automatically.
- **Cost:** free.

### 2) Ahrefs — quick audit inside the tool
- **What it gives:** DR, organic traffic, backlinks with the newest acquired first, organic keyword trend, and — for keywords you track in Ahrefs Rank Tracker — their positions. Endpoints are scaffolded in `/api/ahrefs.js`.
- **To make it live:** an Ahrefs plan that includes **API access**, then put `AHREFS_API_TOKEN` in Vercel. (Heads-up: Ahrefs API calls consume "API units" from your plan, so we'll cache results rather than hit it on every page load.)
- **Cost:** included in an API-enabled Ahrefs plan; usage draws down units.

### 3) Claude — auto-generate reports & analysis
- **What it gives:** (a) an **Analyze with AI** button on the Search Console screen (per property) and the SEO Audit screen — Claude turns the data into bullets (clicks change, top/dropping keywords and pages, DR/backlink/keyword movement, competitor moves) plus recommendations; (b) the Reports section that compiles a client's logged work + GSC + audit into a written report. Analysis buttons call `/api/analyze.js`; reports call `/api/report.js`.
- **To make it live:** an Anthropic **API key** (`ANTHROPIC_API_KEY` in Vercel). Until it's set, the AI buttons fall back to a built-in rule-based summary so they still work. API usage is pay-as-you-go and **billed separately from your Claude.ai subscription**. See https://docs.claude.com/en/api/overview.
- **Cost:** per-use, typically a few cents per analysis.

### Suggested order
GSC first (free, high impact, dashboard already built) → Claude reports (big time-saver, ties everything together) → Ahrefs (most setup, manages paid units).

Tell me which one to wire up first and I'll walk you through getting that one credential, then make that function live end to end.
