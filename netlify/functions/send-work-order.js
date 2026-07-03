// ============================================================
// Netlify Function — Send Work Order Completion email via Resend
// Location in repo: netlify/functions/send-work-order.js
// Called by the form at: /.netlify/functions/send-work-order
//
// Required Netlify environment variables:
//   RESEND_API_KEY     re_xxxxxxxx  (from resend.com → API Keys)
//   CLIENT_EMAIL       the Tyrecycle recipient address
// Optional:
//   RESEND_FROM        default: "Bromar Service <servicet@bromar.com.au>"
//                      (must be an address on a domain verified in Resend)
//   MANAGEMENT_EMAILS  comma-separated CC list, default: ashleys@bromar.com.au
// ============================================================

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const d = JSON.parse(event.body || '{}');

    const FROM = process.env.RESEND_FROM || 'Bromar Service <servicet@bromar.com.au>';
    const TO   = process.env.CLIENT_EMAIL;
    const CC   = (process.env.MANAGEMENT_EMAILS || 'ashleys@bromar.com.au')
                   .split(',').map(s => s.trim()).filter(Boolean);

    if (!process.env.RESEND_API_KEY || !TO) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Missing RESEND_API_KEY or CLIENT_EMAIL env var' }) };
    }

    const esc = (v) => String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const row = (label, value) =>
      `<tr><td style="padding:8px 14px;font-weight:600;color:#111827;border-bottom:1px solid #eee;white-space:nowrap;">${label}</td>` +
      `<td style="padding:8px 14px;color:#374151;border-bottom:1px solid #eee;">${esc(value) || '—'}</td></tr>`;

    let rows =
      row('Technician', d.technician_name) +
      row('Technician Email', d.technician_email) +
      row('Completion Date', d.completion_date) +
      row('Work Order #', d.work_order_number) +
      row('Asset #', d.asset_number) +
      row('Status', d.completion_status) +
      row('Remedials Performed', d.remedial_works) +
      row('Improvement Suggestions', d.improvement_suggestions) +
      row('Other Comments', d.other_comments) +
      row('New Work Order Required', d.new_work_order_required);

    if (d.new_work_order_required === 'Yes') {
      rows += row('Urgency Level', d.urgency_level) +
              row('Remedial Description', d.remedial_description);
    }
    rows += row('Submitted', d.submitted_date);

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;">
        <h2 style="color:#c2440e;margin:0 0 4px;">Work Order Completion Submission</h2>
        <p style="color:#6b7280;margin:0 0 18px;">WO ${esc(d.work_order_number)} — ${esc(d.completion_status)}</p>
        <table style="width:100%;border-collapse:collapse;border:1px solid #eee;border-radius:8px;overflow:hidden;">
          ${rows}
        </table>
        <p style="color:#9ca3af;font-size:12px;margin-top:18px;">Submitted via Bromar Hub — Tyrecycle Work Order Completion.</p>
      </div>`;

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: FROM,
        to: [TO],
        cc: CC,
        reply_to: d.technician_email || undefined,
        subject: `Work Order ${d.work_order_number || ''} — ${d.completion_status || 'Completion'}`,
        html
      })
    });

    const data = await resp.json();
    if (!resp.ok) {
      return { statusCode: resp.status, body: JSON.stringify({ error: data }) };
    }
    return { statusCode: 200, body: JSON.stringify({ ok: true, id: data.id }) };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
