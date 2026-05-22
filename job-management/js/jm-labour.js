/* ── TAB: Labour ── (desktop table + mobile cards) */
(function () {
  const JM = window.JobManager;
  const { esc, fmtDate } = JM;

  JM.registerTool('labour', {
    label: 'Labour', icon: '👷',
    count: d => d.labour.length,
    render(panel, d) {
      const rows = d.labour;
      if (!rows.length) {
        panel.innerHTML = `<div class="tool-card"><div class="tool-card-header"><div class="tool-card-title">Labour</div><div class="tool-card-actions"><button class="btn-add" data-label="Add entry">+ Add entry</button></div></div><div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-text">No labour recorded for this job</div></div></div>`;
        wireAdd(panel);
        return;
      }

      const tableRows = rows.map(l => {
        const normal = Number(l.normalHours) || 0;
        const ot = Number(l.overtimeHours) || 0;
        return `<tr>
          <td>${fmtDate(l._sheet_date)}</td>
          <td>${esc(l.employee || '—')}</td>
          <td style="text-align:right;">${normal || '—'}</td>
          <td style="text-align:right;">${ot || '—'}</td>
          <td style="text-align:right;font-weight:600;">${(normal + ot) || '—'}</td>
          <td><span style="font-family:'JetBrains Mono',monospace;font-size:0.75rem;color:var(--text-secondary);">${esc(l._sheet)}</span></td>
        </tr>`;
      }).join('');

      const cards = rows.map(l => {
        const normal = Number(l.normalHours) || 0;
        const ot = Number(l.overtimeHours) || 0;
        return `<div class="labour-card">
          <div class="labour-card-top">
            <div class="labour-card-name">${esc(l.employee || '—')}</div>
            <div class="labour-card-date">${fmtDate(l._sheet_date)}</div>
          </div>
          <div class="labour-card-hours">
            <div class="labour-hr-block"><span class="labour-hr-label">Normal</span><span class="labour-hr-value">${normal}</span></div>
            <div class="labour-hr-block"><span class="labour-hr-label">OT</span><span class="labour-hr-value">${ot}</span></div>
            <div class="labour-hr-block"><span class="labour-hr-label">Total</span><span class="labour-hr-value accent">${normal + ot}</span></div>
          </div>
          <div class="labour-card-sheet">${esc(l._sheet)}</div>
        </div>`;
      }).join('');

      panel.innerHTML = `<div class="tool-card">
        <div class="tool-card-header">
          <div class="tool-card-title">Labour</div>
          <div class="tool-card-actions"><button class="btn-add" data-label="Add entry">+ Add entry</button></div>
        </div>
        <div class="labour-table-wrap data-table-wrapper">
          <table class="data-table">
            <thead><tr><th>Date</th><th>Employee</th><th style="text-align:right;">Normal</th><th style="text-align:right;">OT</th><th style="text-align:right;">Total</th><th>Sheet</th></tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>
        <div class="labour-cards">${cards}</div>
      </div>`;
      wireAdd(panel);
    }
  });

  function wireAdd(panel) {
    panel.querySelectorAll('.btn-add').forEach(b => {
      b.addEventListener('click', () => window.BromarHub?.showInfo?.(`${b.dataset.label || 'Add'} — coming soon`));
    });
  }
})();
