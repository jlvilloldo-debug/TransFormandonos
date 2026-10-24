/* =====================================================================
   InspectApp · Transformándonos — v4.5
   Herramientas → Validación de horas y tareas
   · El técnico carga su tarea del día y pide horas extra o de viaje
     (también urgentes: arranca y se valida en el día).
   · El coordinador autoriza, rechaza y valida; avisa por WhatsApp
     (semiautomático: la app arma el mensaje y él toca Enviar).
   · Recordatorio de las 9:00 armado para cada técnico.
   · Grilla de guardias, feriados, recursos (propios, otros, contratistas).
   · Reporte para Recursos Humanos (Excel con formato) del 16 al 15.
   Usa las utilidades de index.html / proyectos.js / fibra.js.
   Este archivo solo declara funciones: no ejecuta nada al cargarse.
   ===================================================================== */

const HH_KIND = { tarea: 'Tarea', extra: 'Hora extra', viaje: 'Viaje fuera de horario' };
const HH_KIND_S = { tarea: 'Tarea', extra: 'Extra', viaje: 'Viaje' };
const HH_CAUSE = { corte: 'Corte de servicio / SLA', ventana: 'Ventana de mantenimiento', desplazamiento: 'Desplazamiento extenso', critico: 'Trabajo crítico no suspendible', otro: 'Otro' };
const HH_ST = { pendiente: ['Pendiente', 'p-pend'], autorizada: ['Autorizada', 'p-info'], rechazada: ['Rechazada', 'p-bad'], validada: ['Validada', 'p-ok'] };
const HH_CODES = {
  G:   { n: 'Guardia',     c: '#166534', bg: '#DCFCE7', x: 'FFDCFCE7' },
  F:   { n: 'Franco',      c: '#475569', bg: '#E2E8F0', x: 'FFE2E8F0' },
  VAC: { n: 'Vacaciones',  c: '#1D4ED8', bg: '#DBEAFE', x: 'FFDBEAFE' },
  LIC: { n: 'Licencia',    c: '#92400E', bg: '#FEF3C7', x: 'FFFEF3C7' },
  '-': { n: 'Sin guardia', c: '#94A3B8', bg: '#FFFFFF', x: 'FFFFFFFF' },
};
const HH_DT = { habil: 'Hábil', sabado: 'Sábado', domingo: 'Domingo', feriado: 'Feriado' };
const HH_SK = { tecnico: 'Técnico', recurso: 'Otro recurso', contratista: 'Contratista' };
const HH_MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const hhXDate = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const HH_WD = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const HH_COLS = 'id,staff_id,day,kind,title,start_t,end_t,hours,day_type,over_limit,cause,ticket,urgent,status,lat,lng,end_at,photo_path,reviewed_by_name,reviewed_at,review_note,created_by_name,created_at';
const HH_STAFF_COLS = 'id,user_id,name,grid_name,kind,company,phone,email,base,contract,liquidate,active,sort,notes';
const HH_DEF = { max_extra: 2, max_viaje: 3, work_start: '09:00', work_end: '18:00', deadline_dow: 1, deadline_time: '12:00', period_day: 16, rrhh_email: '', coord_phone: '', greeting: 'Buena jornada laboral', signature: '', night_start: '22:00', night_end: '06:00', sat_from: '13:00' };
const HHS = { cfg: null, staff: [], mine: null, hol: new Map(), day: null, tab: null };

/* ---------- utilidades ---------- */
const hhT = t => t ? String(t).slice(0, 5) : '';
const hhH = n => n == null ? '—' : (Math.round(Number(n) * 100) / 100).toLocaleString('es-AR', { maximumFractionDigits: 2 }) + ' h';
const hhDow = s => (dOf(s).getDay() + 6) % 7;               // 0 = lunes
const hhWeekStart = s => addDays(s, -hhDow(s));
const hhDayType = s => HHS.hol.has(s) ? 'feriado' : hhDow(s) === 5 ? 'sabado' : hhDow(s) === 6 ? 'domingo' : 'habil';
const hhIsOff = s => hhDayType(s) !== 'habil';
const hhMin = t => { const [h, m] = String(t || '0:0').split(':').map(Number); return h * 60 + (m || 0); };
function hhCalc(start, end){ if (!start || !end) return null; let m = hhMin(end) - hhMin(start); if (m <= 0) m += 1440; return Math.round(m / 60 * 100) / 100; }
function hhDeadline(day){ // lunes siguiente 12:00 (hora del teléfono = Argentina)
  const c = HHS.cfg; const d = dOf(addDays(hhWeekStart(day), 7 + (Number(c.deadline_dow) - 1)));
  const [h, m] = hhT(c.deadline_time || '12:00').split(':').map(Number); d.setHours(h, m || 0, 0, 0); return d;
}
function hhPeriod(year, month){ // mes 1..12 → del día P del mes anterior al P-1 del mes
  const P = Number(HHS.cfg.period_day || 16);
  if (P === 1) return { from: dStr(new Date(year, month - 1, 1)), to: dStr(new Date(year, month, 0)) };
  return { from: dStr(new Date(year, month - 2, P)), to: dStr(new Date(year, month - 1, P - 1)) };
}
function hhCurPeriod(){ const t = new Date(), P = Number(HHS.cfg.period_day || 16); let y = t.getFullYear(), m = t.getMonth() + 1; if (P > 1 && t.getDate() >= P){ m++; if (m > 12){ m = 1; y++; } } return { y, m }; }
/* Recargo de horas extra (como liquida la ticketera):
   100% domingo, feriado, sábado desde las 13:00 y cualquier día de 22:00 a 06:00; 50% el resto.
   Si cruza la medianoche, lo que pasa de las 24 h cuenta según el día siguiente. Horarios en Ajustes. */
function hh100(d, mm){
  const c = HHS.cfg || HH_DEF, dt = hhDayType(d), ns = hhMin(c.night_start || '22:00'), ne = hhMin(c.night_end || '06:00');
  const night = ns > ne ? (mm >= ns || mm < ne) : (mm >= ns && mm < ne);
  return dt === 'domingo' || dt === 'feriado' || (dt === 'sabado' && mm >= hhMin(c.sat_from || '13:00')) || night;
}
function hhSplitRange(day, start, end){
  let a = hhMin(start), b = hhMin(end); if (b <= a) b += 1440;
  let m50 = 0, m100 = 0;
  for (let t = a; t < b; t++){ const d = t >= 1440 ? addDays(day, 1) : day; if (hh100(d, t % 1440)) m100++; else m50++; }
  return { h50: Math.round(m50 / 60 * 100) / 100, h100: Math.round(m100 / 60 * 100) / 100, m50, m100 };
}
function hhSplit(it){
  if (it.kind !== 'extra' || !it.start_t || !it.end_t) return { h50: 0, h100: 0 };
  return hhSplitRange(it.day, it.start_t, it.end_t);
}
const hhDays = (from, to) => { const out = []; for (let d = from; d <= to && out.length < 400; d = addDays(d, 1)) out.push(d); return out; };
const hhFirst = n => { const w = String(n || '').trim().split(/[\s,]+/)[0] || ''; return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); };
const hhPretty = n => String(n || '').toLowerCase().replace(/(^|\s|-)\S/g, x => x.toUpperCase());
function hhWa(phone, text){ const p = waPhone(phone); if (!p) return toast('Ese técnico no tiene WhatsApp cargado (Recursos).'); window.open(`https://wa.me/${p}?text=${encodeURIComponent(text)}`, '_blank', 'noopener'); }
const hhSig = () => HHS.cfg.signature || ('Coordinación ' + (org?.name || ''));
const hhStaffName = id => HHS.staff.find(s => s.id === id)?.name || '—';
const hhFmtDay = s => `${HH_WD[hhDow(s)]} ${fmtD(s)}`;
function hhCss(){
  if (document.getElementById('hh-css')) return;
  const st = document.createElement('style'); st.id = 'hh-css';
  st.textContent = `
.hh-tabs{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding:2px 0 10px}
.hh-tabs::-webkit-scrollbar{display:none}
.hh-tabs button{border:1px solid var(--line);background:#fff;border-radius:99px;padding:7px 14px;cursor:pointer;white-space:nowrap;color:var(--muted);font-weight:500}
.hh-tabs button.on{background:var(--navy);color:#fff;border-color:var(--navy)}
.hh-tabs .n{display:inline-block;margin-left:6px;font-size:11px;background:var(--red);color:#fff;border-radius:99px;padding:0 6px}
.hh-big{font-size:22px;font-weight:600;line-height:1.2}
.hh-it{border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin:8px 0;background:#fff}
.hh-it.urg{border-color:#F3C1CB;background:#FFF7F8}
.hh-it .t{font-weight:600}
.hh-week{display:flex;gap:6px;margin-top:6px}
.hh-week span{flex:1;text-align:center;border-radius:8px;padding:6px 0;font-size:12px;font-weight:600;border:1px solid var(--line);background:#fff;color:var(--muted)}
.hh-week span.ok{background:var(--ok-bg);color:var(--green-d);border-color:#BFE8D5}
.hh-week span.wa{background:var(--amber-bg);color:var(--amber);border-color:#F4DDA9}
.hh-week span.no{background:var(--red-bg);color:var(--red);border-color:#F3C1CB}
.hh-week span.today{outline:2px solid var(--navy-2)}
.hh-kseg{display:flex;border:1px solid var(--line);border-radius:10px;overflow:hidden;margin:6px 0 10px}
.hh-kseg button{flex:1;border:0;background:#fff;padding:10px 6px;cursor:pointer;color:var(--muted);font-weight:500}
.hh-kseg button.on{background:var(--navy);color:#fff}
.hh-grid{border-collapse:separate;border-spacing:0;font-size:12px}
.hh-grid th,.hh-grid td{border-bottom:1px solid var(--line);border-right:1px solid var(--line);padding:0;text-align:center;min-width:44px;height:30px}
.hh-grid th{position:sticky;top:0;background:#fff;z-index:2;font-weight:600;padding:6px 4px;font-size:11px;max-width:80px;white-space:normal;line-height:1.15}
.hh-grid td.d{position:sticky;left:0;background:#fff;z-index:1;text-align:left;padding:0 8px;white-space:nowrap;min-width:92px;font-weight:500}
.hh-grid tr.off td.d{background:#FFF8DB}
.hh-grid tr.off td{background:#FFFCEB}
.hh-grid td.c{cursor:pointer;font-weight:700}
.hh-grid td.c:hover{outline:2px solid var(--navy-2);outline-offset:-2px}
.hh-grid td.c i{display:block;font-style:normal;font-weight:400;font-size:9px;opacity:.8;line-height:1}
.hh-codes{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin:8px 0}
.hh-codes button{border:2px solid transparent;border-radius:10px;padding:10px 4px;cursor:pointer;font-weight:700}
.hh-codes button.on{border-color:var(--navy)}
.hh-rep{border:1px solid var(--line);border-radius:12px;overflow:hidden;background:#fff}
.hh-rep .hd{background:#0F2A4A;color:#fff;padding:16px 18px}
.hh-rep .hd h2{color:#fff;margin:0}
.hh-rep table{width:100%;border-collapse:collapse;font-size:13px}
.hh-rep th{background:#E7F7F0;color:#0F2A4A;text-align:center;padding:8px 6px;font-size:12px;border-bottom:2px solid #22B07D}
.hh-rep td{padding:8px 6px;border-bottom:1px solid var(--line);text-align:center}
.hh-rep td:first-child,.hh-rep th:first-child{text-align:left;padding-left:14px}
.hh-rep tr.tot td{font-weight:700;background:#F1F5F9}
.hh-bars{display:flex;align-items:flex-end;gap:6px;height:140px;margin-top:10px}
.hh-bars div{flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;font-size:10px;color:var(--muted);height:100%}
.hh-bars b{display:block;width:100%;max-width:34px;border-radius:6px 6px 0 0}
@media print{ .hh-noprint,.top,.tabs{display:none!important} .hh-rep{border:0} }
`;
  document.head.appendChild(st);
}

/* ---------- datos ---------- */
async function hhLoadBase(){
  const [cfg, staff, hol] = await Promise.all([
    cached('hh-cfg', () => sb.from('hh_settings').select('*').maybeSingle()),
    cached('hh-staff', () => sb.from('hh_staff').select(HH_STAFF_COLS).order('sort').order('name').limit(1000)),
    cached('hh-hol', () => sb.from('hh_holidays').select('day,name,kind').order('day').limit(2000)),
  ]);
  HHS.cfg = { ...HH_DEF, ...(cfg || {}) };
  HHS.staff = staff || [];
  HHS.mine = HHS.staff.find(s => s.user_id === me.id) || null;
  HHS.hol = new Map((hol || []).map(h => [h.day, h]));
}
const hhDrop = (...keys) => Promise.all(keys.map(k => IDB.del('kv', CUR_UID + ':' + k).catch(() => {})));
async function hhItems(q){ const { data, error } = await q; if (error) throw error; return data || []; }

/* cola sin señal (pedidos nuevos del técnico) */
async function hhQueue(row){ const k = CUR_UID + ':hhq'; const q = (await IDB.get('kv', k).catch(() => null)) || []; q.push(row); await IDB.put('kv', q, k); }
async function hhFlush(){
  if (!online() || !CUR_UID) return; const k = CUR_UID + ':hhq';
  const q = (await IDB.get('kv', k).catch(() => null)) || []; if (!q.length) return;
  const left = [];
  for (const row of q){ const { error } = await sb.from('hh_items').insert(row); if (error){ if (isNetErr(error)) left.push(row); else toast('Un pedido guardado sin señal no se pudo enviar: ' + errText(error)); } }
  await IDB.put('kv', left, k);
  if (left.length < q.length) toast(`${q.length - left.length} pedido(s) guardados sin señal ya se enviaron`);
}
window.addEventListener('online', () => setTimeout(() => { try { hhFlush(); } catch {} }, 2500));

/* ---------- mensajes de WhatsApp (los arma la app; el coordinador toca Enviar) ---------- */
function hhMsgAuth(st, it){
  const g = HHS.cfg.greeting || 'Buena jornada laboral';
  if (it.kind === 'tarea') return `${g}, ${hhFirst(st.name)}. Se validó la tarea "${it.title}" del ${fmtD(it.day)}${it.ticket ? ' (ticket ' + it.ticket + ')' : ''}. ${hhSig()}.`;
  return `${g}, ${hhFirst(st.name)}. Se validó la tarea "${it.title}"${it.ticket ? ' (ticket ' + it.ticket + ')' : ''} y se autoriza a realizar ${hhH(it.hours)} de ${it.kind === 'extra' ? 'hora extra' : 'viaje fuera de horario'} el ${hhFmtDay(it.day)} de ${hhT(it.start_t)} a ${hhT(it.end_t)}. ${hhSig()}.`;
}
function hhMsgReject(st, it, why){
  const g = HHS.cfg.greeting || 'Buena jornada laboral';
  return `${g}, ${hhFirst(st.name)}. No se autoriza ${it.kind === 'tarea' ? 'la tarea' : (it.kind === 'extra' ? 'la hora extra' : 'el viaje fuera de horario')} "${it.title}" del ${fmtD(it.day)}${why ? '. Motivo: ' + why : ''}. Consultá con coordinación. ${hhSig()}.`;
}
function hhMsgReminder(st, day, guard, items){
  const g = HHS.cfg.greeting || 'Buena jornada laboral';
  const tasks = items.filter(i => i.kind === 'tarea' && i.status !== 'rechazada');
  const hrs = items.filter(i => i.kind !== 'tarea' && ['autorizada', 'validada'].includes(i.status));
  const ex = hrs.filter(i => i.kind === 'extra').reduce((a, i) => a + Number(i.hours || 0), 0), vj = hrs.filter(i => i.kind === 'viaje').reduce((a, i) => a + Number(i.hours || 0), 0);
  const L = [`${g}, ${hhFirst(st.name)}. Hoy ${hhFmtDay(day)}:`];
  L.push(guard?.code === 'G' ? `• Estás de guardia${guard.note ? ' (' + guard.note + ')' : ''}.` : '• No estás de guardia.');
  L.push(tasks.length ? `• Tareas cargadas: ${tasks.map(t => t.title).join('; ')}.` : '• No tenés tareas cargadas para hoy.');
  L.push(hrs.length ? `• Horas autorizadas: ${ex ? hhH(ex) + ' extra' : ''}${ex && vj ? ' y ' : ''}${vj ? hhH(vj) + ' de viaje' : ''} (${hrs.map(i => hhT(i.start_t) + ' a ' + hhT(i.end_t)).join(', ')}).` : '• No tenés horas extra autorizadas para hoy.');
  L.push('Si te surge un ticket con SLA corto, pedí la hora extra desde la app.'); L.push(hhSig() + '.');
  return L.join('\n');
}
function hhMsgRequest(st, it){
  return `Pedido de ${HH_KIND[it.kind].toLowerCase()}${it.urgent ? ' URGENTE (ya arranqué por SLA)' : ''}: ${st.name} · ${hhFmtDay(it.day)}${it.kind !== 'tarea' ? ' de ' + hhT(it.start_t) + ' a ' + hhT(it.end_t) + ' (' + hhH(hhCalc(it.start_t, it.end_t)) + ')' : ''} · "${it.title}"${it.ticket ? ' · ticket ' + it.ticket : ''}${it.cause ? ' · ' + HH_CAUSE[it.cause] : ''}. Validalo en InspectApp → Herramientas → Validación de horas y tareas.`;
}
async function hhMarkSent(st, day, kind, itemId){ try { await sb.from('hh_sent').insert({ staff_id: st.id, day, kind, item_id: itemId || null, by_name: me.full_name || me.email }); } catch {} }

/* =====================================================================
   VISTA PRINCIPAL
   ===================================================================== */
async function viewHH(v){
  hhCss(); hhQuickCss(); await hhLoadBase(); hhFlush();
  const sub = (location.hash.split('/')[3] || '').replace(/[^a-z]/g, '');
  const mgr = isManager();
  const tabs = [];
  if (HHS.mine) tabs.push(['hoy', 'Mi día']);
  if (mgr) tabs.push(['bandeja', 'Bandeja']);
  tabs.push(['guardias', 'Guardias']);
  if (mgr) tabs.push(['recursos', 'Recursos']);
  if (mgr && can('rrhh')) tabs.push(['reporte', 'Reporte RRHH']);
  if (mgr) tabs.push(['ajustes', 'Ajustes']);
  const tab = tabs.some(t => t[0] === sub) ? sub : tabs[0][0];
  HHS.tab = tab;
  v.innerHTML = `<div class="hh-noprint"><div class="row between" style="margin-bottom:8px"><button class="btn sec small" id="hh-back">← Herramientas</button></div>
    <div class="card" style="background:#0F2A4A;color:#fff;border:0;padding:14px 16px"><div class="row" style="gap:12px;flex-wrap:nowrap"><div style="font-size:30px;line-height:1">⏱️</div><div><h2 style="margin:0;color:#fff">Validación de horas y tareas</h2><div class="sm" style="opacity:.85">Tareas del día, horas extra y de viaje, guardias y reporte para Recursos Humanos.</div></div></div></div>
    <div class="hh-tabs">${tabs.map(([k, n]) => `<button data-hht="${k}" class="${k === tab ? 'on' : ''}">${n}${k === 'bandeja' ? '<span class="n hidden" id="hh-badge"></span>' : ''}</button>`).join('')}</div></div>
    <div id="hh-body"><div class="card muted">Cargando…</div></div>`;
  $('#hh-back').onclick = () => { location.hash = '#/tools'; };
  v.querySelectorAll('[data-hht]').forEach(b => b.onclick = () => { history.replaceState(null, '', '#/tools/hh/' + b.dataset.hht); viewHH(v); });
  const body = $('#hh-body');
  if (!HHS.mine && !mgr && tab === 'guardias'){ body.innerHTML = `<div class="card"><b>Tu usuario todavía no está vinculado a un técnico.</b><p class="muted">Pedile al coordinador que te vincule en Validación de horas → Recursos.</p></div>`; return; }
  if (tab === 'hoy') await hhViewToday(body);
  else if (tab === 'bandeja') await hhViewInbox(body);
  else if (tab === 'guardias') await hhViewGuards(body);
  else if (tab === 'recursos') await hhViewStaff(body);
  else if (tab === 'reporte') await hhViewReport(body);
  else if (tab === 'ajustes') await hhViewSettings(body);
  if (mgr) hhBadge();
}
async function hhOverdue(){
  if (!online()) return [];
  const { data } = await sb.from('hh_items').select(HH_COLS).lt('day', todayStr()).in('status', ['pendiente', 'autorizada']).order('day').limit(300);
  return data || [];
}
async function hhBadge(){ try { const n = (await hhOverdue()).length; const b = $('#hh-badge'); if (b){ b.textContent = n; b.classList.toggle('hidden', !n); } } catch {} }

/* Tarjeta en Herramientas y aviso en Inicio */
async function hhToolCount(box){
  if (!box || !online()) return;
  try {
    if (isManager()){ const n = (await hhOverdue()).length; const { count } = await sb.from('hh_items').select('id', { count: 'exact', head: true }).eq('day', todayStr()).eq('status', 'pendiente');
      box.innerHTML = (n ? `<span class="pill p-bad">${n} sin validar de días anteriores</span> ` : '') + (count ? `<span class="pill p-pend">${count} pendiente(s) hoy</span>` : (n ? '' : '<span class="pill p-ok">Todo validado</span>')); }
  } catch {}
}
async function hhHomeAlert(box){
  if (!box || !isManager() || !online()) return;
  try { const od = await hhOverdue(); if (!od.length) return;
    const el = document.createElement('div'); el.className = 'banner off'; el.style.cursor = 'pointer';
    el.innerHTML = `<span class="dot"></span><div><b>${od.length} tarea(s) u hora(s) sin validar de días anteriores</b><div class="sm">La validación tiene que ser en el día. Tocá para ir a la bandeja.</div></div>`;
    el.onclick = () => { location.hash = '#/tools/hh/bandeja'; }; box.prepend(el);
  } catch {}
}

/* =====================================================================
   MI DÍA (técnico)
   ===================================================================== */
async function hhViewToday(body){
  const st = HHS.mine, today = todayStr(), ws = hhWeekStart(today);
  const [items, guard] = await Promise.all([
    cached('hh-mine', () => sb.from('hh_items').select(HH_COLS).eq('staff_id', st.id).gte('day', addDays(ws, -7)).order('day', { ascending: false }).order('start_t').limit(400)),
    cached('hh-myguard', () => sb.from('hh_guard').select('day,code,note').eq('staff_id', st.id).gte('day', addDays(today, -1)).lte('day', addDays(today, 7))),
  ]);
  const q = (await IDB.get('kv', CUR_UID + ':hhq').catch(() => null)) || [];
  const tod = items.filter(i => i.day === today).concat(q.filter(r => r.day === today).map(r => ({ ...r, status: 'pendiente', _local: true, hours: hhCalc(r.start_t, r.end_t) })));
  const g = guard.find(x => x.day === today);
  const auth = k => tod.filter(i => i.kind === k && ['autorizada', 'validada'].includes(i.status)).reduce((a, i) => a + Number(i.hours || 0), 0);
  const dl = hhDeadline(today), left = dl - Date.now();
  const wk = Array.from({ length: 7 }, (_, k) => { const d = addDays(ws, k); const its = items.filter(i => i.day === d);
    const cls = !its.length ? '' : its.some(i => i.status === 'rechazada') ? 'no' : its.every(i => i.status === 'validada') ? 'ok' : 'wa';
    return `<span class="${cls} ${d === today ? 'today' : ''}" title="${esc(hhFmtDay(d))}">${HH_WD[k][0]}<div style="font-weight:400;font-size:10px">${dOf(d).getDate()}</div></span>`; }).join('');
  body.innerHTML = `
    <div class="card"><div class="row between"><div><h2 style="margin:0">Hola, ${esc(hhFirst(st.name) || '')}</h2><div class="muted sm">${esc(hhFmtDay(today))} · ${HH_DT[hhDayType(today)]}${HHS.hol.get(today) ? ' · ' + esc(HHS.hol.get(today).name || '') : ''}</div></div>
      ${g ? `<span class="pill" style="background:${HH_CODES[g.code].bg};color:${HH_CODES[g.code].c}">${HH_CODES[g.code].n}${g.note ? ' · ' + esc(g.note) : ''}</span>` : '<span class="pill p-info">Sin dato de guardia</span>'}</div>
      <div class="stats" style="margin-top:12px">
        <div class="stat"><span>Tareas de hoy</span><b>${tod.filter(i => i.kind === 'tarea').length}</b></div>
        <div class="stat"><span>Extra autorizada hoy</span><b>${hhH(auth('extra'))}</b><small>tope ${hhH(HHS.cfg.max_extra)}</small></div>
        <div class="stat"><span>Viaje autorizado hoy</span><b>${hhH(auth('viaje'))}</b><small>tope ${hhH(HHS.cfg.max_viaje)}</small></div>
      </div>
      ${canWrite() ? `<div class="row" style="margin-top:12px"><button class="btn grow" id="hh-req">+ Pedir horas</button><button class="btn sec grow" id="hh-task">+ Cargar tarea</button></div>${hhChips()}` : ''}
      ${hhTimeline(tod, today)}
    </div>
    <div class="card"><h2 style="margin:0 0 4px">Hoy</h2>${tod.length ? tod.map(i => hhItemHTML(i, { own: true })).join('') : '<p class="muted">Todavía no hay nada cargado para hoy.</p>'}</div>
    <div class="card"><div class="row between"><h2 style="margin:0">Mi semana</h2><span class="sm ${left < 86400000 ? '' : 'muted'}" style="${left < 86400000 ? 'color:var(--red);font-weight:600' : ''}">${left > 0 ? 'Cierra ' + HH_WD[(dl.getDay() + 6) % 7].toLowerCase() + ' ' + dl.getDate() + ' a las ' + hhT(HHS.cfg.deadline_time) + ' · faltan ' + Math.floor(left / 86400000) + ' d ' + Math.floor(left % 86400000 / 3600000) + ' h' : 'Semana cerrada'}</span></div>
      <div class="hh-week">${wk}</div>
      <p class="muted sm" style="margin:8px 0 0">Verde: validado · amarillo: falta validar · rojo: rechazado. Pasado el cierre, solo el coordinador puede destrabar la semana.</p></div>
    <div class="card"><h2 style="margin:0 0 4px">Anteriores</h2>${items.filter(i => i.day < today).slice(0, 30).map(i => hhItemHTML(i, { own: true, showDay: true })).join('') || '<p class="muted">Sin registros.</p>'}</div>`;
  $('#hh-req')?.addEventListener('click', () => hhItemModal({ staff: st, kind: 'extra' }));
  $('#hh-task')?.addEventListener('click', () => hhItemModal({ staff: st, kind: 'tarea' }));
  hhBindChips(body, st);
  hhBindItems(body, items.concat(tod.filter(i => i._local)));
}

function hhItemHTML(i, o = {}){
  const [stN, stC] = HH_ST[i.status] || ['', ''];
  const late = i.day < todayStr() && ['pendiente', 'autorizada'].includes(i.status);
  return `<div class="hh-it ${i.urgent && i.status !== 'validada' ? 'urg' : ''}" data-hhi="${esc(i.id)}">
    <div class="row between" style="gap:6px;flex-wrap:nowrap"><div style="min-width:0">
      ${o.check ? `<input type="checkbox" data-hhc="${esc(i.id)}" style="width:auto;margin-right:6px">` : ''}<span class="t">${esc(HH_KIND_S[i.kind])}${i.kind !== 'tarea' ? ' · ' + hhT(i.start_t) + ' a ' + hhT(i.end_t) + ' · ' + hhH(i.hours) : ''}</span>
      ${o.showDay ? `<span class="muted sm"> · ${esc(hhFmtDay(i.day))}</span>` : ''}${o.who ? `<span class="muted sm"> · ${esc(hhStaffName(i.staff_id))}</span>` : ''}</div>
      <span class="pill ${i._local ? 'p-pend' : stC}">${i._local ? 'Por enviar' : stN}</span></div>
    <div style="margin-top:4px">${esc(i.title)}</div>
    <div class="muted sm">${[i.cause ? HH_CAUSE[i.cause] : '', i.ticket ? 'Ticket ' + i.ticket : '', i.day_type && i.day_type !== 'habil' ? HH_DT[i.day_type] : '', i.urgent ? '⚡ arrancó por SLA' : '', i.over_limit ? '⚠ supera el tope' : '', i.end_at ? '✓ terminó ' + fmtTime(i.end_at) : '', i.photo_path ? '📷 evidencia' : '', i.reviewed_by_name && i.status !== 'pendiente' ? (i.status === 'rechazada' ? 'Rechazó ' : i.status === 'validada' ? 'Validó ' : 'Autorizó ') + i.reviewed_by_name : '', i.review_note ? '“' + i.review_note + '”' : ''].filter(Boolean).map(esc).join(' · ')}</div>
    ${late ? '<div class="sm" style="color:var(--red);font-weight:600;margin-top:2px">⏰ Sin validar: tenía que validarse en el día</div>' : ''}
    <div class="row" style="gap:6px;margin-top:6px">${o.actions ? o.actions(i) : hhOwnActions(i)}</div></div>`;
}
function hhOwnActions(i){
  if (i._local || !canWrite()) return '';
  const a = [];
  if (i.kind !== 'tarea' && ['autorizada', 'pendiente'].includes(i.status) && !i.end_at) a.push(`<button class="btn small" data-hha="fin">✓ Terminé</button>`);
  if (i.status === 'pendiente'){ a.push(`<button class="btn sec small" data-hha="edit">Editar</button>`); a.push(`<button class="btn sec small" data-hha="del">Borrar</button>`); }
  if (i.status === 'pendiente' && HHS.cfg.coord_phone) a.push(`<button class="btn sec small" data-hha="avisar">💬 Avisar al coordinador</button>`);
  if (i.photo_path) a.push(`<button class="btn sec small" data-hha="foto">Ver foto</button>`);
  return a.join('');
}
function hhBindItems(box, items, after){
  box.querySelectorAll('[data-hhi] [data-hha]').forEach(b => b.onclick = async ev => {
    ev.stopPropagation();
    const id = b.closest('[data-hhi]').dataset.hhi, it = items.find(x => x.id === id); if (!it) return;
    const st = HHS.staff.find(s => s.id === it.staff_id) || HHS.mine;
    const act = b.dataset.hha, reload = after || (() => viewHH($('#view')));
    if (act === 'edit') return hhItemModal({ staff: st, item: it, kind: it.kind, after: reload });
    if (act === 'del'){ if (!needOnline() || !confirm('¿Borrar este registro?')) return; const { error } = await sb.from('hh_items').delete().eq('id', id); if (error) return toast(errText(error)); await hhDrop('hh-mine', 'hh-today'); toast('Borrado'); return reload(); }
    if (act === 'avisar') return hhWa(HHS.cfg.coord_phone, hhMsgRequest(st, it));
    if (act === 'foto'){ const { data } = await sb.storage.from('fotos').createSignedUrl(it.photo_path, 600); if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener'); return; }
    if (act === 'fin') return hhFinish(it, reload);
    if (act === 'wa'){ const kind = it.status === 'rechazada' ? 'rechazo' : 'autorizacion'; hhWa(st.phone, it.status === 'rechazada' ? hhMsgReject(st, it, it.review_note) : hhMsgAuth(st, it)); hhMarkSent(st, it.day, kind, it.id); return; }
    if (['autorizar', 'validar', 'rechazar', 'reabrir'].includes(act)) return hhReview([it], act, reload);
  });
}

/* Terminé: check-out con GPS y foto de evidencia opcional */
function hhFinish(it, after){
  if (!needOnline()) return;
  const m = modal(`<h2>Terminé</h2><p class="muted sm">${esc(HH_KIND[it.kind])} · ${hhT(it.start_t)} a ${hhT(it.end_t)} · ${esc(it.title)}</p>
    <label>Hora real de fin</label><input id="hf-e" type="time" value="${hhT(it.end_t)}">
    <label>Foto de evidencia (opcional: fusión, traza OTDR, ticket cerrado…)</label><input id="hf-p" type="file" accept="image/*" capture="environment">
    <div class="sm muted" id="hf-s">Se registra tu ubicación al confirmar.</div><div class="err" id="hf-err"></div>
    <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn sec" id="hf-x">Cancelar</button><button class="btn" id="hf-ok">Confirmar</button></div>`);
  $('#hf-x').onclick = m.close;
  $('#hf-ok').onclick = async () => {
    $('#hf-ok').disabled = true; $('#hf-s').textContent = 'Tomando ubicación…';
    const pos = await getPos(); const patch = { end_at: new Date().toISOString(), end_lat: pos?.lat ?? null, end_lng: pos?.lng ?? null };
    const e = $('#hf-e').value; if (e && e !== hhT(it.end_t)) patch.end_t = e;
    const f = $('#hf-p').files[0];
    if (f){ try { const blob = await compressImage(f, 1600, 0.8); const p = `${me.org_id}/hh/${it.id}/${uid()}.jpg`; const { error } = await sb.storage.from('fotos').upload(p, blob, { contentType: 'image/jpeg', upsert: false }); if (error) throw error; patch.photo_path = p; } catch (x){ $('#hf-ok').disabled = false; return ($('#hf-err').textContent = 'Foto: ' + errText(x)); } }
    const { error } = await sb.from('hh_items').update(patch).eq('id', it.id);
    if (error){ $('#hf-ok').disabled = false; return ($('#hf-err').textContent = errText(error)); }
    m.close(); await hhDrop('hh-mine', 'hh-today'); toast(patch.end_t ? 'Registrado. Cambió el horario: vuelve a quedar para validar.' : 'Registrado'); after && after();
  };
}

/* =====================================================================
   ALTA / EDICIÓN DE TAREA U HORAS
   ===================================================================== */
async function hhItemModal({ staff, item, kind = 'extra', after, day, preset }){
  const mgr = isManager(), it = item || {}, today = todayStr(), pr = preset || {};
  let k = it.kind || kind;
  const staffOpts = mgr ? HHS.staff.filter(s => s.active).map(s => `<option value="${esc(s.id)}" ${s.id === (it.staff_id || staff?.id) ? 'selected' : ''}>${esc(s.name)}${s.kind !== 'tecnico' ? ' · ' + HH_SK[s.kind] : ''}</option>`).join('') : '';
  const m = modal(`<h2>${item ? 'Editar' : k === 'tarea' ? 'Cargar tarea' : 'Pedir horas'}</h2>
    ${mgr ? `<label>Técnico / recurso</label><select id="hm-s">${staffOpts}</select>` : `<p class="muted sm" style="margin:-4px 0 6px">${esc(staff.name)}</p>`}
    <div class="hh-kseg">${['extra', 'viaje', 'tarea'].map(x => `<button type="button" data-k="${x}" class="${x === k ? 'on' : ''}">${HH_KIND[x]}</button>`).join('')}</div>
    <label>Fecha</label><input id="hm-d" type="date" value="${esc(it.day || day || today)}">
    <div id="hm-hours"><div class="row"><div class="grow"><label>Desde</label><input id="hm-a" type="time" value="${esc(hhT(it.start_t) || pr.start || hhT(HHS.cfg.work_end) || '18:00')}"></div><div class="grow"><label>Hasta</label><input id="hm-b" type="time" value="${esc(hhT(it.end_t) || pr.end || '20:00')}"></div></div>
      <div class="card" style="background:var(--bg);text-align:center;margin:10px 0;padding:10px"><div class="hh-big" id="hm-t">—</div><div class="sm muted" id="hm-tt"></div></div>
      <div id="hm-w"></div>
      <label>Causal</label><select id="hm-c"><option value="">— Elegí —</option>${Object.entries(HH_CAUSE).map(([kk, n]) => `<option value="${kk}" ${it.cause === kk ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
    <label id="hm-tl">¿Qué tarea?</label><input id="hm-n" maxlength="300" value="${esc(it.title || '')}" placeholder="Ej.: Corte en Traza 15, empalme 8 · San Javier">
    <label>N° de ticket u OT</label><input id="hm-k" maxlength="60" value="${esc(it.ticket || '')}" placeholder="INC-48213">
    ${!mgr && !item ? `<label style="display:flex;gap:8px;align-items:center;font-weight:400;margin-top:10px" id="hm-ul"><input type="checkbox" id="hm-u" style="width:auto" ${pr.urgent ? 'checked' : ''}> ⚡ Arranco ya: ticket con SLA corto (se valida en el día)</label>` : ''}
    <p class="muted sm" id="hm-info"></p>
    <div class="err" id="hm-err"></div>
    <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn sec" id="hm-x">Cancelar</button><button class="btn" id="hm-ok">${item ? 'Guardar' : mgr ? 'Cargar autorizado' : 'Enviar pedido'}</button></div>`);
  const curStaff = () => mgr ? HHS.staff.find(s => s.id === $('#hm-s').value) : staff;
  let dayItems = [];
  const loadDay = async () => { dayItems = []; const s = curStaff(); if (!s || !online()) return draw();
    try { const { data } = await sb.from('hh_items').select('id,kind,hours,status').eq('staff_id', s.id).eq('day', $('#hm-d').value); dayItems = data || []; } catch {} draw(); };
  const draw = () => {
    const d = $('#hm-d').value, dt = hhDayType(d);
    m.el.querySelectorAll('[data-k]').forEach(b => b.classList.toggle('on', b.dataset.k === k));
    $('#hm-hours').classList.toggle('hidden', k === 'tarea'); $('#hm-ul')?.classList.toggle('hidden', k === 'tarea');
    $('#hm-tl').textContent = k === 'tarea' ? '¿Qué tarea vas a hacer o hiciste?' : '¿Para qué tarea?';
    const w = [];
    if (k !== 'tarea'){
      const h = hhCalc($('#hm-a').value, $('#hm-b').value); $('#hm-t').textContent = h == null ? '—' : hhH(h);
      $('#hm-tt').textContent = `${HH_DT[dt]}${HHS.hol.get(d) ? ' · ' + (HHS.hol.get(d).name || 'feriado') : ''}${(() => { if (k !== 'extra' || h == null) return ''; const x = hhSplit({ kind: 'extra', day: d, start_t: $('#hm-a').value, end_t: $('#hm-b').value }); return x.h100 ? ' · ' + (x.h50 ? hhH(x.h50) + ' al 50% y ' : '') + hhH(x.h100) + ' al 100%' : ' · al 50%'; })()}`;
      const mx = Number(k === 'extra' ? HHS.cfg.max_extra : HHS.cfg.max_viaje);
      const prev = dayItems.filter(x => x.kind === k && x.status !== 'rechazada' && x.id !== it.id).reduce((a, x) => a + Number(x.hours || 0), 0);
      if (h != null && prev + h > mx) w.push(`<div class="banner off" style="margin:6px 0"><span class="dot"></span><div><b>Supera el tope de ${hhH(mx)} por día${prev ? ' (ya tiene ' + hhH(prev) + ')' : ''}.</b><div class="sm">Solo con causal "Corte de servicio / SLA" y número de ticket.</div></div></div>`);
      if (dt === 'habil' && h != null){ const a = hhMin($('#hm-a').value), b = hhMin($('#hm-b').value), ws = hhMin(HHS.cfg.work_start), we = hhMin(HHS.cfg.work_end);
        if ((b > a && a < we && b > ws) || (b <= a && a < we)) w.push(`<div class="banner warn" style="margin:6px 0"><span class="dot"></span><div><b>En día hábil va fuera del horario laboral (${hhT(HHS.cfg.work_start)} a ${hhT(HHS.cfg.work_end)}).</b></div></div>`); }
    }
    $('#hm-w') && ($('#hm-w').innerHTML = w.join(''));
    const open = mgr || new Date() <= hhDeadline(d);
    $('#hm-info').textContent = !open ? 'Esa semana ya cerró: necesitás que el coordinador la destrabe.' : !mgr && k !== 'tarea' ? 'Queda pendiente hasta que el coordinador lo autorice. Se registra tu ubicación.' : '';
  };
  m.el.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { k = b.dataset.k; draw(); });
  ['#hm-a', '#hm-b'].forEach(s => $(s).oninput = draw);
  $('#hm-d').onchange = loadDay; $('#hm-s') && ($('#hm-s').onchange = loadDay);
  $('#hm-x').onclick = m.close;
  loadDay();
  $('#hm-ok').onclick = async () => {
    $('#hm-err').textContent = '';
    const s = curStaff(); if (!s) return ($('#hm-err').textContent = 'Elegí el técnico.');
    const row = { staff_id: s.id, day: $('#hm-d').value, kind: k, title: $('#hm-n').value.trim(), ticket: $('#hm-k').value.trim() || null };
    if (!row.day) return ($('#hm-err').textContent = 'Elegí la fecha.');
    if (!row.title) return ($('#hm-err').textContent = 'Escribí la tarea.');
    if (k !== 'tarea'){
      Object.assign(row, { start_t: $('#hm-a').value, end_t: $('#hm-b').value, cause: $('#hm-c').value || null });
      if (!row.start_t || !row.end_t) return ($('#hm-err').textContent = 'Indicá desde y hasta.');
      if (!row.cause) return ($('#hm-err').textContent = 'Elegí la causal.');
    } else Object.assign(row, { start_t: null, end_t: null, cause: null });
    if (!item){ row.id = uid(); row.urgent = !!$('#hm-u')?.checked && k !== 'tarea'; }
    $('#hm-ok').disabled = true;
    if (!item && !mgr){ const p = await getPos(); if (p) Object.assign(row, { lat: p.lat, lng: p.lng, acc: p.acc }); }
    if (!online()){
      if (item || mgr){ $('#hm-ok').disabled = false; return ($('#hm-err').textContent = 'Necesitás señal para esto.'); }
      await hhQueue(row); m.close(); toast('Guardado en el teléfono: se envía cuando vuelva la señal.'); return (after || (() => viewHH($('#view'))))();
    }
    const { error } = item ? await sb.from('hh_items').update(row).eq('id', item.id) : await sb.from('hh_items').insert(row);
    $('#hm-ok').disabled = false;
    if (error) return ($('#hm-err').textContent = errText(error));
    await hhDrop('hh-mine', 'hh-today');
    m.close();
    const done = after || (() => viewHH($('#view')));
    if (!item && !mgr && HHS.cfg.coord_phone){
      const m2 = modal(`<h2>Pedido enviado</h2><p>Queda <b>pendiente</b> hasta que el coordinador lo autorice.</p>${row.urgent ? '<p class="sm" style="color:var(--red)">Arrancaste por SLA: el coordinador tiene que validarlo hoy.</p>' : ''}
        <div class="row" style="justify-content:flex-end"><button class="btn sec" id="m2x">Listo</button><button class="btn" id="m2w">💬 Avisar al coordinador</button></div>`);
      $('#m2x').onclick = () => { m2.close(); done(); }; $('#m2w').onclick = () => { hhWa(HHS.cfg.coord_phone, hhMsgRequest(s, row)); m2.close(); done(); };
    } else if (!item && mgr && s.phone){
      const m2 = modal(`<h2>Cargado y autorizado</h2><p>¿Avisarle a ${esc(hhFirst(s.name))} por WhatsApp?</p><div class="row" style="justify-content:flex-end"><button class="btn sec" id="m2x">No</button><button class="btn" id="m2w">💬 Avisar</button></div>`);
      $('#m2x').onclick = () => { m2.close(); done(); }; $('#m2w').onclick = () => { hhWa(s.phone, hhMsgAuth(s, { ...row, hours: hhCalc(row.start_t, row.end_t) })); hhMarkSent(s, row.day, 'autorizacion', row.id); m2.close(); done(); };
    } else { toast(item ? 'Guardado' : 'Enviado'); done(); }
  };
}

/* =====================================================================
   BANDEJA DEL COORDINADOR
   ===================================================================== */
async function hhReview(items, act, after){
  if (!needOnline()) return;
  let note = null;
  if (act === 'rechazar'){ note = prompt('Motivo del rechazo (se le envía al técnico):', ''); if (note === null) return; }
  if (act === 'reabrir' && !confirm('¿Volver a dejarlo pendiente?')) return;
  const { error } = await sb.rpc('hh_review', { p_ids: items.map(i => i.id), p_action: act, p_note: note });
  if (error) return toast(errText(error));
  const done = after || (() => viewHH($('#view')));
  if (items.length === 1 && act !== 'reabrir'){
    const it = { ...items[0], status: act === 'rechazar' ? 'rechazada' : act === 'validar' ? 'validada' : 'autorizada', review_note: note };
    const st = HHS.staff.find(s => s.id === it.staff_id);
    if (st?.phone){
      const m = modal(`<h2>${act === 'rechazar' ? 'Rechazado' : act === 'validar' ? 'Validado' : 'Autorizado'}</h2><p>¿Avisarle a ${esc(hhFirst(st.name))} por WhatsApp?</p>
        <div class="card" style="background:#E7F7F0;font-size:13px;white-space:pre-wrap">${esc(act === 'rechazar' ? hhMsgReject(st, it, note) : hhMsgAuth(st, it))}</div>
        <div class="row" style="justify-content:flex-end"><button class="btn sec" id="rvx">No</button><button class="btn" id="rvw">💬 Enviar por WhatsApp</button></div>`);
      $('#rvx').onclick = () => { m.close(); done(); };
      $('#rvw').onclick = () => { hhWa(st.phone, act === 'rechazar' ? hhMsgReject(st, it, note) : hhMsgAuth(st, it)); hhMarkSent(st, it.day, act === 'rechazar' ? 'rechazo' : 'autorizacion', it.id); m.close(); done(); };
      return;
    }
  }
  toast(`${items.length} actualizado(s)`); done();
}
const hhMgrActions = i => {
  if (!canWrite()) return '';
  const a = [];
  if (i.status === 'pendiente' && i.kind !== 'tarea') a.push(`<button class="btn small" data-hha="autorizar">Autorizar</button>`);
  if (['pendiente', 'autorizada'].includes(i.status)) a.push(`<button class="btn small" style="background:var(--green);border-color:var(--green)" data-hha="validar">Validar</button>`, `<button class="btn sec small" data-hha="rechazar">Rechazar</button>`);
  if (['validada', 'rechazada', 'autorizada'].includes(i.status)) a.push(`<button class="btn sec small" data-hha="wa">💬 WhatsApp</button>`);
  if (['validada', 'rechazada'].includes(i.status)) a.push(`<button class="btn sec small" data-hha="reabrir">Reabrir</button>`);
  a.push(`<button class="btn sec small" data-hha="edit">Editar</button>`);
  if (i.photo_path) a.push(`<button class="btn sec small" data-hha="foto">Ver foto</button>`);
  return a.join('');
};
async function hhViewInbox(body){
  if (!needOnline()){ body.innerHTML = '<div class="card">La bandeja necesita señal.</div>'; return; }
  const day = HHS.day || todayStr(); HHS.day = day;
  const [items, guards, sent, overdue] = await Promise.all([
    hhItems(sb.from('hh_items').select(HH_COLS).eq('day', day).order('created_at')),
    hhItems(sb.from('hh_guard').select('staff_id,code,note').eq('day', day)),
    hhItems(sb.from('hh_sent').select('staff_id,kind,item_id,at,by_name').eq('day', day)),
    hhOverdue(),
  ]);
  const gOf = id => guards.find(g => g.staff_id === id);
  const techs = HHS.staff.filter(s => s.active && s.kind === 'tecnico');
  const withItems = HHS.staff.filter(s => items.some(i => i.staff_id === s.id));
  const show = [...new Set([...withItems, ...techs])];
  const pend = items.filter(i => ['pendiente', 'autorizada'].includes(i.status));
  const nowAfter = day === todayStr() && hhMin(new Date().toTimeString().slice(0, 5)) >= hhMin(HHS.cfg.work_end);
  body.innerHTML = `
    ${overdue.length ? `<div class="banner off"><span class="dot"></span><div class="grow"><b>⏰ ${overdue.length} sin validar de días anteriores</b><div class="sm">La validación tiene que ser en el día.</div>
      ${overdue.slice(0, 50).map(i => hhItemHTML(i, { who: true, showDay: true, actions: hhMgrActions, check: true })).join('')}
      ${overdue.length > 1 ? '<button class="btn small" id="hh-vod" style="margin-top:6px">Validar los marcados</button>' : ''}</div></div>` : ''}
    <div class="card"><div class="row between"><div class="row" style="gap:6px"><button class="btn sec small" id="hh-prev">‹</button><input type="date" id="hh-day" value="${esc(day)}" style="width:auto"><button class="btn sec small" id="hh-next">›</button><button class="btn sec small" id="hh-today">Hoy</button></div>
      <div class="row" style="gap:6px">${canWrite() ? '<button class="btn small" id="hh-add">+ Cargar tarea u horas</button>' : ''}</div></div>
      <div class="muted sm" style="margin-top:6px">${esc(hhFmtDay(day))} · ${HH_DT[hhDayType(day)]}${HHS.hol.get(day) ? ' · ' + esc(HHS.hol.get(day).name || '') : ''} · ${items.length} registro(s) · ${pend.length} por validar</div>
      ${nowAfter && pend.length ? `<div class="banner off" style="margin:8px 0 0"><span class="dot"></span><div><b>Ya terminó el horario y quedan ${pend.length} sin validar hoy.</b></div></div>` : ''}
      ${pend.length > 1 && canWrite() ? '<button class="btn small" id="hh-vall" style="margin-top:8px;background:var(--green);border-color:var(--green)">Validar todo lo pendiente del día</button>' : ''}</div>
    <div class="card"><div class="row between"><h2 style="margin:0">Recordatorios de las 9:00</h2><span class="muted sm">${sent.filter(x => x.kind === 'recordatorio').length} de ${techs.filter(t => t.phone).length} enviados</span></div>
      <p class="muted sm" style="margin:4px 0 8px">Cada mensaje ya está armado: tocá 💬 y enviá desde WhatsApp.</p>
      ${techs.length ? techs.map(s => { const its = items.filter(i => i.staff_id === s.id), g = gOf(s.id), sn = sent.find(x => x.staff_id === s.id && x.kind === 'recordatorio');
        const tasks = its.filter(i => i.kind === 'tarea').length, hrs = its.filter(i => i.kind !== 'tarea' && ['autorizada', 'validada'].includes(i.status)).reduce((a, i) => a + Number(i.hours || 0), 0);
        return `<div class="row between" style="padding:6px 0;border-bottom:1px solid var(--line);flex-wrap:nowrap"><div style="min-width:0"><b>${esc(s.name)}</b><div class="sm muted">${g?.code === 'G' ? '🛡 de guardia · ' : ''}${tasks ? tasks + ' tarea(s)' : 'sin tarea'} · ${hrs ? hhH(hrs) + ' autorizadas' : 'sin horas autorizadas'}${sn ? ' · <span style="color:var(--green-d)">✓ enviado ' + esc(fmtTime(sn.at)) + '</span>' : ''}</div></div>
          ${s.phone ? `<button class="btn ${sn ? 'sec' : ''} small" data-rem="${esc(s.id)}">💬</button>` : '<span class="sm muted">sin WhatsApp</span>'}</div>`; }).join('') : '<p class="muted">Cargá los técnicos en Recursos.</p>'}</div>
    ${show.filter(s => items.some(i => i.staff_id === s.id)).map(s => { const g = gOf(s.id); return `<div class="card"><div class="row between"><h2 style="margin:0">${esc(s.name)}</h2>${g ? `<span class="pill" style="background:${HH_CODES[g.code].bg};color:${HH_CODES[g.code].c}">${HH_CODES[g.code].n}${g.note ? ' · ' + esc(g.note) : ''}</span>` : ''}</div>
      ${items.filter(i => i.staff_id === s.id).map(i => hhItemHTML(i, { actions: hhMgrActions, check: ['pendiente', 'autorizada'].includes(i.status) })).join('')}</div>`; }).join('') || '<div class="card muted">No hay tareas ni horas cargadas para este día.</div>'}`;
  const go = d => { HHS.day = d; hhViewInbox(body); };
  $('#hh-prev').onclick = () => go(addDays(day, -1)); $('#hh-next').onclick = () => go(addDays(day, 1)); $('#hh-today').onclick = () => go(todayStr()); $('#hh-day').onchange = e => e.target.value && go(e.target.value);
  $('#hh-add')?.addEventListener('click', () => hhItemModal({ staff: null, kind: 'tarea', day, after: () => hhViewInbox(body) }));
  const all = items.concat(overdue);
  hhBindItems(body, all, () => hhViewInbox(body));
  $('#hh-vall')?.addEventListener('click', () => confirm(`¿Validar ${pend.length} registro(s) del día?`) && hhReview(pend, 'validar', () => hhViewInbox(body)));
  $('#hh-vod')?.addEventListener('click', () => { const ids = [...body.querySelectorAll('.banner [data-hhc]:checked')].map(x => x.dataset.hhc); if (!ids.length) return toast('Marcá los que querés validar.'); hhReview(overdue.filter(i => ids.includes(i.id)), 'validar', () => hhViewInbox(body)); });
  body.querySelectorAll('[data-rem]').forEach(b => b.onclick = () => { const s = HHS.staff.find(x => x.id === b.dataset.rem);
    hhWa(s.phone, hhMsgReminder(s, day, gOf(s.id), items.filter(i => i.staff_id === s.id))); hhMarkSent(s, day, 'recordatorio').then(() => setTimeout(() => hhViewInbox(body), 800)); });
  const sig = items.map(i => i.id + i.status).join();
  hhPoll(async () => {
    if (HHS.tab !== 'bandeja' || HHS.day !== day || !body.isConnected) return false;
    const { data } = await sb.from('hh_items').select('id,status').eq('day', day).order('created_at');
    if ((data || []).map(i => i.id + i.status).join() !== sig){ toast('Bandeja actualizada'); hhViewInbox(body); }
    return true;
  }, body);
}
/* Actualización en vivo (cada 45 s) mientras la pantalla esté abierta. Se corta sola al salir. */
let HH_POLL = null;
function hhPoll(fn, el){
  clearInterval(HH_POLL); const hash = location.hash;
  HH_POLL = setInterval(async () => {
    if (location.hash !== hash || !el.isConnected){ clearInterval(HH_POLL); return; }
    if (document.hidden || !online() || $('#modal-root').children.length || el.querySelector('[data-hhc]:checked')) return;
    try { if (await fn() === false) clearInterval(HH_POLL); } catch {}
  }, 45000);
}

/* =====================================================================
   GUARDIAS
   ===================================================================== */
async function hhViewGuards(body, per){
  const mgr = isManager() && canWrite();
  const cp = hhCurPeriod(); per = per || HHS.gper || { ...hhPeriod(cp.y, cp.m), y: cp.y, m: cp.m }; HHS.gper = per;
  const list = mgr || isManager() ? HHS.staff.filter(s => s.active) : [HHS.mine].filter(Boolean);
  const flt = HHS.gflt || 'tecnico';
  const cols = isManager() ? list.filter(s => flt === 'todos' || s.kind === flt || (flt === 'otros' && s.kind !== 'tecnico')) : list;
  const rows = await cached(`hh-g-${per.from}`, () => sb.from('hh_guard').select('staff_id,day,code,note').gte('day', per.from).lte('day', per.to).limit(20000));
  const G = new Map(rows.map(r => [r.staff_id + '|' + r.day, r]));
  const days = hhDays(per.from, per.to);
  const yrs = [cp.y - 1, cp.y, cp.y + 1];
  body.innerHTML = `
    <div class="card hh-noprint"><div class="row between"><div class="row" style="gap:6px;flex-wrap:wrap">
        <select id="hg-m" style="width:auto">${HH_MONTHS.map((n, i) => `<option value="${i + 1}" ${i + 1 === per.m ? 'selected' : ''}>${n}</option>`).join('')}</select>
        <select id="hg-y" style="width:auto">${yrs.map(y => `<option ${y === per.y ? 'selected' : ''}>${y}</option>`).join('')}</select>
        <input type="date" id="hg-f" value="${per.from}" style="width:auto"><span class="muted">al</span><input type="date" id="hg-t" value="${per.to}" style="width:auto">
        ${isManager() ? `<select id="hg-k" style="width:auto"><option value="tecnico" ${flt === 'tecnico' ? 'selected' : ''}>Técnicos</option><option value="otros" ${flt === 'otros' ? 'selected' : ''}>Otros recursos y contratistas</option><option value="todos" ${flt === 'todos' ? 'selected' : ''}>Todos</option></select>` : ''}</div>
      ${mgr ? `<div class="row" style="gap:6px"><button class="btn sec small" id="hg-fill">Cargar rango</button><button class="btn sec small" id="hg-hol">Feriados (${HHS.hol.size})</button><label class="btn sec small" style="cursor:pointer">Importar Excel<input type="file" id="hg-imp" accept=".xlsx,.xls" class="hidden"></label></div>` : ''}</div>
      <div class="row" style="gap:6px;margin-top:8px;flex-wrap:wrap">${Object.entries(HH_CODES).map(([c, x]) => `<span class="pill" style="background:${x.bg};color:${x.c};border:1px solid var(--line)">${c} · ${x.n}</span>`).join('')}<span class="pill" style="background:#FFF8DB;color:#92400E">Sáb, dom y feriados</span></div>
      ${mgr ? '<p class="muted sm" style="margin:6px 0 0">Tocá una celda para cambiarla. Período de liquidación: del ' + Number(HHS.cfg.period_day) + ' al ' + (Number(HHS.cfg.period_day) - 1 || 'fin de mes') + ' (se cambia en Ajustes, o con las fechas de arriba).</p>' : ''}</div>
    ${cols.length ? `<div class="card" style="padding:0;overflow:auto;max-height:72vh"><table class="hh-grid"><thead><tr><th style="left:0;z-index:3;position:sticky">Día</th>${cols.map(s => `<th title="${esc(s.name)}">${esc(hhPretty(s.name))}${s.kind !== 'tecnico' ? '<div class="muted" style="font-weight:400">' + HH_SK[s.kind] + '</div>' : ''}</th>`).join('')}</tr></thead><tbody>
      ${days.map(d => `<tr class="${hhIsOff(d) ? 'off' : ''}"><td class="d">${HH_WD[hhDow(d)]} ${dOf(d).getDate()}/${dOf(d).getMonth() + 1}${HHS.hol.get(d) ? ' <span title="' + esc(HHS.hol.get(d).name || '') + '">🎌</span>' : ''}</td>
        ${cols.map(s => { const g = G.get(s.id + '|' + d); const x = g ? HH_CODES[g.code] : null;
          return `<td class="c" data-gs="${esc(s.id)}" data-gd="${d}" style="${x ? 'background:' + x.bg + ';color:' + x.c : 'color:#CBD5E1'}">${g ? esc(g.code) : '·'}${g?.note ? '<i>' + esc(g.note.slice(0, 12)) + '</i>' : ''}</td>`; }).join('')}</tr>`).join('')}
      </tbody><tfoot><tr><td class="d"><b>Guardias</b></td>${cols.map(s => `<td><b>${days.filter(d => G.get(s.id + '|' + d)?.code === 'G').length}</b></td>`).join('')}</tr>
      <tr><td class="d">Fin de sem. / fer.</td>${cols.map(s => `<td>${days.filter(d => hhIsOff(d) && G.get(s.id + '|' + d)?.code === 'G').length}</td>`).join('')}</tr>
      <tr><td class="d">Sin dato</td>${cols.map(s => { const n = days.filter(d => !G.get(s.id + '|' + d)).length; return `<td style="${n ? 'color:var(--red);font-weight:600' : ''}">${n}</td>`; }).join('')}</tr></tfoot></table></div>`
    : `<div class="card muted">${isManager() ? 'No hay técnicos cargados. Agregalos en Recursos o importá tu Excel de guardias.' : 'Tu usuario no está vinculado a un técnico.'}</div>`}`;
  const setPer = (from, to, y, m) => { HHS.gper = { from, to, y, m }; hhViewGuards(body); };
  $('#hg-m').onchange = $('#hg-y').onchange = () => { const y = Number($('#hg-y').value), m = Number($('#hg-m').value); const p = hhPeriod(y, m); setPer(p.from, p.to, y, m); };
  $('#hg-f').onchange = $('#hg-t').onchange = () => { const f = $('#hg-f').value, t = $('#hg-t').value; if (f && t && f <= t && hhDays(f, t).length <= 400) setPer(f, t, per.y, per.m); else toast('Rango inválido (hasta 400 días).'); };
  $('#hg-k')?.addEventListener('change', e => { HHS.gflt = e.target.value; hhViewGuards(body); });
  if (!mgr) return;
  body.querySelectorAll('td.c').forEach(td => td.onclick = () => hhGuardCell(HHS.staff.find(s => s.id === td.dataset.gs), td.dataset.gd, G.get(td.dataset.gs + '|' + td.dataset.gd), per, () => hhViewGuards(body)));
  $('#hg-fill').onclick = () => hhGuardCell(null, per.from, null, per, () => hhViewGuards(body), true);
  $('#hg-hol').onclick = () => hhHolidays(() => hhViewGuards(body));
  $('#hg-imp').onchange = e => hhImportGuards(e.target.files[0], () => hhViewGuards(body));
}
function hhGuardCell(st, day, cur, per, after, range){
  if (!needOnline()) return;
  let code = cur?.code || 'G';
  const m = modal(`<h2>${range ? 'Cargar rango de guardias' : esc(st.name)}</h2>${range ? '' : `<p class="muted sm">${esc(hhFmtDay(day))} · ${HH_DT[hhDayType(day)]}</p>`}
    ${range ? `<label>Técnico / recurso</label><select id="gc-s">${HHS.staff.filter(s => s.active).map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select>` : ''}
    <div class="hh-codes">${Object.entries(HH_CODES).map(([c, x]) => `<button type="button" data-c="${esc(c)}" style="background:${x.bg};color:${x.c}" class="${c === code ? 'on' : ''}">${esc(c)}<div style="font-weight:400;font-size:11px">${x.n}</div></button>`).join('')}</div>
    <label>Nota (trazas que cubre, base…)</label><input id="gc-n" maxlength="200" value="${esc(cur?.note || '')}" placeholder="T15, T22, T24">
    <div class="row"><div class="grow"><label>${range ? 'Desde' : 'Aplicar desde'}</label><input type="date" id="gc-f" value="${day}"></div><div class="grow"><label>Hasta</label><input type="date" id="gc-t" value="${range ? per.to : day}"></div></div>
    <label style="display:flex;gap:8px;align-items:center;font-weight:400"><input type="checkbox" id="gc-w" style="width:auto"> Solo días hábiles</label>
    <div class="err" id="gc-e"></div>
    <div class="row between" style="margin-top:10px">${cur && !range ? '<button class="btn sec" id="gc-del">Borrar dato</button>' : '<span></span>'}<div class="row"><button class="btn sec" id="gc-x">Cancelar</button><button class="btn" id="gc-ok">Guardar</button></div></div>`);
  m.el.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { code = b.dataset.c; m.el.querySelectorAll('[data-c]').forEach(x => x.classList.toggle('on', x === b)); });
  $('#gc-x').onclick = m.close;
  $('#gc-del')?.addEventListener('click', async () => { const { error } = await sb.from('hh_guard').delete().eq('staff_id', st.id).eq('day', day); if (error) return toast(errText(error)); m.close(); await hhDrop(`hh-g-${per.from}`); after(); });
  $('#gc-ok').onclick = async () => {
    const sid = range ? $('#gc-s').value : st.id, f = $('#gc-f').value, t = $('#gc-t').value;
    if (!f || !t || f > t) return ($('#gc-e').textContent = 'Revisá las fechas.');
    let ds = hhDays(f, t); if ($('#gc-w').checked) ds = ds.filter(d => !hhIsOff(d));
    if (ds.length > 400) return ($('#gc-e').textContent = 'Hasta 400 días por vez.');
    const note = $('#gc-n').value.trim() || null;
    $('#gc-ok').disabled = true;
    const { error } = await sb.from('hh_guard').upsert(ds.map(d => ({ staff_id: sid, day: d, code, note })), { onConflict: 'staff_id,day' });
    $('#gc-ok').disabled = false; if (error) return ($('#gc-e').textContent = errText(error));
    m.close(); await hhDrop(`hh-g-${per.from}`); toast(`${ds.length} día(s) guardados`); after();
  };
}
async function hhHolidays(after){
  const list = [...HHS.hol.values()].sort((a, b) => a.day < b.day ? -1 : 1);
  const m = modal(`<h2>Feriados y días no laborables</h2><p class="muted sm">Se usan para el tipo de día (hábil / fin de semana / feriado) y para el recargo.</p>
    <div class="row"><input type="date" id="fh-d" style="width:auto"><input id="fh-n" maxlength="120" placeholder="Descripción" class="grow"><button class="btn small" id="fh-a">Agregar</button></div>
    <div style="max-height:46vh;overflow:auto;margin-top:8px">${list.filter(h => h.day >= addDays(todayStr(), -400)).map(h => `<div class="row between" style="padding:4px 0;border-bottom:1px solid var(--line)"><span>${esc(hhFmtDay(h.day))} · ${esc(h.name || '')}</span><button class="iconbtn" data-fhd="${esc(h.day)}" title="Quitar">✕</button></div>`).join('') || '<p class="muted">No hay feriados cargados.</p>'}</div>
    <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn sec" id="fh-x">Cerrar</button></div>`, { wide: true });
  const reload = async () => { await hhDrop('hh-hol'); await hhLoadBase(); m.close(); hhHolidays(after); };
  $('#fh-x').onclick = () => { m.close(); after(); };
  $('#fh-a').onclick = async () => { const d = $('#fh-d').value; if (!d) return; const { error } = await sb.from('hh_holidays').upsert({ day: d, name: $('#fh-n').value.trim() || 'Feriado' }, { onConflict: 'org_id,day' }); if (error) return toast(errText(error)); reload(); };
  m.el.querySelectorAll('[data-fhd]').forEach(b => b.onclick = async () => { const { error } = await sb.from('hh_holidays').delete().eq('day', b.dataset.fhd); if (error) return toast(errText(error)); reload(); });
}

/* Importar la planilla de guardias (formato "fechas de guardia" + FERIADOS + TECNICOS) */
const hhNormName = s => norm(s).replace(/[^a-z ]/g, ' ').split(/\s+/).filter(Boolean).sort().join(' ');
function hhCodeOf(v){
  const s = norm(String(v || '')).trim(); if (!s) return null;
  if (/de guardia/.test(s)) return 'G';
  if (/^vac/.test(s)) return 'VAC';
  if (/franco/.test(s)) return 'F';
  if (/licen|enferm|carpeta/.test(s)) return 'LIC';
  if (/sin guardia/.test(s)) return '-';
  return null;
}
async function hhImportGuards(file, after){
  if (!file || !needOnline()) return;
  let wb; try { wb = await readWorkbook(file); } catch (x){ return toast('Excel: ' + errText(x)); }
  const sn = wb.SheetNames.find(n => /fechas? de guardia/i.test(n)) || wb.SheetNames[0];
  const R = sheetRows(wb.Sheets[sn]);
  // fila con "DIA DE GUARDIA" = encabezado; la anterior tiene los nombres
  const hr = R.findIndex(r => r.some(c => /dia de guardia/i.test(norm(String(c)))));
  if (hr < 1) return toast('No encontré la solapa "fechas de guardia" con la fila "DIA DE GUARDIA".');
  const heads = []; R[hr].forEach((c, j) => { if (/dia de guardia/i.test(norm(String(c)))){ const nm = String(R[hr - 1][j] || '').trim(); if (nm) heads.push({ j, name: nm.replace(/\s+/g, ' ').slice(0, 120), base: /base/i.test(String(R[hr][j + 1])) ? j + 1 : -1, contr: /contrato/i.test(String(R[hr][j + 2])) ? j + 2 : -1 }); } });
  const dateCol = (() => { for (let j = 0; j < 4; j++) if (R.slice(hr + 1, hr + 20).filter(r => xlDate(r[j])).length > 5) return j; return 1; })();
  // TECNICOS: nombre en el reporte + incluir
  const tsn = wb.SheetNames.find(n => /^tecnicos$/i.test(norm(n)));
  const rep = new Map(); if (tsn){ for (const r of sheetRows(wb.Sheets[tsn])){ if (r[2] && r[1] && !/nombre/i.test(String(r[1]))) rep.set(hhNormName(r[2]), { name: String(r[1]).trim().slice(0, 120), incl: !/^no$/i.test(String(r[3] || '').trim()), idx: rep.size }); } }
  // agrupar columnas duplicadas (mismo nombre en otro orden)
  const groups = new Map(); for (const h of heads){ const k = hhNormName(h.name); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(h); }
  // días
  const rows = []; const fixes = { serie: 0, vac: 0 };
  const grid = new Map(); // k -> Map(day -> {code,note})
  for (const [k, hs] of groups){ const mm = new Map(); grid.set(k, mm);
    for (const h of hs){ let prevNote = null, prevNum = null;
      for (let i = hr + 1; i < R.length; i++){ const d = xlDate(R[i][dateCol]); if (!d) continue; const raw = R[i][h.j]; const code = hhCodeOf(raw); if (!code) { prevNote = null; continue; }
        let note = null; if (code === 'G'){ const mt = /de guardia\s*(.+)$/i.exec(String(raw)); note = mt ? mt[1].trim().slice(0, 200) : null; }
        if (/^vac/i.test(String(raw)) && String(raw).trim() !== 'VAC') fixes.vac++;
        // corregir el "arrastre" de Excel: T24 → T25, T26… (serie que crece de a uno)
        if (note && prevNote){ const a = /^(.*?)(\d+)$/.exec(note), b = /^(.*?)(\d+)$/.exec(prevNote);
          if (a && b && a[1] === b[1] && Number(a[2]) === (prevNum ?? Number(b[2])) + 1){ prevNum = Number(a[2]); note = prevNote; fixes.serie++; } else prevNum = null; }
        prevNote = note;
        const ex = mm.get(d); if (!ex || (ex.code === '-' && code !== '-')) mm.set(d, { code, note });
      } }
  }
  const base = h => { const c = {}; for (let i = hr + 1; i < R.length; i++){ const v = String(R[i][h] || '').trim(); if (v) c[v] = (c[v] || 0) + 1; } return Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0] || null; };
  // feriados
  const fsn = wb.SheetNames.find(n => /^feriados$/i.test(norm(n)));
  const hols = []; if (fsn) for (const r of sheetRows(wb.Sheets[fsn])){ const d = xlDate(r[0]); if (d) hols.push({ day: d, name: String(r[1] || 'Feriado').slice(0, 120), kind: String(r[2] || '').slice(0, 40) || null }); }
  const total = [...grid.values()].reduce((a, mm) => a + mm.size, 0);
  const summary = [...groups.entries()].map(([k, hs]) => { const r = rep.get(k); const ex = HHS.staff.find(s => hhNormName(s.name) === k || hhNormName(s.grid_name) === k || (r && hhNormName(s.name) === hhNormName(r.name)));
    return { k, hs, display: r?.name || hhPretty(hs[0].name), grid_name: hs[0].name, exists: ex, kind: r ? 'tecnico' : 'recurso', liquidate: !!(r && r.incl), base: hs[0].base >= 0 ? base(hs[0].base) : null, contract: hs[0].contr >= 0 ? base(hs[0].contr) : null, days: grid.get(k).size }; });
  const m = modal(`<h2>Importar guardias</h2><p class="muted sm">Solapa "${esc(sn)}" · ${total} días con dato · ${hols.length} feriados</p>
    <div class="tblwrap" style="max-height:44vh;overflow:auto"><table class="tbl"><thead><tr><th>Nombre</th><th>Tipo</th><th class="num">Días</th><th>Estado</th></tr></thead><tbody>
    ${summary.map((s, i) => `<tr><td>${esc(s.display)}${s.hs.length > 1 ? '<div class="sm muted">' + s.hs.length + ' columnas unificadas</div>' : ''}</td><td><select data-ik="${i}" style="width:auto;padding:4px">${Object.entries(HH_SK).map(([k, n]) => `<option value="${k}" ${k === s.kind ? 'selected' : ''}>${n}</option>`).join('')}</select></td><td class="num">${s.days}</td><td class="sm">${s.exists ? 'ya existe' : 'nuevo'}${s.liquidate ? ' · liquida' : ''}</td></tr>`).join('')}</tbody></table></div>
    <p class="sm">Correcciones: ${fixes.serie} días con trazas mal arrastradas (T25, T26…) vuelven al valor original · vacaciones escritas de distintas formas quedan como VAC.</p>
    <label style="display:flex;gap:8px;align-items:center;font-weight:400"><input type="checkbox" id="ig-o" checked style="width:auto"> Reemplazar los días que ya estén cargados</label>
    <div class="err" id="ig-e"></div>
    <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn sec" id="ig-x">Cancelar</button><button class="btn" id="ig-ok">Importar</button></div>`, { wide: true });
  $('#ig-x').onclick = m.close;
  $('#ig-ok').onclick = async () => {
    $('#ig-ok').disabled = true; const btn = $('#ig-ok');
    try {
      m.el.querySelectorAll('[data-ik]').forEach(s => { summary[Number(s.dataset.ik)].kind = s.value; });
      for (const s of summary){
        if (!s.exists){ const { data, error } = await sb.from('hh_staff').insert({ name: s.display, grid_name: s.grid_name, kind: s.kind, active: true, liquidate: s.liquidate && s.kind === 'tecnico', base: s.base, contract: s.contract, sort: rep.get(s.k) ? 10 + rep.get(s.k).idx : 200 + summary.indexOf(s) }).select('id').single(); if (error) throw error; s.id = data.id; }
        else { s.id = s.exists.id; await sb.from('hh_staff').update({ grid_name: s.grid_name }).eq('id', s.id); }
      }
      if (hols.length){ for (let i = 0; i < hols.length; i += 500){ const { error } = await sb.from('hh_holidays').upsert(hols.slice(i, i + 500), { onConflict: 'org_id,day' }); if (error) throw error; } }
      const all = []; for (const s of summary) for (const [d, x] of grid.get(s.k)) all.push({ staff_id: s.id, day: d, code: x.code, note: x.note });
      for (let i = 0; i < all.length; i += 500){
        btn.textContent = `Guardando ${Math.min(i + 500, all.length)} de ${all.length}…`;
        const q = $('#ig-o').checked ? sb.from('hh_guard').upsert(all.slice(i, i + 500), { onConflict: 'staff_id,day' }) : sb.from('hh_guard').upsert(all.slice(i, i + 500), { onConflict: 'staff_id,day', ignoreDuplicates: true });
        const { error } = await q; if (error) throw error;
      }
      m.close(); await hhDrop('hh-staff', 'hh-hol'); await hhLoadBase(); HHS.gper = null; toast(`Importado: ${summary.length} personas, ${all.length} días, ${hols.length} feriados`); after();
    } catch (x){ $('#ig-ok').disabled = false; btn.textContent = 'Reintentar'; $('#ig-e').textContent = errText(x); }
  };
}

/* =====================================================================
   RECURSOS (técnicos, otros recursos, contratistas)
   ===================================================================== */
async function hhViewStaff(body){
  const users = await cached('hh-users', () => sb.from('profiles').select('id,full_name,email,role,active').order('full_name').limit(1000)).catch(() => []);
  const uName = id => { const u = users.find(x => x.id === id); return u ? (u.full_name || u.email) : ''; };
  const byKind = k => HHS.staff.filter(s => s.kind === k);
  body.innerHTML = `<div class="card"><div class="row between"><div><h2 style="margin:0">Recursos</h2><div class="muted sm">Técnicos propios, otros recursos y contratistas. "Liquida" = entra en el reporte a Recursos Humanos.</div></div>${canWrite() ? '<button class="btn" id="hs-new">+ Recurso</button>' : ''}</div></div>
    ${['tecnico', 'recurso', 'contratista'].map(k => `<div class="card"><h2 style="margin:0 0 6px">${HH_SK[k]}${k === 'tecnico' ? 's' : k === 'recurso' ? 's' : 's'} <span class="muted sm">(${byKind(k).length})</span></h2>
      ${byKind(k).length ? `<div class="tblwrap"><table class="tbl"><thead><tr><th>Nombre</th><th class="hide-sm">Empresa / base</th><th>Contacto</th><th class="hide-sm">Usuario de la app</th><th>Liquida</th><th></th></tr></thead><tbody>
      ${byKind(k).map(s => `<tr class="click" data-hs="${esc(s.id)}" style="${s.active ? '' : 'opacity:.5'}"><td><b>${esc(s.name)}</b>${s.active ? '' : ' <span class="pill p-bad">inactivo</span>'}</td><td class="hide-sm sm">${esc([s.company, s.base, s.contract].filter(Boolean).join(' · '))}</td>
        <td class="sm">${s.phone ? '💬 ' + esc(s.phone) : '<span class="muted">sin WhatsApp</span>'}${s.email ? '<div>' + esc(s.email) + '</div>' : ''}</td><td class="hide-sm sm">${esc(uName(s.user_id)) || '<span class="muted">—</span>'}</td><td>${s.liquidate ? '✓' : ''}</td><td>›</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Ninguno.</p>'}</div>`).join('')}`;
  $('#hs-new')?.addEventListener('click', () => hhStaffModal(null, users, () => hhViewStaff(body)));
  body.querySelectorAll('[data-hs]').forEach(tr => tr.onclick = () => canWrite() && hhStaffModal(HHS.staff.find(s => s.id === tr.dataset.hs), users, () => hhViewStaff(body)));
}
function hhStaffModal(s, users, after){
  if (!needOnline()) return;
  const x = s || { kind: 'tecnico', liquidate: true, active: true, sort: 100 };
  const m = modal(`<h2>${s ? 'Editar recurso' : 'Nuevo recurso'}</h2>
    <label>Nombre y apellido *</label><input id="sf-n" maxlength="120" value="${esc(x.name || '')}">
    <div class="row"><div class="grow"><label>Tipo</label><select id="sf-k">${Object.entries(HH_SK).map(([k, n]) => `<option value="${k}" ${k === x.kind ? 'selected' : ''}>${n}</option>`).join('')}</select></div><div class="grow"><label>Empresa</label><input id="sf-c" maxlength="120" value="${esc(x.company || '')}" placeholder="Trans IESA, SIP, Sagir…"></div></div>
    <div class="row"><div class="grow"><label>WhatsApp</label><input id="sf-p" maxlength="40" inputmode="tel" value="${esc(x.phone || '')}" placeholder="342 599-6607"></div><div class="grow"><label>Mail</label><input id="sf-e" maxlength="200" type="email" value="${esc(x.email || '')}"></div></div>
    <div class="row"><div class="grow"><label>Base</label><input id="sf-b" maxlength="120" value="${esc(x.base || '')}"></div><div class="grow"><label>Contrato</label><input id="sf-t" maxlength="120" value="${esc(x.contract || '')}" placeholder="SF+C R3"></div></div>
    <label>Usuario de la app (para que vea su día y pida horas)</label><select id="sf-u"><option value="">— Sin usuario —</option>${users.filter(u => u.active !== false).map(u => `<option value="${esc(u.id)}" ${u.id === x.user_id ? 'selected' : ''}>${esc(u.full_name || u.email)} · ${esc(u.email)}</option>`).join('')}</select>
    <label>Nombre en la planilla de guardias (si es distinto)</label><input id="sf-g" maxlength="120" value="${esc(x.grid_name || '')}">
    <div class="row" style="margin-top:10px"><label style="display:flex;gap:8px;align-items:center;font-weight:400"><input type="checkbox" id="sf-l" ${x.liquidate ? 'checked' : ''} style="width:auto"> Liquida (entra en el reporte a RRHH)</label>
      <label style="display:flex;gap:8px;align-items:center;font-weight:400"><input type="checkbox" id="sf-a" ${x.active ? 'checked' : ''} style="width:auto"> Activo</label></div>
    <div class="row"><div style="width:120px"><label>Orden</label><input id="sf-o" type="number" min="0" max="9999" value="${Number(x.sort ?? 100)}"></div></div>
    <div class="err" id="sf-err"></div>
    <div class="row between" style="margin-top:10px">${s ? '<button class="btn sec" id="sf-d" style="color:var(--red)">Borrar</button>' : '<span></span>'}<div class="row"><button class="btn sec" id="sf-x">Cancelar</button><button class="btn" id="sf-ok">Guardar</button></div></div>`, { wide: true });
  $('#sf-x').onclick = m.close;
  $('#sf-d')?.addEventListener('click', async () => {
    if (!confirm(`¿Borrar a ${s.name}? Se borran también sus días de guardia.`)) return;
    const { error } = await sb.from('hh_staff').delete().eq('id', s.id);
    if (error) return ($('#sf-err').textContent = /foreign key|violates/i.test(error.message) ? 'Tiene horas o tareas cargadas: no se puede borrar sin perder la liquidación. Desmarcá "Activo" para sacarlo de las listas.' : errText(error));
    m.close(); await hhDrop('hh-staff'); await hhLoadBase(); toast('Borrado'); after();
  });
  $('#sf-ok').onclick = async () => {
    const row = { name: $('#sf-n').value.trim(), kind: $('#sf-k').value, company: $('#sf-c').value.trim() || null, phone: $('#sf-p').value.trim() || null, email: $('#sf-e').value.trim() || null,
      base: $('#sf-b').value.trim() || null, contract: $('#sf-t').value.trim() || null, user_id: $('#sf-u').value || null, grid_name: $('#sf-g').value.trim() || null,
      liquidate: $('#sf-l').checked, active: $('#sf-a').checked, sort: Math.max(0, Math.min(9999, Number($('#sf-o').value) || 100)) };
    if (!row.name) return ($('#sf-err').textContent = 'Poné el nombre.');
    if (row.phone && !/^[0-9 +()\-]{6,40}$/.test(row.phone)) return ($('#sf-err').textContent = 'El WhatsApp solo puede tener números, espacios, +, ( ) y -.');
    if (row.email && !/^[^@\s<>"']+@[^@\s<>"']+\.[a-z]{2,}$/i.test(row.email)) return ($('#sf-err').textContent = 'Revisá el mail.');
    const { error } = s ? await sb.from('hh_staff').update(row).eq('id', s.id) : await sb.from('hh_staff').insert(row);
    if (error) return ($('#sf-err').textContent = /duplicate|unique/i.test(error.message) ? 'Ya hay un recurso con ese nombre, o ese usuario ya está vinculado a otro.' : errText(error));
    m.close(); await hhDrop('hh-staff'); await hhLoadBase(); toast('Guardado'); after();
  };
}

/* =====================================================================
   REPORTE PARA RECURSOS HUMANOS
   ===================================================================== */
async function hhReportData(from, to){
  const staff = HHS.staff.filter(s => s.liquidate);
  const [guards, items] = await Promise.all([
    hhItems(sb.from('hh_guard').select('staff_id,day,code,note').gte('day', from).lte('day', to).limit(20000)),
    hhItems(sb.from('hh_items').select(HH_COLS).gte('day', from).lte('day', to).limit(10000)),
  ]);
  const days = hhDays(from, to);
  const G = new Map(guards.map(g => [g.staff_id + '|' + g.day, g]));
  const rows = staff.map(s => {
    const my = items.filter(i => i.staff_id === s.id), val = my.filter(i => i.status === 'validada');
    const sum = f => Math.round(val.filter(f).reduce((a, i) => a + Number(i.hours || 0), 0) * 100) / 100;
    const spl = val.filter(i => i.kind === 'extra').map(hhSplit);
    const r = { s, gd: days.filter(d => G.get(s.id + '|' + d)?.code === 'G').length, gw: days.filter(d => hhIsOff(d) && G.get(s.id + '|' + d)?.code === 'G').length,
      exH: Math.round(spl.reduce((a, x) => a + x.h50, 0) * 100) / 100, exW: Math.round(spl.reduce((a, x) => a + x.h100, 0) * 100) / 100,
      vj: sum(i => i.kind === 'viaje'), tasks: val.filter(i => i.kind === 'tarea').length,
      pend: my.filter(i => ['pendiente', 'autorizada'].includes(i.status)).length, nodata: days.filter(d => !G.get(s.id + '|' + d)).length };
    r.tot = Math.round((r.exH + r.exW + r.vj) * 100) / 100; return r;
  });
  return { from, to, days, G, rows, items, staff };
}
async function hhViewReport(body){
  if (!needOnline()){ body.innerHTML = '<div class="card">El reporte necesita señal.</div>'; return; }
  const cp = hhCurPeriod(); const def = HHS.rper || (() => { let y = cp.y, m = cp.m - 1; if (m < 1){ m = 12; y--; } return { ...hhPeriod(y, m), y, m }; })(); HHS.rper = def;
  const D = await hhReportData(def.from, def.to);
  const T = k => Math.round(D.rows.reduce((a, r) => a + Number(r[k] || 0), 0) * 100) / 100;
  const per = `${fmtD(def.from)} al ${fmtD(def.to)}`, title = `${HH_MONTHS[def.m - 1]} ${def.y}`;
  const warn = D.rows.filter(r => r.pend || r.nodata);
  body.innerHTML = `
    <div class="card hh-noprint"><div class="row between"><div class="row" style="gap:6px;flex-wrap:wrap">
      <select id="hr-m" style="width:auto">${HH_MONTHS.map((n, i) => `<option value="${i + 1}" ${i + 1 === def.m ? 'selected' : ''}>${n}</option>`).join('')}</select>
      <select id="hr-y" style="width:auto">${[cp.y - 1, cp.y, cp.y + 1].map(y => `<option ${y === def.y ? 'selected' : ''}>${y}</option>`).join('')}</select>
      <input type="date" id="hr-f" value="${def.from}" style="width:auto"><span class="muted">al</span><input type="date" id="hr-t" value="${def.to}" style="width:auto"></div>
      <div class="row" style="gap:6px"><button class="btn" id="hr-x">⬇ Excel para RRHH</button><button class="btn sec" id="hr-p">🖨️ PDF</button><button class="btn sec" id="hr-mail">✉️ Enviar a RRHH</button><label class="btn sec" style="cursor:pointer;border-color:var(--navy-2)">⚖️ Comparar con la ticketera<input type="file" id="hr-tk" accept=".xlsx,.xls,.csv" class="hidden"></label></div></div>
      ${warn.length ? `<div class="banner warn" style="margin:10px 0 0"><span class="dot"></span><div><b>Revisá antes de enviar</b><div class="sm">${warn.map(r => esc(r.s.name) + ': ' + [r.pend ? r.pend + ' sin validar' : '', r.nodata ? r.nodata + ' días sin dato de guardia' : ''].filter(Boolean).join(', ')).join(' · ')}</div></div></div>` : '<p class="sm" style="color:var(--green-d);margin:8px 0 0">✓ Todo validado y con dato de guardia.</p>'}</div>
    <div class="hh-rep" id="hh-rep">
      <div class="hd"><div class="row between"><div><h2>Guardias y horas · ${esc(title)}</h2><div class="sm" style="opacity:.85">${esc(org?.name || '')} · Período ${esc(per)} · ${D.days.length} días</div></div><div class="sm" style="text-align:right;opacity:.85">Enviado ${esc(fmtDate(new Date()))}<br>${esc(me.full_name || '')}</div></div></div>
      <div class="tblwrap"><table><thead><tr><th>Técnico</th><th>Días de guardia</th><th>Guardias fin de semana / feriado</th><th>Horas extra al 50%</th><th>Horas extra al 100%</th><th>Horas de viaje</th><th>Total horas</th></tr></thead><tbody>
      ${D.rows.map(r => `<tr><td><b>${esc(r.s.name)}</b><div class="sm muted">${esc([r.s.base, r.s.contract].filter(Boolean).join(' · '))}</div></td><td>${r.gd}</td><td>${r.gw}</td><td>${r.exH || '—'}</td><td>${r.exW || '—'}</td><td>${r.vj || '—'}</td><td><b>${r.tot || '—'}</b></td></tr>`).join('') || '<tr><td colspan="7" class="muted">No hay técnicos marcados para liquidar (Recursos).</td></tr>'}
      <tr class="tot"><td>Total</td><td>${T('gd')}</td><td>${T('gw')}</td><td>${T('exH')}</td><td>${T('exW')}</td><td>${T('vj')}</td><td>${T('tot')}</td></tr></tbody></table></div>
      <p class="sm muted" style="padding:8px 14px;margin:0">Solo horas validadas por coordinación. Horas extra al 100%: domingos, feriados, sábados desde las ${hhT(HHS.cfg.sat_from)} y de ${hhT(HHS.cfg.night_start)} a ${hhT(HHS.cfg.night_end)}. Al 50%: el resto. Guardias de fin de semana / feriado = sábado, domingo o feriado cargado.</p></div>
    <div id="hr-cmp"></div>
    <div class="card hh-noprint" id="hr-stat"><h2 style="margin:0">Estadística ${def.y}</h2><p class="muted sm">Horas validadas por período de liquidación (extra + viaje).</p><div class="muted">Calculando…</div></div>`;
  const setP = (from, to, y, m) => { HHS.rper = { from, to, y, m }; hhViewReport(body); };
  $('#hr-m').onchange = $('#hr-y').onchange = () => { const y = Number($('#hr-y').value), m = Number($('#hr-m').value), p = hhPeriod(y, m); setP(p.from, p.to, y, m); };
  $('#hr-f').onchange = $('#hr-t').onchange = () => { const f = $('#hr-f').value, t = $('#hr-t').value; if (f && t && f <= t && hhDays(f, t).length <= 400) setP(f, t, def.y, def.m); else toast('Rango inválido.'); };
  $('#hr-p').onclick = () => window.print();
  $('#hr-x').onclick = async () => { $('#hr-x').disabled = true; try { await hhExportRRHH(D, def, title, per); } catch (x){ toast('Excel: ' + errText(x)); } $('#hr-x').disabled = false; };
  $('#hr-mail').onclick = () => {
    const to = HHS.cfg.rrhh_email; if (!to) return toast('Cargá el mail de Recursos Humanos en Ajustes.');
    const lines = [`Hola, les envío el reporte de guardias y horas de ${title} (período ${per}).`, '', ...D.rows.map(r => `• ${r.s.name}: ${r.gd} días de guardia (${r.gw} fin de semana/feriado) · extra ${r.exH} h hábiles + ${r.exW} h fin de semana/feriado · viaje ${r.vj} h`), '', 'Adjunto el Excel con el detalle día por día.', '', 'Saludos,', me.full_name || ''];
    if (confirm('Primero se descarga el Excel para que lo adjuntes al mail. ¿Seguimos?')) $('#hr-x').click();
    location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent('Guardias y horas · ' + title + ' (' + per + ')')}&body=${encodeURIComponent(lines.join('\n'))}`;
  };
  $('#hr-tk').onchange = e => hhCompareFile(e.target.files[0], D, def, title, per);
  if (HHS.tk && HHS.tk.key === def.from + def.to) hhCompareRender(HHS.tk.rows, D, def, title, per);
  hhStats(def.y);
}

/* =====================================================================
   COMPARAR CON LA TICKETERA (lo cargado allá vs lo autorizado en la app)
   ===================================================================== */
const HH_TKRE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s*(?:--|-|\s)\s*(\d{1,2}):(\d{2})/;
function hhTkDT(v){
  if (v instanceof Date && !isNaN(v)) return { day: dStr(v), t: String(v.getHours()).padStart(2, '0') + ':' + String(v.getMinutes()).padStart(2, '0') };
  const m = HH_TKRE.exec(String(v || '').trim()); if (!m) return null;
  return { day: `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`, t: `${m[4].padStart(2, '0')}:${m[5]}` };
}
function hhParseTicketera(wb){
  const out = [];
  for (const sn of wb.SheetNames){
    for (const row of sheetRows(wb.Sheets[sn])){
      const dts = []; row.forEach((c, i) => { const d = hhTkDT(c); if (d) dts.push({ i, ...d }); });
      if (dts.length < 2) continue;
      const a = dts[0], b = dts[1], rest = row.map((c, i) => ({ i, c })).filter(x => x.i !== a.i && x.i !== b.i && x.c !== '' && x.c != null);
      const str = rest.filter(x => typeof x.c === 'string').map(x => ({ i: x.i, c: x.c.trim() }));
      const who = str.find(x => /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' .]+,\s*[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' .]+$/.test(x.c)) || str.find(x => /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' .,]{5,60}$/.test(x.c) && !/^(obras|post-?venta|pendiente|validad[ao]|rechazad[ao]|aprobad[ao])$/i.test(x.c));
      const est = str.find(x => /^(pendiente|validad[ao]|rechazad[ao]|aprobad[ao]|anulad[ao])$/i.test(x.c));
      const dur = str.find(x => /\d+\s*hs/i.test(x.c));
      const area = str.find(x => /^(obras|post-?venta|mantenimiento|instalaci[oó]n|guardia)$/i.test(x.c));
      const nums = rest.filter(x => typeof x.c === 'number' || /^\d+%?$/.test(String(x.c).trim()));
      const pctC = nums.filter(x => /^(50|100)%?$/.test(String(x.c).trim())).pop();
      const tick = nums.find(x => x !== pctC && Number(String(x.c).replace('%', '')) >= 1000);
      const desc = str.filter(x => x !== who && x !== est && x !== dur && x !== area).sort((p, q) => q.c.length - p.c.length)[0];
      if (!who) continue;
      let mins = hhMin(b.t) - hhMin(a.t) + (b.day > a.day ? 1440 : 0); if (mins <= 0) mins += 1440;
      out.push({ sheet: sn, who: who.c.slice(0, 120), day: a.day, start: a.t, end: b.t, mins, area: area?.c || '', ticket: tick ? String(tick.c) : '', estado: est?.c || '', desc: (desc?.c || '').slice(0, 300), pct: pctC ? Number(String(pctC.c).replace('%', '')) : null });
      if (out.length > 20000) break;
    }
  }
  return out;
}
async function hhCompareFile(file, D, def, title, per){
  if (!file) return;
  let wb; try { wb = await readWorkbook(file); } catch (x){ return toast('Excel: ' + errText(x)); }
  const rows = hhParseTicketera(wb);
  if (!rows.length) return toast('No encontré filas con fecha y hora "dd/mm/aaaa -- hh:mm" en el archivo.');
  // vincular nombres de la ticketera con los recursos de la app
  const names = [...new Set(rows.map(r => r.who))];
  const map = HHS.tkmap || {};
  const find = n => { const k = hhNormName(n); return HHS.staff.find(s => hhNormName(s.name) === k || hhNormName(s.grid_name) === k)?.id || map[n] || ''; };
  const opts = sel => '<option value="">— No comparar —</option>' + HHS.staff.map(s => `<option value="${esc(s.id)}" ${s.id === sel ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
  const inPer = rows.filter(r => r.day >= def.from && r.day <= def.to);
  const m = modal(`<h2>Comparar con la ticketera</h2><p class="muted sm">${rows.length} registros en el archivo · ${inPer.length} dentro del período ${esc(per)}${rows.length - inPer.length ? ' (el resto queda afuera)' : ''}.</p>
    <div class="tblwrap" style="max-height:44vh;overflow:auto"><table class="tbl"><thead><tr><th>En la ticketera</th><th class="num">Registros</th><th>Es en la app</th></tr></thead><tbody>
    ${names.map((n, i) => `<tr><td>${esc(n)}</td><td class="num">${inPer.filter(r => r.who === n).length}</td><td><select data-tkn="${i}">${opts(find(n))}</select></td></tr>`).join('')}</tbody></table></div>
    <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn sec" id="tk-x">Cancelar</button><button class="btn" id="tk-ok">Comparar</button></div>`, { wide: true });
  $('#tk-x').onclick = m.close;
  $('#tk-ok').onclick = () => {
    m.el.querySelectorAll('[data-tkn]').forEach(sel => { map[names[Number(sel.dataset.tkn)]] = sel.value; });
    HHS.tkmap = map;
    const mapped = inPer.map(r => ({ ...r, staff_id: map[r.who] || find(r.who) })).filter(r => r.staff_id);
    HHS.tk = { key: def.from + def.to, rows: mapped };
    m.close(); hhCompareRender(mapped, D, def, title, per);
    $('#hr-cmp')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
}
const HH_CMP = { ok: ['✅ Coincide', '#DCFCE7', 'FFDCFCE7'], dif: ['🟡 Diferencia de horas', '#FEF3C7', 'FFFEF3C7'], rec: ['🟠 Recargo distinto', '#FFEDD5', 'FFFFEDD5'], pend: ['🟡 Pendiente en la app', '#FEF9C3', 'FFFEF9C3'], sin: ['🔴 Sin autorización en la app', '#FEE2E2', 'FFFEE2E2'], notk: ['⚪ Autorizado y no cargado en la ticketera', '#E2E8F0', 'FFE2E8F0'] };
function hhCompareCalc(rows, D){
  const TOL = 15, days = [];
  const staffIds = [...new Set(rows.map(r => r.staff_id).concat(D.items.filter(i => i.kind !== 'tarea' && ['autorizada', 'validada'].includes(i.status)).map(i => i.staff_id)))].filter(id => rows.some(r => r.staff_id === id) || HHS.staff.find(s => s.id === id)?.liquidate);
  for (const sid of staffIds){
    const keys = [...new Set(rows.filter(r => r.staff_id === sid).map(r => r.day).concat(D.items.filter(i => i.staff_id === sid && i.kind !== 'tarea').map(i => i.day)))].sort();
    for (const day of keys){
      const tk = rows.filter(r => r.staff_id === sid && r.day === day).sort((a, b) => a.start < b.start ? -1 : 1);
      const its = D.items.filter(i => i.staff_id === sid && i.day === day && i.kind !== 'tarea');
      const ok = its.filter(i => ['autorizada', 'validada'].includes(i.status)), pe = its.filter(i => i.status === 'pendiente');
      const tkM = tk.reduce((a, r) => a + r.mins, 0), tk100 = tk.reduce((a, r) => a + (r.pct === 100 ? r.mins : 0), 0);
      const apM = Math.round(ok.reduce((a, i) => a + Number(i.hours || 0) * 60, 0)), ap100 = ok.reduce((a, i) => a + hhSplitRange(i.day, i.start_t, i.end_t).m100, 0);
      const rule100 = tk.reduce((a, r) => a + hhSplitRange(r.day, r.start, r.end).m100, 0);
      // horas superpuestas: el mismo horario cargado dos veces (por ejemplo con dos tickets)
      const iv = tk.map(r => { const a = hhMin(r.start); return [a, a + r.mins]; }).sort((p, q) => p[0] - q[0]);
      let uni = 0, cs = -1, ce = -1; for (const [a, b] of iv){ if (a > ce){ if (ce > cs) uni += ce - cs; cs = a; ce = b; } else ce = Math.max(ce, b); } if (ce > cs) uni += ce - cs;
      const dupM = tkM - uni;
      if (!tkM && !apM && !pe.length) continue;
      let st;
      if (tkM && !apM) st = pe.length ? 'pend' : 'sin';
      else if (!tkM && apM) st = 'notk';
      else if (!tkM) continue;
      else if (Math.abs(tkM - apM) > TOL) st = 'dif';
      else if (Math.abs(tk100 - ap100) > TOL) st = 'rec';
      else st = 'ok';
      const obs = [];
      if (tk.some(r => r.pct != null) && Math.abs(tk100 - rule100) > TOL) obs.push(`la ticketera marca ${hhH(tk100 / 60)} al 100% y por regla son ${hhH(rule100 / 60)}`);
      const tkT = [...new Set(tk.map(r => r.ticket).filter(Boolean))], apT = [...new Set(ok.map(i => i.ticket).filter(Boolean))];
      if (tkT.length && apT.length && !tkT.some(t => apT.some(x => x.replace(/\D/g, '').includes(t) || t.includes(x.replace(/\D/g, ''))))) obs.push(`ticket distinto (ticketera ${tkT.join(', ')} · app ${apT.join(', ')})`);
      if (tk.some(r => /pendiente/i.test(r.estado))) obs.push('en la ticketera figura pendiente');
      if (dupM > 0) obs.unshift(`⚠ ${hhH(dupM / 60)} superpuestas: el mismo horario está cargado dos veces`);
      if (st === 'dif') obs.unshift(`diferencia ${hhH(Math.abs(tkM - apM) / 60)} (${tkM > apM ? 'la ticketera tiene más' : 'la app tiene más'})`);
      days.push({ sid, day, st, tk, ok, pe, tkM, tk100, apM, ap100, obs, dupM });
    }
  }
  return days;
}
function hhCompareRender(rows, D, def, title, per){
  const box = $('#hr-cmp'); if (!box) return;
  const days = hhCompareCalc(rows, D);
  const sids = [...new Set(days.map(d => d.sid))].sort((a, b) => hhStaffName(a).localeCompare(hhStaffName(b)));
  const cnt = k => days.filter(d => d.st === k).length;
  const H = m => hhH(Math.round(m / 60 * 100) / 100);
  box.innerHTML = `<div class="card"><div class="row between"><div><h2 style="margin:0">⚖️ Ticketera vs app · ${esc(title)}</h2><div class="muted sm">Lo cargado en la ticketera contra lo autorizado o validado en la app, día por día (tolerancia 15 min).</div></div><button class="btn" id="tk-xl">⬇ Excel del control</button></div>
    <div class="row" style="gap:6px;flex-wrap:wrap;margin:10px 0">${Object.entries(HH_CMP).map(([k, x]) => `<span class="pill" style="background:${x[1]};color:#0F2A4A">${x[0]}: ${cnt(k)}</span>`).join('')}${days.some(d => d.dupM > 0) ? `<span class="pill" style="background:#EDE9FE;color:#5B21B6">🟣 Horas superpuestas: ${days.filter(d => d.dupM > 0).length} día(s) · ${hhH(days.reduce((a, d) => a + d.dupM, 0) / 60)}</span>` : ''}</div>
    <div class="tblwrap"><table class="tbl"><thead><tr><th>Técnico</th><th class="num">Ticketera</th><th class="num">al 100%</th><th class="num">App (autorizado)</th><th class="num">al 100%</th><th class="num">Diferencia</th><th class="num">Superpuestas</th><th>Días con problema</th></tr></thead><tbody>
    ${sids.map(id => { const ds = days.filter(d => d.sid === id), t = ds.reduce((a, d) => a + d.tkM, 0), a = ds.reduce((x, d) => x + d.apM, 0), bad = ds.filter(d => d.st !== 'ok' || d.dupM > 0).length;
      return `<tr><td><b>${esc(hhStaffName(id))}</b></td><td class="num">${H(t)}</td><td class="num">${H(ds.reduce((x, d) => x + d.tk100, 0))}</td><td class="num">${H(a)}</td><td class="num">${H(ds.reduce((x, d) => x + d.ap100, 0))}</td><td class="num" style="${Math.abs(t - a) > 15 ? 'color:var(--red);font-weight:600' : ''}">${t === a ? '—' : (t > a ? '+' : '−') + H(Math.abs(t - a))}</td><td class="num">${(x => x ? '<b style="color:#5B21B6">' + H(x) + '</b>' : '—')(ds.reduce((x, d) => x + d.dupM, 0))}</td><td>${bad ? `<span class="pill p-bad">${bad} de ${ds.length}</span>` : '<span class="pill p-ok">ninguno</span>'}</td></tr>`; }).join('') || '<tr><td colspan="8" class="muted">Sin datos para comparar en el período.</td></tr>'}
    </tbody></table></div>
    ${sids.map(id => `<details style="margin-top:8px"><summary style="cursor:pointer;font-weight:600">${esc(hhStaffName(id))} · ${days.filter(d => d.sid === id && (d.st !== 'ok' || d.dupM > 0)).length} día(s) para revisar</summary>
      <div class="tblwrap"><table class="tbl"><thead><tr><th>Día</th><th>Ticketera</th><th>App</th><th>Estado</th></tr></thead><tbody>
      ${days.filter(d => d.sid === id).map(d => `<tr style="background:${HH_CMP[d.st][1]}"><td class="sm" style="white-space:nowrap">${esc(hhFmtDay(d.day))}</td>
        <td class="sm">${d.tk.map(r => `${esc(r.start)}–${esc(r.end)} · ${r.pct ?? '?'}%${r.ticket ? ' · #' + esc(r.ticket) : ''}${/pendiente/i.test(r.estado) ? ' · pendiente' : ''}`).join('<br>') || '—'}${d.tkM ? '<div><b>' + H(d.tkM) + '</b></div>' : ''}</td>
        <td class="sm">${d.ok.map(i => `${hhT(i.start_t)}–${hhT(i.end_t)} · ${HH_KIND_S[i.kind]} · ${HH_ST[i.status][0].toLowerCase()}${i.ticket ? ' · ' + esc(i.ticket) : ''}`).join('<br>') || (d.pe.length ? d.pe.map(i => `${hhT(i.start_t)}–${hhT(i.end_t)} · pendiente`).join('<br>') : '—')}${d.apM ? '<div><b>' + H(d.apM) + '</b></div>' : ''}</td>
        <td class="sm"><b>${HH_CMP[d.st][0]}</b>${d.obs.length ? '<div>' + d.obs.map(esc).join(' · ') + '</div>' : ''}</td></tr>`).join('')}</tbody></table></div></details>`).join('')}</div>`;
  $('#tk-xl').onclick = async () => { $('#tk-xl').disabled = true; try { await hhCompareExcel(days, sids, title, per); } catch (x){ toast('Excel: ' + errText(x)); } $('#tk-xl').disabled = false; };
}
async function hhCompareExcel(days, sids, title, per){
  await hhLoadExcelJS();
  const X = s => typeof s === 'string' && /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
  const wb = new ExcelJS.Workbook(); wb.creator = 'InspectApp';
  const NAVY = 'FF0F2A4A', MINT = 'FFE7F7F0', GREEN = 'FF22B07D';
  const border = { top: { style: 'thin', color: { argb: 'FFD6DDE6' } }, bottom: { style: 'thin', color: { argb: 'FFD6DDE6' } }, left: { style: 'thin', color: { argb: 'FFD6DDE6' } }, right: { style: 'thin', color: { argb: 'FFD6DDE6' } } };
  const band = (ws, text, cols) => { ws.mergeCells(1, 1, 1, cols); const c = ws.getCell(1, 1); c.value = X(text); c.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }; c.alignment = { vertical: 'middle', indent: 1 }; ws.getRow(1).height = 28; };
  const head = (ws, row, labels) => { const r = ws.getRow(row); labels.forEach((l, i) => { const c = r.getCell(i + 1); c.value = l; c.font = { bold: true, color: { argb: NAVY } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MINT } }; c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; c.border = { ...border, bottom: { style: 'medium', color: { argb: GREEN } } }; }); r.height = 32; };
  const h = m => Math.round(m / 60 * 100) / 100;
  const ws = wb.addWorksheet('Resumen', { views: [{ showGridLines: false }], pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, paperSize: 9 } });
  ws.columns = [{ width: 30 }, { width: 13 }, { width: 13 }, { width: 15 }, { width: 13 }, { width: 13 }, { width: 13 }, { width: 11 }, { width: 11 }, { width: 11 }, { width: 11 }, { width: 11 }, { width: 13 }];
  band(ws, `Control ticketera vs app · ${title} (${per})`, 13);
  ws.mergeCells(2, 1, 2, 13); ws.getCell(2, 1).value = X(`Generado el ${fmtDate(new Date())} por ${me.full_name || me.email} · tolerancia 15 min · App = horas autorizadas o validadas`); ws.getCell(2, 1).font = { italic: true, color: { argb: 'FF475569' } };
  head(ws, 4, ['Técnico', 'Ticketera (h)', 'Ticketera al 100%', 'App autorizado (h)', 'App al 100%', 'Diferencia (h)', 'Superpuestas (h)', 'Coinciden', 'Diferencia horas', 'Recargo distinto', 'Pendiente en app', 'Sin autorizar', 'No cargado en ticketera']);
  sids.forEach((id, k) => { const ds = days.filter(d => d.sid === id), c = st => ds.filter(d => d.st === st).length, t = ds.reduce((a, d) => a + d.tkM, 0), a = ds.reduce((x, d) => x + d.apM, 0);
    const r = ws.getRow(5 + k); r.values = [X(hhStaffName(id)), h(t), h(ds.reduce((x, d) => x + d.tk100, 0)), h(a), h(ds.reduce((x, d) => x + d.ap100, 0)), h(t - a), h(ds.reduce((x, d) => x + d.dupM, 0)), c('ok'), c('dif'), c('rec'), c('pend'), c('sin'), c('notk')];
    r.eachCell({ includeEmpty: true }, (cell, n) => { cell.border = border; if (n > 1){ cell.alignment = { horizontal: 'center' }; cell.numFmt = '0.##'; } if (n === 6 && Math.abs(t - a) > 15) cell.font = { bold: true, color: { argb: 'FFDC2626' } }; if (n === 7 && cell.value) cell.font = { bold: true, color: { argb: 'FF5B21B6' } }; if (n >= 9 && cell.value) cell.font = { bold: true, color: { argb: 'FFB45309' } }; }); r.getCell(1).font = { bold: true }; });
  const wd = wb.addWorksheet('Detalle por día', { views: [{ state: 'frozen', ySplit: 3, showGridLines: false }], pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 } });
  wd.columns = [{ width: 12 }, { width: 6 }, { width: 26 }, { width: 40 }, { width: 10 }, { width: 40 }, { width: 10 }, { width: 10 }, { width: 30 }, { width: 50 }];
  band(wd, `Detalle día por día · ${title} (${per})`, 10);
  head(wd, 3, ['Fecha', 'Día', 'Técnico', 'Ticketera (tramos)', 'Ticketera (h)', 'App (autorizado / validado)', 'App (h)', 'Diferencia (h)', 'Estado', 'Observaciones']);
  let k = 0;
  for (const id of sids) for (const d of days.filter(x => x.sid === id)){
    const r = wd.getRow(4 + k++);
    r.values = [hhXDate(d.day), HH_WD[hhDow(d.day)], X(hhStaffName(id)), X(d.tk.map(t => `${t.start}–${t.end} ${t.pct ?? '?'}%${t.ticket ? ' #' + t.ticket : ''}${/pendiente/i.test(t.estado) ? ' (pendiente)' : ''}`).join(' · ')),
      h(d.tkM), X(d.ok.map(i => `${hhT(i.start_t)}–${hhT(i.end_t)} ${HH_KIND_S[i.kind]}${i.ticket ? ' ' + i.ticket : ''}`).join(' · ') || d.pe.map(i => `${hhT(i.start_t)}–${hhT(i.end_t)} pendiente`).join(' · ')),
      h(d.apM), h(d.tkM - d.apM), HH_CMP[d.st][0].replace(/^\S+\s/, ''), X(d.obs.join(' · '))];
    r.getCell(1).numFmt = 'dd/mm/yyyy';
    r.eachCell({ includeEmpty: true }, (c, n) => { c.border = border; c.alignment = { vertical: 'top', wrapText: [4, 6, 10].includes(n), horizontal: [2, 5, 7, 8].includes(n) ? 'center' : undefined }; if ([5, 7, 8].includes(n)) c.numFmt = '0.##'; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HH_CMP[d.st][2] } }; });
  }
  const buf = await wb.xlsx.writeBuffer();
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  a.download = `Control ticketera vs app - ${title}.xlsx`.replace(/[\\/:*?"<>|]/g, ''); document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}
async function hhStats(year){
  const box = $('#hr-stat'); if (!box) return;
  const per = Array.from({ length: 12 }, (_, i) => ({ m: i + 1, ...hhPeriod(year, i + 1) }));
  const { data } = await sb.from('hh_items').select('staff_id,day,kind,hours').eq('status', 'validada').in('kind', ['extra', 'viaje']).gte('day', per[0].from).lte('day', per[11].to).limit(20000);
  const it = data || [];
  const tot = per.map(p => ({ ...p, ex: it.filter(i => i.kind === 'extra' && i.day >= p.from && i.day <= p.to).reduce((a, i) => a + Number(i.hours), 0), vj: it.filter(i => i.kind === 'viaje' && i.day >= p.from && i.day <= p.to).reduce((a, i) => a + Number(i.hours), 0) }));
  const mx = Math.max(1, ...tot.map(t => t.ex + t.vj));
  const byS = HHS.staff.filter(s => s.liquidate).map(s => ({ s, h: per.map(p => it.filter(i => i.staff_id === s.id && i.day >= p.from && i.day <= p.to).reduce((a, i) => a + Number(i.hours), 0)) }));
  box.innerHTML = `<h2 style="margin:0">Estadística ${year}</h2><p class="muted sm">Horas validadas por período de liquidación · <span style="color:#0F2A4A">■</span> extra · <span style="color:#22B07D">■</span> viaje</p>
    <div class="hh-bars">${tot.map(t => `<div title="${HH_MONTHS[t.m - 1]}: ${hhH(t.ex)} extra · ${hhH(t.vj)} viaje"><span style="font-size:10px">${Math.round(t.ex + t.vj) || ''}</span><b style="height:${t.vj / mx * 110}px;background:#22B07D;border-radius:0"></b><b style="height:${t.ex / mx * 110}px;background:#0F2A4A;${t.vj ? 'border-radius:6px 6px 0 0' : ''}"></b>${HH_MONTHS[t.m - 1].slice(0, 3)}</div>`).join('')}</div>
    <div class="tblwrap" style="margin-top:10px"><table class="tbl"><thead><tr><th>Técnico</th>${per.map(p => `<th class="num">${HH_MONTHS[p.m - 1].slice(0, 3)}</th>`).join('')}<th class="num">Total</th></tr></thead><tbody>
    ${byS.map(r => `<tr><td>${esc(r.s.name)}</td>${r.h.map(h => `<td class="num">${h ? Math.round(h * 10) / 10 : ''}</td>`).join('')}<td class="num"><b>${Math.round(r.h.reduce((a, b) => a + b, 0) * 10) / 10}</b></td></tr>`).join('')}</tbody></table></div>`;
}
function hhLoadExcelJS(){
  if (window.ExcelJS) return Promise.resolve();
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'exceljs.min.js'; s.onload = () => res(); s.onerror = () => rej(new Error('No se pudo cargar el generador de Excel.')); document.head.appendChild(s); });
}
async function hhExportRRHH(D, def, title, per){
  await hhLoadExcelJS();
  const X = s => typeof s === 'string' && /^[=+\-@\t\r]/.test(s) ? "'" + s : s;   // sin fórmulas escondidas
  const wb = new ExcelJS.Workbook(); wb.creator = 'InspectApp'; wb.created = new Date();
  const NAVY = 'FF0F2A4A', GREEN = 'FF22B07D', MINT = 'FFE7F7F0', GRAY = 'FFF1F5F9', YEL = 'FFFFF8DB';
  const border = { top: { style: 'thin', color: { argb: 'FFD6DDE6' } }, bottom: { style: 'thin', color: { argb: 'FFD6DDE6' } }, left: { style: 'thin', color: { argb: 'FFD6DDE6' } }, right: { style: 'thin', color: { argb: 'FFD6DDE6' } } };
  const band = (ws, row, text, cols, size = 16) => { ws.mergeCells(row, 1, row, cols); const c = ws.getCell(row, 1); c.value = X(text); c.font = { bold: true, size, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }; c.alignment = { vertical: 'middle', indent: 1 }; ws.getRow(row).height = size + 14; };
  const head = (ws, row, labels) => { const r = ws.getRow(row); labels.forEach((l, i) => { const c = r.getCell(i + 1); c.value = l; c.font = { bold: true, color: { argb: NAVY } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MINT } }; c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; c.border = { ...border, bottom: { style: 'medium', color: { argb: GREEN } } }; }); r.height = 34; };
  // 1) Resumen
  const ws = wb.addWorksheet('Resumen', { views: [{ showGridLines: false }], pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, paperSize: 9 } });
  ws.columns = [{ width: 30 }, { width: 36 }, { width: 14 }, { width: 16 }, { width: 16 }, { width: 18 }, { width: 14 }, { width: 13 }];
  band(ws, 1, `${org?.name || ''} · Guardias y horas · ${title}`, 8, 16);
  ws.mergeCells(2, 1, 2, 8); ws.getCell(2, 1).value = X(`Período de liquidación: ${per} · ${D.days.length} días · Generado el ${fmtDate(new Date())} por ${me.full_name || me.email}`); ws.getCell(2, 1).font = { italic: true, color: { argb: 'FF475569' } };
  head(ws, 4, ['Técnico', 'Base / contrato', 'Días de guardia', 'Guardias fin de semana / feriado', 'Horas extra al 50%', 'Horas extra al 100%', 'Horas de viaje', 'Total horas']);
  D.rows.forEach((r, i) => { const row = ws.getRow(5 + i); row.values = [X(r.s.name), X([r.s.base, r.s.contract].filter(Boolean).join(' · ')), r.gd, r.gw, r.exH, r.exW, r.vj, r.tot];
    row.eachCell({ includeEmpty: true }, (c, n) => { c.border = border; if (n > 2){ c.alignment = { horizontal: 'center' }; if (n > 4) c.numFmt = '0.##'; } if (i % 2) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }; }); row.getCell(1).font = { bold: true }; row.getCell(8).font = { bold: true }; });
  const tr = ws.getRow(5 + D.rows.length); const sumc = k => Math.round(D.rows.reduce((a, r) => a + r[k], 0) * 100) / 100;
  tr.values = ['Total', '', sumc('gd'), sumc('gw'), sumc('exH'), sumc('exW'), sumc('vj'), sumc('tot')];
  tr.eachCell({ includeEmpty: true }, (c, n) => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }; c.border = border; if (n > 2) c.alignment = { horizontal: 'center' }; });
  const nr = 7 + D.rows.length;
  ['Solo se incluyen horas validadas por coordinación.', 'Fin de semana / feriado = sábado, domingo o feriado de la solapa "Feriados del período".', `Horas extra al 100%: domingos, feriados, sábados desde las ${hhT(HHS.cfg.sat_from)} y todos los días de ${hhT(HHS.cfg.night_start)} a ${hhT(HHS.cfg.night_end)}. Al 50%: el resto.`].forEach((t, i) => { ws.mergeCells(nr + i, 1, nr + i, 8); ws.getCell(nr + i, 1).value = t; ws.getCell(nr + i, 1).font = { size: 9, color: { argb: 'FF64748B' } }; });
  // 2) Detalle de guardias día por día
  const wg = wb.addWorksheet('Detalle guardias', { views: [{ state: 'frozen', xSplit: 3, ySplit: 3, showGridLines: false }], pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 } });
  const st = D.rows.map(r => r.s);
  wg.columns = [{ width: 12 }, { width: 6 }, { width: 30 }, ...st.map(() => ({ width: 11 }))];
  band(wg, 1, `Detalle día por día · ${title} (${per})`, 3 + st.length, 13);
  head(wg, 3, ['Fecha', 'Día', 'Feriado', ...st.map(s => s.name)]);
  D.days.forEach((d, i) => { const r = wg.getRow(4 + i), off = hhIsOff(d);
    r.values = [hhXDate(d), HH_WD[hhDow(d)], X(HHS.hol.get(d)?.name || ''), ...st.map(s => D.G.get(s.id + '|' + d)?.code || '¿?')];
    r.getCell(1).numFmt = 'dd/mm/yyyy';
    r.eachCell({ includeEmpty: true }, (c, n) => { c.border = border; c.alignment = { horizontal: n === 3 ? 'left' : 'center' }; if (off) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: YEL } };
      if (n > 3){ const code = c.value; const x = HH_CODES[code]; if (x && code !== '-') { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: x.x } }; c.font = { bold: true, color: { argb: 'FF' + x.c.slice(1) } }; } if (code === '¿?') c.font = { bold: true, color: { argb: 'FFDC2626' } };
        const g = D.G.get(st[n - 4].id + '|' + d); if (g?.note) c.note = X(g.note); } }); });
  const fr = 4 + D.days.length; const totRow = (label, f, idx) => { const r = wg.getRow(fr + idx); r.values = [label, '', '', ...st.map(f)]; r.eachCell({ includeEmpty: true }, c => { c.font = { bold: true }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAY } }; c.border = border; c.alignment = { horizontal: 'center' }; }); };
  totRow('Días de guardia', s => D.days.filter(d => D.G.get(s.id + '|' + d)?.code === 'G').length, 0);
  totRow('Fin de sem./feriado', s => D.days.filter(d => hhIsOff(d) && D.G.get(s.id + '|' + d)?.code === 'G').length, 1);
  wg.getRow(fr + 3).values = ['G = guardia · F = franco · VAC = vacaciones · LIC = licencia · - = sin guardia · ¿? = sin dato · filas amarillas = sábado, domingo o feriado'];
  wg.getRow(fr + 3).getCell(1).font = { size: 9, color: { argb: 'FF64748B' } };
  // 3) Horas validadas
  const wh = wb.addWorksheet('Horas validadas', { views: [{ state: 'frozen', ySplit: 3, showGridLines: false }], pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 } });
  wh.columns = [{ width: 12 }, { width: 10 }, { width: 26 }, { width: 10 }, { width: 8 }, { width: 8 }, { width: 8 }, { width: 8 }, { width: 8 }, { width: 26 }, { width: 14 }, { width: 40 }, { width: 22 }];
  band(wh, 1, `Horas extra y de viaje validadas · ${title} (${per})`, 13, 13);
  head(wh, 3, ['Fecha', 'Tipo de día', 'Técnico', 'Tipo', 'Desde', 'Hasta', 'Horas', 'Al 50%', 'Al 100%', 'Causal', 'Ticket / OT', 'Tarea', 'Validó']);
  const val = D.items.filter(i => i.status === 'validada' && i.kind !== 'tarea' && D.staff.some(s => s.id === i.staff_id)).sort((a, b) => a.day < b.day ? -1 : a.day > b.day ? 1 : (a.start_t || '') < (b.start_t || '') ? -1 : 1);
  val.forEach((i, k) => { const r = wh.getRow(4 + k); r.values = [hhXDate(i.day), HH_DT[i.day_type || hhDayType(i.day)], X(hhStaffName(i.staff_id)), HH_KIND_S[i.kind], hhT(i.start_t), hhT(i.end_t), Number(i.hours), ...(i.kind === 'extra' ? (x => [x.h50, x.h100])(hhSplit(i)) : ['', '']), X(HH_CAUSE[i.cause] || ''), X(i.ticket || ''), X(i.title), X(i.reviewed_by_name || '')];
    r.getCell(1).numFmt = 'dd/mm/yyyy'; [7, 8, 9].forEach(n => r.getCell(n).numFmt = '0.##'); r.eachCell({ includeEmpty: true }, (c, n) => { c.border = border; if ([2, 4, 5, 6, 7, 8, 9].includes(n)) c.alignment = { horizontal: 'center' }; if ((i.day_type || hhDayType(i.day)) !== 'habil') c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: YEL } }; }); });
  if (!val.length) wh.getRow(4).values = ['No hay horas validadas en el período.'];
  // 4) Feriados del período
  const wf = wb.addWorksheet('Feriados del período', { views: [{ showGridLines: false }] });
  wf.columns = [{ width: 14 }, { width: 8 }, { width: 44 }];
  band(wf, 1, 'Feriados y días no laborables del período', 3, 13); head(wf, 3, ['Fecha', 'Día', 'Descripción']);
  D.days.filter(d => HHS.hol.has(d)).forEach((d, k) => { const r = wf.getRow(4 + k); r.values = [hhXDate(d), HH_WD[hhDow(d)], X(HHS.hol.get(d).name || '')]; r.getCell(1).numFmt = 'dd/mm/yyyy'; r.eachCell(c => { c.border = border; }); });
  const buf = await wb.xlsx.writeBuffer();
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  a.download = `Guardias y horas - ${title} (${fmtD(D.from).replace(/\//g, '-')} al ${fmtD(D.to).replace(/\//g, '-')}).xlsx`.replace(/[\\/:*?"<>|]/g, ''); document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}

/* =====================================================================
   AJUSTES
   ===================================================================== */
async function hhViewSettings(body){
  const c = HHS.cfg;
  body.innerHTML = `<div class="card"><h2 style="margin:0 0 6px">Ajustes</h2>
    <div class="row"><div class="grow"><label>Tope diario de horas extra</label><input id="hc-me" type="number" min="0" max="24" step="0.5" value="${Number(c.max_extra)}"></div><div class="grow"><label>Tope diario de horas de viaje</label><input id="hc-mv" type="number" min="0" max="24" step="0.5" value="${Number(c.max_viaje)}"></div></div>
    <p class="muted sm" style="margin:2px 0 0">Para superar el tope: causal "Corte de servicio / SLA" y número de ticket. Igual requiere validación.</p>
    <div class="row"><div class="grow"><label>Horario laboral desde</label><input id="hc-ws" type="time" value="${hhT(c.work_start)}"></div><div class="grow"><label>hasta</label><input id="hc-we" type="time" value="${hhT(c.work_end)}"></div></div>
    <div class="row"><div class="grow"><label>Al 100%: sábado desde</label><input id="hc-sf" type="time" value="${hhT(c.sat_from || '13:00')}"></div><div class="grow"><label>Al 100%: nocturnas desde</label><input id="hc-ns" type="time" value="${hhT(c.night_start || '22:00')}"></div><div class="grow"><label>hasta</label><input id="hc-ne" type="time" value="${hhT(c.night_end || '06:00')}"></div></div>
    <p class="muted sm" style="margin:2px 0 0">Domingos y feriados: siempre al 100%. El resto: al 50%.</p>
    <div class="row"><div class="grow"><label>Cierre semanal: día</label><select id="hc-dd">${HH_WD.map((d, i) => `<option value="${i + 1}" ${i + 1 === Number(c.deadline_dow) ? 'selected' : ''}>${['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'][i]} siguiente</option>`).join('')}</select></div><div class="grow"><label>a las</label><input id="hc-dt" type="time" value="${hhT(c.deadline_time)}"></div></div>
    <div class="row"><div class="grow"><label>Período de liquidación: empieza el día</label><input id="hc-pd" type="number" min="1" max="28" value="${Number(c.period_day)}"></div><div class="grow muted sm" style="align-self:end;padding-bottom:10px" id="hc-pdx"></div></div>
    <div class="row"><div class="grow"><label>Mail de Recursos Humanos</label><input id="hc-rr" type="email" maxlength="200" value="${esc(c.rrhh_email || '')}"></div><div class="grow"><label>WhatsApp del coordinador (avisos de pedidos)</label><input id="hc-cp" maxlength="40" inputmode="tel" value="${esc(c.coord_phone || '')}"></div></div>
    <div class="row"><div class="grow"><label>Saludo de los mensajes</label><input id="hc-gr" maxlength="120" value="${esc(c.greeting || '')}"></div><div class="grow"><label>Firma</label><input id="hc-sg" maxlength="120" value="${esc(c.signature || '')}" placeholder="Coordinación ${esc(org?.name || '')}"></div></div>
    <div class="err" id="hc-e"></div>
    <div class="row" style="justify-content:flex-end;margin-top:10px">${canWrite() ? '<button class="btn" id="hc-ok">Guardar</button>' : ''}</div></div>
    <div class="card"><h2 style="margin:0 0 6px">Destrabar una semana cerrada</h2><p class="muted sm">El técnico puede volver a cargar o corregir esa semana durante 48 h.</p>
      <div class="row"><input type="date" id="hu-w" value="${addDays(hhWeekStart(todayStr()), -7)}" style="width:auto"><select id="hu-s" style="width:auto"><option value="">Todos</option>${HHS.staff.filter(s => s.active).map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select>${canWrite() ? '<button class="btn small" id="hu-ok">Destrabar</button>' : ''}</div></div>`;
  const ex = () => { const p = Number($('#hc-pd').value) || 16; $('#hc-pdx').textContent = p === 1 ? 'mes calendario' : `del ${p} del mes anterior al ${p - 1} del mes`; }; ex(); $('#hc-pd').oninput = ex;
  $('#hc-ok')?.addEventListener('click', async () => {
    const row = { max_extra: Number($('#hc-me').value), max_viaje: Number($('#hc-mv').value), work_start: $('#hc-ws').value, work_end: $('#hc-we').value, deadline_dow: Number($('#hc-dd').value), deadline_time: $('#hc-dt').value,
      period_day: Math.max(1, Math.min(28, Number($('#hc-pd').value) || 16)), rrhh_email: $('#hc-rr').value.trim() || null, coord_phone: $('#hc-cp').value.trim() || null, greeting: $('#hc-gr').value.trim() || 'Buena jornada laboral', signature: $('#hc-sg').value.trim() || null, sat_from: $('#hc-sf').value || '13:00', night_start: $('#hc-ns').value || '22:00', night_end: $('#hc-ne').value || '06:00', org_id: me.org_id, updated_at: new Date().toISOString() };
    if (row.coord_phone && !/^[0-9 +()\-]{6,40}$/.test(row.coord_phone)) return ($('#hc-e').textContent = 'Revisá el WhatsApp del coordinador.');
    if (row.rrhh_email && !/^[^@\s<>"']+@[^@\s<>"']+\.[a-z]{2,}$/i.test(row.rrhh_email)) return ($('#hc-e').textContent = 'Revisá el mail de RRHH.');
    const { error } = await sb.from('hh_settings').upsert(row, { onConflict: 'org_id' });
    if (error) return ($('#hc-e').textContent = errText(error));
    await hhDrop('hh-cfg'); await hhLoadBase(); HHS.gper = HHS.rper = null; toast('Ajustes guardados');
  });
  $('#hu-ok')?.addEventListener('click', async () => { const w = $('#hu-w').value; if (!w) return; const { error } = await sb.rpc('hh_unlock', { p_week: w, p_staff: $('#hu-s').value || null, p_hours: 48 }); if (error) return toast(errText(error)); toast(`Semana del ${fmtD(hhWeekStart(w))} destrabada por 48 h`); });
}

/* =====================================================================
   v4.6 · INICIO DIRECTO: pedir horas, tarea de hoy, jornada del vehículo
   ===================================================================== */
const hhHM = m => { m = ((Math.round(m) % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
const hhNowM = () => { const d = new Date(); return Math.floor((d.getHours() * 60 + d.getMinutes()) / 5) * 5; };
/* punto de partida de un pedido: ahora si ya terminó el horario (o no es hábil); si no, el fin del horario */
function hhBaseStart(day){
  const now = hhNowM(), ws = hhMin(HHS.cfg.work_start), we = hhMin(HHS.cfg.work_end);
  if (hhIsOff(day) || now >= we || now < ws) return now; return we;
}
function hhChips(){
  return `<div class="hq-chips"><button data-hq="now" class="urg">⚡ Empiezo ahora</button><button data-hq="1">+1 h</button><button data-hq="2">+2 h</button><button data-hq="22">Hasta las 22</button><button data-hq="x">Otro horario…</button></div>`;
}
function hhBindChips(box, st, after){
  box.querySelectorAll('[data-hq]').forEach(b => b.onclick = () => {
    const day = todayStr(), q = b.dataset.hq, base = q === 'now' ? hhNowM() : hhBaseStart(day);
    const preset = q === 'x' ? {} : { start: hhHM(base), end: q === '22' ? '22:00' : hhHM(base + (q === '2' ? 120 : 60)), urgent: q === 'now' };
    if (q === '22' && base >= 22 * 60) preset.end = hhHM(base + 60);
    hhItemModal({ staff: st, kind: 'extra', day, preset, after });
  });
}
/* barra del día 0–24 h: horario laboral, lo cargado y la hora actual */
function hhTimeline(items, day){
  const pc = m => (m / 1440 * 100).toFixed(2) + '%';
  const ws = hhMin(HHS.cfg.work_start), we = hhMin(HHS.cfg.work_end), off = hhIsOff(day);
  const col = { pendiente: '#F59E0B', autorizada: '#2A78D6', validada: '#16A34A', rechazada: '#DC2626' };
  const seg = (a, b, c, t) => `<i style="left:${pc(a)};width:${pc(Math.max(b - a, 8))};background:${c}" title="${esc(t)}"></i>`;
  const bars = items.filter(i => i.kind !== 'tarea' && i.start_t && i.end_t).map(i => {
    const a = hhMin(i.start_t), b = hhMin(i.end_t), c = col[i.status] || '#94A3B8', t = `${HH_KIND_S[i.kind]} ${hhT(i.start_t)}–${hhT(i.end_t)} · ${(HH_ST[i.status] || [''])[0]}`;
    return b > a ? seg(a, b, c, t) : seg(a, 1440, c, t) + seg(0, b, c, t);
  }).join('');
  const now = day === todayStr() ? `<b style="left:${pc(new Date().getHours() * 60 + new Date().getMinutes())}"></b>` : '';
  return `<div class="hq-tl">${off ? '' : `<u style="left:${pc(ws)};width:${pc(we - ws)}"></u>`}${bars}${now}</div>
    <div class="hq-tlx"><span>0</span><span>6</span><span>12</span><span>18</span><span>24</span></div>
    <div class="sm muted" style="margin-top:2px">${off ? HH_DT[hhDayType(day)] + ': todo el día cuenta como fuera de horario' : 'Gris: horario laboral ' + hhT(HHS.cfg.work_start) + '–' + hhT(HHS.cfg.work_end)} · <span style="color:#F59E0B">■</span> pendiente <span style="color:#2A78D6">■</span> autorizada <span style="color:#16A34A">■</span> validada</div>`;
}
function hhQuickCss(){
  if (document.getElementById('hq-css')) return;
  const st = document.createElement('style'); st.id = 'hq-css';
  st.textContent = `
.hq{background:linear-gradient(135deg,#0F2A4A,#1D4E89);color:#fff;border:0}
.hq h2{color:#fff;margin:0}.hq .sm{opacity:.85}.hq .muted{color:#CBD5E1}
.hq-btns{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-top:12px}
.hq-b{border:0;border-radius:14px;padding:14px 12px;text-align:left;cursor:pointer;background:#fff;color:var(--navy);box-shadow:0 2px 6px rgba(0,0,0,.15);min-height:86px;display:flex;flex-direction:column;justify-content:space-between}
.hq-b .i{font-size:26px;line-height:1}.hq-b .l{font-weight:700;font-size:16px;margin-top:6px}.hq-b .s{font-size:12px;color:var(--muted);margin-top:2px}
.hq-b.go{background:#16A34A;color:#fff}.hq-b.go .s{color:#E7F7F0}
.hq-b.stop{background:#DC2626;color:#fff}.hq-b.stop .s{color:#FEE2E2}
.hq-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
.hq-chips button{border:1px solid rgba(255,255,255,.5);background:rgba(255,255,255,.12);color:#fff;border-radius:99px;padding:8px 14px;font-weight:600;cursor:pointer}
.card:not(.hq) .hq-chips button{border-color:var(--line);background:#fff;color:var(--navy)}
.hq-chips button.urg{background:#F59E0B;border-color:#F59E0B;color:#fff}
.hq-tl{position:relative;height:18px;border-radius:9px;background:#E2E8F0;overflow:hidden;margin-top:10px}
.hq-tl u{position:absolute;top:0;bottom:0;background:#CBD5E1}
.hq-tl i{position:absolute;top:3px;bottom:3px;border-radius:4px}
.hq-tl b{position:absolute;top:0;bottom:0;width:2px;background:#0F2A4A}
.hq-tlx{display:flex;justify-content:space-between;font-size:10px;color:var(--muted);margin-top:2px}
.hq .hq-tl{background:rgba(255,255,255,.18)}.hq .hq-tl u{background:rgba(255,255,255,.3)}.hq .hq-tl b{background:#fff}.hq .hq-tlx{color:#CBD5E1}
.hq-red{background:#DC2626;color:#fff;border-radius:12px;padding:12px 14px;margin:0 0 12px;display:flex;gap:10px;align-items:center;font-weight:600}
.hq-red button{margin-left:auto;background:#fff;color:#DC2626;border:0;border-radius:8px;padding:8px 12px;font-weight:700;cursor:pointer;white-space:nowrap}`;
  document.head.appendChild(st);
}
async function hhHomeQuick(box){
  if (!box || !me) return;
  hhQuickCss();
  const wantH = can('horas');
  if (!wantH && !can('veh')) return;
  try { await hhLoadBase(); } catch { HHS.cfg = HHS.cfg || { ...HH_DEF }; }
  const wantV = typeof vehHomeSlot === 'function' && can('veh') && !!HHS.mine;
  const st = wantH ? HHS.mine : null, mgr = isManager(), today = todayStr();
  let items = [], guard = null, nTasks = 0;
  if (st){
    try {
      const [its, g] = await Promise.all([
        cached('hh-today', () => sb.from('hh_items').select(HH_COLS).eq('staff_id', st.id).eq('day', today).order('start_t')),
        cached('hh-myguard', () => sb.from('hh_guard').select('day,code,note').eq('staff_id', st.id).gte('day', addDays(today, -1)).lte('day', addDays(today, 7))),
      ]);
      const q = (await IDB.get('kv', CUR_UID + ':hhq').catch(() => null)) || [];
      items = its.concat(q.filter(r => r.day === today && r.staff_id === st.id).map(r => ({ ...r, status: 'pendiente', _local: true, hours: hhCalc(r.start_t, r.end_t) })));
      guard = (g || []).find(x => x.day === today) || null;
    } catch {}
  }
  try { const ts = await IDB.get('kv', CUR_UID + ':tasks').catch(() => null); nTasks = (ts || []).filter(t => taskOpen(t) && (!t.due_date || t.due_date <= addDays(today, 1))).length; } catch {}
  const tareas = items.filter(i => i.kind === 'tarea');
  const extra = items.filter(i => i.kind !== 'tarea' && i.status !== 'rechazada');
  const gp = guard && HH_CODES[guard.code] ? `<span class="pill" style="background:${HH_CODES[guard.code].bg};color:${HH_CODES[guard.code].c}">${HH_CODES[guard.code].n}</span>` : '';
  const btns = [];
  if (st && canWrite()) btns.push(`<button class="hq-b" id="hq-req"><span class="i">⏱️</span><div><div class="l">Pedir horas extra</div><div class="s">${extra.length ? extra.length + ' pedido(s) hoy · ' + hhH(extra.reduce((a, i) => a + Number(i.hours || 0), 0)) : 'Tope ' + hhH(HHS.cfg.max_extra) + ' extra · ' + hhH(HHS.cfg.max_viaje) + ' viaje'}</div></div></button>`);
  if (st) btns.push(`<button class="hq-b" id="hq-task"><span class="i">📋</span><div><div class="l">Mi tarea de hoy</div><div class="s">${tareas.length ? esc(tareas[0].title).slice(0, 60) + (tareas.length > 1 ? ' · +' + (tareas.length - 1) : '') : 'Sin tarea cargada · tocá para cargarla'}</div></div></button>`);
  if (nTasks) btns.push(`<button class="hq-b" id="hq-asg"><span class="i">🗂️</span><div><div class="l">Tareas asignadas</div><div class="s">${nTasks} abierta(s) para hoy o vencidas</div></div></button>`);
  if (wantV) btns.push(`<div id="hq-veh" style="display:contents"></div>`);
  box.innerHTML = `<div id="hq-redslot"></div>
    ${st || btns.length ? `<div class="card hq"><div class="row between"><div><h2>${st ? '¡Buen día, ' + esc(hhFirst(st.name) || hhFirst(me.full_name)) + '!' : 'Accesos rápidos'}</h2><div class="sm">${esc(hhFmtDay(today))} · ${HH_DT[hhDayType(today)]}${HHS.hol?.get?.(today) ? ' · ' + esc(HHS.hol.get(today).name || '') : ''}</div></div>${gp}</div>
      <div class="hq-btns">${btns.join('')}</div>
      ${st && canWrite() ? hhChips() : ''}
      ${st ? hhTimeline(items, today) : ''}</div>` : ''}
    <div id="hq-mgr"></div>`;
  const redraw = () => hhHomeQuick(box);
  $('#hq-req')?.addEventListener('click', () => hhItemModal({ staff: st, kind: 'extra', day: today, after: redraw }));
  $('#hq-task')?.addEventListener('click', () => tareas.length ? (location.hash = '#/tools/hh/hoy') : hhItemModal({ staff: st, kind: 'tarea', day: today, after: redraw }));
  $('#hq-asg')?.addEventListener('click', () => { location.hash = '#/tasks'; });
  if (st && canWrite()) hhBindChips(box, st, redraw);
  if (wantV) vehHomeSlot($('#hq-veh'), $('#hq-redslot'), redraw);
  if (wantH && mgr) hhHomeInbox($('#hq-mgr'));
}
/* Tarjeta de bandeja en Inicio para coordinador / supervisor / admin, con actualización en vivo */
async function hhHomeInbox(box){
  if (!box || !online()) return;
  let items = [], od = [];
  try { [items, od] = await Promise.all([hhItems(sb.from('hh_items').select(HH_COLS).eq('day', todayStr()).in('status', ['pendiente', 'autorizada']).order('created_at')), hhOverdue()]); } catch { return; }
  const pend = items.filter(i => i.status === 'pendiente');
  box.innerHTML = `<div class="card"><div class="row between"><h2 style="margin:0">📥 Bandeja de horas</h2><a href="#/tools/hh/bandeja" class="sm">Abrir bandeja</a></div>
    <div class="row" style="gap:6px;margin:6px 0">${pend.length ? `<span class="pill p-pend">${pend.length} para autorizar</span>` : '<span class="pill p-ok">Nada para autorizar</span>'}${items.length - pend.length ? `<span class="pill p-info">${items.length - pend.length} autorizada(s) a validar</span>` : ''}${od.length ? `<span class="pill p-bad">⏰ ${od.length} de días anteriores</span>` : ''}</div>
    ${pend.slice(0, 4).map(i => hhItemHTML(i, { who: true, actions: hhMgrActions })).join('')}
    ${pend.length > 4 ? `<a href="#/tools/hh/bandeja" class="sm">Ver ${pend.length - 4} más…</a>` : ''}</div>`;
  hhBindItems(box, items, () => hhHomeInbox(box));
  const sig = items.map(i => i.id + i.status).join();
  hhPoll(async () => {
    const { data } = await sb.from('hh_items').select('id,status').eq('day', todayStr()).in('status', ['pendiente', 'autorizada']).order('created_at');
    if ((data || []).map(i => i.id + i.status).join() !== sig){ toast('Llegó un pedido nuevo de horas'); hhHomeInbox(box); }
  }, box);
}
