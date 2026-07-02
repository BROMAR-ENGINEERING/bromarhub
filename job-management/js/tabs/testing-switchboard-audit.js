/* ── TESTING: Switchboard Audit ── */
(function () {
  const JM = window.JobManager;

  /* ── Inspection checklist ── */
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

  /* ── Photo state ── */
  let photos = [];

  /* ── Load logo as base64 for PDF ── */
  function loadLogoBase64() {
    return new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        c.getContext('2d').drawImage(img, 0, 0);
        resolve(c.toDataURL('image/png'));
      };
      img.onerror = () => resolve(null);
      img.src = '../Bromar-Primary-Logo-Full-Colour.png';
    });
  }

  /* ── Render form ── */
  function renderForm(panel, d, job, goBack) {
    photos = [];
    const jobNumber = JM.state.selectedJob;
    const clientName = job?.client_name || '';
    const siteName = job?.site_name || '';
    const today = new Date().toISOString().split('T')[0];

    /* Build checklist HTML */
    let checklistHtml = '';
    for (const cat of CATEGORIES) {
      checklistHtml += `<tr class="sa-cat-row"><td colspan="4" style="font-weight:700;font-style:italic;padding:10px 8px 6px;color:var(--text-primary);font-size:0.9rem;">${JM.esc(cat.name)}</td></tr>`;
      for (const item of cat.items) {
        checklistHtml += `
          <tr class="sa-item-row">
            <td style="width:40px;text-align:center;font-weight:600;font-size:0.85rem;">${item.num}</td>
            <td style="font-size:0.85rem;padding:6px 8px;">${JM.esc(item.desc)}</td>
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

    panel.innerHTML = `
      <style>
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
      </style>

      <button class="sa-back" id="saBack">← Back to Testing</button>
      <h3 style="font-size:1.1rem;font-weight:700;margin-bottom:1.25rem;">🔌 Switchboard Inspection Audit</h3>

      <!-- Header fields -->
      <div class="section-label">Job Details</div>
      <div class="field-row">
        <div class="field-group"><label>Client</label><input type="text" id="saClient" value="${JM.esc(clientName)}"></div>
        <div class="field-group"><label>Address / Site</label><input type="text" id="saSite" value="${JM.esc(siteName)}"></div>
      </div>
      <div class="field-row">
        <div class="field-group"><label>Switchboard ID <span class="required">*</span></label><input type="text" id="saBoardId" placeholder="e.g. Main Switchboard"></div>
        <div class="field-group"><label>Location</label><input type="text" id="saLocation" placeholder="e.g. Plant Room, Level 1"></div>
      </div>
      <div class="field-row">
        <div class="field-group"><label>Auditor <span class="required">*</span></label><select id="saAuditor"><option value="">Select...</option></select></div>
        <div class="field-group"><label>Date <span class="required">*</span></label><input type="date" id="saDate" value="${today}"></div>
      </div>

      <!-- Inspection items -->
      <div class="section-label">Inspection Items</div>
      <table class="sa-table">
        <thead><tr><th>Item</th><th>Non-Compliance Description</th><th>Pass / Fail</th><th>N/A</th></tr></thead>
        <tbody>${checklistHtml}</tbody>
      </table>

      <!-- Hazards -->
      <div class="section-label">Hazards / Major Non-Compliance Identified</div>
      <div class="sa-dynamic-list" id="saHazards"></div>
      <button class="add-btn" id="saAddHazard">+ Add Hazard</button>

      <!-- Remedial works -->
      <div class="section-label">Remedial Works Recommended</div>
      <div class="sa-dynamic-list" id="saRemedial"></div>
      <button class="add-btn" id="saAddRemedial">+ Add Remedial Work</button>

      <!-- Photos -->
      <div class="section-label">Photos</div>
      <div class="file-upload-area" id="saPhotoArea">
        <div class="upload-icon">📷</div>
        <div class="upload-text">Tap to add photos</div>
        <div class="upload-hint">JPEG, PNG — include photos of non-compliance items</div>
        <input type="file" id="saPhotoInput" accept="image/*" multiple style="display:none;">
      </div>
      <div class="sa-photo-grid" id="saPhotoGrid"></div>

      <!-- Submit -->
      <div class="form-divider"></div>
      <div class="submit-row">
        <button class="submit-btn" id="saSubmit">Submit Audit & Generate PDF</button>
      </div>
    `;

    /* ── Wire events ── */
    panel.querySelector('#saBack').addEventListener('click', goBack);

    /* Populate auditor dropdown */
    const auditorSel = panel.querySelector('#saAuditor');
    (window.EMPLOYEES || []).forEach(e => {
      const o = document.createElement('option');
      o.value = e.full_name;
      o.textContent = e.full_name;
      o.dataset.email = e.email || '';
      auditorSel.appendChild(o);
    });
    if (window.currentUser?.name) auditorSel.value = window.currentUser.name;

    /* Hazards container ref for auto-populate */
    const hazardsContainer = panel.querySelector('#saHazards');

    /* Dynamic list helpers */
    function renumList(container) {
      container.querySelectorAll('.sa-dyn-row').forEach((r, i) => {
        r.querySelector('.sa-dyn-num').textContent = i + 1;
      });
    }

    function addDynRow(container, text, autoItemNum) {
      const row = document.createElement('div');
      row.className = 'sa-dyn-row';
      if (autoItemNum) row.setAttribute('data-auto-item', autoItemNum);
      row.innerHTML = `<span class="sa-dyn-num">1</span><textarea placeholder="Describe...">${JM.esc(text)}</textarea><button class="remove-btn" type="button">✕</button>`;
      row.querySelector('.remove-btn').addEventListener('click', () => { row.remove(); renumList(container); });
      container.appendChild(row);
      renumList(container);
      return row;
    }

    function setupDynamicList(containerId, addBtnId) {
      const container = panel.querySelector('#' + containerId);
      const addBtn = panel.querySelector('#' + addBtnId);
      addBtn.addEventListener('click', () => {
        const row = addDynRow(container, '', null);
        row.querySelector('textarea').focus();
      });
    }
    setupDynamicList('saHazards', 'saAddHazard');
    setupDynamicList('saRemedial', 'saAddRemedial');

    /* ── Auto-populate hazards on fail ── */
    panel.querySelectorAll('.sa-table input[type="radio"]').forEach(radio => {
      radio.addEventListener('change', () => {
        const itemNum = radio.dataset.item;
        const item = ALL_ITEMS.find(i => i.num === parseInt(itemNum));
        if (!item) return;

        /* Remove existing auto-row for this item */
        const existing = hazardsContainer.querySelector(`.sa-dyn-row[data-auto-item="${itemNum}"]`);
        if (existing) { existing.remove(); renumList(hazardsContainer); }

        /* Add new row if fail */
        if (radio.value === 'fail') {
          addDynRow(hazardsContainer, item.desc, itemNum);
        }
      });
    });

    /* Photos */
    const photoArea = panel.querySelector('#saPhotoArea');
    const photoInput = panel.querySelector('#saPhotoInput');
    const photoGrid = panel.querySelector('#saPhotoGrid');

    photoArea.addEventListener('click', () => photoInput.click());
    photoInput.addEventListener('change', handlePhotos);

    function handlePhotos(e) {
      const files = Array.from(e.target.files || []);
      files.forEach(file => {
        const reader = new FileReader();
        reader.onload = ev => {
          photos.push({ file, dataUrl: ev.target.result, description: '' });
          renderPhotos();
        };
        reader.readAsDataURL(file);
      });
      photoInput.value = '';
    }

    function renderPhotos() {
      photoGrid.innerHTML = photos.map((p, i) => `
        <div class="sa-photo-card" data-idx="${i}">
          <img src="${p.dataUrl}" alt="Photo ${i + 1}">
          <textarea placeholder="Description...">${JM.esc(p.description)}</textarea>
          <button class="remove-btn" type="button">Remove</button>
        </div>
      `).join('');
      photoGrid.querySelectorAll('.sa-photo-card').forEach(card => {
        const idx = parseInt(card.dataset.idx);
        card.querySelector('textarea').addEventListener('input', e => { photos[idx].description = e.target.value; });
        card.querySelector('.remove-btn').addEventListener('click', () => { photos.splice(idx, 1); renderPhotos(); });
      });
    }

    /* Submit */
    panel.querySelector('#saSubmit').addEventListener('click', () => submitAudit(panel, goBack));
  }

  /* ── Collect form data ── */
  function collectData(panel) {
    const client = panel.querySelector('#saClient').value.trim();
    const site = panel.querySelector('#saSite').value.trim();
    const boardId = panel.querySelector('#saBoardId').value.trim();
    const location = panel.querySelector('#saLocation').value.trim();
    const auditor = panel.querySelector('#saAuditor').value;
    const date = panel.querySelector('#saDate').value;

    const items = ALL_ITEMS.map(item => {
      const checked = panel.querySelector(`input[name="item_${item.num}"]:checked`);
      return { num: item.num, desc: item.desc, result: checked ? checked.value : null };
    });

    const hazards = [];
    panel.querySelectorAll('#saHazards .sa-dyn-row textarea').forEach(ta => {
      const v = ta.value.trim();
      if (v) hazards.push(v);
    });

    const remedial = [];
    panel.querySelectorAll('#saRemedial .sa-dyn-row textarea').forEach(ta => {
      const v = ta.value.trim();
      if (v) remedial.push(v);
    });

    return { client, site, boardId, location, auditor, date, items, hazards, remedial, photos };
  }

  /* ── Validate ── */
  function validate(data) {
    if (!data.boardId) return 'Switchboard ID is required';
    if (!data.auditor) return 'Auditor is required';
    if (!data.date) return 'Date is required';
    const unanswered = data.items.filter(i => !i.result);
    if (unanswered.length > 0) return `${unanswered.length} inspection item(s) not answered (item ${unanswered[0].num})`;
    return null;
  }

  /* ── Submit ── */
  async function submitAudit(panel, goBack) {
    const data = collectData(panel);
    const err = validate(data);
    if (err) { BromarHub.showInfo(err); return; }

    const jobNumber = JM.state.selectedJob;
    BromarHub.showLoading('Generating audit...', 'Creating PDF and saving record');

    try {
      /* 1. Insert record */
      const record = {
        job_number: jobNumber,
        client_name: data.client,
        site_name: data.site,
        switchboard_id: data.boardId,
        location: data.location,
        tested_by: data.auditor,
        audit_date: data.date,
        inspection_items: data.items,
        hazards: data.hazards,
        remedial_works: data.remedial,
        photos: [],
        status: 'completed',
      };

      const { data: inserted, error: insertErr } = await JM.sb()
        .from('testing_switchboard_audit')
        .insert(record)
        .select('id')
        .single();
      if (insertErr) throw insertErr;
      const recordId = inserted.id;

      /* 2. Upload photos to storage */
      const photoPaths = [];
      for (let i = 0; i < photos.length; i++) {
        const p = photos[i];
        const ext = p.file.name.split('.').pop() || 'jpg';
        const path = `${jobNumber}/switchboard-audit/${recordId}/photo_${i + 1}.${ext}`;
        const { error: upErr } = await JM.sb().storage.from('testing').upload(path, p.file, { upsert: true });
        if (!upErr) photoPaths.push({ path, description: p.description });
      }

      /* 3. Update record with photo paths */
      if (photoPaths.length) {
        await JM.sb().from('testing_switchboard_audit').update({ photos: photoPaths }).eq('id', recordId);
      }

      /* 4. Generate and upload PDF */
      BromarHub.showLoading('Generating PDF...', 'Please wait');
      const pdfBlob = await generatePDF(data, jobNumber, photoPaths);
      const pdfPath = `${jobNumber}/switchboard-audit/${recordId}.pdf`;
      await JM.sb().storage.from('testing').upload(pdfPath, pdfBlob, { contentType: 'application/pdf', upsert: true });

      BromarHub.hideLoading();
      BromarHub.showSuccess('Switchboard audit saved successfully');

      await JM.loadJobData(jobNumber);
      JM.updateCounts();
      goBack();

    } catch (e) {
      console.error('[SwitchboardAudit]', e);
      BromarHub.hideLoading();
      BromarHub.showInfo('Error saving audit: ' + (e.message || e));
    }
  }

  /* ══════════════════════════════════════════════════════════
     PDF GENERATION
     ══════════════════════════════════════════════════════════ */

  async function generatePDF(data, jobNumber, photoPaths) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = 210, H = 297;
    const ML = 15, MR = 15, MT = 15, MB = 20;
    const CW = W - ML - MR;
    let y = MT;
    let pageNum = 1;

    const logoData = await loadLogoBase64();

    function addPage() {
      doc.addPage();
      pageNum++;
      y = MT;
      drawPageHeader(true);
    }

    function checkSpace(needed) {
      if (y + needed > H - MB) addPage();
    }

    function drawPageHeader(compact) {
      const startY = y;
      if (logoData) {
        try { doc.addImage(logoData, 'PNG', ML, y, 50, 18); } catch (_) {}
      }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(40, 40, 40);
      doc.text('BROMAR ELECTRICAL SERVICES', W - MR, y + 4, { align: 'right' });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
      doc.text('2/98-108 WESTERN AVE', W - MR, y + 8, { align: 'right' });
      doc.text('WESTMEADOWS 3049', W - MR, y + 12, { align: 'right' });
      doc.text('PH: (03) 9335 5344', W - MR, y + 17, { align: 'right' });
      doc.text('REC: 40430', W - MR, y + 21, { align: 'right' });
      y = startY + (compact ? 26 : 28);
    }

    function drawLine(x1, yy, x2) {
      doc.setDrawColor(200); doc.setLineWidth(0.3); doc.line(x1, yy, x2, yy);
    }

    /* ── Page 1: Header + Job info + Inspection table ── */
    drawPageHeader(false);

    doc.setFillColor(234, 88, 12);
    doc.rect(ML, y, CW, 9, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(255, 255, 255);
    doc.text('SWITCHBOARD INSPECTION AUDIT', W / 2, y + 6.5, { align: 'center' });
    y += 13;

    doc.setFontSize(8.5); doc.setTextColor(40, 40, 40);
    const infoRows = [
      ['CLIENT:', data.client],
      ['ADDRESS:', data.site],
      ['SWITCHBOARD ID:', data.boardId],
      ['LOCATION:', data.location],
      ['AUDITOR:', data.auditor],
      ['DATE:', data.date],
    ];
    for (const [label, val] of infoRows) {
      doc.setFont('helvetica', 'bold');
      doc.text(label, ML, y + 4);
      doc.setFont('helvetica', 'normal');
      doc.text(val || '', ML + 35, y + 4);
      drawLine(ML + 35, y + 5.5, W - MR);
      y += 7;
    }
    y += 4;

    /* Inspection table */
    const colX = { item: ML, desc: ML + 14, pf: W - MR - 30, na: W - MR - 12 };

    function drawTableHeader() {
      checkSpace(10);
      doc.setFillColor(240, 240, 240);
      doc.rect(ML, y, CW, 7, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(80, 80, 80);
      doc.text('ITEM', colX.item + 1, y + 5);
      doc.text('NON-COMPLIANCE DESCRIPTION', colX.desc, y + 5);
      doc.text('PASS/FAIL', colX.pf, y + 5);
      doc.text('N/A', colX.na + 2, y + 5);
      y += 8;
    }

    drawTableHeader();

    for (const cat of CATEGORIES) {
      checkSpace(14);
      doc.setFont('helvetica', 'bolditalic'); doc.setFontSize(8); doc.setTextColor(40, 40, 40);
      doc.text(cat.name, colX.desc, y + 4);
      drawLine(ML, y + 5.5, W - MR);
      y += 7;

      for (const item of cat.items) {
        doc.setFontSize(7.5);
        const lines = doc.splitTextToSize(item.desc, colX.pf - colX.desc - 4);
        const rowH = Math.max(6.5, lines.length * 3.5 + 3);
        checkSpace(rowH + 1);

        doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(80, 80, 80);
        doc.text(String(item.num), colX.item + 5, y + 4, { align: 'center' });

        doc.setFont('helvetica', 'normal'); doc.setTextColor(40, 40, 40);
        doc.text(lines, colX.desc, y + 4);

        const result = data.items.find(i => i.num === item.num)?.result;
        doc.setFontSize(9);
        if (result === 'pass') {
          doc.setTextColor(21, 128, 61); doc.setFont('helvetica', 'bold');
          doc.text('✓', colX.pf + 8, y + 4.5, { align: 'center' });
        } else if (result === 'fail') {
          doc.setTextColor(220, 38, 38); doc.setFont('helvetica', 'bold');
          doc.text('✗', colX.pf + 8, y + 4.5, { align: 'center' });
        } else if (result === 'na') {
          doc.setTextColor(120, 120, 120); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
          doc.text('✓', colX.na + 5, y + 4.5, { align: 'center' });
        }

        y += rowH;
        drawLine(ML, y, W - MR);
        y += 0.5;
      }
    }

    /* Hazards section */
    if (data.hazards.length > 0) {
      checkSpace(20); y += 4;
      doc.setFillColor(234, 88, 12); doc.rect(ML, y, CW, 8, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(255, 255, 255);
      doc.text('HAZARDS / MAJOR NON-COMPLIANCE IDENTIFIED', W / 2, y + 5.5, { align: 'center' });
      y += 11;

      doc.setTextColor(40, 40, 40);
      for (let i = 0; i < data.hazards.length; i++) {
        doc.setFontSize(7.5);
        const lines = doc.splitTextToSize(data.hazards[i], CW - 14);
        const rowH = Math.max(7, lines.length * 3.5 + 3);
        checkSpace(rowH + 1);
        doc.setFont('helvetica', 'bold');
        doc.text(String(i + 1), ML + 5, y + 4, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.text(lines, ML + 12, y + 4);
        y += rowH; drawLine(ML, y, W - MR); y += 0.5;
      }
    }

    /* Remedial works section */
    if (data.remedial.length > 0) {
      checkSpace(20); y += 4;
      doc.setFillColor(234, 88, 12); doc.rect(ML, y, CW, 8, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(255, 255, 255);
      doc.text('REMEDIAL WORKS RECOMMENDED', W / 2, y + 5.5, { align: 'center' });
      y += 11;

      doc.setTextColor(40, 40, 40);
      for (let i = 0; i < data.remedial.length; i++) {
        doc.setFontSize(7.5);
        const lines = doc.splitTextToSize(data.remedial[i], CW - 14);
        const rowH = Math.max(7, lines.length * 3.5 + 3);
        checkSpace(rowH + 1);
        doc.setFont('helvetica', 'bold');
        doc.text(String(i + 1), ML + 5, y + 4, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.text(lines, ML + 12, y + 4);
        y += rowH; drawLine(ML, y, W - MR); y += 0.5;
      }
    }

    /* Photos page */
    if (photos.length > 0) {
      addPage(); y += 4;
      const photoW = 55, photoH = 42, gap = 5, cols = 3;

      for (let i = 0; i < photos.length; i++) {
        const col = i % cols;
        if (col === 0 && i > 0) y += photoH + 18;
        checkSpace(photoH + 18);

        const px = ML + col * (photoW + gap);
        try {
          doc.addImage(photos[i].dataUrl, 'JPEG', px, y, photoW, photoH);
        } catch (_) {
          doc.setDrawColor(200); doc.rect(px, y, photoW, photoH);
          doc.setFontSize(7); doc.setTextColor(150);
          doc.text('Image', px + photoW / 2, y + photoH / 2, { align: 'center' });
        }

        if (photos[i].description) {
          doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(80, 80, 80);
          const descLines = doc.splitTextToSize(photos[i].description, photoW);
          doc.text(descLines.slice(0, 3), px, y + photoH + 3.5);
        }
      }
    }

    /* Page numbers + revision */
    const SA_VERSION = 'V1.01';
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(150, 150, 150);
      doc.text(SA_VERSION, ML, H - 10);
      doc.text(`${p}/${totalPages}`, W - MR, H - 10, { align: 'right' });
    }

    return doc.output('blob');
  }

  /* ── Register with testing tab ── */
  if (!JM._testForms) JM._testForms = {};
  JM._testForms['switchboard_audit'] = renderForm;

})();
