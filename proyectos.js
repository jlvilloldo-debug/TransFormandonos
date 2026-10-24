/* =====================================================================
   InspectApp · Transformándonos — v4
   Proyectos, mapa con semáforo, pendientes, etapas, fechas propuestas,
   Gantt (automático o desde Excel) e inventario de equipos.
   Usa las utilidades de index.html ($, esc, sb, cached, modal, toast…).
   Este archivo solo declara funciones: no ejecuta nada al cargarse.
   ===================================================================== */

/* ---------- semáforo ---------- */
const SEM = {
  red:   { c: '#DC2626', o: 6, n: 'Crítico · atrasado · bloqueado' },
  amber: { c: '#F59E0B', o: 5, n: 'En curso · con pendientes' },
  blue:  { c: '#2a78d6', o: 4, n: 'Programado' },
  gray:  { c: '#1A3A6B', o: 3, n: 'Sin visita · a instalar' },
  green: { c: '#16A34A', o: 2, n: 'OK · terminado' },
  none:  { c: '#CBD2DA', o: 0, n: 'Sin datos' },
};
const worstColor = list => list.reduce((a, b) => (SEM[b]?.o ?? 0) > (SEM[a]?.o ?? 0) ? b : a, 'none');
const PEND_SLA_H = { critica: 24, alta: 72, normal: 120 };
const PRIO_TXT = { critica: 'Crítico', alta: 'Alto', normal: 'Normal' };
const pendHours = t => (Date.now() - new Date(t.created_at)) / 3600000;
const pendLate = t => taskOpen(t) && pendHours(t) > (PEND_SLA_H[t.priority] || 120);
const fmtAge = h => h < 48 ? Math.max(1, Math.round(h)) + ' h' : Math.round(h / 24) + ' días';
const todayStr = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const dOf = s => new Date(String(s).slice(0, 10) + 'T12:00:00');
const dStr = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const addDays = (s, n) => { const d = dOf(s); d.setDate(d.getDate() + n); return dStr(d); };
const diffDays = (a, b) => Math.round((dOf(b) - dOf(a)) / 86400000);
const fmtD = s => s ? fmtDate(dOf(s)) : '—';
const fmtDM = s => s ? dOf(s).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : '—';
const semDot = (c, big) => c === 'gray' ? `<i class="semdot ring${big ? ' big' : ''}"></i>` : c === 'none' ? `<i class="semdot nd${big ? ' big' : ''}"></i>` : `<i class="semdot${big ? ' big' : ''}" style="background:${SEM[c]?.c || SEM.none.c}"></i>`;

const PROJ_KIND = { instalacion: 'Instalación / obra', mantenimiento: 'Mantenimiento', mixto: 'Mixto', otro: 'Otro' };
const DEFAULT_STAGES = {
  instalacion: ['Pendiente', 'Relevado', 'En curso', 'Instalado', 'Pruebas OK', 'Acta firmada', 'Certificado'],
  mantenimiento: ['Pendiente', 'En curso', 'Completado'],
  mixto: ['Pendiente', 'Relevado', 'En curso', 'Instalado', 'Pruebas OK', 'Certificado'],
  otro: ['Pendiente', 'En curso', 'Terminado'],
};
const UNITS = { u: 'unidades', m: 'metros', km: 'km', puestos: 'puestos', bocas: 'bocas', otro: 'otra' };
const isValidator = () => me && ['admin', 'supervisor', 'pm'].includes(me.role);
const ROLE_TXT = { admin: 'Admin', supervisor: 'Supervisor', pm: 'PM', coordinador: 'Coordinador', inspector: 'Inspector', contratista: 'Contratista' };

/* ---------- datos (con paginado: Supabase entrega de a 1000 filas) ---------- */
async function pageAll(mk, max = 20000){
  const out = [];
  for (let from = 0; from < max; from += 1000){
    const { data, error } = await mk().range(from, from + 999);
    if (error) return { data: null, error };
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return { data: out, error: null };
}
const PS_COLS = 'id,project_id,site_id,stage,planned,done,start_date,end_date,proposed_start,proposed_end,proposal_note,proposed_at,contractor_id,blocked,block_reason,notes,history,last_inspection_id,updated_at,created_at';
const SITE_MAP_COLS = 'id,name,kind,traza,grupo,lat,lng,localidad,provincia,address,aliases';
const loadProjects = () => cached('projects', () => sb.from('projects').select('*').order('name'));
const loadPS = () => cached('ps-all', () => pageAll(() => sb.from('project_sites').select(PS_COLS).order('id')));
const loadSitesMap = () => cached('sites-map', () => pageAll(() => sb.from('sites').select(SITE_MAP_COLS).eq('active', true).order('name').order('id')));
const loadAllTasks = () => cached('tasks', () => sb.from('tasks').select(TASK_COLS).order('due_date', { ascending: true }).limit(1000));
let SITE_COORDS = new Map();
function rememberCoords(sites){ SITE_COORDS = new Map((sites || []).filter(s => s.lat !== null && s.lat !== undefined).map(s => [s.id, [Number(s.lat), Number(s.lng)]])); }
const mapsLink = (lat, lng) => `https://www.google.com/maps/dir/?api=1&destination=${Number(lat).toFixed(6)},${Number(lng).toFixed(6)}`;

/* ---------- reglas de proyecto ---------- */
function doneIdx(p){
  const st = p.stages || [];
  let i = p.done_stage ? st.indexOf(p.done_stage) : -1;
  if (i < 0) i = st.findIndex(s => /instalad|terminad|finaliz|complet/i.test(s));
  return i < 0 ? st.length - 1 : i;
}
function psPct(ps, p){
  const idx = (p.stages || []).indexOf(ps.stage), di = doneIdx(p);
  const keys = Object.keys(ps.planned || {}).filter(k => Number(ps.planned[k]) > 0);
  if (keys.length){
    const plan = keys.reduce((a, k) => a + Number(ps.planned[k]), 0);
    const done = keys.reduce((a, k) => a + Math.min(Number(ps.done?.[k] || 0), Number(ps.planned[k])), 0);
    return plan ? Math.min(100, done * 100 / plan) : 0;
  }
  if (idx < 0) return 0;
  return idx >= di ? 100 : Math.round(idx * 100 / Math.max(1, di));
}
function psState(ps, p){
  const st = p.stages || [], idx = st.indexOf(ps.stage), di = doneIdx(p), t = todayStr();
  const pct = psPct(ps, p);
  if (ps.blocked) return { c: 'red', n: 'Bloqueado' + (ps.block_reason ? ': ' + ps.block_reason : ''), pct };
  if (idx >= di) return { c: 'green', n: ps.stage + (pct < 100 ? ` · ${Math.round(pct)}% de lo previsto` : ''), pct };
  if (ps.end_date && ps.end_date < t) return { c: 'red', n: `Vencido (fin ${fmtDM(ps.end_date)})`, pct };
  if (idx > 0 || pct > 0) return { c: 'amber', n: ps.stage + (pct ? ` · ${Math.round(pct)}%` : ''), pct };
  if (ps.start_date) return { c: 'blue', n: `Programado ${fmtDM(ps.start_date)}`, pct };
  if (ps.proposed_start) return { c: 'blue', n: `Propuesta ${fmtDM(ps.proposed_start)} · a validar`, pct, prop: true };
  return { c: 'gray', n: ps.stage || 'A instalar', pct };
}
/* fecha en que el sitio llegó a la etapa de terminado (del historial) */
function psDoneDate(ps, p, at){
  const di = at ?? doneIdx(p), later = (p.stages || []).slice(di);
  const h = (ps.history || []).filter(x => x.tipo === 'etapa' && later.includes(x.a)).map(x => x.at).sort()[0];
  if (h) return h.slice(0, 10);
  return (p.stages || []).indexOf(ps.stage) >= di ? (ps.updated_at || '').slice(0, 10) : null;
}
function psStartDate(ps){
  const h = (ps.history || []).filter(x => x.tipo === 'etapa' || x.tipo === 'avance').map(x => x.at).sort()[0];
  return h ? h.slice(0, 10) : null;
}

/* =====================================================================
   MAPA CON SEMÁFORO
   ===================================================================== */
const LAYERS = { prev: '🛠 Preventivos', corr: '⚡ Correctivos', pend: '⚠ Pendientes', inst: '📡 Instalaciones' };
let pmap = null;
async function viewMap(v, preset){
  let saved = {}; try { saved = JSON.parse(localStorage.getItem('ia_map') || '{}'); } catch {}
  const st = { project: saved.project || '', per: saved.per || '30', layers: saved.layers || { prev: true, corr: true, pend: true, inst: true } };
  if (preset === 'pend') st.layers = { prev: false, corr: false, pend: true, inst: false };
  if (preset === 'inst') st.layers = { prev: false, corr: false, pend: false, inst: true };
  const [sites, projects, psAll, tasks, contrs] = await Promise.all([
    loadSitesMap(), loadProjects().catch(() => []), loadPS().catch(() => []), loadAllTasks().catch(() => []), loadContractors().catch(() => [])]);
  rememberCoords(sites);
  if (st.project && !projects.some(p => p.id === st.project)) st.project = '';
  v.innerHTML = `
    <div class="card"><div class="row between"><h2 style="margin:0">Mapa</h2><span class="muted sm" id="mp-note"></span></div>
      <div class="row" style="margin-top:10px">
        <select id="mp-proj" style="width:auto"><option value="">Todos los proyectos y sitios</option>${projects.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select>
        <select id="mp-per" style="width:auto" title="Período para preventivos y correctivos"><option value="30">Visitas: últimos 30 días</option><option value="60">Últimos 60 días</option><option value="90">Últimos 90 días</option><option value="180">Últimos 6 meses</option></select>
        <input id="mp-q" class="grow" placeholder="Buscar sitio o localidad">
      </div>
      <div class="layerbar" id="mp-layers">${Object.entries(LAYERS).map(([k, t]) => `<button type="button" data-ly="${k}" class="${st.layers[k] ? 'on' : ''}">${t}</button>`).join('')}</div>
    </div>
    <div class="card" style="padding:10px"><div id="pmap"></div>
      <div class="sem-legend" id="mp-legend"></div></div>
    <div class="card" id="mp-list"></div>`;
  $('#mp-proj').value = st.project; $('#mp-per').value = st.per;
  const save = () => { try { localStorage.setItem('ia_map', JSON.stringify(st)); } catch {} };
  let insp = [];
  const loadInsp = async () => {
    const from = new Date(Date.now() - Number(st.per) * 86400000).toISOString();
    try { insp = await cached('map-insp:' + st.per, () => pageAll(() => sb.from('inspections').select('id,site_id,site_name,kind,started_at,flagged').eq('status', 'completada').gte('started_at', from).order('started_at').order('id'), 10000)); }
    catch { insp = []; }
  };
  await loadInsp();
  if (pmap){ pmap.remove(); pmap = null; }
  if (!window.L){ $('#pmap').innerHTML = '<p class="muted" style="padding:20px">No se pudo cargar el mapa.</p>'; return; }
  pmap = L.map('pmap', { preferCanvas: true, zoomControl: true }).setView([-34, -63], 5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap' }).addTo(pmap);
  let layer = null, data = [], fitted = false;
  const siteByName = new Map(sites.map(s => [s.name.toLowerCase(), s]));
  const taskSites = t => (t.sites || []).map(x => x.site_id || siteByName.get(String(x.site_name || '').toLowerCase())?.id).filter(Boolean);
  const cName = id => contrs.find(c => c.id === id)?.name || 'Sin asignar';

  const compute = () => {
    const proj = projects.find(p => p.id === st.project);
    const maintSites = new Set(psAll.filter(ps => ['mantenimiento', 'mixto'].includes(projects.find(p => p.id === ps.project_id)?.kind)).map(ps => ps.site_id));
    const anyProj = new Set(psAll.map(ps => ps.site_id));
    const psList = psAll.filter(ps => !st.project || ps.project_id === st.project);
    const inProj = st.project ? new Set(psList.map(ps => ps.site_id)) : null;
    const q = norm($('#mp-q').value);
    const byId = new Map();
    for (const s of sites){
      if (inProj && !inProj.has(s.id)) continue;
      if (q && !norm([s.name, s.localidad, s.provincia, s.address, ...(s.aliases || [])].join(' ')).includes(q)) continue;
      byId.set(s.id, { s, prev: null, corr: null, pend: [], inst: [], cols: {} });
    }
    for (const r of insp){ const x = byId.get(r.site_id); if (!x) continue;
      if (r.kind === 'preventivo'){ if (!x.prev || r.started_at > x.prev.started_at) x.prev = r; }
      else if (r.kind === 'correctivo'){ if (!x.corr || r.started_at > x.corr.started_at) x.corr = r; } }
    const openT = tasks.filter(t => taskOpen(t) || t.status === 'completada');
    for (const t of openT){
      if (st.project && t.project_id && t.project_id !== st.project) continue;
      for (const sid of taskSites(t)){ const x = byId.get(sid); if (!x) continue;
        if (t.is_pending) x.pend.push(t); else if (t.task_type === 'reparacion') (x.corrT = x.corrT || []).push(t); }
    }
    for (const ps of psList){ const p = projects.find(pp => pp.id === ps.project_id); if (!p || p.kind === 'mantenimiento') continue;
      const x = byId.get(ps.site_id); if (x) x.inst.push({ ps, p, st: psState(ps, p) }); }
    for (const x of byId.values()){
      const c = {};
      if (st.layers.prev) c.prev = x.prev ? (x.prev.flagged ? 'amber' : 'green') : (maintSites.has(x.s.id) || (!anyProj.has(x.s.id) && ['epi', 'sala', 'repetidora', 'shelter'].includes(x.s.kind))) ? 'gray' : 'none';
      if (st.layers.corr){ const open = (x.corrT || []).filter(taskOpen); c.corr = open.some(isOverdue) ? 'red' : open.length ? 'amber' : (x.corr || (x.corrT || []).length) ? 'green' : 'none'; }
      if (st.layers.pend){ const open = x.pend.filter(taskOpen); c.pend = open.some(t => t.priority === 'critica') ? 'red' : open.length ? 'amber' : (st.layers.prev || st.layers.corr || st.layers.inst) ? 'none' : 'green';
        x.late = open.some(pendLate); }
      if (st.layers.inst) c.inst = x.inst.length ? worstColor(x.inst.map(i => i.st.c)) : 'none';
      x.cols = c; x.color = worstColor(Object.values(c));
    }
    return [...byId.values()];
  };

  const popup = x => {
    const s = x.s, parts = [];
    if (st.layers.pend){ const open = x.pend.filter(taskOpen).sort((a, b) => (SEM[b.priority === 'critica' ? 'red' : 'amber'].o - SEM[a.priority === 'critica' ? 'red' : 'amber'].o) || pendHours(b) - pendHours(a));
      parts.push(`<div class="pp-sec">${semDot(x.cols.pend)}<b>Pendientes</b> ${open.length ? '' : '<span class="muted">sin pendientes abiertos</span>'}</div>` +
        open.slice(0, 6).map(t => `<div class="pp-it"><span class="pill ${t.priority === 'critica' ? 'p-bad' : 'p-pend'}">${PRIO_TXT[t.priority]}</span> <a href="#/tasks/${t.id}">${esc(t.title.replace(/ — .*$/, ''))}</a>
          <div class="muted sm">Abierto hace ${fmtAge(pendHours(t))}${pendLate(t) ? ' · <b style="color:var(--red)">ATRASADO</b>' : ''} · ${esc(t.contractor_id ? cName(t.contractor_id) : 'sin asignar')}</div></div>`).join('')); }
    if (st.layers.prev) parts.push(`<div class="pp-sec">${semDot(x.cols.prev)}<b>Preventivo</b> ${x.prev ? `${fmtDate(x.prev.started_at)} (hace ${daysSince(x.prev.started_at)} d)${x.prev.flagged ? ` · ${x.prev.flagged} señalados` : ''}` : '<span class="muted">sin visita en el período</span>'}</div>`);
    if (st.layers.corr){ const open = (x.corrT || []).filter(taskOpen); parts.push(`<div class="pp-sec">${semDot(x.cols.corr)}<b>Correctivos</b> ${open.length ? `${open.length} abierto${open.length === 1 ? '' : 's'}` : x.corr ? 'último ' + fmtDate(x.corr.started_at) : '<span class="muted">sin correctivos</span>'}</div>`); }
    if (st.layers.inst && x.inst.length) parts.push(x.inst.map(i => `<div class="pp-sec">${semDot(i.st.c)}<b>${esc(i.p.name)}</b> ${esc(i.st.n)}<div class="progress" style="margin-top:4px"><i style="width:${Math.round(i.st.pct)}%"></i></div></div>`).join(''));
    return `<div class="pp"><b style="font-size:15px">${esc(s.name)}</b><div class="muted sm">${esc([s.localidad, s.provincia].filter(Boolean).join(', ') || s.address || SITE_KINDS[s.kind] || '')}</div>${parts.join('')}
      <div class="row" style="margin-top:8px;gap:6px">
        <a class="btn small" target="_blank" rel="noopener noreferrer" href="${mapsLink(s.lat, s.lng)}">Cómo llegar</a>
        ${isManager() && canWrite() ? `<button class="btn sec small" data-newpend="${s.id}">+ Pendiente</button>` : ''}
        ${x.inst.length ? `<button class="btn sec small" data-goproj="${x.inst[0].p.id}">Ver proyecto</button>` : ''}
      </div></div>`;
  };

  const render = () => {
    data = compute();
    const withC = data.filter(x => x.s.lat !== null && x.s.lat !== undefined && !isNaN(Number(x.s.lat)));
    if (layer) layer.remove(); layer = L.featureGroup().addTo(pmap);
    const z = pmap.getZoom();
    const groupKey = x => z < 6 ? (x.s.provincia ? 'p:' + norm(x.s.provincia) : null) : z < 10 ? (x.s.localidad ? 'l:' + norm(x.s.localidad) + '|' + norm(x.s.provincia) : null) : null;
    const groups = new Map(), singles = [];
    for (const x of withC){ const k = groupKey(x); if (!k) singles.push(x); else { if (!groups.has(k)) groups.set(k, []); groups.get(k).push(x); } }
    for (const [k, list] of groups){
      if (list.length === 1){ singles.push(list[0]); continue; }
      const col = worstColor(list.map(x => x.color)), late = list.some(x => x.late);
      const lat = list.reduce((a, x) => a + Number(x.s.lat), 0) / list.length, lng = list.reduce((a, x) => a + Number(x.s.lng), 0) / list.length;
      const name = k.startsWith('p:') ? list[0].s.provincia : list[0].s.localidad;
      const cnt = ['red', 'amber', 'blue', 'gray', 'green'].map(c => [c, list.filter(x => x.color === c).length]).filter(c => c[1]);
      const icon = L.divIcon({ className: 'mk-wrap', iconSize: [0, 0], iconAnchor: [0, 0],
        html: `<div class="clu c-${col}${late ? ' pulse' : ''}">${esc(name || 'Grupo')} <i>${list.length}</i></div>` });
      L.marker([lat, lng], { icon, keyboard: false, riseOnHover: true }).addTo(layer)
        .bindTooltip(`<b>${esc(name)}</b><br>${cnt.map(([c, n]) => `${semDot(c)}${n}`).join(' &nbsp; ')}`, { direction: 'top', offset: [0, -14] })
        .on('click', () => pmap.fitBounds(L.latLngBounds(list.map(x => [x.s.lat, x.s.lng])), { padding: [40, 40], maxZoom: 13 }));
    }
    for (const x of singles){
      const ll = [Number(x.s.lat), Number(x.s.lng)];
      const crit = x.cols.pend === 'red';
      const html = crit ? `<div class="mk-pin${x.late ? ' pulse' : ''}"><b>!</b></div>`
        : `<div class="mk mk-${x.color}${x.late ? ' pulse' : ''}"></div>`;
      const m = L.marker(ll, { icon: L.divIcon({ className: 'mk-wrap', iconSize: [0, 0], iconAnchor: [0, 0], html }), keyboard: false, riseOnHover: true, zIndexOffset: SEM[x.color].o * 100 });
      if (z >= 10) m.bindTooltip(esc(x.s.name), { permanent: true, direction: 'right', offset: crit ? [10, -16] : [9, 0], className: 'mk-lbl' });
      m.bindPopup(() => popup(x), { maxWidth: 300, offset: crit ? [0, -26] : [0, -4] }).addTo(layer);
    }
    if (!fitted && withC.length){ fitted = true; pmap.fitBounds(L.latLngBounds(withC.map(x => [Number(x.s.lat), Number(x.s.lng)])), { padding: [30, 30], maxZoom: 12 }); }
    // leyenda con cantidades
    const cnt = c => data.filter(x => x.color === c).length;
    $('#mp-legend').innerHTML = ['red', 'amber', 'blue', 'gray', 'green'].map(c => `<span>${semDot(c)}${SEM[c].n} <b>${cnt(c)}</b></span>`).join('') +
      `<span class="muted">· ${data.length - withC.length} sin coordenadas</span>`;
    $('#mp-note').textContent = online() ? '' : 'Sin conexión: datos de la última descarga';
    renderList();
  };
  const renderList = () => {
    const pend = data.flatMap(x => x.pend.filter(taskOpen).map(t => ({ t, x })))
      .sort((a, b) => (b.t.priority === 'critica') - (a.t.priority === 'critica') || (b.t.priority === 'alta') - (a.t.priority === 'alta') || pendHours(b.t) - pendHours(a.t));
    const instAlert = data.flatMap(x => x.inst.filter(i => i.st.c === 'red' || i.st.prop).map(i => ({ ...i, x })));
    $('#mp-list').innerHTML = `
      ${st.layers.pend ? `<h2>Pendientes abiertos (${pend.length})</h2>${pend.length ? `<div class="tblwrap"><table class="tbl"><thead><tr><th>Prioridad</th><th>Pendiente</th><th>Sitio</th><th class="hide-sm">Contratista</th><th class="num">Abierto</th></tr></thead><tbody>
        ${pend.slice(0, 150).map(({ t, x }) => `<tr class="click" data-task="${t.id}"><td><span class="pill ${t.priority === 'critica' ? 'p-bad' : t.priority === 'alta' ? 'p-pend' : 'p-info'}">${PRIO_TXT[t.priority]}</span></td>
          <td><b>${esc(t.title.replace(/ — .*$/, ''))}</b></td><td>${esc(x.s.name)}<div class="muted sm">${esc(x.s.localidad || '')}</div></td>
          <td class="hide-sm">${esc(t.contractor_id ? cName(t.contractor_id) : 'Sin asignar')}</td>
          <td class="num">${fmtAge(pendHours(t))}${pendLate(t) ? '<div><span class="pill p-bad">Atrasado</span></div>' : ''}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No hay pendientes abiertos.</div>'}` : ''}
      ${st.layers.inst && instAlert.length ? `<h2 style="margin-top:16px">Instalaciones a atender (${instAlert.length})</h2><div class="tblwrap"><table class="tbl"><thead><tr><th>Estado</th><th>Sitio</th><th>Proyecto</th></tr></thead><tbody>
        ${instAlert.slice(0, 150).map(i => `<tr class="click" data-goproj="${i.p.id}"><td>${semDot(i.st.c)}${esc(i.st.n)}</td><td>${esc(i.x.s.name)}<div class="muted sm">${esc(i.x.s.localidad || '')}</div></td><td>${esc(i.p.name)}</td></tr>`).join('')}</tbody></table></div>` : ''}`;
    $('#mp-list').querySelectorAll('[data-task]').forEach(tr => tr.onclick = () => location.hash = '#/tasks/' + tr.dataset.task);
    $('#mp-list').querySelectorAll('[data-goproj]').forEach(tr => tr.onclick = () => location.hash = '#/proj/' + tr.dataset.goproj);
    if (!$('#mp-list').innerHTML.trim()) $('#mp-list').classList.add('hidden'); else $('#mp-list').classList.remove('hidden');
  };
  pmap.on('zoomend', render);
  pmap.on('popupopen', e => {
    const el = e.popup.getElement(); if (!el) return;
    el.querySelectorAll('[data-newpend]').forEach(b => b.onclick = () => { const s = sites.find(x => x.id === b.dataset.newpend); newPending(s, contrs); });
    el.querySelectorAll('[data-goproj]').forEach(b => b.onclick = () => location.hash = '#/proj/' + b.dataset.goproj);
  });
  $('#mp-layers').querySelectorAll('[data-ly]').forEach(b => b.onclick = () => {
    st.layers[b.dataset.ly] = !st.layers[b.dataset.ly];
    if (!Object.values(st.layers).some(Boolean)) st.layers[b.dataset.ly] = true;
    b.classList.toggle('on', st.layers[b.dataset.ly]); save(); render();
  });
  $('#mp-proj').onchange = () => { st.project = $('#mp-proj').value; fitted = false; save(); render(); };
  $('#mp-per').onchange = async () => { st.per = $('#mp-per').value; save(); await loadInsp(); render(); };
  let tq; $('#mp-q').oninput = () => { clearTimeout(tq); tq = setTimeout(() => { fitted = false; render(); }, 300); };
  render();
}

/* Pendiente cargado a mano (desde el mapa o un sitio) */
function newPending(site, contrs){
  if (!site) return;
  editTask(null, contrs, { task_type: 'reparacion', priority: 'critica', is_pending: true, title: '',
    due_date: addDays(todayStr(), 1), sites: [{ site_id: site.id, site_name: site.name, inspection_id: null, done: false }], contract: site.grupo || null });
}

/* =====================================================================
   PROYECTOS
   ===================================================================== */
function projSummary(p, psAll){
  const list = psAll.filter(ps => ps.project_id === p.id);
  const states = list.map(ps => psState(ps, p));
  const cnt = c => states.filter(s => s.c === c).length;
  const pct = list.length ? states.reduce((a, s) => a + s.pct, 0) / list.length : 0;
  return { list, states, pct, n: list.length, red: cnt('red'), amber: cnt('amber'), blue: cnt('blue'), gray: cnt('gray'), green: cnt('green'), props: list.filter(ps => ps.proposed_start).length };
}
const semChips = sm => ['red', 'amber', 'blue', 'gray', 'green'].filter(c => sm[c]).map(c => `<span class="semchip">${semDot(c)}${sm[c]}</span>`).join('') || '<span class="muted sm">Sin sitios</span>';

async function viewProjects(v){
  const [projects, psAll, tasks] = await Promise.all([loadProjects(), loadPS().catch(() => []), loadAllTasks().catch(() => [])]);
  const manage = isManager() && canWrite() && online();
  const actives = projects.filter(p => p.active);
  v.innerHTML = `
    <div class="card"><div class="row between"><h2 style="margin:0">Proyectos</h2>${manage ? '<button class="btn" id="pj-new">+ Proyecto</button>' : ''}</div>
      <p class="muted sm" style="margin:8px 0 0">Cada proyecto agrupa sitios (escuelas, edificios, nodos, racks…), lo que hay que instalar o mantener en cada uno, sus etapas, fechas y Gantt.</p></div>
    ${actives.length ? `<div class="pj-grid">${actives.map(p => projCard(p, psAll, tasks)).join('')}</div>` : `<div class="card"><div class="empty">${manage ? 'Todavía no hay proyectos. Creá el primero con <b>+ Proyecto</b>.' : 'No hay proyectos para mostrar.'}</div></div>`}
    ${projects.length > actives.length ? `<details class="card"><summary class="sm" style="cursor:pointer">Proyectos cerrados (${projects.length - actives.length})</summary>${projects.filter(p => !p.active).map(p => `<div class="item row between"><span>${esc(p.name)}</span><button class="btn sec small" data-open="${p.id}">Abrir</button></div>`).join('')}</details>` : ''}`;
  v.querySelectorAll('[data-open]').forEach(b => b.onclick = () => location.hash = '#/proj/' + b.dataset.open);
  $('#pj-new')?.addEventListener('click', () => editProject(null));
}
function projCard(p, psAll, tasks){
  const sm = projSummary(p, psAll);
  const sids = new Set(sm.list.map(ps => ps.site_id));
  const pend = tasks.filter(t => t.is_pending && taskOpen(t) && (t.project_id === p.id || (t.sites || []).some(s => sids.has(s.site_id))));
  const crit = pend.filter(t => t.priority === 'critica').length;
  return `<div class="card pj-card click" data-open="${p.id}">
    <div class="row between" style="align-items:flex-start"><div><b style="font-size:16px">${esc(p.name)}</b><div class="muted sm">${esc([p.client, p.contract].filter(Boolean).join(' · ') || PROJ_KIND[p.kind])}</div></div>
      <span class="pill p-info">${PROJ_KIND[p.kind]}</span></div>
    <div class="row between" style="margin-top:12px"><span class="sm">${sm.n} sitio${sm.n === 1 ? '' : 's'}${p.end_date ? ' · fin ' + fmtD(p.end_date) : ''}</span><b style="font-size:20px">${Math.round(sm.pct)}%</b></div>
    <div class="progress" style="height:8px;margin:4px 0 10px"><i style="width:${Math.round(sm.pct)}%"></i></div>
    <div class="row" style="gap:10px">${semChips(sm)}</div>
    ${pend.length || sm.props ? `<div class="sm" style="margin-top:8px">${pend.length ? `<span style="color:${crit ? 'var(--red)' : 'var(--amber)'}">⚠ ${pend.length} pendiente${pend.length === 1 ? '' : 's'}${crit ? ` (${crit} crítico${crit === 1 ? '' : 's'})` : ''}</span>` : ''}${sm.props ? ` · <span style="color:var(--navy-2)">${sm.props} fecha${sm.props === 1 ? '' : 's'} a validar</span>` : ''}</div>` : ''}
  </div>`;
}

function slug(s){ return norm(s).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30) || 'el'; }
function editProject(p){
  if (!needOnline()) return;
  const isNew = !p;
  p = p || { kind: 'instalacion', stages: DEFAULT_STAGES.instalacion, elements: [], active: true };
  let elements = (p.elements || []).map(e => ({ ...e }));
  const m = modal(`<h2>${isNew ? 'Nuevo proyecto' : 'Editar proyecto'}</h2>
    <label>Nombre</label><input id="pe-n" maxlength="160" value="${esc(p.name || '')}" placeholder="Ej.: AP Escuelas Nación · Reemplazo CCTV · Red MPLS Bs As">
    <div class="row"><div class="grow"><label>Cliente</label><input id="pe-c" maxlength="160" value="${esc(p.client || '')}"></div>
      <div class="grow"><label>Contrato / OC</label><input id="pe-k" maxlength="200" value="${esc(p.contract || '')}"></div></div>
    <div class="row"><div class="grow"><label>Tipo</label><select id="pe-t">${Object.entries(PROJ_KIND).map(([k, x]) => `<option value="${k}" ${p.kind === k ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
      <div class="grow"><label>Inicio</label><input id="pe-s" type="date" value="${esc(p.start_date || '')}"></div>
      <div class="grow"><label>Fin</label><input id="pe-e" type="date" value="${esc(p.end_date || '')}"></div></div>
    <label>Descripción</label><input id="pe-d" maxlength="2000" value="${esc(p.description || '')}">
    <label>Etapas por las que pasa cada sitio (una por renglón, en orden)</label>
    <textarea id="pe-st" style="min-height:120px">${esc((p.stages || []).join('\n'))}</textarea>
    <label>El sitio cuenta como terminado desde la etapa</label><select id="pe-ds"></select>
    <p class="muted sm" style="margin:4px 0 0">Al completar el acta de un sitio, pasa a esa etapa. Las contratistas pueden avanzar hasta ella; las siguientes (pruebas, acta firmada, certificado) las marca el supervisor o el PM.</p>
    <label>Elementos a instalar / mantener</label>
    <div id="pe-el"></div>
    <button class="btn sec small" id="pe-add" type="button" style="margin-top:6px">+ Elemento</button>
    <p class="muted sm" style="margin:6px 0 0">Ej.: Access Point (unidades, con serie) · Cámara (unidades, con serie) · Fibra óptica (metros) · Puesto de trabajo (puestos) · UPS, router, switch…</p>
    ${isNew ? '' : `<label style="display:flex;gap:8px;align-items:center;font-weight:400;margin-top:14px"><input type="checkbox" id="pe-a" style="width:auto" ${p.active ? 'checked' : ''}> Proyecto activo (desmarcar para cerrarlo)</label>`}
    <div class="err" id="pe-err"></div>
    <div class="row between" style="margin-top:10px">${!isNew && isAdmin() ? '<button class="btn danger small" id="pe-del">Eliminar proyecto</button>' : '<span></span>'}
      <div class="row"><button class="btn sec" id="pe-x">Cancelar</button><button class="btn" id="pe-ok">Guardar</button></div></div>`, { wide: true });
  const stages = () => $('#pe-st').value.split('\n').map(x => x.trim()).filter(Boolean).slice(0, 15);
  const fillDs = () => { const st = stages(); const cur = $('#pe-ds').value || p.done_stage || st[doneIdx({ stages: st })]; $('#pe-ds').innerHTML = st.map(s => `<option ${s === cur ? 'selected' : ''}>${esc(s)}</option>`).join(''); };
  const drawEl = () => {
    $('#pe-el').innerHTML = elements.map((e, i) => `<div class="row" style="margin-top:6px;flex-wrap:nowrap">
      <input data-en="${i}" class="grow" maxlength="120" value="${esc(e.name || '')}" placeholder="Nombre del elemento">
      <select data-eu="${i}" style="width:110px">${Object.entries(UNITS).map(([k, x]) => `<option value="${k}" ${e.unit === k ? 'selected' : ''}>${x}</option>`).join('')}</select>
      <label style="display:flex;gap:4px;align-items:center;margin:0;font-weight:400;white-space:nowrap"><input type="checkbox" data-es="${i}" style="width:auto" ${e.serial ? 'checked' : ''}> serie/MAC</label>
      <button class="iconbtn" data-ed="${i}" type="button" title="Quitar">✕</button></div>`).join('') || '<p class="muted sm">Sin elementos todavía.</p>';
    $('#pe-el').querySelectorAll('[data-en]').forEach(x => x.oninput = () => elements[x.dataset.en].name = x.value);
    $('#pe-el').querySelectorAll('[data-eu]').forEach(x => x.onchange = () => elements[x.dataset.eu].unit = x.value);
    $('#pe-el').querySelectorAll('[data-es]').forEach(x => x.onchange = () => elements[x.dataset.es].serial = x.checked);
    $('#pe-el').querySelectorAll('[data-ed]').forEach(x => x.onclick = () => { elements.splice(Number(x.dataset.ed), 1); drawEl(); });
  };
  $('#pe-st').oninput = fillDs; fillDs(); drawEl();
  $('#pe-t').onchange = () => { if (isNew) { $('#pe-st').value = DEFAULT_STAGES[$('#pe-t').value].join('\n'); $('#pe-ds').value = ''; fillDs(); } };
  $('#pe-add').onclick = () => { if (elements.length >= 40) return; elements.push({ name: '', unit: 'u', serial: false }); drawEl(); };
  $('#pe-x').onclick = m.close;
  $('#pe-ok').onclick = async () => {
    const st = stages();
    if (!$('#pe-n').value.trim()) return ($('#pe-err').textContent = 'Poné un nombre.');
    if (st.length < 2) return ($('#pe-err').textContent = 'Indicá al menos dos etapas.');
    if (new Set(st).size !== st.length) return ($('#pe-err').textContent = 'Hay etapas repetidas.');
    const used = new Set();
    const els = elements.filter(e => e.name.trim()).map(e => {
      let id = e.id || slug(e.name); while (used.has(id)) id += '_2'; used.add(id);
      return { id, name: e.name.trim().slice(0, 120), unit: e.unit || 'u', serial: !!e.serial };
    });
    const row = { name: $('#pe-n').value.trim(), client: $('#pe-c').value.trim() || null, contract: $('#pe-k').value.trim() || null, kind: $('#pe-t').value,
      start_date: $('#pe-s').value || null, end_date: $('#pe-e').value || null, description: $('#pe-d').value.trim() || null,
      stages: st, done_stage: $('#pe-ds').value || null, elements: els, active: isNew ? true : $('#pe-a').checked };
    if (row.start_date && row.end_date && row.end_date < row.start_date) return ($('#pe-err').textContent = 'El fin no puede ser antes del inicio.');
    $('#pe-ok').disabled = true;
    const { data, error } = isNew ? await sb.from('projects').insert({ ...row, org_id: me.org_id, created_by: me.id }).select('id').single()
                                  : await sb.from('projects').update(row).eq('id', p.id).select('id').single();
    if (error){ $('#pe-ok').disabled = false; return ($('#pe-err').textContent = /duplicate|unique/i.test(error.message) ? 'Ya existe un proyecto con ese nombre.' : errText(error)); }
    // sitios con etapas que ya no existen: vuelven a la primera
    if (!isNew){ const gone = (p.stages || []).filter(s => !st.includes(s)); if (gone.length) await sb.from('project_sites').update({ stage: st[0], last_reason: 'Se quitó la etapa del proyecto' }).eq('project_id', p.id).in('stage', gone); }
    m.close(); toast('Proyecto guardado'); location.hash = '#/proj/' + data.id; route();
  };
  $('#pe-del')?.addEventListener('click', async () => {
    const ok = prompt(`Se elimina el proyecto "${p.name}" con sus sitios, Gantt e inventario (los sitios y las inspecciones se conservan).\n\nEscribí ELIMINAR para confirmar.`);
    if ((ok || '').trim().toUpperCase() !== 'ELIMINAR') return;
    const { error } = await sb.from('projects').delete().eq('id', p.id);
    if (error) return toast(errText(error)); m.close(); toast('Proyecto eliminado'); location.hash = '#/proj';
  });
}

let PTAB = 'res';
async function viewProject(v, id){
  const [projects, psAll, sites, contrs, tasks] = await Promise.all([loadProjects(), loadPS(), loadSitesMap(), loadContractors().catch(() => []), loadAllTasks().catch(() => [])]);
  const p = projects.find(x => x.id === id);
  if (!p) throw new Error('No se encontró el proyecto (o no tenés acceso).');
  let acts = [], equip = [];
  try { acts = await cached('acts:' + id, () => sb.from('project_activities').select('*').eq('project_id', id).order('sort')); } catch {}
  try { equip = await cached('equip:' + id, () => pageAll(() => sb.from('equipment').select('*').eq('project_id', id).order('site_id').order('id'))); } catch {}
  const ctx = { p, ps: psAll.filter(x => x.project_id === id), sites, siteById: new Map(sites.map(s => [s.id, s])), contrs, tasks, acts, equip };
  try { PTAB = localStorage.getItem('ia_ptab') || PTAB; } catch {}
  const manage = isManager() && canWrite();
  const sm = projSummary(p, ctx.ps);
  v.innerHTML = `
    <div class="card"><div class="row between"><div class="row"><button class="btn sec small" data-go="#/proj">← Proyectos</button>
        <div><h1 style="margin:0">${esc(p.name)}</h1><div class="muted sm">${esc([PROJ_KIND[p.kind], p.client, p.contract].filter(Boolean).join(' · '))}${p.start_date || p.end_date ? ` · ${fmtD(p.start_date)} → ${fmtD(p.end_date)}` : ''}</div></div></div>
      ${manage && online() ? '<button class="btn sec" id="pj-edit">Editar proyecto</button>' : ''}</div>
      <div class="row" style="margin-top:12px;gap:12px"><b style="font-size:22px">${Math.round(sm.pct)}%</b><div class="progress grow" style="height:10px"><i style="width:${Math.round(sm.pct)}%"></i></div></div>
      <div class="seg" id="pj-tabs" style="margin-top:12px">${[['res', 'Resumen'], ['sit', `Sitios (${sm.n})`], ['gan', 'Gantt'], ['inv', `Inventario${equip.length ? ' (' + equip.length + ')' : ''}`]].map(([k, t]) => `<button type="button" data-pt="${k}" class="${PTAB === k ? 'on' : ''}">${t}</button>`).join('')}</div>
    </div>
    <div id="pj-body"></div>`;
  $('#pj-edit')?.addEventListener('click', () => editProject(p));
  const show = k => {
    PTAB = k; try { localStorage.setItem('ia_ptab', k); } catch {}
    $$('#pj-tabs [data-pt]').forEach(b => b.classList.toggle('on', b.dataset.pt === k));
    const body = $('#pj-body');
    if (k === 'res') projResumen(body, ctx); else if (k === 'sit') projSites(body, ctx); else if (k === 'gan') projGantt(body, ctx); else projInventory(body, ctx);
  };
  $$('#pj-tabs [data-pt]').forEach(b => b.onclick = () => show(b.dataset.pt));
  show(['res', 'sit', 'gan', 'inv'].includes(PTAB) ? PTAB : 'res');
}

/* ---------- Resumen ---------- */
function projResumen(box, ctx){
  const { p, ps } = ctx;
  const sm = projSummary(p, ps);
  const els = p.elements || [];
  const elRows = els.map(e => {
    const plan = ps.reduce((a, x) => a + Number(x.planned?.[e.id] || 0), 0), done = ps.reduce((a, x) => a + Math.min(Number(x.done?.[e.id] || 0), Number(x.planned?.[e.id] || 0) || Infinity), 0);
    return { e, plan, done };
  }).filter(r => r.plan);
  const sids = new Set(ps.map(x => x.site_id));
  const pend = ctx.tasks.filter(t => t.is_pending && taskOpen(t) && (t.project_id === p.id || (t.sites || []).some(s => sids.has(s.site_id))));
  const t = todayStr();
  const weeks = [0, 1, 2, 3].map(i => { const a = addDays(t, i * 7 - ((dOf(t).getDay() + 6) % 7)); return { a, b: addDays(a, 6) }; });
  const sName = id => ctx.siteById.get(id)?.name || '—';
  const cName = id => ctx.contrs.find(c => c.id === id)?.name || 'Sin asignar';
  box.innerHTML = `
    <div class="stats" style="margin-bottom:14px">
      <div class="stat"><span>${semDot('green')}Terminados</span><b>${sm.green}</b><small>de ${sm.n} sitios</small></div>
      <div class="stat"><span>${semDot('amber')}En curso</span><b>${sm.amber}</b></div>
      <div class="stat"><span>${semDot('blue')}Programados</span><b>${sm.blue}</b><small>${sm.props ? sm.props + ' propuesta' + (sm.props === 1 ? '' : 's') + ' a validar' : ''}</small></div>
      <div class="stat"><span>${semDot('gray')}Sin empezar</span><b>${sm.gray}</b></div>
      <div class="stat"><span>${semDot('red')}Bloqueados / vencidos</span><b style="color:${sm.red ? 'var(--red)' : 'inherit'}">${sm.red}</b></div>
      <div class="stat"><span>⚠ Pendientes abiertos</span><b style="color:${pend.some(x => x.priority === 'critica') ? 'var(--red)' : 'inherit'}">${pend.length}</b><small>${pend.filter(pendLate).length} atrasados</small></div>
    </div>
    <div class="chart-grid" style="margin-bottom:14px">
      <div class="card"><h2>Avance por elemento</h2>${elRows.length ? chartHBars(elRows.map(r => ({ label: r.e.name, v: r.plan ? r.done * 100 / r.plan : 0, display: `${fmtQty(r.done)} / ${fmtQty(r.plan)} ${UNITS[r.e.unit] === 'unidades' ? '' : UNITS[r.e.unit] || ''}`.trim(), c: 'var(--green)',
        tip: `<b>${esc(r.e.name)}</b><br>Instalado: ${fmtQty(r.done)} de ${fmtQty(r.plan)}<br>${Math.round(r.plan ? r.done * 100 / r.plan : 0)}%` })), { max: 100 }) : '<div class="empty">Cargá las cantidades previstas por sitio para ver el avance por elemento.</div>'}</div>
      <div class="card"><h2>Planificado vs real</h2>${sCurve(p, ps)}</div>
    </div>
    <div class="chart-grid">
      <div class="card"><h2>Próximas 4 semanas</h2>${weeks.map(w => { const l = ps.filter(x => (x.start_date && x.start_date <= w.b && (x.end_date || x.start_date) >= w.a) || (x.proposed_start && x.proposed_start <= w.b && (x.proposed_end || x.proposed_start) >= w.a));
        return `<div class="sub" style="margin-top:8px">Semana del ${fmtDM(w.a)} al ${fmtDM(w.b)} <span class="muted">(${l.length})</span></div>${l.slice(0, 12).map(x => `<div class="sm" style="padding:2px 0">${semDot(psState(x, p).c)}${esc(sName(x.site_id))} · <span class="muted">${esc(cName(x.contractor_id))}${x.start_date ? '' : ' · propuesta'}</span></div>`).join('') || '<div class="muted sm">Nada programado.</div>'}${l.length > 12 ? `<div class="muted sm">y ${l.length - 12} más</div>` : ''}`; }).join('')}</div>
      <div class="card"><h2>Pendientes del proyecto</h2>${pend.length ? pend.sort((a, b) => (b.priority === 'critica') - (a.priority === 'critica') || pendHours(b) - pendHours(a)).slice(0, 15).map(x => `<div class="item"><span class="pill ${x.priority === 'critica' ? 'p-bad' : 'p-pend'}">${PRIO_TXT[x.priority]}</span> <a href="#/tasks/${x.id}">${esc(x.title)}</a><div class="muted sm">hace ${fmtAge(pendHours(x))}${pendLate(x) ? ' · <b style="color:var(--red)">atrasado</b>' : ''}</div></div>`).join('') : '<div class="empty">Sin pendientes abiertos.</div>'}</div>
    </div>`;
  bindTips(box);
}
const fmtQty = n => Number.isInteger(n) ? String(n) : Number(n).toFixed(1).replace('.', ',');

/* Curva S: % de sitios terminados, planificado (por fecha de fin) vs real */
function sCurve(p, ps){
  const plan = ps.map(x => x.end_date).filter(Boolean).sort();
  const real = ps.map(x => psDoneDate(x, p)).filter(Boolean).sort();
  if (!ps.length || (!plan.length && !real.length)) return '<div class="empty">Programá fechas de fin por sitio para ver la curva.</div>';
  const start = [p.start_date, plan[0], real[0], ps.map(x => x.start_date).filter(Boolean).sort()[0]].filter(Boolean).sort()[0];
  const end = [p.end_date, plan[plan.length - 1], todayStr()].filter(Boolean).sort().pop();
  const days = Math.max(7, diffDays(start, end)), N = ps.length, W = 520, H = 200, padL = 34, padB = 22;
  const X = d => padL + diffDays(start, d) * (W - padL - 8) / days, Y = v => 8 + (H - padB - 8) * (1 - v / 100);
  const steps = (arr, upto) => { const pts = [[X(start), Y(0)]]; let n = 0; arr.filter(d => d <= upto).forEach(d => { pts.push([X(d), Y(n * 100 / N)]); n++; pts.push([X(d), Y(n * 100 / N)]); }); pts.push([X(upto), Y(n * 100 / N)]); return pts.map(q => q.map(z => z.toFixed(1)).join(',')).join(' '); };
  const t = todayStr();
  const ticks = []; for (let i = 0; i <= 4; i++){ const d = addDays(start, Math.round(days * i / 4)); ticks.push(`<text x="${X(d)}" y="${H - 6}" text-anchor="middle">${fmtDM(d)}</text>`); }
  const realPct = Math.round(real.filter(d => d <= t).length * 100 / N), planPct = Math.round(plan.filter(d => d <= t).length * 100 / N);
  return `<div class="viz-legend"><span><i style="background:#9AA5B1"></i>Planificado (${planPct}% a hoy)</span><span><i style="background:var(--green)"></i>Real (${realPct}%)</span></div>
    <svg viewBox="0 0 ${W} ${H}" class="scurve" role="img" aria-label="Curva planificado contra real">
      ${[0, 50, 100].map(v => `<line x1="${padL}" x2="${W - 8}" y1="${Y(v)}" y2="${Y(v)}" class="g"/><text x="${padL - 4}" y="${Y(v) + 4}" text-anchor="end">${v}%</text>`).join('')}
      ${t >= start && t <= end ? `<line x1="${X(t)}" x2="${X(t)}" y1="6" y2="${H - padB}" class="today"/><text x="${X(t)}" y="12" text-anchor="middle" class="tl">hoy</text>` : ''}
      <polyline points="${steps(plan, end)}" fill="none" stroke="#9AA5B1" stroke-width="2" stroke-dasharray="5 4"/>
      <polyline points="${steps(real, t < end ? t : end)}" fill="none" stroke="#22B07D" stroke-width="2.5"/>
      ${ticks.join('')}
    </svg>
    <p class="muted sm" style="margin:6px 0 0">${realPct >= planPct ? 'Vas en fecha o adelantado.' : `Vas ${planPct - realPct} puntos atrás de lo planificado.`}</p>`;
}

/* ---------- Sitios del proyecto ---------- */
const refreshProject = async () => { try { await IDB.del('kv', CUR_UID + ':ps-all'); } catch {} route(); };
function projSites(box, ctx){
  const { p, ps, siteById, contrs } = ctx;
  const manage = isManager() && canWrite();
  const els = p.elements || [];
  const cName = id => contrs.find(c => c.id === id)?.name || '';
  let sel = new Set();
  box.innerHTML = `
    <div class="card"><div class="row between"><div class="row">
        <input id="ps-q" placeholder="Buscar sitio o localidad" style="max-width:220px">
        <select id="ps-c" style="width:auto"><option value="">Todos los estados</option>${['red', 'amber', 'blue', 'gray', 'green'].map(c => `<option value="${c}">${SEM[c].n}</option>`).join('')}<option value="prop">Fechas propuestas a validar</option></select>
        ${isContractor() ? '' : `<select id="ps-k" style="width:auto"><option value="">Todas las contratistas</option><option value="__none">Sin asignar</option>${contrs.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select>`}
        <select id="ps-s" style="width:auto"><option value="">Todas las etapas</option>${(p.stages || []).map(s => `<option>${esc(s)}</option>`).join('')}</select></div>
      <div class="row">${manage && online() ? `<button class="btn sec small" id="ps-add">+ Sitios</button><label class="btn sec small" style="margin:0">Importar Excel<input type="file" accept=".xlsx,.xls,.csv" id="ps-xl" class="hidden"></label><button class="btn sec small" id="ps-model">Modelo</button>` : ''}<button class="btn sec small" id="ps-exp">Exportar Excel</button></div></div>
      <div id="ps-bulk" class="row hidden" style="margin-top:10px;background:var(--bg);padding:8px;border-radius:8px"><b id="ps-bn"></b><button class="btn small" id="ps-bc">Asignar contratista</button><button class="btn small" id="ps-bd">Programar fechas</button><button class="btn sec small" id="ps-bx">Quitar selección</button></div></div>
    <div class="card"><div class="tblwrap"><table class="tbl"><thead><tr>${manage ? '<th><input type="checkbox" id="ps-all" style="width:auto"></th>' : ''}<th>Sitio</th><th>Estado</th><th class="hide-sm">Avance</th><th>Fechas</th>${isContractor() ? '' : '<th class="hide-sm">Contratista</th>'}<th></th></tr></thead><tbody id="ps-rows"></tbody></table></div>
      <p class="muted sm" id="ps-foot"></p></div>`;
  const rowsOf = () => {
    const q = norm($('#ps-q').value), c = $('#ps-c').value, k = $('#ps-k')?.value || '', s = $('#ps-s').value;
    return ps.map(x => ({ x, site: siteById.get(x.site_id) || { name: '(sitio no visible)' }, st: psState(x, p) }))
      .filter(r => (!q || norm([r.site.name, r.site.localidad, r.site.provincia, r.site.address].join(' ')).includes(q))
        && (!c || (c === 'prop' ? !!r.x.proposed_start : r.st.c === c)) && (!k || (k === '__none' ? !r.x.contractor_id : r.x.contractor_id === k)) && (!s || r.x.stage === s))
      .sort((a, b) => (SEM[b.st.c].o - SEM[a.st.c].o) || String(a.x.start_date || a.x.proposed_start || '9').localeCompare(String(b.x.start_date || b.x.proposed_start || '9')) || a.site.name.localeCompare(b.site.name, 'es', { numeric: true }));
  };
  const render = () => {
    const rows = rowsOf();
    $('#ps-rows').innerHTML = rows.slice(0, 600).map(({ x, site, st }) => `<tr>
      ${manage ? `<td><input type="checkbox" data-sel="${x.id}" style="width:auto" ${sel.has(x.id) ? 'checked' : ''}></td>` : ''}
      <td><b>${esc(site.name)}</b><div class="muted sm">${esc([site.localidad, site.provincia].filter(Boolean).join(', ') || site.address || '')}</div></td>
      <td>${semDot(st.c)}<span class="sm">${esc(st.n)}</span></td>
      <td class="hide-sm" style="min-width:120px">${els.filter(e => Number(x.planned?.[e.id])).map(e => `<div class="sm">${esc(e.name)}: <b>${fmtQty(Number(x.done?.[e.id] || 0))}</b>/${fmtQty(Number(x.planned[e.id]))}</div>`).join('') || `<span class="muted sm">${Math.round(st.pct)}%</span>`}</td>
      <td class="sm">${x.start_date ? `${fmtDM(x.start_date)} → ${fmtDM(x.end_date)}` : '<span class="muted">Sin programar</span>'}${x.proposed_start ? `<div style="color:var(--navy-2)">⏳ Propuesta ${fmtDM(x.proposed_start)} → ${fmtDM(x.proposed_end)}</div>` : ''}</td>
      ${isContractor() ? '' : `<td class="hide-sm sm">${esc(cName(x.contractor_id)) || '<span class="muted">Sin asignar</span>'}</td>`}
      <td><button class="btn sec small" data-ps="${x.id}">Abrir</button></td></tr>`).join('') || `<tr><td colspan="7" class="muted">${ps.length ? 'Ningún sitio coincide con el filtro.' : manage ? 'Agregá sitios con <b>+ Sitios</b> o importando un Excel.' : 'Sin sitios.'}</td></tr>`;
    $('#ps-foot').textContent = rows.length > 600 ? `Se muestran 600 de ${rows.length}. Usá los filtros.` : '';
    box.querySelectorAll('[data-ps]').forEach(b => b.onclick = () => psModal(ctx, ps.find(x => x.id === b.dataset.ps)));
    box.querySelectorAll('[data-sel]').forEach(c => c.onchange = () => { c.checked ? sel.add(c.dataset.sel) : sel.delete(c.dataset.sel); bulk(); });
  };
  const bulk = () => { $('#ps-bulk').classList.toggle('hidden', !sel.size); $('#ps-bn').textContent = `${sel.size} seleccionado${sel.size === 1 ? '' : 's'}`; };
  $('#ps-all')?.addEventListener('change', e => { rowsOf().forEach(r => e.target.checked ? sel.add(r.x.id) : sel.delete(r.x.id)); render(); bulk(); });
  ['#ps-c', '#ps-k', '#ps-s'].forEach(s => $(s) && ($(s).onchange = render)); $('#ps-q').oninput = render;
  $('#ps-bx')?.addEventListener('click', () => { sel = new Set(); render(); bulk(); });
  $('#ps-bc')?.addEventListener('click', () => bulkContractor(ctx, [...sel]));
  $('#ps-bd')?.addEventListener('click', () => bulkDates(ctx, [...sel]));
  $('#ps-add')?.addEventListener('click', () => addSitesModal(ctx));
  $('#ps-model')?.addEventListener('click', () => downloadScopeModel(p));
  $('#ps-xl')?.addEventListener('change', e => importScope(e.target.files[0], ctx));
  $('#ps-exp').onclick = () => exportProjectSites(ctx);
  render();
}

function psModal(ctx, x){
  const { p, siteById, contrs } = ctx;
  const site = siteById.get(x.site_id) || { name: '—' };
  const st = psState(x, p);
  const manage = isManager() && canWrite();
  const mine = isContractor() && me.contractor_id === x.contractor_id;
  const cName = id => contrs.find(c => c.id === id)?.name || 'Sin asignar';
  const insp = ctx.equip.filter(e => e.site_id === x.site_id);
  const m = modal(`<div class="row between"><div><h2 style="margin:0">${esc(site.name)}</h2><div class="muted sm">${esc([site.localidad, site.provincia, site.address].filter(Boolean).join(' · '))}</div></div><button class="btn sec small" id="pm-x">Cerrar</button></div>
    <div class="banner ${st.c === 'red' ? 'off' : st.c === 'green' ? 'trial' : 'warn'}" style="margin:12px 0"><span class="dot" style="background:${SEM[st.c].c}"></span><div><b>${esc(st.n)}</b><div class="sm">Etapa: ${esc(x.stage)} · Contratista: ${esc(cName(x.contractor_id))}</div></div></div>
    <div class="stats"><div class="stat"><span>Programado</span><b style="font-size:16px">${x.start_date ? fmtDM(x.start_date) + ' → ' + fmtDM(x.end_date) : '—'}</b></div>
      <div class="stat"><span>Propuesta de la contratista</span><b style="font-size:16px">${x.proposed_start ? fmtDM(x.proposed_start) + ' → ' + fmtDM(x.proposed_end) : '—'}</b><small>${esc(x.proposal_note || '')}</small></div>
      <div class="stat"><span>Avance</span><b style="font-size:16px">${Math.round(st.pct)}%</b></div></div>
    ${(p.elements || []).filter(e => Number(x.planned?.[e.id])).length ? `<div class="sm" style="margin-top:10px">${(p.elements || []).filter(e => Number(x.planned?.[e.id])).map(e => `${esc(e.name)}: <b>${fmtQty(Number(x.done?.[e.id] || 0))}</b> de ${fmtQty(Number(x.planned[e.id]))}`).join(' · ')}</div>` : ''}
    ${insp.length ? `<div class="sm muted" style="margin-top:6px">${insp.filter(e => e.status === 'instalado').length} de ${insp.length} equipos del inventario instalados.</div>` : ''}
    <div class="row" style="margin-top:14px;gap:6px">
      ${(manage || mine || me.role === 'inspector') && canWrite() ? '<button class="btn small" id="pm-prog">Cargar avance</button>' : ''}
      ${(manage || mine) && canWrite() ? `<button class="btn sec small" id="pm-acta">Cargar acta</button>` : ''}
      ${manage ? '<button class="btn sec small" id="pm-dates">Programar fechas</button>' : ''}
      ${mine && canWrite() ? '<button class="btn sec small" id="pm-prop">Proponer fechas</button>' : ''}
      ${x.proposed_start && isValidator() && canWrite() ? '<button class="btn small" id="pm-val">Validar propuesta</button>' : ''}
      ${manage ? '<button class="btn sec small" id="pm-ctr">Contratista</button>' : ''}
      ${site.lat ? `<a class="btn sec small" target="_blank" rel="noopener noreferrer" href="${mapsLink(site.lat, site.lng)}">Cómo llegar</a>` : ''}
      ${x.last_inspection_id ? `<button class="btn sec small" id="pm-inf">Ver última acta</button>` : ''}
    </div>
    ${x.notes ? `<p class="sm" style="white-space:pre-wrap">${esc(x.notes)}</p>` : ''}
    <h3 style="margin-top:16px">Historial</h3>
    <div class="sm" style="max-height:220px;overflow:auto">${(x.history || []).slice().reverse().map(h => `<div style="padding:4px 0;border-bottom:1px solid var(--line)">${fmtDT(h.at)} · <b>${esc(h.by || '')}</b> · ${esc(h.tipo)}${h.de ? ': ' + esc(typeof h.de === 'string' ? h.de : JSON.stringify(h.de)) + ' →' : ':'} ${esc(typeof h.a === 'string' ? h.a : h.a ? Object.entries(h.a).map(([k, n]) => (p.elements || []).find(e => e.id === k)?.name + ' ' + n).join(', ') : '')}${h.motivo ? ` <span class="muted">(${esc(h.motivo)})</span>` : ''}</div>`).join('') || '<span class="muted">Sin movimientos.</span>'}</div>
    ${manage && online() ? '<div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn danger small" id="pm-rm">Quitar del proyecto</button></div>' : ''}`, { wide: true });
  $('#pm-x').onclick = m.close;
  $('#pm-inf')?.addEventListener('click', () => { m.close(); location.hash = '#/informe/' + x.last_inspection_id; });
  $('#pm-prog')?.addEventListener('click', () => progressModal(ctx, x));
  $('#pm-dates')?.addEventListener('click', () => datesModal(ctx, [x]));
  $('#pm-prop')?.addEventListener('click', () => proposeModal(x));
  $('#pm-val')?.addEventListener('click', () => validateModal(x));
  $('#pm-ctr')?.addEventListener('click', () => bulkContractor(ctx, [x.id]));
  $('#pm-acta')?.addEventListener('click', () => startActa(ctx, x, site));
  $('#pm-rm')?.addEventListener('click', async () => {
    if (!confirm(`¿Quitar "${site.name}" del proyecto? El sitio y sus inspecciones se conservan.`)) return;
    const { error } = await sb.from('project_sites').delete().eq('id', x.id); if (error) return toast(errText(error));
    m.close(); toast('Sitio quitado del proyecto'); refreshProject();
  });
}

function progressModal(ctx, x){
  if (!needOnline()) return;
  const { p } = ctx;
  const els = (p.elements || []).filter(e => Number(x.planned?.[e.id]) || Number(x.done?.[e.id]));
  const limit = isContractor() ? doneIdx(p) : (p.stages || []).length - 1;
  const m = modal(`<h2>Cargar avance</h2>
    <label>Etapa</label><select id="pg-st">${(p.stages || []).map((s, i) => `<option ${s === x.stage ? 'selected' : ''} ${i > limit ? 'disabled' : ''}>${esc(s)}</option>`).join('')}</select>
    ${isContractor() ? `<p class="muted sm" style="margin:4px 0 0">Las etapas posteriores a "${esc((p.stages || [])[doneIdx(p)])}" las marca el supervisor o el PM.</p>` : ''}
    ${els.length ? `<label>Cantidades instaladas</label>${els.map(e => `<div class="row" style="margin-top:4px"><span class="grow sm">${esc(e.name)} <span class="muted">(previsto ${fmtQty(Number(x.planned?.[e.id] || 0))} ${esc(UNITS[e.unit] || '')})</span></span><input type="number" min="0" step="any" data-q="${esc(e.id)}" value="${Number(x.done?.[e.id] || 0)}" style="width:110px"></div>`).join('')}` : ''}
    <label style="display:flex;gap:8px;align-items:center;font-weight:400;margin-top:14px"><input type="checkbox" id="pg-b" style="width:auto" ${x.blocked ? 'checked' : ''}> Bloqueado (no se puede avanzar)</label>
    <label>Motivo / observación</label><input id="pg-r" maxlength="500" placeholder="Ej.: escuela cerrada · sin energía · faltan materiales" value="${esc(x.blocked ? x.block_reason || '' : '')}">
    <div class="err" id="pg-err"></div>
    <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn sec" id="pg-x">Cancelar</button><button class="btn" id="pg-ok">Guardar</button></div>`);
  $('#pg-x').onclick = m.close;
  $('#pg-ok').onclick = async () => {
    const done = {}; let bad = false;
    m.el.querySelectorAll('[data-q]').forEach(i => { const n = Number(i.value); if (i.value === '' || isNaN(n) || n < 0) bad = true; else done[i.dataset.q] = n; });
    if (bad) return ($('#pg-err').textContent = 'Revisá las cantidades.');
    const blocked = $('#pg-b').checked, reason = $('#pg-r').value.trim();
    if (blocked && !reason) return ($('#pg-err').textContent = 'Indicá por qué está bloqueado.');
    $('#pg-ok').disabled = true;
    const { error } = await sb.rpc('ps_progress', { p_ps: x.id, p_stage: $('#pg-st').value, p_done: els.length ? done : null, p_blocked: blocked, p_reason: reason || null });
    if (error){ $('#pg-ok').disabled = false; return ($('#pg-err').textContent = errText(error)); }
    m.close(); toast('Avance guardado'); refreshProject();
  };
}
function datesModal(ctx, list){
  if (!needOnline()) return;
  const x = list[0], had = list.some(y => y.start_date);
  const m = modal(`<h2>Programar fechas${list.length > 1 ? ` · ${list.length} sitios` : ''}</h2>
    <div class="row"><div class="grow"><label>Inicio</label><input id="dt-s" type="date" value="${esc(list.length === 1 ? x.start_date || x.proposed_start || '' : '')}"></div>
      <div class="grow"><label>Fin</label><input id="dt-e" type="date" value="${esc(list.length === 1 ? x.end_date || x.proposed_end || '' : '')}"></div></div>
    <label>Motivo ${had ? '(obligatorio: es una reprogramación)' : '(opcional)'}</label><input id="dt-r" maxlength="400" placeholder="Queda en el historial">
    ${list.length === 1 && x.start_date ? '<button class="link" id="dt-clr" style="margin-top:8px">Quitar fechas</button>' : ''}
    <div class="err" id="dt-err"></div>
    <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn sec" id="dt-x">Cancelar</button><button class="btn" id="dt-ok">Guardar</button></div>`);
  $('#dt-x').onclick = m.close;
  const save = async (s, e) => {
    const r = $('#dt-r').value.trim();
    if (had && !r) return ($('#dt-err').textContent = 'Indicá el motivo de la reprogramación.');
    if (s && e && e < s) return ($('#dt-err').textContent = 'El fin no puede ser antes del inicio.');
    if ((s && !e) || (!s && e)) return ($('#dt-err').textContent = 'Completá inicio y fin.');
    $('#dt-ok').disabled = true;
    const { error } = await sb.from('project_sites').update({ start_date: s, end_date: e, last_reason: r || null }).in('id', list.map(y => y.id));
    if (error){ $('#dt-ok').disabled = false; return ($('#dt-err').textContent = errText(error)); }
    m.close(); toast('Fechas guardadas'); refreshProject();
  };
  $('#dt-ok').onclick = () => save($('#dt-s').value || null, $('#dt-e').value || null);
  $('#dt-clr')?.addEventListener('click', () => save(null, null));
}
function proposeModal(x){
  if (!needOnline()) return;
  const m = modal(`<h2>Proponer fechas</h2><p class="muted sm" style="margin-top:-6px">El supervisor o el PM las valida. Hasta entonces quedan como propuesta.</p>
    <div class="row"><div class="grow"><label>Inicio</label><input id="pp-s" type="date" value="${esc(x.proposed_start || '')}" min="${todayStr()}"></div><div class="grow"><label>Fin</label><input id="pp-e" type="date" value="${esc(x.proposed_end || '')}" min="${todayStr()}"></div></div>
    <label>Comentario</label><input id="pp-n" maxlength="500" placeholder="Ej.: llevamos 2 técnicos, necesitamos acceso desde las 8">
    <div class="err" id="pp-err"></div>
    <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn sec" id="pp-x">Cancelar</button><button class="btn" id="pp-ok">Enviar propuesta</button></div>`);
  $('#pp-x').onclick = m.close;
  $('#pp-ok').onclick = async () => {
    const s = $('#pp-s').value, e = $('#pp-e').value;
    if (!s || !e) return ($('#pp-err').textContent = 'Completá inicio y fin.');
    const { error } = await sb.rpc('ps_propose', { p_ps: x.id, p_start: s, p_end: e, p_note: $('#pp-n').value.trim() || null });
    if (error) return ($('#pp-err').textContent = errText(error));
    m.close(); toast('Propuesta enviada'); refreshProject();
  };
}
function validateModal(x){
  if (!needOnline()) return;
  const m = modal(`<h2>Validar fechas propuestas</h2>
    <p>La contratista propone <b>${fmtD(x.proposed_start)} → ${fmtD(x.proposed_end)}</b>${x.proposal_note ? `<br><span class="muted">${esc(x.proposal_note)}</span>` : ''}</p>
    <details><summary class="sm" style="cursor:pointer">Aprobar con otras fechas</summary>
      <div class="row"><div class="grow"><label>Inicio</label><input id="vl-s" type="date" value="${esc(x.proposed_start)}"></div><div class="grow"><label>Fin</label><input id="vl-e" type="date" value="${esc(x.proposed_end)}"></div></div></details>
    <label>Comentario</label><input id="vl-c" maxlength="400" placeholder="Obligatorio si la rechazás">
    <div class="err" id="vl-err"></div>
    <div class="row between" style="margin-top:10px"><button class="btn sec" id="vl-x">Cancelar</button><div class="row"><button class="btn danger" id="vl-no">Rechazar</button><button class="btn" id="vl-ok">Aprobar</button></div></div>`);
  $('#vl-x').onclick = m.close;
  const send = async ok => {
    const c = $('#vl-c').value.trim();
    if (!ok && !c) return ($('#vl-err').textContent = 'Contale a la contratista por qué la rechazás.');
    const s = $('#vl-s').value, e = $('#vl-e').value;
    const changed = s !== x.proposed_start || e !== x.proposed_end;
    const { error } = await sb.rpc('ps_review', { p_ps: x.id, p_approve: ok, p_start: ok && changed ? s : null, p_end: ok && changed ? e : null, p_comment: c || null });
    if (error) return ($('#vl-err').textContent = errText(error));
    m.close(); toast(ok ? 'Fechas validadas' : 'Propuesta rechazada'); refreshProject();
  };
  $('#vl-ok').onclick = () => send(true); $('#vl-no').onclick = () => send(false);
}
function bulkContractor(ctx, ids){
  if (!needOnline() || !ids.length) return;
  const act = ctx.contrs.filter(c => c.active);
  const m = modal(`<h2>Asignar contratista${ids.length > 1 ? ` · ${ids.length} sitios` : ''}</h2>
    <select id="bc-c"><option value="">— Sin asignar —</option>${act.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select>
    <label>Motivo (opcional)</label><input id="bc-r" maxlength="400">
    <label style="display:flex;gap:8px;align-items:center;font-weight:400"><input type="checkbox" id="bc-wa" style="width:auto" checked> Avisar por WhatsApp</label>
    <div class="err" id="bc-err"></div>
    <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn sec" id="bc-x">Cancelar</button><button class="btn" id="bc-ok">Asignar</button></div>`);
  $('#bc-x').onclick = m.close;
  $('#bc-ok').onclick = async () => {
    const cid = $('#bc-c').value || null, wa = $('#bc-wa').checked;
    const { error } = await sb.from('project_sites').update({ contractor_id: cid, last_reason: $('#bc-r').value.trim() || null }).in('id', ids);
    if (error) return ($('#bc-err').textContent = errText(error));
    m.close(); toast('Contratista asignada');
    const c = act.find(z => z.id === cid);
    if (c && wa){
      if (!c.phone) toast('La contratista no tiene WhatsApp cargado.');
      else {
        const names = ids.map(i => ctx.siteById.get(ctx.ps.find(x => x.id === i)?.site_id)).filter(Boolean);
        const txt = [`Hola ${c.contact_name || c.name}, se te asignaron ${ids.length} sitio${ids.length === 1 ? '' : 's'} del proyecto *${ctx.p.name}* en InspectApp:`, '',
          ...names.slice(0, 25).map(s => `• ${s.name}${s.localidad ? ' (' + s.localidad + ')' : ''}${s.lat ? ' 📍 https://maps.google.com/?q=' + Number(s.lat).toFixed(6) + ',' + Number(s.lng).toFixed(6) : ''}`),
          names.length > 25 ? `y ${names.length - 25} más` : '', '', 'Proponé las fechas desde la app:', `${location.origin + location.pathname}#/proj/${ctx.p.id}`].filter(z => z !== '');
        window.open(`https://wa.me/${waPhone(c.phone)}?text=${encodeURIComponent(txt.join('\n'))}`, '_blank', 'noopener');
      }
    }
    refreshProject();
  };
}
function bulkDates(ctx, ids){ datesModal(ctx, ctx.ps.filter(x => ids.includes(x.id))); }

async function startActa(ctx, x, site){
  let tpls = [];
  try { tpls = await cached('tpl-pub', () => sb.from('templates').select('id,name,kind,definition').eq('published', true).order('name')); } catch (e){ return toast(errText(e)); }
  if (!tpls.length) return toast('No hay plantillas publicadas.');
  const pref = tpls.find(t => /acta/i.test(t.name) && norm(t.name).includes(norm(ctx.p.name).split(' ')[0])) || tpls.find(t => /acta|instalaci/i.test(t.name)) || tpls.find(t => /cierre de tarea/i.test(t.name)) || tpls[0];
  const m = modal(`<h2>Cargar acta · ${esc(site.name)}</h2><label>Planilla</label><select id="ac-t">${tpls.map(t => `<option value="${t.id}" ${t.id === pref.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select>
    <p class="muted sm">Al completarla, el sitio pasa a la etapa "${esc((ctx.p.stages || [])[doneIdx(ctx.p)])}". Funciona sin señal: se envía sola al volver la conexión.</p>
    <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn sec" id="ac-x">Cancelar</button><button class="btn" id="ac-ok">Comenzar</button></div>`);
  $('#ac-x').onclick = m.close;
  $('#ac-ok').onclick = async () => {
    const tpl = tpls.find(t => t.id === $('#ac-t').value);
    $('#ac-ok').disabled = true; const pos = await getPos();
    const rec = { id: uid(), org_id: me.org_id, template_id: tpl.id, template_name: tpl.name, template_snapshot: tpl.definition,
      site_id: site.id || null, site_name: site.name, traza: site.traza || null, kind: 'otro', status: 'borrador',
      inspector_id: me.id, inspector_name: me.full_name || me.email, started_at: new Date().toISOString(), completed_at: null,
      answers: {}, score: 0, max_score: 0, flagged: 0, flagged_items: [], lat: pos?.lat ?? null, lng: pos?.lng ?? null,
      task_id: null, project_site_id: x.id, _synced: false };
    await localSave(rec); $('#modal-root').innerHTML = ''; location.hash = '#/insp/' + rec.id;
  };
}

function addSitesModal(ctx){
  if (!needOnline()) return;
  const inP = new Set(ctx.ps.map(x => x.site_id));
  const avail = ctx.sites.filter(s => !inP.has(s.id));
  const grupos = [...new Set(avail.map(s => s.grupo).filter(Boolean))].sort();
  const els = ctx.p.elements || [];
  let chosen = new Set();
  const m = modal(`<h2>Agregar sitios al proyecto</h2>
    <div class="row"><input id="as-q" class="grow" placeholder="Buscar (${avail.length} sitios disponibles)">${grupos.length ? `<select id="as-g" style="width:auto"><option value="">Todos los grupos</option>${grupos.map(g => `<option>${esc(g)}</option>`).join('')}</select>` : ''}</div>
    <div class="row" style="margin-top:6px"><button class="link" id="as-all">Seleccionar los visibles</button><span class="muted sm" id="as-n"></span></div>
    <div id="as-list" style="max-height:260px;overflow:auto;margin-top:6px;border:1px solid var(--line);border-radius:8px;padding:4px 8px"></div>
    ${els.length ? `<label>Cantidades previstas por sitio (se pueden cambiar después)</label><div class="row">${els.map(e => `<label class="sm" style="font-weight:400;margin:0">${esc(e.name)} <input type="number" min="0" step="any" data-pq="${esc(e.id)}" style="width:80px"></label>`).join('')}</div>` : ''}
    <p class="muted sm">¿El sitio no existe todavía? Cargalo en la pestaña Sitios o importá el Excel del proyecto (crea los sitios que falten).</p>
    <div class="err" id="as-err"></div>
    <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn sec" id="as-x">Cancelar</button><button class="btn" id="as-ok">Agregar</button></div>`, { wide: true });
  const vis = () => { const q = norm($('#as-q').value), g = $('#as-g')?.value || ''; return avail.filter(s => (!g || s.grupo === g) && (!q || norm([s.name, s.localidad, s.provincia, s.grupo].join(' ')).includes(q))); };
  const draw = () => { const l = vis(); $('#as-list').innerHTML = l.slice(0, 400).map(s => `<label style="display:flex;gap:8px;font-weight:400;margin:4px 0"><input type="checkbox" data-as="${s.id}" style="width:auto" ${chosen.has(s.id) ? 'checked' : ''}> ${esc(s.name)} <span class="muted sm">${esc([s.localidad, s.grupo].filter(Boolean).join(' · '))}</span></label>`).join('') || '<p class="muted sm">Sin resultados.</p>';
    $('#as-list').querySelectorAll('[data-as]').forEach(c => c.onchange = () => { c.checked ? chosen.add(c.dataset.as) : chosen.delete(c.dataset.as); $('#as-n').textContent = `${chosen.size} elegidos`; }); };
  $('#as-q').oninput = draw; $('#as-g') && ($('#as-g').onchange = draw);
  $('#as-all').onclick = () => { vis().slice(0, 400).forEach(s => chosen.add(s.id)); draw(); $('#as-n').textContent = `${chosen.size} elegidos`; };
  $('#as-x').onclick = m.close; draw();
  $('#as-ok').onclick = async () => {
    if (!chosen.size) return ($('#as-err').textContent = 'Elegí al menos un sitio.');
    const planned = {}; m.el.querySelectorAll('[data-pq]').forEach(i => { if (Number(i.value) > 0) planned[i.dataset.pq] = Number(i.value); });
    $('#as-ok').disabled = true;
    const rows = [...chosen].map(site_id => ({ org_id: me.org_id, project_id: ctx.p.id, site_id, planned }));
    for (let i = 0; i < rows.length; i += 200){
      const { error } = await sb.from('project_sites').insert(rows.slice(i, i + 200));
      if (error){ $('#as-ok').disabled = false; return ($('#as-err').textContent = errText(error)); }
    }
    m.close(); toast(`${rows.length} sitios agregados`); refreshProject();
  };
}

/* =====================================================================
   EXCEL — lectura segura y exportación
   ===================================================================== */
const XL_MAX_BYTES = 15 * 1024 * 1024, XL_MAX_ROWS = 20000, XL_MAX_COLS = 200;
async function readWorkbook(file){
  if (!window.XLSX) throw new Error('No se pudo cargar el lector de Excel.');
  if (!file) throw new Error('No se eligió archivo.');
  if (file.size > XL_MAX_BYTES) throw new Error('El archivo supera 15 MB.');
  if (!/\.(xlsx|xlsm|xls|csv)$/i.test(file.name)) throw new Error('El archivo tiene que ser Excel (.xlsx / .xls) o .csv');
  // Sin fórmulas, macros, estilos ni HTML: solo los valores de las celdas
  return XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true, cellFormula: false, cellHTML: false, cellStyles: false, bookVBA: false, sheetRows: XL_MAX_ROWS + 50 });
}
function sheetRows(ws){
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true, blankrows: false });
  return rows.slice(0, XL_MAX_ROWS).map(r => r.slice(0, XL_MAX_COLS).map(c => c instanceof Date ? c : typeof c === 'string' ? c.slice(0, 2000) : c));
}
/* Al exportar: las celdas de texto que empiezan con = + - @ se guardan como texto con ' delante,
   así nadie puede esconder una fórmula que se ejecute al abrir el archivo (CSV/Excel). */
const xlCell = c => typeof c === 'string' && /^[=+\-@\t\r]/.test(c) ? "'" + c : c;
function xlSheet(aoa){ return XLSX.utils.aoa_to_sheet(aoa.map(r => r.map(xlCell))); }
function xlSave(name, sheets){
  const wb = XLSX.utils.book_new();
  for (const [n, aoa, cols] of sheets){ const ws = xlSheet(aoa); if (cols) ws['!cols'] = cols.map(w => ({ wch: w })); XLSX.utils.book_append_sheet(wb, ws, n.slice(0, 31)); }
  XLSX.writeFile(wb, name.replace(/[\\/:*?"<>|]/g, '').slice(0, 120) + '.xlsx');
}
function xlDate(v){
  if (v instanceof Date && !isNaN(v)) return dStr(new Date(v.getTime() + 12 * 3600000));
  if (typeof v === 'number' && v > 20000 && v < 80000){ const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000); return dStr(new Date(d.getTime() + 12 * 3600000)); }
  const s = String(v || '').trim(); let m;
  if ((m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/.exec(s))){ const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]); return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
  if ((m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s))) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}
const xlStr = v => v instanceof Date ? dStr(v) : String(v ?? '').trim();
const xlNumber = v => {
  if (v === '' || v === null || v === undefined) return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  let t = String(v).trim();
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, '').replace(',', '.'); else t = t.replace(',', '.');
  const n = Number(t); return isNaN(n) ? null : n;
};

/* ---------- Alcance del proyecto desde Excel (una fila por sitio) ---------- */
function downloadScopeModel(p){
  const els = p.elements || [];
  xlSave('Modelo_sitios_' + p.name, [
    ['Sitios', [['Sitio', 'Localidad', 'Provincia', 'Dirección', 'Latitud', 'Longitud', 'Tipo', 'Código / otros nombres', 'Contratista', 'Inicio', 'Fin', 'Etapa', ...els.map(e => e.name)],
      ['Escuela N° 12 Gral. San Martín', 'Rosario', 'Santa Fe', 'Mitre 1234', -32.9468, -60.6393, 'Escuela', 'CUE 820001200', '', '', '', '', ...els.map(() => 1)]], [32, 18, 16, 28, 11, 11, 12, 22, 18, 11, 11, 14, ...els.map(() => 12)]],
    ['Instrucciones', [['Una fila por sitio. Obligatorio: Sitio.'], ['Si el sitio no existe en InspectApp se crea; si ya existe (mismo nombre) se usa el existente.'],
      ['Una columna por cada elemento del proyecto con la cantidad prevista (podés agregar otras columnas: al importar elegís cuál es cuál).'],
      ['Latitud / Longitud en grados decimales (ej.: -34.6037). Inicio / Fin en formato dd/mm/aaaa.'],
      ['Contratista: tiene que llamarse igual que en Tareas → Contratistas. Etapa: una de las etapas del proyecto.']], [110]]]);
}
async function importScope(file, ctx){
  if (!file) return;
  let wb; try { wb = await readWorkbook(file); } catch (e){ return toast('No se pudo leer el Excel: ' + errText(e)); }
  // hoja con encabezado que tenga "sitio" o "nombre"
  let rows = null, hi = -1, sheet = null;
  for (const n of wb.SheetNames){ const r = sheetRows(wb.Sheets[n]); const i = r.slice(0, 15).findIndex(x => x.some(c => /^(sitio|nombre)/.test(norm(c)))); if (i >= 0){ rows = r; hi = i; sheet = n; break; } }
  if (!rows) return toast('No encontré una columna "Sitio" o "Nombre". Descargá el modelo.');
  const head = rows[hi].map(c => xlStr(c)), H = head.map(norm);
  const find = (...res) => H.findIndex(h => res.some(re => re.test(h)));
  const C = { n: find(/^sitio$/, /^nombre/, /^sitio/), loc: find(/^localidad/, /^ciudad/), prov: find(/^provincia/), addr: find(/^direcc/, /^ubicaci/, /^domicilio/), lat: find(/^lat/), lng: find(/^lon|^lng/),
    kind: find(/^tipo$/, /^tipo de sitio/), alias: find(/^codigo/, /^cue/, /otros nombres/), ctr: find(/^contratista/, /^cuadrilla/), s: find(/^inicio/, /^fecha inicio/), e: find(/^fin$/, /^fecha fin/), st: find(/^etapa/, /^estado$/) };
  const els = ctx.p.elements || [];
  const guess = e => { const n = norm(e.name), ns = n.replace(/s$/, ''); let i = H.findIndex(h => h === n); if (i < 0) i = H.findIndex(h => /^total/.test(h) && h.includes(ns)); if (i < 0) i = H.findIndex(h => h.includes(ns)); return i; };
  const data = rows.slice(hi + 1).filter(r => xlStr(r[C.n]) && !/^total/i.test(xlStr(r[C.n])) && !/^total/i.test(xlStr(r[0])));
  const m = modal(`<h2>Importar sitios del proyecto</h2>
    <p>Hoja <b>${esc(sheet)}</b>: <b>${data.length}</b> filas.</p>
    <div class="row"><div class="grow"><label>Columna con el nombre del sitio</label><select id="is-n">${head.map((h, i) => `<option value="${i}" ${i === C.n ? 'selected' : ''}>${esc(h || 'Columna ' + (i + 1))}</option>`).join('')}</select></div></div>
    ${els.length ? `<label>Columna con la cantidad prevista de cada elemento</label>${els.map(e => `<div class="row" style="margin-top:4px"><span class="grow sm">${esc(e.name)}</span><select data-ec="${esc(e.id)}" style="width:auto"><option value="-1">— no cargar —</option>${head.map((h, i) => `<option value="${i}" ${i === guess(e) ? 'selected' : ''}>${esc(h || 'Columna ' + (i + 1))}</option>`).join('')}</select></div>`).join('')}` : '<p class="muted sm">El proyecto no tiene elementos cargados: solo se importan los sitios (podés agregar elementos desde Editar proyecto).</p>'}
    <label>Tipo para los sitios nuevos</label><select id="is-k">${Object.entries(SITE_KINDS).map(([k, t]) => `<option value="${k}" ${k === (C.kind >= 0 ? '' : 'escuela') ? 'selected' : ''}>${t}</option>`).join('')}</select>
    <p class="muted sm" style="margin:4px 0 0">${C.kind >= 0 ? 'Si la fila trae la columna Tipo, se usa esa.' : ''} Sitios con el mismo nombre que uno existente se reutilizan (no se duplican).</p>
    <div class="err" id="is-err"></div>
    <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn sec" id="is-x">Cancelar</button><button class="btn" id="is-ok">Importar</button></div>`, { wide: true });
  $('#is-x').onclick = m.close;
  $('#is-ok').onclick = async () => {
    if (!needOnline()) return;
    const cn = Number($('#is-n').value), map = {}; m.el.querySelectorAll('[data-ec]').forEach(s => { if (Number(s.value) >= 0) map[s.dataset.ec] = Number(s.value); });
    const byName = new Map(ctx.sites.map(s => [norm(s.name), s]));
    const ctrBy = new Map(ctx.contrs.map(c => [norm(c.name), c.id]));
    const recs = []; const seen = new Set();
    for (const r of rows.slice(hi + 1)){
      const name = xlStr(r[cn]).slice(0, 200); if (!name || /^total/i.test(name) || /^total/i.test(xlStr(r[0]))) continue;
      if (seen.has(norm(name))) continue; seen.add(norm(name));
      const g = k => C[k] >= 0 ? r[C[k]] : '';
      const planned = {}; for (const [k, i] of Object.entries(map)){ const n = xlNumber(r[i]); if (n !== null && n > 0) planned[k] = n; }
      const lat = xlNumber(g('lat')), lng = xlNumber(g('lng'));
      recs.push({ name, site: { name, kind: C.kind >= 0 && xlStr(g('kind')) ? siteKind(xlStr(g('kind'))) : $('#is-k').value, localidad: xlStr(g('loc')).slice(0, 120) || null, provincia: xlStr(g('prov')).slice(0, 120) || null,
        address: xlStr(g('addr')).slice(0, 300) || null, lat: lat !== null && Math.abs(lat) <= 90 ? lat : null, lng: lng !== null && Math.abs(lng) <= 180 ? lng : null,
        aliases: xlStr(g('alias')) ? xlStr(g('alias')).split(',').map(x => x.trim().slice(0, 80)).filter(Boolean).slice(0, 10) : [] },
        planned, contractor_id: ctrBy.get(norm(xlStr(g('ctr')))) || null, start_date: xlDate(g('s')), end_date: xlDate(g('e')),
        stage: (ctx.p.stages || []).find(s => norm(s) === norm(xlStr(g('st')))) || '' });
    }
    if (!recs.length) return ($('#is-err').textContent = 'No hay filas con nombre de sitio.');
    $('#is-ok').disabled = true; $('#is-ok').textContent = 'Importando…';
    try {
      // 1) sitios que faltan
      const nuevos = recs.filter(r => !byName.has(norm(r.name))).map(r => ({ ...r.site, org_id: me.org_id, grupo: ctx.p.name.slice(0, 200) }));
      for (let i = 0; i < nuevos.length; i += 200){
        const { data, error } = await sb.from('sites').insert(nuevos.slice(i, i + 200)).select(SITE_MAP_COLS);
        if (error) throw error; (data || []).forEach(s => byName.set(norm(s.name), s));
      }
      // completar localidad / coordenadas de sitios existentes que no las tenían
      for (const r of recs){ const s = byName.get(norm(r.name)); if (!s || nuevos.some(n => n.name === r.name)) continue;
        const upd = {}; ['localidad', 'provincia', 'address', 'lat', 'lng'].forEach(k => { if ((s[k] === null || s[k] === undefined || s[k] === '') && r.site[k] !== null && r.site[k] !== undefined) upd[k] = r.site[k]; });
        if (Object.keys(upd).length) await sb.from('sites').update(upd).eq('id', s.id); }
      // 2) sitios del proyecto (nuevos) y actualización de cantidades de los existentes
      const have = new Map(ctx.ps.map(x => [x.site_id, x]));
      const ins = [], upd = [];
      for (const r of recs){ const s = byName.get(norm(r.name)); if (!s) continue;
        const row = { planned: r.planned, contractor_id: r.contractor_id, start_date: r.start_date && r.end_date && r.end_date >= r.start_date ? r.start_date : null, end_date: r.start_date && r.end_date && r.end_date >= r.start_date ? r.end_date : null, stage: r.stage };
        if (have.has(s.id)) upd.push([have.get(s.id), row]); else ins.push({ org_id: me.org_id, project_id: ctx.p.id, site_id: s.id, ...row }); }
      for (let i = 0; i < ins.length; i += 200){ const { error } = await sb.from('project_sites').insert(ins.slice(i, i + 200)); if (error) throw error; }
      for (const [x, row] of upd){ const u = {}; if (Object.keys(row.planned).length) u.planned = { ...(x.planned || {}), ...row.planned };
        if (row.contractor_id && !x.contractor_id) u.contractor_id = row.contractor_id; if (row.start_date && !x.start_date){ u.start_date = row.start_date; u.end_date = row.end_date; }
        if (Object.keys(u).length){ u.last_reason = 'Importado desde Excel'; const { error } = await sb.from('project_sites').update(u).eq('id', x.id); if (error) throw error; } }
      m.close(); toast(`Importado: ${ins.length} sitios nuevos en el proyecto${upd.length ? `, ${upd.length} actualizados` : ''}${nuevos.length ? ` (${nuevos.length} sitios creados)` : ''}`);
      try { await IDB.del('kv', CUR_UID + ':sites-map'); } catch {}
      refreshProject();
    } catch (e){ $('#is-ok').disabled = false; $('#is-ok').textContent = 'Reintentar'; $('#is-err').textContent = errText(e); }
  };
}
function exportProjectSites(ctx){
  const { p, ps, siteById, contrs } = ctx, els = p.elements || [];
  const cName = id => contrs.find(c => c.id === id)?.name || '';
  const head = ['Sitio', 'Localidad', 'Provincia', 'Estado', 'Etapa', 'Avance %', 'Inicio', 'Fin', 'Propuesta inicio', 'Propuesta fin', 'Contratista', 'Bloqueo', ...els.flatMap(e => [e.name + ' previsto', e.name + ' instalado'])];
  const rows = ps.map(x => { const s = siteById.get(x.site_id) || {}, st = psState(x, p);
    return [s.name || '', s.localidad || '', s.provincia || '', st.n, x.stage, Math.round(st.pct), x.start_date || '', x.end_date || '', x.proposed_start || '', x.proposed_end || '', cName(x.contractor_id), x.blocked ? (x.block_reason || 'Sí') : '',
      ...els.flatMap(e => [Number(x.planned?.[e.id] || 0), Number(x.done?.[e.id] || 0)])]; });
  xlSave(p.name + ' - sitios ' + todayStr(), [['Sitios', [head, ...rows], head.map((h, i) => i === 0 ? 30 : 14)]]);
}

/* =====================================================================
   GANTT
   ===================================================================== */
function actLinked(a, ctx){ const ids = new Set(a.site_ids || []); return ctx.ps.filter(x => ids.has(x.site_id)); }
/* si el nombre de la actividad nombra una etapa (ej.: "Relevamiento" → "Relevado"), su avance es llegar a esa etapa */
function actStage(a, p){
  const n = norm(a.name), st = p.stages || [];
  for (let i = 1; i < st.length; i++){ const k = norm(st[i]).slice(0, 5); if (k.length >= 4 && n.includes(k)) return i; }
  return -1;
}
function actProgress(a, ctx){
  const l = actLinked(a, ctx);
  if (l.length){
    const si = actStage(a, ctx.p);
    if (si >= 0) return l.filter(x => (ctx.p.stages || []).indexOf(x.stage) >= si).length * 100 / l.length;
    return l.reduce((s, x) => s + psPct(x, ctx.p), 0) / l.length;
  }
  return Number(a.progress || 0);
}
function actReal(a, ctx){
  const l = actLinked(a, ctx);
  if (l.length){
    const si = actStage(a, ctx.p);
    const st = l.map(psStartDate).filter(Boolean).sort();
    const dn = l.map(x => psDoneDate(x, ctx.p, si >= 0 ? si : undefined));
    return { rs: st[0] || (dn.filter(Boolean).sort()[0]) || null, re: dn.every(Boolean) ? dn.sort().pop() : null };
  }
  return { rs: a.real_start || null, re: a.real_end || null };
}
function barStatus(start, end, pct, done){
  const t = todayStr();
  if (pct >= 100 || done) return { c: 'green', n: 'Terminada' };
  if (end < t) return { c: 'red', n: `Atrasada ${diffDays(end, t)} día${diffDays(end, t) === 1 ? '' : 's'}`, late: diffDays(end, t) };
  if (start > t) return { c: 'gray', n: 'Por empezar' };
  const exp = Math.min(100, (diffDays(start, t) + 1) * 100 / (diffDays(start, end) + 1));
  return pct + 15 < exp ? { c: 'amber', n: `En riesgo (esperado ${Math.round(exp)}%)` } : { c: 'green', n: 'En fecha' };
}
/* camino crítico (actividades sin holgura) cuando hay dependencias */
function criticalSet(acts){
  if (!acts.some(a => (a.depends_on || []).length)) return new Set();
  const byId = new Map(acts.map(a => [a.id, a])), succ = new Map(acts.map(a => [a.id, []]));
  acts.forEach(a => (a.depends_on || []).forEach(d => succ.get(d)?.push(a.id)));
  const end = acts.map(a => a.end_date).sort().pop(), lf = new Map();
  const dur = a => diffDays(a.start_date, a.end_date);
  const LF = (id, depth = 0) => {
    if (lf.has(id)) return lf.get(id);
    if (depth > 200) return end;   // dependencias circulares
    const s = succ.get(id) || [];
    const v = s.length ? s.map(x => addDays(LF(x, depth + 1), -dur(byId.get(x)) - 1)).sort()[0] : end;
    lf.set(id, v); return v;
  };
  return new Set(acts.filter(a => diffDays(a.end_date, LF(a.id)) <= 0).map(a => a.id));
}

function ganttHTML(groups){
  const all = groups.flatMap(g => g.rows);
  const dates = all.flatMap(r => [r.start, r.end, r.rs, r.re]).filter(Boolean).concat([todayStr()]).sort();
  if (!all.length) return '';
  let from = dates[0], to = dates[dates.length - 1];
  const span = diffDays(from, to) + 1;
  const unit = span <= 45 ? 'd' : span <= 420 ? 'w' : 'm';
  if (unit === 'w') from = addDays(from, -((dOf(from).getDay() + 6) % 7));
  if (unit === 'm') from = from.slice(0, 8) + '01';
  from = addDays(from, unit === 'd' ? -1 : 0); to = addDays(to, unit === 'd' ? 2 : 7);
  const ppd = unit === 'd' ? 26 : unit === 'w' ? 34 / 7 : 70 / 30.4;
  const days = diffDays(from, to) + 1, W = Math.ceil(days * ppd);
  const X = d => Math.round(diffDays(from, d) * ppd);
  const ticks = [], months = [];
  for (let d = from; d <= to; d = unit === 'd' ? addDays(d, 1) : unit === 'w' ? addDays(d, 7) : (() => { const x = dOf(d); x.setMonth(x.getMonth() + 1); return dStr(x); })())
    ticks.push(`<span style="left:${X(d)}px;width:${Math.round((unit === 'd' ? 1 : unit === 'w' ? 7 : 30.4) * ppd)}px">${unit === 'd' ? dOf(d).getDate() : unit === 'w' ? fmtDM(d) : MONTHS[dOf(d).getMonth()]}</span>`);
  for (let d = from.slice(0, 8) + '01'; d <= to; ){ const x = dOf(d); const nx = new Date(x); nx.setMonth(nx.getMonth() + 1);
    const l = Math.max(0, X(d)), w = Math.min(W, X(dStr(nx))) - l;
    if (w >= 22) months.push(`<span style="left:${l}px;width:${w}px;overflow:hidden">${MONTHS[x.getMonth()]}${w >= 64 ? ' ' + x.getFullYear() : ''}</span>`); d = dStr(nx); }
  const t = todayStr(), tx = X(t);
  const bar = r => {
    const pl = r.start && r.end ? `<i class="g-plan${r.proposed ? ' prop' : ''}${r.crit ? ' crit' : ''}" style="left:${X(r.start)}px;width:${Math.max(4, X(addDays(r.end, 1)) - X(r.start))}px;--c:${SEM[r.c]?.c || '#8C97A4'}"></i>` : '';
    const rend = r.re || (r.rs ? (t < (r.end || t) ? t : t) : null);
    const re = r.rs ? `<i class="g-real" style="left:${X(r.rs)}px;width:${Math.max(3, X(addDays(rend, 1)) - X(r.rs))}px;background:${SEM[r.c]?.c || '#22B07D'}"></i>` : '';
    const lab = r.start ? `<span class="g-pct" style="left:${X(addDays(r.end || r.start, 1)) + 4}px">${Math.round(r.pct || 0)}%${r.late ? ` · <b>+${r.late} d</b>` : ''}</span>` : '';
    return pl + re + lab;
  };
  return `<div class="gantt"><div class="g-row g-head"><div class="g-lb"></div><div class="g-tr" style="width:${W}px"><div class="g-months">${months.join('')}</div><div class="g-ticks">${ticks.join('')}</div>${t >= from && t <= to ? `<i class="g-today" style="left:${tx}px"><b>hoy</b></i>` : ''}</div></div>
    ${groups.map(g => {
      const gs = g.rows.map(r => r.start).filter(Boolean).sort()[0], ge = g.rows.map(r => r.end).filter(Boolean).sort().pop();
      const gp = g.rows.length ? g.rows.reduce((a, r) => a + (r.pct || 0), 0) / g.rows.length : 0;
      return (g.name ? `<div class="g-row g-phase"><div class="g-lb"><b>${esc(g.name)}</b><small>${Math.round(gp)}% · ${g.rows.length}</small></div><div class="g-tr" style="width:${W}px">${t >= from && t <= to ? `<i class="g-today" style="left:${tx}px"></i>` : ''}${gs ? `<i class="g-sum" style="left:${X(gs)}px;width:${Math.max(4, X(addDays(ge, 1)) - X(gs))}px"></i>` : ''}</div></div>` : '') +
        g.rows.map(r => `<div class="g-row click" data-gid="${esc(r.id)}" data-tip="${esc(`<b>${esc(r.label)}</b><br>Plan: ${fmtDM(r.start)} → ${fmtDM(r.end)}${r.rs ? `<br>Real: ${fmtDM(r.rs)} → ${r.re ? fmtDM(r.re) : 'en curso'}` : ''}<br>Avance ${Math.round(r.pct || 0)}% · ${esc(r.sn || '')}`)}">
          <div class="g-lb">${semDot(r.c)}<span class="g-name">${esc(r.label)}</span><small>${esc(r.sub || '')}</small></div>
          <div class="g-tr" style="width:${W}px">${t >= from && t <= to ? `<i class="g-today" style="left:${tx}px"></i>` : ''}${bar(r)}</div></div>`).join('');
    }).join('')}</div>
    <div class="viz-legend" style="margin:8px 14px"><span><i style="background:#cfd8e3"></i>Planificado</span><span><i style="background:var(--green)"></i>Real</span><span><i style="background:#fff;border:1px dashed var(--navy-2)"></i>Propuesta sin validar</span>${groups.some(g => g.rows.some(r => r.crit)) ? '<span><i style="background:#fff;border:2px solid var(--red)"></i>Camino crítico</span>' : ''}</div>`;
}

let GVIEW = 'plan';
function projGantt(box, ctx){
  const { p, acts, ps, siteById, contrs } = ctx;
  const manage = isManager() && canWrite();
  const has = acts.length > 0;
  try { GVIEW = localStorage.getItem('ia_gview') || GVIEW; } catch {}
  const view = has ? GVIEW : 'auto';
  const cName = id => contrs.find(c => c.id === id)?.name || 'Sin asignar';
  let groups = [];
  if (view === 'plan' && has){
    const crit = criticalSet(acts), byPhase = new Map();
    for (const a of acts){
      const pct = actProgress(a, ctx), rr = actReal(a, ctx), bs = barStatus(a.start_date, a.end_date, pct, !!rr.re);
      const depLate = (a.depends_on || []).map(d => acts.find(x => x.id === d)).filter(Boolean).filter(d => barStatus(d.start_date, d.end_date, actProgress(d, ctx), !!actReal(d, ctx).re).c === 'red');
      const row = { id: a.id, label: a.name, sub: [a.responsible, (a.site_ids || []).length ? `${a.site_ids.length} sitio${a.site_ids.length === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · '),
        start: a.start_date, end: a.end_date, rs: rr.rs, re: rr.re, pct, c: depLate.length && bs.c !== 'red' && bs.c !== 'green' ? 'amber' : bs.c, sn: depLate.length ? bs.n + ' · arrastra atraso de ' + depLate[0].name : bs.n, late: bs.late, crit: crit.has(a.id) };
      const k = a.phase || ''; if (!byPhase.has(k)) byPhase.set(k, []); byPhase.get(k).push(row);
    }
    groups = [...byPhase.entries()].map(([name, rows]) => ({ name, rows }));
  } else {
    const byC = new Map();
    for (const x of ps.filter(x => x.start_date || x.proposed_start).sort((a, b) => String(a.start_date || a.proposed_start).localeCompare(String(b.start_date || b.proposed_start)))){
      const st = psState(x, p), s = siteById.get(x.site_id) || { name: '—' };
      const start = x.start_date || x.proposed_start, end = x.start_date ? x.end_date : x.proposed_end;
      const bs = barStatus(start, end, st.pct, st.c === 'green');
      const row = { id: 'ps:' + x.id, label: s.name, sub: s.localidad || '', start, end, rs: psStartDate(x), re: psDoneDate(x, p), pct: st.pct, c: x.blocked ? 'red' : x.start_date ? bs.c : 'blue', sn: x.start_date ? st.n : 'Propuesta sin validar', late: bs.late, proposed: !x.start_date };
      const k = cName(x.contractor_id); if (!byC.has(k)) byC.set(k, []); byC.get(k).push(row);
    }
    groups = [...byC.entries()].map(([name, rows]) => ({ name, rows }));
  }
  const nProg = ps.filter(x => x.start_date || x.proposed_start).length;
  const late = groups.flatMap(g => g.rows).filter(r => r.c === 'red').length, risk = groups.flatMap(g => g.rows).filter(r => r.c === 'amber').length;
  box.innerHTML = `<div class="card">
    <div class="row between"><div class="row">${has ? `<div class="seg" style="margin:0"><button type="button" data-gv="plan" class="${view === 'plan' ? 'on' : ''}">📊 Gantt subido (${acts.length})</button><button type="button" data-gv="auto" class="${view === 'auto' ? 'on' : ''}">Por sitios (automático)</button></div>` : '<b>Gantt automático por sitios</b>'}</div>
      <div class="row">${manage && online() ? `<label class="btn sec small" style="margin:0">${has ? 'Reemplazar Gantt' : 'Subir Gantt (Excel)'}<input type="file" accept=".xlsx,.xls,.csv" id="gt-xl" class="hidden"></label><button class="btn sec small" id="gt-add">+ Actividad</button>` : ''}<button class="btn sec small" id="gt-exp">Exportar Excel</button></div></div>
    ${!has ? `<p class="muted sm" style="margin:8px 0 0">La app arma este Gantt sola con las fechas de inicio y fin de cada sitio (las propuestas sin validar se ven punteadas). Si tenés un Gantt armado en Excel, subilo con <b>Subir Gantt</b>: no es obligatorio.</p>` : ''}
    <div class="row" style="margin-top:10px;gap:16px"><span class="sm">${semDot('red')}Atrasadas <b>${late}</b></span><span class="sm">${semDot('amber')}En riesgo <b>${risk}</b></span>${view === 'auto' ? `<span class="sm muted">${nProg} de ${ps.length} sitios con fechas</span>` : ''}</div></div>
    <div class="card" style="padding:0;overflow:hidden">${groups.flatMap(g => g.rows).length ? ganttHTML(groups) : `<div class="empty" style="padding:30px">${view === 'auto' ? 'Todavía no hay sitios con fechas. Programalas en la pestaña Sitios (o que la contratista las proponga).' : 'Sin actividades.'}</div>`}</div>`;
  box.querySelectorAll('[data-gv]').forEach(b => b.onclick = () => { GVIEW = b.dataset.gv; try { localStorage.setItem('ia_gview', GVIEW); } catch {} projGantt(box, ctx); });
  box.querySelectorAll('[data-gid]').forEach(r => r.onclick = () => {
    const id = r.dataset.gid;
    if (id.startsWith('ps:')) return psModal(ctx, ps.find(x => x.id === id.slice(3)));
    actModal(ctx, acts.find(a => a.id === id));
  });
  bindTips(box);
  $('#gt-xl')?.addEventListener('change', e => importGantt(e.target.files[0], ctx));
  $('#gt-add')?.addEventListener('click', () => actModal(ctx, null));
  $('#gt-exp').onclick = () => exportGantt(ctx, groups, view);
}

function actModal(ctx, a){
  const { p, acts, ps, siteById } = ctx;
  const manage = isManager() && canWrite() && online();
  const isNew = !a;
  a = a || { name: '', phase: '', start_date: todayStr(), end_date: addDays(todayStr(), 6), depends_on: [], site_ids: [], sort: (acts.length ? Math.max(...acts.map(x => x.sort || 0)) + 1 : 1) };
  const pct = isNew ? 0 : actProgress(a, ctx), rr = isNew ? {} : actReal(a, ctx), bs = barStatus(a.start_date, a.end_date, pct, !!rr.re);
  const linked = new Set(a.site_ids || []), deps = new Set(a.depends_on || []);
  const psSites = ps.map(x => siteById.get(x.site_id)).filter(Boolean).sort((x, y) => x.name.localeCompare(y.name, 'es', { numeric: true }));
  if (!manage){
    return modal(`<h2>${esc(a.name)}</h2><p class="muted">${esc(a.phase || '')}</p>
      <div class="stats"><div class="stat"><span>Planificado</span><b style="font-size:16px">${fmtD(a.start_date)} → ${fmtD(a.end_date)}</b></div><div class="stat"><span>Real</span><b style="font-size:16px">${rr.rs ? fmtDM(rr.rs) + ' → ' + (rr.re ? fmtDM(rr.re) : 'en curso') : '—'}</b></div><div class="stat"><span>Avance</span><b style="font-size:16px">${Math.round(pct)}%</b><small>${esc(bs.n)}</small></div></div>
      ${a.responsible ? `<p class="sm">Responsable: ${esc(a.responsible)}</p>` : ''}${a.deliverable ? `<p class="sm">Entregable: ${esc(a.deliverable)}</p>` : ''}
      <div class="row" style="justify-content:flex-end"><button class="btn" data-close-modal>Cerrar</button></div>`);
  }
  const m = modal(`<h2>${isNew ? 'Nueva actividad' : 'Actividad del Gantt'}</h2>
    ${isNew ? '' : `<div class="banner ${bs.c === 'red' ? 'off' : bs.c === 'amber' ? 'warn' : 'trial'}" style="margin:0 0 10px"><span class="dot" style="background:${SEM[bs.c].c}"></span><div><b>${esc(bs.n)}</b> · avance ${Math.round(pct)}%${rr.rs ? ` · real ${fmtDM(rr.rs)} → ${rr.re ? fmtDM(rr.re) : 'en curso'}` : ''}</div></div>`}
    <label>Actividad</label><input id="ga-n" maxlength="300" value="${esc(a.name)}">
    <div class="row"><div class="grow"><label>Fase</label><input id="ga-f" maxlength="160" value="${esc(a.phase || '')}" list="ga-fl"><datalist id="ga-fl">${[...new Set(acts.map(x => x.phase).filter(Boolean))].map(f => `<option value="${esc(f)}">`).join('')}</datalist></div>
      <div class="grow"><label>Responsable</label><input id="ga-r" maxlength="160" value="${esc(a.responsible || '')}"></div></div>
    <div class="row"><div class="grow"><label>Inicio planificado</label><input id="ga-s" type="date" value="${esc(a.start_date)}"></div><div class="grow"><label>Fin planificado</label><input id="ga-e" type="date" value="${esc(a.end_date)}"></div></div>
    ${isNew ? '' : '<label>Motivo (obligatorio si cambiás las fechas)</label><input id="ga-m" maxlength="400" placeholder="Queda en el historial de reprogramaciones">'}
    <label>Entregable</label><input id="ga-d" maxlength="300" value="${esc(a.deliverable || '')}">
    <details style="margin-top:12px" ${linked.size ? 'open' : ''}><summary class="sm" style="cursor:pointer"><b>Sitios vinculados</b> (${linked.size}) — el avance real sale de estos sitios</summary>
      <input id="ga-sq" placeholder="Filtrar" style="margin-top:6px"><div id="ga-sl" style="max-height:180px;overflow:auto;margin-top:6px"></div></details>
    <div id="ga-man" class="${linked.size ? 'hidden' : ''}"><div class="row"><div style="width:140px"><label>Avance manual %</label><input id="ga-p" type="number" min="0" max="100" value="${a.progress ?? ''}"></div>
      <div class="grow"><label>Inicio real</label><input id="ga-rs" type="date" value="${esc(a.real_start || '')}"></div><div class="grow"><label>Fin real</label><input id="ga-re" type="date" value="${esc(a.real_end || '')}"></div></div></div>
    <details style="margin-top:12px" ${deps.size ? 'open' : ''}><summary class="sm" style="cursor:pointer"><b>Depende de</b> (${deps.size})</summary>
      <div style="max-height:160px;overflow:auto;margin-top:6px">${acts.filter(x => x.id !== a.id).map(x => `<label style="display:flex;gap:8px;font-weight:400;margin:3px 0"><input type="checkbox" data-dep="${x.id}" style="width:auto" ${deps.has(x.id) ? 'checked' : ''}><span class="sm">${esc(x.name)} <span class="muted">(${fmtDM(x.end_date)})</span></span></label>`).join('') || '<span class="muted sm">No hay otras actividades.</span>'}</div></details>
    ${(a.history || []).length ? `<details style="margin-top:12px"><summary class="sm" style="cursor:pointer">Reprogramaciones (${a.history.length})</summary><div class="sm">${a.history.slice().reverse().map(h => `<div style="padding:3px 0;border-bottom:1px solid var(--line)">${fmtDT(h.at)} · ${esc(h.by || '')}: ${esc(h.de || '')} → <b>${esc(h.a || '')}</b>${h.motivo ? ` <span class="muted">(${esc(h.motivo)})</span>` : ''}</div>`).join('')}</div></details>` : ''}
    <div class="err" id="ga-err"></div>
    <div class="row between" style="margin-top:10px">${isNew ? '<span></span>' : '<button class="btn danger small" id="ga-del">Eliminar</button>'}<div class="row"><button class="btn sec" id="ga-x">Cancelar</button><button class="btn" id="ga-ok">Guardar</button></div></div>`, { wide: true });
  const drawSites = () => { const q = norm($('#ga-sq').value);
    $('#ga-sl').innerHTML = psSites.filter(s => !q || norm(s.name + ' ' + (s.localidad || '')).includes(q)).slice(0, 300).map(s => `<label style="display:flex;gap:8px;font-weight:400;margin:3px 0"><input type="checkbox" data-ls="${s.id}" style="width:auto" ${linked.has(s.id) ? 'checked' : ''}><span class="sm">${esc(s.name)}</span></label>`).join('') || '<span class="muted sm">El proyecto no tiene sitios.</span>';
    $('#ga-sl').querySelectorAll('[data-ls]').forEach(c => c.onchange = () => { c.checked ? linked.add(c.dataset.ls) : linked.delete(c.dataset.ls); $('#ga-man').classList.toggle('hidden', linked.size > 0); }); };
  $('#ga-sq').oninput = drawSites; drawSites();
  m.el.querySelectorAll('[data-dep]').forEach(c => c.onchange = () => c.checked ? deps.add(c.dataset.dep) : deps.delete(c.dataset.dep));
  $('#ga-x').onclick = m.close;
  $('#ga-ok').onclick = async () => {
    const row = { name: $('#ga-n').value.trim(), phase: $('#ga-f').value.trim() || null, responsible: $('#ga-r').value.trim() || null, deliverable: $('#ga-d').value.trim() || null,
      start_date: $('#ga-s').value, end_date: $('#ga-e').value, site_ids: [...linked], depends_on: [...deps],
      progress: linked.size || $('#ga-p').value === '' ? null : Math.max(0, Math.min(100, Number($('#ga-p').value))),
      real_start: linked.size ? null : $('#ga-rs').value || null, real_end: linked.size ? null : $('#ga-re').value || null };
    if (!row.name) return ($('#ga-err').textContent = 'Poné el nombre de la actividad.');
    if (!row.start_date || !row.end_date || row.end_date < row.start_date) return ($('#ga-err').textContent = 'Revisá las fechas planificadas.');
    if (row.progress === 100 && !row.real_end) row.real_end = todayStr();
    if (row.progress > 0 && !row.real_start) row.real_start = row.start_date <= todayStr() ? row.start_date : todayStr();
    if (!isNew && (row.start_date !== a.start_date || row.end_date !== a.end_date)){ const mo = $('#ga-m').value.trim(); if (!mo) return ($('#ga-err').textContent = 'Indicá el motivo de la reprogramación.'); row.last_reason = mo; }
    $('#ga-ok').disabled = true;
    const { error } = isNew ? await sb.from('project_activities').insert({ ...row, org_id: me.org_id, project_id: p.id, sort: a.sort }) : await sb.from('project_activities').update(row).eq('id', a.id);
    if (error){ $('#ga-ok').disabled = false; return ($('#ga-err').textContent = errText(error)); }
    m.close(); toast('Actividad guardada'); route();
  };
  $('#ga-del')?.addEventListener('click', async () => {
    if (!confirm('¿Eliminar la actividad del Gantt?')) return;
    const { error } = await sb.from('project_activities').delete().eq('id', a.id); if (error) return toast(errText(error)); m.close(); route();
  });
}

/* ---------- Importar Gantt desde Excel ----------
   Acepta: columnas Inicio / Fin con fechas, o grilla de semanas marcadas (█, x, o cualquier valor)
   con la fecha de cada semana en el encabezado (ej.: "S1 07/07"). */
function siteTokens(s){
  const n = norm(s.name + ' ' + (s.aliases || []).join(' ')).replace(/[°º]/g, ' ');
  const toks = new Set(n.match(/\b[a-z]+\d+[a-z0-9]*\b/g) || []);
  (n.match(/\b[a-z]{6,}\b/g) || []).forEach(w => { if (!['subsuelo', 'edificio', 'escuela', 'planta'].includes(w)) toks.add(w); });
  return toks;
}
function textTokens(txt){
  const n = norm(txt).replace(/[°º.]/g, ' ');
  const toks = new Set(n.match(/\b[a-z]+\d+[a-z0-9]*\b/g) || []);
  (n.match(/\b[a-z]{6,}\b/g) || []).forEach(w => toks.add(w));
  // "San Martín 235" → sm235 / mar235 · "Reconquista 250" → rec250
  const re = /((?:[a-z]+ ){1,2})(\d{2,5})\b/g; let m;
  while ((m = re.exec(n))){ const ws = m[1].trim().split(' ').filter(w => !['edif', 'edificio', 'calle', 'av', 'grupo', 'y', 'de', 'la', 'el'].includes(w)); if (!ws.length) continue;
    toks.add(ws.map(w => w[0]).join('') + m[2]); toks.add(ws[ws.length - 1].slice(0, 3) + m[2]); toks.add(ws[0].slice(0, 3) + m[2]); }
  return toks;
}
function parseGantt(wb){
  let best = null;
  for (const name of wb.SheetNames){
    const rows = sheetRows(wb.Sheets[name]);
    const hi = rows.slice(0, 25).findIndex(r => r.some(c => /^(tarea|actividad|nombre de tarea|nombre de la tarea|descripcion)$/.test(norm(c))));
    if (hi < 0) continue;
    const score = (/gantt|cronograma|plan/i.test(name) ? 10 : 0) + rows.length / 1000;
    if (!best || score > best.score) best = { name, rows, hi, score };
  }
  if (!best) throw new Error('No encontré una hoja con la columna "Tarea" o "Actividad".');
  const { rows, hi } = best, H = rows[hi].map(norm);
  const col = (...res) => H.findIndex(h => res.some(r => r.test(h)));
  const C = { f: col(/^fase/, /^etapa/, /^grupo/), t: col(/^(tarea|actividad|nombre de tarea|nombre de la tarea|descripcion)$/), r: col(/^responsable/, /^recurso/, /^asignado/), d: col(/^entregable/),
    s: col(/^inicio/, /^comienzo/, /^fecha de inicio/, /^start/), e: col(/^fin$/, /^final/, /^fecha de fin/, /^finish/, /^termina/), dep: col(/^depende/, /^predecesora/, /^predecesor/), n: col(/^n°?$/, /^id$/, /^#$/) };
  const known = Object.values(C).filter(i => i >= 0);
  // columnas de semanas: buscan fecha en el encabezado o en la fila de abajo
  let year = null;
  for (const r of rows.slice(0, hi + 2)) for (const c of r){ const m = /\b(20\d\d)\b/.exec(xlStr(c)); if (m){ year = Number(m[1]); break; } if (c instanceof Date){ year = c.getFullYear(); break; } }
  year = year || new Date().getFullYear();
  const weekCols = [];
  if (C.s < 0 || C.e < 0){
    let lastM = 0, y = year;
    const width = Math.max(...rows.slice(hi, hi + 3).map(r => r.length));
    for (let i = 0; i < width; i++){
      if (known.includes(i)) continue;
      let d = null;
      for (const r of [rows[hi], rows[hi + 1]].filter(Boolean)){
        const c = r[i];
        if (c instanceof Date){ d = dStr(c); break; }
        const m = /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/.exec(xlStr(c));
        if (m){ const mo = Number(m[2]); if (m[3]) y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]); else if (mo < lastM) y++; lastM = mo; d = `${y}-${String(mo).padStart(2, '0')}-${m[1].padStart(2, '0')}`; break; }
      }
      if (d) weekCols.push({ i, d });
    }
    if (!weekCols.length) throw new Error('No encontré columnas "Inicio" y "Fin" ni semanas con fecha en el encabezado.');
  }
  const startRow = weekCols.length && rows[hi + 1] && weekCols.some(w => /(\d{1,2})\/(\d{1,2})/.test(xlStr(rows[hi + 1][w.i])) || rows[hi + 1][w.i] instanceof Date) ? hi + 2 : hi + 1;
  const step = weekCols.length > 1 ? Math.max(1, diffDays(weekCols[0].d, weekCols[1].d)) : 7;
  const out = []; let phase = '';
  for (const r of rows.slice(startRow)){
    const name = xlStr(r[C.t]).slice(0, 300);
    if (C.f >= 0 && xlStr(r[C.f])) phase = xlStr(r[C.f]).slice(0, 160);
    if (!name) continue;
    let s = null, e = null;
    if (weekCols.length){
      const marked = weekCols.filter(w => xlStr(r[w.i]) !== '');
      if (!marked.length) continue;
      s = marked[0].d; e = addDays(marked[marked.length - 1].d, step - 1);
    } else { s = xlDate(r[C.s]); e = xlDate(r[C.e]); if (!s || !e) continue; if (e < s) [s, e] = [e, s]; }
    out.push({ n: C.n >= 0 ? xlStr(r[C.n]) : String(out.length + 1), phase: phase || null, name, responsible: C.r >= 0 ? xlStr(r[C.r]).slice(0, 160) || null : null, deliverable: C.d >= 0 ? xlStr(r[C.d]).slice(0, 300) || null : null,
      start_date: s, end_date: e, depRaw: C.dep >= 0 ? xlStr(r[C.dep]) : '' });
  }
  if (!out.length) throw new Error('No encontré actividades con fechas.');
  if (out.length > 500) throw new Error('El Gantt tiene más de 500 actividades.');
  return { sheet: best.name, acts: out, mode: weekCols.length ? `semanas (${weekCols.length})` : 'columnas Inicio / Fin' };
}
async function importGantt(file, ctx){
  if (!file) return;
  let res; try { res = parseGantt(await readWorkbook(file)); } catch (e){ return toast('No se pudo leer el Gantt: ' + errText(e)); }
  const psSites = ctx.ps.map(x => ctx.siteById.get(x.site_id)).filter(Boolean).map(s => ({ s, tk: siteTokens(s) }));
  res.acts.forEach(a => { const tt = textTokens(a.name); a.site_ids = psSites.filter(x => [...x.tk].some(k => tt.has(k))).map(x => x.s.id); });
  const span = [res.acts.map(a => a.start_date).sort()[0], res.acts.map(a => a.end_date).sort().pop()];
  const m = modal(`<h2>Importar Gantt</h2>
    <p>Hoja <b>${esc(res.sheet)}</b> · leído por ${esc(res.mode)} · <b>${res.acts.length}</b> actividades del ${fmtD(span[0])} al ${fmtD(span[1])}.</p>
    <div class="tblwrap" style="max-height:300px;overflow:auto"><table class="tbl"><thead><tr><th>Fase</th><th>Actividad</th><th>Inicio</th><th>Fin</th><th>Sitios</th></tr></thead><tbody>
      ${res.acts.map(a => `<tr><td class="sm">${esc(a.phase || '')}</td><td class="sm">${esc(a.name)}</td><td class="sm">${fmtDM(a.start_date)}</td><td class="sm">${fmtDM(a.end_date)}</td><td class="sm">${a.site_ids.length || '—'}</td></tr>`).join('')}</tbody></table></div>
    <p class="muted sm">Las actividades con sitios vinculados avanzan solas con lo que se carga en esos sitios. Las demás se actualizan a mano (avance %). Los vínculos se pueden corregir tocando cada actividad.</p>
    ${res.acts.some(a => a.end_date < todayStr()) ? `<label style="display:flex;gap:8px;align-items:center;font-weight:400"><input type="checkbox" id="gi-past" style="width:auto"> Dar por terminadas (100%) las actividades sin sitios vinculados cuyo fin planificado ya pasó (${res.acts.filter(a => a.end_date < todayStr() && !a.site_ids.length).length})</label>` : ''}
    ${ctx.acts.length ? `<div class="banner warn"><span class="dot"></span><div class="sm">Este proyecto ya tiene un Gantt de ${ctx.acts.length} actividades: se reemplaza.</div></div>` : ''}
    <div class="err" id="gi-err"></div>
    <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn sec" id="gi-x">Cancelar</button><button class="btn" id="gi-ok">Importar</button></div>`, { wide: true });
  $('#gi-x').onclick = m.close;
  $('#gi-ok').onclick = async () => {
    if (!needOnline()) return;
    $('#gi-ok').disabled = true;
    const past = !!$('#gi-past')?.checked;
    const ids = res.acts.map(() => uid()), byN = new Map(res.acts.map((a, i) => [a.n, ids[i]]));
    const rows = res.acts.map((a, i) => ({ id: ids[i], org_id: me.org_id, project_id: ctx.p.id, sort: i + 1, phase: a.phase, name: a.name, responsible: a.responsible, deliverable: a.deliverable,
      start_date: a.start_date, end_date: a.end_date, site_ids: a.site_ids, depends_on: (a.depRaw.match(/\d+/g) || []).map(n => byN.get(n)).filter(x => x && x !== ids[i]),
      ...(past && !a.site_ids.length && a.end_date < todayStr() ? { progress: 100, real_start: a.start_date, real_end: a.end_date } : {}) }));
    if (ctx.acts.length){ const { error } = await sb.from('project_activities').delete().eq('project_id', ctx.p.id); if (error){ $('#gi-ok').disabled = false; return ($('#gi-err').textContent = errText(error)); } }
    const { error } = await sb.from('project_activities').insert(rows);
    if (error){ $('#gi-ok').disabled = false; return ($('#gi-err').textContent = errText(error)); }
    m.close(); toast(`Gantt importado: ${rows.length} actividades`); GVIEW = 'plan'; try { localStorage.setItem('ia_gview', 'plan'); } catch {} route();
  };
}
/* ---------- Exportar Gantt a Excel (mismo formato de semanas con █ + fila Real) ---------- */
function exportGantt(ctx, groups, view){
  const rows = groups.flatMap(g => g.rows.map(r => ({ ...r, phase: g.name })));
  if (!rows.length) return toast('No hay nada para exportar.');
  const dates = rows.flatMap(r => [r.start, r.end, r.rs, r.re]).filter(Boolean).sort();
  let from = addDays(dates[0], -((dOf(dates[0]).getDay() + 6) % 7)); const to = [dates[dates.length - 1], todayStr()].sort().pop();
  const weeks = []; for (let d = from; d <= to; d = addDays(d, 7)) weeks.push(d);
  const head = [view === 'auto' ? 'Contratista' : 'Fase', view === 'auto' ? 'Sitio' : 'Tarea', '', 'Inicio', 'Fin', 'Avance real %', 'Estado', ...weeks.map((w, i) => `S${i + 1} ${fmtDM(w)}`)];
  const inW = (w, s, e) => s && e && s <= addDays(w, 6) && e >= w;
  const aoa = [[`GANTT — ${ctx.p.name} · exportado ${fmtD(todayStr())}`], head];
  for (const r of rows){
    const rend = r.re || (r.rs ? todayStr() : null);
    aoa.push([r.phase || '', r.label, 'Plan', r.start || '', r.end || '', Math.round(r.pct || 0), r.sn || '', ...weeks.map(w => inW(w, r.start, r.end) ? '█' : '')]);
    aoa.push(['', '', 'Real', r.rs || '', r.re || '', '', '', ...weeks.map(w => inW(w, r.rs, rend) ? '▓' : '')]);
  }
  xlSave(`Gantt ${ctx.p.name} ${todayStr()}`, [['Gantt', aoa, [22, 46, 6, 11, 11, 8, 26, ...weeks.map(() => 9)]]]);
}

/* =====================================================================
   INVENTARIO DE EQUIPOS
   ===================================================================== */
const EQ_ST = { a_instalar: 'A instalar', instalado: 'Instalado', retirado: 'Retirado' };
function projInventory(box, ctx){
  const { p, equip, siteById, ps } = ctx;
  const manage = isManager() && canWrite() && online();
  const els = p.elements || [], elName = id => els.find(e => e.id === id)?.name || id;
  const mySites = new Set(ps.map(x => x.site_id));
  const canTick = e => canWrite() && (isManager() || me.role === 'inspector' || (isContractor() && mySites.has(e.site_id)));
  box.innerHTML = `<div class="card"><div class="row between"><div class="row">
      <input id="iv-q" placeholder="Buscar nombre, serie, MAC, IP o sitio" style="max-width:280px">
      <select id="iv-s" style="width:auto"><option value="">Todos los estados</option>${Object.entries(EQ_ST).map(([k, x]) => `<option value="${k}">${x}</option>`).join('')}</select>
      ${els.length ? `<select id="iv-e" style="width:auto"><option value="">Todos los elementos</option>${els.map(e => `<option value="${esc(e.id)}">${esc(e.name)}</option>`).join('')}</select>` : ''}</div>
    <div class="row">${manage ? `<label class="btn sec small" style="margin:0">Importar Excel<input type="file" accept=".xlsx,.xls,.csv" id="iv-xl" class="hidden"></label><button class="btn sec small" id="iv-add">+ Equipo</button>` : ''}<button class="btn sec small" id="iv-exp">Exportar Excel</button></div></div>
    <p class="muted sm" style="margin:8px 0 0">Cada equipo con su serie, MAC e IP. Al marcarlo instalado se suma al avance del sitio. ${manage ? 'Importá un Excel con una hoja por sitio (como el relevamiento por rack) o con una columna Sitio.' : ''}</p></div>
    <div class="card"><div class="tblwrap"><table class="tbl"><thead><tr><th>Sitio</th><th>Equipo</th><th class="hide-sm">Serie / MAC</th><th class="hide-sm">IP</th><th>Estado</th><th></th></tr></thead><tbody id="iv-rows"></tbody></table></div><p class="muted sm" id="iv-foot"></p></div>`;
  const render = () => {
    const q = norm($('#iv-q').value), s = $('#iv-s').value, e = $('#iv-e')?.value || '';
    const rows = equip.filter(x => (!s || x.status === s) && (!e || x.element === e) && (!q || norm([x.name, x.serial, x.mac, x.ip, siteById.get(x.site_id)?.name].join(' ')).includes(q)));
    $('#iv-rows').innerHTML = rows.slice(0, 800).map(x => `<tr><td class="sm">${esc(siteById.get(x.site_id)?.name || '—')}</td>
      <td><b>${esc(x.name || elName(x.element))}</b><div class="muted sm">${esc(elName(x.element))}</div></td>
      <td class="hide-sm sm">${esc(x.serial || '')}${x.mac ? `<div class="muted">${esc(x.mac)}</div>` : ''}</td><td class="hide-sm sm">${esc(x.ip || '')}</td>
      <td><span class="pill ${x.status === 'instalado' ? 'p-ok' : x.status === 'retirado' ? '' : 'p-pend'}">${EQ_ST[x.status]}</span>${x.installed_at ? `<div class="muted sm">${fmtDate(x.installed_at)}</div>` : ''}</td>
      <td>${canTick(x) ? `<button class="btn sec small" data-eq="${x.id}">${x.status === 'instalado' ? 'Editar' : 'Instalado ✓'}</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">Sin equipos cargados.</td></tr>';
    $('#iv-foot').textContent = `${equip.filter(x => x.status === 'instalado').length} de ${equip.length} instalados` + (rows.length > 800 ? ` · se muestran 800 de ${rows.length}` : '');
    box.querySelectorAll('[data-eq]').forEach(b => b.onclick = () => equipModal(ctx, equip.find(x => x.id === b.dataset.eq)));
  };
  $('#iv-q').oninput = render; $('#iv-s').onchange = render; $('#iv-e') && ($('#iv-e').onchange = render);
  $('#iv-add')?.addEventListener('click', () => equipModal(ctx, null));
  $('#iv-xl')?.addEventListener('change', ev => importEquipment(ev.target.files[0], ctx));
  $('#iv-exp').onclick = () => xlSave(`Inventario ${p.name} ${todayStr()}`, [['Inventario', [['Sitio', 'Elemento', 'Nombre', 'Serie', 'MAC', 'IP', 'Estado', 'Instalado el', 'Instalado por', 'Notas', ...[...new Set(equip.flatMap(x => Object.keys(x.data || {})))].slice(0, 30)],
    ...equip.map(x => { const dk = [...new Set(equip.flatMap(y => Object.keys(y.data || {})))].slice(0, 30); return [siteById.get(x.site_id)?.name || '', elName(x.element), x.name || '', x.serial || '', x.mac || '', x.ip || '', EQ_ST[x.status], x.installed_at ? fmtDate(x.installed_at) : '', x.installed_by || '', x.notes || '', ...dk.map(k => xlStr(x.data?.[k] ?? ''))]; })], [24, 16, 34, 18, 18, 14, 11, 12, 18, 30]]]);
  render();
}
/* recalcula lo instalado de un elemento en el sitio a partir del inventario */
async function syncDoneFromEquip(ctx, siteId, element){
  const x = ctx.ps.find(y => y.site_id === siteId); if (!x) return;
  const { data } = await sb.from('equipment').select('id', { count: 'exact' }).eq('project_id', ctx.p.id).eq('site_id', siteId).eq('element', element).eq('status', 'instalado');
  const n = (data || []).length;
  if (Number(x.done?.[element] || 0) !== n) await sb.rpc('ps_progress', { p_ps: x.id, p_done: { [element]: n }, p_reason: 'Inventario' });
}
function equipModal(ctx, e){
  if (!needOnline()) return;
  const { p, ps, siteById } = ctx, els = p.elements || [], isNew = !e, manage = isManager() && canWrite();
  e = e || { status: 'a_instalar', element: els[0]?.id || '' };
  if (isNew && !els.length) return toast('Primero agregá elementos al proyecto (Editar proyecto).');
  const sites = ps.map(x => siteById.get(x.site_id)).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true }));
  const m = modal(`<h2>${isNew ? 'Nuevo equipo' : esc(e.name || 'Equipo')}</h2>
    ${isNew ? `<label>Sitio</label><select id="eq-si">${sites.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select>
      <label>Elemento</label><select id="eq-el">${els.map(x => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('')}</select>
      <label>Nombre / ubicación</label><input id="eq-n" maxlength="200">` : `<p class="muted sm" style="margin-top:-6px">${esc(siteById.get(e.site_id)?.name || '')} · ${esc(els.find(x => x.id === e.element)?.name || e.element)}</p>`}
    <div class="row"><div class="grow"><label>Serie</label><input id="eq-s" maxlength="120" value="${esc(e.serial || '')}"></div><div class="grow"><label>MAC</label><input id="eq-m" maxlength="60" value="${esc(e.mac || '')}"></div></div>
    ${isNew || manage ? `<label>IP</label><input id="eq-ip" maxlength="60" value="${esc(e.ip || '')}">` : ''}
    <label>Estado</label><select id="eq-st">${Object.entries(EQ_ST).map(([k, x]) => `<option value="${k}" ${e.status === k ? 'selected' : ''}>${x}</option>`).join('')}</select>
    <label>Notas</label><input id="eq-no" maxlength="1000" value="${esc(e.notes || '')}">
    ${!isNew && Object.keys(e.data || {}).length ? `<details style="margin-top:10px"><summary class="sm" style="cursor:pointer">Datos del relevamiento</summary><div class="sm">${Object.entries(e.data).map(([k, v]) => `<div><b>${esc(k)}:</b> ${esc(v)}</div>`).join('')}</div></details>` : ''}
    <div class="err" id="eq-err"></div>
    <div class="row between" style="margin-top:10px">${!isNew && manage ? '<button class="btn danger small" id="eq-del">Eliminar</button>' : '<span></span>'}<div class="row"><button class="btn sec" id="eq-x">Cancelar</button><button class="btn" id="eq-ok">Guardar</button></div></div>`);
  if (!isNew && e.status !== 'instalado') $('#eq-st').value = 'instalado';
  $('#eq-x').onclick = m.close;
  $('#eq-ok').onclick = async () => {
    $('#eq-ok').disabled = true;
    let error, site = e.site_id, el = e.element;
    if (isNew){
      site = $('#eq-si').value; el = $('#eq-el').value;
      ({ error } = await sb.from('equipment').insert({ org_id: me.org_id, project_id: p.id, site_id: site, element: el, name: $('#eq-n').value.trim() || null, serial: $('#eq-s').value.trim() || null, mac: $('#eq-m').value.trim() || null, ip: $('#eq-ip').value.trim() || null, status: $('#eq-st').value, notes: $('#eq-no').value.trim() || null, installed_at: $('#eq-st').value === 'instalado' ? new Date().toISOString() : null, installed_by: $('#eq-st').value === 'instalado' ? (me.full_name || me.email) : null }));
    } else {
      ({ error } = await sb.rpc('equip_set', { p_id: e.id, p_status: $('#eq-st').value, p_serial: $('#eq-s').value, p_mac: $('#eq-m').value, p_notes: $('#eq-no').value }));
      if (!error && manage && $('#eq-ip') && $('#eq-ip').value.trim() !== (e.ip || '')) ({ error } = await sb.from('equipment').update({ ip: $('#eq-ip').value.trim() || null }).eq('id', e.id));
    }
    if (error){ $('#eq-ok').disabled = false; return ($('#eq-err').textContent = errText(error)); }
    await syncDoneFromEquip(ctx, site, el).catch(() => {});
    m.close(); toast('Equipo guardado'); await IDB.del('kv', CUR_UID + ':equip:' + p.id).catch(() => {}); refreshProject();
  };
  $('#eq-del')?.addEventListener('click', async () => {
    if (!confirm('¿Eliminar el equipo del inventario?')) return;
    const { error } = await sb.from('equipment').delete().eq('id', e.id); if (error) return toast(errText(error));
    await syncDoneFromEquip(ctx, e.site_id, e.element).catch(() => {}); m.close(); refreshProject();
  });
}
async function importEquipment(file, ctx){
  if (!file) return;
  const { p, ps, siteById } = ctx, els = p.elements || [];
  if (!els.length) return toast('Primero agregá elementos al proyecto (Editar proyecto).');
  let wb; try { wb = await readWorkbook(file); } catch (e){ return toast('No se pudo leer el Excel: ' + errText(e)); }
  const psSites = ps.map(x => siteById.get(x.site_id)).filter(Boolean);
  const findSite = txt => { const n = norm(txt); if (!n) return null; return psSites.find(s => norm(s.name) === n) || psSites.find(s => (s.aliases || []).some(a => norm(a) === n)) || psSites.find(s => norm(s.name).replace(/\s/g, '') === n.replace(/\s/g, '')) || null; };
  const found = [];
  for (const sn of wb.SheetNames){
    const rows = sheetRows(wb.Sheets[sn]);
    const hi = rows.slice(0, 15).findIndex(r => r.filter(c => /^(mac|serie|serial|s\/n|ip|nombre|equipo|nombre de la camara|modelo)/.test(norm(c))).length >= 2);
    if (hi < 0) continue;
    const H = rows[hi].map(norm), head = rows[hi].map(xlStr);
    const col = (...res) => H.findIndex(h => res.some(r => r.test(h)));
    const C = { site: col(/^sitio/, /^rack$/, /^ubicacion del rack/), name: col(/^nombre/, /^equipo/, /^descripcion/), serial: col(/^serie/, /^serial/, /^s\/n/, /^nro de serie/), mac: col(/mac/), ip: col(/^ip$/, /^ip /, /^direccion ip/), el: col(/^elemento/, /^tipo de equipo/) };
    const sheetSite = findSite(sn);
    const items = [];
    for (const r of rows.slice(hi + 1)){
      const name = C.name >= 0 ? xlStr(r[C.name]) : '', serial = C.serial >= 0 ? xlStr(r[C.serial]) : '', mac = C.mac >= 0 ? xlStr(r[C.mac]) : '';
      if (!name && !serial && !mac) continue;
      const site = C.site >= 0 ? findSite(xlStr(r[C.site])) || sheetSite : sheetSite;
      const data = {}; head.forEach((h, i) => { if (![C.site, C.name, C.serial, C.mac, C.ip, C.el].includes(i) && h && xlStr(r[i]) !== '' && Object.keys(data).length < 30) data[h.slice(0, 60)] = xlStr(r[i]).slice(0, 200); });
      const elTxt = C.el >= 0 ? norm(r[C.el]) : '';
      items.push({ site, name: name.slice(0, 200) || null, serial: serial.slice(0, 120) || null, mac: mac.slice(0, 60) || null, ip: C.ip >= 0 ? xlStr(r[C.ip]).slice(0, 60) || null : null, el: els.find(e => elTxt && (norm(e.name) === elTxt || elTxt.includes(norm(e.name).replace(/s$/, ''))))?.id || null, data });
    }
    if (items.length) found.push({ sn, sheetSite, items });
  }
  if (!found.length) return toast('No encontré hojas con columnas de equipos (Nombre, Serie, MAC, IP).');
  const total = found.reduce((a, f) => a + f.items.length, 0), noSite = found.reduce((a, f) => a + f.items.filter(i => !i.site).length, 0);
  const m = modal(`<h2>Importar inventario</h2>
    <p><b>${total}</b> equipos en ${found.length} hoja${found.length === 1 ? '' : 's'}.</p>
    <div class="tblwrap" style="max-height:240px;overflow:auto"><table class="tbl"><thead><tr><th>Hoja</th><th>Sitio del proyecto</th><th class="num">Equipos</th></tr></thead><tbody>
      ${found.map(f => `<tr><td class="sm">${esc(f.sn)}</td><td class="sm">${f.sheetSite ? esc(f.sheetSite.name) : f.items.some(i => i.site) ? 'por columna Sitio' : '<span style="color:var(--red)">sin sitio: se omite</span>'}</td><td class="num">${f.items.length}</td></tr>`).join('')}</tbody></table></div>
    ${noSite ? `<p class="sm" style="color:var(--amber)">${noSite} equipos no tienen un sitio del proyecto con ese nombre y no se importan. Revisá que la hoja se llame igual que el sitio.</p>` : ''}
    <label>Elemento (para las filas que no lo indican)</label><select id="ie-el">${els.map(e => `<option value="${esc(e.id)}">${esc(e.name)}</option>`).join('')}</select>
    <label>Estado inicial</label><select id="ie-st"><option value="a_instalar">A instalar</option><option value="instalado">Instalado</option></select>
    <label style="display:flex;gap:8px;align-items:center;font-weight:400"><input type="checkbox" id="ie-pl" style="width:auto" checked> Usar la cantidad de equipos como cantidad prevista del sitio</label>
    <div class="err" id="ie-err"></div>
    <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn sec" id="ie-x">Cancelar</button><button class="btn" id="ie-ok">Importar</button></div>`, { wide: true });
  $('#ie-x').onclick = m.close;
  $('#ie-ok').onclick = async () => {
    if (!needOnline()) return;
    $('#ie-ok').disabled = true;
    const defEl = $('#ie-el').value, stt = $('#ie-st').value;
    const rows = found.flatMap(f => f.items.filter(i => i.site).map(i => ({ org_id: me.org_id, project_id: p.id, site_id: i.site.id, element: i.el || defEl, name: i.name, serial: i.serial, mac: i.mac, ip: i.ip, status: stt, data: i.data,
      installed_at: stt === 'instalado' ? new Date().toISOString() : null, installed_by: stt === 'instalado' ? (me.full_name || me.email) : null })));
    try {
      for (let i = 0; i < rows.length; i += 200){ const { error } = await sb.from('equipment').insert(rows.slice(i, i + 200)); if (error) throw error; }
      if ($('#ie-pl').checked){
        const cnt = {}; rows.forEach(r => { const k = r.site_id; cnt[k] = cnt[k] || {}; cnt[k][r.element] = (cnt[k][r.element] || 0) + 1; });
        for (const [sid, c] of Object.entries(cnt)){ const x = ps.find(y => y.site_id === sid); if (!x) continue;
          const { error } = await sb.from('project_sites').update({ planned: { ...(x.planned || {}), ...c }, last_reason: 'Inventario importado' }).eq('id', x.id); if (error) throw error;
          if (stt === 'instalado') await sb.rpc('ps_progress', { p_ps: x.id, p_done: c, p_reason: 'Inventario importado' }); }
      }
      m.close(); toast(`${rows.length} equipos importados`); await IDB.del('kv', CUR_UID + ':equip:' + p.id).catch(() => {}); refreshProject();
    } catch (e){ $('#ie-ok').disabled = false; $('#ie-err').textContent = errText(e); }
  };
}

/* =====================================================================
   INICIO: tablero de proyectos y pendientes críticos
   ===================================================================== */
async function homeBoard(box){
  if (!box) return;
  try {
    const [projects, psAll, tasks] = await Promise.all([loadProjects().catch(() => []), loadPS().catch(() => []), loadAllTasks().catch(() => [])]);
    const pend = tasks.filter(t => t.is_pending && taskOpen(t));
    const crit = pend.filter(t => t.priority === 'critica'), late = pend.filter(pendLate);
    const props = psAll.filter(x => x.proposed_start).length;
    const act = projects.filter(p => p.active);
    box.innerHTML = `
      ${pend.length ? `<a class="card alertcard ${crit.length ? 'bad' : ''}" href="#/map/pend">
        <span style="font-size:28px">⚠</span><div class="grow"><b>${crit.length ? `${crit.length} pendiente${crit.length === 1 ? '' : 's'} crítico${crit.length === 1 ? '' : 's'}` : `${pend.length} pendiente${pend.length === 1 ? '' : 's'} abierto${pend.length === 1 ? '' : 's'}`}</b>
        <div class="sm">${late.length ? `<b>${late.length} atrasado${late.length === 1 ? '' : 's'}</b> · ` : ''}${pend.length} abiertos en total · ver en el mapa</div></div><span>›</span></a>` : ''}
      ${props && isValidator() ? `<a class="card alertcard" href="#/proj"><span style="font-size:24px">📅</span><div class="grow"><b>${props} fecha${props === 1 ? '' : 's'} propuesta${props === 1 ? '' : 's'} por contratistas</b><div class="sm">Esperan tu validación</div></div><span>›</span></a>` : ''}
      ${act.length ? `<div class="row between" style="margin:4px 0 8px"><h2 style="margin:0">Proyectos</h2><a href="#/proj" class="sm">Ver todos</a></div><div class="pj-grid" style="margin-bottom:14px">${act.slice(0, 6).map(p => projCard(p, psAll, tasks)).join('')}</div>` : ''}`;
    box.querySelectorAll('[data-open]').forEach(b => b.onclick = () => location.hash = '#/proj/' + b.dataset.open);
  } catch { box.innerHTML = ''; }
}

/* =====================================================================
   ESTADÍSTICAS: pendientes
   ===================================================================== */
async function pendStats(box, f){
  if (!box) return;
  let tasks = [], sites = [];
  try { [tasks, sites] = await Promise.all([cached('stats-pend', () => sb.from('tasks').select('id,priority,status,created_at,completed_at,sites,contractor_id').eq('is_pending', true).order('created_at', { ascending: false }).limit(3000)), loadSitesMap()]); } catch { return; }
  if (!tasks.length) return;
  const from = new Date(Date.now() - Number(f.per) * 86400000).toISOString();
  const sById = new Map(sites.map(s => [s.id, s]));
  const open = tasks.filter(taskOpen), closed = tasks.filter(t => ['completada', 'aprobada'].includes(t.status) && t.completed_at && t.created_at >= from);
  const hrs = t => (new Date(t.completed_at) - new Date(t.created_at)) / 3600000;
  const avg = l => l.length ? l.reduce((a, t) => a + hrs(t), 0) / l.length : null;
  const inSla = closed.filter(t => hrs(t) <= (PEND_SLA_H[t.priority] || 120)).length;
  const byLoc = {};
  closed.forEach(t => { const s = sById.get(t.sites?.[0]?.site_id); const k = s?.localidad || s?.name || 'Sin localidad'; (byLoc[k] = byLoc[k] || []).push(t); });
  const locList = Object.entries(byLoc).map(([k, l]) => ({ label: k, v: avg(l) / 24, n: l.length })).sort((a, b) => b.v - a.v).slice(0, 12);
  const card = document.createElement('div');
  card.innerHTML = `<div class="card"><h2>Pendientes</h2>
    <div class="stats" style="margin-bottom:12px">
      <div class="stat"><span>Abiertos</span><b>${open.length}</b><small>${open.filter(t => t.priority === 'critica').length} críticos · ${open.filter(pendLate).length} atrasados</small></div>
      <div class="stat"><span>Resueltos en el período</span><b>${closed.length}</b></div>
      <div class="stat"><span>Dentro del plazo</span><b style="color:${closed.length && inSla / closed.length < .8 ? 'var(--red)' : 'var(--si)'}">${closed.length ? Math.round(inSla * 100 / closed.length) + '%' : '—'}</b><small>Crítico 24 h · Alto 72 h · Normal 5 días</small></div>
      ${['critica', 'alta', 'normal'].map(pr => { const a = avg(closed.filter(t => t.priority === pr)); return `<div class="stat"><span>Resolución ${PRIO_TXT[pr].toLowerCase()}</span><b>${a === null ? '—' : fmtAge(a)}</b><small>promedio</small></div>`; }).join('')}
    </div>
    ${locList.length ? `<h3>Tiempo promedio de resolución por localidad (días)</h3>${chartHBars(locList.map(l => ({ label: l.label, v: l.v, display: l.v.toFixed(1).replace('.', ','), c: 'var(--s2)', tip: `<b>${esc(l.label)}</b><br>${l.n} pendiente${l.n === 1 ? '' : 's'} resuelto${l.n === 1 ? '' : 's'}<br>Promedio: ${l.v.toFixed(1).replace('.', ',')} días` })))}` : ''}</div>`;
  box.appendChild(card.firstElementChild); bindTips(box);
}
