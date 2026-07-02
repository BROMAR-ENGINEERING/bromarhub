/* ============================================================
   SWMS BUILDER — CORE — V1.01
   Namespace, tab registry, shared helpers, ctx builder for
   SwmsShared. Load order: this → tab files → boot.
   ============================================================ */
(function () {
  const sb = () => window.sb;

  const state = {
    activeTab: 'templates',
    templates: [],
    swmsInstances: [],
    selectedJob: null,
    allJobs: [],
    currentUser: null,
    booted: false
  };

  const tabs = {};
  const tabOrder = [];
  function registerTab(id, def) {
    tabs[id] = { id, ...def };
    if (!tabOrder.includes(id)) tabOrder.push(id);
    // If we've already booted (tabs registered after boot ran), refresh the UI
    if (state.booted && id === state.activeTab) renderActiveTab();
  }

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  const fmtDate = d => d ? new Date(d).toLocaleDateString('en-AU', { year:'numeric', month:'short', day:'numeric' }) : '—';
  const statusBadge = s => `<span class="status-${s || 'active'}">${(s || 'active').replace('_',' ')}</span>`;

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

  async function openSignedFile(bucket, path) {
    if (!bucket || !path) return;
    const { data, error } = await sb().storage.from(bucket).createSignedUrl(path, 3600);
    if (error) { window.BromarHub?.showInfo?.('Could not open file: ' + error.message); return; }
    window.open(data.signedUrl, '_blank', 'noopener');
  }

  function sharedCtx(reloadKind, extras = {}) {
    return {
      sb: sb(),
      containerId: 'editorMount',
      showLoading: (t, s) => BromarHub.showLoading(t, s),
      hideLoading: () => BromarHub.hideLoading(),
      showInfo: t => BromarHub.showInfo(t),
      showSuccess: t => BromarHub.showSuccess(t),
      ensureCurrentUser,
      statusBadge,
      onSaved: async () => {
        if (reloadKind === 'templates') await reloadTemplates();
        else if (reloadKind === 'swms') await reloadSwms();
      },
      onCancelled: () => { renderActiveTab(); },
      ...extras
    };
  }

  function buildTabBar() {
    const bar = document.getElementById('sbTabs');
    if (!bar) return;
    bar.querySelectorAll('.sb-tab').forEach(t => {
      t.addEventListener('click', () => {
        state.activeTab = t.dataset.tab;
        bar.querySelectorAll('.sb-tab').forEach(x => x.classList.toggle('active', x.dataset.tab === state.activeTab));
        renderActiveTab();
      });
    });
  }

  function updateCounts() {
    const t = document.getElementById('cnt-templates');
    const s = document.getElementById('cnt-swms');
    if (t) t.textContent = state.templates.filter(x => !x.is_archived).length;
    if (s) s.textContent = state.swmsInstances.filter(x => x.status === 'active').length;
  }

  function renderActiveTab() {
    const panel = document.getElementById('tabPanel');
    if (!panel) return;
    const tab = tabs[state.activeTab];
    if (!tab || typeof tab.render !== 'function') {
      panel.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⏳</div><div class="empty-state-text">Loading tab...</div></div>`;
      return;
    }
    tab.render(panel);
  }

  async function reloadTemplates() {
    const { data, error } = await sb().from('swms_templates').select('*').order('name');
    if (error) { BromarHub.showInfo('Load failed: ' + error.message); state.templates = []; }
    else state.templates = data || [];
    updateCounts();
    if (state.activeTab === 'templates') renderActiveTab();
  }

  async function loadAllJobs() {
    if (state.allJobs.length) return state.allJobs;
    const { data, error } = await sb().from('job_number_register')
      .select('job_number, prefix, client_name, site_name, site_address, contact_person, contact_phone, status')
      .order('created_at', { ascending: false });
    if (error) { console.error(error); return []; }
    state.allJobs = data || [];
    return state.allJobs;
  }

  async function reloadSwms() {
    if (!state.selectedJob) {
      state.swmsInstances = [];
      updateCounts();
      if (state.activeTab === 'swms') renderActiveTab();
      return;
    }
    const { data, error } = await sb().from('swms_instances')
      .select('id, swms_number, revision_number, status, title, project_name, swms_date, signer_count, last_signed_at, pdf_path, created_by_name, created_at, template_id, template_name')
      .eq('job_number', state.selectedJob.job_number)
      .order('created_at', { ascending: false });
    if (error) { BromarHub.showInfo('Load failed: ' + error.message); state.swmsInstances = []; }
    else state.swmsInstances = data || [];
    updateCounts();
    if (state.activeTab === 'swms') renderActiveTab();
  }

  function markBooted() { state.booted = true; }

  window.SwmsBuilder = {
    state,
    sb, esc, fmtDate, statusBadge,
    registerTab,
    ensureCurrentUser, openSignedFile,
    sharedCtx,
    buildTabBar, renderActiveTab, updateCounts,
    reloadTemplates, reloadSwms, loadAllJobs,
    markBooted,
    getTabs: () => tabs, getTabOrder: () => tabOrder
  };
})();
