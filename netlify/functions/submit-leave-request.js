const sgMail = require('@sendgrid/mail');
const { createClient } = require('@supabase/supabase-js');

// Initialize SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Parse JSON body from form
    const data = JSON.parse(event.body);

    const employeeName    = data.employee_name;
    const employeeEmail   = data.employee_email;
    const employeePhone   = data.employee_phone;
    const leaveType       = data.leave_type;
    const lastDayOfWork   = data.last_day_of_work;   // YYYY-MM-DD
    const returnToWork    = data.return_to_work;      // YYYY-MM-DD
    const workingDays     = parseFloat(data.working_days) || 0;
    const publicHolidays  = data.public_holidays || 'No Victorian public holidays fall within this leave period.';
    const notes           = data.notes || 'No additional notes provided.';
    const submittedAt     = new Date().toISOString();

    // Format dates for display in email
    const formatDate = (val) => {
      if (!val) return '-';
      const [y, m, d] = val.split('-').map(Number);
      return new Date(y, m - 1, d).toLocaleDateString('en-AU', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      });
    };

    const lastDayFormatted   = formatDate(lastDayOfWork);
    const returnDayFormatted = formatDate(returnToWork);
    const submittedFormatted = new Date().toLocaleDateString('en-AU', {
      day: 'numeric', month: 'long', year: 'numeric'
    });

    // ============================================================
    // SAVE TO SUPABASE
    // ============================================================
    const { data: leaveRecord, error: dbError } = await supabase
      .from('leave_requests')
      .insert({
        employee_name:    employeeName,
        employee_email:   employeeEmail,
        employee_phone:   employeePhone,
        leave_type:       leaveType,
        last_day_of_work: lastDayOfWork,
        return_to_work:   returnToWork,
        working_days:     workingDays,
        public_holidays:  publicHolidays,
        notes:            notes,
        submitted_at:     submittedAt,
        status:           'pending',
      })
      .select()
      .single();

    if (dbError) {
      console.error('Supabase error:', dbError);
      throw new Error('Failed to save to database');
    }

    // ============================================================
    // BUILD EMAIL HTML
    // ============================================================

    // Format public holidays as list items
    const holidayLines = publicHolidays
      .split('\n')
      .filter(l => l.trim())
      .map(l => `<li style="padding:5px 0;font-size:12px;color:#374151;border-bottom:1px solid #f5e8e3;">${l}</li>`)
      .join('');

    const holidaysHTML = holidayLines
      ? `<ul style="list-style:none;padding:0;margin:0;">${holidayLines}</ul>`
      : `<p style="font-size:13px;color:#6b7280;font-style:italic;margin:0;">No Victorian public holidays fall within this leave period.</p>`;

    const emailHTML = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"/></head>
      <body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f3f4f6;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f4f6;">
          <tr>
            <td align="center" style="padding:24px 16px;">
              <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e0e0e0;">

                <!-- HEADER -->
                <tr>
                  <td style="background:#fff3ee;padding:28px 32px 22px;text-align:center;">
                    <img src="https://bromar-engineering.github.io/LEAVE_REQUEST/Bromar-Primary-Logo-Full-Colour.png"
                         alt="Bromar Logo"
                         style="max-height:70px;max-width:220px;margin-bottom:16px;display:block;margin-left:auto;margin-right:auto;"/>
                    <h1 style="color:#c2440e;font-size:22px;margin:0 0 6px;font-weight:700;letter-spacing:0.5px;">Leave Request Submitted</h1>
                    <p style="color:#c2440e;font-size:13px;margin:0;">Submitted ${submittedFormatted}</p>
                  </td>
                </tr>

                <!-- BODY -->
                <tr>
                  <td style="padding:28px 32px;">

                    <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 22px;">
                      Hi Ashley,<br/>
                      A new leave request has been submitted. Please review the details below.
                    </p>

                    <!-- Employee Details -->
                    <p style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#c2440e;margin:0 0 8px;padding-bottom:6px;border-bottom:2px solid #f5e8e3;">Employee Details</p>
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px;">
                      <tr>
                        <td style="font-size:13px;color:#6b7280;font-weight:500;padding:8px 0;border-bottom:1px solid #f3f4f6;width:45%;">Full Name</td>
                        <td style="font-size:13px;color:#111827;font-weight:600;padding:8px 0;border-bottom:1px solid #f3f4f6;text-align:right;">${employeeName}</td>
                      </tr>
                      <tr>
                        <td style="font-size:13px;color:#6b7280;font-weight:500;padding:8px 0;border-bottom:1px solid #f3f4f6;">Email</td>
                        <td style="font-size:13px;color:#111827;font-weight:600;padding:8px 0;border-bottom:1px solid #f3f4f6;text-align:right;">${employeeEmail}</td>
                      </tr>
                      <tr>
                        <td style="font-size:13px;color:#6b7280;font-weight:500;padding:8px 0;">Phone</td>
                        <td style="font-size:13px;color:#111827;font-weight:600;padding:8px 0;text-align:right;">${employeePhone}</td>
                      </tr>
                    </table>

                    <!-- Leave Details -->
                    <p style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#c2440e;margin:0 0 8px;padding-bottom:6px;border-bottom:2px solid #f5e8e3;">Leave Details</p>
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px;">
                      <tr>
                        <td style="font-size:13px;color:#6b7280;font-weight:500;padding:8px 0;border-bottom:1px solid #f3f4f6;width:45%;">Leave Type</td>
                        <td style="font-size:13px;padding:8px 0;border-bottom:1px solid #f3f4f6;text-align:right;">
                          <span style="display:inline-block;background:#fff3ee;color:#c2440e;border:1px solid #f5c4a8;border-radius:20px;padding:3px 12px;font-size:12px;font-weight:600;">${leaveType}</span>
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
                        <td style="font-size:13px;color:#111827;font-weight:600;padding:8px 0;text-align:right;">${workingDays} days</td>
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
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    // Send email via SendGrid — to admin and CC employee
    const msg = {
      to: ['ashleys@bromar.com.au', employeeEmail],
      from: 'servicet@bromar.com.au',
      replyTo: 'admin@bromar.com.au',
      subject: `Leave Request — ${employeeName} (${leaveType})`,
      html: emailHTML,
    };

    await sgMail.send(msg);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Leave request submitted successfully',
        id: leaveRecord.id
      })
    };

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to submit leave request',
        details: error.message
      })
    };
  }
};
