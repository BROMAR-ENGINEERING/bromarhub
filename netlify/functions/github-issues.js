/* ============================================================
   NETLIFY FUNCTION — GITHUB ISSUES FEED (Ash dashboard)
   V1.00 — netlify/functions/github-issues.js
   Returns recent issues/PRs for the Hub + Ops repos.
   Caller must send a Supabase JWT for the dashboard owner.
   Requires: GITHUB_TOKEN (read access to issues on the repos)
   Optional: GITHUB_REPOS (comma list "owner/repo"), SUPABASE_URL
   ============================================================ */

const OWNER_EMAIL = 'ashleys@bromar.com.au';
const SB_URL = process.env.SUPABASE_URL || 'https://iwtvlpfprxqwveqadlwl.supabase.co';
const ALLOWED_ORIGINS = ['https://bromarhub.netlify.app'];
// Ops repo name is a guess — set GITHUB_REPOS in Netlify to override.
const REPOS = (process.env.GITHUB_REPOS || 'BROMAR-ENGINEERING/bromarhub,BROMAR-ENGINEERING/bromar-ops')
  .split(',').map(s => s.trim()).filter(Boolean);

function headers(event) {
  const origin = event?.headers?.origin || '';
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };
}

exports.handler = async (event) => {
  const h = headers(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: h };
  const reply = (statusCode, body) => ({ statusCode, headers: h, body: JSON.stringify(body) });

  const token = (event.headers?.authorization || event.headers?.Authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return reply(401, { error: 'Not signed in' });
  const apikey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;
  try {
    const u = await fetch(SB_URL + '/auth/v1/user', { headers: { Authorization: 'Bearer ' + token, apikey } });
    const user = u.ok ? await u.json() : null;
    if (!user || (user.email || '').toLowerCase() !== OWNER_EMAIL) return reply(403, { error: 'Forbidden' });
  } catch (e) { return reply(502, { error: 'Auth check failed' }); }

  const gh = process.env.GITHUB_TOKEN;
  if (!gh) return reply(500, { error: 'GITHUB_TOKEN not configured' });
  const state = ['open', 'closed', 'all'].includes(event.queryStringParameters?.state) ? event.queryStringParameters.state : 'open';

  const results = await Promise.all(REPOS.map(async repo => {
    try {
      const r = await fetch(`https://api.github.com/repos/${repo}/issues?state=${state}&sort=updated&direction=desc&per_page=25`, {
        headers: { Authorization: 'Bearer ' + gh, Accept: 'application/vnd.github+json', 'User-Agent': 'bromar-dashboard' },
      });
      if (!r.ok) return { repo, error: 'GitHub ' + r.status, items: [] };
      const list = await r.json();
      return {
        repo,
        items: list.map(i => ({
          number: i.number, title: i.title, state: i.state, url: i.html_url,
          pr: !!i.pull_request, comments: i.comments, updated_at: i.updated_at,
          labels: (i.labels || []).map(l => l.name),
        })),
      };
    } catch (e) { return { repo, error: 'Fetch failed', items: [] }; }
  }));
  return reply(200, { repos: results });
};
