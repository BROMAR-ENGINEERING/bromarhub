/* ============================================================
   NETLIFY FUNCTION — CLIENT USER ADMIN
   V1.02 — netlify/functions/client-user-admin.js
   Handles all client portal user management writes.
   Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY),
             RESEND_API_KEY, RESEND_FROM
   ============================================================ */

const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');

const SB_URL = process.env.SUPABASE_URL || 'https://iwtvlpfprxqwveqadlwl.supabase.co';
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const RESEND_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM || 'Bromar Ops <noreply@bromar.com.au>';
const PORTAL_URL = 'https://bromarhub.netlify.app/clients/tyrecycle/compliance/index.html';
const ALLOWED_ORIGINS = [
  'https://bromarhub.netlify.app',
  'https://bromar-engineering.github.io',
];

const VALID_SECTIONS = ['emergency_lighting', 'rcd_testing', 'test_tagging'];
const VALID_CLIENTS = { tyrecycle: 'Tyrecycle Somerton' };

const sb = createClient(SB_URL, SB_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

function getHeaders(event) {
  const origin = event?.headers?.origin || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

exports.handler = async (event) => {
  _headers = getHeaders(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: _headers };
  if (event.httpMethod !== 'POST') return reply(405, { error: 'Method not allowed' });

  /* ── Auth check ── */
  const token = (event.headers.authorization || '').replace('Bearer ', '');
  if (!token) return reply(401, { error: 'No auth token' });

  let caller;
  try {
    const { data: { user }, error } = await sb.auth.getUser(token);
    if (error || !user) throw new Error('Invalid token');
    if (user.app_metadata?.role === 'client') return reply(403, { error: 'Clients cannot manage portal users' });
    caller = user;
  } catch (e) {
    return reply(401, { error: 'Auth failed: ' + e.message });
  }

  /* Verify caller is admin employee — case-insensitive email match, use full_name */
  const { data: emp } = await sb.from('employees')
    .select('role, full_name')
    .ilike('email', caller.email)
    .maybeSingle();
  if (!emp || emp.role !== 'admin') return reply(403, { error: 'Admin role required' });

  /* ── Parse body ── */
  let body;
  try { body = JSON.parse(event.body); } catch { return reply(400, { error: 'Invalid JSON' }); }

  const { action } = body;

  try {
    switch (action) {
      case 'approve_request': return await approveRequest(body, emp);
      case 'decline_request': return await declineRequest(body, emp);
      case 'create_user': return await createUser(body, emp);
      case 'update_sections': return await updateSections(body);
      case 'send_reset': return await sendReset(body);
      case 'disable_user': return await toggleUser(body, false);
      case 'enable_user': return await toggleUser(body, true);
      case 'delete_user': return await deleteUser(body);
      default: return reply(400, { error: 'Unknown action: ' + action });
    }
  } catch (err) {
    console.error('Action failed:', action, err);
    return reply(500, { error: err.message });
  }
};

/* ── GUARDS ── */

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateSections(sections) {
  if (!Array.isArray(sections) || sections.length === 0) return false;
  return sections.every(s => VALID_SECTIONS.includes(s));
}

function validateClient(slug) {
  return slug && VALID_CLIENTS.hasOwnProperty(slug);
}

async function requireClientUser(user_id) {
  const { data, error } = await sb.from('client_users')
    .select('user_id, email, full_name, client_slug')
    .eq('user_id', user_id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw Object.assign(new Error('Client user not found'), { status: 404 });
  return data;
}

/* ── ACTIONS ── */

async function approveRequest({ request_id }, emp) {
  if (!request_id) throw new Error('request_id required');
  const { error } = await sb.from('client_access_requests')
    .update({
      status: 'approved',
      reviewed_by: emp.full_name || 'admin',
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', request_id);
  if (error) throw error;
  return reply(200, { ok: true });
}

async function declineRequest({ request_id, review_notes }, emp) {
  if (!request_id) throw new Error('request_id required');
  const { error } = await sb.from('client_access_requests')
    .update({
      status: 'declined',
      reviewed_by: emp.full_name || 'admin',
      reviewed_at: new Date().toISOString(),
      review_notes: review_notes || null,
    })
    .eq('id', request_id);
  if (error) throw error;
  return reply(200, { ok: true });
}

async function createUser({ email, full_name, company, position, phone, client_slug, sections, request_id }, emp) {
  if (!email || !full_name) throw new Error('Email and name required');
  if (!validateEmail(email)) throw new Error('Invalid email format');

  const slug = client_slug || 'tyrecycle';
  if (!validateClient(slug)) throw new Error('Invalid client: ' + slug);
  if (!validateSections(sections)) throw new Error('At least one valid section required (emergency_lighting, rcd_testing, test_tagging)');

  /* Generate random password (user will reset via welcome email) */
  const password = randomUUID() + 'Aa1!';

  /* Create auth user */
  const { data: authData, error: authErr } = await sb.auth.admin.createUser({
    email: email.toLowerCase(),
    password,
    email_confirm: true,
    app_metadata: { role: 'client', client: slug },
    user_metadata: { full_name },
  });
  if (authErr) throw authErr;

  const userId = authData.user.id;

  /* Create client_users row */
  const { error: rowErr } = await sb.from('client_users').insert({
    user_id: userId,
    client_slug: slug,
    full_name,
    email: email.toLowerCase(),
    position: position || null,
    company: company || null,
    phone: phone || null,
    sections: sections,
    active: true,
    request_id: request_id || null,
  });
  if (rowErr) {
    /* Rollback: delete auth user */
    await sb.auth.admin.deleteUser(userId);
    throw rowErr;
  }

  /* If request_id provided, mark request approved */
  if (request_id) {
    await sb.from('client_access_requests')
      .update({
        status: 'approved',
        reviewed_by: emp.full_name || 'admin',
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', request_id);
  }

  /* Generate recovery link for welcome email */
  let emailed = false;
  try {
    const { data: linkData, error: linkErr } = await sb.auth.admin.generateLink({
      type: 'recovery',
      email: email.toLowerCase(),
      options: { redirectTo: PORTAL_URL },
    });

    if (!linkErr && linkData?.properties?.action_link) {
      await sendEmail(email, 'Welcome to the Bromar Compliance Portal', welcomeHtml(full_name, linkData.properties.action_link));
      emailed = true;
    }
  } catch (emailErr) {
    console.warn('Welcome email failed:', emailErr.message);
  }

  return reply(200, { ok: true, user_id: userId, emailed });
}

async function updateSections({ user_id, sections }) {
  if (!user_id) throw new Error('user_id required');
  await requireClientUser(user_id);
  if (!validateSections(sections)) throw new Error('At least one valid section required');

  const { error } = await sb.from('client_users')
    .update({ sections, updated_at: new Date().toISOString() })
    .eq('user_id', user_id);
  if (error) throw error;
  return reply(200, { ok: true });
}

async function sendReset({ user_id }) {
  if (!user_id) throw new Error('user_id required');
  const cu = await requireClientUser(user_id);

  let emailed = false;
  const { data: linkData, error: linkErr } = await sb.auth.admin.generateLink({
    type: 'recovery',
    email: cu.email,
    options: { redirectTo: PORTAL_URL },
  });
  if (linkErr) throw linkErr;

  try {
    await sendEmail(cu.email, 'Password Reset — Bromar Compliance Portal', resetHtml(cu.full_name, linkData.properties.action_link));
    emailed = true;
  } catch (emailErr) {
    console.warn('Reset email failed:', emailErr.message);
  }

  return reply(200, { ok: true, emailed });
}

async function toggleUser({ user_id }, enable) {
  if (!user_id) throw new Error('user_id required');
  await requireClientUser(user_id);

  /* Update client_users */
  const { error: rowErr } = await sb.from('client_users')
    .update({ active: enable, updated_at: new Date().toISOString() })
    .eq('user_id', user_id);
  if (rowErr) throw rowErr;

  /* Ban / unban in auth */
  const { error: authErr } = await sb.auth.admin.updateUserById(user_id, {
    ban_duration: enable ? 'none' : '876000h',
  });
  if (authErr) throw authErr;

  return reply(200, { ok: true });
}

async function deleteUser({ user_id }) {
  if (!user_id) throw new Error('user_id required');
  await requireClientUser(user_id);

  /* Delete client_users row */
  await sb.from('client_users').delete().eq('user_id', user_id);

  /* Delete auth user */
  const { error } = await sb.auth.admin.deleteUser(user_id);
  if (error) throw error;

  return reply(200, { ok: true });
}

/* ── HELPERS ── */

let _headers = {};
function reply(status, data) {
  return { statusCode: status, headers: _headers, body: JSON.stringify(data) };
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function sendEmail(to, subject, html) {
  if (!RESEND_KEY) { console.warn('RESEND_API_KEY not set, skipping email'); throw new Error('Email not configured'); }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + RESEND_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: RESEND_FROM, to: [to], subject, html }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error('Resend error:', err);
    throw new Error('Email delivery failed');
  }
}

function welcomeHtml(name, link) {
  const safeName = escapeHtml(name);
  return `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:20px">
    <div style="background:#ea580c;padding:16px 24px;border-radius:8px 8px 0 0">
      <h1 style="color:#fff;margin:0;font-size:18px">Bromar Electrical Services</h1>
    </div>
    <div style="background:#fff;border:1px solid #e5e7eb;border-top:0;padding:24px;border-radius:0 0 8px 8px">
      <p>Hi ${safeName},</p>
      <p>Your login for the Bromar Compliance Portal has been created. Click below to set your password and get started:</p>
      <p style="text-align:center;margin:24px 0">
        <a href="${link}" style="background:#ea580c;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">Set Password &amp; Sign In</a>
      </p>
      <p style="color:#6b7280;font-size:13px">If you didn't expect this email, please ignore it.</p>
      <p style="color:#6b7280;font-size:13px">&mdash; Bromar Ops Team</p>
    </div>
  </div>`;
}

function resetHtml(name, link) {
  const safeName = escapeHtml(name);
  return `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:20px">
    <div style="background:#ea580c;padding:16px 24px;border-radius:8px 8px 0 0">
      <h1 style="color:#fff;margin:0;font-size:18px">Bromar Electrical Services</h1>
    </div>
    <div style="background:#fff;border:1px solid #e5e7eb;border-top:0;padding:24px;border-radius:0 0 8px 8px">
      <p>Hi ${safeName},</p>
      <p>A password reset was requested for your Bromar Compliance Portal account. Click below to set a new password:</p>
      <p style="text-align:center;margin:24px 0">
        <a href="${link}" style="background:#ea580c;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">Reset Password</a>
      </p>
      <p style="color:#6b7280;font-size:13px">If you didn't request this, you can safely ignore it.</p>
      <p style="color:#6b7280;font-size:13px">&mdash; Bromar Ops Team</p>
    </div>
  </div>`;
}
