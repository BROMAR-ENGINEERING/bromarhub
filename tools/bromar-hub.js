/* ============================================================
   BROMAR HUB — SHARED JAVASCRIPT
   Import this on every hub page AFTER the Supabase CDN script and auth.js:
     <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
     <script src="/tools/auth.js"></script>
     <link rel="stylesheet" href="../tools/bromar-hub.css"/>
     <script src="../tools/bromar-hub.js" defer></script>
   ============================================================

   Provides:
     - window.sb          — Supabase client
     - window.EMPLOYEES   — employee list (loaded on DOMContentLoaded)
     - window.currentUser — { name, email } of logged-in user
     - BromarHub.initTheme()
     - BromarHub.initHeader()
     - BromarHub.initFavicon()
     - BromarHub.loadEmployees()
     - BromarHub.autoSelectLoggedInUser()
     - BromarHub.showSuccess(text, duration?)
     - BromarHub.showInfo(text, duration?)
     - BromarHub.showLoading(text, subtext?)
     - BromarHub.hideLoading()
     - BromarHub.escapeHtml(str)
*/

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

  // ── USER PREFERENCES (Font Size, Density, Zoom) ──────────
  function applyUserPreferences() {
    // Font size
    const fontSize = localStorage.getItem('fontSize') || 'normal';
    const sizes = { small: '14px', normal: '16px', large: '18px', xlarge: '20px' };
    document.documentElement.style.fontSize = sizes[fontSize] || sizes.normal;
    
    // Density
    const density = localStorage.getItem('density') || 'normal';
    document.documentElement.setAttribute('data-density', density);

    // Zoom (default off)
    const zoom = localStorage.getItem('zoom') || 'off';
    const viewport = document.querySelector('meta[name="viewport"]');
    const zoomContent = zoom === 'on' 
      ? 'width=device-width, initial-scale=1.0'
      : 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
    
    if (viewport) {
      viewport.setAttribute('content', zoomContent);
    } else {
      const meta = document.createElement('meta');
      meta.name = 'viewport';
      meta.content = zoomContent;
      document.head.appendChild(meta);
    }
  }

  // Apply immediately
  applyUserPreferences();

  // ── FAVICON ───────────────────────────────────────────────
  function initFavicon() {
    // Skip if favicon already exists
    if (document.querySelector('link[rel="icon"]')) return;
    const link = document.createElement('link');
    link.rel  = 'icon';
    link.type = 'image/png';
    link.href = '/favicon.png';
    document.head.appendChild(link);
  }

  // ── PWA ───────────────────────────────────────────────────
  function initPWA() {
    // Add manifest link
    if (!document.querySelector('link[rel="manifest"]')) {
      const manifest = document.createElement('link');
      manifest.rel  = 'manifest';
      manifest.href = '/manifest.json';
      document.head.appendChild(manifest);
    }

    // Add theme color
    if (!document.querySelector('meta[name="theme-color"]')) {
      const themeColor = document.createElement('meta');
      themeColor.name    = 'theme-color';
      themeColor.content = '#ea580c';
      document.head.appendChild(themeColor);
    }

    // Add Apple-specific meta tags
    if (!document.querySelector('meta[name="apple-mobile-web-app-capable"]')) {
      const appleCapable = document.createElement('meta');
      appleCapable.name    = 'apple-mobile-web-app-capable';
      appleCapable.content = 'yes';
      document.head.appendChild(appleCapable);
    }

    if (!document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')) {
      const appleStatusBar = document.createElement('meta');
      appleStatusBar.name    = 'apple-mobile-web-app-status-bar-style';
      appleStatusBar.content = 'default';
      document.head.appendChild(appleStatusBar);
    }

    if (!document.querySelector('meta[name="apple-mobile-web-app-title"]')) {
      const appleTitle = document.createElement('meta');
      appleTitle.name    = 'apple-mobile-web-app-title';
      appleTitle.content = 'Bromar Hub';
      document.head.appendChild(appleTitle);
    }

    if (!document.querySelector('link[rel="apple-touch-icon"]')) {
      // iOS requires multiple sizes for best display
      const sizes = ['72x72', '96x96', '128x128', '144x144', '152x152', '192x192'];
      sizes.forEach(size => {
        const appleIcon = document.createElement('link');
        appleIcon.rel   = 'apple-touch-icon';
        appleIcon.sizes = size;
        appleIcon.href  = `/icons/icon-${size}.png`;
        document.head.appendChild(appleIcon);
      });
      // Default (no size attribute) - iOS picks best
      const defaultIcon = document.createElement('link');
      defaultIcon.rel  = 'apple-touch-icon';
      defaultIcon.href = '/icons/icon-192x192.png';
      document.head.appendChild(defaultIcon);
    }

    // Register service worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then((registration) => {
            console.log('[PWA] Service Worker registered:', registration.scope);
          })
          .catch((error) => {
            console.error('[PWA] Service Worker registration failed:', error);
          });
      });
    }
  }

  // ── THEME ─────────────────────────────────────────────────
  function initTheme() {
    const html   = document.documentElement;
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
    placeholder.outerHTML = `
      <div class="header">
        <div class="header-controls">
          <a href="../index.html" class="control-btn" aria-label="Home">
            <svg viewBox="0 0 24 24"><path d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10"/></svg>
          </a>
          <button id="themeToggle" class="control-btn" aria-label="Toggle theme">
            <svg class="sun-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            <svg class="moon-icon" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          </button>
        </div>
        <div class="header-content">
          <img src="../Bromar-Primary-Logo-Full-Colour.png" alt="Bromar" class="logo-image light-logo"/>
          <img src="../Bromar-Primary-Logo-Reverse-White.png" alt="Bromar" class="logo-image dark-logo"/>
        </div>
      </div>`;
  }

  // ── LOADING OVERLAY ───────────────────────────────────────
  function initLoadingOverlay() {
    if (document.getElementById('bromarLoadingOverlay')) return;
    const el = document.createElement('div');
    el.id        = 'bromarLoadingOverlay';
    el.className = 'loading-overlay';
    el.innerHTML = `
      <div class="loading-content">
        <div class="loading-spinner"></div>
        <div class="loading-text"    id="bromarLoadingText">Processing...</div>
        <div class="loading-subtext" id="bromarLoadingSubtext">Please wait</div>
      </div>`;
    document.body.appendChild(el);
  }

  function showLoading(text, subtext) {
    const el = document.getElementById('bromarLoadingOverlay')
            || document.getElementById('loadingOverlay');
    const t  = document.getElementById('bromarLoadingText')
            || document.getElementById('loadingText');
    const s  = document.getElementById('bromarLoadingSubtext')
            || document.getElementById('loadingSubtext');
    if (t) t.textContent = text || 'Processing...';
    if (s) s.textContent = subtext || 'Please wait';
    if (el) el.classList.add('show');
  }

  function hideLoading() {
    const el = document.getElementById('bromarLoadingOverlay')
            || document.getElementById('loadingOverlay');
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
          window.currentUser = opt?.value
            ? { name: opt.value, email: opt.dataset.email || '' }
            : null;
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
      select.value    = match.full_name;
      select.disabled = true;
      window.currentUser = { name: match.full_name, email: match.email || '' };
      // Add 🔒 badge
      const label = document.querySelector(`label[for="${selectId}"]`);
      if (label && !label.querySelector('.logged-in-badge')) {
        const badge = document.createElement('span');
        badge.className  = 'logged-in-badge';
        badge.style.cssText = 'color: var(--success); font-size: 0.75rem; font-weight: 600; margin-left: 6px;';
        badge.textContent   = '🔒 Logged in';
        label.appendChild(badge);
      }
    } catch (_) { /* auth not active */ }
  }

  // ── HELPERS ───────────────────────────────────────────────
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  // ── AUTO-INIT ─────────────────────────────────────────────
  // Run PWA and favicon injection immediately (before DOM ready)
  // so iOS sees the tags before rendering
  initFavicon();
  initPWA();
  
  // Run as soon as the DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    initHeader();         // inject header HTML (if placeholder present)
    initTheme();          // apply saved theme + wire toggle
    initLoadingOverlay(); // inject loading overlay if not already in HTML
  });

  // ── PUBLIC API ────────────────────────────────────────────
  window.BromarHub = {
    initTheme,
    initHeader,
    initFavicon,
    initPWA,
    loadEmployees,
    autoSelectLoggedInUser,
    showSuccess,
    showInfo,
    showLoading,
    hideLoading,
    escapeHtml,
  };
})();
