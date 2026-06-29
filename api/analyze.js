// /api/analyze.js — AI analysis with Claude for the Search Console & Audit "Analyze with AI" buttons
// The frontend POSTs { kind: 'console'|'audit', domain, period, data }.
// Returns strict JSON: { bullets: [string], recommendations: [string] }.
// If ANTHROPIC_API_KEY isn't set, the frontend falls back to its built-in rule-based summary.
//
// SETUP: add ANTHROPIC_API_KEY in Vercel → Settings → Environment Variables.
// API billing is pay-as-you-go and separate from a Claude.ai subscription.
// Docs: https://docs.claude.com/en/api/overview

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(400).json({ error: 'ANTHROPIC_API_KEY not set' });

  const { kind, domain, period, data } = req.body || {};

  // ---- OVERVIEW: triage the whole workload across clients ----
  if (kind === 'overview') {
    const sysO = 'You are an SEO delivery lead helping a teammate triage their workload across all clients. You receive their tasks split into: pending_our_side, done_our_end_not_sent, sent_to_client, awaiting_client. Reply with STRICT JSON only: {"bullets":[string],"recommendations":[string]}. No markdown. Bullets: a clear status read (counts, which clients are heaviest, what is overdue or stuck). Recommendations: an ordered, specific "what needs your attention now" list — name the actual tasks/clients, prioritise overdue and items stuck awaiting the client, and flag finished work not yet sent. Keep each string under ~30 words.';
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1800, system: sysO, messages: [{ role: 'user', content: JSON.stringify(data).slice(0, 16000) }] })
      });
      const j = await r.json();
      const text = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
      let parsed; try { parsed = JSON.parse(text); } catch (e) { const mm = text.match(/\{[\s\S]*\}/); parsed = mm ? JSON.parse(mm[0]) : { bullets: [], recommendations: [] }; }
      return res.status(200).json({ bullets: parsed.bullets || [], recommendations: parsed.recommendations || [] });
    } catch (e) { return res.status(500).json({ error: String(e) }); }
  }

  // ---- REPORT: write a client SEO report from completed work ----
  if (kind === 'report') {
    const sysR = 'You are an SEO account manager writing a concise client report from a period\'s completed work. Reply with STRICT JSON only: {"bullets":[string],"recommendations":[string]}. No markdown, no preamble. Bullets summarize what was done and the client-side outcomes using the real items provided. Recommendations are concrete next steps. If a slide_format is provided, let it guide the structure and emphasis. Keep each string under ~30 words.';
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1500, system: sysR, messages: [{ role: 'user', content: JSON.stringify(data).slice(0, 14000) }] })
      });
      const j = await r.json();
      const text = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
      let parsed; try { parsed = JSON.parse(text); } catch (e) { const m = text.match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : { bullets: [], recommendations: [] }; }
      return res.status(200).json({ bullets: parsed.bullets || [], recommendations: parsed.recommendations || [] });
    } catch (e) { return res.status(500).json({ error: String(e) }); }
  }

  // ---- TASKS: read a worklist doc/image/pdf grouped by client -> task list ----
  if (kind === 'tasks') {
    const sysT = 'You read a worklist that groups tasks under client names (a client name as a heading, then tasks as bullets beneath it). Return STRICT JSON only: {"tasks":[{"client":string,"title":string,"type":string,"priority":"High"|"Medium"|"Low"}]}. No markdown, no preamble. "client" is the heading the task appears under. One task object per bullet/line. "type" must be one of: Keyword Research, Technical SEO, On-Page SEO, Content, Off-Page / Link Building, Local SEO, Site Audit, Analytics & Reporting, Other. Default priority to Medium unless the text clearly signals otherwise.';
    const content = [];
    if (data && data.notes) content.push({ type: 'text', text: 'Worklist document:\n' + String(data.notes).slice(0, 16000) });
    if (data && data.image) content.push({ type: 'image', source: { type: 'base64', media_type: data.mediaType || 'image/png', data: data.image } });
    if (data && data.pdf) content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: data.pdf } });
    if (!content.length) return res.status(200).json({ tasks: [] });
    content.push({ type: 'text', text: 'Extract every task as JSON now.' });
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 3000, system: sysT, messages: [{ role: 'user', content }] })
      });
      const j = await r.json();
      const text = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
      let parsed; try { parsed = JSON.parse(text); } catch (e) { const m = text.match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : { tasks: [] }; }
      return res.status(200).json({ tasks: parsed.tasks || [] });
    } catch (e) { return res.status(500).json({ error: String(e) }); }
  }

  // ---- QBR: turn meeting notes into prioritized quarterly targets ----
  if (kind === 'qbr') {
    const sysQ = 'You are an SEO strategist turning a manager\'s meeting notes into a quarterly target list for one client. Reply with STRICT JSON only: {"targets":[{"title":string,"priority":"High"|"Medium"|"Low","quantity":number,"taskType":string}]}. No markdown, no preamble. Each target is one concrete deliverable. If the notes specify a count (e.g. "12 articles"), set quantity to that number and keep the title singular-ish (e.g. "Publish SEO article"). Otherwise quantity is 1. taskType must be one of: Keyword Research, Technical SEO, On-Page SEO, Content, Off-Page / Link Building, Local SEO, Site Audit, Analytics & Reporting, Other. Infer priority from the notes; default Medium.';
    const promptQ = `Client: ${(data && data.client) || 'this client'}.\n\nMeeting notes / strategy doc:\n${String((data && data.notes) || '').slice(0, 14000)}`;
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 2000, system: sysQ, messages: [{ role: 'user', content: promptQ }] })
      });
      const j = await r.json();
      const text = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
      let parsed;
      try { parsed = JSON.parse(text); }
      catch (e) { const m = text.match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : { targets: [] }; }
      return res.status(200).json({ targets: parsed.targets || [] });
    } catch (e) {
      return res.status(500).json({ error: String(e) });
    }
  }

  const sys = 'You are an expert SEO analyst writing for an agency account manager. Reply with STRICT JSON only — {"bullets":[string],"recommendations":[string]} — no markdown, no preamble. Bullets must be specific and use the real numbers from the data.';

  let task = 'Summarize this SEO data.';
  if (kind === 'console') {
    task = `Analyze this Google Search Console data for ${domain} over "${period}". Bullets must cover: total clicks change vs the comparison period (with the %); the single keyword driving the most clicks; the keyword that dropped the most; the top 5 best-performing pages; the top 5 pages losing traffic. Recommendations: concrete actions for the upcoming period.`;
  } else if (kind === 'audit') {
    task = `Analyze this Ahrefs audit for ${domain}. Bullets must cover: Domain Rating and its change; backlinks / referring domains gained; how many tracked keywords improved vs dropped (name the notable ones); up to 5 new keywords now getting traffic; any competitor that overtook you for a keyword. Recommendations: concrete next steps.`;
  }

  const prompt = `${task}\n\nDATA (JSON):\n${JSON.stringify(data).slice(0, 14000)}`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1500, system: sys, messages: [{ role: 'user', content: prompt }] })
    });
    const j = await r.json();
    const text = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
    let parsed;
    try { parsed = JSON.parse(text); }
    catch (e) { const m = text.match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : { bullets: [text], recommendations: [] }; }
    return res.status(200).json({ bullets: parsed.bullets || [], recommendations: parsed.recommendations || [] });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
};
