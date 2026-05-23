/* ============================================================
   JOB MANAGER — CORE
   Provides the JobManager namespace: shared helpers, the tool
   registry, job search/list/pagination, select/deselect, and
   loadJobData(). Per-tab files call JobManager.registerTool(...).
   Load order: this file, then all tab files, then boot.
   ============================================================ */
(function () {
  const BUCKETS = {
    documents: 'job-sheet-files',
    safety:    'job-sheet-files',
    testing:   'job-sheet-files',
    photos:    'job-sheet-files',
    swms:      'swms-completed',
  };
  const SIGNED_URL_TTL = 3600;
  const JOB_PAGE_SIZE = 15;

  const sb = () => window.sb;

  // ── shared state ──
  const state = {
    ALL_JOBS: [],
    selectedJob: null,
    jobCache: null,
    activeTool: 'overview',
    searchFilter: { text: '', status: 'all', prefix: null },
    jobShowCount: JOB_PAGE_SIZE,
    currentUser: null,
    BROMAR_LOGO_DATAURL: null,
  };

  // ── tool registry ──
  // Each tool: { id, label, icon, render(panel, jobCache, job), count(jobCache) }
  const tools = {};
  const toolOrder = [];
  function registerTool(id, def) {
    tools[id] = { id, ...def };
    if (!toolOrder.includes(id)) toolOrder.push(id);
  }

  // ── helpers ──
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  const fmtDate = d => d ? new Date(d).toLocaleDateString('en-AU', { year:'numeric', month:'short', day:'numeric' }) : '—';
  const fmtMoney = n => '$' + (Number(n) || 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const statusBadge = s => `<span class="job-status status-${s || 'active'}">${(s || 'active').replace('_',' ')}</span>`;

  const PREFIX_CATEGORY = { BE:'Electrical', BC:'Construction', BA:'Automation', BS:'Service', BM:'Maintenance' };
  function jobTypeDisplay(job) {
    const cat = PREFIX_CATEGORY[job.prefix] || '';
    if (job.work_type) return `${esc(job.work_type)}${cat ? ` <span style="color:var(--text-secondary);font-weight:400;">· ${cat} (${esc(job.prefix)})</span>` : ''}`;
    if (cat) return `${cat} <span style="color:var(--text-secondary);font-weight:400;">(${esc(job.prefix)})</span>`;
    return '—';
  }

  async function ensureCurrentUser() {
    if (state.currentUser) return state.currentUser;
    try {
      const { data: { user } } = await sb().auth.getUser();
      if (user) {
        const { data: emp } = await sb().from('employees').select('full_name, email').eq('email', user.email).maybeSingle();
        state.currentUser = emp ? { name: emp.full_name, email: emp.email } : { name: user.email, email: user.email };
      }
    } catch (_) {}
    return state.currentUser;
  }

  async function loadBromarLogo() {
    if (state.BROMAR_LOGO_DATAURL) return state.BROMAR_LOGO_DATAURL;
    const candidates = [
      '../Bromar-Primary-Logo-Full-Colour.png',
      '/Bromar-Primary-Logo-Full-Colour.png',
      'Bromar-Primary-Logo-Full-Colour.png'
    ];
    for (const url of candidates) {
      try {
        const r = await fetch(url);
        if (!r.ok) continue;
        const blob = await r.blob();
        state.BROMAR_LOGO_DATAURL = await new Promise((res, rej) => {
          const fr = new FileReader();
          fr.onload = () => res(fr.result);
          fr.onerror = rej;
          fr.readAsDataURL(blob);
        });
        return state.BROMAR_LOGO_DATAURL;
      } catch (_) {}
    }
    console.warn('[JobManager] Could not load Bromar logo for PDFs');
    return null;
  }

  async function openSignedFile(bucket, path) {
    if (!bucket || !path) return;
    const { data, error } = await sb().storage.from(bucket).createSignedUrl(path, SIGNED_URL_TTL);
    if (error) { window.BromarHub?.showInfo?.('Could not open file: ' + error.message); return; }
    window.open(data.signedUrl, '_blank', 'noopener');
  }

  /* ── JOB LIST ──────────────────────────────────────────── */
  async function loadJobs() {
    const wrap = document.getElementById('jobListWrap');
    wrap.innerHTML = `<div class="loading-inline"><div class="spinner"></div>Loading jobs…</div>`;

    const { data, error } = await sb()
      .from('job_number_register')
      .select('job_number, prefix, client_name, site_name, site_address, contact_person, contact_phone, status, job_type, work_type, created_at, completed_at, notes')
      .order('created_at', { ascending: false });

    if (error) {
      wrap.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-text">${esc(error.message)}</div></div>`;
      return;
    }
    state.ALL_JOBS = data || [];
    wrap.innerHTML = `<div class="job-list" id="jobList"></div>`;
    renderJobList();
  }

  function renderJobList() {
    const list = document.getElementById('jobList');
    if (!list) return;
    let jobs = state.ALL_JOBS.slice();
    const f = state.searchFilter;

    if (f.status !== 'all') jobs = jobs.filter(j => j.status === f.status);
    if (f.prefix) jobs = jobs.filter(j => j.prefix === f.prefix);
    if (f.text) {
      const q = f.text.toLowerCase();
      jobs = jobs.filter(j =>
        (j.job_number   || '').toLowerCase().includes(q) ||
        (j.client_name  || '').toLowerCase().includes(q) ||
        (j.site_name    || '').toLowerCase().includes(q) ||
        (j.site_address || '').toLowerCase().includes(q)
      );
    }

    const existingFooter = list.parentElement.querySelector('.job-list-footer');
    if (existingFooter) existingFooter.remove();

    if (!jobs.length) {
      list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🔍</div><div class="empty-state-text">No jobs match your search</div></div>`;
      return;
    }

    const total = jobs.length;
    const shown = jobs.slice(0, state.jobShowCount);

    list.innerHTML = shown.map(j => `
      <div class="job-row" data-job-number="${esc(j.job_number)}">
        <div class="job-num">${esc(j.job_number)}</div>
        <div class="job-info">
          <div class="job-client">${esc(j.client_name)}</div>
          <div class="job-desc">${esc(j.site_name || j.site_address || '—')}</div>
        </div>
        ${statusBadge(j.status)}
      </div>
    `).join('');

    list.querySelectorAll('.job-row').forEach(el => {
      el.addEventListener('click', () => selectJob(el.dataset.jobNumber));
    });

    const remaining = total - shown.length;
    if (remaining > 0) {
      const footer = document.createElement('div');
      footer.className = 'job-list-footer';
      footer.style.cssText = 'text-align:center;margin-top:0.875rem;';
      footer.innerHTML = `<button class="btn-secondary" id="showMoreJobs">Show more (${remaining} more)</button>`;
      list.parentElement.appendChild(footer);
      footer.querySelector('#showMoreJobs').addEventListener('click', () => {
        state.jobShowCount += JOB_PAGE_SIZE;
        renderJobList();
      });
    }
  }

  /* ── SELECT / DESELECT ─────────────────────────────────── */
  function buildSidebarNav() {
    const navWrap = document.getElementById('sidebarNav');
    if (!navWrap) return;
    navWrap.innerHTML = toolOrder.map((id, i) => {
      const t = tools[id];
      const hasCount = typeof t.count === 'function';
      return `<button class="nav-item${i === 0 ? ' active' : ''}" data-tool="${id}">
        <span class="nav-icon">${t.icon || '•'}</span><span>${esc(t.label)}</span>
        ${hasCount ? `<span class="nav-count" id="cnt-${id}">0</span>` : ''}
      </button>`;
    }).join('');

    navWrap.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        navWrap.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.activeTool = btn.dataset.tool;
        renderTool();
        closeSidebarMobile();
      });
    });
  }

  async function selectJob(jobNumber) {
    const job = state.ALL_JOBS.find(j => j.job_number === jobNumber);
    if (!job) return;
    state.selectedJob = job;
    state.jobCache = null;
    state.activeTool = toolOrder[0] || 'overview';

    document.getElementById('pageWrapper').classList.add('has-sidebar');
    document.getElementById('sidebar').style.display = 'block';
    document.getElementById('searchView').style.display = 'none';
    document.getElementById('detailView').style.display = 'block';
    document.getElementById('sidebarToggle').style.display = window.innerWidth < 900 ? 'inline-flex' : 'none';
    document.getElementById('headerSubtitle').textContent = `Managing ${job.job_number} — ${job.client_name}`;

    document.getElementById('sbJobNum').textContent = job.job_number;
    document.getElementById('sbJobClient').textContent = job.client_name;
    document.getElementById('sbJobDesc').textContent = job.site_name || job.site_address || '';

    document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.tool === state.activeTool));
    document.querySelectorAll('.nav-count').forEach(el => el.textContent = '–');

    document.getElementById('toolPanel').innerHTML = `<div class="loading-inline"><div class="spinner"></div>Loading job data…</div>`;
    window.scrollTo({ top: 0, behavior: 'smooth' });

    await loadJobData(job.job_number);
    updateCounts();
    renderTool();
  }

  function deselectJob() {
    state.selectedJob = null;
    state.jobCache = null;
    document.getElementById('pageWrapper').classList.remove('has-sidebar');
    document.getElementById('sidebar').style.display = 'none';
    document.getElementById('sidebarToggle').style.display = 'none';
    document.getElementById('searchView').style.display = 'block';
    document.getElementById('detailView').style.display = 'none';
    document.getElementById('headerSubtitle').textContent = 'Search and select a job to view its records';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ── DATA LOAD ─────────────────────────────────────────── */
  async function loadJobData(jobNumber) {
    const [sheetsRes, posRes, filesRes, swmsRes, cablingRes] = await Promise.all([
      sb().from('job_sheets')
        .select('id, job_sheet_number, job_number, sheet_date, tasks, labour, materials, notes, created_by, is_service_report, signing_status, report_generated_at, report_sent_to, client_signature_data, client_signature_name, client_signature_date')
        .eq('job_number', jobNumber)
        .order('sheet_date', { ascending: false }),
      sb().from('purchase_orders')
        .select('id, po_number, po_sequence, po_type, supplier, supplier_branch, status, subtotal, gst, total, required_by, ordered_by_name, verbal_description, created_at')
        .eq('job_number', jobNumber)
        .order('created_at', { ascending: false }),
      sb().from('job_sheet_files')
        .select('id, job_sheet_number, file_name, file_path, file_type, file_size, file_category, tags, description, uploaded_by, uploaded_at')
        .eq('job_number', jobNumber)
        .order('uploaded_at', { ascending: false }),
      sb().from('swms_instances')
        .select('id, swms_number, revision_number, status, title, project_name, swms_date, signer_count, last_signed_at, pdf_path, created_by_name, created_at, template_id, parent_instance_id')
        .eq('job_number', jobNumber)
        .order('created_at', { ascending: false }),
      sb().from('cable_selections')
        .select('id, job_number, circuit_ref, switchboard, description, phase, voltage_v, rating_value, rating_unit, cable_distance_m, max_vd_pct, cable_type, conductor, installation, active_size_mm2, earth_size_mm2, current_rating_a, voltage_drop_v, voltage_drop_pct, created_at')
        .eq('job_number', jobNumber)
        .order('created_at', { ascending: false }),
    ]);

    if (sheetsRes.error) console.error('job_sheets', sheetsRes.error);
    if (posRes.error) console.error('purchase_orders', posRes.error);
    if (filesRes.error) console.error('job_sheet_files', filesRes.error);
    if (swmsRes.error) console.error('swms_instances', swmsRes.error);
    if (cablingRes.error) console.error('cable_selections', cablingRes.error);

    const sheets = sheetsRes.data || [];
    const pos    = posRes.data    || [];
    const files  = filesRes.data  || [];
    const swms   = swmsRes.data   || [];
    const cabling = cablingRes.data || [];

    const labour = [], materials = [], notes = [];
    for (const s of sheets) {
      const sheetDate = s.sheet_date, sheetNum = s.job_sheet_number;
      (Array.isArray(s.labour)    ? s.labour    : []).forEach(l => labour.push({ ...l, _sheet_date: sheetDate, _sheet: sheetNum }));
      (Array.isArray(s.materials) ? s.materials : []).forEach(m => materials.push({ ...m, _sheet_date: sheetDate, _sheet: sheetNum }));
      (Array.isArray(s.notes)     ? s.notes     : []).forEach(n => notes.push({ ...n, _sheet_date: sheetDate, _sheet: sheetNum }));
    }

    const documents = files.filter(f => f.file_category === 'documents');
    const safety    = files.filter(f => f.file_category === 'safety');
    const testing   = files.filter(f => f.file_category === 'testing');
    const photos    = files.filter(f => f.file_category === 'photos');

    state.jobCache = { sheets, pos, files, labour, materials, notes, documents, safety, testing, photos, cabling, swms };
  }

  function updateCounts() {
    if (!state.jobCache) return;
    for (const id of toolOrder) {
      const t = tools[id];
      if (typeof t.count !== 'function') continue;
      const el = document.getElementById('cnt-' + id);
      if (el) el.textContent = t.count(state.jobCache);
    }
  }

  /* ── RENDER ACTIVE TOOL ────────────────────────────────── */
  function renderTool() {
    if (!state.selectedJob || !state.jobCache) return;
    const panel = document.getElementById('toolPanel');
    const tool = tools[state.activeTool];
    if (!tool || typeof tool.render !== 'function') {
      panel.innerHTML = `<div class="empty-state"><div class="empty-state-text">Tool not available</div></div>`;
      return;
    }
    tool.render(panel, state.jobCache, state.selectedJob);
  }

  /* ── FILE GRID (shared by Documents/Safety/Testing) ────── */
  const FILE_ICONS = { pdf:'📄', doc:'📄', docx:'📄', txt:'📄', jpg:'🖼️', jpeg:'🖼️', png:'🖼️', gif:'🖼️', webp:'🖼️', heic:'🖼️', xls:'📊', xlsx:'📊', csv:'📊', dwg:'📐', dxf:'📐', zip:'🗜️', rar:'🗜️' };
  const iconFor = name => FILE_ICONS[(name || '').split('.').pop().toLowerCase()] || '📎';
  const fmtSize = b => !b ? '' : (b < 1024*1024 ? (b/1024).toFixed(0) + ' KB' : (b/1024/1024).toFixed(1) + ' MB');

  function renderFileGrid(panel, title, fallbackIcon, items, category, emptyText) {
    const bucket = BUCKETS[category];
    panel.innerHTML = `
      <div class="tool-card">
        <div class="tool-card-header">
          <div class="tool-card-title">${esc(title)}</div>
          <div class="tool-card-actions"><button class="btn-add" data-label="Upload">+ Upload</button></div>
        </div>
        ${items.length ? `<div class="doc-grid">${items.map(f => `<div class="doc-tile" data-file-path="${esc(f.file_path)}" data-bucket="${esc(bucket)}"><div class="doc-icon">${iconFor(f.file_name)}</div><div class="doc-name">${esc(f.file_name)}</div><div class="doc-meta">${esc((f.file_type || '').toUpperCase())}${f.file_size ? ' · ' + fmtSize(f.file_size) : ''} · ${fmtDate(f.uploaded_at)}</div>${(f.tags && f.tags.length) ? `<div class="doc-tags">${f.tags.map(t => `<span class="doc-tag">${esc(t)}</span>`).join('')}</div>` : ''}</div>`).join('')}</div>` : `<div class="empty-state"><div class="empty-state-icon">${fallbackIcon}</div><div class="empty-state-text">${esc(emptyText)}</div></div>`}
      </div>`;
    panel.querySelectorAll('[data-file-path]').forEach(tile => {
      tile.addEventListener('click', () => openSignedFile(tile.dataset.bucket, tile.dataset.filePath));
    });
    panel.querySelectorAll('.btn-add').forEach(b => b.addEventListener('click', () => window.BromarHub?.showInfo?.('Upload — coming soon')));
  }

  /* ── MOBILE SIDEBAR ────────────────────────────────────── */
  function closeSidebarMobile() {
    document.getElementById('sidebar').classList.remove('show');
    document.getElementById('sidebarOverlay').classList.remove('show');
  }

  /* ── PUBLIC API ────────────────────────────────────────── */
  window.JobManager = {
    // namespace
    BUCKETS, SIGNED_URL_TTL, JOB_PAGE_SIZE,
    state,
    // registry
    registerTool,
    getTools: () => tools,
    getToolOrder: () => toolOrder,
    // helpers
    sb, esc, fmtDate, fmtMoney, statusBadge, jobTypeDisplay,
    ensureCurrentUser, loadBromarLogo, openSignedFile, renderFileGrid,
    // lifecycle
    loadJobs, renderJobList, buildSidebarNav, selectJob, deselectJob,
    loadJobData, updateCounts, renderTool, closeSidebarMobile,
  };
})();
