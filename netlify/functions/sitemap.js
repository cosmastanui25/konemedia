// Generates /sitemap.xml dynamically from WordPress posts.
// Served via the redirect:  /sitemap.xml -> /.netlify/functions/sitemap
// Cache-Control max-age=43200 = 12 hours, so it auto-refreshes twice a day.

const SITE = "https://konemedia.co.ke";
const WP   = "https://cms.konemedia.co.ke";

exports.handler = async function () {
  try {
    let posts = [];
    let page = 1;
    while (page <= 20) { // safety cap (20 x 100 = 2000 posts)
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

    const urls = posts
      .filter((p) => p && p.slug)
      .map((p) => {
        const loc = `${SITE}/${encodeURIComponent(p.slug)}`;
        const lastmod = p.modified ? new Date(p.modified).toISOString() : new Date().toISOString();
        return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>daily</changefreq>\n  </url>`;
      })
      .join("\n");

    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=43200, s-maxage=43200",
      },
      body: xml,
    };
  } catch (e) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/xml; charset=utf-8" },
      body:
        `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n`,
    };
  }
};
