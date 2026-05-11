/**
 * Bromar Document Scanner
 * Version: V1.00
 * 
 * Reusable mobile-first document scanner module.
 * Provides: photo library, camera capture, document scan (edge detect + deskew), file browser.
 * Converts to PDF and uploads to Supabase.
 *
 * Usage:
 *   <script src="document-scanner.js"></script>
 *   const scanner = new BromarScanner({ supabase: sb, bucket: 'job-sheet-files' });
 *   scanner.open({ onComplete: (files) => console.log(files) });
 *
 * Or attach to an existing upload area:
 *   scanner.attachTo('#fileUploadArea', { onComplete: ... });
 */

(function(global) {
  'use strict';

  // ─── STYLES ────────────────────────────────────────────────────────────────
  const STYLES = `
    .bsc-overlay {
      position: fixed; inset: 0; z-index: 99999;
      background: rgba(0,0,0,0.92);
      display: flex; align-items: flex-end; justify-content: center;
      opacity: 0; transition: opacity 0.3s ease;
      font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
      overscroll-behavior: none; touch-action: pan-y;
    }
    .bsc-overlay.bsc-visible { opacity: 1; }

    .bsc-sheet {
      background: var(--bg-secondary, #fff);
      border-radius: 20px 20px 0 0;
      width: 100%; max-width: 600px;
      max-height: 95vh;
      display: flex; flex-direction: column;
      transform: translateY(100%); transition: transform 0.35s cubic-bezier(0.34,1.56,0.64,1);
      overflow: hidden;
      /* Prevent iOS back-swipe and Android edge-swipe triggering navigation */
      overscroll-behavior: contain;
      touch-action: pan-y;
    }
    .bsc-overlay {
      overscroll-behavior: none;
    }
    .bsc-overlay.bsc-visible .bsc-sheet { transform: translateY(0); }

    .bsc-handle {
      width: 40px; height: 4px;
      background: var(--border, #e5e7eb);
      border-radius: 2px;
      margin: 12px auto 0;
      flex-shrink: 0;
    }

    .bsc-header {
      padding: 16px 20px 12px;
      display: flex; align-items: center; justify-content: space-between;
      border-bottom: 1px solid var(--border, #f0f0f0);
      flex-shrink: 0;
    }
    .bsc-title { font-size: 1.1rem; font-weight: 700; color: var(--text-primary, #0a0a0a); }
    .bsc-close {
      width: 32px; height: 32px; border-radius: 50%;
      background: var(--bg-main, #f5f5f5); border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      font-size: 1.1rem; color: var(--text-secondary, #666);
      transition: all 0.2s;
    }
    .bsc-close:hover { background: var(--error-bg, #fee2e2); color: var(--error, #dc2626); }

    .bsc-body { flex: 1; overflow-y: auto; overscroll-behavior: contain; }

    /* ── SOURCE PICKER ────────────────────────────────────────── */
    .bsc-sources {
      padding: 16px;
      display: grid; grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .bsc-source-btn {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 8px; padding: 20px 12px;
      background: var(--bg-main, #fafafa);
      border: 2px solid var(--border, #e5e7eb);
      border-radius: 14px; cursor: pointer;
      transition: all 0.2s; text-align: center;
      color: var(--text-primary, #0a0a0a);
    }
    .bsc-source-btn:active { transform: scale(0.96); }
    .bsc-source-btn:hover, .bsc-source-btn:focus {
      border-color: var(--accent, #ea580c);
      background: var(--card-hover, rgba(234,88,12,0.04));
    }
    .bsc-source-btn svg { width: 32px; height: 32px; stroke: var(--accent, #ea580c); fill: none; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    .bsc-source-label { font-size: 0.85rem; font-weight: 600; }
    .bsc-source-sub { font-size: 0.72rem; color: var(--text-secondary, #888); margin-top: 2px; }

    /* ── SCAN VIEW ────────────────────────────────────────────── */
    .bsc-scan-view { padding: 12px; display: none; flex-direction: column; gap: 12px; }
    .bsc-scan-view.bsc-active { display: flex; }

    .bsc-viewfinder {
      position: relative; width: 100%;
      background: #000; border-radius: 12px; overflow: hidden;
      aspect-ratio: 3/4;
    }
    .bsc-video {
      width: 100%; height: 100%; object-fit: cover; display: block;
    }
    .bsc-canvas-overlay {
      position: absolute; inset: 0; width: 100%; height: 100%;
      pointer-events: none;
    }
    .bsc-corner {
      position: absolute; width: 28px; height: 28px;
      border-color: #ea580c; border-style: solid;
      opacity: 0.9;
    }
    .bsc-corner.tl { top: 12px; left: 12px; border-width: 3px 0 0 3px; border-radius: 4px 0 0 0; }
    .bsc-corner.tr { top: 12px; right: 12px; border-width: 3px 3px 0 0; border-radius: 0 4px 0 0; }
    .bsc-corner.bl { bottom: 12px; left: 12px; border-width: 0 0 3px 3px; border-radius: 0 0 0 4px; }
    .bsc-corner.br { bottom: 12px; right: 12px; border-width: 0 3px 3px 0; border-radius: 0 0 4px 0; }

    .bsc-edge-canvas {
      position: absolute; inset: 0; width: 100%; height: 100%;
      pointer-events: none; opacity: 0.85;
    }

    .bsc-scan-hint {
      text-align: center; font-size: 0.8rem;
      color: var(--text-secondary, #888);
      padding: 0 8px;
    }

    .bsc-scan-controls {
      display: flex; align-items: center; justify-content: center; gap: 20px;
      padding: 8px 0 4px;
    }
    .bsc-shutter {
      width: 68px; height: 68px; border-radius: 50%;
      background: linear-gradient(135deg, #ea580c, #fb923c);
      border: 4px solid white; cursor: pointer;
      box-shadow: 0 4px 20px rgba(234,88,12,0.5);
      transition: transform 0.15s, box-shadow 0.15s;
      display: flex; align-items: center; justify-content: center;
    }
    .bsc-shutter:active { transform: scale(0.9); box-shadow: 0 2px 10px rgba(234,88,12,0.4); }
    .bsc-shutter svg { width: 28px; height: 28px; fill: white; stroke: none; }
    .bsc-flip-btn {
      width: 44px; height: 44px; border-radius: 50%;
      background: rgba(255,255,255,0.15); border: 2px solid rgba(255,255,255,0.3);
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      backdrop-filter: blur(8px); transition: all 0.2s;
      color: var(--text-primary, #0a0a0a);
    }
    .bsc-flip-btn svg { width: 20px; height: 20px; stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .bsc-torch-btn {
      width: 44px; height: 44px; border-radius: 50%;
      background: rgba(255,255,255,0.15); border: 2px solid rgba(255,255,255,0.3);
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      backdrop-filter: blur(8px); transition: all 0.2s;
      color: var(--text-primary, #0a0a0a);
    }
    .bsc-torch-btn.active { background: rgba(251,191,36,0.3); border-color: #fbbf24; }
    .bsc-torch-btn svg { width: 20px; height: 20px; stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

    /* ── PREVIEW / CROP ───────────────────────────────────────── */
    .bsc-preview-view { padding: 12px; display: none; flex-direction: column; gap: 12px; touch-action: none; overscroll-behavior: none; }
    .bsc-preview-view.bsc-active { display: flex; }

    .bsc-preview-frame {
      position: relative; width: 100%; border-radius: 12px; background: #111;
      aspect-ratio: 3/4;
    }
    .bsc-preview-img { width: 100%; height: 100%; object-fit: contain; display: block; border-radius: 12px; }
    .bsc-corner-handle {
      position: absolute; width: 28px; height: 28px;
      background: #ea580c; border-radius: 50%;
      border: 3px solid white; cursor: grab; transform: translate(-50%,-50%);
      box-shadow: 0 2px 10px rgba(0,0,0,0.5); touch-action: none;
      z-index: 10; transition: transform 0.1s;
    }
    .bsc-corner-handle:active { cursor: grabbing; transform: translate(-50%,-50%) scale(1.15); }
    .bsc-crop-canvas {
      position: absolute; inset: 0; width: 100%; height: 100%;
      pointer-events: none; border-radius: 12px;
    }

    /* ── LOUPE MAGNIFIER ─────────────────────────────────────── */
    .bsc-loupe {
      position: fixed;
      width: 110px; height: 110px;
      border-radius: 50%;
      border: 3px solid #ea580c;
      box-shadow: 0 4px 20px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.15);
      overflow: hidden;
      pointer-events: none;
      z-index: 100000;
      display: none;
      background: #000;
    }
    .bsc-loupe.bsc-loupe-visible { display: block; }
    .bsc-loupe canvas { width: 100%; height: 100%; display: block; }
    .bsc-loupe-crosshair {
      position: absolute; inset: 0; pointer-events: none;
    }
    .bsc-loupe-crosshair::before, .bsc-loupe-crosshair::after {
      content: ''; position: absolute; background: rgba(234,88,12,0.9);
    }
    .bsc-loupe-crosshair::before { left: 50%; top: 25%; width: 1.5px; height: 50%; transform: translateX(-50%); }
    .bsc-loupe-crosshair::after  { top: 50%; left: 25%; height: 1.5px; width: 50%; transform: translateY(-50%); }

    .bsc-adjustments {
      display: flex; gap: 8px; overflow-x: auto; padding: 2px 0;
      scrollbar-width: none;
    }
    .bsc-adjustments::-webkit-scrollbar { display: none; }
    .bsc-adj-btn {
      flex-shrink: 0; padding: 8px 14px;
      border: 1.5px solid var(--border, #e5e7eb);
      border-radius: 20px; background: var(--bg-main, #fafafa);
      font-size: 0.78rem; font-weight: 600; cursor: pointer;
      transition: all 0.2s; color: var(--text-primary, #0a0a0a);
      display: flex; align-items: center; gap: 5px;
    }
    .bsc-adj-btn:hover, .bsc-adj-btn.active {
      border-color: var(--accent, #ea580c); color: var(--accent, #ea580c);
      background: var(--card-hover, rgba(234,88,12,0.05));
    }
    .bsc-adj-btn svg { width: 14px; height: 14px; stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

    .bsc-preview-actions {
      display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
    }
    .bsc-btn-outline {
      padding: 12px; border: 1.5px solid var(--border, #e5e7eb);
      border-radius: 10px; background: transparent;
      font-family: inherit; font-size: 0.875rem; font-weight: 600;
      cursor: pointer; transition: all 0.2s; color: var(--text-secondary, #666);
    }
    .bsc-btn-outline:hover { border-color: var(--accent, #ea580c); color: var(--accent, #ea580c); }
    .bsc-btn-primary {
      padding: 12px; border: none;
      border-radius: 10px;
      background: linear-gradient(135deg, #ea580c, #fb923c);
      font-family: inherit; font-size: 0.875rem; font-weight: 700;
      cursor: pointer; transition: all 0.2s; color: white;
    }
    .bsc-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(234,88,12,0.35); }
    .bsc-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

    /* ── QUEUE ────────────────────────────────────────────────── */
    .bsc-queue-view { padding: 12px; display: none; flex-direction: column; gap: 12px; }
    .bsc-queue-view.bsc-active { display: flex; }

    .bsc-queue-list { display: flex; flex-direction: column; gap: 8px; }
    .bsc-queue-item {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 12px;
      background: var(--bg-main, #fafafa);
      border: 1px solid var(--border, #e5e7eb);
      border-radius: 10px;
    }
    .bsc-queue-thumb {
      width: 48px; height: 48px; border-radius: 6px;
      object-fit: cover; background: #ddd; flex-shrink: 0;
    }
    .bsc-queue-info { flex: 1; min-width: 0; }
    .bsc-queue-name {
      font-size: 0.85rem; font-weight: 600;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      max-width: 160px;
    }
    .bsc-queue-meta { font-size: 0.72rem; color: var(--text-secondary, #888); margin-top: 2px; }
    .bsc-queue-rename-input {
      font-size: 0.82rem; font-weight: 600;
      border: 1.5px solid var(--accent, #ea580c);
      border-radius: 6px; padding: 3px 6px;
      background: var(--bg-secondary, #fff);
      color: var(--text-primary, #0a0a0a);
      font-family: inherit; width: 100%; outline: none;
    }
    .bsc-queue-actions-row {
      display: flex; gap: 4px; margin-top: 4px;
    }
    .bsc-queue-action-btn {
      font-size: 0.7rem; font-weight: 600; padding: 3px 8px;
      border-radius: 6px; border: 1px solid var(--border, #e5e7eb);
      background: var(--bg-main, #fafafa); cursor: pointer;
      color: var(--text-secondary, #666); transition: all 0.2s;
      font-family: inherit;
    }
    .bsc-queue-action-btn:hover { border-color: var(--accent, #ea580c); color: var(--accent, #ea580c); }
    .bsc-queue-action-btn.danger:hover { border-color: var(--error, #dc2626); color: var(--error, #dc2626); }
    .bsc-queue-remove {
      background: none; border: none; cursor: pointer;
      color: var(--text-secondary, #888); font-size: 1.2rem;
      padding: 4px; border-radius: 6px; transition: all 0.2s;
      flex-shrink: 0;
    }
    .bsc-queue-remove:hover { color: var(--error, #dc2626); background: var(--error-bg, #fee2e2); }

    .bsc-queue-actions {
      display: grid; grid-template-columns: auto 1fr; gap: 10px;
    }

    /* ── PROGRESS ─────────────────────────────────────────────── */
    .bsc-progress-view { padding: 24px 16px; display: none; flex-direction: column; align-items: center; gap: 16px; text-align: center; }
    .bsc-progress-view.bsc-active { display: flex; }
    .bsc-spinner {
      width: 56px; height: 56px;
      border: 3px solid var(--border, #e5e7eb);
      border-top-color: var(--accent, #ea580c);
      border-radius: 50%;
      animation: bsc-spin 0.7s linear infinite;
    }
    @keyframes bsc-spin { to { transform: rotate(360deg); } }
    .bsc-progress-title { font-size: 1rem; font-weight: 700; color: var(--text-primary, #0a0a0a); }
    .bsc-progress-sub { font-size: 0.85rem; color: var(--text-secondary, #888); }
    .bsc-progress-bar-wrap {
      width: 100%; background: var(--border, #e5e7eb); border-radius: 4px; height: 6px; overflow: hidden;
    }
    .bsc-progress-bar {
      height: 100%; background: linear-gradient(90deg, #ea580c, #fb923c);
      border-radius: 4px; transition: width 0.4s ease; width: 0%;
    }

    /* Hidden inputs */
    .bsc-hidden-input { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
  `;

  // ─── SVG ICONS ─────────────────────────────────────────────────────────────
  const ICONS = {
    camera: `<svg viewBox="0 0 24 24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
    scan: `<svg viewBox="0 0 24 24"><rect x="2" y="2" width="7" height="7" rx="1"/><rect x="15" y="2" width="7" height="7" rx="1"/><rect x="2" y="15" width="7" height="7" rx="1"/><rect x="15" y="15" width="7" height="7" rx="1"/><line x1="12" y1="6" x2="12" y2="18"/><line x1="6" y1="12" x2="18" y2="12"/></svg>`,
    photo: `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
    file: `<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
    flip: `<svg viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>`,
    torch: `<svg viewBox="0 0 24 24"><path d="M18 6l-6 6"/><path d="M6.5 12.5l-3-3L12 1l3 3-3.5 3.5"/><path d="M10 14L3 21"/><path d="M20 4l-3.5 3.5"/><rect x="12" y="12" width="4" height="8" rx="1" transform="rotate(45 14 16)"/></svg>`,
    shutter: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/></svg>`,
    rotate: `<svg viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/></svg>`,
    contrast: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 2v20M2 12h20" opacity="0.3"/><path d="M12 2a10 10 0 0 1 0 20z" fill="currentColor" stroke="none"/></svg>`,
    brightness: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`,
    grayscale: `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 12h18" opacity="0.5"/><rect x="3" y="3" width="9" height="18" fill="currentColor" opacity="0.2"/></svg>`,
    plus: `<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  };

  // ─── MAIN CLASS ────────────────────────────────────────────────────────────
  class BromarScanner {
    constructor(options = {}) {
      this.options = {
        supabase: null,
        bucket: 'job-sheet-files',
        outputFormat: 'pdf', // 'pdf' | 'images' | 'both'
        maxFiles: 20,
        pdfQuality: 0.88,
        ...options
      };

      this._queue = [];       // { id, blob, dataUrl, name, processed }
      this._stream = null;
      this._facingMode = 'environment';
      this._torch = false;
      this._capturedImageData = null;
      this._cropPoints = null;
      this._currentFilter = 'none';
      this._view = 'sources';
      this._onComplete = null;
      this._el = null;
      this._edgeDetectTimer = null;

      this._injectStyles();
      this._buildDOM();
    }

    // ── PUBLIC API ────────────────────────────────────────────────────────────
    open({ onComplete } = {}) {
      this._onComplete = onComplete || null;
      this._show();
    }

    attachTo(selectorOrEl, { onComplete } = {}) {
      const el = typeof selectorOrEl === 'string'
        ? document.querySelector(selectorOrEl)
        : selectorOrEl;
      if (!el) return;

      this._onComplete = onComplete || null;

      // Replace inner content with scanner trigger buttons
      const origContent = el.innerHTML;
      el.style.cursor = 'default';

      const row = document.createElement('div');
      row.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;justify-content:center;padding:8px 0;';

      const btns = [
        { icon: ICONS.photo, label: 'Photo Library', action: () => { this._show(); this._triggerPhotoLibrary(); } },
        { icon: ICONS.camera, label: 'Take Photo', action: () => { this._show(); this._showScanView(); } },
        { icon: ICONS.scan, label: 'Scan Document', action: () => { this._show(); this._showScanView(true); } },
        { icon: ICONS.file, label: 'Browse Files', action: () => { this._show(); this._triggerFilePicker(); } },
      ];

      btns.forEach(b => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.style.cssText = `
          display:flex;align-items:center;gap:6px;padding:8px 14px;
          border:1.5px solid var(--border,#e5e7eb);border-radius:20px;
          background:var(--bg-secondary,#fff);font-family:inherit;
          font-size:0.8rem;font-weight:600;cursor:pointer;
          color:var(--text-primary,#0a0a0a);transition:all 0.2s;
        `;
        btn.innerHTML = `<span style="width:15px;height:15px;display:inline-flex;stroke:var(--accent,#ea580c)">${b.icon}</span>${b.label}`;
        btn.addEventListener('mouseover', () => { btn.style.borderColor = 'var(--accent,#ea580c)'; btn.style.color = 'var(--accent,#ea580c)'; });
        btn.addEventListener('mouseout', () => { btn.style.borderColor = 'var(--border,#e5e7eb)'; btn.style.color = 'var(--text-primary,#0a0a0a)'; });
        btn.addEventListener('click', b.action);
        row.appendChild(btn);
      });

      // Keep original upload area click working but add our row below
      el.appendChild(row);

      // Hidden file input for "browse" fallback already handled via _filePicker in _buildDOM
    }

    // ── PRIVATE: STYLES & DOM ─────────────────────────────────────────────────
    _injectStyles() {
      if (document.getElementById('bsc-styles')) return;
      const style = document.createElement('style');
      style.id = 'bsc-styles';
      style.textContent = STYLES;
      document.head.appendChild(style);
    }

    _buildDOM() {
      // Root overlay
      this._el = document.createElement('div');
      this._el.className = 'bsc-overlay';
      this._el.setAttribute('role', 'dialog');
      this._el.setAttribute('aria-modal', 'true');

      this._el.innerHTML = `
        <div class="bsc-sheet">
          <div class="bsc-handle"></div>
          <div class="bsc-header">
            <span class="bsc-title">Add Document</span>
            <button class="bsc-close" aria-label="Close">✕</button>
          </div>
          <div class="bsc-body">

            <!-- SOURCE PICKER -->
            <div class="bsc-sources bsc-view" data-view="sources">
              <button class="bsc-source-btn" data-action="photo-library">
                ${ICONS.photo}
                <span class="bsc-source-label">Photo Library</span>
                <span class="bsc-source-sub">Choose from gallery</span>
              </button>
              <button class="bsc-source-btn" data-action="camera">
                ${ICONS.camera}
                <span class="bsc-source-label">Take Photo</span>
                <span class="bsc-source-sub">Use camera</span>
              </button>
              <button class="bsc-source-btn" data-action="scan">
                ${ICONS.scan}
                <span class="bsc-source-label">Scan Document</span>
                <span class="bsc-source-sub">Auto edge detect</span>
              </button>
              <button class="bsc-source-btn" data-action="files">
                ${ICONS.file}
                <span class="bsc-source-label">Browse Files</span>
                <span class="bsc-source-sub">PDF, Word, any file</span>
              </button>
            </div>

            <!-- CAMERA / SCAN VIEW -->
            <div class="bsc-scan-view bsc-view" data-view="scan">
              <div class="bsc-viewfinder">
                <video class="bsc-video" autoplay playsinline muted></video>
                <canvas class="bsc-edge-canvas"></canvas>
                <div class="bsc-corner tl"></div>
                <div class="bsc-corner tr"></div>
                <div class="bsc-corner bl"></div>
                <div class="bsc-corner br"></div>
              </div>
              <p class="bsc-scan-hint">Position document in frame — edges will be highlighted automatically</p>
              <div class="bsc-scan-controls">
                <button class="bsc-torch-btn" data-action="torch" title="Torch">${ICONS.torch}</button>
                <button class="bsc-shutter" data-action="capture">${ICONS.shutter}</button>
                <button class="bsc-flip-btn" data-action="flip" title="Flip camera">${ICONS.flip}</button>
              </div>
            </div>

            <!-- PREVIEW / CROP VIEW -->
            <div class="bsc-preview-view bsc-view" data-view="preview">
              <div class="bsc-preview-frame">
                <img class="bsc-preview-img" alt="Captured"/>
                <canvas class="bsc-crop-canvas"></canvas>
                <!-- Corner handles injected by JS -->
              </div>
              <div class="bsc-adjustments">
                <button class="bsc-adj-btn" data-filter="none">${ICONS.brightness} Original</button>
                <button class="bsc-adj-btn" data-filter="auto">${ICONS.brightness} Auto Enhance</button>
                <button class="bsc-adj-btn" data-filter="grayscale">${ICONS.grayscale} Grayscale</button>
                <button class="bsc-adj-btn" data-filter="bw">${ICONS.contrast} B&amp;W</button>
                <button class="bsc-adj-btn" data-filter="brighten">${ICONS.brightness} Brighten</button>
              </div>
              <div class="bsc-preview-actions">
                <button class="bsc-btn-outline" data-action="retake">${ICONS.camera} Retake</button>
                <button class="bsc-btn-primary" data-action="use-image">Use Image →</button>
              </div>
            </div>

            <!-- QUEUE VIEW -->
            <div class="bsc-queue-view bsc-view" data-view="queue">
              <div class="bsc-queue-list"></div>
              <div class="bsc-queue-actions">
                <button class="bsc-btn-outline" data-action="add-more">${ICONS.plus} Add More</button>
                <button class="bsc-btn-primary" data-action="process">
                  Convert &amp; Upload →
                </button>
              </div>
            </div>

            <!-- PROGRESS VIEW -->
            <div class="bsc-progress-view bsc-view" data-view="progress">
              <div class="bsc-spinner"></div>
              <div class="bsc-progress-title">Processing...</div>
              <div class="bsc-progress-sub">Please wait</div>
              <div class="bsc-progress-bar-wrap">
                <div class="bsc-progress-bar"></div>
              </div>
            </div>

          </div>

          <!-- Hidden file inputs -->
          <input type="file" class="bsc-hidden-input" id="bsc-photo-input" accept="image/*" multiple/>
          <input type="file" class="bsc-hidden-input" id="bsc-file-input" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" multiple/>
        </div>
      `;

      // Loupe lives outside the sheet so it is never clipped by overflow
      this._loupeEl = document.createElement('div');
      this._loupeEl.className = 'bsc-loupe';
      this._loupeEl.innerHTML = '<canvas></canvas><div class=\"bsc-loupe-crosshair\"></div>';
      document.body.appendChild(this._loupeEl);

      document.body.appendChild(this._el);
      this._bindEvents();
    }

    _bindEvents() {
      const el = this._el;

      // Close
      el.querySelector('.bsc-close').addEventListener('click', () => this._close());
      el.addEventListener('click', (e) => { if (e.target === el) this._close(); });

      // Source buttons
      el.querySelector('[data-action="photo-library"]').addEventListener('click', () => this._triggerPhotoLibrary());
      el.querySelector('[data-action="camera"]').addEventListener('click', () => this._showScanView(false));
      el.querySelector('[data-action="scan"]').addEventListener('click', () => this._showScanView(true));
      el.querySelector('[data-action="files"]').addEventListener('click', () => this._triggerFilePicker());

      // Scan controls
      el.querySelector('[data-action="capture"]').addEventListener('click', () => this._capture());
      el.querySelector('[data-action="flip"]').addEventListener('click', () => this._flipCamera());
      el.querySelector('[data-action="torch"]').addEventListener('click', () => this._toggleTorch());

      // Preview controls
      el.querySelector('[data-action="retake"]').addEventListener('click', () => this._showScanView(this._scanMode));
      el.querySelector('[data-action="use-image"]').addEventListener('click', () => this._useCurrentImage());

      // Filters
      el.querySelectorAll('[data-filter]').forEach(btn => {
        btn.addEventListener('click', () => {
          this._currentFilter = btn.dataset.filter;
          el.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this._applyFilter();
        });
      });

      // Queue controls
      el.querySelector('[data-action="add-more"]').addEventListener('click', () => this._goToView('sources'));
      el.querySelector('[data-action="process"]').addEventListener('click', () => this._processQueue());

      // File inputs
      el.querySelector('#bsc-photo-input').addEventListener('change', (e) => this._handleFileInput(e.target.files, 'image'));
      el.querySelector('#bsc-file-input').addEventListener('change', (e) => this._handleFileInput(e.target.files, 'file'));

      // Keyboard
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this._el.classList.contains('bsc-visible')) this._close(); });
    }

    // ── NAVIGATION ─────────────────────────────────────────────────────────────
    _goToView(viewName) {
      this._view = viewName;
      this._el.querySelectorAll('.bsc-view').forEach(v => {
        v.classList.toggle('bsc-active', v.dataset.view === viewName);
      });
      // Show sources (grid layout needs different CSS class to fire)
      const sources = this._el.querySelector('[data-view="sources"]');
      if (viewName !== 'sources') {
        sources.style.display = 'none';
      } else {
        sources.style.display = '';
      }
    }

    // ── SHOW / CLOSE ───────────────────────────────────────────────────────────
    _show() {
      this._el.style.display = 'flex';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => this._el.classList.add('bsc-visible'));
      });
      this._goToView('sources');

      // Lock body scroll and block iOS/Android swipe-back while scanner is open
      this._prevBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overscrollBehavior = 'none';

      // Block touchmove on the overlay itself (prevents browser chrome gestures).
      // We allow scrolling inside .bsc-body only.
      this._overlayTouchMove = (e) => {
        const bscBody = this._el.querySelector('.bsc-body');
        if (bscBody && bscBody.contains(e.target)) return;
        e.preventDefault();
      };
      this._el.addEventListener('touchmove', this._overlayTouchMove, { passive: false });
    }

    _close() {
      this._el.classList.remove('bsc-visible');
      if (this._loupeEl) this._loupeEl.classList.remove('bsc-loupe-visible');

      // Restore scroll behaviour
      document.body.style.overflow = this._prevBodyOverflow || '';
      document.documentElement.style.overscrollBehavior = '';
      if (this._overlayTouchMove) {
        this._el.removeEventListener('touchmove', this._overlayTouchMove);
        this._overlayTouchMove = null;
      }

      setTimeout(() => {
        this._el.style.display = 'none';
        this._stopCamera();
      }, 350);
    }

    // ── FILE LIBRARY / PICKER ──────────────────────────────────────────────────
    _triggerPhotoLibrary() {
      const input = this._el.querySelector('#bsc-photo-input');
      input.removeAttribute('capture');
      input.click();
    }

    _triggerFilePicker() {
      this._el.querySelector('#bsc-file-input').click();
    }

    async _handleFileInput(files, type) {
      for (const file of Array.from(files)) {
        if (file.size > 50 * 1024 * 1024) { alert(`${file.name} is too large (max 50MB)`); continue; }

        const id = `f_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        let dataUrl = null;

        if (file.type.startsWith('image/')) {
          dataUrl = await this._fileToDataUrl(file);
        } else {
          // PDF/doc etc – create a placeholder icon dataUrl
          dataUrl = this._fileIconDataUrl(file.name);
        }

        this._queue.push({
          id, blob: file, dataUrl,
          name: file.name,
          size: file.size,
          type: file.type,
          processed: true // no crop needed for library picks
        });
      }

      this._goToView('queue');
      this._renderQueue();
    }

    _fileToDataUrl(file) {
      return new Promise(resolve => {
        const r = new FileReader();
        r.onload = e => resolve(e.target.result);
        r.readAsDataURL(file);
      });
    }

    _fileIconDataUrl(name) {
      const ext = name.split('.').pop().toUpperCase().slice(0, 4);
      const c = document.createElement('canvas');
      c.width = 120; c.height = 160;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(0, 0, 120, 160);
      ctx.fillStyle = '#ea580c';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(ext, 60, 90);
      return c.toDataURL();
    }

    // ── CAMERA ─────────────────────────────────────────────────────────────────
    async _showScanView(scanMode = false) {
      this._scanMode = scanMode;
      this._goToView('scan');
      // Block browser navigation gestures while in scan/crop view
      document.documentElement.style.overscrollBehaviorX = 'none';
      await this._startCamera();
      if (scanMode) this._startEdgeDetection();
    }

    async _startCamera() {
      this._stopCamera();
      const video = this._el.querySelector('.bsc-video');
      try {
        this._stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: this._facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false
        });
        video.srcObject = this._stream;
        await video.play();
      } catch (err) {
        alert('Camera access denied or unavailable. Please use "Photo Library" or "Browse Files" instead.');
        this._goToView('sources');
      }
    }

    _stopCamera() {
      if (this._stream) {
        this._stream.getTracks().forEach(t => t.stop());
        this._stream = null;
      }
      if (this._edgeDetectTimer) {
        clearInterval(this._edgeDetectTimer);
        this._edgeDetectTimer = null;
      }
    }

    async _flipCamera() {
      this._facingMode = this._facingMode === 'environment' ? 'user' : 'environment';
      await this._startCamera();
    }

    async _toggleTorch() {
      if (!this._stream) return;
      const track = this._stream.getVideoTracks()[0];
      if (!track) return;
      try {
        this._torch = !this._torch;
        await track.applyConstraints({ advanced: [{ torch: this._torch }] });
        this._el.querySelector('[data-action="torch"]').classList.toggle('active', this._torch);
      } catch (e) { /* torch not supported */ }
    }

    // ── EDGE / DOCUMENT DETECTION ─────────────────────────────────────────────
    // Approach: scan rows and columns for the largest luminance jump.
    // Phone cameras pointing at a document on a desk produce a very clear
    // bright rectangle on a darker background (or vice-versa). We find the
    // four inward-most scanlines that cross a strong contrast threshold and
    // use those as the document boundary. No Sobel needed.
    _startEdgeDetection() {
      const video  = this._el.querySelector('.bsc-video');
      const canvas = this._el.querySelector('.bsc-edge-canvas');
      // Work at ~20% res — enough for boundary detection, fast on mobile
      const SCALE = 0.18;

      let smoothQuad = null;
      const SMOOTH = 0.3;
      let stableFrames = 0;

      this._edgeDetectTimer = setInterval(() => {
        if (!video.videoWidth) return;

        const vw = video.videoWidth, vh = video.videoHeight;
        const sw = Math.max(60, Math.round(vw * SCALE));
        const sh = Math.max(80, Math.round(vh * SCALE));
        const dispW = video.clientWidth  || 300;
        const dispH = video.clientHeight || 400;

        canvas.width  = dispW;
        canvas.height = dispH;
        this._lastEdgeCanvasW = dispW;
        this._lastEdgeCanvasH = dispH;

        // Downsample
        const off = document.createElement('canvas');
        off.width = sw; off.height = sh;
        const octx = off.getContext('2d');
        octx.drawImage(video, 0, 0, sw, sh);
        const { data } = octx.getImageData(0, 0, sw, sh);

        // Build luminance grid
        const lum = new Float32Array(sw * sh);
        for (let i = 0; i < sw * sh; i++) {
          lum[i] = 0.299*data[i*4] + 0.587*data[i*4+1] + 0.114*data[i*4+2];
        }

        // ── Helper: get median luminance of a strip ──────────────────────────
        const stripMedian = (vals) => {
          const s = vals.slice().sort((a,b)=>a-b);
          return s[Math.floor(s.length/2)];
        };

        // ── Scan rows for top/bottom boundary ───────────────────────────────
        // For each row compute mean luminance; find the transition rows where
        // luminance changes significantly from the global median.
        const rowMeans = new Float32Array(sh);
        for (let y = 0; y < sh; y++) {
          let s = 0;
          // sample every 2 pixels for speed
          for (let x = 0; x < sw; x += 2) s += lum[y*sw+x];
          rowMeans[y] = s / (sw/2);
        }
        const colMeans = new Float32Array(sw);
        for (let x = 0; x < sw; x++) {
          let s = 0;
          for (let y = 0; y < sh; y += 2) s += lum[y*sw+x];
          colMeans[x] = s / (sh/2);
        }

        const globalMedian = stripMedian(Array.from(rowMeans));
        // Contrast threshold: at least 18 luminance units difference from global median
        const CONTRAST = 18;

        // Find bounding rows/cols that differ from the background
        // We assume background = median of the outer 15% of the frame
        const outerRows = [...Array.from(rowMeans).slice(0, Math.round(sh*0.12)),
                           ...Array.from(rowMeans).slice(Math.round(sh*0.88))];
        const outerCols = [...Array.from(colMeans).slice(0, Math.round(sw*0.12)),
                           ...Array.from(colMeans).slice(Math.round(sw*0.88))];
        const bgLum = stripMedian([...outerRows, ...outerCols]);

        // Document is brighter or darker than background
        const docIsBrighter = globalMedian > bgLum + CONTRAST/2;
        const threshold = docIsBrighter ? bgLum + CONTRAST : bgLum - CONTRAST;

        const rowTest  = (v) => docIsBrighter ? v > threshold : v < threshold;
        const colTest  = (v) => docIsBrighter ? v > threshold : v < threshold;

        // Shrink from each edge until we hit the document
        const skipFrac = 0.05; // ignore outermost 5% (often over-exposed)
        const skipRows = Math.round(sh * skipFrac);
        const skipCols = Math.round(sw * skipFrac);

        let top = -1, bottom = -1, left = -1, right = -1;

        for (let y = skipRows; y < sh - skipRows; y++) {
          if (rowTest(rowMeans[y])) { top = y; break; }
        }
        for (let y = sh - skipRows - 1; y >= skipRows; y--) {
          if (rowTest(rowMeans[y])) { bottom = y; break; }
        }
        for (let x = skipCols; x < sw - skipCols; x++) {
          if (colTest(colMeans[x])) { left = x; break; }
        }
        for (let x = sw - skipCols - 1; x >= skipCols; x--) {
          if (colTest(colMeans[x])) { right = x; break; }
        }

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, dispW, dispH);

        // Validate: document must cover at least 20% of frame in each dimension
        const minW = sw * 0.20, minH = sh * 0.20;
        if (top < 0 || bottom < 0 || left < 0 || right < 0
            || (right - left) < minW || (bottom - top) < minH) {
          smoothQuad = null;
          this._detectedQuad = null;
          stableFrames = 0;
          return;
        }

        // Map boundary to display coords
        const sx = dispW / sw, sy = dispH / sh;
        const rawQuad = [
          { x: left  * sx, y: top    * sy }, // TL
          { x: right * sx, y: top    * sy }, // TR
          { x: right * sx, y: bottom * sy }, // BR
          { x: left  * sx, y: bottom * sy }, // BL
        ];

        // Exponential smoothing
        if (!smoothQuad) {
          smoothQuad = rawQuad.map(p => ({...p}));
        } else {
          smoothQuad = smoothQuad.map((sp, i) => ({
            x: sp.x + SMOOTH*(rawQuad[i].x - sp.x),
            y: sp.y + SMOOTH*(rawQuad[i].y - sp.y),
          }));
        }

        stableFrames++;
        this._detectedQuad = smoothQuad.map(p => ({...p}));

        // Draw overlay — green when stable (3+ frames), orange while converging
        const stable = stableFrames >= 3;
        const color  = stable ? '#22c55e' : '#ea580c';
        const pts    = smoothQuad;

        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        pts.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.closePath();
        ctx.fillStyle = stable ? 'rgba(34,197,94,0.15)' : 'rgba(234,88,12,0.1)';
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Corner dots + L-shaped brackets
        pts.forEach((p, i) => {
          const bracketLen = 14;
          const dx = (i === 0 || i === 3) ? bracketLen : -bracketLen;
          const dy = (i === 0 || i === 1) ? bracketLen : -bracketLen;
          ctx.beginPath();
          ctx.moveTo(p.x + dx, p.y);
          ctx.lineTo(p.x, p.y);
          ctx.lineTo(p.x, p.y + dy);
          ctx.strokeStyle = color;
          ctx.lineWidth = 3;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(p.x, p.y, 5, 0, Math.PI*2);
          ctx.fillStyle = color;
          ctx.fill();
        });

        // Show "captured" flash when stable
        if (stable && stableFrames === 3) {
          const hint = this._el.querySelector('.bsc-scan-hint');
          if (hint) {
            hint.style.color = '#22c55e';
            hint.textContent = '✓ Document detected — tap shutter to capture';
            setTimeout(() => {
              if (hint) { hint.style.color = ''; hint.textContent = 'Position document in frame — edges will be highlighted automatically'; }
            }, 2500);
          }
        }

      }, 120);
    }
    // ── CAPTURE ────────────────────────────────────────────────────────────────
    _capture() {
      const video = this._el.querySelector('.bsc-video');
      if (!video.videoWidth) return;

      const canvas = document.createElement('canvas');
      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);

      this._capturedImageData = canvas.toDataURL('image/jpeg', 0.95);
      // Store detected quad (in video display coords) to pre-fill crop handles
      this._autoQuad = this._detectedQuad || null;
      this._detectedQuad = null;
      this._stopCamera();
      this._showPreview(this._capturedImageData);
    }

    // ── PREVIEW & CROP ─────────────────────────────────────────────────────────
    _showPreview(dataUrl) {
      this._currentFilter = 'none';
      this._el.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
      this._el.querySelector('[data-filter="none"]').classList.add('active');

      const img = this._el.querySelector('.bsc-preview-img');
      img.src = dataUrl;
      this._goToView('preview');

      img.onload = () => {
        this._setupCropHandles();
      };
    }

    _setupCropHandles() {
      const frame = this._el.querySelector('.bsc-preview-frame');
      frame.querySelectorAll('.bsc-corner-handle').forEach(h => h.remove());

      const W = frame.clientWidth;
      const H = frame.clientHeight;
      const m = 2;

      // If we have a detected quad from the viewfinder, map it into preview frame coords.
      // The edge canvas matched the video's display rect; the preview frame has the same
      // aspect ratio (both are 3/4) but a different pixel size. We also need to account
      // for the fact the image uses object-fit:contain inside the preview frame, so we
      // map through the image's rendered rect rather than the raw frame rect.
      if (this._autoQuad && this._autoQuad.length === 4) {
        // The quad was in video-display coords (edge canvas = video display size).
        // The preview frame is W×H; image is object-fit:contain inside it.
        const srcImg   = this._el.querySelector('.bsc-preview-img');
        const naturalW = srcImg.naturalWidth  || 1;
        const naturalH = srcImg.naturalHeight || 1;
        const imgAspect   = naturalW / naturalH;
        const frameAspect = W / H;
        let rendW, rendH, offX, offY;
        if (imgAspect > frameAspect) {
          rendW = W; rendH = W / imgAspect; offX = 0; offY = (H - rendH) / 2;
        } else {
          rendH = H; rendW = H * imgAspect; offX = (W - rendW) / 2; offY = 0;
        }

        // The edge canvas was sized to video.clientWidth × video.clientHeight.
        // We stored the quad in those display px. The video display is also 3/4
        // aspect and fills its container, so we can treat the quad as normalised
        // fractions of the video display rect and re-apply to the rendered image rect.
        const edgeCanvasW = this._lastEdgeCanvasW || W;
        const edgeCanvasH = this._lastEdgeCanvasH || H;

        this._cropPoints = this._autoQuad.map(p => ({
          x: Math.max(0, Math.min(W, offX + (p.x / edgeCanvasW) * rendW)),
          y: Math.max(0, Math.min(H, offY + (p.y / edgeCanvasH) * rendH))
        }));
        this._autoQuad = null;
      } else {
        this._cropPoints = [
          { x: m,     y: m     }, // TL
          { x: W - m, y: m     }, // TR
          { x: W - m, y: H - m }, // BR
          { x: m,     y: H - m }, // BL
        ];
      }

      // Cache the full-resolution source image for the loupe
      const srcImg = this._el.querySelector('.bsc-preview-img');

      const showLoupe = (clientX, clientY, pt) => {
        const loupe = this._loupeEl;
        const loupeSize = 110;
        const zoom = 3.5;

        // Position loupe above-left of finger (so finger doesn't block it)
        const offset = 70;
        let lx = clientX - offset - loupeSize;
        let ly = clientY - offset - loupeSize;
        // Keep on screen
        lx = Math.max(8, Math.min(window.innerWidth - loupeSize - 8, lx));
        ly = Math.max(8, Math.min(window.innerHeight - loupeSize - 8, ly));

        loupe.style.left = lx + 'px';
        loupe.style.top  = ly + 'px';
        loupe.classList.add('bsc-loupe-visible');

        // Draw zoomed region onto loupe canvas
        const loupeCanvas = loupe.querySelector('canvas');
        loupeCanvas.width  = loupeSize;
        loupeCanvas.height = loupeSize;
        const ctx = loupeCanvas.getContext('2d');

        // Map handle position (frame coords) → source image coords
        const frameRect = frame.getBoundingClientRect();
        const naturalW = srcImg.naturalWidth  || srcImg.width;
        const naturalH = srcImg.naturalHeight || srcImg.height;

        // The img uses object-fit:contain — compute rendered size/offset within frame
        const frameAspect = frameRect.width / frameRect.height;
        const imgAspect   = naturalW / naturalH;
        let rendW, rendH, offX, offY;
        if (imgAspect > frameAspect) {
          rendW = frameRect.width;
          rendH = frameRect.width / imgAspect;
          offX  = 0;
          offY  = (frameRect.height - rendH) / 2;
        } else {
          rendH = frameRect.height;
          rendW = frameRect.height * imgAspect;
          offX  = (frameRect.width - rendW) / 2;
          offY  = 0;
        }

        // pt is in frame coords → map to source image coords
        const imgX = ((pt.x - offX) / rendW) * naturalW;
        const imgY = ((pt.y - offY) / rendH) * naturalH;

        // Region of source image to show (in source px, centred on imgX/imgY)
        const regionW = loupeSize / zoom;
        const regionH = loupeSize / zoom;
        const sx = imgX - regionW / 2;
        const sy = imgY - regionH / 2;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(srcImg, sx, sy, regionW, regionH, 0, 0, loupeSize, loupeSize);
      };

      const hideLoupe = () => {
        this._loupeEl.classList.remove('bsc-loupe-visible');
      };

      this._cropPoints.forEach((pt) => {
        const handle = document.createElement('div');
        handle.className = 'bsc-corner-handle';
        handle.style.left = pt.x + 'px';
        handle.style.top  = pt.y + 'px';
        frame.appendChild(handle);

        let dragging = false, startX, startY;

        const onStart = (e) => {
          dragging = true;
          e.preventDefault(); // critical: stops browser swipe-back gesture
          e.stopPropagation();
          startX = e.clientX - pt.x;
          startY = e.clientY - pt.y;
          handle.setPointerCapture(e.pointerId); // lock pointer to this handle
          showLoupe(e.clientX, e.clientY, pt);
        };

        const onMove = (e) => {
          if (!dragging) return;
          e.preventDefault();
          pt.x = Math.max(0, Math.min(W, e.clientX - startX));
          pt.y = Math.max(0, Math.min(H, e.clientY - startY));
          handle.style.left = pt.x + 'px';
          handle.style.top  = pt.y + 'px';
          this._drawCropOverlay();
          showLoupe(e.clientX, e.clientY, pt);
        };

        const onEnd = (e) => {
          if (!dragging) return;
          dragging = false;
          hideLoupe();
        };

        // Use the handle itself for all pointer events (setPointerCapture keeps them here)
        handle.addEventListener('pointerdown',   onStart, { passive: false });
        handle.addEventListener('pointermove',   onMove,  { passive: false });
        handle.addEventListener('pointerup',     onEnd);
        handle.addEventListener('pointercancel', onEnd);
      });

      this._drawCropOverlay();
    }

    _drawCropOverlay() {
      const canvas = this._el.querySelector('.bsc-crop-canvas');
      const frame = this._el.querySelector('.bsc-preview-frame');
      canvas.width = frame.clientWidth;
      canvas.height = frame.clientHeight;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!this._cropPoints) return;
      const pts = this._cropPoints;

      // Dim outside
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Clear crop region
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      ctx.lineTo(pts[1].x, pts[1].y);
      ctx.lineTo(pts[2].x, pts[2].y);
      ctx.lineTo(pts[3].x, pts[3].y);
      ctx.closePath();
      ctx.clip();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();

      // Border
      ctx.strokeStyle = '#ea580c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      pts.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.closePath();
      ctx.stroke();
    }

    _applyFilter() {
      const img = this._el.querySelector('.bsc-preview-img');
      const filters = {
        none: '',
        auto: 'contrast(1.15) saturate(1.05) brightness(1.05)',
        grayscale: 'grayscale(1) contrast(1.1)',
        bw: 'grayscale(1) contrast(2) brightness(1.1)',
        brighten: 'brightness(1.25) contrast(1.05)',
      };
      img.style.filter = filters[this._currentFilter] || '';
    }

    async _useCurrentImage() {
      // Perform perspective correction + deskew
      const processedBlob = await this._perspectiveCorrect(
        this._capturedImageData,
        this._cropPoints,
        this._currentFilter
      );

      const id = `c_${Date.now()}`;
      const dataUrl = await this._blobToDataUrl(processedBlob);
      this._queue.push({
        id,
        blob: processedBlob,
        dataUrl,
        name: `scan_${Date.now()}.jpg`,
        size: processedBlob.size,
        type: 'image/jpeg',
        processed: true
      });

      this._goToView('queue');
      this._renderQueue();
    }

    // ── PERSPECTIVE CORRECTION ─────────────────────────────────────────────────
    async _perspectiveCorrect(dataUrl, cropPoints, filter) {
      return new Promise(resolve => {
        const img = new Image();
        img.onload = () => {
          const frame = this._el.querySelector('.bsc-preview-frame');
          const frameW = frame.clientWidth;
          const frameH = frame.clientHeight;

          // Map crop points from display coords to image coords
          const scaleX = img.width / frameW;
          const scaleY = img.height / frameH;

          const srcPts = cropPoints.map(p => ({
            x: p.x * scaleX,
            y: p.y * scaleY
          }));

          // Target: A4-ish rectangle, max 2480px wide
          const outW = Math.min(2480, Math.round(Math.max(
            this._dist(srcPts[0], srcPts[1]),
            this._dist(srcPts[3], srcPts[2])
          )));
          const outH = Math.min(3508, Math.round(Math.max(
            this._dist(srcPts[0], srcPts[3]),
            this._dist(srcPts[1], srcPts[2])
          )));

          const dst = document.createElement('canvas');
          dst.width = outW;
          dst.height = outH;
          const ctx = dst.getContext('2d');

          // Apply perspective transform via bilinear mapping
          this._perspectiveTransform(ctx, img, srcPts, outW, outH);

          // Apply filter
          if (filter && filter !== 'none') {
            const filters = {
              auto: { contrast: 1.15, brightness: 1.05 },
              grayscale: { grayscale: true, contrast: 1.1 },
              bw: { grayscale: true, contrast: 2, brightness: 1.1 },
              brighten: { brightness: 1.25, contrast: 1.05 }
            };
            const f = filters[filter];
            if (f) this._applyCanvasFilter(ctx, dst, f);
          }

          dst.toBlob(blob => resolve(blob), 'image/jpeg', 0.92);
        };
        img.src = dataUrl;
      });
    }

    _perspectiveTransform(ctx, img, srcPts, outW, outH) {
      // Simple bilinear interpolation for perspective correction
      // For each output pixel, compute corresponding source pixel
      const tmpCanvas = document.createElement('canvas');
      tmpCanvas.width = img.width;
      tmpCanvas.height = img.height;
      const tmpCtx = tmpCanvas.getContext('2d');
      tmpCtx.drawImage(img, 0, 0);
      const srcData = tmpCtx.getImageData(0, 0, img.width, img.height);

      const outData = ctx.createImageData(outW, outH);

      const [tl, tr, br, bl] = srcPts;

      for (let y = 0; y < outH; y++) {
        const v = y / outH;
        for (let x = 0; x < outW; x++) {
          const u = x / outW;

          // Bilinear interpolation
          const srcX = (1 - u) * ((1 - v) * tl.x + v * bl.x) + u * ((1 - v) * tr.x + v * br.x);
          const srcY = (1 - u) * ((1 - v) * tl.y + v * bl.y) + u * ((1 - v) * tr.y + v * br.y);

          const sx = Math.round(srcX);
          const sy = Math.round(srcY);

          if (sx < 0 || sx >= img.width || sy < 0 || sy >= img.height) continue;

          const srcIdx = (sy * img.width + sx) * 4;
          const dstIdx = (y * outW + x) * 4;
          outData.data[dstIdx]     = srcData.data[srcIdx];
          outData.data[dstIdx + 1] = srcData.data[srcIdx + 1];
          outData.data[dstIdx + 2] = srcData.data[srcIdx + 2];
          outData.data[dstIdx + 3] = 255;
        }
      }

      ctx.putImageData(outData, 0, 0);
    }

    _applyCanvasFilter(ctx, canvas, opts) {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imgData.data;

      for (let i = 0; i < d.length; i += 4) {
        let r = d[i], g = d[i + 1], b = d[i + 2];

        if (opts.grayscale) {
          const gray = 0.299 * r + 0.587 * g + 0.114 * b;
          r = g = b = gray;
        }
        if (opts.brightness) {
          r *= opts.brightness; g *= opts.brightness; b *= opts.brightness;
        }
        if (opts.contrast) {
          const f = opts.contrast;
          r = f * (r - 128) + 128;
          g = f * (g - 128) + 128;
          b = f * (b - 128) + 128;
        }

        d[i]     = Math.max(0, Math.min(255, r));
        d[i + 1] = Math.max(0, Math.min(255, g));
        d[i + 2] = Math.max(0, Math.min(255, b));
      }

      ctx.putImageData(imgData, 0, 0);
    }

    _dist(a, b) {
      return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
    }

    // ── QUEUE ──────────────────────────────────────────────────────────────────
    _renderQueue() {
      const list = this._el.querySelector('.bsc-queue-list');
      list.innerHTML = '';

      if (this._queue.length === 0) {
        list.innerHTML = '<p style="text-align:center;color:var(--text-secondary,#888);font-size:0.85rem;padding:16px 0;">No items — add something above</p>';
        this._el.querySelector('[data-action="process"]').textContent = 'Convert to PDF & Upload →';
        return;
      }

      this._queue.forEach(item => {
        const div = document.createElement('div');
        div.className = 'bsc-queue-item';
        div.style.flexDirection = 'column';
        div.style.alignItems = 'stretch';
        div.style.gap = '8px';

        // Top row: thumb + name/meta + remove
        const topRow = document.createElement('div');
        topRow.style.cssText = 'display:flex;align-items:center;gap:10px;width:100%;';

        const thumb = document.createElement('img');
        thumb.className = 'bsc-queue-thumb';
        thumb.src = item.dataUrl;
        thumb.alt = item.name;

        const info = document.createElement('div');
        info.className = 'bsc-queue-info';
        info.style.flex = '1';
        info.style.minWidth = '0';

        const nameEl = document.createElement('div');
        nameEl.className = 'bsc-queue-name';
        nameEl.textContent = item.name;
        nameEl.title = item.name;

        const metaEl = document.createElement('div');
        metaEl.className = 'bsc-queue-meta';
        metaEl.textContent = this._formatSize(item.size);

        // Action buttons row (Rename / Remove)
        const actionsRow = document.createElement('div');
        actionsRow.className = 'bsc-queue-actions-row';

        const renameBtn = document.createElement('button');
        renameBtn.className = 'bsc-queue-action-btn';
        renameBtn.type = 'button';
        renameBtn.textContent = '✏️ Rename';

        const removeBtn = document.createElement('button');
        removeBtn.className = 'bsc-queue-action-btn danger';
        removeBtn.type = 'button';
        removeBtn.textContent = '🗑 Remove';

        actionsRow.appendChild(renameBtn);
        actionsRow.appendChild(removeBtn);

        info.appendChild(nameEl);
        info.appendChild(metaEl);
        info.appendChild(actionsRow);

        topRow.appendChild(thumb);
        topRow.appendChild(info);
        div.appendChild(topRow);
        list.appendChild(div);

        // ── Rename logic ──────────────────────────────────────────────────────
        renameBtn.addEventListener('click', () => {
          // Replace name display with inline input
          nameEl.style.display = 'none';
          actionsRow.style.display = 'none';

          const ext = item.name.includes('.') ? '.' + item.name.split('.').pop() : '';
          const baseName = ext ? item.name.slice(0, -ext.length) : item.name;

          const inputWrap = document.createElement('div');
          inputWrap.style.cssText = 'display:flex;gap:6px;align-items:center;margin-top:2px;';

          const inp = document.createElement('input');
          inp.className = 'bsc-queue-rename-input';
          inp.type = 'text';
          inp.value = baseName;
          inp.placeholder = 'File name';

          const extSpan = document.createElement('span');
          extSpan.style.cssText = 'font-size:0.78rem;color:var(--text-secondary,#888);flex-shrink:0;';
          extSpan.textContent = ext;

          const saveBtn = document.createElement('button');
          saveBtn.type = 'button';
          saveBtn.className = 'bsc-queue-action-btn';
          saveBtn.style.flexShrink = '0';
          saveBtn.textContent = '✓';

          inputWrap.appendChild(inp);
          if (ext) inputWrap.appendChild(extSpan);
          inputWrap.appendChild(saveBtn);
          info.insertBefore(inputWrap, metaEl);

          inp.focus();
          inp.select();

          const commitRename = () => {
            const newBase = inp.value.trim() || baseName;
            item.name = newBase + ext;
            nameEl.textContent = item.name;
            nameEl.title = item.name;
            nameEl.style.display = '';
            actionsRow.style.display = '';
            inputWrap.remove();
          };

          saveBtn.addEventListener('click', commitRename);
          inp.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
            if (e.key === 'Escape') {
              nameEl.style.display = '';
              actionsRow.style.display = '';
              inputWrap.remove();
            }
          });
        });

        // ── Remove logic ──────────────────────────────────────────────────────
        removeBtn.addEventListener('click', () => {
          this._queue = this._queue.filter(q => q.id !== item.id);
          this._renderQueue();
        });
      });

      const btn = this._el.querySelector('[data-action="process"]');
      btn.textContent = `Convert to PDF & Upload (${this._queue.length}) →`;
    }

    // ── PDF CONVERSION & UPLOAD ────────────────────────────────────────────────
    async _processQueue() {
      if (this._queue.length === 0) return;
      this._goToView('progress');
      this._setProgress(0, 'Building PDF...', `${this._queue.length} page(s)`);

      try {
        // Collect image blobs (skip non-images for now — pass through as-is)
        const imageItems = this._queue.filter(q => q.type.startsWith('image/'));
        const otherItems = this._queue.filter(q => !q.type.startsWith('image/'));

        const resultFiles = [];

        // Build PDF from images
        if (imageItems.length > 0) {
          const pdfBlob = await this._buildPDF(imageItems);
          const pdfName = `scan_${Date.now()}.pdf`;
          resultFiles.push({ blob: pdfBlob, name: pdfName, type: 'application/pdf' });
        }

        // Pass through non-image files as-is
        otherItems.forEach(item => {
          resultFiles.push({ blob: item.blob, name: item.name, type: item.type });
        });

        this._setProgress(60, 'Uploading...', 'Sending to Supabase');

        // Upload
        const uploaded = await this._uploadFiles(resultFiles);

        this._setProgress(100, 'Done!', 'Files ready');

        await new Promise(r => setTimeout(r, 600));

        this._close();

        if (typeof this._onComplete === 'function') {
          this._onComplete(uploaded);
        }

        // Reset queue
        this._queue = [];

      } catch (err) {
        console.error('[BromarScanner] Process error:', err);
        alert('Error: ' + err.message);
        this._goToView('queue');
      }
    }

    async _buildPDF(imageItems) {
      // Dynamically load jsPDF if not already present
      if (!window.jspdf) {
        await this._loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
      }

      const { jsPDF } = window.jspdf;
      let pdf = null;

      for (let i = 0; i < imageItems.length; i++) {
        const item = imageItems[i];
        this._setProgress(
          Math.round(10 + (i / imageItems.length) * 45),
          'Building PDF...',
          `Page ${i + 1} of ${imageItems.length}`
        );

        const dataUrl = await this._blobToDataUrl(item.blob);
        const imgInfo = await this._getImageDimensions(dataUrl);

        // A4 in mm: 210 x 297
        const isLandscape = imgInfo.width > imgInfo.height;
        const pageW = isLandscape ? 297 : 210;
        const pageH = isLandscape ? 210 : 297;

        if (!pdf) {
          pdf = new jsPDF({ orientation: isLandscape ? 'l' : 'p', unit: 'mm', format: 'a4' });
        } else {
          pdf.addPage('a4', isLandscape ? 'l' : 'p');
        }

        // Fit image to page
        const margin = 5;
        const availW = pageW - margin * 2;
        const availH = pageH - margin * 2;
        const ratio = Math.min(availW / imgInfo.width, availH / imgInfo.height);
        const w = imgInfo.width * ratio;
        const h = imgInfo.height * ratio;
        const x = (pageW - w) / 2;
        const y = (pageH - h) / 2;

        pdf.addImage(dataUrl, 'JPEG', x, y, w, h, undefined, 'FAST');
      }

      const pdfBytes = pdf.output('arraybuffer');
      return new Blob([pdfBytes], { type: 'application/pdf' });
    }

    async _uploadFiles(files) {
      const sb = this.options.supabase;
      const bucket = this.options.bucket || 'job-sheet-files';
      const pathPrefix = this.options.pathPrefix || 'scans';
      const results = [];

      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        this._setProgress(
          Math.round(60 + (i / files.length) * 35),
          'Uploading...',
          f.name
        );

        let filePath = `${pathPrefix}/${Date.now()}-${f.name}`;

        if (sb) {
          const { data, error } = await sb.storage
            .from(bucket)
            .upload(filePath, f.blob, { contentType: f.type, upsert: false });

          if (error) throw new Error('Upload failed: ' + error.message);

          const { data: urlData } = await sb.storage
            .from(bucket)
            .createSignedUrl(filePath, 60 * 60 * 24 * 30);

          results.push({
            name: f.name,
            path: filePath,
            type: f.type,
            size: f.blob.size,
            blob: f.blob,
            url: urlData?.signedUrl || null
          });
        } else {
          // No supabase — return blob URL for local use
          results.push({
            name: f.name,
            path: filePath,
            type: f.type,
            size: f.blob.size,
            blob: f.blob,
            url: URL.createObjectURL(f.blob)
          });
        }
      }

      return results;
    }

    // ── HELPERS ────────────────────────────────────────────────────────────────
    _setProgress(pct, title, sub) {
      const view = this._el.querySelector('[data-view="progress"]');
      view.querySelector('.bsc-progress-title').textContent = title;
      view.querySelector('.bsc-progress-sub').textContent = sub || '';
      view.querySelector('.bsc-progress-bar').style.width = pct + '%';
    }

    _blobToDataUrl(blob) {
      return new Promise(resolve => {
        const r = new FileReader();
        r.onload = e => resolve(e.target.result);
        r.readAsDataURL(blob);
      });
    }

    _getImageDimensions(dataUrl) {
      return new Promise(resolve => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.src = dataUrl;
      });
    }

    _formatSize(bytes) {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    _loadScript(src) {
      return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }
  }

  // ── EXPOSE ──────────────────────────────────────────────────────────────────
  global.BromarScanner = BromarScanner;

})(window);
