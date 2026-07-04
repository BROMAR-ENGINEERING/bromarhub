/* ============================================================
   BROMAR HUB — CABLE SCHEDULE REPORT BUILDER
   Requires: /tools/bromar-report-kit.js (BromarReportKit)
             /tools/auth.js (window.sb)
             jsPDF 2.5.1 + jspdf-autotable 3.8.2

   Usage:
     await window.BromarCableReport.generatePDF(jobNumber, opts)
     opts: { circuits, job, preparedBy }

   Path: /tools/cable-report.js
   Version: V1.02
   ============================================================ */

(function () {
  'use strict';

  const VERSION = 'V1.02';

  /* ── Configure ReportKit paths for Hub (assets at root) ─── */
  if (window.BromarReportKit) {
    window.BromarReportKit.configure({
      logoColour:  '/Bromar-Primary-Logo-Full-Colour.png',
      logoReverse: '/Bromar-Primary-Logo-Reverse-White.png',
    });
  }

  /* ── Installation method SVGs (keyed by installation title) */
  const INSTALL_SVGS = {
    'Spaced from surface': `<svg width="80" height="80" viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg"><rect width="72" height="72" fill="#e8e8e8"/><line x1="4" y1="58" x2="68" y2="58" stroke="#888" stroke-width="3"/><line x1="12" y1="48" x2="12" y2="58" stroke="#888" stroke-width="2"/><line x1="36" y1="48" x2="36" y2="58" stroke="#888" stroke-width="2"/><line x1="60" y1="48" x2="60" y2="58" stroke="#888" stroke-width="2"/><line x1="4" y1="48" x2="68" y2="48" stroke="#888" stroke-width="2"/><circle cx="20" cy="36" r="9" fill="#f90" stroke="#333" stroke-width="1.5"/><circle cx="36" cy="36" r="9" fill="#f90" stroke="#333" stroke-width="1.5"/><circle cx="52" cy="36" r="9" fill="#f90" stroke="#333" stroke-width="1.5"/><circle cx="36" cy="47" r="2" fill="#4a4" stroke="#333" stroke-width="1"/></svg>`,
    'Touching surface': `<svg width="80" height="80" viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg"><rect width="72" height="72" fill="#e8e8e8"/><rect x="4" y="54" width="64" height="8" fill="#bbb" rx="1"/><circle cx="20" cy="44" r="9" fill="#f90" stroke="#333" stroke-width="1.5"/><circle cx="36" cy="44" r="9" fill="#f90" stroke="#333" stroke-width="1.5"/><circle cx="52" cy="44" r="9" fill="#f90" stroke="#333" stroke-width="1.5"/><circle cx="36" cy="53" r="2" fill="#4a4" stroke="#333" stroke-width="1"/></svg>`,
    'Exposed to sun': `<svg width="80" height="80" viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg"><rect width="72" height="72" fill="#e8e8e8"/><circle cx="56" cy="16" r="8" fill="#FFD700"/><rect x="4" y="58" width="64" height="8" fill="#bbb" rx="1"/><circle cx="20" cy="48" r="9" fill="#f90" stroke="#333" stroke-width="1.5"/><circle cx="36" cy="48" r="9" fill="#f90" stroke="#333" stroke-width="1.5"/><circle cx="52" cy="48" r="9" fill="#f90" stroke="#333" stroke-width="1.5"/><circle cx="36" cy="57" r="2" fill="#4a4" stroke="#333" stroke-width="1"/></svg>`,
    'Wiring enclosure in air': `<svg width="80" height="80" viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg"><rect width="72" height="72" fill="#e8e8e8"/><circle cx="36" cy="36" r="26" fill="none" stroke="#555" stroke-width="4"/><circle cx="24" cy="36" r="8" fill="#f90" stroke="#333" stroke-width="1.5"/><circle cx="36" cy="28" r="8" fill="#f90" stroke="#333" stroke-width="1.5"/><circle cx="48" cy="36" r="8" fill="#f90" stroke="#333" stroke-width="1.5"/><circle cx="36" cy="46" r="2" fill="#4a4" stroke="#333" stroke-width="1"/></svg>`,
    'Partially surrounded by thermal insulation, in wiring enclosure': `<svg width="80" height="80" viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg"><rect width="72" height="72" fill="#f0d0d0"/><circle cx="36" cy="36" r="26" fill="none" stroke="#555" stroke-width="4"/><circle cx="24" cy="36" r="8" fill="#f90" stroke="#333" stroke-width="1.5"/><circle cx="36" cy="28" r="8" fill="#f90" stroke="#333" stroke-width="1.5"/><circle cx="48" cy="36" r="8" fill="#f90" stroke="#333" stroke-width="1.5"/><circle cx="36" cy="46" r="2" fill="#4a4" stroke="#333" stroke-width="1"/></svg>`,
    'Partially surrounded by thermal insulation, unenclosed': `<svg width="80" height="80" viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg"><rect width="72" height="72" fill="#f0d0d0"/><circle cx="20" cy="44" r="9" fill="#f90" stroke="#333" stroke-width="1.5"/><circle cx="36" cy="44" r="9" fill="#f90" stroke="#333" stroke-width="1.5"/><circle cx="52" cy="44" r="9" fill="#f90" stroke="#333" stroke-width="1.5"/><circle cx="36" cy="53" r="2" fill="#4a4" stroke="#333" stroke-width="1"/></svg>`,
    'Completely surrounded by thermal insulation, in wiring enclosure': `<svg width="80" height="80" viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg"><rect width="72" height="72" fill="#e8c0c0"/><circle cx="36" cy="36" r="26" fill="none" stroke="#555" stroke-width="4"/><circle cx="24" cy="36" r="8" fill="#f90" stroke="#333" stroke-width="1.5"/><circle cx="36" cy="28" r="8" fill="#f90" stroke="#333" stroke-width="1.5"/><circle cx="48" cy="36" r="8" fill="#f90" stroke="#333" stroke-width="1.5"/><circle cx="36" cy="46" r="2" fill="#4a4" stroke="#333" stroke-width="1"/></svg>`,
    'Completely surrounded by thermal insulation, unenclosed': `<svg width="80" height="80" viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg"><rect width="72" height="72" fill="#e8c0c0"/><circle cx="20" cy="44" r="9" fill="#f90" stroke="#333" stroke-width="1.5"/><circle cx="36" cy="44" r="9" fill="#f90" stroke="#333" stroke-width="1.5"/><circle cx="52" cy="44" r="9" fill="#f90" stroke="#333" stroke-width="1.5"/><circle cx="36" cy="53" r="2" fill="#4a4" stroke="#333" stroke-width="1"/></svg>`,
    'Buried direct': `<svg width="80" height="80" viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg"><rect width="72" height="72" fill="#c8a06a"/><rect x="0" y="0" width="72" height="24" fill="#5a9a3a"/><rect x="0" y="24" width="72" height="48" fill="#8B5E3C"/><circle cx="20" cy="46" r="9" fill="#f90" stroke="#333" stroke-width="1.5"/><circle cx="36" cy="46" r="9" fill="#f90" stroke="#333" stroke-width="1.5"/><circle cx="52" cy="46" r="9" fill="#f90" stroke="#333" stroke-width="1.5"/><circle cx="36" cy="58" r="2" fill="#4a4" stroke="#333" stroke-width="1"/></svg>`,
    'Underground wiring enclosure': `<svg width="80" height="80" viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg"><rect width="72" height="72" fill="#c8a06a"/><rect x="0" y="0" width="72" height="24" fill="#5a9a3a"/><rect x="0" y="24" width="72" height="48" fill="#8B5E3C"/><circle cx="36" cy="46" r="18" fill="none" stroke="#555" stroke-width="4"/><circle cx="28" cy="46" r="6" fill="#f90" stroke="#333" stroke-width="1.5"/><circle cx="36" cy="40" r="6" fill="#f90" stroke="#333" stroke-width="1.5"/><circle cx="44" cy="46" r="6" fill="#f90" stroke="#333" stroke-width="1.5"/><circle cx="36" cy="54" r="2" fill="#4a4" stroke="#333" stroke-width="1"/></svg>`,
  };

  /* ── jsPDF lazy loader ───────────────────────────────────── */
  let _pdfPromise = null;
  function _loadJsPDF() {
    if (window.jspdf) return Promise.resolve();
    if (_pdfPromise) return _pdfPromise;
    _pdfPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      s.onload = () => {
        const s2 = document.createElement('script');
        s2.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';
        s2.onload = resolve;
        s2.onerror = () => reject(new Error('autoTable load failed'));
        document.head.appendChild(s2);
      };
      s.onerror = () => reject(new Error('jsPDF load failed'));
      document.head.appendChild(s);
    });
    return _pdfPromise;
  }

  /* ── SVG → PNG dataURL for embedding ────────────────────── */
  function _svgToPng(svgStr, size) {
    return new Promise(resolve => {
      const blob = new Blob([svgStr], { type: 'image/svg+xml' });
      const url  = URL.createObjectURL(blob);
      const img  = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = c.height = size;
        c.getContext('2d').drawImage(img, 0, 0, size, size);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/png'));
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
  }

  /* ── Fetch circuits from Supabase ────────────────────────── */
  async function _fetch(jobNumber) {
    const { data, error } = await window.sb
      .from('cable_selections').select('*')
      .eq('job_number', jobNumber)
      .order('switchboard').order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
  }

  /* ── Helpers ─────────────────────────────────────────────── */
  const n  = s => window.BromarReportKit.normalize(s);
  const ph = p => p === '3' ? '3\u00d8' : p === '1' ? '1\u00d8' : (p || '\u2014');
  const ident = c => {
    if (!c.circuit_ref) return '\u2014';
    const labels = { ref: 'Ref', nickname: '', fed_from: 'Fed from', cb: 'CB' };
    const pre = labels[c.circuit_ref_type];
    return pre ? pre + ' ' + c.circuit_ref : c.circuit_ref;
  };
  const vdOk = c => c.voltage_drop_pct != null && c.max_vd_pct != null
                    && Number(c.voltage_drop_pct) <= Number(c.max_vd_pct);

  /* ── Main generator ──────────────────────────────────────── */
  async function generatePDF(jobNumber, opts) {
    opts = opts || {};
    const BRK = window.BromarReportKit;
    if (!BRK) throw new Error('BromarReportKit not loaded');

    await _loadJsPDF();

    const circuits   = opts.circuits || await _fetch(jobNumber);
    if (!circuits.length) { alert('No circuits found for job ' + jobNumber); return; }

    const jobInfo    = opts.job || circuits[0] || {};
    const preparedBy = opts.preparedBy || '';
    const today      = BRK.formatDate(new Date());
    const total      = circuits.length;
    const boards     = new Set(circuits.map(c => c.switchboard || '')).size;
    const pass       = circuits.filter(vdOk).length;
    const fail       = total - pass;

    /* Pre-render SVGs → PNG */
    const svgCache = {};
    for (const c of circuits) {
      const key = c.installation || '';
      if (key && !svgCache[key]) {
        const str = INSTALL_SVGS[key];
        svgCache[key] = str ? await _svgToPng(str, 120) : null;
      }
    }

    /* Shorthand palette refs */
    const P  = BRK.PALETTE;
    const LO = BRK.LAYOUT;
    const F  = BRK.FONT;

    const doc = BRK.createDoc();
    const W   = LO.pageW;
    const M   = LO.margin;
    const cW  = LO.contentW;

    /* ── stamp: header + footer on every page ─────────────── */
    let _logoRec = null;
    try {
      _logoRec = await BRK.loadLogoAsset(
        window.BromarReportKit.configure ? '/Bromar-Primary-Logo-Full-Colour.png' : BRK.LAYOUT.logoBox
      );
    } catch (_) {}

    const stamp = (pageNo) => {
      /* Header */
      const a = P.accent.rgb;
      doc.setFillColor(...a); doc.rect(0, 0, W, LO.topBarH, 'F');
      if (_logoRec && _logoRec.dataURL) {
        const dim = BRK.fitBox(_logoRec.w, _logoRec.h, LO.logoBox.w, LO.logoBox.h);
        doc.addImage(_logoRec.dataURL, 'PNG', M, LO.topBarH + 3, dim.w, dim.h, undefined, 'FAST');
      }
      const rx = W - M;
      doc.setFont('helvetica', 'bold').setFontSize(F.heading).setTextColor(...P.navy.rgb);
      doc.text(BRK.COMPANY.name, rx, LO.topBarH + 8, { align: 'right' });
      doc.setFont('helvetica', 'normal').setFontSize(F.small).setTextColor(...P.charcoal.rgb);
      doc.text(BRK.COMPANY.address,                           rx, LO.topBarH + 13, { align: 'right' });
      doc.text('PH: ' + BRK.COMPANY.phone + '   REC: ' + BRK.COMPANY.rec, rx, LO.topBarH + 17.5, { align: 'right' });
      const ln = P.line.rgb;
      doc.setDrawColor(...ln).setLineWidth(0.3);
      doc.line(M, LO.headerH, W - M, LO.headerH);

      /* Footer */
      doc.line(M, LO.footerY - 3, W - M, LO.footerY - 3);
      doc.setFont('helvetica', 'normal').setFontSize(F.tiny).setTextColor(...P.muted.rgb);
      doc.text('Generated: ' + today, M, LO.footerY);
      doc.text('Cable Schedule \u2014 ' + jobNumber + '   \u00b7   AS/NZS 3008', W / 2, LO.footerY, { align: 'center' });
      doc.text('Page ' + pageNo + '   ' + VERSION, W - M, LO.footerY, { align: 'right' });
    };

    let pageNo = 1;
    stamp(pageNo);
    let y = LO.headerH + 8;

    /* ── COVER ───────────────────────────────────────────── */
    doc.setFont('helvetica', 'bold').setFontSize(22).setTextColor(...P.navy.rgb);
    doc.text('Cable Selection Schedule', W / 2, y, { align: 'center' }); y += 8;
    doc.setFont('helvetica', 'normal').setFontSize(12).setTextColor(...P.accent.rgb);
    doc.text('AS/NZS 3008 \u2014 Cable Sizing Report', W / 2, y, { align: 'center' }); y += 5;
    doc.setDrawColor(...P.accent.rgb).setLineWidth(0.8); doc.line(M, y, W - M, y); y += 10;

    /* Job detail box */
    doc.setFillColor(246, 248, 252).setDrawColor(...P.line.rgb).setLineWidth(0.4);
    doc.roundedRect(M, y, cW, 50, 3, 3, 'FD');
    doc.setFillColor(...P.accent.rgb); doc.roundedRect(M, y, 4, 50, 2, 0, 'F');
    const dR = (label, value, dy, right) => {
      const x = right ? W / 2 + 6 : M + 9;
      doc.setFont('helvetica', 'normal').setFontSize(6.5).setTextColor(...P.muted.rgb);
      doc.text(label.toUpperCase(), x, y + dy);
      doc.setFont('helvetica', 'bold').setFontSize(9.5).setTextColor(...P.charcoal.rgb);
      doc.text(doc.splitTextToSize(n(value || '\u2014'), cW / 2 - 16), x, y + dy + 4.5);
    };
    dR('Job Number',   jobNumber,                    6);
    dR('Client',       jobInfo.client_name,          18);
    dR('Site',         jobInfo.site_name,            30);
    dR('Site Address', jobInfo.site_address,          6, true);
    dR('Date',         today,                        18, true);
    dR('Prepared By',  preparedBy,                   30, true);
    y += 58;

    /* Stat cards */
    const cards = [
      ['Total Circuits', total,  P.navy.rgb],
      ['VD Pass',        pass,   P.success.rgb],
      ['VD Fail',        fail,   P.error.rgb],
      ['Switchboards',   boards, P.navy.rgb],
    ];
    const cw4 = (cW - 9) / 4;
    cards.forEach(([label, val, col], i) => {
      const cx = M + i * (cw4 + 3);
      doc.setFillColor(240, 244, 252).setDrawColor(...P.line.rgb);
      doc.roundedRect(cx, y, cw4, 22, 2, 2, 'FD');
      doc.setFont('helvetica', 'bold').setFontSize(18).setTextColor(...col);
      doc.text(String(val), cx + cw4 / 2, y + 12, { align: 'center' });
      doc.setFont('helvetica', 'normal').setFontSize(6.5).setTextColor(...P.muted.rgb);
      doc.text(label.toUpperCase(), cx + cw4 / 2, y + 19, { align: 'center' });
    });
    y += 30;

    doc.setFont('helvetica', 'italic').setFontSize(7.5).setTextColor(...P.muted.rgb);
    const coverNote = 'Cable sizes selected per AS/NZS 3008. Current ratings from Tables 7\u201315 for the selected installation method. Voltage drop using R/X values from Tables 30\u201335. Pass = actual VD% \u2264 max VD%. Verify on site before installation.';
    doc.text(doc.splitTextToSize(coverNote, cW), W / 2, y, { align: 'center' });

    /* ── METHODOLOGY PAGE ────────────────────────────────── */
    doc.addPage(); pageNo++; stamp(pageNo); y = LO.headerH + 8;

    doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(...P.navy.rgb);
    doc.text('Calculation Methodology', M, y); y += 3;
    doc.setDrawColor(...P.accent.rgb).setLineWidth(0.5); doc.line(M, y, W - M, y); y += 8;

    const methods = [
      ['Standard Reference',     'AS/NZS 3008.1.1:2017 - Selection of Cables - Cables for alternating voltages up to and including 0.6/1 kV - Typical Australian installation conditions. Specifies current-carrying capacity, voltage drop, and short-circuit ratings for Australian cable installations.'],
      ['Current Rating (Imax)',  'Maximum continuous current ratings sourced from AS/NZS 3008 Tables 7-15, selected by conductor material (copper or aluminium), insulation type (PVC 75/90 deg C, XLPE 90/110 deg C), and installation method. Selected active size must have Imax >= design load current.'],
      ['Voltage Drop',           '3-Phase AC: VD = sqrt(3) x I x L x Z / 1000\n1-Phase AC: VD = 2 x I x L x Z / 1000\nDC: VD = 2 x I x L x R / 1000\nWhere Z = sqrt(R^2 + X^2) worst-case PF, or Z = R.cos(phi) + X.sin(phi) for specified PF. R and X values from Tables 30-35. L = one-way run in metres.'],
      ['Earth Conductor',        'Protective earth sizes selected per AS/NZS 3000:2018 Table 5.1 based on active conductor CSA. Final sizing must be confirmed against fault loop impedance and prospective short-circuit current calculations.'],
      ['Installation Method',    'Installation method determines thermal derating. Each circuit card includes the AS/NZS 3008 installation method diagram showing the physical cable arrangement that governs which current rating table applies.'],
      ['Table Values',           'Tables 34 (Cu) and 35 (Al): DC resistance at 75 deg C. Tables 30-31: AC reactance for multicore and single-core cables. Current rating tables 7-15 cross-referenced by installation reference number matching the selected installation method.'],
      ['Disclaimer',             'Design aid only. The licensed electrical contractor and engineer of record are responsible for verifying all cable selections against site conditions and applicable standards prior to installation. Bromar Electrical Services accepts no liability for errors from incorrect input data.'],
    ];

    for (const [heading, text] of methods) {
      if (y > LO.footerY - 30) { doc.addPage(); pageNo++; stamp(pageNo); y = LO.headerH + 8; }
      doc.setFont('helvetica', 'bold').setFontSize(8.5).setTextColor(...P.accent.rgb);
      doc.text(heading, M, y); y += 5;
      doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...P.charcoal.rgb);
      const lines = doc.splitTextToSize(n(text), cW);
      doc.text(lines, M, y); y += lines.length * 3.8 + 5;
    }

    /* ── ONE CARD PER CIRCUIT ────────────────────────────── */
    for (const c of circuits) {
      doc.addPage(); pageNo++; stamp(pageNo); y = LO.headerH + 6;

      const ok      = vdOk(c);
      const okRgb   = ok ? P.success.rgb : P.error.rgb;
      const okBgRgb = ok ? [209, 250, 229] : [254, 226, 226];
      const okLabel = ok ? '\u2713  PASS' : '\u2717  FAIL';
      const id      = ident(c);

      /* Card header band */
      doc.setFillColor(...P.navy.rgb); doc.rect(M, y, cW, 10, 'F');
      doc.setFillColor(...okRgb); doc.rect(W - M - 26, y, 26, 10, 'F');
      doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(255, 255, 255);
      doc.text(n((id !== '\u2014' ? id + '  \u2014  ' : '') + (c.description || '\u2014')), M + 5, y + 7);
      doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(255, 255, 255);
      doc.text(okLabel, W - M - 13, y + 6.5, { align: 'center' });
      y += 13;

      if (c.switchboard) {
        doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...P.muted.rgb);
        doc.text('Switchboard / Area:  ' + n(c.switchboard), M, y); y += 7;
      }

      /* Left: installation diagram */
      const diagSize = 42;
      const svgPng   = svgCache[c.installation || ''];
      if (svgPng) {
        doc.addImage(svgPng, 'PNG', M, y, diagSize, diagSize);
      } else {
        doc.setFillColor(240, 240, 240); doc.rect(M, y, diagSize, diagSize, 'F');
      }
      /* Label under diagram */
      doc.setFont('helvetica', 'normal').setFontSize(6.5).setTextColor(...P.muted.rgb);
      const instLines = doc.splitTextToSize(n(c.installation || '\u2014'), diagSize);
      doc.text(instLines, M + diagSize / 2, y + diagSize + 4.5, { align: 'center' });

      /* Right: 2-column spec grid */
      const gridX = M + diagSize + 8;
      const gridW = cW - diagSize - 8;
      const colW2 = (gridW - 3) / 2;
      const specs = [
        ['Phase',          ph(c.phase)],
        ['Voltage',        c.voltage_v != null ? c.voltage_v + ' V' : '\u2014'],
        ['Load / Rating',  c.rating_value != null ? c.rating_value + ' ' + (c.rating_unit || '') : '\u2014'],
        ['Cable Distance', c.cable_distance_m != null ? c.cable_distance_m + ' m' : '\u2014'],
        ['Max VD%',        c.max_vd_pct != null ? c.max_vd_pct + '%' : '\u2014'],
        ['Conductor',      n(c.conductor)],
        ['Insulation',     n(c.insulation)],
        ['Cable Type',     n(c.cable_type)],
      ];
      let gy = y;
      specs.forEach(([label, value], i) => {
        const col = i % 2;
        if (i > 0 && col === 0) gy += 15;
        const cx = gridX + col * (colW2 + 3);
        doc.setFillColor(...[249, 250, 252]); doc.rect(cx, gy, colW2, 13, 'F');
        doc.setFont('helvetica', 'normal').setFontSize(6.5).setTextColor(...P.muted.rgb);
        doc.text(label.toUpperCase(), cx + 3, gy + 5);
        doc.setFont('helvetica', 'bold').setFontSize(8.5).setTextColor(...P.charcoal.rgb);
        doc.text(doc.splitTextToSize(n(value), colW2 - 6), cx + 3, gy + 10);
      });
      y = Math.max(y + diagSize + 12, gy + 18);

      /* Result band */
      doc.setFillColor(...okBgRgb);
      doc.setDrawColor(...okRgb).setLineWidth(0.5);
      doc.rect(M, y, cW, 28, 'FD');
      doc.setFillColor(...okRgb); doc.rect(M, y, 4, 28, 'F');

      const results = [
        ['Selected Active', c.active_size_mm2  != null ? c.active_size_mm2  + ' mm\u00b2' : '\u2014'],
        ['Earth Size',      c.earth_size_mm2   != null ? c.earth_size_mm2   + ' mm\u00b2' : '\u2014'],
        ['Imax',            c.current_rating_a != null ? c.current_rating_a + ' A'         : '\u2014'],
        ['Voltage Drop',    c.voltage_drop_v   != null ? c.voltage_drop_v   + ' V'         : '\u2014'],
        ['VD%',             c.voltage_drop_pct != null ? c.voltage_drop_pct + '%'           : '\u2014'],
        ['Result',          okLabel],
      ];
      const rcW = (cW - 8) / results.length;
      results.forEach(([label, value], i) => {
        const cx = M + 6 + i * (rcW + 1);
        const isResult = label === 'Result';
        const isVD     = label === 'VD%';
        doc.setFont('helvetica', 'normal').setFontSize(6.5).setTextColor(...P.muted.rgb);
        doc.text(label.toUpperCase(), cx + rcW / 2, y + 8, { align: 'center' });
        doc.setFont('helvetica', 'bold').setFontSize(isResult ? 11 : 13)
           .setTextColor(...((isResult || isVD) ? okRgb : P.charcoal.rgb));
        doc.text(n(value), cx + rcW / 2, y + 21, { align: 'center' });
      });
      y += 32;

      if (c.notes) {
        doc.setFont('helvetica', 'italic').setFontSize(8).setTextColor(...P.muted.rgb);
        doc.text('Notes: ' + n(c.notes), M, y);
      }
    }

    /* ── DISCLAIMER ──────────────────────────────────────── */
    doc.addPage(); pageNo++; stamp(pageNo); y = LO.headerH + 8;
    doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(...P.navy.rgb);
    doc.text('Disclaimer & Document Control', M, y); y += 3;
    doc.setDrawColor(...P.accent.rgb).setLineWidth(0.5); doc.line(M, y, W - M, y); y += 8;

    for (const [h, t] of [
      ['Disclaimer', 'This document is a design aid only. The licensed electrical contractor and engineer of record are responsible for verifying all cable selections against site conditions and applicable standards prior to installation. Bromar Electrical Services accepts no liability for errors from incorrect input data.'],
      ['Retention',  'Retain this document as a record of cable selection calculations. Re-issue and supersede if design parameters change.'],
      ['Standard',   'AS/NZS 3008.1.1:2017 - Selection of Cables. AS/NZS 3000:2018 - Wiring Rules (earth sizing).'],
    ]) {
      doc.setFont('helvetica', 'bold').setFontSize(8.5).setTextColor(...P.accent.rgb);
      doc.text(h, M, y); y += 5;
      doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...P.charcoal.rgb);
      const lines = doc.splitTextToSize(n(t), cW); doc.text(lines, M, y); y += lines.length * 3.8 + 6;
    }

    /* Signature block */
    if (y > LO.footerY - 42) { doc.addPage(); pageNo++; stamp(pageNo); y = LO.headerH + 8; }
    y += 4;
    doc.setDrawColor(...P.line.rgb).setLineWidth(0.3); doc.rect(M, y, cW, 34, 'S');
    doc.setFillColor(...P.accent.rgb); doc.rect(M, y, 4, 34, 'F');
    doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(...P.navy.rgb);
    doc.text('Prepared by', M + 9, y + 7);
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...P.charcoal.rgb);
    doc.text(n(preparedBy || BRK.COMPANY.name), M + 9, y + 13);
    doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...P.muted.rgb);
    doc.text(BRK.COMPANY.address + '   ABN: 45 634 835 939', M + 9, y + 19);
    doc.text('REC: ' + BRK.COMPANY.rec + '   PH: ' + BRK.COMPANY.phone + '   ' + BRK.COMPANY.web, M + 9, y + 24);
    doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(...P.navy.rgb);
    doc.text('Document Version', W - M - 52, y + 7);
    doc.setFont('helvetica', 'bold').setFontSize(18).setTextColor(...P.accent.rgb);
    doc.text(VERSION, W - M - 52, y + 18);
    doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...P.muted.rgb);
    doc.text('Generated ' + today, W - M - 52, y + 25);

    /* ── Save ────────────────────────────────────────────── */
    const clean = s => String(s || '').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '');
    doc.save([jobNumber, clean(jobInfo.client_name) || null, 'Cable_Schedule']
      .filter(Boolean).join('_') + '.pdf');
  }

  window.BromarCableReport = { version: VERSION, generatePDF };
})();
