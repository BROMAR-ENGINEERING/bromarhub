/* ── TAB: TEMPLATES — V1.00 ────────────────────────────
   Master template library. List / search / edit / archive.
   ──────────────────────────────────────────────────────── */
(function () {
  const SB = window.SwmsBuilder;
  const SS = window.SwmsShared;
  if (!SS) { console.error('[sb-templates] SwmsShared missing'); return; }

  let searchText = '';
  let showArchived = false;

  SB.registerTab('templates', { render });

  function render(panel) {
    const all = SB.state.templates;
    const visible = all
      .filter(t => showArchived ? true : !t.is_archived)
      .filter(t => !searchText || matches(t, searchText));

    panel.innerHTML = `
      <div style="display:flex; gap:0.5rem; margin-bottom:1rem; flex-wrap:wrap; align-items:center;">
        <input type="text" id="tplSearch" placeholder="Search templates..." value="${SB.esc(searchText)}" style="flex:1; min-width:200px; padding:0.6rem 0.75rem; border:1px solid var(--border); border-radius:8px; background:var(--bg-main); color:var(--text-primary); font-family:inherit; font-size:0.9rem;"/>
        <label style="display:inline-flex; align-items:center; gap:0.4rem; font-size:0.85rem; color:var(--text-secondary); cursor:pointer;">
          <input type="checkbox" id="tplShowArchived" ${showArchived ? 'checked' : ''}/> Show archived
        </label>
        <button class="btn-add" id="tplNew">+ New Template</button>
      </div>

      <div id="editorMount"></div>

      ${visible.length ? `
        <div class="sb-list">
          ${visible.map(rowHtml).join('')}
        </div>
      ` : `
        <div class="empty-state">
          <div class="empty-state-icon">📚</div>
          <div class="empty-state-text">${searchText ? 'No templates match your search' : 'No templates yet. Click <strong>+ New Template</strong> to start.'}</div>
        </div>
      `}
    `;

    document.getElementById('tplSearch').addEventListener('input', e => { searchText = e.target.value; render(panel); });
    document.getElementById('tplShowArchived').addEventListener('change', e => { showArchived = e.target.checked; render(panel); });
    document.getElementById('tplNew').addEventListener('click', openNew);
    panel.querySelectorAll('[data-tpl-edit]').forEach(b => b.addEventListener('click', () => openEdit(b.dataset.tplEdit)));
    panel.querySelectorAll('[data-tpl-restore]').forEach(b => b.addEventListener('click', () => restoreTemplate(b.dataset.tplRestore)));
  }

  function matches(t, q) {
    const s = q.toLowerCase();
    return (t.name || '').toLowerCase().includes(s)
        || (t.title || '').toLowerCase().includes(s)
        || (t.category || '').toLowerCase().includes(s);
  }

  function rowHtml(t) {
    const hazCount = (t.hazards_json || []).filter(h => h.type !== 'phase').length;
    return `
      <div class="sb-list-item" style="${t.is_archived ? 'opacity:0.55;' : ''}">
        <div class="sb-list-info">
          <div class="sb-list-title">${SB.esc(t.name)}${t.is_archived ? ' <span style="font-size:0.7rem; color:var(--text-secondary); font-weight:500;">(archived)</span>' : ''}</div>
          <div class="sb-list-meta">
            ${SB.esc(t.title || '')}
            ${t.category ? ' · ' + SB.esc(t.category) : ''}
            · ${hazCount} hazard${hazCount === 1 ? '' : 's'}
            ${t.template_version ? ' · ' + SB.esc(t.template_version) : ''}
          </div>
        </div>
        <div class="sb-list-actions">
          ${t.is_archived
            ? `<button class="btn-secondary" data-tpl-restore="${t.id}">↺ Restore</button>`
            : `<button class="btn-secondary" data-tpl-edit="${t.id}">✎ Edit</button>`}
        </div>
      </div>`;
  }

  function openNew() {
    SS.openEditor({
      swmsId: null,
      mode: 'template',
      ctx: SB.sharedCtx('templates', { isTemplate: true })
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openEdit(templateId) {
    SS.openEditor({
      swmsId: templateId,
      mode: 'template',
      ctx: SB.sharedCtx('templates', { isTemplate: true })
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function restoreTemplate(id) {
    if (!confirm('Restore this template? It will appear in the picker again.')) return;
    BromarHub.showLoading('Restoring template', 'Please wait...');
    const { error } = await SB.sb().from('swms_templates').update({ is_archived: false }).eq('id', id);
    BromarHub.hideLoading();
    if (error) { BromarHub.showInfo('Restore failed: ' + error.message); return; }
    BromarHub.showSuccess('Template restored');
    await SB.reloadTemplates();
  }
})();
