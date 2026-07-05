// netlify/functions/submit-hazard-report.js
//
// Bromar Hub — hazard report email function.
// Downloads the PDF + photos from Supabase Storage and emails them via Resend.
//
// Env vars (set in Netlify → Site settings → Environment variables):
//   RESEND_API_KEY   Resend API key
//   FROM_EMAIL       Verified sender, e.g. "Bromar Service <servicet@bromar.com.au>"
//                    Until domain verified: "Bromar Hub <onboarding@resend.dev>"
//   TEST_TO          Optional — forces ALL mail to this inbox while domain unverified
//   SUPABASE_URL     Supabase project URL
//   SUPABASE_KEY     Service-role key (needed to download from private bucket)

const { createClient } = require('@supabase/supabase-js');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL     = process.env.FROM_EMAIL || 'Bromar Hub <onboarding@resend.dev>';
const TEST_TO        = process.env.TEST_TO;
const SUPABASE_URL   = process.env.SUPABASE_URL;
const SUPABASE_KEY   = process.env.SUPABASE_KEY;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: cors(), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const {
      report_id,
      recipients = [],
      report_data = {},
      pdf_path,
      photo_paths = [],
      subject,
    } = body;

    if (!recipients.length) return json(400, { error: 'No recipients provided' });
    if (!pdf_path)          return json(400, { error: 'No pdf_path provided' });

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // Download from Supabase Storage as base64
    async function downloadAsBase64(path) {
      const { data, error } = await supabase.storage.from('safety').download(path);
      if (error) throw new Error(`Failed to download ${path}: ${error.message}`);
      const buf = Buffer.from(await data.arrayBuffer());
      return {
        filename: path.split('/').pop() || 'file',
        content:  buf.toString('base64'),
      };
    }

    const attachments = [];
    attachments.push(await downloadAsBase64(pdf_path));
    for (const p of photo_paths) {
      try { attachments.push(await downloadAsBase64(p)); }
      catch (e) { console.warn(`Skipped photo ${p}:`, e.message); }
    }

    // Route to TEST_TO if set (domain not yet verified)
    const toList = TEST_TO ? [TEST_TO] : recipients;

    const html = buildHtml(report_id, report_data);

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: toList,
        subject: subject || `Hazard Report — ${report_data.risk_rating || ''}`,
        html,
        attachments,
      }),
    });

    if (!resendRes.ok) {
      const err = await resendRes.text();
      console.error('Resend error:', err);
      return json(502, { error: 'Email send failed', details: err });
    }

    const result = await resendRes.json();
    return json(200, {
      success: true,
      id: report_id,
      emailId: result.id,
      routed_to: toList,
    });

  } catch (err) {
    console.error(err);
    return json(500, { error: 'Internal error', details: String(err) });
  }
};

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}
function json(status, body) {
  return {
    statusCode: status,
    headers: { ...cors(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}
function esc(s) {
  if (s === null || s === undefined) return '—';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function buildHtml(reportId, d) {
  const reporter = d.is_anonymous
    ? `<p><em>Submitted anonymously — reporter details not recorded.</em></p>`
    : `<table style="border-collapse:collapse">
         <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Name</td><td>${esc(d.reporter_name)}</td></tr>
         <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Email</td><td>${esc(d.reporter_email)}</td></tr>
         <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Phone</td><td>${esc(d.reporter_phone)}</td></tr>
         <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Employee Type</td><td>${esc(d.reporter_type)}</td></tr>
       </table>`;
  const riskColors = { Low: '#0e9f6e', Medium: '#f59e0b', High: '#ef4444', Critical: '#991b1b' };
  const rc = riskColors[d.risk_rating] || '#6b7280';
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#111827">
      <div style="border-top:5px solid #c2440e;padding:16px 0;text-align:center">
        <h1 style="margin:0;font-size:24px;letter-spacing:1px">HAZARD REPORT</h1>
        <p style="margin:4px 0 0;color:#6b7280;font-size:13px">Bromar Engineering — WHS Hazard Notification</p>
      </div>
      <div style="background:#fff3ee;border-left:4px solid ${rc};padding:12px 16px;margin:16px 0;border-radius:6px">
        <strong style="color:${rc};font-size:14px">Risk Rating: ${esc(d.risk_rating)}</strong>
      </div>
      <h3 style="font-size:14px;color:#c2440e;border-bottom:1px solid #c2440e;padding-bottom:4px">Reporter</h3>
      ${reporter}
      <h3 style="font-size:14px;color:#c2440e;border-bottom:1px solid #c2440e;padding-bottom:4px;margin-top:20px">Hazard</h3>
      <table style="border-collapse:collapse;width:100%">
        <tr><td style="padding:4px 12px 4px 0;color:#6b7280;width:160px">Date</td><td>${esc(d.hazard_date)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Time</td><td>${esc(d.hazard_time)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Location</td><td>${esc(d.hazard_location)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Job #</td><td>${esc(d.job_number)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#6b7280">At risk</td><td>${esc(d.affected_persons)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Witnesses</td><td>${esc(d.witnesses)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Reported before</td><td>${esc(d.previously_reported)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Supervisor notified</td><td>${esc(d.supervisor_notified)}${d.supervisor_name ? ` (${esc(d.supervisor_name)})` : ''}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Type</td><td>${esc(d.hazard_type)}</td></tr>
      </table>
      <p style="margin-top:12px"><strong style="color:#6b7280">Description:</strong><br>${esc(d.hazard_description)}</p>
      <h3 style="font-size:14px;color:#c2440e;border-bottom:1px solid #c2440e;padding-bottom:4px;margin-top:20px">Action Taken</h3>
      <p><strong style="color:#6b7280">Immediate:</strong><br>${esc(d.immediate_action)}</p>
      <p><strong style="color:#6b7280">Suggested:</strong><br>${esc(d.suggested_action)}</p>
      <p style="margin-top:20px;color:#9ca3af;font-size:12px;text-align:center">
        Submitted ${esc(d.submitted_date)} · ${esc(d.revision)} · Report ID ${esc(reportId)}<br>
        Full PDF and photos attached
      </p>
    </div>
  `;
}
