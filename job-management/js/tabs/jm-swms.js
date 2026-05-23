/* ── TAB: SWMS ── (sign-on, amend/revision, multi-page PDF) — V1.01 */
(function () {
  const JM = window.JobManager;

  // local signing state
  let currentSwmsForSigning = null;

  JM.registerTool('swms', {
    label: 'SWMS', icon: '🛡️',
    count: d => d.swms.filter(s => s.status === 'active').length,
    render(panel, d) { renderSwmsTool(panel, d.swms); }
  });

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
  panel.querySelectorAll('[data-swms-sign]').forEach(b => b.addEventListener('click', () => openSignModal(b.dataset.swmsSign)));
  panel.querySelectorAll('[data-swms-amend]').forEach(b => b.addEventListener('click', () => amendSwms(b.dataset.swmsAmend)));
  panel.querySelectorAll('[data-swms-pdf]').forEach(b => b.addEventListener('click', async () => {
    const swmsId = b.dataset.swmsPdf;
    const row = JM.state.jobCache.swms.find(s => s.id === swmsId);
    if (!row) return;
    await logSwmsAccess(swmsId, 'downloaded');
    if (row.pdf_path) {
      await JM.openSignedFile(JM.BUCKETS.swms, row.pdf_path);
    } else {
      BromarHub.showLoading('Generating PDF', 'Please wait...');
      const { data: full, error } = await JM.sb().from('swms_instances').select('*').eq('id', swmsId).single();
      if (error) { BromarHub.hideLoading(); BromarHub.showInfo('Load failed: ' + error.message); return; }
      await generateAndUploadPdf(full, { saveLocal: true });
      BromarHub.hideLoading();
      await JM.loadJobData(JM.state.selectedJob.job_number); JM.updateCounts();
      JM.renderTool();
    }
  }));
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

  await generateAndUploadPdf(created);

  BromarHub.hideLoading();
  BromarHub.showSuccess(`SWMS ${swmsNumber} attached to job`);
  await JM.loadJobData(JM.state.selectedJob.job_number); JM.updateCounts();
  JM.updateCounts();
  JM.renderTool();
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

      <div class="data-table-wrapper" style="margin-top:1rem; overflow-x:auto;">
        <table class="data-table">
          <tbody>
            <tr><th style="width:40%;">Project</th><td>${JM.esc(data.project_name || '—')}</td></tr>
            <tr><th>Client</th><td>${JM.esc(data.client_name || '—')}</td></tr>
            <tr><th>Site</th><td>${JM.esc(data.site_name || '—')}</td></tr>
            <tr><th>Site Address</th><td>${JM.esc(data.site_address || '—')}</td></tr>
            <tr><th>Site Contact</th><td>${JM.esc(data.site_contact || '—')}${data.site_contact_phone ? ' · ' + JM.esc(data.site_contact_phone) : ''}</td></tr>
            <tr><th>SWMS Date</th><td>${JM.fmtDate(data.swms_date)}</td></tr>
            <tr><th>Review Date</th><td>${JM.fmtDate(data.review_date)}</td></tr>
            <tr><th>Developed by</th><td>${JM.esc(data.developed_by || '—')}</td></tr>
          </tbody>
        </table>
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
    </div>
  `;

  document.getElementById('closeDetail').addEventListener('click', () => { detail.innerHTML = ''; });
}

/* Stacked, mobile-friendly hazard card (replaces the wide PDF-style table in the on-screen view) */
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
      ${fieldRow('Risk Rating', h.riskRating ? `<strong>${e(h.riskRating)}</strong>` : '')}
      ${fieldRow('Controls', ctrlList.length ? `<ul style="margin:0; padding-left:1.1rem;">${ctrlList.map(c => `<li style="margin-bottom:2px;">${e(c)}</li>`).join('')}</ul>` : '')}
      ${fieldRow('Hierarchy', hocList.map(e).join('<br/>'))}
      ${fieldRow('Residual', h.residualRisk ? `<strong>${e(h.residualRisk)}</strong>` : '')}
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

  document.getElementById('clearSignBtn').addEventListener('click', () => {
    const rect = c.getBoundingClientRect();
    signCtx.clearRect(0, 0, rect.width * 2, rect.height * 2);
  });
  document.getElementById('cancelSignBtn').addEventListener('click', () => {
    document.getElementById('signModal').classList.remove('show');
    currentSwmsForSigning = null;
  });
  document.getElementById('confirmSignBtn').addEventListener('click', confirmSign);
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
  if (swms) await generateAndUploadPdf(swms);

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
  BromarHub.showSuccess(`Revision ${newRev} created. Workers must re-sign.`);
  await JM.loadJobData(JM.state.selectedJob.job_number); JM.updateCounts();
  JM.updateCounts();
  JM.renderTool();
  setTimeout(() => viewSwms(created.id), 100);
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
  padding: 0;
  margin: 0;
  position: relative;
  overflow: hidden;
}
.pdf-page * { box-sizing: border-box; }
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
.pdf-section-heading { background: #7f7f7f; color: white; padding: 6px 12px; font-size: 9pt; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; margin-top: 10px; }
.pdf-fields { width: 100%; border-collapse: collapse; table-layout: fixed; }
.pdf-fields td { border: 1px solid #d0d0d0; padding: 6px 10px; font-size: 9pt; vertical-align: middle; }
.pdf-fields td.lbl { background: #f5f5f5; font-weight: 700; color: #333; font-size: 8pt; letter-spacing: 0.3px; text-transform: uppercase; }
.pdf-fields td.val { background: white; color: #000; font-size: 9.5pt; }
.pdf-ref { width: 100%; border-collapse: collapse; table-layout: fixed; }
.pdf-ref th { background: #7f7f7f; color: white; padding: 5px 10px; text-align: left; font-size: 8pt; font-weight: 700; letter-spacing: 0.3px; text-transform: uppercase; border: 1px solid #666; }
.pdf-ref td { border: 1px solid #d0d0d0; padding: 6px 10px; font-size: 9pt; vertical-align: top; }
.pdf-matrix-wrap { display: flex; gap: 24px; margin-top: 8px; }
.pdf-matrix { flex: 1; border-collapse: collapse; table-layout: fixed; }
.pdf-matrix th, .pdf-matrix td { border: 1px solid #999; text-align: center; padding: 10px 6px; font-size: 10pt; font-weight: 600; }
.pdf-matrix th { background: #7f7f7f; color: white; }
.pdf-matrix .lh-label { background: #d9d9d9; font-weight: 700; writing-mode: vertical-rl; transform: rotate(180deg); width: 32px; font-size: 9pt; letter-spacing: 1.5px; }
.pdf-matrix .row-label { background: white; font-weight: 700; text-align: left; padding-left: 12px; font-size: 10pt; }
.pdf-matrix .code { background: white; font-weight: 700; width: 42px; font-size: 10pt; }
.pdf-hoc-panel { width: 280px; background: #f8f8f8; border: 1px solid #d0d0d0; padding: 12px 14px; font-size: 8.5pt; line-height: 1.45; }
.pdf-hoc-panel h3 { font-size: 9.5pt; font-weight: 700; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.6px; color: #2c2c2c; }
.pdf-hoc-panel .hoc-item { display: flex; gap: 8px; padding: 5px 0; border-bottom: 1px solid #e5e5e5; }
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
.pdf-footer { position: absolute; bottom: 0; left: 0; right: 0; text-align: center; font-size: 7.5pt; color: #666; padding: 6px 0; border-top: 1px solid #ccc; }
.pdf-footer .warn { font-weight: 700; letter-spacing: 0.5px; margin-top: 2px; }
.pdf-pageno { position: absolute; bottom: 6px; right: 12px; font-size: 7pt; color: #999; font-family: 'JetBrains Mono', monospace; }
</style>
`;

async function generateAndUploadPdf(swms, opts = {}) {
  const { saveLocal = false, silent = false } = opts;

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
    const path = `${swms.job_number}/${swms.swms_number}_rev${swms.revision_number}.pdf`;
    const { error: upErr } = await JM.sb().storage.from(JM.BUCKETS.swms).upload(path, blob, { contentType: 'application/pdf', upsert: true });
    if (upErr) {
      console.error('[SWMS PDF] upload failed', upErr);
      if (!silent) BromarHub.showInfo('PDF generated but upload failed: ' + upErr.message);
      return blob;
    }
    await JM.sb().from('swms_instances').update({ pdf_path: path, pdf_generated_at: new Date().toISOString() }).eq('id', swms.id);
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

  const pageHeader = `
    <div class="pdf-header">
      ${logoBlock}
      <div class="title-band">SAFE WORK METHOD STATEMENT</div>
      <div class="company-cell">Bromar Electrical Services (AUST) Pty Ltd<br/>ABN: 45 634 835 939<br/>LICENCE #: 17364</div>
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

  const ppeMandatory = lines(s.ppe_mandatory);
  const ppeAdditional = lines(s.ppe_additional);
  const maxPpe = Math.max(ppeMandatory.length, ppeAdditional.length, 1);
  let ppeRows = '';
  for (let i = 0; i < maxPpe; i++) ppeRows += `<tr><td>${e(ppeMandatory[i] || '')}</td><td>${e(ppeAdditional[i] || '')}</td></tr>`;

  const ratingClass = r => {
    const map = { 'A1':'risk-high','A2':'risk-high','A3':'risk-high','A4':'risk-high','A5':'risk-low','B1':'risk-high','B2':'risk-high','B3':'risk-high','B4':'risk-mod','B5':'risk-low','C1':'risk-high','C2':'risk-high','C3':'risk-mod','C4':'risk-mod','C5':'risk-low','D1':'risk-high','D2':'risk-high','D3':'risk-mod','D4':'risk-low','D5':'risk-low','E1':'risk-mod','E2':'risk-mod','E3':'risk-low','E4':'risk-low','E5':'risk-low' };
    return map[r] || '';
  };

  const page1 = `
    ${pageHeader}
    <div class="pdf-section-heading">Project Details</div>
    <table class="pdf-fields">
      <colgroup><col style="width:14%"/><col style="width:36%"/><col style="width:14%"/><col style="width:36%"/></colgroup>
      <tr><td class="lbl">Project</td><td class="val">${e(s.project_name || '—')}</td><td class="lbl">SWMS Date</td><td class="val">${JM.fmtDate(s.swms_date) || '—'}</td></tr>
      <tr><td class="lbl">Developed by</td><td class="val">${e(s.developed_by || '—')}</td><td class="lbl">Review Date</td><td class="val">${JM.fmtDate(s.review_date) || '—'}</td></tr>
      <tr><td class="lbl">Approved by</td><td class="val">${e(s.approved_by || '—')}</td><td class="lbl">Reviewed by</td><td class="val">${e(s.reviewed_by || '—')}</td></tr>
    </table>
    <div class="pdf-section-heading">Site Details</div>
    <table class="pdf-fields">
      <colgroup><col style="width:14%"/><col style="width:36%"/><col style="width:14%"/><col style="width:36%"/></colgroup>
      <tr><td class="lbl">Client</td><td class="val">${e(s.client_name || '—')}</td><td class="lbl">Site</td><td class="val">${e(s.site_name || '—')}</td></tr>
      <tr><td class="lbl">Address</td><td class="val" colspan="3">${e(s.site_address || '—')}</td></tr>
      <tr><td class="lbl">Site Contact</td><td class="val" colspan="3">${e(s.site_contact || '—')}${s.site_contact_phone ? ' · ' + e(s.site_contact_phone) : ''}</td></tr>
    </table>
    <div class="pdf-section-heading">Compliance &amp; Resources</div>
    <table class="pdf-ref">
      <colgroup><col style="width:50%"/><col style="width:50%"/></colgroup>
      <tr><th>Legislation, Standards &amp; Codes of Practice</th><th>Personnel Qualifications Required</th></tr>
      <tr><td>${lines(s.legislation).map(e).join('<br/>') || '—'}</td><td>${e(s.qualifications || '—')}</td></tr>
      <tr><th>Plant &amp; Equipment Required</th><th>Plant &amp; Equipment Inspections</th></tr>
      <tr><td>${lines(s.plant_required).map(e).join('<br/>') || '—'}</td><td>${lines(s.plant_inspections).map(e).join('<br/>') || '—'}</td></tr>
      <tr><th>Materials Used</th><th>MSDS Required</th></tr>
      <tr><td>${e(s.materials_used || '—')}</td><td>${e(s.msds_required || '—')}</td></tr>
      <tr><th>Specific Training Required</th><th>Relevant Procedures</th></tr>
      <tr><td>${e(s.training_required || '—')}</td><td>${e(s.relevant_procedures || '—')}</td></tr>
    </table>
    <div class="pdf-footer">Bromar Electrical Services (AUST) Pty Ltd — ABN 45 634 835 939<div class="warn">THIS DOCUMENT IS 'UNCONTROLLED' WHEN PRINTED</div></div>
    <div class="pdf-pageno">Page 1</div>`;

  const page2 = `
    ${pageHeader}
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
    <div class="pdf-footer">Bromar Electrical Services (AUST) Pty Ltd — ABN 45 634 835 939<div class="warn">THIS DOCUMENT IS 'UNCONTROLLED' WHEN PRINTED</div></div>
    <div class="pdf-pageno">Page 2</div>`;

  const page3 = `
    ${pageHeader}
    <div class="pdf-section-heading">Personal Protective Equipment</div>
    <table class="pdf-ppe">
      <colgroup><col style="width:50%"/><col style="width:50%"/></colgroup>
      <tr><th>Mandatory Site PPE</th><th>Additional PPE Required</th></tr>
      ${ppeRows}
    </table>
    <div class="pdf-footer">Bromar Electrical Services (AUST) Pty Ltd — ABN 45 634 835 939<div class="warn">THIS DOCUMENT IS 'UNCONTROLLED' WHEN PRINTED</div></div>
    <div class="pdf-pageno">Page 3</div>`;

  const ROWS_PER_PAGE = 11;
  const hazItems = s.hazards_json || [];
  const hazardPages = [];
  let chunk = [];
  let rowCount = 0;
  for (const h of hazItems) {
    chunk.push(h);
    if (h.type !== 'phase') rowCount++;
    if (rowCount >= ROWS_PER_PAGE) { hazardPages.push(chunk); chunk = []; rowCount = 0; }
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
      ${pageHeader}
      <div class="pdf-section-heading">Job Steps, Hazards &amp; Controls${hazardPages.length > 1 ? ` — Continued (${idx + 1} of ${hazardPages.length})` : ''}</div>
      <table class="pdf-haz">
        <colgroup><col class="c1"/><col class="c2"/><col class="c3"/><col class="c4"/><col class="c5"/><col class="c6"/><col class="c7"/><col class="c8"/><col class="c9"/></colgroup>
        <thead><tr><th>Step</th><th>Job Step</th><th>Hazards</th><th>Risks</th><th>Risk<br/>Rating</th><th>Controls</th><th>Hierarchy<br/>of Control</th><th>Residual<br/>Risk</th><th>Responsibility</th></tr></thead>
        <tbody>${body || '<tr><td colspan="9" style="text-align:center;color:#999;padding:20px">No hazards recorded</td></tr>'}</tbody>
      </table>
      <div class="pdf-footer">Bromar Electrical Services (AUST) Pty Ltd — ABN 45 634 835 939<div class="warn">THIS DOCUMENT IS 'UNCONTROLLED' WHEN PRINTED</div></div>
      <div class="pdf-pageno">Page ${4 + idx}</div>`;
  });

  const signoffPageNo = 4 + hazardPages.length;
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
    ${pageHeader}
    <div class="pdf-section-heading">Worker Sign-On</div>
    <div class="pdf-consent">
      We, the undersigned, confirm that we were consulted in the development of this SWMS. If a failure is identified within the SWMS work will stop, the SWMS amended and changes communicated to the workforce. We also clearly understand that the controls must be applied as documented, otherwise work is to cease immediately. We also confirm that we are qualified to carry out the works identified above, a copy to evidence our required qualifications have been provided and where applicable all insurances and work cover policies to undertake this activity are current.
    </div>
    <table class="pdf-signoff">
      <colgroup><col style="width:22%"/><col style="width:30%"/><col style="width:14%"/><col style="width:10%"/><col style="width:24%"/></colgroup>
      <thead><tr><th>Name</th><th>Signature</th><th>Date</th><th>Time</th><th>Employer</th></tr></thead>
      <tbody>${sigBody}</tbody>
    </table>
    <div class="pdf-footer">Bromar Electrical Services (AUST) Pty Ltd — ABN 45 634 835 939<div class="warn">THIS DOCUMENT IS 'UNCONTROLLED' WHEN PRINTED</div></div>
    <div class="pdf-pageno">Page ${signoffPageNo}</div>`;

  return [page1, page2, page3, ...hazPagesHtml, signoffPage];
}
})();
