/* ── TAB: Notes & Actions ── */
(function () {
  const JM = window.JobManager;
  const { esc, fmtDate } = JM;

  /* ── Helper: relative time ── */
  function timeAgo(iso) {
    if (!iso) return '';
    const mins = Math.round((Date.now() - new Date(iso)) / 60000);
    if (mins < 2)  return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24)  return `${hrs}h ago`;
    const days = Math.round(hrs / 24);
    if (days < 7)  return `${days}d ago`;
    return fmtDate(iso);
  }

  /* ── Helper: build employee checkbox grid HTML ── */
  function empGridHtml() {
    const emps = window.EMPLOYEES || [];
    if (!emps.length) return '<div style="padding:0.75rem; color:var(--text-secondary); font-size:0.85rem; grid-column:1/-1;">No employees loaded</div>';
    return emps.map(e => `
      <label style="display:flex; align-items:center; gap:8px; padding:6px 10px; border-radius:8px; cursor:pointer; font-size:0.85rem; font-weight:400; border:1px solid transparent; transition:all 0.15s;" class="note-emp-label">
        <input type="checkbox" class="note-modal-cb" value="${esc(e.full_name)}" data-email="${esc(e.email || '')}"
          style="accent-color:var(--accent); width:15px; height:15px; cursor:pointer;"/>
        ${esc(e.full_name)}
      </label>`).join('');
  }

  /* ── Helper: wire checkbox highlight + selected display ── */
  function wireEmpCheckboxes(container, selectedEl) {
    container.querySelectorAll('.note-modal-cb').forEach(cb => {
      cb.addEventListener('change', () => {
        const label = cb.closest('label');
        if (cb.checked) {
          label.style.background = 'var(--card-hover)';
          label.style.borderColor = 'var(--accent)';
          label.style.color = 'var(--accent)';
          label.style.fontWeight = '600';
        } else {
          label.style.background = '';
          label.style.borderColor = 'transparent';
          label.style.color = '';
          label.style.fontWeight = '400';
        }
        if (selectedEl) {
          const sel = Array.from(container.querySelectorAll('.note-modal-cb:checked')).map(c => c.value);
          selectedEl.textContent = sel.length ? `Notifying: ${sel.join(', ')}` : '';
        }
      });
    });
  }

  JM.registerTool('notes', {
    label: 'Notes', icon: '📝',
    count: d => (d.notes?.length || 0) + (d._jobNotes?.length || 0),

    async render(panel, d, job) {
      const jobNumber = job.job_number;

      /* ── Fetch job_notes from the new table ── */
      let jobNotes = [];
      try {
        const { data, error } = await JM.sb()
          .from('job_notes')
          .select('*')
          .eq('job_number', jobNumber)
          .order('created_at', { ascending: false });
        if (!error && data) jobNotes = data;
      } catch (e) { console.warn('[Notes] job_notes fetch:', e); }

      /* ── Legacy notes from job sheets (read-only) ── */
      const legacyNotes = (d.notes || []).map(n => ({
        _legacy: true,
        id: null,
        text: n.note || n.text || n.content || '',
        author: n.author || n.created_by || '—',
        created_at: n.created_at || n._sheet_date || null,
        notify_people: (n.notifyPeople || []).map(p => typeof p === 'string' ? { name: p } : p),
        status: 'closed',
        acknowledged_by: null,
        acknowledged_at: null,
        replies: [],
        job_sheet_number: n._sheet || null,
        _sheet_date: n._sheet_date
      }));

      const allNotes = [...jobNotes, ...legacyNotes];
      const openNotes = allNotes.filter(n => n.status === 'open');
      const closedNotes = allNotes.filter(n => n.status !== 'open');

      /* ── Filter tabs ── */
      const filterHtml = `
        <div style="display:flex; gap:6px; flex-wrap:wrap;" id="notesFilterBar">
          <button class="notes-filter-btn active" data-filter="all" style="padding:5px 14px; border-radius:8px; border:1px solid var(--border); background:var(--bg-main); font-family:'Outfit',sans-serif; font-size:0.8rem; font-weight:600; cursor:pointer; transition:all 0.2s; color:var(--text-secondary);">All (${allNotes.length})</button>
          <button class="notes-filter-btn" data-filter="open" style="padding:5px 14px; border-radius:8px; border:1px solid var(--border); background:var(--bg-main); font-family:'Outfit',sans-serif; font-size:0.8rem; font-weight:600; cursor:pointer; transition:all 0.2s; color:var(--text-secondary);">🔴 Open (${openNotes.length})</button>
          <button class="notes-filter-btn" data-filter="closed" style="padding:5px 14px; border-radius:8px; border:1px solid var(--border); background:var(--bg-main); font-family:'Outfit',sans-serif; font-size:0.8rem; font-weight:600; cursor:pointer; transition:all 0.2s; color:var(--text-secondary);">✅ Closed (${closedNotes.length})</button>
        </div>`;

      /* ── Render a single note card ── */
      function noteCard(n, idx) {
        const isOpen = n.status === 'open';
        const isLegacy = !!n._legacy;
        const notified = (n.notify_people || []).map(p => typeof p === 'string' ? p : p.name).filter(Boolean);
        const replies = n.replies || [];

        const statusDot = isOpen
          ? '<span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#ef4444; margin-right:6px;" title="Open"></span>'
          : '<span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#22c55e; margin-right:6px;" title="Closed"></span>';

        const borderColor = isOpen ? 'var(--accent)' : 'var(--border)';
        const borderLeft = isOpen ? '3px solid var(--accent)' : '3px solid var(--success, #22c55e)';

        /* Notify chips */
        const notifyHtml = notified.length
          ? `<div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:8px;">${notified.map(name =>
              `<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px;background:var(--card-hover);border:1px solid var(--accent);border-radius:12px;font-size:0.7rem;font-weight:600;color:var(--accent);">🔔 ${esc(name)}</span>`
            ).join('')}</div>`
          : '';

        /* Acknowledged info */
        const ackHtml = n.acknowledged_by
          ? `<div style="margin-top:8px; font-size:0.78rem; color:var(--success, #22c55e); font-weight:600;">✅ Acknowledged by ${esc(n.acknowledged_by)} · ${timeAgo(n.acknowledged_at)}</div>`
          : '';

        /* Replies */
        const repliesHtml = replies.length
          ? `<div style="margin-top:10px; padding-top:10px; border-top:1px solid var(--border);">
              <div style="font-size:0.75rem; font-weight:700; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;">Replies (${replies.length})</div>
              ${replies.map(r => `
                <div style="padding:8px 12px; background:var(--bg-secondary); border-radius:8px; margin-bottom:6px; border-left:2px solid var(--accent);">
                  <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px; flex-wrap:wrap;">
                    <span style="font-weight:600; font-size:0.8rem; color:var(--text-primary);">${esc(r.author || '—')}</span>
                    <span style="font-size:0.72rem; color:var(--text-secondary);">${timeAgo(r.created_at)}</span>
                  </div>
                  <div style="font-size:0.85rem; color:var(--text-primary); line-height:1.5; white-space:pre-wrap;">${esc(r.text || '')}</div>
                </div>`).join('')}
            </div>`
          : '';

        /* Action buttons — only for new table notes, not legacy */
        const actionsHtml = !isLegacy ? `
          <div style="display:flex; gap:8px; margin-top:10px; flex-wrap:wrap;">
            <button class="note-reply-btn" data-note-id="${n.id}" style="padding:4px 12px; border-radius:8px; border:1px solid var(--border); background:var(--bg-secondary); font-family:'Outfit',sans-serif; font-size:0.78rem; font-weight:600; cursor:pointer; color:var(--text-secondary); transition:all 0.2s;">💬 Reply</button>
            ${isOpen
              ? `<button class="note-ack-btn" data-note-id="${n.id}" style="padding:4px 12px; border-radius:8px; border:1px solid var(--success-border, #a7f3d0); background:var(--bg-secondary); font-family:'Outfit',sans-serif; font-size:0.78rem; font-weight:600; cursor:pointer; color:var(--success, #22c55e); transition:all 0.2s;">✅ Acknowledge &amp; Close</button>`
              : `<button class="note-reopen-btn" data-note-id="${n.id}" style="padding:4px 12px; border-radius:8px; border:1px solid var(--border); background:var(--bg-secondary); font-family:'Outfit',sans-serif; font-size:0.78rem; font-weight:600; cursor:pointer; color:var(--text-secondary); transition:all 0.2s;">🔄 Reopen</button>`
            }
          </div>` : '';

        /* Source badge */
        const sourceBadge = n.job_sheet_number
          ? `<span style="font-family:'JetBrains Mono',monospace; font-size:0.7rem; color:var(--text-secondary); background:var(--bg-secondary); padding:2px 8px; border-radius:6px; border:1px solid var(--border);">${esc(n.job_sheet_number)}</span>`
          : (isLegacy ? '<span style="font-size:0.7rem; color:var(--text-secondary); background:var(--bg-secondary); padding:2px 8px; border-radius:6px; border:1px solid var(--border);">Legacy</span>' : '');

        return `<div class="note-card-item" data-status="${n.status || 'closed'}" style="background:var(--bg-main); border:1px solid var(--border); border-left:${borderLeft}; border-radius:12px; padding:1rem; transition:all 0.2s;">
          <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:8px; margin-bottom:8px; flex-wrap:wrap;">
            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
              ${statusDot}
              <span style="font-weight:700; font-size:0.88rem; color:var(--text-primary);">${esc(n.author || '—')}</span>
              <span style="font-size:0.78rem; color:var(--text-secondary);">${timeAgo(n.created_at)}</span>
            </div>
            ${sourceBadge}
          </div>
          <div style="font-size:0.9rem; color:var(--text-primary); line-height:1.6; white-space:pre-wrap;">${esc(n.text || '')}</div>
          ${notifyHtml}
          ${ackHtml}
          ${repliesHtml}
          ${actionsHtml}

          <!-- Inline reply box (hidden by default) -->
          ${!isLegacy ? `<div class="note-reply-box" data-note-id="${n.id}" style="display:none; margin-top:10px; padding-top:10px; border-top:1px solid var(--border);">
            <textarea class="note-reply-text" placeholder="Write a reply..." style="width:100%; padding:0.6rem 0.8rem; border:1px solid var(--border); border-radius:8px; font-family:'Outfit',sans-serif; font-size:0.88rem; color:var(--text-primary); background:var(--bg-secondary); min-height:60px; resize:vertical; outline:none; box-sizing:border-box;"></textarea>
            <div style="display:flex; gap:6px; justify-content:flex-end; margin-top:6px;">
              <button class="note-reply-cancel" data-note-id="${n.id}" style="padding:5px 12px; border-radius:8px; border:1px solid var(--border); background:transparent; font-family:'Outfit',sans-serif; font-size:0.8rem; font-weight:600; cursor:pointer; color:var(--text-secondary);">Cancel</button>
              <button class="note-reply-send" data-note-id="${n.id}" style="padding:5px 14px; border-radius:8px; border:none; background:linear-gradient(135deg, var(--accent) 0%, var(--accent-light) 100%); font-family:'Outfit',sans-serif; font-size:0.8rem; font-weight:600; cursor:pointer; color:white;">Send</button>
            </div>
          </div>` : ''}
        </div>`;
      }

      const cardsHtml = allNotes.length
        ? allNotes.map((n, i) => noteCard(n, i)).join('')
        : '';

      panel.innerHTML = `
        <div class="tool-card">
          <div class="tool-card-header">
            <div class="tool-card-title">Notes & Actions</div>
            <div class="tool-card-actions"><button class="btn-add" id="notesAddBtn">+ Add Note</button></div>
          </div>
          ${allNotes.length ? filterHtml : ''}
          <div id="notesCardList" style="display:flex; flex-direction:column; gap:8px; margin-top:${allNotes.length ? '12px' : '0'};">
            ${cardsHtml || `<div class="empty-state"><div class="empty-state-icon">📝</div><div class="empty-state-text">No notes yet</div></div>`}
          </div>
        </div>

        <!-- Add Note Modal -->
        <div id="notesModal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:9000; align-items:center; justify-content:center; padding:1rem;">
          <div style="background:var(--bg-secondary); border-radius:16px; max-width:560px; width:100%; max-height:90vh; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 20px 60px rgba(0,0,0,0.4);">
            <div style="padding:1.25rem 1.5rem; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
              <div style="font-size:1.1rem; font-weight:700; color:var(--text-primary);">📝 Add Note</div>
              <button id="notesModalClose" style="background:none; border:none; font-size:1.5rem; color:var(--text-secondary); cursor:pointer; padding:0; width:32px; height:32px; line-height:32px;">&times;</button>
            </div>
            <div style="padding:1.5rem; overflow-y:auto; flex:1;">
              <div style="margin-bottom:1.25rem;">
                <label style="display:block; font-size:0.875rem; font-weight:600; color:var(--text-primary); margin-bottom:0.5rem;">Note <span style="color:var(--accent);">*</span></label>
                <textarea id="noteModalText" placeholder="e.g. things to pass on, items to order, tasks completed..." style="width:100%; padding:0.75rem 1rem; border:1px solid var(--border); border-radius:10px; font-family:'Outfit',sans-serif; font-size:1rem; color:var(--text-primary); background:var(--bg-secondary); min-height:100px; resize:vertical; outline:none; box-sizing:border-box; transition:border-color 0.3s;" onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='var(--border)'"></textarea>
              </div>
              <div>
                <label style="display:block; font-size:0.875rem; font-weight:600; color:var(--text-primary); margin-bottom:0.5rem;">Notify Staff <span style="font-weight:400; color:var(--text-secondary);">(optional)</span></label>
                <div id="noteModalEmployees" style="max-height:200px; overflow-y:auto; border:1px solid var(--border); border-radius:10px; background:var(--bg-main); padding:6px; display:grid; grid-template-columns:repeat(auto-fill, minmax(160px, 1fr)); gap:4px;">
                  <div style="padding:0.75rem; color:var(--text-secondary); font-size:0.85rem; grid-column:1/-1;">Loading employees...</div>
                </div>
                <div id="noteModalSelected" style="margin-top:6px; font-size:0.75rem; color:var(--text-secondary);"></div>
              </div>
            </div>
            <div style="padding:1rem 1.5rem; border-top:1px solid var(--border); background:var(--bg-main); display:flex; gap:0.75rem; justify-content:flex-end;">
              <button id="notesModalCancel" class="btn-secondary" style="padding:0.625rem 1.25rem;">Cancel</button>
              <button id="notesModalSave" class="submit-btn" style="padding:0.625rem 1.5rem;">Save Note</button>
            </div>
          </div>
        </div>`;

      /* ── WIRE: Filter buttons ── */
      panel.querySelectorAll('.notes-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          panel.querySelectorAll('.notes-filter-btn').forEach(b => {
            b.classList.remove('active');
            b.style.background = 'var(--bg-main)';
            b.style.color = 'var(--text-secondary)';
            b.style.borderColor = 'var(--border)';
          });
          btn.classList.add('active');
          btn.style.background = 'var(--card-hover)';
          btn.style.color = 'var(--accent)';
          btn.style.borderColor = 'var(--accent)';
          const filter = btn.dataset.filter;
          panel.querySelectorAll('.note-card-item').forEach(card => {
            if (filter === 'all') card.style.display = '';
            else card.style.display = card.dataset.status === filter ? '' : 'none';
          });
        });
        /* Set initial active style */
        if (btn.classList.contains('active')) {
          btn.style.background = 'var(--card-hover)';
          btn.style.color = 'var(--accent)';
          btn.style.borderColor = 'var(--accent)';
        }
      });

      /* ── WIRE: Reply toggle ── */
      panel.querySelectorAll('.note-reply-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const box = panel.querySelector(`.note-reply-box[data-note-id="${btn.dataset.noteId}"]`);
          if (box) {
            box.style.display = box.style.display === 'none' ? 'block' : 'none';
            if (box.style.display === 'block') box.querySelector('.note-reply-text').focus();
          }
        });
      });
      panel.querySelectorAll('.note-reply-cancel').forEach(btn => {
        btn.addEventListener('click', () => {
          const box = panel.querySelector(`.note-reply-box[data-note-id="${btn.dataset.noteId}"]`);
          if (box) { box.style.display = 'none'; box.querySelector('.note-reply-text').value = ''; }
        });
      });

      /* ── WIRE: Reply send ── */
      panel.querySelectorAll('.note-reply-send').forEach(btn => {
        btn.addEventListener('click', async () => {
          const noteId = btn.dataset.noteId;
          const box = panel.querySelector(`.note-reply-box[data-note-id="${noteId}"]`);
          const text = box.querySelector('.note-reply-text').value.trim();
          if (!text) { window.BromarHub?.showInfo?.('Please enter a reply'); return; }
          btn.disabled = true; btn.textContent = 'Sending...';
          try {
            const user = JM.ensureCurrentUser();
            const { data: existing, error: fetchErr } = await JM.sb()
              .from('job_notes').select('replies').eq('id', noteId).single();
            if (fetchErr) throw fetchErr;
            const replies = Array.isArray(existing.replies) ? existing.replies : [];
            replies.push({ author: user?.name || 'Unknown', text, created_at: new Date().toISOString() });
            const { error: updErr } = await JM.sb()
              .from('job_notes').update({ replies }).eq('id', noteId);
            if (updErr) throw updErr;
            window.BromarHub?.showSuccess?.('Reply added');
            await refreshTab(jobNumber);
          } catch (err) {
            console.error('[Notes] Reply failed:', err);
            window.BromarHub?.showInfo?.('Failed to send reply: ' + (err.message || err));
          } finally { btn.disabled = false; btn.textContent = 'Send'; }
        });
      });

      /* ── WIRE: Acknowledge & Close ── */
      panel.querySelectorAll('.note-ack-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const noteId = btn.dataset.noteId;
          btn.disabled = true; btn.textContent = 'Closing...';
          try {
            const user = JM.ensureCurrentUser();
            const { error } = await JM.sb().from('job_notes').update({
              status: 'closed',
              acknowledged_by: user?.name || 'Unknown',
              acknowledged_at: new Date().toISOString()
            }).eq('id', noteId);
            if (error) throw error;
            window.BromarHub?.showSuccess?.('Note acknowledged & closed');
            await refreshTab(jobNumber);
          } catch (err) {
            console.error('[Notes] Acknowledge failed:', err);
            window.BromarHub?.showInfo?.('Failed to close note: ' + (err.message || err));
          } finally { btn.disabled = false; btn.textContent = '✅ Acknowledge & Close'; }
        });
      });

      /* ── WIRE: Reopen ── */
      panel.querySelectorAll('.note-reopen-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const noteId = btn.dataset.noteId;
          btn.disabled = true; btn.textContent = 'Reopening...';
          try {
            const { error } = await JM.sb().from('job_notes').update({
              status: 'open',
              acknowledged_by: null,
              acknowledged_at: null
            }).eq('id', noteId);
            if (error) throw error;
            window.BromarHub?.showSuccess?.('Note reopened');
            await refreshTab(jobNumber);
          } catch (err) {
            console.error('[Notes] Reopen failed:', err);
            window.BromarHub?.showInfo?.('Failed to reopen note: ' + (err.message || err));
          } finally { btn.disabled = false; btn.textContent = '🔄 Reopen'; }
        });
      });

      /* ── WIRE: Add Note Modal ── */
      const modal = panel.querySelector('#notesModal');
      const openModal = () => {
        const empContainer = panel.querySelector('#noteModalEmployees');
        empContainer.innerHTML = empGridHtml();
        wireEmpCheckboxes(empContainer, panel.querySelector('#noteModalSelected'));
        panel.querySelector('#noteModalText').value = '';
        panel.querySelector('#noteModalSelected').textContent = '';
        modal.style.display = 'flex';
        setTimeout(() => panel.querySelector('#noteModalText').focus(), 50);
      };
      const closeModal = () => { modal.style.display = 'none'; };

      panel.querySelector('#notesAddBtn').addEventListener('click', openModal);
      panel.querySelector('#notesModalClose').addEventListener('click', closeModal);
      panel.querySelector('#notesModalCancel').addEventListener('click', closeModal);
      modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

      /* ── WIRE: Save Note (to job_notes table) ── */
      panel.querySelector('#notesModalSave').addEventListener('click', async () => {
        const text = panel.querySelector('#noteModalText').value.trim();
        if (!text) { window.BromarHub?.showInfo?.('Please enter a note'); return; }

        const notifyPeople = Array.from(panel.querySelectorAll('.note-modal-cb:checked')).map(cb => ({
          name: cb.value, email: cb.dataset.email || ''
        }));

        const saveBtn = panel.querySelector('#notesModalSave');
        saveBtn.disabled = true; saveBtn.textContent = 'Saving...';

        try {
          const user = JM.ensureCurrentUser();
          const { error } = await JM.sb().from('job_notes').insert({
            job_number: jobNumber,
            text: text,
            author: user?.name || 'Unknown',
            notify_people: notifyPeople,
            status: 'open',
            replies: [],
            created_at: new Date().toISOString()
          });
          if (error) throw error;
          closeModal();
          window.BromarHub?.showSuccess?.('Note saved');
          await refreshTab(jobNumber);
        } catch (err) {
          console.error('[Notes] Save failed:', err);
          window.BromarHub?.showInfo?.('Failed to save note: ' + (err.message || err));
        } finally { saveBtn.disabled = false; saveBtn.textContent = 'Save Note'; }
      });

      /* ── Refresh helper ── */
      async function refreshTab(jobNum) {
        await JM.loadJobData(jobNum);
        JM.updateCounts();
        JM.renderTool();
      }
    }
  });
})();
