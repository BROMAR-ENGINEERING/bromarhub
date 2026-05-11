/**
 * Bromar Document Scanner
 * Version: V1.03
 *
 * Mobile document scanner with OpenCV.js auto edge detection.
 *
 * Flow: capture/import → auto-detect document corners (OpenCV.js, lazy-loaded)
 *       → manual corner adjustment → perspective correction → PDF → upload.
 *
 * On iPhone, the "Scan Document" button uses Apple's native scanner UI for
 * capture. On any device, the captured image is then run through OpenCV's
 * findContours pipeline to locate the document edges, and the user can fine-
 * tune the auto-detected corners before applying.
 *
 * Usage:
 *   const scanner = new BromarScanner({ supabase: sb, bucket: 'job-sheet-files' });
 *   scanner.open({ onComplete: (files) => console.log(files) });
 *
 *   // Attach to an existing upload area:
 *   scanner.attachTo('#fileUploadArea', { onComplete: (files) => ... });
 *
 *   // Pass job number after selection:
 *   scanner.options.jobNumber  = 'BC0042';
 *   scanner.options.pathPrefix = 'BC0042/scans';
 */

(function(global) {
  'use strict';

  // ─── DOCUMENT TYPES ────────────────────────────────────────────────────────
  const DOC_TYPES = [
    { value: 'coes',                 label: 'COES' },
    { value: 'test_sheet',           label: 'Test Sheet' },
    { value: 'as_built_drawing',     label: 'As Built Drawing' },
    { value: 'instructions',         label: 'Instructions' },
    { value: 'site_photo',           label: 'Site Photo' },
    { value: 'inspection_report',    label: 'Inspection Report' },
    { value: 'handover_certificate', label: 'Handover Certificate' },
    { value: 'variation_notice',     label: 'Variation Notice' },
    { value: 'safety_report',        label: 'Safety Report' },
    { value: 'delivery_docket',      label: 'Delivery Docket' },
    { value: 'invoice',              label: 'Invoice' },
    { value: 'quote',                label: 'Quote' },
    { value: 'risk_assessment',      label: 'Risk Assessment' },
    { value: 'permit_to_work',       label: 'Permit to Work' },
    { value: 'material_requisition', label: 'Material Requisition' },
  ];

  // ─── STYLES ────────────────────────────────────────────────────────────────
  const STYLES = `
    .bsc-overlay {
      position: fixed; inset: 0; z-index: 99999;
      background: rgba(0,0,0,0.85);
      display: flex; align-items: flex-end; justify-content: center;
      opacity: 0; transition: opacity 0.25s ease;
      font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
      overscroll-behavior: none;
    }
    .bsc-overlay.bsc-visible { opacity: 1; }

    .bsc-sheet {
      background: var(--bg-secondary, #fff);
      border-radius: 20px 20px 0 0;
      width: 100%; max-width: 560px;
      max-height: 92vh;
      display: flex; flex-direction: column;
      transform: translateY(100%);
      transition: transform 0.3s cubic-bezier(0.34, 1.4, 0.64, 1);
      overflow: hidden;
      overscroll-behavior: contain;
    }
    .bsc-overlay.bsc-visible .bsc-sheet { transform: translateY(0); }

    .bsc-handle {
      width: 36px; height: 4px;
      background: var(--border, #e2e8f0);
      border-radius: 2px; margin: 10px auto 0; flex-shrink: 0;
    }

    .bsc-header {
      padding: 14px 18px 10px;
      display: flex; align-items: center; justify-content: space-between;
      border-bottom: 1px solid var(--border, #f0f0f0); flex-shrink: 0;
    }
    .bsc-title { font-size: 1rem; font-weight: 700; color: var(--text-primary, #0a0a0a); }
    .bsc-close {
      width: 30px; height: 30px; border-radius: 50%;
      background: var(--bg-main, #f5f5f5); border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      font-size: 1rem; color: var(--text-secondary, #666); transition: all 0.2s;
    }
    .bsc-close:hover { background: #fee2e2; color: #dc2626; }

    .bsc-body { flex: 1; overflow-y: auto; overscroll-behavior: contain; }

    /* ── SOURCE BUTTONS ─────────────────────────────────────────────────── */
    .bsc-sources {
      padding: 14px; display: grid;
      grid-template-columns: 1fr 1fr; gap: 10px;
    }
    .bsc-source-btn {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; gap: 8px; padding: 18px 10px;
      background: var(--bg-main, #fafafa);
      border: 2px solid var(--border, #e5e7eb);
      border-radius: 14px; cursor: pointer; text-align: center;
      color: var(--text-primary, #0a0a0a); transition: border-color 0.15s;
      -webkit-tap-highlight-color: transparent;
    }
    .bsc-source-btn:active {
      transform: scale(0.96);
      border-color: var(--accent, #ea580c);
      background: var(--card-hover, rgba(234,88,12,0.05));
    }
    .bsc-source-btn svg {
      width: 30px; height: 30px; stroke: var(--accent, #ea580c);
      fill: none; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round;
    }
    .bsc-source-label { font-size: 0.85rem; font-weight: 700; }
    .bsc-source-sub   { font-size: 0.7rem; color: var(--text-secondary, #888); }

    /* ── QUEUE ──────────────────────────────────────────────────────────── */
    .bsc-queue-view { padding: 12px; display: none; flex-direction: column; gap: 10px; }
    .bsc-queue-view.bsc-active { display: flex; }
    .bsc-queue-list { display: flex; flex-direction: column; gap: 8px; }
    .bsc-queue-item {
      display: flex; flex-direction: column; gap: 6px;
      padding: 10px 12px;
      background: var(--bg-main, #fafafa);
      border: 1px solid var(--border, #e5e7eb); border-radius: 10px;
    }
    .bsc-queue-top { display: flex; align-items: center; gap: 10px; }
    .bsc-queue-thumb {
      width: 46px; height: 46px; border-radius: 6px;
      object-fit: cover; background: #e2e8f0; flex-shrink: 0;
    }
    .bsc-queue-info { flex: 1; min-width: 0; }
    .bsc-queue-name {
      font-size: 0.82rem; font-weight: 700;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      color: var(--text-primary, #0a0a0a);
    }
    .bsc-queue-meta { font-size: 0.7rem; color: var(--text-secondary, #888); margin-top: 1px; }
    .bsc-queue-btns { display: flex; gap: 5px; margin-top: 5px; }
    .bsc-queue-btn {
      font-size: 0.72rem; font-weight: 600; padding: 4px 9px;
      border-radius: 6px; border: 1px solid var(--border, #e5e7eb);
      background: var(--bg-secondary, #fff); cursor: pointer;
      color: var(--text-secondary, #666); font-family: inherit;
      -webkit-tap-highlight-color: transparent; transition: all 0.15s;
    }
    .bsc-queue-btn.rename:active { border-color: var(--accent, #ea580c); color: var(--accent, #ea580c); }
    .bsc-queue-btn.remove:active { border-color: #dc2626; color: #dc2626; }

    /* ── RENAME PANEL ───────────────────────────────────────────────────── */
    .bsc-rename-panel {
      background: var(--bg-secondary, #fff);
      border: 1.5px solid var(--accent, #ea580c);
      border-radius: 8px; padding: 10px;
      display: flex; flex-direction: column; gap: 8px;
    }
    .bsc-rename-select {
      width: 100%; padding: 9px 32px 9px 10px;
      border: 1px solid var(--border, #e5e7eb); border-radius: 7px;
      font-family: inherit; font-size: 0.88rem; font-weight: 600;
      background: var(--bg-main, #fafafa); color: var(--text-primary, #0a0a0a);
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23666' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
      background-repeat: no-repeat; background-position: right 10px center;
      cursor: pointer; outline: none;
    }
    .bsc-rename-select:focus { border-color: var(--accent, #ea580c); }
    .bsc-rename-preview {
      font-size: 0.74rem; color: var(--text-secondary, #888);
      font-family: 'JetBrains Mono', monospace;
      background: var(--bg-main, #fafafa);
      border: 1px solid var(--border, #e5e7eb);
      border-radius: 5px; padding: 6px 8px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .bsc-rename-preview .hi { color: var(--accent, #ea580c); font-weight: 700; }
    .bsc-rename-jobinput-wrap {
      display: flex; flex-direction: column; gap: 4px;
    }
    .bsc-rename-jobinput-label {
      font-size: 0.7rem; font-weight: 600;
      color: var(--text-secondary, #888);
      text-transform: uppercase; letter-spacing: 0.4px;
    }
    .bsc-rename-jobinput {
      width: 100%; padding: 9px 10px;
      border: 1px solid var(--border, #e5e7eb);
      border-radius: 7px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.88rem; font-weight: 600;
      background: var(--bg-main, #fafafa);
      color: var(--text-primary, #0a0a0a);
      text-transform: uppercase; outline: none;
    }
    .bsc-rename-jobinput:focus { border-color: var(--accent, #ea580c); }
    .bsc-rename-row { display: flex; gap: 6px; }
    .bsc-rename-apply {
      flex: 1; padding: 8px; border: none; border-radius: 7px;
      background: linear-gradient(135deg, #ea580c, #fb923c);
      color: white; font-family: inherit; font-size: 0.83rem; font-weight: 700;
      cursor: pointer;
    }
    .bsc-rename-apply:disabled { opacity: 0.4; cursor: not-allowed; }
    .bsc-rename-cancel-btn {
      padding: 8px 14px; background: transparent;
      border: 1px solid var(--border, #e5e7eb); border-radius: 7px;
      color: var(--text-secondary, #888); font-family: inherit;
      font-size: 0.83rem; cursor: pointer;
    }

    /* ── BOTTOM ACTION BAR ──────────────────────────────────────────────── */
    .bsc-queue-actions { display: grid; grid-template-columns: auto 1fr; gap: 8px; }
    .bsc-btn-outline {
      padding: 12px 14px; border: 1.5px solid var(--border, #e5e7eb);
      border-radius: 10px; background: transparent;
      font-family: inherit; font-size: 0.875rem; font-weight: 600;
      cursor: pointer; color: var(--text-secondary, #666);
      -webkit-tap-highlight-color: transparent;
    }
    .bsc-btn-outline:active { border-color: var(--accent, #ea580c); color: var(--accent, #ea580c); }
    .bsc-btn-primary {
      padding: 12px; border: none; border-radius: 10px;
      background: linear-gradient(135deg, #ea580c, #fb923c);
      font-family: inherit; font-size: 0.875rem; font-weight: 700;
      cursor: pointer; color: white;
      -webkit-tap-highlight-color: transparent;
    }
    .bsc-btn-primary:active  { opacity: 0.9; transform: scale(0.98); }
    .bsc-btn-primary:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }

    /* ── PROGRESS ───────────────────────────────────────────────────────── */
    .bsc-progress-view {
      padding: 36px 16px; display: none; flex-direction: column;
      align-items: center; gap: 14px; text-align: center;
    }
    .bsc-progress-view.bsc-active { display: flex; }
    .bsc-spinner {
      width: 52px; height: 52px;
      border: 3px solid var(--border, #e5e7eb);
      border-top-color: var(--accent, #ea580c);
      border-radius: 50%; animation: bsc-spin 0.7s linear infinite;
    }
    @keyframes bsc-spin { to { transform: rotate(360deg); } }
    .bsc-progress-title { font-size: 1rem; font-weight: 700; color: var(--text-primary, #0a0a0a); }
    .bsc-progress-sub   { font-size: 0.83rem; color: var(--text-secondary, #888); }
    .bsc-progress-bar-wrap {
      width: 100%; background: var(--border, #e5e7eb);
      border-radius: 4px; height: 5px; overflow: hidden;
    }
    .bsc-progress-bar {
      height: 100%; border-radius: 4px;
      background: linear-gradient(90deg, #ea580c, #fb923c);
      transition: width 0.35s ease; width: 0%;
    }

    .bsc-hidden-input {
      position: absolute; width: 1px; height: 1px;
      opacity: 0; pointer-events: none;
    }

    /* ── CROP VIEW ──────────────────────────────────────────────────────── */
    .bsc-crop-view {
      padding: 12px; display: none; flex-direction: column; gap: 12px;
      touch-action: none;
    }
    .bsc-crop-view.bsc-active { display: flex; }

    .bsc-crop-stage {
      position: relative; width: 100%;
      background: #1a1a1a; border-radius: 12px;
      aspect-ratio: 3/4; overflow: hidden;
    }
    .bsc-crop-img {
      position: absolute; inset: 0; width: 100%; height: 100%;
      object-fit: contain; user-select: none; -webkit-user-drag: none;
      pointer-events: none;
    }
    .bsc-crop-overlay {
      position: absolute; inset: 0; width: 100%; height: 100%;
      pointer-events: none;
    }
    .bsc-crop-handle {
      position: absolute; width: 32px; height: 32px;
      background: var(--accent, #ea580c);
      border: 3px solid white; border-radius: 50%;
      transform: translate(-50%, -50%);
      box-shadow: 0 2px 8px rgba(0,0,0,0.5);
      cursor: grab; touch-action: none;
      z-index: 10;
      -webkit-tap-highlight-color: transparent;
    }
    .bsc-crop-handle:active {
      cursor: grabbing;
      transform: translate(-50%, -50%) scale(1.2);
      background: var(--accent-light, #fb923c);
    }

    .bsc-crop-hint {
      font-size: 0.78rem; color: var(--text-secondary, #888);
      text-align: center; padding: 0 8px;
    }

    .bsc-crop-actions {
      display: grid; grid-template-columns: auto 1fr 1fr; gap: 8px;
    }
    .bsc-crop-reset {
      padding: 11px 12px; border: 1.5px solid var(--border, #e5e7eb);
      border-radius: 10px; background: transparent;
      font-family: inherit; font-size: 0.82rem; font-weight: 600;
      cursor: pointer; color: var(--text-secondary, #666);
      -webkit-tap-highlight-color: transparent;
    }
    .bsc-crop-cancel {
      padding: 11px; border: 1.5px solid var(--border, #e5e7eb);
      border-radius: 10px; background: transparent;
      font-family: inherit; font-size: 0.85rem; font-weight: 600;
      cursor: pointer; color: var(--text-secondary, #666);
      -webkit-tap-highlight-color: transparent;
    }
    /* Auto-detect badge / spinner shown above the image while OpenCV works */
    .bsc-crop-status {
      position: absolute; top: 8px; left: 50%; transform: translateX(-50%);
      display: flex; align-items: center; gap: 6px;
      padding: 6px 12px; border-radius: 16px;
      background: rgba(0,0,0,0.75); color: white;
      font-size: 0.72rem; font-weight: 600;
      pointer-events: none; z-index: 5;
      opacity: 0; transition: opacity 0.25s;
    }
    .bsc-crop-status.bsc-crop-status-on { opacity: 1; }
    .bsc-crop-status.success { background: rgba(34,197,94,0.9); }
    .bsc-crop-status.fail    { background: rgba(234,88,12,0.9); }
    .bsc-crop-mini-spinner {
      width: 12px; height: 12px;
      border: 1.5px solid rgba(255,255,255,0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: bsc-spin 0.7s linear infinite;
    }

    .bsc-crop-apply {
      padding: 11px; border: none; border-radius: 10px;
      background: linear-gradient(135deg, #ea580c, #fb923c);
      font-family: inherit; font-size: 0.85rem; font-weight: 700;
      cursor: pointer; color: white;
      -webkit-tap-highlight-color: transparent;
    }

    .bsc-queue-btn.crop:active { border-color: var(--accent, #ea580c); color: var(--accent, #ea580c); }
  `;

  // ─── ICONS ─────────────────────────────────────────────────────────────────
  const ICONS = {
    scan:   `<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3H3v4M19 3h2v4M5 21H3v-4M19 21h2v-4"/><rect x="7" y="7" width="10" height="10" rx="1"/></svg>`,
    camera: `<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
    photo:  `<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
    file:   `<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
    plus:   `<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  };

  // ─── CLASS ─────────────────────────────────────────────────────────────────
  class BromarScanner {
    constructor(opts = {}) {
      this.options = {
        supabase:   null,
        bucket:     'job-sheet-files',
        pathPrefix: 'scans',
        jobNumber:  null,
        maxFiles:   20,
        pdfQuality: 0.88,
        ...opts
      };
      this._queue      = [];
      this._onComplete = null;
      this._el         = null;
      this._injectStyles();
      this._buildDOM();
    }

    // ── PUBLIC ───────────────────────────────────────────────────────────────
    open({ onComplete } = {}) {
      this._onComplete = onComplete || null;
      this._show();
    }

    attachTo(sel, { onComplete } = {}) {
      const target = typeof sel === 'string' ? document.querySelector(sel) : sel;
      if (!target) return;
      this._onComplete = onComplete || null;

      const row = document.createElement('div');
      row.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;justify-content:center;padding:8px 0;';

      [
        { icon: ICONS.scan,   label: 'Scan Document', source: 'scan' },
        { icon: ICONS.photo,  label: 'Photo Library', source: 'photo-library' },
        { icon: ICONS.camera, label: 'Take Photo',    source: 'camera' },
        { icon: ICONS.file,   label: 'Browse Files',  source: 'files' },
      ].forEach(b => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.style.cssText = `display:flex;align-items:center;gap:6px;padding:8px 14px;
          border:1.5px solid var(--border,#e5e7eb);border-radius:20px;
          background:var(--bg-secondary,#fff);font-family:inherit;font-size:0.8rem;
          font-weight:600;cursor:pointer;color:var(--text-primary,#0a0a0a);
          -webkit-tap-highlight-color:transparent;`;
        btn.innerHTML = `<span style="width:16px;height:16px;display:inline-flex;stroke:var(--accent,#ea580c)">${b.icon}</span>${b.label}`;
        btn.addEventListener('click', () => this._triggerInput(b.source));
        row.appendChild(btn);
      });

      target.appendChild(row);
    }

    // ── PRIVATE: STYLES ──────────────────────────────────────────────────────
    _injectStyles() {
      if (document.getElementById('bsc-styles')) return;
      const s = document.createElement('style');
      s.id = 'bsc-styles'; s.textContent = STYLES;
      document.head.appendChild(s);
    }

    // ── PRIVATE: DOM ─────────────────────────────────────────────────────────
    _buildDOM() {
      this._el = document.createElement('div');
      this._el.className = 'bsc-overlay';

      this._el.innerHTML = `
        <div class="bsc-sheet">
          <div class="bsc-handle"></div>

          <div class="bsc-header">
            <span class="bsc-title">Add Document</span>
            <button class="bsc-close">✕</button>
          </div>

          <div class="bsc-body">

            <!-- SOURCE PICKER -->
            <div class="bsc-sources bsc-view" data-view="sources">
              <button class="bsc-source-btn" data-source="scan">
                ${ICONS.scan}
                <span class="bsc-source-label">Scan Document</span>
                <span class="bsc-source-sub">iOS 16+ · auto edge detect</span>
              </button>
              <button class="bsc-source-btn" data-source="photo-library">
                ${ICONS.photo}
                <span class="bsc-source-label">Photo Library</span>
                <span class="bsc-source-sub">Choose from gallery</span>
              </button>
              <button class="bsc-source-btn" data-source="camera">
                ${ICONS.camera}
                <span class="bsc-source-label">Take Photo</span>
                <span class="bsc-source-sub">Open camera</span>
              </button>
              <button class="bsc-source-btn" data-source="files">
                ${ICONS.file}
                <span class="bsc-source-label">Browse Files</span>
                <span class="bsc-source-sub">PDF, Word, any file</span>
              </button>
            </div>

            <!-- QUEUE -->
            <div class="bsc-queue-view bsc-view" data-view="queue">
              <div class="bsc-queue-list"></div>
              <div class="bsc-queue-actions">
                <button class="bsc-btn-outline" data-action="add-more">${ICONS.plus} Add More</button>
                <button class="bsc-btn-primary" data-action="process" disabled>Upload →</button>
              </div>
            </div>

            <!-- PROGRESS -->
            <div class="bsc-progress-view bsc-view" data-view="progress">
              <div class="bsc-spinner"></div>
              <div class="bsc-progress-title">Processing...</div>
              <div class="bsc-progress-sub"></div>
              <div class="bsc-progress-bar-wrap">
                <div class="bsc-progress-bar"></div>
              </div>
            </div>

            <!-- CROP -->
            <div class="bsc-crop-view bsc-view" data-view="crop">
              <div class="bsc-crop-stage">
                <img class="bsc-crop-img" alt="Crop preview"/>
                <canvas class="bsc-crop-overlay"></canvas>
                <div class="bsc-crop-status">
                  <div class="bsc-crop-mini-spinner"></div>
                  <span class="bsc-crop-status-text">Detecting edges...</span>
                </div>
              </div>
              <p class="bsc-crop-hint">Auto-detected corners shown — drag any to adjust, then Apply</p>
              <div class="bsc-crop-actions">
                <button class="bsc-crop-reset" data-action="crop-reset">↺ Reset</button>
                <button class="bsc-crop-cancel" data-action="crop-cancel">Cancel</button>
                <button class="bsc-crop-apply"  data-action="crop-apply">✓ Apply Crop</button>
              </div>
            </div>

          </div>

          <!--
            iOS native inputs
            ─────────────────────────────────────────────────────────────────
            capture="environment" on an image input causes iOS to show:
              "Take Photo | Scan Document | Photo Library"
            The "Scan Document" option is Apple's native multi-page scanner
            with automatic edge detection, perspective correction, and
            optional B&W/colour/greyscale enhancement.
            ─────────────────────────────────────────────────────────────────
          -->
          <input class="bsc-hidden-input" id="bsc-in-scan"
                 type="file" accept="image/*" capture="environment" multiple/>
          <input class="bsc-hidden-input" id="bsc-in-photo-library"
                 type="file" accept="image/*" multiple/>
          <input class="bsc-hidden-input" id="bsc-in-camera"
                 type="file" accept="image/*" capture="environment"/>
          <input class="bsc-hidden-input" id="bsc-in-files"
                 type="file"
                 accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                 multiple/>
        </div>
      `;

      document.body.appendChild(this._el);
      this._bind();
    }

    _bind() {
      const el = this._el;

      // Close
      el.querySelector('.bsc-close').addEventListener('click', () => this._close());
      el.addEventListener('click', e => { if (e.target === el) this._close(); });
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && el.classList.contains('bsc-visible')) this._close();
      });

      // Source buttons
      el.querySelectorAll('[data-source]').forEach(btn =>
        btn.addEventListener('click', () => this._triggerInput(btn.dataset.source))
      );

      // Queue buttons
      el.querySelector('[data-action="add-more"]').addEventListener('click',  () => this._goToView('sources'));
      el.querySelector('[data-action="process"]').addEventListener('click',   () => this._process());

      // Crop view buttons
      el.querySelector('[data-action="crop-reset"]').addEventListener('click',  () => this._resetCrop());
      el.querySelector('[data-action="crop-cancel"]').addEventListener('click', () => this._cancelCrop());
      el.querySelector('[data-action="crop-apply"]').addEventListener('click',  () => this._applyCrop());

      // File inputs
      ['scan', 'photo-library', 'camera', 'files'].forEach(id => {
        el.querySelector(`#bsc-in-${id}`).addEventListener('change', e => {
          this._handleFiles(e.target.files);
          e.target.value = '';
        });
      });

      // Swipe-back prevention
      this._moveTrap = e => {
        if (el.querySelector('.bsc-body')?.contains(e.target)) return;
        e.preventDefault();
      };
    }

    // ── SHOW / CLOSE ─────────────────────────────────────────────────────────
    _show() {
      this._el.style.display = 'flex';
      requestAnimationFrame(() => requestAnimationFrame(() =>
        this._el.classList.add('bsc-visible')
      ));
      this._goToView('sources');

      // Pre-load OpenCV.js in the background so it's ready by the time the
      // user captures an image. First open ≈ 2-3s, cached after that.
      this._ensureOpenCV().catch(err => {
        console.warn('[BromarScanner] OpenCV preload failed:', err);
      });
      this._prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overscrollBehavior = 'none';
      this._el.addEventListener('touchmove', this._moveTrap, { passive: false });
    }

    _close() {
      this._el.classList.remove('bsc-visible');
      document.body.style.overflow = this._prevOverflow || '';
      document.documentElement.style.overscrollBehavior = '';
      this._el.removeEventListener('touchmove', this._moveTrap);
      setTimeout(() => { this._el.style.display = 'none'; }, 300);
    }

    // ── VIEW NAVIGATION ──────────────────────────────────────────────────────
    _goToView(name) {
      this._el.querySelectorAll('.bsc-view').forEach(v => {
        const on = v.dataset.view === name;
        v.classList.toggle('bsc-active', on);
        if (v.dataset.view === 'sources') v.style.display = on ? '' : 'none';
      });
    }

    // ── TRIGGER NATIVE FILE INPUT ─────────────────────────────────────────────
    _triggerInput(source) {
      if (!this._el.classList.contains('bsc-visible')) this._show();
      this._el.querySelector(`#bsc-in-${source}`)?.click();
    }

    // ── HANDLE FILES FROM INPUT ───────────────────────────────────────────────
    async _handleFiles(fileList) {
      if (!fileList?.length) return;

      // Separate images (require crop) from other files (pass through)
      const incomingImages = [];

      for (const file of Array.from(fileList)) {
        if (file.size > 50 * 1024 * 1024) { alert(`${file.name} exceeds 50MB`); continue; }
        const id = `f${Date.now()}${Math.random().toString(36).slice(2, 6)}`;

        if (file.type.startsWith('image/')) {
          const dataUrl = await this._toDataUrl(file);
          const item = { id, file, dataUrl, name: file.name, size: file.size, type: file.type };
          incomingImages.push(item);
        } else {
          // PDFs / docs go straight to queue
          this._queue.push({
            id, file,
            dataUrl: this._iconDataUrl(file.name),
            name: file.name, size: file.size, type: file.type
          });
        }
      }

      // Every image must be cropped — process them one at a time
      if (incomingImages.length > 0) {
        this._pendingCropItems = incomingImages;
        this._openCrop(this._pendingCropItems[0]);
        return;
      }

      // No images — just show queue
      this._goToView('queue');
      this._renderQueue();
    }

    // ── RENDER QUEUE ──────────────────────────────────────────────────────────
    _renderQueue() {
      const list    = this._el.querySelector('.bsc-queue-list');
      const procBtn = this._el.querySelector('[data-action="process"]');
      list.innerHTML = '';

      if (!this._queue.length) {
        list.innerHTML = '<p style="text-align:center;color:var(--text-secondary,#888);font-size:0.85rem;padding:20px 0;">No files added yet</p>';
        procBtn.disabled = true;
        procBtn.textContent = 'Upload →';
        return;
      }

      procBtn.disabled = false;
      procBtn.textContent = `Convert & Upload (${this._queue.length}) →`;

      this._queue.forEach(item => {
        const wrap = document.createElement('div');
        wrap.className = 'bsc-queue-item';

        // ── Top row ───────────────────────────────────────────────────────
        const top = document.createElement('div');
        top.className = 'bsc-queue-top';

        const thumb = document.createElement('img');
        thumb.className = 'bsc-queue-thumb';
        thumb.src = item.dataUrl; thumb.alt = item.name;

        const info = document.createElement('div');
        info.className = 'bsc-queue-info';

        const nameEl = document.createElement('div');
        nameEl.className = 'bsc-queue-name';
        nameEl.textContent = item.name; nameEl.title = item.name;

        const metaEl = document.createElement('div');
        metaEl.className = 'bsc-queue-meta';
        metaEl.textContent = this._fmtSize(item.size);

        const btns = document.createElement('div');
        btns.className = 'bsc-queue-btns';

        // Re-crop button — only for images (initial crop already happened on import)
        if (item.type.startsWith('image/')) {
          const cropBtn = document.createElement('button');
          cropBtn.type = 'button';
          cropBtn.className = 'bsc-queue-btn crop';
          cropBtn.textContent = '✂️ Re-crop';
          cropBtn.addEventListener('click', () => {
            // Treat as single-item pending crop
            this._pendingCropItems = [item];
            // Remove from queue while re-cropping (will be re-added on apply)
            this._queue = this._queue.filter(q => q.id !== item.id);
            this._openCrop(item);
          });
          btns.appendChild(cropBtn);
        }

        const renBtn = document.createElement('button');
        renBtn.type = 'button'; renBtn.className = 'bsc-queue-btn rename';
        renBtn.textContent = '✏️ Rename';

        const delBtn = document.createElement('button');
        delBtn.type = 'button'; delBtn.className = 'bsc-queue-btn remove';
        delBtn.textContent = '🗑 Remove';

        btns.append(renBtn, delBtn);
        info.append(nameEl, metaEl, btns);
        top.append(thumb, info);
        wrap.appendChild(top);
        list.appendChild(wrap);

        // ── Rename ────────────────────────────────────────────────────────
        renBtn.addEventListener('click', () => {
          const existing = wrap.querySelector('.bsc-rename-panel');
          if (existing) { existing.remove(); return; }

          // Resolve job number from options, or fall back to common globals,
          // or read from a known input field if present on the page.
          const resolveJobNumber = () => {
            if (this.options.jobNumber) return this.options.jobNumber;
            if (window.currentJobNumber)  return window.currentJobNumber;
            // Try common input IDs used by Bromar hub pages
            const tryIds = ['existing_job_number', 'job_number', 'jobNumber'];
            for (const id of tryIds) {
              const el = document.getElementById(id);
              if (el && el.value) return el.value;
            }
            return '';
          };

          const initialJobNum = (resolveJobNumber() || '').toUpperCase().replace(/\s/g, '');

          const panel = document.createElement('div');
          panel.className = 'bsc-rename-panel';

          // Document type dropdown
          const sel = document.createElement('select');
          sel.className = 'bsc-rename-select';
          sel.innerHTML = '<option value="">— Select document type —</option>' +
            DOC_TYPES.map(t => `<option value="${t.value}">${t.label}</option>`).join('');

          // Job number input — pre-filled if we found one, editable either way
          const jobWrap = document.createElement('div');
          jobWrap.className = 'bsc-rename-jobinput-wrap';
          const jobLabel = document.createElement('label');
          jobLabel.className = 'bsc-rename-jobinput-label';
          jobLabel.textContent = 'Job Number';
          const jobInput = document.createElement('input');
          jobInput.type = 'text';
          jobInput.className = 'bsc-rename-jobinput';
          jobInput.placeholder = 'e.g. BC0042';
          jobInput.value = initialJobNum;
          jobWrap.append(jobLabel, jobInput);

          const preview = document.createElement('div');
          preview.className = 'bsc-rename-preview';
          preview.textContent = 'Select a type to preview filename';

          const row = document.createElement('div');
          row.className = 'bsc-rename-row';

          const applyBtn = document.createElement('button');
          applyBtn.type = 'button'; applyBtn.className = 'bsc-rename-apply';
          applyBtn.textContent = '✓ Apply'; applyBtn.disabled = true;

          const cancelBtn = document.createElement('button');
          cancelBtn.type = 'button'; cancelBtn.className = 'bsc-rename-cancel-btn';
          cancelBtn.textContent = 'Cancel';

          row.append(applyBtn, cancelBtn);
          panel.append(sel, jobWrap, preview, row);
          wrap.appendChild(panel);

          // Force uppercase, no spaces
          jobInput.addEventListener('input', () => {
            const cursor = jobInput.selectionStart;
            jobInput.value = jobInput.value.toUpperCase().replace(/\s/g, '');
            jobInput.setSelectionRange(cursor, cursor);
            updatePreview();
          });

          const buildName = () => {
            const type   = sel.value;
            const jobNum = jobInput.value.trim().toLowerCase();
            if (!type) return null;
            return jobNum ? `${type}_${jobNum}.pdf` : `${type}.pdf`;
          };

          const updatePreview = () => {
            const type   = sel.value;
            const jobNum = jobInput.value.trim();
            if (!type) {
              preview.textContent = 'Select a type to preview filename';
              applyBtn.disabled = true;
              return;
            }
            const jp = jobNum ? `_<span class="hi">${jobNum.toLowerCase()}</span>` : '';
            preview.innerHTML = `${type}${jp}<span class="hi">.pdf</span>`;
            applyBtn.disabled = false;
          };

          sel.addEventListener('change', updatePreview);

          applyBtn.addEventListener('click', () => {
            const name = buildName();
            if (!name) return;
            item.name = name;
            nameEl.textContent = name; nameEl.title = name;
            // Remember the job number entered here, so subsequent renames pre-fill
            const enteredJob = jobInput.value.trim();
            if (enteredJob) this.options.jobNumber = enteredJob;
            panel.remove();
          });

          cancelBtn.addEventListener('click', () => panel.remove());
        });

        // ── Remove ────────────────────────────────────────────────────────
        delBtn.addEventListener('click', () => {
          this._queue = this._queue.filter(q => q.id !== item.id);
          this._renderQueue();
        });
      });
    }

    // ── CROP ──────────────────────────────────────────────────────────────────
    _openCrop(item) {
      this._cropTargetItem = item;
      const view   = this._el.querySelector('[data-view="crop"]');
      const img    = view.querySelector('.bsc-crop-img');
      const stage  = view.querySelector('.bsc-crop-stage');
      const status = view.querySelector('.bsc-crop-status');
      const statusText = view.querySelector('.bsc-crop-status-text');

      img.src = item.dataUrl;
      this._goToView('crop');

      const begin = async () => {
        // Show initial badge
        status.classList.remove('success', 'fail');
        status.classList.add('bsc-crop-status-on');

        // Set up handles at full-frame default first (instant interactivity)
        await new Promise(r => requestAnimationFrame(r));
        this._setupCropHandles(stage, img);

        // Show status based on OpenCV state:
        //  - already loaded     → 'Detecting edges...'
        //  - still loading      → 'Loading detector...' (and we wait for it)
        //  - load already failed → 'Auto-detect unavailable — drag manually'
        const cvReady = !!(window.cv && window.cv.imread);
        statusText.textContent = cvReady ? 'Detecting edges...' : 'Loading detector...';

        try {
          // Wait for OpenCV with a generous timeout. If it's not loaded yet,
          // this waits silently in the background.
          await this._ensureOpenCV();

          // Now it's ready — run detection
          statusText.textContent = 'Detecting edges...';
          const quad = await this._autoDetectCorners(img);

          if (quad) {
            this._applyAutoQuad(stage, quad);
            statusText.textContent = '✓ Edges detected — adjust if needed';
            status.classList.remove('fail');
            status.classList.add('success');
          } else {
            statusText.textContent = 'No clear edges — drag corners manually';
            status.classList.add('fail');
          }
        } catch (err) {
          console.warn('[BromarScanner] Auto-detect error:', err);
          statusText.textContent = 'Auto-detect unavailable — drag manually';
          status.classList.add('fail');
        }

        // Fade the status badge after 3s
        setTimeout(() => status.classList.remove('bsc-crop-status-on'), 3000);
      };

      if (img.complete && img.naturalWidth) {
        begin();
      } else {
        img.onload = begin;
      }
    }

    // ── OPENCV AUTO-DETECT ──────────────────────────────────────────────────
    // Loads OpenCV.js on first call (cached after), then runs a document
    // detection pipeline: grayscale → blur → Canny → find largest 4-sided
    // contour. Returns 4 corner points in IMAGE-NATURAL coords or null.
    async _autoDetectCorners(img) {
      await this._ensureOpenCV();
      if (!window.cv || !window.cv.imread) return null;

      const cv = window.cv;

      // Build a working canvas from the image at full natural resolution
      const work = document.createElement('canvas');
      work.width  = img.naturalWidth;
      work.height = img.naturalHeight;
      const wctx = work.getContext('2d');
      wctx.drawImage(img, 0, 0);

      let src = null, gray = null, blurred = null, edges = null,
          contours = null, hierarchy = null;
      try {
        src      = cv.imread(work);
        gray     = new cv.Mat();
        blurred  = new cv.Mat();
        edges    = new cv.Mat();
        contours = new cv.MatVector();
        hierarchy = new cv.Mat();

        // Grayscale
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
        // Gaussian blur to reduce noise
        cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
        // Canny edges — tuned thresholds for document scans
        cv.Canny(blurred, edges, 75, 200);
        // Dilate to close small gaps in detected edges
        const kernel = cv.Mat.ones(3, 3, cv.CV_8U);
        cv.dilate(edges, edges, kernel);
        kernel.delete();

        // Find contours
        cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

        const imageArea = src.cols * src.rows;
        const minArea   = imageArea * 0.15; // doc must cover >=15% of frame
        let best = null;
        let bestArea = 0;

        for (let i = 0; i < contours.size(); i++) {
          const cnt    = contours.get(i);
          const peri   = cv.arcLength(cnt, true);
          const approx = new cv.Mat();
          cv.approxPolyDP(cnt, approx, 0.02 * peri, true);

          // We want exactly 4 corners forming a convex quad large enough
          if (approx.rows === 4 && cv.isContourConvex(approx)) {
            const area = cv.contourArea(approx);
            if (area > minArea && area > bestArea) {
              bestArea = area;
              if (best) best.delete();
              best = approx;
            } else {
              approx.delete();
            }
          } else {
            approx.delete();
          }
          cnt.delete();
        }

        if (!best) return null;

        // Extract 4 corners as image-coord points
        const raw = [];
        for (let i = 0; i < 4; i++) {
          raw.push({ x: best.data32S[i * 2], y: best.data32S[i * 2 + 1] });
        }
        best.delete();

        // Order them as TL, TR, BR, BL
        return this._orderCorners(raw);

      } finally {
        src?.delete(); gray?.delete(); blurred?.delete();
        edges?.delete(); contours?.delete(); hierarchy?.delete();
      }
    }

    _orderCorners(pts) {
      // Sort by (x + y): smallest = TL, largest = BR
      // Sort by (x - y): smallest = BL, largest = TR
      const sums   = pts.map(p => p.x + p.y);
      const diffs  = pts.map(p => p.x - p.y);
      const tl = pts[sums.indexOf(Math.min(...sums))];
      const br = pts[sums.indexOf(Math.max(...sums))];
      const tr = pts[diffs.indexOf(Math.max(...diffs))];
      const bl = pts[diffs.indexOf(Math.min(...diffs))];
      return [tl, tr, br, bl];
    }

    // Map detected image-coord quad → display-coord crop points and refresh
    _applyAutoQuad(stage, imageQuad) {
      const img = stage.querySelector('.bsc-crop-img');
      const stageRect = stage.getBoundingClientRect();
      const W = stageRect.width;
      const H = stageRect.height;

      // The img uses object-fit:contain inside stage → compute rendered rect
      const natW = img.naturalWidth, natH = img.naturalHeight;
      const stageAspect = W / H, imgAspect = natW / natH;
      let rendW, rendH, offX, offY;
      if (imgAspect > stageAspect) {
        rendW = W; rendH = W / imgAspect; offX = 0; offY = (H - rendH) / 2;
      } else {
        rendH = H; rendW = H * imgAspect; offX = (W - rendW) / 2; offY = 0;
      }

      // Map each detected point from image coords → stage display coords
      this._cropPts = imageQuad.map(p => ({
        x: Math.max(0, Math.min(W, offX + (p.x / natW) * rendW)),
        y: Math.max(0, Math.min(H, offY + (p.y / natH) * rendH)),
      }));

      // Reposition the existing handles in the DOM
      const handles = stage.querySelectorAll('.bsc-crop-handle');
      this._cropPts.forEach((pt, i) => {
        if (handles[i]) {
          handles[i].style.left = pt.x + 'px';
          handles[i].style.top  = pt.y + 'px';
        }
      });
      this._drawCropOverlay(stage);
    }

    // Lazy-load OpenCV.js on first use; cached for subsequent calls.
    _ensureOpenCV() {
      if (this._opencvReady) return this._opencvReady;

      this._opencvReady = new Promise((resolve, reject) => {
        if (window.cv && window.cv.imread) { resolve(); return; }

        // OpenCV.js calls a global onRuntimeInitialized hook when ready.
        // We set it BEFORE inserting the script so it gets picked up.
        window.Module = window.Module || {};
        const prevHook = window.Module.onRuntimeInitialized;
        window.Module.onRuntimeInitialized = () => {
          if (prevHook) try { prevHook(); } catch(e){}
          resolve();
        };

        const s = document.createElement('script');
        s.src = 'https://docs.opencv.org/4.8.0/opencv.js';
        s.async = true;
        s.onerror = () => reject(new Error('Failed to load OpenCV.js'));
        document.head.appendChild(s);

        // Some builds expose cv synchronously after load and never fire the hook
        s.onload = () => {
          if (window.cv && window.cv.imread) resolve();
          // Otherwise wait for onRuntimeInitialized
        };

        // Safety timeout (15s) — if OpenCV doesn't load, fall through to manual
        setTimeout(() => {
          if (!(window.cv && window.cv.imread)) {
            reject(new Error('OpenCV.js load timed out'));
          }
        }, 15000);
      });

      return this._opencvReady;
    }

    _setupCropHandles(stage, img) {
      // Remove old handles
      stage.querySelectorAll('.bsc-crop-handle').forEach(h => h.remove());

      const stageRect = stage.getBoundingClientRect();
      const W = stageRect.width;
      const H = stageRect.height;

      // Default crop: full frame, slight inset so handles are visible
      const inset = 6;
      this._cropPts = [
        { x: inset,     y: inset     }, // TL
        { x: W - inset, y: inset     }, // TR
        { x: W - inset, y: H - inset }, // BR
        { x: inset,     y: H - inset }, // BL
      ];

      this._cropPts.forEach((pt, i) => {
        const handle = document.createElement('div');
        handle.className = 'bsc-crop-handle';
        handle.dataset.idx = i;
        handle.style.left = pt.x + 'px';
        handle.style.top  = pt.y + 'px';
        stage.appendChild(handle);

        let startX = 0, startY = 0, ptStartX = 0, ptStartY = 0;
        let dragging = false;

        const onDown = (e) => {
          dragging = true;
          e.preventDefault(); e.stopPropagation();
          startX   = e.clientX; startY = e.clientY;
          ptStartX = pt.x;      ptStartY = pt.y;
          handle.setPointerCapture(e.pointerId);
        };
        const onMove = (e) => {
          if (!dragging) return;
          e.preventDefault();
          // Constrain to current stage size
          const r = stage.getBoundingClientRect();
          pt.x = Math.max(0, Math.min(r.width,  ptStartX + (e.clientX - startX)));
          pt.y = Math.max(0, Math.min(r.height, ptStartY + (e.clientY - startY)));
          handle.style.left = pt.x + 'px';
          handle.style.top  = pt.y + 'px';
          this._drawCropOverlay(stage);
        };
        const onUp = () => { dragging = false; };

        handle.addEventListener('pointerdown',   onDown, { passive: false });
        handle.addEventListener('pointermove',   onMove, { passive: false });
        handle.addEventListener('pointerup',     onUp);
        handle.addEventListener('pointercancel', onUp);
      });

      this._drawCropOverlay(stage);
    }

    _drawCropOverlay(stage) {
      const canvas = stage.querySelector('.bsc-crop-overlay');
      const rect   = stage.getBoundingClientRect();
      canvas.width  = rect.width;
      canvas.height = rect.height;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, rect.width, rect.height);

      const pts = this._cropPts;
      if (!pts) return;

      // Dim the area outside the quad
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath();
      ctx.rect(0, 0, rect.width, rect.height);
      // Subtract quad using even-odd fill
      ctx.moveTo(pts[0].x, pts[0].y);
      ctx.lineTo(pts[1].x, pts[1].y);
      ctx.lineTo(pts[2].x, pts[2].y);
      ctx.lineTo(pts[3].x, pts[3].y);
      ctx.closePath();
      ctx.fill('evenodd');

      // Quad border
      ctx.strokeStyle = '#ea580c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      pts.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.closePath();
      ctx.stroke();
    }

    _resetCrop() {
      const stage = this._el.querySelector('.bsc-crop-stage');
      const img   = this._el.querySelector('.bsc-crop-img');
      this._setupCropHandles(stage, img);
    }

    _cancelCrop() {
      // Confirm if there are more items waiting — cancelling here drops the
      // current image but the user might still want to crop the rest.
      const remaining = this._pendingCropItems?.length || 0;
      if (remaining > 1) {
        const skipAll = confirm(
          `Skip cropping this image?\n\n` +
          `${remaining - 1} more image(s) waiting. Tap OK to skip this one and continue, ` +
          `or Cancel to keep cropping.`
        );
        if (!skipAll) return; // back to crop view
      }

      this._cropTargetItem = null;
      this._cropPts = null;
      this._advanceCropOrFinish();
    }

    async _applyCrop() {
      const item = this._cropTargetItem;
      if (!item || !this._cropPts) return;

      // CRITICAL: capture stage dimensions BEFORE switching views.
      // Once we go to 'progress', the crop stage has 0×0 dimensions and
      // the coord mapping would produce NaN.
      const stage     = this._el.querySelector('.bsc-crop-stage');
      const stageRect = stage.getBoundingClientRect();
      const cropPtsCopy = this._cropPts.map(p => ({ x: p.x, y: p.y }));

      this._goToView('progress');
      this._setProgress(20, 'Cropping...', 'Applying perspective correction');

      try {
        const newBlob = await this._perspectiveCrop(item.file, cropPtsCopy, stageRect);
        this._setProgress(80, 'Updating preview...', '');

        // Replace item.file and dataUrl
        item.file    = newBlob;
        item.size    = newBlob.size;
        item.type    = 'image/jpeg';
        item.dataUrl = await this._toDataUrl(newBlob);

        // If filename was the original (e.g. IMG_1234.HEIC), normalise to .jpg
        if (!item.name.toLowerCase().endsWith('.pdf')) {
          item.name = item.name.replace(/\.[^.]+$/, '') + '.jpg';
        }

        // Add cropped item to queue
        this._queue.push(item);

        this._cropTargetItem = null;
        this._cropPts = null;

        // Advance to next pending crop, or back to queue
        this._advanceCropOrFinish();
      } catch (err) {
        console.error('[BromarScanner] Crop error:', err);
        alert('Crop failed: ' + err.message);
        // Skip this item but continue with the rest
        this._advanceCropOrFinish();
      }
    }

    _advanceCropOrFinish() {
      // Remove the just-completed item from the pending queue
      if (this._pendingCropItems?.length) {
        this._pendingCropItems.shift();
      }

      if (this._pendingCropItems?.length) {
        // Next item — open crop view
        this._openCrop(this._pendingCropItems[0]);
      } else {
        // All done — show queue
        this._pendingCropItems = null;
        this._goToView('queue');
        this._renderQueue();
      }
    }

    async _perspectiveCrop(fileBlob, displayPts, stageRect) {
      // Load image at full resolution
      const dataUrl = await this._toDataUrl(fileBlob);
      const img     = await new Promise((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = rej;
        i.src = dataUrl;
      });

      // Map display coords → source image coords.
      // Image was object-fit:contain inside the stage, so we account for letterbox.
      // stageRect is passed in because by the time we run, the stage is hidden
      // (view switched to 'progress') and would report 0×0 dimensions.
      const sW = stageRect.width, sH = stageRect.height;
      const nW = img.naturalWidth, nH = img.naturalHeight;

      if (!sW || !sH || !nW || !nH) {
        throw new Error('Invalid image or stage dimensions');
      }

      const stageAspect = sW / sH;
      const imgAspect   = nW / nH;

      let rendW, rendH, offX, offY;
      if (imgAspect > stageAspect) {
        rendW = sW; rendH = sW / imgAspect;
        offX = 0;   offY  = (sH - rendH) / 2;
      } else {
        rendH = sH; rendW = sH * imgAspect;
        offX = (sW - rendW) / 2; offY = 0;
      }

      // Convert display → source coords
      const srcPts = displayPts.map(p => ({
        x: ((p.x - offX) / rendW) * nW,
        y: ((p.y - offY) / rendH) * nH
      }));

      // Output dimensions: take the longer of each opposite side pair
      const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
      const outW = Math.round(Math.max(dist(srcPts[0], srcPts[1]), dist(srcPts[3], srcPts[2])));
      const outH = Math.round(Math.max(dist(srcPts[0], srcPts[3]), dist(srcPts[1], srcPts[2])));

      // Clamp to reasonable max
      const MAX = 2480;
      const scale = Math.min(1, MAX / Math.max(outW, outH));
      const finalW = Math.max(100, Math.round(outW * scale));
      const finalH = Math.max(100, Math.round(outH * scale));

      // Source image to canvas
      const srcCanvas = document.createElement('canvas');
      srcCanvas.width  = nW;
      srcCanvas.height = nH;
      srcCanvas.getContext('2d').drawImage(img, 0, 0);
      const srcData = srcCanvas.getContext('2d').getImageData(0, 0, nW, nH);

      // Build output via bilinear mapping (perspective via quad → rectangle)
      const dstCanvas = document.createElement('canvas');
      dstCanvas.width  = finalW;
      dstCanvas.height = finalH;
      const dstCtx = dstCanvas.getContext('2d');
      const dstData = dstCtx.createImageData(finalW, finalH);

      const [tl, tr, br, bl] = srcPts;

      for (let y = 0; y < finalH; y++) {
        const v = y / finalH;
        for (let x = 0; x < finalW; x++) {
          const u = x / finalW;
          // Bilinear quad mapping
          const sx = (1 - u) * ((1 - v) * tl.x + v * bl.x) + u * ((1 - v) * tr.x + v * br.x);
          const sy = (1 - u) * ((1 - v) * tl.y + v * bl.y) + u * ((1 - v) * tr.y + v * br.y);

          const ix = Math.round(sx);
          const iy = Math.round(sy);
          if (ix < 0 || ix >= nW || iy < 0 || iy >= nH) continue;

          const si = (iy * nW + ix) * 4;
          const di = (y * finalW + x) * 4;
          dstData.data[di]     = srcData.data[si];
          dstData.data[di + 1] = srcData.data[si + 1];
          dstData.data[di + 2] = srcData.data[si + 2];
          dstData.data[di + 3] = 255;
        }
      }

      dstCtx.putImageData(dstData, 0, 0);
      return await new Promise(res =>
        dstCanvas.toBlob(b => res(b), 'image/jpeg', this.options.pdfQuality)
      );
    }

    // ── PROCESS: BUILD PDF + UPLOAD ───────────────────────────────────────────
    async _process() {
      this._goToView('progress');
      this._setProgress(0, 'Building PDF...', `${this._queue.length} file(s)`);

      try {
        const images = this._queue.filter(q => q.type.startsWith('image/'));
        const others = this._queue.filter(q => !q.type.startsWith('image/'));
        const uploads = [];

        if (images.length) {
          this._setProgress(10, 'Converting to PDF...', `${images.length} image(s)`);
          const blob = await this._imagesToPdf(images);
          // Honour renamed filename from first image, otherwise generic
          const fname = images[0].name.endsWith('.pdf')
            ? images[0].name
            : images[0].name.replace(/\.[^.]+$/, '') + '.pdf';
          uploads.push({ blob, name: fname, type: 'application/pdf' });
        }

        others.forEach(q => uploads.push({ blob: q.file, name: q.name, type: q.type }));

        this._setProgress(55, 'Uploading...', '');
        const results = await this._upload(uploads);

        this._setProgress(100, 'Done!', '');
        await new Promise(r => setTimeout(r, 500));
        this._queue = [];
        this._close();
        this._onComplete?.(results);

      } catch (err) {
        console.error('[BromarScanner]', err);
        alert('Upload error: ' + err.message);
        this._goToView('queue');
      }
    }

    async _imagesToPdf(items) {
      if (!window.jspdf) {
        await this._loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
      }
      const { jsPDF } = window.jspdf;
      let pdf = null;

      for (let i = 0; i < items.length; i++) {
        this._setProgress(
          Math.round(10 + (i / items.length) * 42),
          'Converting to PDF...',
          `Page ${i + 1} of ${items.length}`
        );
        const dataUrl   = await this._toDataUrl(items[i].file);
        const { w, h }  = await this._imgDims(dataUrl);
        const landscape = w > h;
        const pw = landscape ? 297 : 210, ph = landscape ? 210 : 297;

        if (!pdf) {
          pdf = new jsPDF({ orientation: landscape ? 'l' : 'p', unit: 'mm', format: 'a4' });
        } else {
          pdf.addPage('a4', landscape ? 'l' : 'p');
        }

        const m = 4, aw = pw - m * 2, ah = ph - m * 2;
        const r = Math.min(aw / w, ah / h);
        const fw = w * r, fh = h * r;
        pdf.addImage(dataUrl, 'JPEG', (pw - fw) / 2, (ph - fh) / 2, fw, fh, '', 'FAST');
      }

      return new Blob([pdf.output('arraybuffer')], { type: 'application/pdf' });
    }

    async _upload(files) {
      const { supabase: sb, bucket, pathPrefix: prefix } = this.options;
      const results = [];

      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        this._setProgress(
          Math.round(55 + (i / files.length) * 42),
          'Uploading...', f.name
        );

        const path = `${prefix}/${Date.now()}-${f.name}`;

        if (sb) {
          const { error } = await sb.storage.from(bucket)
            .upload(path, f.blob, { contentType: f.type, upsert: false });
          if (error) throw new Error('Upload failed: ' + error.message);

          const { data: u } = await sb.storage.from(bucket)
            .createSignedUrl(path, 60 * 60 * 24 * 30);

          results.push({ name: f.name, path, type: f.type, size: f.blob.size, blob: f.blob, url: u?.signedUrl || null });
        } else {
          results.push({ name: f.name, path, type: f.type, size: f.blob.size, blob: f.blob, url: URL.createObjectURL(f.blob) });
        }
      }
      return results;
    }

    // ── UTILITIES ─────────────────────────────────────────────────────────────
    _setProgress(pct, title, sub) {
      const v = this._el.querySelector('[data-view="progress"]');
      v.querySelector('.bsc-progress-title').textContent = title;
      v.querySelector('.bsc-progress-sub').textContent   = sub || '';
      v.querySelector('.bsc-progress-bar').style.width   = pct + '%';
    }

    _toDataUrl(file) {
      return new Promise(res => {
        const r = new FileReader();
        r.onload = e => res(e.target.result);
        r.readAsDataURL(file);
      });
    }

    _imgDims(dataUrl) {
      return new Promise(res => {
        const img = new Image();
        img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight });
        img.src = dataUrl;
      });
    }

    _iconDataUrl(name) {
      const ext = name.split('.').pop().toUpperCase().slice(0, 4);
      const c   = document.createElement('canvas');
      c.width = 120; c.height = 160;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#f1f5f9'; ctx.fillRect(0, 0, 120, 160);
      ctx.fillStyle = '#ea580c';
      ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(ext, 60, 92);
      return c.toDataURL();
    }

    _fmtSize(b) {
      return b < 1024 ? b + ' B'
        : b < 1048576 ? (b / 1024).toFixed(1) + ' KB'
        : (b / 1048576).toFixed(1) + ' MB';
    }

    _loadScript(src) {
      return new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = src; s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
    }
  }

  global.BromarScanner = BromarScanner;

})(window);
