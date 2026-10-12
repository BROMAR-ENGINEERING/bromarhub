// netlify/functions/submit-jobsheet.js — V1.00 — 2026-10-12 — Bromar Hub
// ============================================================
// Sends a signed service report PDF to the client via Resend.
// Called by the jobsheet HTML on submit (Skip Sign-Off path and
// after in-person signing).
//
// Env vars (set in Netlify → Site settings → Environment variables):
//   RESEND_API_KEY   required
//   FROM_EMAIL       optional, defaults to 'Bromar Hub <onboarding@resend.dev>'
//   TEST_TO          optional, if set routes ALL mail here (testing)
//   SUPABASE_URL     optional (reserved for future table writes)
//   SUPABASE_KEY     optional (reserved for future table writes)
// ============================================================

const { Resend } = require('resend');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL     = process.env.FROM_EMAIL || 'Bromar Hub <onboarding@resend.dev>';
const TEST_TO        = process.env.TEST_TO    || null;

console.log('[submit-jobsheet] boot — FROM:', FROM_EMAIL, '| TEST_TO:', TEST_TO || '(none)', '| API key set:', !!RESEND_API_KEY);

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return respond(405, { error: 'Method not allowed' });
  }
  if (!resend) {
    return respond(500, { error: 'RESEND_API_KEY not configured on the server' });
  }

  let payload;
  try { payload = JSON.parse(event.body || '{}'); }
  catch (err) { return respond(400, { error: 'Invalid JSON body', details: err.message }); }

  const {
    recipientEmail, replyToEmail,
    jobSheetNumber, jobNumber,
    clientName, siteName, siteAddress,
    sheetDate, preparedBy, signedByName,
    pdfBase64
  } = payload;

  // Required field check
  const missing = [];
  if (!recipientEmail) missing.push('recipientEmail');
  if (!jobSheetNumber) missing.push('jobSheetNumber');
  if (!jobNumber)      missing.push('jobNumber');
  if (!pdfBase64)      missing.push('pdfBase64');
  if (missing.length) {
    return respond(400, { error: 'Missing required fields', details: missing });
  }

  const to = TEST_TO || recipientEmail;
  const subject = `Service Report — ${jobSheetNumber}`;
  const html = buildEmailHtml({
    clientName, jobNumber, jobSheetNumber, siteName, siteAddress,
    sheetDate, preparedBy, signedByName,
    testMode: !!TEST_TO, originalRecipient: recipientEmail
  });

  const sendOpts = {
    from:    FROM_EMAIL,
    to:      [to],
    subject,
    html,
    attachments: [{
      filename: `${jobSheetNumber}.pdf`,
      content:  pdfBase64
    }]
  };
  if (replyToEmail) sendOpts.reply_to = replyToEmail;

  try {
    const { data, error } = await resend.emails.send(sendOpts);
    if (error) {
      console.error('[submit-jobsheet] Resend error:', error);
      return respond(500, { error: error.message || 'Resend send failed', details: error });
    }
    console.log('[submit-jobsheet] sent OK — id:', data?.id, '| to:', to);
    return respond(200, { success: true, id: data?.id, emailId: data?.id });
  } catch (err) {
    console.error('[submit-jobsheet] exception:', err);
    return respond(500, { error: err.message || 'Unknown error', details: String(err) });
  }
};

function respond(statusCode, body) {
  return {
    statusCode,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}

function buildEmailHtml({ clientName, jobNumber, jobSheetNumber, siteName, siteAddress, sheetDate, preparedBy, signedByName, testMode, originalRecipient }) {
  const dateStr = sheetDate
    ? new Date(sheetDate + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  const signedLine = signedByName && signedByName !== '(No signature required)'
    ? `<p style="margin:4px 0;"><strong>Signed off by:</strong> ${esc(signedByName)}</p>`
    : '';

  const siteBlock = (siteName || siteAddress)
    ? `<p style="margin:4px 0;"><strong>Site:</strong> ${esc([siteName, siteAddress].filter(Boolean).join(' — '))}</p>`
    : '';

  const testBanner = testMode
    ? `<div style="background:#fff3e0; border:1px solid #c2440e; color:#c2440e; padding:10px 14px; border-radius:8px; margin-bottom:16px; font-size:13px;">
         <strong>TEST MODE</strong> — this email would normally go to <strong>${esc(originalRecipient)}</strong>.
       </div>`
    : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0; padding:0; background:#f4f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color:#1f1f23;">
  <div style="max-width:600px; margin:0 auto; padding:24px 16px;">
    ${testBanner}
    <div style="background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.06);">
      <div style="background:#c2440e; height:4px;"></div>
      <div style="padding:28px 24px;">
        <h1 style="margin:0 0 6px 0; font-size:22px; color:#c2440e; font-weight:700;">Service Report</h1>
        <p style="margin:0 0 20px 0; font-size:14px; color:#6b6b70;">${esc(dateStr)}</p>

        <p style="margin:0 0 16px 0; font-size:15px;">Hi ${esc(clientName || 'there')},</p>
        <p style="margin:0 0 20px 0; font-size:15px; line-height:1.5;">
          Please find attached your service report for job <strong>${esc(jobNumber)}</strong>.
        </p>

        <div style="background:#fafafa; border-left:3px solid #c2440e; padding:14px 16px; border-radius:4px; margin:16px 0;">
          <p style="margin:4px 0;"><strong>Job:</strong> ${esc(jobNumber)}</p>
          <p style="margin:4px 0;"><strong>Report #:</strong> ${esc(jobSheetNumber)}</p>
          ${siteBlock}
          ${preparedBy ? `<p style="margin:4px 0;"><strong>Prepared by:</strong> ${esc(preparedBy)}</p>` : ''}
          ${signedLine}
        </div>

        <p style="margin:20px 0 0 0; font-size:14px; line-height:1.5; color:#4a4a4e;">
          If you have any questions, reply to this email or call us on <strong>03 9335 5344</strong>.
        </p>
      </div>

      <div style="background:#f7f7f9; padding:20px 24px; border-top:1px solid #e4e4e7; font-size:12px; color:#6b6b70; line-height:1.6;">
        <div style="font-weight:600; color:#1f1f23; margin-bottom:6px;">Bromar Electrical Services Pty Ltd</div>
        2/98-108 Western Ave, Westmeadows VIC 3049<br>
        PH: +61 3 9335 5344 &nbsp;·&nbsp; <a href="mailto:admin@bromar.com.au" style="color:#c2440e; text-decoration:none;">admin@bromar.com.au</a><br>
        ABN: 45 634 835 939 &nbsp;·&nbsp; REC: 30340
      </div>
    </div>
  </div>
</body>
</html>`;
}

function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
