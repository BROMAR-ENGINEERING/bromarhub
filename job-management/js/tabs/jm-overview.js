/* ── TAB: Overview ── */
(function () {
  const JM = window.JobManager;
  const { esc, fmtDate, fmtMoney, statusBadge, jobTypeDisplay } = JM;

  JM.registerTool('overview', {
    label: 'Overview', icon: '📊',
    render(panel, d, job) {
      const hours = d.labour.reduce((s, l) => s + (Number(l.normalHours) || 0) + (Number(l.overtimeHours) || 0), 0);
      const poTotal = d.pos.reduce((s, p) => s + (Number(p.total) || 0), 0);
      const filesTotal = d.documents.length + d.safety.length + d.testing.length;
      const activeSwms = d.swms.filter(s => s.status === 'active').length;

      panel.innerHTML = `
        <div class="stats-row">
          <div class="stat-card"><div class="stat-label">Status</div><div class="stat-value">${statusBadge(job.status)}</div></div>
          <div class="stat-card"><div class="stat-label">Labour Hours</div><div class="stat-value accent">${hours.toFixed(1)}</div></div>
          <div class="stat-card"><div class="stat-label">PO Total</div><div class="stat-value">${fmtMoney(poTotal)}</div></div>
          <div class="stat-card"><div class="stat-label">Active SWMS</div><div class="stat-value">${activeSwms}</div></div>
          <div class="stat-card"><div class="stat-label">Files</div><div class="stat-value">${filesTotal}</div></div>
        </div>
        <div class="tool-card">
          <div class="tool-card-header"><div class="tool-card-title">Job Details</div></div>
          <div class="data-table-wrapper">
            <table class="data-table">
              <tbody>
                <tr><th style="width:32%;">Job Number</th><td>${esc(job.job_number)}</td></tr>
                <tr><th>Client</th><td>${esc(job.client_name)}</td></tr>
                <tr><th>Site</th><td>${esc(job.site_name || '—')}</td></tr>
                <tr><th>Site Address</th><td>${esc(job.site_address || '—')}</td></tr>
                <tr><th>Contact</th><td>${esc(job.contact_person || '—')} ${job.contact_phone ? '· ' + esc(job.contact_phone) : ''}</td></tr>
                <tr><th>Job Type</th><td>${jobTypeDisplay(job)}</td></tr>
                <tr><th>Opened</th><td>${fmtDate(job.created_at)}</td></tr>
                <tr><th>Completed</th><td>${fmtDate(job.completed_at)}</td></tr>
                ${job.notes ? `<tr><th>Notes</th><td>${esc(job.notes)}</td></tr>` : ''}
              </tbody>
            </table>
          </div>
        </div>`;
    }
  });
})();
