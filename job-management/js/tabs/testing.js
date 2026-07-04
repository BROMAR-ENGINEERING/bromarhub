/* ── TAB: Testing (Job Manager wrapper) ── */
(function () {
  const JM = window.JobManager;

  const TEST_TYPES = [
    { key: 'switchboard_audit',   label: 'Switchboard Audit',   icon: '🔌', table: 'testing_switchboard_audit',   folder: 'switchboard-audit' },
    { key: 'construction_wiring', label: 'Construction Wiring', icon: '🔧', table: 'testing_construction_wiring', folder: 'construction-wiring' },
    { key: 'circuit_testing',     label: 'Circuit Testing',     icon: '⚡', table: 'testing_circuit',              folder: 'circuit-testing' },
    { key: 'switchboard_itc',     label: 'Switchboard ITC',     icon: '📋', table: 'testing_switchboard_itc',      folder: 'switchboard-itc' },
    { key: 'field_device_itc',    label: 'Field Device ITC',    icon: '📡', table: 'testing_field_device_itc',     folder: 'field-device-itc' },
  ];

  async function loadCompletedTests(jobNumber) {
    const sb = JM.sb(); const results = [];
    for (const t of TEST_TYPES) {
      try {
        const { data, error } = await sb.from(t.table).select('id, created_at, tested_by, status, site_name').eq('job_number', jobNumber).order('created_at', { ascending: false });
        if (!error && data) data.forEach(row => results.push({ ...row, _type: t }));
      } catch (_) {}
    }
    results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return results;
  }

  /* ── Adapter: bridge shared modules into JM._testForms ── */
  if (!JM._testForms) JM._testForms = {};

  function makeConfig(job, goBack) {
    return {
      jobNumber: String(JM.state.selectedJob || ''),
      clientName: job?.client_name || '',
      siteName: job?.site_name || '',
      employees: window.EMPLOYEES || [],
      currentUser: window.currentUser,
      supabase: window.sb,
      onComplete: async () => { await JM.loadJobData(JM.state.selectedJob); JM.updateCounts(); goBack(); },
      onBack: goBack,
    };
  }

  JM._testForms['switchboard_audit'] = function (panel, d, job, goBack) {
    if (window.BromarTest?.SwitchboardAudit) {
      window.BromarTest.SwitchboardAudit.renderForm(panel, makeConfig(job, goBack));
    } else { BromarHub.showInfo('Switchboard Audit module not loaded'); }
  };

  JM._testForms['construction_wiring'] = function (panel, d, job, goBack) {
    if (window.BromarTest?.ConstructionWiring) {
      window.BromarTest.ConstructionWiring.renderForm(panel, makeConfig(job, goBack));
    } else { BromarHub.showInfo('Construction Wiring module not loaded'); }
  };

  /* ── Register testing tab ── */
  JM.registerTool('testing', {
    label: 'Testing', icon: '🧪',
    count: d => d.testing.length,
    async render(panel, d, job) {
      const jobNumber = JM.state.selectedJob;

      panel.innerHTML = `
        <div style="margin-bottom:2rem;">
          <h3 style="font-size:1.1rem;font-weight:700;margin-bottom:1.25rem;display:flex;align-items:center;gap:8px;">🧪 Testing</h3>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:0.75rem;margin-bottom:2rem;">
            ${TEST_TYPES.map(t => `
              <button class="tool-card test-type-btn" data-type="${t.key}" style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:1.25rem 0.75rem;cursor:pointer;border:1px solid var(--border);border-radius:12px;background:var(--bg-secondary);transition:all 0.2s;">
                <span style="font-size:1.75rem;">${t.icon}</span>
                <span style="font-size:0.85rem;font-weight:600;text-align:center;color:var(--text-primary);">${JM.esc(t.label)}</span>
              </button>`).join('')}
          </div>
          <h4 style="font-size:0.95rem;font-weight:700;margin-bottom:0.75rem;color:var(--text-secondary);">Completed Tests</h4>
          <div id="testingCompletedList"><div class="empty-state" style="padding:2rem;text-align:center;color:var(--text-secondary);font-size:0.9rem;">Loading...</div></div>
        </div>`;

      panel.querySelectorAll('.test-type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const key = btn.dataset.type;
          const type = TEST_TYPES.find(t => t.key === key);
          if (!type) return;
          if (JM._testForms[key]) { JM._testForms[key](panel, d, job, () => JM.renderTool('testing')); }
          else { BromarHub.showInfo(`${type.label} form is not built yet`); }
        });
      });

      const completed = await loadCompletedTests(jobNumber);
      const listEl = document.getElementById('testingCompletedList');
      if (!listEl) return;

      if (!completed.length) {
        listEl.innerHTML = `<div class="empty-state" style="padding:2rem;text-align:center;color:var(--text-secondary);font-size:0.9rem;">No test sheets recorded yet</div>`;
        return;
      }

      listEl.innerHTML = completed.map(row => {
        const t = row._type; const date = JM.fmtDate(row.created_at); const status = row.status || 'completed';
        return `<div class="tool-card" style="display:flex;align-items:center;gap:0.75rem;padding:0.875rem 1rem;margin-bottom:0.5rem;cursor:pointer;border-radius:10px;" data-type="${t.key}" data-id="${row.id}">
          <span style="font-size:1.25rem;">${t.icon}</span>
          <div style="flex:1;min-width:0;"><div style="font-weight:600;font-size:0.9rem;color:var(--text-primary);">${JM.esc(t.label)}</div>
          <div style="font-size:0.78rem;color:var(--text-secondary);">${date}${row.site_name ? ' · ' + JM.esc(row.site_name) : ''}${row.tested_by ? ' · ' + JM.esc(row.tested_by) : ''}</div></div>
          ${JM.statusBadge(status)}</div>`;
      }).join('');

      listEl.querySelectorAll('.tool-card').forEach(card => {
        card.addEventListener('click', () => {
          const type = TEST_TYPES.find(t => t.key === card.dataset.type);
          if (type) JM.openSignedFile('testing', `${jobNumber}/${type.folder}/${card.dataset.id}.pdf`);
        });
      });
    }
  });
})();
