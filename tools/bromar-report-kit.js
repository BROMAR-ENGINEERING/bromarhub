/* ============================================================
   BROMAR REPORT KIT — shared PDF / report styling
   Single source of truth for branding across report modules
   (test & tag, quotes, safety, jobs) in Bromar Ops + Bromar Hub.

   Registers: window.BromarReportKit
   Requires : jsPDF 2.5.1 UMD (+ jspdf-autotable 3.8.2 for tables)
   Pattern  : window-export, no build step, no framework.

   VERSION V1.00
   (+0.01 per change; major digit only bumps on explicit major change)
   ============================================================ */

(function () {
  'use strict';

  const VERSION = 'V1.00';

  /* ── CONFIG (per-repo overrides) ──
     Bromar Ops and Bromar Hub live in separate repos with different
     asset paths. Keep this file identical in both; each repo calls
     BromarReportKit.configure({...}) once at startup to set its paths.
     Defaults below are the Bromar Ops paths. */
  const config = {
    logoColour:  'assets/Bromar-Primary-Logo-Full-Colour.png',
    logoReverse: 'assets/Bromar-Primary-Logo-Reverse-White.png'
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
    injectPreviewVars: injectPreviewVars
  };
})();
