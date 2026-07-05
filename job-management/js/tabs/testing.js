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
    const sb = window.sb; const results = [];
    for (const t of TEST_TYPES) {
      try {
        const { data, error } = await sb.from(t.table)
          .select('id, created_at, tested_by, status, site_name, switchboard_id, rev_major, rev_minor, parent_id')
          .eq('job_number', jobNumber)
          .order('created_at', { ascending: false });
        if (!error && data) data.forEach(row => results.push({ ...row, _type: t }));
      } catch (_) {}
    }
    results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return results;
  }

  async function fetchFullRecord(table, id) {
    const { data, error } = await window.sb.from(table).select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  }

  if (!JM._testForms) JM._testForms = {};

  function makeConfig(job, goBack, editRecord) {
    return {
      jobNumber: String(JM.state.selectedJob || ''),
      clientName: job?.client_name || '',
      siteName: job?.site_name || '',
      siteAddress: job?.site_address || '',
      employees: window.EMPLOYEES || [],
      currentUser: window.currentUser,
      supabase: window.sb,
      editRecord: editRecord || null,
      onComplete: async () => { await JM.loadJobData(JM.state.selectedJob); JM.updateCounts(); goBack(); },
      onBack: goBack,
    };
  }

  JM._testForms['switchboard_audit'] = function (panel, d, job, goBack, editRecord) {
    if (window.BromarTest?.SwitchboardAudit) {
      window.BromarTest.SwitchboardAudit.renderForm(panel, makeConfig(job, goBack, editRecord));
    } else { BromarHub.showInfo('Switchboard Audit module not loaded'); }
  };

  JM._testForms['construction_wiring'] = function (panel, d, job, goBack, editRecord) {
    if (window.BromarTest?.ConstructionWiring) {
      window.BromarTest.ConstructionWiring.renderForm(panel, makeConfig(job, goBack, editRecord));
    } else { BromarHub.showInfo('Construction Wiring module not loaded'); }
  };

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
        const t = row._type;
        const date = JM.fmtDate(row.created_at);
        const status = row.status || 'completed';
        const rev = (row.rev_major != null && row.rev_minor != null) ? `V${row.rev_major}.${String(row.rev_minor).padStart(2, '0')}` : '';
        const label = row.switchboard_id ? `${JM.esc(t.label)} — ${JM.esc(row.switchboard_id)}` : JM.esc(t.label);
        return `
          <div class="tool-card" style="display:flex;align-items:center;gap:0.75rem;padding:0.875rem 1rem;margin-bottom:0.5rem;border-radius:10px;" data-type="${t.key}" data-id="${row.id}" data-table="${t.table}">
            <span style="font-size:1.25rem;">${t.icon}</span>
            <div style="flex:1;min-width:0;">
              <div style="font-weight:600;font-size:0.9rem;color:var(--text-primary);">${label}${rev ? ' <span style="font-size:0.75rem;color:var(--text-secondary);font-weight:500;font-family:\'JetBrains Mono\',monospace;">' + rev + '</span>' : ''}</div>
              <div style="font-size:0.78rem;color:var(--text-secondary);">${date}${row.site_name ? ' · ' + JM.esc(row.site_name) : ''}${row.tested_by ? ' · ' + JM.esc(row.tested_by) : ''}</div>
            </div>
            ${JM.statusBadge(status)}
            <div style="display:flex;gap:4px;">
              <button class="btn-secondary test-view-btn" data-type="${t.key}" data-id="${row.id}" style="padding:4px 10px;font-size:0.75rem;" title="View PDF">📄</button>
              <button class="btn-secondary test-edit-btn" data-type="${t.key}" data-id="${row.id}" data-table="${t.table}" style="padding:4px 10px;font-size:0.75rem;" title="Edit / New Revision">✏️</button>
            </div>
          </div>`;
      }).join('');

      /* View PDF */
      listEl.querySelectorAll('.test-view-btn').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          const type = TEST_TYPES.find(t => t.key === btn.dataset.type);
          if (type) JM.openSignedFile('testing', `${jobNumber}/${type.folder}/${btn.dataset.id}.pdf`);
        });
      });

      /* Edit — fetch full record, open form in edit mode */
      listEl.querySelectorAll('.test-edit-btn').forEach(btn => {
        btn.addEventListener('click', async e => {
          e.stopPropagation();
          const key = btn.dataset.type;
          const table = btn.dataset.table;
          const id = btn.dataset.id;
          if (!JM._testForms[key]) { BromarHub.showInfo('Module not loaded'); return; }
          try {
            BromarHub.showLoading('Loading audit...');
            const record = await fetchFullRecord(table, id);
            BromarHub.hideLoading();
            JM._testForms[key](panel, d, job, () => JM.renderTool('testing'), record);
          } catch (err) {
            BromarHub.hideLoading();
            BromarHub.showInfo('Could not load record: ' + (err.message || err));
          }
        });
      });
    }
  });
})();
