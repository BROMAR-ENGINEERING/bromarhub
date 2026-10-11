// ============================================================
// BROMAR HUB — CLIENT ACCESS REQUEST  (V1.00)
// POST /.netlify/functions/client-access-request
// Saves the request to Supabase (service role) and emails Bromar via Resend.
// Env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY),
//           RESEND_API_KEY, RESEND_FROM, ACCESS_REQUEST_EMAIL
// ============================================================

const SB_URL  = process.env.SUPABASE_URL || 'https://iwtvlpfprxqwveqadlwl.supabase.co';
const SB_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const NOTIFY  = process.env.ACCESS_REQUEST_EMAIL || 'ashleys@bromar.com.au';
const FROM    = process.env.RESEND_FROM;
const RESEND  = process.env.RESEND_API_KEY;
const OPS_URL = 'https://bromarhub.netlify.app';

const SECTIONS = {
  emergency_lighting: 'Emergency lighting',
  rcd_testing: 'RCD testing',
  test_tagging: 'Test & tagging'
};
const CLIENTS = { tyrecycle: 'Tyrecycle Somerton' };

const MAX_PER_IP_PER_HOUR = 5;

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body)
});

const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function sb(path, opts = {}) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {})
    }
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  if (!SB_KEY) return json(500, { error: 'Server not configured.' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return json(400, { error: 'Invalid request.' }); }

  // Honeypot — bots fill hidden field; pretend success
  if (body.website) return json(200, { ok: true });

  const data = {
    full_name:   clean(body.full_name, 120),
    position:    clean(body.position, 120),
    company:     clean(body.company, 120),
    email:       clean(body.email, 160).toLowerCase(),
    phone:       clean(body.phone, 40),
    reason:      clean(body.reason, 1000),
    client_slug: CLIENTS[body.client_slug] ? body.client_slug : 'tyrecycle',
    sections:    Array.isArray(body.sections) ? [...new Set(body.sections.filter(s => SECTIONS[s]))] : []
  };

  if (!data.full_name || !data.company) return json(400, { error: 'Enter your full name and company.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email)) return json(400, { error: 'Enter a valid work email address.' });
  if (!data.sections.length) return json(400, { error: 'Select at least one type of record.' });

  const ip = event.headers['x-nf-client-connection-ip'] || event.headers['x-forwarded-for'] || '';
  const ua = clean(event.headers['user-agent'], 300);

  try {
    // Rate limit per IP
    if (ip) {
      const hourAgo = new Date(Date.now() - 3600e3).toISOString();
      const recent = await sb(`client_access_requests?select=id&source_ip=eq.${encodeURIComponent(ip)}&created_at=gte.${encodeURIComponent(hourAgo)}`);
      if (recent.length >= MAX_PER_IP_PER_HOUR) return json(429, { error: 'Too many requests.' });
    }

    // Duplicate pending request from same email in last 24h — don't re-notify
    const dayAgo = new Date(Date.now() - 86400e3).toISOString();
    const dupe = await sb(`client_access_requests?select=id&email=eq.${encodeURIComponent(data.email)}&status=eq.pending&created_at=gte.${encodeURIComponent(dayAgo)}`);
    if (dupe.length) return json(200, { ok: true });

    const [row] = await sb('client_access_requests', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ ...data, source_ip: ip, user_agent: ua })
    });

    // Email Bromar (request is already saved, so email failure isn't fatal)
    if (RESEND && FROM) {
      const site = CLIENTS[data.client_slug];
      const rows = [
        ['Name', data.full_name],
        ['Position', data.position || '—'],
        ['Company', data.company],
        ['Email', data.email],
        ['Phone', data.phone || '—'],
        ['Site', site],
        ['Records requested', data.sections.map(s => SECTIONS[s]).join(', ')],
        ['Reason', data.reason || '—'],
        ['Submitted', new Date().toLocaleString('en-AU', { timeZone: 'Australia/Melbourne' })]
      ].map(([k, v]) => `<tr><td style="padding:6px 12px 6px 0;color:#636369;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:6px 0;color:#1a1a1e">${esc(v)}</td></tr>`).join('');

      const html = `
        <div style="font-family:Arial,sans-serif;max-width:560px">
          <h2 style="color:#ea580c;margin:0 0 4px">Compliance portal access request</h2>
          <p style="color:#636369;margin:0 0 16px">${esc(site)}</p>
          <table style="border-collapse:collapse;font-size:14px">${rows}</table>
          <p style="margin:20px 0 0;font-size:13px;color:#636369">
            Review and approve in Bromar Hub ops. Request ID: ${esc(row?.id || '')}<br/>
            <a href="${OPS_URL}" style="color:#ea580c">${OPS_URL}</a>
          </p>
        </div>`;

      try {
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${RESEND}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: FROM,
            to: NOTIFY.split(',').map(s => s.trim()).filter(Boolean),
            reply_to: data.email,
            subject: `Portal access request: ${data.full_name} (${data.company})`,
            html
          })
        });
        if (!r.ok) console.error('[client-access-request] Resend', r.status, await r.text());
      } catch (mailErr) {
        console.error('[client-access-request] Resend', mailErr);
      }
    } else {
      console.warn('[client-access-request] RESEND_API_KEY / RESEND_FROM not set — email skipped');
    }

    return json(200, { ok: true });
  } catch (err) {
    console.error('[client-access-request]', err);
    return json(500, { error: 'The request didn\'t send. Try again, or email admin@bromar.com.au.' });
  }
};
