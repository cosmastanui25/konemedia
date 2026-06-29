// /api/report.js — generate a client report with Claude
// The frontend POSTs the compiled context (tasks done, GSC numbers, Ahrefs audit)
// and a request like "weekly report for Betika as slides". Claude returns the
// report content (summary + per-section bullets + recommendations) which the
// frontend renders into the existing slide/PDF view.
//
// SETUP:
// - Anthropic API key (API billing is pay-as-you-go and SEPARATE from a Claude.ai
//   subscription). Create one at the Anthropic Console.
// - Vercel env var: ANTHROPIC_API_KEY
// API docs: https://docs.claude.com/en/api/overview

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(400).json({ error: 'ANTHROPIC_API_KEY not set' });

  // Vercel parses JSON body automatically when Content-Type is application/json
  const { client, period, format, tasks = [], gsc = {}, ahrefs = {}, houseFormat = '' } = req.body || {};

  const prompt = `You are an SEO account manager writing a ${period || 'weekly'} report for the client "${client}".
Output it as content for a ${format || 'slide'} deck.

Work we logged this period (completed and not completed):
${JSON.stringify(tasks, null, 2)}

Search Console performance:
${JSON.stringify(gsc, null, 2)}

Quick Ahrefs audit (DR, traffic, latest backlinks, keyword positions):
${JSON.stringify(ahrefs, null, 2)}

${houseFormat ? `Follow this slide format exactly:\n${houseFormat}\n` : ''}
Write: (1) a short summary, (2) one section per SEO area with client-friendly bullets,
(3) concrete recommendations and next steps grounded in the data above. Return clean JSON:
{ "title": "...", "summary": ["..."], "sections": [{"heading":"...","bullets":["..."]}], "recommendations": ["..."] }`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await r.json();
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
    return res.status(200).json({ raw: text });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
};
