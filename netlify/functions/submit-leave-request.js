const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const data = JSON.parse(event.body);

    const {
      employee_name,
      employee_email,
      employee_phone,
      leave_type,
      last_day_of_work,
      return_to_work,
      working_days,
      public_holidays = 'No Victorian public holidays fall within this leave period.',
      notes = 'No additional notes provided.',
    } = data;

    // ── Format dates for email display ──────────────────────────
    const formatDate = (val) => {
      if (!val) return '-';
      const [y, m, d] = val.split('-').map(Number);
      return new Date(y, m - 1, d).toLocaleDateString('en-AU', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      });
    };

    const submittedFormatted  = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
    const lastDayFormatted    = formatDate(last_day_of_work);
    const returnDayFormatted  = formatDate(return_to_work);

    // ── Save to Supabase ─────────────────────────────────────────
    const { data: leaveRecord, error: dbError } = await supabase
      .from('leave_requests')
      .insert({
        employee_name,
        employee_email,
        employee_phone,
        leave_type,
        last_day_of_work,
        return_to_work,
        working_days:   parseFloat(working_days) || 0,
        public_holidays,
        notes,
        submitted_at:   new Date().toISOString(),
        status:         'pending',
      })
      .select()
      .single();

    if (dbError) {
      console.error('Supabase error:', dbError);
      throw new Error('Failed to save to database');
    }

    // ── Build holiday list HTML ──────────────────────────────────
    const holidayLines = public_holidays
      .split('\n')
      .filter(l => l.trim())
      .map(l => `<li style="padding:5px 0;font-size:12px;color:#374151;border-bottom:1px solid #f5e8e3;">${l}</li>`)
      .join('');

    const holidaysHTML = holidayLines
      ? `<ul style="list-style:none;padding:0;margin:0;">${holidayLines}</ul>`
      : `<p style="font-size:13px;color:#6b7280;font-style:italic;margin:0;">No Victorian public holidays fall within this leave period.</p>`;

    // ── Build email HTML ─────────────────────────────────────────
    const emailHTML = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;">
    <tr><td align="center" style="padding:24px 16px;">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e0e0e0;">

        <!-- HEADER -->
        <tr>
          <td style="background:#fff3ee;padding:28px 32px 22px;text-align:center;">
            <img src="https://bromar-engineering.github.io/LEAVE_REQUEST/Bromar-Primary-Logo-Full-Colour.png"
                 alt="Bromar Logo"
                 style="max-height:70px;max-width:220px;margin:0 auto 16px;display:block;"/>
            <h1 style="color:#c2440e;font-size:22px;margin:0 0 6px;font-weight:700;">Leave Request Submitted</h1>
            <p style="color:#c2440e;font-size:13px;margin:0;">Submitted ${submittedFormatted}</p>
          </td>
        </tr>

        <!-- BODY -->
        <tr>
          <td style="padding:28px 32px;">

            <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 22px;">
              Hi Ashley,<br/>A new leave request has been submitted. Please review the details below.
            </p>

            <!-- Employee Details -->
            <p style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#c2440e;margin:0 0 8px;padding-bottom:6px;border-bottom:2px solid #f5e8e3;">Employee Details</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px;">
              <tr>
                <td style="font-size:13px;color:#6b7280;font-weight:500;padding:8px 0;border-bottom:1px solid #f3f4f6;width:45%;">Full Name</td>
                <td style="font-size:13px;color:#111827;font-weight:600;padding:8px 0;border-bottom:1px solid #f3f4f6;text-align:right;">${employee_name}</td>
              </tr>
              <tr>
                <td style="font-size:13px;color:#6b7280;font-weight:500;padding:8px 0;border-bottom:1px solid #f3f4f6;">Email</td>
                <td style="font-size:13px;color:#111827;font-weight:600;padding:8px 0;border-bottom:1px solid #f3f4f6;text-align:right;">${employee_email}</td>
              </tr>
              <tr>
                <td style="font-size:13px;color:#6b7280;font-weight:500;padding:8px 0;">Phone</td>
                <td style="font-size:13px;color:#111827;font-weight:600;padding:8px 0;text-align:right;">${employee_phone}</td>
              </tr>
            </table>

            <!-- Leave Details -->
            <p style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#c2440e;margin:0 0 8px;padding-bottom:6px;border-bottom:2px solid #f5e8e3;">Leave Details</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px;">
              <tr>
                <td style="font-size:13px;color:#6b7280;font-weight:500;padding:8px 0;border-bottom:1px solid #f3f4f6;width:45%;">Leave Type</td>
                <td style="font-size:13px;padding:8px 0;border-bottom:1px solid #f3f4f6;text-align:right;">
                  <span style="background:#fff3ee;color:#c2440e;border:1px solid #f5c4a8;border-radius:20px;padding:3px 12px;font-size:12px;font-weight:600;">${leave_type}</span>
                </td>
              </tr>
              <tr>
                <td style="font-size:13px;color:#6b7280;font-weight:500;padding:8px 0;border-bottom:1px solid #f3f4f6;">Last Day of Work</td>
                <td style="font-size:13px;color:#111827;font-weight:600;padding:8px 0;border-bottom:1px solid #f3f4f6;text-align:right;">${lastDayFormatted}</td>
              </tr>
              <tr>
                <td style="font-size:13px;color:#6b7280;font-weight:500;padding:8px 0;border-bottom:1px solid #f3f4f6;">Return to Work</td>
                <td style="font-size:13px;color:#111827;font-weight:600;padding:8px 0;border-bottom:1px solid #f3f4f6;text-align:right;">${returnDayFormatted}</td>
              </tr>
              <tr>
                <td style="font-size:13px;color:#6b7280;font-weight:500;padding:8px 0;">Working Days of Leave</td>
                <td style="font-size:13px;color:#111827;font-weight:600;padding:8px 0;text-align:right;">${working_days} days</td>
              </tr>
            </table>

            <!-- Public Holidays -->
            <p style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#c2440e;margin:0 0 8px;padding-bottom:6px;border-bottom:2px solid #f5e8e3;">Victorian Public Holidays in Leave Period</p>
            <div style="background:#fff8f5;border:1px solid #f5c4a8;border-radius:6px;padding:14px 16px;margin-bottom:22px;">
              ${holidaysHTML}
            </div>

            <!-- Notes -->
            <p style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#c2440e;margin:0 0 8px;padding-bottom:6px;border-bottom:2px solid #f5e8e3;">Notes</p>
            <div style="background:#fafafa;border-left:3px solid #c2440e;border-radius:0 6px 6px 0;padding:12px 14px;font-size:13px;color:#374151;line-height:1.6;">
              ${notes}
            </div>

          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:18px 32px;text-align:center;">
            <p style="font-size:11px;color:#9ca3af;margin:3px 0;">2/98-108 Western Ave, Westmeadows, VIC 3049</p>
            <p style="font-size:11px;color:#9ca3af;margin:3px 0;">PH: +61 3 9335 5344 &nbsp;|&nbsp; FAX: +61 3 9335 5322</p>
            <p style="font-size:11px;color:#9ca3af;margin:3px 0;">EMAIL: <a href="mailto:admin@bromar.com.au" style="color:#c2440e;text-decoration:none;">admin@bromar.com.au</a> &nbsp;|&nbsp; REC: 30340</p>
            <p style="font-size:11px;color:#9ca3af;margin:3px 0;">ABN: 45 634 835 939 &nbsp;&nbsp; ACN: 634 835 939</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    // ── Send via Resend ──────────────────────────────────────────
    const to = process.env.TEST_TO
      ? [process.env.TEST_TO]
      : ['ashleys@bromar.com.au', employee_email];

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    process.env.FROM_EMAIL || 'Bromar Hub <onboarding@resend.dev>',
        to,
        subject: `Leave Request — ${employee_name} (${leave_type})`,
        html:    emailHTML,
      }),
    });

    if (!resendRes.ok) {
      const resendError = await resendRes.json();
      console.error('Resend error:', resendError);
      throw new Error('Failed to send email');
    }

    const resendData = await resendRes.json();

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        id:      leaveRecord.id,
        emailId: resendData.id,
      }),
    };

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to submit leave request', details: error.message }),
    };
  }
};
