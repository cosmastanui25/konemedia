// Generates /sitemap.xml dynamically: home + categories + contact + all posts.
// Served via redirect:  /sitemap.xml -> /.netlify/functions/sitemap
// Cache-Control max-age=43200 = 12 hours, so it auto-refreshes twice a day.

const SITE = "https://konemedia.co.ke";
const WP   = "https://cms.konemedia.co.ke";
// Must match the categories used by the site's menu/router.
const CATEGORIES = ["Sports", "Business", "Finance", "Health", "Technology", "AI", "Guides", "Top 10"];
// Posts here use NO trailing slash; all other posts keep the trailing slash.
const NO_TRAILING_SLASH = new Set(["best-sites-to-play-aviator-in-kenya-a-ranked-comparison"]);

function urlTag(loc, lastmod, changefreq, priority) {
  return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
}
function wrap(entries) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</urlset>\n`;
}
function catPath(name) {
  return "/" + name.trim().replace(/\s+/g, "-");
}

exports.handler = async function () {
  const now = new Date().toISOString();
  try {
    let posts = [];
    let page = 1;
    while (page <= 20) {
      const res = await fetch(
        `${WP}/wp-json/wp/v2/posts?per_page=100&page=${page}&_fields=slug,modified&orderby=modified`
      );
      if (!res.ok) break;
      const batch = await res.json();
      if (!Array.isArray(batch) || batch.length === 0) break;
      posts = posts.concat(batch);
      const totalPages = parseInt(res.headers.get("x-wp-totalpages") || "1", 10);
      if (page >= totalPages) break;
      page++;
    }

    // newest post date -> used as lastmod for home & category pages
    let newest = "";
    posts.forEach((p) => { if (p.modified && p.modified > newest) newest = p.modified; });
    const siteLastmod = newest ? new Date(newest).toISOString() : now;

    const entries = [];
    entries.push(urlTag(`${SITE}/`, siteLastmod, "daily", "1.0"));                 // home
    CATEGORIES.forEach((c) =>                                                       // categories
      entries.push(urlTag(`${SITE}${encodeURI(catPath(c))}`, siteLastmod, "daily", "0.6"))
    );
    entries.push(urlTag(`${SITE}/contact`, now, "monthly", "0.3"));                 // contact
    posts.filter((p) => p && p.slug).forEach((p) => {                               // posts
      const slash = NO_TRAILING_SLASH.has(p.slug) ? "" : "/";
      entries.push(urlTag(`${SITE}/${encodeURIComponent(p.slug)}${slash}`,
        p.modified ? new Date(p.modified).toISOString() : now, "daily", "0.8"));
    });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=43200, s-maxage=43200",
      },
      body: wrap(entries),
    };
  } catch (e) {
    // Fallback: still list home, categories and contact even if WordPress is unreachable.
    const entries = [urlTag(`${SITE}/`, now, "daily", "1.0")];
    CATEGORIES.forEach((c) => entries.push(urlTag(`${SITE}${encodeURI(catPath(c))}`, now, "daily", "0.6")));
    entries.push(urlTag(`${SITE}/contact`, now, "monthly", "0.3"));
    return { statusCode: 200, headers: { "Content-Type": "application/xml; charset=utf-8" }, body: wrap(entries) };
  }
};
