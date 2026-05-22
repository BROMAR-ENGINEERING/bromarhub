/* ── TAB: Documents ── */
(function () {
  const JM = window.JobManager;
  JM.registerTool('documents', {
    label: 'Documents', icon: '📂',
    count: d => d.documents.length,
    render(panel, d) {
      JM.renderFileGrid(panel, 'Documents', '📂', d.documents, 'documents', 'No documents uploaded yet');
    }
  });
})();
