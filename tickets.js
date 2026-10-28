/* =====================================================================
   InspectApp · Transformándonos — v5.0 · Mesa de tickets
   La oficina recibe los tickets de los clientes (captura o texto, leídos en el propio equipo),
   los asigna a técnicos o contratistas, el técnico completa la planilla del proyecto y marca
   "Realizado y normalizado", y la mesa los carga en la ticketera del cliente.
   Este archivo solo declara funciones: no ejecuta nada al cargarse.
   ===================================================================== */

const TK_ST = { nuevo: 'Nuevo', asignado: 'Asignado', en_curso: 'En curso', informe: 'Informe listo', cerrado: 'Cargado en el cliente', cancelado: 'Cancelado' };
const TK_PRIO = { critica: ['Crítica', '#B91C1C', '#FEE2E2'], alta: ['Alta', '#1E40AF', '#DBEAFE'], normal: ['Normal', '#92400E', '#FEF3C7'], baja: ['Baja', '#475569', '#E2E8F0'] };
const TK_FALLA = { infra: 'Infraestructura del sitio (energía, shelter, seguridad)', fo: 'Tendido de fibra óptica / radioenlace', mov: 'Movimiento o resujeción de FO', prev: 'Preventivo', otro: 'Otro' };
const TK_FALLA_S = { infra: 'Infraestructura', fo: 'Tendido FO / radio', mov: 'Movimiento de FO', prev: 'Preventivo', otro: 'Otro' };
const TK = { projects: [], tkr: [], rules: new Map(), list: [], timer: null, filter: '' };

/* ---------- utilidades ---------- */
const tkH = h => { if (h == null || !isFinite(h)) return '—'; const s = Math.abs(h); if (s >= 48) return `${Math.round(s / 24)} días`; const t = Math.round(s * 60), H = Math.floor(t / 60), M = t % 60; return H ? `${H} h${M ? ' ' + String(M).padStart(2, '0') : ''}` : `${M} min`; };
function tkLeft(t){       // horas que quedan (negativo = vencido); null si no hay reloj
  if (t.normalized_at || !t.due_at) return null;
  return (new Date(t.due_at) - Date.now()) / 3600000;
}
function tkMood(t){       // la persona: tranquila, caminando, corriendo, apurada, lista
  if (['informe', 'cerrado'].includes(t.status) || t.normalized_at) return 'listo';
  const left = tkLeft(t); if (left == null) return 'sinreloj';
  if (left < 0) return 'vencido';
  const frac = t.ttr_h ? left / (Number(t.ttr_h) + Number(t.pause_h || 0)) : 1;
  return frac > .5 ? 'calma' : frac > .25 ? 'camina' : 'corre';
}
const TK_MOOD = { calma: ['Con tiempo', '#15803D'], camina: ['Atención', '#B45309'], corre: ['Por vencer', '#C2410C'], vencido: ['Fuera de SLA', '#B91C1C'], listo: ['Normalizado', '#15803D'], sinreloj: ['Sin hora del reporte', '#64748B'] };
function tkLeftTxt(t){
  if (t.normalized_at){ const h = t.reported_at ? (new Date(t.normalized_at) - new Date(t.reported_at)) / 3600000 - Number(t.pause_h || 0) : null; return h == null ? 'normalizado' : `normalizado en ${tkH(h)}${t.ttr_h ? (h <= t.ttr_h ? ' · dentro del SLA' : ' · fuera de SLA') : ''}`; }
  const l = tkLeft(t); if (l == null) return t.reported_at ? 'sin TTR' : 'falta la hora del reporte';
  return l >= 0 ? `quedan ${tkH(l)}` : `vencido hace ${tkH(-l)}`;
}
/* figura animada según el tiempo que queda (dibujo propio, sin imágenes externas) */
function tkFigure(t, size = 46){
  const m = tkMood(t), c = TK_MOOD[m][1];
  const legs = { calma: '<path d="M24 34 L20 46 M24 34 L28 46"/>', camina: '<g class="tk-l1"><path d="M24 34 L18 46"/></g><g class="tk-l2"><path d="M24 34 L30 46"/></g>',
    corre: '<g class="tk-l1"><path d="M24 33 L14 42 L10 40"/></g><g class="tk-l2"><path d="M24 33 L32 45"/></g>', vencido: '<g class="tk-l1"><path d="M24 33 L15 44"/></g><g class="tk-l2"><path d="M24 33 L33 44"/></g>',
    listo: '<path d="M24 34 L20 46 M24 34 L28 46"/>', sinreloj: '<path d="M24 34 L20 46 M24 34 L28 46"/>' }[m];
  const arms = { calma: '<path d="M24 22 L17 30 M24 22 L31 30"/>', camina: '<g class="tk-a1"><path d="M24 22 L18 30"/></g><g class="tk-a2"><path d="M24 22 L30 30"/></g>',
    corre: '<path d="M24 21 L33 17 M24 21 L15 27"/>', vencido: '<path d="M24 21 L15 13 M24 21 L33 13"/>', listo: '<path d="M24 22 L17 29 M24 22 L32 13"/>', sinreloj: '<path d="M24 22 L17 30 M24 22 L31 30"/>' }[m];
  const lean = m === 'corre' || m === 'vencido' ? ' transform="rotate(14 24 30)"' : '';
  const extra = { corre: '<path class="tk-wind" d="M3 20h7M1 26h8M4 32h6" stroke-width="2"/>', vencido: '<path d="M38 4v7M38 14v1.5" stroke-width="3"/>', listo: '<path d="M34 8l3 3 6-6" stroke-width="3"/>',
    sinreloj: '<text x="35" y="12" font-size="11" fill="' + c + '" stroke="none" font-family="sans-serif" font-weight="700">?</text>', calma: '', camina: '' }[m];
  return `<span class="tk-fig tk-${m}" title="${esc(TK_MOOD[m][0])}" role="img" aria-label="${esc(TK_MOOD[m][0])}"><svg width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" stroke="${c}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
    <g class="tk-body"${lean}><circle cx="24" cy="10" r="5" fill="${c}"/><path d="M24 16 L24 34"/>${arms}${legs}</g>${extra}</svg></span>`;
}
function tkCss(){
  if (document.getElementById('tk-css')) return;
  const st = document.createElement('style'); st.id = 'tk-css';
  st.textContent = `.tk-fig{display:inline-flex;flex:none}
.tk-camina .tk-body{animation:tkbob 1.1s ease-in-out infinite}.tk-camina .tk-l1{animation:tkswing 1.1s ease-in-out infinite;transform-origin:24px 34px}.tk-camina .tk-l2{animation:tkswing 1.1s ease-in-out infinite reverse;transform-origin:24px 34px}
.tk-camina .tk-a1{animation:tkswing 1.1s ease-in-out infinite reverse;transform-origin:24px 22px}.tk-camina .tk-a2{animation:tkswing 1.1s ease-in-out infinite;transform-origin:24px 22px}
.tk-corre .tk-body{animation:tkbob .45s ease-in-out infinite}.tk-corre .tk-l1{animation:tkrun .45s ease-in-out infinite;transform-origin:24px 33px}.tk-corre .tk-l2{animation:tkrun .45s ease-in-out infinite reverse;transform-origin:24px 33px}
.tk-corre .tk-wind{animation:tkwind .45s linear infinite}
.tk-vencido svg{animation:tkshake .35s ease-in-out infinite}.tk-vencido .tk-l1{animation:tkrun .3s ease-in-out infinite;transform-origin:24px 33px}.tk-vencido .tk-l2{animation:tkrun .3s ease-in-out infinite reverse;transform-origin:24px 33px}
.tk-listo svg{animation:tkjump 1.6s ease-in-out infinite}
@keyframes tkswing{0%,100%{transform:rotate(-18deg)}50%{transform:rotate(18deg)}}@keyframes tkrun{0%,100%{transform:rotate(-30deg)}50%{transform:rotate(30deg)}}
@keyframes tkbob{0%,100%{transform:translateY(0)}50%{transform:translateY(-1.5px)}}@keyframes tkwind{0%{opacity:1;transform:translateX(0)}100%{opacity:0;transform:translateX(-4px)}}
@keyframes tkshake{0%,100%{transform:translateX(0)}25%{transform:translateX(-1.5px)}75%{transform:translateX(1.5px)}}@keyframes tkjump{0%,70%,100%{transform:translateY(0)}80%{transform:translateY(-4px)}}
@media (prefers-reduced-motion:reduce){.tk-fig *,.tk-fig svg{animation:none!important}}
.grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px;margin-bottom:14px}
.tk-top{display:flex;flex-wrap:wrap;gap:10px;align-items:stretch;margin-bottom:12px}
.tk-paste{flex:1 1 420px;border:2px dashed #94A3B8;border-radius:14px;background:#fff;padding:12px 16px;display:flex;gap:12px;align-items:center;cursor:pointer;min-height:64px}
.tk-paste:focus{outline:3px solid var(--green);outline-offset:2px}.tk-paste.drag{border-color:var(--green);background:#F0FDF4}
.tk-cnt{flex:0 0 130px;border-radius:14px;padding:10px 14px;border:1px solid var(--line);background:#fff;cursor:pointer;text-align:left;font:inherit;color:inherit}
.tk-cnt b{display:block;font-size:28px;line-height:1.1}.tk-cnt span{font-size:12px}
.tk-board{display:grid;grid-template-columns:repeat(5,minmax(190px,1fr));gap:12px;overflow-x:auto;padding-bottom:6px}
.tk-col{background:#E9EEF5;border-radius:14px;padding:10px;display:flex;flex-direction:column;gap:9px;min-height:120px}
.tk-col>b{font-size:13px;padding:2px 4px}
.tk-card{background:#fff;border-radius:12px;padding:10px 12px;border-left:6px solid #94A3B8;cursor:pointer;display:flex;gap:10px;align-items:flex-start;text-align:left;font:inherit;color:inherit;border-top:0;border-right:0;border-bottom:0;width:100%}
.tk-card:hover{box-shadow:0 2px 8px rgba(15,42,74,.15)}.tk-card .t{flex:1;min-width:0}.tk-card .t b{display:block;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tk-card .s{font-size:12px;color:var(--muted)}.tk-card .p{font-size:11px;font-weight:700;padding:2px 7px;border-radius:6px;display:inline-block;margin-top:5px}
.tk-card .l{font-size:12px;font-weight:700;margin-top:4px}
.tk-side{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;margin-top:12px}
.tk-hero{border-radius:18px;padding:16px;color:#fff;display:flex;flex-direction:column;gap:6px}
.tk-hero .big{font-size:22px;font-weight:800}.tk-hero a.go{background:#fff;text-align:center;border-radius:12px;padding:13px;font-weight:800;text-decoration:none;margin-top:6px}
.tk-step{display:flex;gap:12px;align-items:center;background:#fff;border:1px solid var(--line);border-radius:16px;padding:14px 16px;width:100%;font:inherit;color:inherit;text-align:left;cursor:pointer}
.tk-step .n{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;background:#E2E8F0;flex:none}
.tk-step.done .n{background:#16A34A;color:#fff}.tk-step.now{border:2px solid var(--navy)}.tk-step.now .n{background:var(--navy);color:#fff}
.tk-big{width:100%;border:0;border-radius:16px;padding:17px;font:inherit;font-size:18px;font-weight:800;background:#16A34A;color:#fff;cursor:pointer}.tk-big:disabled{background:#CBD5E1;color:#475569;cursor:not-allowed}
.tk-seg{display:inline-flex;border:1px solid var(--line);border-radius:10px;overflow:hidden}.tk-seg button{border:0;background:#fff;padding:9px 14px;font:inherit;font-weight:600;cursor:pointer;color:var(--muted)}.tk-seg button.on{background:var(--navy);color:#fff}
.tk-sla{background:var(--navy);color:#fff;border-radius:14px;padding:12px 16px;display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap}
.tk-ocr mark{background:#FDE68A;border-radius:3px;padding:0 2px}
@media (max-width:700px){.tk-board{grid-template-columns:repeat(5,minmax(250px,85vw));scroll-snap-type:x mandatory}.tk-col{scroll-snap-align:start}}`;
  document.head.appendChild(st);
}

/* ---------- carga de datos ---------- */
async function tkLoadBase(){
  const [pr, tk] = await Promise.all([
    cached('tk-proj', () => sb.from('projects').select('id,name,client,contract,kind,active,ticketera_id,corr_template_id,node_priority,end_date,short_name').in('kind', ['mantenimiento', 'mixto']).order('name')),
    cached('tk-tkr', () => sb.from('ticketeras').select('*').order('name')).catch(() => []),
  ]);
  TK.projects = (pr || []).filter(p => p.active !== false); TK.tkr = (tk || []).filter(x => x.active !== false);
  return TK;
}
async function tkRules(projectId){
  if (!projectId) return [];
  if (!TK.rules.has(projectId)){ const { data } = await sb.from('sla_rules').select('*').eq('project_id', projectId).order('sort'); TK.rules.set(projectId, data || []); }
  return TK.rules.get(projectId);
}
function tkPickRule(rules, falla, afect, node){       // la misma regla que usa la base
  const ok = rules.filter(r => r.falla === (falla || 'otro') && (r.afect === (afect || 'na') || r.afect === 'na') && (node == null || ((r.node_min == null || node >= r.node_min) && (r.node_max == null || node <= r.node_max))));
  ok.sort((a, b) => ((b.afect === (afect || 'na')) - (a.afect === (afect || 'na'))) || ((b.node_min != null) - (a.node_min != null)) || (a.ttr_h - b.ttr_h));
  return ok[0] || null;
}
async function tkLoadList(){
  const since = new Date(Date.now() - 36 * 3600000).toISOString();
  const r = await pageAll(() => sb.from('tickets').select('*').or(`status.in.(nuevo,asignado,en_curso,informe),loaded_at.gte.${since}`).order('due_at', { ascending: true, nullsFirst: false }).order('id'), 5000);
  if (r.error) throw r.error;
  TK.list = r.data || []; return TK.list;
}
// enlace a la ticketera del cliente: solo https (nunca javascript:, data:, etc.)
const tkUrl = (k, t) => { const u = k?.url_tpl ? k.url_tpl.replace('{n}', encodeURIComponent(t.ext_no)) : ''; return /^https:\/\/[^\s"'<>]+$/i.test(u) ? u : null; };
const tkProj = id => TK.projects.find(p => p.id === id);
const tkPName = id => { const p = tkProj(id); return p ? (p.short_name || p.name) : ''; };
const tkTkr = id => TK.tkr.find(x => x.id === id);
const tkStaffName = id => (typeof HHS !== 'undefined' && HHS.staff || []).find(s => s.id === id)?.name || 'Técnico';
function tkWho(t){
  const n = (t.staff_ids || []).map(tkStaffName);
  if (t.contractor_id){ const c = (TK.contrs || []).find(x => x.id === t.contractor_id); n.push('Contratista ' + (c?.name || '')); }
  return n.join(', ');
}

/* =====================================================================
   MESA DE DESPACHO  #/mesa
   ===================================================================== */
async function viewMesa(v){
  tkCss();
  if (!isManager()){ location.hash = '#/tickets'; return; }
  if (!needOnline()){ v.innerHTML = '<div class="card">La mesa necesita señal.</div>'; return; }
  await Promise.all([tkLoadBase(), (async () => { try { await hhLoadBase(); } catch {} })(), loadContractors().then(c => { TK.contrs = c; }).catch(() => {})]);
  const [list, shifts] = await Promise.all([tkLoadList(), sb.from('mesa_shifts').select('*').is('ended_at', null).then(r => r.data || [])]);
  const mine = shifts.find(s => s.user_id === me.id);
  const projTxt = s => !s.project_ids?.length ? 'todos los proyectos' : s.project_ids.map(id => tkProj(id)?.name || '').filter(Boolean).join(' · ');
  const f = TK.filter;
  const vis = list.filter(t => !f || t.project_id === f);
  const by = st => vis.filter(t => t.status === st);
  const cnt = { nuevo: by('nuevo').length, corre: vis.filter(t => ['corre'].includes(tkMood(t))).length, vencido: vis.filter(t => tkMood(t) === 'vencido').length };
  const card = t => { const pr = TK_PRIO[t.priority] || TK_PRIO.normal, m = tkMood(t);
    return `<button class="tk-card" data-tk="${esc(t.id)}" style="border-left-color:${TK_MOOD[m][1]}">${tkFigure(t, 40)}<div class="t">
      <div class="s">#${esc(t.ext_no)} · ${esc(tkPName(t.project_id))}</div><b>${esc(t.site_name)}${t.site2_name ? ' – ' + esc(t.site2_name) : ''}</b>
      <div class="s">${esc([t.category, tkProblem(t.problem, t.category)].filter(Boolean).join(' · '))}</div>
      ${t.staff_ids?.length || t.contractor_id ? `<div class="s" style="color:var(--navy)">${esc(tkWho(t))}</div>` : ''}
      <span class="p" style="background:${pr[2]};color:${pr[1]}">${pr[0]}</span>
      <div class="l" style="color:${TK_MOOD[m][1]}" data-left="${esc(t.id)}">${esc(tkLeftTxt(t))}</div></div></button>`; };
  const col = (st, title) => `<div class="tk-col"><b>${title} · ${by(st).length}</b>${by(st).map(card).join('') || '<span class="sm muted" style="padding:4px">—</span>'}</div>`;
  v.innerHTML = `
    <div class="row between" style="margin-bottom:10px;gap:10px">
      <div><h1 style="margin:0">Mesa de tickets</h1><div class="muted sm">${shifts.length ? 'De turno: ' + shifts.map(s => `<b>${esc(s.user_name || '')}</b> (${esc(projTxt(s))})`).join(' · ') : 'Nadie tomó el turno: los informes listos les llegan a toda la oficina.'}</div></div>
      <div class="row" style="gap:6px">
        <select id="tk-f" style="width:auto"><option value="">Todos los proyectos</option>${TK.projects.map(p => `<option value="${esc(p.id)}" ${p.id === f ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
        <button class="btn ${mine ? 'sec' : ''}" id="tk-shift">${mine ? 'Dejar el turno' : 'Tomar el turno'}</button>
        <button class="btn sec" id="tk-cfg" title="Ticketeras">⚙ Ticketeras</button></div></div>
    ${!TK.projects.length ? `<div class="banner warn" style="margin:0 0 12px"><span class="dot"></span><div><b>Primero armá un proyecto de mantenimiento</b><div class="sm">En Proyectos → nuevo proyecto de tipo Mantenimiento, con su ticketera, su planilla de correctivo y la tabla del pliego.</div><a class="btn small" href="#/proj" style="margin-top:6px">Ir a Proyectos</a></div></div>` : ''}
    <div class="tk-top">
      <div class="tk-paste" id="tk-paste" tabindex="0" role="button" aria-label="Pegar captura o texto del ticket">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#0F2A4A" stroke-width="2" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3h6v3H9zM12 10v6M9 13h6"/></svg>
        <div style="flex:1"><b>Pegá acá la captura o el texto del ticket (Ctrl+V)</b><div class="sm muted">El detalle de un ticket o la lista entera. También podés arrastrar la imagen o <a href="#" id="tk-pick">elegir un archivo</a> · <a href="#" id="tk-manual">cargar a mano</a></div></div>
        <input type="file" id="tk-file" accept="image/png,image/jpeg,image/webp" class="hidden"></div>
      <button class="tk-cnt" data-jump="nuevo"><span>Nuevos</span><b>${cnt.nuevo}</b></button>
      <button class="tk-cnt" style="background:#FFF7ED;border-color:#FDBA74" data-jump="corre"><span style="color:#9A3412">Por vencer</span><b style="color:#C2410C">${cnt.corre}</b></button>
      <button class="tk-cnt" style="background:#FEF2F2;border-color:#FCA5A5" data-jump="vencido"><span style="color:#991B1B">Fuera de SLA</span><b style="color:#B91C1C">${cnt.vencido}</b></button>
    </div>
    <div class="tk-board">${col('nuevo', 'Nuevos')}${col('asignado', 'Asignados')}${col('en_curso', 'En curso')}${col('informe', 'Informe listo')}${col('cerrado', 'Cargados en el cliente (hoy)')}</div>
    <div class="tk-side"><div class="card" style="margin:0"><h2 style="margin:0 0 8px">Gente hoy</h2><div id="tk-people" class="sm muted">Cargando…</div></div>
      <div class="card" style="margin:0;padding:0;overflow:hidden"><div id="tk-map" style="height:300px"></div></div></div>`;
  $('#tk-f').onchange = e => { TK.filter = e.target.value; viewMesa(v); };
  $('#tk-shift').onclick = () => mine ? tkShiftEnd(() => viewMesa(v)) : tkShiftModal(() => viewMesa(v));
  $('#tk-cfg').onclick = () => tkTicketerasModal(() => viewMesa(v));
  v.querySelectorAll('[data-tk]').forEach(b => b.onclick = () => tkDetailModal(b.dataset.tk, () => viewMesa(v)));
  v.querySelectorAll('[data-jump]').forEach(b => b.onclick = () => { const k = b.dataset.jump; const t = vis.find(x => k === 'nuevo' ? x.status === 'nuevo' : tkMood(x) === k); if (t) v.querySelector(`[data-tk="${t.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
  tkBindPaste(v, () => viewMesa(v));
  clearInterval(TK.timer);
  TK.timer = setInterval(() => { if (!document.body.contains(v.querySelector('.tk-board'))){ clearInterval(TK.timer); return; }
    v.querySelectorAll('[data-left]').forEach(el => { const t = list.find(x => x.id === el.dataset.left); if (t) el.textContent = tkLeftTxt(t); }); }, 60000);
  tkPeople($('#tk-people'), list).catch(() => { $('#tk-people').textContent = 'Sin datos de la gente.'; });
  tkMap(list.filter(t => t.status !== 'cerrado')).catch(() => {});
}

/* gente de hoy: jornada abierta, guardia y tickets abiertos */
async function tkPeopleData(){
  const today = todayStr();
  const [days, guard] = await Promise.all([
    sb.from('veh_days').select('staff_id,start_lat,start_lng,start_at,status').eq('status', 'abierta').then(r => r.data || []).catch(() => []),
    sb.from('hh_guard').select('staff_id,code').eq('day', today).then(r => r.data || []).catch(() => []),
  ]);
  return { days, guard: guard.filter(g => /^g/i.test(g.code || '')) };
}
async function tkPeople(box, list){
  if (!box) return;
  const { days, guard } = await tkPeopleData();
  const open = id => list.filter(t => !['cerrado', 'cancelado', 'informe'].includes(t.status) && (t.staff_ids || []).includes(id)).length;
  const staff = (HHS.staff || []).filter(s => s.active && s.kind !== 'contratista');
  const rows = staff.map(s => ({ s, day: days.find(d => d.staff_id === s.id), g: guard.some(g => g.staff_id === s.id), n: open(s.id) }))
    .filter(x => x.day || x.g || x.n).sort((a, b) => (b.day ? 1 : 0) - (a.day ? 1 : 0) || a.n - b.n);
  const ctr = (TK.contrs || []).filter(c => c.active).map(c => ({ c, n: list.filter(t => t.contractor_id === c.id && !['cerrado', 'cancelado', 'informe'].includes(t.status)).length }));
  box.innerHTML = (rows.map(x => `<div class="row between" style="padding:5px 0;border-bottom:1px solid var(--line);color:var(--ink,#0F2A4A)"><span>${esc(x.s.name)}</span><span class="sm" style="color:${x.n ? 'var(--muted)' : 'var(--green-d,#15803D)'};font-weight:${x.n ? 400 : 700}">${x.day ? 'jornada abierta' : ''}${x.g ? (x.day ? ' · ' : '') + 'de guardia' : ''}${' · ' + (x.n ? x.n + ' abierto(s)' : 'libre')}</span></div>`).join('')
    + ctr.map(x => `<div class="row between" style="padding:5px 0;border-bottom:1px solid var(--line);color:var(--ink,#0F2A4A)"><span>Contratista ${esc(x.c.name)}</span><span class="sm muted">${x.n} abierto(s)</span></div>`).join(''))
    || 'Hoy nadie abrió jornada. Igual podés asignar a cualquiera.';
}
let tkMapObj = null;
async function tkMap(list){
  if (typeof L === 'undefined' || !$('#tk-map')) return;
  if (tkMapObj){ tkMapObj.remove(); tkMapObj = null; }
  try { if (!SITE_COORDS.size) rememberCoords(await loadSitesMap()); } catch {}
  tkMapObj = L.map('tk-map'); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap' }).addTo(tkMapObj);
  const pts = [];
  for (const t of list){ const c = t.site_id && SITE_COORDS.get(t.site_id); if (!c) continue; pts.push(c);
    L.circleMarker(c, { radius: 8, color: '#fff', weight: 2, fillColor: TK_MOOD[tkMood(t)][1], fillOpacity: 1 }).bindTooltip(`<b>${esc(t.site_name)}</b><br>#${esc(t.ext_no)} · ${esc(tkLeftTxt(t))}`).addTo(tkMapObj); }
  try { const { days } = await tkPeopleData();
    for (const d of days){ if (d.start_lat == null) continue; const c = [Number(d.start_lat), Number(d.start_lng)]; pts.push(c);
      L.marker(c, { icon: L.divIcon({ className: '', html: '<div style="width:14px;height:14px;border-radius:4px;background:#0F2A4A;border:2px solid #fff"></div>', iconSize: [14, 14] }) }).bindTooltip(esc(tkStaffName(d.staff_id)) + ' (inicio de jornada)').addTo(tkMapObj); } } catch {}
  if (pts.length) tkMapObj.fitBounds(pts, { padding: [24, 24], maxZoom: 11 }); else tkMapObj.setView([-31.6, -60.7], 7);
}

/* ---------- turno ---------- */
function tkShiftModal(after){
  const m = modal(`<h2>Tomar el turno</h2><p class="muted sm" style="margin-top:-4px">Los informes listos de estos proyectos te llegan a vos. Puede haber varios de turno a la vez.</p>
    <div style="display:flex;flex-direction:column;gap:6px;margin:8px 0">${TK.projects.map(p => `<label style="display:flex;gap:8px;align-items:center;font-weight:400"><input type="checkbox" class="sh-p" value="${esc(p.id)}" checked style="width:auto"> ${esc(p.name)}</label>`).join('') || '<span class="muted sm">Todos los proyectos</span>'}</div>
    <label>Nota (opcional)</label><input id="sh-n" maxlength="300" placeholder="Ej.: turno mañana hasta las 14">
    <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn sec" id="sh-x">Cancelar</button><button class="btn" id="sh-ok">Tomar el turno</button></div>`);
  $('#sh-x').onclick = m.close;
  $('#sh-ok').onclick = async () => { const ids = [...m.el.querySelectorAll('.sh-p:checked')].map(c => c.value); const all = ids.length === TK.projects.length;
    const { error } = await sb.rpc('shift_take', { p_projects: all ? [] : ids, p_note: $('#sh-n').value || null }); if (error) return toast(errText(error)); m.close(); toast('Tenés el turno'); after && after(); };
}
async function tkShiftEnd(after){
  const n = prompt('Nota para el que sigue (pendientes, avisos). Podés dejarla vacía.', '');
  if (n === null) return;
  const { error } = await sb.rpc('shift_end', { p_note: n || null }); if (error) return toast(errText(error)); toast('Dejaste el turno'); after && after();
}

/* =====================================================================
   ENTRADA: pegar captura o texto
   ===================================================================== */
function tkBindPaste(v, after){
  const box = $('#tk-paste'); if (!box) return;
  const onFile = f => { if (f && /^image\//.test(f.type)) tkFromImage(f, after); };
  const pasteH = e => {
    if (!document.body.contains(box)){ document.removeEventListener('paste', pasteH); return; }
    if (document.querySelector('.modal-bg, .modal-root .modal, #modal-root .modal')) return;   // con un formulario abierto, el pegado es para el formulario
    const it = [...(e.clipboardData?.items || [])];
    const img = it.find(x => x.type.startsWith('image/'));
    if (img){ e.preventDefault(); onFile(img.getAsFile()); return; }
    const txt = e.clipboardData?.getData('text/plain');
    if (txt && txt.trim().length > 3){ e.preventDefault(); tkFromText(txt.slice(0, 20000), null, after); }
  };
  document.removeEventListener('paste', TK.pasteH || (() => {})); TK.pasteH = pasteH; document.addEventListener('paste', pasteH);
  box.onclick = e => { if (e.target.id === 'tk-manual'){ e.preventDefault(); return tkPreview([{}], null, '', after); } if (e.target.id === 'tk-pick' || e.target === box){ e.preventDefault(); $('#tk-file').click(); } };
  $('#tk-file').onchange = e => onFile(e.target.files[0]);
  box.ondragover = e => { e.preventDefault(); box.classList.add('drag'); }; box.ondragleave = () => box.classList.remove('drag');
  box.ondrop = e => { e.preventDefault(); box.classList.remove('drag'); onFile(e.dataTransfer.files[0]); };
}
/* lector de texto de la imagen: corre en el navegador (archivos de la app, nada sale afuera) */
let tkOcrWorker = null;
async function tkOcr(file, onProg){
  if (file.size > 12 * 1024 * 1024) throw new Error('La imagen supera 12 MB.');
  if (typeof Tesseract === 'undefined') await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'tesseract.min.js'; s.onload = res; s.onerror = () => rej(new Error('No se pudo cargar el lector de capturas (falta tesseract.min.js en el sitio).')); document.head.appendChild(s); });
  if (!tkOcrWorker) tkOcrWorker = await Tesseract.createWorker('spa', 1, { workerPath: new URL('worker.min.js', location.href).href, corePath: new URL('.', location.href).href, langPath: new URL('.', location.href).href, gzip: true, workerBlobURL: false,
    logger: m => { if (m.status === 'recognizing text' && onProg) onProg(m.progress); } });
  // agrandar y pasar a grises mejora la lectura de capturas de pantalla
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('La imagen no se puede leer.')); i.src = URL.createObjectURL(file); });
  const k = Math.min(3, Math.max(1, 2400 / Math.max(img.width, 1)));
  const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  const g = c.getContext('2d'); g.filter = 'grayscale(1) contrast(1.15)'; g.drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(img.src);
  const { data } = await tkOcrWorker.recognize(c);
  return String(data.text || '').slice(0, 20000);
}
async function tkFromImage(file, after){
  if (!needOnline()) return;
  const m = modal(`<h2>Leyendo la captura…</h2><div class="progress"><i id="ocr-p" style="width:3%"></i></div><p class="muted sm">La primera vez tarda un poco más (descarga el lector, unos 10 MB, y queda guardado).</p>`);
  let txt = '';
  try { txt = await tkOcr(file, p => { const el = $('#ocr-p'); if (el) el.style.width = Math.round(p * 100) + '%'; }); }
  catch (e){ m.close(); return toast(errText(e)); }
  m.close();
  if (!txt.trim()) return toast('No se pudo leer texto en la imagen. Probá con una captura más grande o pegá el texto.');
  tkFromText(txt, file, after);
}

/* ---------- lectura del texto: presets de las ticketeras conocidas + las que se carguen ---------- */
const TK_PRESETS = {
  // el lector a veces lee el "#" como "=", "5" o "2": se toman los 5 dígitos del número, en el renglón de "Type / Nodo Tipo / Client"
  sf: { name: 'Portal Santa Fe', num_re: '(?:^|[^\\d])[#=]?\\d?(\\d{5})\\b(?=.*(?:type|tipo|client|nodo))', title_re: '^(.+?)\\s*/\\s*(.+?)\\s*/\\s*(.+)$', include_hours: false, pdf_tpl: '{ticket}-{sitio}',
        status_map: { open: 'Open', closed: 'Closed', pending: 'Pending', cancelled: 'Cancelled' },
        note_tpl: '{saludo}\n\n{realizado}\n\nAdjunto informe para su cierre\n\nSaludos cordiales\n\n{tecnico}\n{cargo}\n{telefono}' },
  trans: { name: 'Ticketera Trans', num_re: 'TICKET\\s*N[°ºo]?\\s*:?\\s*(\\d{3,8})', title_re: '', include_hours: true, pdf_tpl: '{ticket}-{sitio}', status_map: {},
        note_tpl: '{realizado}\n\nTrabajo realizado por {tecnico} el {fecha}. Se adjunta informe.' },
};
function tkRe(s, flags = 'i'){ try { return s ? new RegExp(s, flags) : null; } catch { return null; } }
function tkParse(text){
  const lines = text.replace(/\r/g, '').split('\n').map(l => l.replace(/[|¦]/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
  const all = lines.join('\n');
  // ¿qué ticketera es? por las marcas de la pantalla, y si no, la que reconozca un número
  const isTrans = /CREADOR|PRODUCTO\s*:|TICKET\s*N[°ºo]/i.test(all);
  const kind = isTrans ? 'trans' : /\S\s\/\s\S+\s\/\s\S/.test(all) ? 'sf' : null;
  let tkr = (kind && TK.tkr.find(x => (kind === 'trans' ? /trans/i : /santa\s*fe/i).test(x.name))) || TK.tkr.find(x => tkRe(x.num_re)?.test(all)) || null;
  const preset = kind ? TK_PRESETS[kind] : null;
  const out = [];
  if (isTrans){
    // el número: el que se repite (pestaña abierta y encabezado "TICKET N°"); si no, el del encabezado
    const cnt = {}; for (const mm of all.matchAll(/(?:ticket\s*n?[°ºo]?\s*:?\s*|^)(\d{4,8})\b/gim)) cnt[mm[1]] = (cnt[mm[1]] || 0) + 1;
    const n = all.match(/TICKET\s*N[°ºo]?\s*:?\s*(\d{3,8})/i)?.[1] || Object.entries(cnt).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
    const d = all.match(/cre[oó] un ticket[\s\S]{0,60}?(\d{1,2})\/(\d{1,2})\/(\d{4})[\s\S]{0,60}?(\d{1,2}):(\d{2})/i);
    const prio = all.match(/prioridad[\s\S]{0,40}?\b(alta|media|baja|cr[ií]tica)\b/i)?.[1];
    const textual = l => { const letters = (l.match(/[a-záéíóúñ0-9 \-.,]/gi) || []).length; return l.length > 25 && letters / l.length > .92 && (l.match(/[a-záéíóúñ]{3,}/gi) || []).length >= 4 && !/:/.test(l); };
    const dl = lines.findIndex(l => /^descripci[oó]n:/i.test(l));
    const desc = (dl >= 0 ? (lines[dl].replace(/^descripci[oó]n:\s*/i, '') + ' ' + (lines[dl + 1] && !/:/.test(lines[dl + 1]) ? lines[dl + 1] : '')).trim() : '')
      || lines.find(l => textual(l) && !/ticket|producto|creador|empresa|agregar|exportar|notificaciones|reasign|cambi[oó] el estado|registr[oó]|proyectad|financiero|definir/i.test(l)) || '';
    out.push({ ext_no: n || '', problem: desc.slice(0, 300), description: desc, site_name: (desc.match(/edificio\s+(.+)$/i)?.[1] || '').slice(0, 200),
      reported_at: d ? new Date(Number(d[3]), Number(d[2]) - 1, Number(d[1]), Number(d[4]), Number(d[5])).toISOString() : null,
      priority: prio ? ({ alta: 'alta', media: 'normal', baja: 'baja', 'crítica': 'critica', critica: 'critica' })[norm(prio)] : null, _tkr: tkr?.id || null, _preset: 'trans' });
    return out;
  }
  if (/TICKET\s*DETAILS|^\s*Created\b|^\s*Due\b/im.test(all)){        // detalle de un ticket del portal
    const d = tkParseDetail(lines, all, tkr); if (d) return [d];
  }
  const numRe = tkRe(tkr?.num_re || preset?.num_re || TK_PRESETS.sf.num_re);
  const titleRe = tkRe(tkr?.title_re || preset?.title_re || TK_PRESETS.sf.title_re);
  for (let i = 0; i < lines.length; i++){
    const mm = lines[i].match(numRe); if (!mm) continue;
    let title = '';
    for (let j = i - 1; j >= Math.max(0, i - 3); j--){ if (titleRe?.test(lines[j])){ title = lines[j]; break; } }
    const tm = title.match(titleRe) || [];
    const after = lines[i].slice(mm.index + mm[0].length);      // el estado está a la derecha del número (no en el renglón de abajo: ahí está el menú)
    const st = after.match(/\b(Open|Closed|Pending|Cancelled|Abierto|Cerrado|Pendiente|Cancelado)\b/i)?.[1] || null;
    const node = after.match(/nodo\s*tipo\s*(\d)/i)?.[1];
    const ago = (title + ' ' + after).match(/(\d+)\s*(minutes?|hours?|days?)\s*ago|hace\s*(\d+)\s*(minutos?|horas?|d[ií]as?)/i);
    const clean = v => String(v || '').replace(/["“”»«'`~^*_]+/g, ' ').replace(/\s+(Updated|Closed|Actualizado)\b.*$/i, '').replace(/\s+/g, ' ').trim();
    out.push({ ext_no: mm[1], site_name: clean(tm[1]).slice(0, 200), category: tm[2] ? stxCat(tm[2]) : null, problem: clean(tm[3]).slice(0, 300), ext_status: st,
      node_type: node && Number(node) >= 1 && Number(node) <= 4 ? Number(node) : null, _ago: ago ? ago[0] : null, _tkr: tkr?.id || null, _preset: kind });
  }
  const seen = new Set(); return out.filter(x => x.ext_no && !seen.has(x.ext_no) && seen.add(x.ext_no));
}
/* fecha del portal: 26/10/26 15:26 (o 26/10/2026 15:26) → ISO */
function tkDate(s){
  const m = String(s || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})\D{1,4}(\d{1,2})[:.](\d{2})/); if (!m) return null;
  const y = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);
  const d = new Date(y, Number(m[2]) - 1, Number(m[1]), Number(m[4]), Number(m[5])); return isNaN(d) ? null : d.toISOString();
}
function tkParseDetail(lines, all, tkr){
  let num = all.match(/(?:^|\n)\s*[#*=+»>]?\s*(\d{5,7})\b/)?.[1] || all.match(/(?:ticket|#)\s*:?\s*(\d{4,7})/i)?.[1];
  // los tickets del portal tienen 5 dígitos: si vienen 6 y el primero es un "#" mal leído (4, 2, 5, 7, 9), quedan los últimos 5
  if (num && num.length === 6 && /^[24579]/.test(num) && (!tkr || /\{5\}/.test(tkr.num_re || '') || /santa\s*fe/i.test(tkr.name || ''))) num = num.slice(1);
  const titleRe = tkRe(tkr?.title_re || TK_PRESETS.sf.title_re);
  const title = lines.find(l => titleRe.test(l) && !/^(created|due|chient|client)/i.test(l)) || '';
  const tm = title.match(titleRe) || [];
  const cr = lines.find(l => /^\s*created\b(?!\s*by)/i.test(l)), du = lines.find(l => /^\s*due\b/i.test(l));
  const by = (lines.find(l => /^\s*created\s*by/i.test(l)) || '').replace(/^\s*created\s*by[.:]?\s*/i, '');
  const di = lines.findIndex(l => /^\s*details\s*$/i.test(l));
  const desc = di >= 0 ? lines.slice(di + 1).filter(l => !/^(notes|ticket notes|attachments?|history)\b/i.test(l)).join('\n').slice(0, 4000) : '';
  const af = all.match(/\b(sin afectaci[oó]n|afectado|afectaci[oó]n total|afectaci[oó]n parcial)\b/i)?.[1];
  const node = all.match(/nodo\s*tipo\s*(\d)/i)?.[1];
  if (!num && !title) return null;
  const clean = v => String(v || '').replace(/["“”»«'`~^*_]+/g, ' ').replace(/\s+/g, ' ').trim();
  return { ext_no: num || '', site_name: clean(tm[1]).slice(0, 200), category: tm[2] ? stxCat(tm[2]) : null, problem: clean(tm[3]).slice(0, 300),
    reported_at: tkDate(cr), client_due_at: tkDate(du), created_by_client: clean(by).slice(0, 120) || null, description: desc || null,
    afect: af ? (/sin|parcial/i.test(af) ? 'parcial' : 'total') : null, node_type: node && Number(node) <= 4 ? Number(node) : null,
    _tkr: tkr?.id || null, _preset: 'sf', _detail: true };
}
async function tkFromText(text, file, after){
  await tkLoadBase();
  const found = tkParse(text);
  if (!found.length) return tkPreview([{ description: text.slice(0, 4000) }], file, text, after);
  return tkPreview(found, file, text, after);
}

/* ---------- vista previa y confirmación ---------- */
async function tkSitesAll(){ return (await pageAll(() => sb.from('sites').select('id,name,traza,node_type,aliases').eq('active', true).order('name').order('id'))).data || []; }
function tkMatchSite(sites, name){
  const k = stxK(name || ''); if (!k) return null;
  const exact = q => sites.find(s => stxK(s.name) === q || (s.aliases || []).some(a => stxK(a) === q));
  let hit = exact(k); if (hit) return hit;
  const w = k.split(' ');                       // "y status 4 cululu" → prueba "cululu", "4 cululu"…
  for (let n = Math.min(5, w.length - 1); n >= 1; n--){ hit = exact(w.slice(-n).join(' ')); if (hit) return hit; }
  return sites.find(s => k.length > 4 && stxK(s.name).length > 4 && (k.endsWith(stxK(s.name)) || stxK(s.name).startsWith(k))) || null;
}
// el problema sin la categoría repetida adelante ("Energía / Falla en rectificador" → "Falla en rectificador")
function tkProblem(pr, cat){ let v = String(pr || '').trim(); for (const c of [cat, ...STX_CATS, 'Energia', 'Fibra Optica', 'Seguridad Fisica', 'FO']) if (c) v = v.replace(new RegExp('^' + c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*[/·:-]\\s*', 'i'), ''); return v.slice(0, 300); }
const tkFallaOf = cat => cat === 'Fibra óptica' ? 'fo' : ['Energía', 'Seguridad física'].includes(cat) ? 'infra' : 'otro';
const tkLocal = iso => { if (!iso) return ''; const d = new Date(iso); if (isNaN(d)) return ''; return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
async function tkPreview(items, file, raw, after){
  const sites = await tkSitesAll();
  const existing = new Map(TK.list.map(t => [t.project_id + '|' + String(t.ext_no).toLowerCase(), t]));
  const projFor = x => { const byTkr = TK.projects.filter(p => p.ticketera_id && p.ticketera_id === x._tkr); return (byTkr[0] || (TK.filter && tkProj(TK.filter)) || TK.projects[0] || {}).id || ''; };
  if (items.length > 1){     // captura de la lista: alta de los nuevos y actualización de estado
    const proj = projFor(items[0]);
    const m = modal(`<h2>${items.length} tickets en la captura</h2><p class="muted sm" style="margin-top:-4px">Los nuevos se cargan como "Nuevo" (después completás la hora del reporte); los que ya están se actualizan con el estado del cliente.</p>
      <label>Proyecto</label><select id="tl-p">${TK.projects.map(p => `<option value="${esc(p.id)}" ${p.id === proj ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
      <div class="tblwrap" style="max-height:340px;overflow:auto;margin-top:8px"><table class="tbl"><thead><tr><th></th><th>Ticket</th><th>Sitio</th><th>Categoría · problema</th><th>Estado del cliente</th><th></th></tr></thead><tbody>
      ${items.map((x, i) => { const ex = existing.get(proj + '|' + String(x.ext_no).toLowerCase()), ms = tkMatchSite(sites, x.site_name); return `<tr><td><input type="checkbox" class="tl-c" data-i="${i}" checked style="width:auto"></td><td>#${esc(x.ext_no)}</td><td>${ms ? '<b>' + esc(ms.name) + '</b>' : esc(x.site_name) + ' <span class="pill p-pend">sin sitio</span>'}</td><td class="sm">${esc([x.category, x.problem].filter(Boolean).join(' · '))}</td><td>${esc(x.ext_status || '')}</td><td>${ex ? '<span class="pill">ya está</span>' : '<span class="pill p-ok">nuevo</span>'}</td></tr>`; }).join('')}</tbody></table></div>
      <div class="err" id="tl-err"></div>
      <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn sec" id="tl-x">Cancelar</button><button class="btn" id="tl-ok">Cargar</button></div>`, { wide: true });
    $('#tl-x').onclick = m.close;
    $('#tl-ok').onclick = async () => {
      $('#tl-ok').disabled = true; let nw = 0, up = 0;
      try { for (const c of m.el.querySelectorAll('.tl-c:checked')){ const x = items[Number(c.dataset.i)]; const s = tkMatchSite(sites, x.site_name);
          const { data, error } = await sb.rpc('ticket_upsert', { p: { project_id: $('#tl-p').value, ext_no: x.ext_no, ext_status: x.ext_status, site_id: s?.id || null, site_name: s?.name || x.site_name || 'Sin sitio',
            category: x.category, problem: tkProblem(x.problem, x.category), falla: tkFallaOf(x.category), node_type: x.node_type || s?.node_type || null } });
          if (error) throw error; data.created ? nw++ : up++; }
        m.close(); toast(`${nw} nuevo(s) · ${up} actualizado(s)`); after && after();
      } catch (e){ $('#tl-ok').disabled = false; $('#tl-err').textContent = errText(e); }
    };
    return;
  }
  const x = items[0] || {};
  let tm = x._preset === 'trans' ? [String(x.site_name || '')] : String(x.site_name || '').split(/\s+[-–]\s+/);   // en Trans el " - " es parte de la dirección
  if (tm.length === 1 && !tkMatchSite(sites, tm[0]) && /\S[-–]\S/.test(tm[0])){ const z = tm[0].split(/[-–]/); if (tkMatchSite(sites, z[0]) || tkMatchSite(sites, z[1])) tm = z; }
  let s1 = tkMatchSite(sites, tm[0]), s2 = tm[1] ? tkMatchSite(sites, tm[1]) : null;
  const proj0 = projFor(x);
  let afect = x.afect || null, falla = tkFallaOf(x.category);
  const m = modal(`<h2>${x.ext_no ? 'Nuevo ticket' : 'Cargar ticket a mano'}${x._preset ? ` <span class="pill p-ok" style="font-size:12px;vertical-align:middle">${x._preset === 'sf' ? 'Portal Santa Fe' : 'Ticketera Trans'}</span>` : ''}</h2>
    <div class="grid2" style="gap:14px">
      ${raw ? `<div><div class="sm muted" style="font-weight:700;text-transform:uppercase;letter-spacing:.05em">Lo que leyó la app</div><div class="tk-ocr" style="background:#111;color:#eee;border-radius:12px;padding:12px;font-size:13px;line-height:1.5;max-height:330px;overflow:auto;white-space:pre-wrap">${tkMarkRaw(raw, x)}</div>
        <p class="sm muted">La lectura se hizo en tu equipo. Corregí a la derecha lo que haga falta.</p></div>` : ''}
      <div style="display:flex;flex-direction:column;gap:2px">
        <label>Proyecto</label><select id="tn-p">${TK.projects.map(p => `<option value="${esc(p.id)}" ${p.id === proj0 ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
        <div class="row" style="gap:10px"><div class="grow"><label>Nro. de ticket</label><input id="tn-n" maxlength="60" value="${esc(x.ext_no || '')}"></div>
          <div class="grow"><label>Creado (Created)</label><input id="tn-r" type="datetime-local" value="${esc(tkLocal(x.reported_at))}" style="${x.reported_at ? 'border-color:var(--green)' : 'border:2px solid var(--amber)'}"></div>
          <div class="grow"><label>Vence (Due)</label><input id="tn-d" type="datetime-local" value="${esc(tkLocal(x.client_due_at))}" style="${x.client_due_at ? 'border-color:var(--green)' : ''}"></div></div>
        ${!x.reported_at ? `<p class="sm" style="color:#92400E;background:#FFFBEB;border-radius:8px;padding:6px 10px;margin:4px 0">${x._ago ? `La captura dice "${esc(x._ago)}": ` : ''}cargá cuándo el cliente creó el ticket (desde ahí corre el SLA). El vencimiento lo fija el ticket (Due); si no lo trae, sale del pliego.</p>` : ''}
        <label>Sitio</label><input id="tn-s" list="tn-sl" maxlength="200" value="${esc(s1?.name || tm[0] || '')}" autocomplete="off" style="${s1 ? 'border-color:var(--green)' : ''}">
        <label>Tramo: hasta el nodo <span class="muted sm">(si afecta a dos)</span></label><input id="tn-s2" list="tn-sl" maxlength="200" value="${esc(s2?.name || tm[1] || '')}" autocomplete="off">
        <datalist id="tn-sl">${sites.map(s => `<option value="${esc(s.name)}">`).join('')}</datalist>
        <div class="row" style="gap:10px"><div class="grow"><label>Categoría</label><select id="tn-c"><option value="">—</option>${STX_CATS.map(c => `<option value="${esc(c)}" ${c === x.category ? 'selected' : ''}>${esc(STX_CAT_TXT[c] || c)}</option>`).join('')}</select></div>
          <div class="grow"><label>Tipo de nodo</label><select id="tn-nt"><option value="">—</option>${[1, 2, 3, 4].map(n => `<option ${n === (x.node_type || s1?.node_type) ? 'selected' : ''}>${n}</option>`).join('')}</select></div></div>
        <label>Problema</label><input id="tn-pr" maxlength="300" value="${esc(x.problem || '')}">
        <label>Tipo de falla (para el pliego)</label><select id="tn-f">${Object.entries(TK_FALLA).map(([k, l]) => `<option value="${k}" ${k === falla ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
        <div class="row" style="gap:10px;align-items:center;margin-top:8px"><span class="sm">Afectación</span><div class="tk-seg"><button type="button" data-a="" class="${!afect ? 'on' : ''}">Sin dato</button><button type="button" data-a="total" class="${afect === 'total' ? 'on' : ''}">Total</button><button type="button" data-a="parcial" class="${afect === 'parcial' ? 'on' : ''}">Parcial</button></div></div>
        ${x.description ? `<label>Descripción del cliente</label><textarea id="tn-de" rows="3" maxlength="4000">${esc(x.description)}</textarea>` : ''}
        <div class="tk-sla" id="tn-sla" style="margin-top:10px"></div>
      </div></div>
    <div class="err" id="tn-err"></div>
    <div class="row" style="justify-content:flex-end;margin-top:10px;gap:8px"><button class="btn sec" id="tn-x">Cancelar</button><button class="btn sec" id="tn-save">Guardar</button><button class="btn" id="tn-go">Guardar y asignar</button></div>`, { wide: true });
  const calc = async () => {
    const p = tkProj($('#tn-p').value), rules = await tkRules(p?.id), node = Number($('#tn-nt').value) || null;
    const r = tkPickRule(rules, $('#tn-f').value, afect, node), pr = x.priority || (p?.node_priority || {})[String(node)] || 'normal', P = TK_PRIO[pr];
    const rep = $('#tn-r').value ? new Date($('#tn-r').value) : null, cd = $('#tn-d').value ? new Date($('#tn-d').value) : null;
    let head, big;
    if (cd){ const h = rep ? (cd - rep) / 3600000 : null;
      head = 'Vencimiento del ticket (manda lo que dice el cliente)' + (r && h != null && Math.abs(h - r.ttr_h) >= 1 ? ` · el pliego da ${tkH(Number(r.ttr_h))} para ${esc(TK_FALLA_S[$('#tn-f').value])}${afect ? ' ' + afect : ''}` : '');
      big = `Vence ${esc(fmtDT(cd))}${h != null && h > 0 ? ' · plazo ' + tkH(h) : ''}`; }
    else { const due = rep && r ? new Date(rep.getTime() + r.ttr_h * 3600000) : null;
      head = r ? `El ticket no trae Due: según el pliego (${esc(TK_FALLA_S[$('#tn-f').value])}${afect ? ' · ' + afect : ''} · nodo ${node || '¿?'})` : rules.length ? 'Sin Due y sin una regla del pliego para esta combinación' : 'Sin Due: el proyecto todavía no tiene la tabla del pliego';
      big = r ? `TTR ${tkH(Number(r.ttr_h))}${due ? ' · vence ' + esc(fmtDT(due)) : ''}` : 'Sin vencimiento'; }
    $('#tn-sla').innerHTML = `<div><div class="sm" style="opacity:.8">${head}</div><b style="font-size:18px">${big}</b></div><span style="background:${P[2]};color:${P[1]};font-weight:700;padding:5px 10px;border-radius:8px">Prioridad ${P[0]}</span>`;
  };
  m.el.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { afect = b.dataset.a || null; m.el.querySelectorAll('[data-a]').forEach(z => z.classList.toggle('on', z === b)); calc(); });
  ['#tn-p', '#tn-nt', '#tn-f', '#tn-r', '#tn-d'].forEach(id => $(id).addEventListener('change', calc));
  $('#tn-c').onchange = () => { $('#tn-f').value = tkFallaOf($('#tn-c').value); calc(); };
  $('#tn-s').onchange = () => { const s = tkMatchSite(sites, $('#tn-s').value); $('#tn-s').style.borderColor = s ? 'var(--green)' : ''; if (s?.node_type) $('#tn-nt').value = s.node_type; calc(); };
  calc();
  $('#tn-x').onclick = m.close;
  const save = async go => {
    $('#tn-err').textContent = '';
    const n = $('#tn-n').value.trim(); if (!n) return ($('#tn-err').textContent = 'Falta el número de ticket.');
    if (!$('#tn-p').value) return ($('#tn-err').textContent = 'Elegí el proyecto.');
    const s = tkMatchSite(sites, $('#tn-s').value), sb2 = $('#tn-s2').value.trim() ? tkMatchSite(sites, $('#tn-s2').value) : null;
    $('#tn-save').disabled = $('#tn-go').disabled = true;
    try {
      let cap = null;
      if (file){ const blob = await compressImage(file, 2000, 0.85); cap = `${me.org_id}/tickets/${uid()}.jpg`;
        const { error } = await sb.storage.from('fotos').upload(cap, blob, { contentType: 'image/jpeg', upsert: false }); if (error) cap = null; }
      const { data, error } = await sb.rpc('ticket_upsert', { p: { project_id: $('#tn-p').value, ext_no: n, ext_status: x.ext_status || null,
        reported_at: $('#tn-r').value ? new Date($('#tn-r').value).toISOString() : null, client_due_at: $('#tn-d').value ? new Date($('#tn-d').value).toISOString() : null,
        created_by_client: x.created_by_client || null, site_id: s?.id || null, site_name: s?.name || $('#tn-s').value.trim() || 'Sin sitio',
        site2_id: sb2?.id || null, site2_name: sb2?.name || $('#tn-s2').value.trim() || null, category: $('#tn-c').value || null, problem: tkProblem($('#tn-pr').value, $('#tn-c').value) || null,
        description: ($('#tn-de')?.value ?? x.description) || null, falla: $('#tn-f').value, afect, node_type: Number($('#tn-nt').value) || null,
        priority: x.priority || null, priority_manual: !!x.priority, capture_path: cap } });
      if (error) throw error;
      m.close(); toast(data.created ? 'Ticket cargado' : 'El ticket ya estaba: se actualizó');
      if (go){ await tkLoadList(); tkAssignModal(data.id, after); } else after && after();
    } catch (e){ $('#tn-save').disabled = $('#tn-go').disabled = false; $('#tn-err').textContent = errText(e); }
  };
  $('#tn-save').onclick = () => save(false); $('#tn-go').onclick = () => save(true);
}
function tkMarkRaw(raw, x){
  let h = esc(raw.slice(0, 6000));
  for (const v of [x.ext_no, x.site_name, x.problem].filter(v => v && String(v).length > 2)){ const e = esc(String(v)); h = h.split(e).join(`<mark>${e}</mark>`); }
  return h;
}

/* =====================================================================
   ASIGNAR (con sugerencia: jornada abierta, guardia, cercanía y carga)
   ===================================================================== */
async function tkAssignModal(id, after){
  if (!needOnline()) return;
  try { await hhLoadBase(); } catch {}
  if (!TK.contrs) TK.contrs = await loadContractors().catch(() => []);
  const t = TK.list.find(x => x.id === id) || (await sb.from('tickets').select('*').eq('id', id).single()).data;
  if (!t) return toast('No se encontró el ticket');
  const { days, guard } = await tkPeopleData();
  try { if (!SITE_COORDS.size) rememberCoords(await loadSitesMap()); } catch {}
  const site = t.site_id && SITE_COORDS.get(t.site_id);
  const open = sid => TK.list.filter(x => !['cerrado', 'cancelado', 'informe'].includes(x.status) && (x.staff_ids || []).includes(sid)).length;
  const people = (HHS.staff || []).filter(s => s.active && s.kind !== 'contratista').map(s => {
    const d = days.find(z => z.staff_id === s.id), g = guard.some(z => z.staff_id === s.id);
    const km = d && site && d.start_lat != null ? stxDist([Number(d.start_lat), Number(d.start_lng)], site) / 1000 : null, n = open(s.id);
    const score = (d ? 30 : 0) + (g ? 15 : 0) - n * 12 - (km != null ? Math.min(km, 300) / 10 : 8);
    return { s, d, g, km, n, score };
  }).sort((a, b) => b.score - a.score);
  const best = people[0];
  const prj = tkProj(t.project_id);
  let tplName = 'la planilla del proyecto';
  if (prj?.corr_template_id){ try { const tp = await cached('tpl-pub', () => sb.from('templates').select('id,name,kind,definition').eq('published', true).order('name')); tplName = tp.find(z => z.id === prj.corr_template_id)?.name || tplName; } catch {} }
  const m = modal(`<div class="sm muted">#${esc(t.ext_no)} · ${esc(prj?.name || '')} · ${esc(tkLeftTxt(t))}</div>
    <h2 style="margin:2px 0 8px">¿Quién va a ${esc(t.site_name)}?</h2>
    <div class="sm muted" style="font-weight:700;text-transform:uppercase;letter-spacing:.05em">Sugeridos: jornada abierta hoy, guardia, cercanía y tickets abiertos</div>
    <div style="display:flex;flex-direction:column;gap:8px;max-height:300px;overflow:auto;margin:8px 0">
      ${people.map((p, i) => `<label style="display:flex;align-items:center;gap:12px;border:${i === 0 && p.score > 0 ? '2px solid var(--green);background:#F0FDF4' : '1px solid var(--line)'};border-radius:12px;padding:10px 14px;font-weight:400;cursor:pointer">
        <input type="checkbox" class="as-s" value="${esc(p.s.id)}" ${(t.staff_ids || []).includes(p.s.id) ? 'checked' : ''} style="width:22px;height:22px">
        <div style="flex:1"><b>${esc(p.s.name)}</b><div class="sm muted">${[p.d ? 'jornada abierta' : 'sin jornada hoy', p.g ? 'de guardia' : '', p.n ? p.n + ' ticket(s) abierto(s)' : 'sin tickets abiertos'].filter(Boolean).join(' · ')}</div></div>
        <div style="text-align:right"><b>${p.km != null ? Math.round(p.km) + ' km' : '—'}</b><div class="sm muted">${p.km != null ? 'desde el inicio de jornada' : 'sin ubicación'}</div></div>
        ${i === 0 && p.score > 0 ? '<span class="pill p-ok">Mejor opción</span>' : ''}</label>`).join('')}
      ${(TK.contrs || []).filter(c => c.active).map(c => `<label style="display:flex;align-items:center;gap:12px;border:1px solid var(--line);border-radius:12px;padding:10px 14px;font-weight:400;cursor:pointer">
        <input type="radio" name="as-c" class="as-c" value="${esc(c.id)}" ${t.contractor_id === c.id ? 'checked' : ''} style="width:22px;height:22px">
        <div style="flex:1"><b>Contratista ${esc(c.name)}</b><div class="sm muted">${TK.list.filter(x => x.contractor_id === c.id && !['cerrado', 'cancelado', 'informe'].includes(x.status)).length} ticket(s) abierto(s)</div></div></label>`).join('')}
      ${(TK.contrs || []).length ? '<label style="display:flex;gap:8px;align-items:center;font-weight:400" class="sm"><input type="radio" name="as-c" class="as-c" value="" style="width:auto"> Sin contratista</label>' : ''}
    </div>
    <div class="row" style="gap:10px"><div class="grow"><label>Planilla que se completa</label><input value="${esc(tplName)}" disabled></div>
      <div class="grow"><label>Indicaciones (opcional)</label><input id="as-n" maxlength="500" placeholder="Ej.: llevar rectificador de repuesto"></div></div>
    <label style="display:flex;gap:8px;align-items:center;font-weight:400;margin-top:8px"><input type="checkbox" id="as-wa" style="width:auto" ${tkWaAuto() ? 'checked' : ''}> Enviar por WhatsApp al asignar</label>
    <div class="err" id="as-err"></div>
    <div class="row between" style="margin-top:10px"><span class="sm muted">Le llega el aviso al teléfono con el sitio y la cuenta regresiva.</span>
      <div class="row" style="gap:8px"><button class="btn sec" id="as-x">Cancelar</button><button class="btn" id="as-ok">Asignar</button></div></div>`, { wide: true });
  if (best && best.score > 0 && !(t.staff_ids || []).length && !t.contractor_id) m.el.querySelector(`.as-s[value="${best.s.id}"]`).checked = true;
  const lbl = () => { const n = m.el.querySelectorAll('.as-s:checked').length, c = m.el.querySelector('.as-c:checked')?.value; $('#as-ok').textContent = n || c ? `Asignar${n ? ' a ' + n + ' técnico(s)' : ''}${c ? (n ? ' y' : '') + ' a la contratista' : ''}` : 'Asignar'; };
  m.el.querySelectorAll('.as-s, .as-c').forEach(i => i.onchange = lbl); lbl();
  $('#as-x').onclick = m.close;
  $('#as-ok').onclick = async () => {
    const st = [...m.el.querySelectorAll('.as-s:checked')].map(i => i.value), c = m.el.querySelector('.as-c:checked')?.value || null;
    if (!st.length && !c) return ($('#as-err').textContent = 'Elegí al menos un técnico o una contratista.');
    $('#as-ok').disabled = true;
    const { error } = await sb.rpc('ticket_assign', { p_ticket: t.id, p_staff: st, p_contractor: c, p_note: $('#as-n').value.trim() || null });
    if (error){ $('#as-ok').disabled = false; return ($('#as-err').textContent = errText(error)); }
    await IDB.del('kv', CUR_UID + ':tasks').catch(() => {});
    const wa = $('#as-wa').checked; try { localStorage.setItem('ia_tk_wa', wa ? '1' : '0'); } catch {}
    m.close(); after && after();
    tkReachModal({ ...t, staff_ids: st, contractor_id: c, _note: $('#as-n')?.value || '' }, wa, true);
  };
}

/* ---------- a quién le llegó el aviso, y WhatsApp ---------- */
const tkWaAuto = () => { try { return localStorage.getItem('ia_tk_wa') !== '0'; } catch { return true; } };
function tkWaText(t, name){
  const due = t.due_at ? fmtDT(t.due_at) : null;
  return [`Hola ${String(name || '').split(/[\s,]+/)[0] || ''}, te asigné el ticket #${t.ext_no} · ${t.site_name}${t.site2_name ? ' – ' + t.site2_name : ''}`,
    [t.category, tkProblem(t.problem, t.category)].filter(Boolean).join(' · '), due ? `Vence: ${due}` : null, t._note ? `Indicaciones: ${t._note}` : null,
    `Abrilo en InspectApp: ${location.origin + location.pathname}#/tickets/${t.id}`].filter(Boolean).join('\n');
}
async function tkReachModal(t, autoWa, justAssigned){
  const { data: reach, error } = await sb.rpc('ticket_reach', { p_ticket: t.id });
  if (error){ toast(justAssigned ? 'Asignado' : errText(error)); return; }
  const list = reach || [];
  let waOnly = false; try { waOnly = (await stxLoadCfg()).push_mode === 'off'; } catch {}
  const why0 = r => r.devices > 0 ? ['✔ le llega el aviso al teléfono', 'var(--green-d,#15803D)'] : r.has_user ? ['✖ no activó los avisos en su teléfono', 'var(--red)'] : [r.kind === 'contratista' ? '✖ la contratista no tiene usuario en la app' : '✖ no está vinculado a un usuario de la app', 'var(--red)'];
  const why = r => waOnly ? (waPhone(r.phone) ? ['avisale por WhatsApp', 'var(--muted)'] : ['✖ sin celular cargado (Recursos)', 'var(--red)']) : why0(r);
  const m = modal(`<h2>${justAssigned ? 'Asignado' : 'Avisar'} · #${esc(t.ext_no)} ${esc(t.site_name)}</h2>
    ${list.map((r, i) => { const w = why(r); return `<div class="item row between" style="gap:10px"><div><b>${esc(r.kind === 'contratista' ? 'Contratista ' + r.name : r.name)}</b><div class="sm" style="color:${w[1]}">${esc(w[0])}</div></div>
      ${waPhone(r.phone) ? `<button class="btn small" data-wa="${i}" style="background:#16A34A;border-color:#16A34A">WhatsApp</button>` : '<span class="sm muted">sin teléfono cargado</span>'}</div>`; }).join('') || '<p class="muted">No hay nadie asignado.</p>'}
    ${!waOnly && list.some(r => !r.has_user) ? '<p class="sm muted">Para que le lleguen los avisos al teléfono, vinculalo a su usuario en Mi empresa → columna Horas (o Validación de horas → Recursos) y que toque "Activar avisos" en su teléfono.</p>' : ''}
    <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn sec" id="rc-x">Listo</button></div>`);
  $('#rc-x').onclick = m.close;
  const send = i => { const r = list[i]; window.open(`https://wa.me/${waPhone(r.phone)}?text=${encodeURIComponent(tkWaText(t, r.kind === 'contratista' ? '' : r.name))}`, '_blank', 'noopener'); };
  m.el.querySelectorAll('[data-wa]').forEach(b => b.onclick = () => { send(Number(b.dataset.wa)); b.textContent = 'Enviado ✓'; b.classList.add('sec'); });
  if (autoWa){ const i = list.findIndex(r => waPhone(r.phone)); if (i >= 0){ send(i); const b = m.el.querySelector(`[data-wa="${i}"]`); if (b){ b.textContent = 'Enviado ✓'; b.classList.add('sec'); } } }
}

/* =====================================================================
   DETALLE (oficina)
   ===================================================================== */
async function tkDetailModal(id, after){
  const t = TK.list.find(x => x.id === id) || (await sb.from('tickets').select('*').eq('id', id).single()).data;
  if (!t) return;
  if (t.status === 'informe') return tkCloseModal(t, after);
  const p = tkProj(t.project_id), k = tkTkr(t.ticketera_id), P = TK_PRIO[t.priority] || TK_PRIO.normal;
  const url = tkUrl(k, t);
  const m = modal(`<div class="row" style="gap:12px;align-items:center">${tkFigure(t, 56)}<div><div class="sm muted">#${esc(t.ext_no)} · ${esc(p?.name || '')}</div><h2 style="margin:2px 0">${esc(t.site_name)}${t.site2_name ? ' – ' + esc(t.site2_name) : ''}</h2>
      <div class="sm"><b style="color:${TK_MOOD[tkMood(t)][1]}">${esc(tkLeftTxt(t))}</b> · ${esc(TK_ST[t.status])}${t.ext_status ? ' · en el cliente: ' + esc(t.ext_status) : ''}</div></div></div>
    <div class="stats" style="margin-top:12px">
      <div class="stat"><span>Prioridad</span><b style="color:${P[1]}">${P[0]}</b></div>
      <div class="stat"><span>TTR</span><b>${t.ttr_h ? tkH(Number(t.ttr_h)) : '—'}</b><small>${esc(TK_FALLA_S[t.falla] || '')}${t.afect ? ' · ' + t.afect : ''}${t.node_type ? ' · nodo ' + t.node_type : ''}</small></div>
      <div class="stat"><span>Creado / vence</span><b style="font-size:15px">${t.reported_at ? esc(fmtDT(t.reported_at)) : '—'}</b><small>${t.client_due_at ? 'vence ' + esc(fmtDT(t.client_due_at)) + ' (ticket)' : t.due_at ? 'vence ' + esc(fmtDT(t.due_at)) + ' (pliego)' : ''}${t.pause_h > 0 ? ` · +${t.pause_h} h de gracia` : ''}</small></div>
      <div class="stat"><span>Asignado</span><b style="font-size:15px">${esc(tkWho(t) || 'Nadie')}</b>${t.arrived_at ? `<small>llegó ${esc(fmtTime(t.arrived_at))}</small>` : ''}</div></div>
    <p>${esc([t.category, tkProblem(t.problem, t.category)].filter(Boolean).join(' · '))}</p>${t.description ? `<p class="sm muted" style="white-space:pre-wrap">${esc(t.description.slice(0, 1500))}</p>` : ''}
    ${t.capture_path ? '<p class="sm"><a href="#" id="dt-cap">Ver la captura original</a></p>' : ''}
    <details class="sm"><summary style="cursor:pointer">Historial (${(t.history || []).length})</summary>${(t.history || []).map(h => `<div style="padding:3px 0;border-bottom:1px solid var(--line)">${esc(fmtDT(h.at))} · ${esc(h.by || '')}: ${esc(h.ev === 'gracia' ? `gracia +${h.h} h (${h.motivo})` : TK_ST[h.ev] || h.ev)}</div>`).join('')}</details>
    <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:12px">
      ${['nuevo', 'asignado', 'en_curso'].includes(t.status) ? `<button class="btn" id="dt-as">${t.staff_ids?.length || t.contractor_id ? 'Reasignar' : 'Asignar'}</button>` : ''}
      ${(t.staff_ids?.length || t.contractor_id) && ['asignado', 'en_curso'].includes(t.status) ? '<button class="btn sec" id="dt-wa">WhatsApp / avisos</button>' : ''}
      ${['nuevo', 'asignado', 'en_curso'].includes(t.status) ? '<button class="btn sec" id="dt-ed">Corregir datos</button><button class="btn sec" id="dt-gr">Período de gracia</button>' : ''}
      ${url ? `<a class="btn sec" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Abrir en la ticketera ↗</a>` : ''}
      ${t.inspection_id ? `<a class="btn sec" href="#/informe/${esc(t.inspection_id)}">Ver informe</a>` : ''}
      ${['nuevo', 'asignado'].includes(t.status) ? '<button class="btn danger" id="dt-can">Cancelar ticket</button>' : ''}
      <button class="btn sec" id="dt-x" style="margin-left:auto">Cerrar</button></div>`, { wide: true });
  $('#dt-x').onclick = m.close;
  $('#dt-as')?.addEventListener('click', () => { m.close(); tkAssignModal(t.id, after); });
  $('#dt-ed')?.addEventListener('click', () => { m.close(); tkEditModal(t, after); });
  $('#dt-wa')?.addEventListener('click', () => { m.close(); tkReachModal(t, false, false); });
  $('#dt-gr')?.addEventListener('click', async () => {
    const h = Number(prompt('¿Cuántas horas de gracia? (las autorizó el cliente: clima, sin acceso…)', '2')); if (!h) return;
    const r = prompt('Motivo (queda en el historial):', ''); if (!r) return;
    const { error } = await sb.rpc('ticket_grace', { p_ticket: t.id, p_hours: h, p_reason: r }); if (error) return toast(errText(error)); m.close(); toast('Período de gracia cargado'); after && after(); });
  $('#dt-can')?.addEventListener('click', async () => { if (!confirm('¿Cancelar el ticket? Queda en el historial.')) return;
    const { error } = await sb.from('tickets').update({ status: 'cancelado' }).eq('id', t.id); if (error) return toast(errText(error)); m.close(); after && after(); });
  $('#dt-cap')?.addEventListener('click', async e => { e.preventDefault(); const { data } = await sb.storage.from('fotos').createSignedUrl(t.capture_path, 600); if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener'); });
}
async function tkEditModal(t, after){
  const sites = await tkSitesAll(); let afect = t.afect || null;
  const m = modal(`<h2>Corregir ticket #${esc(t.ext_no)}</h2>
    <div class="row" style="gap:10px"><div class="grow"><label>Creado (Created)</label><input id="te-r" type="datetime-local" value="${esc(tkLocal(t.reported_at))}"></div>
      <div class="grow"><label>Vence (Due del ticket)</label><input id="te-d" type="datetime-local" value="${esc(tkLocal(t.client_due_at))}"></div></div>
    <label>Sitio</label><input id="te-s" list="te-sl" value="${esc(t.site_name)}"><datalist id="te-sl">${sites.map(s => `<option value="${esc(s.name)}">`).join('')}</datalist>
    <div class="row" style="gap:10px"><div class="grow"><label>Tipo de falla</label><select id="te-f">${Object.entries(TK_FALLA).map(([k, l]) => `<option value="${k}" ${k === t.falla ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
      <div><label>Tipo de nodo</label><select id="te-nt"><option value="">—</option>${[1, 2, 3, 4].map(n => `<option ${n === t.node_type ? 'selected' : ''}>${n}</option>`).join('')}</select></div></div>
    <div class="row" style="gap:10px;align-items:center;margin-top:8px"><span class="sm">Afectación</span><div class="tk-seg"><button type="button" data-a="" class="${!afect ? 'on' : ''}">Sin dato</button><button type="button" data-a="total" class="${afect === 'total' ? 'on' : ''}">Total</button><button type="button" data-a="parcial" class="${afect === 'parcial' ? 'on' : ''}">Parcial</button></div></div>
    <div class="row" style="gap:10px"><div class="grow"><label>Prioridad</label><select id="te-p"><option value="">Según el tipo de nodo</option>${Object.entries(TK_PRIO).map(([k, v]) => `<option value="${k}" ${t.priority_manual && t.priority === k ? 'selected' : ''}>${v[0]}</option>`).join('')}</select></div>
      <div class="grow"><label>TTR en horas</label><input id="te-t" type="number" min="1" max="2000" placeholder="Según el pliego" value="${t.ttr_manual ? esc(t.ttr_h) : ''}"></div></div>
    <div class="err" id="te-err"></div><div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn sec" id="te-x">Cancelar</button><button class="btn" id="te-ok">Guardar</button></div>`);
  m.el.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { afect = b.dataset.a || null; m.el.querySelectorAll('[data-a]').forEach(z => z.classList.toggle('on', z === b)); });
  $('#te-x').onclick = m.close;
  $('#te-ok').onclick = async () => {
    const s = tkMatchSite(sites, $('#te-s').value), pr = $('#te-p').value, ttr = Number($('#te-t').value) || null;
    const { error } = await sb.from('tickets').update({ reported_at: $('#te-r').value ? new Date($('#te-r').value).toISOString() : null, client_due_at: $('#te-d').value ? new Date($('#te-d').value).toISOString() : null, site_id: s?.id || null, site_name: s?.name || $('#te-s').value.trim(),
      falla: $('#te-f').value, afect, node_type: Number($('#te-nt').value) || null, priority: pr || 'normal', priority_manual: !!pr, ttr_h: ttr, ttr_manual: !!ttr }).eq('id', t.id);
    if (error) return ($('#te-err').textContent = errText(error)); m.close(); toast('Guardado'); after && after();
  };
}

/* =====================================================================
   CIERRE: lo que se pega en la ticketera del cliente
   ===================================================================== */
async function tkCloseModal(t, after){
  const k = tkTkr(t.ticketera_id) || {}, p = tkProj(t.project_id);
  const [ins, st, hh] = await Promise.all([
    t.inspection_id ? sb.from('inspections').select('id,answers,template_snapshot,site_name,completed_at,inspector_id,inspector_name').eq('id', t.inspection_id).maybeSingle().then(r => r.data) : null,
    t.normalized_by ? sb.from('hh_staff').select('name,phone,kind').eq('user_id', t.normalized_by).maybeSingle().then(r => r.data).catch(() => null) : null,
    k.include_hours ? sb.from('hh_items').select('staff_id,kind,day,start_t,end_t,hours,title,ticket,status').or(`ticket.eq.${String(t.ext_no).replace(/[^\w\-]/g, '')}${t.task_id ? ',task_id.eq.' + t.task_id : ''}`).order('day').then(r => r.data || []).catch(() => []) : [],
  ]);
  // "lo realizado": las respuestas de texto de la planilla (trabajo realizado, observaciones…)
  let done = '';
  try { for (const s of ins?.template_snapshot?.sections || []) for (const it of s.items || []){ const a = ins.answers?.[it.id]; const val = a?.value;
      if (typeof val === 'string' && val.trim().length > 3 && /realiz|trabajo|observ|tarea|soluci|coment|detalle/i.test(it.label || '')) done += (done ? '\n' : '') + val.trim();
      if (typeof a?.note === 'string' && a.note.trim().length > 3) done += (done ? '\n' : '') + a.note.trim(); } } catch {}
  if (!done) done = '[contá en una o dos líneas lo que se hizo]';
  const hr = new Date().getHours(), saludo = hr < 13 ? 'Buenos días' : hr < 20 ? 'Buenas tardes' : 'Buenas noches';
  const tec = st?.name || t.normalized_by_name || ins?.inspector_name || '';
  const fill = s => String(s || '').replace(/\{(\w+)\}/g, (m0, key) => ({ saludo, realizado: done, tecnico: tec, cargo: 'Técnico área Infraestructura', telefono: st?.phone || '',
    ticket: t.ext_no, sitio: t.site_name, fecha: fmtD(String(t.normalized_at || '').slice(0, 10)), hora: t.normalized_at ? fmtTime(t.normalized_at) : '' })[key] ?? m0).replace(/\n{3,}/g, '\n\n').trim();
  const note = fill(k.note_tpl || TK_PRESETS.sf.note_tpl);
  const pdfName = fill(k.pdf_tpl || '{ticket}-{sitio}').replace(/[^\w\-áéíóúñÁÉÍÓÚÑ]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 100) + '.pdf';
  const hrsTxt = hh.map(h => `${tkStaffName(h.staff_id)}\t${h.kind === 'viaje' ? 'Viaje' : 'Trabajo'}\t${fmtD(h.day)} ${String(h.start_t || '').slice(0, 5)}–${String(h.end_t || '').slice(0, 5)}\t${h.hours ?? ''} h`).join('\n');
  const used = t.reported_at && t.normalized_at ? (new Date(t.normalized_at) - new Date(t.reported_at)) / 3600000 - Number(t.pause_h || 0) : null;
  const url = tkUrl(k, t);
  const m = modal(`<div class="row" style="gap:12px;align-items:center">${tkFigure(t, 52)}<div><div class="sm muted">Informe listo · ${esc(p?.name || '')} · ${esc(k.name || 'ticketera')}</div>
      <h2 style="margin:2px 0">#${esc(t.ext_no)} · ${esc(t.site_name)}</h2><div class="sm"><b style="color:${used != null && t.ttr_h && used > t.ttr_h ? 'var(--red)' : 'var(--green-d,#15803D)'}">${used != null ? `Normalizado en ${tkH(used)}${t.ttr_h ? (used <= t.ttr_h ? ' · dentro del SLA (' + tkH(Number(t.ttr_h)) + ')' : ' · fuera de SLA por ' + tkH(used - t.ttr_h)) : ''}` : 'Normalizado'}</b> · por ${esc(tec)}</div></div></div>
    <label style="margin-top:12px">Nota para la ticketera (podés corregirla)</label><textarea id="cl-n" rows="10" style="font-size:15px;line-height:1.5;background:#FFFBEB">${esc(note)}</textarea>
    <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:8px"><button class="btn" id="cl-copy">Copiar nota</button>
      ${t.inspection_id ? `<button class="btn sec" id="cl-pdf">Informe en PDF (${esc(pdfName)})</button>` : ''}
      ${url ? `<a class="btn sec" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Abrir el ticket del cliente ↗</a>` : ''}</div>
    ${k.include_hours ? `<label style="margin-top:12px">Horas y viajes para cargar en la ticketera</label>${hh.length ? `<div class="tblwrap"><table class="tbl"><thead><tr><th>Técnico</th><th>Tipo</th><th>Día y horario</th><th class="num">Horas</th></tr></thead><tbody>${hh.map(h => `<tr><td>${esc(tkStaffName(h.staff_id))}</td><td>${h.kind === 'viaje' ? 'Viaje' : 'Trabajo'}</td><td>${esc(fmtD(h.day))} ${esc(String(h.start_t || '').slice(0, 5))}–${esc(String(h.end_t || '').slice(0, 5))}</td><td class="num">${esc(h.hours ?? '')}</td></tr>`).join('')}</tbody></table></div><button class="btn sec small" id="cl-hh" style="margin-top:6px">Copiar horas</button>` : '<p class="sm muted">No hay horas cargadas con este ticket (en Horas, el pedido lleva el número de ticket).</p>'}` : ''}
    <div class="tk-sla" style="margin-top:14px"><span>¿Ya lo cargaste en la ticketera del cliente? Queda registrada la hora y pasa a cerrado.</span><button class="btn" id="cl-ok" style="background:var(--green);border-color:var(--green)">Cargado en el cliente</button></div>
    <div class="row" style="justify-content:flex-end;margin-top:8px"><button class="btn sec" id="cl-x">Cerrar</button></div>`, { wide: true });
  const copy = async (txt, msg) => { try { await navigator.clipboard.writeText(txt); toast(msg); } catch { toast('No se pudo copiar: seleccioná el texto y copialo a mano.'); } };
  $('#cl-copy').onclick = () => copy($('#cl-n').value, 'Nota copiada: pegala en el ticket del cliente');
  $('#cl-hh')?.addEventListener('click', () => copy(hrsTxt, 'Horas copiadas'));
  $('#cl-pdf')?.addEventListener('click', () => { try { sessionStorage.setItem('ia_pdfname', pdfName.replace(/\.pdf$/, '')); } catch {} m.close(); location.hash = '#/informe/' + t.inspection_id; });
  $('#cl-x').onclick = m.close;
  $('#cl-ok').onclick = async () => { const { error } = await sb.rpc('ticket_loaded', { p_ticket: t.id }); if (error) return toast(errText(error)); m.close(); toast('Ticket cerrado'); after && after(); };
}

/* =====================================================================
   TÉCNICO: mis tickets (Inicio) y el ticket  #/tickets  #/tickets/<id>
   ===================================================================== */
async function tkMine(){
  if (!online()) return (await IDB.get('kv', CUR_UID + ':tk-mine').catch(() => null)) || [];
  const { data } = await sb.from('tickets').select('id,ext_no,project_id,site_id,site_name,site2_name,category,problem,priority,ttr_h,pause_h,due_at,reported_at,status,normalized_at,task_id,inspection_id,staff_ids,contractor_id,arrived_at')
    .in('status', ['asignado', 'en_curso', 'informe']).order('due_at', { ascending: true, nullsFirst: false }).limit(50);
  IDB.put('kv', data || [], CUR_UID + ':tk-mine').catch(() => {});
  return data || [];
}
/* tarjeta grande en Inicio para técnicos y contratistas */
async function tkHomeCard(box){
  if (!box) return;
  tkCss();
  if (isManager()){            // oficina: resumen de la mesa con las personitas
    if (!online()) return;
    const { data } = await sb.from('tickets').select('id,status,due_at,ttr_h,pause_h,normalized_at,reported_at').in('status', ['nuevo', 'asignado', 'en_curso', 'informe']).limit(1000);
    const l = data || []; if (!l.length) return;
    const c = k => l.filter(t => tkMood(t) === k).length, nw = l.filter(t => t.status === 'nuevo').length, inf = l.filter(t => t.status === 'informe').length;
    const worst = l.find(t => tkMood(t) === 'vencido') || l.find(t => tkMood(t) === 'corre') || l[0];
    box.innerHTML = `<a href="#/mesa" class="card row between" style="text-decoration:none;color:inherit;border-left:6px solid ${TK_MOOD[tkMood(worst)][1]}">
      <div class="row" style="gap:12px;flex-wrap:nowrap">${tkFigure(worst, 48)}<div><b style="font-size:17px">Mesa de tickets</b><div class="sm muted">${l.length} abiertos · ${nw} nuevos · ${inf} informes para cargar</div></div></div>
      <div class="row" style="gap:8px">${c('corre') ? `<span class="pill" style="background:#FFF7ED;color:#C2410C">${c('corre')} por vencer</span>` : ''}${c('vencido') ? `<span class="pill p-bad">${c('vencido')} fuera de SLA</span>` : ''}<span class="btn small">Ir a la Mesa</span></div></a>`;
    return;
  }
  let list = []; try { list = (await tkMine()).filter(t => t.status !== 'informe'); } catch { return; }
  if (!list.length) return;
  const t = list[0], m = tkMood(t), bg = { calma: '#15803D', camina: '#B45309', corre: '#C2410C', vencido: '#B91C1C', sinreloj: '#0F2A4A', listo: '#15803D' }[m];
  box.innerHTML = `<div class="tk-hero" style="background:${bg};margin-bottom:12px">
      <div class="row between" style="align-items:flex-start"><div style="font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase">${list.length > 1 ? list.length + ' tickets para vos' : 'Ticket para vos'}</div>
        <span style="background:#fff;border-radius:14px;padding:4px">${tkFigure(t, 44)}</span></div>
      <div class="big">${esc(t.site_name)}${t.site2_name ? ' – ' + esc(t.site2_name) : ''}</div>
      <div>${esc([t.category, tkProblem(t.problem, t.category)].filter(Boolean).join(' · '))}</div>
      <div class="row between"><span class="sm">#${esc(t.ext_no)}</span><b style="font-size:18px">${esc(tkLeftTxt(t))}</b></div>
      <a class="go" href="#/tickets/${esc(t.id)}" style="color:${bg}">Abrir el ticket</a>
      ${list.length > 1 ? `<a href="#/tickets" style="color:#fff;text-align:center;font-size:14px">Ver los ${list.length}</a>` : ''}</div>`;
}
async function viewTickets(v, id){
  tkCss();
  if (id) return viewTicket(v, id);
  if (isManager()){ location.hash = '#/mesa'; return; }
  let list = []; try { list = await tkMine(); } catch (e){ v.innerHTML = `<div class="card">${esc(errText(e))}</div>`; return; }
  v.innerHTML = `<h1>Mis tickets</h1>${list.map(t => `<a class="tk-card" href="#/tickets/${esc(t.id)}" style="border-left-color:${TK_MOOD[tkMood(t)][1]};margin-bottom:10px;text-decoration:none">${tkFigure(t, 44)}<div class="t">
      <div class="s">#${esc(t.ext_no)}</div><b>${esc(t.site_name)}</b><div class="s">${esc([t.category, tkProblem(t.problem, t.category)].filter(Boolean).join(' · '))}</div>
      <div class="l" style="color:${TK_MOOD[tkMood(t)][1]}">${esc(t.status === 'informe' ? 'Informe enviado a la oficina' : tkLeftTxt(t))}</div></div></a>`).join('') || '<div class="card muted">No tenés tickets asignados.</div>'}`;
}
async function tkFindInsp(t){
  const loc = (await localAll()).filter(r => r.ticket_id === t.id).sort((a, b) => String(b.started_at).localeCompare(String(a.started_at)))[0];
  if (loc) return loc;
  if (online()){ const { data } = await sb.from('inspections').select('id,status,completed_at,started_at').eq('ticket_id', t.id).order('started_at', { ascending: false }).limit(1); if (data?.[0]) return data[0]; }
  return null;
}
async function viewTicket(v, id){
  let t;
  if (online()){ const r = await sb.from('tickets').select('*').eq('id', id).maybeSingle(); if (r.error) throw r.error; t = r.data; }
  else t = ((await IDB.get('kv', CUR_UID + ':tk-mine').catch(() => null)) || []).find(x => x.id === id);
  if (!t){ v.innerHTML = '<div class="card">No encontramos el ticket (o no está asignado a vos).</div>'; return; }
  if (isManager() && online()){ await tkLoadBase(); }
  const ins = await tkFindInsp(t);
  const task = t.task_id && online() ? (await sb.from('tasks').select('id,description,template_id').eq('id', t.task_id).maybeSingle()).data : null;
  let coord = null; try { if (!SITE_COORDS.size) rememberCoords(await loadSitesMap()); coord = t.site_id && SITE_COORDS.get(t.site_id); } catch {}
  const s1 = !!t.arrived_at, s2 = ins?.status === 'completada', closed = ['informe', 'cerrado'].includes(t.status);
  const m = tkMood(t), col = TK_MOOD[m][1];
  v.innerHTML = `<div style="max-width:560px;margin:0 auto;display:flex;flex-direction:column;gap:12px">
    <div class="row between"><a href="${isManager() ? '#/mesa' : '#/home'}" class="btn sec small">‹ ${isManager() ? 'Mesa' : 'Inicio'}</a><span class="pill" style="background:${col};color:#fff;font-size:14px">${esc(tkLeftTxt(t))}</span></div>
    <div class="card" style="margin:0"><div class="row" style="gap:12px;align-items:center">${tkFigure(t, 60)}<div><div class="sm muted">#${esc(t.ext_no)}</div><h1 style="margin:0">${esc(t.site_name)}${t.site2_name ? ' – ' + esc(t.site2_name) : ''}</h1>
      <div>${esc([t.category, tkProblem(t.problem, t.category)].filter(Boolean).join(' · '))}</div></div></div>
      ${task?.description ? `<div style="margin-top:10px;background:#FFFBEB;border-radius:10px;padding:10px">Indicación: ${esc(task.description)}</div>` : ''}
      ${coord ? `<a class="btn" style="display:block;text-decoration:none;text-align:center;margin-top:12px;padding:13px;font-size:16px;background:#2A78D6;border-color:#2A78D6" href="https://www.google.com/maps/dir/?api=1&destination=${coord[0]},${coord[1]}" target="_blank" rel="noopener noreferrer">Ir al sitio (Google Maps)</a>` : ''}</div>
    ${closed ? `<div class="card" style="margin:0;text-align:center"><div style="display:flex;justify-content:center">${tkFigure(t, 80)}</div><h2 style="margin:6px 0">¡Listo!</h2><p class="muted">${t.status === 'cerrado' ? 'La oficina ya lo cargó en el cliente.' : 'Le pasamos el informe a la oficina para que lo cargue en el cliente.'}</p>${ins ? `<a href="#/informe/${esc(ins.id)}">Ver mi informe</a>` : ''}</div>` : `
    <div id="t-lessons"></div>
    <div class="sm muted" style="font-weight:700;text-transform:uppercase;letter-spacing:.06em;padding:0 4px">Tres pasos</div>
    <button class="tk-step ${s1 ? 'done' : 'now'}" id="st1"><span class="n">${s1 ? '✓' : '1'}</span><div><b>Llegué al sitio</b><div class="sm muted">${s1 ? 'Registrado ' + esc(fmtTime(t.arrived_at)) : 'Toca al llegar: guarda la hora y tu ubicación'}</div></div></button>
    <button class="tk-step ${s2 ? 'done' : s1 ? 'now' : ''}" id="st2"><span class="n">${s2 ? '✓' : '2'}</span><div><b>${ins ? (s2 ? 'Planilla completa' : 'Seguir con la planilla') : 'Completar la planilla'}</b><div class="sm muted">Correctivo del proyecto, con los datos del ticket ya cargados. Las fotos van en la planilla.</div></div></button>
    <button class="tk-big" id="st3" ${s2 ? '' : 'disabled'}>Realizado y normalizado</button>
    <div class="sm muted" style="text-align:center">${s2 ? 'Para el reloj del SLA y le pasa el informe a la oficina, firmado por vos.' : 'Se habilita cuando la planilla está completa.'}</div>`}
  </div>`;
  if (typeof taskLessons === 'function') taskLessons($('#t-lessons'), 'reparacion', t.site_id ? [t.site_id] : [], t.id).catch(() => {});
  $('#st1')?.addEventListener('click', async () => {
    if (s1) return; if (!needOnline()) return;
    const pos = await getPos();
    if (t.site_id && typeof stxPresenceCheck === 'function' && !(await stxPresenceCheck(t.site_id, pos))) return;
    const { error } = await sb.rpc('ticket_arrive', { p_ticket: t.id, p_lat: pos?.lat ?? null, p_lng: pos?.lng ?? null }); if (error) return toast(errText(error));
    toast('Llegada registrada'); viewTicket(v, id);
  });
  $('#st2')?.addEventListener('click', async () => {
    if (ins){ location.hash = (ins.status === 'completada' ? '#/informe/' : '#/insp/') + ins.id; return; }
    let tpls = []; try { tpls = await cached('tpl-pub', () => sb.from('templates').select('id,name,kind,definition').eq('published', true).order('name')); } catch {}
    const prj = online() ? (await sb.from('projects').select('corr_template_id').eq('id', t.project_id).maybeSingle()).data : null;
    const tpl = tpls.find(x => x.id === (task?.template_id || prj?.corr_template_id)) || tpls.find(x => x.kind === 'correctivo');
    if (!tpl) return toast('El proyecto no tiene planilla de correctivo cargada: avisale a la oficina.');
    const pos = await getPos();
    const rec = { id: uid(), org_id: me.org_id, template_id: tpl.id, template_name: tpl.name, template_snapshot: tpl.definition,
      site_id: t.site_id || null, site_name: t.site_name, traza: null, kind: 'correctivo', status: 'borrador', inspector_id: me.id, inspector_name: me.full_name || me.email,
      started_at: new Date().toISOString(), completed_at: null, answers: {}, score: 0, max_score: 0, flagged: 0, flagged_items: [], lat: pos?.lat ?? null, lng: pos?.lng ?? null,
      task_id: t.task_id || null, ticket_id: t.id, ticket: t.ext_no, site2_id: null, site2_name: t.site2_name || null,
      corr: { category: t.category || undefined, problem: t.problem || undefined, ttype: 'Incidente', node_type: t.node_type ? String(t.node_type) : undefined,
              afect: t.afect === 'parcial' ? 'Sin afectación' : t.afect === 'total' ? 'Afectado' : undefined, ttr_h: t.ttr_h ? Number(t.ttr_h) : undefined, open_at: t.reported_at || undefined },
      _synced: false };
    Object.keys(rec.corr).forEach(k => rec.corr[k] === undefined && delete rec.corr[k]);
    await localSave(rec); location.hash = '#/insp/' + rec.id;
  });
  $('#st3')?.addEventListener('click', async () => {
    if (!needOnline()) return;
    $('#st3').disabled = true; $('#st3').textContent = 'Enviando…';
    try {
      const loc = (await localAll()).find(r => r.id === ins.id);
      if (loc && loc._dirty){ await syncNow(); const again = (await localAll()).find(r => r.id === ins.id); if (again?._dirty) throw new Error('La planilla todavía no se envió: esperá a tener señal y probá de nuevo.'); }
      const { error } = await sb.rpc('ticket_normalize', { p_ticket: t.id, p_inspection: ins.id }); if (error) throw error;
      toast('¡Listo! La oficina ya tiene tu informe.'); viewTicket(v, id);
    } catch (e){ $('#st3').disabled = false; $('#st3').textContent = 'Realizado y normalizado'; toast(errText(e)); }
  });
}

/* =====================================================================
   TICKETERAS (ficha por sistema de tickets; dos ya armadas)
   ===================================================================== */
async function tkTicketerasModal(after){
  await tkLoadBase();
  const m = modal(`<h2>Ticketeras</h2><p class="muted sm" style="margin-top:-4px">Cómo leer los tickets de cada cliente y cómo armar la nota de cierre. Para un cliente nuevo, sumá una ficha.</p>
    <div id="tk-l">${TK.tkr.map(x => `<div class="item row between"><div><b>${esc(x.name)}</b><div class="sm muted">${esc(x.url_tpl || 'sin enlace')}${x.include_hours ? ' · pasa horas y viajes' : ''}</div></div><button class="btn sec small" data-e="${esc(x.id)}">Editar</button></div>`).join('') || '<p class="muted">Todavía no hay ninguna.</p>'}</div>
    <div class="row" style="gap:8px;margin-top:10px;flex-wrap:wrap">${!TK.tkr.some(x => /santa fe/i.test(x.name)) ? '<button class="btn sec small" data-pre="sf">+ Portal Santa Fe (ya armada)</button>' : ''}${!TK.tkr.some(x => /trans/i.test(x.name)) ? '<button class="btn sec small" data-pre="trans">+ Ticketera Trans (ya armada)</button>' : ''}<button class="btn small" data-e="">+ Otra ticketera</button></div>
    <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn sec" id="tk-lx">Cerrar</button></div>`, { wide: true });
  $('#tk-lx').onclick = () => { m.close(); after && after(); };
  m.el.querySelectorAll('[data-pre]').forEach(b => b.onclick = async () => { const pz = TK_PRESETS[b.dataset.pre];
    const { error } = await sb.from('ticketeras').insert({ org_id: me.org_id, name: pz.name, num_re: pz.num_re, title_re: pz.title_re, status_map: pz.status_map, note_tpl: pz.note_tpl, pdf_tpl: pz.pdf_tpl, include_hours: pz.include_hours, url_tpl: '' });
    if (error) return toast(errText(error)); await IDB.del('kv', CUR_UID + ':tk-tkr').catch(() => {}); m.close(); tkTicketerasModal(after); });
  m.el.querySelectorAll('[data-e]').forEach(b => b.onclick = () => { m.close(); tkTicketeraEdit(TK.tkr.find(x => x.id === b.dataset.e) || {}, after); });
}
function tkTicketeraEdit(x, after){
  const m = modal(`<h2>${x.id ? 'Editar' : 'Nueva'} ticketera</h2>
    <label>Nombre</label><input id="te-name" maxlength="80" value="${esc(x.name || '')}" placeholder="Ej.: Mesa de ayuda Cliente X">
    <label>Enlace a un ticket <span class="muted sm">({n} = número; tiene que empezar con https://)</span></label><input id="te-url" maxlength="300" value="${esc(x.url_tpl || '')}" placeholder="https://.../ticket/{n}">
    <label>Cómo es el número <span class="muted sm">(expresión; el número entre paréntesis)</span></label><input id="te-num" maxlength="200" value="${esc(x.num_re || '#\\s?(\\d{4,7})')}">
    <label>Cómo viene el título <span class="muted sm">(sitio / categoría / problema)</span></label><input id="te-tit" maxlength="300" value="${esc(x.title_re ?? '^(.+?)\\s*/\\s*(.+?)\\s*/\\s*(.+)$')}">
    <label>Probar con un texto del ticket</label><textarea id="te-try" rows="3" placeholder="Pegá acá el texto de un ticket para ver qué lee"></textarea><div class="sm" id="te-res"></div>
    <label>Nota de cierre <span class="muted sm">{saludo} {realizado} {tecnico} {cargo} {telefono} {ticket} {sitio} {fecha} {hora}</span></label><textarea id="te-note" rows="7">${esc(x.note_tpl || TK_PRESETS.sf.note_tpl)}</textarea>
    <label>Nombre del PDF</label><input id="te-pdf" maxlength="120" value="${esc(x.pdf_tpl || '{ticket}-{sitio}')}">
    <label style="display:flex;gap:8px;align-items:center;font-weight:400;margin-top:8px"><input type="checkbox" id="te-hh" style="width:auto" ${x.include_hours ? 'checked' : ''}> Al cerrar, pasar también las horas y los viajes del ticket</label>
    <div class="err" id="te-err"></div>
    <div class="row between" style="margin-top:10px">${x.id ? '<button class="btn danger" id="te-del">Dar de baja</button>' : '<span></span>'}<div class="row" style="gap:8px"><button class="btn sec" id="te-x">Cancelar</button><button class="btn" id="te-ok">Guardar</button></div></div>`, { wide: true });
  $('#te-try').oninput = () => { const save = TK.tkr; TK.tkr = [{ id: 'x', num_re: $('#te-num').value, title_re: $('#te-tit').value }];
    const r = tkParse($('#te-try').value); TK.tkr = save;
    $('#te-res').innerHTML = r.length ? r.slice(0, 5).map(z => `✔ #${esc(z.ext_no)} · ${esc(z.site_name || '¿sitio?')} · ${esc(z.category || '')} · ${esc(z.problem || '')}`).join('<br>') : '<span style="color:var(--red)">No reconoce ningún ticket todavía.</span>'; };
  $('#te-x').onclick = () => { m.close(); tkTicketerasModal(after); };
  $('#te-del')?.addEventListener('click', async () => { if (!confirm('¿Dar de baja la ticketera? Los tickets cargados se conservan.')) return; const { error } = await sb.from('ticketeras').update({ active: false }).eq('id', x.id); if (error) return toast(errText(error)); await IDB.del('kv', CUR_UID + ':tk-tkr').catch(() => {}); m.close(); tkTicketerasModal(after); });
  $('#te-ok').onclick = async () => {
    const url = $('#te-url').value.trim();
    if (url && !/^https:\/\//i.test(url)) return ($('#te-err').textContent = 'El enlace tiene que empezar con https://');
    for (const id of ['#te-num', '#te-tit']) if ($(id).value && !tkRe($(id).value)) return ($('#te-err').textContent = 'Hay una expresión mal escrita.');
    const row = { org_id: me.org_id, name: $('#te-name').value.trim(), url_tpl: url, num_re: $('#te-num').value.trim(), title_re: $('#te-tit').value.trim(), note_tpl: $('#te-note').value, pdf_tpl: $('#te-pdf').value.trim() || '{ticket}-{sitio}', include_hours: $('#te-hh').checked };
    if (row.name.length < 2) return ($('#te-err').textContent = 'Poné un nombre.');
    const { error } = x.id ? await sb.from('ticketeras').update(row).eq('id', x.id) : await sb.from('ticketeras').insert(row);
    if (error) return ($('#te-err').textContent = errText(error));
    await IDB.del('kv', CUR_UID + ':tk-tkr').catch(() => {}); m.close(); toast('Guardado'); tkTicketerasModal(after);
  };
}

/* =====================================================================
   PROYECTO DE MANTENIMIENTO: contrato, ticketera, planilla, prioridad, pliego y SLA, abono
   (pestaña "Contrato y SLA" dentro del proyecto)
   ===================================================================== */
const TK_AFECT = { total: 'Total', parcial: 'Parcial', na: 'Cualquiera' };
async function tkProjSla(box, p){
  tkCss(); await tkLoadBase();
  const manage = isManager() && canWrite(), fin = ['admin', 'pm'].includes(me.role) || me.is_superadmin;
  const [rules, tpls, finRow, month] = await Promise.all([
    sb.from('sla_rules').select('*').eq('project_id', p.id).order('sort').order('falla').then(r => r.data || []),
    cached('tpl-pub', () => sb.from('templates').select('id,name,kind,definition').eq('published', true).order('name')).catch(() => []),
    fin ? sb.from('project_finance').select('*').eq('project_id', p.id).maybeSingle().then(r => r.data) : null,
    sb.from('tickets').select('id,reported_at,normalized_at,ttr_h,k,base_h,pause_h,status').eq('project_id', p.id).gte('reported_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()).then(r => r.data || []),
  ]);
  TK.rules.set(p.id, rules);
  const np = p.node_priority || { 1: 'critica', 2: 'alta', 3: 'normal', 4: 'normal' };
  const ams = Number(finRow?.ams || 0);
  // este mes: dentro del TTR, horas fuera de SLA y multa estimada
  let inT = 0, withT = 0, outH = 0, fine = 0;
  for (const t of month){ if (!t.normalized_at || !t.reported_at || !t.ttr_h) continue; withT++;
    const T = (new Date(t.normalized_at) - new Date(t.reported_at)) / 3600000 - Number(t.pause_h || 0);
    if (T <= t.ttr_h) inT++; else outH += T - t.ttr_h;
    const Tc = Math.ceil(T), base = Number(t.base_h ?? t.ttr_h); if (ams && t.k && Tc > base) fine += ams * (Tc - base) / Number(t.k); }
  const money = n => '$ ' + Math.round(n).toLocaleString('es-AR');
  box.innerHTML = `<div class="grid2">
    <div class="card" style="margin:0"><h2 style="margin:0 0 8px">Ticketera y planilla</h2>
      <label>Ticketera del cliente</label><select id="ps-tk" ${manage ? '' : 'disabled'}><option value="">—</option>${TK.tkr.map(x => `<option value="${esc(x.id)}" ${x.id === p.ticketera_id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
      <label>Planilla de correctivo (la que completa el técnico y recibe el cliente)</label><select id="ps-tp" ${manage ? '' : 'disabled'}><option value="">—</option>${(tpls || []).map(x => `<option value="${esc(x.id)}" ${x.id === p.corr_template_id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
      <h2 style="margin:16px 0 8px">Prioridad por tipo de nodo</h2>
      <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px">${[1, 2, 3, 4].map(n => `<label class="sm" style="margin:0">Nodo tipo ${n}<select data-np="${n}" ${manage ? '' : 'disabled'}>${Object.entries(TK_PRIO).map(([k, v]) => `<option value="${k}" ${np[n] === k ? 'selected' : ''}>${v[0]}</option>`).join('')}</select></label>`).join('')}</div>
      ${manage ? '<button class="btn small" id="ps-save" style="margin-top:12px">Guardar</button> <button class="btn sec small" id="ps-tkr">⚙ Ticketeras</button>' : ''}</div>
    <div class="card" style="margin:0;${fin ? 'background:var(--navy);color:#fff' : ''}">${fin ? `<div class="row between"><h2 style="margin:0;color:#fff">Abono y multa estimada</h2><span class="pill" style="background:rgba(255,255,255,.15);color:#fff">solo Admin y PM</span></div>
      <label style="color:#CBD5E1">Abono mensual (AMS)</label><div class="row" style="gap:8px"><input id="ps-ams" type="number" min="0" step="1000" value="${esc(finRow?.ams ?? '')}" placeholder="Ej.: 10000000" class="grow"><button class="btn small" id="ps-ams-ok" style="background:var(--green);border-color:var(--green)">Guardar</button></div>
      <div style="margin-top:12px;background:rgba(255,255,255,.1);border-radius:12px;padding:12px"><div style="font-size:20px;font-weight:800">M = AMS × (T − TTR) ÷ K</div>
        <div class="sm" style="color:#CBD5E1;margin-top:6px">T = horas desde el reporte hasta "normalizado", redondeadas para arriba (las fracciones cuentan como 1 hora), menos los períodos de gracia. Preventivo: M = AMS × (T − 96) ÷ 1000.</div></div>
      <div class="sm" style="color:#CBD5E1;margin-top:8px">Ejemplo: corte total en nodo 3/4 resuelto en 18 h 20 → T = 19 h → ${ams ? money(ams * 3 / 168) : 'AMS × 3 ÷ 168'}</div>` : '<h2 style="margin:0 0 6px">Abono y multas</h2><p class="muted sm">Los ven solo Admin y PM.</p>'}
      <div class="stats" style="margin-top:12px;color:#0F2A4A">
        <div class="stat"><span>Tickets del mes</span><b>${month.length}</b></div>
        <div class="stat"><span>Dentro del TTR</span><b>${withT ? Math.round(inT * 100 / withT) + '%' : '—'}</b><small>${withT ? inT + ' de ' + withT : ''}</small></div>
        <div class="stat"><span>Horas fuera de SLA</span><b>${tkH(outH)}</b></div>
        ${fin ? `<div class="stat"><span>Multa estimada</span><b>${ams ? money(fine) : '—'}</b><small>${ams ? '' : 'cargá el abono'}</small></div>` : ''}</div></div>
  </div>
  <div class="card"><div class="row between"><div><h2 style="margin:0">Tiempos del pliego (SLA)</h2><div class="sm muted">El reloj corre desde la carga del ticket del cliente hasta "Realizado y normalizado". ${p.pliego_name ? 'Pliego: <a href="#" id="ps-pl">' + esc(p.pliego_name) + '</a>' : ''}</div></div>
    ${manage ? '<div class="row" style="gap:6px"><button class="btn sec small" id="ps-read">⬆ Leer del pliego (PDF)</button><button class="btn small" id="ps-add">+ Fila</button></div>' : ''}</div>
    <div class="tblwrap" style="margin-top:10px"><table class="tbl"><thead><tr><th>Tipo de falla</th><th>Afectación</th><th>Tipo de nodo</th><th class="num">TTR (h)</th><th class="num">K</th><th class="num">Multa desde (h)</th>${manage ? '<th></th>' : ''}</tr></thead><tbody>
    ${rules.map(r => `<tr><td>${esc(TK_FALLA_S[r.falla] || r.falla)}</td><td>${esc(TK_AFECT[r.afect])}</td><td>${r.node_min == null ? 'Todos' : r.node_min === r.node_max ? r.node_min : r.node_min + ' a ' + r.node_max}</td><td class="num"><b>${esc(r.ttr_h)}</b></td><td class="num">${esc(r.k ?? '—')}</td><td class="num">${r.base_h != null ? `<b style="color:var(--red)" title="El pliego cuenta la multa desde otra hora que el TTR">${esc(r.base_h)}</b>` : esc(r.ttr_h)}</td>${manage ? `<td style="white-space:nowrap"><button class="btn sec small" data-re="${esc(r.id)}">Editar</button> <button class="btn sec small" data-rd="${esc(r.id)}" aria-label="Borrar fila">🗑</button></td>` : ''}</tr>`).join('') || `<tr><td colspan="7" class="muted">Sin tabla todavía. ${manage ? 'Leela del pliego en PDF o cargala a mano con "+ Fila".' : ''}</td></tr>`}
    </tbody></table></div></div>`;
  const reload = () => tkProjSla(box, p);
  $('#ps-tkr')?.addEventListener('click', () => tkTicketerasModal(reload));
  $('#ps-save')?.addEventListener('click', async () => {
    const npn = {}; box.querySelectorAll('[data-np]').forEach(s => { npn[s.dataset.np] = s.value; });
    const patch = { ticketera_id: $('#ps-tk').value || null, corr_template_id: $('#ps-tp').value || null, node_priority: npn };
    const { error } = await sb.from('projects').update(patch).eq('id', p.id); if (error) return toast(errText(error));
    Object.assign(p, patch); ['tk-proj', 'projects'].forEach(k => IDB.del('kv', CUR_UID + ':' + k).catch(() => {})); toast('Guardado'); });
  $('#ps-ams-ok')?.addEventListener('click', async () => {
    const v = $('#ps-ams').value === '' ? null : Number($('#ps-ams').value); if (v != null && !(v >= 0)) return toast('Revisá el monto.');
    const { error } = await sb.from('project_finance').upsert({ project_id: p.id, org_id: me.org_id, ams: v }, { onConflict: 'project_id' }); if (error) return toast(errText(error)); toast('Abono guardado'); reload(); });
  $('#ps-add')?.addEventListener('click', () => tkRuleModal(p, {}, reload));
  box.querySelectorAll('[data-re]').forEach(b => b.onclick = () => tkRuleModal(p, rules.find(r => r.id === b.dataset.re), reload));
  box.querySelectorAll('[data-rd]').forEach(b => b.onclick = async () => { if (!confirm('¿Borrar esta fila del SLA?')) return; const { error } = await sb.from('sla_rules').delete().eq('id', b.dataset.rd); if (error) return toast(errText(error)); TK.rules.delete(p.id); reload(); });
  $('#ps-read')?.addEventListener('click', () => tkPliegoModal(p, rules, reload));
  $('#ps-pl')?.addEventListener('click', async e => { e.preventDefault(); const { data } = await sb.storage.from('fotos').createSignedUrl(p.pliego_path, 600); if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener'); });
}
function tkRuleModal(p, r, after){
  const m = modal(`<h2>${r.id ? 'Editar' : 'Nueva'} fila del SLA</h2>
    <label>Tipo de falla</label><select id="rl-f">${Object.entries(TK_FALLA).map(([k, l]) => `<option value="${k}" ${k === (r.falla || 'infra') ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
    <label>Afectación del servicio</label><select id="rl-a">${Object.entries(TK_AFECT).map(([k, l]) => `<option value="${k}" ${k === (r.afect || 'total') ? 'selected' : ''}>${l}</option>`).join('')}</select>
    <div class="row" style="gap:10px"><div class="grow"><label>Nodo desde</label><select id="rl-n1"><option value="">Todos</option>${[1, 2, 3, 4].map(n => `<option ${n === r.node_min ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      <div class="grow"><label>hasta</label><select id="rl-n2"><option value="">—</option>${[1, 2, 3, 4].map(n => `<option ${n === r.node_max ? 'selected' : ''}>${n}</option>`).join('')}</select></div></div>
    <div class="row" style="gap:10px"><div class="grow"><label>TTR (horas)</label><input id="rl-t" type="number" min="1" max="2000" value="${esc(r.ttr_h ?? '')}"></div>
      <div class="grow"><label>Factor K</label><input id="rl-k" type="number" min="1" value="${esc(r.k ?? '')}"></div>
      <div class="grow"><label>Multa desde (h)</label><input id="rl-b" type="number" min="0" value="${esc(r.base_h ?? '')}" placeholder="= TTR"></div></div>
    <div class="err" id="rl-err"></div><div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn sec" id="rl-x">Cancelar</button><button class="btn" id="rl-ok">Guardar</button></div>`);
  $('#rl-x').onclick = m.close;
  $('#rl-ok').onclick = async () => {
    const n1 = Number($('#rl-n1').value) || null, n2 = Number($('#rl-n2').value) || n1;
    const row = { org_id: me.org_id, project_id: p.id, falla: $('#rl-f').value, afect: $('#rl-a').value, node_min: n1, node_max: n1 ? n2 : null, ttr_h: Number($('#rl-t').value), k: Number($('#rl-k').value) || null, base_h: $('#rl-b').value === '' ? null : Number($('#rl-b').value) };
    if (!(row.ttr_h > 0)) return ($('#rl-err').textContent = 'Cargá el TTR en horas.');
    const { error } = r.id ? await sb.from('sla_rules').update(row).eq('id', r.id) : await sb.from('sla_rules').insert(row);
    if (error) return ($('#rl-err').textContent = errText(error)); TK.rules.delete(p.id); m.close(); after && after();
  };
}
/* lector del pliego: el PDF se lee en el navegador (pdf.js incluido en la app) */
async function tkPdfText(file){
  const pdfjs = await import(new URL('pdf.min.mjs', location.href).href);
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdf.worker.min.mjs', location.href).href;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false, disableFontFace: true, enableXfa: false }).promise;
  let out = '';
  for (let i = 1; i <= Math.min(doc.numPages, 120); i++){ const pg = await doc.getPage(i); const tc = await pg.getTextContent(); out += tc.items.map(x => x.str).join(' ') + '\n'; }
  return out;
}
function tkParsePliego(text){
  const T = text.replace(/\s+/g, ' ');
  const nodes = s => { const m = s.match(/Nodos?\s+Tipo\s+(?:Tipo\s+)?(\d)(?:\s*o\s*(?:Tipo\s*)?(\d))?/i); return m ? [Number(m[1]), Number(m[2] || m[1])] : [null, null]; };
  const rules = [];
  const ci = T.search(/mantenimiento correctivo\s*:/i), pi = T.search(/PENALIDADES/i);
  const corr = T.slice(ci >= 0 ? ci : 0, pi > ci ? pi : undefined);
  for (const ch of corr.split(/(?=\b[a-h]\s*[.\-]\s*-?\s*dispondr[aá]\s+de)/i)){
    const h = ch.match(/dispondr[aá]\s+de\s+(\d+(?:[.,]\d+)?)\s*h/i); if (!h) continue;
    const [n1, n2] = nodes(ch);
    rules.push({ falla: /tendido|fibra|radioenlace/i.test(ch) ? 'fo' : 'infra', afect: /no\s+est[eé]\s+interrumpido|parcial/i.test(ch) ? 'parcial' : 'total', node_min: n1, node_max: n2, ttr_h: Number(h[1].replace(',', '.')), k: null, base_h: null });
  }
  const mov = T.match(/movimiento o resujeci[oó]n[\s\S]{0,300}?dispondr[aá]\s+de\s+(\d+)\s*hs/i);
  if (mov) rules.push({ falla: 'mov', afect: 'na', node_min: null, node_max: null, ttr_h: Number(mov[1]), k: null, base_h: null });
  // penalidades del correctivo: K y desde qué hora cuenta la multa, por la misma combinación
  const pen = T.slice(pi >= 0 ? pi : T.length), pc = pen.search(/PENALIDADES[^.]{0,40}CORRECTIVO/i);
  for (const raw of (pc >= 0 ? pen.slice(pc) : '').split(/(?=\b[a-e]\s*-\s*El retraso)/i)){
    const fk = raw.search(/factor\s+K/i); if (fk < 0 || !/El retraso/i.test(raw)) continue;
    const ch = raw.slice(0, fk + 40), k = Number(ch.match(/factor\s+K\s+ser[aá]\s*:?\s*(\d+)/i)?.[1]), base = Number(ch.match(/\(\s*T\s*-\s*(\d+)/i)?.[1]);
    if (!k || !base) continue;
    const falla = /tendido|radioenlace/i.test(ch) ? 'fo' : 'infra', afect = /p[eé]rdida\s+parcial/i.test(ch) ? 'parcial' : 'total';
    const [n1, n2] = nodes(ch);
    let r = rules.find(x => x.falla === falla && x.afect === afect && x.node_min != null && n1 != null && x.node_min <= n1 && x.node_max >= n2);
    if (r && (r.node_min !== n1 || r.node_max !== n2)){        // la multa distingue nodos que el tiempo agrupa: se separa la fila
      const rest = { ...r }; r.node_min = n1; r.node_max = n2;
      if (rest.node_min < n1) rules.push({ ...rest, node_max: n1 - 1, k: null, base_h: null });
      if (rest.node_max > n2) rules.push({ ...rest, node_min: n2 + 1, k: null, base_h: null });
    }
    if (!r){ r = { falla, afect, node_min: n1, node_max: n2, ttr_h: base, k: null, base_h: null }; rules.push(r); }
    r.k = k; r.base_h = base !== r.ttr_h ? base : null;
  }
  rules.sort((a, b) => ['infra', 'fo', 'mov', 'prev', 'otro'].indexOf(a.falla) - ['infra', 'fo', 'mov', 'prev', 'otro'].indexOf(b.falla) || (a.afect === b.afect ? 0 : a.afect > b.afect ? -1 : 1) || (a.node_min || 0) - (b.node_min || 0));
  if (/PREVENTIVO[\s\S]{0,600}?\(\s*T\s*-\s*96/i.test(pen)) rules.push({ falla: 'prev', afect: 'na', node_min: null, node_max: null, ttr_h: 96, k: 1000, base_h: null });
  return rules;
}
function tkPliegoModal(p, current, after){
  const m = modal(`<h2>Leer el pliego</h2><p class="muted sm" style="margin-top:-4px">Subí el PDF del pliego (anexo técnico). La app busca los tiempos ("dispondrá de N hs…") y los factores de las multas, y te muestra la tabla para revisarla antes de guardar. El PDF queda guardado en el proyecto.</p>
    <input type="file" id="pl-f" accept="application/pdf,.pdf"><div id="pl-r" style="margin-top:10px"></div>
    <div class="row" style="justify-content:flex-end;margin-top:10px;gap:8px"><button class="btn sec" id="pl-x">Cancelar</button><button class="btn hidden" id="pl-ok">Guardar la tabla</button></div>`, { wide: true });
  $('#pl-x').onclick = m.close;
  let found = [], file = null;
  $('#pl-f').onchange = async () => {
    file = $('#pl-f').files[0]; if (!file) return;
    if (file.size > 10 * 1024 * 1024) return ($('#pl-r').innerHTML = '<p class="err">El PDF supera 10 MB.</p>');
    $('#pl-r').innerHTML = '<p class="muted">Leyendo…</p>';
    try { found = tkParsePliego(await tkPdfText(file)); } catch (e){ $('#pl-r').innerHTML = `<p class="err">No se pudo leer el PDF: ${esc(errText(e))}</p>`; return; }
    $('#pl-r').innerHTML = found.length ? `<div class="tblwrap"><table class="tbl"><thead><tr><th>Tipo de falla</th><th>Afectación</th><th>Nodo</th><th class="num">TTR</th><th class="num">K</th><th class="num">Multa desde</th></tr></thead><tbody>${found.map(r => `<tr><td>${esc(TK_FALLA_S[r.falla])}</td><td>${esc(TK_AFECT[r.afect])}</td><td>${r.node_min == null ? 'Todos' : r.node_min === r.node_max ? r.node_min : r.node_min + ' a ' + r.node_max}</td><td class="num"><b>${r.ttr_h} h</b></td><td class="num">${r.k ?? '—'}</td><td class="num">${r.base_h != null ? `<b style="color:var(--red)" title="El pliego cuenta la multa desde otra hora que el TTR">${r.base_h} h</b>` : '= TTR'}</td></tr>`).join('')}</tbody></table></div>
      ${found.some(r => r.base_h != null) ? '<p class="sm" style="color:#92400E;background:#FFFBEB;padding:8px 10px;border-radius:8px">Ojo: en alguna fila el pliego fija un tiempo y cuenta la multa desde otra hora (marcado en rojo). Revisalo con el contrato.</p>' : ''}
      ${current.length ? `<label style="display:flex;gap:8px;align-items:center;font-weight:400"><input type="checkbox" id="pl-rep" checked style="width:auto"> Reemplazar las ${current.length} filas actuales</label>` : ''}`
      : '<p class="muted">No encontramos tiempos en el formato "dispondrá de N hs". Cargá la tabla a mano con "+ Fila" (el PDF igual se guarda en el proyecto).</p>';
    $('#pl-ok').classList.remove('hidden'); $('#pl-ok').textContent = found.length ? 'Guardar la tabla' : 'Guardar solo el PDF';
  };
  $('#pl-ok').onclick = async () => {
    $('#pl-ok').disabled = true;
    try {
      const path = `${me.org_id}/pliegos/${uid()}.pdf`;
      const up = await sb.storage.from('fotos').upload(path, file, { contentType: 'application/pdf', upsert: false });
      if (!up.error) await sb.from('projects').update({ pliego_path: path, pliego_name: file.name.slice(0, 200) }).eq('id', p.id);
      if (found.length){
        if ($('#pl-rep')?.checked) await sb.from('sla_rules').delete().eq('project_id', p.id);
        const { error } = await sb.from('sla_rules').insert(found.map((r, i) => ({ ...r, org_id: me.org_id, project_id: p.id, sort: i }))); if (error) throw error;
      }
      TK.rules.delete(p.id); IDB.del('kv', CUR_UID + ':projects').catch(() => {}); m.close(); toast(found.length ? 'Tabla del pliego guardada' : 'PDF guardado'); after && after();
    } catch (e){ $('#pl-ok').disabled = false; toast(errText(e)); }
  };
}
