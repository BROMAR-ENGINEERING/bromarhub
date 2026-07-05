/* ══════════════════════════════════════════════════════════════
   BROMAR HUB — SHARED TESTING MODULE: Switchboard Audit
   Location: /tools/testing/switchboard-audit.js
   API: window.BromarTest.SwitchboardAudit.renderForm(container, config)
   ══════════════════════════════════════════════════════════════ */
window.BromarTest = window.BromarTest || {};
window.BromarTest.SwitchboardAudit = (function () {

  const VERSION = 'V1.02';
  const TABLE = 'testing_switchboard_audit';
  const BUCKET = 'testing';
  const FOLDER = 'switchboard-audit';
  const NAVY = [36, 59, 107], ORANGE = [234, 88, 12], MUTED = [107, 114, 128];
  const ORG = { name: 'Bromar Electrical Services Pty Ltd', addr: '2/98-108 Western Ave, Westmeadows 3049', phoneRec: 'PH: 9335 5344    REC: 40430', web: 'www.bromar.com.au' };

  const CATEGORIES = [
    { name: 'General Access & Location', items: [
      { num: 1, desc: '600mm radius of door opening obtained',
        criteria: 'Confirm a minimum 600mm clear working space is available in front of the switchboard with the door fully open. Ensure no permanent obstructions reduce safe access.',
        report: '600mm radius of door opening not achieved: Adequate clearance allows safe operation, maintenance and emergency isolation of the switchboard.' },
      { num: 2, desc: 'Obstructions to door opening',
        criteria: 'Ensure the switchboard door can fully open without obstruction from equipment, stored materials, piping or building structures.',
        report: 'Obstructions prevent the switchboard door from fully opening: Unrestricted access is required for safe operation, maintenance and emergency isolation.' },
      { num: 3, desc: 'Lockable to restrict unauthorised personnel',
        criteria: 'Verify the switchboard can be locked where required and that locking provisions are functional.',
        report: 'Switchboard is not capable of being secured against unauthorised access: Restricting access reduces the risk of electric shock and unauthorised interference.' },
    ]},
    { name: 'Labelling', items: [
      { num: 4, desc: 'Switchboard identification label',
        criteria: 'Confirm the switchboard has a permanent identification label matching site drawings or nomenclature.',
        report: 'Switchboard identification label missing or incorrect: Clear identification assists maintenance personnel and emergency responders.' },
      { num: 5, desc: 'Sub-circuit labelling / schedule',
        criteria: 'Verify every protective device is labelled and matches the circuit schedule. Ensure labels are legible and redundant circuits are identified or removed.',
        report: 'Circuit labelling or schedule is incomplete or inaccurate: Accurate circuit identification improves safety and reduces maintenance time.' },
      { num: 6, desc: 'Main switch / isolator label',
        criteria: 'Confirm all main switches, isolators and incoming supplies are clearly labelled.',
        report: 'Main switch or isolator is not clearly labelled: Clearly identifying isolation points allows power to be safely disconnected when required.' },
      { num: 7, desc: 'Emergency lighting labels',
        criteria: 'Verify emergency lighting circuits are clearly labelled. Where an emergency lighting test switch or test kit is fitted, confirm it is labelled and all associated emergency lighting circuits can be readily identified.',
        report: 'Emergency lighting circuits or test facilities are not correctly labelled: Correct labelling allows emergency lighting systems to be safely tested and maintained.' },
      { num: 8, desc: 'Solar warning labels',
        criteria: 'Where a solar PV system exists, verify all required warning labels are fitted including Main Switch (Grid Supply), Main Switch (Inverter Supply), Dual Supply Warning, Inverter Shutdown Procedure, PV Array Isolation, Rooftop PV Warning and Battery Storage warnings where applicable.',
        report: 'Required solar warning labels are missing or incomplete: Correct warning labels alert personnel that multiple energy sources may remain energised.' },
    ]},
    { name: 'Enclosure', items: [
      { num: 9, desc: 'Enclosure condition',
        criteria: 'Inspect the enclosure for corrosion, dents, cracks, damage, unauthorised modifications or deterioration.',
        report: 'Switchboard enclosure is damaged or deteriorated: A damaged enclosure may reduce electrical safety and environmental protection.' },
      { num: 10, desc: 'Pole fillers',
        criteria: 'Confirm all unused module spaces are fitted with approved blanking plates and no live parts are accessible.',
        report: 'Unused switchgear openings are not fitted with approved pole fillers: Blanking plates prevent accidental contact with live electrical components.' },
      { num: 11, desc: 'Enclosure fixings',
        criteria: 'Check the enclosure is securely fixed to the wall, floor or supporting structure. Inspect hinges, covers, chassis fixings, mounting bolts and screws for security and damage.',
        report: 'Switchboard enclosure is not securely mounted or fixed: A securely mounted switchboard maintains its structural integrity and electrical safety.' },
      { num: 12, desc: 'No openings bigger than 5mm',
        criteria: 'Inspect for holes, gaps or missing covers that could allow access to live parts or ingress of foreign objects.',
        report: 'Enclosure contains openings that may expose live parts or compromise protection: Maintaining enclosure integrity reduces electrical hazards.' },
      { num: 13, desc: 'Seals and gaskets satisfactory',
        criteria: 'Inspect door seals and gaskets for deterioration, damage or missing sections. Ensure doors seal correctly.',
        report: 'Door seals or gaskets are damaged or missing: Good seals help protect electrical equipment from dust and moisture.' },
      { num: 14, desc: 'Degree of IP protection maintained',
        criteria: 'Confirm any modifications, cable entries or equipment additions have not compromised the enclosure\'s environmental protection.',
        report: 'Enclosure IP protection has been compromised: Maintaining the enclosure\'s protection reduces the likelihood of equipment failure.' },
      { num: 15, desc: 'No undue accumulation of dust and dirt',
        criteria: 'Inspect internally and externally for excessive dust, debris, moisture or contamination.',
        report: 'Excessive dust, dirt or contamination present within the switchboard: Contamination can contribute to overheating and premature equipment failure.' },
      { num: 16, desc: 'Fire rating maintained where required',
        criteria: 'Verify penetrations are appropriately sealed and that the fire rating of the wall, floor or barrier has been maintained.',
        report: 'Fire-rated penetrations have not been correctly sealed: Maintaining fire barriers helps limit the spread of fire throughout the building.' },
      { num: 17, desc: 'Protection against corrosion, weather, vibration and adverse factors',
        criteria: 'Assess the installation for corrosion, UV damage, water ingress, excessive vibration, chemical exposure or other environmental deterioration.',
        report: 'Switchboard is inadequately protected from environmental conditions: Environmental damage can reduce equipment reliability and service life.' },
    ]},
    { name: 'Cabling', items: [
      { num: 18, desc: 'Cables entering board have adequate mechanical protection',
        criteria: 'Verify incoming and outgoing cables are protected from abrasion and mechanical damage using glands, bushes, conduit or equivalent protection. Look for unprotected cables entering the bottom of the switchboard.',
        report: 'Incoming or outgoing cables lack adequate mechanical protection: Mechanical protection reduces cable damage and improves long-term reliability.' },
      { num: 19, desc: 'Cables on sharp edges',
        criteria: 'Ensure cables do not contact sharp metal edges and that edge protection is fitted where required.',
        report: 'Cables are in contact with sharp edges or lack edge protection: Protecting cable insulation reduces the likelihood of electrical faults.' },
    ]},
    { name: 'Glandplate', items: [
      { num: 20, desc: 'Non-ferrous gland plate used',
        criteria: 'Where single-core cables are installed, confirm gland plates are manufactured from non-ferrous material (aluminium or stainless steel) or are otherwise suitable to prevent induced heating. Alternatively, cable entry openings may be slotted in accordance with AS/NZS 3000 provided the slot dimensions comply and the remaining opening is suitably sealed.',
        report: 'Cable entry arrangement is unsuitable for single-core cables: Correct gland plate construction prevents induced heating and maintains enclosure protection.' },
      { num: 21, desc: 'Gland plate and glands tight & secured',
        criteria: 'Check gland plates are secure and cable glands are correctly tightened, sealed and provide strain relief.',
        report: 'Cable glands or gland plate are loose or inadequately secured: Secure cable entries maintain enclosure protection and prevent cable movement.' },
    ]},
    { name: 'Switchgear', items: [
      { num: 22, desc: 'Discrimination / Coordination',
        criteria: 'Review available drawings and protection settings to confirm upstream and downstream protective devices are appropriately coordinated where practical.',
        report: 'Protective devices may not be correctly coordinated: Correct coordination helps minimise unnecessary power outages during electrical faults.' },
      { num: 23, desc: 'Switchgear selection (suited to switchboard)',
        criteria: 'Confirm protective devices are correctly rated for voltage, current, fault level and intended application.',
        report: 'Installed switchgear is not appropriately selected for the application: Correctly selected equipment improves the safety and reliability of the installation.' },
      { num: 24, desc: 'Switchgear orientation',
        criteria: 'Verify devices are installed in the manufacturer\'s approved orientation and have adequate ventilation and clearance. Check that MCBs and RCBOs have not been installed backwards. Breaker toggle orientation may differ provided ON and OFF positions are clearly labelled, however consistent orientation is best practice.',
        report: 'Switchgear is incorrectly orientated or installed: Correct installation ensures switchgear operates safely and as intended.' },
      { num: 25, desc: 'Switchgear condition',
        criteria: 'Inspect breakers, contactors, isolators and RCDs for cracks, overheating, discolouration, damaged terminals, missing handles or evidence of arcing.',
        report: 'Switchgear shows signs of damage or deterioration: Damaged switchgear increases the risk of equipment failure and electrical faults.' },
    ]},
    { name: 'Chassis & Busbars', items: [
      { num: 26, desc: 'Insulation on busbars in good condition',
        criteria: 'Inspect visible busbar insulation for cracking, deterioration, tracking or exposed conductive parts.',
        report: 'Busbar insulation is damaged or deteriorated: Damaged insulation increases the risk of electrical faults and electric shock.' },
      { num: 27, desc: 'Phase to earth clearance',
        criteria: 'Verify adequate clearance is maintained between live conductors and earth or grounded metalwork.',
        report: 'Insufficient phase-to-earth clearance observed: Adequate clearances reduce the risk of flashover and electrical faults.' },
      { num: 28, desc: 'Phase to phase clearance',
        criteria: 'Verify adequate separation is maintained between live conductors of different phases.',
        report: 'Insufficient phase-to-phase clearance observed: Correct conductor spacing reduces the likelihood of phase-to-phase faults.' },
      { num: 29, desc: 'Shrouds fitted',
        criteria: 'Confirm all required barriers, covers and shrouds are fitted and securely installed over live components.',
        report: 'Required shrouds or protective barriers are missing: Protective barriers reduce the risk of accidental contact with live parts.' },
    ]},
    { name: 'Terminations', items: [
      { num: 30, desc: 'Exposed copper on terminations',
        criteria: 'Inspect all terminations for excessive exposed conductor and ensure insulation extends close to the terminal.',
        report: 'Excessive exposed copper identified at terminations: Correct terminations minimise the risk of short circuits and accidental contact.' },
      { num: 31, desc: 'Loose connections',
        criteria: 'Inspect accessible terminations for loose conductors, overheating, discolouration or evidence of arcing. Use thermal imaging where available.',
        report: 'Loose or overheated electrical connections identified: Loose electrical connections are a common cause of overheating and equipment failure.' },
      { num: 32, desc: 'Visual indications',
        criteria: 'Verify indicator lamps, voltmeters, ammeters, selector switches, mimic diagrams and mechanical position indicators are present, legible and operating correctly.',
        report: 'Visual indicators are missing, damaged or not operating correctly: Visual indicators assist operators in identifying equipment status and faults.' },
    ]},
    { name: 'Residual Current Devices', items: [
      { num: 33, desc: 'RCD fitted where required',
        criteria: 'Verify RCD protection is installed where required and has not been bypassed or removed.',
        report: 'Residual current protection is not installed where required: RCD protection provides additional protection against electric shock.' },
      { num: 34, desc: 'Correct RCD type',
        criteria: 'Verify all installed RCDs and RCBOs are Type A devices. Type AC devices are not acceptable for new installations or replacements.',
        report: 'Type AC RCDs identified or incorrect RCD type installed: Type A RCDs provide improved protection for modern electrical installations.' },
      { num: 35, desc: 'ESV approved RCD',
        criteria: 'Verify each installed RCD/RCBO appears on the current Energy Safe Victoria approved RCD register where applicable.',
        report: 'Non-approved RCD identified: Approved products provide confidence the protective devices meet Victorian regulatory requirements.' },
      { num: 36, desc: 'Correct RCD sensitivity',
        criteria: 'Confirm the residual operating current (e.g. 30mA, 100mA or 300mA) is appropriate for the protected circuit and application.',
        report: 'Incorrect RCD sensitivity installed for the application: Correct RCD sensitivity provides the intended level of electrical protection while reducing nuisance tripping.' },
    ]},
    { name: 'Overcurrent Protection', items: [
      { num: 37, desc: 'Protection settings and device sizing',
        criteria: 'Verify protective device ratings and adjustable settings are appropriate for the connected cables and equipment. Check settings where adjustable protection devices are installed.',
        report: 'Protective device ratings or settings are incorrect: Correct protection settings help safeguard cables, equipment and personnel from overloads and electrical faults.' },
    ]},
  ];

  const ALL_ITEMS = CATEGORIES.flatMap(c => c.items);
  let photos = [];
  let _logoData = null;

  function esc(s) { return String(s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

  function injectStyles() {
    if (document.getElementById('bromar-test-sa-styles')) return;
    const st = document.createElement('style'); st.id = 'bromar-test-sa-styles';
    st.textContent = `
      .sa-back{display:inline-flex;align-items:center;gap:6px;font-size:0.85rem;font-weight:600;color:var(--accent);cursor:pointer;margin-bottom:1.25rem;background:none;border:none;padding:4px 0;}.sa-back:hover{text-decoration:underline;}
      .sa-table{width:100%;border-collapse:collapse;margin-bottom:1.5rem;}
      .sa-table th{background:var(--bg-main);font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-secondary);padding:8px;text-align:left;border-bottom:2px solid var(--border);}
      .sa-item-row td{border-bottom:1px solid var(--border);vertical-align:middle;}.sa-cat-row td{border-bottom:1px solid var(--border);background:var(--bg-main);}
      .sa-radio-group{display:flex;gap:4px;justify-content:center;}.sa-radio{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:6px;cursor:pointer;border:1px solid var(--border);transition:all 0.15s;font-size:0.8rem;}
      .sa-radio input{position:absolute;opacity:0;pointer-events:none;}.sa-radio span{font-weight:700;}
      .sa-radio.pass:has(input:checked){background:#d1fae5;border-color:#15803d;color:#15803d;}.sa-radio.fail:has(input:checked){background:#fee2e2;border-color:#dc2626;color:#dc2626;}.sa-radio.na:has(input:checked){background:var(--bg-main);border-color:var(--accent);color:var(--accent);}
      .sa-info-btn{width:22px;height:22px;border-radius:50%;border:1px solid var(--border);background:var(--bg-main);color:var(--text-secondary);font-size:0.7rem;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;margin-left:6px;transition:all 0.15s;flex-shrink:0;vertical-align:middle;}
      .sa-info-btn:hover{border-color:var(--accent);color:var(--accent);background:var(--card-hover);}
      .sa-info-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9500;align-items:center;justify-content:center;padding:1rem;}
      .sa-info-overlay.show{display:flex;}
      .sa-info-content{background:var(--bg-secondary);border-radius:14px;max-width:520px;width:100%;padding:1.5rem;box-shadow:0 12px 40px rgba(0,0,0,0.3);}
      .sa-info-title{font-size:0.95rem;font-weight:700;color:var(--accent);margin-bottom:0.75rem;}
      .sa-info-body{font-size:0.85rem;line-height:1.6;color:var(--text-primary);}
      .sa-info-close{margin-top:1rem;padding:0.5rem 1.25rem;border:1px solid var(--border);border-radius:8px;background:transparent;color:var(--text-secondary);cursor:pointer;font-family:'Outfit',sans-serif;font-size:0.85rem;font-weight:600;}
      .sa-info-close:hover{border-color:var(--accent);color:var(--accent);}
      .sa-desc-cell{display:flex;align-items:center;}
      .sa-desc-text{flex:1;}
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

  function loadLogo() {
    if (_logoData) return Promise.resolve(_logoData);
    return new Promise(resolve => {
      const img = new Image(); img.crossOrigin = 'anonymous';
      const paths = ['/Bromar-Primary-Logo-Full-Colour.png', '../Bromar-Primary-Logo-Full-Colour.png', '../../Bromar-Primary-Logo-Full-Colour.png'];
      let tried = 0;
      function tryNext() { if (tried >= paths.length) { resolve(null); return; } img.src = paths[tried++]; }
      img.onload = () => { const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext('2d').drawImage(img, 0, 0); _logoData = { dataUrl: c.toDataURL('image/png'), w: img.naturalWidth, h: img.naturalHeight }; resolve(_logoData); };
      img.onerror = tryNext; tryNext();
    });
  }

  let _jspdfPromise = null;
  function ensureJsPDF() {
    if (window.jspdf) return Promise.resolve();
    if (_jspdfPromise) return _jspdfPromise;
    _jspdfPromise = new Promise((resolve, reject) => {
      const s1 = document.createElement('script'); s1.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      s1.onload = () => { const s2 = document.createElement('script'); s2.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'; s2.onload = resolve; s2.onerror = reject; document.head.appendChild(s2); };
      s1.onerror = reject; document.head.appendChild(s1);
    });
    return _jspdfPromise;
  }

  /* ── Render form ── */
  function renderForm(container, config) {
    injectStyles(); photos = [];
    const cfg = config || {};
    const today = new Date().toISOString().split('T')[0];

    let checklistHtml = '';
    for (const cat of CATEGORIES) {
      checklistHtml += `<tr class="sa-cat-row"><td colspan="4" style="font-weight:700;font-style:italic;padding:10px 8px 6px;color:var(--text-primary);font-size:0.9rem;">${esc(cat.name)}</td></tr>`;
      for (const item of cat.items) {
        checklistHtml += `
          <tr class="sa-item-row">
            <td style="width:36px;text-align:center;font-weight:600;font-size:0.85rem;">${item.num}</td>
            <td style="font-size:0.85rem;padding:6px 8px;"><div class="sa-desc-cell"><span class="sa-desc-text">${esc(item.desc)}</span><button type="button" class="sa-info-btn" data-item="${item.num}" title="Inspection criteria">i</button></div></td>
            <td style="width:70px;text-align:center;"><div class="sa-radio-group"><label class="sa-radio pass"><input type="radio" name="item_${item.num}" value="pass" data-item="${item.num}"><span>✓</span></label><label class="sa-radio fail"><input type="radio" name="item_${item.num}" value="fail" data-item="${item.num}"><span>✗</span></label></div></td>
            <td style="width:50px;text-align:center;"><label class="sa-radio na"><input type="radio" name="item_${item.num}" value="na" data-item="${item.num}"><span>N/A</span></label></td>
          </tr>`;
      }
    }

    container.innerHTML = `
      <div class="sa-info-overlay" id="saInfoOverlay">
        <div class="sa-info-content">
          <div class="sa-info-title" id="saInfoTitle"></div>
          <div class="sa-info-body" id="saInfoBody"></div>
          <button class="sa-info-close" id="saInfoClose">Close</button>
        </div>
      </div>
      ${cfg.onBack ? '<button class="sa-back" id="saBack">\u2190 Back</button>' : ''}
      <h3 style="font-size:1.1rem;font-weight:700;margin-bottom:1.25rem;">\uD83D\uDD0C Switchboard Inspection Audit</h3>
      <div class="section-label">Job Details</div>
      ${cfg.jobNumber ? '' : '<div class="field-row"><div class="field-group full" style="grid-column:1/-1;"><label>Job Number <span class="required">*</span></label><div class="autocomplete-wrapper"><input type="text" id="saJobNumber" placeholder="Search job number, client, or site..." autocomplete="off"><div class="autocomplete-results" id="saJobResults"></div></div></div></div>'}
      <div class="field-row">
        <div class="field-group"><label>Date <span class="required">*</span></label><input type="date" id="saDate" value="${today}"></div>
        <div class="field-group"><label>Auditor <span class="required">*</span></label><select id="saAuditor"><option value="">Select...</option></select></div>
      </div>
      <div class="field-row">
        <div class="field-group"><label>Client</label><input type="text" id="saClient" value="${esc(cfg.clientName || '')}"></div>
        <div class="field-group"><label>Site Name / Address</label><input type="text" id="saSite" value="${esc(cfg.siteName || '')}"></div>
      </div>
      <div class="field-row">
        <div class="field-group"><label>Switchboard ID <span class="required">*</span></label><input type="text" id="saBoardId" placeholder="e.g. Main Switchboard"></div>
        <div class="field-group"><label>Location within site</label><input type="text" id="saLocation" placeholder="e.g. Plant Room, Level 1"></div>
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
        <div class="upload-icon">\uD83D\uDCF7</div>
        <div class="upload-text">Tap to add photos</div>
        <div class="upload-hint">JPEG, PNG \u2014 include photos of non-compliance items</div>
        <input type="file" id="saPhotoInput" accept="image/*" multiple style="display:none;">
      </div>
      <div class="sa-photo-grid" id="saPhotoGrid"></div>
      <div class="form-divider"></div>
      <div class="submit-row">
        <button class="btn-secondary" id="saSaveDraft" style="padding:0.875rem 1.5rem;">\uD83D\uDCBE Save Progress</button>
        <button class="submit-btn" id="saSubmit">Submit Audit & Generate PDF</button>
      </div>
    `;

    /* Wire back */
    if (cfg.onBack) container.querySelector('#saBack').addEventListener('click', cfg.onBack);

    /* Job number autocomplete (standalone mode) */
    if (!cfg.jobNumber) {
      const jobInput = container.querySelector('#saJobNumber');
      const jobResults = container.querySelector('#saJobResults');
      if (jobInput && jobResults && cfg.supabase) {
        let _jobCache = [];
        cfg.supabase.from('job_number_register').select('job_number, client_name, site_name, site_address').order('job_number', { ascending: false }).limit(500)
          .then(({ data }) => { if (data) _jobCache = data; });
        jobInput.addEventListener('input', () => {
          const q = jobInput.value.trim().toLowerCase();
          if (q.length < 2) { jobResults.classList.remove('show'); return; }
          const matches = _jobCache.filter(j => (j.job_number||'').toLowerCase().includes(q) || (j.client_name||'').toLowerCase().includes(q) || (j.site_name||'').toLowerCase().includes(q)).slice(0, 8);
          if (!matches.length) { jobResults.innerHTML = '<div style="padding:0.75rem 1rem;color:var(--text-secondary);font-size:0.85rem;">No jobs found</div>'; jobResults.classList.add('show'); return; }
          jobResults.innerHTML = matches.map(j => `<div class="autocomplete-item" data-jn="${esc(j.job_number)}" data-cn="${esc(j.client_name||'')}" data-sn="${esc(j.site_name||j.site_address||'')}"><div class="autocomplete-item-number">${esc(j.job_number)}</div><div class="autocomplete-item-client">${esc(j.client_name||'')}${j.site_name?' \u2014 '+esc(j.site_name):''}</div></div>`).join('');
          jobResults.classList.add('show');
          jobResults.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('click', () => {
              jobInput.value = item.dataset.jn; jobResults.classList.remove('show');
              const cEl = container.querySelector('#saClient'), sEl = container.querySelector('#saSite');
              if (cEl && !cEl.value) cEl.value = item.dataset.cn;
              if (sEl && !sEl.value) sEl.value = item.dataset.sn;
            });
          });
        });
        jobInput.addEventListener('blur', () => { setTimeout(() => jobResults.classList.remove('show'), 200); });
      }
    }

    /* Auditor auto-fill */
    const auditorSel = container.querySelector('#saAuditor');
    (cfg.employees || []).forEach(e => { const o = document.createElement('option'); o.value = e.full_name; o.textContent = e.full_name; o.dataset.email = e.email || ''; auditorSel.appendChild(o); });
    (async () => {
      try {
        if (cfg.supabase) {
          const { data: { user } } = await cfg.supabase.auth.getUser();
          if (user?.email) { const m = (cfg.employees || []).find(e => e.email?.toLowerCase() === user.email.toLowerCase()); if (m) { auditorSel.value = m.full_name; auditorSel.disabled = true; return; } }
        }
        if (cfg.currentUser?.name) auditorSel.value = cfg.currentUser.name;
      } catch (_) { if (cfg.currentUser?.name) auditorSel.value = cfg.currentUser.name; }
    })();

    /* Info popup */
    const overlay = container.querySelector('#saInfoOverlay');
    const infoTitle = container.querySelector('#saInfoTitle');
    const infoBody = container.querySelector('#saInfoBody');
    container.querySelector('#saInfoClose').addEventListener('click', () => overlay.classList.remove('show'));
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('show'); });
    container.querySelectorAll('.sa-info-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const item = ALL_ITEMS.find(i => i.num === parseInt(btn.dataset.item));
        if (!item) return;
        infoTitle.textContent = 'Item ' + item.num + ': ' + item.desc;
        infoBody.textContent = item.criteria;
        overlay.classList.add('show');
      });
    });

    /* Dynamic lists */
    const hazardsContainer = container.querySelector('#saHazards');
    function renumList(cont) { cont.querySelectorAll('.sa-dyn-row').forEach((r, i) => r.querySelector('.sa-dyn-num').textContent = i + 1); }
    function addDynRow(cont, text, autoItemNum) {
      const row = document.createElement('div'); row.className = 'sa-dyn-row';
      if (autoItemNum) row.setAttribute('data-auto-item', autoItemNum);
      row.innerHTML = `<span class="sa-dyn-num">1</span><textarea placeholder="Describe...">${esc(text)}</textarea><button class="remove-btn" type="button">\u2715</button>`;
      row.querySelector('.remove-btn').addEventListener('click', () => { row.remove(); renumList(cont); });
      cont.appendChild(row); renumList(cont); return row;
    }
    function setupDynamicList(contId, btnId) { const cont = container.querySelector('#' + contId); container.querySelector('#' + btnId).addEventListener('click', () => addDynRow(cont, '', null).querySelector('textarea').focus()); }
    setupDynamicList('saHazards', 'saAddHazard');
    setupDynamicList('saRemedial', 'saAddRemedial');

    /* Auto-populate hazards on fail — uses customer report detail */
    container.querySelectorAll('.sa-table input[type="radio"]').forEach(radio => {
      radio.addEventListener('change', () => {
        const num = radio.dataset.item;
        const item = ALL_ITEMS.find(i => i.num === parseInt(num));
        if (!item) return;
        const existing = hazardsContainer.querySelector(`.sa-dyn-row[data-auto-item="${num}"]`);
        if (existing) { existing.remove(); renumList(hazardsContainer); }
        if (radio.value === 'fail') addDynRow(hazardsContainer, item.report, num);
      });
    });

    /* Photos */
    const photoArea = container.querySelector('#saPhotoArea');
    const photoInput = container.querySelector('#saPhotoInput');
    const photoGrid = container.querySelector('#saPhotoGrid');
    photoArea.addEventListener('click', () => photoInput.click());
    photoInput.addEventListener('change', e => {
      Array.from(e.target.files || []).forEach(file => { const reader = new FileReader(); reader.onload = ev => { photos.push({ file, dataUrl: ev.target.result, description: '' }); renderPhotos(); }; reader.readAsDataURL(file); });
      photoInput.value = '';
    });
    function renderPhotos() {
      photoGrid.innerHTML = photos.map((p, i) => `<div class="sa-photo-card" data-idx="${i}"><img src="${p.dataUrl}" alt="Photo ${i+1}"><textarea placeholder="Description...">${esc(p.description)}</textarea><button class="remove-btn" type="button">Remove</button></div>`).join('');
      photoGrid.querySelectorAll('.sa-photo-card').forEach(card => { const idx = parseInt(card.dataset.idx); card.querySelector('textarea').addEventListener('input', e => { photos[idx].description = e.target.value; }); card.querySelector('.remove-btn').addEventListener('click', () => { photos.splice(idx, 1); renderPhotos(); }); });
    }

    /* Submit + Save Draft */
    let _draftId = null;
    container.querySelector('#saSubmit').addEventListener('click', () => submitAudit(container, cfg));
    container.querySelector('#saSaveDraft').addEventListener('click', async () => {
      const data = collectData(container);
      if (!data.auditor) { BromarHub.showInfo('Select an auditor before saving'); return; }
      const sb = cfg.supabase; const jobNumber = cfg.jobNumber || data.jobNumber || 'STANDALONE';
      BromarHub.showLoading('Saving draft...');
      try {
        const record = { job_number: jobNumber, client_name: data.client, site_name: data.site, switchboard_id: data.boardId, location: data.location, tested_by: data.auditor, audit_date: data.date, inspection_items: data.items, hazards: data.hazards, remedial_works: data.remedial, photos: [], status: 'draft' };
        if (_draftId) { await sb.from(TABLE).update(record).eq('id', _draftId); }
        else { const { data: ins, error } = await sb.from(TABLE).insert(record).select('id').single(); if (error) throw error; _draftId = ins.id; }
        BromarHub.hideLoading(); BromarHub.showSuccess('Draft saved');
      } catch (e) { BromarHub.hideLoading(); BromarHub.showInfo('Save failed: ' + (e.message || e)); }
    });
  }

  function collectData(container) {
    const g = id => (container.querySelector('#' + id) || {}).value || '';
    return {
      jobNumber: g('saJobNumber').trim() || '', client: g('saClient').trim(), site: g('saSite').trim(),
      boardId: g('saBoardId').trim(), location: g('saLocation').trim(),
      auditor: g('saAuditor'), date: g('saDate'),
      items: ALL_ITEMS.map(item => {
        const checked = container.querySelector(`input[name="item_${item.num}"]:checked`);
        return { num: item.num, desc: item.desc, result: checked ? checked.value : null, report: item.report };
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

  async function submitAudit(container, cfg) {
    const data = collectData(container);
    const err = validate(data);
    if (err) { BromarHub.showInfo(err); return; }
    const sb = cfg.supabase;
    const jobNumber = cfg.jobNumber || data.jobNumber || 'STANDALONE';
    BromarHub.showLoading('Generating audit...', 'Creating PDF and saving record');
    try {
      const record = { job_number: jobNumber, client_name: data.client, site_name: data.site, switchboard_id: data.boardId, location: data.location, tested_by: data.auditor, audit_date: data.date, inspection_items: data.items, hazards: data.hazards, remedial_works: data.remedial, photos: [], status: 'completed' };
      const { data: inserted, error: insertErr } = await sb.from(TABLE).insert(record).select('id').single();
      if (insertErr) throw insertErr;
      const recordId = inserted.id;
      const photoPaths = [];
      for (let i = 0; i < photos.length; i++) { const p = photos[i]; const ext = p.file.name.split('.').pop() || 'jpg'; const path = `${jobNumber}/${FOLDER}/${recordId}/photo_${i + 1}.${ext}`; const { error: upErr } = await sb.storage.from(BUCKET).upload(path, p.file, { upsert: true }); if (!upErr) photoPaths.push({ path, description: p.description }); }
      if (photoPaths.length) await sb.from(TABLE).update({ photos: photoPaths }).eq('id', recordId);
      BromarHub.showLoading('Generating PDF...', 'Please wait');
      const pdfBlob = await generatePDF(data, jobNumber);
      const pdfPath = `${jobNumber}/${FOLDER}/${recordId}.pdf`;
      await sb.storage.from(BUCKET).upload(pdfPath, pdfBlob, { contentType: 'application/pdf', upsert: true });
      BromarHub.hideLoading();
      const pdfUrl = URL.createObjectURL(pdfBlob);
      const fname = `${jobNumber}_Switchboard_Audit_${data.date}.pdf`;
      container.innerHTML = `<div class="pdf-actions show"><h3>\u2705 Switchboard Audit Saved</h3><p style="font-size:0.9rem;color:var(--text-secondary);margin-bottom:0.5rem;">PDF generated and uploaded to storage.</p><div class="pdf-actions-buttons"><a href="${pdfUrl}" download="${fname}" class="pdf-btn" id="saDownloadPdf">\uD83D\uDCE5 Download PDF</a><button class="pdf-btn" id="saViewPdf">\uD83D\uDC41 View PDF</button><button class="pdf-btn" id="saDone">\u2713 Done</button></div></div>`;
      container.querySelector('#saViewPdf').addEventListener('click', () => window.open(pdfUrl, '_blank'));
      container.querySelector('#saDone').addEventListener('click', () => { URL.revokeObjectURL(pdfUrl); if (cfg.onComplete) cfg.onComplete(); });
    } catch (e) { console.error('[SwitchboardAudit]', e); BromarHub.hideLoading(); BromarHub.showInfo('Error saving audit: ' + (e.message || e)); }
  }

  /* ══════════════════════════════════════════════════════════
     PDF GENERATION
     ══════════════════════════════════════════════════════════ */
  async function generatePDF(data, jobNumber) {
    await ensureJsPDF();
    const logo = await loadLogo();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
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
      doc.text(VERSION, M, 290);
      doc.text((data.boardId || 'Switchboard') + ' \u2014 Switchboard Inspection Audit', W / 2, 290, { align: 'center' });
      doc.text('Page ' + doc.internal.getNumberOfPages(), W - M, 290, { align: 'right' });
    }

    stamp(); let y = 28;
    doc.setFont('helvetica', 'bold').setFontSize(19).setTextColor(...NAVY); doc.text('Switchboard Inspection Audit', W / 2, y, { align: 'center' }); y += 9;
    doc.setDrawColor(...ORANGE).setLineWidth(0.8).line(M, y, W - M, y); y += 9;

    const colW = W / 2 - M - 5;
    function pairRow(pairs, sy) {
      let ml = 1;
      const blocks = pairs.map(([k, v], i) => { const x = i === 0 ? M : W / 2; const lines = doc.splitTextToSize(v || '\u2014', colW); ml = Math.max(ml, lines.length); return { x, k, lines }; });
      blocks.forEach(b => { doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...MUTED); doc.text(b.k.toUpperCase(), b.x, sy); doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(40, 49, 60); doc.text(b.lines, b.x, sy + 4.5); });
      return sy + 4.5 + ml * 4 + 3;
    }
    y = pairRow([['Client', data.client], ['Site', data.site]], y);
    y = pairRow([['Switchboard ID', data.boardId], ['Location', data.location]], y);
    y = pairRow([['Auditor', data.auditor], ['Date', data.date]], y);
    y = pairRow([['Job Number', jobNumber]], y);
    y += 2;

    const ensure = need => { if (y + need > 280) { doc.addPage(); stamp(); y = 26; } };

    /* Standards reference */
    ensure(20);
    doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...NAVY); doc.text('Applicable Standards', M, y); y += 5;
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(40, 49, 60);
    doc.text(doc.splitTextToSize('This inspection has been conducted with reference to the following Australian standards and regulations:', W - 2 * M), M, y); y += 5;
    doc.autoTable({
      startY: y, margin: { left: M, right: M, top: 22, bottom: 14 },
      body: [['AS/NZS 3000:2018', 'Electrical Installations \u2014 Wiring Rules'], ['AS/NZS 3012:2019', 'Electrical Installations \u2014 Construction & demolition sites'], ['AS/NZS 3760:2022', 'In-service safety inspection & testing of electrical equipment'], ['Electricity Safety Act 1998', 'Victorian electrical safety legislation']],
      styles: { fontSize: 7.5, cellPadding: 1.5 }, columnStyles: { 0: { cellWidth: 42, fontStyle: 'bold', textColor: NAVY } },
      theme: 'plain', alternateRowStyles: { fillColor: [250, 251, 253] }, didDrawPage: stamp,
    });
    y = doc.lastAutoTable.finalY + 6;

    /* Summary cards */
    const passCount = data.items.filter(i => i.result === 'pass').length;
    const failCount = data.items.filter(i => i.result === 'fail').length;
    const naCount = data.items.filter(i => i.result === 'na').length;
    ensure(28);
    doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(...NAVY); doc.text('Results Summary', M, y); y += 6;
    const cards = [['Total Items', ALL_ITEMS.length, NAVY], ['Pass', passCount, [29, 122, 92]], ['Fail', failCount, [192, 57, 43]], ['N/A', naCount, MUTED]];
    const cw = (W - 2 * M - 3 * 4) / 4;
    cards.forEach((c, i) => { const x = M + i * (cw + 4); doc.setFillColor(244, 247, 252).roundedRect(x, y, cw, 16, 2, 2, 'F'); doc.setFont('helvetica', 'bold').setFontSize(15).setTextColor(...c[2]).text(String(c[1]), x + cw / 2, y + 8, { align: 'center' }); doc.setFont('helvetica', 'normal').setFontSize(6.5).setTextColor(...MUTED).text(c[0].toUpperCase(), x + cw / 2, y + 13, { align: 'center' }); });
    y += 24;

    /* Inspection table */
    ensure(16);
    doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(...NAVY); doc.text('Inspection Items', M, y); y += 5;
    const tableBody = [];
    for (const cat of CATEGORIES) {
      tableBody.push([{ content: cat.name, colSpan: 3, styles: { fontStyle: 'bolditalic', fillColor: [255, 247, 237], textColor: [40, 40, 40], fontSize: 8 } }]);
      for (const item of cat.items) {
        const r = data.items.find(i => i.num === item.num); let st = '', sc = MUTED;
        if (r?.result === 'pass') { st = '\u2713 PASS'; sc = [29, 122, 92]; } else if (r?.result === 'fail') { st = '\u2717 FAIL'; sc = [192, 57, 43]; } else if (r?.result === 'na') { st = 'N/A'; sc = MUTED; }
        tableBody.push([{ content: String(item.num), styles: { halign: 'center', fontStyle: 'bold' } }, item.desc, { content: st, styles: { halign: 'center', fontStyle: 'bold', textColor: sc } }]);
      }
    }
    doc.autoTable({ startY: y, margin: { left: M, right: M, top: 22, bottom: 14 }, head: [['#', 'Description', 'Result']], body: tableBody, styles: { fontSize: 7.5, cellPadding: 2 }, headStyles: { fillColor: ORANGE, fontSize: 8 }, alternateRowStyles: { fillColor: [250, 251, 253] }, columnStyles: { 0: { cellWidth: 12 }, 2: { cellWidth: 28 } }, didDrawPage: stamp });
    y = doc.lastAutoTable.finalY + 8;

    /* Hazards — new page */
    if (data.hazards.length > 0) {
      doc.addPage(); stamp(); y = 26;
      doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(...NAVY); doc.text('Hazards / Major Non-Compliance', M, y); y += 5;
      doc.autoTable({ startY: y, margin: { left: M, right: M, top: 22, bottom: 14 }, head: [['#', 'Description']], body: data.hazards.map((h, i) => [i + 1, h]), styles: { fontSize: 8, cellPadding: 2 }, headStyles: { fillColor: [176, 106, 23], fontSize: 8 }, alternateRowStyles: { fillColor: [253, 248, 240] }, columnStyles: { 0: { cellWidth: 12, halign: 'center' } }, didDrawPage: stamp });
      y = doc.lastAutoTable.finalY + 8;
    }

    /* Remedial */
    if (data.remedial.length > 0) {
      ensure(16);
      doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(...NAVY); doc.text('Remedial Works Recommended', M, y); y += 5;
      doc.autoTable({ startY: y, margin: { left: M, right: M, top: 22, bottom: 14 }, head: [['#', 'Description']], body: data.remedial.map((r, i) => [i + 1, r]), styles: { fontSize: 8, cellPadding: 2 }, headStyles: { fillColor: ORANGE, fontSize: 8 }, alternateRowStyles: { fillColor: [250, 251, 253] }, columnStyles: { 0: { cellWidth: 12, halign: 'center' } }, didDrawPage: stamp });
      y = doc.lastAutoTable.finalY + 8;
    }

    /* Photos — own page, 2 per row */
    if (photos.length > 0) {
      doc.addPage(); stamp(); y = 26;
      doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(...NAVY); doc.text('Photos', M, y); y += 8;
      const photoW = 85, photoH = 65, gap = 8, cols = 2;
      for (let i = 0; i < photos.length; i++) {
        const col = i % cols;
        if (col === 0 && i > 0) y += photoH + 22;
        if (y + photoH + 22 > 280) { doc.addPage(); stamp(); y = 26; }
        const px = M + col * (photoW + gap);
        try { doc.addImage(photos[i].dataUrl, 'JPEG', px, y, photoW, photoH); } catch (_) { doc.setDrawColor(200); doc.rect(px, y, photoW, photoH); }
        if (photos[i].description) { doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(...MUTED); doc.text(doc.splitTextToSize(photos[i].description, photoW).slice(0, 3), px, y + photoH + 4); }
      }
    }

    return doc.output('blob');
  }

  return { VERSION, renderForm, collectData, validate, generatePDF, CATEGORIES, ALL_ITEMS };
})();
