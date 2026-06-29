// /api/gsc.js — Google Search Console properties + performance
// Runs on Vercel as a serverless function. Secrets live in Vercel env vars,
// NEVER in the frontend. Returns an array shaped like the dashboard expects:
//   [{ domain, series:[numbers], keywords, position }, ...]
//
// SETUP (one time):
// 1) Google Cloud Console → create a project → enable "Google Search Console API".
// 2) Create OAuth credentials (Web application). Authorized redirect URI:
//      https://YOUR-DOMAIN/api/gsc-callback
// 3) Put these in Vercel → Project → Settings → Environment Variables:
//      GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
//    (The refresh token is obtained once via the OAuth consent flow — see README.)
//
// This handler uses the refresh token to get a short-lived access token,
// lists all properties you can access, and pulls clicks per day for each.

module.exports = async function handler(req, res) {
  try {
    const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env;
    if (!GOOGLE_CLIENT_ID || !GOOGLE_REFRESH_TOKEN) {
      return res.status(200).json([]); // not configured yet → frontend shows sample data
    }

    // 1) refresh token -> access token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: GOOGLE_REFRESH_TOKEN,
        grant_type: 'refresh_token'
      })
    });
    const { access_token } = await tokenRes.json();
    const auth = { Authorization: `Bearer ${access_token}` };

    // 2) list all properties
    const sitesRes = await fetch('https://www.googleapis.com/webmasters/v3/sites', { headers: auth });
    const sites = (await sitesRes.json()).siteEntry || [];

    const iso = d => d.toISOString().slice(0, 10);
    const cleanDomain = u => u.replace(/^sc-domain:/, '').replace(/^https?:\/\//, '').replace(/\/$/, '');

    // 3-letter ISO country code -> friendly name (falls back to UPPERCASE code)
    const CC = { ken:'Kenya', tza:'Tanzania', uga:'Uganda', nga:'Nigeria', zaf:'South Africa',
      usa:'United States', gbr:'United Kingdom', ind:'India', gha:'Ghana', rwa:'Rwanda',
      eth:'Ethiopia', egy:'Egypt', can:'Canada', aus:'Australia', deu:'Germany', fra:'France',
      are:'UAE', sau:'Saudi Arabia', zmb:'Zambia', moz:'Mozambique', cod:'DR Congo',
      bdi:'Burundi', ssd:'South Sudan', som:'Somalia', mwi:'Malawi', bwa:'Botswana' };
    const titleCase = s => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;
    const pathOf = u => { try { return new URL(u).pathname || u; } catch { return u; } };

    // one searchAnalytics query for a given property + date range (fails soft to [])
    const query = (prop, body, range) => fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(prop)}/searchAnalytics/query`,
      { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate: range.startDate, endDate: range.endDate, ...body }) }
    ).then(r => r.json()).then(j => j.rows || []).catch(() => []);

    const metricRow = r => ({
      clicks: Math.round(r.clicks || 0),
      impressions: Math.round(r.impressions || 0),
      ctr: +(((r.ctr || 0) * 100).toFixed(1)),
      position: +((r.position || 0).toFixed(1))
    });

    // pull all four dimension breakdowns (+ daily series) for one property over a range
    const pullProperty = async (prop, range) => {
      const [dateRows, qRows, pRows, cRows, dRows] = await Promise.all([
        query(prop, { dimensions: ['date'], rowLimit: 500 }, range),
        query(prop, { dimensions: ['query'], rowLimit: 100 }, range),
        query(prop, { dimensions: ['page'], rowLimit: 100 }, range),
        query(prop, { dimensions: ['country'], rowLimit: 50 }, range),
        query(prop, { dimensions: ['device'], rowLimit: 10 }, range)
      ]);
      return {
        domain: cleanDomain(prop),
        series: dateRows.map(row => Math.round(row.clicks)),
        impr: dateRows.map(row => Math.round(row.impressions || 0)),
        pos: dateRows.map(row => +(row.position || 0).toFixed(1)),
        queries: qRows.map(r => ({ q: r.keys[0], ...metricRow(r) })),
        pages: pRows.map(r => ({ url: pathOf(r.keys[0]), ...metricRow(r) })),
        countries: cRows.map(r => ({ country: CC[r.keys[0]] || (r.keys[0] || '').toUpperCase(), ...metricRow(r) })),
        devices: dRows.map(r => ({ device: titleCase(r.keys[0]), ...metricRow(r) })),
        keywords: qRows.length,
        position: dateRows.length ? (dateRows.reduce((a, b) => a + b.position, 0) / dateRows.length).toFixed(1) : '0'
      };
    };

    // parse query params (runtime-agnostic)
    let params = {};
    try { params = Object.fromEntries(new URL(req.url, 'http://localhost').searchParams); } catch (e) {}

    // ---- DETAIL MODE: one property, exact date range (tables follow the selected period) ----
    if (params.detail) {
      const today = new Date(), d28 = new Date(); d28.setDate(d28.getDate() - 27);
      const range = { startDate: params.from || iso(d28), endDate: params.to || iso(today) };
      const site = sites.find(s => cleanDomain(s.siteUrl) === params.detail);
      if (!site) return res.status(200).json({});
      const data = await pullProperty(site.siteUrl, range);
      res.setHeader('Cache-Control', 's-maxage=600'); // 10 min
      return res.status(200).json(data);
    }

    // ---- GRID MODE: all properties, last ~13 months (so previous-period / YoY compares have data) ----
    const end = new Date(), start = new Date(); start.setDate(start.getDate() - 400);
    const baseRange = { startDate: iso(start), endDate: iso(end) };
    const out = await Promise.all(sites.map(s => pullProperty(s.siteUrl, baseRange)));
    res.setHeader('Cache-Control', 's-maxage=3600'); // cache 1h
    return res.status(200).json(out);
  } catch (e) {
    return res.status(200).json([]); // fail soft → sample data
  }
};
