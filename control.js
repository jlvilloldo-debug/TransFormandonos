/* =====================================================================
   InspectApp 5.4 · Control y desempeño (Etapa 1)
   #/control            tablero Kanban de tareas (oficina)
   #/control/personas   equipo con indicadores (Admin y PM)
   #/control/p/<id>     ficha del recurso (Admin y PM)
   #/control/yo         mi ficha (si Admin/PM lo habilitaron)
   Los números los calcula la base (perf_kpis), que también decide quién ve qué.
   Se carga recién cuando se abre (no pesa en el arranque).
   ===================================================================== */
const CT = { proj: '', who: '', q: '', month: null, info: null, pf: '' };   // pf: proyecto elegido en Personas / ficha / objetivos
const ctMonthKey = d => d.slice(0, 7);
const ctRange = ym => { const [y, m] = ym.split('-').map(Number); const a = `${ym}-01`; const e = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); return [a, e]; };
const ctMonthAdd = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); return d.toISOString().slice(0, 7); };
const CT_MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const ctMonthTxt = ym => { const [y, m] = ym.split('-').map(Number); return ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][m - 1] + ' ' + y; };
const ctPct = (a, b) => b ? Math.round(a * 100 / b) : null;
const ctSem = (v, g, a, inverse) => v == null ? 'na' : inverse ? (v <= g ? 'ok' : v <= a ? 'wa' : 'bad') : (v >= g ? 'ok' : v >= a ? 'wa' : 'bad');
const CT_SEM = { ok: ['#15803D', '#DCFCE7'], wa: ['#B45309', '#FEF3C7'], bad: ['#B91C1C', '#FEE2E2'], na: ['#64748B', '#F1F5F9'] };

function ctCss(){
  if (document.getElementById('ct-css')) return;
  const st = document.createElement('style'); st.id = 'ct-css';
  st.textContent = `.ct-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}.ct-tab{border:1px solid #CBD5E1;background:#fff;border-radius:999px;padding:8px 16px;font-weight:600;color:#0F2A4A;cursor:pointer;text-decoration:none}.ct-tab.on{background:#0F2A4A;color:#fff;border-color:#0F2A4A}
.ct-board{display:grid;grid-template-columns:repeat(5,minmax(185px,1fr));gap:10px;overflow-x:auto;padding-bottom:6px}
.ct-col{background:#EEF2F7;border-radius:14px;padding:8px;min-height:120px}.ct-col h3{font-size:14px;margin:4px 6px 8px;color:#334155}
.ct-card{display:block;width:100%;text-align:left;background:#fff;border:1px solid #DCE3EC;border-left:5px solid #94A3B8;border-radius:8px;padding:8px 10px;margin-bottom:8px;cursor:pointer;color:#0F2A4A;font:inherit}
.ct-card:hover{border-color:#94A3B8}.ct-card b{display:block;font-size:14px}.ct-card .s{font-size:12px;color:#64748B}.ct-card .t{font-size:12px;font-weight:700;margin-top:3px}
.ct-tag{display:inline-block;font-size:11px;font-weight:700;border-radius:6px;padding:2px 6px;margin:3px 4px 0 0}
.ct-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.ct-k{border-radius:12px;padding:12px 14px;border:1px solid #E2E8F0;background:#fff}.ct-k span{display:block;font-size:13px;color:#475569}.ct-k b{font-size:26px;display:block;margin-top:2px}.ct-k small{font-size:12px;color:#64748B}
.ct-bars{display:flex;align-items:flex-end;gap:10px;height:130px;margin-top:8px}.ct-bars div{flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;font-size:12px;color:#64748B;height:100%}.ct-bars i{display:block;width:100%;max-width:44px;border-radius:6px 6px 0 0;background:#85B7EB}.ct-bars em{font-style:normal;font-weight:700;color:#0F2A4A;font-size:12px}
.ct-tbl td,.ct-tbl th{white-space:nowrap}.ct-dot{display:inline-block;min-width:44px;text-align:center;border-radius:6px;padding:2px 6px;font-weight:700;font-size:13px}
.ct-note{border:1px solid #E2E8F0;border-radius:10px;padding:8px 12px;margin-top:8px}
.ct-switch{display:flex;gap:10px;align-items:center;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:10px 14px}
@media print{.top,.tabs,.ct-tabs,.ct-noprint,#bnav{display:none!important}.card{box-shadow:none;border:0}}`;
  document.head.appendChild(st);
}

async function ctInfo(){
  if (!CT.info){ const { data, error } = await sb.rpc('perf_self_get'); if (error) throw error; CT.info = data || {}; }
  return CT.info;
}
async function ctProjOpts(){ CT.plist = CT.plist || (await loadProjects().catch(() => [])).filter(p => p.active !== false); return CT.plist; }
const ctProjSel = (id, val, empty = 'Todos los proyectos') => `<select id="${id}" style="width:auto"><option value="">${empty}</option>${(CT.plist || []).map(p => `<option value="${esc(p.id)}" ${val === p.id ? 'selected' : ''}>${esc(p.short_name || p.name)}</option>`).join('')}</select>`;
const ctProjName = id => (CT.plist || []).find(p => p.id === id)?.short_name || (CT.plist || []).find(p => p.id === id)?.name || '';
const ctIsFin = () => me && (['admin', 'pm'].includes(me.role) || me.is_superadmin);

async function viewControl(v, sub, id){
  ctCss();
  if (!needOnline()){ v.innerHTML = '<div class="card">Control y desempeño necesita señal.</div>'; return; }
  const info = await ctInfo().catch(() => ({}));
  if (sub === 'yo'){
    if (!info.my_staff) return void (v.innerHTML = '<div class="card"><b>Tu usuario no está vinculado a un recurso.</b><p class="muted">Pedile a la oficina que te vincule en Recursos.</p></div>');
    if (!info.enabled && !info.fin) return void (v.innerHTML = '<div class="card"><b>Todavía no está habilitado.</b><p class="muted">La ficha propia la habilitan el Admin o el PM.</p></div>');
    return ctFicha(v, info.my_staff, { self: true });
  }
  if (!isManager()){ location.hash = info.enabled && info.my_staff ? '#/control/yo' : '#/home'; return; }
  const fin = !!info.fin;
  const tab = (k, h, t) => `<a class="ct-tab ${k ? 'on' : ''}" href="${h}">${t}</a>`;
  const tabs = `<div class="ct-tabs ct-noprint">${tab(!sub, '#/control', '🗂 Tablero')}${tab(sub === 'calidad', '#/control/calidad', '🎯 Calidad')}${tab(sub === 'mejora', '#/control/mejora', '🔧 Mejora')}${tab(sub === 'lecciones', '#/control/lecciones', '💡 Lecciones')}${tab(sub === 'raci', '#/control/raci', '🧩 RACI')}${tab(sub === 'ogsm', '#/control/ogsm', '🧭 Objetivos')}${fin ? tab(sub === 'personas' || sub === 'p', '#/control/personas', '👥 Personas') : ''}</div>`;
  if ((sub === 'personas' || sub === 'p') && !fin){ v.innerHTML = tabs + '<div class="card"><b>Las evaluaciones las ven el Admin y el PM.</b></div>'; return; }
  if (sub === 'p' && id) return ctFicha(v, id, { tabs });
  if (sub === 'personas') return ctPeople(v, tabs);
  if (sub === 'calidad') return ctQC(v, tabs);
  if (sub === 'mejora') return ctCases(v, tabs, id);
  if (sub === 'lecciones') return ctLessons(v, tabs);
  if (sub === 'raci') return ctRaci(v, tabs);
  if (sub === 'ogsm') return ctOgsm(v, tabs);
  return ctBoard(v, tabs);
}

/* ---------- tablero Kanban ---------- */
async function ctBoard(v, tabs){
  try { await hhLoadBase(); } catch {}
  const since = new Date(Date.now() - 14 * 86400000).toISOString();
  const cols = 'id,title,status,due_date,sites,contractor_id,staff_ids,ticket_id,project_id,priority,is_pending,completed_at,rejections';
  const [open, closed, contrs, projects, qcp] = await Promise.all([
    sb.from('tasks').select(cols).in('status', ['sin_asignar', 'asignada', 'vista', 'en_curso', 'rechazada', 'completada']).order('due_date').limit(1000).then(r => r.data || []),
    sb.from('tasks').select(cols).eq('status', 'aprobada').gte('completed_at', since).order('completed_at', { ascending: false }).limit(300).then(r => r.data || []),
    loadContractors().catch(() => []), loadProjects().catch(() => []),
    sb.from('qc_audits').select('task_id').eq('status', 'pendiente').limit(1000).then(r => new Set((r.data || []).map(x => x.task_id))).catch(() => new Set()),
  ]);
  const all = [...open, ...closed];
  const today = todayStr();
  const sname = id => (HHS.staff || []).find(s => s.id === id)?.name || 'Técnico';
  const who = t => { const n = (t.staff_ids || []).map(sname); if (t.contractor_id && !n.length){ const c = contrs.find(x => x.id === t.contractor_id); if (c) n.push(c.staff_id ? sname(c.staff_id) : c.name); } return n.join(', ') || 'Sin asignar'; };
  const hash = s => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
  const qc = t => qcp.has(t.id);                             // la base la sorteó para auditar
  const vis = all.filter(t => (!CT.proj || t.project_id === CT.proj)
    && (!CT.who || (CT.who === 'libre' ? !(t.staff_ids || []).length && !t.contractor_id : (t.staff_ids || []).includes(CT.who) || t.contractor_id === CT.who || (!(t.staff_ids || []).length && contrs.find(x => x.id === t.contractor_id)?.staff_id === CT.who)))
    && (!CT.q || norm(t.title + ' ' + (t.sites || []).map(s => s.site_name).join(' ')).includes(norm(CT.q))));
  const colOf = t => t.status === 'sin_asignar' ? 0 : ['asignada', 'vista', 'rechazada'].includes(t.status) ? 1 : t.status === 'en_curso' ? 2 : t.status === 'completada' ? 3 : 4;
  const COLS = ['Sin asignar', 'Asignada', 'En curso', 'Para revisar', 'Aprobada (14 días)'];
  const due = t => {
    if (t.status === 'aprobada') return t.completed_at && t.completed_at.slice(0, 10) > t.due_date ? ['#B45309', 'cerrada fuera de término'] : ['#15803D', 'cerrada a tiempo'];
    if (t.status === 'completada') return ['#2563EB', 'esperando revisión'];
    const d = daysLeft(dueDate(t.due_date));
    return d < 0 ? ['#B91C1C', `vencida hace ${-d} día${d === -1 ? '' : 's'}`] : d <= 2 ? ['#D97706', d === 0 ? 'vence hoy' : d === 1 ? 'vence mañana' : 'vence en 2 días'] : ['#16A34A', 'vence ' + fmtDate(t.due_date)];
  };
  const card = t => { const [c, txt] = due(t); const s = (t.sites || []);
    return `<button class="ct-card" data-t="${esc(t.id)}" style="border-left-color:${c}"><b>${esc(t.title)}</b>
      <div class="s">${esc(s[0]?.site_name || '')}${s.length > 1 ? ` y ${s.length - 1} más` : ''}</div><div class="s">${esc(who(t))}</div>
      <div class="t" style="color:${c}">${esc(txt)}</div>
      ${t.ticket_id ? '<span class="ct-tag" style="background:#FEE2E2;color:#991B1B">⚠ Ticket</span>' : ''}${t.status === 'rechazada' ? '<span class="ct-tag" style="background:#FEE2E2;color:#991B1B">Rechazada: rehacer</span>' : ''}${t.is_pending ? '<span class="ct-tag" style="background:#FEF3C7;color:#92400E">Pendiente</span>' : ''}${qc(t) ? '<span class="ct-tag" style="background:#DBEAFE;color:#1E40AF">🎯 Le toca QC en campo</span>' : ''}${(t.rejections || 0) > 0 && t.status !== 'rechazada' ? `<span class="ct-tag" style="background:#F1F5F9;color:#475569">${t.rejections} rechazo(s)</span>` : ''}</button>`; };
  const cnt = { venc: vis.filter(t => colOf(t) < 3 && t.due_date < today).length, hoy: vis.filter(t => colOf(t) < 3 && t.due_date === today).length, rev: vis.filter(t => t.status === 'completada').length };
  const people = [...new Set(all.flatMap(t => (t.staff_ids || []).length ? t.staff_ids : t.contractor_id ? [t.contractor_id] : []))];
  const pn = id => (HHS.staff || []).find(s => s.id === id)?.name || contrs.find(c => c.id === id)?.name || '—';
  v.innerHTML = `${tabs}<div class="card"><div class="row between" style="gap:10px;flex-wrap:wrap"><div><h1 style="margin:0">🗂 Tablero de tareas</h1><div class="muted sm">Todas las tareas por estado. El borde avisa el vencimiento: verde con tiempo, naranja vence en 48 h, rojo vencida.</div></div>
      <div class="row" style="gap:6px;flex-wrap:wrap"><input id="ct-q" placeholder="Buscar tarea o sitio" value="${esc(CT.q)}" style="width:190px">
        <select id="ct-p" style="width:auto"><option value="">Todos los proyectos</option>${projects.filter(p => p.active !== false).map(p => `<option value="${esc(p.id)}" ${CT.proj === p.id ? 'selected' : ''}>${esc(p.short_name || p.name)}</option>`).join('')}</select>
        <select id="ct-w" style="width:auto"><option value="">Todas las personas</option><option value="libre" ${CT.who === 'libre' ? 'selected' : ''}>Sin asignar</option>${people.map(id => `<option value="${esc(id)}" ${CT.who === id ? 'selected' : ''}>${esc(pn(id))}</option>`).join('')}</select></div></div>
    <div class="stats" style="margin-top:12px"><div class="stat"><span>Vencidas</span><b style="color:${cnt.venc ? '#B91C1C' : 'inherit'}">${cnt.venc}</b></div><div class="stat"><span>Vencen hoy</span><b style="color:${cnt.hoy ? '#D97706' : 'inherit'}">${cnt.hoy}</b></div><div class="stat"><span>Para revisar</span><b>${cnt.rev}</b></div><div class="stat"><span>Abiertas</span><b>${vis.filter(t => colOf(t) < 3).length}</b></div></div></div>
    <div class="ct-board">${COLS.map((c, i) => { const L = vis.filter(t => colOf(t) === i); return `<div class="ct-col"><h3>${c} · ${L.length}</h3>${L.slice(0, 60).map(card).join('') || '<div class="sm muted" style="padding:6px">—</div>'}${L.length > 60 ? `<div class="sm muted" style="padding:6px">y ${L.length - 60} más: usá los filtros</div>` : ''}</div>`; }).join('')}</div>`;
  v.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { location.hash = '#/tasks/' + b.dataset.t; });
  $('#ct-p').onchange = e => { CT.proj = e.target.value; ctBoard(v, tabs); };
  $('#ct-w').onchange = e => { CT.who = e.target.value; ctBoard(v, tabs); };
  let tm; $('#ct-q').oninput = e => { clearTimeout(tm); tm = setTimeout(() => { CT.q = e.target.value; ctBoard(v, tabs).then(() => { const i = $('#ct-q'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }); }, 350); };
}

/* ---------- equipo ---------- */
const ctOnTime = r => ctPct((r.tasks_ontime || 0) + (r.tk_in_sla || 0), (r.tasks_done || 0) + (r.tk_done || 0));
const ctGps = r => ctPct(r.insp_gps || 0, r.insp_done || 0);
async function ctPeople(v, tabs){
  CT.month = CT.month || ctMonthKey(todayStr());
  const [a, b] = ctRange(CT.month);
  await ctProjOpts();
  const [{ data, error }, info] = await Promise.all([sb.rpc('perf_kpis', { p_from: a, p_to: b, p_staff: null, p_project: CT.pf || null }), ctInfo()]);
  const rowsAll = (data || []);
  if (error) throw error;
  const rows = CT.pf ? rowsAll.filter(r => (r.tasks_done || 0) + (r.tk_done || 0) + (r.tasks_overdue || 0) + (r.insp_done || 0) > 0) : rowsAll;
  const cell = (val, sem, suf = '') => `<span class="ct-dot" style="background:${CT_SEM[sem][1]};color:${CT_SEM[sem][0]}">${val == null ? '—' : val + suf}</span>`;
  v.innerHTML = `${tabs}<div class="card"><div class="row between" style="gap:10px;flex-wrap:wrap"><div><h1 style="margin:0">👥 Personas · ${esc(ctMonthTxt(CT.month))}${CT.pf ? ' · ' + esc(ctProjName(CT.pf)) : ''}</h1><div class="muted sm">Indicadores que salen solos de lo que registra la app. Tocá una persona para ver su ficha.</div></div>
      <div class="row" style="gap:6px">${ctProjSel('ct-pf', CT.pf)}<button class="btn sec" id="ct-prev">‹</button><button class="btn sec" id="ct-next" ${CT.month >= ctMonthKey(todayStr()) ? 'disabled' : ''}>›</button></div></div>
    ${canWrite() ? `<label class="ct-switch" style="margin-top:12px"><input type="checkbox" id="ct-self" ${info.enabled ? 'checked' : ''} style="width:auto;margin:0"><div><b>Cada recurso ve su propia ficha</b><div class="sm muted">Si lo activás, cada técnico ve SOLO la suya en Más → Mi ficha (nunca la de otros ni las comparaciones con el equipo).</div></div></label>` : ''}
    <div class="tblwrap" style="margin-top:12px"><table class="tbl ct-tbl"><thead><tr><th>Persona</th><th class="num">Tareas</th><th class="num">Tickets</th><th class="num">A tiempo</th><th class="num">Volvieron</th><th class="num">Rechazos</th><th class="num">Planillas en el sitio</th><th class="num">Vencidas</th><th class="num">Horas</th></tr></thead><tbody>
    ${rows.map(r => { const ot = ctOnTime(r), gp = ctGps(r);
      return `<tr class="click" data-p="${esc(r.staff_id)}"><td><b>${esc(r.name)}</b></td><td class="num">${r.tasks_done}</td><td class="num">${r.tk_done}</td>
        <td class="num">${cell(ot, ctSem(ot, 85, 70), '%')}</td><td class="num">${cell(r.tk_repeat, ctSem(r.tk_repeat, 0, 1, true))}</td><td class="num">${cell(r.rejections, ctSem(r.rejections, 0, 2, true))}</td>
        <td class="num">${cell(gp, ctSem(gp, 90, 70), '%')}</td><td class="num">${cell(r.tasks_overdue, ctSem(r.tasks_overdue, 0, 2, true))}</td><td class="num">${String(r.hours).replace('.', ',')}</td></tr>`; }).join('') || `<tr><td colspan="9" class="muted">${CT.pf ? 'Nadie trabajó en este proyecto en el mes.' : 'No hay recursos cargados.'}</td></tr>`}
    </tbody></table></div>
    <p class="muted sm">A tiempo = tareas cerradas dentro de su fecha + tickets normalizados dentro del SLA · Volvieron = otro ticket en el mismo sitio dentro de los 30 días · Planillas en el sitio = cargadas cerca del sitio (GPS) · Vencidas = asignadas y sin cerrar.</p></div>`;
  v.querySelectorAll('[data-p]').forEach(r => r.onclick = () => { location.hash = '#/control/p/' + r.dataset.p; });
  $('#ct-pf').onchange = e => { CT.pf = e.target.value; ctPeople(v, tabs); };
  $('#ct-prev').onclick = () => { CT.month = ctMonthAdd(CT.month, -1); ctPeople(v, tabs); };
  $('#ct-next').onclick = () => { CT.month = ctMonthAdd(CT.month, 1); ctPeople(v, tabs); };
  $('#ct-self')?.addEventListener('change', async e => { const on = e.target.checked;
    if (on && !confirm('Cada recurso va a poder ver su propia ficha (indicadores y notas de seguimiento). ¿Activar?')){ e.target.checked = false; return; }
    const { error: er } = await sb.rpc('perf_self_set', { p_on: on }); if (er){ e.target.checked = !on; return toast(errText(er)); }
    CT.info = null; toast(on ? 'Cada recurso ya puede ver su ficha' : 'Fichas propias desactivadas'); });
}

/* ---------- ficha del recurso ---------- */
async function ctFicha(v, staffId, opt = {}){
  const self = !!opt.self, preview = !!opt.preview;
  CT.month = CT.month || ctMonthKey(todayStr());
  const months = [...Array(6)].map((_, i) => ctMonthAdd(CT.month, i - 5));
  await ctProjOpts();
  const PF = CT.pf || null;
  const q = ym => { const [a, b] = ctRange(ym); return sb.rpc('perf_kpis', { p_from: a, p_to: b, p_staff: staffId, p_project: PF }); };
  const [a, b] = ctRange(CT.month);
  const [cur, team, hist, notes, shirt, qcr, prm, raci, plans] = await Promise.all([
    q(CT.month),
    self || preview ? Promise.resolve({ data: [] }) : sb.rpc('perf_kpis', { p_from: a, p_to: b, p_staff: null, p_project: PF }),
    Promise.all(months.map(q)),
    sb.from('perf_notes').select('id,kind,body,by_name,created_at').eq('staff_id', staffId).order('created_at', { ascending: false }).limit(50).then(r => r.data || []).catch(() => []),
    self ? sb.rpc('my_shirt').then(r => r.data?.shirt).catch(() => null) : sb.from('hh_staff').select('shirt').eq('id', staffId).maybeSingle().then(r => r.data?.shirt).catch(() => null),
    needLib('donde').catch(() => {}),
  ]).then(async x => { [x[5], x[6], x[7], x[8]] = await Promise.all([
      sb.rpc('perf_qc', { p_from: a, p_to: b, p_staff: staffId, p_project: PF }).then(r => (r.data || [])[0] || null).catch(() => null),
      sb.rpc('perf_promises', { p_from: a, p_to: b, p_staff: staffId, p_project: PF }).then(r => (r.data || [])[0] || null).catch(() => null),
      sb.from('raci').select('activity,cells,project_id').limit(1000).then(r => (r.data || []).filter(z => z.cells && z.cells[staffId] && (!PF || z.project_id === PF))).catch(() => []),
      sb.from('pdca').select('*').eq('staff_id', staffId).order('created_at', { ascending: false }).limit(20).then(r => r.data || []).catch(() => []),
    ]); return x; });
  if (cur.error) throw cur.error;
  const r = (cur.data || [])[0]; if (!r) throw new Error('No se encontró el recurso');
  const T = (team.data || []).filter(x => x.staff_id !== staffId);
  const avg = f => { const L = T.filter(x => (x.tasks_done || 0) + (x.tk_done || 0) > 0).map(f).filter(x => x != null); return L.length ? Math.round(L.reduce((s, x) => s + x, 0) / L.length) : null; };   // solo los que trabajaron en el período
  const cmp = (txt, f) => self || preview || !T.length ? txt : `${txt} · equipo ${avg(f) ?? '—'}`;
  const ot = ctOnTime(r), gp = ctGps(r), work = (r.tasks_done || 0) + (r.tk_done || 0);
  const perTask = work ? Math.round(r.hours * 10 / work) / 10 : null;
  const k = (label, val, sem, small) => `<div class="ct-k" style="border-color:${CT_SEM[sem][1]}"><span>${label}</span><b style="color:${CT_SEM[sem][0]}">${val}</b><small>${small || ''}</small></div>`;
  const H = hist.map((x, i) => ({ ym: months[i], v: ctOnTime((x.data || [])[0] || {}), n: (((x.data || [])[0] || {}).tasks_done || 0) + (((x.data || [])[0] || {}).tk_done || 0) }));
  const fin = ctIsFin() && !self && !preview;
  const NK = { nota: ['📝', 'Nota'], reconocimiento: ['⭐', 'Reconocimiento'], acuerdo: ['🤝', 'Acuerdo'] };
  v.innerHTML = `${opt.tabs || ''}<div class="card">
    ${preview ? '<div class="banner trial ct-noprint" style="margin:0 0 12px"><span class="dot"></span><div><b>Vista previa: así ve su ficha el recurso</b> (sin comparaciones con el equipo). <a href="#" id="ct-endprev">Volver a la ficha completa</a></div></div>' : ''}
    <div class="row between" style="gap:12px;flex-wrap:wrap"><div class="row" style="gap:12px;flex-wrap:nowrap">${typeof shirtFig === 'function' ? shirtFig(shirt, 'parado', 64) : ''}
      <div><h1 style="margin:0">${self ? 'Mi ficha' : esc(r.name)}</h1><div class="muted sm">${esc(ctMonthTxt(CT.month))}${self ? ' · ' + esc(r.name) : ''}${PF ? ' · solo ' + esc(ctProjName(PF)) : ' · todos los proyectos'}</div></div></div>
      <div class="row ct-noprint" style="gap:6px;flex-wrap:wrap">${ctProjSel('ct-fpf', CT.pf)}<button class="btn sec" id="ct-prev">‹</button><button class="btn sec" id="ct-next" ${CT.month >= ctMonthKey(todayStr()) ? 'disabled' : ''}>›</button>
        ${fin ? '<button class="btn sec" id="ct-prevw">👁 Ver como lo ve él</button>' : ''}<button class="btn sec" id="ct-print">🖨 Imprimir / PDF</button>${!self ? '<a class="btn sec" href="#/control/personas">← Personas</a>' : ''}</div></div>
    <div class="ct-kpis" style="margin-top:14px">
      ${k('Trabajos cerrados', work, work ? 'ok' : 'na', cmp(`${r.tasks_done} tareas · ${r.tk_done} tickets`, x => (x.tasks_done || 0) + (x.tk_done || 0)))}
      ${k('A tiempo', ot == null ? '—' : ot + '%', ctSem(ot, 85, 70), cmp('meta 85%', ctOnTime))}
      ${k('Tickets que volvieron', r.tk_repeat, ctSem(r.tk_repeat, 0, 1, true), 'mismo sitio, dentro de 30 días')}
      ${k('Rechazos de la revisión', r.rejections, ctSem(r.rejections, 0, 2, true), r.quality ? `calificación promedio ${String(r.quality).replace('.', ',')} ★` : 'sin calificaciones')}
      ${k('Planillas cargadas en el sitio', gp == null ? '—' : gp + '%', ctSem(gp, 90, 70), `${r.insp_gps} de ${r.insp_done} con GPS cerca del sitio`)}
      ${k('Vencidas sin cerrar', r.tasks_overdue, ctSem(r.tasks_overdue, 0, 2, true), 'asignadas hoy')}
      ${prm ? k('Fechas que prometió', prm.promised ? `${prm.kept} de ${prm.promised}` : '—', !prm.promised ? 'na' : ctSem(ctPct(prm.kept, prm.promised), 85, 70), prm.promised ? `cumplidas${prm.changes ? ' · cambió la fecha ' + prm.changes + (prm.changes === 1 ? ' vez' : ' veces') : ''}` : 'no prometió fechas que vencieran este mes') : ''}
      ${qcr ? k('Auditorías de calidad', qcr.qc_done ? `${qcr.qc_ok} de ${qcr.qc_done} OK` : '—', !qcr.qc_done ? 'na' : qcr.qc_bad ? 'bad' : qcr.qc_obs ? 'wa' : 'ok', `${qcr.qc_obs} con observaciones · ${qcr.qc_bad} rechazadas`) : ''}
      ${qcr ? k('Casos de mejora abiertos', qcr.cases_open, ctSem(qcr.cases_open, 0, 1, true), `${qcr.cases_total} abiertos este mes (5 porqués)`) : ''}
      ${k('Horas cargadas', String(r.hours).replace('.', ','), 'na', `${String(r.extra_hours).replace('.', ',')} extra y viaje${perTask != null ? ' · ' + String(perTask).replace('.', ',') + ' h por trabajo' : ''}`)}
    </div>
    <div class="grid2" style="margin-top:16px">
      <div><h3 style="margin:0">A tiempo · últimos 6 meses</h3><div class="ct-bars">${H.map(x => `<div><em>${x.v == null ? '—' : x.v + '%'}</em><i style="height:${x.v == null ? 2 : Math.max(4, x.v)}%;background:${x.ym === CT.month ? '#185FA5' : '#85B7EB'}"></i>${CT_MES[Number(x.ym.slice(5)) - 1]}<span style="font-size:11px">${x.n} trab.</span></div>`).join('')}</div></div>
      <div><h3 style="margin:0">Cómo leer la ficha</h3><ul class="sm muted" style="margin:8px 0 0;padding-left:18px;line-height:1.6">
        <li><b>Planillas en el sitio</b>: lo que declara contra lo que se comprueba (GPS al cargar la planilla).</li>
        <li><b>Volvieron</b>: el problema no quedó resuelto (outcome), aunque la tarea se haya cerrado (output).</li>
        <li><b>Rechazos</b>: el supervisor la devolvió para rehacer.</li>
        <li>Son hechos registrados por la app, no opiniones. La evaluación la hace la persona responsable con esta información a la vista.</li></ul></div></div>
    ${raci.length ? `<h2 style="margin:18px 0 4px">🧩 Responsabilidades (RACI)</h2><div class="sm">${['A', 'R', 'C', 'I'].map(L => { const n = raci.filter(z => z.cells[staffId] === L); return n.length ? `<div style="margin-top:4px"><b>${CT_RACI[L][0]}</b> · ${n.map(z => esc(z.activity) + (PF ? '' : ` <span class="muted">(${esc(ctProjName(z.project_id))})</span>`)).join(' · ')}</div>` : ''; }).join('')}</div>` : ''}
    <div class="row between" style="margin:18px 0 4px"><h2 style="margin:0">🔄 Planes de mejora (PDCA)</h2>${fin && canWrite() ? '<button class="btn sec small ct-noprint" id="pd-new">+ Plan de mejora</button>' : ''}</div>
    ${plans.map(pl => ctPdcaCard(pl, ctMetricNow(pl.metric, { r, qcr, prm }), fin && canWrite())).join('') || '<p class="muted sm">No hay planes de mejora.</p>'}
    <h2 style="margin:18px 0 4px">Seguimiento</h2>
    ${fin && canWrite() ? `<div class="ct-noprint" style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-start"><select id="ct-nk" style="width:auto">${Object.entries(NK).map(([kk, [ic, t]]) => `<option value="${kk}">${ic} ${t}</option>`).join('')}</select>
      <textarea id="ct-nb" maxlength="2000" placeholder="Qué se habló, qué se acordó o qué se reconoce (lo ve el recurso si la ficha propia está activa)" style="flex:1;min-width:240px;min-height:60px"></textarea><button class="btn" id="ct-nadd">Guardar</button></div>` : ''}
    ${notes.map(n => `<div class="ct-note"><div class="row between"><b>${(NK[n.kind] || NK.nota)[0]} ${esc((NK[n.kind] || NK.nota)[1])}</b><span class="sm muted">${esc(fmtDT(n.created_at))} · ${esc(n.by_name || '')}${fin && canWrite() ? ` <button class="iconbtn ct-noprint" data-nd="${esc(n.id)}" title="Borrar" aria-label="Borrar">🗑</button>` : ''}</span></div><div style="white-space:pre-wrap;margin-top:4px">${esc(n.body)}</div></div>`).join('') || '<p class="muted sm">Todavía no hay notas.</p>'}
  </div>`;
  const again = () => ctFicha(v, staffId, opt);
  const cur3 = { r, qcr, prm };
  $('#pd-new')?.addEventListener('click', () => ctPdcaModal({ staff_id: staffId }, cur3, again));
  v.querySelectorAll('[data-pd]').forEach(bt => bt.onclick = () => ctPdcaModal(plans.find(x => x.id === bt.dataset.pd), cur3, again));
  $('#ct-fpf').onchange = e => { CT.pf = e.target.value; again(); };
  $('#ct-prev').onclick = () => { CT.month = ctMonthAdd(CT.month, -1); again(); };
  $('#ct-next').onclick = () => { CT.month = ctMonthAdd(CT.month, 1); again(); };
  $('#ct-print').onclick = () => window.print();
  $('#ct-prevw')?.addEventListener('click', () => ctFicha(v, staffId, { ...opt, preview: true }));
  $('#ct-endprev')?.addEventListener('click', e => { e.preventDefault(); ctFicha(v, staffId, { ...opt, preview: false }); });
  $('#ct-nadd')?.addEventListener('click', async () => { const body = $('#ct-nb').value.trim(); if (!body) return toast('Escribí la nota');
    const { error } = await sb.from('perf_notes').insert({ org_id: me.org_id, staff_id: staffId, kind: $('#ct-nk').value, body }); if (error) return toast(errText(error)); toast('Nota guardada'); again(); });
  v.querySelectorAll('[data-nd]').forEach(bt => bt.onclick = async () => { if (!confirm('¿Borrar la nota?')) return;
    const { error } = await sb.from('perf_notes').delete().eq('id', bt.dataset.nd); if (error) return toast(errText(error)); again(); });
}

/* =====================================================================
   ETAPA 2 · Calidad (auditorías), Mejora (5 porqués + CAPA) y Lecciones aprendidas
   ===================================================================== */
const QC_DEF = ['Trabajo terminado según lo pedido', 'Planilla completa y coincide con lo que se ve en el sitio', 'Fotos de cierre correctas', 'Rotulado y etiquetas', 'Sitio limpio y ordenado', 'Seguridad: tapas, cerramiento y candados'];
const QC_ST = { pendiente: ['Pendiente', '#1E40AF', '#DBEAFE'], ok: ['OK', '#15803D', '#DCFCE7'], observada: ['Con observaciones', '#B45309', '#FEF3C7'], rechazada: ['Rechazada', '#B91C1C', '#FEE2E2'], anulada: ['Anulada', '#64748B', '#F1F5F9'] };
const CS_ORIG = { manual: '✍ Manual', incidente: '⚠ Incidente', qc: '🎯 Auditoría', rechazo: '↩ Rechazo en la revisión', ticket_repetido: '🔁 Ticket que volvió' };
const CS_ST = { abierto: ['Analizar', '#B91C1C', '#FEE2E2'], en_accion: ['En acción', '#B45309', '#FEF3C7'], verificar: ['Verificar eficacia', '#1E40AF', '#DBEAFE'], cerrado: ['Cerrado', '#15803D', '#DCFCE7'], anulado: ['Anulado', '#64748B', '#F1F5F9'] };
const CS_CAUSE = { proceso: 'Proceso / procedimiento', material: 'Material / repuesto', herramienta: 'Herramienta / equipo', persona: 'Persona (capacitación, atención)', cliente: 'Cliente / terceros', clima: 'Clima / acceso', otro: 'Otro' };
const CS_P = ['', 'Muy rara', 'Rara', 'Posible', 'Probable', 'Casi segura'];
const CS_I = ['', 'Mínimo', 'Menor', 'Moderado', 'Mayor (multa)', 'Grave (seguridad / corte total)'];
const ctPill = ([t, c, bg]) => `<span class="ct-tag" style="background:${bg};color:${c}">${esc(t)}</span>`;
const ctRisk = (p, i) => !p || !i ? null : p * i;
const ctRiskColor = r => r == null ? '#E2E8F0' : r >= 15 ? '#E24B4A' : r >= 8 ? '#F09595' : r >= 4 ? '#FAC775' : '#C0DD97';
const ctStaffName = id => (HHS.staff || []).find(s => s.id === id)?.name || 'Técnico';

/* ---------- 🎯 Calidad ---------- */
async function ctQC(v, tabs){
  try { await hhLoadBase(); } catch {}
  const since = new Date(Date.now() - 60 * 86400000).toISOString();
  const [cfg, pend, done] = await Promise.all([
    sb.rpc('qc_cfg').then(r => r.data || { rate: 10 }),
    sb.from('qc_audits').select('*').eq('status', 'pendiente').order('created_at').limit(300).then(r => r.data || []),
    sb.from('qc_audits').select('*').neq('status', 'pendiente').gte('created_at', since).order('done_at', { ascending: false }).limit(300).then(r => r.data || []),
  ]);
  const ids = [...new Set([...pend, ...done].map(a => a.task_id))];
  const tasks = ids.length ? await sb.from('tasks').select('id,title,sites,completed_at,staff_ids,contractor_id,task_type').in('id', ids).then(r => r.data || []) : [];
  const contrs = await loadContractors().catch(() => []);
  const tk = id => tasks.find(t => t.id === id) || { title: 'Tarea', sites: [] };
  const who = a => [...(a.staff_ids || []).map(ctStaffName), ...(a.contractor_id && !(a.staff_ids || []).length ? [contrs.find(c => c.id === a.contractor_id)?.name || 'Contratista'] : [])].join(', ') || '—';
  const fin = ctIsFin();
  const row = a => { const t = tk(a.task_id); return `<div class="ct-note" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><div style="flex:1;min-width:220px"><b>${esc(t.title)}</b> ${ctPill(QC_ST[a.status])} ${a.picked === 'azar' ? '<span class="ct-tag" style="background:#F1F5F9;color:#475569">al azar</span>' : ''}
      <div class="sm muted">${esc((t.sites || []).map(s => s.site_name).join(', '))} · ${esc(who(a))}${a.done_at ? ' · auditó ' + esc(a.auditor_name || '') + ' el ' + esc(fmtDate(a.done_at)) : ' · cerrada ' + esc(t.completed_at ? fmtDate(t.completed_at) : '')}</div></div>
      <a class="btn sec small" href="#/tasks/${esc(a.task_id)}">Ver tarea</a>${canWrite() ? `<button class="btn small ${a.status === 'pendiente' ? '' : 'sec'}" data-qa="${esc(a.id)}">${a.status === 'pendiente' ? 'Auditar' : 'Ver'}</button>` : ''}</div>`; };
  const tot = done.filter(a => a.status !== 'anulada'), okp = ctPct(tot.filter(a => a.status === 'ok').length, tot.length);
  v.innerHTML = `${tabs}<div class="card"><div class="row between" style="gap:10px;flex-wrap:wrap"><div><h1 style="margin:0">🎯 Calidad</h1><div class="muted sm">Cuando una tarea queda completada, la base sortea si se audita en campo (${cfg.rate}% de las tareas). El técnico no sabe cuáles van a tocar.</div></div>
      <div class="row" style="gap:6px">${canWrite() ? '<button class="btn sec" id="qc-man">+ Auditar otra tarea</button>' : ''}${fin && canWrite() ? '<button class="btn sec" id="qc-cfg">⚙ Porcentaje y checklist</button>' : ''}</div></div>
    <div class="stats" style="margin-top:12px"><div class="stat"><span>Pendientes</span><b>${pend.length}</b></div><div class="stat"><span>Auditadas (60 días)</span><b>${tot.length}</b></div><div class="stat"><span>OK</span><b style="color:${okp == null ? 'inherit' : CT_SEM[ctSem(okp, 90, 75)][0]}">${okp == null ? '—' : okp + '%'}</b></div><div class="stat"><span>Rechazadas</span><b style="color:${tot.some(a => a.status === 'rechazada') ? '#B91C1C' : 'inherit'}">${tot.filter(a => a.status === 'rechazada').length}</b></div></div></div>
    <div class="card"><h2 style="margin:0 0 4px">Para auditar · ${pend.length}</h2>${pend.map(row).join('') || '<p class="muted sm">No hay auditorías pendientes.</p>'}</div>
    <div class="card"><h2 style="margin:0 0 4px">Hechas · últimos 60 días</h2>${done.map(row).join('') || '<p class="muted sm">Todavía no hay auditorías hechas.</p>'}</div>`;
  const again = () => ctQC(v, tabs);
  v.querySelectorAll('[data-qa]').forEach(b => b.onclick = () => { const a = [...pend, ...done].find(x => x.id === b.dataset.qa); ctQCModal(a, tk(a.task_id), who(a), cfg, again); });
  $('#qc-cfg')?.addEventListener('click', () => ctQCCfg(cfg, again));
  $('#qc-man')?.addEventListener('click', () => ctQCPick(again));
}
function ctQCModal(a, t, who, cfg, after){
  const items = a.checklist?.length ? a.checklist : (cfg.items?.length ? cfg.items : QC_DEF).map(l => ({ label: l, r: null, note: null }));
  const ro = a.status !== 'pendiente' && a.status !== 'observada';
  const m = modal(`<h2>🎯 Auditoría · ${esc(t.title)}</h2><p class="muted sm" style="margin-top:-6px">${esc((t.sites || []).map(s => s.site_name).join(', '))} · hizo: ${esc(who)}</p>
    <div class="tblwrap"><table class="tbl"><thead><tr><th>Control</th><th>OK</th><th>Falla</th><th>N/A</th><th>Observación</th></tr></thead><tbody>
    ${items.map((it, i) => `<tr><td>${esc(it.label || '')}</td>${['ok', 'falla', 'na'].map(r => `<td><input type="radio" name="qa${i}" value="${r}" ${it.r === r ? 'checked' : ''} ${ro ? 'disabled' : ''} style="width:auto" aria-label="${r}"></td>`).join('')}
      <td><input class="qa-n" data-i="${i}" maxlength="300" value="${esc(it.note || '')}" ${ro ? 'disabled' : ''} placeholder="Qué se vio"></td></tr>`).join('')}</tbody></table></div>
    <label>Comentario general</label><textarea id="qa-notes" maxlength="2000" ${ro ? 'disabled' : ''}>${esc(a.notes || '')}</textarea>
    ${a.done_at ? `<p class="sm muted">Resultado: ${ctPill(QC_ST[a.status])} · ${esc(a.auditor_name || '')} · ${esc(fmtDT(a.done_at))}</p>` : ''}
    <div class="err" id="qa-err"></div>
    <div class="row" style="justify-content:flex-end;gap:6px;margin-top:10px;flex-wrap:wrap"><button class="btn sec" id="qa-x">Cerrar</button>
      ${!ro && canWrite() ? `<button class="btn sec" id="qa-an">Anular</button><button class="btn" style="background:#B91C1C" data-res="rechazada">❌ Rechazada</button><button class="btn" style="background:#B45309" data-res="observada">⚠ Con observaciones</button><button class="btn" data-res="ok">✅ OK</button>` : ''}</div>`, { wide: true });
  $('#qa-x').onclick = m.close;
  const read = () => items.map((it, i) => ({ label: it.label, r: m.el.querySelector(`input[name="qa${i}"]:checked`)?.value || null, note: m.el.querySelector(`.qa-n[data-i="${i}"]`).value.trim() || null }));
  const save = async st => { const ch = read();
    if (st !== 'anulada' && ch.some(x => !x.r)) return ($('#qa-err').textContent = 'Marcá OK, Falla o N/A en cada control.');
    if (st === 'ok' && ch.some(x => x.r === 'falla')) return ($('#qa-err').textContent = 'Hay controles con falla: elegí "Con observaciones" o "Rechazada".');
    if (st === 'rechazada' && !confirm('Se abre un caso de mejora (5 porqués) para analizar la causa. ¿Confirmar rechazo?')) return;
    const { error } = await sb.from('qc_audits').update({ status: st, checklist: ch, notes: $('#qa-notes').value.trim() || null }).eq('id', a.id);
    if (error) return ($('#qa-err').textContent = errText(error)); m.close(); toast(st === 'rechazada' ? 'Auditoría rechazada: se abrió un caso en Mejora' : 'Auditoría guardada'); after(); };
  m.el.querySelectorAll('[data-res]').forEach(b => b.onclick = () => save(b.dataset.res));
  $('#qa-an')?.addEventListener('click', () => confirm('¿Anular esta auditoría?') && save('anulada'));
}
function ctQCCfg(cfg, after){
  const m = modal(`<h2>⚙ Auditorías de calidad</h2><label>Qué porcentaje de las tareas completadas se sortea para auditar</label>
    <select id="qc-r">${[0, 5, 10, 15, 20, 30, 50, 100].map(x => `<option value="${x}" ${Number(cfg.rate) === x ? 'selected' : ''}>${x === 0 ? 'Ninguna (apagado)' : x + '%'}</option>`).join('')}</select>
    <label>Controles de la auditoría (uno por línea)</label><textarea id="qc-i" style="min-height:160px" maxlength="6000">${esc((cfg.items?.length ? cfg.items : QC_DEF).join('\n'))}</textarea>
    <div class="err" id="qc-e"></div><div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn sec" id="qc-x">Cancelar</button><button class="btn" id="qc-ok">Guardar</button></div>`);
  $('#qc-x').onclick = m.close;
  $('#qc-ok').onclick = async () => { const items = $('#qc-i').value.split('\n').map(x => x.trim()).filter(Boolean).slice(0, 30);
    const { error } = await sb.rpc('qc_cfg_set', { p_rate: Number($('#qc-r').value), p_items: items }); if (error) return ($('#qc-e').textContent = errText(error)); m.close(); toast('Guardado'); after(); };
}
async function ctQCPick(after){
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const [tasks, has] = await Promise.all([
    sb.from('tasks').select('id,title,sites,completed_at,status').in('status', ['completada', 'aprobada']).gte('completed_at', since).order('completed_at', { ascending: false }).limit(200).then(r => r.data || []),
    sb.from('qc_audits').select('task_id').limit(2000).then(r => new Set((r.data || []).map(x => x.task_id))),
  ]);
  const L = tasks.filter(t => !has.has(t.id));
  const m = modal(`<h2>+ Auditar otra tarea</h2><p class="muted sm" style="margin-top:-6px">Tareas cerradas en los últimos 30 días que no tienen auditoría.</p>
    <input id="qp-q" placeholder="Buscar">
    <div id="qp-l" style="max-height:50vh;overflow:auto;margin-top:8px"></div><div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn sec" id="qp-x">Cerrar</button></div>`, { wide: true });
  const draw = () => { const q = norm($('#qp-q').value);
    $('#qp-l').innerHTML = L.filter(t => !q || norm(t.title + ' ' + (t.sites || []).map(s => s.site_name).join(' ')).includes(q)).slice(0, 80).map(t => `<div class="ct-note row between"><div><b>${esc(t.title)}</b><div class="sm muted">${esc((t.sites || []).map(s => s.site_name).join(', '))} · ${esc(fmtDate(t.completed_at))}</div></div><button class="btn small" data-pk="${esc(t.id)}">Auditar</button></div>`).join('') || '<p class="muted sm">No hay tareas para elegir.</p>';
    $('#qp-l').querySelectorAll('[data-pk]').forEach(b => b.onclick = async () => { const { error } = await sb.from('qc_audits').insert({ org_id: me.org_id, task_id: b.dataset.pk, picked: 'manual' }); if (error) return toast(errText(error)); m.close(); toast('Agregada a "Para auditar"'); after(); }); };
  $('#qp-q').oninput = draw; $('#qp-x').onclick = m.close; draw();
}

/* ---------- 🔧 Mejora: 5 porqués + CAPA ---------- */
async function ctCases(v, tabs, openId){
  try { await hhLoadBase(); } catch {}
  const [cases, acts] = await Promise.all([
    sb.from('cases').select('*').neq('status', 'anulado').order('created_at', { ascending: false }).limit(500).then(r => r.data || []),
    sb.from('case_actions').select('id,case_id,done_at,due').limit(3000).then(r => r.data || []),
  ]);
  CT.cf = CT.cf || { st: 'abiertos', cell: null };
  const today = todayStr();
  const isOpen = c => ['abierto', 'en_accion', 'verificar'].includes(c.status);
  const vis = cases.filter(c => (CT.cf.st === 'abiertos' ? isOpen(c) : CT.cf.st === 'cerrados' ? c.status === 'cerrado' : true)
    && (!CT.cf.cell || (c.prob === CT.cf.cell[0] && c.impact === CT.cf.cell[1])));
  const grid = {}; cases.filter(isOpen).forEach(c => { if (c.prob && c.impact){ const k = c.prob + '-' + c.impact; grid[k] = (grid[k] || 0) + 1; } });
  const card = c => { const A = acts.filter(x => x.case_id === c.id), late = A.some(x => !x.done_at && x.due && x.due < today), r = ctRisk(c.prob, c.impact);
    const vfy = c.status === 'verificar' && c.verify_at && c.verify_at <= today;
    return `<button class="ct-card" data-cs="${esc(c.id)}" style="border-left-color:${ctRiskColor(r)}"><b>${esc(c.title)}</b>
      <div class="s">${esc(CS_ORIG[c.origin] || c.origin)} · ${esc(c.site_name || '')} · ${esc(fmtDate(c.created_at))}</div>
      <div style="margin-top:4px">${ctPill(CS_ST[c.status])}${r ? `<span class="ct-tag" style="background:${ctRiskColor(r)};color:#0F2A4A">riesgo ${r}</span>` : '<span class="ct-tag" style="background:#F1F5F9;color:#64748B">sin evaluar</span>'}${A.length ? `<span class="ct-tag" style="background:#F1F5F9;color:#475569">${A.filter(x => x.done_at).length}/${A.length} acciones</span>` : ''}${late ? '<span class="ct-tag" style="background:#FEE2E2;color:#991B1B">acción vencida</span>' : ''}${vfy ? '<span class="ct-tag" style="background:#DBEAFE;color:#1E40AF">toca verificar</span>' : ''}</div></button>`; };
  const cell = (p, i) => { const n = grid[p + '-' + i] || 0, on = CT.cf.cell && CT.cf.cell[0] === p && CT.cf.cell[1] === i;
    return `<button data-cell="${p}-${i}" title="Probabilidad: ${CS_P[p]} · Impacto: ${CS_I[i]}" style="aspect-ratio:1;border:${on ? '3px solid #0F2A4A' : '1px solid #fff'};border-radius:6px;background:${ctRiskColor(p * i)};font-weight:700;color:#0F2A4A;cursor:pointer;min-width:0">${n || ''}</button>`; };
  v.innerHTML = `${tabs}<div class="card"><div class="row between" style="gap:10px;flex-wrap:wrap"><div><h1 style="margin:0">🔧 Mejora</h1><div class="muted sm">Cada problema se analiza con 5 porqués hasta la causa raíz, con acciones correctivas y preventivas, y después se verifica si funcionó. Se abren solos cuando una auditoría se rechaza, la revisión rechaza una tarea o un ticket vuelve al mismo sitio en 30 días.</div></div>
      ${canWrite() ? '<button class="btn" id="cs-new">+ Nuevo caso</button>' : ''}</div></div>
    <div class="grid2"><div class="card" style="margin:0"><h2 style="margin:0 0 6px">Casos abiertos por riesgo</h2>
      <div style="display:grid;grid-template-columns:70px repeat(5,minmax(0,1fr));gap:4px;align-items:center;max-width:330px">
      ${[5, 4, 3, 2, 1].map(p => `<span class="sm muted" style="font-size:11px;line-height:1.1">${CS_P[p]}</span>${[1, 2, 3, 4, 5].map(i => cell(p, i)).join('')}`).join('')}
      <span></span>${[1, 2, 3, 4, 5].map(i => `<span class="sm muted" style="font-size:10px;text-align:center;line-height:1.1">${CS_I[i].split(' ')[0]}</span>`).join('')}</div>
      <div class="sm muted" style="margin-top:6px">↑ probabilidad · impacto → · tocá un cuadro para filtrar${CT.cf.cell ? ' · <a href="#" id="cs-cellx">quitar filtro</a>' : ''}</div></div>
    <div class="card" style="margin:0"><h2 style="margin:0 0 6px">Resumen</h2><div class="stats">
      <div class="stat"><span>Para analizar</span><b>${cases.filter(c => c.status === 'abierto').length}</b></div><div class="stat"><span>En acción</span><b>${cases.filter(c => c.status === 'en_accion').length}</b></div>
      <div class="stat"><span>Verificar</span><b>${cases.filter(c => c.status === 'verificar').length}</b></div><div class="stat"><span>Cerrados</span><b>${cases.filter(c => c.status === 'cerrado').length}</b></div></div>
      <div class="sm muted" style="margin-top:8px">Causas de los cerrados: ${Object.entries(cases.filter(c => c.status === 'cerrado' && c.cause_type).reduce((o, c) => (o[c.cause_type] = (o[c.cause_type] || 0) + 1, o), {})).map(([k, n]) => esc(CS_CAUSE[k].split(' ')[0]) + ' ' + n).join(' · ') || '—'}</div></div></div>
    <div class="card"><div class="row" style="gap:6px;margin-bottom:8px">${[['abiertos', 'Abiertos'], ['cerrados', 'Cerrados'], ['todos', 'Todos']].map(([k, t]) => `<button class="ct-tab ${CT.cf.st === k ? 'on' : ''}" data-cst="${k}">${t}</button>`).join('')}</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:8px">${vis.map(card).join('') || '<p class="muted sm">No hay casos.</p>'}</div></div>`;
  const again = id => ctCases(v, tabs, id);
  v.querySelectorAll('[data-cs]').forEach(b => b.onclick = () => ctCaseModal(cases.find(c => c.id === b.dataset.cs), () => again()));
  v.querySelectorAll('[data-cst]').forEach(b => b.onclick = () => { CT.cf.st = b.dataset.cst; again(); });
  v.querySelectorAll('[data-cell]').forEach(b => b.onclick = () => { const [p, i] = b.dataset.cell.split('-').map(Number); CT.cf.cell = CT.cf.cell && CT.cf.cell[0] === p && CT.cf.cell[1] === i ? null : [p, i]; CT.cf.st = 'abiertos'; again(); });
  $('#cs-cellx')?.addEventListener('click', e => { e.preventDefault(); CT.cf.cell = null; again(); });
  $('#cs-new')?.addEventListener('click', () => ctCaseModal(null, () => again()));
  if (openId){ const c = cases.find(x => x.id === openId); if (c) ctCaseModal(c, () => again()); }
}
async function ctCaseModal(c, after){
  const isNew = !c; c = c || { origin: 'incidente', title: '', whys: [], staff_ids: [], status: 'abierto' };
  const staff = (HHS.staff || []).filter(s => s.active);
  const acts = isNew ? [] : await sb.from('case_actions').select('*').eq('case_id', c.id).order('created_at').then(r => r.data || []);
  let hint = '';
  if (!isNew && c.site_id && ['verificar', 'cerrado', 'en_accion'].includes(c.status)){
    const { data } = await sb.from('tickets').select('id,ext_no,created_at').eq('site_id', c.site_id).gt('created_at', c.created_at).neq('id', c.ticket_id || '00000000-0000-0000-0000-000000000000').limit(20);
    hint = (data || []).length ? `<div class="banner off" style="margin:8px 0"><span class="dot"></span><div><b>El problema volvió:</b> ${(data || []).length} ticket(s) nuevos en el sitio desde que se abrió el caso (${(data || []).map(x => '#' + esc(x.ext_no)).join(', ')}).</div></div>`
      : '<div style="margin:8px 0;background:#DCFCE7;color:#166534;border-radius:10px;padding:10px 12px">✅ <b>Sin tickets nuevos en el sitio</b> desde que se abrió el caso.</div>';
  }
  const ro = !canWrite() || ['cerrado', 'anulado'].includes(c.status);
  const whys = [...(c.whys || [])]; while (whys.length < 5) whys.push('');
  const today = todayStr();
  const m = modal(`<h2>${isNew ? '+ Nuevo caso' : '🔧 ' + esc(c.title)}</h2>
    ${!isNew ? `<p class="muted sm" style="margin-top:-6px">${esc(CS_ORIG[c.origin] || '')} · abierto el ${esc(fmtDate(c.created_at))} por ${esc(c.created_by_name || '')} ${ctPill(CS_ST[c.status])}
      ${c.task_id ? ` · <a href="#/tasks/${esc(c.task_id)}">ver tarea</a>` : ''}${c.ticket_id ? ` · <a href="#/tickets/${esc(c.ticket_id)}">ver ticket</a>` : ''}</p>` : ''}${hint}
    <label>Qué pasó (título)</label><input id="cs-t" maxlength="200" value="${esc(c.title)}" ${ro ? 'disabled' : ''} placeholder="Ej.: Entró agua en el empalme de Cabal">
    ${isNew ? `<div class="row"><div class="grow"><label>Tipo</label><select id="cs-o"><option value="incidente">⚠ Incidente</option><option value="manual">✍ Otro problema</option></select></div><div class="grow"><label>Sitio (opcional)</label><input id="cs-s" maxlength="200"></div></div>` : ''}
    <label>Personas involucradas (opcional · solo para el seguimiento, no para culpar)</label><div class="row" style="gap:6px;flex-wrap:wrap">${staff.map(s => `<label class="pill p-info" style="font-weight:400;display:inline-flex;gap:6px;align-items:center;font-size:13px"><input type="checkbox" class="cs-st" value="${esc(s.id)}" ${(c.staff_ids || []).includes(s.id) ? 'checked' : ''} ${ro ? 'disabled' : ''} style="width:auto;margin:0"> ${esc(s.name)}</label>`).join('') || '<span class="muted sm">—</span>'}</div>
    <h3 style="margin:14px 0 4px">5 porqués</h3><div class="sm muted" style="margin-bottom:6px">Preguntá "¿por qué?" a cada respuesta hasta llegar a algo que se pueda corregir para que no vuelva a pasar.</div>
    ${whys.map((w, i) => `<div class="row" style="gap:8px;flex-wrap:nowrap;margin-top:4px"><b style="min-width:120px">${i + 1}. ¿Por qué${i ? '' : ' pasó'}?</b><input class="cs-w" data-i="${i}" maxlength="400" value="${esc(w)}" ${ro ? 'disabled' : ''}></div>`).join('')}
    <div class="row"><div class="grow"><label>Causa raíz</label><input id="cs-rc" maxlength="1000" value="${esc(c.root_cause || '')}" ${ro ? 'disabled' : ''}></div>
      <div><label>Tipo de causa</label><select id="cs-ct" ${ro ? 'disabled' : ''}><option value="">—</option>${Object.entries(CS_CAUSE).map(([k, t]) => `<option value="${k}" ${c.cause_type === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div></div>
    <div class="row"><div class="grow"><label>Probabilidad de que vuelva a pasar</label><select id="cs-p" ${ro ? 'disabled' : ''}><option value="">—</option>${[1, 2, 3, 4, 5].map(x => `<option value="${x}" ${c.prob === x ? 'selected' : ''}>${x} · ${CS_P[x]}</option>`).join('')}</select></div>
      <div class="grow"><label>Impacto</label><select id="cs-i" ${ro ? 'disabled' : ''}><option value="">—</option>${[1, 2, 3, 4, 5].map(x => `<option value="${x}" ${c.impact === x ? 'selected' : ''}>${x} · ${CS_I[x]}</option>`).join('')}</select></div></div>
    ${isNew ? '' : `<h3 style="margin:14px 0 4px">Acciones (CAPA)</h3>
      ${acts.map(a => `<div class="ct-note row between" style="gap:8px"><div style="flex:1;min-width:200px"><b>${a.kind === 'preventiva' ? '🛡 Preventiva' : '🔨 Correctiva'}</b> · ${esc(a.body)}<div class="sm muted">${esc(a.owner_name || (a.owner_id ? ctStaffName(a.owner_id) : 'sin responsable'))}${a.due ? ' · para el ' + esc(fmtDate(a.due)) : ''}${a.done_at ? ' · ✅ hecha el ' + esc(fmtDate(a.done_at)) : a.due && a.due < today ? ' · <b style="color:#B91C1C">vencida</b>' : ''}</div></div>
        ${!ro && !a.done_at ? `<button class="btn small sec" data-adone="${esc(a.id)}">Marcar hecha</button>` : ''}</div>`).join('') || '<p class="muted sm">Todavía no hay acciones.</p>'}
      ${!ro ? `<div class="row" style="gap:6px;margin-top:8px;flex-wrap:wrap"><select id="ca-k" style="width:auto"><option value="correctiva">🔨 Correctiva (arreglar esto)</option><option value="preventiva">🛡 Preventiva (que no vuelva)</option></select>
        <input id="ca-b" maxlength="1000" placeholder="Qué hay que hacer" style="flex:1;min-width:200px"><select id="ca-o" style="width:auto"><option value="">Responsable</option>${staff.map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select>
        <input id="ca-d" type="date" style="width:auto" value="${addDays(today, 7)}"><button class="btn sec" id="ca-add">Agregar</button></div>` : ''}
      ${c.status === 'verificar' || c.status === 'cerrado' ? `<h3 style="margin:14px 0 4px">Verificación de eficacia</h3><div class="sm">Fecha prevista: ${esc(c.verify_at ? fmtDate(c.verify_at) : '—')}${c.verified_ok != null ? ` · ${c.verified_ok ? '✅ funcionó' : '❌ no funcionó'}${c.verify_note ? ' — ' + esc(c.verify_note) : ''}` : ''}</div>` : ''}`}
    <div class="err" id="cs-err"></div>
    <div class="row" style="justify-content:flex-end;gap:6px;margin-top:12px;flex-wrap:wrap"><button class="btn sec" id="cs-x">Cerrar</button>
      ${!ro ? `${!isNew && ctIsFin() ? '<button class="btn sec" id="cs-an">Anular</button>' : ''}<button class="btn sec" id="cs-save">Guardar</button>
        ${!isNew && c.status !== 'verificar' ? '<button class="btn" id="cs-vfy">Pasar a verificar →</button>' : ''}${!isNew && c.status === 'verificar' ? '<button class="btn" id="cs-close">Cerrar el caso ✓</button>' : ''}` : ''}
      ${c.status === 'cerrado' ? '<button class="btn" id="cs-les">💡 Cargar la lección aprendida</button>' : ''}</div>`, { wide: true });
  $('#cs-x').onclick = () => { m.close(); after(); };
  const read = () => { const w = [...m.el.querySelectorAll('.cs-w')].map(x => x.value.trim()); while (w.length && !w[w.length - 1]) w.pop();
    return { title: $('#cs-t').value.trim(), whys: w, root_cause: $('#cs-rc').value.trim() || null, cause_type: $('#cs-ct').value || null,
      prob: Number($('#cs-p').value) || null, impact: Number($('#cs-i').value) || null, staff_ids: [...m.el.querySelectorAll('.cs-st:checked')].map(x => x.value) }; };
  const save = async extra => { const d = { ...read(), ...(extra || {}) }; if (!d.title) return ($('#cs-err').textContent = 'Poné qué pasó.') && null;
    if (isNew){ const { data, error } = await sb.from('cases').insert({ ...d, org_id: me.org_id, origin: $('#cs-o').value, site_name: $('#cs-s').value.trim() || null }).select('*').single(); if (error) return ($('#cs-err').textContent = errText(error)) && null; return data; }
    const { data, error } = await sb.from('cases').update(d).eq('id', c.id).select('*').single(); if (error) return ($('#cs-err').textContent = errText(error)) && null; return data; };
  $('#cs-save')?.addEventListener('click', async () => { const d = await save(isNew ? {} : { status: c.status === 'abierto' && read().root_cause ? 'en_accion' : c.status }); if (!d) return; toast('Guardado'); m.close(); ctCaseModal(d, after); });
  $('#cs-vfy')?.addEventListener('click', async () => { const d0 = read();
    if (d0.whys.length < 2 || !d0.root_cause) return ($('#cs-err').textContent = 'Completá al menos 2 porqués y la causa raíz.');
    if (!acts.length) return ($('#cs-err').textContent = 'Cargá al menos una acción.');
    const when = prompt('¿Cuándo verificamos si funcionó? (días desde hoy)', '30'); if (when === null) return; const n = Math.max(1, Math.min(365, parseInt(when, 10) || 30));
    const d = await save({ status: 'verificar', verify_at: addDays(today, n) }); if (!d) return; toast('Pasó a verificar'); m.close(); ctCaseModal(d, after); });
  $('#cs-close')?.addEventListener('click', async () => {
    const ok = confirm('¿Funcionó? Aceptar = SÍ, el problema no volvió · Cancelar = NO funcionó (vuelve a "En acción")');
    const note = prompt(ok ? 'Comentario de la verificación (opcional)' : '¿Qué pasó? (vuelve a En acción para sumar otra acción)', '') ?? '';
    const d = await save(ok ? { status: 'cerrado', verified_ok: true, verify_note: note || null } : { status: 'en_accion', verified_ok: false, verify_note: note || null }); if (!d) return;
    m.close(); if (ok){ toast('Caso cerrado'); ctLessonModal({ title: '', happened: d.title + (d.root_cause ? '. Causa: ' + d.root_cause : ''), do_next: acts.filter(a => a.kind === 'preventiva').map(a => a.body).join('. '), case_id: d.id, status: 'publicada' }, after); } else { toast('Vuelve a En acción'); ctCaseModal(d, after); } });
  $('#cs-an')?.addEventListener('click', async () => { if (!confirm('¿Anular el caso?')) return; const d = await save({ status: 'anulado' }); if (d){ m.close(); after(); } });
  $('#cs-les')?.addEventListener('click', () => { m.close(); ctLessonModal({ title: '', happened: c.title + (c.root_cause ? '. Causa: ' + c.root_cause : ''), do_next: acts.filter(a => a.kind === 'preventiva').map(a => a.body).join('. '), case_id: c.id, status: 'publicada' }, after); });
  $('#ca-add')?.addEventListener('click', async () => { const body = $('#ca-b').value.trim(); if (!body) return ($('#cs-err').textContent = 'Escribí la acción.');
    const { error } = await sb.from('case_actions').insert({ org_id: me.org_id, case_id: c.id, kind: $('#ca-k').value, body, owner_id: $('#ca-o').value || null, due: $('#ca-d').value || null });
    if (error) return ($('#cs-err').textContent = errText(error));
    const d = await save(c.status === 'abierto' ? { status: 'en_accion' } : {}); m.close(); ctCaseModal(d || c, after); });
  m.el.querySelectorAll('[data-adone]').forEach(b => b.onclick = async () => { const { error } = await sb.from('case_actions').update({ done_at: new Date().toISOString() }).eq('id', b.dataset.adone); if (error) return toast(errText(error)); m.close(); ctCaseModal(c, after); });
}

/* ---------- 💡 Lecciones aprendidas ---------- */
const LS_TT = () => (typeof TASK_TYPES !== 'undefined' ? TASK_TYPES : { inspeccion: 'Inspección', instalacion: 'Instalación', reparacion: 'Reparación', mantenimiento: 'Mantenimiento', otro: 'Otro' });
const LS_SK = () => (typeof SITE_KINDS !== 'undefined' ? SITE_KINDS : {});
async function ctLessons(v, tabs){
  const [L, tpls] = await Promise.all([
    sb.from('lessons').select('*').neq('status', 'archivada').order('updated_at', { ascending: false }).limit(500).then(r => r.data || []),
    sb.from('templates').select('id,name').order('name').then(r => r.data || []).catch(() => []),
  ]);
  CT.lq = CT.lq || { q: '', tt: '', st: '' };
  const vis = L.filter(l => (!CT.lq.st || l.status === CT.lq.st) && (!CT.lq.tt || !l.task_types.length || l.task_types.includes(CT.lq.tt))
    && (!CT.lq.q || norm([l.title, l.happened, l.do_next, ...(l.tags || [])].join(' ')).includes(norm(CT.lq.q))));
  const TT = LS_TT(), SK = LS_SK();
  const tname = id => tpls.find(t => t.id === id)?.name || 'planilla';
  const card = l => `<div class="ct-note" style="border-left:5px solid ${l.good ? '#16A34A' : '#F59E0B'};border-radius:0 10px 10px 0">
    <div class="row between" style="gap:6px"><b>${l.good ? '👍' : '💡'} ${esc(l.title)}</b><span>${l.status === 'borrador' ? ctPill(['Propuesta (sin publicar)', '#B45309', '#FEF3C7']) : ''}<span class="sm muted"> 👁 ${l.views}</span></span></div>
    ${l.happened ? `<div class="sm" style="margin-top:4px"><b>Qué pasó:</b> ${esc(l.happened)}</div>` : ''}<div class="sm" style="margin-top:2px"><b>Qué hacer:</b> ${esc(l.do_next)}</div>
    <div class="sm muted" style="margin-top:4px">${l.task_types.length ? esc(l.task_types.map(x => TT[x] || x).join(', ')) : 'Todas las tareas'}${l.site_kinds.length ? ' · ' + esc(l.site_kinds.map(x => SK[x] || x).join(', ')) : ''}${(l.tags || []).length ? ' · #' + l.tags.map(esc).join(' #') : ''}${l.template_ids.length ? ' · 📌 en ' + esc(l.template_ids.map(tname).join(', ')) : ''} · aportó ${esc(l.author_name || '')}</div>
    ${canWrite() ? `<div class="row" style="gap:6px;margin-top:6px;flex-wrap:wrap">${l.status === 'borrador' ? `<button class="btn small" data-lpub="${esc(l.id)}">Publicar</button>` : ''}<button class="btn small sec" data-led="${esc(l.id)}">Editar</button>${l.status === 'publicada' ? `<button class="btn small sec" data-ltpl="${esc(l.id)}">📌 Pasar a una planilla</button>` : ''}<button class="btn small sec" data-larc="${esc(l.id)}">Archivar</button></div>` : ''}</div>`;
  v.innerHTML = `${tabs}<div class="card"><div class="row between" style="gap:10px;flex-wrap:wrap"><div><h1 style="margin:0">💡 Lecciones aprendidas</h1><div class="muted sm">Qué aprendimos y qué hacer la próxima vez, sin culpables. Le aparecen solas al técnico en las tareas del mismo tipo. Si una se repite, pasala a la planilla como paso obligatorio.</div></div>
      ${canWrite() ? '<button class="btn" id="ls-new">+ Nueva lección</button>' : ''}</div>
    <div class="row" style="gap:6px;margin-top:10px;flex-wrap:wrap"><input id="ls-q" placeholder="Buscar" value="${esc(CT.lq.q)}" style="width:220px">
      <select id="ls-tt" style="width:auto"><option value="">Todos los tipos de tarea</option>${Object.entries(TT).map(([k, t]) => `<option value="${k}" ${CT.lq.tt === k ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>
      <select id="ls-st" style="width:auto"><option value="">Publicadas y propuestas</option><option value="publicada" ${CT.lq.st === 'publicada' ? 'selected' : ''}>Publicadas</option><option value="borrador" ${CT.lq.st === 'borrador' ? 'selected' : ''}>Propuestas por revisar (${L.filter(l => l.status === 'borrador').length})</option></select></div></div>
    <div class="card">${vis.map(card).join('') || '<p class="muted sm">Todavía no hay lecciones. Se cargan al cerrar un caso de Mejora o con "+ Nueva lección".</p>'}</div>`;
  const again = () => ctLessons(v, tabs);
  $('#ls-new')?.addEventListener('click', () => ctLessonModal({ status: 'publicada' }, again));
  let tm; $('#ls-q').oninput = e => { clearTimeout(tm); tm = setTimeout(() => { CT.lq.q = e.target.value; again().then(() => { const i = $('#ls-q'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }); }, 350); };
  $('#ls-tt').onchange = e => { CT.lq.tt = e.target.value; again(); };
  $('#ls-st').onchange = e => { CT.lq.st = e.target.value; again(); };
  v.querySelectorAll('[data-lpub]').forEach(b => b.onclick = async () => { const { error } = await sb.from('lessons').update({ status: 'publicada' }).eq('id', b.dataset.lpub); if (error) return toast(errText(error)); toast('Publicada'); again(); });
  v.querySelectorAll('[data-larc]').forEach(b => b.onclick = async () => { if (!confirm('¿Archivar la lección? Deja de aparecer en las tareas.')) return; const { error } = await sb.from('lessons').update({ status: 'archivada' }).eq('id', b.dataset.larc); if (error) return toast(errText(error)); again(); });
  v.querySelectorAll('[data-led]').forEach(b => b.onclick = () => ctLessonModal(L.find(l => l.id === b.dataset.led), again));
  v.querySelectorAll('[data-ltpl]').forEach(b => b.onclick = () => { const l = L.find(x => x.id === b.dataset.ltpl);
    const m = modal(`<h2>📌 Pasar a una planilla</h2><p class="muted sm" style="margin-top:-6px">Se agrega como paso obligatorio (OK / Falla) en la sección "Lecciones aprendidas" de la planilla elegida: <b>${esc(l.title)}</b>. Las inspecciones ya hechas no cambian.</p>
      <select id="lt-t">${tpls.filter(t => !l.template_ids.includes(t.id)).map(t => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}</select><div class="err" id="lt-e"></div>
      <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn sec" id="lt-x">Cancelar</button><button class="btn" id="lt-ok">Agregar</button></div>`);
    $('#lt-x').onclick = m.close;
    $('#lt-ok').onclick = async () => { const tid = $('#lt-t').value; if (!tid) return; const { error } = await sb.rpc('lesson_to_template', { p_lesson: l.id, p_template: tid }); if (error) return ($('#lt-e').textContent = errText(error));
      m.close(); toast('Agregada a la planilla'); again(); }; });
}
function ctLessonModal(l, after){
  l = l || {}; const isNew = !l.id; const TT = LS_TT(), SK = LS_SK();
  const mgr = isManager();
  const m = modal(`<h2>${isNew ? '💡 Nueva lección aprendida' : 'Editar lección'}</h2><p class="muted sm" style="margin-top:-6px">Sin nombres ni culpables: se cuenta qué pasó y qué hacer la próxima vez.${mgr ? '' : ' La oficina la revisa antes de publicarla.'}</p>
    <label>Título corto</label><input id="ll-t" maxlength="160" value="${esc(l.title || '')}" placeholder="Ej.: Llevar cinta autosoldable en cada salida">
    <label>Qué pasó (opcional)</label><textarea id="ll-h" maxlength="1500">${esc(l.happened || '')}</textarea>
    <label>Qué hacer la próxima vez</label><textarea id="ll-d" maxlength="1500">${esc(l.do_next || '')}</textarea>
    <label>A qué tareas aplica (ninguna marcada = a todas)</label><div class="row" style="gap:6px;flex-wrap:wrap">${Object.entries(TT).map(([k, t]) => `<label class="pill p-info" style="font-weight:400;display:inline-flex;gap:6px;align-items:center;font-size:13px"><input type="checkbox" class="ll-tt" value="${k}" ${(l.task_types || []).includes(k) ? 'checked' : ''} style="width:auto;margin:0"> ${esc(t)}</label>`).join('')}</div>
    ${Object.keys(SK).length ? `<label>Tipos de sitio (ninguno = todos)</label><div class="row" style="gap:6px;flex-wrap:wrap">${Object.entries(SK).map(([k, t]) => `<label class="pill" style="font-weight:400;display:inline-flex;gap:6px;align-items:center;font-size:13px"><input type="checkbox" class="ll-sk" value="${esc(k)}" ${(l.site_kinds || []).includes(k) ? 'checked' : ''} style="width:auto;margin:0"> ${esc(t)}</label>`).join('')}</div>` : ''}
    <div class="row"><div class="grow"><label>Etiquetas (separadas por coma)</label><input id="ll-g" maxlength="300" value="${esc((l.tags || []).join(', '))}" placeholder="empalme, energía"></div>
      <label style="display:flex;gap:8px;align-items:center;font-weight:400;margin-top:22px"><input type="checkbox" id="ll-good" ${l.good ? 'checked' : ''} style="width:auto;margin:0"> 👍 Es una buena práctica (algo que salió bien)</label></div>
    <div class="err" id="ll-e"></div><div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn sec" id="ll-x">Cancelar</button><button class="btn" id="ll-ok">${mgr ? (isNew ? 'Publicar' : 'Guardar') : 'Enviar a la oficina'}</button></div>`, { wide: true });
  $('#ll-x').onclick = () => { m.close(); after && after(); };
  $('#ll-ok').onclick = async () => {
    const row = { title: $('#ll-t').value.trim(), happened: $('#ll-h').value.trim() || null, do_next: $('#ll-d').value.trim(), good: $('#ll-good').checked,
      task_types: [...m.el.querySelectorAll('.ll-tt:checked')].map(x => x.value), site_kinds: [...m.el.querySelectorAll('.ll-sk:checked')].map(x => x.value),
      tags: $('#ll-g').value.split(',').map(x => x.trim()).filter(Boolean).slice(0, 10) };
    if (!row.title || !row.do_next) return ($('#ll-e').textContent = 'Completá el título y qué hacer la próxima vez.');
    const q = isNew ? sb.from('lessons').insert({ ...row, org_id: me.org_id, case_id: l.case_id || null, status: mgr ? (l.status || 'publicada') : 'borrador' }) : sb.from('lessons').update(row).eq('id', l.id);
    const { error } = await q; if (error) return ($('#ll-e').textContent = errText(error));
    m.close(); toast(mgr ? 'Lección guardada' : 'Gracias: la oficina la va a revisar'); after && after(); };
}

/* =====================================================================
   ETAPA 3 · RACI, Objetivos (OGSM), Planes de mejora (PDCA) y promesas
   ===================================================================== */
const CT_RACI = { R: ['R · Hace', '#1E40AF', '#DBEAFE'], A: ['A · Responde (aprueba)', '#991B1B', '#FEE2E2'], C: ['C · Consultado', '#92400E', '#FEF3C7'], I: ['I · Informado', '#475569', '#F1F5F9'] };
const CT_MET = { a_tiempo: ['% a tiempo', '%', 1], promesas: ['% fechas prometidas cumplidas', '%', 1], qc_ok: ['% auditorías OK', '%', 1], gps: ['% planillas en el sitio', '%', 1],
  repetidos: ['Tickets que volvieron', '', -1], rechazos: ['Rechazos', '', -1], vencidas: ['Vencidas sin cerrar', '', -1], manual: ['Otro (valor a mano)', '', 1] };
function ctMetricNow(m, { r, qcr, prm }){
  if (!r && m !== 'manual') return null;
  return { a_tiempo: () => ctOnTime(r), promesas: () => prm ? ctPct(prm.kept, prm.promised) : null, qc_ok: () => qcr ? ctPct(qcr.qc_ok, qcr.qc_done) : null, gps: () => ctGps(r),
    repetidos: () => r.tk_repeat, rechazos: () => r.rejections, vencidas: () => r.tasks_overdue, manual: () => null }[m || 'manual']?.() ?? null;
}
const ctGoalOk = (m, val, target) => val == null || target == null ? 'na' : (CT_MET[m]?.[2] ?? 1) > 0 ? (val >= target ? 'ok' : val >= target * 0.85 ? 'wa' : 'bad') : (val <= target ? 'ok' : val <= target + 1 ? 'wa' : 'bad');
const ctFmtM = (m, v) => v == null ? '—' : String(Math.round(v * 10) / 10).replace('.', ',') + (CT_MET[m]?.[1] || '');

/* ---------- PDCA ---------- */
const PD_PH = [['P', 'Planificar'], ['D', 'Hacer'], ['C', 'Verificar'], ['A', 'Actuar']];
function ctPdcaCard(pl, now, edit){
  const idx = pl.phase === 'cerrado' ? 4 : PD_PH.findIndex(x => x[0] === pl.phase);
  const st = ctGoalOk(pl.metric, now, pl.target);
  return `<div class="ct-note"><div class="row between" style="gap:6px"><b>${esc(pl.title)}</b>${pl.phase === 'cerrado' ? ctPill([{ logrado: 'Logrado', parcial: 'Parcial', no_logrado: 'No logrado' }[pl.result] || 'Cerrado', pl.result === 'logrado' ? '#15803D' : '#B45309', pl.result === 'logrado' ? '#DCFCE7' : '#FEF3C7']) : ''}</div>
    <div class="row" style="gap:4px;margin:6px 0">${PD_PH.map(([k, t], i) => `<span class="ct-tag" style="background:${i < idx ? '#DCFCE7' : i === idx ? '#DBEAFE' : '#F1F5F9'};color:${i < idx ? '#166534' : i === idx ? '#1E40AF' : '#64748B'}">${i < idx ? '✓ ' : ''}${k} · ${t}</span>`).join('')}</div>
    ${pl.metric ? `<div class="sm">${esc(CT_MET[pl.metric]?.[0] || '')}: antes <b>${ctFmtM(pl.metric, pl.baseline)}</b> → meta <b>${ctFmtM(pl.metric, pl.target)}</b> · ahora <b style="color:${CT_SEM[st][0]}">${ctFmtM(pl.metric, now)}</b>${pl.due ? ' · para el ' + esc(fmtDate(pl.due)) : ''}</div>` : ''}
    ${pl.plan ? `<div class="sm muted" style="margin-top:4px">Plan: ${esc(pl.plan)}</div>` : ''}
    ${edit ? `<button class="btn sec small ct-noprint" data-pd="${esc(pl.id)}" style="margin-top:6px">${pl.phase === 'cerrado' ? 'Ver' : 'Actualizar'}</button>` : ''}</div>`;
}
function ctPdcaModal(pl, cur, after){
  const isNew = !pl.id; pl = { phase: 'P', ...pl };
  const ro = pl.phase === 'cerrado';
  const m = modal(`<h2>🔄 ${isNew ? 'Nuevo plan de mejora' : esc(pl.title)}</h2>
    <label>Objetivo del plan</label><input id="pd-t" maxlength="200" value="${esc(pl.title || '')}" ${ro ? 'disabled' : ''} placeholder="Ej.: Cumplir las fechas que promete">
    <div class="row"><div class="grow"><label>Indicador</label><select id="pd-m" ${ro ? 'disabled' : ''}>${Object.entries(CT_MET).map(([k, [t]]) => `<option value="${k}" ${(pl.metric || 'a_tiempo') === k ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></div>
      <div><label>Hoy</label><input id="pd-b" type="number" step="0.1" value="${pl.baseline ?? ''}" ${ro ? 'disabled' : ''} style="width:110px"></div>
      <div><label>Meta</label><input id="pd-g" type="number" step="0.1" value="${pl.target ?? ''}" ${ro ? 'disabled' : ''} style="width:110px"></div>
      <div><label>Para el</label><input id="pd-d" type="date" value="${esc(pl.due || addDays(todayStr(), 60))}" ${ro ? 'disabled' : ''}></div></div>
    <label>P · Planificar: qué se va a hacer</label><textarea id="pd-p" maxlength="2000" ${ro ? 'disabled' : ''}>${esc(pl.plan || '')}</textarea>
    ${['D', 'C', 'A', 'cerrado'].includes(pl.phase) ? `<label>D · Hacer: qué se hizo</label><textarea id="pd-do" maxlength="2000" ${ro ? 'disabled' : ''}>${esc(pl.do_notes || '')}</textarea>` : ''}
    ${['C', 'A', 'cerrado'].includes(pl.phase) ? `<label>C · Verificar: qué muestran los números</label><textarea id="pd-c" maxlength="2000" ${ro ? 'disabled' : ''}>${esc(pl.check_notes || '')}</textarea><div class="sm muted">Valor actual del indicador: <b>${ctFmtM(pl.metric, ctMetricNow(pl.metric, cur))}</b></div>` : ''}
    ${['A', 'cerrado'].includes(pl.phase) ? `<label>A · Actuar: qué queda como estándar o qué se ajusta</label><textarea id="pd-a" maxlength="2000" ${ro ? 'disabled' : ''}>${esc(pl.act_notes || '')}</textarea>` : ''}
    <div class="err" id="pd-e"></div>
    <div class="row" style="justify-content:flex-end;gap:6px;margin-top:10px;flex-wrap:wrap"><button class="btn sec" id="pd-x">Cerrar</button>
      ${!ro ? `<button class="btn sec" id="pd-s">Guardar</button>${pl.phase !== 'A' ? `<button class="btn" id="pd-n">Guardar y pasar a ${PD_PH[Math.min(3, PD_PH.findIndex(x => x[0] === pl.phase) + 1)][1]} →</button>` : '<button class="btn" id="pd-end">Cerrar el plan ✓</button>'}` : ''}</div>`, { wide: true });
  $('#pd-x').onclick = m.close;
  if (isNew) $('#pd-m').onchange = () => { const v0 = ctMetricNow($('#pd-m').value, cur); if (v0 != null) $('#pd-b').value = Math.round(v0 * 10) / 10; };
  if (isNew){ const v0 = ctMetricNow($('#pd-m').value, cur); if (v0 != null && $('#pd-b').value === '') $('#pd-b').value = Math.round(v0 * 10) / 10; }
  const num = id => { const x = $(id)?.value; return x === '' || x == null ? null : Number(x); };
  const read = () => ({ title: $('#pd-t').value.trim(), metric: $('#pd-m').value, baseline: num('#pd-b'), target: num('#pd-g'), due: $('#pd-d').value || null, plan: $('#pd-p').value.trim() || null,
    ...(m.el.querySelector('#pd-do') ? { do_notes: $('#pd-do').value.trim() || null } : {}), ...(m.el.querySelector('#pd-c') ? { check_notes: $('#pd-c').value.trim() || null } : {}), ...(m.el.querySelector('#pd-a') ? { act_notes: $('#pd-a').value.trim() || null } : {}) });
  const save = async extra => { const d = { ...read(), ...(extra || {}) }; if (!d.title) return void ($('#pd-e').textContent = 'Poné el objetivo del plan.');
    const { error } = await (isNew ? sb.from('pdca').insert({ ...d, org_id: me.org_id, staff_id: pl.staff_id }) : sb.from('pdca').update(d).eq('id', pl.id));
    if (error) return void ($('#pd-e').textContent = errText(error)); m.close(); toast('Plan guardado'); after(); };
  $('#pd-s')?.addEventListener('click', () => save());
  $('#pd-n')?.addEventListener('click', () => save({ phase: PD_PH[Math.min(3, PD_PH.findIndex(x => x[0] === pl.phase) + 1)][0] }));
  $('#pd-end')?.addEventListener('click', () => { const r0 = prompt('Resultado: escribí 1 = logrado, 2 = parcial, 3 = no logrado', '1'); if (r0 === null) return;
    save({ phase: 'cerrado', result: { 1: 'logrado', 2: 'parcial', 3: 'no_logrado' }[String(r0).trim()] || 'parcial' }); });
}

/* ---------- 🧩 RACI por proyecto ---------- */
const RACI_DEF = ['Recibir y cargar el ticket del cliente', 'Asignar el recurso', 'Hacer el trabajo en el sitio', 'Completar la planilla con fotos', 'Revisar la calidad', 'Cargar el cierre en la ticketera del cliente', 'Informar al cliente', 'Certificar el mes'];
async function ctRaci(v, tabs){
  try { await hhLoadBase(); } catch {}
  const projects = (await loadProjects().catch(() => [])).filter(p => p.active !== false);
  CT.rp = CT.rp && projects.some(p => p.id === CT.rp) ? CT.rp : projects[0]?.id || '';
  const rows = CT.rp ? await sb.from('raci').select('*').eq('project_id', CT.rp).order('sort').order('activity').then(r => r.data || []) : [];
  const staff = (HHS.staff || []).filter(s => s.active && s.kind !== 'contratista');
  CT.rcols = CT.rcols || {};
  const used = new Set(rows.flatMap(r => Object.keys(r.cells || {})));
  const cols = staff.filter(s => used.has(s.id) || (CT.rcols[CT.rp] || []).includes(s.id));
  const edit = canWrite();
  const cell = (r, s) => { const L = (r.cells || {})[s.id] || ''; const c = CT_RACI[L];
    return `<td style="text-align:center;padding:4px"><button ${edit ? '' : 'disabled'} data-rc="${esc(r.id)}" data-rs="${esc(s.id)}" title="Tocá para cambiar: R → A → C → I → vacío" style="width:40px;height:34px;border-radius:8px;border:1px solid #CBD5E1;font-weight:800;cursor:${edit ? 'pointer' : 'default'};background:${c ? c[2] : '#fff'};color:${c ? c[1] : '#94A3B8'}">${L || '·'}</button></td>`; };
  const warn = r => { const vals = Object.values(r.cells || {}); const a = vals.filter(x => x === 'A').length, rr = vals.filter(x => x === 'R').length;
    return a !== 1 ? `<div class="sm" style="color:#B91C1C">${a ? 'Hay ' + a + ' "A": tiene que haber uno solo' : 'Falta quién responde (A)'}</div>` : !rr ? '<div class="sm" style="color:#B45309">Falta quién lo hace (R)</div>' : ''; };
  v.innerHTML = `${tabs}<div class="card"><div class="row between" style="gap:10px;flex-wrap:wrap"><div><h1 style="margin:0">🧩 RACI · quién hace qué</h1><div class="muted sm">Por proyecto: <b>R</b> lo hace · <b>A</b> responde y aprueba (uno solo) · <b>C</b> se le consulta · <b>I</b> se le informa. Así queda claro de quién es cada cosa antes de que pase algo; el registro de la app muestra después quién lo hizo de verdad.</div></div>
      <select id="rc-p" style="width:auto">${projects.map(p => `<option value="${esc(p.id)}" ${p.id === CT.rp ? 'selected' : ''}>${esc(p.short_name || p.name)}</option>`).join('') || '<option value="">Sin proyectos</option>'}</select></div>
    ${edit && CT.rp ? `<div class="row" style="gap:6px;margin-top:10px;flex-wrap:wrap"><input id="rc-a" maxlength="200" placeholder="Nueva actividad" style="flex:1;min-width:220px"><button class="btn sec" id="rc-add">+ Actividad</button>
      ${!rows.length ? '<button class="btn sec" id="rc-def">Cargar actividades típicas</button>' : ''}
      <select id="rc-from" style="width:auto"><option value="">📋 Copiar de otro proyecto…</option>${projects.filter(p => p.id !== CT.rp).map(p => `<option value="${esc(p.id)}">${esc(p.short_name || p.name)}</option>`).join('')}</select>
      <select id="rc-col" style="width:auto"><option value="">+ Persona en la matriz</option>${staff.filter(s => !cols.includes(s)).map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select></div>` : ''}</div>
    <div class="card"><div class="tblwrap"><table class="tbl"><thead><tr><th>Actividad</th>${cols.map(s => `<th style="text-align:center;white-space:normal;min-width:70px;font-size:12px">${esc(s.name)}</th>`).join('')}${edit ? '<th></th>' : ''}</tr></thead><tbody>
      ${rows.map(r => `<tr><td><b>${esc(r.activity)}</b>${warn(r)}</td>${cols.map(s => cell(r, s)).join('')}${edit ? `<td><button class="iconbtn" data-rdel="${esc(r.id)}" title="Borrar" aria-label="Borrar">🗑</button></td>` : ''}</tr>`).join('') || `<tr><td colspan="${cols.length + 2}" class="muted">Todavía no hay actividades.</td></tr>`}
    </tbody></table></div>${!cols.length && rows.length ? '<p class="muted sm">Agregá personas con "+ Persona en la matriz".</p>' : ''}
    <div class="row" style="gap:6px;margin-top:8px;flex-wrap:wrap">${Object.values(CT_RACI).map(x => ctPill(x)).join('')}</div></div>`;
  const again = () => ctRaci(v, tabs);
  $('#rc-p').onchange = e => { CT.rp = e.target.value; again(); };
  $('#rc-col')?.addEventListener('change', e => { if (!e.target.value) return; (CT.rcols[CT.rp] = CT.rcols[CT.rp] || []).push(e.target.value); again(); });
  $('#rc-add')?.addEventListener('click', async () => { const a = $('#rc-a').value.trim(); if (!a) return; const { error } = await sb.from('raci').insert({ org_id: me.org_id, project_id: CT.rp, activity: a, sort: (rows.length + 1) * 10, cells: {} }); if (error) return toast(errText(error)); again(); });
  $('#rc-from')?.addEventListener('change', async e => { const from = e.target.value; if (!from) return;
    const keep = confirm('¿Copiar también las personas (R/A/C/I)?\nAceptar = actividades y personas · Cancelar = solo las actividades');
    const { data, error } = await sb.rpc('raci_copy', { p_from: from, p_to: CT.rp, p_people: keep }); if (error) return toast(errText(error));
    toast(data ? `Se copiaron ${data} actividad(es)` : 'No había actividades nuevas para copiar'); again(); });
  $('#rc-def')?.addEventListener('click', async () => { const { error } = await sb.from('raci').insert(RACI_DEF.map((a, i) => ({ org_id: me.org_id, project_id: CT.rp, activity: a, sort: (i + 1) * 10, cells: {} }))); if (error) return toast(errText(error)); again(); });
  v.querySelectorAll('[data-rdel]').forEach(b => b.onclick = async () => { if (!confirm('¿Borrar la actividad?')) return; const { error } = await sb.from('raci').delete().eq('id', b.dataset.rdel); if (error) return toast(errText(error)); again(); });
  v.querySelectorAll('[data-rc]').forEach(b => b.onclick = async () => { const r = rows.find(x => x.id === b.dataset.rc); const cells = { ...(r.cells || {}) }; const cur = cells[b.dataset.rs] || '';
    const nx = { '': 'R', R: 'A', A: 'C', C: 'I', I: '' }[cur]; if (nx) cells[b.dataset.rs] = nx; else delete cells[b.dataset.rs];
    const { error } = await sb.from('raci').update({ cells }).eq('id', r.id); if (error) return toast(errText(error)); again(); });
}

/* ---------- 🧭 Objetivos (OGSM) ---------- */
async function ctOgsm(v, tabs){
  try { await hhLoadBase(); } catch {}
  CT.oy = CT.oy || Number(todayStr().slice(0, 4));
  const fin = ctIsFin(), edit = fin && canWrite();
  const a = `${CT.oy}-01-01`, b0 = `${CT.oy}-12-31`, b = b0 < todayStr() ? b0 : todayStr();
  await ctProjOpts();
  const OP = CT.op || null;   // null = toda la empresa
  const pq = q => OP ? q.eq('project_id', OP) : q;
  const [itemsAll, team, qcs, prom, ptasks] = await Promise.all([
    sb.from('ogsm_items').select('*').eq('year', CT.oy).order('sort').order('updated_at').then(r => r.data || []),
    fin && a <= b ? sb.rpc('perf_kpis', { p_from: a, p_to: b, p_staff: null, p_project: OP }).then(r => r.data || []).catch(() => []) : Promise.resolve([]),
    sb.from('qc_audits').select('status,task_id').gte('done_at', a).lte('done_at', b + 'T23:59:59').limit(5000).then(r => r.data || []).catch(() => []),
    pq(sb.from('tasks').select('promised_date,completed_at,status').gte('promised_date', a).lt('promised_date', b < todayStr() ? b : todayStr())).limit(5000).then(r => r.data || []).catch(() => []),
    OP ? sb.from('tasks').select('id').eq('project_id', OP).limit(10000).then(r => new Set((r.data || []).map(x => x.id))).catch(() => new Set()) : Promise.resolve(null),
  ]);
  const items = itemsAll.filter(x => (x.project_id || null) === OP);
  const qcs2 = ptasks ? qcs.filter(x => ptasks.has(x.task_id)) : qcs;
  const S = k => team.reduce((s, x) => s + (x[k] || 0), 0);
  const qd = qcs2.filter(x => ['ok', 'observada', 'rechazada'].includes(x.status)), pv = prom.filter(x => x.status !== 'cancelada');
  const auto = { a_tiempo: team.length ? ctPct(S('tasks_ontime') + S('tk_in_sla'), S('tasks_done') + S('tk_done')) : null, gps: team.length ? ctPct(S('insp_gps'), S('insp_done')) : null,
    repetidos: team.length ? S('tk_repeat') : null, rechazos: team.length ? S('rejections') : null, vencidas: team.length ? S('tasks_overdue') : null,
    qc_ok: qd.length ? ctPct(qd.filter(x => x.status === 'ok').length, qd.length) : null, promesas: pv.length ? ctPct(pv.filter(x => x.completed_at && x.completed_at.slice(0, 10) <= x.promised_date).length, pv.length) : null };
  const val = it => it.metric === 'manual' || !it.metric ? (it.manual_value != null ? Number(it.manual_value) : null) : auto[it.metric];
  const kids = (id, kind) => items.filter(x => x.parent_id === id && (!kind || x.kind === kind));
  const own = id => (HHS.staff || []).find(s => s.id === id)?.name || '';
  const ST = { pendiente: ['Pendiente', '#64748B', '#F1F5F9'], en_curso: ['En curso', '#1E40AF', '#DBEAFE'], hecho: ['Hecho', '#15803D', '#DCFCE7'], frenado: ['Frenado', '#B91C1C', '#FEE2E2'] };
  const metric = it => { const x = val(it), st = ctGoalOk(it.metric || 'manual', x, it.target == null ? null : Number(it.target)), pc = x != null && it.target ? Math.max(0, Math.min(100, (CT_MET[it.metric || 'manual'][2] > 0 ? x / it.target : (it.target ? (it.target / Math.max(x, 0.0001)) : 0)) * 100)) : 0;
    return `<div class="sm" style="margin-top:3px">${esc(CT_MET[it.metric || 'manual'][0])}: <b style="color:${CT_SEM[st][0]}">${ctFmtM(it.metric, x)}</b>${it.target != null ? ' · meta ' + ctFmtM(it.metric, Number(it.target)) : ''}</div>
      <div style="height:8px;border-radius:4px;background:#EEF2F7;margin-top:3px;overflow:hidden"><i style="display:block;height:100%;width:${pc}%;background:${CT_SEM[st][0]}"></i></div>`; };
  const btn = (kind, parent, label) => edit ? `<button class="btn sec small" data-oadd="${kind}" data-op="${esc(parent || '')}">${label}</button>` : '';
  const ed = it => edit ? `<button class="iconbtn" data-oed="${esc(it.id)}" title="Editar" aria-label="Editar">✏️</button>` : '';
  const objs = items.filter(x => x.kind === 'objetivo');
  v.innerHTML = `${tabs}<div class="card"><div class="row between" style="gap:10px;flex-wrap:wrap"><div><h1 style="margin:0">🧭 Objetivos ${CT.oy} · ${OP ? esc(ctProjName(OP)) : 'Toda la empresa'}</h1><div class="muted sm"><b>O</b>bjetivo (a dónde vamos) · <b>G</b>oals, metas con número · <b>S</b>trategias (cómo) · <b>M</b>edidas (cómo sabemos que avanza). Las metas con indicador se calculan solas con lo que registra la app.${fin ? '' : ' Los editan el Admin y el PM.'}</div></div>
      <div class="row" style="gap:6px">${ctProjSel('og-p', CT.op || '', 'Toda la empresa')}<button class="btn sec" id="og-prev">‹</button><button class="btn sec" id="og-next">›</button>${btn('objetivo', '', '+ Objetivo')}</div></div></div>
    ${objs.map(o => `<div class="card"><div class="row between"><h2 style="margin:0">🎯 ${esc(o.body)}</h2>${ed(o)}</div>
      <div class="grid2" style="margin-top:10px">
        <div><h3 style="margin:0 0 4px">Metas</h3>${kids(o.id, 'meta').map(g => `<div class="ct-note"><div class="row between"><b>${esc(g.body)}</b>${ed(g)}</div>${metric(g)}</div>`).join('') || '<p class="muted sm">Sin metas.</p>'}${btn('meta', o.id, '+ Meta')}</div>
        <div><h3 style="margin:0 0 4px">Estrategias y medidas</h3>${kids(o.id, 'estrategia').map(st => `<div class="ct-note"><div class="row between"><b>${esc(st.body)}</b><span>${ctPill(ST[st.status] || ST.en_curso)}${ed(st)}</span></div>
          <div class="sm muted">${st.owner_id ? 'Responsable: ' + esc(own(st.owner_id)) : 'Sin responsable'}</div>
          ${kids(st.id, 'medida').map(md => `<div style="border-top:1px dashed #E2E8F0;margin-top:6px;padding-top:4px"><div class="row between"><span class="sm">📏 ${esc(md.body)}</span>${ed(md)}</div>${metric(md)}</div>`).join('')}
          ${btn('medida', st.id, '+ Medida')}</div>`).join('') || '<p class="muted sm">Sin estrategias.</p>'}${btn('estrategia', o.id, '+ Estrategia')}</div></div></div>`).join('') || `<div class="card"><p class="muted">Todavía no hay objetivos para ${CT.oy}${OP ? ' en ' + esc(ctProjName(OP)) : ' de toda la empresa'}.${edit ? ' Empezá con "+ Objetivo" (ej.: "Cumplir el SLA del Renglón 3 sin multas").' : ''}</p></div>`}`;
  const again = () => ctOgsm(v, tabs);
  $('#og-p').onchange = e => { CT.op = e.target.value; again(); };
  $('#og-prev').onclick = () => { CT.oy--; again(); }; $('#og-next').onclick = () => { CT.oy++; again(); };
  v.querySelectorAll('[data-oadd]').forEach(b => b.onclick = () => ctOgsmModal({ kind: b.dataset.oadd, parent_id: b.dataset.op || null, year: CT.oy, project_id: OP }, again));
  v.querySelectorAll('[data-oed]').forEach(b => b.onclick = () => ctOgsmModal(items.find(x => x.id === b.dataset.oed), again));
}
function ctOgsmModal(it, after){
  const isNew = !it.id, K = { objetivo: 'Objetivo', meta: 'Meta', estrategia: 'Estrategia', medida: 'Medida' };
  const hasM = ['meta', 'medida'].includes(it.kind), staff = (HHS.staff || []).filter(s => s.active);
  const m = modal(`<h2>${isNew ? '+ ' : ''}${K[it.kind]}</h2>
    <label>${{ objetivo: 'A dónde queremos llegar', meta: 'Meta (qué número queremos lograr)', estrategia: 'Cómo lo vamos a lograr', medida: 'Cómo medimos que la estrategia avanza' }[it.kind]}</label>
    <input id="og-b" maxlength="500" value="${esc(it.body || '')}">
    ${hasM ? `<div class="row"><div class="grow"><label>Indicador</label><select id="og-m">${Object.entries(CT_MET).map(([k, [t]]) => `<option value="${k}" ${(it.metric || 'a_tiempo') === k ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></div>
      <div><label>Meta</label><input id="og-t" type="number" step="0.1" value="${it.target ?? ''}" style="width:110px"></div><div><label>Valor a mano</label><input id="og-v" type="number" step="0.1" value="${it.manual_value ?? ''}" style="width:110px" title="Solo si el indicador es 'Otro'"></div></div>` : ''}
    ${it.kind === 'estrategia' ? `<div class="row"><div class="grow"><label>Responsable</label><select id="og-o"><option value="">—</option>${staff.map(s => `<option value="${esc(s.id)}" ${it.owner_id === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
      <div class="grow"><label>Estado</label><select id="og-s">${[['pendiente', 'Pendiente'], ['en_curso', 'En curso'], ['hecho', 'Hecho'], ['frenado', 'Frenado']].map(([k, t]) => `<option value="${k}" ${(it.status || 'en_curso') === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div></div>` : ''}
    <div class="err" id="og-e"></div><div class="row" style="justify-content:flex-end;gap:6px;margin-top:10px">${!isNew ? '<button class="btn danger" id="og-d">Borrar</button>' : ''}<button class="btn sec" id="og-x">Cancelar</button><button class="btn" id="og-ok">Guardar</button></div>`);
  $('#og-x').onclick = m.close;
  const num = id => { const x = $(id)?.value; return x === '' || x == null ? null : Number(x); };
  $('#og-ok').onclick = async () => { const d = { body: $('#og-b').value.trim() };
    if (!d.body) return ($('#og-e').textContent = 'Escribí el texto.');
    if (hasM){ d.metric = $('#og-m').value; d.target = num('#og-t'); d.manual_value = num('#og-v'); }
    if (it.kind === 'estrategia'){ d.owner_id = $('#og-o').value || null; d.status = $('#og-s').value; }
    const { error } = await (isNew ? sb.from('ogsm_items').insert({ ...d, org_id: me.org_id, kind: it.kind, parent_id: it.parent_id, year: it.year, project_id: it.project_id || null }) : sb.from('ogsm_items').update(d).eq('id', it.id));
    if (error) return ($('#og-e').textContent = errText(error)); m.close(); after(); };
  $('#og-d')?.addEventListener('click', async () => { if (!confirm('¿Borrar? También se borra lo que cuelga de este elemento.')) return; const { error } = await sb.from('ogsm_items').delete().eq('id', it.id); if (error) return toast(errText(error)); m.close(); after(); });
}
