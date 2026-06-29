// Rewrites the canonical (and og:url) in the served HTML so the RAW page source
// matches the URL — fixing what crawlers / view-source / SEO tools read before JS runs.
// Mirrors the front-end's URL rules exactly.

const SITE = "https://konemedia.co.ke";
const CATEGORIES = ["Sports", "Business", "Finance", "Health", "Technology", "AI", "Guides", "Top 10"];
// Posts here use NO trailing slash; every other post keeps the trailing slash.
const NO_TRAILING_SLASH = new Set(["best-sites-to-play-aviator-in-kenya-a-ranked-comparison"]);

function canonicalFor(pathname) {
  const trimmed = pathname.replace(/^\/+|\/+$/g, "");
  if (!trimmed) return SITE + "/";
  const seg = decodeURIComponent(trimmed.split("/")[0]);
  if (seg.toLowerCase() === "contact") return SITE + "/contact";
  if (seg.toLowerCase() === "category") return SITE + "/"; // legacy, shouldn't be canonical
  const norm = seg.replace(/-/g, " ").trim().toLowerCase();
  const cat = CATEGORIES.find((c) => c.toLowerCase() === norm);
  if (cat) return SITE + "/" + cat.replace(/\s+/g, "-");
  // article
  return SITE + "/" + seg + (NO_TRAILING_SLASH.has(seg) ? "" : "/");
}

export default async (request, context) => {
  const response = await context.next();
  const ctype = response.headers.get("content-type") || "";
  if (!ctype.includes("text/html")) return response; // only rewrite HTML pages

  const canonical = canonicalFor(new URL(request.url).pathname);
  let html = await response.text();
  html = html
    .replace(
      /(<link id="meta-canonical" rel="canonical" href=")[^"]*(">)/,
      `$1${canonical}$2`
    )
    .replace(
      /(<meta id="meta-og-url" property="og:url" content=")[^"]*(">)/,
      `$1${canonical}$2`
    );

  const headers = new Headers(response.headers);
  headers.delete("content-length"); // body length changed
  return new Response(html, { status: response.status, headers });
};
