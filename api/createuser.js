// /api/createuser.js — Super admin creates a new manager login (Supabase Admin API)
// POST { access_token, email, password, name, role }
// SETUP (Vercel env vars):
//   SUPABASE_URL                = https://<project>.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY   = Supabase → Settings → API → service_role secret (KEEP SECRET)
//   SUPER_ADMIN_EMAILS          = comma-separated emails allowed to create users
// The caller must be logged in AND their email must be in SUPER_ADMIN_EMAILS.

function readBody(req){ return new Promise(r=>{ let d=''; req.on('data',c=>d+=c); req.on('end',()=>{ try{ r(d?JSON.parse(d):{}); }catch(e){ r({}); } }); req.on('error',()=>r({})); }); }

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const url = process.env.SUPABASE_URL, svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !svc) return res.status(200).json({ error: 'not_configured' });

  let body = req.body && typeof req.body === 'object' ? req.body : await readBody(req);
  const { access_token, email, password, name, role } = body || {};
  if (!access_token) return res.status(401).json({ error: 'Not signed in.' });
  if (!email || !password) return res.status(400).json({ error: 'Email and a temporary password are required.' });
  if (String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

  // 1) verify the caller is a logged-in super admin
  try {
    const who = await fetch(url + '/auth/v1/user', { headers: { apikey: svc, Authorization: 'Bearer ' + access_token } });
    const u = await who.json();
    const callerEmail = ((u && u.email) || '').toLowerCase();
    const supers = (process.env.SUPER_ADMIN_EMAILS || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
    if (!callerEmail || (supers.length && !supers.includes(callerEmail))) return res.status(403).json({ error: 'Only a super admin can create logins.' });
  } catch (e) { return res.status(401).json({ error: 'Could not verify your session.' }); }

  // 2) create the confirmed user
  try {
    const r = await fetch(url + '/auth/v1/admin/users', {
      method: 'POST',
      headers: { apikey: svc, Authorization: 'Bearer ' + svc, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { name: name || email.split('@')[0], role: role || 'Manager' } })
    });
    const j = await r.json();
    if (!r.ok) return res.status(400).json({ error: j.msg || j.error_description || j.error || 'Could not create that user.' });
    return res.status(200).json({ ok: true, id: j.id, email: j.email });
  } catch (e) { return res.status(500).json({ error: String(e) }); }
};
