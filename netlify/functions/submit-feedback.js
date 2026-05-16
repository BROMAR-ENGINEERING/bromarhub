const sgMail = require('@sendgrid/mail');
const { createClient } = require('@supabase/supabase-js');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const data = JSON.parse(event.body);

    const userName = data.user_name;
    const userEmail = data.user_email;
    const reportType = data.report_type;
    const subject = data.subject;
    const description = data.description;
    const pageUrl = data.page_url || null;
    const browser = data.browser || null;
    const priority = data.priority || 'N/A';

    const submittedFormatted = new Date().toLocaleDateString('en-AU', {
      day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    // ============================================================
    // SAVE TO SUPABASE
    // ============================================================
    const { data: feedbackRecord, error: dbError } = await supabase
      .from('feedback_reports')
      .insert({
        user_name: userName,
        user_email: userEmail,
        report_type: reportType,
        subject: subject,
        description: description,
        page_url: pageUrl,
        browser: browser,
        priority: priority,
        status: 'open'
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

    // Icon based on report type
    const typeIcon = {
      'Bug Report': '🐛',
      'Feature Request': '💡',
      'General Feedback': '💬',
      'Other': '📝'
    }[reportType] || '📝';

    // Priority badge color
    let priorityBadge = '';
    if (reportType === 'Bug Report') {
      const priorityColors = {
        'Low': { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d', emoji: '🟢' },
        'Medium': { bg: '#fef9c3', border: '#fde047', text: '#854d0e', emoji: '🟡' },
        'High': { bg: '#fee2e2', border: '#fecaca', text: '#991b1b', emoji: '🔴' }
      };
      const colors = priorityColors[priority] || priorityColors['Medium'];
      priorityBadge = `
        <tr>
          <td style="font-size:13px;color:#6b7280;font-weight:500;padding:8px 0;border-bottom:1px solid #f3f4f6;width:45%;">Priority</td>
          <td style="font-size:13px;padding:8px 0;border-bottom:1px solid #f3f4f6;text-align:right;">
            <span style="display:inline-block;background:${colors.bg};color:${colors.text};border:1px solid ${colors.border};border-radius:20px;padding:3px 12px;font-size:12px;font-weight:600;">${colors.emoji} ${priority}</span>
          </td>
        </tr>
      `;
    }

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
                    <h1 style="color:#c2440e;font-size:22px;margin:0 0 6px;font-weight:700;letter-spacing:0.5px;">${typeIcon} ${reportType}</h1>
                    <p style="color:#c2440e;font-size:13px;margin:0;">Submitted ${submittedFormatted}</p>
                  </td>
                </tr>

                <!-- BODY -->
                <tr>
                  <td style="padding:28px 32px;">

                    <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 22px;">
                      Hi Ashley,<br/>
                      A new ${reportType.toLowerCase()} has been submitted from the Bromar Hub. Please review the details below.
                    </p>

                    <!-- User Details -->
                    <p style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#c2440e;margin:0 0 8px;padding-bottom:6px;border-bottom:2px solid #f5e8e3;">Submitted By</p>
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px;">
                      <tr>
                        <td style="font-size:13px;color:#6b7280;font-weight:500;padding:8px 0;border-bottom:1px solid #f3f4f6;width:45%;">Name</td>
                        <td style="font-size:13px;color:#111827;font-weight:600;padding:8px 0;border-bottom:1px solid #f3f4f6;text-align:right;">${userName}</td>
                      </tr>
                      <tr>
                        <td style="font-size:13px;color:#6b7280;font-weight:500;padding:8px 0;">Email</td>
                        <td style="font-size:13px;color:#111827;font-weight:600;padding:8px 0;text-align:right;">${userEmail}</td>
                      </tr>
                    </table>

                    <!-- Report Details -->
                    <p style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#c2440e;margin:0 0 8px;padding-bottom:6px;border-bottom:2px solid #f5e8e3;">Report Details</p>
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px;">
                      <tr>
                        <td style="font-size:13px;color:#6b7280;font-weight:500;padding:8px 0;border-bottom:1px solid #f3f4f6;width:45%;">Type</td>
                        <td style="font-size:13px;padding:8px 0;border-bottom:1px solid #f3f4f6;text-align:right;">
                          <span style="display:inline-block;background:#fff3ee;color:#c2440e;border:1px solid #f5c4a8;border-radius:20px;padding:3px 12px;font-size:12px;font-weight:600;">${reportType}</span>
                        </td>
                      </tr>
                      ${priorityBadge}
                      <tr>
                        <td style="font-size:13px;color:#6b7280;font-weight:500;padding:8px 0;border-bottom:1px solid #f3f4f6;">Subject</td>
                        <td style="font-size:13px;color:#111827;font-weight:600;padding:8px 0;border-bottom:1px solid #f3f4f6;text-align:right;">${subject}</td>
                      </tr>
                      <tr>
                        <td style="font-size:13px;color:#6b7280;font-weight:500;padding:8px 0;border-bottom:1px solid #f3f4f6;">Page/Section</td>
                        <td style="font-size:13px;color:#111827;font-weight:600;padding:8px 0;border-bottom:1px solid #f3f4f6;text-align:right;">${pageUrl || 'Not specified'}</td>
                      </tr>
                      <tr>
                        <td style="font-size:13px;color:#6b7280;font-weight:500;padding:8px 0;">Browser/Device</td>
                        <td style="font-size:13px;color:#111827;font-weight:600;padding:8px 0;text-align:right;">${browser || 'Not specified'}</td>
                      </tr>
                    </table>

                    <!-- Description -->
                    <p style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#c2440e;margin:0 0 8px;padding-bottom:6px;border-bottom:2px solid #f5e8e3;">Description</p>
                    <div style="background:#fafafa;border-left:3px solid #c2440e;border-radius:0 6px 6px 0;padding:12px 14px;font-size:13px;color:#374151;line-height:1.6;white-space:pre-wrap;">${description}</div>

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

    // Send email via SendGrid
    const msg = {
      to: ['ashleys@bromar.com.au', userEmail],
      from: 'servicet@bromar.com.au',
      replyTo: 'admin@bromar.com.au',
      subject: `${typeIcon} ${reportType} — ${subject}`,
      html: emailHTML,
    };

    await sgMail.send(msg);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Feedback submitted successfully',
        id: feedbackRecord.id
      })
    };

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to submit feedback',
        details: error.message
      })
    };
  }
};
