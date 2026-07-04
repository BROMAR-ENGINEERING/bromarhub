/* ══════════════════════════════════════════════════════════════
   BROMAR HUB — SHARED TESTING MODULE: Switchboard Audit
   Location: /tools/testing/switchboard-audit.js

   Self-contained module usable from:
     - Job Manager testing tab (via JM._testForms adapter)
     - Standalone toolbox/testing.html page

   API:
     window.BromarTest.SwitchboardAudit.renderForm(container, config)
     config: { jobNumber, clientName, siteName, siteAddress,
               employees, currentUser, supabase,
               onComplete, onBack }
   ══════════════════════════════════════════════════════════════ */
window.BromarTest = window.BromarTest || {};
window.BromarTest.SwitchboardAudit = (function () {

  const VERSION = 'V1.00';
  const TABLE = 'testing_switchboard_audit';
  const BUCKET = 'testing';
  const FOLDER = 'switchboard-audit';
  const NAVY = [36, 59, 107], ORANGE = [234, 88, 12], MUTED = [107, 114, 128];
  const ORG = { name: 'Bromar Electrical Services Pty Ltd', addr: '2/98-108 Western Ave, Westmeadows 3049', phoneRec: 'PH: 9335 5344    REC: 40430', web: 'www.bromar.com.au' };

  const CATEGORIES = [
    { name: 'General Access & Location', items: [
      { num: 1, desc: '600mm radius of door opening obtained' },
      { num: 2, desc: 'Obstructions to door opening' },
      { num: 3, desc: 'Lockable to restrict unauthorized personnel' },
    ]},
    { name: 'Labelling', items: [
      { num: 4, desc: 'Switchboard identification label' },
      { num: 5, desc: 'Sub circuits labelling / schedule' },
      { num: 6, desc: 'Main switch/isolator label' },
      { num: 7, desc: 'Emergency lighting labels' },
      { num: 8, desc: 'Solar warning labels' },
    ]},
    { name: 'Enclosure', items: [
      { num: 9, desc: 'Enclosure condition' },
      { num: 10, desc: 'Pole Fillers' },
      { num: 11, desc: 'Enclosure fixings' },
      { num: 12, desc: 'No openings bigger than 5mm' },
      { num: 13, desc: 'Seals and gaskets satisfactory' },
      { num: 14, desc: 'Is the degree of IP protection maintained' },
      { num: 15, desc: 'No undue accumulation of dust and dirt' },
      { num: 16, desc: 'Fire rating maintained where required' },
      { num: 17, desc: 'Adequate protection of equipment and cables against corrosion, the weather, vibration and other adverse factors' },
    ]},
    { name: 'Cabling', items: [
      { num: 18, desc: 'Cables entering board have adequate mechanical protection' },
      { num: 19, desc: 'Cables on sharp edges' },
    ]},
    { name: 'Glandplate', items: [
      { num: 20, desc: 'Non-Ferreous material used' },
      { num: 21, desc: 'Glandplate and glands all tight & secured' },
    ]},
    { name: 'Switchgear', items: [
      { num: 22, desc: 'Discrimination/Coordination' },
      { num: 23, desc: 'Switchgear selection (suited to switchboard)' },
      { num: 24, desc: 'Switchgear orientation' },
      { num: 25, desc: 'Switchgear condition' },
    ]},
    { name: 'Chassis & Busbars', items: [
      { num: 26, desc: 'Insulation on busbars in good condition' },
      { num: 27, desc: 'Phase to earth clearance' },
      { num: 28, desc: 'Phase to phase clearance' },
      { num: 29, desc: 'Shrouds fitted' },
    ]},
    { name: 'Terminations', items: [
      { num: 30, desc: 'Exposed copper on terminations' },
      { num: 31, desc: 'Loose connections' },
      { num: 32, desc: 'Visual indications' },
    ]},
    { name: 'Residual Current Devices', items: [
      { num: 33, desc: 'Fitted where required' },
      { num: 34, desc: 'Correct milli-amp rating' },
    ]},
    { name: 'Overcurrent Protection', items: [
      { num: 35, desc: 'Ensure all protection settings/sizes are as minimum' },
    ]},
  ];

  const ALL_ITEMS = CATEGORIES.flatMap(c => c.items);
  let photos = [];
  let _logoData = null;

  function esc(s) { return String(s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

  /* ── CSS (injected once) ── */
  function injectStyles() {
    if (document.getElementById('bromar-test-sa-styles')) return;
    const st = document.createElement('style');
    st.id = 'bromar-test-sa-styles';
    st.textContent = `
      .sa-back{display:inline-flex;align-items:center;gap:6px;font-size:0.85rem;font-weight:600;color:var(--accent);cursor:pointer;margin-bottom:1.25rem;background:none;border:none;padding:4px 0;}
      .sa-back:hover{text-decoration:underline;}
      .sa-table{width:100%;border-collapse:collapse;margin-bottom:1.5rem;}
      .sa-table th{background:var(--bg-main);font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-secondary);padding:8px;text-align:left;border-bottom:2px solid var(--border);}
      .sa-item-row td{border-bottom:1px solid var(--border);vertical-align:middle;}
      .sa-cat-row td{border-bottom:1px solid var(--border);background:var(--bg-main);}
      .sa-radio-group{display:flex;gap:4px;justify-content:center;}
      .sa-radio{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:6px;cursor:pointer;border:1px solid var(--border);transition:all 0.15s;font-size:0.8rem;}
      .sa-radio input{position:absolute;opacity:0;pointer-events:none;}
      .sa-radio span{font-weight:700;}
      .sa-radio.pass:has(input:checked){background:#d1fae5;border-color:#15803d;color:#15803d;}
      .sa-radio.fail:has(input:checked){background:#fee2e2;border-color:#dc2626;color:#dc2626;}
      .sa-radio.na:has(input:checked){background:var(--bg-main);border-color:var(--accent);color:var(--accent);}
      .sa-dynamic-list .sa-dyn-row{display:flex;gap:8px;align-items:flex-start;margin-bottom:8px;}
      .sa-dyn-row span.sa-dyn-num{min-width:24px;height:36px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.85rem;color:var(--text-secondary);}
      .sa-dyn-row textarea{flex:1;min-height:56px;padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-family:'Outfit',sans-serif;font-size:0.85rem;background:var(--bg-secondary);color:var(--text-primary);resize:vertical;}
      .sa-dyn-row .remove-btn{margin-top:6px;}
      .sa-dyn-row[data-auto-item] textarea{border-left:3px solid var(--accent);}
      .sa-photo-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:1rem;margin-top:1rem;}
      .sa-photo-card{border:1px solid var(--border);border-radius:10px;overflow:hidden;background:var(--bg-secondary);}
      .sa-photo-card img{width:100%;height:140px;object-fit:cover;display:block;}
      .sa-photo-card textarea{width:100%;border:none;border-top:1px solid var(--border);padding:8px;font-family:'Outfit',sans-serif;font-size:0.8rem;resize:none;min-height:50px;background:var(--bg-secondary);color:var(--text-primary);}
      .sa-photo-card .remove-btn{width:100%;text-align:center;padding:6px;border-top:1px solid var(--border);}
    `;
    document.head.appendChild(st);
  }

  /* ── Logo loader ── */
  function loadLogo() {
    if (_logoData) return Promise.resolve(_logoData);
    return new Promise(resolve => {
      const img = new Image(); img.crossOrigin = 'anonymous';
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        c.getContext('2d').drawImage(img, 0, 0);
        _logoData = { dataUrl: c.toDataURL('image/png'), w: img.naturalWidth, h: img.naturalHeight };
        resolve(_logoData);
      };
      img.onerror = () => resolve(null);
      /* Try multiple paths depending on context */
      const paths = ['../Bromar-Primary-Logo-Full-Colour.png', '../../Bromar-Primary-Logo-Full-Colour.png', '/Bromar-Primary-Logo-Full-Colour.png'];
      let tried = 0;
      function tryNext() { if (tried >= paths.length) { resolve(null); return; } img.src = paths[tried++]; }
      img.onerror = tryNext;
      tryNext();
    });
  }

  /* ── Ensure jsPDF + autoTable loaded ── */
  let _jspdfPromise = null;
  function ensureJsPDF() {
    if (window.jspdf) return Promise.resolve();
    if (_jspdfPromise) return _jspdfPromise;
    _jspdfPromise = new Promise((resolve, reject) => {
      const s1 = document.createElement('script');
      s1.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      s1.onload = () => {
        const s2 = document.createElement('script');
        s2.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';
        s2.onload = resolve;
        s2.onerror = () => reject(new Error('Failed to load autoTable'));
        document.head.appendChild(s2);
      };
      s1.onerror = () => reject(new Error('Failed to load jsPDF'));
      document.head.appendChild(s1);
    });
    return _jspdfPromise;
  }

  /* ── Render form ── */
  function renderForm(container, config) {
    injectStyles();
    photos = [];
    const cfg = config || {};
    const today = new Date().toISOString().split('T')[0];

    let checklistHtml = '';
    for (const cat of CATEGORIES) {
      checklistHtml += `<tr class="sa-cat-row"><td colspan="4" style="font-weight:700;font-style:italic;padding:10px 8px 6px;color:var(--text-primary);font-size:0.9rem;">${esc(cat.name)}</td></tr>`;
      for (const item of cat.items) {
        checklistHtml += `
          <tr class="sa-item-row">
            <td style="width:40px;text-align:center;font-weight:600;font-size:0.85rem;">${item.num}</td>
            <td style="font-size:0.85rem;padding:6px 8px;">${esc(item.desc)}</td>
            <td style="width:70px;text-align:center;">
              <div class="sa-radio-group">
                <label class="sa-radio pass"><input type="radio" name="item_${item.num}" value="pass" data-item="${item.num}"><span>✓</span></label>
                <label class="sa-radio fail"><input type="radio" name="item_${item.num}" value="fail" data-item="${item.num}"><span>✗</span></label>
              </div>
            </td>
            <td style="width:50px;text-align:center;">
              <label class="sa-radio na"><input type="radio" name="item_${item.num}" value="na" data-item="${item.num}"><span>N/A</span></label>
            </td>
          </tr>`;
      }
    }

    container.innerHTML = `
      ${cfg.onBack ? '<button class="sa-back" id="saBack">← Back</button>' : ''}
      <h3 style="font-size:1.1rem;font-weight:700;margin-bottom:1.25rem;">🔌 Switchboard Inspection Audit</h3>
      <div class="section-label">Job Details</div>
      <div class="field-row">
        <div class="field-group"><label>Job Number</label><input type="text" id="saJobNumber" value="${esc(cfg.jobNumber || '')}" ${cfg.jobNumber ? 'readonly' : ''}></div>
        <div class="field-group"><label>Date <span class="required">*</span></label><input type="date" id="saDate" value="${today}"></div>
      </div>
      <div class="field-row">
        <div class="field-group"><label>Client</label><input type="text" id="saClient" value="${esc(cfg.clientName || '')}"></div>
        <div class="field-group"><label>Site Name / Address</label><input type="text" id="saSite" value="${esc(cfg.siteName || '')}"></div>
      </div>
      <div class="field-row">
        <div class="field-group"><label>Switchboard ID <span class="required">*</span></label><input type="text" id="saBoardId" placeholder="e.g. Main Switchboard"></div>
        <div class="field-group"><label>Location within site</label><input type="text" id="saLocation" placeholder="e.g. Plant Room, Level 1"></div>
      </div>
      <div class="field-row">
        <div class="field-group"><label>Auditor <span class="required">*</span></label><select id="saAuditor"><option value="">Select...</option></select></div>
        <div class="field-group"></div>
      </div>
      <div class="section-label">Inspection Items</div>
      <table class="sa-table">
        <thead><tr><th>Item</th><th>Non-Compliance Description</th><th>Pass / Fail</th><th>N/A</th></tr></thead>
        <tbody>${checklistHtml}</tbody>
      </table>
      <div class="section-label">Hazards / Major Non-Compliance Identified</div>
      <div class="sa-dynamic-list" id="saHazards"></div>
      <button class="add-btn" id="saAddHazard">+ Add Hazard</button>
      <div class="section-label">Remedial Works Recommended</div>
      <div class="sa-dynamic-list" id="saRemedial"></div>
      <button class="add-btn" id="saAddRemedial">+ Add Remedial Work</button>
      <div class="section-label">Photos</div>
      <div class="file-upload-area" id="saPhotoArea">
        <div class="upload-icon">📷</div>
        <div class="upload-text">Tap to add photos</div>
        <div class="upload-hint">JPEG, PNG — include photos of non-compliance items</div>
        <input type="file" id="saPhotoInput" accept="image/*" multiple style="display:none;">
      </div>
      <div class="sa-photo-grid" id="saPhotoGrid"></div>
      <div class="form-divider"></div>
      <div class="submit-row">
        <button class="submit-btn" id="saSubmit">Submit Audit & Generate PDF</button>
      </div>
    `;

    /* Wire back */
    if (cfg.onBack) container.querySelector('#saBack').addEventListener('click', cfg.onBack);

    /* Populate auditor */
    const auditorSel = container.querySelector('#saAuditor');
    (cfg.employees || []).forEach(e => {
      const o = document.createElement('option');
      o.value = e.full_name; o.textContent = e.full_name; o.dataset.email = e.email || '';
      auditorSel.appendChild(o);
    });
    if (cfg.currentUser?.name) auditorSel.value = cfg.currentUser.name;

    /* Dynamic lists */
    const hazardsContainer = container.querySelector('#saHazards');
    function renumList(cont) { cont.querySelectorAll('.sa-dyn-row').forEach((r, i) => { r.querySelector('.sa-dyn-num').textContent = i + 1; }); }
    function addDynRow(cont, text, autoItemNum) {
      const row = document.createElement('div'); row.className = 'sa-dyn-row';
      if (autoItemNum) row.setAttribute('data-auto-item', autoItemNum);
      row.innerHTML = `<span class="sa-dyn-num">1</span><textarea placeholder="Describe...">${esc(text)}</textarea><button class="remove-btn" type="button">✕</button>`;
      row.querySelector('.remove-btn').addEventListener('click', () => { row.remove(); renumList(cont); });
      cont.appendChild(row); renumList(cont); return row;
    }
    function setupDynamicList(contId, btnId) {
      const cont = container.querySelector('#' + contId);
      container.querySelector('#' + btnId).addEventListener('click', () => { addDynRow(cont, '', null).querySelector('textarea').focus(); });
    }
    setupDynamicList('saHazards', 'saAddHazard');
    setupDynamicList('saRemedial', 'saAddRemedial');

    /* Auto-populate hazards on fail */
    container.querySelectorAll('.sa-table input[type="radio"]').forEach(radio => {
      radio.addEventListener('change', () => {
        const num = radio.dataset.item;
        const item = ALL_ITEMS.find(i => i.num === parseInt(num));
        if (!item) return;
        const existing = hazardsContainer.querySelector(`.sa-dyn-row[data-auto-item="${num}"]`);
        if (existing) { existing.remove(); renumList(hazardsContainer); }
        if (radio.value === 'fail') addDynRow(hazardsContainer, item.desc, num);
      });
    });

    /* Photos */
    const photoArea = container.querySelector('#saPhotoArea');
    const photoInput = container.querySelector('#saPhotoInput');
    const photoGrid = container.querySelector('#saPhotoGrid');
    photoArea.addEventListener('click', () => photoInput.click());
    photoInput.addEventListener('change', e => {
      Array.from(e.target.files || []).forEach(file => {
        const reader = new FileReader();
        reader.onload = ev => { photos.push({ file, dataUrl: ev.target.result, description: '' }); renderPhotos(); };
        reader.readAsDataURL(file);
      });
      photoInput.value = '';
    });
    function renderPhotos() {
      photoGrid.innerHTML = photos.map((p, i) => `
        <div class="sa-photo-card" data-idx="${i}">
          <img src="${p.dataUrl}" alt="Photo ${i + 1}">
          <textarea placeholder="Description...">${esc(p.description)}</textarea>
          <button class="remove-btn" type="button">Remove</button>
        </div>`).join('');
      photoGrid.querySelectorAll('.sa-photo-card').forEach(card => {
        const idx = parseInt(card.dataset.idx);
        card.querySelector('textarea').addEventListener('input', e => { photos[idx].description = e.target.value; });
        card.querySelector('.remove-btn').addEventListener('click', () => { photos.splice(idx, 1); renderPhotos(); });
      });
    }

    /* Submit */
    container.querySelector('#saSubmit').addEventListener('click', () => submitAudit(container, cfg));
  }

  /* ── Collect ── */
  function collectData(container) {
    const g = id => (container.querySelector('#' + id) || {}).value || '';
    return {
      jobNumber: g('saJobNumber').trim(), client: g('saClient').trim(), site: g('saSite').trim(),
      boardId: g('saBoardId').trim(), location: g('saLocation').trim(),
      auditor: g('saAuditor'), date: g('saDate'),
      items: ALL_ITEMS.map(item => {
        const checked = container.querySelector(`input[name="item_${item.num}"]:checked`);
        return { num: item.num, desc: item.desc, result: checked ? checked.value : null };
      }),
      hazards: Array.from(container.querySelectorAll('#saHazards .sa-dyn-row textarea')).map(ta => ta.value.trim()).filter(Boolean),
      remedial: Array.from(container.querySelectorAll('#saRemedial .sa-dyn-row textarea')).map(ta => ta.value.trim()).filter(Boolean),
      photos,
    };
  }

  function validate(data) {
    if (!data.boardId) return 'Switchboard ID is required';
    if (!data.auditor) return 'Auditor is required';
    if (!data.date) return 'Date is required';
    const un = data.items.filter(i => !i.result);
    if (un.length) return `${un.length} inspection item(s) not answered (item ${un[0].num})`;
    return null;
  }

  /* ── Submit ── */
  async function submitAudit(container, cfg) {
    const data = collectData(container);
    const err = validate(data);
    if (err) { BromarHub.showInfo(err); return; }

    const sb = cfg.supabase;
    const jobNumber = data.jobNumber || cfg.jobNumber || 'STANDALONE';
    BromarHub.showLoading('Generating audit...', 'Creating PDF and saving record');

    try {
      const record = {
        job_number: jobNumber, client_name: data.client, site_name: data.site,
        switchboard_id: data.boardId, location: data.location,
        tested_by: data.auditor, audit_date: data.date,
        inspection_items: data.items, hazards: data.hazards,
        remedial_works: data.remedial, photos: [], status: 'completed',
      };
      const { data: inserted, error: insertErr } = await sb.from(TABLE).insert(record).select('id').single();
      if (insertErr) throw insertErr;
      const recordId = inserted.id;

      const photoPaths = [];
      for (let i = 0; i < photos.length; i++) {
        const p = photos[i]; const ext = p.file.name.split('.').pop() || 'jpg';
        const path = `${jobNumber}/${FOLDER}/${recordId}/photo_${i + 1}.${ext}`;
        const { error: upErr } = await sb.storage.from(BUCKET).upload(path, p.file, { upsert: true });
        if (!upErr) photoPaths.push({ path, description: p.description });
      }
      if (photoPaths.length) await sb.from(TABLE).update({ photos: photoPaths }).eq('id', recordId);

      BromarHub.showLoading('Generating PDF...', 'Please wait');
      const pdfBlob = await generatePDF(data, jobNumber);
      const pdfPath = `${jobNumber}/${FOLDER}/${recordId}.pdf`;
      await sb.storage.from(BUCKET).upload(pdfPath, pdfBlob, { contentType: 'application/pdf', upsert: true });

      BromarHub.hideLoading();
      BromarHub.showSuccess('Switchboard audit saved successfully');
      if (cfg.onComplete) cfg.onComplete();
    } catch (e) {
      console.error('[SwitchboardAudit]', e);
      BromarHub.hideLoading();
      BromarHub.showInfo('Error saving audit: ' + (e.message || e));
    }
  }

  /* ══════════════════════════════════════════════════════════
     PDF GENERATION — Test & Tag branded theme
     ══════════════════════════════════════════════════════════ */
  async function generatePDF(data, jobNumber) {
    await ensureJsPDF();
    const logo = await loadLogo();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    const W = doc.internal.pageSize.getWidth(), M = 14;
    const generated = new Date().toLocaleDateString('en-GB');

    /* Logo sizing */
    let logoW = 0, logoH = 0;
    if (logo) {
      const maxW = 38, maxH = 14, ratio = logo.w / logo.h;
      logoW = maxW; logoH = logoW / ratio;
      if (logoH > maxH) { logoH = maxH; logoW = logoH * ratio; }
    }

    function stamp() {
      doc.setFillColor(...ORANGE); doc.rect(0, 0, W, 3, 'F');
      if (logo) try { doc.addImage(logo.dataUrl, 'PNG', M, 7, logoW, logoH); } catch (_) {}
      const rx = W - M;
      doc.setFont('helvetica', 'bold').setFontSize(8.5).setTextColor(...NAVY);
      doc.text(ORG.name, rx, 8, { align: 'right' });
      doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(...MUTED);
      doc.text(ORG.addr, rx, 12, { align: 'right' });
      doc.text(ORG.phoneRec, rx, 15.5, { align: 'right' });
      doc.text('WEB: ' + ORG.web, rx, 19, { align: 'right' });
      /* Footer */
      doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(...MUTED);
      doc.text(VERSION, M, 290);
      doc.text('Switchboard Inspection Audit', W / 2, 290, { align: 'center' });
      doc.text('Page ' + doc.internal.getNumberOfPages(), W - M, 290, { align: 'right' });
    }

    stamp();
    let y = 28;

    /* Title */
    doc.setFont('helvetica', 'bold').setFontSize(19).setTextColor(...NAVY);
    doc.text('Switchboard Inspection Audit', W / 2, y, { align: 'center' }); y += 9;
    doc.setDrawColor(...ORANGE).setLineWidth(0.8).line(M, y, W - M, y); y += 9;

    /* Job info pairs */
    const colW = W / 2 - M - 5;
    function pairRow(pairs, sy) {
      let maxLines = 1;
      const blocks = pairs.map(([k, v], i) => {
        const x = i === 0 ? M : W / 2;
        const lines = doc.splitTextToSize(v || '\u2014', colW);
        maxLines = Math.max(maxLines, lines.length);
        return { x, k, lines };
      });
      blocks.forEach(b => {
        doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...MUTED);
        doc.text(b.k.toUpperCase(), b.x, sy);
        doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(40, 49, 60);
        doc.text(b.lines, b.x, sy + 4.5);
      });
      return sy + 4.5 + maxLines * 4 + 3;
    }
    y = pairRow([['Client', data.client], ['Site', data.site]], y);
    y = pairRow([['Switchboard ID', data.boardId], ['Location', data.location]], y);
    y = pairRow([['Auditor', data.auditor], ['Date', data.date]], y);
    y = pairRow([['Job Number', jobNumber]], y);
    y += 2;

    /* Summary cards */
    const passCount = data.items.filter(i => i.result === 'pass').length;
    const failCount = data.items.filter(i => i.result === 'fail').length;
    const naCount = data.items.filter(i => i.result === 'na').length;
    const ensure = need => { if (y + need > 280) { doc.addPage(); stamp(); y = 26; } };

    ensure(28);
    doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(...NAVY);
    doc.text('Results Summary', M, y); y += 6;
    const cards = [['Total Items', ALL_ITEMS.length, NAVY], ['Pass', passCount, [29, 122, 92]], ['Fail', failCount, [192, 57, 43]], ['N/A', naCount, MUTED]];
    const cw = (W - 2 * M - 3 * 4) / 4;
    cards.forEach((c, i) => {
      const x = M + i * (cw + 4);
      doc.setFillColor(244, 247, 252).roundedRect(x, y, cw, 16, 2, 2, 'F');
      doc.setFont('helvetica', 'bold').setFontSize(15).setTextColor(...c[2]).text(String(c[1]), x + cw / 2, y + 8, { align: 'center' });
      doc.setFont('helvetica', 'normal').setFontSize(6.5).setTextColor(...MUTED).text(c[0].toUpperCase(), x + cw / 2, y + 13, { align: 'center' });
    });
    y += 24;

    /* Inspection table via autoTable */
    ensure(16);
    doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(...NAVY);
    doc.text('Inspection Items', M, y); y += 5;

    const tableBody = [];
    for (const cat of CATEGORIES) {
      tableBody.push([{ content: cat.name, colSpan: 4, styles: { fontStyle: 'bolditalic', fillColor: [255, 247, 237], textColor: [40, 40, 40], fontSize: 8 } }]);
      for (const item of cat.items) {
        const r = data.items.find(i => i.num === item.num);
        let status = '', statusColor = MUTED;
        if (r?.result === 'pass') { status = '✓ PASS'; statusColor = [29, 122, 92]; }
        else if (r?.result === 'fail') { status = '✗ FAIL'; statusColor = [192, 57, 43]; }
        else if (r?.result === 'na') { status = 'N/A'; statusColor = MUTED; }
        tableBody.push([
          { content: String(item.num), styles: { halign: 'center', fontStyle: 'bold' } },
          item.desc,
          { content: status, styles: { halign: 'center', fontStyle: 'bold', textColor: statusColor } },
        ]);
      }
    }

    doc.autoTable({
      startY: y, margin: { left: M, right: M, top: 22, bottom: 14 },
      head: [['#', 'Description', 'Result']],
      body: tableBody,
      styles: { fontSize: 7.5, cellPadding: 2 },
      headStyles: { fillColor: ORANGE, fontSize: 8 },
      alternateRowStyles: { fillColor: [250, 251, 253] },
      columnStyles: { 0: { cellWidth: 12 }, 2: { cellWidth: 28 } },
      didDrawPage: stamp,
    });
    y = doc.lastAutoTable.finalY + 8;

    /* Hazards */
    if (data.hazards.length > 0) {
      ensure(16);
      doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(...NAVY);
      doc.text('Hazards / Major Non-Compliance', M, y); y += 5;
      doc.autoTable({
        startY: y, margin: { left: M, right: M, top: 22, bottom: 14 },
        head: [['#', 'Description']],
        body: data.hazards.map((h, i) => [i + 1, h]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [176, 106, 23], fontSize: 8 },
        alternateRowStyles: { fillColor: [253, 248, 240] },
        columnStyles: { 0: { cellWidth: 12, halign: 'center' } },
        didDrawPage: stamp,
      });
      y = doc.lastAutoTable.finalY + 8;
    }

    /* Remedial works */
    if (data.remedial.length > 0) {
      ensure(16);
      doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(...NAVY);
      doc.text('Remedial Works Recommended', M, y); y += 5;
      doc.autoTable({
        startY: y, margin: { left: M, right: M, top: 22, bottom: 14 },
        head: [['#', 'Description']],
        body: data.remedial.map((r, i) => [i + 1, r]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: ORANGE, fontSize: 8 },
        alternateRowStyles: { fillColor: [250, 251, 253] },
        columnStyles: { 0: { cellWidth: 12, halign: 'center' } },
        didDrawPage: stamp,
      });
      y = doc.lastAutoTable.finalY + 8;
    }

    /* Photos page */
    if (photos.length > 0) {
      doc.addPage(); stamp(); y = 26;
      doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(...NAVY);
      doc.text('Photos', M, y); y += 8;
      const photoW = 55, photoH = 42, gap = 5, cols = 3;
      for (let i = 0; i < photos.length; i++) {
        const col = i % cols;
        if (col === 0 && i > 0) y += photoH + 18;
        if (y + photoH + 18 > 280) { doc.addPage(); stamp(); y = 26; }
        const px = M + col * (photoW + gap);
        try { doc.addImage(photos[i].dataUrl, 'JPEG', px, y, photoW, photoH); } catch (_) {
          doc.setDrawColor(200); doc.rect(px, y, photoW, photoH);
        }
        if (photos[i].description) {
          doc.setFont('helvetica', 'normal').setFontSize(6.5).setTextColor(...MUTED);
          doc.text(doc.splitTextToSize(photos[i].description, photoW).slice(0, 3), px, y + photoH + 3.5);
        }
      }
    }

    return doc.output('blob');
  }

  return { VERSION, renderForm, collectData, validate, generatePDF, CATEGORIES, ALL_ITEMS };
})();
