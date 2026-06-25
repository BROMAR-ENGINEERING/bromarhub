// ============================================================
// BROMAR HUB — Roster Change Email Notifier
// Path: netlify/functions/send-roster-change-email.js
// Env var required: SENDGRID_API_KEY
// ============================================================

const ADMIN_EMAIL  = 'admin@bromar.com.au';
const FROM_EMAIL   = 'servicet@bromar.com.au';
const CAL_LINK     = 'https://bromarhub.netlify.app/schedules/callout-roster-calendar.html';

function fmt(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d} ${months[m - 1]} ${y}`;
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: 'SENDGRID_API_KEY not configured' };
  }

  let p;
  try { p = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, body: 'Invalid JSON' }; }

  const arranged = p.swap_type === 'swap_arranged';
  const origRange = p.original_start_date === p.original_end_date
    ? fmt(p.original_start_date)
    : `${fmt(p.original_start_date)} → ${fmt(p.original_end_date)}`;
  const swapRange = p.swap_start_date === p.swap_end_date
    ? fmt(p.swap_start_date)
    : `${fmt(p.swap_start_date)} → ${fmt(p.swap_end_date)}`;

  const swapBlock = arranged
    ? `<tr><td style="padding:6px 0;color:#636369">Swap with</td><td style="padding:6px 0;font-weight:600">${esc(p.swap_with_name)} ${p.swap_with_email ? `(${esc(p.swap_with_email)})` : ''}</td></tr>
       <tr><td style="padding:6px 0;color:#636369">Date they'll take</td><td style="padding:6px 0;font-weight:600">${origRange}</td></tr>
       <tr><td style="padding:6px 0;color:#636369">Date requester will take</td><td style="padding:6px 0;font-weight:600">${swapRange} ${p.swap_shift_type ? `· ${esc(p.swap_shift_type)}` : ''}</td></tr>`
    : `<tr><td style="padding:6px 0;color:#636369">Cover</td><td style="padding:6px 0;font-weight:600;color:#c2410c">No swap organised — admin to arrange cover</td></tr>`;

  const html = `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1e">
    <div style="background:#ea580c;color:#fff;padding:18px 24px;border-radius:12px 12px 0 0">
      <h2 style="margin:0;font-size:18px">Roster Change / Swap Request</h2>
    </div>
    <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:24px">
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:6px 0;color:#636369;width:42%">Requested by</td><td style="padding:6px 0;font-weight:600">${esc(p.requested_by)} ${p.requested_by_email ? `(${esc(p.requested_by_email)})` : ''}</td></tr>
        <tr><td style="padding:6px 0;color:#636369">Date to change</td><td style="padding:6px 0;font-weight:600">${origRange} ${p.original_shift_type ? `· ${esc(p.original_shift_type)}` : ''}</td></tr>
        <tr><td style="padding:6px 0;color:#636369">Type</td><td style="padding:6px 0;font-weight:600">${arranged ? 'Swap organised' : 'No swap organised'}</td></tr>
        ${swapBlock}
        ${p.notes ? `<tr><td style="padding:6px 0;color:#636369;vertical-align:top">Notes</td><td style="padding:6px 0">${esc(p.notes)}</td></tr>` : ''}
      </table>
      <a href="${CAL_LINK}" style="display:inline-block;margin-top:18px;background:#ea580c;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:600;font-size:14px">Open Roster Calendar</a>
    </div>
  </div>`;

  const body = {
    personalizations: [{ to: [{ email: ADMIN_EMAIL }] }],
    from: { email: FROM_EMAIL, name: 'Bromar Hub' },
    reply_to: p.requested_by_email ? { email: p.requested_by_email } : undefined,
    subject: `Roster ${arranged ? 'swap' : 'change'} request — ${p.requested_by} (${origRange})`,
    content: [{ type: 'text/html', value: html }]
  };

  try {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const txt = await res.text();
      return { statusCode: 502, body: `SendGrid error: ${res.status} ${txt}` };
    }
    return { statusCode: 200, body: JSON.stringify({ sent: true }) };
  } catch (err) {
    return { statusCode: 500, body: `Send failed: ${err.message}` };
  }
};
