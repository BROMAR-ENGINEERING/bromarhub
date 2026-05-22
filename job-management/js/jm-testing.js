/* ── TAB: Testing ── */
(function () {
  const JM = window.JobManager;
  JM.registerTool('testing', {
    label: 'Testing', icon: '🧪',
    count: d => d.testing.length,
    render(panel, d) {
      JM.renderFileGrid(panel, 'Testing', '🧪', d.testing, 'testing', 'No test sheets recorded yet');
    }
  });
})();
