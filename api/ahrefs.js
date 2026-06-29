// /api/ahrefs.js — full SEO audit bundle from the Ahrefs API v3
// Call: /api/ahrefs?target=domain.com
// Returns: overview metrics (+3-month changes), 24-month monthly history for charts,
//          AI citation counts, latest best backlinks, and top organic keywords.
// SETUP: Vercel env var AHREFS_API_TOKEN (Ahrefs → Account settings → API keys).

module.exports = async function handler(req, res) {
  const token = process.env.AHREFS_API_TOKEN;
  let params = {};
  try { params = Object.fromEntries(new URL(req.url, 'http://localhost').searchParams); } catch (e) {}
  const target = params.target || (req.query && req.query.target) || '';
  if (!token) return res.status(200).json({ error: 'not_configured' });
  if (!target) return res.status(400).json({ error: 'pass ?target=domain.com' });

  const base = 'https://api.ahrefs.com/v3';
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  const t = encodeURIComponent(target);
  const sel = s => encodeURIComponent(s);
  const iso = d => d.toISOString().slice(0, 10);
  const today = iso(new Date());
  const prev3 = iso(new Date(Date.now() - 91 * 86400000));   // ~3 months ago (for changes)
  const histFrom = iso(new Date(Date.now() - 730 * 86400000)); // ~24 months for charts

  const get = async (path) => { try { const r = await fetch(`${base}${path}`, { headers }); if (!r.ok) return null; return await r.json(); } catch (e) { return null; } };

  const aiSel = 'google_ai_overviews,google_ai_mode,chatgpt,gemini,perplexity,copilot,grok,google_ai_overviews_keywords';

  const [drNow, drPrev, mNow, mPrev, bNow, bPrev, drHist, urHist, rdHist, mHist, ai, backlinks, okw] = await Promise.all([
    get(`/site-explorer/domain-rating?target=${t}&date=${today}`),
    get(`/site-explorer/domain-rating?target=${t}&date=${prev3}`),
    get(`/site-explorer/metrics?target=${t}&date=${today}&mode=subdomains&volume_mode=monthly`),
    get(`/site-explorer/metrics?target=${t}&date=${prev3}&mode=subdomains&volume_mode=monthly`),
    get(`/site-explorer/backlinks-stats?target=${t}&date=${today}&mode=subdomains`),
    get(`/site-explorer/backlinks-stats?target=${t}&date=${prev3}&mode=subdomains`),
    get(`/site-explorer/domain-rating-history?target=${t}&date_from=${histFrom}&history_grouping=monthly`),
    get(`/site-explorer/url-rating-history?target=${t}&date_from=${histFrom}&history_grouping=monthly`),
    get(`/site-explorer/refdomains-history?target=${t}&date_from=${histFrom}&history_grouping=monthly&mode=subdomains`),
    get(`/site-explorer/metrics-history?target=${t}&date_from=${histFrom}&history_grouping=monthly&mode=subdomains&volume_mode=monthly&select=${sel('date,org_traffic,org_cost,paid_traffic,paid_cost')}`),
    get(`/site-explorer/ai-responses-count?target=${t}&date=${today}&mode=subdomains&select=${sel(aiSel)}`),
    get(`/site-explorer/all-backlinks?target=${t}&mode=subdomains&aggregation=1_per_domain&limit=20&order_by=first_seen:desc&select=${sel('url_from,domain_rating_source,anchor,first_seen,is_dofollow,traffic_domain')}`),
    get(`/site-explorer/organic-keywords?target=${t}&date=${today}&date_compared=${prev3}&mode=subdomains&volume_mode=monthly&limit=20&order_by=${sel('sum_traffic:desc')}&select=${sel('keyword,best_position,best_position_diff,volume,best_position_url')}`)
  ]);

  const drVal = o => o ? (typeof o.domain_rating === 'object' && o.domain_rating ? o.domain_rating.domain_rating : o.domain_rating) : null;
  const arVal = o => o ? (typeof o.domain_rating === 'object' && o.domain_rating ? o.domain_rating.ahrefs_rank : o.ahrefs_rank) : null;
  const m = (mNow && mNow.metrics) || {}, mp = (mPrev && mPrev.metrics) || {};
  const bs = (bNow && bNow.metrics) || {}, bsp = (bPrev && bPrev.metrics) || {};
  const num = x => (x == null ? null : x);
  const diff = (a, b) => (a == null || b == null ? null : a - b);

  // ----- build a unified monthly date axis for the charts -----
  const drArr = (drHist && drHist.domain_ratings) || [];
  const urArr = (urHist && urHist.url_ratings) || [];
  const rdArr = (rdHist && rdHist.refdomains) || [];
  const mArr = (mHist && mHist.metrics) || [];
  const dateSet = {};
  [drArr, urArr, rdArr, mArr].forEach(a => a.forEach(o => { if (o && o.date) dateSet[o.date] = 1; }));
  const dates = Object.keys(dateSet).sort();
  const mapBy = (arr, key, scale) => { const x = {}; (arr || []).forEach(o => { if (o && o.date != null) x[o.date] = (o[key] == null ? null : o[key] * (scale || 1)); }); return dates.map(d => (x[d] != null ? x[d] : null)); };

  const urLast = urArr.length ? urArr[urArr.length - 1].url_rating : null;

  const aic = (ai && ai.ai_responses_count) || {};
  const aiCell = o => (o && typeof o === 'object') ? { citations: o.citations || 0, pages: o.pages || 0 } : { citations: 0, pages: 0 };

  return res.status(200).json({
    domain: target,
    // overview — backlink profile
    dr: drVal(drNow), dr_change: diff(drVal(drNow), drVal(drPrev)),
    ur: urLast,
    ahrefs_rank: arVal(drNow), ar_change: diff(arVal(drNow), arVal(drPrev)),
    backlinks: num(bs.live), backlinks_change: diff(bs.live, bsp.live), backlinks_all: num(bs.all_time),
    refdomains: num(bs.live_refdomains), refdomains_change: diff(bs.live_refdomains, bsp.live_refdomains), refdomains_all: num(bs.all_time_refdomains),
    // overview — search
    org_keywords: num(m.org_keywords), org_keywords_change: diff(m.org_keywords, mp.org_keywords),
    org_traffic: num(m.org_traffic), org_traffic_change: diff(m.org_traffic, mp.org_traffic),
    top3: num(m.org_keywords_1_3),
    org_value: m.org_cost != null ? Math.round(m.org_cost / 100) : null,
    paid_keywords: num(m.paid_keywords), paid_traffic: num(m.paid_traffic),
    paid_value: m.paid_cost != null ? Math.round(m.paid_cost / 100) : null,
    // AI responses
    ai: {
      google_ai_overviews: aiCell(aic.google_ai_overviews), google_ai_mode: aiCell(aic.google_ai_mode),
      chatgpt: aiCell(aic.chatgpt), gemini: aiCell(aic.gemini), perplexity: aiCell(aic.perplexity),
      copilot: aiCell(aic.copilot), grok: aiCell(aic.grok), aio_keywords: aiCell(aic.google_ai_overviews_keywords)
    },
    // chart history (monthly, ~24 months)
    history: {
      dates,
      dr: mapBy(drArr, 'domain_rating'),
      ur: mapBy(urArr, 'url_rating'),
      refdomains: mapBy(rdArr, 'refdomains'),
      org_traffic: mapBy(mArr, 'org_traffic'),
      org_value: mapBy(mArr, 'org_cost', 1 / 100),
      paid_traffic: mapBy(mArr, 'paid_traffic'),
      paid_value: mapBy(mArr, 'paid_cost', 1 / 100)
    },
    latest_backlinks: (backlinks && backlinks.backlinks) || [],
    keywords_list: (okw && okw.keywords) || []
  });
};
