/* ============================================================
   SCHEDULING PAGE — Bromar Ops
   Employee job scheduling with Supabase persistence,
   drag-drop (desktop), mobile day-view with swipe,
   notification queue. Assignment types: one-off, duration,
   indefinite. Linked to schedule_assignments, client_sites,
   clients tables. Jobs table optional.
   V1.17
   ============================================================ */
window.BromarPages = window.BromarPages || {};
window.BromarPages.scheduling = (() => {

  const PAGE_VERSION = 'V1.17';

  /* ── SUPABASE CONFIG ── */
  const SUPABASE_URL = 'https://iwtvlpfprxqwveqadlwl.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3dHZscGZwcnhxd3ZlcWFkbHdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1MzczMDQsImV4cCI6MjA5MzExMzMwNH0.X6tOhxgFnJDDipltIuILOaZRv4bM4RE9kVV1R_UsE5k';
  let supabase = null;
  function getSupabase() {
    if (supabase) return supabase;
    if (window.supabaseClient) { supabase = window.supabaseClient; return supabase; }
    if (window.supabase?.createClient) { supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); return supabase; }
    return null;
  }

  /* ── STATE ── */
  let employees = [];
  let jobs = [];
  let sites = [];
  let assignments = [];
  let notificationQueue = [];
  let currentWeekStart = null;
  let mobileSelectedDate = null;
  let showWeekends = false;
  let dragData = null;
  let filterRole = 'all';
  let searchTerm = '';
  let activeModal = null;
  let hiddenEmployees = new Set();
  let mobileExpandedEmp = null;
  let mobileShowFilters = false;
  let touchStartX = 0;
  let touchStartY = 0;
  let containerRef = null;

  function isMobile() { return window.innerWidth <= 900; }

  /* ── DATA LAYER ── */
  const DB = {
    async init() {
      if (!window.supabase && !window.supabaseClient) {
        await new Promise((res, rej) => {
          const s = document.createElement('script');
          s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
          s.onload = res;
          s.onerror = () => rej(new Error('Failed to load Supabase SDK'));
          document.head.appendChild(s);
        });
      }
      const sb = getSupabase();
      if (!sb) throw new Error('Supabase unavailable');
      return sb;
    },

    async fetchEmployees() {
      try {
        const sb = await this.init();
        const { data, error } = await sb.from('employees')
          .select('full_name, first_name, last_name, role, a_grade, is_active')
          .eq('is_active', true)
          .order('full_name');
        if (error) throw error;
        return (data || []).map((e, i) => ({
          id: 'emp-' + i,
          name: e.full_name || `${e.first_name || ''} ${e.last_name || ''}`.trim(),
          firstName: e.first_name || '',
          lastName: e.last_name || '',
          role: e.role || 'unassigned',
          aGrade: !!e.a_grade,
          avatar: ((e.first_name || '?')[0] + (e.last_name || '?')[0]).toUpperCase()
        }));
      } catch (err) {
        console.error('Employee fetch failed:', err);
        return [];
      }
    },

    async fetchJobs() {
      try {
        const sb = await this.init();
        const { data, error } = await sb.from('jobs').select('*').order('created_at', { ascending: false });
        if (error) {
          if (error.code === '42P01' || error.message?.includes('does not exist')) {
            console.warn('Jobs table does not exist yet');
            return [];
          }
          throw error;
        }
        return (data || []).map(j => ({
          number: j.job_number || j.number || '?',
          client: j.client_name || j.client || '',
          site: j.site_name || j.site_address || j.site || '',
          status: j.status || 'active',
          priority: j.priority || 'medium'
        }));
      } catch (err) {
        console.warn('Jobs fetch failed:', err.message);
        return [];
      }
    },

    async fetchSites() {
      try {
        const sb = await this.init();
        const { data, error } = await sb.from('client_sites')
          .select('id, site_name, address, city, client_id, is_active, clients(name)')
          .eq('is_active', true)
          .order('site_name');
        if (error) throw error;
        return (data || []).map(s => ({
          id: s.id,
          name: s.site_name,
          address: s.address || '',
          city: s.city || '',
          clientId: s.client_id,
          clientName: s.clients?.name || ''
        }));
      } catch (err) {
        console.warn('Sites fetch failed:', err.message);
        return [];
      }
    },

    async fetchAssignments() {
      try {
        const sb = await this.init();
        const { data, error } = await sb.from('schedule_assignments').select('*').eq('is_active', true);
        if (error) {
          if (error.code === '42P01' || error.message?.includes('does not exist')) {
            console.warn('schedule_assignments table does not exist yet — run the migration SQL');
            return [];
          }
          throw error;
        }
        return (data || []).map(a => ({
          id: a.id,
          employeeName: a.employee_name,
          type: a.type || 'job',
          jobNumber: a.job_number || null,
          siteId: a.site_id || null,
          siteName: a.site_name || null,
          clientName: a.client_name || null,
          schedule: a.schedule || 'oneoff',
          startDate: a.start_date,
          endDate: a.end_date || null,
          skipDates: parseJsonb(a.skip_dates, []),
          notes: a.notes || '',
          recentlyChanged: false
        }));
      } catch (err) {
        console.warn('Assignments fetch failed:', err.message);
        return [];
      }
    },

    async saveAssignment(a) {
      try {
        const sb = await this.init();
        const row = {
          employee_name: a.employeeName,
          type: a.type,
          job_number: a.jobNumber || null,
          site_id: a.siteId || null,
          site_name: a.siteName || null,
          client_name: a.clientName || null,
          schedule: a.schedule,
          start_date: a.startDate,
          end_date: a.endDate || null,
          skip_dates: JSON.stringify(a.skipDates || []),
          notes: a.notes || null,
          is_active: true
        };
        if (a.id && !a.id.startsWith('local-')) {
          const { data, error } = await sb.from('schedule_assignments').update(row).eq('id', a.id).select();
          if (error) throw error;
          return data?.[0] || null;
        } else {
          const { data, error } = await sb.from('schedule_assignments').insert(row).select();
          if (error) throw error;
          if (data?.[0]) a.id = data[0].id;
          return data?.[0] || null;
        }
      } catch (err) {
        console.error('Save assignment failed:', err);
        if (!a.id) a.id = 'local-' + uid();
        return null;
      }
    },

    async deleteAssignment(id) {
      if (id.startsWith('local-')) { assignments = assignments.filter(a => a.id !== id); return; }
      try {
        const sb = await this.init();
        await sb.from('schedule_assignments').update({ is_active: false }).eq('id', id);
      } catch (err) { console.error('Delete failed:', err); }
      assignments = assignments.filter(a => a.id !== id);
    },

    async updateSkipDates(id, skipDates) {
      if (id.startsWith('local-')) return;
      try {
        const sb = await this.init();
        await sb.from('schedule_assignments').update({ skip_dates: JSON.stringify(skipDates) }).eq('id', id);
      } catch (err) { console.error('Update skip dates failed:', err); }
    },

    async endAssignment(id, endDate) {
      if (id.startsWith('local-')) return;
      try {
        const sb = await this.init();
        await sb.from('schedule_assignments').update({ end_date: endDate }).eq('id', id);
      } catch (err) { console.error('End assignment failed:', err); }
    }
  };

  function parseJsonb(val, fallback) {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') { try { return JSON.parse(val); } catch { return fallback; } }
    return fallback;
  }

  /* ── HELPERS ── */
  function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }
  function getMonday(d) { const dt = new Date(d); const day = dt.getDay(); dt.setDate(dt.getDate() - day + (day === 0 ? -6 : 1)); dt.setHours(0, 0, 0, 0); return dt; }
  function formatDate(d) { const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return `${d.getDate()} ${m[d.getMonth()]}`; }
  function formatDateFull(d) { const m = ['January','February','March','April','May','June','July','August','September','October','November','December']; const dn = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']; return `${dn[d.getDay()]}, ${d.getDate()} ${m[d.getMonth()]}`; }
  function formatDateKey(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  function parseDateKey(dk) { const p = dk.split('-'); return new Date(+p[0], +p[1]-1, +p[2]); }
  function getDaysOfWeek() { const days = []; const s = new Date(currentWeekStart); for (let i = 0; i < (showWeekends ? 7 : 5); i++) { const d = new Date(s); d.setDate(s.getDate() + i); days.push(d); } return days; }
  function isToday(d) { const t = new Date(); return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate(); }
  function isWeekday(dk) { const d = parseDateKey(dk); const day = d.getDay(); return day >= 1 && day <= 5; }
  function priorityColor(p) { return p === 'high' ? 'var(--error)' : p === 'medium' ? 'var(--accent)' : 'var(--success)'; }
  function timeSince(ts) { const s = Math.floor((Date.now() - ts) / 1000); if (s < 60) return 'just now'; if (s < 3600) return `${Math.floor(s/60)}m ago`; if (s < 86400) return `${Math.floor(s/3600)}h ago`; return `${Math.floor(s/86400)}d ago`; }
  async function queueNotification(empName, message) {
    const notif = { id: uid(), employeeName: empName, message, timestamp: Date.now(), sent: false };
    notificationQueue.push(notif);
    try {
      const sb = await DB.init();
      await sb.from('notifications').insert({ employee_name: empName, message, type: 'schedule_change' });
    } catch (err) { console.warn('Failed to save notification:', err); }
  }
  function roleLabel(r) { return { electrician: 'Electrician', senior_electrician: 'Senior Electrician', apprentice: 'Apprentice', engineer: 'Engineer', unassigned: 'Unassigned' }[r] || r; }
  function roleColor(r) { return { electrician: 'var(--accent)', senior_electrician: '#8b5cf6', apprentice: '#0ea5e9', engineer: '#10b981', unassigned: 'var(--text-secondary)' }[r] || 'var(--text-secondary)'; }
  function getFilteredEmployees() {
    let f = filterRole === 'all' ? [...employees] : employees.filter(e => e.role === filterRole);
    if (searchTerm) { const q = searchTerm.toLowerCase(); f = f.filter(e => e.name.toLowerCase().includes(q)); }
    f = f.filter(e => !hiddenEmployees.has(e.id));
    return f;
  }
  function getMobileDateKey() { return mobileSelectedDate ? formatDateKey(mobileSelectedDate) : formatDateKey(new Date()); }
  function unsent() { return notificationQueue.filter(n => !n.sent).length; }

  /* ── ASSIGNMENT RESOLUTION ── */
  function getEffectiveAssignments(empName, dateKey) {
    const results = [];
    for (const a of assignments) {
      if (a.employeeName !== empName) continue;
      if (a.schedule === 'oneoff') {
        if (a.startDate === dateKey) results.push({ ...a, effective: true, linked: false });
        continue;
      }
      if (dateKey < a.startDate) continue;
      if (a.endDate && dateKey > a.endDate) continue;
      if (!isWeekday(dateKey)) continue;
      if (a.skipDates && a.skipDates.includes(dateKey)) continue;
      results.push({ ...a, effective: true, linked: true });
    }
    return results;
  }

  function getAssignmentLabel(a) {
    if (a.type === 'leave') return a.siteName || 'Leave';
    if (a.type === 'site') return a.siteName || '?';
    return a.jobNumber || '?';
  }
  function getAssignmentSub(a) {
    if (a.type === 'leave') return 'Leave';
    if (a.type === 'site') return a.clientName || 'Site';
    const job = jobs.find(j => j.number === a.jobNumber);
    return job?.client || a.clientName || '';
  }
  function getAssignmentBorderColor(a) {
    if (a.type === 'leave') return leaveColor(a.siteName);
    if (a.type === 'site') return '#0ea5e9';
    const job = jobs.find(j => j.number === a.jobNumber);
    return priorityColor(job?.priority || 'medium');
  }
  function scheduleLabel(s) { return { oneoff: 'One-off', duration: 'Duration', indefinite: 'Indefinite' }[s] || s; }
  function leaveColor(lt) { return { 'RDO': '#8b5cf6', 'Annual Leave': '#14b8a6', 'Sick Leave': 'var(--error)' }[lt] || '#8b5cf6'; }
  function empHasAssignmentsInWeek(empName) {
    const days = getDaysOfWeek();
    return days.some(d => getEffectiveAssignments(empName, formatDateKey(d)).length > 0);
  }

  function getUnassignedJobs() {
    const assigned = new Set(assignments.filter(a => a.type === 'job').map(a => a.jobNumber));
    return jobs.filter(j => !assigned.has(j.number) && (j.status === 'active' || j.status === 'in_progress'));
  }
  function searchJobsLocal(query) {
    const pool = jobs.filter(j => j.status === 'active' || j.status === 'in_progress');
    if (!query) return pool.slice(0, 12);
    const q = query.toLowerCase();
    return pool.filter(j => j.number.toLowerCase().includes(q) || j.client.toLowerCase().includes(q) || j.site.toLowerCase().includes(q));
  }
  function searchSitesLocal(query) {
    if (!query) return sites.slice(0, 12);
    const q = query.toLowerCase();
    return sites.filter(s => s.name.toLowerCase().includes(q) || s.clientName.toLowerCase().includes(q) || s.address.toLowerCase().includes(q));
  }

  const CHAIN_ICON = `<svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6.5 9.5a3 3 0 004 .5l1.5-1.5a3 3 0 00-4.25-4.25L6.75 5.25"/><path d="M9.5 6.5a3 3 0 00-4-.5L4 7.5a3 3 0 004.25 4.25L9.25 10.75"/></svg>`;

  /* ── STYLES ── */
  function injectStyles() {
    if (document.getElementById('sched-styles')) return;
    const style = document.createElement('style');
    style.id = 'sched-styles';
    style.textContent = `
      .sched-input{font-family:'Outfit',sans-serif;font-size:0.875rem;padding:0.5rem 0.75rem;border-radius:var(--radius-sm);border:1px solid var(--border);background:var(--bg-secondary);color:var(--text-primary);outline:none;transition:border 0.2s}
      .sched-input:focus{border-color:var(--accent)}
      .sched-select{font-family:'Outfit',sans-serif;font-size:0.875rem;padding:0.5rem 0.75rem;border-radius:var(--radius-sm);border:1px solid var(--border);background:var(--bg-secondary);color:var(--text-primary);outline:none;cursor:pointer}
      .sched-empty{text-align:center;padding:1.5rem;color:var(--text-secondary);font-size:0.85rem}
      .sched-badge{font-size:0.65rem;background:var(--accent);color:white;border-radius:10px;padding:0.1rem 0.45rem;font-weight:700;min-width:18px;text-align:center}
      .sched-conflict{margin-top:0.5rem;padding:0.5rem 0.75rem;border-radius:8px;background:var(--error-bg);color:var(--error);font-size:0.78rem;font-weight:500}
      .sched-priority-tag{font-size:0.65rem;font-weight:600;padding:0.15rem 0.45rem;border-radius:4px;text-transform:uppercase;letter-spacing:0.03em}
      .sched-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:1000;display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease}
      .sched-modal{background:var(--bg-secondary);border:1px solid var(--border);border-radius:16px;padding:1.75rem;width:90%;max-width:500px;box-shadow:0 20px 60px var(--shadow);animation:fadeIn 0.3s ease;max-height:90vh;overflow-y:auto}
      .sched-modal h3{font-size:1.1rem;font-weight:700;margin-bottom:1rem;color:var(--text-primary)}
      .sched-modal-close{float:right;background:none;border:none;font-size:1.3rem;cursor:pointer;color:var(--text-secondary);line-height:1}
      .sched-modal-close:hover{color:var(--text-primary)}
      .sched-modal label{display:block;font-size:0.8rem;font-weight:600;color:var(--text-secondary);margin-bottom:0.3rem;margin-top:0.75rem}
      .sched-modal .sched-input,.sched-modal .sched-select{width:100%}
      .sched-job-results{max-height:180px;overflow-y:auto;margin-top:0.4rem;display:flex;flex-direction:column;gap:0.3rem}
      .sched-job-result{padding:0.5rem 0.6rem;border-radius:6px;border:1px solid var(--border);background:var(--bg-main);cursor:pointer;transition:border-color 0.15s;display:flex;justify-content:space-between;align-items:center}
      .sched-job-result:hover{border-color:var(--accent)}
      .sched-job-result.selected{border-color:var(--accent);background:var(--card-hover)}
      .sched-job-result .jr-num{font-weight:700;font-family:'JetBrains Mono',monospace;font-size:0.8rem}
      .sched-job-result .jr-client{font-size:0.75rem;color:var(--text-secondary)}
      .sched-site-result{padding:0.5rem 0.6rem;border-radius:6px;border:1px solid var(--border);background:var(--bg-main);cursor:pointer;transition:border-color 0.15s;display:flex;flex-direction:column;gap:2px}
      .sched-site-result:hover{border-color:#0ea5e9}
      .sched-site-result.selected{border-color:#0ea5e9;background:rgba(14,165,233,0.06)}
      .sched-site-result .sr-name{font-weight:700;font-size:0.8rem}
      .sched-site-result .sr-client{font-size:0.7rem;color:var(--text-secondary)}
      .sched-site-result .sr-addr{font-size:0.65rem;color:var(--text-secondary);font-style:italic}
      .sched-modal-actions{display:flex;gap:0.5rem;margin-top:1.25rem;justify-content:flex-end}
      .sched-modal-tabs{display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:1rem}
      .sched-modal-tab{padding:0.5rem 1rem;font-size:0.85rem;font-weight:600;color:var(--text-secondary);cursor:pointer;border:none;background:none;border-bottom:2px solid transparent;margin-bottom:-2px;transition:all 0.2s;font-family:'Outfit',sans-serif}
      .sched-modal-tab:hover{color:var(--text-primary)}
      .sched-modal-tab.active{color:var(--accent);border-bottom-color:var(--accent)}
      .sched-schedule-type{display:flex;gap:0.4rem;margin-top:0.4rem}
      .sched-stype-btn{flex:1;padding:0.5rem;border-radius:8px;border:1px solid var(--border);background:var(--bg-main);font-family:'Outfit',sans-serif;font-size:0.75rem;font-weight:600;color:var(--text-secondary);cursor:pointer;text-align:center;transition:all 0.15s}
      .sched-stype-btn:hover{border-color:var(--accent);color:var(--text-primary)}
      .sched-stype-btn.active{border-color:var(--accent);background:var(--card-hover);color:var(--accent)}
      .sched-date-row{display:flex;gap:0.5rem;margin-top:0.4rem}
      .sched-date-row .sched-input{flex:1}
      .sched-leave-types{display:flex;flex-direction:column;gap:0.4rem;margin-top:0.4rem}
      .sched-leave-btn{padding:0.65rem 0.75rem;border-radius:8px;border:1px solid var(--border);background:var(--bg-main);font-family:'Outfit',sans-serif;font-size:0.85rem;font-weight:600;color:var(--text-secondary);cursor:pointer;text-align:left;transition:all 0.15s}
      .sched-leave-btn:hover{border-color:var(--lc);color:var(--text-primary)}
      .sched-leave-btn.active{border-color:var(--lc);background:color-mix(in srgb,var(--lc) 8%,transparent);color:var(--lc)}
      .sched-toolbar{display:flex;flex-wrap:wrap;gap:0.75rem;align-items:center;margin-bottom:1.25rem}
      .sched-toolbar-group{display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap}
      .sched-week-nav{display:flex;align-items:center;gap:0.5rem}
      .sched-week-label{font-weight:600;font-size:0.95rem;min-width:180px;text-align:center;color:var(--text-primary)}
      .sched-nav-btn{width:36px;height:36px;border-radius:var(--radius-sm);border:1px solid var(--border);background:var(--bg-secondary);color:var(--text-primary);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;font-size:1.1rem}
      .sched-nav-btn:hover{border-color:var(--accent);background:var(--card-hover)}
      .sched-toggle{display:flex;align-items:center;gap:0.4rem;font-size:0.85rem;color:var(--text-secondary);cursor:pointer;user-select:none}
      .sched-toggle input{accent-color:var(--accent);cursor:pointer}
      .sched-hidden-bar{display:flex;flex-wrap:wrap;gap:0.4rem;align-items:center;margin-bottom:1rem;padding:0.6rem 0.75rem;border-radius:var(--radius-sm);background:var(--bg-secondary);border:1px solid var(--border);font-size:0.8rem}
      .sched-hidden-bar .hidden-label{color:var(--text-secondary);font-weight:600;font-size:0.75rem;margin-right:0.25rem}
      .sched-hidden-chip{display:flex;align-items:center;gap:0.3rem;padding:0.2rem 0.5rem;border-radius:6px;background:var(--bg-main);border:1px solid var(--border);font-size:0.75rem;color:var(--text-primary);cursor:pointer;transition:border-color 0.15s}
      .sched-hidden-chip:hover{border-color:var(--accent)}
      .sched-hidden-chip .chip-x{color:var(--text-secondary);font-weight:700}
      .sched-hidden-chip:hover .chip-x{color:var(--accent)}
      .sched-show-all-btn{padding:0.2rem 0.6rem;border-radius:6px;border:1px solid var(--border);background:none;font-family:'Outfit',sans-serif;font-size:0.7rem;font-weight:600;color:var(--accent);cursor:pointer}
      .sched-show-all-btn:hover{background:var(--card-hover);border-color:var(--accent)}
      .sched-hide-actions{display:flex;gap:0.3rem}
      .sched-hide-btn{padding:0.3rem 0.6rem;border-radius:6px;border:1px solid var(--border);background:none;font-family:'Outfit',sans-serif;font-size:0.7rem;font-weight:600;color:var(--text-secondary);cursor:pointer;transition:all 0.15s;white-space:nowrap}
      .sched-hide-btn:hover{background:var(--card-hover);border-color:var(--accent);color:var(--text-primary)}
      .sched-grid-wrap{overflow-x:auto;border-radius:var(--radius);border:1px solid var(--border);background:var(--bg-secondary)}
      .sched-grid{display:grid;min-width:800px}
      .sched-col-head{padding:0.75rem 0.5rem;text-align:center;font-weight:600;font-size:0.8rem;color:var(--text-secondary);border-bottom:2px solid var(--border);background:var(--bg-main);text-transform:uppercase;letter-spacing:0.04em;position:sticky;top:0;z-index:2}
      .sched-col-head.today{color:var(--accent);border-bottom-color:var(--accent)}
      .sched-emp-cell{padding:0.6rem 0.75rem;display:flex;align-items:center;gap:0.6rem;border-bottom:1px solid var(--border);border-right:1px solid var(--border);background:var(--bg-main);position:sticky;left:0;z-index:1;min-width:200px}
      .sched-emp-avatar{width:32px;height:32px;border-radius:50%;font-size:0.7rem;font-weight:600;display:flex;align-items:center;justify-content:center;color:white;flex-shrink:0}
      .sched-emp-info{display:flex;flex-direction:column;min-width:0}
      .sched-emp-name{font-weight:600;font-size:0.85rem;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .sched-emp-meta{display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap}
      .sched-emp-role{font-size:0.65rem;padding:0.1rem 0.4rem;border-radius:4px;font-weight:600;text-transform:uppercase;letter-spacing:0.03em}
      .sched-emp-hide{width:20px;height:20px;border-radius:50%;border:1px solid var(--border);background:none;color:var(--text-secondary);font-size:0.7rem;cursor:pointer;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.15s;margin-left:auto;flex-shrink:0}
      .sched-emp-cell:hover .sched-emp-hide{opacity:0.6}
      .sched-emp-cell:hover .sched-emp-hide:hover{opacity:1;color:var(--error);border-color:var(--error)}
      .sched-day-cell{padding:0.4rem;border-bottom:1px solid var(--border);border-right:1px solid var(--border);min-height:80px;display:flex;flex-direction:column;gap:0.3rem;transition:background 0.15s;cursor:pointer;position:relative}
      .sched-day-cell:hover{background:var(--card-hover)}
      .sched-day-cell.today-col{background:rgba(234,88,12,0.03)}
      .sched-day-cell.drag-over{background:rgba(234,88,12,0.08);outline:2px dashed var(--accent);outline-offset:-2px}
      .sched-day-cell .cell-add{opacity:0;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:32px;height:32px;border-radius:50%;border:none;background:var(--accent);color:white;font-size:1.3rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:opacity 0.15s,transform 0.15s}
      .sched-day-cell:hover .cell-add{opacity:0.6}
      .sched-day-cell:hover .cell-add:hover{opacity:1;transform:translate(-50%,-50%) scale(1.15)}
      .sched-job-card{padding:0.35rem 0.5rem;border-radius:6px;font-size:0.75rem;border-left:3px solid var(--accent);background:var(--bg-main);cursor:grab;transition:box-shadow 0.15s,transform 0.15s;display:flex;flex-direction:column;gap:1px;position:relative}
      .sched-job-card:active{cursor:grabbing}
      .sched-job-card:hover{box-shadow:0 2px 8px var(--shadow);transform:translateY(-1px)}
      .sched-job-card.recently-changed{animation:schedPulse 2s ease}
      .sched-job-card.is-site{border-left-color:#0ea5e9}
      .sched-job-card.is-leave{border-left-color:#8b5cf6}
      .sm-assign-card.is-leave{border-left:3px solid #8b5cf6}
      .sched-job-card.no-drag{cursor:default}
      @keyframes schedPulse{0%,100%{box-shadow:0 0 0 0 transparent}50%{box-shadow:0 0 0 3px rgba(234,88,12,0.25)}}
      .sched-job-card .job-top{display:flex;align-items:center;gap:0.3rem}
      .sched-job-card .job-chain{color:var(--accent);display:flex;align-items:center;flex-shrink:0;opacity:0.7}
      .sched-job-card .job-chain.is-site-chain{color:#0ea5e9}
      .sched-job-card .job-num{font-weight:700;font-family:'JetBrains Mono',monospace;font-size:0.7rem}
      .sched-job-card .job-client{color:var(--text-secondary);font-size:0.65rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .sched-job-card .job-type-tag{font-size:0.5rem;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;padding:0.02rem 0.25rem;border-radius:3px;align-self:flex-start}
      .sched-job-card .job-actions{position:absolute;top:2px;right:3px;display:flex;gap:2px;opacity:0;transition:opacity 0.15s}
      .sched-job-card:hover .job-actions{opacity:1}
      .sched-job-card .ja-btn{background:none;border:none;color:var(--text-secondary);cursor:pointer;font-size:0.85rem;line-height:1;padding:2px;pointer-events:auto}
      .sched-job-card .ja-btn:hover{color:var(--error)}
      .sched-job-card .ja-btn.end-btn:hover{color:var(--accent)}
      .sched-job-card .ja-btn.notif-btn:hover{color:var(--accent)}
      .sched-job-card .card-extend{position:absolute;top:50%;width:20px;height:34px;border:none;background:var(--accent);color:white;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;opacity:0;transition:opacity 0.15s,background 0.15s;z-index:2;pointer-events:auto}
      .sched-job-card:hover .card-extend{opacity:0.8}
      .sched-job-card:hover .card-extend:hover{opacity:1;background:var(--accent-light)}
      .sched-job-card .card-extend-left{left:-11px;transform:translateY(-50%);border-radius:5px 0 0 5px}
      .sched-job-card .card-extend-right{right:-11px;transform:translateY(-50%);border-radius:0 5px 5px 0}
      .sched-panels{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:1.25rem}
      .sched-panel-title{font-size:0.95rem;font-weight:600;margin-bottom:0.75rem;display:flex;align-items:center;gap:0.5rem;color:var(--text-primary)}
      .sched-list-scroll{display:flex;flex-direction:column;gap:0.4rem;max-height:260px;overflow-y:auto}
      .sched-unassigned-item{display:flex;align-items:center;justify-content:space-between;padding:0.6rem 0.75rem;border-radius:8px;border:1px solid var(--border);background:var(--bg-main);transition:border-color 0.2s;cursor:grab}
      .sched-unassigned-item:hover{border-color:var(--accent)}
      .sched-unassigned-item .uaj-left{display:flex;flex-direction:column;gap:2px}
      .sched-unassigned-item .uaj-num{font-weight:700;font-family:'JetBrains Mono',monospace;font-size:0.8rem}
      .sched-unassigned-item .uaj-client{font-size:0.75rem;color:var(--text-secondary)}
      .sched-notif-item{display:flex;align-items:center;justify-content:space-between;padding:0.5rem 0.75rem;border-radius:8px;border:1px solid var(--border);background:var(--bg-main);font-size:0.78rem;flex-wrap:wrap;gap:0.3rem}
      .sched-notif-item .notif-msg{flex:1;color:var(--text-primary);min-width:0}
      .sched-notif-item .notif-time{font-family:'JetBrains Mono',monospace;font-size:0.7rem;color:var(--text-secondary)}
      .sched-notif-item .notif-send{padding:0.25rem 0.6rem;border-radius:6px;border:none;background:var(--accent);color:white;font-family:'Outfit',sans-serif;font-size:0.7rem;font-weight:600;cursor:pointer}
      .sched-notif-item .notif-sent{color:var(--success);font-weight:600;font-size:0.75rem}
      .sched-desktop{display:block}.sched-mobile{display:none}
      @media(max-width:900px){.sched-desktop{display:none!important}.sched-mobile{display:block!important}}
      .sm-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem}
      .sm-date-nav{display:flex;align-items:center;gap:0.5rem}
      .sm-date-label{font-weight:700;font-size:1rem;color:var(--text-primary);text-align:center}
      .sm-nav-btn{width:40px;height:40px;border-radius:var(--radius-sm);border:1px solid var(--border);background:var(--bg-secondary);color:var(--text-primary);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:1.2rem;transition:all 0.2s}
      .sm-nav-btn:hover{border-color:var(--accent)}
      .sm-header-actions{display:flex;gap:0.5rem;align-items:center}
      .sm-icon-btn{width:40px;height:40px;border-radius:var(--radius-sm);border:1px solid var(--border);background:var(--bg-secondary);color:var(--text-primary);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:1rem;position:relative;transition:all 0.2s}
      .sm-icon-btn:hover{border-color:var(--accent)}
      .sm-icon-btn .sm-notif-dot{position:absolute;top:6px;right:6px;width:8px;height:8px;border-radius:50%;background:var(--error)}
      .sm-day-dots{display:flex;justify-content:center;gap:0.5rem;margin-bottom:1rem}
      .sm-day-dot{width:38px;height:44px;border-radius:8px;border:1px solid var(--border);background:var(--bg-secondary);display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:0.65rem;font-weight:600;color:var(--text-secondary);cursor:pointer;transition:all 0.2s;gap:1px}
      .sm-day-dot:hover{border-color:var(--accent)}
      .sm-day-dot.active{background:var(--accent);color:white;border-color:var(--accent)}
      .sm-day-dot.today:not(.active){border-color:var(--accent);color:var(--accent)}
      .sm-day-dot .dot-day{font-size:0.6rem;text-transform:uppercase;letter-spacing:0.04em}
      .sm-day-dot .dot-num{font-size:0.85rem;font-weight:700}
      .sm-filters{overflow:hidden;transition:max-height 0.3s ease;max-height:0}
      .sm-filters.open{max-height:300px}
      .sm-filters-inner{padding:0.75rem;background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:1rem;display:flex;flex-direction:column;gap:0.5rem}
      .sm-filters-inner .sched-input,.sm-filters-inner .sched-select{width:100%}
      .sm-emp-list{display:flex;flex-direction:column;gap:0.6rem}
      .sm-emp-card{background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;transition:border-color 0.2s}
      .sm-emp-card.has-items{border-color:rgba(234,88,12,0.15)}
      .sm-emp-head{display:flex;align-items:center;justify-content:space-between;padding:0.75rem 1rem;cursor:pointer;transition:background 0.15s}
      .sm-emp-head:active{background:var(--card-hover)}
      .sm-emp-head-left{display:flex;align-items:center;gap:0.6rem;min-width:0}
      .sm-emp-head .sched-emp-avatar{width:36px;height:36px;font-size:0.75rem}
      .sm-emp-head-info{display:flex;flex-direction:column;min-width:0}
      .sm-emp-head-name{font-weight:600;font-size:0.9rem;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .sm-emp-head-role{font-size:0.7rem;font-weight:600;text-transform:uppercase;letter-spacing:0.03em}
      .sm-emp-head-right{display:flex;align-items:center;gap:0.5rem}
      .sm-emp-count{font-size:0.7rem;font-weight:700;color:var(--accent)}
      .sm-emp-chevron{font-size:0.9rem;color:var(--text-secondary);transition:transform 0.2s}
      .sm-emp-card.expanded .sm-emp-chevron{transform:rotate(90deg)}
      .sm-emp-body{max-height:0;overflow:hidden;transition:max-height 0.3s ease}
      .sm-emp-card.expanded .sm-emp-body{max-height:600px}
      .sm-emp-body-inner{padding:0.5rem 1rem 1rem;display:flex;flex-direction:column;gap:0.4rem}
      .sm-assign-card{display:flex;align-items:center;justify-content:space-between;padding:0.6rem 0.75rem;border-radius:8px;border:1px solid var(--border);background:var(--bg-main)}
      .sm-assign-card.is-site{border-left:3px solid #0ea5e9}
      .sm-assign-card.is-job{border-left:3px solid var(--accent)}
      .sm-assign-left{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}
      .sm-assign-left .a-label{font-weight:700;font-family:'JetBrains Mono',monospace;font-size:0.8rem}
      .sm-assign-left .a-sub{font-size:0.75rem;color:var(--text-secondary)}
      .sm-assign-left .a-type{font-size:0.55rem;font-weight:700;text-transform:uppercase;padding:0.05rem 0.3rem;border-radius:3px;align-self:flex-start}
      .sm-assign-left .a-sched{font-size:0.6rem;color:var(--text-secondary);display:flex;align-items:center;gap:0.3rem}
      .sm-assign-actions{display:flex;gap:0.3rem;flex-shrink:0}
      .sm-assign-btn{width:30px;height:30px;border-radius:50%;border:1px solid var(--border);background:none;color:var(--text-secondary);font-size:0.85rem;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.15s}
      .sm-assign-btn:hover{color:var(--error);border-color:var(--error)}
      .sm-assign-btn.end-btn:hover{color:var(--accent);border-color:var(--accent)}
      .sm-assign-btn.notif-btn:hover{color:var(--accent);border-color:var(--accent)}
      .sm-add-btn{width:100%;padding:0.5rem;border-radius:8px;border:1px dashed var(--border);background:none;color:var(--text-secondary);font-family:'Outfit',sans-serif;font-size:0.8rem;cursor:pointer;transition:all 0.2s;display:flex;align-items:center;justify-content:center;gap:0.4rem}
      .sm-add-btn:hover{border-color:var(--accent);color:var(--accent)}
      .sm-fab{position:fixed;bottom:70px;right:16px;width:56px;height:56px;border-radius:50%;border:none;background:linear-gradient(135deg,var(--accent),var(--accent-light));color:white;font-size:1.5rem;cursor:pointer;box-shadow:0 4px 16px rgba(234,88,12,0.35);display:flex;align-items:center;justify-content:center;z-index:100;transition:transform 0.2s}
      .sm-fab:active{transform:scale(0.92)}
      .sm-notif-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:900;display:flex;align-items:flex-end;justify-content:center;animation:fadeIn 0.15s}
      .sm-notif-sheet{background:var(--bg-secondary);border-radius:16px 16px 0 0;width:100%;max-width:500px;max-height:70vh;overflow-y:auto;padding:1.25rem;animation:slideUp 0.25s ease}
      @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
      .sm-notif-sheet h3{font-size:1rem;font-weight:700;margin-bottom:1rem}
      .sm-swipe-area{touch-action:pan-y}
      .sched-confirm-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:1100;display:flex;align-items:center;justify-content:center;animation:fadeIn 0.15s}
      .sched-confirm{background:var(--bg-secondary);border:1px solid var(--border);border-radius:16px;padding:1.75rem;width:90%;max-width:380px;box-shadow:0 20px 60px var(--shadow);animation:fadeIn 0.2s ease;text-align:center}
      .sched-confirm p{font-size:0.95rem;color:var(--text-primary);margin-bottom:1.25rem;line-height:1.5}
      .sched-confirm-actions{display:flex;gap:0.5rem;justify-content:center}
    `;
    document.head.appendChild(style);
  }
  function removeStyles() { const el = document.getElementById('sched-styles'); if (el) el.remove(); }

  /* ═══════════════════════════════════════ RENDER ═══════════════════════════════════════ */
  async function render(container) {
    injectStyles(); containerRef = container;
    if (!currentWeekStart) currentWeekStart = getMonday(new Date());
    if (!mobileSelectedDate) mobileSelectedDate = new Date();
    container.innerHTML = `<div class="card"><div class="sched-empty">Loading…</div></div>`;
    const [emps, jbs, sts, asgn] = await Promise.all([DB.fetchEmployees(), DB.fetchJobs(), DB.fetchSites(), DB.fetchAssignments()]);
    employees = emps; jobs = jbs; sites = sts; assignments = asgn;
    container.innerHTML = `<div class="sched-desktop">${buildDesktop()}</div><div class="sched-mobile">${buildMobile()}</div>`;
    bindDesktop(container); bindMobile(container);
    const vEl = document.getElementById('app-version'); if (vEl) vEl.textContent = `scheduling ${PAGE_VERSION}`;
  }

  function rerender(container) {
    container.innerHTML = `<div class="sched-desktop">${buildDesktop()}</div><div class="sched-mobile">${buildMobile()}</div>`;
    bindDesktop(container); bindMobile(container);
  }

  /* ═══════════════════════════════════════ DESKTOP ═══════════════════════════════════════ */
  function buildDesktop() {
    const days = getDaysOfWeek(); const dayNames = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const roles = [...new Set(employees.map(e => e.role))].filter(r=>r&&r!=='unassigned').sort();
    const filtered = getFilteredEmployees(); const unassigned = getUnassignedJobs();
    const weekEnd = new Date(currentWeekStart); weekEnd.setDate(weekEnd.getDate() + (showWeekends ? 6 : 4));
    const hiddenEmps = employees.filter(e => hiddenEmployees.has(e.id));
    return `
      <div class="sched-toolbar">
        <div class="sched-toolbar-group sched-week-nav">
          <button class="sched-nav-btn" id="dt-prev">‹</button>
          <span class="sched-week-label">${formatDate(currentWeekStart)} — ${formatDate(weekEnd)}</span>
          <button class="sched-nav-btn" id="dt-next">›</button>
          <button class="sched-nav-btn" id="dt-today" style="font-size:0.75rem;width:auto;padding:0 0.6rem;">Today</button>
        </div>
        <div class="sched-toolbar-group">
          <input class="sched-input" id="dt-search" type="text" placeholder="Search employees…" value="${searchTerm}" style="width:160px;">
          <select class="sched-select" id="dt-role"><option value="all">All roles</option>${roles.map(r=>`<option value="${r}" ${filterRole===r?'selected':''}>${roleLabel(r)}</option>`).join('')}</select>
          <label class="sched-toggle"><input type="checkbox" id="dt-weekends" ${showWeekends?'checked':''}> Weekends</label>
          <div class="sched-hide-actions">
            <button class="sched-hide-btn" id="dt-hide-scheduled" title="Hide employees with assignments this week">Hide Scheduled</button>
            <button class="sched-hide-btn" id="dt-hide-all" title="Hide all employees">Hide All</button>
          </div>
        </div>
      </div>
      ${hiddenEmps.length?`<div class="sched-hidden-bar"><span class="hidden-label">Hidden (${hiddenEmps.length}):</span>${hiddenEmps.map(e=>`<span class="sched-hidden-chip" data-show-emp="${e.id}">${e.name} <span class="chip-x">×</span></span>`).join('')}<button class="sched-show-all-btn" id="dt-show-all">Show all</button></div>`:''}
      <div class="sched-grid-wrap"><div class="sched-grid" style="grid-template-columns:200px repeat(${days.length},1fr);">
        <div class="sched-col-head" style="position:sticky;left:0;z-index:3;">Employee</div>
        ${days.map(d=>`<div class="sched-col-head ${isToday(d)?'today':''}">${dayNames[d.getDay()===0?6:d.getDay()-1]}<br>${formatDate(d)}</div>`).join('')}
        ${filtered.map(emp=>`<div class="sched-emp-cell">
            <div class="sched-emp-avatar" style="background:linear-gradient(135deg,${roleColor(emp.role)},${roleColor(emp.role)}88)">${emp.avatar}</div>
            <div class="sched-emp-info"><span class="sched-emp-name">${emp.name}</span><div class="sched-emp-meta">${emp.role&&emp.role!=='unassigned'?`<span class="sched-emp-role" style="background:${roleColor(emp.role)}18;color:${roleColor(emp.role)}">${roleLabel(emp.role)}</span>`:''}</div></div>
            <button class="sched-emp-hide" data-hide-emp="${emp.id}" title="Hide">✕</button></div>
          ${days.map(d=>{const dk=formatDateKey(d);const ea=getEffectiveAssignments(emp.name,dk);return`
            <div class="sched-day-cell ${isToday(d)?'today-col':''}" data-emp="${emp.name}" data-date="${dk}" ondragover="event.preventDefault();this.classList.add('drag-over')" ondragleave="this.classList.remove('drag-over')">
              ${ea.map(a=>{const lbl=getAssignmentLabel(a);const sub=getAssignmentSub(a);const bc=getAssignmentBorderColor(a);const isSite=a.type==='site';const isLeave=a.type==='leave';const isLinked=a.linked;const isIndef=a.schedule==='indefinite'&&!a.endDate;const canDrag=!isLinked;
                return`<div class="sched-job-card ${a.recentlyChanged?'recently-changed':''} ${isSite?'is-site':''} ${isLeave?'is-leave':''} ${!canDrag?'no-drag':''}" draggable="${canDrag}" data-assign-id="${a.id}" data-date-key="${dk}" style="border-left-color:${bc}">
                  <button class="card-extend card-extend-left" data-extend-left="${a.id}" data-extend-date="${dk}" title="Extend to previous day">◂</button>
                  <button class="card-extend card-extend-right" data-extend-right="${a.id}" data-extend-date="${dk}" title="Extend to next day">▸</button>
                  ${isSite?'<span class="job-type-tag" style="background:#0ea5e920;color:#0ea5e9;">SITE</span>':''}${isLeave?`<span class="job-type-tag" style="background:${bc}20;color:${bc};">LEAVE</span>`:''}
                  <div class="job-top">${isLinked?`<span class="job-chain ${isSite?'is-site-chain':''}" title="${scheduleLabel(a.schedule)}">${CHAIN_ICON}</span>`:''}<span class="job-num">${lbl}</span></div>
                  <span class="job-client">${sub}</span>
                  <div class="job-actions"><button class="ja-btn notif-btn" data-notify="${a.id}" title="Notify employee">🔔</button>${isIndef&&isLinked?`<button class="ja-btn end-btn" data-end="${a.id}" data-end-date="${dk}" title="End assignment here">⏹</button>`:''}<button class="ja-btn" data-remove="${a.id}" data-remove-date="${dk}" data-remove-linked="${isLinked}" title="Remove">×</button></div>
                </div>`;}).join('')}
              <button class="cell-add" data-cell-emp="${emp.name}" data-cell-date="${dk}" title="Assign">+</button>
            </div>`;}).join('')}`).join('')}
        ${filtered.length===0?'<div class="sched-empty" style="grid-column:1/-1;">No employees match your filter.</div>':''}
      </div></div>
      <div class="sched-panels">
        <div class="card"><div class="sched-panel-title">Unassigned Jobs ${unassigned.length?`<span class="sched-badge">${unassigned.length}</span>`:''}</div>
          <div class="sched-list-scroll">${unassigned.length===0?`<div class="sched-empty">${jobs.length===0?'No jobs table found':'All jobs assigned'}</div>`:''}
            ${unassigned.map(j=>`<div class="sched-unassigned-item" draggable="true" data-job-num="${j.number}"><div class="uaj-left"><span class="uaj-num">${j.number}</span><span class="uaj-client">${j.client}${j.site?' · '+j.site:''}</span></div><span class="sched-priority-tag" style="background:${priorityColor(j.priority)}20;color:${priorityColor(j.priority)}">${j.priority}</span></div>`).join('')}
          </div></div>
        <div class="card"><div class="sched-panel-title">Notifications ${unsent()?`<span class="sched-badge">${unsent()}</span>`:''}</div>
          <div class="sched-list-scroll">${notificationQueue.length===0?'<div class="sched-empty">No pending notifications</div>':''}
            ${notificationQueue.map(n=>`<div class="sched-notif-item"><span class="notif-msg"><strong>${n.employeeName}</strong>: ${n.message}</span><span class="notif-time">${timeSince(n.timestamp)}</span>${n.sent?'<span class="notif-sent">✓ Sent</span>':`<button class="notif-send" data-notif-id="${n.id}">Send</button>`}</div>`).join('')}
          </div></div>
      </div>`;
  }

  function bindDesktop(container) {
    const dt = container.querySelector('.sched-desktop'); if (!dt) return;
    dt.querySelector('#dt-prev')?.addEventListener('click',()=>{currentWeekStart.setDate(currentWeekStart.getDate()-7);rerender(container);});
    dt.querySelector('#dt-next')?.addEventListener('click',()=>{currentWeekStart.setDate(currentWeekStart.getDate()+7);rerender(container);});
    dt.querySelector('#dt-today')?.addEventListener('click',()=>{currentWeekStart=getMonday(new Date());rerender(container);});
    dt.querySelector('#dt-search')?.addEventListener('input',e=>{searchTerm=e.target.value;rerender(container);});
    dt.querySelector('#dt-role')?.addEventListener('change',e=>{filterRole=e.target.value;rerender(container);});
    dt.querySelector('#dt-weekends')?.addEventListener('change',e=>{showWeekends=e.target.checked;rerender(container);});
    dt.querySelectorAll('.sched-emp-hide').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();hiddenEmployees.add(b.dataset.hideEmp);rerender(container);}));
    dt.querySelectorAll('.sched-hidden-chip').forEach(c=>c.addEventListener('click',()=>{hiddenEmployees.delete(c.dataset.showEmp);rerender(container);}));
    dt.querySelector('#dt-show-all')?.addEventListener('click',()=>{hiddenEmployees.clear();rerender(container);});
    dt.querySelector('#dt-hide-scheduled')?.addEventListener('click',()=>{employees.forEach(e=>{if(empHasAssignmentsInWeek(e.name))hiddenEmployees.add(e.id);});rerender(container);});
    dt.querySelector('#dt-hide-all')?.addEventListener('click',()=>{employees.forEach(e=>hiddenEmployees.add(e.id));rerender(container);});
    dt.querySelectorAll('.cell-add').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();openAssignModal(container,b.dataset.cellEmp,b.dataset.cellDate);}));
    bindCardActions(dt,container);
    dt.querySelectorAll('.sched-job-card[draggable="true"]').forEach(c=>{
      c.addEventListener('dragstart',e=>{const a=assignments.find(x=>x.id===c.dataset.assignId);if(!a||a.schedule!=='oneoff'){e.preventDefault();return;}dragData={type:'reassign',assignId:c.dataset.assignId};e.dataTransfer.effectAllowed='move';c.style.opacity='0.5';});
      c.addEventListener('dragend',()=>{c.style.opacity='1';dragData=null;dt.querySelectorAll('.drag-over').forEach(el=>el.classList.remove('drag-over'));});
    });
    dt.querySelectorAll('.sched-unassigned-item[draggable]').forEach(item=>{
      item.addEventListener('dragstart',e=>{dragData={type:'assign',jobNumber:item.dataset.jobNum};e.dataTransfer.effectAllowed='copy';item.style.opacity='0.5';});
      item.addEventListener('dragend',()=>{item.style.opacity='1';dragData=null;dt.querySelectorAll('.drag-over').forEach(el=>el.classList.remove('drag-over'));});
    });
    dt.querySelectorAll('.sched-day-cell').forEach(cell=>{
      cell.addEventListener('drop',e=>{e.preventDefault();cell.classList.remove('drag-over');if(!dragData)return;handleDrop(container,cell.dataset.emp,cell.dataset.date);});
    });
    bindExtendArrows(dt,container);
    bindNotifyButtons(dt,container);
    dt.querySelectorAll('.notif-send').forEach(b=>b.addEventListener('click',()=>{markNotifSent(container,b.dataset.notifId);}));
  }

  /* ═══════════════════════════════════════ MOBILE ═══════════════════════════════════════ */
  function buildMobile() {
    const days=getDaysOfWeek();const dayAbbr=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const dk=getMobileDateKey();const filtered=getFilteredEmployees();
    const roles=[...new Set(employees.map(e=>e.role))].filter(r=>r&&r!=='unassigned').sort();
    return `
      <div class="sm-header">
        <div class="sm-date-nav"><button class="sm-nav-btn" id="sm-prev">‹</button><span class="sm-date-label">${formatDateFull(mobileSelectedDate)}</span><button class="sm-nav-btn" id="sm-next">›</button></div>
        <div class="sm-header-actions"><button class="sm-icon-btn" id="sm-filter-toggle">⚙</button><button class="sm-icon-btn" id="sm-notif-toggle">🔔${unsent()?'<span class="sm-notif-dot"></span>':''}</button></div>
      </div>
      <div class="sm-day-dots">${days.map(d=>{const active=formatDateKey(d)===dk;const today=isToday(d);return`<div class="sm-day-dot ${active?'active':''} ${today&&!active?'today':''}" data-date="${formatDateKey(d)}"><span class="dot-day">${dayAbbr[d.getDay()]}</span><span class="dot-num">${d.getDate()}</span></div>`;}).join('')}</div>
      <div class="sm-filters ${mobileShowFilters?'open':''}"><div class="sm-filters-inner">
        <input class="sched-input" id="sm-search" type="text" placeholder="Search employees…" value="${searchTerm}">
        <select class="sched-select" id="sm-role"><option value="all">All roles</option>${roles.map(r=>`<option value="${r}" ${filterRole===r?'selected':''}>${roleLabel(r)}</option>`).join('')}</select>
        <label class="sched-toggle"><input type="checkbox" id="sm-weekends" ${showWeekends?'checked':''}> Show weekends</label>
      </div></div>
      <div class="sm-emp-list sm-swipe-area" id="sm-emp-list">
        ${filtered.length===0?'<div class="sched-empty">No employees match your filter.</div>':''}
        ${filtered.map(emp=>{const ea=getEffectiveAssignments(emp.name,dk);const expanded=mobileExpandedEmp===emp.id;
          return`<div class="sm-emp-card ${expanded?'expanded':''} ${ea.length?'has-items':''}" data-emp-id="${emp.id}">
            <div class="sm-emp-head" data-emp-toggle="${emp.id}">
              <div class="sm-emp-head-left"><div class="sched-emp-avatar" style="background:linear-gradient(135deg,${roleColor(emp.role)},${roleColor(emp.role)}88)">${emp.avatar}</div>
                <div class="sm-emp-head-info"><span class="sm-emp-head-name">${emp.name}</span>${emp.role&&emp.role!=='unassigned'?`<span class="sm-emp-head-role" style="color:${roleColor(emp.role)}">${roleLabel(emp.role)}</span>`:''}</div></div>
              <div class="sm-emp-head-right">${ea.length?`<span class="sm-emp-count">${ea.length}</span>`:''}<span class="sm-emp-chevron">›</span></div>
            </div>
            <div class="sm-emp-body"><div class="sm-emp-body-inner">
              ${ea.map(a=>{const lbl=getAssignmentLabel(a);const sub=getAssignmentSub(a);const bc=getAssignmentBorderColor(a);const isSite=a.type==='site';const isLeave=a.type==='leave';const isLinked=a.linked;const isIndef=a.schedule==='indefinite'&&!a.endDate;
                return`<div class="sm-assign-card ${isSite?'is-site':isLeave?'is-leave':'is-job'}" ${isLeave?`style="border-left-color:${bc}"`:''}><div class="sm-assign-left">
                    ${isSite?'<span class="a-type" style="background:#0ea5e920;color:#0ea5e9;">SITE</span>':isLeave?`<span class="a-type" style="background:${bc}20;color:${bc};">LEAVE</span>`:'<span class="a-type" style="background:var(--card-hover);color:var(--accent);">JOB</span>'}
                    <span class="a-label">${lbl}</span><span class="a-sub">${sub}</span>
                    ${isLinked?`<span class="a-sched">${CHAIN_ICON} ${scheduleLabel(a.schedule)}${a.endDate?' · ends '+a.endDate:''}</span>`:''}</div>
                  <div class="sm-assign-actions"><button class="sm-assign-btn" data-notify="${a.id}" title="Notify" style="font-size:0.7rem">🔔</button>${isIndef&&isLinked?`<button class="sm-assign-btn end-btn" data-end="${a.id}" data-end-date="${dk}" title="End here">⏹</button>`:''}<button class="sm-assign-btn" data-remove="${a.id}" data-remove-date="${dk}" data-remove-linked="${isLinked}" title="Remove">×</button></div></div>`;}).join('')}
              <button class="sm-add-btn" data-add-emp="${emp.name}" data-add-date="${dk}">+ Assign job or site</button>
            </div></div></div>`;}).join('')}
      </div>
      <button class="sm-fab" id="sm-fab">+</button>`;
  }

  function bindMobile(container) {
    const mb=container.querySelector('.sched-mobile');if(!mb)return;
    mb.querySelector('#sm-prev')?.addEventListener('click',()=>{mobileSelectedDate.setDate(mobileSelectedDate.getDate()-1);currentWeekStart=getMonday(mobileSelectedDate);rerender(container);});
    mb.querySelector('#sm-next')?.addEventListener('click',()=>{mobileSelectedDate.setDate(mobileSelectedDate.getDate()+1);currentWeekStart=getMonday(mobileSelectedDate);rerender(container);});
    mb.querySelectorAll('.sm-day-dot').forEach(dot=>{dot.addEventListener('click',()=>{const p=dot.dataset.date.split('-');mobileSelectedDate=new Date(+p[0],+p[1]-1,+p[2]);rerender(container);});});
    const swipeArea=mb.querySelector('#sm-emp-list');
    if(swipeArea){
      swipeArea.addEventListener('touchstart',e=>{touchStartX=e.touches[0].clientX;touchStartY=e.touches[0].clientY;},{passive:true});
      swipeArea.addEventListener('touchend',e=>{const dx=e.changedTouches[0].clientX-touchStartX;const dy=e.changedTouches[0].clientY-touchStartY;if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.5){mobileSelectedDate.setDate(mobileSelectedDate.getDate()+(dx<0?1:-1));currentWeekStart=getMonday(mobileSelectedDate);rerender(container);}},{passive:true});
    }
    mb.querySelector('#sm-filter-toggle')?.addEventListener('click',()=>{mobileShowFilters=!mobileShowFilters;mb.querySelector('.sm-filters')?.classList.toggle('open',mobileShowFilters);});
    mb.querySelector('#sm-search')?.addEventListener('input',e=>{searchTerm=e.target.value;rerender(container);});
    mb.querySelector('#sm-role')?.addEventListener('change',e=>{filterRole=e.target.value;rerender(container);});
    mb.querySelector('#sm-weekends')?.addEventListener('change',e=>{showWeekends=e.target.checked;currentWeekStart=getMonday(mobileSelectedDate);rerender(container);});
    mb.querySelectorAll('[data-emp-toggle]').forEach(h=>{h.addEventListener('click',()=>{mobileExpandedEmp=mobileExpandedEmp===h.dataset.empToggle?null:h.dataset.empToggle;rerender(container);});});
    mb.querySelectorAll('.sm-add-btn').forEach(b=>{b.addEventListener('click',e=>{e.stopPropagation();openAssignModal(container,b.dataset.addEmp,b.dataset.addDate);});});
    bindCardActions(mb,container);
    bindNotifyButtons(mb,container);
    mb.querySelector('#sm-fab')?.addEventListener('click',()=>{openQuickAssignModal(container);});
    mb.querySelector('#sm-notif-toggle')?.addEventListener('click',()=>{openNotifSheet(container);});
  }

  /* ═══════════════════════════════════════ SHARED ACTIONS ═══════════════════════════════════════ */
  function showConfirm(message, onConfirm) {
    const overlay = document.createElement('div'); overlay.className = 'sched-confirm-overlay';
    overlay.innerHTML = `<div class="sched-confirm"><p>${message}</p><div class="sched-confirm-actions"><button class="btn-secondary" id="sc-cancel">Cancel</button><button class="btn-primary" id="sc-confirm">Remove</button></div></div>`;
    overlay.querySelector('#sc-cancel').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#sc-confirm').addEventListener('click', () => { overlay.remove(); onConfirm(); });
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  }

  function bindCardActions(root,container) {
    root.querySelectorAll('[data-remove]').forEach(b=>b.addEventListener('click',e=>{
      e.stopPropagation();
      const a = assignments.find(x=>x.id===b.dataset.remove); if(!a) return;
      const lbl = getAssignmentLabel(a);
      const isLinked = b.dataset.removeLinked === 'true';
      const dk = b.dataset.removeDate;
      if(isLinked){
        showConfirm(`Remove <strong>${lbl}</strong> from <strong>${dk}</strong>?`, async () => {
          if(!a.skipDates) a.skipDates = [];
          a.skipDates.push(dk);
          await DB.updateSkipDates(a.id, a.skipDates);
          rerender(container);
        });
      } else {
        showConfirm(`Are you sure you want to remove <strong>${lbl}</strong> from this schedule?`, () => removeAssignment(container, b.dataset.remove));
      }
    }));
    root.querySelectorAll('[data-end]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();const a=assignments.find(x=>x.id===b.dataset.end);if(!a)return;const d=parseDateKey(b.dataset.endDate);d.setDate(d.getDate()-1);a.endDate=formatDateKey(d);DB.endAssignment(a.id,a.endDate);queueNotification(a.employeeName,`${getAssignmentLabel(a)} ends on ${a.endDate}`);rerender(container);}));
  }

  async function removeAssignment(container,aId){await DB.deleteAssignment(aId);rerender(container);}

  async function handleDrop(container,empName,date) {
    if(dragData.type==='assign'){
      const job=jobs.find(j=>j.number===dragData.jobNumber);if(!job)return;
      const a={employeeName:empName,type:'job',jobNumber:job.number,clientName:job.client,schedule:'oneoff',startDate:date,skipDates:[],recentlyChanged:true};
      await DB.saveAssignment(a);assignments.push(a);queueNotification(empName,`Assigned ${job.number} on ${date}`);
    }
    if(dragData.type==='reassign'){
      const a=assignments.find(x=>x.id===dragData.assignId);if(!a||(a.employeeName===empName&&a.startDate===date))return;
      const oldName=a.employeeName;const lbl=getAssignmentLabel(a);a.employeeName=empName;a.startDate=date;a.recentlyChanged=true;
      await DB.saveAssignment(a);queueNotification(empName,`${lbl} reassigned to you on ${date}`);if(oldName!==empName)queueNotification(oldName,`${lbl} removed from your schedule`);
    }
    dragData=null;rerender(container);
  }

  async function markNotifSent(container,nId){
    const n=notificationQueue.find(x=>x.id===nId);if(!n)return;
    n.sent=true;
    try {
      const sb = await DB.init();
      await sb.functions.invoke('send-notification', { body: { employee_name: n.employeeName, message: n.message } });
    } catch (err) { console.warn('Edge function call failed (notification still saved):', err); }
    rerender(container);
  }

  function bindExtendArrows(root,container) {
    root.querySelectorAll('[data-extend-left]').forEach(b=>b.addEventListener('click',async e=>{
      e.stopPropagation();
      const a=assignments.find(x=>x.id===b.dataset.extendLeft);if(!a)return;
      const dk=b.dataset.extendDate;const d=parseDateKey(dk);d.setDate(d.getDate()-1);const prevDk=formatDateKey(d);
      if(a.schedule==='oneoff'){a.schedule='duration';a.startDate=prevDk;a.endDate=dk;await DB.saveAssignment(a);}
      else{if(prevDk<a.startDate){a.startDate=prevDk;await DB.saveAssignment(a);}}
      rerender(container);
    }));
    root.querySelectorAll('[data-extend-right]').forEach(b=>b.addEventListener('click',async e=>{
      e.stopPropagation();
      const a=assignments.find(x=>x.id===b.dataset.extendRight);if(!a)return;
      const dk=b.dataset.extendDate;const d=parseDateKey(dk);d.setDate(d.getDate()+1);const nextDk=formatDateKey(d);
      if(a.schedule==='oneoff'){a.schedule='duration';a.endDate=nextDk;await DB.saveAssignment(a);}
      else if(a.endDate){a.endDate=nextDk;await DB.saveAssignment(a);}
      rerender(container);
    }));
  }

  function bindNotifyButtons(root,container) {
    root.querySelectorAll('[data-notify]').forEach(b=>b.addEventListener('click',e=>{
      e.stopPropagation();e.preventDefault();
      const a=assignments.find(x=>x.id===b.dataset.notify);if(!a)return;
      const lbl=getAssignmentLabel(a);
      const overlay=document.createElement('div');overlay.className='sched-confirm-overlay';
      overlay.innerHTML=`<div class="sched-confirm">
        <p style="margin-bottom:0.5rem;font-weight:700">Notify ${a.employeeName}</p>
        <p style="font-size:0.85rem;margin-bottom:0.75rem">Send a schedule change notification about <strong>${lbl}</strong>?</p>
        <textarea class="sched-input" id="nc-msg" rows="3" style="width:100%;margin-bottom:1rem;resize:vertical;font-size:16px">Schedule update: ${lbl} ${a.schedule==='oneoff'?'on '+a.startDate:'from '+a.startDate+(a.endDate?' to '+a.endDate:' ongoing')}</textarea>
        <div class="sched-confirm-actions">
          <button class="btn-secondary" id="nc-cancel">Cancel</button>
          <button class="btn-primary" id="nc-send">Send Notification</button>
        </div>
      </div>`;
      const inner=overlay.querySelector('.sched-confirm');
      inner.addEventListener('click',ev=>ev.stopPropagation());
      inner.addEventListener('mousedown',ev=>ev.stopPropagation());
      overlay.querySelector('#nc-cancel').addEventListener('click',()=>overlay.remove());
      overlay.querySelector('#nc-send').addEventListener('click',async()=>{
        const msg=overlay.querySelector('#nc-msg')?.value||'';
        await queueNotification(a.employeeName,msg);
        try {
          const sb = await DB.init();
          await sb.functions.invoke('send-notification', { body: { employee_name: a.employeeName, message: msg } });
        } catch (err) { console.warn('Edge function call failed:', err); }
        overlay.remove();rerender(container);
      });
      overlay.addEventListener('mousedown',ev=>{if(ev.target===overlay)overlay.remove();});
      document.body.appendChild(overlay);
      overlay.querySelector('#nc-msg')?.focus();
    }));
  }

  /* ═══════════════════════════════════════ ASSIGN MODAL ═══════════════════════════════════════ */
  function openAssignModal(container,empName,date,prefillSchedule,prefillEndDate) {
    let activeTab='job',selectedJob=null,selectedSite=null,selectedLeave=null,jobQuery='',siteQuery='';
    let schedType=prefillSchedule||'oneoff',endDateVal=prefillEndDate||'';
    const leaveTypes=['RDO','Annual Leave','Sick Leave'];
    const overlay=document.createElement('div');overlay.className='sched-modal-overlay';

    function rm() {
      const existing=getEffectiveAssignments(empName,date);
      const conflict=existing.length>=3?`⚠ ${empName} has ${existing.length} items on this date.`:'';
      const canSubmit=activeTab==='job'?!!selectedJob:activeTab==='site'?!!selectedSite:!!selectedLeave;
      const fJobs=searchJobsLocal(jobQuery);const fSites=searchSitesLocal(siteQuery);

      overlay.innerHTML=`<div class="sched-modal">
        <button class="sched-modal-close" id="am-close">×</button>
        <h3>Assign to Schedule</h3>
        <p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:0.75rem;">${empName} · starting ${date}</p>
        <div class="sched-modal-tabs">
          <button class="sched-modal-tab ${activeTab==='job'?'active':''}" data-tab="job">Job Number</button>
          <button class="sched-modal-tab ${activeTab==='site'?'active':''}" data-tab="site">Sites</button>
          <button class="sched-modal-tab ${activeTab==='leave'?'active':''}" data-tab="leave" style="${activeTab==='leave'?'color:#8b5cf6;border-bottom-color:#8b5cf6':''}">Leave</button>
        </div>
        ${activeTab==='job'?`
          <label>Search Job</label>
          <input class="sched-input" id="am-job-search" type="text" placeholder="Search by job number, client or site…" value="${jobQuery}" autofocus>
          <div class="sched-job-results">${fJobs.length===0?`<div class="sched-empty">${jobs.length===0?'No jobs table found':'No matching jobs'}</div>`:''}
            ${fJobs.map(j=>`<div class="sched-job-result ${selectedJob?.number===j.number?'selected':''}" data-jnum="${j.number}"><div><span class="jr-num">${j.number}</span> <span class="jr-client">${j.client}${j.site?' · '+j.site:''}</span></div><span class="sched-priority-tag" style="background:${priorityColor(j.priority)}20;color:${priorityColor(j.priority)}">${j.priority}</span></div>`).join('')}</div>
        `:activeTab==='site'?`
          <label>Search Site</label>
          <input class="sched-input" id="am-site-search" type="text" placeholder="Search by site name, client or address…" value="${siteQuery}" autofocus>
          <div class="sched-job-results">${fSites.length===0?`<div class="sched-empty">${sites.length===0?'No sites found':'No matching sites'}</div>`:''}
            ${fSites.map(s=>`<div class="sched-site-result ${selectedSite?.id===s.id?'selected':''}" data-sid="${s.id}"><span class="sr-name">${s.name}</span><span class="sr-client">${s.clientName}</span>${s.address?`<span class="sr-addr">${s.address}${s.city?', '+s.city:''}</span>`:''}</div>`).join('')}</div>
        `:`
          <label>Leave Type</label>
          <div class="sched-leave-types">${leaveTypes.map(lt=>`<button class="sched-leave-btn ${selectedLeave===lt?'active':''}" data-leave="${lt}" style="--lc:${leaveColor(lt)}">${lt}</button>`).join('')}</div>
        `}
        <label>Schedule Type</label>
        <div class="sched-schedule-type">
          <button class="sched-stype-btn ${schedType==='oneoff'?'active':''}" data-stype="oneoff">One-off</button>
          <button class="sched-stype-btn ${schedType==='duration'?'active':''}" data-stype="duration">Duration</button>
          <button class="sched-stype-btn ${schedType==='indefinite'?'active':''}" data-stype="indefinite">Indefinite</button>
        </div>
        ${schedType==='duration'?`<div class="sched-date-row"><div style="flex:1"><label>End Date</label><input class="sched-input" id="am-end-date" type="date" value="${endDateVal}"></div></div>`:''}
        ${schedType==='indefinite'?'<p style="font-size:0.75rem;color:var(--text-secondary);margin-top:0.5rem;">Repeats Mon–Fri until manually ended.</p>':''}
        ${schedType==='duration'?'<p style="font-size:0.75rem;color:var(--text-secondary);margin-top:0.25rem;">Repeats Mon–Fri between start and end dates.</p>':''}
        ${conflict?`<div class="sched-conflict">${conflict}</div>`:''}
        <div class="sched-modal-actions">
          <button class="btn-secondary" id="am-cancel">Cancel</button>
          <button class="btn-primary" id="am-submit" ${!canSubmit?'disabled style="opacity:0.5;pointer-events:none"':''}>Assign</button>
        </div>
      </div>`;

      overlay.querySelector('#am-close')?.addEventListener('click',close);
      overlay.querySelector('#am-cancel')?.addEventListener('click',close);
      overlay.querySelectorAll('.sched-modal-tab').forEach(t=>t.addEventListener('click',()=>{activeTab=t.dataset.tab;selectedJob=null;selectedSite=null;selectedLeave=null;jobQuery='';siteQuery='';rm();}));
      overlay.querySelectorAll('.sched-stype-btn').forEach(b=>b.addEventListener('click',()=>{schedType=b.dataset.stype;rm();}));
      if(activeTab==='job'){
        overlay.querySelector('#am-job-search')?.addEventListener('input',e=>{jobQuery=e.target.value;const pos=e.target.selectionStart;selectedJob=null;rm();const i=overlay.querySelector('#am-job-search');if(i){i.value=jobQuery;i.focus();i.setSelectionRange(pos,pos);}});
        overlay.querySelectorAll('.sched-job-result').forEach(el=>el.addEventListener('click',()=>{selectedJob=jobs.find(j=>j.number===el.dataset.jnum);rm();}));
      } else if(activeTab==='site'){
        overlay.querySelector('#am-site-search')?.addEventListener('input',e=>{siteQuery=e.target.value;const pos=e.target.selectionStart;selectedSite=null;rm();const i=overlay.querySelector('#am-site-search');if(i){i.value=siteQuery;i.focus();i.setSelectionRange(pos,pos);}});
        overlay.querySelectorAll('.sched-site-result').forEach(el=>el.addEventListener('click',()=>{selectedSite=sites.find(s=>s.id===el.dataset.sid);rm();}));
      } else {
        overlay.querySelectorAll('.sched-leave-btn').forEach(el=>el.addEventListener('click',()=>{selectedLeave=el.dataset.leave;rm();}));
      }
      overlay.querySelector('#am-end-date')?.addEventListener('change',e=>{endDateVal=e.target.value;});
      overlay.querySelector('#am-submit')?.addEventListener('click',async()=>{
        const a={employeeName:empName,schedule:schedType,startDate:date,endDate:schedType==='duration'?(endDateVal||null):null,skipDates:[],recentlyChanged:true};
        let lbl;
        if(activeTab==='job'){if(!selectedJob)return;a.type='job';a.jobNumber=selectedJob.number;a.clientName=selectedJob.client;lbl=selectedJob.number;}
        else if(activeTab==='site'){if(!selectedSite)return;a.type='site';a.siteId=selectedSite.id;a.siteName=selectedSite.name;a.clientName=selectedSite.clientName;lbl=selectedSite.name;}
        else{if(!selectedLeave)return;a.type='leave';a.siteName=selectedLeave;lbl=selectedLeave;}
        await DB.saveAssignment(a);assignments.push(a);
        queueNotification(empName,`Assigned ${lbl} ${schedType==='oneoff'?date:schedType==='indefinite'?'indefinitely':'to '+endDateVal}`);
        close();rerender(container);
      });
    }
    function close(){overlay.remove();activeModal=null;}
    overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
    rm();document.body.appendChild(overlay);activeModal=overlay;
  }

  function openQuickAssignModal(container) {
    const dk=getMobileDateKey();let selectedEmpName=null;
    const overlay=document.createElement('div');overlay.className='sched-modal-overlay';
    function rq() {
      const filtered=getFilteredEmployees();
      overlay.innerHTML=`<div class="sched-modal"><button class="sched-modal-close" id="qm-close">×</button><h3>Quick Assign — ${formatDateFull(mobileSelectedDate)}</h3>
        <label>Select Employee</label>
        <select class="sched-select" id="qm-emp" style="width:100%"><option value="">Choose…</option>${filtered.map(e=>`<option value="${e.name}" ${selectedEmpName===e.name?'selected':''}>${e.name} (${roleLabel(e.role)})</option>`).join('')}</select>
        <div class="sched-modal-actions"><button class="btn-secondary" id="qm-cancel">Cancel</button><button class="btn-primary" id="qm-next" ${!selectedEmpName?'disabled style="opacity:0.5;pointer-events:none"':''}>Next</button></div></div>`;
      overlay.querySelector('#qm-close')?.addEventListener('click',close);
      overlay.querySelector('#qm-cancel')?.addEventListener('click',close);
      overlay.querySelector('#qm-emp')?.addEventListener('change',e=>{selectedEmpName=e.target.value;rq();});
      overlay.querySelector('#qm-next')?.addEventListener('click',()=>{if(!selectedEmpName)return;close();openAssignModal(container,selectedEmpName,dk);});
    }
    function close(){overlay.remove();activeModal=null;}
    overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
    rq();document.body.appendChild(overlay);activeModal=overlay;
  }

  function openNotifSheet() {
    const overlay=document.createElement('div');overlay.className='sm-notif-overlay';
    function rs() {
      overlay.innerHTML=`<div class="sm-notif-sheet"><h3>Notifications ${unsent()?`(${unsent()} pending)`:''}</h3>
        <div style="display:flex;flex-direction:column;gap:0.4rem;">${notificationQueue.length===0?'<div class="sched-empty">No notifications</div>':''}
          ${notificationQueue.map(n=>`<div class="sched-notif-item"><span class="notif-msg"><strong>${n.employeeName}</strong>: ${n.message}</span>${n.sent?'<span class="notif-sent">✓</span>':`<button class="notif-send" data-notif-id="${n.id}">Send</button>`}</div>`).join('')}
        </div></div>`;
      overlay.querySelectorAll('.notif-send').forEach(b=>b.addEventListener('click',()=>{const n=notificationQueue.find(x=>x.id===b.dataset.notifId);if(n){n.sent=true;rs();}}));
    }
    overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove();});
    rs();document.body.appendChild(overlay);
  }

  function destroy(){if(activeModal){activeModal.remove();activeModal=null;}removeStyles();containerRef=null;}

  return { title:'Scheduling', version:PAGE_VERSION, render, destroy };
})();
