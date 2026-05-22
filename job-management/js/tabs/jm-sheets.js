/* ── TAB: Job Sheets / Service Reports ── */
(function () {
  const JM = window.JobManager;
  const { esc, fmtDate, sb } = JM;

  let cacheRef = null; // hold current jobCache for viewSheet lookups

  JM.registerTool('sheets', {
    label: 'Job Sheets', icon: '📋',
    count: d => d.sheets.length,
    render(panel, d) {
      cacheRef = d;
      const sheets = d.sheets;
      if (!sheets.length) {
        panel.innerHTML = `<div class="tool-card"><div class="tool-card-header"><div class="tool-card-title">Job Sheets</div></div><div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-text">No job sheets submitted for this job</div></div></div>`;
        return;
      }

      const reports = sheets.filter(s => s.is_service_report);

      const rowHtml = s => {
        const labourCount = Array.isArray(s.labour) ? s.labour.length : 0;
        const matCount = Array.isArray(s.materials) ? s.materials.length : 0;
        const taskCount = Array.isArray(s.tasks) ? s.tasks.length : 0;
        return `<tr data-sheet-id="${s.id}" style="cursor:pointer;">
          <td><strong style="font-family:'JetBrains Mono',monospace;font-size:0.8rem;color:var(--accent);">${esc(s.job_sheet_number)}</strong></td>
          <td>${fmtDate(s.sheet_date)}</td>
          <td>${s.is_service_report ? '🛎️ Service Report' : 'Job Sheet'}</td>
          <td>${esc(s.created_by || '—')}</td>
          <td style="font-size:0.78rem;color:var(--text-secondary);">${taskCount}t · ${labourCount}l · ${matCount}m</td>
          <td>${s.is_service_report ? signBadge(s.signing_status) : '—'}</td>
          <td>${(s.is_service_report && s.report_generated_at) ? `<button class="btn-secondary" style="padding:0.35rem 0.7rem;font-size:0.75rem;" data-report-pdf="${esc(s.job_number)}|${esc(s.job_sheet_number)}">📄 PDF</button>` : ''}</td>
        </tr>`;
      };

      panel.innerHTML = `<div class="tool-card">
        <div class="tool-card-header">
          <div>
            <div class="tool-card-title">Job Sheets</div>
            <div style="font-size:0.82rem;color:var(--text-secondary);margin-top:2px;">${sheets.length} sheet${sheets.length===1?'':'s'}${reports.length?` · ${reports.length} service report${reports.length===1?'':'s'}`:''}. Click a row to view.</div>
          </div>
        </div>
        <div class="data-table-wrapper">
          <table class="data-table">
            <thead><tr><th>Sheet #</th><th>Date</th><th>Type</th><th>By</th><th>Contents</th><th>Signing</th><th>Report</th></tr></thead>
            <tbody>${sheets.map(rowHtml).join('')}</tbody>
          </table>
        </div>
        <div id="sheetDetail"></div>
      </div>`;

      panel.querySelectorAll('[data-report-pdf]').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          const [jobNum, sheetNum] = btn.dataset.reportPdf.split('|');
          openServiceReport(jobNum, sheetNum);
        });
      });
      panel.querySelectorAll('[data-sheet-id]').forEach(row => {
        row.addEventListener('click', () => viewSheet(row.dataset.sheetId));
      });
    }
  });

  function signBadge(status) {
    const map = { signed:'completed', unsigned:'on_hold', sent:'active' };
    const cls = map[status] || 'draft';
    return `<span class="job-status status-${cls}">${esc(status || 'unsigned')}</span>`;
  }

  async function openServiceReport(jobNumber, sheetNum) {
    const signedPath   = `${jobNumber}/service-reports/signed-${sheetNum}.pdf`;
    const unsignedPath = `${jobNumber}/service-reports/${sheetNum}.pdf`;
    let url = null;
    try { const { data } = await sb().storage.from('job-sheet-files').createSignedUrl(signedPath, 3600); url = data?.signedUrl; } catch {}
    if (!url) { try { const { data } = await sb().storage.from('job-sheet-files').createSignedUrl(unsignedPath, 3600); url = data?.signedUrl; } catch {} }
    if (url) window.open(url, '_blank', 'noopener');
    else window.BromarHub?.showInfo?.('Report PDF not found in storage');
  }

  function viewSheet(sheetId) {
    const s = cacheRef.sheets.find(x => x.id === sheetId);
    if (!s) return;
    const detail = document.getElementById('sheetDetail');
    if (!detail) return;

    const labour = Array.isArray(s.labour) ? s.labour : [];
    const mats = Array.isArray(s.materials) ? s.materials : [];
    const tasks = Array.isArray(s.tasks) ? s.tasks : [];
    const notes = Array.isArray(s.notes) ? s.notes : [];

    const tasksHtml = tasks.length ? tasks.map(t => `<li>${esc(t.task || t.description || t.text || (typeof t === 'string' ? t : JSON.stringify(t)))}</li>`).join('') : '<li style="color:var(--text-secondary);">None</li>';
    const labourHtml = labour.length ? labour.map(l => `<li>${esc(l.employee || '—')} — ${(Number(l.normalHours)||0)+(Number(l.overtimeHours)||0)}h (${Number(l.normalHours)||0} normal, ${Number(l.overtimeHours)||0} OT)</li>`).join('') : '<li style="color:var(--text-secondary);">None</li>';
    const matsHtml = mats.length ? mats.map(m => `<li>${esc(m.description || m.item || m.name || '—')}${m.qty ? ' × ' + m.qty : ''}</li>`).join('') : '<li style="color:var(--text-secondary);">None</li>';
    const notesHtml = notes.length ? notes.map(n => `<li>${esc(n.note || n.text || n.content || (typeof n === 'string' ? n : JSON.stringify(n)))}</li>`).join('') : '<li style="color:var(--text-secondary);">None</li>';

    const sigBlock = s.is_service_report ? `
      <div style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--border);">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:0.75rem;flex-wrap:wrap;margin-bottom:0.5rem;">
          <div style="font-size:0.78rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;">Service Report — ${signBadge(s.signing_status)}</div>
          ${s.report_generated_at ? `<button class="btn-secondary" style="padding:0.4rem 0.8rem;font-size:0.78rem;" data-detail-report="${esc(s.job_number)}|${esc(s.job_sheet_number)}">📄 View Report PDF</button>` : ''}
        </div>
        ${s.client_signature_data ? `<div><img src="${s.client_signature_data}" style="max-height:60px;background:white;padding:4px;border-radius:6px;border:1px solid var(--border);"/><div style="font-size:0.8rem;margin-top:4px;">Signed by <strong>${esc(s.client_signature_name || '—')}</strong>${s.client_signature_date ? ' on ' + fmtDate(s.client_signature_date) : ''}</div></div>` : '<div style="font-size:0.85rem;color:var(--text-secondary);">Not yet signed by client</div>'}
        ${(s.report_sent_to && s.report_sent_to.length) ? `<div style="font-size:0.78rem;color:var(--text-secondary);margin-top:6px;">Sent to: ${s.report_sent_to.map(esc).join(', ')}</div>` : ''}
      </div>` : '';

    detail.innerHTML = `
      <div style="margin-top:1rem;padding:1.25rem;background:var(--bg-main);border:1px solid var(--border);border-radius:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap;margin-bottom:0.875rem;">
          <div>
            <div style="font-family:'JetBrains Mono',monospace;font-weight:700;color:var(--accent);">${esc(s.job_sheet_number)}</div>
            <div style="font-size:0.82rem;color:var(--text-secondary);">${fmtDate(s.sheet_date)} · ${esc(s.created_by || '—')}${s.is_service_report ? ' · 🛎️ Service Report' : ''}</div>
          </div>
          <button class="btn-secondary" id="closeSheetDetail">Close</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;font-size:0.85rem;">
          <div><div style="font-weight:700;margin-bottom:4px;">Tasks</div><ul style="margin:0;padding-left:1.1rem;">${tasksHtml}</ul></div>
          <div><div style="font-weight:700;margin-bottom:4px;">Labour</div><ul style="margin:0;padding-left:1.1rem;">${labourHtml}</ul></div>
          <div><div style="font-weight:700;margin-bottom:4px;">Materials</div><ul style="margin:0;padding-left:1.1rem;">${matsHtml}</ul></div>
          <div><div style="font-weight:700;margin-bottom:4px;">Notes</div><ul style="margin:0;padding-left:1.1rem;">${notesHtml}</ul></div>
        </div>
        ${sigBlock}
      </div>`;

    detail.querySelector('#closeSheetDetail').addEventListener('click', () => { detail.innerHTML = ''; });
    const reportBtn = detail.querySelector('[data-detail-report]');
    if (reportBtn) {
      reportBtn.addEventListener('click', () => {
        const [jobNum, sheetNum] = reportBtn.dataset.detailReport.split('|');
        openServiceReport(jobNum, sheetNum);
      });
    }
    detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
})();
