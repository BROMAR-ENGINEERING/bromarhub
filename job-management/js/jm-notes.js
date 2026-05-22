/* ── TAB: Notes ── */
(function () {
  const JM = window.JobManager;
  const { esc, fmtDate } = JM;

  JM.registerTool('notes', {
    label: 'Notes', icon: '📝',
    count: d => d.notes.length,
    render(panel, d) {
      const rows = d.notes;
      const body = rows.map(n => `<tr>
        <td style="white-space:nowrap;">${fmtDate(n._sheet_date)}</td>
        <td style="white-space:nowrap;">${esc(n.author || n.created_by || '—')}</td>
        <td>${esc(n.note || n.text || n.content || '—')}</td>
        <td><span style="font-family:'JetBrains Mono',monospace;font-size:0.75rem;color:var(--text-secondary);">${esc(n._sheet)}</span></td>
      </tr>`).join('');

      panel.innerHTML = `<div class="tool-card">
        <div class="tool-card-header">
          <div class="tool-card-title">Notes</div>
          <div class="tool-card-actions"><button class="btn-add" data-label="Add note">+ Add note</button></div>
        </div>
        ${rows.length
          ? `<div class="data-table-wrapper"><table class="data-table"><thead><tr><th>Date</th><th>Author</th><th>Note</th><th>Sheet</th></tr></thead><tbody>${body}</tbody></table></div>`
          : `<div class="empty-state"><div class="empty-state-icon">📝</div><div class="empty-state-text">No notes yet</div></div>`}
      </div>`;
      panel.querySelectorAll('.btn-add').forEach(b => b.addEventListener('click', () => window.BromarHub?.showInfo?.('Add note — coming soon')));
    }
  });
})();
