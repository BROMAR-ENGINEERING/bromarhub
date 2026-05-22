/* ============================================================
   JOB MANAGER — BOOT
   Runs after core + all tab files have loaded. Builds the sidebar
   nav from the registered tools, wires page events, loads jobs.
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  const JM = window.JobManager;
  if (!JM) { console.error('[JobManager] core not loaded'); return; }

  // Build sidebar nav from registered tools
  JM.buildSidebarNav();

  // Load jobs (wait for window.sb if auth.js hasn't finished)
  if (!window.sb) setTimeout(() => JM.loadJobs(), 200);
  else JM.loadJobs();

  // Preload logo for PDF embedding
  JM.loadBromarLogo();

  // ── Search ──
  document.getElementById('jobSearch').addEventListener('input', e => {
    JM.state.searchFilter.text = e.target.value;
    JM.state.jobShowCount = JM.JOB_PAGE_SIZE;
    JM.renderJobList();
  });

  // ── Status chips ──
  document.querySelectorAll('.filter-chip[data-status]').forEach(c => {
    c.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip[data-status]').forEach(b => b.classList.remove('active'));
      c.classList.add('active');
      JM.state.searchFilter.status = c.dataset.status;
      JM.state.jobShowCount = JM.JOB_PAGE_SIZE;
      JM.renderJobList();
    });
  });

  // ── Prefix chips ──
  document.querySelectorAll('.filter-chip[data-prefix]').forEach(c => {
    c.addEventListener('click', () => {
      const wasActive = c.classList.contains('active');
      document.querySelectorAll('.filter-chip[data-prefix]').forEach(b => b.classList.remove('active'));
      if (!wasActive) { c.classList.add('active'); JM.state.searchFilter.prefix = c.dataset.prefix; }
      else { JM.state.searchFilter.prefix = null; }
      JM.state.jobShowCount = JM.JOB_PAGE_SIZE;
      JM.renderJobList();
    });
  });

  // ── Change job / sidebar ──
  document.getElementById('changeJobBtn').addEventListener('click', () => { JM.closeSidebarMobile(); JM.deselectJob(); });
  document.getElementById('sidebarToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.add('show');
    document.getElementById('sidebarOverlay').classList.add('show');
  });
  document.getElementById('sidebarClose').addEventListener('click', JM.closeSidebarMobile);
  document.getElementById('sidebarOverlay').addEventListener('click', JM.closeSidebarMobile);

  window.addEventListener('resize', () => {
    if (JM.state.selectedJob) {
      document.getElementById('sidebarToggle').style.display = window.innerWidth < 900 ? 'inline-flex' : 'none';
    }
  });
});
