/* ── TAB: SWMS ── (sign-on, amend/revision) — V2.00
   Full editor + PDF generator extracted to /tools/swms-shared.js.
   This file is now just the Job Manager wrapper: list, sign-on,
   attach-from-template, amend, and the buttons that trigger the
   shared editor / PDF gen.

   Requires: /tools/swms-shared.js loaded BEFORE this file.
   ─────────────────────────────────────────────────────────── */
(function () {
  const JM = window.JobManager;
  const SS = window.SwmsShared;
  if (!SS) { console.error('[jm-swms] window.SwmsShared missing. Load /tools/swms-shared.js before jm-swms.js'); return; }

  let currentSwmsForSigning = null;

  JM.registerTool('swms', {
    label: 'SWMS', icon: '🛡️',
    count: d => d.swms.filter(s => s.status === 'active').length,
    render(panel, d) { renderSwmsTool(panel, d.swms); }
  });

  function jmCtx(extras = {}) {
    return {
      sb: JM.sb(),
      containerId: 'swmsDetail',
      showLoading: (t, s) => BromarHub.showLoading(t, s),
      hideLoading: () => BromarHub.hideLoading(),
      showInfo: t => BromarHub.showInfo(t),
      showSuccess: t => BromarHub.showSuccess(t),
      ensureCurrentUser: () => JM.ensureCurrentUser(),
      statusBadge: s => JM.statusBadge(s),
      onSaved: async () => {
        await JM.loadJobData(JM.state.selectedJob.job_number);
        JM.updateCounts();
        JM.renderTool();
      },
      onCancelled: () => {},
      ...extras
    };
  }

  async function openSwmsPdf(swmsId) {
    await logSwmsAccess(swmsId, 'downloaded');
    const { data: full, error } = await JM.sb().from('swms_instances').select('*').eq('id', swmsId).single();
    if (error) { BromarHub.showInfo('Load failed: ' + error.message); return; }
    if (full.pdf_path) {
      try {
        const ok = await JM.openSignedFile(JM.BUCKETS.swms, full.pdf_path);
        if (ok !== false) return;
      } catch (_) {}
    }
    BromarHub.showLoading('Generating PDF', 'Please wait...');
    const blob = await SS.generateAndUploadPdf(full, { saveLocal: true, silent: true, ctx: jmCtx() });
    BromarHub.hideLoading();
    if (!blob) { BromarHub.showInfo('Could not generate PDF. Try again in a moment.'); return; }
    await JM.loadJobData(JM.state.selectedJob.job_number);
    JM.updateCounts();
    JM.renderTool();
  }

  async function logSwmsAccess(swmsInstanceId, action, extra = {}) {
    const u = await JM.ensureCurrentUser();
    try {
      await JM.sb().from('swms_access_log').insert({
        swms_instance_id: swmsInstanceId,
        action,
        user_name: u?.name || null,
        user_email: u?.email || null,
        user_agent: navigator.userAgent,
        ...extra
      });
    } catch (err) { console.error('access log failed', err); }
  }

  function renderSwmsTool(panel, swms) {
    const active = swms.filter(s => s.status === 'active' || s.status === 'draft');
    const superseded = swms.filter(s => s.status === 'superseded' || s.status === 'archived');

    panel.innerHTML = `
      <div class="tool-card">
        <div class="tool-card-header">
          <div>
            <div class="tool-card-title">SWMS for this Job</div>
            <div style="font-size:0.82rem; color:var(--text-secondary); margin-top:2px;">Workers sign on here. Amend a SWMS to create a new revision.</div>
          </div>
          <div class="tool-card-actions">
            <button class="btn-secondary" id="manageTemplatesBtn">📚 Manage Templates</button>
            <button class="btn-add" id="newSwmsBtn" data-handled="true">+ Attach SWMS</button>
          </div>
        </div>

        ${active.length ? `<div class="swms-list">${active.map(swmsRowHtml).join('')}</div>` : `<div class="empty-state"><div class="empty-state-icon">🛡️</div><div class="empty-state-text">No SWMS attached to this job yet. Click <strong>+ Attach SWMS</strong> to start.</div></div>`}

        ${superseded.length ? `
          <details style="margin-top:1.5rem;">
            <summary style="cursor:pointer; font-size:0.85rem; color:var(--text-secondary); font-weight:600; padding:0.5rem 0;">Show ${superseded.length} superseded / archived</summary>
            <div class="swms-list" style="margin-top:0.75rem; opacity:0.7;">${superseded.map(swmsRowHtml).join('')}</div>
          </details>
        ` : ''}
      </div>

      <div id="swmsDetail"></div>
    `;

    panel.querySelector('#newSwmsBtn').addEventListener('click', openNewSwmsFlow);
    panel.querySelector('#manageTemplatesBtn').addEventListener('click', () => { window.open('../swms-builder/swms-builder.html', '_blank'); });

    panel.querySelectorAll('[data-swms-view]').forEach(b => b.addEventListener('click', () => viewSwms(b.dataset.swmsView)));
    panel.querySelectorAll('[data-swms-edit]').forEach(b => b.addEventListener('click', () => SS.openEditor({ swmsId: b.dataset.swmsEdit, mode: 'edit', ctx: jmCtx() })));
    panel.querySelectorAll('[data-swms-sign]').forEach(b => b.addEventListener('click', () => openSignModal(b.dataset.swmsSign)));
    panel.querySelectorAll('[data-swms-amend]').forEach(b => b.addEventListener('click', () => amendSwms(b.dataset.swmsAmend)));
    panel.querySelectorAll('[data-swms-pdf]').forEach(b => b.addEventListener('click', () => openSwmsPdf(b.dataset.swmsPdf)));
  }

  function swmsRowHtml(s) {
    return `
      <div class="swms-row">
        <div class="swms-info">
          <div class="swms-num">${JM.esc(s.swms_number)} · Rev ${s.revision_number} · ${JM.statusBadge(s.status)}</div>
          <div class="swms-title-text">${JM.esc(s.title || '')}</div>
          <div class="swms-meta">
            ${JM.esc(s.project_name || '')}
            ${s.swms_date ? ' · ' + JM.fmtDate(s.swms_date) : ''}
            · ${s.signer_count || 0} signer${s.signer_count === 1 ? '' : 's'}
            ${s.last_signed_at ? ' · last signed ' + JM.fmtDate(s.last_signed_at) : ''}
          </div>
        </div>
        <div class="swms-actions">
          <button class="btn-secondary" data-swms-view="${s.id}">View</button>
          ${s.status === 'active' ? `<button class="btn-secondary" data-swms-edit="${s.id}">✎ Edit</button>` : ''}
          ${s.status === 'active' ? `<button class="btn-secondary" data-swms-sign="${s.id}">✍ Sign On</button>` : ''}
          ${s.status === 'active' ? `<button class="btn-secondary" data-swms-amend="${s.id}">Amend</button>` : ''}
          <button class="btn-secondary" data-swms-pdf="${s.id}">📄 PDF</button>
        </div>
      </div>`;
  }

  async function openNewSwmsFlow() {
    BromarHub.showLoading('Loading templates', 'Please wait...');
    const { data: templates, error } = await JM.sb().from('swms_templates').select('id, name, title, category').eq('is_archived', false).order('name');
    BromarHub.hideLoading();
    if (error) { BromarHub.showInfo('Failed to load templates: ' + error.message); return; }
    if (!templates || !templates.length) {
      BromarHub.showInfo('No SWMS templates available. Create one in the SWMS Builder first.');
      setTimeout(() => window.open('../swms-builder/swms-builder.html', '_blank'), 600);
      return;
    }

    const detail = document.getElementById('swmsDetail');
    detail.innerHTML = `
      <div class="tool-card" style="margin-top:1rem;">
        <div class="tool-card-header">
          <div class="tool-card-title">Attach SWMS to ${JM.esc(JM.state.selectedJob.job_number)}</div>
          <button class="btn-secondary" id="cancelAttach">Cancel</button>
        </div>
        <div class="field-group">
          <label>Pick a template <span class="required">*</span></label>
          <select id="pickTemplate" style="width:100%;">
            <option value="">— Select template —</option>
            ${templates.map(t => `<option value="${t.id}">${JM.esc(t.name)}${t.category ? ' (' + JM.esc(t.category) + ')' : ''}</option>`).join('')}
          </select>
        </div>
        <div class="field-group">
          <label>SWMS number <span class="required">*</span></label>
          <input type="text" id="newSwmsNumber" placeholder="${JM.esc(JM.state.selectedJob.job_number)}-SWMS-001"/>
          <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:4px;">Suggested: ${JM.esc(JM.state.selectedJob.job_number)}-SWMS-${String(JM.state.jobCache.swms.length + 1).padStart(3, '0')}</div>
        </div>
        <div class="field-group">
          <label>SWMS date</label>
          <input type="date" id="newSwmsDate" value="${new Date().toISOString().slice(0,10)}"/>
        </div>
        <div style="display:flex; justify-content:flex-end;">
          <button class="submit-btn" id="confirmAttach">Create SWMS</button>
        </div>
      </div>
    `;
    document.getElementById('newSwmsNumber').value = `${JM.state.selectedJob.job_number}-SWMS-${String(JM.state.jobCache.swms.length + 1).padStart(3, '0')}`;
    document.getElementById('cancelAttach').addEventListener('click', () => { detail.innerHTML = ''; });
    document.getElementById('confirmAttach').addEventListener('click', () => attachSwmsFromTemplate(templates));
  }

  async function attachSwmsFromTemplate(templates) {
    const tplId = document.getElementById('pickTemplate').value;
    const swmsNumber = document.getElementById('newSwmsNumber').value.trim();
    const swmsDate = document.getElementById('newSwmsDate').value;
    if (!tplId) { BromarHub.showInfo('Pick a template'); return; }
    if (!swmsNumber) { BromarHub.showInfo('SWMS number required'); return; }

    BromarHub.showLoading('Creating SWMS', 'Loading template...');
    const { data: tpl, error: tplErr } = await JM.sb().from('swms_templates').select('*').eq('id', tplId).single();
    if (tplErr) { BromarHub.hideLoading(); BromarHub.showInfo('Template load failed: ' + tplErr.message); return; }

    const u = await JM.ensureCurrentUser();
    const baseDate = swmsDate ? new Date(swmsDate) : new Date();
    const reviewDate = new Date(baseDate);
    reviewDate.setMonth(reviewDate.getMonth() + 1);
    const reviewDateStr = reviewDate.toISOString().slice(0, 10);

    const payload = {
      job_number: JM.state.selectedJob.job_number,
      swms_number: swmsNumber,
      template_id: tpl.id, template_name: tpl.name,
      revision_number: 1, status: 'active',
      title: tpl.title, activity_description: tpl.activity_description,
      project_name: JM.state.selectedJob.site_name || JM.state.selectedJob.client_name,
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
      client_name: JM.state.selectedJob.client_name,
      site_name: JM.state.selectedJob.site_name,
      site_address: JM.state.selectedJob.site_address,
      site_contact: JM.state.selectedJob.contact_person,
      site_contact_phone: JM.state.selectedJob.contact_phone,
      created_by_name: u?.name || null, created_by_email: u?.email || null
    };

    const { data: created, error: insErr } = await JM.sb().from('swms_instances').insert(payload).select().single();
    if (insErr) { BromarHub.hideLoading(); BromarHub.showInfo('Create failed: ' + insErr.message); return; }

    BromarHub.hideLoading();
    await JM.loadJobData(JM.state.selectedJob.job_number);
    JM.updateCounts();
    JM.renderTool();
    SS.openEditor({ swmsId: created.id, mode: 'attach', templateId: tpl.id, ctx: jmCtx() });
  }

  async function viewSwms(swmsId) {
    const { data, error } = await JM.sb().from('swms_instances').select('*').eq('id', swmsId).single();
    if (error) { BromarHub.showInfo('Load failed: ' + error.message); return; }
    const { data: sigs } = await JM.sb().from('swms_signatures').select('*').eq('swms_instance_id', swmsId).order('captured_at');
    await logSwmsAccess(swmsId, 'viewed');

    const hazItems = data.hazards_json || [];
    const detail = document.getElementById('swmsDetail');
    detail.innerHTML = `
      <div class="tool-card" style="margin-top:1rem;">
        <div class="swms-detail-header">
          <div>
            <div class="swms-detail-title">${JM.esc(data.swms_number)} · Rev ${data.revision_number}</div>
            <div class="swms-detail-meta">${JM.esc(data.title)} · ${JM.statusBadge(data.status)}</div>
          </div>
          <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
            <button class="btn-secondary" id="closeDetail">Close</button>
          </div>
        </div>

        <div style="margin-top:1rem; border:1px solid var(--border); border-radius:10px; overflow:hidden;">
          ${[
            ['Project', JM.esc(data.project_name || '—')],
            ['Client', JM.esc(data.client_name || '—')],
            ['Site', JM.esc(data.site_name || '—')],
            ['Site Address', JM.esc(data.site_address || '—')],
            ['Site Contact', JM.esc(data.site_contact || '—') + (data.site_contact_phone ? ' · ' + JM.esc(data.site_contact_phone) : '')],
            ['SWMS Date', JM.fmtDate(data.swms_date) || '—'],
            ['Review Date', JM.fmtDate(data.review_date) || '—'],
            ['Developed by', JM.esc(data.developed_by || '—')]
          ].map(([label, val], i) => `
            <div style="display:flex; ${i ? 'border-top:1px solid var(--border);' : ''}">
              <div style="flex:0 0 84px; padding:0.6rem 0.55rem; background:var(--bg-main); font-size:0.68rem; font-weight:700; text-transform:uppercase; letter-spacing:0.4px; color:var(--text-secondary);">${label}</div>
              <div style="flex:1; min-width:0; padding:0.6rem 0.8rem; font-size:0.9rem; word-break:break-word;">${val}</div>
            </div>`).join('')}
        </div>

        <div style="margin-top:1rem;">
          <div style="font-size:0.78rem; font-weight:700; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:0.5rem;">Signers (${(sigs || []).length})</div>
          ${(sigs && sigs.length) ? `
            <div class="signer-list">
              ${sigs.map(s => `
                <div class="signer-row-card">
                  <div>${s.signature_data ? `<img src="${s.signature_data}" alt="sig"/>` : ''}</div>
                  <div>
                    <div class="signer-row-name">${JM.esc(s.signer_name)}</div>
                    <div class="signer-row-meta">${JM.esc(s.employer || '')}</div>
                  </div>
                  <div class="signer-row-meta" style="text-align:right;">${JM.fmtDate(s.sign_date)}<br/>${JM.esc(s.sign_time || '')}</div>
                  <div></div>
                </div>
              `).join('')}
            </div>
          ` : '<div style="font-size:0.85rem; color:var(--text-secondary); padding:0.5rem 0;">No signatures yet</div>'}
        </div>

        <details style="margin-top:1.5rem;" open>
          <summary style="cursor:pointer; font-size:0.85rem; font-weight:600; padding:0.5rem 0;">Hazards &amp; controls (${hazItems.filter(h => h.type !== 'phase').length} items)</summary>
          <div style="margin-top:0.5rem;">
            ${hazItems.length ? hazItems.map(hazardCardHtml).join('') : '<div style="font-size:0.85rem; color:var(--text-secondary); padding:0.5rem 0;">No hazards recorded</div>'}
          </div>
        </details>

        ${riskMatrixHtml()}
      </div>
    `;
    document.getElementById('closeDetail').addEventListener('click', () => { detail.innerHTML = ''; });
  }

  function riskTile(code) {
    const c = (code || '').toUpperCase().trim();
    const lvl = SS.riskLevel(c);
    if (!c) return '<span style="color:var(--text-secondary);">—</span>';
    if (!lvl) return `<strong>${JM.esc(c)}</strong>`;
    const col = SS.RISK_COLOURS[lvl];
    return `<span style="display:inline-flex; align-items:center; gap:6px; background:${col.bg}; color:${col.fg}; padding:2px 10px; border-radius:6px; font-size:0.8rem; font-weight:700; letter-spacing:0.3px;">${JM.esc(c)} · ${col.label}</span>`;
  }

  function riskMatrixHtml() {
    const RC = SS.RISK_COLOURS;
    const cell = lvl => `<td style="background:${RC[lvl].bg}; color:${RC[lvl].fg}; text-align:center; font-weight:700; font-size:0.72rem; padding:6px 4px; border:1px solid var(--border);">${RC[lvl].label}</td>`;
    const rows = [
      ['Almost Certain','A', ['low','mod','high','high','high']],
      ['Likely',        'B', ['low','mod','high','high','high']],
      ['Moderate',      'C', ['low','mod','mod','high','high']],
      ['Unlikely',      'D', ['low','low','mod','high','high']],
      ['Rare',          'E', ['low','low','low','mod','mod']]
    ];
    const head = `
      <tr>
        <th style="background:var(--bg-main); border:1px solid var(--border); padding:5px;"></th>
        <th style="background:var(--bg-main); border:1px solid var(--border); padding:5px;"></th>
        <th colspan="5" style="background:#7f7f7f; color:#fff; text-align:center; font-size:0.7rem; letter-spacing:0.5px; padding:5px; border:1px solid var(--border);">CONSEQUENCES</th>
      </tr>
      <tr>
        <th style="background:#7f7f7f; color:#fff; font-size:0.62rem; padding:4px; border:1px solid var(--border);">Likelihood</th>
        <th style="background:var(--bg-main); border:1px solid var(--border);"></th>
        <th style="background:#7f7f7f; color:#fff; font-size:0.6rem; padding:4px; border:1px solid var(--border);">Insignificant [5]</th>
        <th style="background:#7f7f7f; color:#fff; font-size:0.6rem; padding:4px; border:1px solid var(--border);">Minor [4]</th>
        <th style="background:#7f7f7f; color:#fff; font-size:0.6rem; padding:4px; border:1px solid var(--border);">Moderate [3]</th>
        <th style="background:#7f7f7f; color:#fff; font-size:0.6rem; padding:4px; border:1px solid var(--border);">Major [2]</th>
        <th style="background:#7f7f7f; color:#fff; font-size:0.6rem; padding:4px; border:1px solid var(--border);">Catastrophic [1]</th>
      </tr>`;
    const body = rows.map(([name, code, cells]) => `
      <tr>
        <td style="font-weight:700; font-size:0.72rem; padding:5px 8px; border:1px solid var(--border); white-space:nowrap;">${name}</td>
        <td style="font-weight:700; text-align:center; font-size:0.72rem; padding:5px; border:1px solid var(--border);">[${code}]</td>
        ${cells.map(cell).join('')}
      </tr>`).join('');
    return `
      <details style="margin-top:1rem;">
        <summary style="cursor:pointer; font-size:0.85rem; font-weight:600; padding:0.5rem 0;">Risk rating matrix &amp; key</summary>
        <div style="overflow-x:auto; margin-top:0.5rem;">
          <table style="border-collapse:collapse; width:100%; min-width:480px;">${head}${body}</table>
        </div>
        <div style="display:flex; gap:1rem; flex-wrap:wrap; margin-top:0.75rem; font-size:0.78rem;">
          <span style="display:inline-flex; align-items:center; gap:6px;"><span style="width:14px; height:14px; border-radius:3px; background:${RC.high.bg};"></span>High — stop, controls mandatory</span>
          <span style="display:inline-flex; align-items:center; gap:6px;"><span style="width:14px; height:14px; border-radius:3px; background:${RC.mod.bg};"></span>Moderate — controls required</span>
          <span style="display:inline-flex; align-items:center; gap:6px;"><span style="width:14px; height:14px; border-radius:3px; background:${RC.low.bg};"></span>Low — monitor</span>
        </div>
      </details>`;
  }

  function hazardCardHtml(h) {
    const e = JM.esc;
    if (h.type === 'phase') {
      return `<div style="background:var(--card-hover); padding:0.45rem 0.85rem; border-radius:8px; margin:0.85rem 0 0.5rem; font-weight:700; font-size:0.78rem; letter-spacing:0.5px; text-transform:uppercase; color:var(--accent);">${e((h.label || '').toUpperCase())}</div>`;
    }
    const ctrlList = (h.controls || '').split('\n').map(x => x.trim()).filter(Boolean);
    const respList = (h.responsibility || '').split('\n').map(x => x.trim()).filter(Boolean);
    const hocList  = (h.hoc || '').split('\n').map(x => x.trim()).filter(Boolean);
    const fieldRow = (label, value) => value ? `
      <div style="display:flex; gap:0.5rem; padding:0.3rem 0; border-top:1px solid var(--border);">
        <div style="flex:0 0 92px; font-size:0.68rem; font-weight:700; text-transform:uppercase; letter-spacing:0.4px; color:var(--text-secondary); padding-top:1px;">${label}</div>
        <div style="flex:1; font-size:0.85rem; min-width:0; word-break:break-word;">${value}</div>
      </div>` : '';

    return `
      <div style="border:1px solid var(--border); border-left:3px solid var(--accent); border-radius:10px; padding:0.75rem 0.9rem; margin-bottom:0.6rem;">
        <div style="display:flex; align-items:center; gap:0.55rem; margin-bottom:0.35rem;">
          <span style="flex:0 0 auto; min-width:26px; height:26px; padding:0 7px; background:var(--accent); color:#fff; border-radius:6px; font-weight:700; font-size:0.78rem; display:inline-flex; align-items:center; justify-content:center;">${e(h.step || '')}</span>
          <span style="font-weight:600; font-size:0.92rem; line-height:1.3;">${e(h.jobStep || '')}</span>
        </div>
        ${fieldRow('Hazards', e(h.hazard || ''))}
        ${fieldRow('Risks', e(h.risks || ''))}
        ${fieldRow('Risk Rating', h.riskRating ? riskTile(h.riskRating) : '')}
        ${fieldRow('Controls', ctrlList.length ? `<ul style="margin:0; padding-left:1.1rem;">${ctrlList.map(c => `<li style="margin-bottom:2px;">${e(c)}</li>`).join('')}</ul>` : '')}
        ${fieldRow('Hierarchy', hocList.map(e).join('<br/>'))}
        ${fieldRow('Residual', h.residualRisk ? riskTile(h.residualRisk) : '')}
        ${fieldRow('Responsibility', respList.map(e).join('<br/>'))}
      </div>`;
  }

  /* ── SIGN ON ───────────────────────────────────────────── */
  let signCtx = null;
  let signDrawing = false;
  let signLast = { x: 0, y: 0 };

  function openSignModal(swmsId) {
    currentSwmsForSigning = swmsId;
    const modal = document.getElementById('signModal');
    modal.classList.add('show');
    JM.ensureCurrentUser().then(u => {
      if (u) document.getElementById('signName').value = u.name || '';
    });
    setTimeout(() => {
      const c = document.getElementById('signCanvas');
      const rect = c.getBoundingClientRect();
      c.width = rect.width * 2;
      c.height = rect.height * 2;
      signCtx = c.getContext('2d');
      signCtx.scale(2, 2);
      signCtx.strokeStyle = '#000';
      signCtx.lineWidth = 1.8;
      signCtx.lineCap = 'round';
      signCtx.clearRect(0, 0, c.width, c.height);
    }, 50);
  }

  function signPos(e, c) {
    const r = c.getBoundingClientRect();
    return { x: (e.touches ? e.touches[0].clientX : e.clientX) - r.left, y: (e.touches ? e.touches[0].clientY : e.clientY) - r.top };
  }

  document.addEventListener('DOMContentLoaded', () => {
    const c = document.getElementById('signCanvas');
    if (!c) return;
    const start = e => { e.preventDefault(); signDrawing = true; signLast = signPos(e, c); };
    const move = e => {
      if (!signDrawing) return; e.preventDefault();
      const p = signPos(e, c);
      signCtx.beginPath(); signCtx.moveTo(signLast.x, signLast.y); signCtx.lineTo(p.x, p.y); signCtx.stroke();
      signLast = p;
    };
    const end = () => { signDrawing = false; };
    c.addEventListener('mousedown', start); c.addEventListener('mousemove', move); c.addEventListener('mouseup', end); c.addEventListener('mouseleave', end);
    c.addEventListener('touchstart', start, { passive: false }); c.addEventListener('touchmove', move, { passive: false }); c.addEventListener('touchend', end);

    document.getElementById('clearSignBtn')?.addEventListener('click', () => {
      const rect = c.getBoundingClientRect();
      signCtx.clearRect(0, 0, rect.width * 2, rect.height * 2);
    });
    document.getElementById('cancelSignBtn')?.addEventListener('click', () => {
      document.getElementById('signModal').classList.remove('show');
      currentSwmsForSigning = null;
    });
    document.getElementById('confirmSignBtn')?.addEventListener('click', confirmSign);
  });

  async function confirmSign() {
    const name = document.getElementById('signName').value.trim();
    const employer = document.getElementById('signEmployer').value.trim();
    if (!name) { BromarHub.showInfo('Name is required'); return; }
    const c = document.getElementById('signCanvas');
    const blank = document.createElement('canvas');
    blank.width = c.width; blank.height = c.height;
    if (c.toDataURL() === blank.toDataURL()) { BromarHub.showInfo('Please draw a signature'); return; }

    BromarHub.showLoading('Saving signature', 'Please wait...');
    const sigData = c.toDataURL('image/png');
    const u = await JM.ensureCurrentUser();
    const now = new Date();
    const { error } = await JM.sb().from('swms_signatures').insert({
      swms_instance_id: currentSwmsForSigning,
      signer_name: name,
      employer: employer || 'Bromar Electrical Services',
      sign_date: now.toISOString().slice(0,10),
      sign_time: now.toTimeString().slice(0,5),
      signature_data: sigData,
      captured_by_name: u?.name || null,
      captured_by_email: u?.email || null
    });
    if (error) { BromarHub.hideLoading(); BromarHub.showInfo('Sign failed: ' + error.message); return; }

    const { data: swms } = await JM.sb().from('swms_instances').select('*').eq('id', currentSwmsForSigning).single();
    if (swms) await SS.generateAndUploadPdf(swms, { snapshot: true, triggerEvent: 'signed', silent: true, ctx: jmCtx() });

    BromarHub.hideLoading();
    BromarHub.showSuccess(`${name} signed`);
    document.getElementById('signModal').classList.remove('show');
    await JM.loadJobData(JM.state.selectedJob.job_number);
    JM.updateCounts();
    JM.renderTool();
    setTimeout(() => viewSwms(currentSwmsForSigning), 100);
  }

  async function amendSwms(swmsId) {
    if (!confirm('Create a new revision of this SWMS? The current revision will be marked superseded.')) return;
    BromarHub.showLoading('Creating revision', 'Please wait...');
    const { data: parent, error } = await JM.sb().from('swms_instances').select('*').eq('id', swmsId).single();
    if (error) { BromarHub.hideLoading(); BromarHub.showInfo(error.message); return; }

    const u = await JM.ensureCurrentUser();
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

    const { data: created, error: insErr } = await JM.sb().from('swms_instances').insert(newSwms).select().single();
    if (insErr) { BromarHub.hideLoading(); BromarHub.showInfo(insErr.message); return; }

    BromarHub.hideLoading();
    await JM.loadJobData(JM.state.selectedJob.job_number);
    JM.updateCounts();
    JM.renderTool();
    SS.openEditor({ swmsId: created.id, mode: 'amend', templateId: parent.template_id, ctx: jmCtx() });
  }
})();
