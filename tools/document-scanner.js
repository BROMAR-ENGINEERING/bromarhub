/**
 * Bromar Document Scanner
 * Version: V1.04
 *
 * Mobile document scanner with OpenCV.js auto edge detection and multi-page
 * support.
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

    /* Unrenamed item: stand out so user knows action is required */
    .bsc-queue-item.bsc-needs-rename {
      border-color: #f59e0b;
      background: rgba(245, 158, 11, 0.06);
    }
    .bsc-queue-item.bsc-needs-rename .bsc-queue-name {
      color: #92400e;
      font-style: italic;
    }
    .bsc-queue-item.bsc-needs-rename .bsc-queue-btn.rename {
      border-color: #f59e0b;
      background: #fffbeb;
      color: #92400e;
      animation: bsc-pulse 1.8s ease-in-out infinite;
    }
    @keyframes bsc-pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4); }
      50%      { box-shadow: 0 0 0 6px rgba(245, 158, 11, 0); }
    }

    /* Page count badge */
    .bsc-page-count-badge {
      display: inline-block; margin-left: 6px;
      font-size: 0.66rem; font-weight: 700;
      padding: 1px 7px; border-radius: 10px;
      background: var(--accent, #ea580c); color: white;
      vertical-align: middle;
    }

    /* Page thumbnails strip (shown when item has multiple pages) */
    .bsc-page-strip {
      display: flex; gap: 6px; flex-wrap: wrap;
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid var(--border, #e5e7eb);
    }
    .bsc-page-thumb-wrap {
      position: relative;
      width: 50px; height: 50px;
      border-radius: 6px; overflow: hidden;
      background: #e2e8f0;
      border: 1px solid var(--border, #e5e7eb);
    }
    .bsc-page-thumb-wrap img {
      width: 100%; height: 100%; object-fit: cover;
    }
    .bsc-page-num {
      position: absolute; bottom: 0; left: 0; right: 0;
      background: rgba(0,0,0,0.7); color: white;
      font-size: 0.62rem; font-weight: 700;
      padding: 1px 0; text-align: center;
    }
    .bsc-page-remove-btn {
      position: absolute; top: -4px; right: -4px;
      width: 18px; height: 18px; border-radius: 50%;
      background: #dc2626; color: white; border: 2px solid white;
      font-size: 0.7rem; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; padding: 0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    }

    /* Rotate button — small inline icon button */
    .bsc-queue-btn.rotate {
      padding: 4px 8px;
    }
    .bsc-queue-btn.addpage {
      border-color: var(--accent, #ea580c);
      color: var(--accent, #ea580c);
      background: rgba(234, 88, 12, 0.05);
    }
    .bsc-queue-btn.addpage:active {
      background: rgba(234, 88, 12, 0.15);
    }
    .bsc-rename-required-badge {
      display: inline-block; margin-left: 6px;
      font-size: 0.65rem; font-weight: 700;
      padding: 1px 6px; border-radius: 10px;
      background: #f59e0b; color: white;
      vertical-align: middle;
    }
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
      aspect-ratio: 3/4;
      max-height: 60vh;
      /* IMPORTANT: no overflow:hidden — corner handles sit at stage edges
         and need to remain fully visible and tappable. The img/overlay are
         clipped via border-radius on their own elements. */
    }
    .bsc-crop-stage::after {
      content: ''; position: absolute; inset: 0;
      border-radius: 12px; pointer-events: none;
      /* Optional thin border for visual definition */
      box-shadow: inset 0 0 0 1px rgba(255,255,255,0.05);
    }
    .bsc-crop-img {
      position: absolute; inset: 0; width: 100%; height: 100%;
      object-fit: contain; user-select: none; -webkit-user-drag: none;
      pointer-events: none; border-radius: 12px;
    }
    .bsc-crop-overlay {
      position: absolute; inset: 0; width: 100%; height: 100%;
      pointer-events: none; border-radius: 12px;
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

    /* Magnifying loupe — shown while dragging a crop handle.
       Renders a fixed-position circular zoomed view of the area under the finger. */
    .bsc-loupe {
      position: fixed;
      width: 130px; height: 130px;
      border-radius: 50%;
      border: 3px solid var(--accent, #ea580c);
      box-shadow: 0 4px 20px rgba(0,0,0,0.6), inset 0 0 0 2px rgba(255,255,255,0.4);
      overflow: hidden;
      pointer-events: none;
      z-index: 100001;
      display: none;
      background: #1a1a1a;
    }
    .bsc-loupe.bsc-loupe-on { display: block; }
    .bsc-loupe-canvas { width: 100%; height: 100%; display: block; }
    /* Crosshair overlay — pure CSS, no extra element */
    .bsc-loupe::before, .bsc-loupe::after {
      content: ''; position: absolute;
      background: rgba(234, 88, 12, 0.85);
      pointer-events: none;
    }
    .bsc-loupe::before {
      left: 50%; top: 25%; width: 2px; height: 50%;
      transform: translateX(-50%);
    }
    .bsc-loupe::after {
      top: 50%; left: 25%; height: 2px; width: 50%;
      transform: translateY(-50%);
    }

    .bsc-crop-actions {
      display: flex; flex-direction: column; gap: 8px;
    }
    .bsc-crop-utility-row {
      display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px;
    }
    .bsc-crop-utility {
      padding: 10px 6px; border: 1.5px solid var(--border, #e5e7eb);
      border-radius: 10px; background: transparent;
      font-family: inherit; font-size: 0.8rem; font-weight: 600;
      cursor: pointer; color: var(--text-secondary, #666);
      -webkit-tap-highlight-color: transparent;
    }
    .bsc-crop-utility:active {
      border-color: var(--accent, #ea580c);
      color: var(--accent, #ea580c);
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
      width: 100%;
      padding: 14px; border: none; border-radius: 10px;
      background: linear-gradient(135deg, #ea580c, #fb923c);
      font-family: inherit; font-size: 0.95rem; font-weight: 700;
      cursor: pointer; color: white;
      -webkit-tap-highlight-color: transparent;
      box-shadow: 0 2px 8px rgba(234,88,12,0.3);
    }
    .bsc-crop-apply:active {
      transform: translateY(1px);
      box-shadow: 0 1px 4px rgba(234,88,12,0.4);
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
                <div class="bsc-crop-utility-row">
                  <button class="bsc-crop-utility" data-action="crop-rotate">↻ Rotate</button>
                  <button class="bsc-crop-utility" data-action="crop-reset">↺ Reset</button>
                  <button class="bsc-crop-utility" data-action="crop-cancel">Cancel</button>
                </div>
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

      // Loupe magnifier — lives outside the sheet so it's never clipped
      this._loupeEl = document.createElement('div');
      this._loupeEl.className = 'bsc-loupe';
      this._loupeEl.innerHTML = '<canvas class="bsc-loupe-canvas"></canvas>';
      document.body.appendChild(this._loupeEl);

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
      el.querySelector('[data-action="crop-rotate"]').addEventListener('click', () => this._rotateCropImage());
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
      this._loupeEl?.classList.remove('bsc-loupe-on');
      if (this._cropDragTeardown) { this._cropDragTeardown(); this._cropDragTeardown = null; }
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

      const incomingImages = [];

      for (const file of Array.from(fileList)) {
        if (file.size > 50 * 1024 * 1024) { alert(`${file.name} exceeds 50MB`); continue; }
        const id = `f${Date.now()}${Math.random().toString(36).slice(2, 6)}`;

        if (file.type.startsWith('image/')) {
          // Auto-rotate based on EXIF orientation so portrait photos stay portrait
          const orientation = await this._readExifOrientation(file);
          let workingFile = file;
          if (orientation !== 1) {
            try {
              workingFile = await this._bakeRotation(file, { exifOrientation: orientation });
            } catch (e) {
              console.warn('EXIF rotation failed, using original:', e);
            }
          }

          const dataUrl = await this._toDataUrl(workingFile);
          incomingImages.push({
            id, file: workingFile, dataUrl,
            name: file.name, size: workingFile.size, type: workingFile.type || file.type
          });
        } else {
          // PDFs / docs go straight to queue (no group, no crop)
          this._queue.push({
            id, file,
            dataUrl: this._iconDataUrl(file.name),
            name: file.name, size: file.size, type: file.type,
            renamed: false,
            groupId: id,        // own group of 1
            pageIndex: 0
          });
        }
      }

      // Every image must be cropped — process them one at a time
      if (incomingImages.length > 0) {
        // If we're in "add page" mode, mark these to join the target group
        if (this._addPageTargetGroupId) {
          incomingImages.forEach(it => {
            it._joinGroup = this._addPageTargetGroupId;
          });
        }
        this._pendingCropItems = incomingImages;
        this._openCrop(this._pendingCropItems[0]);
        return;
      }

      // No images — just show queue
      this._addPageTargetGroupId = null;
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

      // Count unnamed GROUPS (not individual pages) — one rename = whole document
      const groupIds = new Set();
      const unnamedGroupIds = new Set();
      this._queue.forEach(q => {
        const gid = q.groupId || q.id;
        groupIds.add(gid);
        if (!q.renamed) unnamedGroupIds.add(gid);
      });
      const totalGroups   = groupIds.size;
      const unnamedCount  = unnamedGroupIds.size;

      if (unnamedCount > 0) {
        procBtn.disabled = true;
        procBtn.textContent = `Rename ${unnamedCount} document${unnamedCount > 1 ? 's' : ''} to continue`;
      } else {
        procBtn.disabled = false;
        procBtn.textContent = `Convert & Upload (${totalGroups}) →`;
      }

      // ── Group items by groupId so multi-page docs render as one block ──
      const groups = [];
      const groupMap = new Map();
      this._queue.forEach(it => {
        const gid = it.groupId || it.id;
        if (!groupMap.has(gid)) {
          const g = { id: gid, pages: [], head: null };
          groupMap.set(gid, g);
          groups.push(g);
        }
        groupMap.get(gid).pages.push(it);
      });
      // Sort pages within each group by pageIndex
      groups.forEach(g => {
        g.pages.sort((a, b) => (a.pageIndex || 0) - (b.pageIndex || 0));
        g.head = g.pages[0];
      });

      groups.forEach(group => {
        const item = group.head; // representative item for the group
        const totalPages = group.pages.length;
        const isMultiPage = totalPages > 1;

        const wrap = document.createElement('div');
        wrap.className = 'bsc-queue-item';
        if (!item.renamed) wrap.classList.add('bsc-needs-rename');

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
        // Show name with page count badge if multi-page
        if (isMultiPage) {
          nameEl.innerHTML = `${this._escapeHtml(item.name)}<span class="bsc-page-count-badge">${totalPages} pages</span>`;
        } else {
          nameEl.textContent = item.name;
        }
        nameEl.title = item.name;

        // Sum sizes across all pages
        const totalSize = group.pages.reduce((s, p) => s + (p.size || 0), 0);

        const metaEl = document.createElement('div');
        metaEl.className = 'bsc-queue-meta';
        if (item.renamed) {
          metaEl.textContent = this._fmtSize(totalSize);
        } else {
          metaEl.innerHTML = `${this._fmtSize(totalSize)} <span class="bsc-rename-required-badge">RENAME REQUIRED</span>`;
        }

        const btns = document.createElement('div');
        btns.className = 'bsc-queue-btns';

        // Only images get image-specific buttons (rotate, re-crop, add page)
        const isImage = item.type.startsWith('image/');

        if (isImage) {
          // ── Add Page button ──
          const addPageBtn = document.createElement('button');
          addPageBtn.type = 'button';
          addPageBtn.className = 'bsc-queue-btn addpage';
          addPageBtn.textContent = '➕ Add Page';
          addPageBtn.addEventListener('click', () => {
            // Mark target group, then open source picker to capture another page
            this._addPageTargetGroupId = group.id;
            this._goToView('sources');
          });
          btns.appendChild(addPageBtn);

          // ── Re-crop button ──
          const cropBtn = document.createElement('button');
          cropBtn.type = 'button';
          cropBtn.className = 'bsc-queue-btn crop';
          cropBtn.textContent = '✂️ Re-crop';
          cropBtn.addEventListener('click', () => {
            // Preserve grouping/renaming state across the re-crop cycle
            item._preserveGroupId   = item.groupId;
            item._preservePageIndex = item.pageIndex;
            item._preserveRenamed   = item.renamed;
            item._preserveName      = item.name;
            this._pendingCropItems = [item];
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

        // ── Page strip (shown only for multi-page docs) ──
        if (isMultiPage) {
          const strip = document.createElement('div');
          strip.className = 'bsc-page-strip';

          group.pages.forEach((page, idx) => {
            const pageWrap = document.createElement('div');
            pageWrap.className = 'bsc-page-thumb-wrap';

            const pImg = document.createElement('img');
            pImg.src = page.dataUrl; pImg.alt = `Page ${idx + 1}`;

            const pNum = document.createElement('div');
            pNum.className = 'bsc-page-num';
            pNum.textContent = `${idx + 1}`;

            pageWrap.append(pImg, pNum);

            // Only show remove button if more than 1 page
            if (group.pages.length > 1) {
              const pRemove = document.createElement('button');
              pRemove.type = 'button';
              pRemove.className = 'bsc-page-remove-btn';
              pRemove.textContent = '×';
              pRemove.title = `Remove page ${idx + 1}`;
              pRemove.addEventListener('click', (e) => {
                e.stopPropagation();
                this._queue = this._queue.filter(q => q.id !== page.id);
                // Re-index remaining pages in this group
                let newIdx = 0;
                this._queue.forEach(q => {
                  if (q.groupId === group.id) {
                    q.pageIndex = newIdx++;
                  }
                });
                this._renderQueue();
              });
              pageWrap.appendChild(pRemove);
            }

            strip.appendChild(pageWrap);
          });

          wrap.appendChild(strip);
        }

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

          // Document type dropdown — includes a special "Custom" option
          const sel = document.createElement('select');
          sel.className = 'bsc-rename-select';
          sel.innerHTML =
            '<option value="">— Select document type —</option>' +
            DOC_TYPES.map(t => `<option value="${t.value}">${t.label}</option>`).join('') +
            '<option value="__custom__">✏️ Custom name...</option>';

          // Custom name input (hidden unless "Custom" is chosen in the dropdown)
          const customWrap = document.createElement('div');
          customWrap.className = 'bsc-rename-jobinput-wrap';
          customWrap.style.display = 'none';
          const customLabel = document.createElement('label');
          customLabel.className = 'bsc-rename-jobinput-label';
          customLabel.textContent = 'Custom Name';
          const customInput = document.createElement('input');
          customInput.type = 'text';
          customInput.className = 'bsc-rename-jobinput';
          customInput.placeholder = 'e.g. site_diagram';
          customInput.style.textTransform = 'lowercase';
          customWrap.append(customLabel, customInput);

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
          panel.append(sel, customWrap, jobWrap, preview, row);
          wrap.appendChild(panel);

          // Job number — force uppercase, no spaces
          jobInput.addEventListener('input', () => {
            const cursor = jobInput.selectionStart;
            jobInput.value = jobInput.value.toUpperCase().replace(/\s/g, '');
            jobInput.setSelectionRange(cursor, cursor);
            updatePreview();
          });

          // Custom name — lowercase, replace spaces with underscores,
          // strip anything that isn't a-z 0-9 _ -
          customInput.addEventListener('input', () => {
            const cursor = customInput.selectionStart;
            customInput.value = customInput.value
              .toLowerCase()
              .replace(/\s+/g, '_')
              .replace(/[^a-z0-9_-]/g, '');
            customInput.setSelectionRange(cursor, cursor);
            updatePreview();
          });

          // Resolve which prefix to use — either selected DOC_TYPE or custom text
          const getPrefix = () => {
            if (sel.value === '__custom__') return customInput.value.trim();
            return sel.value;
          };

          const buildName = () => {
            const prefix = getPrefix();
            const jobNum = jobInput.value.trim().toLowerCase();
            if (!prefix) return null;
            return jobNum ? `${prefix}_${jobNum}.pdf` : `${prefix}.pdf`;
          };

          const updatePreview = () => {
            const prefix = getPrefix();
            const jobNum = jobInput.value.trim();
            if (!prefix) {
              preview.textContent = sel.value === '__custom__'
                ? 'Type a custom name above'
                : 'Select a type to preview filename';
              applyBtn.disabled = true;
              return;
            }
            const jp = jobNum ? `_<span class="hi">${jobNum.toLowerCase()}</span>` : '';
            preview.innerHTML = `${prefix}${jp}<span class="hi">.pdf</span>`;
            applyBtn.disabled = false;
          };

          // Toggle custom input visibility based on dropdown choice
          sel.addEventListener('change', () => {
            if (sel.value === '__custom__') {
              customWrap.style.display = '';
              customInput.focus();
            } else {
              customWrap.style.display = 'none';
            }
            updatePreview();
          });

          applyBtn.addEventListener('click', () => {
            const name = buildName();
            if (!name) return;
            // Apply name + renamed flag to EVERY page in this group
            this._queue.forEach(q => {
              if (q.groupId === group.id) {
                q.name = name;
                q.renamed = true;
              }
            });
            // Remember the job number entered here for subsequent renames
            const enteredJob = jobInput.value.trim();
            if (enteredJob) this.options.jobNumber = enteredJob;
            panel.remove();
            this._renderQueue();
          });

          cancelBtn.addEventListener('click', () => panel.remove());
        });

        // ── Remove (removes ENTIRE document group) ──────────────────────
        delBtn.addEventListener('click', () => {
          this._queue = this._queue.filter(q => q.groupId !== group.id);
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

      // Map each detected point from image coords → stage display coords.
      // Clamp into the IMAGE rendered area (not the full stage) so handles
      // never land in the letterbox region.
      this._cropPts = imageQuad.map(p => ({
        x: Math.max(offX, Math.min(offX + rendW, offX + (p.x / natW) * rendW)),
        y: Math.max(offY, Math.min(offY + rendH, offY + (p.y / natH) * rendH)),
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
    // Uses a polling approach because OpenCV.js initialisation timing varies
    // across builds — sometimes cv.imread is ready before the script's load
    // event fires, sometimes after onRuntimeInitialized, sometimes neither
    // fires reliably and we just have to poll for cv to appear.
    _ensureOpenCV() {
      // If a previous load attempt rejected, allow a fresh retry (don't cache
      // a permanent failure — could have been a transient network blip).
      if (this._opencvReady && !this._opencvFailed) return this._opencvReady;

      this._opencvFailed = false;

      this._opencvReady = new Promise((resolve, reject) => {
        // Already loaded?
        if (window.cv && typeof window.cv.imread === 'function') {
          resolve();
          return;
        }

        const isReady = () => window.cv && typeof window.cv.imread === 'function';

        // Insert the script tag if it isn't already there
        let s = document.querySelector('script[data-bsc-opencv]');
        if (!s) {
          s = document.createElement('script');
          s.src = 'https://docs.opencv.org/4.8.0/opencv.js';
          s.async = true;
          s.setAttribute('data-bsc-opencv', '1');
          s.onerror = () => {
            this._opencvFailed = true;
            reject(new Error('Failed to load OpenCV.js'));
          };
          document.head.appendChild(s);
        }

        // Poll for cv.imread to be defined. OpenCV.js completes its WASM
        // initialisation asynchronously after the script tag loads, so a
        // simple onload listener isn't reliable across all builds. Poll
        // every 80ms for up to 30s.
        let elapsed = 0;
        const interval = 80;
        const maxWait  = 30000;

        const poll = setInterval(() => {
          if (isReady()) {
            clearInterval(poll);
            resolve();
            return;
          }
          elapsed += interval;
          if (elapsed >= maxWait) {
            clearInterval(poll);
            this._opencvFailed = true;
            reject(new Error('OpenCV.js initialisation timed out'));
          }
        }, interval);
      });

      // If this promise rejects, clear the cache so next call retries.
      this._opencvReady.catch(() => {
        this._opencvReady = null;
      });

      return this._opencvReady;
    }

    _setupCropHandles(stage, img) {
      // Tear down any prior drag listeners (avoids accumulating them across
      // resets / re-opens of the crop view)
      if (this._cropDragTeardown) this._cropDragTeardown();
      this._cropDragTeardown = null;

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

      // Loupe helpers — shared by all 4 handles
      const showLoupe = (clientX, clientY, pt) => {
        const loupe       = this._loupeEl;
        const loupeSize   = 130;
        const zoom        = 3.2;
        const img         = stage.querySelector('.bsc-crop-img');

        // Position loupe above-left of the finger so finger doesn't block view
        const offset = 60;
        let lx = clientX - offset - loupeSize;
        let ly = clientY - offset - loupeSize;
        // If too close to left/top edge, flip to opposite side of finger
        if (lx < 8)  lx = clientX + offset;
        if (ly < 8)  ly = clientY + offset;
        // Final clamp inside viewport
        lx = Math.max(8, Math.min(window.innerWidth  - loupeSize - 8, lx));
        ly = Math.max(8, Math.min(window.innerHeight - loupeSize - 8, ly));

        loupe.style.left = lx + 'px';
        loupe.style.top  = ly + 'px';
        loupe.classList.add('bsc-loupe-on');

        // Draw zoomed region centred on the handle position
        const canvas = loupe.querySelector('.bsc-loupe-canvas');
        canvas.width  = loupeSize;
        canvas.height = loupeSize;
        const ctx = canvas.getContext('2d');

        // Map handle position (stage coords) → source image natural coords.
        // Image uses object-fit:contain inside stage, so compute rendered rect.
        const r          = stage.getBoundingClientRect();
        const natW       = img.naturalWidth  || 1;
        const natH       = img.naturalHeight || 1;
        const stageAspect = r.width / r.height;
        const imgAspect   = natW / natH;
        let rendW, rendH, offX, offY;
        if (imgAspect > stageAspect) {
          rendW = r.width;  rendH = r.width / imgAspect;
          offX = 0;         offY  = (r.height - rendH) / 2;
        } else {
          rendH = r.height; rendW = r.height * imgAspect;
          offX = (r.width - rendW) / 2; offY = 0;
        }

        const imgX = ((pt.x - offX) / rendW) * natW;
        const imgY = ((pt.y - offY) / rendH) * natH;

        const regionW = loupeSize / zoom;
        const regionH = loupeSize / zoom;
        const sx = imgX - regionW / 2;
        const sy = imgY - regionH / 2;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, loupeSize, loupeSize);
        try {
          ctx.drawImage(img, sx, sy, regionW, regionH, 0, 0, loupeSize, loupeSize);
        } catch (e) { /* off-image — leave blank background */ }
      };

      const hideLoupe = () => {
        this._loupeEl.classList.remove('bsc-loupe-on');
      };

      // Collect all document-level listeners we register so we can clean them
      // up when the crop view is re-initialised.
      const docListeners = [];
      const addDocListener = (event, fn, opts) => {
        document.addEventListener(event, fn, opts);
        docListeners.push([event, fn, opts]);
      };
      this._cropDragTeardown = () => {
        docListeners.forEach(([ev, fn, opts]) => document.removeEventListener(ev, fn, opts));
      };

      this._cropPts.forEach((pt, i) => {
        const handle = document.createElement('div');
        handle.className = 'bsc-crop-handle';
        handle.dataset.idx = i;
        handle.style.left = pt.x + 'px';
        handle.style.top  = pt.y + 'px';
        stage.appendChild(handle);

        let startX = 0, startY = 0, ptStartX = 0, ptStartY = 0;
        let dragging = false;
        let activePointerId = null;

        const onDown = (e) => {
          dragging = true;
          activePointerId = e.pointerId;
          e.preventDefault(); e.stopPropagation();
          startX   = e.clientX; startY = e.clientY;
          ptStartX = pt.x;      ptStartY = pt.y;
          try { handle.setPointerCapture(e.pointerId); } catch (_) {}
          showLoupe(e.clientX, e.clientY, pt);
        };
        const onMove = (e) => {
          if (!dragging) return;
          if (activePointerId !== null && e.pointerId !== activePointerId) return;
          e.preventDefault();
          const r = stage.getBoundingClientRect();
          pt.x = Math.max(0, Math.min(r.width,  ptStartX + (e.clientX - startX)));
          pt.y = Math.max(0, Math.min(r.height, ptStartY + (e.clientY - startY)));
          handle.style.left = pt.x + 'px';
          handle.style.top  = pt.y + 'px';
          this._drawCropOverlay(stage);
          showLoupe(e.clientX, e.clientY, pt);
        };
        const onUp = (e) => {
          if (!dragging) return;
          if (activePointerId !== null && e && e.pointerId !== undefined && e.pointerId !== activePointerId) return;
          dragging = false;
          activePointerId = null;
          hideLoupe();
        };

        handle.addEventListener('pointerdown', onDown, { passive: false });
        addDocListener('pointermove',   onMove, { passive: false });
        addDocListener('pointerup',     onUp);
        addDocListener('pointercancel', onUp);
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

    // Rotate the image currently being cropped by 90° clockwise.
    // Re-runs auto-detection on the rotated image so the new corners are
    // suggested correctly.
    async _rotateCropImage() {
      const item = this._cropTargetItem;
      if (!item) return;

      const view       = this._el.querySelector('[data-view="crop"]');
      const stage      = view.querySelector('.bsc-crop-stage');
      const img        = view.querySelector('.bsc-crop-img');
      const status     = view.querySelector('.bsc-crop-status');
      const statusText = view.querySelector('.bsc-crop-status-text');
      const rotBtn     = view.querySelector('[data-action="crop-rotate"]');

      rotBtn.disabled = true;
      status.classList.remove('success', 'fail');
      status.classList.add('bsc-crop-status-on');
      statusText.textContent = 'Rotating...';

      try {
        const rotated = await this._bakeRotation(item.file, { rotateDeg: 90 });
        item.file    = rotated;
        item.size    = rotated.size;
        item.type    = 'image/jpeg';
        item.dataUrl = await this._toDataUrl(rotated);

        // Reload the <img> with new data, then re-run auto-detect
        await new Promise((resolve, reject) => {
          img.onload  = resolve;
          img.onerror = reject;
          img.src = item.dataUrl;
        });

        // Re-init handles at full-frame default for the new orientation
        await new Promise(r => requestAnimationFrame(r));
        this._setupCropHandles(stage, img);

        // Re-run auto-detect on the rotated image
        statusText.textContent = 'Detecting edges...';
        try {
          const quad = await this._autoDetectCorners(img);
          if (quad) {
            this._applyAutoQuad(stage, quad);
            statusText.textContent = '✓ Edges detected — adjust if needed';
            status.classList.add('success');
          } else {
            statusText.textContent = 'No clear edges — drag corners manually';
            status.classList.add('fail');
          }
        } catch (e) {
          statusText.textContent = 'Auto-detect unavailable — drag manually';
          status.classList.add('fail');
        }

        setTimeout(() => status.classList.remove('bsc-crop-status-on'), 3000);
      } catch (err) {
        console.error('[BromarScanner] Rotate error:', err);
        statusText.textContent = 'Rotate failed';
        status.classList.add('fail');
      } finally {
        rotBtn.disabled = false;
      }
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

        // Add cropped item to queue with grouping metadata
        if (item._preserveGroupId !== undefined) {
          // Re-crop: restore exactly what was there
          item.groupId   = item._preserveGroupId;
          item.pageIndex = item._preservePageIndex;
          item.renamed   = item._preserveRenamed;
          item.name      = item._preserveName;
          delete item._preserveGroupId;
          delete item._preservePageIndex;
          delete item._preserveRenamed;
          delete item._preserveName;
        } else if (item._joinGroup) {
          // Joining an existing document — inherit groupId and inherit renamed
          // state from the head item
          item.groupId = item._joinGroup;
          const head = this._queue.find(q => q.id === item.groupId);
          item.renamed = head ? head.renamed : false;
          if (head) {
            // Same name as the head so they merge into one PDF during _process
            item.name = head.name;
          }
          // Append at the end of that group (pageIndex = current count of pages)
          item.pageIndex = this._queue.filter(q => q.groupId === item.groupId).length;
          delete item._joinGroup;
        } else {
          // New standalone document
          item.groupId = item.id;
          item.pageIndex = 0;
          item.renamed = false;
        }

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
        // All done — show queue and clear any add-page mode
        this._pendingCropItems = null;
        this._addPageTargetGroupId = null;
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
      // Defensive check — block upload if any document group hasn't been renamed
      const unnamedGroups = new Set();
      this._queue.forEach(q => {
        if (!q.renamed) unnamedGroups.add(q.groupId || q.id);
      });
      if (unnamedGroups.size > 0) {
        alert(`${unnamedGroups.size} document(s) still need to be renamed before uploading.\n\nTap the ✏️ Rename button on each highlighted item.`);
        return;
      }

      this._goToView('progress');
      this._setProgress(0, 'Building PDF...', `${this._queue.length} file(s)`);

      try {
        const images = this._queue.filter(q => q.type.startsWith('image/'));
        const others = this._queue.filter(q => !q.type.startsWith('image/'));
        const uploads = [];

        // Group images by groupId — each group becomes one PDF.
        // Pages within a group are sorted by pageIndex.
        const imageGroups = new Map();
        images.forEach(img => {
          const gid = img.groupId || img.id;
          if (!imageGroups.has(gid)) imageGroups.set(gid, []);
          imageGroups.get(gid).push(img);
        });

        const groupIds = [...imageGroups.keys()];
        for (let g = 0; g < groupIds.length; g++) {
          const gid   = groupIds[g];
          const group = imageGroups.get(gid).slice().sort(
            (a, b) => (a.pageIndex || 0) - (b.pageIndex || 0)
          );
          const fileName = group[0].name.toLowerCase().endsWith('.pdf')
            ? group[0].name
            : group[0].name.replace(/\.[^.]+$/, '') + '.pdf';
          this._setProgress(
            Math.round(10 + (g / groupIds.length) * 40),
            'Converting to PDF...',
            `${fileName} (${group.length} page${group.length > 1 ? 's' : ''})`
          );
          const blob = await this._imagesToPdf(group);
          uploads.push({ blob, name: fileName, type: 'application/pdf' });
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

    _escapeHtml(s) {
      return String(s ?? '').replace(/[&<>"']/g, c => ({
        '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
      }[c]));
    }

    // ── EXIF ORIENTATION ─────────────────────────────────────────────────
    // Read EXIF orientation tag (1-8) from a JPEG file. Returns 1 if absent
    // or non-JPEG. Used to auto-rotate phone photos to correct orientation.
    async _readExifOrientation(file) {
      if (!file || !file.type || !file.type.startsWith('image/jpeg')) return 1;

      try {
        const buf  = await file.slice(0, 65536).arrayBuffer();
        const view = new DataView(buf);
        if (view.getUint16(0) !== 0xFFD8) return 1; // not a JPEG

        let offset = 2;
        const len = view.byteLength;
        while (offset < len) {
          if (view.getUint16(offset) !== 0xFF00 && (view.getUint16(offset) & 0xFF00) === 0xFF00) {
            const marker = view.getUint16(offset);
            offset += 2;
            // APP1 (EXIF) marker
            if (marker === 0xFFE1) {
              if (view.getUint32(offset + 2) !== 0x45786966) return 1; // "Exif"
              const little = view.getUint16(offset + 8) === 0x4949;
              const ifdOffset = view.getUint32(offset + 12, little);
              const tagCount  = view.getUint16(offset + 8 + ifdOffset, little);
              for (let i = 0; i < tagCount; i++) {
                const entryOffset = offset + 8 + ifdOffset + 2 + i * 12;
                if (view.getUint16(entryOffset, little) === 0x0112) {
                  return view.getUint16(entryOffset + 8, little);
                }
              }
              return 1;
            } else {
              const segLen = view.getUint16(offset, false);
              offset += segLen;
            }
          } else {
            offset++;
          }
        }
      } catch (e) {
        console.warn('EXIF read failed:', e);
      }
      return 1;
    }

    // Bake a rotation into the actual pixels of a blob.
    // exifOrientation: 1..8 OR a direct angle in degrees if rotateDeg passed.
    // Returns a new Blob (image/jpeg).
    async _bakeRotation(fileBlob, { exifOrientation = 1, rotateDeg = 0 } = {}) {
      // If no rotation needed at all, return as-is
      if (exifOrientation === 1 && rotateDeg === 0) return fileBlob;

      const dataUrl = await this._toDataUrl(fileBlob);
      const img     = await new Promise((res, rej) => {
        const i = new Image();
        i.onload = () => res(i); i.onerror = rej; i.src = dataUrl;
      });

      // Decode EXIF orientation to rotation/flip
      let rot = 0, flipH = false, flipV = false;
      switch (exifOrientation) {
        case 2: flipH = true; break;
        case 3: rot = 180; break;
        case 4: flipV = true; break;
        case 5: rot = 90;  flipH = true; break;
        case 6: rot = 90;  break;
        case 7: rot = 270; flipH = true; break;
        case 8: rot = 270; break;
      }
      // Add any user-applied rotation on top
      rot = (rot + rotateDeg) % 360;

      const w = img.naturalWidth, h = img.naturalHeight;
      const swap = rot === 90 || rot === 270;
      const cw = swap ? h : w;
      const ch = swap ? w : h;

      const canvas = document.createElement('canvas');
      canvas.width  = cw;
      canvas.height = ch;
      const ctx = canvas.getContext('2d');

      ctx.save();
      ctx.translate(cw / 2, ch / 2);
      ctx.rotate(rot * Math.PI / 180);
      if (flipH) ctx.scale(-1, 1);
      if (flipV) ctx.scale(1, -1);
      ctx.drawImage(img, -w / 2, -h / 2);
      ctx.restore();

      return new Promise(res => {
        canvas.toBlob(b => res(b), 'image/jpeg', 0.92);
      });
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
