/* ══════════════════════════════════════════════════════════════
   BROMAR HUB — SHARED TESTING MODULE: Construction Wiring (AS3012)
   Location: /tools/testing/construction-wiring.js
   API: window.BromarTest.ConstructionWiring.renderForm(container, config)
   ══════════════════════════════════════════════════════════════ */
window.BromarTest = window.BromarTest || {};
window.BromarTest.ConstructionWiring = (function () {

  const VERSION = 'V1.00';
  const TABLE = 'testing_construction_wiring';
  const BUCKET = 'testing';
  const FOLDER = 'construction-wiring';
  const NAVY = [36, 59, 107], ORANGE = [234, 88, 12], MUTED = [107, 114, 128];
  const ORG = { name: 'Bromar Electrical Services Pty Ltd', addr: '2/98-108 Western Ave, Westmeadows 3049', phoneRec: 'PH: 9335 5344    REC: 40430', web: 'www.bromar.com.au' };

  const CATEGORIES = [
    { name: 'General Site Compliance', items: [
      { num: 1, desc: 'Electrical safety plan available on site' },
      { num: 2, desc: 'Temporary wiring diagram available' },
      { num: 3, desc: 'Signage displayed at main switchboard' },
      { num: 4, desc: 'Emergency procedures posted' },
    ]},
    { name: 'Switchboard', items: [
      { num: 5, desc: 'Switchboard securely mounted and stable' },
      { num: 6, desc: 'Switchboard doors close and latch correctly' },
      { num: 7, desc: 'All openings blocked up and pole fillers fitted where needed' },
      { num: 8, desc: 'All circuits labelled with minimum text height of 6mm' },
      { num: 9, desc: 'Main switch / isolator clearly labelled' },
      { num: 10, desc: 'IP rating maintained for environment' },
      { num: 11, desc: 'All lighting and GPO circuits protected by a Type A RCD' },
      { num: 12, desc: 'RCD test buttons functional' },
      { num: 13, desc: 'Check RCDs to ensure they isolate both poles (neutral & active)' },
      { num: 14, desc: 'Overcurrent protection correctly rated' },
      { num: 15, desc: 'Map of site layout attached to switchboard if 5+ sheds' },
    ]},
    { name: 'Cables & Wiring', items: [
      { num: 16, desc: 'Temporary wiring tape on cabling at least every 5m' },
      { num: 17, desc: 'All cabling below 2.4m mechanically protected' },
      { num: 18, desc: 'Cable colour coding correct (active, neutral, earth)' },
      { num: 19, desc: 'Cables protected from mechanical damage' },
      { num: 20, desc: 'No cables across walkways or traffic areas without protection' },
      { num: 21, desc: 'Cable supports at appropriate intervals' },
      { num: 22, desc: 'No damaged or deteriorated cables' },
      { num: 23, desc: 'Cables clear of heat sources and sharp edges' },
      { num: 24, desc: 'Cable joints properly made and insulated' },
    ]},
    { name: 'Height Clearances', items: [
      { num: 25, desc: 'Overhead cables minimum 2.4m above walkways' },
      { num: 26, desc: 'Overhead cables minimum 5.8m above vehicle access' },
      { num: 27, desc: 'Cables clear of scaffolding and temporary structures' },
    ]},
    { name: 'Earthing', items: [
      { num: 28, desc: 'Main earth connection secure and accessible' },
      { num: 29, desc: 'Earth continuity verified' },
      { num: 30, desc: 'Equipotential bonding in place where required' },
      { num: 31, desc: 'Earth stake / electrode condition satisfactory' },
    ]},
    { name: 'Socket Outlets & Connections', items: [
      { num: 32, desc: 'Socket outlets weatherproof where required' },
      { num: 33, desc: 'No double adaptors in use' },
      { num: 34, desc: 'Extension leads in serviceable condition' },
      { num: 35, desc: 'Leads tagged and tested (in-service date current)' },
      { num: 36, desc: 'Plug tops and connectors undamaged' },
      { num: 37, desc: 'All junction boxes and shed connection boxes tight and secure — no openings including open glands, conduit adapters' },
    ]},
    { name: 'Lighting', items: [
      { num: 38, desc: 'Temporary lighting adequate for work areas' },
      { num: 39, desc: 'Emergency / exit lighting operational' },
      { num: 40, desc: 'Light fittings mechanically protected where required' },
      { num: 41, desc: 'Lighting control includes a manual bypass option (force on) in case PE cell fails' },
      { num: 42, desc: 'PE cell positioned or covered to prevent false triggering from direct light sources' },
      { num: 43, desc: 'Light switch installed to control lights if PE cell not required' },
    ]},
    { name: 'General Safety', items: [
      { num: 44, desc: 'Exclusion zones maintained around live work' },
      { num: 45, desc: 'Lock-out / tag-out equipment available' },
      { num: 46, desc: 'PPE available for electrical work' },
      { num: 47, desc: 'No unauthorised modifications to installation' },
    ]},
  ];

  const ALL_ITEMS = CATEGORIES.flatMap(c => c.items);
  let photos = [];

  function esc(s) { return String(s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

  function injectStyles() {
    if (document.getElementById('bromar-test-cw-styles')) return;
    const st = document.createElement('style'); st.id = 'bromar-test-cw-styles';
    st.textContent = `
      .cw-back{display:inline-flex;align-items:center;gap:6px;font-size:0.85rem;font-weight:600;color:var(--accent);cursor:pointer;margin-bottom:1.25rem;background:none;border:none;padding:4px 0;}.cw-back:hover{text-decoration:underline;}
      .cw-table{width:100%;border-collapse:collapse;margin-bottom:1.5rem;}.cw-table th{background:var(--bg-main);font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-secondary);padding:8px;text-align:left;border-bottom:2px solid var(--border);}
      .cw-item-row td{border-bottom:1px solid var(--border);vertical-align:middle;}.cw-cat-row td{border-bottom:1px solid var(--border);background:var(--bg-main);}
      .cw-radio-group{display:flex;gap:4px;justify-content:center;}.cw-radio{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:6px;cursor:pointer;border:1px solid var(--border);transition:all 0.15s;font-size:0.8rem;}
      .cw-radio input{position:absolute;opacity:0;pointer-events:none;}.cw-radio span{font-weight:700;}
      .cw-radio.pass:has(input:checked){background:#d1fae5;border-color:#15803d;color:#15803d;}.cw-radio.fail:has(input:checked){background:#fee2e2;border-color:#dc2626;color:#dc2626;}.cw-radio.na:has(input:checked){background:var(--bg-main);border-color:var(--accent);color:var(--accent);}
      .cw-dynamic-list .cw-dyn-row{display:flex;gap:8px;align-items:flex-start;margin-bottom:8px;}.cw-dyn-row span.cw-dyn-num{min-width:24px;height:36px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.85rem;color:var(--text-secondary);}
      .cw-dyn-row textarea{flex:1;min-height:56px;padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-family:'Outfit',sans-serif;font-size:0.85rem;background:var(--bg-secondary);color:var(--text-primary);resize:vertical;}.cw-dyn-row .remove-btn{margin-top:6px;}
      .cw-dyn-row[data-auto-item] textarea{border-left:3px solid var(--accent);}
      .cw-photo-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:1rem;margin-top:1rem;}.cw-photo-card{border:1px solid var(--border);border-radius:10px;overflow:hidden;background:var(--bg-secondary);}
      .cw-photo-card img{width:100%;height:140px;object-fit:cover;display:block;}.cw-photo-card textarea{width:100%;border:none;border-top:1px solid var(--border);padding:8px;font-family:'Outfit',sans-serif;font-size:0.8rem;resize:none;min-height:50px;background:var(--bg-secondary);color:var(--text-primary);}
      .cw-photo-card .remove-btn{width:100%;text-align:center;padding:6px;border-top:1px solid var(--border);}
    `;
    document.head.appendChild(st);
  }

  /* Uses shared logo loader from SwitchboardAudit module */
  function loadLogo() { return window.BromarTest.SwitchboardAudit ? window.BromarTest.SwitchboardAudit._loadLogo ? window.BromarTest.SwitchboardAudit._loadLogo() : Promise.resolve(null) : Promise.resolve(null); }
  let _localLogo = null;
  function loadLogoLocal() {
    if (_localLogo) return Promise.resolve(_localLogo);
    return new Promise(resolve => {
      const img = new Image(); img.crossOrigin = 'anonymous';
      const paths = ['../Bromar-Primary-Logo-Full-Colour.png', '../../Bromar-Primary-Logo-Full-Colour.png', '/Bromar-Primary-Logo-Full-Colour.png'];
      let tried = 0;
      function tryNext() { if (tried >= paths.length) { resolve(null); return; } img.src = paths[tried++]; }
      img.onload = () => { const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext('2d').drawImage(img, 0, 0); _localLogo = { dataUrl: c.toDataURL('image/png'), w: img.naturalWidth, h: img.naturalHeight }; resolve(_localLogo); };
      img.onerror = tryNext; tryNext();
    });
  }

  function ensureJsPDF() {
    if (window.jspdf) return Promise.resolve();
    const s1 = document.createElement('script'); s1.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    return new Promise((resolve, reject) => {
      s1.onload = () => { const s2 = document.createElement('script'); s2.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'; s2.onload = resolve; s2.onerror = reject; document.head.appendChild(s2); };
      s1.onerror = reject; document.head.appendChild(s1);
    });
  }

  /* ── Form (same pattern as switchboard audit, different prefix/items) ── */
  function renderForm(container, config) {
    injectStyles(); photos = [];
    const cfg = config || {}; const today = new Date().toISOString().split('T')[0];

    let checklistHtml = '';
    for (const cat of CATEGORIES) {
      checklistHtml += `<tr class="cw-cat-row"><td colspan="4" style="font-weight:700;font-style:italic;padding:10px 8px 6px;color:var(--text-primary);font-size:0.9rem;">${esc(cat.name)}</td></tr>`;
      for (const item of cat.items) {
        checklistHtml += `<tr class="cw-item-row"><td style="width:40px;text-align:center;font-weight:600;font-size:0.85rem;">${item.num}</td><td style="font-size:0.85rem;padding:6px 8px;">${esc(item.desc)}</td><td style="width:70px;text-align:center;"><div class="cw-radio-group"><label class="cw-radio pass"><input type="radio" name="cw_item_${item.num}" value="pass" data-item="${item.num}"><span>✓</span></label><label class="cw-radio fail"><input type="radio" name="cw_item_${item.num}" value="fail" data-item="${item.num}"><span>✗</span></label></div></td><td style="width:50px;text-align:center;"><label class="cw-radio na"><input type="radio" name="cw_item_${item.num}" value="na" data-item="${item.num}"><span>N/A</span></label></td></tr>`;
      }
    }

    container.innerHTML = `
      ${cfg.onBack ? '<button class="cw-back" id="cwBack">← Back</button>' : ''}
      <h3 style="font-size:1.1rem;font-weight:700;margin-bottom:1.25rem;">🔧 Construction Wiring Inspection (AS3012)</h3>
      <div class="section-label">Job Details</div>
      ${cfg.jobNumber ? '' : '<div class="field-row"><div class="field-group"><label>Job Number</label><input type="text" id="cwJobNumber" placeholder="e.g. BE5600"></div><div class="field-group"></div></div>'}
      <div class="field-row"><div class="field-group"><label>Date <span class="required">*</span></label><input type="date" id="cwDate" value="${today}"></div><div class="field-group"><label>Inspector <span class="required">*</span></label><select id="cwInspector"><option value="">Select...</option></select></div></div>
      <div class="field-row"><div class="field-group"><label>Client</label><input type="text" id="cwClient" value="${esc(cfg.clientName || '')}"></div><div class="field-group"><label>Site Address</label><input type="text" id="cwSite" value="${esc(cfg.siteName || '')}"></div></div>
      <div class="field-row"><div class="field-group"><label>Area / Section</label><input type="text" id="cwArea" placeholder="e.g. Shed 3, Level 2"></div><div class="field-group"><label>Switchboard ID</label><input type="text" id="cwBoardId" placeholder="e.g. DB-01"></div></div>
      <div class="section-label">Inspection Items</div>
      <table class="cw-table"><thead><tr><th>Item</th><th>Description</th><th>Pass / Fail</th><th>N/A</th></tr></thead><tbody>${checklistHtml}</tbody></table>
      <div class="section-label">Non-Compliance / Issues Identified</div>
      <div class="cw-dynamic-list" id="cwIssues"></div><button class="add-btn" id="cwAddIssue">+ Add Issue</button>
      <div class="section-label">Corrective Actions Required</div>
      <div class="cw-dynamic-list" id="cwActions"></div><button class="add-btn" id="cwAddAction">+ Add Corrective Action</button>
      <div class="section-label">Photos</div>
      <div class="file-upload-area" id="cwPhotoArea"><div class="upload-icon">📷</div><div class="upload-text">Tap to add photos</div><div class="upload-hint">JPEG, PNG</div><input type="file" id="cwPhotoInput" accept="image/*" multiple style="display:none;"></div>
      <div class="cw-photo-grid" id="cwPhotoGrid"></div>
      <div class="form-divider"></div>
      <div class="submit-row"><button class="btn-secondary" id="cwSaveDraft" style="padding:0.875rem 1.5rem;">💾 Save Progress</button><button class="submit-btn" id="cwSubmit">Submit Inspection & Generate PDF</button></div>
    `;

    if (cfg.onBack) container.querySelector('#cwBack').addEventListener('click', cfg.onBack);
    const inspSel = container.querySelector('#cwInspector');
    (cfg.employees || []).forEach(e => { const o = document.createElement('option'); o.value = e.full_name; o.textContent = e.full_name; inspSel.appendChild(o); });
    (async () => {
      try {
        if (cfg.supabase) {
          const { data: { user } } = await cfg.supabase.auth.getUser();
          if (user?.email) {
            const match = (cfg.employees || []).find(e => e.email?.toLowerCase() === user.email.toLowerCase());
            if (match) { inspSel.value = match.full_name; inspSel.disabled = true; return; }
          }
        }
        if (cfg.currentUser?.name) inspSel.value = cfg.currentUser.name;
      } catch (_) { if (cfg.currentUser?.name) inspSel.value = cfg.currentUser.name; }
    })();

    const issuesContainer = container.querySelector('#cwIssues');
    function renumList(cont) { cont.querySelectorAll('.cw-dyn-row').forEach((r, i) => { r.querySelector('.cw-dyn-num').textContent = i + 1; }); }
    function addDynRow(cont, text, autoItem) {
      const row = document.createElement('div'); row.className = 'cw-dyn-row';
      if (autoItem) row.setAttribute('data-auto-item', autoItem);
      row.innerHTML = `<span class="cw-dyn-num">1</span><textarea placeholder="Describe...">${esc(text)}</textarea><button class="remove-btn" type="button">✕</button>`;
      row.querySelector('.remove-btn').addEventListener('click', () => { row.remove(); renumList(cont); });
      cont.appendChild(row); renumList(cont); return row;
    }
    function setupList(contId, btnId) { const cont = container.querySelector('#'+contId); container.querySelector('#'+btnId).addEventListener('click', () => { addDynRow(cont, '', null).querySelector('textarea').focus(); }); }
    setupList('cwIssues', 'cwAddIssue'); setupList('cwActions', 'cwAddAction');

    container.querySelectorAll('.cw-table input[type="radio"]').forEach(radio => {
      radio.addEventListener('change', () => {
        const num = radio.dataset.item; const item = ALL_ITEMS.find(i => i.num === parseInt(num)); if (!item) return;
        const existing = issuesContainer.querySelector(`.cw-dyn-row[data-auto-item="${num}"]`);
        if (existing) { existing.remove(); renumList(issuesContainer); }
        if (radio.value === 'fail') addDynRow(issuesContainer, item.desc, num);
      });
    });

    const photoArea = container.querySelector('#cwPhotoArea'); const photoInput = container.querySelector('#cwPhotoInput'); const photoGrid = container.querySelector('#cwPhotoGrid');
    photoArea.addEventListener('click', () => photoInput.click());
    photoInput.addEventListener('change', e => { Array.from(e.target.files||[]).forEach(file => { const reader = new FileReader(); reader.onload = ev => { photos.push({ file, dataUrl: ev.target.result, description: '' }); renderPhotos(); }; reader.readAsDataURL(file); }); photoInput.value = ''; });
    function renderPhotos() {
      photoGrid.innerHTML = photos.map((p, i) => `<div class="cw-photo-card" data-idx="${i}"><img src="${p.dataUrl}" alt="Photo ${i+1}"><textarea placeholder="Description...">${esc(p.description)}</textarea><button class="remove-btn" type="button">Remove</button></div>`).join('');
      photoGrid.querySelectorAll('.cw-photo-card').forEach(card => { const idx = parseInt(card.dataset.idx); card.querySelector('textarea').addEventListener('input', e => { photos[idx].description = e.target.value; }); card.querySelector('.remove-btn').addEventListener('click', () => { photos.splice(idx, 1); renderPhotos(); }); });
    }
    let _draftId = null;
    container.querySelector('#cwSubmit').addEventListener('click', () => submitInspection(container, cfg));
    container.querySelector('#cwSaveDraft').addEventListener('click', async () => {
      const data = collectData(container);
      if (!data.inspector) { BromarHub.showInfo('Select an inspector before saving'); return; }
      const sb = cfg.supabase; const jobNumber = cfg.jobNumber || data.jobNumber || 'STANDALONE';
      BromarHub.showLoading('Saving draft...');
      try {
        const record = { job_number: jobNumber, client_name: data.client, site_name: data.site, area: data.area, switchboard_id: data.boardId, tested_by: data.inspector, inspection_date: data.date, inspection_items: data.items, issues: data.issues, corrective_actions: data.actions, photos: [], status: 'draft' };
        if (_draftId) { await sb.from(TABLE).update(record).eq('id', _draftId); }
        else { const { data: ins, error } = await sb.from(TABLE).insert(record).select('id').single(); if (error) throw error; _draftId = ins.id; }
        BromarHub.hideLoading(); BromarHub.showSuccess('Draft saved');
      } catch (e) { BromarHub.hideLoading(); BromarHub.showInfo('Save failed: ' + (e.message || e)); }
    });
  }

  function collectData(container) {
    const g = id => (container.querySelector('#'+id)||{}).value||'';
    return {
      jobNumber: g('cwJobNumber').trim(), client: g('cwClient').trim(), site: g('cwSite').trim(),
      area: g('cwArea').trim(), boardId: g('cwBoardId').trim(),
      inspector: g('cwInspector'), date: g('cwDate'),
      items: ALL_ITEMS.map(item => { const c = container.querySelector(`input[name="cw_item_${item.num}"]:checked`); return { num: item.num, desc: item.desc, result: c ? c.value : null }; }),
      issues: Array.from(container.querySelectorAll('#cwIssues .cw-dyn-row textarea')).map(ta => ta.value.trim()).filter(Boolean),
      actions: Array.from(container.querySelectorAll('#cwActions .cw-dyn-row textarea')).map(ta => ta.value.trim()).filter(Boolean),
      photos,
    };
  }

  function validate(data) {
    if (!data.inspector) return 'Inspector is required';
    if (!data.date) return 'Date is required';
    const un = data.items.filter(i => !i.result);
    if (un.length) return `${un.length} item(s) not answered (item ${un[0].num})`;
    return null;
  }

  async function submitInspection(container, cfg) {
    const data = collectData(container); const err = validate(data);
    if (err) { BromarHub.showInfo(err); return; }
    const sb = cfg.supabase; const jobNumber = cfg.jobNumber || data.jobNumber || 'STANDALONE';
    BromarHub.showLoading('Generating inspection...', 'Creating PDF and saving');
    try {
      const record = { job_number: jobNumber, client_name: data.client, site_name: data.site, area: data.area, switchboard_id: data.boardId, tested_by: data.inspector, inspection_date: data.date, inspection_items: data.items, issues: data.issues, corrective_actions: data.actions, photos: [], status: 'completed' };
      const { data: inserted, error: ie } = await sb.from(TABLE).insert(record).select('id').single();
      if (ie) throw ie;
      const rid = inserted.id;
      const photoPaths = [];
      for (let i = 0; i < photos.length; i++) { const p = photos[i]; const ext = p.file.name.split('.').pop()||'jpg'; const path = `${jobNumber}/${FOLDER}/${rid}/photo_${i+1}.${ext}`; const { error: ue } = await sb.storage.from(BUCKET).upload(path, p.file, { upsert: true }); if (!ue) photoPaths.push({ path, description: p.description }); }
      if (photoPaths.length) await sb.from(TABLE).update({ photos: photoPaths }).eq('id', rid);
      BromarHub.showLoading('Generating PDF...', 'Please wait');
      const pdfBlob = await generatePDF(data, jobNumber);
      await sb.storage.from(BUCKET).upload(`${jobNumber}/${FOLDER}/${rid}.pdf`, pdfBlob, { contentType: 'application/pdf', upsert: true });
      BromarHub.hideLoading(); BromarHub.showSuccess('Construction wiring inspection saved');
      if (cfg.onComplete) cfg.onComplete();
    } catch (e) { console.error('[ConstructionWiring]', e); BromarHub.hideLoading(); BromarHub.showInfo('Error: ' + (e.message || e)); }
  }

  async function generatePDF(data, jobNumber) {
    await ensureJsPDF(); const logo = await loadLogoLocal();
    const { jsPDF } = window.jspdf; const doc = new jsPDF('p', 'mm', 'a4');
    const W = doc.internal.pageSize.getWidth(), M = 14;
    let logoW = 0, logoH = 0;
    if (logo) { const maxW = 38, maxH = 14, ratio = logo.w / logo.h; logoW = maxW; logoH = logoW / ratio; if (logoH > maxH) { logoH = maxH; logoW = logoH * ratio; } }

    function stamp() {
      doc.setFillColor(...ORANGE); doc.rect(0, 0, W, 3, 'F');
      if (logo) try { doc.addImage(logo.dataUrl, 'PNG', M, 7, logoW, logoH); } catch (_) {}
      const rx = W - M;
      doc.setFont('helvetica', 'bold').setFontSize(8.5).setTextColor(...NAVY); doc.text(ORG.name, rx, 8, { align: 'right' });
      doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(...MUTED); doc.text(ORG.addr, rx, 12, { align: 'right' }); doc.text(ORG.phoneRec, rx, 15.5, { align: 'right' }); doc.text('WEB: ' + ORG.web, rx, 19, { align: 'right' });
      doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(...MUTED);
      doc.text(VERSION, M, 290); doc.text('Construction Wiring Inspection (AS3012)', W / 2, 290, { align: 'center' }); doc.text('Page ' + doc.internal.getNumberOfPages(), W - M, 290, { align: 'right' });
    }
    stamp(); let y = 28;
    doc.setFont('helvetica', 'bold').setFontSize(19).setTextColor(...NAVY); doc.text('Construction Wiring Inspection', W / 2, y, { align: 'center' }); y += 4;
    doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...MUTED); doc.text('AS/NZS 3012', W / 2, y, { align: 'center' }); y += 5;
    doc.setDrawColor(...ORANGE).setLineWidth(0.8).line(M, y, W - M, y); y += 9;

    const colW = W / 2 - M - 5;
    function pairRow(pairs, sy) { let ml = 1; const blocks = pairs.map(([k, v], i) => { const x = i===0?M:W/2; const lines = doc.splitTextToSize(v||'\u2014', colW); ml = Math.max(ml, lines.length); return { x, k, lines }; }); blocks.forEach(b => { doc.setFont('helvetica','normal').setFontSize(7.5).setTextColor(...MUTED); doc.text(b.k.toUpperCase(), b.x, sy); doc.setFont('helvetica','bold').setFontSize(9).setTextColor(40,49,60); doc.text(b.lines, b.x, sy+4.5); }); return sy+4.5+ml*4+3; }
    y = pairRow([['Client', data.client], ['Site Address', data.site]], y);
    y = pairRow([['Area / Section', data.area], ['Switchboard ID', data.boardId]], y);
    y = pairRow([['Inspector', data.inspector], ['Date', data.date]], y);
    y = pairRow([['Job Number', jobNumber]], y); y += 2;

    const passCount = data.items.filter(i=>i.result==='pass').length; const failCount = data.items.filter(i=>i.result==='fail').length; const naCount = data.items.filter(i=>i.result==='na').length;
    const ensure = need => { if (y + need > 280) { doc.addPage(); stamp(); y = 26; } };
    ensure(28); doc.setFont('helvetica','bold').setFontSize(12).setTextColor(...NAVY); doc.text('Results Summary', M, y); y += 6;
    const cards = [['Total', ALL_ITEMS.length, NAVY], ['Pass', passCount, [29,122,92]], ['Fail', failCount, [192,57,43]], ['N/A', naCount, MUTED]];
    const cw2 = (W - 2*M - 3*4) / 4;
    cards.forEach((c,i) => { const x = M + i*(cw2+4); doc.setFillColor(244,247,252).roundedRect(x,y,cw2,16,2,2,'F'); doc.setFont('helvetica','bold').setFontSize(15).setTextColor(...c[2]).text(String(c[1]), x+cw2/2, y+8, { align:'center' }); doc.setFont('helvetica','normal').setFontSize(6.5).setTextColor(...MUTED).text(c[0].toUpperCase(), x+cw2/2, y+13, { align:'center' }); });
    y += 24;

    ensure(16); doc.setFont('helvetica','bold').setFontSize(12).setTextColor(...NAVY); doc.text('Inspection Items', M, y); y += 5;
    const tableBody = [];
    for (const cat of CATEGORIES) {
      tableBody.push([{ content: cat.name, colSpan: 3, styles: { fontStyle: 'bolditalic', fillColor: [255,247,237], textColor: [40,40,40], fontSize: 8 } }]);
      for (const item of cat.items) { const r = data.items.find(i=>i.num===item.num); let st = '', sc = MUTED; if (r?.result==='pass'){st='✓ PASS';sc=[29,122,92];}else if(r?.result==='fail'){st='✗ FAIL';sc=[192,57,43];}else if(r?.result==='na'){st='N/A';sc=MUTED;} tableBody.push([{ content: String(item.num), styles: { halign:'center', fontStyle:'bold' } }, item.desc, { content: st, styles: { halign:'center', fontStyle:'bold', textColor: sc } }]); }
    }
    doc.autoTable({ startY:y, margin:{left:M,right:M,top:22,bottom:14}, head:[['#','Description','Result']], body:tableBody, styles:{fontSize:7.5,cellPadding:2}, headStyles:{fillColor:ORANGE,fontSize:8}, alternateRowStyles:{fillColor:[250,251,253]}, columnStyles:{0:{cellWidth:12},2:{cellWidth:28}}, didDrawPage:stamp });
    y = doc.lastAutoTable.finalY + 8;

    if (data.issues.length) { ensure(16); doc.setFont('helvetica','bold').setFontSize(12).setTextColor(...NAVY); doc.text('Non-Compliance / Issues', M, y); y+=5; doc.autoTable({ startY:y, margin:{left:M,right:M,top:22,bottom:14}, head:[['#','Description']], body:data.issues.map((h,i)=>[i+1,h]), styles:{fontSize:8,cellPadding:2}, headStyles:{fillColor:[176,106,23],fontSize:8}, alternateRowStyles:{fillColor:[253,248,240]}, columnStyles:{0:{cellWidth:12,halign:'center'}}, didDrawPage:stamp }); y=doc.lastAutoTable.finalY+8; }
    if (data.actions.length) { ensure(16); doc.setFont('helvetica','bold').setFontSize(12).setTextColor(...NAVY); doc.text('Corrective Actions Required', M, y); y+=5; doc.autoTable({ startY:y, margin:{left:M,right:M,top:22,bottom:14}, head:[['#','Description']], body:data.actions.map((r,i)=>[i+1,r]), styles:{fontSize:8,cellPadding:2}, headStyles:{fillColor:ORANGE,fontSize:8}, alternateRowStyles:{fillColor:[250,251,253]}, columnStyles:{0:{cellWidth:12,halign:'center'}}, didDrawPage:stamp }); y=doc.lastAutoTable.finalY+8; }

    if (photos.length) { doc.addPage(); stamp(); y = 26; doc.setFont('helvetica','bold').setFontSize(12).setTextColor(...NAVY); doc.text('Photos', M, y); y+=8; const pW=55,pH=42,gap=5,cols=3; for(let i=0;i<photos.length;i++){const col=i%cols;if(col===0&&i>0)y+=pH+18;if(y+pH+18>280){doc.addPage();stamp();y=26;}const px=M+col*(pW+gap);try{doc.addImage(photos[i].dataUrl,'JPEG',px,y,pW,pH);}catch(_){doc.setDrawColor(200);doc.rect(px,y,pW,pH);}if(photos[i].description){doc.setFont('helvetica','normal').setFontSize(6.5).setTextColor(...MUTED);doc.text(doc.splitTextToSize(photos[i].description,pW).slice(0,3),px,y+pH+3.5);}} }

    return doc.output('blob');
  }

  return { VERSION, renderForm, collectData, validate, generatePDF, CATEGORIES, ALL_ITEMS };
})();
