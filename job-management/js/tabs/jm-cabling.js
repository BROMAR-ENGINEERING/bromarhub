/* ── TAB: Cabling ── (AS/NZS 3008 cable selections; links to calculator) */
(function () {
  const JM = window.JobManager;
  const { esc, fmtDate } = JM;

  // Calculator page, with job context passed so it can pre-fill
  const CALCULATOR_URL = '../standards/cable-calculator.html';

  JM.registerTool('cabling', {
    label: 'Cabling', icon: '🔌',
    count: d => d.cabling.length,
    render(panel, d, job) {
      const rows = d.cabling;

      const newCalcUrl = `${CALCULATOR_URL}?job=${encodeURIComponent(job.job_number)}`
        + `&client=${encodeURIComponent(job.client_name || '')}`
        + `&site=${encodeURIComponent(job.site_name || '')}`;

      if (!rows.length) {
        panel.innerHTML = `<div class="tool-card">
          <div class="tool-card-header">
            <div>
              <div class="tool-card-title">Cabling</div>
              <div style="font-size:0.82rem;color:var(--text-secondary);margin-top:2px;">AS/NZS 3008 cable selections for this job.</div>
            </div>
            <div class="tool-card-actions"><a class="btn-add" href="${newCalcUrl}" target="_blank" rel="noopener" style="text-decoration:none;">+ New Calculation</a></div>
          </div>
          <div class="empty-state"><div class="empty-state-icon">🔌</div><div class="empty-state-text">No cable selections saved for this job yet.<br/>Click <strong>+ New Calculation</strong> to size a cable.</div></div>
        </div>`;
        return;
      }

      const fmtNum = (v, suffix = '') => (v === null || v === undefined || v === '') ? '—' : `${v}${suffix}`;
      const vdClass = (pct, max) => {
        if (pct === null || pct === undefined) return '';
        if (max && Number(pct) > Number(max)) return 'status-cancelled';
        return 'status-completed';
      };

      const body = rows.map(c => `
        <tr data-cable-id="${c.id}" style="cursor:pointer;">
          <td><strong>${esc(c.circuit_ref || '—')}</strong>${c.switchboard ? `<div style="font-size:0.72rem;color:var(--text-secondary);">${esc(c.switchboard)}</div>` : ''}</td>
          <td>${esc(c.description || '—')}</td>
          <td>${fmtNum(c.active_size_mm2, ' mm²')}${c.earth_size_mm2 ? ` <span style="color:var(--text-secondary);">+ ${c.earth_size_mm2}E</span>` : ''}</td>
          <td>${esc(c.cable_type || '—')}${c.conductor ? ` · ${esc(c.conductor)}` : ''}</td>
          <td>${fmtNum(c.cable_distance_m, ' m')}</td>
          <td>${fmtNum(c.current_rating_a, ' A')}</td>
          <td>${c.voltage_drop_pct !== null && c.voltage_drop_pct !== undefined ? `<span class="job-status ${vdClass(c.voltage_drop_pct, c.max_vd_pct)}">${c.voltage_drop_pct}%</span>` : '—'}</td>
          <td style="font-size:0.75rem;color:var(--text-secondary);">${fmtDate(c.created_at)}</td>
        </tr>
        <tr class="cable-detail-row" data-cable-detail="${c.id}" style="display:none;"><td colspan="8" style="background:var(--bg-main);padding:0;"></td></tr>
      `).join('');

      panel.innerHTML = `<div class="tool-card">
        <div class="tool-card-header">
          <div>
            <div class="tool-card-title">Cabling</div>
            <div style="font-size:0.82rem;color:var(--text-secondary);margin-top:2px;">${rows.length} cable selection${rows.length === 1 ? '' : 's'}. Click a row for full detail.</div>
          </div>
          <div class="tool-card-actions"><a class="btn-add" href="${newCalcUrl}" target="_blank" rel="noopener" style="text-decoration:none;">+ New Calculation</a></div>
        </div>
        <div class="data-table-wrapper">
          <table class="data-table">
            <thead><tr><th>Circuit</th><th>Description</th><th>Active</th><th>Type</th><th>Length</th><th>Rating</th><th>V-Drop</th><th>Date</th></tr></thead>
            <tbody>${body}</tbody>
          </table>
        </div>
      </div>`;

      panel.querySelectorAll('[data-cable-id]').forEach(row => {
        row.addEventListener('click', () => toggleDetail(row, rows));
      });
    }
  });

  function toggleDetail(row, rows) {
    const id = row.dataset.cableId;
    const detailRow = document.querySelector(`tr[data-cable-detail="${id}"]`);
    if (!detailRow) return;
    if (detailRow.style.display !== 'none') { detailRow.style.display = 'none'; return; }
    const c = rows.find(x => x.id === id);
    if (!c) return;

    const cell = detailRow.querySelector('td');
    const f = (label, val) => `<tr><th style="width:30%;">${label}</th><td>${val ?? '—'}</td></tr>`;
    cell.innerHTML = `
      <div style="padding:1rem 1.25rem;">
        <div class="data-table-wrapper">
          <table class="data-table">
            <tbody>
              ${f('Circuit Ref', esc(c.circuit_ref || '—'))}
              ${f('Switchboard', esc(c.switchboard || '—'))}
              ${f('Description', esc(c.description || '—'))}
              ${f('Phase', esc(c.phase || '—'))}
              ${f('Voltage', c.voltage_v ? c.voltage_v + ' V' : '—')}
              ${f('Load', (c.rating_value ?? '') !== '' ? `${c.rating_value} ${esc(c.rating_unit || '')}` : '—')}
              ${f('Cable Type', esc(c.cable_type || '—'))}
              ${f('Conductor', esc(c.conductor || '—'))}
              ${f('Installation', esc(c.installation || '—'))}
              ${f('Distance', c.cable_distance_m ? c.cable_distance_m + ' m' : '—')}
              ${f('Active Size', c.active_size_mm2 ? c.active_size_mm2 + ' mm²' : '—')}
              ${f('Earth Size', c.earth_size_mm2 ? c.earth_size_mm2 + ' mm²' : '—')}
              ${f('Current Rating', c.current_rating_a ? c.current_rating_a + ' A' : '—')}
              ${f('Voltage Drop', (c.voltage_drop_v != null ? c.voltage_drop_v + ' V' : '—') + (c.voltage_drop_pct != null ? ` (${c.voltage_drop_pct}%)` : ''))}
              ${f('Max V-Drop', c.max_vd_pct != null ? c.max_vd_pct + '%' : '—')}
            </tbody>
          </table>
        </div>
      </div>`;
    detailRow.style.display = '';
  }
})();
