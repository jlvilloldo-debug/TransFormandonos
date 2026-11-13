/* =====================================================================
   InspectApp · Transformándonos — v5.17
   AGENDA DE CUADRILLAS: la planilla semanal de asignación, dentro de la app.
   Filas = personas (Horas y guardias → Personal) y contratistas; columnas = días.
   Las tareas son tareas comunes de la app (tabla tasks): el técnico las ve en "Mis tareas".
   Bandeja "Por asignar" = tareas sin asignar (las de la agenda, pendientes de inspecciones, tickets…).
   Asignan: administrador, supervisor, PM y coordinador. Técnicos y contratistas ven "Mi semana".
   Se carga recién al abrir la sección. Todo texto que viene de la base pasa por esc().
   ===================================================================== */

const AG_TYPES = {
  corr: { n: 'Correctivo', c: '#DC2626', i: '🔧', tt: 'reparacion' }, prev: { n: 'Preventivo', c: '#059669', i: '🛠', tt: 'mantenimiento' },
  inst: { n: 'Instalación', c: '#2563EB', i: '📦', tt: 'instalacion' }, rel: { n: 'Relevamiento', c: '#0E7490', i: '📐', tt: 'inspeccion' },
  med: { n: 'Medición OTDR', c: '#EA580C', i: '📈', tt: 'otro' }, infra: { n: 'Infraestructura', c: '#92400E', i: '🧱', tt: 'reparacion' },
  log: { n: 'Logística / traslado', c: '#475569', i: '🚚', tt: 'otro' }, cap: { n: 'Capacitación', c: '#DB2777', i: '🎓', tt: 'otro' },
  ofi: { n: 'Oficina / depósito', c: '#7C3AED', i: '🏢', tt: 'otro' },
};
const AG_TT2K = { reparacion: 'corr', mantenimiento: 'prev', instalacion: 'inst', inspeccion: 'rel', otro: 'log' };
const AG_SLOTS = { am: 'Mañana', pm: 'Tarde', full: 'Todo el día' };
const AG_HRS = { am: 4, pm: 4, full: 8 };
const AG_SKILLS = ['FO', 'OTDR', 'Energía', 'Radio', 'Redes', 'Infraestructura'];
const AG_DOW = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const AG_AV = { G: ['guard', 'De guardia'], F: ['off', 'Franco'], VAC: ['leave', 'Vacaciones'], LIC: ['leave', 'Licencia'] };
const AG_PRIO = { critica: ['c', 'CRÍTICA'], alta: ['a', 'ALTA'], normal: ['n', ''] };
const AG_LOCK = ['en_curso', 'completada', 'aprobada', 'rechazada'];
const AG_COLS = ['#2563EB', '#059669', '#7C3AED', '#DB2777', '#EA580C', '#0E7490', '#B45309', '#4F46E5', '#BE123C', '#15803D'];
const AG = { wk: null, view: 'week', day: 0, q: '', base: '', kind: '', sk: new Set(), picked: null, hint: null, sel: null, data: null };

function agCss(){
  if (document.getElementById('ag-css')) return;
  const s = document.createElement('style'); s.id = 'ag-css';
  s.textContent = `
.ag-head{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;margin-bottom:12px}
.ag-head h1{margin:0;font-size:21px}
.ag-weeknav{display:flex;align-items:center;gap:4px;background:#fff;border:1px solid var(--line);border-radius:12px;padding:3px}
.ag-weeknav button{border:0;background:transparent;border-radius:8px;padding:7px 10px;cursor:pointer;font:inherit}
.ag-weeknav button:hover{background:#EEF2F7}.ag-weeknav b{padding:0 6px;white-space:nowrap}
.ag-seg{display:inline-flex;background:#fff;border:1px solid var(--line);border-radius:12px;padding:3px}
.ag-seg button{border:0;background:transparent;padding:7px 12px;border-radius:9px;font:inherit;color:var(--muted);cursor:pointer}
.ag-seg button.on{background:var(--navy);color:#fff}
.ag-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:12px}
.ag-kpi{background:#fff;border:1px solid var(--line);border-radius:12px;padding:10px 12px;display:flex;gap:10px;align-items:center;text-align:left;font:inherit;cursor:pointer;color:inherit}
.ag-kpi .n{font-size:24px;font-weight:700;min-width:30px;font-variant-numeric:tabular-nums}.ag-kpi .t{font-size:12.5px;color:var(--muted);line-height:1.25}
.ag-kpi.red .n{color:#DC2626}.ag-kpi.amb .n{color:#D97706}.ag-kpi.grn .n{color:#059669}
.ag-filters{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px}
.ag-filters input,.ag-filters select{width:auto;margin:0}.ag-filters input{flex:1 1 180px;min-width:0}
.ag-chip{border:1px solid var(--line);background:#fff;border-radius:20px;padding:6px 11px;font:inherit;font-size:13px;cursor:pointer;color:inherit}
.ag-chip.on{background:var(--navy);color:#fff;border-color:var(--navy)}
.ag-board{display:grid;grid-template-columns:270px minmax(0,1fr);gap:12px;align-items:start}
@media(max-width:900px){.ag-board{grid-template-columns:minmax(0,1fr)}}
.ag-tray{background:#fff;border:1px solid var(--line);border-radius:14px;padding:12px;position:sticky;top:70px}
@media(max-width:900px){.ag-tray{position:static}}
.ag-tray h2{margin:0;font-size:15px;display:flex;justify-content:space-between}
.ag-tray .list{display:grid;gap:8px;margin-top:10px;max-height:60vh;overflow:auto}
@media(max-width:900px){.ag-tray .list{grid-auto-flow:column;grid-auto-columns:minmax(230px,1fr);max-height:none;overflow-x:auto;padding-bottom:4px}}
.ag-tray.drop{outline:2px dashed #2563EB;outline-offset:3px}
.ag-grid{background:#fff;border:1px solid var(--line);border-radius:14px;overflow:auto;max-height:78vh}
table.ag-g{border-collapse:separate;border-spacing:0;width:100%;min-width:980px;table-layout:fixed}
.ag-g th,.ag-g td{border-bottom:1px solid var(--line);border-right:1px solid var(--line);vertical-align:top}
.ag-g thead th{position:sticky;top:0;background:#fff;z-index:3;padding:7px 6px;text-align:left;font-weight:600;font-size:13px}
.ag-g thead th .d{font-size:18px;font-weight:700}.ag-g thead th .cap{font-size:11px;color:var(--muted);font-weight:500}
.ag-g thead th.today{background:#ECFDF5}.ag-g thead th.hol{background:#FEF3C7}
.ag-g .who{position:sticky;left:0;background:#fff;z-index:2;width:215px}.ag-g thead th.who{z-index:4}
.ag-who{display:flex;gap:9px;padding:9px 8px;align-items:flex-start;cursor:pointer}
.ag-av{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;font-weight:700;font-size:13px;color:#fff;flex:none}
.ag-av.ct{border-radius:9px;background:#EA580C}
.ag-who b{display:block;font-size:13.5px;line-height:1.2}.ag-who .meta{font-size:11.5px;color:var(--muted)}
.ag-ct{display:inline-block;font-size:10.5px;font-weight:700;background:#EA580C;color:#fff;border-radius:6px;padding:0 6px;margin-top:2px}
tr.ct .who{background:linear-gradient(90deg,#FFF3EA,#fff)}
.ag-sks{display:flex;gap:3px;flex-wrap:wrap;margin-top:3px}.ag-sk{font-size:10.5px;border:1px solid var(--line);border-radius:6px;padding:0 5px;color:var(--muted)}
.ag-load{height:5px;background:#EEF2F7;border-radius:4px;margin-top:5px;overflow:hidden}.ag-load i{display:block;height:100%;border-radius:4px}
.ag-cell{min-height:84px;padding:5px;display:flex;flex-direction:column;gap:4px;position:relative}
td.today .ag-cell{background:#F0FDF7}
.ag-cell.guard{background:repeating-linear-gradient(135deg,#EDE9FE 0 10px,transparent 10px 20px)}
.ag-cell.off{background:repeating-linear-gradient(135deg,#E5E7EB 0 6px,transparent 6px 12px)}
.ag-cell.leave{background:#FEF3C7}
.ag-cell.over{box-shadow:inset 0 0 0 2px #93C5FD;background:#DBEAFE}
.ag-cell.hint{box-shadow:inset 0 0 0 2px #059669}
.ag-cell.hint::after{content:"Sugerido";position:absolute;top:3px;right:4px;font-size:10px;font-weight:700;color:#065F46;background:#D1FAE5;border-radius:6px;padding:1px 5px}
.ag-cell.pick{cursor:copy}
.ag-bd{font-size:10.5px;font-weight:700;border-radius:6px;padding:1px 6px;align-self:flex-start;color:#fff}
.ag-bd.guard{background:#7C3AED}.ag-bd.off{background:#475569}.ag-bd.leave{background:#D97706}
.ag-add{border:1px dashed var(--line);background:transparent;border-radius:8px;color:var(--muted);font-size:12px;padding:3px;opacity:0;cursor:pointer;font:inherit}
.ag-cell:hover .ag-add,.ag-cell:focus-within .ag-add{opacity:1}
@media (hover:none){.ag-add{opacity:.8}}
.ag-tk{background:#fff;border:1px solid var(--line);border-left:4px solid var(--c);border-radius:8px;padding:5px 7px;font-size:12px;line-height:1.25;cursor:grab;text-align:left;display:block;user-select:none;color:var(--text)}
.ag-tk .t1{font-weight:600;display:flex;flex-wrap:wrap;gap:3px 4px;align-items:flex-start}.ag-tk .t1 .ag-pr{flex-basis:auto}.ag-tk .t1 span{flex:1 1 100%;min-width:0;overflow-wrap:break-word;hyphens:auto}
.ag-tk .t2{color:var(--muted);font-size:11px;margin-top:2px;display:flex;gap:6px;flex-wrap:wrap}
.ag-tk.sel{outline:2px solid #2563EB}.ag-tk.lock{cursor:pointer;opacity:.75}.ag-tk.done .t1 span{text-decoration:line-through}
.ag-pr{font-size:10px;font-weight:700;border-radius:5px;padding:0 4px;color:#fff;flex:none;font-style:normal}.ag-pr.c{background:#DC2626}.ag-pr.a{background:#D97706}
.ag-tray .ag-tk{font-size:13px;padding:8px 9px}
.ag-tray .ag-tk .row{display:flex;gap:6px;margin-top:6px}
.ag-tray .ag-tk .row button{border:1px solid var(--line);background:#EEF2F7;border-radius:7px;padding:3px 8px;font:inherit;font-size:12px;cursor:pointer}
.ag-legend{display:flex;gap:12px;flex-wrap:wrap;font-size:12px;color:var(--muted);margin-top:10px}.ag-legend span{display:inline-flex;gap:5px;align-items:center}.ag-legend i{width:12px;height:12px;border-radius:3px;display:inline-block}
.ag-pickbar{background:var(--navy);color:#fff;border-radius:12px;padding:9px 12px;display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-bottom:10px}
.ag-pickbar button{background:#fff;color:#0F2A4A;border:0;border-radius:8px;padding:5px 10px;font-weight:600;cursor:pointer}
.ag-dayc{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px}
.ag-dcard{background:#fff;border:1px solid var(--line);border-radius:14px;padding:10px;display:grid;gap:6px;align-content:start}.ag-dcard.free{border-color:#059669}
.ag-free{font-size:11px;font-weight:700;color:#065F46;background:#D1FAE5;border-radius:6px;padding:1px 6px}
.ag-types{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:6px}
.ag-types button{border:1px solid var(--line);background:#fff;border-radius:10px;padding:8px;text-align:left;font:inherit;font-size:12.5px;display:flex;gap:6px;align-items:center;cursor:pointer;color:inherit}
.ag-types button i{width:10px;height:10px;border-radius:3px;flex:none}.ag-types button.on{border-color:var(--c);box-shadow:inset 0 0 0 1px var(--c);font-weight:600}
.ag-opts{display:flex;gap:6px;flex-wrap:wrap}.ag-opts button{flex:1;border:1px solid var(--line);background:#fff;border-radius:10px;padding:8px;font:inherit;font-size:12.5px;cursor:pointer;min-width:70px;color:inherit}
.ag-opts button.on{background:var(--navy);color:#fff;border-color:var(--navy)}
.ag-warn{background:#FEF3C7;border-radius:10px;padding:8px 10px;font-size:13px;margin:6px 0}
.ag-msg{white-space:pre-wrap;background:#F8FAFC;border:1px solid var(--line);border-radius:10px;padding:10px;font-size:13px;max-height:240px;overflow:auto}
.ag-xl{overflow:auto;border:1px solid var(--line);border-radius:10px;max-height:300px}.ag-xl table{border-collapse:collapse;font-size:12px;min-width:100%}
.ag-xl th,.ag-xl td{border:1px solid var(--line);padding:4px 6px;text-align:left;vertical-align:top;white-space:pre-wrap}.ag-xl th{background:#EEF2F7;position:sticky;top:0}
.ag-diff{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:8px 0}.ag-diff div{background:#F8FAFC;border:1px solid var(--line);border-radius:10px;padding:8px;text-align:center}.ag-diff b{display:block;font-size:22px}
.ag-phone{max-width:420px;margin:0 auto;background:#fff;border:1px solid var(--line);border-radius:18px;padding:14px}
.ag-phone .day{border-top:1px solid var(--line);padding:10px 2px}.ag-phone .day h3{margin:0 0 6px;font-size:14px;display:flex;justify-content:space-between}`;
  document.head.appendChild(s);
}

/* ---------- fechas ---------- */
const agMon = s => { const d = dOf(s); const w = (d.getDay() + 6) % 7; d.setDate(d.getDate() - w); return dStr(d); };
const agDays = () => [...Array(7)].map((_, i) => addDays(AG.wk, i));
const agFmt = s => { const d = dOf(s); return `${d.getDate()}/${d.getMonth() + 1}`; };
const agDow = s => AG_DOW[(dOf(s).getDay() + 6) % 7];
const agIni = n => String(n || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
const agNorm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const agCan = () => isManager() && canWrite();

/* ---------- datos ---------- */
async function agLoad(){
  const days = agDays(), from = days[0], to = days[6];
  const prevFrom = addDays(from, -7);
  const COLS = TASK_COLS + ',slot,work_kind,skill,weekly';
  const q = async (p) => { const r = await p; if (r.error) throw r.error; return r.data || []; };
  let staff, contrs, guards = [], hols = [], tasks, tray = [], missingSql = false;
  try {
    [staff, contrs, guards, hols, tasks, tray] = await Promise.all([
      cachedQuick('ag-staff', () => sb.from('hh_staff').select('id,user_id,name,kind,company,phone,base,active,sort,skills').eq('active', true).order('sort').order('name').limit(500)),
      cachedQuick('ag-contrs', () => sb.from('contractors').select('id,name,phone,contact_name,active,staff_id,skills,base').eq('active', true).order('name')),
      q(sb.from('hh_guard').select('staff_id,day,code').gte('day', from).lte('day', to).limit(5000)).catch(() => []),
      q(sb.from('hh_holidays').select('day,name').gte('day', from).lte('day', to)).catch(() => []),
      cachedQuick('ag-t:' + from, () => sb.from('tasks').select(COLS).gte('due_date', prevFrom).lte('due_date', to).neq('status', 'cancelada').limit(3000)),
      agCan() ? cachedQuick('ag-tray', () => sb.from('tasks').select(COLS).eq('status', 'sin_asignar').order('due_date').limit(300)) : [],
    ]);
  } catch (e){
    if (/skills|slot|work_kind|weekly|column/i.test(e.message || '')) missingSql = true; else throw e;
  }
  if (missingSql) return { missingSql: true };
  const cById = new Map(contrs.map(c => [c.id, c]));
  const linked = new Map(contrs.filter(c => c.staff_id).map(c => [c.staff_id, c]));
  const rows = [];
  staff.filter(s => s.kind !== 'recurso' || true).forEach((s, i) => rows.push({ key: 's:' + s.id, type: 'staff', id: s.id, name: s.name, base: s.base || '', skills: s.skills || [], phone: s.phone || (linked.get(s.id) || {}).phone || '',
    ct: s.kind === 'contratista', co: s.company || '', col: AG_COLS[i % AG_COLS.length], crew: linked.get(s.id) || null, user_id: s.user_id }));
  contrs.filter(c => !c.staff_id).forEach(c => rows.push({ key: 'c:' + c.id, type: 'contr', id: c.id, name: c.name, base: c.base || '', skills: c.skills || [], phone: c.phone || '', ct: true, co: c.contact_name || '', col: '#EA580C' }));
  const av = {}; guards.forEach(g => { if (AG_AV[g.code]) av['s:' + g.staff_id + '|' + g.day] = g.code; });
  const hol = Object.fromEntries(hols.map(h => [h.day, h.name || 'Feriado']));
  const rowsOf = t => { const ks = (t.staff_ids || []).map(id => 's:' + id).filter(k => rows.some(r => r.key === k));
    if (ks.length) return ks; if (!t.contractor_id) return []; const c = cById.get(t.contractor_id); if (!c) return []; return [c.staff_id && rows.some(r => r.key === 's:' + c.staff_id) ? 's:' + c.staff_id : 'c:' + c.id]; };
  return { rows, cById, av, hol, tasks, prev: tasks.filter(t => t.due_date < from), week: tasks.filter(t => t.due_date >= from && t.status !== 'sin_asignar'), tray, rowsOf };
}
const agKind = t => t.work_kind && AG_TYPES[t.work_kind] ? t.work_kind : AG_TT2K[t.task_type] || 'corr';
const agSite = t => (t.sites || []).map(s => s.site_name || s.name).filter(Boolean).join(', ');
const agAt = (D, rk, day) => D.week.filter(t => t.due_date === day && D.rowsOf(t).includes(rk)).sort((a, b) => ({ am: 0, full: 1, pm: 2 }[a.slot || 'full'] - { am: 0, full: 1, pm: 2 }[b.slot || 'full']));
const agHrs = (D, rk, day) => agAt(D, rk, day).reduce((s, t) => s + AG_HRS[t.slot || 'full'], 0);
const agAv = (D, rk, day) => D.av[rk + '|' + day] || null;

/* ---------- pantalla ---------- */
async function viewAgenda(v, sub){
  agCss();
  if (!AG.wk){ const t = todayStr(), d = dOf(t).getDay(); AG.wk = agMon(d === 5 || d === 6 || d === 0 ? addDays(t, 7 - ((d + 6) % 7)) : t); }
  if (!agCan()) AG.view = 'tech';
  const D = AG.data = await agLoad();
  if (D.missingSql){ v.innerHTML = `<div class="card"><h2>📅 Agenda de cuadrillas</h2><p>Falta cargar <b>33_agenda.sql</b> en Supabase (SQL Editor). Avisale al administrador.</p></div>`; return; }
  if (AG.view === 'tech' && !AG.sel){ const mine = D.rows.find(r => r.user_id === me.id) || (isContractor() ? D.rows.find(r => r.type === 'contr' && r.id === me.contractor_id) : null); AG.sel = mine ? mine.key : D.rows[0]?.key; }
  agRender(v);
}
function agRender(v){
  v = v || $('#view'); const D = AG.data; if (!D) return;
  const days = agDays(), today = todayStr();
  const lbl = `${agFmt(days[0])} al ${agFmt(days[6])}` + (AG.wk === agMon(today) ? ' · esta semana' : AG.wk === addDays(agMon(today), 7) ? ' · próxima' : '');
  const mgr = agCan();
  v.innerHTML = `
    <div class="ag-head"><div><h1>📅 Agenda de cuadrillas</h1><div class="muted sm">${mgr ? 'Tareas del día a día: arrastralas a la persona y al día.' : 'Tu semana de trabajo.'}</div></div>
      ${mgr ? `<div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn" id="ag-new">＋ Tarea rápida</button><button class="btn sec" id="ag-copy" title="Repite las tareas marcadas como fijas de la semana anterior">⧉ Copiar semana anterior</button>
        <button class="btn" id="ag-wa" style="background:#15803D">💬 Avisar la semana</button><button class="btn sec" id="ag-xo">⬇ Excel</button>
        <label class="btn sec" style="margin:0;cursor:pointer">⬆ Subir Excel<input type="file" id="ag-xi" accept=".xlsx,.xls,.csv" class="hidden"></label></div>` : ''}</div>
    <div class="ag-head"><div class="ag-weeknav"><button data-agw="-1" aria-label="Semana anterior">‹</button><b>${lbl}</b><button data-agw="1" aria-label="Semana siguiente">›</button><button data-agw="0">Esta semana</button></div>
      ${mgr ? `<div class="ag-seg">${[['week', 'Semana'], ['day', 'Día'], ['tech', 'Vista del técnico']].map(([k, l]) => `<button data-agv="${k}" class="${AG.view === k ? 'on' : ''}">${l}</button>`).join('')}</div>` : ''}</div>
    ${mgr ? agKpis() : ''}
    ${mgr && AG.view !== 'tech' ? agFilters() : ''}
    <div id="ag-pick"></div><div id="ag-body"></div>
    ${AG.view !== 'tech' ? `<div class="ag-legend"><span><i style="background:#EDE9FE;border:1px solid #7C3AED"></i>De guardia</span><span><i style="background:#E5E7EB;border:1px solid #475569"></i>Franco</span><span><i style="background:#FEF3C7;border:1px solid #D97706"></i>Licencia / vacaciones</span><span><i style="background:#ECFDF5;border:1px solid #059669"></i>Hoy</span>${Object.values(AG_TYPES).map(T => `<span><i style="background:${T.c}"></i>${T.n}</span>`).join('')}</div>
      <p class="muted sm">La disponibilidad sale de <a href="#/tools/hh/guardias">Horas y guardias</a>. Tocá el nombre de una persona para cargar su base y habilidades.</p>` : ''}`;
  agBody(); agBind(v);
}
function agKpis(){
  const D = AG.data, days = agDays(), today = todayStr();
  let nb = addDays(today, 1); while ([0, 6].includes(dOf(nb).getDay())) nb = addDays(nb, 1);
  const crit = D.tray.filter(t => t.priority === 'critica').length;
  const free = days.includes(nb) ? D.rows.filter(r => !agAv(D, r.key, nb) && !agHrs(D, r.key, nb)).length : null;
  const over = D.rows.filter(r => days.some(d => agHrs(D, r.key, d) > 8)).length;
  const conf = D.week.filter(t => days.includes(t.due_date) && D.rowsOf(t).some(k => ['F', 'VAC', 'LIC'].includes(agAv(D, k, t.due_date)))).length;
  return `<div class="ag-kpis">
    <button class="ag-kpi ${crit ? 'red' : 'amb'}" data-agk="tray"><span class="n">${D.tray.length}</span><span class="t">Por asignar${crit ? `<br><b style="color:#DC2626">${crit} crítica${crit > 1 ? 's' : ''}</b>` : ''}</span></button>
    <button class="ag-kpi grn" data-agk="free" data-day="${nb}"><span class="n">${free ?? '—'}</span><span class="t">Libres el ${agDow(nb).toLowerCase()} ${agFmt(nb)}${free == null ? '<br>(otra semana)' : ''}</span></button>
    <button class="ag-kpi ${over ? 'amb' : ''}" data-agk="over"><span class="n">${over}</span><span class="t">Con más de 8 h<br>en algún día</span></button>
    <button class="ag-kpi ${conf ? 'red' : ''}" data-agk="conf"><span class="n">${conf}</span><span class="t">Asignadas a alguien<br>de franco o licencia</span></button></div>`;
}
function agFilters(){
  const bases = [...new Set(AG.data.rows.map(r => r.base).filter(Boolean))].sort();
  return `<div class="ag-filters"><input id="ag-q" type="search" placeholder="Buscar persona, sitio o tarea" value="${esc(AG.q)}">
    <select id="ag-base"><option value="">Todas las bases</option>${bases.map(b => `<option ${AG.base === b ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select>
    <select id="ag-kind"><option value="">Propios y contratistas</option><option value="p" ${AG.kind === 'p' ? 'selected' : ''}>Solo personal propio</option><option value="c" ${AG.kind === 'c' ? 'selected' : ''}>Solo contratistas</option></select>
    <span class="muted sm">Habilidad:</span>${AG_SKILLS.map(s => `<button type="button" class="ag-chip ${AG.sk.has(s) ? 'on' : ''}" data-agsk="${esc(s)}">${esc(s)}</button>`).join('')}</div>`;
}
function agRowOk(r){
  const D = AG.data, q = agNorm(AG.q);
  return (!AG.base || r.base === AG.base) && (!AG.kind || (AG.kind === 'c') === r.ct) && (!AG.sk.size || r.skills.some(s => AG.sk.has(s))) &&
    (!q || agNorm(r.name + ' ' + r.base + ' ' + r.co).includes(q) || D.week.some(t => D.rowsOf(t).includes(r.key) && agNorm(t.title + ' ' + agSite(t)).includes(q)));
}
function agChip(t, tray){
  const T = AG_TYPES[agKind(t)], pr = AG_PRIO[t.priority] || AG_PRIO.normal, lock = AG_LOCK.includes(t.status), site = agSite(t);
  return `<div role="button" tabindex="0" class="ag-tk ${AG.picked === t.id ? 'sel' : ''} ${lock ? 'lock' : ''} ${['completada', 'aprobada'].includes(t.status) ? 'done' : ''}" style="--c:${T.c}" ${lock || !agCan() ? '' : 'draggable="true"'} data-agt="${esc(t.id)}">
    <div class="t1">${pr[1] ? `<i class="ag-pr ${pr[0]}">${pr[1]}</i>` : ''}<span>${T.i} ${esc(t.title)}</span></div>
    <div class="t2"><span>${AG_SLOTS[t.slot || 'full']}</span>${site ? `<span>📍 ${esc(site)}</span>` : ''}${t.skill ? `<span>🧰 ${esc(t.skill)}</span>` : ''}${lock ? `<span>${esc(TASK_ST[t.status] || t.status)}</span>` : ''}${t.weekly ? '<span>🔁</span>' : ''}${t.is_pending ? '<span>⚠ pendiente</span>' : ''}${t.ticket_id ? '<span>🎫 ticket</span>' : ''}</div>
    ${tray && agCan() ? `<div class="row"><button type="button" data-agsug="${esc(t.id)}">⭐ Sugerir</button><button type="button" data-agpk="${esc(t.id)}">✋ Asignar</button></div>` : ''}</div>`;
}
function agTray(){
  const D = AG.data; const ord = { critica: 0, alta: 1, normal: 2 };
  const list = [...D.tray].sort((a, b) => (ord[a.priority] ?? 2) - (ord[b.priority] ?? 2) || String(a.due_date).localeCompare(b.due_date));
  return `<aside class="ag-tray" id="ag-tray"><h2>📥 Por asignar <span class="muted sm">${list.length}</span></h2>
    <div class="muted sm">Arrastrá a una celda, o ✋ Asignar y tocá la celda. Soltá acá para desasignar.</div>
    <div class="list">${list.map(t => agChip(t, true)).join('') || '<div class="muted sm" style="padding:10px 0">Todo asignado 👌</div>'}</div>
    <button class="btn sec small" id="ag-tnew" style="margin-top:10px;width:100%">＋ Agregar a la bandeja</button></aside>`;
}
function agBody(){
  const D = AG.data, days = agDays(), today = todayStr(), box = $('#ag-body'), mgr = agCan();
  const p = D.tray.find(t => t.id === AG.picked) || D.week.find(t => t.id === AG.picked);
  $('#ag-pick').innerHTML = p ? `<div class="ag-pickbar"><span>✋ Tocá la celda de la persona y el día para <b>${esc(p.title)}</b></span><button type="button" data-agpkx>Cancelar</button></div>` : '';
  const who = r => { const h = days.reduce((s, d) => s + agHrs(D, r.key, d), 0), lc = h > 40 ? '#DC2626' : h >= 32 ? '#D97706' : '#059669';
    return `<div class="ag-who" ${mgr ? `data-agr="${esc(r.key)}" title="Tocá para cargar base y habilidades"` : ''}><span class="ag-av ${r.ct ? 'ct' : ''}" style="${r.ct ? '' : 'background:' + r.col}">${r.ct ? '🏗' : esc(agIni(r.name))}</span><div style="min-width:0"><b>${esc(r.name)}</b>
      <div class="meta">${esc(r.base || 'Sin base')}${r.ct ? '' : ' · Personal propio'}</div>${r.ct ? `<span class="ag-ct">CONTRATISTA${r.co && r.type === 'staff' ? ' · ' + esc(r.co) : ''}</span>` : ''}
      ${r.skills.length ? `<div class="ag-sks">${r.skills.map(s => `<span class="ag-sk">${esc(s)}</span>`).join('')}</div>` : ''}
      <div class="ag-load" title="${h} h de 40 h"><i style="width:${Math.min(100, h * 2.5)}%;background:${lc}"></i></div><div class="meta">${h} h / 40 h</div></div></div>`; };
  const cell = (r, d) => { const a = agAv(D, r.key, d), cls = a ? AG_AV[a][0] : '', list = agAt(D, r.key, d), hs = agHrs(D, r.key, d);
    return `<div class="ag-cell ${cls} ${AG.hint && AG.hint.has(r.key + '|' + d) ? 'hint' : ''} ${AG.picked ? 'pick' : ''}" data-agc="${esc(r.key)}|${d}">
      ${a ? `<span class="ag-bd ${cls}">${AG_AV[a][1]}</span>` : ''}${list.map(t => agChip(t)).join('')}${hs > 8 ? `<span class="ag-bd leave">⚠ ${hs} h</span>` : ''}
      ${mgr ? `<button type="button" class="ag-add" data-aga="${esc(r.key)}|${d}" aria-label="Agregar tarea">＋</button>` : ''}</div>`; };
  const rows = D.rows.filter(agRowOk);
  if (AG.view === 'week'){
    box.innerHTML = `<div class="ag-board">${agTray()}<div class="ag-grid"><table class="ag-g"><thead><tr><th class="who">Persona / cuadrilla</th>${days.map((d, i) => `<th class="${d === today ? 'today' : D.hol[d] ? 'hol' : ''}" title="${esc(D.hol[d] || '')}"><span class="cap">${AG_DOW[i]}${D.hol[d] ? ' · feriado' : ''}</span><br><span class="d">${dOf(d).getDate()}</span> <span class="cap">${['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][dOf(d).getMonth()]}</span></th>`).join('')}</tr></thead>
      <tbody>${rows.map(r => `<tr class="${r.ct ? 'ct' : ''}"><td class="who">${who(r)}</td>${days.map(d => `<td class="${d === today ? 'today' : ''}">${cell(r, d)}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="8" style="padding:20px" class="muted">No hay personas cargadas. Agregalas en <a href="#/tools/hh/personal">Horas y guardias → Personal</a> o en Mi empresa → Contratistas.</td></tr>`}</tbody></table></div></div>`;
  } else if (AG.view === 'day'){
    const d = days[AG.day];
    box.innerHTML = `<div class="ag-filters">${days.map((x, i) => `<button type="button" class="ag-chip ${i === AG.day ? 'on' : ''}" data-agdi="${i}">${AG_DOW[i]} ${agFmt(x)}</button>`).join('')}</div>
      <div class="ag-board">${agTray()}<div class="ag-dayc">${rows.map(r => { const a = agAv(D, r.key, d), list = agAt(D, r.key, d), free = !a && !list.length;
        return `<div class="ag-dcard ${free ? 'free' : ''}"><div class="row" style="gap:9px;align-items:center;flex-wrap:nowrap"><span class="ag-av ${r.ct ? 'ct' : ''}" style="${r.ct ? '' : 'background:' + r.col}">${r.ct ? '🏗' : esc(agIni(r.name))}</span><div style="flex:1;min-width:0"><b>${esc(r.name)}</b><div class="muted sm">${esc(r.base || '')} · ${agHrs(D, r.key, d)} h</div>${r.ct ? '<span class="ag-ct">CONTRATISTA</span>' : ''}</div>${free ? '<span class="ag-free">LIBRE</span>' : a ? `<span class="ag-bd ${AG_AV[a][0]}">${AG_AV[a][1]}</span>` : ''}</div>
          ${cell(r, d)}</div>`; }).join('')}</div></div>`;
  } else {
    const r = D.rows.find(x => x.key === AG.sel) || D.rows[0];
    if (!r){ box.innerHTML = `<div class="card muted">${mgr ? 'No hay personas cargadas.' : 'Tu usuario todavía no está vinculado a una persona de Horas y guardias. Pedíselo al coordinador.'}</div>`; return; }
    const h = days.reduce((s, d) => s + agHrs(D, r.key, d), 0);
    box.innerHTML = `${mgr ? `<div class="ag-filters"><span class="muted sm">Así lo ve en el celular:</span><select id="ag-sel">${D.rows.map(x => `<option value="${esc(x.key)}" ${x.key === r.key ? 'selected' : ''}>${x.ct ? '🏗 ' : ''}${esc(x.name)}</option>`).join('')}</select></div>` : ''}
      <div class="ag-phone"><div class="row" style="gap:10px;align-items:center;flex-wrap:nowrap;margin-bottom:6px"><span class="ag-av ${r.ct ? 'ct' : ''}" style="${r.ct ? '' : 'background:' + r.col}">${r.ct ? '🏗' : esc(agIni(r.name))}</span><div><b>${mgr ? esc(r.name) : 'Mi semana'}</b><div class="muted sm">${agFmt(days[0])} al ${agFmt(days[6])} · ${h} h</div></div></div>
      ${days.map((d, i) => { const a = agAv(D, r.key, d), list = agAt(D, r.key, d);
        return `<div class="day"><h3><span>${AG_DOW[i]} ${agFmt(d)}${D.hol[d] ? ' · ' + esc(D.hol[d]) : ''}</span>${a ? `<span class="ag-bd ${AG_AV[a][0]}">${AG_AV[a][1]}</span>` : list.length ? '' : '<span class="muted sm">Sin tareas</span>'}</h3>
          ${list.map(t => `<a href="#/tasks/${esc(t.id)}" style="text-decoration:none;display:block;margin-bottom:6px">${agChip(t)}</a>`).join('')}</div>`; }).join('')}</div>`;
  }
}

/* ---------- eventos ---------- */
let agDrag = null;
function agBind(v){
  const D = AG.data;
  v.querySelectorAll('[data-agw]').forEach(b => b.onclick = () => { const n = Number(b.dataset.agw); AG.wk = n ? addDays(AG.wk, 7 * n) : agMon(todayStr()); AG.hint = null; if (!n) AG.day = (dOf(todayStr()).getDay() + 6) % 7; route(); });
  v.querySelectorAll('[data-agv]').forEach(b => b.onclick = () => { AG.view = b.dataset.agv; agRender(); });
  $('#ag-q') && ($('#ag-q').oninput = e => { AG.q = e.target.value; agBody(); });
  $('#ag-base') && ($('#ag-base').onchange = e => { AG.base = e.target.value; agBody(); });
  $('#ag-kind') && ($('#ag-kind').onchange = e => { AG.kind = e.target.value; agBody(); });
  v.querySelectorAll('[data-agsk]').forEach(b => b.onclick = () => { const s = b.dataset.agsk; AG.sk.has(s) ? AG.sk.delete(s) : AG.sk.add(s); b.classList.toggle('on', AG.sk.has(s)); agBody(); });
  $('#ag-new') && ($('#ag-new').onclick = () => agTaskSheet(null));
  $('#ag-copy') && ($('#ag-copy').onclick = agCopyPrev);
  $('#ag-wa') && ($('#ag-wa').onclick = agWaSheet);
  $('#ag-xo') && ($('#ag-xo').onclick = agXlExport);
  $('#ag-xi') && ($('#ag-xi').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) agXlImport(f); });
  if (v.dataset.agBound) return; v.dataset.agBound = '1';
  v.addEventListener('click', e => {
    if (!AG.data || !location.hash.startsWith('#/agenda')) return;
    const t = e.target;
    const g = c => t.closest(c);
    if (g('[data-agsug]')){ e.stopPropagation(); return agSuggest(g('[data-agsug]').dataset.agsug); }
    if (g('[data-agpk]')){ e.stopPropagation(); const id = g('[data-agpk]').dataset.agpk; AG.picked = AG.picked === id ? null : id; AG.hint = null; return agBody(); }
    if (g('[data-agpkx]')){ AG.picked = null; AG.hint = null; return agBody(); }
    if (g('#ag-tnew')) return agTaskSheet(null);
    if (g('[data-agdi]')){ AG.day = Number(g('[data-agdi]').dataset.agdi); return agBody(); }
    if (g('[data-agr]')) return agSkillsSheet(g('[data-agr]').dataset.agr);
    if (g('[data-agk]')){ const k = g('[data-agk]').dataset.agk;
      if (k === 'tray') $('#ag-tray')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      else if (k === 'free'){ const d = g('[data-agk]').dataset.day; AG.wk = agMon(d); AG.view = 'day'; AG.day = (dOf(d).getDay() + 6) % 7; route(); }
      else toast(k === 'conf' ? 'Son las tareas que están sobre celdas grises o amarillas (franco o licencia).' : 'Buscá el aviso ⚠ con las horas dentro de la celda.');
      return; }
    const add = g('[data-aga]'); if (add){ if (AG.picked) return agAssign(AG.picked, null, add.dataset.aga); const [rk, d] = agSplit(add.dataset.aga); return agTaskSheet(null, { row: rk, day: d }); }
    const tk = g('[data-agt]');
    if (tk && !g('.ag-phone')){ const c = tk.closest('[data-agc]'); if (AG.picked && c) return agAssign(AG.picked, null, c.dataset.agc);
      const task = D.tray.find(x => x.id === tk.dataset.agt) || D.week.find(x => x.id === tk.dataset.agt); if (task) return agTaskSheet(task, { from: c ? agSplit(c.dataset.agc)[0] : null }); }
    const c = g('[data-agc]'); if (c && AG.picked) return agAssign(AG.picked, null, c.dataset.agc);
  });
  v.addEventListener('change', e => { if (e.target.id === 'ag-sel'){ AG.sel = e.target.value; agBody(); } });
  v.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[data-agt]')){ e.preventDefault(); e.target.click(); } });
  // arrastrar y soltar (compu)
  v.addEventListener('dragstart', e => { const tk = e.target.closest && e.target.closest('[data-agt]'); if (!tk) return; const c = tk.closest('[data-agc]'); agDrag = { id: tk.dataset.agt, from: c ? agSplit(c.dataset.agc)[0] : null }; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', agDrag.id); } catch {} });
  v.addEventListener('dragover', e => { const c = e.target.closest && (e.target.closest('[data-agc]') || e.target.closest('#ag-tray')); if (!c || !agDrag) return; e.preventDefault(); v.querySelectorAll('.over,.drop').forEach(x => x.classList.remove('over', 'drop')); c.classList.add(c.id === 'ag-tray' ? 'drop' : 'over'); });
  v.addEventListener('dragleave', e => { const c = e.target.closest && e.target.closest('[data-agc]'); c && c.classList.remove('over'); });
  v.addEventListener('drop', e => { const c = e.target.closest && (e.target.closest('[data-agc]') || e.target.closest('#ag-tray')); v.querySelectorAll('.over,.drop').forEach(x => x.classList.remove('over', 'drop')); if (!c || !agDrag) return; e.preventDefault();
    const dd = agDrag; agDrag = null; if (c.id === 'ag-tray') agUnassign(dd.id); else agAssign(dd.id, dd.from, c.dataset.agc); });
  v.addEventListener('dragend', () => { agDrag = null; v.querySelectorAll('.over,.drop').forEach(x => x.classList.remove('over', 'drop')); });
}
const agSplit = s => { const i = s.lastIndexOf('|'); return [s.slice(0, i), s.slice(i + 1)]; };

/* ---------- asignar / mover ---------- */
function agPatch(t, fromKey, toKey, day){
  const D = AG.data, to = D.rows.find(r => r.key === toKey);
  let staff = [...(t.staff_ids || [])], contr = t.contractor_id || null;
  const from = fromKey ? D.rows.find(r => r.key === fromKey) : null;
  if (from && from.type === 'staff') staff = staff.filter(x => x !== from.id);
  if (from && (from.type === 'contr' || (from.crew && from.crew.id === contr))) contr = null;
  if (to.type === 'staff'){ if (!staff.includes(to.id)) staff.push(to.id); if (to.crew) contr = to.crew.id; else if (!fromKey || !contr) contr = contr && staff.length > 1 ? contr : null; }
  else { contr = to.id; if (!fromKey) staff = []; }
  return { due_date: day, staff_ids: staff, contractor_id: contr, ...(t.status === 'sin_asignar' ? { status: 'asignada' } : {}) };
}
async function agAssign(id, fromKey, cellKey, force){
  if (!needOnline()) return;
  const D = AG.data, t = D.tray.find(x => x.id === id) || D.week.find(x => x.id === id); if (!t) return;
  if (AG_LOCK.includes(t.status)) return toast('Esa tarea ya está en curso o terminada: no se mueve.');
  const [rk, day] = agSplit(cellKey), r = D.rows.find(x => x.key === rk); if (!r) return;
  if (fromKey === rk && t.due_date === day) return;
  const a = agAv(D, rk, day), same = D.rowsOf(t).includes(rk) && t.due_date === day, after = agHrs(D, rk, day) + (same ? 0 : AG_HRS[t.slot || 'full']);
  const warns = [];
  if (a === 'F') warns.push(`${esc(r.name)} está de <b>franco</b> ese día.`);
  if (a === 'VAC' || a === 'LIC') warns.push(`${esc(r.name)} está de <b>${a === 'VAC' ? 'vacaciones' : 'licencia'}</b> ese día.`);
  if (D.hol[day]) warns.push(`Es <b>feriado</b> (${esc(D.hol[day])}).`);
  if (after > 8) warns.push(`Le quedarían <b>${after} h</b> ese día.`);
  if (t.skill && r.skills.length && !r.skills.includes(t.skill)) warns.push(`La tarea pide <b>${esc(t.skill)}</b> y ${esc(r.name)} no la tiene cargada.`);
  if (warns.length && !force){
    const m = modal(`<h2 style="margin-top:0">Antes de asignar</h2>${warns.map(w => `<div class="ag-warn">⚠ ${w}</div>`).join('')}
      <div class="row" style="justify-content:flex-end;gap:8px;margin-top:10px"><button class="btn sec" data-close-modal>Elegir otro</button><button class="btn" id="agw-ok">Asignar igual</button></div>`);
    $('#agw-ok').onclick = () => { m.close(); agAssign(id, fromKey, cellKey, true); }; return;
  }
  const prev = { due_date: t.due_date, staff_ids: t.staff_ids || [], contractor_id: t.contractor_id, status: t.status };
  const patch = agPatch(t, fromKey || (t.status === 'sin_asignar' ? null : D.rowsOf(t)[0] || null), rk, day);
  const { error } = await sb.from('tasks').update(patch).eq('id', id);
  if (error) return toast(errText(error));
  AG.picked = null; AG.hint = null;
  toast(`Asignada a ${r.name} · ${agDow(day)} ${agFmt(day)}`);
  agToastUndo(async () => { await sb.from('tasks').update(prev).eq('id', id); route(); });
  route();
}
async function agUnassign(id){
  if (!needOnline()) return;
  const t = AG.data.week.find(x => x.id === id); if (!t) return;
  if (AG_LOCK.includes(t.status)) return toast('Esa tarea ya está en curso o terminada.');
  const prev = { staff_ids: t.staff_ids || [], contractor_id: t.contractor_id, status: t.status };
  const { error } = await sb.from('tasks').update({ staff_ids: [], contractor_id: null, status: 'sin_asignar' }).eq('id', id);
  if (error) return toast(errText(error));
  toast('Volvió a la bandeja'); agToastUndo(async () => { await sb.from('tasks').update(prev).eq('id', id); route(); }); route();
}
function agToastUndo(fn){
  setTimeout(() => { const tt = document.querySelector('.toast'); if (!tt || tt.querySelector('[data-agundo]')) return;
    const b = document.createElement('button'); b.type = 'button'; b.dataset.agundo = '1'; b.textContent = 'Deshacer'; b.style.cssText = 'margin-left:10px;background:transparent;border:1px solid rgba(255,255,255,.5);color:#fff;border-radius:8px;padding:2px 8px;cursor:pointer;pointer-events:auto';
    b.onclick = () => { tt.remove(); fn(); }; tt.appendChild(b); tt.style.pointerEvents = 'auto'; }, 50);
}
function agSuggest(id){
  const D = AG.data, t = D.tray.find(x => x.id === id); if (!t) return;
  const days = agDays(), today = todayStr(), sc = [];
  const siteBase = agNorm(agSite(t) + ' ' + (t.contract || ''));
  D.rows.forEach(r => days.forEach((d, i) => { if (d < today || agAv(D, r.key, d) || D.hol[d] || i > 4) return;
    const h = agHrs(D, r.key, d); if (h + AG_HRS[t.slot || 'full'] > 8) return; if (t.skill && !r.skills.includes(t.skill)) return;
    sc.push([(r.base && siteBase.includes(agNorm(r.base)) ? 10 : 0) + (8 - h) - i * 1.5 + (t.priority === 'critica' ? -i * 3 : 0), r.key + '|' + d]); }));
  AG.hint = new Set(sc.sort((a, b) => b[0] - a[0]).slice(0, 5).map(x => x[1])); AG.picked = id;
  if (AG.view !== 'week'){ AG.view = 'week'; agRender(); } else agBody();
  toast(AG.hint.size ? `⭐ ${AG.hint.size} opciones en verde: libres, con la habilidad y menos carga. Tocá una.` : 'No hay nadie libre con esa habilidad esta semana.');
}

/* ---------- tarea rápida / editar ---------- */
function agTaskSheet(t, pre = {}){
  if (!agCan()){ if (t) location.hash = '#/tasks/' + t.id; return; }
  const D = AG.data, isNew = !t, days = agDays();
  const st = isNew ? { title: '', kind: 'corr', site: '', prio: 'normal', row: pre.row || '', slot: 'full', day: pre.day || null, skill: '', notes: '', weekly: false }
    : { title: t.title, kind: agKind(t), site: agSite(t), prio: t.priority || 'normal', row: pre.from || D.rowsOf(t)[0] || '', slot: t.slot || 'full', day: t.status === 'sin_asignar' ? null : t.due_date, skill: t.skill || '', notes: t.description || '', weekly: !!t.weekly };
  const extra = new Set();
  const lock = t && AG_LOCK.includes(t.status);
  const draw = () => {
    const m = modal(`<div class="row between"><h2 style="margin:0">${isNew ? '＋ Tarea rápida' : '✏️ Tarea'}</h2>${t ? `<a class="btn sec small" href="#/tasks/${esc(t.id)}" data-close-modal>Abrir la tarea</a>` : ''}</div>
      ${lock ? `<div class="ag-warn">Esta tarea está ${esc(TASK_ST[t.status])}: solo se puede ver.</div>` : ''}
      <label>Qué hay que hacer</label><input id="agt-ti" maxlength="300" value="${esc(st.title)}" placeholder="Ej.: Cambiar ONT en nodo Recreo">
      <label>Tipo</label><div class="ag-types">${Object.entries(AG_TYPES).map(([k, T]) => `<button type="button" data-ty="${k}" class="${st.kind === k ? 'on' : ''}" style="--c:${T.c}"><i style="background:${T.c}"></i>${T.i} ${T.n}</button>`).join('')}</div>
      <label>Dónde (sitio o dirección)</label><input id="agt-si" maxlength="200" value="${esc(st.site)}" placeholder="Ej.: EPI San Justo">
      <label>Prioridad</label><div class="ag-opts">${[['critica', '🔴 Crítica 24 h'], ['alta', '🟠 Alta 72 h'], ['normal', '⚪ Normal']].map(([k, l]) => `<button type="button" data-pr="${k}" class="${st.prio === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="row" style="flex-wrap:wrap"><div class="grow"><label>Persona / cuadrilla</label><select id="agt-ro"><option value="">— Dejar en la bandeja —</option>${D.rows.map(r => `<option value="${esc(r.key)}" ${st.row === r.key ? 'selected' : ''}>${r.ct ? '🏗 ' : ''}${esc(r.name)}${r.base ? ' · ' + esc(r.base) : ''}</option>`).join('')}</select></div>
        <div class="grow"><label>Turno</label><select id="agt-sl">${Object.entries(AG_SLOTS).map(([k, l]) => `<option value="${k}" ${st.slot === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>
      <label>Día${isNew ? ' (tocá varios para repetirla en la semana)' : ''}</label><div class="ag-opts">${days.map((d, i) => `<button type="button" data-dy="${d}" class="${st.day === d || extra.has(d) ? 'on' : ''}">${AG_DOW[i]} ${dOf(d).getDate()}</button>`).join('')}</div>
      <div class="row" style="flex-wrap:wrap"><div class="grow"><label>Habilidad que necesita</label><select id="agt-sk"><option value="">Cualquiera</option>${AG_SKILLS.map(s => `<option ${st.skill === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
        <div class="grow"><label>&nbsp;</label><label class="row" style="gap:6px;font-weight:400;flex-wrap:nowrap"><input type="checkbox" id="agt-wk" style="width:auto;margin:0" ${st.weekly ? 'checked' : ''}> 🔁 Fija: se copia cada semana</label></div></div>
      <label>Notas para el técnico</label><textarea id="agt-no" maxlength="2000" placeholder="Contacto en sitio, ticket del cliente, materiales…">${esc(st.notes)}</textarea>
      <div class="err" id="agt-err"></div>
      <div class="row between" style="margin-top:10px;gap:8px;flex-wrap:wrap">${!isNew && !lock ? `<div class="row" style="gap:6px;flex-wrap:wrap">${t.status !== 'sin_asignar' ? '<button class="btn sec small" id="agt-un">📥 A la bandeja</button>' : ''}<button class="btn sec small" id="agt-del" style="color:var(--red)">🗑 Cancelar tarea</button></div>` : '<span></span>'}
        <div class="row" style="gap:6px">${!isNew && st.row ? '<button class="btn small" id="agt-wa" style="background:#15803D">💬 Avisar</button>' : ''}<button class="btn sec" data-close-modal>Cerrar</button>${lock ? '' : `<button class="btn" id="agt-ok">${isNew ? 'Crear' : 'Guardar'}</button>`}</div></div>`, { wide: true });
    const keep = () => { st.title = $('#agt-ti').value; st.site = $('#agt-si').value; st.row = $('#agt-ro').value; st.slot = $('#agt-sl').value; st.skill = $('#agt-sk').value; st.notes = $('#agt-no').value; st.weekly = $('#agt-wk').checked; };
    m.el.querySelectorAll('[data-ty]').forEach(b => b.onclick = () => { keep(); st.kind = b.dataset.ty; if (st.kind === 'infra' && !st.skill) st.skill = 'Infraestructura'; draw(); });
    m.el.querySelectorAll('[data-pr]').forEach(b => b.onclick = () => { keep(); st.prio = b.dataset.pr; draw(); });
    m.el.querySelectorAll('[data-dy]').forEach(b => b.onclick = () => { keep(); const d = b.dataset.dy;
      if (isNew){ if (st.day === d){ st.day = [...extra][0] || null; if (st.day) extra.delete(st.day); } else if (extra.has(d)) extra.delete(d); else if (!st.day) st.day = d; else extra.add(d); }
      else st.day = st.day === d ? null : d; draw(); });
    $('#agt-ok') && ($('#agt-ok').onclick = async () => {
      keep(); if (!needOnline()) return;
      if (!st.title.trim()) return ($('#agt-err').textContent = 'Escribí qué hay que hacer.');
      if (st.row && !st.day) return ($('#agt-err').textContent = 'Elegí el día, o dejala en la bandeja sin persona.');
      const r = D.rows.find(x => x.key === st.row);
      const base = { title: st.title.trim().slice(0, 300), work_kind: st.kind, task_type: AG_TYPES[st.kind].tt, priority: st.prio, slot: st.slot, skill: st.skill || null, weekly: st.weekly,
        description: st.notes.trim() || null, sites: st.site.trim() ? [{ site_id: null, site_name: st.site.trim().slice(0, 200) }] : (t ? t.sites : []) };
      const deadline = addDays(todayStr(), { critica: 1, alta: 3, normal: 5 }[st.prio]);
      let error;
      if (isNew){
        const ds = [st.day, ...extra].filter(Boolean);
        const rows = (ds.length ? ds : [null]).map(d => ({ ...base, org_id: me.org_id, created_by: me.id, due_date: d || deadline,
          ...(r && d ? agPatch({ staff_ids: [], contractor_id: null, status: 'sin_asignar' }, null, r.key, d) : { status: 'sin_asignar', staff_ids: [], contractor_id: null }) }));
        ({ error } = await sb.from('tasks').insert(rows));
        if (!error) toast(rows.length > 1 ? `Creada en ${rows.length} días` : r && st.day ? `Asignada a ${r.name}` : 'Tarea en la bandeja');
      } else {
        const curRow = pre.from || D.rowsOf(t)[0] || null;
        const asg = r && st.day ? (st.row !== curRow || st.day !== t.due_date || t.status === 'sin_asignar' ? agPatch(t, t.status === 'sin_asignar' ? null : curRow, r.key, st.day) : {}) : (t.status === 'sin_asignar' ? {} : { staff_ids: [], contractor_id: null, status: 'sin_asignar', due_date: deadline });
        ({ error } = await sb.from('tasks').update({ ...base, ...asg }).eq('id', t.id));
        if (!error) toast('Cambios guardados');
      }
      if (error){ $('#agt-err').textContent = /slot|work_kind|skill|weekly/i.test(error.message) ? 'Falta cargar 33_agenda.sql en Supabase.' : errText(error); return; }
      m.close(); route();
    });
    $('#agt-un') && ($('#agt-un').onclick = () => { m.close(); agUnassign(t.id); });
    $('#agt-del') && ($('#agt-del').onclick = async () => { if (!needOnline()) return; if (!confirm('¿Cancelar esta tarea? Queda en el historial como cancelada.')) return;
      const { error } = await sb.from('tasks').update({ status: 'cancelada' }).eq('id', t.id); if (error) return toast(errText(error)); m.close(); toast('Tarea cancelada'); route(); });
    $('#agt-wa') && ($('#agt-wa').onclick = () => { const r = D.rows.find(x => x.key === st.row); agWaOpen(r, agWaTask(t, r)); });
  };
  draw();
}

/* ---------- base y habilidades de una persona / contratista ---------- */
function agSkillsSheet(key){
  const D = AG.data, r = D.rows.find(x => x.key === key); if (!r) return;
  const sk = new Set(r.skills);
  const draw = () => {
    const m = modal(`<h2 style="margin-top:0">${r.ct ? '🏗 ' : ''}${esc(r.name)}</h2>
      <label>Base</label><input id="ags-b" maxlength="120" value="${esc(r.base)}" placeholder="Ej.: Santa Fe, Rosario, Avellaneda">
      <label>Habilidades</label><div class="ag-opts">${[...new Set([...AG_SKILLS, ...r.skills])].map(s => `<button type="button" data-s="${esc(s)}" class="${sk.has(s) ? 'on' : ''}">${esc(s)}</button>`).join('')}</div>
      <p class="muted sm">Sirven para ⭐ Sugerir y para avisar si se asigna una tarea que pide otra habilidad.</p>
      <div class="err" id="ags-err"></div>
      <div class="row" style="justify-content:flex-end;gap:6px;margin-top:8px"><button class="btn sec" data-close-modal>Cancelar</button><button class="btn" id="ags-ok">Guardar</button></div>`);
    m.el.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { r.base = $('#ags-b').value; const s = b.dataset.s; sk.has(s) ? sk.delete(s) : sk.add(s); draw(); });
    $('#ags-ok').onclick = async () => {
      if (!needOnline()) return;
      const { error } = await sb.rpc('agenda_set_skills', { p_kind: r.type === 'staff' ? 'staff' : 'contr', p_id: r.id, p_skills: [...sk], p_base: $('#ags-b').value.trim() || null });
      if (error) return ($('#ags-err').textContent = errText(error));
      m.close(); toast('Guardado'); try { await IDB.del('kv', CUR_UID + ':ag-staff'); await IDB.del('kv', CUR_UID + ':ag-contrs'); } catch {} route();
    };
  };
  draw();
}

/* ---------- copiar semana anterior ---------- */
async function agCopyPrev(){
  if (!needOnline()) return;
  const D = AG.data, from = agDays()[0];
  const fixed = D.prev.filter(t => t.weekly && t.status !== 'cancelada');
  const add = fixed.filter(t => !D.week.some(y => y.weekly && agNorm(y.title) === agNorm(t.title) && y.due_date === addDays(t.due_date, 7) && JSON.stringify(D.rowsOf(y)) === JSON.stringify(D.rowsOf(t))));
  if (!add.length) return toast(fixed.length ? 'Las tareas fijas de la semana anterior ya están copiadas.' : 'La semana anterior no tiene tareas marcadas como 🔁 fijas.');
  const rows = add.map(t => ({ org_id: me.org_id, created_by: me.id, title: t.title, task_type: t.task_type, work_kind: t.work_kind, priority: t.priority, slot: t.slot, skill: t.skill, weekly: true,
    description: t.description, sites: (t.sites || []).map(s => ({ site_id: s.site_id || null, site_name: s.site_name || s.name })), due_date: addDays(t.due_date, 7), staff_ids: t.staff_ids || [], contractor_id: t.contractor_id,
    status: (t.staff_ids || []).length || t.contractor_id ? 'asignada' : 'sin_asignar', contract: t.contract, project_id: t.project_id }));
  const { error } = await sb.from('tasks').insert(rows); if (error) return toast(errText(error));
  toast(`Se copiaron ${rows.length} tareas fijas a la semana del ${agFmt(from)}.`); route();
}

/* ---------- WhatsApp ---------- */
function agWaTask(t, r){
  const d = t.status === 'sin_asignar' ? null : t.due_date;
  return `Hola ${String(r?.name || '').split(' ')[0]} 👋\nTe asigné: ${AG_TYPES[agKind(t)].i} ${t.title}${agSite(t) ? '\n📍 ' + agSite(t) : ''}\n📅 ${d ? agDow(d) + ' ' + agFmt(d) : 'a definir'} · ${AG_SLOTS[t.slot || 'full']}${t.priority === 'critica' ? '\n🔴 Prioridad CRÍTICA' : t.priority === 'alta' ? '\n🟠 Prioridad alta' : ''}${t.description ? '\n📝 ' + t.description : ''}\nLa ves en InspectApp → Tareas.`;
}
function agWaWeek(r){
  const D = AG.data, days = agDays();
  const lines = days.map((d, i) => { const a = agAv(D, r.key, d), list = agAt(D, r.key, d); if (!list.length && !a) return null;
    return `*${AG_DOW[i]} ${agFmt(d)}*${a ? ' — ' + AG_AV[a][1] : ''}${list.map(t => `\n  • ${AG_SLOTS[t.slot || 'full']}: ${t.title}${agSite(t) ? ' (' + agSite(t) + ')' : ''}`).join('')}`; }).filter(Boolean);
  return `Hola ${String(r.name).split(' ')[0]} 👋 Tu semana del ${agFmt(days[0])} al ${agFmt(days[6])}:\n\n${lines.join('\n') || 'Sin tareas asignadas por ahora.'}\n\nLas tareas están en InspectApp → Tareas.`;
}
function agWaOpen(r, txt){
  const ph = r && r.phone ? waPhone(r.phone) : '';
  window.open(`https://wa.me/${ph && /^\d{6,16}$/.test(ph) ? ph : ''}?text=${encodeURIComponent(txt)}`, '_blank', 'noopener');
}
function agWaSheet(){
  const D = AG.data, days = agDays();
  const list = D.rows.filter(r => days.some(d => agAt(D, r.key, d).length));
  if (!list.length) return toast('No hay tareas asignadas esta semana.');
  let cur = list[0].key;
  const draw = () => { const r = D.rows.find(x => x.key === cur);
    const m = modal(`<h2 style="margin-top:0">💬 Avisar la semana</h2><p class="muted sm" style="margin-top:-6px">Un mensaje por persona con su semana. Tocá el nombre, revisá el texto y abrí WhatsApp.</p>
      <div class="ag-filters">${list.map(x => `<button type="button" class="ag-chip ${x.key === cur ? 'on' : ''}" data-wt="${esc(x.key)}">${x.ct ? '🏗 ' : ''}${esc(String(x.name).split(' ')[0])}${x.phone ? '' : ' ⚠'}</button>`).join('')}</div>
      <div class="ag-msg" id="agwa-m">${esc(agWaWeek(r))}</div>
      ${r.phone ? '' : '<p class="sm" style="color:#B45309">Esta persona no tiene teléfono cargado: WhatsApp se abre para elegir el contacto.</p>'}
      <div class="row" style="justify-content:flex-end;gap:6px;margin-top:10px"><button class="btn sec" data-close-modal>Cerrar</button><button class="btn sec" id="agwa-cp">📋 Copiar</button><button class="btn" id="agwa-go" style="background:#15803D">💬 Abrir WhatsApp</button></div>`, { wide: true });
    m.el.querySelectorAll('[data-wt]').forEach(b => b.onclick = () => { cur = b.dataset.wt; draw(); });
    $('#agwa-cp').onclick = () => { navigator.clipboard?.writeText($('#agwa-m').textContent).then(() => toast('Copiado'), () => toast('No se pudo copiar')); };
    $('#agwa-go').onclick = () => agWaOpen(r, agWaWeek(r));
  };
  draw();
}

/* ---------- Excel: bajar y subir ---------- */
// Hoja "Semana" = la planilla de siempre (personas × días). Hoja "Tareas" = una fila por tarea. Las dos se pueden volver a subir.
async function agXlExport(){
  try { await needLib('xlsx'); } catch (e){ return toast(errText(e)); }
  const D = AG.data, days = agDays(), PR = { critica: 'Crítica', alta: 'Alta', normal: 'Normal' };
  const cellTxt = (r, d) => [agAv(D, r.key, d) ? AG_AV[agAv(D, r.key, d)][1].toUpperCase() : null, ...agAt(D, r.key, d).map(t => `${AG_SLOTS[t.slot || 'full']}: ${t.title}${agSite(t) ? ' @ ' + agSite(t) : ''}`)].filter(Boolean).join('\n');
  const grid = [['Persona / cuadrilla', 'Tipo', 'Base', ...days.map((d, i) => `${AG_DOW[i]} ${agFmt(d)}`)], ...D.rows.map(r => [r.name, r.ct ? 'Contratista' : 'Propio', r.base, ...days.map(d => cellTxt(r, d))])];
  const rows = [['Fecha', 'Persona / cuadrilla', 'Tarea', 'Tipo de tarea', 'Sitio', 'Turno', 'Prioridad', 'Habilidad', 'Notas', 'Estado'],
    ...D.week.filter(t => days.includes(t.due_date)).sort((a, b) => a.due_date.localeCompare(b.due_date)).flatMap(t => D.rowsOf(t).map(k => [agFmt(t.due_date) + '/' + t.due_date.slice(0, 4), D.rows.find(r => r.key === k)?.name || '', t.title, AG_TYPES[agKind(t)].n, agSite(t), AG_SLOTS[t.slot || 'full'], PR[t.priority] || '', t.skill || '', t.description || '', TASK_ST[t.status] || t.status])),
    ...D.tray.map(t => ['', '', t.title, AG_TYPES[agKind(t)].n, agSite(t), AG_SLOTS[t.slot || 'full'], PR[t.priority] || '', t.skill || '', t.description || '', 'Por asignar'])];
  const wb = XLSX.utils.book_new();
  const w1 = XLSX.utils.aoa_to_sheet(grid); w1['!cols'] = [{ wch: 24 }, { wch: 12 }, { wch: 14 }, ...Array(7).fill({ wch: 36 })]; XLSX.utils.book_append_sheet(wb, w1, 'Semana');
  const w2 = XLSX.utils.aoa_to_sheet(rows); w2['!cols'] = [{ wch: 11 }, { wch: 24 }, { wch: 40 }, { wch: 16 }, { wch: 28 }, { wch: 12 }, { wch: 10 }, { wch: 15 }, { wch: 30 }, { wch: 12 }]; XLSX.utils.book_append_sheet(wb, w2, 'Tareas');
  XLSX.writeFile(wb, `Agenda_${days[0]}_al_${days[6]}.xlsx`);
  toast('Excel descargado');
}
async function agXlImport(file){
  if (!needOnline()) return;
  if (file.size > 5 * 1048576) return toast('El archivo es muy grande (máximo 5 MB).');
  try { await needLib('xlsx'); } catch (e){ return toast(errText(e)); }
  const D = AG.data;
  let wb; try { wb = XLSX.read(await file.arrayBuffer(), { cellDates: true }); } catch { return toast('No pude leer el archivo. Subí un .xlsx o .csv.'); }
  const findRow = n => { const q = agNorm(n); if (!q) return null; return D.rows.find(r => agNorm(r.name) === q) || D.rows.find(r => { const a = agNorm(r.name).split(' '); const b = q.split(' '); return a[0] === b[0] && a.slice(-1)[0] === b.slice(-1)[0]; }) || null; };
  const findKind = s => { const q = agNorm(s); const k = Object.keys(AG_TYPES).find(k => q && agNorm(AG_TYPES[k].n).startsWith(q.slice(0, 5)));
    return k || (/guardia|oficina|deposito/.test(q) ? 'ofi' : /traslado|retir|llevar/.test(q) ? 'log' : /otdr|medic|medir|atenuac|reflectom/.test(q) ? 'med' : /instal/.test(q) ? 'inst' : /prevent|mantenim/.test(q) ? 'prev' : /capacit|curso/.test(q) ? 'cap' : /relev/.test(q) ? 'rel' : /cerco|obra civil|pintur|albañ|infraestr/.test(q) ? 'infra' : 'corr'); };
  const findSlot = s => { const q = agNorm(s); return /^(manana|am\b|m\b)/.test(q) ? 'am' : /^(tarde|pm\b|t\b)/.test(q) ? 'pm' : 'full'; };
  const pDate = v => { if (v instanceof Date && !isNaN(v)) return dStr(v); const m = String(v || '').match(/(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?/); if (!m) return null;
    const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : dOf(AG.wk).getFullYear(); const d = new Date(y, Number(m[2]) - 1, Number(m[1])); return isNaN(d) ? null : dStr(d); };
  const out = [], probs = []; let fmt = null;
  for (const name of wb.SheetNames){
    const aoa = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: '' }).slice(0, 2000); if (!aoa.length) continue;
    const hi = aoa.findIndex(r => r.some(c => /tecnic|cuadrilla|recurso|persona|nombre/.test(agNorm(c)))); if (hi < 0) continue;
    const H = aoa[hi].map(agNorm);
    const iF = H.findIndex(h => /^fecha|^dia$/.test(h)), iT = H.findIndex(h => /tecnic|cuadrilla|recurso|persona|nombre/.test(h)), iTa = H.findIndex(h => /^tarea|^trabajo|^actividad/.test(h));
    if (iF >= 0 && iTa >= 0){
      fmt = 'una fila por tarea';
      aoa.slice(hi + 1).forEach((r, j) => { const title = String(r[iTa] || '').trim().slice(0, 300); if (!title) return;
        const g = n => { const i = H.findIndex(h => h.startsWith(n)); return i >= 0 ? String(r[i] ?? '').trim() : ''; };
        if (/cancel/.test(agNorm(g('estado')))) return;
        const row = findRow(r[iT]), d = pDate(r[iF]);
        if (r[iT] && !row) probs.push(`Fila ${hi + j + 2}: no encontré a "${String(r[iT]).slice(0, 60)}" (va a la bandeja).`);
        const pr = agNorm(g('prioridad'));
        out.push({ title, kind: findKind(g('tipo') || title), site: g('sitio').slice(0, 200) || g('lugar').slice(0, 200), slot: findSlot(g('turno')), prio: /crit/.test(pr) ? 'critica' : /alta/.test(pr) ? 'alta' : 'normal',
          skill: AG_SKILLS.find(s => agNorm(s) === agNorm(g('habilidad'))) || null, notes: g('nota').slice(0, 2000), row: row && d ? row.key : null, day: row && d ? d : null });
      });
    } else {
      const dayCols = H.map((h, i) => [i, h]).filter(([i, h]) => i !== iT && (/^(lun|mar|mie|jue|vie|sab|dom)/.test(h) || /\d{1,2}[\/\-]\d{1,2}/.test(h) || aoa[hi][i] instanceof Date));
      if (!dayCols.length) continue; fmt = 'grilla personas × días';
      const dk = dayCols.map(([i, h]) => { const d = pDate(aoa[hi][i]); if (d) return [i, d]; const di = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'].findIndex(p => h.startsWith(p)); return [i, di >= 0 ? addDays(AG.wk, di) : null]; });
      aoa.slice(hi + 1).forEach((r, j) => { const nm = String(r[iT] || '').trim(); if (!nm) return; const row = findRow(nm);
        if (!row){ probs.push(`Fila ${hi + j + 2}: no encontré a "${nm.slice(0, 60)}" en el personal.`); return; }
        dk.forEach(([i, d]) => { if (!d) return; String(r[i] || '').split(/\n|;/).map(z => z.trim()).filter(Boolean).forEach(txt => {
          if (/^(de )?(franco|licencia|vacaciones|guardia|feriado)$|^-$/.test(agNorm(txt))) return;
          const m = txt.match(/^(mañana|manana|tarde|todo el dia|todo el día|am|pm)\s*[:\-]\s*(.+)$/i); const body = m ? m[2] : txt; const [ti, si] = body.split(/\s@\s/);
          out.push({ title: ti.trim().slice(0, 300), kind: findKind(ti), site: (si || '').trim().slice(0, 200), slot: m ? findSlot(m[1]) : 'full', prio: 'normal', skill: null, notes: '', row: row.key, day: d }); }); });
      });
    }
    if (out.length) break;
  }
  if (!out.length) return toast('No encontré tareas: el archivo tiene que tener una columna Técnico (o Persona) y los días, o una fila por tarea.');
  if (out.length > 1000) return toast('Son más de 1000 tareas: dividí el archivo.');
  // lo que ya está cargado en esas fechas (puede ser otra semana distinta a la que se ve)
  const ds = out.map(x => x.day).filter(Boolean).sort();
  let all = [...D.week, ...D.tray];
  if (ds.length){ const r = await sb.from('tasks').select('id,title,due_date,staff_ids,contractor_id,status').gte('due_date', ds[0]).lte('due_date', ds[ds.length - 1]).neq('status', 'cancelada').limit(5000);
    if (r.error) return toast(errText(r.error)); all = [...all, ...(r.data || [])]; }
  const dup = x => all.some(y => agNorm(y.title) === agNorm(x.title) && (x.row ? y.due_date === x.day && D.rowsOf(y).includes(x.row) : y.status === 'sin_asignar'));
  const nuevas = out.filter(x => !dup(x)), rep = out.length - nuevas.length, sinA = nuevas.filter(x => !x.row).length;
  const tbl = `<div class="ag-xl"><table><thead><tr><th>Día</th><th>Persona</th><th>Tarea</th><th>Turno</th><th>Sitio</th></tr></thead><tbody>${nuevas.slice(0, 80).map(x => `<tr><td>${x.day ? agDow(x.day) + ' ' + agFmt(x.day) : '—'}</td><td>${esc(D.rows.find(r => r.key === x.row)?.name || 'Por asignar')}</td><td>${esc(x.title)}</td><td>${AG_SLOTS[x.slot]}</td><td>${esc(x.site)}</td></tr>`).join('')}</tbody></table></div>`;
  const m = modal(`<h2 style="margin-top:0">⬆ Subir planificación</h2><p class="muted sm" style="margin-top:-6px">${esc(file.name)} · formato "${fmt}".</p>
    <div class="ag-diff"><div><span class="muted sm">✨ Nuevas</span><b>${nuevas.length - sinA}</b></div><div><span class="muted sm">📥 A la bandeja</span><b>${sinA}</b></div><div><span class="muted sm">↔ Ya estaban</span><b>${rep}</b></div></div>
    ${probs.length ? `<div class="ag-warn">${probs.slice(0, 8).map(esc).join('<br>')}${probs.length > 8 ? `<br>y ${probs.length - 8} más` : ''}</div>` : ''}
    ${tbl}<p class="muted sm">No se duplica lo que ya está cargado. Las celdas Franco, Licencia o Guardia se ignoran: eso sale de Horas y guardias.</p>
    <div class="err" id="agx-err"></div>
    <div class="row" style="justify-content:flex-end;gap:6px;margin-top:8px"><button class="btn sec" data-close-modal>Cancelar</button><button class="btn" id="agx-ok" ${nuevas.length ? '' : 'disabled'}>Cargar ${nuevas.length} tarea${nuevas.length === 1 ? '' : 's'}</button></div>`, { wide: true });
  $('#agx-ok').onclick = async () => {
    if (!needOnline()) return; $('#agx-ok').disabled = true;
    const rows = nuevas.map(x => { const r = D.rows.find(z => z.key === x.row);
      return { org_id: me.org_id, created_by: me.id, title: x.title, work_kind: x.kind, task_type: AG_TYPES[x.kind].tt, priority: x.prio, slot: x.slot, skill: x.skill, description: x.notes || null,
        sites: x.site ? [{ site_id: null, site_name: x.site }] : [], due_date: x.day || addDays(todayStr(), { critica: 1, alta: 3, normal: 5 }[x.prio]),
        ...(r && x.day ? agPatch({ staff_ids: [], contractor_id: null, status: 'sin_asignar' }, null, r.key, x.day) : { status: 'sin_asignar', staff_ids: [], contractor_id: null }) }; });
    let ok = 0;
    for (let i = 0; i < rows.length; i += 100){ const { error } = await sb.from('tasks').insert(rows.slice(i, i + 100)); if (error){ $('#agx-err').textContent = errText(error) + (ok ? ` (se cargaron ${ok})` : ''); $('#agx-ok').disabled = false; return; } ok += Math.min(100, rows.length - i); }
    m.close(); AG.picked = null; AG.hint = null; const d1 = nuevas.find(x => x.day); if (d1) AG.wk = agMon(d1.day); toast(`Se cargaron ${ok} tareas.`); route();
  };
}
