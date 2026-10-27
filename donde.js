/* =====================================================================
   InspectApp 5.3 · ¿Dónde está cada uno?  (#/tools/donde, solo la oficina)
   y Mi camiseta (#/tools/camiseta, cualquiera con su recurso vinculado)
   Todo lo que viene de la base se muestra escapado; la camiseta solo acepta
   colores de una paleta fija (lo controla también la base).
   ===================================================================== */
const SHIRT_COLS = [['#FFFFFF', 'Blanco'], ['#E24B4A', 'Rojo'], ['#991B1B', 'Bordó'], ['#185FA5', 'Azul'], ['#85B7EB', 'Celeste'], ['#EF9F27', 'Naranja'], ['#FACC15', 'Amarillo'], ['#3B6D11', 'Verde'], ['#2C2C2A', 'Negro'], ['#7F2D8C', 'Violeta']];
const SHIRT_PAT = { lisa: 'Lisa', rayas: 'Rayas', banda: 'Banda', diag: 'Diagonal', mitad: 'Mitad y mitad' };
const SHIRT_DEF = { p: 'lisa', a: '#185FA5', b: '#FFFFFF', n: '', club: '' };
const DN = { f: 'man', proj: '', who: '', map: null, pick: null };
let dnSeq = 0;

function shirtClean(s){
  s = s && typeof s === 'object' ? s : {};
  const ok = c => SHIRT_COLS.some(x => x[0] === String(c || '').toUpperCase()) ? String(c).toUpperCase() : null;
  return { p: SHIRT_PAT[s.p] ? s.p : 'lisa', a: ok(s.a) || SHIRT_DEF.a, b: ok(s.b) || SHIRT_DEF.b,
    n: String(s.n ?? '').replace(/\D/g, '').slice(0, 2), club: String(s.club ?? '').replace(/[<>{}`\\$"\u0000-\u001f]/g, '').slice(0, 30) };
}

/* muñequito con camiseta · mode: parado | camina | sitio | libre (sin asignar) */
function shirtFig(shirt, mode = 'parado', size = 56){
  const s = shirtClean(shirt), id = 'dnc' + (++dnSeq), A = s.a, B = s.b;
  const gray = mode === 'libre';
  let fill = `<rect x="0" y="0" width="80" height="120" fill="${gray ? '#CBD5E1' : A}"/>`;
  if (!gray){
    if (s.p === 'rayas') for (let x = 24; x < 60; x += 10) fill += `<rect x="${x}" y="0" width="5" height="120" fill="${B}"/>`;
    if (s.p === 'banda') fill += `<rect x="0" y="50" width="80" height="11" fill="${B}"/>`;
    if (s.p === 'diag') fill += `<polygon points="18,40 30,34 62,70 54,80" fill="${B}"/>`;
    if (s.p === 'mitad') fill += `<rect x="40" y="0" width="40" height="120" fill="${B}"/>`;
  }
  const dark = ['#FFFFFF', '#FACC15', '#85B7EB', '#EF9F27'].includes(A);
  const legs = mode === 'camina' ? '<g class="dn-l1"><line x1="34" y1="78" x2="28" y2="108"/></g><g class="dn-l2"><line x1="46" y1="78" x2="52" y2="108"/></g>' : '<line x1="34" y1="78" x2="31" y2="108"/><line x1="46" y1="78" x2="49" y2="108"/>';
  const tool = mode === 'sitio' ? '<path d="M66 70 l8 -10 m-3 -3 a4 4 0 1 0 6 6" stroke="#475569" stroke-width="3" fill="none" stroke-linecap="round"/>' : '';
  const q = gray ? '<text x="40" y="66" text-anchor="middle" font-size="16" font-weight="700" fill="#475569" font-family="sans-serif">?</text>' : '';
  const W = Math.round(size * 80 / 120);
  return `<svg class="dn-fig dn-${mode}" viewBox="0 0 80 120" width="${W}" height="${size}" aria-hidden="true">
    <defs><clipPath id="${id}"><path d="M22 40 L32 34 L48 34 L58 40 L62 56 L54 58 L54 78 L26 78 L26 58 L18 56 Z"/></clipPath></defs>
    <circle cx="40" cy="20" r="11" fill="#F0C9A0" stroke="#5F5E5A" stroke-width="1.5"/>
    <g stroke="#334155" stroke-width="6" stroke-linecap="round">${legs}</g>
    <line x1="20" y1="54" x2="14" y2="74" stroke="#F0C9A0" stroke-width="5" stroke-linecap="round"/>
    <g class="dn-arm"><line x1="62" y1="52" x2="68" y2="72" stroke="#F0C9A0" stroke-width="5" stroke-linecap="round"/></g>
    <g clip-path="url(#${id})">${fill}</g>
    <path d="M22 40 L32 34 L48 34 L58 40 L62 56 L54 58 L54 78 L26 78 L26 58 L18 56 Z" fill="none" stroke="#2C2C2A" stroke-width="1.2"/>
    ${s.n && !gray ? `<text x="40" y="66" text-anchor="middle" font-size="14" font-weight="700" font-family="sans-serif" fill="${dark ? '#0F2A4A' : '#FFFFFF'}">${s.n}</text>` : ''}${q}${tool}</svg>`;
}
function truckFig(size = 34){
  return `<svg class="dn-fig dn-truck" viewBox="0 0 64 40" width="${Math.round(size * 1.4)}" height="${size}" aria-hidden="true">
    <rect x="2" y="8" width="36" height="22" rx="3" fill="#FAEEDA" stroke="#854F0B" stroke-width="2"/><path d="M38 14 h12 l8 9 v7 h-20z" fill="#FAC775" stroke="#854F0B" stroke-width="2"/>
    <rect x="42" y="17" width="7" height="6" fill="#fff" stroke="#854F0B" stroke-width="1.5"/>
    <circle cx="14" cy="32" r="5" fill="#334155"/><circle cx="48" cy="32" r="5" fill="#334155"/></svg>`;
}
function dnCss(){
  if (document.getElementById('dn-css')) return;
  const st = document.createElement('style'); st.id = 'dn-css';
  st.textContent = `.dn-mk{position:absolute;transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer}
.dn-lab{background:#fff;border:1px solid #94A3B8;border-radius:8px;padding:3px 8px;font:12px/1.3 Inter,system-ui,sans-serif;color:#0F2A4A;white-space:nowrap;text-align:center;max-width:280px;overflow:hidden;text-overflow:ellipsis;box-shadow:0 1px 3px rgba(15,42,74,.18)}
.dn-lab b{display:block;font-weight:700}.dn-lab span{color:#475569}.dn-lab .tkb{color:#B91C1C;font-weight:700}.dn-lab .ap{color:#B45309}
.dn-figs{display:flex;align-items:flex-end;gap:0}.dn-figs .more{font:700 12px Inter,sans-serif;color:#0F2A4A;background:#fff;border-radius:999px;padding:1px 6px;border:1px solid #94A3B8;margin-left:2px}
.dn-camina .dn-l1{animation:dnsw 1s ease-in-out infinite;transform-origin:34px 78px}.dn-camina .dn-l2{animation:dnsw 1s ease-in-out infinite reverse;transform-origin:46px 78px}
.dn-wave .dn-arm{animation:dnwave .4s ease-in-out 3;transform-origin:62px 52px}
@keyframes dnsw{0%,100%{transform:rotate(-14deg)}50%{transform:rotate(14deg)}}@keyframes dnwave{0%,100%{transform:rotate(0)}50%{transform:rotate(-120deg)}}
@media (prefers-reduced-motion:reduce){.dn-fig *{animation:none!important}}
.dn-pill{border:1px solid #CBD5E1;background:#fff;border-radius:999px;padding:7px 14px;font-weight:600;cursor:pointer;color:#0F2A4A}.dn-pill.on{background:#0F2A4A;color:#fff;border-color:#0F2A4A}
.dn-grid{display:grid;grid-template-columns:minmax(0,3fr) minmax(260px,1fr);gap:14px}@media (max-width:900px){.dn-grid{grid-template-columns:minmax(0,1fr)}}
.dn-pr{display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--line);cursor:pointer}.dn-pr:hover{background:#F8FAFC}
.dn-it{border:1px solid var(--line);border-radius:12px;padding:10px 12px;margin-top:8px}
.sh-sw{width:32px;height:32px;border-radius:50%;border:1px solid #94A3B8;cursor:pointer;padding:0}.sh-sw.on{outline:3px solid #16A34A;outline-offset:2px}`;
  document.head.appendChild(st);
}

/* ---------- datos ---------- */
const DN_TASK_COLS = 'id,title,task_type,status,due_date,sites,contractor_id,staff_ids,ticket_id,project_id,priority,is_pending';
const DN_TK_COLS = 'id,ext_no,site_id,site_name,status,staff_ids,contractor_id,task_id,due_at,arrived_at,project_id,problem,category,reported_at,ttr_h,pause_h,normalized_at';
async function dnLoad(){
  const wk = addDays(todayStr(), 7);
  const safe = p => p.then(r => Array.isArray(r) ? r : (r && r.data) || []).catch(() => []);
  const [tasks, tickets, sites, centers, shirts, projects, contrs] = await Promise.all([
    safe(pageAll(() => sb.from('tasks').select(DN_TASK_COLS).in('status', ['sin_asignar', 'asignada', 'vista', 'en_curso', 'rechazada']).lte('due_date', wk).order('id'))),
    safe(sb.from('tickets').select(DN_TK_COLS).in('status', ['nuevo', 'asignado', 'en_curso']).limit(1000)),
    safe(loadSitesMap()),
    safe(sb.from('loc_centers').select('loc_key,label,lat,lng').limit(2000)),
    safe(sb.from('hh_staff').select('id,shirt').limit(1000)),
    safe(loadProjects()),
    safe(loadContractors()),
    (async () => { try { await hhLoadBase(); } catch {} })(),
  ]);
  return { tasks, tickets, sites, centers, shirts: new Map(shirts.map(x => [x.id, x.shirt])), projects, contrs };
}
const dnLocKey = s => s && s.localidad ? norm(s.localidad) + '|' + norm(s.provincia || '') : null;

/* arma la lista de "dónde va cada uno": un ítem por sitio pendiente de cada tarea, más los tickets todavía sin tarea */
function dnItems(D){
  const today = todayStr(), tom = addDays(today, 1);
  const byId = new Map(D.sites.map(s => [s.id, s])), byName = new Map(D.sites.map(s => [norm(s.name), s]));
  const centers = new Map(D.centers.map(c => [c.loc_key, [Number(c.lat), Number(c.lng)]]));
  const avg = new Map();
  for (const s of D.sites){ const k = dnLocKey(s); if (!k || s.lat == null) continue; const a = avg.get(k) || [0, 0, 0]; a[0] += Number(s.lat); a[1] += Number(s.lng); a[2]++; avg.set(k, a); }
  const where = (siteId, siteName) => {
    const s = (siteId && byId.get(siteId)) || byName.get(norm(siteName || ''));
    if (s && s.lat != null) return { c: [Number(s.lat), Number(s.lng)], s, approx: false };
    const k = dnLocKey(s);
    if (k && centers.has(k)) return { c: centers.get(k), s, approx: true, k };
    if (k && avg.has(k)){ const a = avg.get(k); return { c: [a[0] / a[2], a[1] / a[2]], s, approx: true, k }; }
    return { c: null, s, approx: true, k };
  };
  const tkById = new Map(D.tickets.map(t => [t.id, t]));
  const out = [];
  for (const t of D.tasks){
    const tk = t.ticket_id ? tkById.get(t.ticket_id) : null;
    for (const st of (t.sites || [])){ if (st.done) continue;
      const w = where(st.site_id, st.site_name);
      out.push({ kind: 'task', id: t.id, title: t.title, date: t.due_date, status: t.status, staff: t.staff_ids || [], contr: t.contractor_id, ticket: tk, project: t.project_id,
        site: st.site_name, ...w, onsite: t.status === 'en_curso' || !!tk?.arrived_at }); }
  }
  const withTask = new Set(D.tasks.map(t => t.ticket_id).filter(Boolean));
  for (const tk of D.tickets){ if (withTask.has(tk.id)) continue;
    const w = where(tk.site_id, tk.site_name);
    out.push({ kind: 'ticket', id: tk.id, title: '#' + tk.ext_no + ' · ' + (typeof tkProblem === 'function' ? tkProblem(tk.problem, tk.category) : (tk.problem || '')), date: today, status: tk.status, staff: tk.staff_ids || [], contr: tk.contractor_id,
      ticket: tk, project: tk.project_id, site: tk.site_name, ...w, onsite: !!tk.arrived_at }); }
  const inRange = x => DN.f === 'hoy' ? (x.date <= today || x.onsite) : DN.f === 'man' ? x.date === tom : true;
  return out.filter(x => inRange(x) && (!DN.proj || x.project === DN.proj) && (!DN.who || (DN.who === 'libre' ? !x.staff.length && !x.contr : x.staff.includes(DN.who) || x.contr === DN.who)));
}
const dnStaff = id => (HHS.staff || []).find(s => s.id === id);
const dnContr = (D, id) => D.contrs.find(c => c.id === id);
const dnWho = (D, x) => { const n = x.staff.map(id => dnStaff(id)?.name || 'Técnico'); if (x.contr && !x.staff.length) n.push(dnContr(D, x.contr)?.name || 'Contratista'); return n.length ? n : ['Sin asignar']; };
const dnWhen = d => { const t = todayStr(); return d < t ? 'atrasada' : d === t ? 'hoy' : d === addDays(t, 1) ? 'mañana' : fmtDate(d); };

/* ---------- pantalla ---------- */
async function viewDonde(v){
  if (!isManager()){ v.innerHTML = '<div class="card"><b>Esta pantalla es de la oficina.</b><p class="muted">La ven supervisores, PM, coordinadores y administradores.</p><a href="#/tools">Volver</a></div>'; return; }
  if (!needOnline()){ v.innerHTML = '<div class="card">El mapa necesita señal.</div>'; return; }
  dnCss();
  const D = await dnLoad();
  const draw = () => {
    const items = dnItems(D);
    const people = new Map();
    for (const x of items){ const keys = x.staff.length ? x.staff : x.contr ? [x.contr] : ['libre'];
      for (const k of keys){ const p = people.get(k) || { k, n: 0, locs: new Set(), onsite: false }; p.n++; p.locs.add(x.s?.localidad || x.site || ''); p.onsite ||= x.onsite; people.set(k, p); } }
    const pname = k => k === 'libre' ? 'Sin asignar' : dnStaff(k)?.name || dnContr(D, k)?.name || '—';
    const pfig = k => k === 'libre' ? shirtFig(null, 'libre', 30) : dnStaff(k) ? shirtFig(D.shirts.get(k), 'parado', 30) : truckFig(20);
    const unplaced = items.filter(x => !x.c);
    const needC = new Map(); unplaced.forEach(x => { if (x.k){ const e = needC.get(x.k) || { k: x.k, label: [x.s?.localidad, x.s?.provincia].filter(Boolean).join(', '), n: 0 }; e.n++; needC.set(x.k, e); } });
    const noLoc = unplaced.filter(x => !x.k);
    const whoOpts = [...new Set([...(HHS.staff || []).filter(s => s.active && s.kind !== 'contratista').map(s => s.id), ...D.contrs.filter(c => c.active).map(c => c.id)])];
    v.innerHTML = `
      <div class="card"><div class="row between" style="gap:10px;flex-wrap:wrap">
        <div><h1 style="margin:0">📍 ¿Dónde está cada uno?</h1><div class="muted sm">Cada uno sobre la localidad de la tarea que tiene asignada. Tocá un muñequito para ver la tarea, mandarle un WhatsApp o reasignar.</div></div>
        <div class="row" style="gap:6px;flex-wrap:wrap">${[['hoy', 'Hoy'], ['man', 'Mañana'], ['sem', 'Esta semana']].map(([k, t]) => `<button class="dn-pill ${DN.f === k ? 'on' : ''}" data-f="${k}">${t}</button>`).join('')}
          <select id="dn-p" style="width:auto"><option value="">Todos los proyectos</option>${D.projects.filter(p => p.active !== false).map(p => `<option value="${esc(p.id)}" ${DN.proj === p.id ? 'selected' : ''}>${esc(p.short_name || p.name)}</option>`).join('')}</select>
          <select id="dn-w" style="width:auto"><option value="">Todas las personas</option><option value="libre" ${DN.who === 'libre' ? 'selected' : ''}>Sin asignar</option>${whoOpts.map(id => `<option value="${esc(id)}" ${DN.who === id ? 'selected' : ''}>${esc(pname(id))}</option>`).join('')}</select></div></div>
        <div class="sm muted" style="margin-top:8px;display:flex;gap:14px;flex-wrap:wrap"><span>🚶 en camino (hoy)</span><span>🧍 asignado</span><span>🔧 en el sitio (marcó "Llegué")</span><span>🚚 contratista</span><span style="color:#B91C1C;font-weight:700">⚠ ticket</span><span style="color:#B45309">≈ ubicación aproximada (centro de la localidad)</span></div></div>
      <div class="dn-grid">
        <div><div class="card" style="padding:0;overflow:hidden;margin:0"><div id="dn-map" style="height:max(440px,64vh)"></div></div>
          <div id="dn-card"></div></div>
        <div>
          <div class="card" style="margin:0 0 14px"><h2 style="margin:0 0 6px">Gente · ${DN.f === 'hoy' ? 'hoy' : DN.f === 'man' ? 'mañana' : 'esta semana'}</h2>
            ${[...people.values()].sort((a, b) => (a.k === 'libre') - (b.k === 'libre') || b.n - a.n).map(p => `<div class="dn-pr" data-who="${esc(p.k)}">${pfig(p.k)}<div style="flex:1;min-width:0"><b>${esc(pname(p.k))}</b><div class="sm muted" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.n} tarea${p.n === 1 ? '' : 's'}${p.onsite ? ' · en el sitio' : ''} · ${esc([...p.locs].filter(Boolean).slice(0, 4).join(', '))}</div></div>${dnStaff(p.k) && canWrite() ? `<button class="iconbtn" data-shirt="${esc(p.k)}" title="Camiseta" aria-label="Camiseta">👕</button>` : ''}</div>`).join('') || '<p class="muted sm">No hay tareas en este período.</p>'}
            ${DN.who ? '<button class="btn sec small" id="dn-all" style="margin-top:8px">Ver a todos</button>' : ''}</div>
          ${needC.size || noLoc.length ? `<div class="card" style="margin:0"><h2 style="margin:0 0 6px">Sin ubicación en el mapa</h2>
            ${[...needC.values()].map(e => `<div class="dn-it"><b>${esc(e.label)}</b><div class="sm muted">${e.n} tarea${e.n === 1 ? '' : 's'} · ningún sitio de esta localidad tiene coordenadas</div>${canWrite() ? `<button class="btn small" data-center="${esc(e.k)}" data-lab="${esc(e.label)}" style="margin-top:6px">Marcar el centro en el mapa</button>` : ''}</div>`).join('')}
            ${noLoc.map(x => `<div class="dn-it"><b>${esc(x.site || 'Sin sitio')}</b><div class="sm muted">${esc(dnWho(D, x).join(', '))} · ${esc(x.title)}<br>El sitio no tiene coordenadas ni localidad: cargalas en Sitios.</div></div>`).join('')}</div>` : ''}
        </div></div>`;
    v.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { DN.f = b.dataset.f; draw(); });
    $('#dn-p').onchange = e => { DN.proj = e.target.value; draw(); };
    $('#dn-w').onchange = e => { DN.who = e.target.value; draw(); };
    $('#dn-all')?.addEventListener('click', () => { DN.who = ''; draw(); });
    v.querySelectorAll('[data-who]').forEach(r => r.onclick = e => { if (e.target.closest('[data-shirt]')) return; DN.who = r.dataset.who; draw(); });
    v.querySelectorAll('[data-shirt]').forEach(b => b.onclick = () => shirtModal(b.dataset.shirt, D.shirts.get(b.dataset.shirt), sh => { D.shirts.set(b.dataset.shirt, sh); draw(); }));
    v.querySelectorAll('[data-center]').forEach(b => b.onclick = () => {
      DN.pick = { k: b.dataset.center, label: b.dataset.lab };
      toast('Tocá en el mapa el centro de ' + b.dataset.lab); $('#dn-map').scrollIntoView({ behavior: 'smooth', block: 'center' }); $('#dn-map').style.cursor = 'crosshair'; });
    dnMap(D, items, draw);
  };
  draw();
}

function dnMap(D, items, redraw){
  if (typeof L === 'undefined' || !$('#dn-map')) return;
  if (DN.map){ DN.map.remove(); DN.map = null; }
  const map = DN.map = L.map('dn-map', { zoomControl: true });
  L.tileLayer(typeof MAP_TILE_URL_SAFE === 'function' ? MAP_TILE_URL_SAFE() : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap' }).addTo(map);
  const groups = new Map();
  for (const x of items){ if (!x.c) continue; const k = x.c[0].toFixed(4) + ',' + x.c[1].toFixed(4); if (!groups.has(k)) groups.set(k, { c: x.c, items: [] }); groups.get(k).items.push(x); }
  const pts = [];
  for (const g of groups.values()){
    pts.push(g.c);
    const whoKeys = [...new Set(g.items.flatMap(x => x.staff.length ? x.staff : x.contr ? [x.contr] : ['libre']))];
    const mode = k => { const its = g.items.filter(x => x.staff.includes(k) || x.contr === k || (k === 'libre' && !x.staff.length && !x.contr));
      return k === 'libre' ? 'libre' : its.some(x => x.onsite) ? 'sitio' : its.some(x => x.date <= todayStr()) ? 'camina' : 'parado'; };
    const fig = k => k === 'libre' ? shirtFig(null, 'libre') : dnStaff(k) ? shirtFig(D.shirts.get(k), mode(k)) : truckFig();
    const names = whoKeys.map(k => k === 'libre' ? 'Sin asignar' : dnStaff(k)?.name || dnContr(D, k)?.name || '—');
    const first = g.items[0], tk = g.items.some(x => x.ticket || x.kind === 'ticket'), approx = g.items.every(x => x.approx);
    const loc = first.s?.localidad || first.site || '';
    const html = `<div class="dn-mk"><div class="dn-lab"><b>${esc(names.slice(0, 2).join(' · '))}${names.length > 2 ? ' +' + (names.length - 2) : ''}</b>
      <span>${tk ? '<span class="tkb">⚠ </span>' : ''}${esc(loc)} · ${g.items.length > 1 ? g.items.length + ' tareas' : esc(dnWhen(first.date))}</span><br><span>${esc(String(first.title || '').slice(0, 40))}${g.items.length > 1 ? ' y más' : ''}</span>${approx ? '<br><span class="ap">≈ centro de la localidad</span>' : ''}</div>
      <div class="dn-figs">${whoKeys.slice(0, 3).map(fig).join('')}${whoKeys.length > 3 ? `<span class="more">+${whoKeys.length - 3}</span>` : ''}</div></div>`;
    const mk = L.marker(g.c, { icon: L.divIcon({ className: '', html, iconSize: [0, 0] }), keyboard: true, title: names.join(', ') }).addTo(map);
    mk.on('click', () => { const el = mk.getElement(); el?.querySelectorAll('.dn-fig').forEach(f => { f.classList.remove('dn-wave'); void f.getBoundingClientRect(); f.classList.add('dn-wave'); }); dnCard(D, g.items, redraw); });
  }
  map.on('click', async e => {
    if (!DN.pick) return; const p = DN.pick; DN.pick = null; $('#dn-map').style.cursor = '';
    if (!confirm('¿Guardar este punto como centro de ' + p.label + '?')) return;
    const { error } = await sb.from('loc_centers').upsert({ org_id: me.org_id, loc_key: p.k, label: p.label, lat: Number(e.latlng.lat.toFixed(6)), lng: Number(e.latlng.lng.toFixed(6)) }, { onConflict: 'org_id,loc_key' });
    if (error) return toast(errText(error));
    D.centers = D.centers.filter(c => c.loc_key !== p.k).concat([{ loc_key: p.k, label: p.label, lat: e.latlng.lat, lng: e.latlng.lng }]);
    toast('Centro de ' + p.label + ' guardado'); redraw();
  });
  if (pts.length) map.fitBounds(pts, { padding: [60, 60], maxZoom: 11 }); else map.setView([-31.0, -60.7], 7);
  setTimeout(() => map.invalidateSize(), 100);
}

function dnWaText(D, x, name){
  const link = location.origin + location.pathname + (x.kind === 'ticket' ? '#/tickets/' : '#/tasks/') + x.id;
  return `Hola ${name}, ${x.ticket ? 'ticket ' + (x.ticket.ext_no || '') + ' · ' : ''}${x.title}\nSitio: ${x.site || ''}${x.s?.localidad ? ' (' + x.s.localidad + ')' : ''}\nFecha: ${dnWhen(x.date)}\n${link}`;
}
function dnCard(D, items, redraw){
  const box = $('#dn-card'); if (!box) return;
  box.innerHTML = `<div class="card" style="margin:14px 0 0"><div class="row between"><h2 style="margin:0">${esc(items[0].s?.localidad || items[0].site || 'Sitio')}</h2><button class="iconbtn" id="dn-cx" aria-label="Cerrar">✕</button></div>
    ${items.map((x, i) => { const who = dnWho(D, x);
      const phones = [...x.staff.map(id => dnStaff(id)).filter(s => s && s.phone).map(s => [s.name, s.phone]), ...(!x.staff.length && x.contr && dnContr(D, x.contr)?.phone ? [[dnContr(D, x.contr).name, dnContr(D, x.contr).phone]] : [])];
      return `<div class="dn-it"><div class="row" style="gap:10px;flex-wrap:nowrap;align-items:flex-start">
        <div style="flex:none">${x.staff.length ? shirtFig(D.shirts.get(x.staff[0]), x.onsite ? 'sitio' : 'parado', 40) : x.contr ? truckFig(24) : shirtFig(null, 'libre', 40)}</div>
        <div style="flex:1;min-width:0"><b>${esc(who.join(', '))}</b>${x.ticket || x.kind === 'ticket' ? ' <span class="pill p-bad">⚠ Ticket</span>' : ''}${x.approx ? ' <span class="pill p-pend">≈ aproximada</span>' : ''}
          <div class="sm">${esc(x.title)}</div><div class="sm muted">${esc(x.site || '')} · ${esc(dnWhen(x.date))} · ${x.kind === 'ticket' ? esc(x.status) : esc(TASK_ST[x.status] || x.status)}${x.onsite ? ' · en el sitio' : ''}</div>
          <div class="row" style="gap:6px;margin-top:6px;flex-wrap:wrap">
            <button class="btn sec small" data-go="${i}">${x.kind === 'ticket' ? 'Ver ticket' : 'Ver tarea'}</button>
            ${phones.map(([n, p], j) => `<button class="btn sec small" data-wa="${i}" data-wj="${j}">WhatsApp ${esc(n.split(' ')[0])}</button>`).join('')}
            ${canWrite() ? `<button class="btn small" data-re="${i}">${who[0] === 'Sin asignar' ? 'Asignar' : 'Reasignar'}</button>` : ''}</div></div></div></div>`; }).join('')}</div>`;
  $('#dn-cx').onclick = () => { box.innerHTML = ''; };
  box.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { const x = items[b.dataset.go]; if (x.kind === 'ticket' && typeof tkDetailModal === 'function') tkDetailModal(x.id, () => route()); else location.hash = '#/tasks/' + x.id; });
  box.querySelectorAll('[data-wa]').forEach(b => b.onclick = () => { const x = items[b.dataset.wa];
    const list = [...x.staff.map(id => dnStaff(id)).filter(s => s && s.phone).map(s => [s.name, s.phone]), ...(!x.staff.length && x.contr && dnContr(D, x.contr)?.phone ? [[dnContr(D, x.contr).name, dnContr(D, x.contr).phone]] : [])];
    const [n, p] = list[Number(b.dataset.wj)] || []; const d = waPhone(p); if (!d) return toast('Sin celular cargado');
    window.open('https://wa.me/' + d + '?text=' + encodeURIComponent(dnWaText(D, x, String(n).split(' ')[0])), '_blank', 'noopener'); });
  box.querySelectorAll('[data-re]').forEach(b => b.onclick = () => { const x = items[b.dataset.re];
    if ((x.kind === 'ticket' || x.ticket) && typeof tkAssignModal === 'function') tkAssignModal(x.ticket?.id || x.id, () => route());
    else location.hash = '#/tasks/' + x.id; });
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ---------- camiseta ---------- */
function shirtEditor(box, init, onSave){
  let st = shirtClean(init || SHIRT_DEF);
  box.innerHTML = `<div class="grid2" style="align-items:center">
    <div>
      <label>Club</label><input id="sh-club" maxlength="30" value="${esc(st.club)}" placeholder="Nombre de tu club">
      <label>Diseño</label><div class="row" id="sh-p" style="gap:6px;flex-wrap:wrap">${Object.entries(SHIRT_PAT).map(([k, t]) => `<button type="button" class="dn-pill ${st.p === k ? 'on' : ''}" data-p="${k}">${t}</button>`).join('')}</div>
      <label>Color principal</label><div class="row" id="sh-a" style="gap:8px;flex-wrap:wrap">${SHIRT_COLS.map(([c, n]) => `<button type="button" class="sh-sw ${st.a === c ? 'on' : ''}" data-c="${c}" style="background:${c}" title="${n}" aria-label="${n}"></button>`).join('')}</div>
      <label>Segundo color</label><div class="row" id="sh-b" style="gap:8px;flex-wrap:wrap">${SHIRT_COLS.map(([c, n]) => `<button type="button" class="sh-sw ${st.b === c ? 'on' : ''}" data-c="${c}" style="background:${c}" title="${n}" aria-label="${n}"></button>`).join('')}</div>
      <label>Número</label><input id="sh-n" inputmode="numeric" maxlength="2" value="${esc(st.n)}" style="width:90px">
    </div>
    <div style="text-align:center;background:#F1F5F9;border-radius:14px;padding:16px"><div class="sm muted">Así te ven en el mapa · tocalo</div><div id="sh-prev" style="cursor:pointer;margin-top:6px"></div><div id="sh-msg" class="sm" style="min-height:20px;color:#0F2A4A"></div></div></div>
    <div class="err" id="sh-err"></div>
    <div class="row" style="justify-content:flex-end;gap:8px;margin-top:10px"><button class="btn sec" id="sh-def" type="button">Sin camiseta</button><button class="btn" id="sh-ok" type="button">Guardar</button></div>`;
  const prev = () => { $('#sh-prev').innerHTML = shirtFig(st, 'parado', 150); };
  const rd = () => { st.club = $('#sh-club').value; st.n = $('#sh-n').value.replace(/\D/g, '').slice(0, 2); st = shirtClean(st); prev(); };
  box.querySelectorAll('#sh-p [data-p]').forEach(b => b.onclick = () => { st.p = b.dataset.p; box.querySelectorAll('#sh-p [data-p]').forEach(x => x.classList.toggle('on', x === b)); rd(); });
  ['a', 'b'].forEach(k => box.querySelectorAll(`#sh-${k} [data-c]`).forEach(b => b.onclick = () => { st[k] = b.dataset.c; box.querySelectorAll(`#sh-${k} [data-c]`).forEach(x => x.classList.toggle('on', x === b)); rd(); }));
  $('#sh-n').oninput = rd; $('#sh-club').oninput = rd;
  $('#sh-prev').onclick = () => { const f = $('#sh-prev svg'); f.classList.remove('dn-wave'); void f.getBoundingClientRect(); f.classList.add('dn-wave');
    $('#sh-msg').textContent = '¡Hola! Soy de ' + (st.club.trim() || 'mi club'); };
  $('#sh-ok').onclick = () => { rd(); onSave(st); };
  $('#sh-def').onclick = () => onSave(null);
  prev();
}
async function shirtSave(staffId, sh){
  if (!needOnline()) return false;
  const { error } = await sb.rpc('shirt_set', { p_staff: staffId || null, p_shirt: sh ? shirtClean(sh) : null });
  if (error){ toast(errText(error)); return false; }
  toast(sh ? 'Camiseta guardada' : 'Camiseta quitada'); return true;
}
function shirtModal(staffId, cur, after){
  dnCss();
  const m = modal(`<h2>Camiseta de ${esc(dnStaff(staffId)?.name || 'técnico')}</h2><div id="sh-box"></div>`, { wide: true });
  shirtEditor($('#sh-box'), cur, async sh => { if (await shirtSave(staffId, sh)){ m.close(); after && after(sh ? shirtClean(sh) : null); } });
}
async function viewShirt(v){
  dnCss();
  if (!needOnline()){ v.innerHTML = '<div class="card">Necesita señal.</div>'; return; }
  const { data, error } = await sb.rpc('my_shirt');
  if (error) throw error;
  if (!data){ v.innerHTML = `<div class="card"><h2 style="margin:0">👕 Mi camiseta</h2><p class="muted">Tu usuario todavía no está vinculado a un recurso. Pedile a la oficina que te vincule en Herramientas → Validación de horas y tareas → Recursos.</p><a href="#/tools">Volver</a></div>`; return; }
  v.innerHTML = `<div class="card"><div class="row between"><div><h2 style="margin:0">👕 Mi camiseta</h2><p class="muted sm" style="margin:4px 0 0">Elegí los colores de tu club: así te ve la oficina en el mapa.</p></div><a class="btn sec" href="#/tools">← Volver</a></div><div id="sh-box" style="margin-top:10px"></div></div>`;
  shirtEditor($('#sh-box'), data.shirt, async sh => { if (await shirtSave(null, sh)) location.hash = '#/tools'; });
}
