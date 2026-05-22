/* ── TAB: Materials ── */
(function () {
  const JM = window.JobManager;
  const { esc, fmtDate } = JM;

  JM.registerTool('materials', {
    label: 'Materials', icon: '📦',
    count: d => d.materials.length,
    render(panel, d) {
      const rows = d.materials;
      const body = rows.map(m => `<tr>
        <td>${fmtDate(m._sheet_date)}</td>
        <td>${esc(m.description || m.item || m.name || '—')}</td>
        <td>${m.qty ?? m.quantity ?? '—'}</td>
        <td>${esc(m.supplier || m.unit || '—')}</td>
        <td><span style="font-family:'JetBrains Mono',monospace;font-size:0.75rem;color:var(--text-secondary);">${esc(m._sheet)}</span></td>
      </tr>`).join('');

      panel.innerHTML = `<div class="tool-card">
        <div class="tool-card-header">
          <div class="tool-card-title">Materials</div>
          <div class="tool-card-actions"><button class="btn-add" data-label="Add material">+ Add material</button></div>
        </div>
        ${rows.length
          ? `<div class="data-table-wrapper"><table class="data-table"><thead><tr><th>Date</th><th>Item</th><th>Qty</th><th>Supplier / Unit</th><th>Sheet</th></tr></thead><tbody>${body}</tbody></table></div>`
          : `<div class="empty-state"><div class="empty-state-icon">📦</div><div class="empty-state-text">No materials recorded for this job</div></div>`}
      </div>`;
      panel.querySelectorAll('.btn-add').forEach(b => b.addEventListener('click', () => window.BromarHub?.showInfo?.('Add material — coming soon')));
    }
  });
})();
