/* ── TAB: SWMS — V1.00 ─────────────────────────────────
   Job search + SWMS instances (mirrors Job Manager SWMS
   flow but with a job picker at the top).
   ──────────────────────────────────────────────────────── */
(function () {
  const SB = window.SwmsBuilder;
  const SS = window.SwmsShared;
  if (!SS) { console.error('[sb-swms] SwmsShared missing'); return; }

  let jobSearchText = '';
  let jobResultsOpen = false;
  let currentSwmsForSigning = null;

  SB.registerTab('swms', { render });

  function render(panel) {
    const job = SB.state.selectedJob;
    const list = SB.state.swmsInstances;
    const active = list.filter(s => s.status === 'active' || s.status === 'draft');
    const superseded = list.filter(s => s.status === 'superseded' || s.status === 'archived');

    panel.innerHTML = `
      ${renderJobPicker()}

      ${!job ? `
        <div class="empty-state">
          <div class="empty-state-icon">🛡️</div>
          <div class="empty-state-text">Search and select a job above to manage its SWMS.</div>
        </div>
      ` : `
        <div class="tool-card">
          <div class="tool-card-header">
            <div>
              <div class="tool-card-title">SWMS for ${SB.esc(job.job_number)}</div>
              <div style="font-size:0.82rem; color:var(--text-secondary); margin-top:2px;">Workers sign on here. Amend a SWMS to create a new revision.</div>
            </div>
            <div class="tool-card-actions">
              <button class="btn-add" id="sbAttach">+ Attach SWMS</button>
            </div>
          </div>

          ${active.length ? `<div class="sb-list">${active.map(rowHtml).join('')}</div>` : `<div class="empty-state" style="padding:1.5rem 1rem;"><div class="empty-state-icon">🛡️</div><div class="empty-state-text">No SWMS attached to this job yet.</div></div>`}

          ${superseded.length ? `
            <details style="margin-top:1.25rem;">
              <summary style="cursor:pointer; font-size:0.85rem; color:var(--text-secondary); font-weight:600; padding:0.5rem 0;">Show ${superseded.length} superseded / archived</summary>
              <div class="sb-list" style="margin-top:0.75rem; opacity:0.7;">${superseded.map(rowHtml).join('')}</div>
            </details>
          ` : ''}
        </div>
      `}

      <div id="editorMount"></div>
      <div id="swmsDetail"></div>
    `;

    wireJobPicker();

    if (job) {
      panel.querySelector('#sbAttach')?.addEventListener('click', openAttachFlow);
      panel.querySelectorAll('[data-swms-view]').forEach(b => b.addEventListener('click', () => viewSwms(b.dataset.swmsView)));
      panel.querySelectorAll('[data-swms-edit]').forEach(b => b.addEventListener('click', () => SS.openEditor({ swmsId: b.dataset.swmsEdit, mode: 'edit', ctx: SB.sharedCtx('swms') })));
      panel.querySelectorAll('[data-swms-amend]').forEach(b => b.addEventListener('click', () => amendSwms(b.dataset.swmsAmend)));
      panel.querySelectorAll('[data-swms-pdf]').forEach(b => b.addEventListener('click', () => openSwmsPdf(b.dataset.swmsPdf)));
    }
  }

  /* ── JOB PICKER ── */
  function renderJobPicker() {
    const job = SB.state.selectedJob;
    if (job) {
      return `
        <div class="sb-job-picker">
          <div class="sb-job-picker-title">Selected Job</div>
          <div class="sb-selected-job">
            <div class="sb-selected-job-info">
              <div class="sb-selected-job-num">${SB.esc(job.job_number)}</div>
              <div class="sb-selected-job-desc">${SB.esc(job.client_name || '')}${job.site_name ? ' · ' + SB.esc(job.site_name) : ''}</div>
            </div>
            <button class="btn-secondary" id="sbChangeJob">Change Job</button>
          </div>
        </div>`;
    }
    return `
      <div class="sb-job-picker">
        <div class="sb-job-picker-header">
          <div class="sb-job-picker-title">Pick a Job</div>
        </div>
        <div class="sb-job-search">
          <input type="text" id="sbJobInput" placeholder="Search job number, client, or site..." value="${SB.esc(jobSearchText)}"/>
          <div class="sb-job-results" id="sbJobResults"></div>
        </div>
      </div>`;
  }

  function wireJobPicker() {
    const changeBtn = document.getElementById('sbChangeJob');
    if (changeBtn) {
      changeBtn.addEventListener('click', () => {
        SB.state.selectedJob = null;
        SB.state.swmsInstances = [];
        SB.updateCounts();
        SB.renderActiveTab();
      });
      return;
    }
    const input = document.getElementById('sbJobInput');
    if (!input) return;
    input.addEventListener('input', e => {
      jobSearchText = e.target.value;
      renderResults();
    });
    input.addEventListener('focus', renderResults);
    input.addEventListener('blur', () => setTimeout(() => {
      jobResultsOpen = false;
      const r = document.getElementById('sbJobResults');
      if (r) r.classList.remove('show');
    }, 200));
  }

  async function renderResults() {
    const input = document.getElementById('sbJobInput');
    const results = document.getElementById('sbJobResults');
    if (!input || !results) return;
    const q = (jobSearchText || '').trim().toLowerCase();

    // Load jobs on first search
    if (!SB.state.allJobs.length) await SB.loadAllJobs();

    let matches = SB.state.allJobs;
    if (q) {
      matches = matches.filter(j =>
        (j.job_number   || '').toLowerCase().includes(q) ||
        (j.client_name  || '').toLowerCase().includes(q) ||
        (j.site_name    || '').toLowerCase().includes(q) ||
        (j.site_address || '').toLowerCase().includes(q)
      );
    }
    matches = matches.slice(0, 15);

    if (!matches.length) {
      results.innerHTML = `<div class="sb-job-result" style="cursor:default; color:var(--text-secondary);">No matching jobs</div>`;
    } else {
      results.innerHTML = matches.map(j => `
        <div class="sb-job-result" data-job="${SB.esc(j.job_number)}">
          <div class="sb-job-result-num">${SB.esc(j.job_number)}</div>
          <div class="sb-job-result-desc">${SB.esc(j.client_name || '')}${j.site_name ? ' · ' + SB.esc(j.site_name) : ''}${j.status ? ' · ' + SB.esc(j.status) : ''}</div>
        </div>`).join('');
      results.querySelectorAll('[data-job]').forEach(el => {
        el.addEventListener('mousedown', () => selectJob(el.dataset.job));
      });
    }
    results.classList.add('show');
    jobResultsOpen = true;
  }

  async function selectJob(jobNumber) {
    const job = SB.state.allJobs.find(j => j.job_number === jobNumber);
    if (!job) return;
    SB.state.selectedJob = job;
    jobSearchText = '';
    BromarHub.showLoading('Loading SWMS', 'Please wait...');
    await SB.reloadSwms();
    BromarHub.hideLoading();
  }

  /* ── SWMS LIST ROW ── */
  function rowHtml(s) {
    return `
      <div class="sb-list-item">
        <div class="sb-list-info">
          <div class="sb-list-title">${SB.esc(s.swms_number)} · Rev ${s.revision_number} · ${SB.statusBadge(s.status)}</div>
          <div class="sb-list-meta">
            ${SB.esc(s.title || '')}
            ${s.swms_date ? ' · ' + SB.fmtDate(s.swms_date) : ''}
            · ${s.signer_count || 0} signer${s.signer_count === 1 ? '' : 's'}
            ${s.last_signed_at ? ' · last signed ' + SB.fmtDate(s.last_signed_at) : ''}
          </div>
        </div>
        <div class="sb-list-actions">
          <button class="btn-secondary" data-swms-view="${s.id}">View</button>
          ${s.status === 'active' ? `<button class="btn-secondary" data-swms-edit="${s.id}">✎ Edit</button>` : ''}
          ${s.status === 'active' ? `<button class="btn-secondary" data-swms-amend="${s.id}">Amend</button>` : ''}
          <button class="btn-secondary" data-swms-pdf="${s.id}">📄 PDF</button>
        </div>
      </div>`;
  }

  /* ── ATTACH ── */
  async function openAttachFlow() {
    BromarHub.showLoading('Loading templates', 'Please wait...');
    const { data: templates, error } = await SB.sb().from('swms_templates').select('id, name, title, category').eq('is_archived', false).order('name');
    BromarHub.hideLoading();
    if (error) { BromarHub.showInfo('Failed to load templates: ' + error.message); return; }
    if (!templates || !templates.length) {
      BromarHub.showInfo('No SWMS templates available. Create one in the Templates tab first.');
      return;
    }

    const job = SB.state.selectedJob;
    const nextSeq = String(SB.state.swmsInstances.length + 1).padStart(3, '0');
    const suggested = `${job.job_number}-SWMS-${nextSeq}`;

    const mount = document.getElementById('editorMount');
    mount.innerHTML = `
      <div class="tool-card" style="margin-top:1rem;">
        <div class="tool-card-header">
          <div class="tool-card-title">Attach SWMS to ${SB.esc(job.job_number)}</div>
          <button class="btn-secondary" id="sbCancelAttach">Cancel</button>
        </div>
        <div class="field-group">
          <label>Pick a template <span class="required">*</span></label>
          <select id="sbPickTpl">
            <option value="">— Select template —</option>
            ${templates.map(t => `<option value="${t.id}">${SB.esc(t.name)}${t.category ? ' (' + SB.esc(t.category) + ')' : ''}</option>`).join('')}
          </select>
        </div>
        <div class="field-group">
          <label>SWMS number <span class="required">*</span></label>
          <input type="text" id="sbNewSwmsNumber" value="${SB.esc(suggested)}"/>
        </div>
        <div class="field-group">
          <label>SWMS date</label>
          <input type="date" id="sbNewSwmsDate" value="${new Date().toISOString().slice(0,10)}"/>
        </div>
        <div style="display:flex; justify-content:flex-end;">
          <button class="btn-add" id="sbConfirmAttach">Create SWMS</button>
        </div>
      </div>
    `;
    document.getElementById('sbCancelAttach').addEventListener('click', () => { mount.innerHTML = ''; });
    document.getElementById('sbConfirmAttach').addEventListener('click', () => confirmAttach(templates));
  }

  async function confirmAttach(templates) {
    const tplId = document.getElementById('sbPickTpl').value;
    const swmsNumber = document.getElementById('sbNewSwmsNumber').value.trim();
    const swmsDate = document.getElementById('sbNewSwmsDate').value;
    if (!tplId) { BromarHub.showInfo('Pick a template'); return; }
    if (!swmsNumber) { BromarHub.showInfo('SWMS number required'); return; }

    BromarHub.showLoading('Creating SWMS', 'Loading template...');
    const { data: tpl, error: tplErr } = await SB.sb().from('swms_templates').select('*').eq('id', tplId).single();
    if (tplErr) { BromarHub.hideLoading(); BromarHub.showInfo('Template load failed: ' + tplErr.message); return; }

    const u = await SB.ensureCurrentUser();
    const job = SB.state.selectedJob;
    const baseDate = swmsDate ? new Date(swmsDate) : new Date();
    const reviewDate = new Date(baseDate);
    reviewDate.setMonth(reviewDate.getMonth() + 1);
    const reviewDateStr = reviewDate.toISOString().slice(0, 10);

    const payload = {
      job_number: job.job_number,
      swms_number: swmsNumber,
      template_id: tpl.id, template_name: tpl.name,
      revision_number: 1, status: 'active',
      title: tpl.title, activity_description: tpl.activity_description,
      project_name: job.site_name || job.client_name,
      swms_date: swmsDate || null, review_date: reviewDateStr,
      developed_by: tpl.default_developed_by || (u?.name || null),
      reviewed_by: tpl.default_reviewed_by,
      legislation: tpl.legislation,
      plant_required: tpl.plant_required, plant_inspections: tpl.plant_inspections,
      materials_used: tpl.materials_used, msds_required: tpl.msds_required,
      qualifications: tpl.qualifications, training_required: tpl.training_required,
      relevant_procedures: tpl.relevant_procedures,
      ppe_mandatory: tpl.ppe_mandatory, ppe_additional: tpl.ppe_additional,
      hazards_json: tpl.hazards_json,
      client_name: job.client_name,
      site_name: job.site_name,
      site_address: job.site_address,
      site_contact: job.contact_person,
      site_contact_phone: job.contact_phone,
      created_by_name: u?.name || null, created_by_email: u?.email || null
    };

    const { data: created, error: insErr } = await SB.sb().from('swms_instances').insert(payload).select().single();
    if (insErr) { BromarHub.hideLoading(); BromarHub.showInfo('Create failed: ' + insErr.message); return; }

    BromarHub.hideLoading();
    await SB.reloadSwms();
    SS.openEditor({ swmsId: created.id, mode: 'attach', templateId: tpl.id, ctx: SB.sharedCtx('swms') });
  }

  /* ── VIEW / AMEND / PDF ── */
  async function viewSwms(swmsId) {
    const { data, error } = await SB.sb().from('swms_instances').select('*').eq('id', swmsId).single();
    if (error) { BromarHub.showInfo('Load failed: ' + error.message); return; }
    const { data: sigs } = await SB.sb().from('swms_signatures').select('*').eq('swms_instance_id', swmsId).order('captured_at');
    await logAccess(swmsId, 'viewed');

    const hazItems = data.hazards_json || [];
    const detail = document.getElementById('swmsDetail');
    detail.innerHTML = `
      <div class="tool-card" style="margin-top:1rem;">
        <div class="swms-detail-header">
          <div>
            <div class="swms-detail-title">${SB.esc(data.swms_number)} · Rev ${data.revision_number}</div>
            <div class="swms-detail-meta">${SB.esc(data.title)} · ${SB.statusBadge(data.status)}</div>
          </div>
          <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
            <button class="btn-secondary" id="closeDetail">Close</button>
          </div>
        </div>
        <div style="margin-top:1rem; border:1px solid var(--border); border-radius:10px; overflow:hidden;">
          ${[
            ['Project', SB.esc(data.project_name || '—')],
            ['Client', SB.esc(data.client_name || '—')],
            ['Site', SB.esc(data.site_name || '—')],
            ['Address', SB.esc(data.site_address || '—')],
            ['Contact', SB.esc(data.site_contact || '—')],
            ['SWMS Date', SB.fmtDate(data.swms_date) || '—'],
            ['Review Date', SB.fmtDate(data.review_date) || '—'],
            ['Developed by', SB.esc(data.developed_by || '—')]
          ].map(([label, val], i) => `
            <div style="display:flex; ${i ? 'border-top:1px solid var(--border);' : ''}">
              <div style="flex:0 0 100px; padding:0.6rem 0.55rem; background:var(--bg-main); font-size:0.68rem; font-weight:700; text-transform:uppercase; letter-spacing:0.4px; color:var(--text-secondary);">${label}</div>
              <div style="flex:1; min-width:0; padding:0.6rem 0.8rem; font-size:0.9rem; word-break:break-word;">${val}</div>
            </div>`).join('')}
        </div>
        <div style="margin-top:1rem;">
          <div style="font-size:0.78rem; font-weight:700; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:0.5rem;">Signers (${(sigs || []).length})</div>
          ${(sigs && sigs.length) ? sigs.map(s => `
            <div style="display:flex; align-items:center; gap:0.75rem; padding:0.6rem 0; border-top:1px solid var(--border);">
              <div style="flex:0 0 80px;">${s.signature_data ? `<img src="${s.signature_data}" style="max-height:36px; max-width:100%;" alt="sig"/>` : ''}</div>
              <div style="flex:1;">
                <div style="font-weight:600; font-size:0.9rem;">${SB.esc(s.signer_name)}</div>
                <div style="font-size:0.78rem; color:var(--text-secondary);">${SB.esc(s.employer || '')}</div>
              </div>
              <div style="font-size:0.78rem; color:var(--text-secondary); text-align:right;">${SB.fmtDate(s.sign_date)}<br/>${SB.esc(s.sign_time || '')}</div>
            </div>`).join('') : '<div style="font-size:0.85rem; color:var(--text-secondary);">No signatures yet</div>'}
        </div>
        <details style="margin-top:1.5rem;" open>
          <summary style="cursor:pointer; font-size:0.85rem; font-weight:600; padding:0.5rem 0;">Hazards &amp; controls (${hazItems.filter(h => h.type !== 'phase').length} items)</summary>
          <div style="margin-top:0.5rem;">${hazItems.length ? hazItems.map(hazardCardHtml).join('') : '<div style="font-size:0.85rem; color:var(--text-secondary);">No hazards recorded</div>'}</div>
        </details>
      </div>`;
    document.getElementById('closeDetail').addEventListener('click', () => { detail.innerHTML = ''; });
  }

  function hazardCardHtml(h) {
    const e = SB.esc;
    if (h.type === 'phase') {
      return `<div style="background:var(--card-hover); padding:0.45rem 0.85rem; border-radius:8px; margin:0.85rem 0 0.5rem; font-weight:700; font-size:0.78rem; letter-spacing:0.5px; text-transform:uppercase; color:var(--accent);">${e((h.label || '').toUpperCase())}</div>`;
    }
    const ctrlList = (h.controls || '').split('\n').map(x => x.trim()).filter(Boolean);
    return `
      <div style="border:1px solid var(--border); border-left:3px solid var(--accent); border-radius:10px; padding:0.75rem 0.9rem; margin-bottom:0.6rem;">
        <div style="display:flex; align-items:center; gap:0.55rem; margin-bottom:0.35rem;">
          <span style="min-width:26px; height:26px; padding:0 7px; background:var(--accent); color:#fff; border-radius:6px; font-weight:700; font-size:0.78rem; display:inline-flex; align-items:center; justify-content:center;">${e(h.step || '')}</span>
          <span style="font-weight:600; font-size:0.92rem;">${e(h.jobStep || '')}</span>
        </div>
        ${h.hazard ? `<div style="font-size:0.85rem; margin-top:0.3rem;"><strong style="color:var(--text-secondary); font-size:0.72rem; text-transform:uppercase;">Hazards:</strong> ${e(h.hazard)}</div>` : ''}
        ${h.risks ? `<div style="font-size:0.85rem; margin-top:0.3rem;"><strong style="color:var(--text-secondary); font-size:0.72rem; text-transform:uppercase;">Risks:</strong> ${e(h.risks)}</div>` : ''}
        ${h.riskRating ? `<div style="font-size:0.85rem; margin-top:0.3rem;"><strong style="color:var(--text-secondary); font-size:0.72rem; text-transform:uppercase;">Risk Rating:</strong> ${riskTile(h.riskRating)}</div>` : ''}
        ${ctrlList.length ? `<div style="font-size:0.85rem; margin-top:0.3rem;"><strong style="color:var(--text-secondary); font-size:0.72rem; text-transform:uppercase;">Controls:</strong><ul style="margin:0.3rem 0 0; padding-left:1.1rem;">${ctrlList.map(c => `<li>${e(c)}</li>`).join('')}</ul></div>` : ''}
        ${h.residualRisk ? `<div style="font-size:0.85rem; margin-top:0.3rem;"><strong style="color:var(--text-secondary); font-size:0.72rem; text-transform:uppercase;">Residual:</strong> ${riskTile(h.residualRisk)}</div>` : ''}
      </div>`;
  }

  function riskTile(code) {
    const c = (code || '').toUpperCase().trim();
    const lvl = SS.riskLevel(c);
    if (!c) return '';
    if (!lvl) return `<strong>${SB.esc(c)}</strong>`;
    const col = SS.RISK_COLOURS[lvl];
    return `<span style="display:inline-flex; align-items:center; gap:6px; background:${col.bg}; color:${col.fg}; padding:2px 10px; border-radius:6px; font-size:0.78rem; font-weight:700;">${SB.esc(c)} · ${col.label}</span>`;
  }

  async function amendSwms(swmsId) {
    if (!confirm('Create a new revision of this SWMS? The current revision will be marked superseded.')) return;
    BromarHub.showLoading('Creating revision', 'Please wait...');
    const { data: parent, error } = await SB.sb().from('swms_instances').select('*').eq('id', swmsId).single();
    if (error) { BromarHub.hideLoading(); BromarHub.showInfo(error.message); return; }
    const u = await SB.ensureCurrentUser();
    const newRev = parent.revision_number + 1;
    const newSwms = { ...parent };
    delete newSwms.id; delete newSwms.created_at; delete newSwms.updated_at;
    delete newSwms.signer_count; delete newSwms.last_signed_at;
    delete newSwms.pdf_path; delete newSwms.pdf_generated_at; delete newSwms.superseded_by_id;
    newSwms.revision_number = newRev;
    newSwms.parent_instance_id = parent.id;
    newSwms.status = 'active';
    newSwms.created_by_name = u?.name || null;
    newSwms.created_by_email = u?.email || null;

    const { data: created, error: insErr } = await SB.sb().from('swms_instances').insert(newSwms).select().single();
    if (insErr) { BromarHub.hideLoading(); BromarHub.showInfo(insErr.message); return; }
    BromarHub.hideLoading();
    await SB.reloadSwms();
    SS.openEditor({ swmsId: created.id, mode: 'amend', templateId: parent.template_id, ctx: SB.sharedCtx('swms') });
  }

  async function openSwmsPdf(swmsId) {
    await logAccess(swmsId, 'downloaded');
    const { data: full, error } = await SB.sb().from('swms_instances').select('*').eq('id', swmsId).single();
    if (error) { BromarHub.showInfo('Load failed: ' + error.message); return; }
    if (full.pdf_path) {
      try {
        await SB.openSignedFile('swms-completed', full.pdf_path);
        return;
      } catch (_) {}
    }
    BromarHub.showLoading('Generating PDF', 'Please wait...');
    const blob = await SS.generateAndUploadPdf(full, { saveLocal: true, silent: true, ctx: SB.sharedCtx('swms') });
    BromarHub.hideLoading();
    if (!blob) BromarHub.showInfo('Could not generate PDF. Try again in a moment.');
    else await SB.reloadSwms();
  }

  async function logAccess(swmsInstanceId, action) {
    const u = await SB.ensureCurrentUser();
    try {
      await SB.sb().from('swms_access_log').insert({
        swms_instance_id: swmsInstanceId,
        action,
        user_name: u?.name || null,
        user_email: u?.email || null,
        user_agent: navigator.userAgent
      });
    } catch (_) {}
  }
})();
