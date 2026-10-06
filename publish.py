#!/usr/bin/env python3
"""
KONE-MEDIA auto-publisher
-------------------------
Runs on your own laptop, on demand, from the terminal.

For each run it:
  1. takes the next N unused topics from topics.csv
  2. picks 3 real internal links from your existing WordPress posts
  3. asks Claude (Haiku, cheap) to write each article as clean HTML
  4. strips every em dash, verifies the 3 internal links, checks external links
  5. fetches a free Pexels photo and sets it as the featured image
  6. publishes the post to WordPress
  7. after all posts, pings Cloudflare once to rebuild the live site

Nothing here costs money except Claude tokens (a few dollars a month on Haiku).
Pexels, WordPress and Cloudflare are free for this use.

Read README.md first. All secrets live in a local .env file (never commit it).
"""

import os, sys, re, json, csv, time, mimetypes, pathlib, random
import requests
from dotenv import load_dotenv

# --------------------------------------------------------------------------
# Config (from .env)
# --------------------------------------------------------------------------
load_dotenv()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "").strip()
WP_BASE   = os.getenv("WP_BASE", "https://cms.konemedia.co.ke").rstrip("/")
WP_USER   = os.getenv("WP_USER", "").strip()
WP_APP_PASSWORD = os.getenv("WP_APP_PASSWORD", "").strip()
PEXELS_API_KEY  = os.getenv("PEXELS_API_KEY", "").strip()
CF_DEPLOY_HOOK  = os.getenv("CF_DEPLOY_HOOK", "").strip()
SITE   = os.getenv("SITE", "https://konemedia.co.ke").rstrip("/")
MODEL  = os.getenv("MODEL", "claude-haiku-4-5-20251001").strip()
COUNT  = int(os.getenv("COUNT", "5"))            # how many articles per run
STATUS = os.getenv("STATUS", "publish").strip()  # "publish" or "draft"

# The 8 sections your site uses. The article is filed under one of these.
CATEGORIES = ["Sports", "Business", "Finance", "Health", "Technology", "AI", "Guides", "Top 10"]

# Trailing-slash exception (must match build.mjs on the website)
NO_TRAILING_SLASH = {"best-sites-to-play-aviator-in-kenya-a-ranked-comparison"}

HERE = pathlib.Path(__file__).parent
TOPICS_FILE = HERE / "topics.csv"
STATE_FILE  = HERE / "state.json"
LOG_FILE    = HERE / "run.log"

WP_AUTH = (WP_USER, WP_APP_PASSWORD)
HTTP_TIMEOUT = 45


# --------------------------------------------------------------------------
# Small helpers
# --------------------------------------------------------------------------
def log(msg):
    line = f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {msg}"
    print(line)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def die(msg):
    log("FATAL: " + msg)
    sys.exit(1)


def slugify(text):
    text = re.sub(r"[^a-z0-9\s-]", "", text.lower())
    text = re.sub(r"[\s_-]+", "-", text).strip("-")
    return text[:90] or "post"


def front_url(slug):
    """Public front-end URL for a post slug, honouring the no-slash exception."""
    return f"{SITE}/{slug}" + ("" if slug in NO_TRAILING_SLASH else "/")


def strip_em_dashes(text):
    """The site rule: never use em dashes. Replace them with normal punctuation."""
    if not text:
        return text
    text = text.replace("\u2014", ", ")   # — em dash  -> comma
    text = text.replace("\u2013", "-")     # – en dash  -> hyphen (safe in ranges)
    text = re.sub(r"\s*,\s*,\s*", ", ", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    return text


def load_state():
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {"done": {}}   # normalized_topic -> {slug, date}


def save_state(state):
    STATE_FILE.write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8")


def norm_topic(t):
    return re.sub(r"\s+", " ", t.strip().lower())


# --------------------------------------------------------------------------
# Topics
# --------------------------------------------------------------------------
def load_topics():
    if not TOPICS_FILE.exists():
        die(f"{TOPICS_FILE} not found. Create it (see README).")
    rows = []
    with open(TOPICS_FILE, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        # Accept a 'topic' column (required) and optional 'category' column.
        if not reader.fieldnames or "topic" not in [c.strip().lower() for c in reader.fieldnames]:
            die("topics.csv must have a header row with at least a 'topic' column.")
        # map header names case-insensitively
        cols = {c.strip().lower(): c for c in reader.fieldnames}
        for r in reader:
            topic = (r.get(cols.get("topic", ""), "") or "").strip()
            if not topic:
                continue
            cat = (r.get(cols.get("category", ""), "") or "").strip()
            rows.append({"topic": topic, "category": cat})
    return rows


# --------------------------------------------------------------------------
# WordPress
# --------------------------------------------------------------------------
def wp_get(path, **params):
    r = requests.get(f"{WP_BASE}/wp-json/wp/v2/{path}", params=params, auth=WP_AUTH, timeout=HTTP_TIMEOUT)
    r.raise_for_status()
    return r


def fetch_existing_posts():
    """All published posts (id, slug, title) for internal-link selection + dedup."""
    out, page = [], 1
    while page <= 30:
        r = wp_get("posts", per_page=100, page=page, status="publish",
                   _fields="id,slug,title", orderby="date", order="desc")
        batch = r.json()
        if not batch:
            break
        for p in batch:
            title = (p.get("title", {}) or {}).get("rendered", "")
            out.append({"id": p["id"], "slug": p.get("slug", ""), "title": title})
        total_pages = int(r.headers.get("X-WP-TotalPages", "1") or "1")
        if page >= total_pages:
            break
        page += 1
    return out


def slug_exists(slug):
    try:
        r = wp_get("posts", slug=slug, _fields="id", status="publish,draft,pending,future")
        return len(r.json()) > 0
    except Exception:
        return False


def get_or_create_term(taxonomy, name):
    """taxonomy = 'categories' or 'tags'. Returns the term id."""
    name = name.strip()
    if not name:
        return None
    try:
        r = wp_get(taxonomy, search=name, per_page=20, _fields="id,name")
        for t in r.json():
            if t.get("name", "").strip().lower() == name.lower():
                return t["id"]
    except Exception:
        pass
    # create it
    try:
        r = requests.post(f"{WP_BASE}/wp-json/wp/v2/{taxonomy}",
                          json={"name": name}, auth=WP_AUTH, timeout=HTTP_TIMEOUT)
        if r.status_code in (200, 201):
            return r.json()["id"]
        # term may already exist (race) -> API returns the id in the error data
        data = r.json()
        if isinstance(data, dict) and data.get("data", {}).get("term_id"):
            return data["data"]["term_id"]
    except Exception as e:
        log(f"  ! could not create {taxonomy[:-1]} '{name}': {e}")
    return None


def upload_image(img_bytes, filename, alt_text):
    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"',
        "Content-Type": mimetypes.guess_type(filename)[0] or "image/jpeg",
    }
    r = requests.post(f"{WP_BASE}/wp-json/wp/v2/media", headers=headers,
                      data=img_bytes, auth=WP_AUTH, timeout=HTTP_TIMEOUT)
    r.raise_for_status()
    media_id = r.json()["id"]
    # best-effort alt text
    try:
        requests.post(f"{WP_BASE}/wp-json/wp/v2/media/{media_id}",
                      json={"alt_text": alt_text[:120]}, auth=WP_AUTH, timeout=HTTP_TIMEOUT)
    except Exception:
        pass
    return media_id


def create_post(title, slug, content, excerpt, cat_id, tag_ids, media_id):
    payload = {
        "title": title,
        "slug": slug,
        "content": content,
        "excerpt": excerpt,
        "status": STATUS,
        "categories": [cat_id] if cat_id else [],
        "tags": [t for t in tag_ids if t],
    }
    if media_id:
        payload["featured_media"] = media_id
    r = requests.post(f"{WP_BASE}/wp-json/wp/v2/posts", json=payload, auth=WP_AUTH, timeout=HTTP_TIMEOUT)
    r.raise_for_status()
    return r.json()


# --------------------------------------------------------------------------
# Pexels (free stock photo)
# --------------------------------------------------------------------------
def fetch_pexels_image(query):
    if not PEXELS_API_KEY:
        return None
    try:
        r = requests.get("https://api.pexels.com/v1/search",
                         headers={"Authorization": PEXELS_API_KEY},
                         params={"query": query, "orientation": "landscape", "per_page": 1},
                         timeout=HTTP_TIMEOUT)
        r.raise_for_status()
        photos = r.json().get("photos", [])
        if not photos:
            return None
        src = photos[0]["src"]
        url = src.get("large2x") or src.get("large") or src.get("original")
        img = requests.get(url, timeout=HTTP_TIMEOUT)
        img.raise_for_status()
        return img.content
    except Exception as e:
        log(f"  ! pexels failed for '{query}': {e}")
        return None


# --------------------------------------------------------------------------
# External link checking (drop only clearly dead links)
# --------------------------------------------------------------------------
def link_is_dead(url):
    try:
        r = requests.get(url, timeout=20, stream=True,
                         headers={"User-Agent": "Mozilla/5.0 (link-check)"})
        return r.status_code in (404, 410)
    except Exception:
        return True


def _prune_one(m, internal_urls):
    href = m.group(1)
    text = m.group(2)
    if href in internal_urls or not href.startswith("http"):
        return m.group(0)
    if link_is_dead(href):
        log(f"  - dropping dead source link: {href}")
        return text
    return m.group(0)


# --------------------------------------------------------------------------
# Internal link selection
# --------------------------------------------------------------------------
STOP = set("the a an and or of to in on for with your you how what why is are be best "
           "kenya kenyan 2026 guide tips this that from".split())

def pick_internal_links(topic, posts, k=3):
    words = {w for w in re.findall(r"[a-z]+", topic.lower()) if w not in STOP and len(w) > 2}
    scored = []
    for p in posts:
        if not p["slug"]:
            continue
        title_words = set(re.findall(r"[a-z]+", p["title"].lower()))
        score = len(words & title_words)
        scored.append((score, p))
    scored.sort(key=lambda x: x[0], reverse=True)
    chosen = [p for s, p in scored if s > 0][:k]
    if len(chosen) < k:  # top up with recent posts
        for s, p in scored:
            if p not in chosen:
                chosen.append(p)
            if len(chosen) >= k:
                break
    return [{"title": re.sub("<.*?>", "", p["title"]).strip(), "url": front_url(p["slug"])}
            for p in chosen[:k]]


# --------------------------------------------------------------------------
# Claude (Haiku) article generation
# --------------------------------------------------------------------------
def write_article(topic, category_hint, internal_links):
    links_block = "\n".join(f'- "{l["title"]}" -> {l["url"]}' for l in internal_links)
    cat_line = f"Preferred category: {category_hint}." if category_hint else \
               f"Choose the best category from: {', '.join(CATEGORIES)}."

    system = (
        "You are a professional feature writer for KONE-MEDIA Africa, a Kenyan news and "
        "analysis site. You write accurate, original, genuinely useful articles with a "
        "Kenyan and African context. You output ONLY valid minified JSON and nothing else: "
        "no markdown, no code fences, no commentary."
    )
    user = f"""Write one article.

TOPIC: {topic}
{cat_line}

HARD RULES:
- 900 to 1200 words. Original, factual, helpful. Natural human tone.
- NEVER use em dashes anywhere. Use commas, full stops or parentheses instead.
- Body must be clean HTML using only <p>, <h2>, <h3>, <ul>, <li>, <strong>, <a> tags. No <h1>. No inline styles.
- Include EXACTLY these 3 internal links, each once, as natural anchor text inside sentences, using these exact URLs:
{links_block}
- Include 2 to 3 external links to well known, authoritative sources relevant to the topic
  (for example official bodies, major reputable publications). Use real https URLs to real homepages
  or well known sections. Open nothing in new tabs, just plain <a href="...">anchor</a>.
- Start with a strong opening paragraph that answers the core question quickly.
- Use <h2> subheadings. Short paragraphs.

Return ONLY this JSON object (minified), with these keys:
{{"title": string (<= 65 chars, no em dash),
"slug": string (kebab-case, <= 9 words),
"meta_description": string (140-160 chars, no em dash),
"excerpt": string (1 sentence standfirst, no em dash),
"category": one of [{', '.join(CATEGORIES)}],
"tags": array of 3-5 short lowercase tag strings,
"image_query": string (2-4 words to find a stock photo),
"content_html": string (the full article body as HTML)}}"""

    body = {
        "model": MODEL,
        "max_tokens": 2600,
        "system": system,
        "messages": [{"role": "user", "content": user}],
    }
    r = requests.post("https://api.anthropic.com/v1/messages",
                      headers={"x-api-key": ANTHROPIC_API_KEY,
                               "anthropic-version": "2023-06-01",
                               "content-type": "application/json"},
                      json=body, timeout=120)
    if r.status_code != 200:
        raise RuntimeError(f"Claude API {r.status_code}: {r.text[:300]}")
    data = r.json()
    text = "".join(blk.get("text", "") for blk in data.get("content", []) if blk.get("type") == "text")
    text = text.strip()
    # strip accidental code fences
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
        text = re.sub(r"\n?```$", "", text).strip()
    # find the JSON object
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        raise RuntimeError("Claude did not return JSON.")
    art = json.loads(text[start:end + 1])
    usage = data.get("usage", {})
    return art, usage


# --------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------
def main():
    for name, val in [("ANTHROPIC_API_KEY", ANTHROPIC_API_KEY), ("WP_USER", WP_USER),
                      ("WP_APP_PASSWORD", WP_APP_PASSWORD)]:
        if not val:
            die(f"{name} is missing from .env")
    if STATUS not in ("publish", "draft"):
        die("STATUS in .env must be 'publish' or 'draft'.")

    log(f"=== run start | model={MODEL} | count={COUNT} | status={STATUS} ===")
    state = load_state()
    done = state.setdefault("done", {})

    topics = load_topics()
    queue = [t for t in topics if norm_topic(t["topic"]) not in done]
    if not queue:
        log("No unused topics left in topics.csv. Add more rows. Done.")
        return
    batch = queue[:COUNT]
    log(f"{len(queue)} unused topics available; writing {len(batch)} this run.")

    log("Fetching existing posts for internal links...")
    posts = fetch_existing_posts()
    log(f"  found {len(posts)} existing posts.")

    total_in = total_out = 0
    published = 0

    for i, item in enumerate(batch, 1):
        topic = item["topic"]
        log(f"[{i}/{len(batch)}] {topic}")
        try:
            internal = pick_internal_links(topic, posts, k=3)
            art, usage = write_article(topic, item["category"], internal)
            total_in += usage.get("input_tokens", 0)
            total_out += usage.get("output_tokens", 0)

            title = strip_em_dashes(art.get("title", topic)).strip()
            slug = slugify(art.get("slug") or title)
            if slug_exists(slug) or any(d.get("slug") == slug for d in done.values()):
                slug = f"{slug}-{random.randint(100,999)}"
            excerpt = strip_em_dashes(art.get("excerpt", "")).strip()
            meta = strip_em_dashes(art.get("meta_description", "")).strip()
            category = art.get("category", "").strip()
            if category not in CATEGORIES:
                category = item["category"] if item["category"] in CATEGORIES else "Guides"
            tags = [str(t).strip() for t in (art.get("tags") or []) if str(t).strip()][:5]
            content = strip_em_dashes(art.get("content_html", "")).strip()
            if len(content) < 400:
                raise RuntimeError("article body too short, skipping.")

            # guarantee the 3 internal links are present
            internal_urls = {l["url"] for l in internal}
            missing = [l for l in internal if l["url"] not in content]
            if missing:
                extra = " ".join(f'<a href="{l["url"]}">{l["title"]}</a>.' for l in missing)
                content += f'\n<p><strong>Related reading:</strong> {extra}</p>'

            # drop dead external links (keep anchor text)
            content = re.sub(r'<a\s+href="([^"]+)"[^>]*>(.*?)</a>',
                             lambda m: _prune_one(m, internal_urls), content, flags=re.S)

            # featured image from Pexels (free; optional)
            media_id = None
            img = fetch_pexels_image(art.get("image_query") or topic)
            if img:
                try:
                    media_id = upload_image(img, f"{slug}.jpg", title)
                except Exception as e:
                    log(f"  ! image upload failed: {e}")

            cat_id = get_or_create_term("categories", category)
            tag_ids = [get_or_create_term("tags", t) for t in tags]

            post = create_post(title, slug, content, excerpt or meta, cat_id, tag_ids, media_id)
            link = post.get("link", f"{SITE}/{slug}/")
            done[norm_topic(topic)] = {"slug": slug, "date": time.strftime("%Y-%m-%d"), "wp_id": post.get("id")}
            save_state(state)
            published += 1
            log(f"  OK [{STATUS}] -> {link}")
        except Exception as e:
            log(f"  SKIPPED: {e}")
        time.sleep(2)   # be gentle

    # cost estimate
    est = total_in / 1_000_000 * 1.0 + total_out / 1_000_000 * 5.0
    log(f"Tokens: in={total_in} out={total_out} | est. Claude cost this run ~ ${est:.3f}")

    # one rebuild of the static site at the end
    if published and CF_DEPLOY_HOOK:
        try:
            requests.post(CF_DEPLOY_HOOK, timeout=30)
            log("Triggered Cloudflare rebuild.")
        except Exception as e:
            log(f"! could not trigger rebuild: {e}")
    elif published:
        log("No CF_DEPLOY_HOOK set; publish a rebuild manually or rely on WP Webhooks.")

    log(f"=== run done | published {published}/{len(batch)} ===")


if __name__ == "__main__":
    main()
