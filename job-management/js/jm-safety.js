/* ── TAB: Safety Files ── */
(function () {
  const JM = window.JobManager;
  JM.registerTool('safety', {
    label: 'Safety Files', icon: '🦺',
    count: d => d.safety.length,
    render(panel, d) {
      JM.renderFileGrid(panel, 'Safety Files', '🦺', d.safety, 'safety', 'No safety files uploaded yet');
    }
  });
})();
