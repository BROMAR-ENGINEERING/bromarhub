// ============================================================
// Bromar Hub — submit-uniform-request
// POST /.netlify/functions/submit-uniform-request
//
// Payload (JSON):
// {
//   employee_name, employee_email, employee_phone, employee_role,
//   items: [{ item, size, quantity }],
//   total_quantity, total_types, notes
// }
//
// Behaviour:
//   1. Insert row into `uniform_requests` (Supabase).
//   2. Email admin (ashleys@bromar.com.au) with request summary.
//   3. Email employee a confirmation.
//   4. Return { success: true, id, emailId }.
// ============================================================

const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

const ADMIN_EMAIL = 'ashleys@bromar.com.au';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }

  const {
    employee_name, employee_email, employee_phone, employee_role,
    items, total_quantity, total_types, notes,
  } = body;

  // ── Validation ─────────────────────────────────────────────
  if (!employee_name || !employee_email) {
    return json(400, { error: 'Missing required fields: employee_name, employee_email' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return json(400, { error: 'At least one item is required' });
  }
  for (const it of items) {
    if (!it.item || !it.size || !it.quantity) {
      return json(400, { error: 'Each item requires: item, size, quantity', details: it });
    }
  }

  // ── Supabase insert ────────────────────────────────────────
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

  const { data: row, error: dbErr } = await supabase
    .from('uniform_requests')
    .insert({
      employee_name,
      employee_email,
      employee_phone: employee_phone || null,
      employee_role:  employee_role  || null,
      items,
      total_quantity: total_quantity || items.reduce((s, i) => s + Number(i.quantity || 0), 0),
      total_types:    total_types    || items.length,
      notes:          notes || null,
    })
    .select('id, created_at')
    .single();

  if (dbErr) {
    console.error('Supabase insert error:', dbErr);
    return json(500, { error: 'Database write failed', details: dbErr.message });
  }

  // ── Resend email ───────────────────────────────────────────
  const resend = new Resend(process.env.RESEND_API_KEY);
  const from   = process.env.FROM_EMAIL || 'Bromar Hub <onboarding@resend.dev>';
  const testTo = process.env.TEST_TO || null;

  const submittedDate = new Date(row.created_at).toLocaleString('en-AU', {
    timeZone: 'Australia/Melbourne',
    dateStyle: 'long', timeStyle: 'short',
  });

  const itemRowsHtml = items.map(i =>
    `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${escapeHtml(i.item)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${escapeHtml(i.size)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:600;">${escapeHtml(String(i.quantity))}</td>
    </tr>`
  ).join('');

  const itemRowsText = items.map(i => `  • ${i.item} — Size ${i.size} × ${i.quantity}`).join('\n');

  const adminHtml = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#111827;">
      <div style="background:#ea580c;color:white;padding:20px 24px;border-radius:8px 8px 0 0;">
        <h2 style="margin:0;font-size:20px;">New PPE / Uniform Request</h2>
        <p style="margin:6px 0 0;font-size:13px;opacity:0.9;">Submitted ${submittedDate}</p>
      </div>
      <div style="background:#fafafa;padding:20px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
        <h3 style="margin:0 0 12px;font-size:14px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Employee</h3>
        <p style="margin:0 0 4px;"><strong>${escapeHtml(employee_name)}</strong></p>
        <p style="margin:0 0 4px;font-size:14px;">${escapeHtml(employee_email)}</p>
        ${employee_phone ? `<p style="margin:0 0 4px;font-size:14px;">${escapeHtml(employee_phone)}</p>` : ''}
        ${employee_role  ? `<p style="margin:0 0 4px;font-size:14px;color:#6b7280;">${escapeHtml(employee_role)}</p>` : ''}

        <h3 style="margin:20px 0 12px;font-size:14px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Items Requested</h3>
        <table style="width:100%;border-collapse:collapse;background:white;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
          <thead>
            <tr style="background:#f3f4f6;">
              <th style="padding:10px 12px;text-align:left;font-size:12px;text-transform:uppercase;color:#6b7280;">Item</th>
              <th style="padding:10px 12px;text-align:center;font-size:12px;text-transform:uppercase;color:#6b7280;">Size</th>
              <th style="padding:10px 12px;text-align:center;font-size:12px;text-transform:uppercase;color:#6b7280;">Qty</th>
            </tr>
          </thead>
          <tbody>${itemRowsHtml}</tbody>
          <tfoot>
            <tr style="background:#fff3ee;">
              <td colspan="2" style="padding:10px 12px;font-weight:600;text-align:right;">Total</td>
              <td style="padding:10px 12px;font-weight:700;text-align:center;color:#c2440e;">${total_quantity || items.reduce((s, i) => s + Number(i.quantity || 0), 0)}</td>
            </tr>
          </tfoot>
        </table>

        ${notes ? `
          <h3 style="margin:20px 0 8px;font-size:14px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Notes</h3>
          <p style="margin:0;padding:12px;background:white;border:1px solid #e5e7eb;border-radius:6px;font-size:14px;line-height:1.5;">${escapeHtml(notes)}</p>
        ` : ''}

        <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;">Request ID: ${row.id}</p>
      </div>
    </div>
  `;

  const adminText = [
    `New PPE / Uniform Request`,
    `Submitted: ${submittedDate}`,
    ``,
    `Employee: ${employee_name}`,
    `Email: ${employee_email}`,
    employee_phone ? `Phone: ${employee_phone}` : null,
    employee_role  ? `Role:  ${employee_role}`  : null,
    ``,
    `Items:`,
    itemRowsText,
    ``,
    notes ? `Notes:\n${notes}` : null,
    ``,
    `Request ID: ${row.id}`,
  ].filter(Boolean).join('\n');

  const employeeHtml = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#111827;">
      <div style="background:#ea580c;color:white;padding:20px 24px;border-radius:8px 8px 0 0;">
        <h2 style="margin:0;font-size:20px;">PPE / Uniform Request Received</h2>
      </div>
      <div style="background:#fafafa;padding:20px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
        <p style="margin:0 0 16px;">Hi ${escapeHtml(employee_name.split(' ')[0])},</p>
        <p style="margin:0 0 16px;">Your request has been received and forwarded to admin. You'll be notified when it's fulfilled.</p>

        <h3 style="margin:20px 0 12px;font-size:14px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Your Request</h3>
        <table style="width:100%;border-collapse:collapse;background:white;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
          <thead>
            <tr style="background:#f3f4f6;">
              <th style="padding:10px 12px;text-align:left;font-size:12px;text-transform:uppercase;color:#6b7280;">Item</th>
              <th style="padding:10px 12px;text-align:center;font-size:12px;text-transform:uppercase;color:#6b7280;">Size</th>
              <th style="padding:10px 12px;text-align:center;font-size:12px;text-transform:uppercase;color:#6b7280;">Qty</th>
            </tr>
          </thead>
          <tbody>${itemRowsHtml}</tbody>
        </table>

        <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;">Reference: ${row.id}<br/>Submitted ${submittedDate}</p>
      </div>
    </div>
  `;

  let emailId = null;
  try {
    // Admin email
    const adminRes = await resend.emails.send({
      from,
      to: testTo || ADMIN_EMAIL,
      subject: `PPE / Uniform Request — ${employee_name}`,
      html: adminHtml,
      text: adminText,
      reply_to: employee_email,
    });
    emailId = adminRes?.data?.id || null;

    // Employee confirmation (only if we have a real address and TEST_TO isn't overriding)
    if (employee_email) {
      await resend.emails.send({
        from,
        to: testTo || employee_email,
        subject: 'Your PPE / Uniform Request — Bromar Hub',
        html: employeeHtml,
        text: `Hi ${employee_name.split(' ')[0]},\n\nYour PPE / Uniform request has been received.\n\n${itemRowsText}\n\nReference: ${row.id}`,
      });
    }
  } catch (mailErr) {
    console.error('Resend error:', mailErr);
    // DB row is already saved — return success with a warning
    return json(200, {
      success: true,
      id: row.id,
      warning: 'Saved to database but email delivery failed',
      details: mailErr.message,
    });
  }

  return json(200, { success: true, id: row.id, emailId });
};

// ── Helpers ────────────────────────────────────────────────
function json(statusCode, obj) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(obj),
  };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
