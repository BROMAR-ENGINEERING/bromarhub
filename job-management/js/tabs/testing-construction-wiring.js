/* ── TESTING: Construction Wiring (AS3012) ── */
(function () {
  const JM = window.JobManager;

  /* ── Inspection checklist ── */
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
      checklistHtml += `<tr class="cw-cat-row"><td colspan="4" style="font-weight:700;font-style:italic;padding:10px 8px 6px;color:var(--text-primary);font-size:0.9rem;">${JM.esc(cat.name)}</td></tr>`;
      for (const item of cat.items) {
        checklistHtml += `
          <tr class="cw-item-row">
            <td style="width:40px;text-align:center;font-weight:600;font-size:0.85rem;">${item.num}</td>
            <td style="font-size:0.85rem;padding:6px 8px;">${JM.esc(item.desc)}</td>
            <td style="width:70px;text-align:center;">
              <div class="cw-radio-group">
                <label class="cw-radio pass"><input type="radio" name="cw_item_${item.num}" value="pass"><span>✓</span></label>
                <label class="cw-radio fail"><input type="radio" name="cw_item_${item.num}" value="fail"><span>✗</span></label>
              </div>
            </td>
            <td style="width:50px;text-align:center;">
              <label class="cw-radio na"><input type="radio" name="cw_item_${item.num}" value="na"><span>N/A</span></label>
            </td>
          </tr>`;
      }
    }

    panel.innerHTML = `
      <style>
        .cw-back{display:inline-flex;align-items:center;gap:6px;font-size:0.85rem;font-weight:600;color:var(--accent);cursor:pointer;margin-bottom:1.25rem;background:none;border:none;padding:4px 0;}
        .cw-back:hover{text-decoration:underline;}
        .cw-table{width:100%;border-collapse:collapse;margin-bottom:1.5rem;}
        .cw-table th{background:var(--bg-main);font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-secondary);padding:8px;text-align:left;border-bottom:2px solid var(--border);}
        .cw-item-row td{border-bottom:1px solid var(--border);vertical-align:middle;}
        .cw-cat-row td{border-bottom:1px solid var(--border);background:var(--bg-main);}
        .cw-radio-group{display:flex;gap:4px;justify-content:center;}
        .cw-radio{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:6px;cursor:pointer;border:1px solid var(--border);transition:all 0.15s;font-size:0.8rem;}
        .cw-radio input{position:absolute;opacity:0;pointer-events:none;}
        .cw-radio span{font-weight:700;}
        .cw-radio.pass:has(input:checked){background:#d1fae5;border-color:#15803d;color:#15803d;}
        .cw-radio.fail:has(input:checked){background:#fee2e2;border-color:#dc2626;color:#dc2626;}
        .cw-radio.na:has(input:checked){background:var(--bg-main);border-color:var(--accent);color:var(--accent);}
        .cw-dynamic-list .cw-dyn-row{display:flex;gap:8px;align-items:flex-start;margin-bottom:8px;}
        .cw-dyn-row span.cw-dyn-num{min-width:24px;height:36px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.85rem;color:var(--text-secondary);}
        .cw-dyn-row textarea{flex:1;min-height:56px;padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-family:'Outfit',sans-serif;font-size:0.85rem;background:var(--bg-secondary);color:var(--text-primary);resize:vertical;}
        .cw-dyn-row .remove-btn{margin-top:6px;}
        .cw-photo-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:1rem;margin-top:1rem;}
        .cw-photo-card{border:1px solid var(--border);border-radius:10px;overflow:hidden;background:var(--bg-secondary);}
        .cw-photo-card img{width:100%;height:140px;object-fit:cover;display:block;}
        .cw-photo-card textarea{width:100%;border:none;border-top:1px solid var(--border);padding:8px;font-family:'Outfit',sans-serif;font-size:0.8rem;resize:none;min-height:50px;background:var(--bg-secondary);color:var(--text-primary);}
        .cw-photo-card .remove-btn{width:100%;text-align:center;padding:6px;border-top:1px solid var(--border);}
      </style>

      <button class="cw-back" id="cwBack">← Back to Testing</button>
      <h3 style="font-size:1.1rem;font-weight:700;margin-bottom:1.25rem;">🔧 Construction Wiring Inspection (AS3012)</h3>

      <!-- Header fields -->
      <div class="section-label">Job Details</div>
      <div class="field-row">
        <div class="field-group"><label>Client</label><input type="text" id="cwClient" value="${JM.esc(clientName)}"></div>
        <div class="field-group"><label>Site Address</label><input type="text" id="cwSite" value="${JM.esc(siteName)}"></div>
      </div>
      <div class="field-row">
        <div class="field-group"><label>Area / Section</label><input type="text" id="cwArea" placeholder="e.g. Shed 3, Level 2"></div>
        <div class="field-group"><label>Switchboard ID</label><input type="text" id="cwBoardId" placeholder="e.g. DB-01"></div>
      </div>
      <div class="field-row">
        <div class="field-group"><label>Inspector <span class="required">*</span></label><select id="cwInspector"><option value="">Select...</option></select></div>
        <div class="field-group"><label>Date <span class="required">*</span></label><input type="date" id="cwDate" value="${today}"></div>
      </div>

      <!-- Inspection items -->
      <div class="section-label">Inspection Items</div>
      <table class="cw-table">
        <thead><tr><th>Item</th><th>Description</th><th>Pass / Fail</th><th>N/A</th></tr></thead>
        <tbody>${checklistHtml}</tbody>
      </table>

      <!-- Non-compliance -->
      <div class="section-label">Non-Compliance / Issues Identified</div>
      <div class="cw-dynamic-list" id="cwIssues"></div>
      <button class="add-btn" id="cwAddIssue">+ Add Issue</button>

      <!-- Corrective actions -->
      <div class="section-label">Corrective Actions Required</div>
      <div class="cw-dynamic-list" id="cwActions"></div>
      <button class="add-btn" id="cwAddAction">+ Add Corrective Action</button>

      <!-- Photos -->
      <div class="section-label">Photos</div>
      <div class="file-upload-area" id="cwPhotoArea">
        <div class="upload-icon">📷</div>
        <div class="upload-text">Tap to add photos</div>
        <div class="upload-hint">JPEG, PNG — include photos of non-compliance items</div>
        <input type="file" id="cwPhotoInput" accept="image/*" multiple style="display:none;">
      </div>
      <div class="cw-photo-grid" id="cwPhotoGrid"></div>

      <!-- Submit -->
      <div class="form-divider"></div>
      <div class="submit-row">
        <button class="submit-btn" id="cwSubmit">Submit Inspection & Generate PDF</button>
      </div>
    `;

    /* ── Wire events ── */
    panel.querySelector('#cwBack').addEventListener('click', goBack);

    /* Populate inspector dropdown */
    const inspectorSel = panel.querySelector('#cwInspector');
    (window.EMPLOYEES || []).forEach(e => {
      const o = document.createElement('option');
      o.value = e.full_name;
      o.textContent = e.full_name;
      o.dataset.email = e.email || '';
      inspectorSel.appendChild(o);
    });
    if (window.currentUser?.name) inspectorSel.value = window.currentUser.name;

    /* Dynamic lists */
    function setupDynamicList(containerId, addBtnId) {
      const container = panel.querySelector('#' + containerId);
      const addBtn = panel.querySelector('#' + addBtnId);
      function renum() {
        container.querySelectorAll('.cw-dyn-row').forEach((r, i) => {
          r.querySelector('.cw-dyn-num').textContent = i + 1;
        });
      }
      addBtn.addEventListener('click', () => {
        const row = document.createElement('div');
        row.className = 'cw-dyn-row';
        row.innerHTML = `<span class="cw-dyn-num">1</span><textarea placeholder="Describe..."></textarea><button class="remove-btn" type="button">✕</button>`;
        row.querySelector('.remove-btn').addEventListener('click', () => { row.remove(); renum(); });
        container.appendChild(row);
        renum();
        row.querySelector('textarea').focus();
      });
    }
    setupDynamicList('cwIssues', 'cwAddIssue');
    setupDynamicList('cwActions', 'cwAddAction');

    /* Photos */
    const photoArea = panel.querySelector('#cwPhotoArea');
    const photoInput = panel.querySelector('#cwPhotoInput');
    const photoGrid = panel.querySelector('#cwPhotoGrid');

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
        <div class="cw-photo-card" data-idx="${i}">
          <img src="${p.dataUrl}" alt="Photo ${i + 1}">
          <textarea placeholder="Description...">${JM.esc(p.description)}</textarea>
          <button class="remove-btn" type="button">Remove</button>
        </div>
      `).join('');
      photoGrid.querySelectorAll('.cw-photo-card').forEach(card => {
        const idx = parseInt(card.dataset.idx);
        card.querySelector('textarea').addEventListener('input', e => { photos[idx].description = e.target.value; });
        card.querySelector('.remove-btn').addEventListener('click', () => { photos.splice(idx, 1); renderPhotos(); });
      });
    }

    /* Submit */
    panel.querySelector('#cwSubmit').addEventListener('click', () => submitInspection(panel, goBack));
  }

  /* ── Collect form data ── */
  function collectData(panel) {
    return {
      client: panel.querySelector('#cwClient').value.trim(),
      site: panel.querySelector('#cwSite').value.trim(),
      area: panel.querySelector('#cwArea').value.trim(),
      boardId: panel.querySelector('#cwBoardId').value.trim(),
      inspector: panel.querySelector('#cwInspector').value,
      date: panel.querySelector('#cwDate').value,
      items: ALL_ITEMS.map(item => {
        const checked = panel.querySelector(`input[name="cw_item_${item.num}"]:checked`);
        return { num: item.num, desc: item.desc, result: checked ? checked.value : null };
      }),
      issues: Array.from(panel.querySelectorAll('#cwIssues .cw-dyn-row textarea')).map(ta => ta.value.trim()).filter(Boolean),
      actions: Array.from(panel.querySelectorAll('#cwActions .cw-dyn-row textarea')).map(ta => ta.value.trim()).filter(Boolean),
      photos,
    };
  }

  /* ── Validate ── */
  function validate(data) {
    if (!data.inspector) return 'Inspector is required';
    if (!data.date) return 'Date is required';
    const unanswered = data.items.filter(i => !i.result);
    if (unanswered.length > 0) return `${unanswered.length} inspection item(s) not answered (item ${unanswered[0].num})`;
    return null;
  }

  /* ── Submit ── */
  async function submitInspection(panel, goBack) {
    const data = collectData(panel);
    const err = validate(data);
    if (err) { BromarHub.showInfo(err); return; }

    const jobNumber = JM.state.selectedJob;
    BromarHub.showLoading('Generating inspection...', 'Creating PDF and saving record');

    try {
      /* 1. Insert record */
      const record = {
        job_number: jobNumber,
        client_name: data.client,
        site_name: data.site,
        area: data.area,
        switchboard_id: data.boardId,
        tested_by: data.inspector,
        inspection_date: data.date,
        inspection_items: data.items,
        issues: data.issues,
        corrective_actions: data.actions,
        photos: [],
        status: 'completed',
      };

      const { data: inserted, error: insertErr } = await JM.sb()
        .from('testing_construction_wiring')
        .insert(record)
        .select('id')
        .single();
      if (insertErr) throw insertErr;
      const recordId = inserted.id;

      /* 2. Upload photos */
      const photoPaths = [];
      for (let i = 0; i < photos.length; i++) {
        const p = photos[i];
        const ext = p.file.name.split('.').pop() || 'jpg';
        const path = `${jobNumber}/construction-wiring/${recordId}/photo_${i + 1}.${ext}`;
        const { error: upErr } = await JM.sb().storage.from('testing').upload(path, p.file, { upsert: true });
        if (!upErr) photoPaths.push({ path, description: p.description });
      }

      /* 3. Update record with photo paths */
      if (photoPaths.length) {
        await JM.sb().from('testing_construction_wiring').update({ photos: photoPaths }).eq('id', recordId);
      }

      /* 4. Generate and upload PDF */
      BromarHub.showLoading('Generating PDF...', 'Please wait');
      const pdfBlob = await generatePDF(data, jobNumber);
      const pdfPath = `${jobNumber}/construction-wiring/${recordId}.pdf`;
      await JM.sb().storage.from('testing').upload(pdfPath, pdfBlob, { contentType: 'application/pdf', upsert: true });

      BromarHub.hideLoading();
      BromarHub.showSuccess('Construction wiring inspection saved successfully');

      await JM.loadJobData(jobNumber);
      JM.updateCounts();
      goBack();

    } catch (e) {
      console.error('[ConstructionWiring]', e);
      BromarHub.hideLoading();
      BromarHub.showInfo('Error saving inspection: ' + (e.message || e));
    }
  }

  /* ══════════════════════════════════════════════════════════
     PDF GENERATION
     ══════════════════════════════════════════════════════════ */

  async function generatePDF(data, jobNumber) {
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

    function drawSectionBar(title) {
      checkSpace(14);
      y += 4;
      doc.setFillColor(234, 88, 12);
      doc.rect(ML, y, CW, 8, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(255, 255, 255);
      doc.text(title, W / 2, y + 5.5, { align: 'center' });
      y += 11;
    }

    function drawNumberedList(list) {
      doc.setTextColor(40, 40, 40);
      for (let i = 0; i < list.length; i++) {
        doc.setFontSize(7.5);
        const lines = doc.splitTextToSize(list[i], CW - 14);
        const rowH = Math.max(7, lines.length * 3.5 + 3);
        checkSpace(rowH + 1);
        doc.setFont('helvetica', 'bold');
        doc.text(String(i + 1), ML + 5, y + 4, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.text(lines, ML + 12, y + 4);
        y += rowH;
        drawLine(ML, y, W - MR);
        y += 0.5;
      }
    }

    /* ── Page 1: Header + Job info ── */
    drawPageHeader(false);

    /* Title bar */
    doc.setFillColor(234, 88, 12);
    doc.rect(ML, y, CW, 9, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(255, 255, 255);
    doc.text('CONSTRUCTION WIRING INSPECTION (AS3012)', W / 2, y + 6.5, { align: 'center' });
    y += 13;

    /* Job info */
    doc.setFontSize(8.5); doc.setTextColor(40, 40, 40);
    const infoRows = [
      ['CLIENT:', data.client],
      ['SITE ADDRESS:', data.site],
      ['AREA / SECTION:', data.area],
      ['SWITCHBOARD ID:', data.boardId],
      ['INSPECTOR:', data.inspector],
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

    /* ── Inspection table ── */
    const colX = { item: ML, desc: ML + 14, pf: W - MR - 30, na: W - MR - 12 };

    function drawTableHeader() {
      checkSpace(10);
      doc.setFillColor(240, 240, 240);
      doc.rect(ML, y, CW, 7, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(80, 80, 80);
      doc.text('ITEM', colX.item + 1, y + 5);
      doc.text('DESCRIPTION', colX.desc, y + 5);
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

    /* ── Issues section ── */
    if (data.issues.length > 0) {
      drawSectionBar('NON-COMPLIANCE / ISSUES IDENTIFIED');
      drawNumberedList(data.issues);
    }

    /* ── Corrective actions section ── */
    if (data.actions.length > 0) {
      drawSectionBar('CORRECTIVE ACTIONS REQUIRED');
      drawNumberedList(data.actions);
    }

    /* ── Photos page ── */
    if (photos.length > 0) {
      addPage();
      y += 4;
      const photoW = 55, photoH = 42, gap = 5;
      const cols = 3;

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

    /* ── Page numbers + revision ── */
    const CW_VERSION = 'V1.00';
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(150, 150, 150);
      doc.text(CW_VERSION, ML, H - 10);
      doc.text(`${p}/${totalPages}`, W - MR, H - 10, { align: 'right' });
    }

    return doc.output('blob');
  }

  /* ── Register with testing tab ── */
  if (!JM._testForms) JM._testForms = {};
  JM._testForms['construction_wiring'] = renderForm;

})();
