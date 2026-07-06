/* ============================================================
   BROMAR HUB — SHARED JAVASCRIPT
   Import on every hub page AFTER Supabase CDN + auth.js:
     <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
     <script src="/tools/auth.js"></script>
     <link rel="stylesheet" href="/tools/bromar-hub.css"/>
     <script src="/tools/bromar-hub.js" defer></script>
   ============================================================ */

(function () {
  // ── SUPABASE ──────────────────────────────────────────────
  const SUPABASE_URL     = 'https://iwtvlpfprxqwveqadlwl.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3dHZscGZwcnhxd3ZlcWFkbHdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1MzczMDQsImV4cCI6MjA5MzExMzMwNH0.X6tOhxgFnJDDipltIuILOaZRv4bM4RE9kVV1R_UsE5k';

  if (!window.supabase?.createClient) {
    console.error('[BromarHub] Supabase library not loaded');
  } else {
    window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  window.EMPLOYEES   = [];
  window.currentUser = null;

  // ── USER PREFERENCES ─────────────────────────────────────
  function applyUserPreferences() {
    const fontSize = localStorage.getItem('fontSize') || 'normal';
    const sizes = { small: '14px', normal: '16px', large: '18px', xlarge: '20px' };
    document.documentElement.style.fontSize = sizes[fontSize] || sizes.normal;
    const density = localStorage.getItem('density') || 'normal';
    document.documentElement.setAttribute('data-density', density);
    const zoom = localStorage.getItem('zoom') || 'off';
    const viewport = document.querySelector('meta[name="viewport"]');
    const zoomContent = zoom === 'on'
      ? 'width=device-width, initial-scale=1.0'
      : 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
    if (viewport) viewport.setAttribute('content', zoomContent);
    else {
      const meta = document.createElement('meta');
      meta.name = 'viewport'; meta.content = zoomContent;
      document.head.appendChild(meta);
    }
  }
  applyUserPreferences();

  // ── SEARCH AUTOFILL PROTECTION ────────────────────────────
  function initSearchProtection() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;
    searchInput.setAttribute('autocomplete', 'off');
    searchInput.setAttribute('autocorrect', 'off');
    searchInput.setAttribute('autocapitalize', 'off');
    searchInput.setAttribute('spellcheck', 'false');
    searchInput.setAttribute('data-lpignore', 'true');
    searchInput.setAttribute('data-form-type', 'other');
    if (!searchInput.name || searchInput.name === 'search') {
      searchInput.name = 'search-no-autofill-' + Math.random().toString(36).slice(2, 8);
    }
    const isEmail = (v) => /\S+@\S+\.\S+/.test(v);
    searchInput.addEventListener('focus', () => {
      if (isEmail(searchInput.value)) {
        searchInput.value = '';
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    searchInput.addEventListener('input', (e) => {
      if (isEmail(e.target.value)) e.target.value = '';
    });
    let checkCount = 0;
    const autofillCheck = setInterval(() => {
      if (isEmail(searchInput.value)) {
        searchInput.value = '';
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (++checkCount > 20) clearInterval(autofillCheck);
    }, 100);
  }

  // ── FAVICON ───────────────────────────────────────────────
  function initFavicon() {
    if (document.querySelector('link[rel="icon"]')) return;
    const link = document.createElement('link');
    link.rel = 'icon'; link.type = 'image/png'; link.href = '/assets/icons/icon-32x32.png';
    document.head.appendChild(link);
  }

  // ── PWA ───────────────────────────────────────────────────
  function initPWA() {
    if (!document.querySelector('link[rel="manifest"]')) {
      const m = document.createElement('link');
      m.rel = 'manifest'; m.href = '/manifest.json';
      document.head.appendChild(m);
    }
    if (!document.querySelector('meta[name="theme-color"]')) {
      const t = document.createElement('meta');
      t.name = 'theme-color'; t.content = '#ea580c';
      document.head.appendChild(t);
    }
    if (!document.querySelector('meta[name="apple-mobile-web-app-capable"]')) {
      const a = document.createElement('meta');
      a.name = 'apple-mobile-web-app-capable'; a.content = 'yes';
      document.head.appendChild(a);
    }
    if (!document.querySelector('meta[name="mobile-web-app-capable"]')) {
      const m = document.createElement('meta');
      m.name = 'mobile-web-app-capable'; m.content = 'yes';
      document.head.appendChild(m);
    }
    if (!document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')) {
      const s = document.createElement('meta');
      s.name = 'apple-mobile-web-app-status-bar-style'; s.content = 'default';
      document.head.appendChild(s);
    }
    if (!document.querySelector('meta[name="apple-mobile-web-app-title"]')) {
      const t = document.createElement('meta');
      t.name = 'apple-mobile-web-app-title'; t.content = 'Bromar Hub';
      document.head.appendChild(t);
    }
    if (!document.querySelector('link[rel="apple-touch-icon"]')) {
      const sizes = ['72x72', '96x96', '128x128', '144x144', '152x152', '192x192'];
      sizes.forEach(size => {
        const i = document.createElement('link');
        i.rel = 'apple-touch-icon'; i.sizes = size;
        i.href = `/assets/icons/icon-${size}.png`;
        document.head.appendChild(i);
      });
      const d = document.createElement('link');
      d.rel = 'apple-touch-icon'; d.href = '/assets/icons/icon-192x192.png';
      document.head.appendChild(d);
    }
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then(r => console.log('[PWA] SW registered:', r.scope))
          .catch(e => console.error('[PWA] SW failed:', e));
      });
    }
  }

  // ── THEME ─────────────────────────────────────────────────
  function initTheme() {
    const html = document.documentElement;
    const toggle = document.getElementById('themeToggle');
    function getTheme() {
      const saved = localStorage.getItem('theme');
      if (saved === 'dark' || saved === 'light') return saved;
      return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    html.setAttribute('data-theme', getTheme());
    if (toggle) {
      toggle.addEventListener('click', () => {
        const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        html.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
      });
    }
    window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', e => {
      if (!localStorage.getItem('theme')) html.setAttribute('data-theme', e.matches ? 'dark' : 'light');
    });
  }

  // ── HEADER INJECTION ──────────────────────────────────────
  function initHeader() {
    const placeholder = document.getElementById('bromar-header');
    if (!placeholder) return;
    let homeHref = '/index.html';
    const path = window.location.pathname;
    if (path.includes('/clients/tyrecycle/') && !path.endsWith('/tyrecyclehome.html')) {
      homeHref = '/clients/tyrecycle/tyrecyclehome.html';
    }
    placeholder.outerHTML = `
      <div class="header">
        <div class="header-controls">
          <button id="bromarMenuBtn" class="control-btn" aria-label="Menu">
            <svg viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <a href="${homeHref}" class="control-btn" aria-label="Home">
            <svg viewBox="0 0 24 24"><path d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10"/></svg>
          </a>
          <button id="themeToggle" class="control-btn" aria-label="Toggle theme">
            <svg class="sun-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            <svg class="moon-icon" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          </button>
        </div>
        <div class="header-content">
          <img src="/assets/logo/bromar-logo-colour.png" alt="Bromar" class="logo-image light-logo"/>
          <img src="/assets/logo/bromar-logo-white.png" alt="Bromar" class="logo-image dark-logo"/>
        </div>
      </div>`;
    initMenu();
  }

  // ── COLLAPSIBLE NAVIGATION MENU ───────────────────────────
  const MENU_SECTIONS = [
    { title: 'Job Management', items: [
      { title: 'Jobsheet Submission', href: '/job-management/jobsheet-submission.html', locked: false, iconPath: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>' },
      { title: 'Timesheet Submission', href: '/job-management/timesheet-submission.html', locked: false, iconPath: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>' },
      { title: 'Purchase Order', href: '/job-management/purchase-order.html', locked: false, iconPath: '<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>' },
      { title: 'Job Manager', href: '/job-management/job-manager.html', locked: true, iconPath: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>' },
    ]},
    { title: 'Schedules & Rosters', items: [
      { title: 'Your Schedule', href: '/schedules/your-schedule.html', locked: false, iconPath: '<path d="M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>' },
      { title: 'ETU RDO Calendar', href: '/schedules/etu-rdo-calendar.html', locked: false, iconPath: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="m9 16 2 2 4-4"/>' },
      { title: 'Callout Roster', href: '/schedules/callout-roster.html', locked: false, iconPath: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>' },
      { title: 'RDO Roster', href: '/schedules/rdo-roster.html', locked: false, iconPath: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>' },
      { title: 'Callout Roster Change', href: '/schedules/callout-roster-change.html', locked: true, iconPath: '<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>' },
    ]},
    { title: 'Safety & Compliance', items: [
      { title: 'Incident Report', href: '/safety/incident-report.html', locked: false, iconPath: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>' },
      { title: 'Hazard Report', href: '/safety/hazard-report.html', locked: false, iconPath: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>' },
      { title: 'PPE/Uniform Request', href: '/safety/ppe-uniform-request.html', locked: true, iconPath: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>' },
      { title: 'First Aiders', href: '/safety/first-aiders.html', locked: true, iconPath: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>' },
      { title: 'Toolbox Talks', href: '/safety/toolbox-talks.html', locked: true, iconPath: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>' },
      { title: 'SWMS Builder', href: '/safety/swms-builder.html', locked: true, iconPath: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M12 18v-6"/><path d="m9 15 3 3 3-3"/>' },
    ]},
    { title: 'Standards & Knowledge', items: [
      { title: 'Standards', href: '/standards/standards.html', locked: true, iconPath: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>' },
      { title: 'Technical Resources', href: '/standards/technical-resources.html', locked: true, iconPath: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>' },
      { title: 'Electrical Calculators', href: '/standards/electrical-calculators.html', locked: false, iconPath: '<rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="8" y1="6" x2="16" y2="6"/>' },
      { title: 'Cable Calculator', href: '/standards/cable-calculator.html', locked: true, iconPath: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>' },
    ]},
    { title: 'Employee Resources', items: [
      { title: 'Leave Request', href: '/employee-resources/leave-request.html', locked: false, iconPath: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="m9 16 2 2 4-4"/>' },
      { title: 'EBA Document', href: '/employee-resources/eba.html', locked: false, iconPath: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>' },
      { title: 'Company Policies', href: '/employee-resources/company-policies.html', locked: true, iconPath: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>' },
      { title: 'Expense Claim', href: '/employee-resources/expense-claim.html', locked: false, iconPath: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>' },
      { title: 'Employee Change Details', href: '/employee-resources/employee-change-details.html', locked: false, iconPath: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>' },
    ]},
    { title: 'Fleet Management', items: [
      { title: 'Vehicle Maintenance Request', href: '/fleet-management/vehicle-maintenance-request.html', locked: false, iconPath: '<rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>' },
      { title: 'Vehicle Maintenance Audit', href: '/fleet-management/vehicle-maintenance-audit.html', locked: true, iconPath: '<path d="M9 11H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-4"/><path d="M9 11V7a3 3 0 0 1 6 0v4"/><path d="m8 16 2 2 4-4"/>' },
    ]},
    { title: 'Toolbox', items: [
      { title: 'Testing', href: '/toolbox/testing.html', locked: true, iconPath: '<path d="M9 2v6l-3 3v11h12V11l-3-3V2"/><line x1="9" y1="2" x2="15" y2="2"/><line x1="9" y1="14" x2="15" y2="14"/><line x1="9" y1="18" x2="15" y2="18"/>' },
      { title: 'Switchboard Schedule Builder', href: '/toolbox/switchboard-schedule-builder.html', locked: true, iconPath: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/>' },
    ]},
    { title: 'Client Sites', items: [
      { title: 'Tyrecycle', href: '/clients/tyrecycle/tyrecyclehome.html', locked: false, iconPath: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>' },
    ]},
    { title: 'Bromar Hub', items: [
      { title: 'Settings', href: '/employee-resources/settings.html', locked: false, iconPath: '<circle cx="12" cy="12" r="3"/>' },
      { title: 'Suggestions & Feedback', href: '/employee-resources/suggestions-feedback.html', locked: false, iconPath: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>' },
      { title: 'FAQ', href: '/employee-resources/faq.html', locked: true, iconPath: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>' },
    ]},
  ];

  function initMenu() {
    if (document.getElementById('bromarMenu')) return;

    const style = document.createElement('style');
    style.textContent = `
      #bromarMenuBackdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); z-index: 9998; opacity: 0; pointer-events: none; transition: opacity 0.25s ease; }
      #bromarMenuBackdrop.show { opacity: 1; pointer-events: auto; }
      #bromarMenu { position: fixed; top: 0; left: 0; height: 100dvh; width: 320px; max-width: 90vw; background: var(--bg-secondary); border-right: 1px solid var(--border); z-index: 9999; transform: translateX(-100%); transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1); display: flex; flex-direction: column; box-shadow: 4px 0 24px rgba(0,0,0,0.15); }
      #bromarMenu.show { transform: translateX(0); }
      .bromar-menu-header { padding: 1.25rem 1.25rem 1rem; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
      .bromar-menu-title { font-size: 1.1rem; font-weight: 700; color: var(--text-primary); letter-spacing: -0.01em; }
      .bromar-menu-close { width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-main); color: var(--text-primary); cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; }
      .bromar-menu-close svg { width: 16px; height: 16px; stroke: currentColor; stroke-width: 2; fill: none; stroke-linecap: round; stroke-linejoin: round; }
      .bromar-menu-body { flex: 1; overflow-y: auto; padding: 0.5rem 0.75rem 1.25rem; -webkit-overflow-scrolling: touch; }
      .bromar-menu-section { border-radius: 10px; margin-bottom: 0.375rem; overflow: hidden; }
      .bromar-menu-section-btn { width: 100%; display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 0.875rem; background: transparent; border: none; cursor: pointer; font-family: 'Outfit', sans-serif; font-size: 0.9rem; font-weight: 700; color: var(--text-primary); text-align: left; border-radius: 10px; transition: background 0.15s ease; letter-spacing: -0.01em; }
      .bromar-menu-section-btn:hover { background: var(--bg-main); }
      .bromar-menu-section-btn svg.chevron { width: 16px; height: 16px; stroke: var(--text-secondary); stroke-width: 2; fill: none; transition: transform 0.25s ease; flex-shrink: 0; }
      .bromar-menu-section.open .bromar-menu-section-btn svg.chevron { transform: rotate(90deg); }
      .bromar-menu-items { max-height: 0; overflow: hidden; transition: max-height 0.3s ease; }
      .bromar-menu-section.open .bromar-menu-items { max-height: 800px; }
      .bromar-menu-item { display: flex; align-items: center; gap: 0.625rem; padding: 0.625rem 0.875rem 0.625rem 1rem; color: var(--text-primary); text-decoration: none; font-size: 0.85rem; border-radius: 8px; margin: 0.15rem 0; transition: background 0.15s ease; }
      .bromar-menu-item:hover { background: var(--bg-main); }
      .bromar-menu-item.active { background: var(--bg-main); color: var(--accent); font-weight: 600; }
      .bromar-menu-item-icon { width: 22px; height: 22px; border-radius: 5px; background: rgba(234, 88, 12, 0.1); color: var(--accent); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
      .bromar-menu-item-icon svg { width: 12px; height: 12px; stroke: currentColor; stroke-width: 2; fill: none; stroke-linecap: round; stroke-linejoin: round; }
      .bromar-menu-item-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .bromar-menu-lock { font-size: 0.7rem; opacity: 0.65; flex-shrink: 0; }
      [data-theme="dark"] #bromarMenu { box-shadow: 4px 0 24px rgba(0,0,0,0.4); }
    `;
    document.head.appendChild(style);

    const backdrop = document.createElement('div');
    backdrop.id = 'bromarMenuBackdrop';
    document.body.appendChild(backdrop);

    const drawer = document.createElement('nav');
    drawer.id = 'bromarMenu';
    drawer.setAttribute('aria-label', 'Main menu');

    const currentPath = window.location.pathname;
    const sectionsHTML = MENU_SECTIONS.map((section, idx) => {
      const itemsHTML = section.items.map(item => {
        const isActive = currentPath === item.href || currentPath.endsWith(item.href);
        return `
          <a href="${item.href}" class="bromar-menu-item${isActive ? ' active' : ''}">
            <span class="bromar-menu-item-icon"><svg viewBox="0 0 24 24">${item.iconPath}</svg></span>
            <span class="bromar-menu-item-label">${item.title}</span>
            ${item.locked ? '<span class="bromar-menu-lock">🔒</span>' : ''}
          </a>`;
      }).join('');
      return `
        <div class="bromar-menu-section" data-section-index="${idx}">
          <button class="bromar-menu-section-btn" type="button">
            <span>${section.title}</span>
            <svg class="chevron" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
          <div class="bromar-menu-items">${itemsHTML}</div>
        </div>`;
    }).join('');

    drawer.innerHTML = `
      <div class="bromar-menu-header">
        <div class="bromar-menu-title">Menu</div>
        <button class="bromar-menu-close" id="bromarMenuCloseBtn" aria-label="Close menu">
          <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="bromar-menu-body">${sectionsHTML}</div>`;
    document.body.appendChild(drawer);

    const openMenu = () => { drawer.classList.add('show'); backdrop.classList.add('show'); };
    const closeMenu = () => { drawer.classList.remove('show'); backdrop.classList.remove('show'); };

    const menuBtn = document.getElementById('bromarMenuBtn');
    if (menuBtn) menuBtn.addEventListener('click', openMenu);
    document.getElementById('bromarMenuCloseBtn').addEventListener('click', closeMenu);
    backdrop.addEventListener('click', closeMenu);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && drawer.classList.contains('show')) closeMenu();
    });

    drawer.querySelectorAll('.bromar-menu-section-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const parent = btn.parentElement;
        const wasOpen = parent.classList.contains('open');
        drawer.querySelectorAll('.bromar-menu-section.open').forEach(s => s.classList.remove('open'));
        if (!wasOpen) parent.classList.add('open');
      });
    });

    const activeItem = drawer.querySelector('.bromar-menu-item.active');
    if (activeItem) {
      const section = activeItem.closest('.bromar-menu-section');
      if (section) section.classList.add('open');
    }
  }

  // ── LOADING OVERLAY ───────────────────────────────────────
  function initLoadingOverlay() {
    if (document.getElementById('bromarLoadingOverlay')) return;
    const el = document.createElement('div');
    el.id = 'bromarLoadingOverlay';
    el.className = 'loading-overlay';
    el.innerHTML = `
      <div class="loading-content">
        <div class="loading-spinner"></div>
        <div class="loading-text" id="bromarLoadingText">Processing...</div>
        <div class="loading-subtext" id="bromarLoadingSubtext">Please wait</div>
      </div>`;
    document.body.appendChild(el);
  }

  function showLoading(text, subtext) {
    const el = document.getElementById('bromarLoadingOverlay') || document.getElementById('loadingOverlay');
    const t = document.getElementById('bromarLoadingText') || document.getElementById('loadingText');
    const s = document.getElementById('bromarLoadingSubtext') || document.getElementById('loadingSubtext');
    if (t) t.textContent = text || 'Processing...';
    if (s) s.textContent = subtext || 'Please wait';
    if (el) el.classList.add('show');
  }

  function hideLoading() {
    const el = document.getElementById('bromarLoadingOverlay') || document.getElementById('loadingOverlay');
    if (el) el.classList.remove('show');
  }

  // ── BANNERS ───────────────────────────────────────────────
  function showSuccess(text, duration = 5000) {
    const b = document.getElementById('successBanner');
    const t = document.getElementById('successText');
    if (!b) return;
    if (t) t.textContent = text;
    b.classList.add('show');
    setTimeout(() => b.classList.remove('show'), duration);
  }

  function showInfo(text, duration = 6000) {
    const b = document.getElementById('infoBanner');
    const t = document.getElementById('infoBannerText');
    if (!b) return;
    if (t) t.textContent = text;
    b.classList.add('show');
    setTimeout(() => b.classList.remove('show'), duration);
  }

  // ── EMPLOYEES ─────────────────────────────────────────────
  async function loadEmployees(selectId = 'filled_by') {
    if (!window.sb) return [];
    try {
      const { data, error } = await window.sb.from('employees').select('full_name, email').order('full_name');
      if (error) { console.error('[BromarHub] loadEmployees:', error); return []; }
      window.EMPLOYEES = data || [];
      const select = document.getElementById(selectId);
      if (select) {
        select.innerHTML = '<option value="">Select your name...</option>' +
          window.EMPLOYEES.map(e => `<option value="${escapeHtml(e.full_name)}" data-email="${escapeHtml(e.email || '')}">${escapeHtml(e.full_name)}</option>`).join('');
        select.addEventListener('change', function () {
          const opt = this.selectedOptions[0];
          window.currentUser = opt?.value ? { name: opt.value, email: opt.dataset.email || '' } : null;
        });
      }
      return window.EMPLOYEES;
    } catch (err) { console.error('[BromarHub] loadEmployees:', err); return []; }
  }

  async function autoSelectLoggedInUser(selectId = 'filled_by') {
    if (!window.sb) return;
    try {
      const { data: { user } } = await window.sb.auth.getUser();
      if (!user?.email) return;
      const match = window.EMPLOYEES.find(e => e.email?.toLowerCase() === user.email.toLowerCase());
      if (!match) return;
      const select = document.getElementById(selectId);
      if (!select) return;
      select.value = match.full_name;
      select.disabled = true;
      window.currentUser = { name: match.full_name, email: match.email || '' };
      const label = document.querySelector(`label[for="${selectId}"]`);
      if (label && !label.querySelector('.logged-in-badge')) {
        const badge = document.createElement('span');
        badge.className = 'logged-in-badge';
        badge.style.cssText = 'color: var(--success); font-size: 0.75rem; font-weight: 600; margin-left: 6px;';
        badge.textContent = '🔒 Logged in';
        label.appendChild(badge);
      }
    } catch (_) {}
  }

  // ── HELPERS ───────────────────────────────────────────────
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  // ── AUTO-INIT ─────────────────────────────────────────────
  initFavicon();
  initPWA();

  document.addEventListener('DOMContentLoaded', () => {
    initHeader();
    initTheme();
    initLoadingOverlay();
    initSearchProtection();
  });

  // ── PUBLIC API ────────────────────────────────────────────
  window.BromarHub = {
    initTheme, initHeader, initFavicon, initPWA, initMenu,
    loadEmployees, autoSelectLoggedInUser,
    showSuccess, showInfo, showLoading, hideLoading, escapeHtml,
  };
})();
