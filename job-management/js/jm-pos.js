/* ── TAB: Purchase Orders ── (expandable line items) */
(function () {
  const JM = window.JobManager;
  const { esc, fmtDate, fmtMoney, sb } = JM;

  JM.registerTool('pos', {
    label: 'Purchase Orders', icon: '🧾',
    count: d => d.pos.length,
    render(panel, d) {
      const rows = d.pos;
      if (!rows.length) {
        panel.innerHTML = `<div class="tool-card"><div class="tool-card-header"><div class="tool-card-title">Purchase Orders</div><div class="tool-card-actions"><button class="btn-add" data-label="New PO">+ New PO</button></div></div><div class="empty-state"><div class="empty-state-icon">🧾</div><div class="empty-state-text">No purchase orders for this job</div></div></div>`;
        wireAdd(panel);
        return;
      }
      const html = rows.map(p => `
        <tr class="po-expandable" data-po-id="${p.id}">
          <td><span class="caret">▸</span><strong>${esc(p.po_number)}</strong></td>
          <td>${fmtDate(p.created_at)}</td>
          <td>${esc(p.supplier)}${p.supplier_branch ? ' · ' + esc(p.supplier_branch) : ''}</td>
          <td>${esc(p.po_type)}</td>
          <td><span class="job-status status-${(p.status || 'submitted') === 'received' ? 'completed' : 'active'}">${esc(p.status)}</span></td>
          <td style="text-align:right;">${fmtMoney(p.total)}</td>
        </tr>
        <tr class="po-items-row" data-po-items="${p.id}" style="display:none;"><td colspan="6"></td></tr>
      `).join('');

      panel.innerHTML = `<div class="tool-card"><div class="tool-card-header"><div class="tool-card-title">Purchase Orders</div><div class="tool-card-actions"><button class="btn-add" data-label="New PO">+ New PO</button></div></div><div class="data-table-wrapper"><table class="data-table"><thead><tr><th>PO #</th><th>Date</th><th>Supplier</th><th>Type</th><th>Status</th><th style="text-align:right;">Total</th></tr></thead><tbody>${html}</tbody></table></div></div>`;

      panel.querySelectorAll('.po-expandable').forEach(row => row.addEventListener('click', () => togglePOItems(row)));
      wireAdd(panel);
    }
  });

  async function togglePOItems(row) {
    const poId = row.dataset.poId;
    const itemsRow = document.querySelector(`tr[data-po-items="${poId}"]`);
    const caret = row.querySelector('.caret');
    if (!itemsRow) return;
    if (itemsRow.style.display !== 'none') { itemsRow.style.display = 'none'; caret.classList.remove('open'); return; }
    caret.classList.add('open');
    itemsRow.style.display = '';
    const cell = itemsRow.querySelector('td');
    cell.innerHTML = `<div class="loading-inline"><div class="spinner"></div>Loading line items…</div>`;
    const { data, error } = await sb().from('purchase_order_items').select('line_number, qty, part_number, description, price_each, line_total, item_notes').eq('po_id', poId).order('line_number');
    if (error) { cell.innerHTML = `<div style="padding:1rem;color:var(--error);">Error: ${esc(error.message)}</div>`; return; }
    if (!data || !data.length) { cell.innerHTML = `<div style="padding:1rem;color:var(--text-secondary);text-align:center;">No line items</div>`; return; }
    cell.innerHTML = `<table class="po-items-table"><thead><tr><th>#</th><th>Part</th><th>Description</th><th style="text-align:right;">Qty</th><th style="text-align:right;">Price</th><th style="text-align:right;">Total</th></tr></thead><tbody>${data.map(i => `<tr><td>${i.line_number}</td><td>${esc(i.part_number || '—')}</td><td>${esc(i.description)}${i.item_notes ? `<div style="font-size:0.7rem;color:var(--text-secondary);margin-top:2px;">${esc(i.item_notes)}</div>` : ''}</td><td style="text-align:right;">${i.qty}</td><td style="text-align:right;">${fmtMoney(i.price_each)}</td><td style="text-align:right;">${fmtMoney(i.line_total)}</td></tr>`).join('')}</tbody></table>`;
  }

  function wireAdd(panel) {
    panel.querySelectorAll('.btn-add').forEach(b => b.addEventListener('click', () => window.BromarHub?.showInfo?.('New PO — coming soon')));
  }
})();
