// Send email via SendGrid with Dynamic Template
const msg = {
  to: 'ashleys@bromar.com.au',
  from: 'servicet@bromar.com.au',
  replyTo: 'admin@bromar.com.au',
  subject: `Timesheet Submission - ${employeeName} - Week of ${new Date(weekStarting).toLocaleDateString('en-AU')}`,
  templateId: process.env.SENDGRID_TEMPLATE_ID,
  dynamicTemplateData: {
    employee_name: employeeName,
    employee_email: employeeEmail,
    employee_type: employeeType,
    week_starting: new Date(weekStarting).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }),
    submitted_date: new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    total_normal_hours: totalNormalHours.toFixed(1),
    total_overtime_hours: totalOvertimeHours.toFixed(1),
    total_hours: totalHours.toFixed(1),
    on_call_standby: standby,
    general_comments: generalComments !== 'No additional comments' ? generalComments : null,
    timesheet_rows: timesheetHTML
  }
};

await sgMail.send(msg);
