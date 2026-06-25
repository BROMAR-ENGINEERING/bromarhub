/* ── TAB: SWMS ── (sign-on, amend/revision, multi-page PDF) — V1.10
   Changes since V1.09:
   - Page 1: Project + Site Details merged into one compact 4-column block
     (was 2 separate 6-row tables). Saves ~80px vertical for Compliance
   - Compliance & Resources cells now render multi-line items as inline
     bullet chips that wrap side-by-side, not stacked top-to-bottom.
     Single-line items still render as plain text.
   - Tighter padding throughout cover page so longer Compliance content
     no longer collides with the footer
   ─────────────────────────────────────────────────────────── */
(function () {
  const JM = window.JobManager;

  // local signing state
  let currentSwmsForSigning = null;

  JM.registerTool('swms', {
    label: 'SWMS', icon: '🛡️',
    count: d => d.swms.filter(s => s.status === 'active').length,
    render(panel, d) { renderSwmsTool(panel, d.swms); }
  });

/* Open the live PDF: try the stored path, but if the object is missing
   (stale pdf_path / failed earlier upload), regenerate + re-upload + open. */
async function openSwmsPdf(swmsId) {
  await logSwmsAccess(swmsId, 'downloaded');

  const { data: full, error } = await JM.sb().from('swms_instances').select('*').eq('id', swmsId).single();
  if (error) { BromarHub.showInfo('Load failed: ' + error.message); return; }

  // 1) Try the stored path first.
  if (full.pdf_path) {
    try {
      const ok = await JM.openSignedFile(JM.BUCKETS.swms, full.pdf_path);
      if (ok !== false) return; // opened successfully
    } catch (_) { /* fall through to regenerate */ }
  }

  // 2) No path, or the object was missing — regenerate fresh and open.
  BromarHub.showLoading('Generating PDF', 'Please wait...');
  const blob = await generateAndUploadPdf(full, { saveLocal: true, silent: true });
  BromarHub.hideLoading();
  if (!blob) { BromarHub.showInfo('Could not generate PDF. Try again in a moment.'); return; }

  await JM.loadJobData(JM.state.selectedJob.job_number); JM.updateCounts();
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
  panel.querySelectorAll('[data-swms-edit]').forEach(b => b.addEventListener('click', () => openSwmsEditor(b.dataset.swmsEdit, { mode: 'edit' })));
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

  // Auto-set review date to 1 month after SWMS date
  const baseDate = swmsDate ? new Date(swmsDate) : new Date();
  const reviewDate = new Date(baseDate);
  reviewDate.setMonth(reviewDate.getMonth() + 1);
  const reviewDateStr = reviewDate.toISOString().slice(0, 10);

  const payload = {
    job_number: JM.state.selectedJob.job_number,
    swms_number: swmsNumber,
    template_id: tpl.id,
    template_name: tpl.name,
    revision_number: 1,
    status: 'active',
    title: tpl.title,
    activity_description: tpl.activity_description,
    project_name: JM.state.selectedJob.site_name || JM.state.selectedJob.client_name,
    swms_date: swmsDate || null,
    review_date: reviewDateStr,
    developed_by: tpl.default_developed_by || (u?.name || null),
    reviewed_by: tpl.default_reviewed_by,
    legislation: tpl.legislation,
    plant_required: tpl.plant_required,
    plant_inspections: tpl.plant_inspections,
    materials_used: tpl.materials_used,
    msds_required: tpl.msds_required,
    qualifications: tpl.qualifications,
    training_required: tpl.training_required,
    relevant_procedures: tpl.relevant_procedures,
    ppe_mandatory: tpl.ppe_mandatory,
    ppe_additional: tpl.ppe_additional,
    hazards_json: tpl.hazards_json,
    client_name: JM.state.selectedJob.client_name,
    site_name: JM.state.selectedJob.site_name,
    site_address: JM.state.selectedJob.site_address,
    site_contact: JM.state.selectedJob.contact_person,
    site_contact_phone: JM.state.selectedJob.contact_phone,
    created_by_name: u?.name || null,
    created_by_email: u?.email || null
  };

  const { data: created, error: insErr } = await JM.sb().from('swms_instances').insert(payload).select().single();
  if (insErr) { BromarHub.hideLoading(); BromarHub.showInfo('Create failed: ' + insErr.message); return; }

  BromarHub.hideLoading();
  await JM.loadJobData(JM.state.selectedJob.job_number);
  JM.updateCounts();
  JM.renderTool();
  // Open the editor so the user can tweak the template before signing starts
  openSwmsEditor(created.id, { mode: 'attach', templateId: tpl.id });
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

/* ── RISK RATING (shared by screen view + PDF) ───────────── */
const RISK_MAP = {
  A1:'high',A2:'high',A3:'high',A4:'mod', A5:'low',
  B1:'high',B2:'high',B3:'high',B4:'mod', B5:'low',
  C1:'high',C2:'high',C3:'mod', C4:'mod', C5:'low',
  D1:'high',D2:'high',D3:'mod', D4:'low', D5:'low',
  E1:'mod', E2:'mod', E3:'low', E4:'low', E5:'low'
};
const RISK_COLOURS = {
  high: { bg: '#e30613', fg: '#ffffff', label: 'High' },
  mod:  { bg: '#ffc000', fg: '#1a1a1e', label: 'Moderate' },
  low:  { bg: '#2e9c4d', fg: '#ffffff', label: 'Low' }
};
function riskLevel(code) { return RISK_MAP[(code || '').toUpperCase().trim()] || null; }

function riskTile(code) {
  const c = (code || '').toUpperCase().trim();
  const lvl = riskLevel(c);
  if (!c) return '<span style="color:var(--text-secondary);">—</span>';
  if (!lvl) return `<strong>${JM.esc(c)}</strong>`;
  const col = RISK_COLOURS[lvl];
  return `<span style="display:inline-flex; align-items:center; gap:6px; background:${col.bg}; color:${col.fg}; padding:2px 10px; border-radius:6px; font-size:0.8rem; font-weight:700; letter-spacing:0.3px;">${JM.esc(c)} · ${col.label}</span>`;
}

function riskMatrixHtml() {
  const cell = lvl => {
    const col = RISK_COLOURS[lvl];
    return `<td style="background:${col.bg}; color:${col.fg}; text-align:center; font-weight:700; font-size:0.72rem; padding:6px 4px; border:1px solid var(--border);">${col.label}</td>`;
  };
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
        <span style="display:inline-flex; align-items:center; gap:6px;"><span style="width:14px; height:14px; border-radius:3px; background:${RISK_COLOURS.high.bg};"></span>High — stop, controls mandatory</span>
        <span style="display:inline-flex; align-items:center; gap:6px;"><span style="width:14px; height:14px; border-radius:3px; background:${RISK_COLOURS.mod.bg};"></span>Moderate — controls required</span>
        <span style="display:inline-flex; align-items:center; gap:6px;"><span style="width:14px; height:14px; border-radius:3px; background:${RISK_COLOURS.low.bg};"></span>Low — monitor</span>
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
  if (swms) await generateAndUploadPdf(swms, { snapshot: true, triggerEvent: 'signed', silent: true });

  BromarHub.hideLoading();
  BromarHub.showSuccess(`${name} signed`);
  document.getElementById('signModal').classList.remove('show');
  await JM.loadJobData(JM.state.selectedJob.job_number); JM.updateCounts();
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
  delete newSwms.id;
  delete newSwms.created_at;
  delete newSwms.updated_at;
  delete newSwms.signer_count;
  delete newSwms.last_signed_at;
  delete newSwms.pdf_path;
  delete newSwms.pdf_generated_at;
  delete newSwms.superseded_by_id;
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
  // Open the editor — Save will generate the PDF and record the audit snapshot
  openSwmsEditor(created.id, { mode: 'amend', templateId: parent.template_id });
}

/* ── EDITOR ──────────────────────────────────────────────
   Full edit of an existing swms_instance: metadata, hazards, phases.
   Opens automatically after Attach and Amend, and from the Edit button.
   Save writes back to the row + regenerates the PDF.
   ──────────────────────────────────────────────────────── */

// Working copy held in module state so all helpers can read/write
let editorState = null;

const RATING_CODES = ['A1','A2','A3','A4','A5','B1','B2','B3','B4','B5','C1','C2','C3','C4','C5','D1','D2','D3','D4','D5','E1','E2','E3','E4','E5'];

async function openSwmsEditor(swmsId, opts = {}) {
  const { mode = 'edit', templateId = null } = opts;

  BromarHub.showLoading('Loading SWMS', 'Please wait...');
  const { data, error } = await JM.sb().from('swms_instances').select('*').eq('id', swmsId).single();
  BromarHub.hideLoading();
  if (error) { BromarHub.showInfo('Load failed: ' + error.message); return; }

  // Build working copy. hazards_json items keep their shape; we only mutate locally.
  editorState = {
    swmsId,
    mode,
    templateId: templateId || data.template_id || null,
    data: { ...data },
    hazards: Array.isArray(data.hazards_json) ? JSON.parse(JSON.stringify(data.hazards_json)) : [],
    canOverwriteTemplate: false
  };

  // Decide if user can overwrite the source template (only if email matches creator)
  if (editorState.templateId) {
    try {
      const u = await JM.ensureCurrentUser();
      const { data: tpl } = await JM.sb().from('swms_templates').select('id, name, created_by_email').eq('id', editorState.templateId).single();
      editorState.templateName = tpl?.name || null;
      editorState.canOverwriteTemplate = !!(u?.email && tpl?.created_by_email && u.email.toLowerCase() === tpl.created_by_email.toLowerCase());
    } catch (_) {}
  }

  renderEditor();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderEditor() {
  const detail = document.getElementById('swmsDetail');
  if (!detail || !editorState) return;
  const s = editorState.data;
  const e = JM.esc;
  const modeLabel = ({ attach: 'Edit before sign-on', amend: 'Edit revision', edit: 'Edit SWMS' })[editorState.mode] || 'Edit SWMS';

  const ratingSelect = (field, current) => {
    const cur = (current || '').toUpperCase();
    const opts = ['', ...RATING_CODES].map(c => `<option value="${c}"${c === cur ? ' selected' : ''}>${c || '—'}</option>`).join('');
    return `<select class="ed-input" data-field="${field}">${opts}</select>`;
  };

  // ── Hazard list ──
  let hazList = '';
  editorState.hazards.forEach((h, idx) => {
    if (h.type === 'phase') {
      hazList += `
        <div class="ed-phase" data-idx="${idx}">
          <div class="ed-phase-bar">
            <span class="ed-phase-tag">PHASE</span>
            <input type="text" class="ed-phase-input" data-field="label" placeholder="Phase label..." value="${e(h.label || '')}"/>
            <div class="ed-row-actions">
              <button class="ed-mini" data-action="up" title="Move up">▲</button>
              <button class="ed-mini" data-action="down" title="Move down">▼</button>
              <button class="ed-mini ed-del" data-action="delete" title="Delete">✕</button>
            </div>
          </div>
        </div>`;
    } else {
      hazList += `
        <div class="ed-haz" data-idx="${idx}">
          <div class="ed-haz-head">
            <div class="ed-haz-num">
              <span class="ed-haz-num-label">Step</span>
              <input type="text" class="ed-input ed-step" data-field="step" value="${e(h.step || '')}"/>
            </div>
            <div class="ed-row-actions">
              <button class="ed-mini" data-action="up" title="Move up">▲</button>
              <button class="ed-mini" data-action="down" title="Move down">▼</button>
              <button class="ed-mini ed-del" data-action="delete" title="Delete">✕</button>
            </div>
          </div>
          <div class="ed-haz-body">
            <div class="ed-fld">
              <label>Job Step</label>
              <input type="text" class="ed-input" data-field="jobStep" value="${e(h.jobStep || '')}"/>
            </div>
            <div class="ed-fld">
              <label>Hazards</label>
              <textarea class="ed-input" data-field="hazard" rows="2">${e(h.hazard || '')}</textarea>
            </div>
            <div class="ed-fld">
              <label>Risks</label>
              <textarea class="ed-input" data-field="risks" rows="2">${e(h.risks || '')}</textarea>
            </div>
            <div class="ed-fld-grid">
              <div class="ed-fld">
                <label>Risk Rating</label>
                ${ratingSelect('riskRating', h.riskRating)}
              </div>
              <div class="ed-fld">
                <label>Residual Risk</label>
                ${ratingSelect('residualRisk', h.residualRisk)}
              </div>
            </div>
            <div class="ed-fld">
              <label>Controls <span style="font-weight:400;color:var(--text-secondary);font-size:0.7rem;">(one per line)</span></label>
              <textarea class="ed-input" data-field="controls" rows="4">${e(h.controls || '')}</textarea>
            </div>
            <div class="ed-fld-grid">
              <div class="ed-fld">
                <label>Hierarchy of Control</label>
                <textarea class="ed-input" data-field="hoc" rows="2">${e(h.hoc || '')}</textarea>
              </div>
              <div class="ed-fld">
                <label>Responsibility</label>
                <textarea class="ed-input" data-field="responsibility" rows="2">${e(h.responsibility || '')}</textarea>
              </div>
            </div>
          </div>
        </div>`;
    }
  });

  if (!hazList) {
    hazList = `<div style="text-align:center;padding:1.5rem;color:var(--text-secondary);font-size:0.85rem;">No hazards yet. Add your first one below.</div>`;
  }

  detail.innerHTML = `
    <style>
      .ed-card { margin-top: 1rem; }
      .ed-section { margin-top: 1.25rem; }
      .ed-section-title { font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.5rem; }
      .ed-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
      @media (max-width: 720px) { .ed-grid { grid-template-columns: 1fr; } }
      .ed-fld { display: flex; flex-direction: column; gap: 0.25rem; }
      .ed-fld label { font-size: 0.72rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.3px; }
      .ed-input { width: 100%; padding: 0.5rem 0.65rem; border: 1px solid var(--border); border-radius: 6px; font-size: 0.85rem; background: var(--bg-main); color: var(--text-primary); font-family: inherit; resize: vertical; }
      .ed-input:focus { outline: 2px solid var(--accent); outline-offset: -1px; }
      .ed-fld-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
      .ed-haz { border: 1px solid var(--border); border-left: 3px solid var(--accent); border-radius: 10px; padding: 0.75rem 0.9rem; margin-bottom: 0.85rem; background: var(--bg-main); }
      .ed-haz-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.6rem; gap: 0.5rem; }
      .ed-haz-num { display: flex; align-items: center; gap: 0.4rem; }
      .ed-haz-num-label { font-size: 0.7rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; }
      .ed-step { width: 70px !important; text-align: center; font-weight: 700; }
      .ed-haz-body { display: flex; flex-direction: column; gap: 0.6rem; }
      .ed-phase { background: var(--card-hover); border: 1px solid var(--border); border-radius: 10px; padding: 0.6rem 0.8rem; margin-bottom: 0.85rem; }
      .ed-phase-bar { display: flex; align-items: center; gap: 0.5rem; }
      .ed-phase-tag { background: var(--accent); color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.65rem; font-weight: 700; letter-spacing: 0.5px; flex-shrink: 0; }
      .ed-phase-input { flex: 1; padding: 0.4rem 0.6rem; border: 1px solid var(--border); border-radius: 6px; font-size: 0.9rem; font-weight: 600; background: var(--bg-main); color: var(--text-primary); }
      .ed-row-actions { display: flex; gap: 0.3rem; }
      .ed-mini { width: 28px; height: 28px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-main); cursor: pointer; font-size: 0.75rem; color: var(--text-primary); display: inline-flex; align-items: center; justify-content: center; }
      .ed-mini:hover { background: var(--card-hover); border-color: var(--accent); }
      .ed-del { color: var(--error); }
      .ed-del:hover { background: rgba(220, 38, 38, 0.1); border-color: var(--error); }
      .ed-add-row { display: flex; gap: 0.5rem; justify-content: center; padding: 0.75rem 0; flex-wrap: wrap; }
      .ed-add-btn { padding: 0.5rem 1rem; border: 1px dashed var(--border); border-radius: 8px; background: transparent; color: var(--text-secondary); cursor: pointer; font-size: 0.85rem; font-weight: 600; }
      .ed-add-btn:hover { border-color: var(--accent); color: var(--accent); background: var(--card-hover); }
      .ed-footer { position: sticky; bottom: 0; background: var(--bg-secondary); border-top: 1px solid var(--border); padding: 0.85rem 1rem; margin: 1.5rem -1rem -1rem; display: flex; gap: 0.5rem; justify-content: space-between; flex-wrap: wrap; z-index: 10; }
      .ed-footer-left, .ed-footer-right { display: flex; gap: 0.5rem; flex-wrap: wrap; }
      .ed-banner { background: var(--card-hover); border: 1px solid var(--accent); border-radius: 8px; padding: 0.65rem 0.85rem; font-size: 0.82rem; margin-bottom: 1rem; }
    </style>

    <div class="tool-card ed-card">
      <div class="swms-detail-header">
        <div>
          <div class="swms-detail-title">${e(s.swms_number)} · Rev ${s.revision_number} — ${modeLabel}</div>
          <div class="swms-detail-meta">${e(s.title)} · ${JM.statusBadge(s.status)}</div>
        </div>
        <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
          <button class="btn-secondary" id="edCancel">Cancel</button>
        </div>
      </div>

      ${editorState.mode === 'attach' ? `<div class="ed-banner">📝 <strong>Edit before sign-on.</strong> Tweak the SWMS to match this site's conditions, then click <strong>Save</strong>. Workers can sign on after you save.</div>` : ''}
      ${editorState.mode === 'amend' ? `<div class="ed-banner">📝 <strong>New revision created.</strong> The previous revision is superseded. Edit the hazards and details below, then click <strong>Save</strong>. Workers must re-sign.</div>` : ''}

      <div class="ed-section">
        <div class="ed-section-title">SWMS Details</div>
        <div class="ed-grid">
          <div class="ed-fld"><label>Title</label><input type="text" class="ed-input" id="edf-title" value="${e(s.title || '')}"/></div>
          <div class="ed-fld"><label>Project</label><input type="text" class="ed-input" id="edf-project_name" value="${e(s.project_name || '')}"/></div>
          <div class="ed-fld" style="grid-column:1/-1;"><label>Activity Description</label><textarea class="ed-input" id="edf-activity_description" rows="2">${e(s.activity_description || '')}</textarea></div>
          <div class="ed-fld"><label>SWMS Date</label><input type="date" class="ed-input" id="edf-swms_date" value="${s.swms_date || ''}"/></div>
          <div class="ed-fld"><label>Review Date</label><input type="date" class="ed-input" id="edf-review_date" value="${s.review_date || ''}"/></div>
          <div class="ed-fld"><label>Developed by</label><input type="text" class="ed-input" id="edf-developed_by" value="${e(s.developed_by || '')}"/></div>
          <div class="ed-fld"><label>Approved by</label><input type="text" class="ed-input" id="edf-approved_by" value="${e(s.approved_by || '')}"/></div>
        </div>
      </div>

      <div class="ed-section">
        <div class="ed-section-title">Site Details</div>
        <div class="ed-grid">
          <div class="ed-fld"><label>Client</label><input type="text" class="ed-input" id="edf-client_name" value="${e(s.client_name || '')}"/></div>
          <div class="ed-fld"><label>Site</label><input type="text" class="ed-input" id="edf-site_name" value="${e(s.site_name || '')}"/></div>
          <div class="ed-fld" style="grid-column:1/-1;"><label>Site Address</label><input type="text" class="ed-input" id="edf-site_address" value="${e(s.site_address || '')}"/></div>
          <div class="ed-fld"><label>Site Contact</label><input type="text" class="ed-input" id="edf-site_contact" value="${e(s.site_contact || '')}"/></div>
          <div class="ed-fld"><label>Contact Phone</label><input type="text" class="ed-input" id="edf-site_contact_phone" value="${e(s.site_contact_phone || '')}"/></div>
        </div>
      </div>

      <div class="ed-section">
        <div class="ed-section-title">Compliance &amp; Resources</div>
        <div class="ed-grid">
          <div class="ed-fld"><label>Legislation (one per line)</label><textarea class="ed-input" id="edf-legislation" rows="3">${e(s.legislation || '')}</textarea></div>
          <div class="ed-fld"><label>Qualifications</label><textarea class="ed-input" id="edf-qualifications" rows="3">${e(s.qualifications || '')}</textarea></div>
          <div class="ed-fld"><label>Plant &amp; Equipment Required</label><textarea class="ed-input" id="edf-plant_required" rows="2">${e(s.plant_required || '')}</textarea></div>
          <div class="ed-fld"><label>Plant Inspections</label><textarea class="ed-input" id="edf-plant_inspections" rows="2">${e(s.plant_inspections || '')}</textarea></div>
          <div class="ed-fld"><label>Materials Used</label><textarea class="ed-input" id="edf-materials_used" rows="2">${e(s.materials_used || '')}</textarea></div>
          <div class="ed-fld"><label>MSDS Required</label><textarea class="ed-input" id="edf-msds_required" rows="2">${e(s.msds_required || '')}</textarea></div>
          <div class="ed-fld"><label>Training Required</label><textarea class="ed-input" id="edf-training_required" rows="2">${e(s.training_required || '')}</textarea></div>
          <div class="ed-fld"><label>Relevant Procedures</label><textarea class="ed-input" id="edf-relevant_procedures" rows="2">${e(s.relevant_procedures || '')}</textarea></div>
        </div>
      </div>

      <div class="ed-section">
        <div class="ed-section-title">PPE</div>
        <div class="ed-grid">
          <div class="ed-fld"><label>Mandatory PPE (one per line)</label><textarea class="ed-input" id="edf-ppe_mandatory" rows="5">${e(s.ppe_mandatory || '')}</textarea></div>
          <div class="ed-fld"><label>Additional PPE (one per line)</label><textarea class="ed-input" id="edf-ppe_additional" rows="5">${e(s.ppe_additional || '')}</textarea></div>
        </div>
      </div>

      <div class="ed-section">
        <div class="ed-section-title">Hazards &amp; Controls (${editorState.hazards.filter(h => h.type !== 'phase').length} steps)</div>
        <div id="edHazList">${hazList}</div>
        <div class="ed-add-row">
          <button class="ed-add-btn" id="edAddRow">+ Add Hazard Row</button>
          <button class="ed-add-btn" id="edAddPhase">+ Add Phase Divider</button>
        </div>
      </div>

      <div class="ed-footer">
        <div class="ed-footer-left">
          <button class="btn-secondary" id="edSaveAsNew">💾 Save as New Template</button>
          ${editorState.canOverwriteTemplate ? `<button class="btn-secondary" id="edOverwrite">↺ Overwrite "${e(editorState.templateName || '')}"</button>` : ''}
        </div>
        <div class="ed-footer-right">
          <button class="btn-secondary" id="edCancel2">Cancel</button>
          <button class="submit-btn" id="edSave">Save SWMS</button>
        </div>
      </div>
    </div>
  `;

  // Wire row-level actions
  detail.querySelectorAll('#edHazList [data-idx]').forEach(rowEl => {
    const idx = parseInt(rowEl.dataset.idx, 10);
    rowEl.querySelectorAll('[data-action]').forEach(b => {
      b.addEventListener('click', () => handleEditorRowAction(idx, b.dataset.action));
    });
    rowEl.querySelectorAll('[data-field]').forEach(inp => {
      inp.addEventListener('input', () => {
        editorState.hazards[idx][inp.dataset.field] = inp.value;
      });
    });
  });

  document.getElementById('edAddRow').addEventListener('click', () => addEditorRow('haz'));
  document.getElementById('edAddPhase').addEventListener('click', () => addEditorRow('phase'));
  document.getElementById('edCancel').addEventListener('click', closeEditor);
  document.getElementById('edCancel2').addEventListener('click', closeEditor);
  document.getElementById('edSave').addEventListener('click', () => saveEditor());
  document.getElementById('edSaveAsNew').addEventListener('click', saveAsNewTemplate);
  const ow = document.getElementById('edOverwrite');
  if (ow) ow.addEventListener('click', overwriteTemplate);
}

function handleEditorRowAction(idx, action) {
  if (action === 'delete') {
    if (!confirm('Delete this row?')) return;
    editorState.hazards.splice(idx, 1);
  } else if (action === 'up') {
    if (idx === 0) return;
    [editorState.hazards[idx - 1], editorState.hazards[idx]] = [editorState.hazards[idx], editorState.hazards[idx - 1]];
  } else if (action === 'down') {
    if (idx >= editorState.hazards.length - 1) return;
    [editorState.hazards[idx + 1], editorState.hazards[idx]] = [editorState.hazards[idx], editorState.hazards[idx + 1]];
  }
  renderEditor();
}

function addEditorRow(kind) {
  // Read current top-level form values back into state so they aren't lost on re-render
  syncTopFieldsIntoState();
  if (kind === 'phase') {
    editorState.hazards.push({ type: 'phase', label: '' });
  } else {
    // Auto-number next step
    const hazRows = editorState.hazards.filter(h => h.type !== 'phase');
    const nextStep = String(hazRows.length + 1).padStart(2, '0');
    editorState.hazards.push({
      step: nextStep,
      jobStep: '',
      hazard: '',
      risks: '',
      riskRating: '',
      controls: '',
      hoc: '',
      residualRisk: '',
      responsibility: ''
    });
  }
  renderEditor();
}

function syncTopFieldsIntoState() {
  const fields = ['title','project_name','activity_description','swms_date','review_date','developed_by','approved_by','client_name','site_name','site_address','site_contact','site_contact_phone','legislation','qualifications','plant_required','plant_inspections','materials_used','msds_required','training_required','relevant_procedures','ppe_mandatory','ppe_additional'];
  for (const f of fields) {
    const el = document.getElementById('edf-' + f);
    if (el) editorState.data[f] = el.value;
  }
}

function closeEditor() {
  if (confirm('Discard changes and close the editor? Unsaved edits will be lost.')) {
    editorState = null;
    document.getElementById('swmsDetail').innerHTML = '';
  }
}

async function saveEditor() {
  if (!editorState) return;
  syncTopFieldsIntoState();

  BromarHub.showLoading('Saving SWMS', 'Updating and generating PDF...');
  const s = editorState.data;
  const updates = {
    title: s.title,
    project_name: s.project_name,
    activity_description: s.activity_description,
    swms_date: s.swms_date || null,
    review_date: s.review_date || null,
    developed_by: s.developed_by,
    approved_by: s.approved_by,
    client_name: s.client_name,
    site_name: s.site_name,
    site_address: s.site_address,
    site_contact: s.site_contact,
    site_contact_phone: s.site_contact_phone,
    legislation: s.legislation,
    qualifications: s.qualifications,
    plant_required: s.plant_required,
    plant_inspections: s.plant_inspections,
    materials_used: s.materials_used,
    msds_required: s.msds_required,
    training_required: s.training_required,
    relevant_procedures: s.relevant_procedures,
    ppe_mandatory: s.ppe_mandatory,
    ppe_additional: s.ppe_additional,
    hazards_json: editorState.hazards
  };

  const { data: updated, error } = await JM.sb().from('swms_instances').update(updates).eq('id', editorState.swmsId).select().single();
  if (error) { BromarHub.hideLoading(); BromarHub.showInfo('Save failed: ' + error.message); return; }

  // Regenerate PDF. Treat the first save after attach/amend as audit-worthy.
  const triggerEvent = editorState.mode === 'attach' ? 'attached'
                     : editorState.mode === 'amend' ? 'amended'
                     : 'edited';
  const snapshot = editorState.mode !== 'edit'; // edits don't create audit snapshots, attach/amend do
  await generateAndUploadPdf(updated, { snapshot, triggerEvent, silent: true });

  BromarHub.hideLoading();
  BromarHub.showSuccess('SWMS saved');
  editorState = null;
  await JM.loadJobData(JM.state.selectedJob.job_number);
  JM.updateCounts();
  JM.renderTool();
}

async function saveAsNewTemplate() {
  if (!editorState) return;
  syncTopFieldsIntoState();
  const defaultName = (editorState.templateName || editorState.data.title || 'SWMS Template') + ' (copy)';
  const name = prompt('New template name:', defaultName);
  if (!name) return;
  const trimmed = name.trim();
  if (!trimmed) { BromarHub.showInfo('Name required'); return; }

  BromarHub.showLoading('Saving template', 'Please wait...');
  const u = await JM.ensureCurrentUser();
  const s = editorState.data;
  const payload = {
    name: trimmed,
    title: s.title || trimmed,
    activity_description: s.activity_description,
    legislation: s.legislation,
    qualifications: s.qualifications,
    plant_required: s.plant_required,
    plant_inspections: s.plant_inspections,
    materials_used: s.materials_used,
    msds_required: s.msds_required,
    training_required: s.training_required,
    relevant_procedures: s.relevant_procedures,
    ppe_mandatory: s.ppe_mandatory,
    ppe_additional: s.ppe_additional,
    hazards_json: editorState.hazards,
    default_developed_by: s.developed_by,
    default_reviewed_by: s.reviewed_by,
    template_version: 'V1.00',
    created_by_name: u?.name || null,
    created_by_email: u?.email || null
  };
  const { data: created, error } = await JM.sb().from('swms_templates').insert(payload).select().single();
  BromarHub.hideLoading();
  if (error) {
    if (error.code === '23505') {
      BromarHub.showInfo('A template with that name already exists. Pick a different name.');
    } else {
      BromarHub.showInfo('Save failed: ' + error.message);
    }
    return;
  }
  BromarHub.showSuccess(`Template "${trimmed}" saved`);
  // Point future overwrites at the new template
  editorState.templateId = created.id;
  editorState.templateName = created.name;
  editorState.canOverwriteTemplate = true;
  renderEditor();
}

async function overwriteTemplate() {
  if (!editorState || !editorState.templateId) return;
  if (!confirm(`Overwrite template "${editorState.templateName}"? This affects all FUTURE SWMS created from this template. Existing SWMS instances are unaffected.`)) return;
  syncTopFieldsIntoState();

  BromarHub.showLoading('Updating template', 'Please wait...');
  const s = editorState.data;
  // Read current version to increment
  const { data: tpl } = await JM.sb().from('swms_templates').select('template_version').eq('id', editorState.templateId).single();
  const ver = bumpTemplateVersion(tpl?.template_version || 'V1.00');

  const updates = {
    title: s.title || editorState.templateName,
    activity_description: s.activity_description,
    legislation: s.legislation,
    qualifications: s.qualifications,
    plant_required: s.plant_required,
    plant_inspections: s.plant_inspections,
    materials_used: s.materials_used,
    msds_required: s.msds_required,
    training_required: s.training_required,
    relevant_procedures: s.relevant_procedures,
    ppe_mandatory: s.ppe_mandatory,
    ppe_additional: s.ppe_additional,
    hazards_json: editorState.hazards,
    default_developed_by: s.developed_by,
    default_reviewed_by: s.reviewed_by,
    template_version: ver
  };
  const { error } = await JM.sb().from('swms_templates').update(updates).eq('id', editorState.templateId);
  BromarHub.hideLoading();
  if (error) { BromarHub.showInfo('Overwrite failed: ' + error.message); return; }
  BromarHub.showSuccess(`Template updated → ${ver}`);
}

function bumpTemplateVersion(v) {
  // 'V1.07' → 'V1.08'
  const m = (v || '').match(/^V(\d+)\.(\d+)$/i);
  if (!m) return 'V1.01';
  const major = parseInt(m[1], 10);
  const minor = parseInt(m[2], 10) + 1;
  if (minor > 99) return `V${major + 1}.00`;
  return `V${major}.${String(minor).padStart(2, '0')}`;
}

/* ── PDF GENERATION ──────────────────────────────────────
   Render each page individually at exact A4 landscape printable
   size, snapshot with html2canvas, place on its own jsPDF page.
   A4 landscape = 297 × 210mm; 10mm margins = 277 × 190mm printable.
   ───────────────────────────────────────────────────────── */
const PDF_PAGE_W_MM = 277;
const PDF_PAGE_H_MM = 190;
const PDF_PAGE_W_PX = 1047;
const PDF_PAGE_H_PX = 718;

const PDF_STYLES = `
<style>
.pdf-page {
  width: ${PDF_PAGE_W_PX}px;
  height: ${PDF_PAGE_H_PX}px;
  background: white;
  color: #000;
  font-family: Calibri, Arial, sans-serif;
  font-size: 8.5pt;
  line-height: 1.3;
  box-sizing: border-box;
  padding: 0 0 28px 0;          /* 28px reserved at bottom for the footer */
  margin: 0;
  position: relative;
  overflow: hidden;
}
.pdf-page * { box-sizing: border-box; }

/* Full header (page 1 only) */
.pdf-header { display: flex; align-items: stretch; border: 1px solid #999; }
.pdf-header .logo-cell { background: white; padding: 6px 12px; display: flex; align-items: center; justify-content: center; width: 160px; border-right: 1px solid #999; }
.pdf-header .logo-cell img { max-width: 140px; max-height: 48px; display: block; }
.pdf-header .title-band { flex: 1; background: white; color: #1a1a1e; padding: 12px 16px; font-weight: 700; font-size: 12pt; display: flex; align-items: center; letter-spacing: 0.5px; }
.pdf-header .company-cell { background: #f5f5f5; padding: 8px 12px; font-size: 8pt; line-height: 1.4; width: 250px; border-left: 1px solid #999; }
.pdf-hero { background: #e30613; color: white; padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; }
.pdf-hero .h-left .h-eyebrow { font-size: 8pt; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; opacity: 0.85; }
.pdf-hero .h-left .h-title { font-size: 17pt; font-weight: 700; margin-top: 3px; }
.pdf-hero .h-right { display: flex; gap: 22px; }
.pdf-hero .h-stat { text-align: right; }
.pdf-hero .h-stat-label { font-size: 7pt; font-weight: 600; letter-spacing: 1.2px; text-transform: uppercase; opacity: 0.8; }
.pdf-hero .h-stat-value { font-size: 14pt; font-weight: 700; font-family: 'JetBrains Mono', 'Courier New', monospace; margin-top: 2px; }
.pdf-activity { background: #2c2c2c; color: white; padding: 8px 18px; font-weight: 600; font-size: 9pt; letter-spacing: 0.3px; }

/* Compact header (pages 2+) — saves ~100px vertical vs full hero */
.pdf-compact-header { display: flex; align-items: center; gap: 14px; padding: 8px 14px; border-bottom: 2px solid #e30613; background: white; }
.pdf-compact-header .ch-logo { max-height: 32px; max-width: 110px; }
.pdf-compact-header .ch-logo-text { font-weight: 700; font-size: 12pt; color: #e30613; }
.pdf-compact-header .ch-title { flex: 1; min-width: 0; }
.pdf-compact-header .ch-title-main { font-size: 10pt; font-weight: 700; color: #1a1a1e; letter-spacing: 0.2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pdf-compact-header .ch-title-sub { font-size: 7.5pt; color: #666; margin-top: 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pdf-compact-header .ch-stats { display: flex; gap: 14px; font-family: 'JetBrains Mono', 'Courier New', monospace; font-size: 8.5pt; font-weight: 700; color: #1a1a1e; }
.pdf-compact-header .ch-stat span { color: #888; font-weight: 600; font-size: 6.5pt; letter-spacing: 1px; display: block; margin-bottom: 1px; font-family: Calibri, Arial, sans-serif; }

.pdf-section-heading { background: #7f7f7f; color: white; padding: 5px 12px; font-size: 9pt; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; margin-top: 6px; }
.pdf-fields { width: 100%; border-collapse: collapse; table-layout: fixed; }
.pdf-fields td { border: 1px solid #d0d0d0; padding: 5px 9px; font-size: 9pt; vertical-align: middle; }
.pdf-fields td.lbl { background: #f5f5f5; font-weight: 700; color: #333; font-size: 7.5pt; letter-spacing: 0.3px; text-transform: uppercase; }
.pdf-fields td.val { background: white; color: #000; font-size: 9pt; }

.pdf-ref { width: 100%; border-collapse: collapse; table-layout: fixed; }
.pdf-ref th { background: #7f7f7f; color: white; padding: 4px 10px; text-align: left; font-size: 7.5pt; font-weight: 700; letter-spacing: 0.3px; text-transform: uppercase; border: 1px solid #666; }
.pdf-ref td { border: 1px solid #d0d0d0; padding: 5px 10px; font-size: 8.5pt; vertical-align: top; line-height: 1.45; }
/* Inline chip layout for multi-item lists in the compliance area */
.pdf-ref td .chip-flow { display: block; }
.pdf-ref td .chip { display: inline-block; padding: 1px 0; margin-right: 14px; white-space: nowrap; }
.pdf-ref td .chip::before { content: '•'; color: #e30613; font-weight: 700; margin-right: 5px; }
.pdf-ref td .chip-wrap { white-space: normal; }
.pdf-matrix-wrap { display: flex; gap: 24px; margin-top: 6px; padding: 0 8px; }
.pdf-matrix { flex: 1; border-collapse: collapse; table-layout: fixed; }
.pdf-matrix th, .pdf-matrix td { border: 1px solid #999; text-align: center; padding: 7px 6px; font-size: 9.5pt; font-weight: 600; }
.pdf-matrix th { background: #7f7f7f; color: white; }
.pdf-matrix .lh-label { background: #d9d9d9; font-weight: 700; writing-mode: vertical-rl; width: 32px; font-size: 9pt; letter-spacing: 1.5px; }
.pdf-matrix .row-label { background: white; font-weight: 700; text-align: left; padding-left: 12px; font-size: 10pt; }
.pdf-matrix .code { background: white; font-weight: 700; width: 42px; font-size: 10pt; }
.pdf-hoc-panel { width: 280px; background: #f8f8f8; border: 1px solid #d0d0d0; padding: 10px 14px; font-size: 8.5pt; line-height: 1.4; }
.pdf-hoc-panel h3 { font-size: 9.5pt; font-weight: 700; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.6px; color: #2c2c2c; }
.pdf-hoc-panel .hoc-item { display: flex; gap: 8px; padding: 4px 0; border-bottom: 1px solid #e5e5e5; }
.pdf-hoc-panel .hoc-item:last-child { border-bottom: none; }
.pdf-hoc-panel .hoc-num { width: 18px; height: 18px; background: #7f7f7f; color: white; border-radius: 50%; font-weight: 700; font-size: 8pt; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.pdf-hoc-panel .hoc-text strong { display: block; font-size: 9pt; color: #1a1a1e; margin-bottom: 1px; }
.pdf-hoc-panel .hoc-text span { font-size: 8pt; color: #555; }
.risk-low { background: #92d050 !important; color: #000 !important; }
.risk-mod { background: #ffff00 !important; color: #000 !important; }
.risk-high { background: #e30613 !important; color: #fff !important; }
.pdf-ppe { width: 100%; border-collapse: collapse; table-layout: fixed; }
.pdf-ppe th { background: #7f7f7f; color: white; padding: 6px 12px; text-align: left; font-size: 8pt; font-weight: 700; letter-spacing: 0.3px; text-transform: uppercase; border: 1px solid #666; }
.pdf-ppe td { border: 1px solid #d0d0d0; padding: 7px 12px; font-size: 9pt; }

/* Compact PPE — 4-column layout for the combined matrix+PPE page */
.pdf-ppe-compact { width: 100%; border-collapse: collapse; table-layout: fixed; margin-top: 4px; }
.pdf-ppe-compact th { background: #7f7f7f; color: white; padding: 4px 8px; text-align: left; font-size: 7.5pt; font-weight: 700; letter-spacing: 0.3px; text-transform: uppercase; border: 1px solid #666; }
.pdf-ppe-compact td { border: 1px solid #d0d0d0; padding: 4px 8px; font-size: 8pt; vertical-align: middle; }
.pdf-ppe-compact td.lbl { background: #f5f5f5; font-weight: 700; font-size: 6.5pt; text-transform: uppercase; letter-spacing: 0.3px; color: #555; width: 4%; text-align: center; }
.pdf-haz { width: 100%; border-collapse: collapse; table-layout: fixed; }
.pdf-haz col.c1 { width: 4%; } .pdf-haz col.c2 { width: 12%; } .pdf-haz col.c3 { width: 12%; }
.pdf-haz col.c4 { width: 13%; } .pdf-haz col.c5 { width: 5%; } .pdf-haz col.c6 { width: 26%; }
.pdf-haz col.c7 { width: 8%; } .pdf-haz col.c8 { width: 5%; } .pdf-haz col.c9 { width: 15%; }
.pdf-haz th { background: #7f7f7f; color: white; font-size: 7.5pt; padding: 5px 4px; text-align: left; border: 1px solid #666; font-weight: 700; }
.pdf-haz td { border: 1px solid #c0c0c0; padding: 4px 5px; font-size: 7.5pt; vertical-align: top; word-wrap: break-word; }
.pdf-haz .step { background: #f2f2f2; text-align: center; font-weight: 700; }
.pdf-haz .phase td { background: #d9d9d9; font-weight: 700; padding: 5px 8px; font-size: 9pt; letter-spacing: 0.5px; }
.pdf-haz .ctrl-list { margin: 0; padding-left: 14px; }
.pdf-haz .ctrl-list li { margin-bottom: 2px; }
.pdf-haz .rating { text-align: center; font-weight: 700; font-size: 8.5pt; }
.pdf-consent { background: #f5f5f5; border: 1px solid #c0c0c0; padding: 12px 16px; line-height: 1.5; font-size: 9pt; margin-bottom: 12px; }
.pdf-signoff { width: 100%; border-collapse: collapse; table-layout: fixed; }
.pdf-signoff th { background: #7f7f7f; color: white; padding: 6px 10px; text-align: left; font-size: 8pt; font-weight: 700; letter-spacing: 0.3px; text-transform: uppercase; border: 1px solid #666; }
.pdf-signoff td { border: 1px solid #c0c0c0; padding: 8px 10px; height: 38px; font-size: 9pt; vertical-align: middle; }
.pdf-signoff img { max-height: 40px; max-width: 100%; display: block; }

/* Single-line footer, 4px clear of bottom edge */
.pdf-footer { position: absolute; bottom: 4px; left: 0; right: 0; text-align: center; font-size: 7pt; color: #666; padding: 4px 12px 0; border-top: 1px solid #ccc; white-space: nowrap; }
.pdf-footer .warn { font-weight: 700; letter-spacing: 0.5px; }
.pdf-pageno { position: absolute; bottom: 6px; right: 12px; font-size: 7pt; color: #999; font-family: 'JetBrains Mono', monospace; }
</style>
`;

const PDF_FOOTER = `<div class="pdf-footer">Bromar Electrical Services (AUST) Pty Ltd · ABN 45 634 835 939 · REC: 40430 · <span class="warn">THIS DOCUMENT IS 'UNCONTROLLED' WHEN PRINTED</span></div>`;

async function generateAndUploadPdf(swms, opts = {}) {
  // saveLocal     — also trigger a browser download
  // silent        — suppress info/success banners
  // snapshot      — additionally write an immutable, timestamped audit copy
  //                 (use this on signing/amend/attach events, NOT on plain views)
  // triggerEvent  — free-text label for the snapshot row ('signed' | 'amended' | 'attached')
  const { saveLocal = false, silent = false, snapshot = false, triggerEvent = null } = opts;

  const html2canvas = window.html2canvas;
  const jsPDF = window.jspdf?.jsPDF || window.jsPDF || (window.jspdf && window.jspdf.default);

  if (!html2canvas || !jsPDF) {
    console.error('[SWMS PDF] libraries missing', { html2canvas: !!html2canvas, jsPDF: !!jsPDF });
    if (!silent) BromarHub.showInfo('PDF libraries still loading. Wait 2 seconds and try again.');
    return null;
  }

  await JM.loadBromarLogo();

  const { data: sigs, error: sigErr } = await JM.sb().from('swms_signatures').select('*').eq('swms_instance_id', swms.id).order('captured_at');
  if (sigErr) console.error('[SWMS PDF] signature fetch failed', sigErr);

  const pages = buildSwmsPages(swms, sigs || []);

  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:absolute; left:-99999px; top:0; background:white; z-index:-9999;';
  wrap.innerHTML = PDF_STYLES + pages.map(p => `<div class="pdf-page">${p}</div>`).join('');
  document.body.appendChild(wrap);

  await new Promise(r => setTimeout(r, 250));
  if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (_) {} }

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape', compress: true });
  const pageEls = wrap.querySelectorAll('.pdf-page');

  try {
    for (let i = 0; i < pageEls.length; i++) {
      const canvas = await html2canvas(pageEls[i], {
        scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false,
        width: PDF_PAGE_W_PX, height: PDF_PAGE_H_PX,
        windowWidth: PDF_PAGE_W_PX, windowHeight: PDF_PAGE_H_PX
      });
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      if (i > 0) pdf.addPage('a4', 'landscape');
      pdf.addImage(imgData, 'JPEG', 10, 10, PDF_PAGE_W_MM, PDF_PAGE_H_MM, undefined, 'FAST');
    }
  } catch (err) {
    document.body.removeChild(wrap);
    console.error('[SWMS PDF] generation failed', err);
    if (!silent) BromarHub.showInfo('PDF generation failed: ' + (err.message || err));
    return null;
  }

  document.body.removeChild(wrap);

  const blob = pdf.output('blob');
  const filename = `${swms.swms_number}_rev${swms.revision_number}.pdf`;

  if (saveLocal && blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  try {
    // 1) Live copy — stable, overwritable path the PDF button opens.
    const latestPath = `${swms.job_number}/${swms.swms_number}_rev${swms.revision_number}_latest.pdf`;
    const { error: upErr } = await JM.sb().storage.from(JM.BUCKETS.swms).upload(latestPath, blob, { contentType: 'application/pdf', upsert: true });
    if (upErr) {
      console.error('[SWMS PDF] live upload failed', upErr);
      if (!silent) BromarHub.showInfo('PDF generated but upload failed: ' + upErr.message);
      return blob;
    }
    await JM.sb().from('swms_instances').update({ pdf_path: latestPath, pdf_generated_at: new Date().toISOString() }).eq('id', swms.id);

    // 2) Immutable audit snapshot — only on signing/amend/attach events.
    if (snapshot) {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const snapPath = `${swms.job_number}/audit/${swms.swms_number}_rev${swms.revision_number}_${stamp}.pdf`;
      const { error: snapErr } = await JM.sb().storage.from(JM.BUCKETS.swms).upload(snapPath, blob, { contentType: 'application/pdf', upsert: false });
      if (snapErr) {
        console.error('[SWMS PDF] audit snapshot upload failed', snapErr);
      } else {
        try {
          await JM.sb().from('swms_pdf_snapshots').insert({
            swms_instance_id: swms.id,
            job_number: swms.job_number,
            swms_number: swms.swms_number,
            revision_number: swms.revision_number,
            pdf_path: snapPath,
            signer_count: (sigs || []).length,
            trigger_event: triggerEvent
          });
        } catch (logErr) { console.error('[SWMS PDF] snapshot log failed', logErr); }
      }
    }

    if (!silent && !saveLocal) BromarHub.showSuccess('PDF saved to storage');
  } catch (err) {
    console.error('[SWMS PDF] upload error', err);
    if (!silent) BromarHub.showInfo('PDF upload error: ' + (err.message || err));
  }

  return blob;
}

function buildSwmsPages(s, sigs) {
  const lines = t => (t || '').split('\n').map(x => x.trim()).filter(Boolean);
  const e = JM.esc;

  const logoBlock = JM.state.BROMAR_LOGO_DATAURL
    ? `<div class="logo-cell"><img src="${JM.state.BROMAR_LOGO_DATAURL}" alt="Bromar"/></div>`
    : `<div class="logo-cell" style="font-weight:700; font-size:14pt; color:#e30613;">BROMAR</div>`;

  // ── Full header (page 1 only) ──
  const fullHeader = `
    <div class="pdf-header">
      ${logoBlock}
      <div class="title-band">SAFE WORK METHOD STATEMENT</div>
      <div class="company-cell">Bromar Electrical Services (AUST) Pty Ltd<br/>ABN: 45 634 835 939<br/>REC: 40430</div>
    </div>
    <div class="pdf-hero">
      <div class="h-left">
        <div class="h-eyebrow">${e(s.template_name || 'Safe Work Method Statement')}</div>
        <div class="h-title">${e(s.title || '')}</div>
      </div>
      <div class="h-right">
        <div class="h-stat"><div class="h-stat-label">Job</div><div class="h-stat-value">${e(s.job_number || '—')}</div></div>
        <div class="h-stat"><div class="h-stat-label">SWMS</div><div class="h-stat-value">${e(s.swms_number || '—')}</div></div>
        <div class="h-stat"><div class="h-stat-label">Rev</div><div class="h-stat-value">${s.revision_number}</div></div>
      </div>
    </div>
    <div class="pdf-activity">${e(s.activity_description || '')}</div>`;

  // ── Compact header (pages 2+) ──
  const compactLogoBlock = JM.state.BROMAR_LOGO_DATAURL
    ? `<img class="ch-logo" src="${JM.state.BROMAR_LOGO_DATAURL}" alt="Bromar"/>`
    : `<div class="ch-logo-text">BROMAR</div>`;
  const compactHeader = `
    <div class="pdf-compact-header">
      ${compactLogoBlock}
      <div class="ch-title">
        <div class="ch-title-main">SWMS — ${e(s.title || '')}</div>
        <div class="ch-title-sub">${e(s.activity_description || '')}</div>
      </div>
      <div class="ch-stats">
        <div class="ch-stat"><span>JOB</span> ${e(s.job_number || '—')}</div>
        <div class="ch-stat"><span>SWMS</span> ${e(s.swms_number || '—')}</div>
        <div class="ch-stat"><span>REV</span> ${s.revision_number}</div>
      </div>
    </div>`;

  const ppeMandatory = lines(s.ppe_mandatory);
  const ppeAdditional = lines(s.ppe_additional);
  const maxPpe = Math.max(ppeMandatory.length, ppeAdditional.length, 1);
  let ppeRows = '';
  for (let i = 0; i < maxPpe; i++) ppeRows += `<tr><td>${e(ppeMandatory[i] || '')}</td><td>${e(ppeAdditional[i] || '')}</td></tr>`;

  const ratingClass = r => {
    const lvl = riskLevel(r);
    return lvl ? 'risk-' + lvl : '';
  };

  // Helper: render multi-line content as inline chips that wrap naturally,
  // or fall back to plain text for single-line content.
  const chipFlow = txt => {
    const items = lines(txt);
    if (!items.length) return '—';
    if (items.length === 1) return e(items[0]);
    return `<div class="chip-flow chip-wrap">${items.map(i => `<span class="chip">${e(i)}</span>`).join('')}</div>`;
  };

  // ── PAGE 1: Cover with full header + combined Project/Site + Compliance ──
  const page1 = `
    ${fullHeader}
    <div class="pdf-section-heading">Project &amp; Site Details</div>
    <table class="pdf-fields">
      <colgroup><col style="width:13%"/><col style="width:37%"/><col style="width:13%"/><col style="width:37%"/></colgroup>
      <tr>
        <td class="lbl">Project</td><td class="val">${e(s.project_name || '—')}</td>
        <td class="lbl">Client</td><td class="val">${e(s.client_name || '—')}</td>
      </tr>
      <tr>
        <td class="lbl">Site</td><td class="val">${e(s.site_name || '—')}</td>
        <td class="lbl">Site Address</td><td class="val">${e(s.site_address || '—')}</td>
      </tr>
      <tr>
        <td class="lbl">Site Contact</td><td class="val">${e(s.site_contact || '—')}</td>
        <td class="lbl">Developed by</td><td class="val">${e(s.developed_by || '—')}</td>
      </tr>
      <tr>
        <td class="lbl">SWMS Date</td><td class="val">${JM.fmtDate(s.swms_date) || '—'}</td>
        <td class="lbl">Review Date</td><td class="val">${JM.fmtDate(s.review_date) || '—'}</td>
      </tr>
      ${(s.approved_by || s.reviewed_by) ? `
      <tr>
        <td class="lbl">Approved by</td><td class="val">${e(s.approved_by || '—')}</td>
        <td class="lbl">Reviewed by</td><td class="val">${e(s.reviewed_by || '—')}</td>
      </tr>` : ''}
    </table>
    <div class="pdf-section-heading">Compliance &amp; Resources</div>
    <table class="pdf-ref">
      <colgroup><col style="width:50%"/><col style="width:50%"/></colgroup>
      <tr><th>Legislation, Standards &amp; Codes of Practice</th><th>Personnel Qualifications Required</th></tr>
      <tr><td>${chipFlow(s.legislation)}</td><td>${chipFlow(s.qualifications)}</td></tr>
      <tr><th>Plant &amp; Equipment Required</th><th>Plant &amp; Equipment Inspections</th></tr>
      <tr><td>${chipFlow(s.plant_required)}</td><td>${chipFlow(s.plant_inspections)}</td></tr>
      <tr><th>Materials Used</th><th>MSDS Required</th></tr>
      <tr><td>${chipFlow(s.materials_used)}</td><td>${chipFlow(s.msds_required)}</td></tr>
      <tr><th>Specific Training Required</th><th>Relevant Procedures</th></tr>
      <tr><td>${chipFlow(s.training_required)}</td><td>${chipFlow(s.relevant_procedures)}</td></tr>
    </table>
    ${PDF_FOOTER}
    <div class="pdf-pageno">Page 1</div>`;

  // ── PAGE 2: Risk Matrix + Hierarchy of Control + PPE (combined) ──
  // PPE laid out as a 4-column grid below the matrix to fit on one page.
  // Mandatory items appear first, then Additional, flowing left-to-right.
  const allPpe = [
    ...ppeMandatory.map(item => ({ item, type: 'M' })),
    ...ppeAdditional.map(item => ({ item, type: 'A' }))
  ];
  // Distribute into 4 columns top-to-bottom
  const ppeColCount = 4;
  const ppePerCol = Math.ceil(allPpe.length / ppeColCount) || 1;
  const ppeColumns = [];
  for (let c = 0; c < ppeColCount; c++) {
    ppeColumns.push(allPpe.slice(c * ppePerCol, (c + 1) * ppePerCol));
  }
  const maxRows = Math.max(...ppeColumns.map(c => c.length), 1);
  let ppeCompactRows = '';
  for (let r = 0; r < maxRows; r++) {
    let row = '<tr>';
    for (let c = 0; c < ppeColCount; c++) {
      const cell = ppeColumns[c][r];
      if (cell) {
        const badge = cell.type === 'M'
          ? '<span style="background:#e30613;color:#fff;font-weight:700;padding:1px 5px;border-radius:3px;font-size:6.5pt;margin-right:6px;">REQ</span>'
          : '<span style="background:#888;color:#fff;font-weight:700;padding:1px 5px;border-radius:3px;font-size:6.5pt;margin-right:6px;">ADD</span>';
        row += `<td>${badge}${e(cell.item)}</td>`;
      } else {
        row += '<td></td>';
      }
    }
    row += '</tr>';
    ppeCompactRows += row;
  }

  const page2 = `
    ${compactHeader}
    <div class="pdf-section-heading">Figure 1 — Risk Management Matrix &amp; Hierarchy of Control</div>
    <div class="pdf-matrix-wrap">
      <table class="pdf-matrix">
        <tr><td rowspan="7" class="lh-label">LIKELIHOOD</td><th></th><th></th><th colspan="5" style="font-size:11pt;">CONSEQUENCES</th></tr>
        <tr><th></th><th></th><th>Insignificant<br/>[5]</th><th>Minor<br/>[4]</th><th>Moderate<br/>[3]</th><th>Major<br/>[2]</th><th>Catastrophic<br/>[1]</th></tr>
        <tr><td class="row-label">Almost Certain</td><td class="code">[A]</td><td class="risk-low">Low</td><td class="risk-mod">Moderate</td><td class="risk-high">High</td><td class="risk-high">High</td><td class="risk-high">High</td></tr>
        <tr><td class="row-label">Likely</td><td class="code">[B]</td><td class="risk-low">Low</td><td class="risk-mod">Moderate</td><td class="risk-high">High</td><td class="risk-high">High</td><td class="risk-high">High</td></tr>
        <tr><td class="row-label">Moderate</td><td class="code">[C]</td><td class="risk-low">Low</td><td class="risk-mod">Moderate</td><td class="risk-mod">Moderate</td><td class="risk-high">High</td><td class="risk-high">High</td></tr>
        <tr><td class="row-label">Unlikely</td><td class="code">[D]</td><td class="risk-low">Low</td><td class="risk-low">Low</td><td class="risk-mod">Moderate</td><td class="risk-high">High</td><td class="risk-high">High</td></tr>
        <tr><td class="row-label">Rare</td><td class="code">[E]</td><td class="risk-low">Low</td><td class="risk-low">Low</td><td class="risk-low">Low</td><td class="risk-mod">Moderate</td><td class="risk-mod">Moderate</td></tr>
      </table>
      <div class="pdf-hoc-panel">
        <h3>Hierarchy of Control</h3>
        <div class="hoc-item"><div class="hoc-num">1</div><div class="hoc-text"><strong>Elimination</strong><span>Remove the hazard entirely</span></div></div>
        <div class="hoc-item"><div class="hoc-num">2</div><div class="hoc-text"><strong>Substitution</strong><span>Replace with something less hazardous</span></div></div>
        <div class="hoc-item"><div class="hoc-num">3</div><div class="hoc-text"><strong>Isolation</strong><span>Separate workers from the hazard</span></div></div>
        <div class="hoc-item"><div class="hoc-num">4</div><div class="hoc-text"><strong>Engineering</strong><span>Use physical or design controls</span></div></div>
        <div class="hoc-item"><div class="hoc-num">5</div><div class="hoc-text"><strong>Administration</strong><span>Training, procedures, signage</span></div></div>
        <div class="hoc-item"><div class="hoc-num">6</div><div class="hoc-text"><strong>PPE</strong><span>Last line of defence</span></div></div>
      </div>
    </div>
    <div class="pdf-section-heading">Personal Protective Equipment <span style="font-weight:400;text-transform:none;letter-spacing:0;font-size:7.5pt;opacity:0.85;margin-left:8px;">REQ = Mandatory · ADD = Additional</span></div>
    <table class="pdf-ppe-compact">
      <colgroup><col style="width:25%"/><col style="width:25%"/><col style="width:25%"/><col style="width:25%"/></colgroup>
      <tbody>${ppeCompactRows}</tbody>
    </table>
    ${PDF_FOOTER}
    <div class="pdf-pageno">Page 2</div>`;

  // ── PAGES 4+: Hazards — weighted pagination ──
  // Each row's "weight" reflects its content density. Total budget per page = 14.
  //   Base row = 1.4 units, +0.45 per control/HoC/responsibility line beyond 2
  //   Phase divider = 0.6 units
  const PAGE_BUDGET = 14;
  const hazItems = s.hazards_json || [];
  const hazardPages = [];
  let chunk = [];
  let used = 0;
  for (const h of hazItems) {
    let weight;
    if (h.type === 'phase') {
      weight = 0.6;
    } else {
      const ctrlCount = (h.controls || '').split('\n').filter(x => x.trim()).length;
      const hocCount = (h.hoc || '').split('\n').filter(x => x.trim()).length;
      const respCount = (h.responsibility || '').split('\n').filter(x => x.trim()).length;
      const maxLines = Math.max(ctrlCount, hocCount, respCount, 2);
      weight = 1.4 + Math.max(0, maxLines - 2) * 0.45;
    }
    if (used + weight > PAGE_BUDGET && chunk.length) {
      hazardPages.push(chunk);
      chunk = [];
      used = 0;
    }
    chunk.push(h);
    used += weight;
  }
  if (chunk.length) hazardPages.push(chunk);
  if (!hazardPages.length) hazardPages.push([]);

  const hazPagesHtml = hazardPages.map((rows, idx) => {
    let body = '';
    rows.forEach(h => {
      if (h.type === 'phase') {
        body += `<tr class="phase"><td colspan="9">${e((h.label || '').toUpperCase())}</td></tr>`;
      } else {
        const ctrlList = (h.controls || '').split('\n').map(x => x.trim()).filter(Boolean);
        const hocList = (h.hoc || '').split('\n').map(x => x.trim()).filter(Boolean);
        const respList = (h.responsibility || '').split('\n').map(x => x.trim()).filter(Boolean);
        body += `
          <tr>
            <td class="step">${e(h.step || '')}</td>
            <td>${e(h.jobStep || '')}</td>
            <td>${e(h.hazard || '')}</td>
            <td>${e(h.risks || '')}</td>
            <td class="rating ${ratingClass(h.riskRating)}">${e(h.riskRating || '')}</td>
            <td><ul class="ctrl-list">${ctrlList.map(c => `<li>${e(c)}</li>`).join('')}</ul></td>
            <td>${hocList.map(e).join('<br/>')}</td>
            <td class="rating ${ratingClass(h.residualRisk)}">${e(h.residualRisk || '')}</td>
            <td>${respList.map(e).join('<br/>')}</td>
          </tr>`;
      }
    });
    return `
      ${compactHeader}
      <div class="pdf-section-heading">Job Steps, Hazards &amp; Controls${hazardPages.length > 1 ? ` — Continued (${idx + 1} of ${hazardPages.length})` : ''}</div>
      <table class="pdf-haz">
        <colgroup><col class="c1"/><col class="c2"/><col class="c3"/><col class="c4"/><col class="c5"/><col class="c6"/><col class="c7"/><col class="c8"/><col class="c9"/></colgroup>
        <thead><tr><th>Step</th><th>Job Step</th><th>Hazards</th><th>Risks</th><th>Risk<br/>Rating</th><th>Controls</th><th>Hierarchy<br/>of Control</th><th>Residual<br/>Risk</th><th>Responsibility</th></tr></thead>
        <tbody>${body || '<tr><td colspan="9" style="text-align:center;color:#999;padding:20px">No hazards recorded</td></tr>'}</tbody>
      </table>
      ${PDF_FOOTER}
      <div class="pdf-pageno">Page ${3 + idx}</div>`;
  });

  // ── LAST PAGE: Worker sign-on (compact header) ──
  const signoffPageNo = 3 + hazardPages.length;
  let sigBody = '';
  const minSigRows = Math.max(sigs.length, 10);
  for (let i = 0; i < minSigRows; i++) {
    const sig = sigs[i];
    sigBody += `<tr>
      <td><strong>${e(sig?.signer_name || '')}</strong></td>
      <td>${sig?.signature_data ? `<img src="${sig.signature_data}" alt="signature"/>` : ''}</td>
      <td>${JM.fmtDate(sig?.sign_date)}</td>
      <td>${e(sig?.sign_time || '')}</td>
      <td>${e(sig?.employer || '')}</td>
    </tr>`;
  }

  const signoffPage = `
    ${compactHeader}
    <div class="pdf-section-heading">Worker Sign-On</div>
    <div class="pdf-consent">
      We, the undersigned, confirm that we were consulted in the development of this SWMS. If a failure is identified within the SWMS work will stop, the SWMS amended and changes communicated to the workforce. We also clearly understand that the controls must be applied as documented, otherwise work is to cease immediately. We also confirm that we are qualified to carry out the works identified above, a copy to evidence our required qualifications have been provided and where applicable all insurances and work cover policies to undertake this activity are current.
    </div>
    <table class="pdf-signoff">
      <colgroup><col style="width:22%"/><col style="width:30%"/><col style="width:14%"/><col style="width:10%"/><col style="width:24%"/></colgroup>
      <thead><tr><th>Name</th><th>Signature</th><th>Date</th><th>Time</th><th>Employer</th></tr></thead>
      <tbody>${sigBody}</tbody>
    </table>
    ${PDF_FOOTER}
    <div class="pdf-pageno">Page ${signoffPageNo}</div>`;

  return [page1, page2, ...hazPagesHtml, signoffPage];
}
})();
