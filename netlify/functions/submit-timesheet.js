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
    // Parse form data
    const params = new URLSearchParams(event.body);
    const formData = {};
    
    for (const [key, value] of params) {
      formData[key] = value;
    }

    // Extract employee details
    const employeeName = formData.employee_name;
    const employeeEmail = formData.employee_email;
    const employeeType = formData.employee_type;
    const weekStarting = formData.week_starting;
    const standby = formData.standby === 'on';
    const generalComments = formData.general_comments || 'No additional comments';
    const allowanceFirstAid = formData.allowance_first_aid === 'on';
    const allowanceConstructionWiring = formData.allowance_construction_wiring === 'on';

    // Parse daily timesheet data
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const timesheetEntries = [];
    let totalNormalHours = 0;
    let totalOvertimeHours = 0;
    let totalTravelHours = 0;

    console.log('=== FUNCTION DEBUG: Parsing timesheet data ===');
    console.log('Total form fields received:', Object.keys(formData).length);

    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      const dayPrefix = `day_${dayIndex}`;
      const shift = formData[`${dayPrefix}_shift`] || 'Day';
      const laha = formData[`${dayPrefix}_laha`] === 'on';
      const office = formData[`${dayPrefix}_office`] === 'on';
      const owncar = formData[`${dayPrefix}_owncar`] === 'on';
      const owncarKm = formData[`${dayPrefix}_owncar_km`] || '0';
      const breakAchieved = formData[`${dayPrefix}_break_achieved`] === 'on';
      const calloutStart = formData[`${dayPrefix}_callout_start`] || null;
      const calloutFinish = formData[`${dayPrefix}_callout_finish`] || null;

      console.log(`\n--- Day ${dayIndex} (${days[dayIndex]}) ---`);
      
      // Find all jobs for this day - using the correct field naming: job-{dayIndex}-{jobIndex}
      let jobIndex = 0;
      let foundJobsForDay = 0;
      
      while (formData[`job-${dayIndex}-${jobIndex}_type`]) {
        const jobPrefix = `job-${dayIndex}-${jobIndex}`;
        const type = formData[`${jobPrefix}_type`];
        const normalHours = parseFloat(formData[`${jobPrefix}_hours`]) || 0;
        const overtimeHours = parseFloat(formData[`${jobPrefix}_overtime`]) || 0;
        const travelHours = parseFloat(formData[`${jobPrefix}_travel_time`]) || 0;
        
        console.log(`  Job ${jobIndex}: type="${type}", normal=${normalHours}, OT=${overtimeHours}, travel=${travelHours}`);
        
        if (type && (normalHours > 0 || overtimeHours > 0 || travelHours > 0)) {
          foundJobsForDay++;
          const jobNumber = formData[`${jobPrefix}_number`] || '-';
          const client = formData[`${jobPrefix}_client`] || '-';
          const siteAllowance = formData[`${jobPrefix}_site_allowance`] === 'on';
          const jobOwncar = formData[`${jobPrefix}_owncar`] === 'on';
          const jobOwncarKm = formData[`${jobPrefix}_owncar_km`] || '0';
          const calloutReceived = formData[`${jobPrefix}_callout_received`] || null;
          const calloutComplete = formData[`${jobPrefix}_callout_complete`] || null;
          const comment = formData[`${jobPrefix}_comment`] || '-';

          const allowances = [];
          if (siteAllowance) allowances.push('Site');
          if (laha) allowances.push('LAHA');
          if (office) allowances.push('Start/Finish at Office');
          if (owncar) allowances.push(`Own Car (${owncarKm}km)`);
          if (jobOwncar) allowances.push(`+${jobOwncarKm}km`);

          timesheetEntries.push({
            day: days[dayIndex],
            date: new Date(weekStarting).setDate(new Date(weekStarting).getDate() + dayIndex),
            shift,
            type,
            normal_hours: normalHours,
            overtime_hours: overtimeHours,
            travel_hours: travelHours,
            job_number: jobNumber,
            client,
            allowances: allowances.join(', ') || '-',
            callout_received: calloutReceived,
            callout_complete: calloutComplete,
            comment,
            break_achieved: breakAchieved,
            callout_start: calloutStart,
            callout_finish: calloutFinish
          });

          totalNormalHours += normalHours;
          totalOvertimeHours += overtimeHours;
          totalTravelHours += travelHours;
          console.log(`    ✓ Added to timesheet`);
        } else {
          console.log(`    ✗ Skipped (no type or no hours)`);
        }
        
        jobIndex++;
      }
      console.log(`  Total jobs found for ${days[dayIndex]}: ${foundJobsForDay}`);
    }

    console.log(`\n=== SUMMARY ===`);
    console.log(`Total entries: ${timesheetEntries.length}`);
    console.log(`Total normal hours: ${totalNormalHours}`);
    console.log(`Total OT hours: ${totalOvertimeHours}`);
    console.log(`Total travel hours: ${totalTravelHours}`);
    console.log(`Standby checkbox: ${standby}`);

    const totalHours = totalNormalHours + totalOvertimeHours;

    // ============================================
    // SAVE TO SUPABASE
    // ============================================
    const { data: timesheetRecord, error: dbError} = await supabase
      .from('timesheets')
      .insert({
        employee_name: employeeName,
        employee_email: employeeEmail,
        employee_type: employeeType,
        week_starting: weekStarting,
        total_normal_hours: totalNormalHours,
        total_overtime_hours: totalOvertimeHours,
        total_travel_hours: totalTravelHours,
        total_hours: totalHours,
        on_call_standby: standby,
        allowance_first_aid: allowanceFirstAid,
        allowance_construction_wiring: allowanceConstructionWiring,
        general_comments: generalComments,
        timesheet_entries: timesheetEntries,
        submitted_at: new Date().toISOString()
      })
      .select()
      .single();

    if (dbError) {
      console.error('Supabase error:', dbError);
      throw new Error('Failed to save to database');
    }

    // ============================================
    // SEND EMAIL VIA SENDGRID
    // ============================================
    
    // Build HTML table for email
    let timesheetHTML = '';
    timesheetEntries.forEach((entry, index) => {
      const bgColor = index % 2 === 0 ? '#ffffff' : '#f9fafb';
      timesheetHTML += `
        <tr style="background:${bgColor};">
          <td style="padding:10px 8px;font-size:12px;color:#374151;border-bottom:1px solid #f3f4f6;">${entry.day}</td>
          <td style="padding:10px 8px;font-size:12px;color:#374151;border-bottom:1px solid #f3f4f6;">${entry.shift}</td>
          <td style="padding:10px 8px;font-size:12px;color:#374151;border-bottom:1px solid #f3f4f6;">${entry.type}</td>
          <td style="padding:10px 8px;font-size:12px;color:#374151;border-bottom:1px solid #f3f4f6;text-align:center;">${entry.normal_hours.toFixed(1)}</td>
          <td style="padding:10px 8px;font-size:12px;color:#374151;border-bottom:1px solid #f3f4f6;text-align:center;">${entry.overtime_hours.toFixed(1)}</td>
          <td style="padding:10px 8px;font-size:12px;color:#374151;border-bottom:1px solid #f3f4f6;text-align:center;">${entry.travel_hours.toFixed(1)}</td>
          <td style="padding:10px 8px;font-size:12px;color:#374151;border-bottom:1px solid #f3f4f6;">${entry.job_number}</td>
          <td style="padding:10px 8px;font-size:12px;color:#374151;border-bottom:1px solid #f3f4f6;">${entry.client}</td>
          <td style="padding:10px 8px;font-size:12px;color:#374151;border-bottom:1px solid #f3f4f6;">${entry.allowances}</td>
          <td style="padding:10px 8px;font-size:12px;color:#374151;border-bottom:1px solid #f3f4f6;">${entry.comment}</td>
        </tr>
      `;
    });

    const emailHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
      </head>
      <body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f3f4f6;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f4f6;">
          <tr>
            <td align="center" style="padding:24px 16px;">
              <table width="680" cellpadding="0" cellspacing="0" border="0" style="max-width:680px;background:#ffffff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
                
                <!-- Header -->
                <tr>
                  <td style="padding:28px 32px;text-align:center;border-bottom:1px solid #e5e7eb;">
                    <h1 style="margin:0;font-size:24px;color:#111827;font-weight:700;">Employee Timesheet Submission</h1>
                    <p style="margin:8px 0 0;font-size:14px;color:#6b7280;">Week Starting: ${new Date(weekStarting).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding:28px 32px;">
                    
                    <!-- Employee Details -->
                    <p style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#c2440e;margin:0 0 12px;padding-bottom:6px;border-bottom:2px solid #f5e8e3;">Employee Information</p>
                    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;margin-bottom:24px;">
                      <tr>
                        <td style="padding:6px 0;color:#6b7280;width:150px;">Name:</td>
                        <td style="padding:6px 0;color:#111827;font-weight:600;">${employeeName}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;color:#6b7280;">Email:</td>
                        <td style="padding:6px 0;color:#111827;">${employeeEmail}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;color:#6b7280;">Type:</td>
                        <td style="padding:6px 0;color:#111827;">${employeeType}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;color:#6b7280;">Submitted:</td>
                        <td style="padding:6px 0;color:#111827;">${new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</td>
                      </tr>
                    </table>

                    <!-- Hours Summary -->
                    <p style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#c2440e;margin:0 0 12px;padding-bottom:6px;border-bottom:2px solid #f5e8e3;">Hours Summary</p>
                    <div style="display:flex;gap:12px;margin-bottom:24px;flex-wrap:wrap;">
                      <div style="flex:1;min-width:150px;background:#eff6ff;border-left:4px solid #1a56db;border-radius:6px;padding:16px;">
                        <div style="font-size:11px;color:#1e40af;font-weight:600;text-transform:uppercase;">Normal Hours</div>
                        <div style="font-size:28px;color:#1a56db;font-weight:700;">${totalNormalHours.toFixed(1)}</div>
                      </div>
                      <div style="flex:1;min-width:150px;background:#fef3c7;border-left:4px solid #f59e0b;border-radius:6px;padding:16px;">
                        <div style="font-size:11px;color:#92400e;font-weight:600;text-transform:uppercase;">Overtime</div>
                        <div style="font-size:28px;color:#f59e0b;font-weight:700;">${totalOvertimeHours.toFixed(1)}</div>
                      </div>
                      <div style="flex:1;min-width:150px;background:#f3e8ff;border-left:4px solid #9333ea;border-radius:6px;padding:16px;">
                        <div style="font-size:11px;color:#581c87;font-weight:600;text-transform:uppercase;">Travel</div>
                        <div style="font-size:28px;color:#9333ea;font-weight:700;">${totalTravelHours.toFixed(1)}</div>
                      </div>
                      <div style="flex:1;min-width:150px;background:#f0fdf4;border-left:4px solid #0e9f6e;border-radius:6px;padding:16px;">
                        <div style="font-size:11px;color:#065f46;font-weight:600;text-transform:uppercase;">Total Hours</div>
                        <div style="font-size:28px;color:#0e9f6e;font-weight:700;">${totalHours.toFixed(1)}</div>
                      </div>
                    </div>

                    ${standby ? `
                    <div style="margin-bottom:22px;padding:12px 14px;background:#fff3ee;border-radius:6px;border-left:3px solid #ff6b35;">
                      <p style="font-size:13px;color:#c2440e;font-weight:600;margin:0;">📞 This employee was on call/afterhours standby this week</p>
                    </div>
                    ` : ''}

                    ${generalComments !== 'No additional comments' ? `
                    <p style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#c2440e;margin:0 0 8px;padding-bottom:6px;border-bottom:2px solid #f5e8e3;">Additional Comments</p>
                    <div style="background:#fafafa;border-left:3px solid #c2440e;border-radius:0 6px 6px 0;padding:12px 14px;font-size:13px;color:#374151;line-height:1.6;margin-bottom:22px;">
                      ${generalComments}
                    </div>
                    ` : ''}

                    <!-- Timesheet Table -->
                    <p style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#c2440e;margin:0 0 12px;padding-bottom:6px;border-bottom:2px solid #f5e8e3;">Timesheet Details</p>
                    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
                      <thead>
                        <tr style="background:#1a56db;">
                          <th style="padding:10px 8px;text-align:left;font-size:11px;color:#ffffff;font-weight:600;text-transform:uppercase;">Day</th>
                          <th style="padding:10px 8px;text-align:left;font-size:11px;color:#ffffff;font-weight:600;text-transform:uppercase;">Shift</th>
                          <th style="padding:10px 8px;text-align:left;font-size:11px;color:#ffffff;font-weight:600;text-transform:uppercase;">Type</th>
                          <th style="padding:10px 8px;text-align:center;font-size:11px;color:#ffffff;font-weight:600;text-transform:uppercase;">Normal</th>
                          <th style="padding:10px 8px;text-align:center;font-size:11px;color:#ffffff;font-weight:600;text-transform:uppercase;">OT</th>
                          <th style="padding:10px 8px;text-align:center;font-size:11px;color:#ffffff;font-weight:600;text-transform:uppercase;">Travel</th>
                          <th style="padding:10px 8px;text-align:left;font-size:11px;color:#ffffff;font-weight:600;text-transform:uppercase;">Job #</th>
                          <th style="padding:10px 8px;text-align:left;font-size:11px;color:#ffffff;font-weight:600;text-transform:uppercase;">Client</th>
                          <th style="padding:10px 8px;text-align:left;font-size:11px;color:#ffffff;font-weight:600;text-transform:uppercase;">Allowances</th>
                          <th style="padding:10px 8px;text-align:left;font-size:11px;color:#ffffff;font-weight:600;text-transform:uppercase;">Comment</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${timesheetHTML}
                      </tbody>
                    </table>

                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 32px;text-align:center;">
                    <p style="font-size:11px;color:#6b7280;margin:4px 0;">2/98-108 Western Ave, Westmeadows, VIC 3049</p>
                    <p style="font-size:11px;color:#6b7280;margin:4px 0;">PH: +61 3 9335 5344  |  FAX: +61 3 9335 5322</p>
                    <p style="font-size:11px;color:#6b7280;margin:4px 0;">EMAIL: <a href="mailto:admin@bromar.com.au" style="color:#c2440e;text-decoration:none;">admin@bromar.com.au</a>  |  REC: 30340</p>
                    <p style="font-size:11px;color:#6b7280;margin:4px 0;">ABN: 45 634 835 939  |  ACN: 634 835 939</p>
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
      to: ['servicet@bromar.com.au', employeeEmail],
      from: 'servicet@bromar.com.au', // Must be verified in SendGrid
      replyTo: 'admin@bromar.com.au',
      subject: `Timesheet Submission - ${employeeName} - Week of ${new Date(weekStarting).toLocaleDateString('en-AU')}`,
      html: emailHTML,
    };

    await sgMail.send(msg);

    // Return success
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true, 
        message: 'Timesheet submitted successfully',
        id: timesheetRecord.id
      })
    };

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Failed to submit timesheet', 
        details: error.message 
      })
    };
  }
};
