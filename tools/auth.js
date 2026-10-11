// auth.js - V1.01 - 2026-10-12 - /tools/auth.js
// ============================================
// BROMAR HUB - SHARED AUTHENTICATION
// ============================================
// This file handles authentication for staff subpages under the Bromar Hub.
//   - If user is not logged in           → redirected to /index.html
//   - If logged-in user is a staff user  → page loads normally
//   - If logged-in user is a client user → redirected to their compliance
//     portal at /clients/<slug>/compliance/index.html
//
// Client role is determined by session.user.app_metadata.role === 'client'.
// app_metadata can only be set server-side, so it is trusted.
//
// IMPORTANT: Client portal pages under /clients/*/compliance/ MUST NOT load
// this file. Those pages load the Supabase CDN + /tools/bromar-hub.js only
// and rely on window.sb created there. Loading auth.js on a client portal
// page would cause an infinite redirect loop.
// ============================================

const SUPABASE_URL = 'https://iwtvlpfprxqwveqadlwl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3dHZscGZwcnhxd3ZlcWFkbHdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1MzczMDQsImV4cCI6MjA5MzExMzMwNH0.X6tOhxgFnJDDipltIuILOaZRv4bM4RE9kVV1R_UsE5k';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storage: window.localStorage,
    }
});

// Share the client with other scripts (e.g. bromar-hub.js) so a second
// client isn't created with different auth options.
window.sb = supabaseClient;

// Check authentication on page load
(async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (!session) {
        window.location.href = '/index.html';
        return;
    }

    // Client accounts don't belong on staff pages — redirect to their portal.
    const role = session.user?.app_metadata?.role;
    if (role === 'client') {
        try { document.documentElement.style.visibility = 'hidden'; } catch (_) {}
        const rawSlug = session.user?.app_metadata?.client || '';
        const slug = String(rawSlug).toLowerCase().replace(/[^a-z0-9-]/g, '');
        const target = slug
            ? `/clients/${slug}/compliance/index.html`
            : '/index.html';
        window.location.replace(target);
        return;
    }
})();
