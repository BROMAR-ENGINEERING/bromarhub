/* ============================================================
   BROMAR REPORT KIT — shared PDF / report styling
   Single source of truth for branding across report modules
   (test & tag, quotes, safety, jobs) in Bromar Ops + Bromar Hub.

   Registers: window.BromarReportKit
   Requires : jsPDF 2.5.1 UMD (+ jspdf-autotable 3.8.2 for tables)
              Style 2 also requires html2canvas 1.4.1 (rich card look)
   Pattern  : window-export, no build step, no framework.

   Two output styles:
     STYLE 1 — jsPDF vector: drawHeader / drawFooter / pairRow /
               sectionHeading / para. Sharp, selectable, small files.
     STYLE 2 — BromarReportKit.style2.* : rich card look (orange
               gradient stat cards, icons, rounded panels) built as
               HTML and captured with html2canvas. Faithful but raster.

   VERSION V1.03
   (+0.01 per change; major digit only bumps on explicit major change)
   ============================================================ */

(function () {
  'use strict';

  const VERSION = 'V1.03';

  /* ── CONFIG ──
     Bromar Ops and Bromar Hub are separate repos but run this file
     byte-identical. Both repos must keep their logos at assets/logo/.
     configure() remains available if a repo ever needs to override. */
  const config = {
    logoColour:  'assets/logo/bromar-logo-colour.png',
    logoReverse: 'assets/logo/bromar-logo-white.png'
  };

  function configure(opts) {
    if (!opts) return;
    if (opts.logoColour)  config.logoColour  = opts.logoColour;
    if (opts.logoReverse) config.logoReverse = opts.logoReverse;
  }

  /* ── COMPANY CONSTANTS (single source of truth) ── */
  const COMPANY = {
    name:    'Bromar Electrical Services Pty Ltd',
    address: '2/98-108 Western Ave, Westmeadows 3049',
    phone:   '9335 5344',
    rec:     '30340',
    web:     'www.bromar.com.au'
  };

  /* ── PALETTE ──
     hex = for HTML/on-screen previews · rgb = for jsPDF (arrays) */
  const PALETTE = {
    accent:   { hex: '#ea580c', rgb: [234, 88, 12]  },  // orange
    navy:     { hex: '#243b6b', rgb: [36, 59, 107]   },
    charcoal: { hex: '#44474d', rgb: [68, 71, 77]    },
    muted:    { hex: '#8e8e99', rgb: [142, 142, 153] },  // muted grey
    line:     { hex: '#d9d9de', rgb: [217, 217, 222] },  // hairlines
    success:  { hex: '#15803d', rgb: [21, 128, 61]   },
    error:    { hex: '#dc2626', rgb: [220, 38, 38]   },
    white:    { hex: '#ffffff', rgb: [255, 255, 255] },
    black:    { hex: '#1a1a1e', rgb: [26, 26, 30]    }
  };

  /* ── LAYOUT TOKENS (mm; assumes doc unit:'mm', format:'a4') ── */
  const LAYOUT = {
    pageW: 210,
    pageH: 297,
    margin: 14,
    get contentW() { return this.pageW - this.margin * 2; },
    topBarH: 4,          // orange strip at very top
    headerH: 34,         // reserved header zone height
    footerY: 285,        // baseline for footer text
    logoBox: { w: 46, h: 18 }  // max logo footprint (aspect-fit inside)
  };

  const FONT = {
    tiny: 7,
    small: 8,
    body: 10,
    label: 9,
    heading: 12,
    title: 15
  };

  /* ── LOGO LOADER ── fetch → dataURL, cached, with dimensions ── */
  const _logoCache = {};   // key: url → { dataURL, w, h }

  function loadLogoAsset(url) {
    if (_logoCache[url]) return Promise.resolve(_logoCache[url]);
    return fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error('logo fetch ' + r.status);
        return r.blob();
      })
      .then(function (blob) {
        return new Promise(function (resolve, reject) {
          const fr = new FileReader();
          fr.onload = function () { resolve(fr.result); };
          fr.onerror = reject;
          fr.readAsDataURL(blob);
        });
      })
      .then(function (dataURL) {
        return new Promise(function (resolve) {
          const img = new Image();
          img.onload = function () {
            const rec = { dataURL: dataURL, w: img.naturalWidth, h: img.naturalHeight };
            _logoCache[url] = rec;
            resolve(rec);
          };
          img.onerror = function () {
            const rec = { dataURL: dataURL, w: 0, h: 0 };
            _logoCache[url] = rec;
            resolve(rec);
          };
          img.src = dataURL;
        });
      });
  }

  // aspect-fit natural dims into a target box → {w,h} in mm
  function fitBox(natW, natH, boxW, boxH) {
    if (!natW || !natH) return { w: boxW, h: boxH };
    const scale = Math.min(boxW / natW, boxH / natH);
    return { w: natW * scale, h: natH * scale };
  }

  /* ── ASCII NORMALISER ──
     jsPDF built-in fonts are WinAnsi; strip/replace anything that
     would render as garbage. */
  function normalize(input) {
    if (input === null || input === undefined) return '';
    let s = String(input);
    s = s.replace(/<[^>]*>/g, '');                 // strip tags
    s = s.replace(/I\s*Δ\s*n/gi, 'I delta-n');     // IΔn → readable
    s = s.replace(/Δ/g, 'delta');
    s = s.replace(/[\u2018\u2019\u201A\u201B]/g, "'");   // smart singles
    s = s.replace(/[\u201C\u201D\u201E\u201F]/g, '"');   // smart doubles
    s = s.replace(/[\u2013\u2014\u2015]/g, '-');   // en/em dash
    s = s.replace(/\u2026/g, '...');               // ellipsis
    s = s.replace(/[\u00A0\u2007\u202F]/g, ' ');   // nbsp variants
    s = s.replace(/[\u2022\u25AA\u25CF]/g, '-');   // bullets
    s = s.replace(/[\u00B1]/g, '+/-');
    s = s.replace(/[\u00B5]/g, 'u');               // micro
    s = s.replace(/[\u03A9\u2126]/g, 'ohm');       // omega
    s = s.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, ''); // drop remaining non-ascii
    return s;
  }

  /* ── internal font helper ── */
  function setFont(doc, size, style, rgb) {
    doc.setFontSize(size || FONT.body);
    doc.setFont('helvetica', style || 'normal');
    const c = rgb || PALETTE.charcoal.rgb;
    doc.setTextColor(c[0], c[1], c[2]);
  }

  /* ── HEADER ──
     orange top bar · logo top-left · right-aligned company block.
     async because the logo is fetched. `dark` picks reverse-white
     over full-colour (for dark backgrounds); default full-colour. */
  function drawHeader(doc, opts) {
    opts = opts || {};
    const M = LAYOUT.margin;
    const url = opts.dark ? config.logoReverse : config.logoColour;

    // orange top bar
    const a = PALETTE.accent.rgb;
    doc.setFillColor(a[0], a[1], a[2]);
    doc.rect(0, 0, LAYOUT.pageW, LAYOUT.topBarH, 'F');

    // right-aligned company block
    const rx = LAYOUT.pageW - M;
    let y = LAYOUT.topBarH + 8;
    setFont(doc, FONT.heading, 'bold', PALETTE.navy.rgb);
    doc.text(COMPANY.name, rx, y, { align: 'right' });
    setFont(doc, FONT.small, 'normal', PALETTE.charcoal.rgb);
    y += 4.6;
    doc.text(COMPANY.address, rx, y, { align: 'right' });
    y += 4.2;
    doc.text('PH: ' + COMPANY.phone + '     REC: ' + COMPANY.rec, rx, y, { align: 'right' });
    y += 4.2;
    doc.text('WEB: ' + COMPANY.web, rx, y, { align: 'right' });

    // hairline under header
    const ln = PALETTE.line.rgb;
    doc.setDrawColor(ln[0], ln[1], ln[2]);
    doc.setLineWidth(0.3);
    doc.line(M, LAYOUT.headerH, LAYOUT.pageW - M, LAYOUT.headerH);

    // logo top-left (fetched → aspect-fit → placed)
    return loadLogoAsset(url).then(function (rec) {
      if (!rec || !rec.dataURL) throw new Error('no logo');
      const box = LAYOUT.logoBox;
      const dim = fitBox(rec.w, rec.h, box.w, box.h);
      const ly = LAYOUT.topBarH + 5;
      const fmt = /^data:image\/png/i.test(rec.dataURL) ? 'PNG' : 'JPEG';
      doc.addImage(rec.dataURL, fmt, M, ly, dim.w, dim.h, undefined, 'FAST');
      return LAYOUT.headerH;
    }).catch(function () {
      // text fallback if the image can't load
      setFont(doc, FONT.title, 'bold', PALETTE.accent.rgb);
      doc.text('BROMAR', M, LAYOUT.topBarH + 12);
      return LAYOUT.headerH;
    });
  }

  /* ── FOOTER ──
     generated-date left · centred title (+ optional ref) · page no right */
  function drawFooter(doc, opts) {
    opts = opts || {};
    const M = LAYOUT.margin;
    const y = LAYOUT.footerY;
    const ln = PALETTE.line.rgb;

    doc.setDrawColor(ln[0], ln[1], ln[2]);
    doc.setLineWidth(0.3);
    doc.line(M, y - 3, LAYOUT.pageW - M, y - 3);

    setFont(doc, FONT.tiny, 'normal', PALETTE.muted.rgb);

    // left: generated date
    doc.text('Generated: ' + formatDate(new Date()), M, y, { align: 'left' });

    // centre: title + optional ref
    let centre = opts.title ? normalize(opts.title) : '';
    if (opts.ref) centre += (centre ? '  ·  ' : '') + normalize(opts.ref);
    if (centre) doc.text(centre, LAYOUT.pageW / 2, y, { align: 'center' });

    // right: page number
    if (opts.pageNo !== undefined && opts.pageNo !== null) {
      doc.text('Page ' + opts.pageNo, LAYOUT.pageW - M, y, { align: 'right' });
    }
  }

  function formatDate(d) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
  }

  /* ── HELPERS ── */

  // two-column key/value block. returns the y after the row.
  function pairRow(doc, x, y, label, value, opts) {
    opts = opts || {};
    const labelW = opts.labelW || 34;
    setFont(doc, opts.size || FONT.body, 'bold', PALETTE.charcoal.rgb);
    doc.text(normalize(label), x, y);
    setFont(doc, opts.size || FONT.body, 'normal', (opts.valueRgb || PALETTE.black.rgb));
    const vx = x + labelW;
    const maxW = opts.width || (LAYOUT.pageW - LAYOUT.margin - vx);
    const lines = doc.splitTextToSize(normalize(value), maxW);
    doc.text(lines, vx, y);
    return y + lines.length * ((opts.size || FONT.body) * 0.42 + 1.4);
  }

  // section heading with accent tab. returns y after the heading.
  function sectionHeading(doc, x, y, text) {
    const a = PALETTE.accent.rgb;
    doc.setFillColor(a[0], a[1], a[2]);
    doc.rect(x, y - 3.4, 1.6, 4.6, 'F');
    setFont(doc, FONT.heading, 'bold', PALETTE.navy.rgb);
    doc.text(normalize(text), x + 3.5, y);
    return y + 6;
  }

  // paragraph. sets font BEFORE splitTextToSize (so wrapping matches),
  // page-breaks cleanly, and re-sets font after any break.
  // returns the y after the paragraph.
  function para(doc, x, y, text, opts) {
    opts = opts || {};
    const size = opts.size || FONT.body;
    const style = opts.style || 'normal';
    const rgb = opts.rgb || PALETTE.charcoal.rgb;
    const width = opts.width || (LAYOUT.pageW - LAYOUT.margin - x);
    const lh = opts.lineHeight || (size * 0.42 + 1.6);
    const bottom = opts.bottom || (LAYOUT.footerY - 6);

    setFont(doc, size, style, rgb);
    const lines = doc.splitTextToSize(normalize(text), width);

    for (let i = 0; i < lines.length; i++) {
      if (y > bottom) {
        doc.addPage();
        y = LAYOUT.headerH + 6;
        setFont(doc, size, style, rgb);   // re-set after break
      }
      doc.text(lines[i], x, y);
      y += lh;
    }
    return y;
  }

  /* ── convenience: create a correctly-configured jsPDF doc ── */
  function createDoc() {
    const JsPDF = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    if (!JsPDF) throw new Error('jsPDF not loaded');
    return new JsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  }

  /* ── preview CSS custom props (so on-screen previews match PDF) ── */
  function injectPreviewVars() {
    if (document.getElementById('brk-preview-vars')) return;
    const css = ':root{' +
      '--brk-accent:' + PALETTE.accent.hex + ';' +
      '--brk-navy:' + PALETTE.navy.hex + ';' +
      '--brk-charcoal:' + PALETTE.charcoal.hex + ';' +
      '--brk-muted:' + PALETTE.muted.hex + ';' +
      '--brk-line:' + PALETTE.line.hex + ';' +
      '--brk-success:' + PALETTE.success.hex + ';' +
      '--brk-error:' + PALETTE.error.hex + ';' +
      '}';
    const style = document.createElement('style');
    style.id = 'brk-preview-vars';
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ============================================================
     STYLE 2 — rich card look (HTML + html2canvas)
     Reusable building blocks that mirror the switchboard schedule:
     header (logo left / company centre / big orange title right),
     rounded info panel with optional badge, orange-gradient stat
     cards with icons, boxed grid, footer. Compose then generate().
     ============================================================ */

  const S2_ID = 'brk2-css';

  const S2_CSS =
    ".brk2-page{position:relative;width:760px;min-height:1074px;margin:0 auto;background:#fff;color:#000;font-family:'Outfit',Arial,sans-serif;padding:24px 26px 70px;box-sizing:border-box;}" +
    ".brk2-head{display:flex;justify-content:space-between;align-items:center;gap:14px;margin-bottom:6px;}" +
    ".brk2-logo{max-height:42px;width:auto;}" +
    ".brk2-center{flex:1;text-align:left;padding-left:30px;font-size:8px;color:#555;line-height:1.32;}" +
    ".brk2-title{font-size:26px;font-weight:800;color:" + PALETTE.accent.hex + ";letter-spacing:-0.01em;line-height:1.05;text-align:center;}" +
    ".brk2-info{border:1px solid #e2e2e2;border-radius:10px;overflow:hidden;margin-bottom:8px;box-shadow:0 2px 6px rgba(0,0,0,0.05);}" +
    ".brk2-info-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:8px 16px;background:#fff;}" +
    ".brk2-info-title{font-size:18px;font-weight:800;color:#1a1a1e;letter-spacing:-0.02em;line-height:1.05;text-transform:uppercase;}" +
    ".brk2-info-sub{font-size:8.5px;color:#8a8a8a;margin-top:1px;text-transform:uppercase;letter-spacing:1.5px;font-weight:600;}" +
    ".brk2-info-warn{flex:none;background:#fdeaea;color:#d21f1f;border:1px solid #f3b4b4;border-radius:6px;padding:5px 10px;font-size:8px;font-weight:800;text-align:center;line-height:1.2;letter-spacing:.5px;}" +
    ".brk2-stats{display:flex;}" +
    ".brk2-stats + .brk2-stats{border-top:1px solid rgba(0,0,0,0.07);}" +
    ".brk2-stats .brk2-stat{flex:1;display:flex;align-items:center;gap:8px;padding:5px 14px;min-width:0;}" +
    ".brk2-stats .brk2-stat + .brk2-stat{border-left:1px solid rgba(255,255,255,0.25);}" +
    ".brk2-stats-secondary .brk2-stat + .brk2-stat{border-left:1px solid #ececec;}" +
    ".brk2-stat-t{display:flex;flex-direction:column;line-height:1.1;min-width:0;}" +
    ".brk2-lbl{font-size:7px;text-transform:uppercase;letter-spacing:.5px;opacity:.85;font-weight:600;}" +
    ".brk2-val{font-size:11px;font-weight:800;word-break:break-word;text-transform:uppercase;}" +
    ".brk2-stats-primary{background:linear-gradient(90deg," + PALETTE.accent.hex + " 0%,#f97316 100%);color:#fff;}" +
    ".brk2-stats-secondary{background:#f8f8f8;color:#1a1a1e;}" +
    ".brk2-stats-secondary .brk2-lbl{color:#9a9a9a;opacity:1;}" +
    ".brk2-gridwrap{border:1px solid #e2e2e2;border-radius:10px;overflow:hidden;}" +
    ".brk2-section{display:flex;align-items:center;gap:8px;margin:14px 0 6px;}" +
    ".brk2-section .brk2-bar{width:4px;height:15px;border-radius:3px;background:linear-gradient(180deg," + PALETTE.accent.hex + ",#fb923c);}" +
    ".brk2-section-t{font-size:13px;font-weight:800;color:" + PALETTE.navy.hex + ";text-transform:uppercase;letter-spacing:.3px;}" +
    ".brk2-p{font-size:9.5px;color:" + PALETTE.charcoal.hex + ";line-height:1.5;margin:0 0 8px;}" +
    ".brk2-grid{width:100%;border-collapse:collapse;font-size:9px;table-layout:fixed;line-height:1.15;}" +
    ".brk2-grid th,.brk2-grid td{border:1px solid #e2e2e2;padding:1.5px 5px;}" +
    ".brk2-grid th{font-weight:700;text-align:center;background:#f8f8f8;color:#1a1a1e;}" +
    ".brk2-grid td.cb{text-align:center;font-weight:700;background:#f2f2f2;color:#1a1a1e;}" +
    ".brk2-grid td.ctr{text-align:center;}" +
    ".brk2-band td{background:#1a1a1e;color:#fff;font-weight:700;text-align:center;letter-spacing:0.5px;}" +
    ".brk2-break td{background:#1a1a1e;color:#fff;font-weight:800;text-align:center;letter-spacing:1px;font-size:10px;}" +
    ".brk2-foot{position:absolute;left:26px;right:26px;bottom:42px;display:flex;justify-content:space-between;gap:16px;padding-top:8px;border-top:1px solid #ececec;}" +
    ".brk2-foot-item{display:flex;align-items:center;gap:6px;font-size:8.5px;color:#777;}";

  function s2InjectCSS() {
    if (document.getElementById(S2_ID)) return;
    const st = document.createElement('style');
    st.id = S2_ID;
    st.textContent = S2_CSS;
    document.head.appendChild(st);
  }

  const S2_ICONS = {
    switch:   '<path d="M18.36 6.64A9 9 0 1 1 5.64 6.64"/><line x1="12" y1="2" x2="12" y2="12"/>',
    bolt:     '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    battery:  '<rect x="1" y="6" width="18" height="12" rx="2"/><line x1="23" y1="10" x2="23" y2="14"/><line x1="6" y1="10" x2="6" y2="14"/>',
    grid:     '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
    tag:      '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',
    box:      '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
    map:      '<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>',
    trefoil:  '<circle cx="12" cy="7.5" r="4.2"/><circle cx="7.3" cy="15.5" r="4.2"/><circle cx="16.7" cy="15.5" r="4.2"/>',
    login:    '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>',
    branch:   '<line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
    note:     '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
    person:   '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    check:    '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'
  };

  function escHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // inline icon (raw SVG). color defaults to accent.
  function s2Icon(name, color, size) {
    const sz = size || 15;
    const col = color || PALETTE.accent.hex;
    return '<svg viewBox="0 0 24 24" width="' + sz + '" height="' + sz + '" style="flex:none" fill="none" stroke="' + col + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (S2_ICONS[name] || '') + '</svg>';
  }

  // one stat card. label/value are escaped; icon is raw.
  function s2StatCard(icon, label, value, color, grow) {
    const st = grow ? ' style="flex:' + grow + '"' : '';
    return '<div class="brk2-stat"' + st + '>' + (icon || '') +
      '<div class="brk2-stat-t"><span class="brk2-lbl">' + escHtml(label) +
      '</span><span class="brk2-val">' + (value ? escHtml(value) : '—') + '</span></div></div>';
  }

  // a row of stat cards. variant 'primary' (orange gradient) | 'secondary' (grey).
  // cards = array of stat-card HTML strings (use s2StatCard).
  function s2StatRow(variant, cards) {
    const list = Array.isArray(cards) ? cards.join('') : (cards || '');
    return '<div class="brk2-stats brk2-stats-' + (variant === 'primary' ? 'primary' : 'secondary') + '">' + list + '</div>';
  }

  // rounded info panel. { title, subtitle, badge, rows } where rows is
  // pre-built stat-row HTML (use s2StatRow). title/subtitle/badge escaped.
  function s2InfoPanel(cfg) {
    cfg = cfg || {};
    return '<div class="brk2-info"><div class="brk2-info-head"><div>' +
      '<div class="brk2-info-title">' + escHtml(cfg.title || '') + '</div>' +
      (cfg.subtitle ? '<div class="brk2-info-sub">' + escHtml(cfg.subtitle) + '</div>' : '') +
      '</div>' +
      (cfg.badge ? '<div class="brk2-info-warn">' + cfg.badge + '</div>' : '') +
      '</div>' + (cfg.rows || '') + '</div>';
  }

  // footer strip. left/right are raw HTML (icon + text).
  function s2Footer(leftHTML, rightHTML) {
    return '<div class="brk2-foot"><div class="brk2-foot-item">' + (leftHTML || '') +
      '</div><div class="brk2-foot-item">' + (rightHTML || '') + '</div></div>';
  }

  // company block used in the Style 2 header (single source of truth).
  function s2CompanyBlock(extraLine) {
    return COMPANY.address + '<br>Ph: ' + COMPANY.phone + ' &nbsp;&middot;&nbsp; REC: ' + COMPANY.rec +
      '<br>WEB: ' + COMPANY.web + (extraLine ? '<br>' + extraLine : '');
  }

  // header: logo left, company centre, big orange title right.
  // title is raw (allows <br>); logoDataURL supplied by page().
  function s2Header(logoDataURL, title, extraLine) {
    const logo = logoDataURL
      ? '<img class="brk2-logo" src="' + logoDataURL + '" alt="Bromar"/>'
      : '<div class="brk2-title" style="font-size:20px;text-align:left">BROMAR</div>';
    return '<div class="brk2-head">' + logo +
      '<div class="brk2-center">' + s2CompanyBlock(extraLine) + '</div>' +
      '<div class="brk2-title">' + (title || '') + '</div></div>';
  }

  // build a full Style 2 page element (off-screen ready).
  // cfg: { title, extraLine, body (raw HTML between header & footer),
  //        footerLeft, footerRight, dark }
  // returns a Promise<HTMLElement>.
  function s2Page(cfg) {
    cfg = cfg || {};
    s2InjectCSS();
    const url = cfg.dark ? config.logoReverse : config.logoColour;
    return loadLogoAsset(url).then(function (rec) {
      return (rec && rec.dataURL) || '';
    }).catch(function () {
      return '';
    }).then(function (logoDataURL) {
      const el = document.createElement('div');
      el.className = 'brk2-page';
      el.innerHTML =
        s2Header(logoDataURL, cfg.title || '', cfg.extraLine) +
        (cfg.body || '') +
        s2Footer(cfg.footerLeft, cfg.footerRight);
      return el;
    });
  }

  // capture a Style 2 element to a multi-page A4 PDF and save.
  // opts: { element (required), filename, rev, save (default true) }
  // stamps optional revision bottom-left + page number centre on every page.
  function s2Generate(opts) {
    opts = opts || {};
    if (!opts.element) return Promise.reject(new Error('style2.generate needs { element }'));
    if (!window.html2canvas) return Promise.reject(new Error('html2canvas not loaded (required for Style 2)'));
    const JsPDF = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    if (!JsPDF) return Promise.reject(new Error('jsPDF not loaded'));

    const holder = document.createElement('div');
    holder.style.cssText = 'position:fixed;left:-99999px;top:0;';
    holder.appendChild(opts.element);
    document.body.appendChild(holder);

    return document.fonts.ready
      .then(function () { return new Promise(function (r) { setTimeout(r, 250); }); })
      .then(function () {
        return window.html2canvas(opts.element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      })
      .then(function (canvas) {
        const pdf = new JsPDF('p', 'mm', 'a4');
        const pw = LAYOUT.pageW, ph = LAYOUT.pageH;
        const imgW = pw, imgH = canvas.height * pw / canvas.width;
        const img = canvas.toDataURL('image/png');
        let heightLeft = imgH, position = 0;
        pdf.addImage(img, 'PNG', 0, position, imgW, imgH); heightLeft -= ph;
        while (heightLeft > 0) { position -= ph; pdf.addPage(); pdf.addImage(img, 'PNG', 0, position, imgW, imgH); heightLeft -= ph; }
        const pages = pdf.getNumberOfPages();
        for (let i = 1; i <= pages; i++) {
          pdf.setPage(i);
          pdf.setFontSize(8);
          pdf.setTextColor(120, 120, 120);
          if (opts.rev) pdf.text(String(opts.rev), 10, 292);
          pdf.text(String(i), 105, 292, { align: 'center' });
        }
        if (opts.save !== false) {
          const fn = String(opts.filename || 'report').replace(/[^\w.-]+/g, '_');
          pdf.save(fn.replace(/\.pdf$/i, '') + '.pdf');
        }
        return pdf;
      })
      .finally(function () { holder.remove(); });
  }

  // themed section heading (orange bar + navy uppercase title).
  function s2Section(title) {
    return '<div class="brk2-section"><span class="brk2-bar"></span>' +
      '<span class="brk2-section-t">' + escHtml(title) + '</span></div>';
  }

  // body paragraph.
  function s2Para(text) {
    return '<p class="brk2-p">' + escHtml(text) + '</p>';
  }

  // themed data table. headers: array of strings OR
  // { label, align, width, cb } . rows: array of cell-arrays (text escaped).
  function s2Table(headers, rows) {
    const cols = (headers || []).map(function (h) { return typeof h === 'string' ? { label: h } : (h || {}); });
    const colgroup = cols.map(function (c) { return '<col' + (c.width ? ' style="width:' + c.width + '"' : '') + '>'; }).join('');
    const thead = '<tr>' + cols.map(function (c) {
      return '<th' + (c.align ? ' style="text-align:' + c.align + '"' : '') + '>' + escHtml(c.label) + '</th>';
    }).join('') + '</tr>';
    const body = (rows || []).map(function (r) {
      return '<tr>' + r.map(function (cell, i) {
        const c = cols[i] || {};
        const cls = c.cb ? ' class="cb"' : (c.align === 'center' ? ' class="ctr"' : '');
        const al = c.align ? ' style="text-align:' + c.align + '"' : '';
        return '<td' + cls + al + '>' + (cell == null ? '' : escHtml(cell)) + '</td>';
      }).join('') + '</tr>';
    }).join('');
    return '<div class="brk2-gridwrap"><table class="brk2-grid"><colgroup>' + colgroup +
      '</colgroup><thead>' + thead + '</thead><tbody>' + body + '</tbody></table></div>';
  }

  const style2 = {
    injectCSS: s2InjectCSS,
    icon: s2Icon,
    statCard: s2StatCard,
    statRow: s2StatRow,
    infoPanel: s2InfoPanel,
    section: s2Section,
    para: s2Para,
    table: s2Table,
    header: s2Header,
    footer: s2Footer,
    companyBlock: s2CompanyBlock,
    page: s2Page,
    generate: s2Generate,
    escHtml: escHtml,
    ICONS: S2_ICONS
  };

  /* ── EXPORT ── */
  window.BromarReportKit = {
    version: VERSION,
    configure: configure,
    COMPANY: COMPANY,
    PALETTE: PALETTE,
    LAYOUT: LAYOUT,
    FONT: FONT,
    loadLogoAsset: loadLogoAsset,
    fitBox: fitBox,
    normalize: normalize,
    drawHeader: drawHeader,
    drawFooter: drawFooter,
    pairRow: pairRow,
    sectionHeading: sectionHeading,
    para: para,
    createDoc: createDoc,
    formatDate: formatDate,
    injectPreviewVars: injectPreviewVars,
    style2: style2
  };
})();
