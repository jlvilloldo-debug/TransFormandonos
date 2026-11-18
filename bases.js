/* =====================================================================
   InspectApp v5.23 · 🗺 MAPA DE BASES Y CUADRILLAS (por proyecto)   #/bases/<id del proyecto>
   ---------------------------------------------------------------------
   · Bases: lugar en el mapa (se mueven), de Trans o de una contratista.
   · Cuadrillas: salen de una base, hacen uno o más servicios (preventivo EPI, reparación FO…),
     tienen recursos (personas, vehículos, equipos) y cubren sitios y tramos como titular o apoyo.
     Dos cuadrillas pueden cubrir lo mismo (por ejemplo preventivo EPI + reparación FO).
   · Plan vigente y borrador: los cambios se prueban en el borrador y se pasan a vigente.
   · Cada cambio queda en el historial (cov_log). Guarda solo coordinación / supervisión / PM / admin.
   ===================================================================== */
const BS = { pid:null, p:null, plans:{}, log:[], kind:'vigente', plan:null, sites:[], cables:[], byKey:new Map(), staff:[],
  tab:'crews', focus:null, svc:'all', hide:new Set(), moving:null, paint:null, area:false, q:'', layers:{ cab:true, sit:true, names:true, bases:true },
  map:null, G:null, dirty:false, pending:[], saveT:null, saving:false, savedAt:null, err:null };
const BS_SVC = { prev_epi:['🧹','Preventivo EPI / nodos'], corr_epi:['🔧','Correctivo EPI / nodos'], energia:['⚡','Energía y grupo electrógeno'], fo_rep:['🧵','Reparación y fusión FO'], fo_prev:['🚶','Recorrida de traza FO'], radio:['📡','Radioenlaces'], otro:['•','Otro'] };
const BS_RT = { persona:['👷','Persona'], vehiculo:['🚙','Vehículo'], equipo:['🧰','Equipo'] };
const BS_PAL = ['#2563eb','#d97706','#059669','#db2777','#7c3aed','#0891b2','#65a30d','#dc2626','#475569','#a16207'];
const BS_OWN = ['Trans','SIP Servicios Integrales','Sagir'];
const bsCol = c => /^#[0-9a-f]{6}$/i.test(c || '') ? c : '#64748b';
const bsId = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const bsKm = (a, b) => { const R = 6371, r = x => x * Math.PI / 180, dA = r(b[0] - a[0]), dO = r(b[1] - a[1]); const h = Math.sin(dA / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dO / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const bsCan = () => isManager() && canWrite();
const bsBase = id => BS.plan.bases.find(b => b.id === id);
const bsCrew = id => BS.plan.crews.find(c => c.id === id);
const bsShort = s => String(s || '').replace(/^Base \d+\s*[–-]\s*/, '');
const bsPos = it => it.c || it.mid;

function bsCss(){
  if (document.getElementById('bs-css')) return;
  const s = document.createElement('style'); s.id = 'bs-css';
  s.textContent = `
  .bs{display:grid;grid-template-rows:auto 1fr;height:calc(100vh - 150px);min-height:520px;gap:10px}
  .bs-head{display:flex;gap:8px 14px;flex-wrap:wrap;align-items:center;justify-content:space-between}
  .bs-head h1{margin:0;font-size:20px}
  .bs-seg{display:inline-flex;background:#E8EEF4;border-radius:10px;padding:3px;gap:2px}
  .bs-seg button{border:0;background:transparent;padding:6px 12px;border-radius:8px;font-weight:700;font-size:13px;color:#475569;cursor:pointer}
  .bs-seg button.on{background:#fff;color:#0F2A4A;box-shadow:0 1px 3px rgba(0,0,0,.12)}
  .bs-save{font-size:12px;color:var(--muted)}
  .bs-main{display:grid;grid-template-columns:370px minmax(0,1fr);gap:10px;min-height:0}
  .bs-side{background:#fff;border:1px solid var(--line);border-radius:14px;overflow:auto;min-height:0;display:flex;flex-direction:column}
  .bs-tabs{display:grid;grid-template-columns:repeat(5,1fr);border-bottom:1px solid var(--line);position:sticky;top:0;background:#fff;z-index:2}
  .bs-tabs button{border:0;background:transparent;padding:9px 2px;font-size:11.5px;font-weight:700;color:var(--muted);border-bottom:3px solid transparent;cursor:pointer;display:grid;justify-items:center;gap:1px}
  .bs-tabs button span{font-size:16px}
  .bs-tabs button.on{color:var(--ink,#14202E);border-bottom-color:#17946A}
  .bs-pane{padding:12px 14px 22px;display:grid;gap:10px;align-content:start}
  .bs-pane h2{margin:0;font-size:16px}
  .bs-card{border:1px solid var(--line);border-radius:12px;padding:10px 12px;display:grid;gap:6px;background:#fff}
  .bs-card.dim{opacity:.45}.bs-card.foc{box-shadow:inset 0 0 0 2px var(--bc)}
  .bs-base{border:2px solid var(--bc);border-radius:14px;padding:10px;display:grid;gap:8px;background:#FAFCFD}
  .bs-sw{width:13px;height:13px;border-radius:4px;flex:none;display:inline-block}
  .bs-own{font-size:11px;font-weight:700;padding:1px 7px;border-radius:20px;background:#F1F5F9;color:#475569;border:1px solid var(--line);white-space:nowrap}
  .bs-kv{display:grid;grid-template-columns:repeat(4,1fr);gap:5px}
  .bs-kv div{background:#F4F7F9;border-radius:8px;padding:4px;font-size:10.5px;color:var(--muted);text-align:center}
  .bs-kv b{display:block;font-size:14px;color:#14202E;font-variant-numeric:tabular-nums}
  .bs-chips{display:flex;flex-wrap:wrap;gap:4px}
  .bs-chips span{font-size:11.5px;padding:2px 8px;border-radius:20px;background:#F1F5F9;border:1px solid var(--line)}
  .bs-mapw{position:relative;border-radius:14px;overflow:hidden;border:1px solid var(--line);min-height:300px}
  #bs-map{position:absolute;inset:0}
  .bs-tools{position:absolute;top:8px;left:52px;right:8px;z-index:500;display:flex;gap:6px;flex-wrap:wrap;pointer-events:none}
  .bs-tools > *{pointer-events:auto}
  .bs-tools button,.bs-tools select{border:1px solid var(--line);background:#fff;border-radius:20px;padding:5px 10px;font-size:12px;font-weight:700;color:#475569;box-shadow:0 1px 3px rgba(0,0,0,.15);cursor:pointer;width:auto}
  .bs-tools button.on{background:#0F2A4A;border-color:#0F2A4A;color:#fff}
  .bs-paint{position:absolute;left:8px;right:8px;bottom:8px;z-index:600;background:#0F2A4A;color:#fff;border-radius:12px;padding:8px 10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;font-size:13px}
  .bs-paint select{width:auto;padding:4px 8px;border-radius:8px}
  .bs-paint button{border:0;border-radius:8px;padding:5px 10px;font-weight:700;cursor:pointer}
  .bs-legend{position:absolute;right:8px;bottom:8px;z-index:500;background:#fff;border:1px solid var(--line);border-radius:12px;padding:7px 9px;font-size:11.5px;display:grid;gap:3px;max-width:230px;max-height:45%;overflow:auto;box-shadow:0 2px 8px rgba(0,0,0,.15)}
  .bs-legend div{display:flex;gap:6px;align-items:center}
  .bs-lbl{background:transparent;border:0;box-shadow:none;color:#1F2D3D;font-size:11px;font-weight:700;text-shadow:0 0 3px #fff,0 0 3px #fff,0 0 3px #fff;padding:0}
  .bs-lbl::before{display:none}
  .bs-bm{display:grid;place-items:center;width:34px;height:34px;border-radius:9px;color:#fff;font-weight:800;font-size:13px;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)}
  .bs-bm.drag{outline:3px dashed #0F2A4A;outline-offset:3px;cursor:move}
  .bs-pop h3{margin:0 0 2px;font-size:15px}
  .bs-pop .r{display:grid;grid-template-columns:minmax(0,1fr) 110px;gap:6px;align-items:center;font-size:12.5px}
  .bs-pop select{padding:4px 6px}
  table.bs-t{border-collapse:collapse;width:100%;font-size:12.5px}
  table.bs-t th,table.bs-t td{border-bottom:1px solid var(--line);padding:5px 4px;text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
  table.bs-t th:first-child,table.bs-t td:first-child{text-align:left;white-space:normal}
  .bs-up{color:#15803D;font-weight:700}.bs-dn{color:#B91C1C;font-weight:700}
  .bs-log div{font-size:12.5px;border-left:3px solid var(--line);padding:2px 0 2px 8px;margin-bottom:6px}
  .bs-cols{display:flex;gap:6px;flex-wrap:wrap}.bs-cols button{width:26px;height:26px;border-radius:7px;border:2px solid transparent;cursor:pointer}.bs-cols button.on{border-color:#14202E}
  .bs-svc{display:flex;flex-wrap:wrap;gap:6px}.bs-svc label{display:flex;gap:4px;align-items:center;font-weight:500;border:1px solid var(--line);border-radius:20px;padding:3px 9px;font-size:12.5px;margin:0}
  .bs-warn{background:#FEF3C7;color:#92400E;border-radius:10px;padding:8px 10px;font-size:12.5px}
  @media (max-width:900px){ .bs{height:auto} .bs-main{grid-template-columns:minmax(0,1fr)} .bs-mapw{order:-1;height:58vh} .bs-legend{display:none} }`;
  document.head.appendChild(s);
}

/* ---------- datos ---------- */
async function bsLoad(pid){
  const [projects, ps, sitesAll, nets, plans, log] = await Promise.all([
    loadProjects().catch(() => []), loadPS().catch(() => []), loadSitesMap().catch(() => []),
    cached('bs-nets-' + pid, () => sb.from('net_networks').select('id,name,kind').eq('project_id', pid)).catch(() => []),
    cached('bs-plans-' + pid, () => sb.from('cov_plans').select('kind,data,updated_at,updated_by_name').eq('project_id', pid)).catch(() => []),
    cached('bs-log-' + pid, () => sb.from('cov_log').select('kind,at,who,text').eq('project_id', pid).order('id', { ascending:false }).limit(300)).catch(() => []),
  ]);
  BS.p = projects.find(x => x.id === pid);
  if (!BS.p) throw new Error('No se encontró el proyecto (o no tenés acceso).');
  const sid = new Set(ps.filter(x => x.project_id === pid).map(x => x.site_id)), smap = new Map(sitesAll.map(s => [s.id, s]));
  BS.sites = [...sid].map(id => smap.get(id)).filter(s => s && s.lat != null && s.lng != null)
    .map(s => ({ key:'s:' + s.id, id:s.id, name:s.name, loc:s.localidad, kind:s.kind, traza:s.traza, c:[+s.lat, +s.lng] }));
  BS.cables = [];
  for (const n of (nets || []).filter(n => n.kind === 'troncal')){
    const cbs = await cached('bs-cab-' + n.id, () => pageAll(() => sb.from('net_cables').select('id,name,path,length_m,props').eq('network_id', n.id).eq('active', true).order('id'))).catch(() => []);
    for (const c of cbs || []){
      const path = (c.path || []).filter(p => Array.isArray(p) && p.length >= 2).map(p => [+p[1], +p[0]]);
      if (path.length < 2) continue;
      let km = c.length_m != null ? +c.length_m / 1000 : 0; if (!km) for (let i = 1; i < path.length; i++) km += bsKm(path[i - 1], path[i]);
      BS.cables.push({ key:'c:' + c.id, id:c.id, name:c.name || 'Tramo', net:n.name, path, km:Math.round(km * 10) / 10, mid:path[Math.floor(path.length / 2)] });
    }
  }
  BS.byKey = new Map([...BS.sites, ...BS.cables].map(x => [x.key, x]));
  BS.plans = {};
  for (const k of ['vigente', 'borrador']){ const r = (plans || []).find(x => x.kind === k); BS.plans[k] = r ? bsNorm(r.data) : null; if (r) BS.plans[k]._at = r.updated_at, BS.plans[k]._by = r.updated_by_name; }
  BS.log = log || [];
  try { const st = await cached('bs-staff', () => sb.from('hh_staff').select('id,name').order('name')); BS.staff = (st || []).map(x => x.name).filter(Boolean); } catch { BS.staff = []; }
}
function bsNorm(d){
  d = d && typeof d === 'object' ? d : {};
  return { bases:(Array.isArray(d.bases) ? d.bases : []).map(b => ({ ...b, color:bsCol(b.color) })),
    crews:(Array.isArray(d.crews) ? d.crews : []).map(c => ({ ...c, color:bsCol(c.color), svc:Array.isArray(c.svc) ? c.svc : [], res:Array.isArray(c.res) ? c.res : [], cov:c.cov && typeof c.cov === 'object' ? c.cov : {} })),
    lims:d.lims && typeof d.lims === 'object' ? d.lims : {} };
}
const bsEmpty = () => ({ bases:[], crews:[], lims:{} });
const bsClone = p => JSON.parse(JSON.stringify({ bases:p.bases, crews:p.crews, lims:p.lims }));

/* ---------- guardar (con espera corta para juntar cambios) ---------- */
function bsChange(text){
  if (!bsCan()) return;
  BS.plans[BS.kind] = BS.plan; if (text) BS.pending.push(text);
  BS.dirty = true; bsSaveState(); clearTimeout(BS.saveT); BS.saveT = setTimeout(bsSave, 1200);
}
async function bsSave(){
  if (!BS.dirty || BS.saving) return;
  if (!online()){ BS.err = 'Sin conexión: se guarda cuando vuelva.'; bsSaveState(); BS.saveT = setTimeout(bsSave, 8000); return; }
  BS.saving = true; BS.dirty = false; const logs = BS.pending.splice(0, 30), kind = BS.kind; bsSaveState();
  try {
    const { data, error } = await sb.rpc('cov_save', { p_project:BS.pid, p_kind:kind, p_data:bsClone(BS.plans[kind]), p_log:logs });
    if (error) throw error;
    BS.savedAt = data; BS.err = null;
    const at = new Date().toISOString(); for (const t of logs) BS.log.unshift({ kind, at, who:me?.full_name || 'Yo', text:t });
    IDB.del('kv', CUR_UID + ':bs-plans-' + BS.pid).catch(() => {}); IDB.del('kv', CUR_UID + ':bs-log-' + BS.pid).catch(() => {});
  } catch (e){ BS.err = errText(e); BS.dirty = true; BS.pending.unshift(...logs); }
  BS.saving = false; bsSaveState(); if (BS.tab === 'hist') bsPane();
  if (BS.dirty && !BS.err) BS.saveT = setTimeout(bsSave, 800);
}
function bsSaveState(){
  const el = document.getElementById('bs-st'); if (!el) return;
  el.innerHTML = !bsCan() ? '👁 Solo lectura' : BS.err ? `<span style="color:#B91C1C">⚠ ${esc(BS.err)}</span>` : BS.saving || BS.dirty ? 'Guardando…' : BS.savedAt ? '✔ Guardado' : '';
}
window.addEventListener('beforeunload', e => { if (BS.dirty || BS.saving){ e.preventDefault(); e.returnValue = ''; } });

/* ---------- vista principal ---------- */
async function viewBases(v, pid){
  bsCss(); BS.pid = pid; BS.focus = null; BS.moving = null; BS.paint = null; BS.area = false; BS.hide.clear();
  v.innerHTML = '<div class="card"><p class="muted">Cargando el mapa de bases…</p></div>';
  await bsLoad(pid);
  if (!BS.plans.vigente && !BS.plans.borrador) BS.plans.vigente = bsEmpty();
  if (!BS.plans[BS.kind]) BS.kind = BS.plans.vigente ? 'vigente' : 'borrador';
  BS.plan = BS.plans[BS.kind];
  v.innerHTML = `<div class="bs">
    <div class="bs-head">
      <div><div class="muted sm"><a href="#/proj/${esc(pid)}">← ${esc(BS.p.name)}</a></div><h1>🗺 Mapa de bases</h1></div>
      <div class="row" style="gap:8px;align-items:center;flex-wrap:wrap">
        <div class="bs-seg" id="bs-scen"><button data-k="vigente">Vigente</button><button data-k="borrador">Borrador</button></div>
        ${bsCan() ? '<button class="btn sec small" id="bs-copy" style="margin:0">Copiar vigente al borrador</button>' : ''}
        <span class="bs-save" id="bs-st"></span>
      </div>
    </div>
    <div class="bs-main">
      <aside class="bs-side"><nav class="bs-tabs" id="bs-tabs">
        <button data-t="crews"><span>🏠</span>Bases</button><button data-t="quien"><span>🔎</span>¿Quién cubre?</button>
        <button data-t="lim"><span>⚠️</span>Límites</button><button data-t="comp"><span>⚖️</span>Comparar</button><button data-t="hist"><span>🕓</span>Historial</button></nav>
        <div class="bs-pane" id="bs-pane"></div></aside>
      <div class="bs-mapw"><div id="bs-map" aria-label="Mapa de bases y cobertura"></div><div class="bs-tools" id="bs-tools"></div><div class="bs-legend" id="bs-leg"></div><div id="bs-paint"></div></div>
    </div></div>`;
  BS.map = L.map('bs-map', { preferCanvas:false }); L.tileLayer(SITE_TILE_BS, { maxZoom:18, attribution:'© OpenStreetMap' }).addTo(BS.map);
  BS.G = { cab:L.layerGroup().addTo(BS.map), sit:L.layerGroup().addTo(BS.map), bas:L.layerGroup().addTo(BS.map) };
  BS.map.on('zoomend', () => { const z = BS.map.getZoom() >= 9; if (z !== BS._z){ BS._z = z; bsDraw(); } });
  bsBindArea();
  document.querySelectorAll('#bs-scen button').forEach(b => b.onclick = () => bsScen(b.dataset.k));
  document.querySelectorAll('#bs-tabs button').forEach(b => b.onclick = () => { BS.tab = b.dataset.t; bsPane(); });
  $('#bs-copy')?.addEventListener('click', bsCopyDraft);
  bsRender(); bsFit(); setTimeout(() => BS.map?.invalidateSize(), 120);
}
const SITE_TILE_BS = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
function bsFit(){
  const pts = [...BS.sites.map(s => s.c), ...BS.cables.flatMap(c => [c.path[0], c.path[c.path.length - 1]]), ...BS.plan.bases.map(b => [b.lat, b.lng])];
  if (pts.length) BS.map.fitBounds(L.latLngBounds(pts).pad(0.05)); else BS.map.setView([-31, -61], 6);
}
async function bsScen(k){
  if (k === BS.kind) return;
  if (BS.dirty){ clearTimeout(BS.saveT); await bsSave(); }
  if (!BS.plans[k]){
    if (!bsCan()) return toast('Todavía no hay borrador.');
    BS.plans[k] = bsClone(BS.plans.vigente || bsEmpty()); BS.kind = k; BS.plan = BS.plans[k]; bsChange('Armó el borrador copiando lo vigente.');
  }
  BS.kind = k; BS.plan = BS.plans[k]; BS.focus = null; BS.moving = null; BS.paint = null; bsRender();
  toast(k === 'borrador' ? 'Estás en el borrador: los cambios no tocan lo vigente.' : 'Estás en lo vigente.');
}
async function bsCopyDraft(){
  const b = $('#bs-copy');
  if (BS.plans.borrador && !b.dataset.sure){ b.dataset.sure = 1; b.textContent = 'Tocá otra vez: reemplaza el borrador'; setTimeout(() => { if (b.isConnected){ delete b.dataset.sure; b.textContent = 'Copiar vigente al borrador'; } }, 4000); return; }
  if (BS.dirty){ clearTimeout(BS.saveT); await bsSave(); }
  BS.plans.borrador = bsClone(BS.plans.vigente || bsEmpty()); BS.kind = 'borrador'; BS.plan = BS.plans.borrador;
  bsChange('Copió lo vigente al borrador.'); bsRender(); toast('Borrador listo para modificar.');
}
function bsRender(){
  document.querySelectorAll('#bs-scen button').forEach(b => b.classList.toggle('on', b.dataset.k === BS.kind));
  bsSaveState(); bsTools(); bsPane(); bsDraw(); bsPaintBar();
}

/* ---------- cobertura ---------- */
// cuadrillas que se ven con el filtro actual (servicio + ocultas)
const bsVis = () => BS.plan.crews.filter(c => !BS.hide.has(c.id) && (BS.svc === 'all' || c.svc.includes(BS.svc)));
const bsWho = key => BS.plan.crews.filter(c => c.cov[key]).map(c => ({ c, r:c.cov[key] }));
function bsStats(plan){
  const m = new Map(plan.crews.map(c => [c.id, { t:0, a:0, km:0, per:c.res.filter(r => r.t === 'persona').length }]));
  for (const c of plan.crews){ const s = m.get(c.id);
    for (const [k, r] of Object.entries(c.cov)){ const it = BS.byKey.get(k); if (!it) continue;
      if (it.path){ if (r === 'T') s.km += it.km; } else if (r === 'T') s.t++; else s.a++; } }
  return m;
}
function bsIssues(plan){
  const vis = new Set(plan.crews.flatMap(c => Object.keys(c.cov)));
  const none = [...BS.sites, ...BS.cables].filter(it => !vis.has(it.key));
  const dup = [];   // dos titulares que hacen el mismo servicio en el mismo punto
  for (const it of BS.sites){ const tit = plan.crews.filter(c => c.cov[it.key] === 'T');
    for (const s of Object.keys(BS_SVC)){ const x = tit.filter(c => c.svc.includes(s)); if (x.length > 1) dup.push({ it, s, crews:x }); } }
  const svcHole = [];   // servicios que se dan en el proyecto pero no llegan a este sitio
  const used = [...new Set(plan.crews.flatMap(c => c.svc))];
  for (const it of BS.sites){ const who = plan.crews.filter(c => c.cov[it.key]); for (const s of used) if (!who.some(c => c.svc.includes(s))) svcHole.push({ it, s }); }
  return { none, dup, svcHole };
}

/* ---------- mapa ---------- */
function bsDraw(){
  if (!BS.map) return;
  const G = BS.G; G.cab.clearLayers(); G.sit.clearLayers(); G.bas.clearLayers();
  const vis = bsVis(), visIds = new Set(vis.map(c => c.id)), names = BS.layers.names && BS.map.getZoom() >= 9;
  const dim = key => BS.focus && !bsCrew(BS.focus)?.cov[key];
  if (BS.layers.cab) for (const cb of BS.cables){
    const who = bsWho(cb.key).filter(w => visIds.has(w.c.id)), d = dim(cb.key);
    L.polyline(cb.path, { color:'#94A3B8', weight:2, opacity:d ? .25 : .8, interactive:false }).addTo(G.cab);
    who.forEach((w, i) => L.polyline(cb.path, { color:w.c.color, weight:3 + (who.length - 1 - i) * 4, opacity:d ? .15 : (w.r === 'T' ? .9 : .75), dashArray:w.r === 'A' ? '8 9' : null, interactive:false }).addTo(G.cab));
    L.polyline(cb.path, { color:'#000', weight:14, opacity:0 }).addTo(G.cab).on('click', e => bsItemClick(cb, e.latlng)).bindTooltip(esc(cb.name), { sticky:true });
  }
  if (BS.layers.sit) for (const s of BS.sites){
    const who = bsWho(s.key).filter(w => visIds.has(w.c.id)), t = who.find(w => w.r === 'T'), d = dim(s.key), lim = BS.plan.lims[s.key];
    const m = L.circleMarker(s.c, { radius:who.length > 1 ? 8 : 6, fillColor:t ? t.c.color : who[0] ? '#fff' : '#94A3B8', fillOpacity:d ? .2 : 1,
      color:who.length > 1 ? (who.find(w => w !== t) || who[0]).c.color : who[0] && !t ? who[0].c.color : '#fff', weight:who.length > 1 || (who[0] && !t) ? 3 : 1.5, opacity:d ? .2 : 1, dashArray:lim ? '3 3' : null }).addTo(G.sit);
    if (names && !d) m.bindTooltip(esc(s.name), { permanent:true, direction:'right', offset:[7, 0], className:'bs-lbl' });
    else m.bindTooltip(esc(s.name));
    m.on('click', e => bsItemClick(s, e.latlng));
  }
  if (BS.layers.bases) for (const b of BS.plan.bases){
    const crews = BS.plan.crews.filter(c => c.base === b.id), num = (b.name.match(/\d+/) || [b.name[0] || '?'])[0];
    const ic = L.divIcon({ className:'', html:`<div class="bs-bm ${BS.moving === b.id ? 'drag' : ''}" style="background:${bsCol(b.color)}">${esc(num)}</div>`, iconSize:[34, 34], iconAnchor:[17, 17] });
    const mk = L.marker([b.lat, b.lng], { icon:ic, draggable:BS.moving === b.id, zIndexOffset:1000, opacity:BS.focus && !crews.some(c => c.id === BS.focus) ? .5 : 1 }).addTo(G.bas);
    mk.bindTooltip(`<b>${esc(b.name)}</b> · ${esc(b.owner)}<br>${crews.map(c => esc(c.name)).join('<br>') || 'Sin cuadrillas'}`, { direction:'top', offset:[0, -16] });
    mk.on('dragend', e => { const p = e.target.getLatLng(), dkm = bsKm([b.lat, b.lng], [p.lat, p.lng]); b.lat = +p.lat.toFixed(6); b.lng = +p.lng.toFixed(6); BS.moving = null; bsChange(`Movió ${b.name} ${dkm.toFixed(1)} km.`); bsRender(); toast('Base movida.'); });
  }
  bsLegend();
}
function bsLegend(){
  const vis = bsVis(), is = bsIssues(BS.plan);
  $('#bs-leg').innerHTML = (vis.map(c => `<div><span class="bs-sw" style="background:${c.color}"></span>${esc(c.name)}</div>`).join('') || '<div class="muted">Sin cuadrillas a la vista</div>') +
    '<div><svg width="24" height="8" aria-hidden="true"><line x1="0" y1="4" x2="24" y2="4" stroke="#64748B" stroke-width="4" stroke-dasharray="6 5"/></svg>Apoyo</div>' +
    '<div><span class="bs-sw" style="background:#fff;border:3px solid #64748B;border-radius:50%"></span>Lo cubre más de una</div>' +
    (is.none.length ? `<div style="color:#B45309"><span class="bs-sw" style="background:#94A3B8;border-radius:50%"></span>${is.none.length} sin cuadrilla</div>` : '');
}
function bsTools(){
  const used = [...new Set(BS.plan.crews.flatMap(c => c.svc))];
  $('#bs-tools').innerHTML = `<select id="bs-svc" aria-label="Servicio"><option value="all">Todos los servicios</option>${used.map(s => `<option value="${s}" ${BS.svc === s ? 'selected' : ''}>${BS_SVC[s][0]} ${BS_SVC[s][1]}</option>`).join('')}</select>
    ${[['cab', 'Tramos'], ['sit', 'Sitios'], ['names', 'Nombres'], ['bases', 'Bases']].map(([k, l]) => `<button data-ly="${k}" class="${BS.layers[k] ? 'on' : ''}">${l}</button>`).join('')}
    <button data-ly="fit">⤢ Todo</button>${bsCan() ? `<button id="bs-pt" class="${BS.paint ? 'on' : ''}">🖌 Pintar cobertura</button>` : ''}`;
  if (!used.includes(BS.svc)) BS.svc = 'all';
  $('#bs-svc').onchange = e => { BS.svc = e.target.value; bsDraw(); bsPane(); };
  document.querySelectorAll('#bs-tools [data-ly]').forEach(b => b.onclick = () => { const k = b.dataset.ly; if (k === 'fit') return bsFit(); BS.layers[k] = !BS.layers[k]; bsTools(); bsDraw(); });
  $('#bs-pt')?.addEventListener('click', () => { if (BS.paint){ BS.paint = null; BS.area = false; } else { if (!BS.plan.crews.length) return toast('Primero creá una cuadrilla.'); BS.paint = { crew:BS.focus || BS.plan.crews[0].id, role:'T' }; } bsTools(); bsPaintBar(); });
}

/* ---------- pintar cobertura: tocar puntos o marcar un área ---------- */
function bsPaintBar(){
  const box = $('#bs-paint'); if (!box) return;
  if (!BS.paint){ box.innerHTML = ''; BS.area = false; BS.map?.dragging.enable(); return; }
  box.innerHTML = `<div class="bs-paint"><b>🖌</b><select id="bp-c">${BS.plan.crews.map(c => `<option value="${c.id}" ${BS.paint.crew === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
    <select id="bp-r"><option value="T" ${BS.paint.role === 'T' ? 'selected' : ''}>como titular</option><option value="A" ${BS.paint.role === 'A' ? 'selected' : ''}>como apoyo</option><option value="X" ${BS.paint.role === 'X' ? 'selected' : ''}>quitar</option></select>
    <button id="bp-a" style="background:${BS.area ? '#FBBF24' : '#fff'};color:#0F2A4A">${BS.area ? '▭ Arrastrá en el mapa…' : '▭ Marcar un área'}</button>
    <span style="flex:1;min-width:120px;font-size:12px;opacity:.85">Tocá sitios o tramos, o marcá un área.</span><button id="bp-x" style="background:transparent;color:#fff;border:1px solid rgba(255,255,255,.4)">Listo</button></div>`;
  $('#bp-c').onchange = e => { BS.paint.crew = e.target.value; };
  $('#bp-r').onchange = e => { BS.paint.role = e.target.value; };
  $('#bp-a').onclick = () => { BS.area = !BS.area; BS.area ? BS.map.dragging.disable() : BS.map.dragging.enable(); bsPaintBar(); };
  $('#bp-x').onclick = () => { BS.paint = null; bsTools(); bsPaintBar(); };
}
function bsApply(items){
  const c = bsCrew(BS.paint.crew); if (!c || !items.length) return;
  let n = 0; for (const it of items){ const before = c.cov[it.key]; if (BS.paint.role === 'X'){ if (before){ delete c.cov[it.key]; n++; } } else if (before !== BS.paint.role){ c.cov[it.key] = BS.paint.role; n++; } }
  if (!n) return toast('No cambió nada.');
  const lbl = items.length === 1 ? items[0].name : `${items.length} puntos`;
  bsChange(BS.paint.role === 'X' ? `${c.name}: dejó de cubrir ${lbl}.` : `${c.name}: cubre ${lbl} como ${BS.paint.role === 'T' ? 'titular' : 'apoyo'}.`);
  bsDraw(); bsPane(); toast(`${n} punto(s) actualizados.`);
}
function bsBindArea(){
  let start = null, rect = null;
  const mp = BS.map;
  mp.on('mousedown', e => { if (!BS.area) return; start = e.latlng; rect = L.rectangle([start, start], { color:'#0F2A4A', weight:2, dashArray:'5 5', fillOpacity:.08 }).addTo(mp); });
  mp.on('mousemove', e => { if (start && rect) rect.setBounds([start, e.latlng]); });
  mp.on('mouseup', e => {
    if (!start) return; const b = L.latLngBounds(start, e.latlng); start = null; rect?.remove(); rect = null;
    const inB = p => b.contains(L.latLng(p[0], p[1]));
    const items = [...(BS.layers.sit ? BS.sites.filter(s => inB(s.c)) : []), ...(BS.layers.cab ? BS.cables.filter(c => c.path.filter(inB).length * 2 >= c.path.length) : [])];
    BS.area = false; mp.dragging.enable(); bsPaintBar(); bsApply(items);
  });
  // en el teléfono: tocar dos esquinas
  mp.on('click', e => { if (!BS.area || !L.Browser.touch) return; if (!BS._c1){ BS._c1 = e.latlng; toast('Ahora tocá la esquina opuesta.'); return; }
    const b = L.latLngBounds(BS._c1, e.latlng); BS._c1 = null; const inB = p => b.contains(L.latLng(p[0], p[1]));
    const items = [...BS.sites.filter(s => inB(s.c)), ...BS.cables.filter(c => c.path.filter(inB).length * 2 >= c.path.length)];
    BS.area = false; mp.dragging.enable(); bsPaintBar(); bsApply(items); });
}

/* ---------- tocar un sitio o tramo ---------- */
function bsItemClick(it, at){
  if (BS.paint && !BS.area) return bsApply([it]);
  if (BS.area) return;
  const can = bsCan(), lim = !!BS.plan.lims[it.key];
  const ds = it.c ? BS.plan.bases.map(b => ({ b, d:bsKm([b.lat, b.lng], it.c) })).sort((x, y) => x.d - y.d) : [];
  const html = `<div class="bs-pop"><h3>${esc(it.name)}</h3><div class="muted sm">${it.path ? `Tramo · ${esc(it.net)} · ${it.km} km` : `Sitio${it.loc && it.loc !== it.name ? ' · ' + esc(it.loc) : ''}${it.traza ? ' · ' + esc(it.traza) : ''}`}${lim ? ' · <b>punto límite</b>' : ''}</div>
    ${ds.length ? `<div class="sm" style="margin:6px 0">Distancia en línea recta: ${ds.map(({ b, d }) => `<span style="white-space:nowrap"><span class="bs-sw" style="background:${b.color};width:9px;height:9px"></span> ${esc(bsShort(b.name))} ${d.toFixed(0)} km</span>`).join(' · ')}</div>` : ''}
    <div style="display:grid;gap:5px;margin-top:6px">${BS.plan.crews.map(c => `<div class="r"><span><span class="bs-sw" style="background:${c.color}"></span> ${esc(c.name)} <span class="muted">${c.svc.map(s => BS_SVC[s][0]).join('')}</span></span>
      <select data-pc="${c.id}" ${can ? '' : 'disabled'}><option value="">—</option><option value="T" ${c.cov[it.key] === 'T' ? 'selected' : ''}>Titular</option><option value="A" ${c.cov[it.key] === 'A' ? 'selected' : ''}>Apoyo</option></select></div>`).join('') || '<p class="muted sm">Todavía no hay cuadrillas.</p>'}</div>
    ${can ? `<label style="display:flex;gap:6px;align-items:center;margin-top:8px;font-weight:500"><input type="checkbox" id="bp-l" style="width:auto" ${lim ? 'checked' : ''}> Punto límite (lo define la mesa)</label>
      <div class="row" style="justify-content:flex-end;margin-top:8px"><button class="btn small" id="bp-ok" style="margin:0">Guardar</button></div>` : ''}</div>`;
  const pop = L.popup({ maxWidth:340, minWidth:260 }).setLatLng(at).setContent(html).openOn(BS.map);
  setTimeout(() => {
    const ok = document.getElementById('bp-ok'); if (!ok) return;
    ok.onclick = () => {
      const ch = [];
      document.querySelectorAll('.bs-pop [data-pc]').forEach(s => { const c = bsCrew(s.dataset.pc), v = s.value, was = c.cov[it.key] || '';
        if (v !== was){ if (v) c.cov[it.key] = v; else delete c.cov[it.key]; ch.push(`${c.name} ${v === 'T' ? 'titular' : v === 'A' ? 'apoyo' : 'ya no cubre'}`); } });
      const l = document.getElementById('bp-l').checked; if (l !== lim){ if (l) BS.plan.lims[it.key] = true; else delete BS.plan.lims[it.key]; ch.push(l ? 'marcado como punto límite' : 'ya no es punto límite'); }
      BS.map.closePopup(pop); if (!ch.length) return;
      bsChange(`${it.name}: ${ch.join(', ')}.`); bsDraw(); bsPane(); toast('Guardado.');
    };
  }, 0);
}

/* ---------- panel lateral ---------- */
function bsPane(){
  document.querySelectorAll('#bs-tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === BS.tab));
  const P = $('#bs-pane'); if (!P) return;
  P.innerHTML = ({ crews:bsPCrews, quien:bsPQuien, lim:bsPLim, comp:bsPComp, hist:bsPHist })[BS.tab]();
  P.querySelectorAll('[data-fc]').forEach(x => x.onclick = () => { BS.focus = BS.focus === x.dataset.fc ? null : x.dataset.fc; if (BS.paint && BS.focus) BS.paint.crew = BS.focus; bsPane(); bsDraw(); bsPaintBar(); });
  P.querySelectorAll('[data-hc]').forEach(x => x.onclick = () => { const id = x.dataset.hc; BS.hide.has(id) ? BS.hide.delete(id) : BS.hide.add(id); bsPane(); bsDraw(); });
  P.querySelectorAll('[data-ec]').forEach(x => x.onclick = () => bsEditCrew(bsCrew(x.dataset.ec)));
  P.querySelectorAll('[data-eb]').forEach(x => x.onclick = () => bsEditBase(bsBase(x.dataset.eb)));
  P.querySelectorAll('[data-mv]').forEach(x => x.onclick = () => { BS.moving = BS.moving === x.dataset.mv ? null : x.dataset.mv; const b = bsBase(x.dataset.mv); if (BS.moving){ BS.map.panTo([b.lat, b.lng]); toast('Arrastrá la base en el mapa y soltala donde va.'); } bsPane(); bsDraw(); });
  P.querySelectorAll('[data-zc]').forEach(x => x.onclick = () => { const c = bsCrew(x.dataset.zc); BS.focus = c.id; const pts = Object.keys(c.cov).map(k => BS.byKey.get(k)).filter(Boolean).flatMap(it => it.path ? [it.path[0], it.path[it.path.length - 1]] : [it.c]); const b = bsBase(c.base); if (b) pts.push([b.lat, b.lng]); if (pts.length) BS.map.fitBounds(L.latLngBounds(pts).pad(0.15)); bsPane(); bsDraw(); });
  P.querySelectorAll('[data-go]').forEach(x => x.onclick = () => { const it = BS.byKey.get(x.dataset.go); if (!it) return; BS.map.setView(bsPos(it), 11); bsItemClick(it, bsPos(it)); });
  $('#bs-nb')?.addEventListener('click', () => bsEditBase(null));
  $('#bs-nc')?.addEventListener('click', () => bsEditCrew(null));
  const q = $('#bs-q'); if (q){ q.oninput = () => { BS.q = q.value; const pos = q.selectionStart; bsPane(); const q2 = $('#bs-q'); q2.focus(); q2.setSelectionRange(pos, pos); }; }
  $('#bs-prom')?.addEventListener('click', bsPromote);
}
function bsCrewCard(c, st){
  const s = st.get(c.id);
  return `<div class="bs-card ${BS.focus && BS.focus !== c.id ? 'dim' : ''} ${BS.focus === c.id ? 'foc' : ''}" style="--bc:${c.color}">
    <div class="row" style="gap:8px;align-items:center"><span class="bs-sw" style="background:${c.color}"></span><b style="flex:1;cursor:pointer" data-fc="${c.id}" title="Ver solo esta cuadrilla">${esc(c.name)}</b><span class="bs-own">${esc(c.owner)}</span>
      <button class="btn sec small" data-hc="${c.id}" style="margin:0;padding:2px 7px" title="${BS.hide.has(c.id) ? 'Mostrar' : 'Ocultar'} en el mapa">${BS.hide.has(c.id) ? '🙈' : '👁'}</button></div>
    <div class="bs-chips">${c.svc.map(x => `<span>${BS_SVC[x][0]} ${BS_SVC[x][1]}</span>`).join('') || '<span>Sin servicios</span>'}${c.guard ? '<span>📟 Guardia 7x24</span>' : ''}</div>
    <div class="bs-kv"><div><b>${s.t}</b>sitios tit.</div><div><b>${s.a}</b>apoyo</div><div><b>${Math.round(s.km)}</b>km tramo</div><div><b>${c.svc.includes('prev_epi') ? Math.ceil(s.t / 3) : '—'}</b>EPI/mes</div></div>
    <div class="bs-chips">${c.res.map(r => `<span>${BS_RT[r.t][0]} ${esc(r.n)}</span>`).join('') || '<span class="muted">Sin recursos cargados</span>'}</div>
    <div class="row" style="gap:6px">${bsCan() ? `<button class="btn sec small" data-ec="${c.id}" style="margin:0">✏️ Editar y recursos</button>` : ''}<button class="btn sec small" data-zc="${c.id}" style="margin:0">🔍 Ver</button></div></div>`;
}
function bsPCrews(){
  const st = bsStats(BS.plan), can = bsCan(), loose = BS.plan.crews.filter(c => !bsBase(c.base));
  const empty = !BS.plan.bases.length && !BS.plan.crews.length;
  return `<div class="row" style="justify-content:space-between"><h2>Bases y cuadrillas${BS.kind === 'borrador' ? ' · borrador' : ''}</h2>${can ? '<div class="row" style="gap:6px"><button class="btn sec small" id="bs-nb" style="margin:0">+ Base</button><button class="btn small" id="bs-nc" style="margin:0">+ Cuadrilla</button></div>' : ''}</div>
    ${!BS.sites.length && !BS.cables.length ? '<div class="bs-warn">El proyecto no tiene sitios con ubicación ni trazas cargadas. Sumá los sitios al proyecto, o cargá el KMZ de trazas en 🌐 Red de fibra.</div>' : ''}
    ${!BS.cables.length && BS.sites.length ? '<p class="muted sm" style="margin:0">Se ven los sitios del proyecto. Para ver los tramos de fibra, cargá el KMZ de trazas en 🌐 Red de fibra.</p>' : ''}
    ${empty ? `<div class="bs-card"><b>Cómo se arma</b><ol class="sm" style="margin:0;padding-left:18px;line-height:1.6"><li><b>+ Base</b>: nombre, de quién es, y la ubicás en el mapa.</li><li><b>+ Cuadrilla</b>: de qué base sale, qué servicios hace y sus recursos.</li><li>En la cuadrilla, <b>Cubrir lo más cercano a su base</b> arma una primera cobertura sola.</li><li>Con <b>🖌 Pintar cobertura</b> ajustás: tocás sitios o tramos, o marcás un área.</li></ol></div>` : ''}
    ${BS.plan.bases.map(b => { const cs = BS.plan.crews.filter(c => c.base === b.id);
      return `<div class="bs-base" style="--bc:${b.color}"><div class="row" style="gap:8px;align-items:center"><span class="bs-sw" style="background:${b.color}"></span><b style="flex:1">${esc(b.name)}</b><span class="bs-own">${esc(b.owner)}</span></div>
        ${b.notes ? `<div class="muted sm">${esc(b.notes)}</div>` : ''}
        ${can ? `<div class="row" style="gap:6px"><button class="btn sec small" data-eb="${b.id}" style="margin:0">✏️ Editar</button><button class="btn sec small" data-mv="${b.id}" style="margin:0">${BS.moving === b.id ? '✔ Soltala en el mapa' : '📍 Mover'}</button></div>` : ''}
        ${cs.map(c => bsCrewCard(c, st)).join('') || '<p class="muted sm" style="margin:0">Sin cuadrillas en esta base.</p>'}</div>`; }).join('')}
    ${loose.length ? `<div class="bs-base" style="--bc:#CBD5E1"><b>Cuadrillas sin base</b>${loose.map(c => bsCrewCard(c, st)).join('')}</div>` : ''}`;
}
function bsPQuien(){
  const q = BS.q.trim().toLowerCase(), all = [...BS.sites, ...BS.cables];
  const res = q.length < 2 ? [] : all.filter(it => (it.name + ' ' + (it.loc || '')).toLowerCase().includes(q)).slice(0, 10);
  return `<h2>¿Quién cubre…?</h2><input type="text" id="bs-q" placeholder="Escribí una localidad, sitio o tramo" value="${esc(BS.q)}" autocomplete="off">
    ${q.length < 2 ? '<p class="muted sm" style="margin:0">Te dice qué cuadrillas cubren el lugar, con qué servicio, y a qué distancia está cada base.</p>' :
    res.length ? res.map(it => { const who = bsWho(it.key), ds = it.c ? BS.plan.bases.map(b => ({ b, d:bsKm([b.lat, b.lng], it.c) })).sort((x, y) => x.d - y.d) : [];
      const tit = who.filter(w => w.r === 'T'), near = ds[0]?.b, titBases = new Set(tit.map(w => w.c.base));
      return `<div class="bs-card"><div class="row" style="justify-content:space-between"><b>${esc(it.name)}</b><span class="muted sm">${it.path ? 'Tramo · ' + it.km + ' km' : esc(it.loc || 'Sitio')}</span></div>
        ${who.length ? who.map(w => `<div class="sm"><span class="bs-sw" style="background:${w.c.color}"></span> <b>${esc(w.c.name)}</b> · ${w.r === 'T' ? 'titular' : 'apoyo'} · ${w.c.svc.map(s => BS_SVC[s][1]).join(', ') || 'sin servicios'}${bsBase(w.c.base) ? ' · sale de ' + esc(bsBase(w.c.base).name) : ''}</div>`).join('') : '<div class="bs-warn">Ninguna cuadrilla lo cubre.</div>'}
        ${BS.plan.lims[it.key] ? '<div class="sm">📍 Punto límite</div>' : ''}
        ${ds.length ? `<div class="muted sm">Bases más cerca: ${ds.slice(0, 3).map(({ b, d }) => `${esc(bsShort(b.name))} ${d.toFixed(0)} km`).join(' · ')}${tit.length && near && !titBases.has(near.id) ? ' · <b style="color:#B45309">la titular no sale de la base más cercana</b>' : ''}</div>` : ''}
        <div><button class="btn sec small" data-go="${it.key}" style="margin:0">Ver en el mapa</button></div></div>`; }).join('') : '<p class="muted sm">No encontré ese lugar en el proyecto.</p>'}`;
}
function bsPLim(){
  const is = bsIssues(BS.plan), lims = Object.keys(BS.plan.lims).map(k => BS.byKey.get(k)).filter(Boolean);
  const li = (it, extra) => `<div class="row" style="justify-content:space-between;border-bottom:1px solid var(--line);padding:4px 0;gap:6px"><span class="sm">${esc(it.name)} <span class="muted">${extra || ''}</span></span><button class="btn sec small" data-go="${it.key}" style="margin:0;padding:2px 8px">Ver</button></div>`;
  const holes = BS.svc === 'all' ? is.svcHole : is.svcHole.filter(x => x.s === BS.svc);
  return `<h2>Límites y huecos</h2>
    <div class="bs-card"><b>${is.none.length ? '⚠️' : '✔'} Sin ninguna cuadrilla (${is.none.length})</b>${is.none.slice(0, 40).map(it => li(it, it.path ? 'tramo' : 'sitio')).join('') || '<p class="muted sm" style="margin:0">Todo tiene al menos una cuadrilla.</p>'}</div>
    <div class="bs-card"><b>Sitios sin un servicio (${holes.length})</b><p class="muted sm" style="margin:0">El servicio se da en el proyecto, pero ninguna cuadrilla lo lleva a ese sitio. Filtrá por servicio arriba del mapa.</p>${holes.slice(0, 40).map(x => li(x.it, BS_SVC[x.s][1])).join('')}</div>
    <div class="bs-card"><b>Dos titulares para el mismo servicio (${is.dup.length})</b>${is.dup.slice(0, 40).map(x => li(x.it, `${BS_SVC[x.s][1]}: ${x.crews.map(c => c.name).join(' y ')}`)).join('') || '<p class="muted sm" style="margin:0">Ninguno.</p>'}</div>
    <div class="bs-card"><b>Puntos límite (${lims.length})</b><p class="muted sm" style="margin:0">Los marca la mesa a mano en cada sitio o tramo.</p>${lims.map(it => li(it, bsWho(it.key).map(w => w.c.name + (w.r === 'A' ? ' (apoyo)' : '')).join(' · '))).join('')}</div>`;
}
function bsPComp(){
  const V = BS.plans.vigente, B = BS.plans.borrador;
  if (!B) return `<h2>Vigente vs. borrador</h2><p class="muted sm">Todavía no hay borrador. Con <b>Copiar vigente al borrador</b> armás uno para probar cambios sin tocar lo vigente.</p>`;
  const sv = bsStats(V || bsEmpty()), sb_ = bsStats(B), ids = [...new Set([...(V?.crews || []), ...B.crews].map(c => c.id))];
  const nm = id => (B.crews.find(c => c.id === id) || V.crews.find(c => c.id === id)).name, z = { t:0, a:0, km:0, per:0 }, cl = (a, b) => b > a ? 'bs-up' : b < a ? 'bs-dn' : '';
  const ch = [...BS.sites, ...BS.cables].filter(it => JSON.stringify((V?.crews || []).filter(c => c.cov[it.key]).map(c => c.id + c.cov[it.key]).sort()) !== JSON.stringify(B.crews.filter(c => c.cov[it.key]).map(c => c.id + c.cov[it.key]).sort()));
  const moved = B.bases.filter(b => { const o = V?.bases.find(x => x.id === b.id); return !o || bsKm([o.lat, o.lng], [b.lat, b.lng]) > 0.5; });
  return `<h2>Vigente vs. borrador</h2>
    <div style="overflow-x:auto"><table class="bs-t"><thead><tr><th>Cuadrilla</th><th>Sitios tit.</th><th>km tramo</th><th>Personas</th><th>Sitios/pers.</th></tr></thead><tbody>
    ${ids.map(id => { const a = sv.get(id) || z, b = sb_.get(id) || z, r = x => x.per ? (x.t / x.per).toFixed(1) : '—';
      return `<tr><td>${esc(nm(id))}</td><td>${a.t} → <span class="${cl(a.t, b.t)}">${b.t}</span></td><td>${Math.round(a.km)} → <span class="${cl(a.km, b.km)}">${Math.round(b.km)}</span></td><td>${a.per} → <span class="${cl(a.per, b.per)}">${b.per}</span></td><td>${r(a)} → ${r(b)}</td></tr>`; }).join('')}</tbody></table></div>
    ${moved.length ? `<div class="bs-card"><b>Bases nuevas o movidas (${moved.length})</b>${moved.map(b => `<div class="sm">${esc(b.name)}</div>`).join('')}</div>` : ''}
    <div class="bs-card"><b>Sitios y tramos que cambian (${ch.length})</b>${ch.slice(0, 40).map(it => `<div class="sm">${esc(it.name)}</div>`).join('') || '<p class="muted sm" style="margin:0">Mismo reparto que lo vigente.</p>'}</div>
    ${bsCan() ? '<div><button class="btn" id="bs-prom" style="margin:0">Pasar el borrador a vigente</button></div><p class="muted sm" id="bs-prom-n" style="margin:0"></p>' : ''}`;
}
async function bsPromote(){
  const b = $('#bs-prom'); if (!b.dataset.sure){ b.dataset.sure = 1; b.textContent = 'Tocá otra vez para confirmar'; $('#bs-prom-n').textContent = 'Lo vigente se reemplaza por el borrador. Queda en el historial.'; return; }
  if (BS.dirty){ clearTimeout(BS.saveT); await bsSave(); }
  const { error } = await sb.rpc('cov_promote', { p_project:BS.pid }); if (error) return toast(errText(error));
  BS.plans.vigente = bsClone(BS.plans.borrador); BS.log.unshift({ kind:'vigente', at:new Date().toISOString(), who:me?.full_name || 'Yo', text:'Pasó el borrador a vigente.' });
  IDB.del('kv', CUR_UID + ':bs-plans-' + BS.pid).catch(() => {});
  BS.kind = 'vigente'; BS.plan = BS.plans.vigente; bsRender(); toast('El borrador ahora es lo vigente.');
}
function bsPHist(){
  const l = BS.log.filter(x => x.kind === BS.kind);
  return `<h2>Historial · ${BS.kind}</h2><p class="muted sm" style="margin:0">Cada cambio de base, cuadrilla, recurso o cobertura, con fecha y quién lo hizo.</p>
    <div class="bs-log">${l.map(x => `<div>${esc(x.text)}<div class="muted sm">${esc(fmtDT(x.at))} · ${esc(x.who || '')}</div></div>`).join('') || '<p class="muted sm">Sin cambios todavía.</p>'}</div>`;
}

/* ---------- editar base ---------- */
function bsEditBase(b){
  const isNew = !b, c0 = BS.map.getCenter();
  const x = b ? JSON.parse(JSON.stringify(b)) : { id:bsId('b'), name:'Base ' + (BS.plan.bases.length + 1) + ' – ', owner:'Trans', lat:+c0.lat.toFixed(6), lng:+c0.lng.toFixed(6), color:BS_PAL[BS.plan.bases.length % BS_PAL.length], notes:'' };
  const m = modal(`<h2>${isNew ? 'Nueva base' : 'Editar base'}</h2>
    <label for="be-n">Nombre</label><input id="be-n" maxlength="80" value="${esc(x.name)}">
    <label for="be-o">De quién es</label><input id="be-o" list="be-ol" maxlength="80" value="${esc(x.owner)}"><datalist id="be-ol">${BS_OWN.map(o => `<option value="${esc(o)}">`).join('')}</datalist>
    <label>Color</label><div class="bs-cols" id="be-c">${BS_PAL.map(c => `<button type="button" data-c="${c}" class="${x.color === c ? 'on' : ''}" style="background:${c}" aria-label="Color ${c}"></button>`).join('')}</div>
    <label for="be-s">Ubicarla en un sitio del proyecto <span class="muted sm">(opcional; después la podés mover en el mapa)</span></label><input id="be-s" list="be-sl" placeholder="Escribí para buscar" autocomplete="off"><datalist id="be-sl">${BS.sites.map(s => `<option value="${esc(s.name)}">`).join('')}</datalist>
    <label for="be-t">Notas</label><input id="be-t" maxlength="300" value="${esc(x.notes || '')}" placeholder="Dirección, horario, contacto…">
    <div class="err" id="be-e"></div>
    <div class="row" style="justify-content:space-between;margin-top:10px">${!isNew ? '<button class="btn sec" id="be-d" style="color:#B91C1C">Quitar base</button>' : '<span></span>'}<div class="row"><button class="btn sec" id="be-x">Cancelar</button><button class="btn" id="be-ok">Guardar</button></div></div>`);
  m.el.querySelectorAll('[data-c]').forEach(c => c.onclick = () => { x.color = c.dataset.c; m.el.querySelectorAll('[data-c]').forEach(z => z.classList.toggle('on', z === c)); });
  $('#be-x').onclick = m.close;
  $('#be-d')?.addEventListener('click', e => { const d = e.target; if (!d.dataset.sure){ d.dataset.sure = 1; d.textContent = 'Tocá otra vez para confirmar'; return; }
    BS.plan.bases = BS.plan.bases.filter(z => z.id !== x.id); BS.plan.crews.forEach(c => { if (c.base === x.id) c.base = null; });
    m.close(); bsChange(`Quitó la base ${x.name}. Sus cuadrillas quedaron sin base.`); bsRender(); });
  $('#be-ok').onclick = () => {
    x.name = $('#be-n').value.trim(); x.owner = $('#be-o').value.trim() || 'Trans'; x.notes = $('#be-t').value.trim();
    if (!x.name) return void ($('#be-e').textContent = 'Poné un nombre.');
    const s = $('#be-s').value.trim() && BS.sites.find(z => z.name === $('#be-s').value.trim()); if (s){ x.lat = s.c[0]; x.lng = s.c[1]; }
    const lg = [];
    if (isNew){ BS.plan.bases.push(x); lg.push(`Nueva base ${x.name} (${x.owner})${s ? ' en ' + s.name : ''}.`); }
    else { const i = BS.plan.bases.findIndex(z => z.id === x.id), o = BS.plan.bases[i]; BS.plan.bases[i] = x;
      const d = []; if (o.name !== x.name) d.push(`renombrada (antes ${o.name})`); if (o.owner !== x.owner) d.push(`ahora es de ${x.owner}`); if (s) d.push(`ubicada en ${s.name}`);
      if (d.length) lg.push(`${x.name}: ${d.join('; ')}.`); }
    m.close(); bsChange(lg.join(' ')); bsRender(); if (isNew && !s) toast('Base creada en el centro del mapa: tocá 📍 Mover para ubicarla.');
  };
}

/* ---------- editar cuadrilla ---------- */
function bsEditCrew(c){
  const isNew = !c;
  const x = c ? JSON.parse(JSON.stringify(c)) : { id:bsId('c'), name:'', owner:'Trans', base:BS.plan.bases[0]?.id || null, color:BS_PAL[(BS.plan.crews.length + 3) % BS_PAL.length], svc:[], guard:false, res:[], cov:{} };
  const resLog = [];
  const body = () => `<h2>${isNew ? 'Nueva cuadrilla' : 'Editar cuadrilla'}</h2>
    <label for="ce-n">Nombre</label><input id="ce-n" maxlength="80" value="${esc(x.name)}" placeholder="Ej.: Reparación FO Norte">
    <div class="row" style="gap:10px"><div class="grow"><label for="ce-o">De quién es</label><input id="ce-o" list="ce-ol" maxlength="80" value="${esc(x.owner)}"><datalist id="ce-ol">${BS_OWN.map(o => `<option value="${esc(o)}">`).join('')}</datalist></div>
      <div class="grow"><label for="ce-b">Sale de la base</label><select id="ce-b"><option value="">— Sin base —</option>${BS.plan.bases.map(b => `<option value="${b.id}" ${x.base === b.id ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select></div></div>
    <label>Qué hace</label><div class="bs-svc">${Object.entries(BS_SVC).map(([k, [ic, l]]) => `<label><input type="checkbox" value="${k}" style="width:auto" ${x.svc.includes(k) ? 'checked' : ''}> ${ic} ${l}</label>`).join('')}</div>
    <label style="display:flex;gap:6px;align-items:center;font-weight:500"><input type="checkbox" id="ce-g" style="width:auto" ${x.guard ? 'checked' : ''}> Guardia 7x24</label>
    <label>Color en el mapa</label><div class="bs-cols">${BS_PAL.map(k => `<button type="button" data-c="${k}" class="${x.color === k ? 'on' : ''}" style="background:${k}" aria-label="Color ${k}"></button>`).join('')}</div>
    <label>Recursos <span class="muted sm">(cada alta o baja queda en el historial)</span></label>
    <div style="display:grid;gap:5px">${x.res.map((r, i) => `<div class="row" style="gap:6px"><span style="flex:1">${BS_RT[r.t][0]} ${esc(r.n)}</span><button class="btn sec small" data-rx="${i}" style="margin:0">Quitar</button></div>`).join('') || '<p class="muted sm" style="margin:0">Sin recursos.</p>'}</div>
    <div class="row" style="gap:6px"><select id="cr-t" style="width:auto">${Object.entries(BS_RT).map(([k, v]) => `<option value="${k}">${v[0]} ${v[1]}</option>`).join('')}</select><input id="cr-n" list="cr-nl" maxlength="80" placeholder="Nombre, patente o equipo" style="flex:1;min-width:140px"><datalist id="cr-nl">${BS.staff.slice(0, 500).map(n => `<option value="${esc(n)}">`).join('')}</datalist><button class="btn sec small" id="cr-add" style="margin:0">Agregar</button></div>
    ${!isNew ? `<details style="margin-top:8px"><summary style="cursor:pointer;font-weight:700">Armar la cobertura rápido</summary>
      <div style="display:grid;gap:6px;margin-top:6px">
        <button class="btn sec small" id="ce-near" style="margin:0" ${bsBase(x.base) ? '' : 'disabled'}>📍 Cubrir como titular lo más cercano a su base</button>
        <div class="row" style="gap:6px"><select id="ce-cp" style="flex:1">${BS.plan.crews.filter(z => z.id !== x.id).map(z => `<option value="${z.id}">${esc(z.name)}</option>`).join('')}</select><select id="ce-cpr" style="width:auto"><option value="T">como titular</option><option value="A">como apoyo</option></select><button class="btn sec small" id="ce-cpb" style="margin:0">Copiar lo que cubre</button></div>
        <button class="btn sec small" id="ce-clr" style="margin:0;color:#B91C1C">Borrar toda su cobertura</button>
        <p class="muted sm" style="margin:0" id="ce-cov">Cubre ${Object.keys(x.cov).length} sitios y tramos.</p></div></details>` : ''}
    <div class="err" id="ce-e"></div>
    <div class="row" style="justify-content:space-between;margin-top:10px">${!isNew ? '<button class="btn sec" id="ce-d" style="color:#B91C1C">Quitar cuadrilla</button>' : '<span></span>'}<div class="row"><button class="btn sec" id="ce-x">Cancelar</button><button class="btn" id="ce-ok">Guardar</button></div></div>`;
  const covLog = [];
  const sync = () => { x.name = $('#ce-n').value; x.owner = $('#ce-o').value; x.base = $('#ce-b').value || null; x.guard = $('#ce-g').checked; x.svc = [...m.el.querySelectorAll('.bs-svc input:checked')].map(i => i.value); };
  const bind = () => {
    m.el.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { sync(); x.color = b.dataset.c; m.el.innerHTML = body(); bind(); });
    m.el.querySelectorAll('[data-rx]').forEach(b => b.onclick = () => { sync(); const r = x.res.splice(+b.dataset.rx, 1)[0]; resLog.push(`quitó ${BS_RT[r.t][1].toLowerCase()} "${r.n}"`); m.el.innerHTML = body(); bind(); });
    $('#cr-add').onclick = () => { const n = $('#cr-n').value.trim(); if (!n) return $('#cr-n').focus(); sync(); const t = $('#cr-t').value; x.res.push({ t, n }); resLog.push(`sumó ${BS_RT[t][1].toLowerCase()} "${n}"`); m.el.innerHTML = body(); bind(); $('#cr-n').focus(); };
    $('#cr-n').onkeydown = e => { if (e.key === 'Enter'){ e.preventDefault(); $('#cr-add').click(); } };
    $('#ce-x').onclick = m.close;
    $('#ce-near')?.addEventListener('click', () => { sync(); const b = bsBase(x.base); if (!b) return;
      let n = 0; for (const it of [...BS.sites, ...BS.cables]){ const p = bsPos(it); const best = BS.plan.bases.map(z => ({ z, d:bsKm([z.lat, z.lng], p) })).sort((u, v) => u.d - v.d)[0];
        if (best?.z.id === b.id && x.cov[it.key] !== 'T'){ x.cov[it.key] = 'T'; n++; } }
      covLog.push(`tomó como titular ${n} puntos más cercanos a ${b.name}`); $('#ce-cov').textContent = `Cubre ${Object.keys(x.cov).length} sitios y tramos (se suman al guardar).`; toast(`${n} puntos sumados.`); });
    $('#ce-cpb')?.addEventListener('click', () => { const z = bsCrew($('#ce-cp').value); if (!z) return; const r = $('#ce-cpr').value; let n = 0;
      for (const k of Object.keys(z.cov)) if (x.cov[k] !== 'T' && x.cov[k] !== r){ x.cov[k] = r; n++; } covLog.push(`copió la cobertura de ${z.name} (${n} puntos, como ${r === 'T' ? 'titular' : 'apoyo'})`);
      $('#ce-cov').textContent = `Cubre ${Object.keys(x.cov).length} sitios y tramos (se suman al guardar).`; toast(`${n} puntos sumados.`); });
    $('#ce-clr')?.addEventListener('click', e => { const d = e.target; if (!d.dataset.sure){ d.dataset.sure = 1; d.textContent = 'Tocá otra vez para borrar'; return; } x.cov = {}; covLog.push('borró toda su cobertura'); $('#ce-cov').textContent = 'Sin cobertura (se aplica al guardar).'; });
    $('#ce-d')?.addEventListener('click', e => { const d = e.target; if (!d.dataset.sure){ d.dataset.sure = 1; d.textContent = 'Tocá otra vez para confirmar'; return; }
      BS.plan.crews = BS.plan.crews.filter(z => z.id !== x.id); if (BS.focus === x.id) BS.focus = null; m.close(); bsChange(`Quitó la cuadrilla ${x.name}.`); bsRender(); });
    $('#ce-ok').onclick = () => {
      sync(); x.name = x.name.trim(); x.owner = (x.owner || '').trim() || 'Trans';
      if (!x.name) return void ($('#ce-e').textContent = 'Poné un nombre.');
      if (!x.svc.length) return void ($('#ce-e').textContent = 'Marcá al menos un servicio.');
      const lg = [];
      if (isNew){ BS.plan.crews.push(x); lg.push(`Nueva cuadrilla ${x.name} (${x.owner})${bsBase(x.base) ? ' en ' + bsBase(x.base).name : ''}: ${x.svc.map(s => BS_SVC[s][1]).join(', ')}.`); }
      else { const i = BS.plan.crews.findIndex(z => z.id === x.id), o = BS.plan.crews[i]; BS.plan.crews[i] = x;
        const d = [];
        if (o.name !== x.name) d.push(`renombrada (antes ${o.name})`); if (o.owner !== x.owner) d.push(`ahora es de ${x.owner}`);
        if (o.base !== x.base) d.push(`pasa a ${bsBase(x.base)?.name || 'sin base'}`);
        if (o.svc.slice().sort().join() !== x.svc.slice().sort().join()) d.push(`servicios: ${x.svc.map(s => BS_SVC[s][1]).join(', ')}`);
        if (o.guard !== x.guard) d.push(x.guard ? 'con guardia 7x24' : 'sin guardia');
        d.push(...covLog);
        if (d.length) lg.push(`${x.name}: ${d.join('; ')}.`); }
      if (resLog.length) lg.push(`${x.name}: ${resLog.join('; ')}.`);
      m.close(); bsChange(lg.join(' ')); bsRender(); toast('Cuadrilla guardada.');
    };
  };
  const m = modal(body(), { wide:true }); bind(); $('#ce-n').focus();
}
