# KONE-MEDIA auto-publisher

A script you run **on your own laptop, from the terminal, whenever you want**. It writes
articles with Claude, adds 3 internal links + checked external sources, removes every em dash,
adds a free photo, publishes to WordPress, and rebuilds your live site once at the end.

Free except Claude tokens (roughly **$6-8 / month** for 20 articles/day on Haiku).

---

## One-time setup (about 15 minutes)

### 1. Install Python
- Windows: install from https://www.python.org/downloads/ (tick "Add Python to PATH").
- Mac: it's usually already there. Check with `python3 --version`.

### 2. Get the files onto your laptop
Put this whole folder somewhere easy, e.g. `Documents/konemedia-autopublish`.

### 3. Install the two libraries
Open a terminal **in this folder** and run:
```
pip install -r requirements.txt
```
(If `pip` isn't found, try `pip3`.)

### 4. Create your WordPress Application Password
This lets the script log in safely without your real password.
1. Go to `https://cms.konemedia.co.ke/wp-admin` → **Users → Profile** (your user).
2. Scroll to **Application Passwords**. Type a name like `autopublish` → **Add New**.
3. Copy the password it shows (looks like `abcd efgh ijkl mnop qrst uvwx`).

### 5. Get a free Pexels key (for photos)
Sign up at https://www.pexels.com/api/ and copy your API key. (Optional, but recommended.)

### 6. Make your .env file
Copy `.env.example` to `.env`, then open `.env` in a text editor and fill in:
- `ANTHROPIC_API_KEY` – your Claude API key
- `WP_USER` – your WordPress username
- `WP_APP_PASSWORD` – the application password from step 4
- `PEXELS_API_KEY` – from step 5
- `CF_DEPLOY_HOOK` – already filled in with your Cloudflare rebuild hook
- `COUNT` – how many articles per run (start at **3**)
- `STATUS` – start with **draft** so you can review; switch to **publish** later

### 7. Add your topics
Open `topics.csv`. Keep the header row `topic,category`. Add one topic per line.
`category` is optional (leave blank and Claude picks), but must be one of:
Sports, Business, Finance, Health, Technology, AI, Guides, Top 10.
You can paste up to 1000 rows.

---

## Running it

In the terminal, in this folder:
```
python publish.py
```
(or `python3 publish.py`)

It will write `COUNT` articles from the next unused topics, publish them, and rebuild the site.
Every topic it uses is recorded in `state.json`, so it **never repeats a topic**. Run it again
tomorrow and it continues down the list. A full log is saved in `run.log`.

To do 20 a day, set `COUNT=20` and run it once each day. (You can split into smaller runs too.)

---

## Strong advice (please read)

- **Start with `STATUS=draft` and `COUNT=3`.** Read the drafts in WordPress. Only when you are
  happy with the quality should you raise the count or switch to `publish`.
- Publishing many AI articles per day, unreviewed, is the single biggest risk to your Google
  rankings (Google penalises "scaled content abuse"). Fewer, genuinely useful articles with a
  quick human check is far safer for the domain you've built. The script supports either; the
  choice of volume is yours.

## What it guarantees per article
- No em dashes (stripped automatically).
- Exactly 3 internal links to your real existing posts (checked; added if the model forgets).
- 2-3 external source links, with obviously dead ones removed.
- A category, tags, excerpt, meta description, and a free featured image.

## Costs
- Claude (Haiku): about 1 cent per article. 20/day ≈ $6-8/month.
- Pexels, WordPress, Cloudflare: free for this use.
- Images are stock photos, not AI-generated (Claude's API can't make images). To use true
  AI images later you'd add a separate paid image API; ask and it can be wired in.

## Troubleshooting
- `ANTHROPIC_API_KEY is missing` → you didn't create `.env` or left it blank.
- `401`/`403` from WordPress → wrong `WP_USER` or application password; recreate it.
- Images skipped → check `PEXELS_API_KEY`, or leave it blank to post without photos.
- Nothing appears on the live site → check Cloudflare Deployments; the rebuild runs at the end.
