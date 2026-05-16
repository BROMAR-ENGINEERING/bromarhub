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
    const submittedAt = new Date().toISOString();

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
