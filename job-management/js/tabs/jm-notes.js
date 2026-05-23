/* ── TAB: Notes ── */
(function () {
  const JM = window.JobManager;
  const { esc, fmtDate } = JM;

  JM.registerTool('notes', {
    label: 'Notes', icon: '📝',
    count: d => d.notes.length,

    render(panel, d, job) {
      const rows = d.notes;

      /* ── table body ── */
      const body = rows.map((n, idx) => {
        const notified = (n.notifyPeople || []).map(p => typeof p === 'string' ? p : p.name).filter(Boolean);
        const notifyHtml = notified.length
          ? `<div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:4px;">${notified.map(name =>
              `<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px;background:var(--card-hover);border:1px solid var(--accent);border-radius:12px;font-size:0.7rem;font-weight:600;color:var(--accent);">🔔 ${esc(name)}</span>`
            ).join('')}</div>`
          : '';
        return `<tr>
          <td style="white-space:nowrap;">${fmtDate(n._sheet_date)}</td>
          <td style="white-space:nowrap;">${esc(n.author || n.created_by || '—')}</td>
          <td>
            <div>${esc(n.note || n.text || n.content || '—')}</div>
            ${notifyHtml}
          </td>
          <td><span style="font-family:'JetBrains Mono',monospace;font-size:0.75rem;color:var(--text-secondary);">${esc(n._sheet)}</span></td>
        </tr>`;
      }).join('');

      panel.innerHTML = `
        <div class="tool-card">
          <div class="tool-card-header">
            <div class="tool-card-title">Notes</div>
            <div class="tool-card-actions"><button class="btn-add" id="notesAddBtn">+ Add Note</button></div>
          </div>
          ${rows.length
            ? `<div class="data-table-wrapper"><table class="data-table"><thead><tr><th>Date</th><th>Author</th><th>Note</th><th>Sheet</th></tr></thead><tbody>${body}</tbody></table></div>`
            : `<div class="empty-state"><div class="empty-state-icon">📝</div><div class="empty-state-text">No notes yet</div></div>`}
        </div>

        <!-- Add Note Modal -->
        <div id="notesModal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:9000; align-items:center; justify-content:center; padding:1rem;">
          <div style="background:var(--bg-secondary); border-radius:16px; max-width:560px; width:100%; max-height:90vh; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 20px 60px rgba(0,0,0,0.4);">
            <!-- Header -->
            <div style="padding:1.25rem 1.5rem; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
              <div style="font-size:1.1rem; font-weight:700; color:var(--text-primary);">📝 Add Note</div>
              <button id="notesModalClose" style="background:none; border:none; font-size:1.5rem; color:var(--text-secondary); cursor:pointer; padding:0; width:32px; height:32px; line-height:32px;">&times;</button>
            </div>
            <!-- Body -->
            <div style="padding:1.5rem; overflow-y:auto; flex:1;">
              <div style="margin-bottom:1.25rem;">
                <label style="display:block; font-size:0.875rem; font-weight:600; color:var(--text-primary); margin-bottom:0.5rem;">Note <span style="color:var(--accent);">*</span></label>
                <textarea id="noteModalText" placeholder="e.g. things to pass on, items to order, tasks completed..." style="width:100%; padding:0.75rem 1rem; border:1px solid var(--border); border-radius:10px; font-family:'Outfit',sans-serif; font-size:1rem; color:var(--text-primary); background:var(--bg-secondary); min-height:100px; resize:vertical; outline:none; box-sizing:border-box; transition:border-color 0.3s;" onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='var(--border)'"></textarea>
              </div>
              <div>
                <label style="display:block; font-size:0.875rem; font-weight:600; color:var(--text-primary); margin-bottom:0.5rem;">Notify Staff <span style="font-weight:400; color:var(--text-secondary);">(optional — select who should be notified)</span></label>
                <div id="noteModalEmployees" style="max-height:200px; overflow-y:auto; border:1px solid var(--border); border-radius:10px; background:var(--bg-main); padding:6px; display:grid; grid-template-columns:1fr 1fr; gap:4px;">
                  <div style="padding:0.75rem; color:var(--text-secondary); font-size:0.85rem; grid-column:1/-1;">Loading employees...</div>
                </div>
                <div id="noteModalSelected" style="margin-top:6px; font-size:0.75rem; color:var(--text-secondary);"></div>
              </div>
            </div>
            <!-- Footer -->
            <div style="padding:1rem 1.5rem; border-top:1px solid var(--border); background:var(--bg-main); display:flex; gap:0.75rem; justify-content:flex-end;">
              <button id="notesModalCancel" class="btn-secondary" style="padding:0.625rem 1.25rem;">Cancel</button>
              <button id="notesModalSave" class="submit-btn" style="padding:0.625rem 1.5rem;">Save Note</button>
            </div>
          </div>
        </div>`;

      /* ── Wire modal open/close ── */
      const modal = panel.querySelector('#notesModal');
      const openModal = () => {
        buildEmployeeList();
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

      /* ── Build employee checkboxes ── */
      function buildEmployeeList() {
        const emps = window.EMPLOYEES || [];
        const container = panel.querySelector('#noteModalEmployees');
        if (!emps.length) {
          container.innerHTML = '<div style="padding:0.75rem; color:var(--text-secondary); font-size:0.85rem; grid-column:1/-1;">No employees loaded</div>';
          return;
        }
        container.innerHTML = emps.map(e => `
          <label style="display:flex; align-items:center; gap:8px; padding:6px 10px; border-radius:8px; cursor:pointer; font-size:0.85rem; font-weight:400; border:1px solid transparent; transition:all 0.15s;" class="note-emp-label">
            <input type="checkbox" class="note-modal-cb" value="${esc(e.full_name)}" data-email="${esc(e.email || '')}"
              style="accent-color:var(--accent); width:15px; height:15px; cursor:pointer;"/>
            ${esc(e.full_name)}
          </label>`).join('');

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
            updateSelectedDisplay();
          });
        });
      }

      function updateSelectedDisplay() {
        const selected = Array.from(panel.querySelectorAll('.note-modal-cb:checked')).map(cb => cb.value);
        panel.querySelector('#noteModalSelected').textContent = selected.length
          ? `Notifying: ${selected.join(', ')}`
          : '';
      }

      /* ── Save note ── */
      panel.querySelector('#notesModalSave').addEventListener('click', async () => {
        const text = panel.querySelector('#noteModalText').value.trim();
        if (!text) {
          window.BromarHub?.showInfo?.('Please enter a note');
          return;
        }

        const notifyPeople = Array.from(panel.querySelectorAll('.note-modal-cb:checked')).map(cb => ({
          name: cb.value,
          email: cb.dataset.email || ''
        }));

        const saveBtn = panel.querySelector('#notesModalSave');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        try {
          const user = JM.ensureCurrentUser();
          const jobNumber = job.job_number;

          /* Find the most recent sheet for this job */
          const { data: sheets, error: sheetErr } = await JM.sb()
            .from('job_sheets')
            .select('id, job_sheet_number, notes')
            .eq('job_number', jobNumber)
            .order('sheet_date', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(1);

          if (sheetErr) throw sheetErr;
          if (!sheets || !sheets.length) {
            window.BromarHub?.showInfo?.('No job sheets found for this job — submit a job sheet first');
            return;
          }

          const sheet = sheets[0];
          const existingNotes = Array.isArray(sheet.notes) ? sheet.notes : [];
          const newNote = {
            text: text,
            notifyPeople: notifyPeople,
            author: user?.name || 'Unknown',
            created_at: new Date().toISOString()
          };
          existingNotes.push(newNote);

          const { error: updateErr } = await JM.sb()
            .from('job_sheets')
            .update({ notes: existingNotes })
            .eq('id', sheet.id);

          if (updateErr) throw updateErr;

          closeModal();
          window.BromarHub?.showSuccess?.('Note saved');

          /* Refresh the tab data and re-render */
          const freshData = await JM.loadJobData(jobNumber);
          JM.state.jobCache = freshData;
          JM.updateCounts();
          JM.renderTool();

        } catch (err) {
          console.error('[Notes] Save failed:', err);
          window.BromarHub?.showInfo?.('Failed to save note: ' + (err.message || err));
        } finally {
          saveBtn.disabled = false;
          saveBtn.textContent = 'Save Note';
        }
      });
    }
  });
})();
