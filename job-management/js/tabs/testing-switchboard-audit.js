/* ── TAB: Testing ── */
(function () {
  const JM = window.JobManager;

  const TEST_TYPES = [
    { key: 'switchboard_audit',      label: 'Switchboard Audit',      icon: '🔌', table: 'testing_switchboard_audit',      folder: 'switchboard-audit' },
    { key: 'construction_wiring',    label: 'Construction Wiring',    icon: '🔧', table: 'testing_construction_wiring',    folder: 'construction-wiring' },
    { key: 'circuit_testing',        label: 'Circuit Testing',        icon: '⚡', table: 'testing_circuit',               folder: 'circuit-testing' },
    { key: 'switchboard_itc',        label: 'Switchboard ITC',        icon: '📋', table: 'testing_switchboard_itc',        folder: 'switchboard-itc' },
    { key: 'field_device_itc',       label: 'Field Device ITC',       icon: '📡', table: 'testing_field_device_itc',       folder: 'field-device-itc' },
  ];

  /* ── Switchboard Audit inspection items (mirrors the Bromar audit sheet) ── */
  const SWB_SECTIONS = [
    { section: 'General Access & Location', items: [
      '600mm radius of door opening obtained',
      'Obstructions to door opening',
      'Lockable to restrict unauthorized personnel',
    ]},
    { section: 'Labelling', items: [
      'Switchboard identification label',
      'Sub circuits labelling / schedule',
      'Main switch/isolator label',
      'Emergency lighting labels',
      'Solar warning labels',
    ]},
    { section: 'Enclosure', items: [
      'Enclosure condition',
      'Pole Fillers',
      'Enclosure fixings',
      'No openings bigger than 5mm',
      'Seals and gaskets satisfactory',
      'Is the degree of IP protection maintained',
      'No undue accumulation of dust and dirt',
      'Fire rating maintained where required',
      'Adequate protection of equipment and cables against corrosion, the weather, vibration and other adverse factors',
    ]},
    { section: 'Cabling', items: [
      'Cables entering board have adequate mechanical protection',
      'Cables on sharp edges',
    ]},
    { section: 'Glandplate', items: [
      'Non-Ferrous material used',
      'Glandplate and glands all tight & secured',
    ]},
    { section: 'Switchgear', items: [
      'Discrimination/Coordination',
      'Switchgear selection (suited to switchboard)',
      'Switchgear orientation',
      'Switchgear condition',
    ]},
    { section: 'Chassis & Busbars', items: [
      'Insulation on busbars in good condition',
      'Phase to earth clearance',
      'Phase to phase clearance',
      'Shrouds fitted',
    ]},
    { section: 'Terminations', items: [
      'Exposed copper on terminations',
      'Loose connections',
      'Visual indications',
    ]},
    { section: 'Residual Current Devices', items: [
      'Fitted where required',
      'Correct milli-amp rating',
      'Test buttons operational',
    ]},
    { section: 'Overcurrent Protection', items: [
      'Ensure all protection settings/sizes are as minimum',
    ]},
  ];

  /* Flat ordered list of items with their global 1-based number */
  const SWB_ITEMS = (() => {
    const flat = [];
    let n = 0;
    SWB_SECTIONS.forEach(sec => {
      sec.items.forEach(label => { n += 1; flat.push({ num: n, section: sec.section, label }); });
    });
    return flat;
  })();
  const SWB_ITEM_COUNT = SWB_ITEMS.length;

  /* ── Fetch completed tests across all type tables ── */
  async function loadCompletedTests(jobNumber) {
    const sb = JM.sb();
    const results = [];
    for (const t of TEST_TYPES) {
      try {
        const { data, error } = await sb
          .from(t.table)
          .select('id, created_at, tested_by, status, site_name')
          .eq('job_number', jobNumber)
          .order('created_at', { ascending: false });
        if (!error && data) {
          data.forEach(row => results.push({ ...row, _type: t }));
        }
      } catch (_) { /* table may not exist yet */ }
    }
    results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return results;
  }

  JM.registerTool('testing', {
    label: 'Testing', icon: '🧪',
    count: d => d.testing.length,

    async render(panel, d, job) {
      const jobNumber = JM.state.selectedJob;

      /* ── Landing page ── */
      panel.innerHTML = `
        <div style="margin-bottom:2rem;">
          <h3 style="font-size:1.1rem;font-weight:700;margin-bottom:1.25rem;display:flex;align-items:center;gap:8px;">
            🧪 Testing
          </h3>

          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:0.75rem;margin-bottom:2rem;">
            ${TEST_TYPES.map(t => `
              <button class="tool-card test-type-btn" data-type="${t.key}"
                style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:1.25rem 0.75rem;cursor:pointer;border:1px solid var(--border);border-radius:12px;background:var(--bg-secondary);transition:all 0.2s;">
                <span style="font-size:1.75rem;">${t.icon}</span>
                <span style="font-size:0.85rem;font-weight:600;text-align:center;color:var(--text-primary);">${JM.esc(t.label)}</span>
              </button>
            `).join('')}
          </div>

          <h4 style="font-size:0.95rem;font-weight:700;margin-bottom:0.75rem;color:var(--text-secondary);">Completed Tests</h4>
          <div id="testingCompletedList">
            <div class="empty-state" style="padding:2rem;text-align:center;color:var(--text-secondary);font-size:0.9rem;">Loading...</div>
          </div>
        </div>
      `;

      /* ── Wire test type buttons ── */
      panel.querySelectorAll('.test-type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const key = btn.dataset.type;
          const type = TEST_TYPES.find(t => t.key === key);
          if (!type) return;
          /* Each test type module will register a builder function here */
          if (JM._testForms && JM._testForms[key]) {
            JM._testForms[key](panel, d, job, () => JM.renderTool('testing'));
          } else {
            BromarHub.showInfo(`${type.label} form is not built yet`);
          }
        });
      });

      /* ── Load and render completed tests ── */
      const completed = await loadCompletedTests(jobNumber);
      const listEl = document.getElementById('testingCompletedList');
      if (!listEl) return;

      if (completed.length === 0) {
        listEl.innerHTML = `<div class="empty-state" style="padding:2rem;text-align:center;color:var(--text-secondary);font-size:0.9rem;">No test sheets recorded yet</div>`;
        return;
      }

      listEl.innerHTML = completed.map(row => {
        const t = row._type;
        const date = JM.fmtDate(row.created_at);
        const status = row.status || 'completed';
        return `
          <div class="tool-card" style="display:flex;align-items:center;gap:0.75rem;padding:0.875rem 1rem;margin-bottom:0.5rem;cursor:pointer;border-radius:10px;" data-type="${t.key}" data-id="${row.id}">
            <span style="font-size:1.25rem;">${t.icon}</span>
            <div style="flex:1;min-width:0;">
              <div style="font-weight:600;font-size:0.9rem;color:var(--text-primary);">${JM.esc(t.label)}</div>
              <div style="font-size:0.78rem;color:var(--text-secondary);">${date}${row.site_name ? ' · ' + JM.esc(row.site_name) : ''}${row.tested_by ? ' · ' + JM.esc(row.tested_by) : ''}</div>
            </div>
            ${JM.statusBadge(status)}
          </div>`;
      }).join('');

      /* ── Wire completed test rows (view/open PDF) ── */
      listEl.querySelectorAll('.tool-card').forEach(card => {
        card.addEventListener('click', () => {
          const key = card.dataset.type;
          const id = card.dataset.id;
          const type = TEST_TYPES.find(t => t.key === key);
          if (!type) return;
          /* Try to open the PDF from storage */
          const pdfPath = `${jobNumber}/${type.folder}/${id}.pdf`;
          JM.openSignedFile('testing', pdfPath);
        });
      });
    }
  });

  /* ── Registry for test form builders ── */
  if (!JM._testForms) JM._testForms = {};

  /* ════════════════════════════════════════════════════════════════════
     SWITCHBOARD AUDIT FORM
     ════════════════════════════════════════════════════════════════════ */

  /* Lazy-load jsPDF once, cached on window */
  function loadJsPDF() {
    if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
    if (window._jspdfLoading) return window._jspdfLoading;
    window._jspdfLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      s.onload = () => {
        if (window.jspdf && window.jspdf.jsPDF) resolve(window.jspdf.jsPDF);
        else reject(new Error('jsPDF failed to initialise'));
      };
      s.onerror = () => reject(new Error('Failed to load jsPDF'));
      document.head.appendChild(s);
    });
    return window._jspdfLoading;
  }

  /* Read a File into a data URL */
  function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
  }

  /* Load an image into an <img> so we can read natural dimensions */
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('image load failed'));
      img.src = src;
    });
  }

  /* In-memory state for the form while it's open */
  function newAuditState() {
    return {
      header: { client: '', address: '', switchboard_id: '', location: '', auditor: '', audit_date: '' },
      items: {},                 // num -> 'pass' | 'fail' | 'na'
      hazards: ['', '', '', '', ''],
      remedial: ['', '', '', '', ''],
      photos: [],                // { name, dataUrl, file }
    };
  }

  /* ── Build & wire the form ── */
  JM._testForms['switchboard_audit'] = function (panel, d, job, onBack) {
    const jobNumber = JM.state.selectedJob;
    const st = newAuditState();

    /* Prefill what we sensibly can from the job */
    if (job) {
      st.header.client = job.client || job.client_name || '';
      st.header.address = job.site_address || job.address || '';
      st.header.location = job.site_name || '';
    }
    st.header.audit_date = new Date().toISOString().slice(0, 10);

    const rowFor = (it) => `
      <tr data-num="${it.num}">
        <td style="text-align:center;font-weight:600;width:48px;">${it.num}</td>
        <td>${JM.esc(it.label)}</td>
        <td style="text-align:center;white-space:nowrap;">
          <label style="margin-right:8px;cursor:pointer;"><input type="radio" name="swb-item-${it.num}" value="pass"> ✓</label>
          <label style="margin-right:8px;cursor:pointer;"><input type="radio" name="swb-item-${it.num}" value="fail"> ✕</label>
          <label style="cursor:pointer;"><input type="radio" name="swb-item-${it.num}" value="na"> N/A</label>
        </td>
      </tr>`;

    let itemsHtml = '';
    SWB_SECTIONS.forEach(sec => {
      itemsHtml += `<tr><td colspan="3" style="font-style:italic;font-weight:700;background:var(--bg-secondary);padding:6px 10px;">${JM.esc(sec.section)}</td></tr>`;
      itemsHtml += sec.items.map((label) => {
        const it = SWB_ITEMS.find(x => x.label === label);
        return rowFor(it);
      }).join('');
    });

    const fieldsHtml = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:0.75rem;margin-bottom:1.5rem;">
        <label style="font-size:0.85rem;font-weight:600;color:var(--text-secondary);">Client
          <input id="swb-client" type="text" value="${JM.esc(st.header.client)}" style="display:block;width:100%;margin-top:4px;padding:8px;border:1px solid var(--border);border-radius:8px;background:var(--bg-secondary);color:var(--text-primary);font-weight:400;">
        </label>
        <label style="font-size:0.85rem;font-weight:600;color:var(--text-secondary);">Address
          <input id="swb-address" type="text" value="${JM.esc(st.header.address)}" style="display:block;width:100%;margin-top:4px;padding:8px;border:1px solid var(--border);border-radius:8px;background:var(--bg-secondary);color:var(--text-primary);font-weight:400;">
        </label>
        <label style="font-size:0.85rem;font-weight:600;color:var(--text-secondary);">Switchboard ID
          <input id="swb-id" type="text" value="${JM.esc(st.header.switchboard_id)}" style="display:block;width:100%;margin-top:4px;padding:8px;border:1px solid var(--border);border-radius:8px;background:var(--bg-secondary);color:var(--text-primary);font-weight:400;">
        </label>
        <label style="font-size:0.85rem;font-weight:600;color:var(--text-secondary);">Location
          <input id="swb-location" type="text" value="${JM.esc(st.header.location)}" style="display:block;width:100%;margin-top:4px;padding:8px;border:1px solid var(--border);border-radius:8px;background:var(--bg-secondary);color:var(--text-primary);font-weight:400;">
        </label>
        <label style="font-size:0.85rem;font-weight:600;color:var(--text-secondary);">Auditor
          <input id="swb-auditor" type="text" value="${JM.esc(st.header.auditor)}" style="display:block;width:100%;margin-top:4px;padding:8px;border:1px solid var(--border);border-radius:8px;background:var(--bg-secondary);color:var(--text-primary);font-weight:400;">
        </label>
        <label style="font-size:0.85rem;font-weight:600;color:var(--text-secondary);">Date
          <input id="swb-date" type="date" value="${JM.esc(st.header.audit_date)}" style="display:block;width:100%;margin-top:4px;padding:8px;border:1px solid var(--border);border-radius:8px;background:var(--bg-secondary);color:var(--text-primary);font-weight:400;">
        </label>
      </div>`;

    const listBlock = (title, idPrefix, arr) => `
      <h4 style="font-size:0.95rem;font-weight:700;margin:1.5rem 0 0.5rem;color:var(--text-secondary);">${title}</h4>
      <div id="${idPrefix}-list">
        ${arr.map((v, i) => `
          <input type="text" data-i="${i}" value="${JM.esc(v)}" placeholder="${i + 1}."
            style="display:block;width:100%;margin-bottom:6px;padding:8px;border:1px solid var(--border);border-radius:8px;background:var(--bg-secondary);color:var(--text-primary);">
        `).join('')}
      </div>
      <button class="btn-add" data-add="${idPrefix}" style="margin-top:2px;font-size:0.8rem;">+ Add row</button>`;

    panel.innerHTML = `
      <div style="margin-bottom:2rem;">
        <button class="btn-add" id="swb-back" style="margin-bottom:1rem;">← Back to Testing</button>
        <h3 style="font-size:1.1rem;font-weight:700;margin-bottom:1.25rem;display:flex;align-items:center;gap:8px;">
          🔌 Switchboard Inspection Audit
        </h3>

        ${fieldsHtml}

        <h4 style="font-size:0.95rem;font-weight:700;margin:0 0 0.5rem;color:var(--text-secondary);">Inspection Items</h4>
        <div style="display:flex;gap:8px;margin-bottom:0.5rem;">
          <button class="btn-add" id="swb-all-pass" style="font-size:0.8rem;">Mark all Pass</button>
        </div>
        <table class="data-table" style="width:100%;border-collapse:collapse;font-size:0.85rem;">
          <thead>
            <tr>
              <th style="width:48px;text-align:center;">Item</th>
              <th style="text-align:left;">Description</th>
              <th style="text-align:center;white-space:nowrap;">Pass / Fail / N/A</th>
            </tr>
          </thead>
          <tbody id="swb-items-body">
            ${itemsHtml}
          </tbody>
        </table>

        ${listBlock('Hazards / Major Non-Compliance Identified', 'swb-hazards', st.hazards)}
        ${listBlock('Remedial Works Recommended', 'swb-remedial', st.remedial)}

        <h4 style="font-size:0.95rem;font-weight:700;margin:1.5rem 0 0.5rem;color:var(--text-secondary);">Photos</h4>
        <input id="swb-photo-input" type="file" accept="image/*" multiple style="margin-bottom:0.75rem;">
        <div id="swb-photo-grid" class="doc-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;"></div>

        <div style="display:flex;gap:8px;margin-top:2rem;">
          <button class="btn-add" id="swb-save" style="font-weight:700;">Save &amp; Generate PDF</button>
          <button class="btn-add" id="swb-cancel">Cancel</button>
        </div>
      </div>`;

    /* ── Wiring ── */
    const $ = (sel) => panel.querySelector(sel);

    $('#swb-back').addEventListener('click', onBack);
    $('#swb-cancel').addEventListener('click', onBack);

    /* Header inputs -> state */
    const bind = (sel, key) => { const el = $(sel); el.addEventListener('input', () => { st.header[key] = el.value; }); };
    bind('#swb-client', 'client');
    bind('#swb-address', 'address');
    bind('#swb-id', 'switchboard_id');
    bind('#swb-location', 'location');
    bind('#swb-auditor', 'auditor');
    bind('#swb-date', 'audit_date');

    /* Inspection item radios -> state */
    panel.querySelectorAll('#swb-items-body input[type="radio"]').forEach(r => {
      r.addEventListener('change', () => {
        const num = r.name.replace('swb-item-', '');
        st.items[num] = r.value;
      });
    });

    /* Mark all pass */
    $('#swb-all-pass').addEventListener('click', () => {
      SWB_ITEMS.forEach(it => {
        const radio = panel.querySelector(`input[name="swb-item-${it.num}"][value="pass"]`);
        if (radio) { radio.checked = true; st.items[it.num] = 'pass'; }
      });
    });

    /* Hazards / remedial inputs -> state */
    const wireList = (idPrefix, arr) => {
      const container = $(`#${idPrefix}-list`);
      container.addEventListener('input', (e) => {
        const i = e.target.dataset.i;
        if (i != null) arr[i] = e.target.value;
      });
      $(`button[data-add="${idPrefix}"]`).addEventListener('click', () => {
        arr.push('');
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.dataset.i = arr.length - 1;
        inp.placeholder = `${arr.length}.`;
        inp.style.cssText = 'display:block;width:100%;margin-bottom:6px;padding:8px;border:1px solid var(--border);border-radius:8px;background:var(--bg-secondary);color:var(--text-primary);';
        container.appendChild(inp);
      });
    };
    wireList('swb-hazards', st.hazards);
    wireList('swb-remedial', st.remedial);

    /* Photos */
    const grid = $('#swb-photo-grid');
    const renderPhotoGrid = () => {
      grid.innerHTML = st.photos.map((p, i) => `
        <div style="position:relative;border:1px solid var(--border);border-radius:8px;overflow:hidden;">
          <img src="${p.dataUrl}" alt="${JM.esc(p.name)}" style="width:100%;height:90px;object-fit:cover;display:block;">
          <button data-rm="${i}" title="Remove" style="position:absolute;top:2px;right:2px;border:none;background:rgba(0,0,0,0.6);color:#fff;border-radius:50%;width:20px;height:20px;cursor:pointer;line-height:1;">×</button>
        </div>`).join('');
      grid.querySelectorAll('button[data-rm]').forEach(b => {
        b.addEventListener('click', () => { st.photos.splice(+b.dataset.rm, 1); renderPhotoGrid(); });
      });
    };
    $('#swb-photo-input').addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []);
      for (const f of files) {
        try { st.photos.push({ name: f.name, dataUrl: await fileToDataURL(f), file: f }); }
        catch (_) { /* skip unreadable */ }
      }
      e.target.value = '';
      renderPhotoGrid();
    });

    /* ── Save ── */
    $('#swb-save').addEventListener('click', async () => {
      if (!st.header.auditor.trim()) { BromarHub.showInfo('Please enter the auditor name'); return; }

      BromarHub.showLoading('Saving audit…');
      try {
        const sb = JM.sb();
        await JM.ensureCurrentUser();

        /* Status: fail if any item marked fail, else pass */
        const anyFail = Object.values(st.items).some(v => v === 'fail');
        const status = anyFail ? 'fail' : 'pass';

        const hazards = st.hazards.map(s => s.trim()).filter(Boolean);
        const remedial = st.remedial.map(s => s.trim()).filter(Boolean);

        /* 1) Insert the record first so we have an id for storage paths */
        const insertRow = {
          job_number: jobNumber,
          status,
          tested_by: st.header.auditor.trim(),
          site_name: st.header.client.trim() || st.header.location.trim() || null,
          client: st.header.client.trim() || null,
          address: st.header.address.trim() || null,
          switchboard_id: st.header.switchboard_id.trim() || null,
          location: st.header.location.trim() || null,
          audit_date: st.header.audit_date || null,
          items: st.items,
          hazards,
          remedial,
          photos: [],
        };
        const { data: inserted, error: insErr } = await sb
          .from('testing_switchboard_audit')
          .insert(insertRow)
          .select('id')
          .single();
        if (insErr) throw insErr;
        const id = inserted.id;

        /* 2) Upload photos to testing/{job}/switchboard-audit/{id}/photos/ */
        const photoMeta = [];
        for (let i = 0; i < st.photos.length; i++) {
          const p = st.photos[i];
          const safe = (p.name || `photo-${i + 1}.jpg`).replace(/[^\w.\-]+/g, '_');
          const path = `${jobNumber}/${TEST_TYPES.find(t => t.key === 'switchboard_audit').folder}/${id}/photos/${i + 1}-${safe}`;
          const { error: upErr } = await sb.storage.from('testing').upload(path, p.file, { upsert: true });
          if (!upErr) photoMeta.push({ path, name: p.name });
        }

        /* 3) Generate the PDF and upload to testing/{job}/switchboard-audit/{id}.pdf */
        const pdfBlob = await buildAuditPDF(st, { id, jobNumber });
        const pdfPath = `${jobNumber}/${TEST_TYPES.find(t => t.key === 'switchboard_audit').folder}/${id}.pdf`;
        const { error: pdfErr } = await sb.storage
          .from('testing')
          .upload(pdfPath, pdfBlob, { upsert: true, contentType: 'application/pdf' });
        if (pdfErr) throw pdfErr;

        /* 4) Patch the photo metadata onto the row */
        if (photoMeta.length) {
          await sb.from('testing_switchboard_audit').update({ photos: photoMeta }).eq('id', id);
        }

        BromarHub.hideLoading();
        BromarHub.showSuccess('Switchboard audit saved');
        JM.renderTool('testing');
      } catch (err) {
        BromarHub.hideLoading();
        console.error('[switchboard_audit] save failed', err);
        BromarHub.showInfo('Save failed: ' + (err.message || err));
      }
    });
  };

  /* ── PDF builder: mirrors the Bromar audit layout ── */
  async function buildAuditPDF(st, meta) {
    const jsPDF = await loadJsPDF();
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const PW = doc.internal.pageSize.getWidth();
    const PH = doc.internal.pageSize.getHeight();
    const M = 40;                       // margin
    const ORANGE = [243, 146, 0];
    const GREY = [220, 220, 220];

    /* Header block (logo + company details) — repeated each page */
    let logoData = null;
    try { logoData = await JM.loadBromarLogo(); } catch (_) { /* optional */ }

    const drawHeader = () => {
      if (logoData) {
        try { doc.addImage(logoData, 'PNG', M, 30, 150, 40); } catch (_) {}
      }
      doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(0, 0, 0);
      doc.text('BROMAR ELECTRICAL SERVICES', PW - M, 40, { align: 'right' });
      doc.setFont('helvetica', 'normal').setFontSize(8);
      doc.text('2/98-108 WESTERN AVE', PW - M, 52, { align: 'right' });
      doc.text('WESTMEADOWS 3049', PW - M, 62, { align: 'right' });
      doc.text('PH: (03) 9335 5344', PW - M, 78, { align: 'right' });
      doc.text('REC: 30340', PW - M, 88, { align: 'right' });
    };

    const footer = (n, total) => {
      doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(0, 0, 0);
      doc.text(`${n}/${total}`, PW - M, PH - 24, { align: 'right' });
    };

    /* ── PAGE 1 ── */
    drawHeader();
    let y = 110;

    /* Title bar */
    doc.setFillColor(...ORANGE);
    doc.rect(M, y, PW - 2 * M, 20, 'F');
    doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(0, 0, 0);
    doc.text('SWITCHBOARD INSPECTION AUDIT', PW / 2, y + 14, { align: 'center' });
    y += 20;

    /* Header fields table */
    const fields = [
      ['CLIENT:', st.header.client],
      ['ADDRESS:', st.header.address],
      ['SWITCHBOARD ID:', st.header.switchboard_id],
      ['LOCATION:', st.header.location],
      ['AUDITOR:', st.header.auditor],
      ['DATE:', st.header.audit_date ? JM.fmtDate(st.header.audit_date) : ''],
    ];
    const labelW = 110;
    doc.setFontSize(9);
    fields.forEach(([k, v]) => {
      doc.setDrawColor(0, 0, 0).setLineWidth(0.5);
      doc.rect(M, y, labelW, 16);
      doc.rect(M + labelW, y, PW - 2 * M - labelW, 16);
      doc.setFont('helvetica', 'bold').setTextColor(0, 0, 0).text(k, M + 4, y + 11);
      doc.setFont('helvetica', 'normal').text(String(v || ''), M + labelW + 4, y + 11);
      y += 16;
    });

    /* Inspection items header */
    y += 4;
    doc.setFillColor(...GREY);
    doc.rect(M, y, PW - 2 * M, 16, 'F');
    doc.setFont('helvetica', 'bold').setFontSize(9).text('INSPECTION ITEMS', PW / 2, y + 11, { align: 'center' });
    y += 16;

    /* Column geometry */
    const cItem = M;
    const cItemW = 50;
    const cDescW = PW - 2 * M - cItemW - 70 - 70;
    const cDesc = cItem + cItemW;
    const cPass = cDesc + cDescW;
    const cPassW = 70;
    const cNA = cPass + cPassW;
    const cNAW = 70;

    doc.setFont('helvetica', 'bold').setFontSize(8);
    const colHead = (ty) => {
      doc.rect(cItem, ty, cItemW, 14);
      doc.rect(cDesc, ty, cDescW, 14);
      doc.rect(cPass, ty, cPassW, 14);
      doc.rect(cNA, ty, cNAW, 14);
      doc.text('ITEM', cItem + cItemW / 2, ty + 10, { align: 'center' });
      doc.text('NON-COMPLIANCE DESCRIPTION', cDesc + 4, ty + 10);
      doc.text('PASS/FAIL', cPass + cPassW / 2, ty + 10, { align: 'center' });
      doc.text('N/A', cNA + cNAW / 2, ty + 10, { align: 'center' });
    };
    colHead(y);
    y += 14;

    const ensureSpace = (needed, pageNo, total) => {
      if (y + needed > PH - 40) {
        footer(pageNo.n, total);
        doc.addPage();
        pageNo.n += 1;
        drawHeader();
        y = 110;
        doc.setFont('helvetica', 'bold').setFontSize(8);
        colHead(y);
        y += 14;
      }
    };

    const pageNo = { n: 1 };
    /* We won't know the true total until the end; print placeholders then.
       Simpler: compute total pages after layout. We'll track and stamp at end. */

    /* Render sections + items */
    doc.setFontSize(8);
    SWB_SECTIONS.forEach(sec => {
      ensureSpace(16 + 16, pageNo, 99);
      /* Section subheading row */
      doc.setFillColor(245, 245, 245);
      doc.rect(cItem, y, PW - 2 * M, 14, 'F');
      doc.setFont('helvetica', 'bolditalic').setTextColor(0, 0, 0).text(sec.section, cDesc + 4, y + 10);
      doc.rect(cItem, y, PW - 2 * M, 14);
      y += 14;

      sec.items.forEach(label => {
        const it = SWB_ITEMS.find(x => x.label === label);
        const descLines = doc.splitTextToSize(it.label, cDescW - 8);
        const rowH = Math.max(16, descLines.length * 9 + 6);
        ensureSpace(rowH, pageNo, 99);

        doc.rect(cItem, y, cItemW, rowH);
        doc.rect(cDesc, y, cDescW, rowH);
        doc.rect(cPass, y, cPassW, rowH);
        doc.rect(cNA, y, cNAW, rowH);

        doc.setFont('helvetica', 'normal').text(String(it.num), cItem + cItemW / 2, y + rowH / 2 + 3, { align: 'center' });
        doc.text(descLines, cDesc + 4, y + 10);

        const v = st.items[it.num];
        const midY = y + rowH / 2 + 3;
        if (v === 'pass') doc.text('✓', cPass + cPassW / 2, midY, { align: 'center' });
        else if (v === 'fail') doc.text('✗', cPass + cPassW / 2, midY, { align: 'center' });
        else if (v === 'na') doc.text('✓', cNA + cNAW / 2, midY, { align: 'center' });

        y += rowH;
      });
    });

    /* Hazards box */
    const hazards = st.hazards.map(s => (s || '').trim()).filter(Boolean);
    const remedial = st.remedial.map(s => (s || '').trim()).filter(Boolean);

    const drawListBox = (title, arr) => {
      ensureSpace(20 + 22 * Math.max(arr.length, 3) + 10, pageNo, 99);
      y += 8;
      doc.setFillColor(...GREY);
      doc.rect(M, y, PW - 2 * M, 16, 'F');
      doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(0, 0, 0).text(title, PW / 2, y + 11, { align: 'center' });
      doc.rect(M, y, PW - 2 * M, 16);
      y += 16;
      const numW = 60;
      const rows = Math.max(arr.length, 3);
      doc.setFont('helvetica', 'normal').setFontSize(9);
      for (let i = 0; i < rows; i++) {
        const txt = arr[i] || '';
        const lines = doc.splitTextToSize(txt, PW - 2 * M - numW - 8);
        const rowH = Math.max(22, lines.length * 11 + 8);
        ensureSpace(rowH, pageNo, 99);
        doc.rect(M, y, numW, rowH);
        doc.rect(M + numW, y, PW - 2 * M - numW, rowH);
        doc.text(String(i + 1), M + numW / 2, y + rowH / 2 + 3, { align: 'center' });
        if (txt) doc.text(lines, M + numW + 6, y + 13);
        y += rowH;
      }
    };
    drawListBox('HAZARDS/MAJOR NON-COMPLIANCE IDENTIFIED', hazards);
    drawListBox('REMEDIAL WORKS RECOMMENDED', remedial);

    /* Photos page(s) */
    if (st.photos.length) {
      footer(pageNo.n, 99);
      doc.addPage();
      pageNo.n += 1;
      drawHeader();
      y = 110;
      const cols = 3;
      const gap = 12;
      const cellW = (PW - 2 * M - gap * (cols - 1)) / cols;
      const cellH = cellW * 0.95;
      let col = 0;
      for (const p of st.photos) {
        if (y + cellH > PH - 40) {
          footer(pageNo.n, 99);
          doc.addPage();
          pageNo.n += 1;
          drawHeader();
          y = 110;
          col = 0;
        }
        const x = M + col * (cellW + gap);
        try {
          const img = await loadImage(p.dataUrl);
          const ratio = Math.min(cellW / img.naturalWidth, cellH / img.naturalHeight);
          const w = img.naturalWidth * ratio;
          const h = img.naturalHeight * ratio;
          const fmt = /png/i.test(p.dataUrl.slice(0, 30)) ? 'PNG' : 'JPEG';
          doc.addImage(p.dataUrl, fmt, x + (cellW - w) / 2, y + (cellH - h) / 2, w, h);
        } catch (_) { /* skip bad image */ }
        col += 1;
        if (col >= cols) { col = 0; y += cellH + gap; }
      }
    }

    /* Stamp real page numbers now that we know the total */
    const total = doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      /* clear any prior placeholder by overdrawing white then re-stamping */
      doc.setFillColor(255, 255, 255);
      doc.rect(PW - M - 40, PH - 36, 50, 16, 'F');
      doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(0, 0, 0);
      doc.text(`${i}/${total}`, PW - M, PH - 24, { align: 'right' });
    }

    return doc.output('blob');
  }

})();
