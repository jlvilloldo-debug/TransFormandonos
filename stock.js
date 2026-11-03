/* =====================================================================
   InspectApp · Transformándonos — v5.9
   ACTIVOS Y STOCK: equipos y herramientas con número de serie, materiales por cantidad,
   lugares (depósitos, bases, obradores, vehículos) que se crean y se desarman,
   stock general de la empresa y stock de cada proyecto, siempre separados.
   El historial de cada activo lo escribe la base sola: nadie lo puede editar ni borrar.
   Se carga recién al abrir Activos y stock. Todo texto que viene de la base pasa por esc().
   ===================================================================== */

const STK = { tab: 'eq', q: '', fType: '', fStatus: '', fPlace: '', sel: new Set(), base: null };
const STK_PLACE_KIND = { deposito: ['🏬', 'Depósito'], base: ['🏠', 'Base'], obrador: ['🚧', 'Obrador'], vehiculo: ['🚚', 'Vehículo'], otro: ['📦', 'Otro'] };
const STK_CAT = { equipo: ['📡', 'Equipo', 'Equipos'], herramienta: ['🧰', 'Herramienta', 'Herramientas'] };
const STK_DEF_CFG = { st_equipo: ['Activo', 'En stock', 'Instalado', 'Desmontado', 'Dañado', 'En reparación', 'Baja'], st_herr: ['Disponible', 'Asignada', 'En reparación', 'Baja'], owners: ['Trans', 'Cliente', 'Proveedor'] };
const STK_UUID = /^[0-9A-Za-z-]{1,40}$/;   // los id solo se usan para buscar en la lista o como parámetro, nunca en el HTML sin esc()

function stkCss(){
  if (document.getElementById('stk-css')) return;
  const s = document.createElement('style'); s.id = 'stk-css';
  s.textContent = `
.stk-scope{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:12px 14px;border-radius:12px;color:#fff;margin-bottom:12px}
.stk-scope.gen{background:linear-gradient(135deg,#0F2A4A,#1A3A6B)}.stk-scope.prj{background:linear-gradient(135deg,#5B21B6,#7C3AED)}.stk-scope.all{background:linear-gradient(135deg,#0E7490,#0891B2)}
.stk-scope .big{font-size:30px;line-height:1}.stk-scope h1{margin:0;font-size:20px;color:#fff}.stk-scope p{margin:2px 0 0;opacity:.85;font-size:13px}
.stk-scope select{width:auto;max-width:100%;padding:6px 8px;border-radius:8px;border:0;font-weight:600}
.stk-chips{display:flex;gap:6px;flex-wrap:wrap}.stk-chip{border:1px solid var(--line);background:#fff;border-radius:20px;padding:6px 12px;font-size:13px;cursor:pointer;color:var(--ink)}
.stk-chip.on{background:var(--navy);color:#fff;border-color:var(--navy)}
.stk-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:12px}
.stk-kpi{background:#fff;border-radius:12px;padding:12px 14px;box-shadow:0 1px 2px rgba(0,0,0,.06);border-left:4px solid var(--navy-2)}
.stk-kpi > span{font-size:12px;color:var(--muted)}.stk-kpi > b{display:block;font-size:26px;line-height:1.15}.stk-kpi small{color:var(--muted);font-size:12px}
.stk-bar{display:flex;height:16px;border-radius:8px;overflow:hidden;background:var(--line)}.stk-bar i{display:block;height:100%}
.stk-leg{display:flex;gap:12px;flex-wrap:wrap;font-size:12px;margin-top:6px}.stk-leg span{display:inline-flex;gap:5px;align-items:center}.stk-leg i{width:10px;height:10px;border-radius:3px;display:inline-block}
.stk-st{display:inline-block;border-radius:20px;padding:2px 10px;font-size:12px;font-weight:600;white-space:nowrap}
.stk-tbl td{vertical-align:middle}.stk-tbl .ic{font-size:20px;width:30px;text-align:center}
.stk-bulk{position:sticky;bottom:80px;z-index:20;background:var(--navy);color:#fff;border-radius:12px;padding:10px 12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px;box-shadow:0 6px 20px rgba(0,0,0,.25)}
.stk-bulk .btn{margin:0}
.stk-head{display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap}
.stk-av{width:88px;height:88px;border-radius:14px;background:#EEF2F8;display:grid;place-items:center;font-size:38px;overflow:hidden;flex:none}
.stk-av img{width:100%;height:100%;object-fit:cover}
.stk-head h1{margin:0;font-size:24px;letter-spacing:.2px}.stk-sub{color:var(--muted);font-size:14px;margin:4px 0 8px;display:flex;gap:12px;flex-wrap:wrap}
.stk-tabs{display:flex;gap:2px;border-bottom:1px solid var(--line);overflow-x:auto;margin:14px -4px 0}
.stk-tabs button{background:none;border:0;padding:10px 12px;font-size:14px;color:var(--muted);cursor:pointer;border-bottom:3px solid transparent;white-space:nowrap}
.stk-tabs button.on{color:var(--navy);font-weight:700;border-bottom-color:#5B5BD6}
.stk-fil{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 14px}.stk-fil button{background:#fff;border:1px solid var(--line);border-radius:10px;padding:8px 12px;font-size:13px;cursor:pointer;display:inline-flex;gap:6px;align-items:center}
.stk-fil button.on{border:2px solid #5B5BD6;color:#3B3BB0;font-weight:700}
.stk-fil select{width:auto;padding:7px 10px;border-radius:10px}
.stk-month{font-size:16px;margin:16px 0 8px;font-weight:600}
.stk-ev{display:flex;gap:14px;padding:14px 16px;background:#fff;border-bottom:1px solid var(--line)}.stk-ev:first-of-type{border-radius:12px 12px 0 0}.stk-ev:last-child{border-radius:0 0 12px 12px;border-bottom:0}
.stk-evs{border-radius:12px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,.06)}
.stk-evi{width:34px;height:34px;border-radius:9px;background:#ECEBFB;display:grid;place-items:center;flex:none;font-size:16px}
.stk-evd{font-size:13px;color:var(--muted)}.stk-evt{font-size:16px;margin:2px 0}.stk-evc{font-size:14px;display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.stk-evc s{color:var(--muted)}.stk-evc a{color:#3B3BB0}
.stk-dl{display:grid;grid-template-columns:minmax(140px,220px) 1fr;gap:8px 16px;margin:0}.stk-dl dt{color:var(--muted)}.stk-dl dd{margin:0;word-break:break-word}
.stk-imgs{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px}.stk-imgs .th{position:relative;aspect-ratio:1;border-radius:10px;overflow:hidden;background:var(--line)}
.stk-imgs img{width:100%;height:100%;object-fit:cover;cursor:zoom-in}
.stk-places{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}
.stk-place{background:#fff;border-radius:12px;padding:14px;box-shadow:0 1px 2px rgba(0,0,0,.06);border-top:4px solid #0E7490}
.stk-place .n{display:flex;gap:16px;margin:10px 0}.stk-place .n b{display:block;font-size:20px}.stk-place .n span{font-size:12px;color:var(--muted)}
.stk-kinds{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin:8px 0}
.stk-kinds button{background:#fff;border:2px solid var(--line);border-radius:12px;padding:10px;cursor:pointer;text-align:center;font-size:13px}
.stk-kinds button b{display:block;font-size:24px;margin-bottom:4px}.stk-kinds button.on{border-color:var(--navy);background:#EEF2F8}
.stk-lbls{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px}.stk-lbl{border:1px dashed #999;border-radius:8px;padding:8px;text-align:center;background:#fff;break-inside:avoid}
.stk-lbl svg{width:120px;height:120px}.stk-lbl b{display:block;font-size:13px}.stk-lbl small{font-size:11px;color:#444}
.stk-ex{display:grid;grid-template-columns:1fr 1fr auto;gap:6px;margin-top:6px}
.stk-scan{position:relative;border-radius:14px;overflow:hidden;background:#000;aspect-ratio:3/4;max-height:60vh;margin:0 auto}.stk-scan video{width:100%;height:100%;object-fit:cover;display:block}
@media print{body.stk-printing > *:not(#stk-print){display:none!important}#stk-print{display:block!important}}
#stk-print{display:none}
@media (max-width:640px){.stk-dl{grid-template-columns:1fr}.stk-dl dt{margin-top:6px}.stk-head h1{font-size:20px}.stk-hide-m{display:none}}`;
  document.head.appendChild(s);
}

/* ---------- utilidades ---------- */
const stkCan = (l = 2) => typeof can === 'function' && can('stock', l) && canWrite() && online();
const stkNorm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
function stkStCol(s){
  const x = stkNorm(s);
  if (/activ|instal|disponib|funciona|ok/.test(x)) return ['#DCFCE7', '#166534'];
  if (/stock|asignad|deposit|nuevo/.test(x)) return ['#DBEAFE', '#1E40AF'];
  if (/repar|calibr|revis|garant/.test(x)) return ['#FEF3C7', '#92400E'];
  if (/dan|baja|rob|perd|rot|vencid/.test(x)) return ['#FEE2E2', '#991B1B'];
  return ['#E5E7EB', '#374151'];
}
const stkStPill = s => { const [b, c] = stkStCol(s); return `<span class="stk-st" style="background:${b};color:${c}">${esc(s || '—')}</span>`; };
function stkLoc(a){
  const B = STK.base;
  if (a.place_id){ const p = B.placeById.get(a.place_id); const k = STK_PLACE_KIND[p?.kind] || STK_PLACE_KIND.otro; return { ic: k[0], name: p ? p.name : 'Lugar', href: '#/stock/l/' + a.place_id, closed: p && !p.active }; }
  if (a.site_id){ const s = B.siteById.get(a.site_id); return { ic: '📍', name: s ? s.name : 'Sitio', href: '#/stock/s/' + a.site_id }; }
  return { ic: '❔', name: 'Sin lugar', href: null };
}
const stkHolder = a => a.holder_staff_id ? (STK.base.staffById.get(a.holder_staff_id)?.name || 'Persona') : null;
const stkProjName = id => id ? (STK.base.projById.get(id)?.name || 'Proyecto') : 'Stock general';
const stkFmtQty = n => { const x = Math.round(Number(n || 0) * 100) / 100; return x.toLocaleString('es-AR'); };
const stkDate = s => s ? fmtD(s) : '—';
function stkCfg(){ const c = STK.base?.cfg || {}; return { st_equipo: c.st_equipo?.length ? c.st_equipo : STK_DEF_CFG.st_equipo, st_herr: c.st_herr?.length ? c.st_herr : STK_DEF_CFG.st_herr, owners: c.owners?.length ? c.owners : STK_DEF_CFG.owners }; }
const stkStatuses = cat => cat === 'herramienta' ? stkCfg().st_herr : stkCfg().st_equipo;
const stkOpt = (list, cur) => list.map(x => `<option value="${esc(x)}" ${x === cur ? 'selected' : ''}>${esc(x)}</option>`).join('');
function stkInval(){ for (const k of ['stk-assets', 'stk-places', 'stk-items', 'stk-moves']) IDB.del('kv', CUR_UID + ':' + k).catch(() => {}); STK.base = null; }

async function stkLoadBase(force){
  if (STK.base && !force) return STK.base;
  const [places, projects, sites, items, moves, assets, cfgRow] = await Promise.all([
    cached('stk-places', () => sb.from('stock_places').select('*').order('name')).catch(() => []),
    loadProjects().catch(() => []),
    loadSitesMap().catch(() => []),
    cached('stk-items', () => sb.from('stock_items').select('*').order('name')).catch(() => []),
    cached('stk-moves', () => pageAll(() => sb.from('stock_moves').select('*').order('at').order('id'))).catch(() => []),
    cached('stk-assets', () => pageAll(() => sb.from('assets').select('*').order('code').order('id'))),
    cached('stk-cfg', () => sb.from('org_settings').select('stock_cfg').eq('org_id', me.org_id).maybeSingle()).catch(() => null),
    (async () => { try { if (typeof hhLoadBase === 'function' && !(HHS.staff || []).length) await hhLoadBase(); } catch {} })()]);
  const staff = (typeof HHS !== 'undefined' && HHS.staff) || [];
  STK.base = { places, projects, sites, items, moves, assets, cfg: cfgRow?.stock_cfg || null, staff,
    placeById: new Map(places.map(p => [p.id, p])), projById: new Map(projects.map(p => [p.id, p])), siteById: new Map(sites.map(s => [s.id, s])),
    staffById: new Map(staff.map(s => [s.id, s])), itemById: new Map(items.map(i => [i.id, i])) };
  return STK.base;
}
// saldo de materiales por material · stock (general / proyecto) · lugar
function stkBalances(){
  const m = new Map(), key = (i, p, l) => `${i}|${p || ''}|${l}`;
  const add = (i, p, l, q) => { const k = key(i, p, l); m.set(k, (m.get(k) || 0) + q); };
  for (const x of STK.base.moves){ if (x.to_place) add(x.item_id, x.to_project, x.to_place, Number(x.qty)); if (x.from_place) add(x.item_id, x.from_project, x.from_place, -Number(x.qty)); }
  return [...m.entries()].filter(([, q]) => Math.abs(q) > 1e-9).map(([k, q]) => { const [item, project, place] = k.split('|'); return { item, project: project || null, place, qty: q }; });
}

/* ---------- ruteo: #/stock · #/stock/p/<proyecto> · #/stock/a/<activo> · #/stock/l/<lugar> · #/stock/s/<sitio> · #/stock/m/<material> ---------- */
async function viewStock(v, sub, id){
  stkCss();
  if (id && !STK_UUID.test(id)) { location.hash = '#/stock'; return; }
  await stkLoadBase(true);
  if (sub === 'a' && id) return stkAsset(v, id);
  let scope = { kind: 'gen' };
  if (sub === 'p' && id){ if (!STK.base.projById.has(id)) throw new Error('No se encontró el proyecto (o no tenés acceso).'); scope = { kind: 'prj', id }; }
  else if (sub === 'l' && id) scope = { kind: 'place', id };
  else if (sub === 's' && id) scope = { kind: 'site', id };
  else if (sub === 'm' && id){ STK.tab = 'mat'; STK.openItem = id; }
  STK.sel.clear();
  return stkList(v, scope);
}
const stkInScope = (a, sc) => sc.kind === 'gen' ? !a.project_id : sc.kind === 'prj' ? a.project_id === sc.id : sc.kind === 'place' ? a.place_id === sc.id : sc.kind === 'site' ? a.site_id === sc.id : true;
const stkScopeProj = sc => sc.kind === 'prj' ? sc.id : null;

function stkScopeHead(sc){
  const B = STK.base, pj = B.projects.filter(p => p.active);
  const sel = `<select id="stk-sw"><option value="gen" ${sc.kind === 'gen' ? 'selected' : ''}>🏢 Stock general</option>${pj.map(p => `<option value="${p.id}" ${sc.kind === 'prj' && sc.id === p.id ? 'selected' : ''}>📁 ${esc(p.name)}</option>`).join('')}</select>`;
  if (sc.kind === 'gen') return `<div class="stk-scope gen"><div class="big">🏢</div><div style="flex:1;min-width:200px"><h1>Stock general de la empresa</h1><p>Lo que no está reservado para ningún proyecto. Para pasarlo a un proyecto usá <b>Asignar a proyecto</b>.</p></div>${sel}</div>`;
  if (sc.kind === 'prj') return `<div class="stk-scope prj"><div class="big">📁</div><div style="flex:1;min-width:200px"><h1>Stock del proyecto · ${esc(stkProjName(sc.id))}</h1><p>Reservado para este proyecto. Lo que sobra vuelve con <b>Devolver al stock general</b>.</p></div>${sel}<a class="btn sec small" href="#/proj/${sc.id}" style="margin:0">Ver proyecto</a></div>`;
  if (sc.kind === 'place'){ const p = B.placeById.get(sc.id); const k = STK_PLACE_KIND[p?.kind] || STK_PLACE_KIND.otro;
    return `<div class="stk-scope all"><div class="big">${k[0]}</div><div style="flex:1;min-width:200px"><h1>${esc(p?.name || 'Lugar')}${p && !p.active ? ' (desarmado)' : ''}</h1><p>${k[1]}${p?.address ? ' · ' + esc(p.address) : ''} · todo lo que hay acá, del stock general y de los proyectos.</p></div><a class="btn sec small" href="#/stock" style="margin:0">← Stock</a></div>`; }
  const s = B.siteById.get(sc.id);
  return `<div class="stk-scope all"><div class="big">📍</div><div style="flex:1;min-width:200px"><h1>${esc(s?.name || 'Sitio')}</h1><p>Equipos y herramientas que están en este sitio.</p></div><a class="btn sec small" href="#/stock" style="margin:0">← Stock</a></div>`;
}

function stkList(v, sc){
  const B = STK.base, list = B.assets.filter(a => !a.archived && stkInScope(a, sc));
  const eq = list.filter(a => a.cat === 'equipo'), tl = list.filter(a => a.cat === 'herramienta');
  const pid = stkScopeProj(sc), bal = stkBalances().filter(b => sc.kind === 'gen' ? !b.project : sc.kind === 'prj' ? b.project === sc.id : sc.kind === 'place' ? b.place === sc.id : false);
  const low = B.items.filter(i => i.active && i.min_qty != null && bal.filter(b => b.item === i.id).reduce((s, b) => s + b.qty, 0) < Number(i.min_qty) && (sc.kind !== 'site'));
  const today = todayStr(), soon = addDays(today, 30);
  const calib = tl.filter(a => a.service_due && a.service_due <= soon);
  const stCount = arr => { const m = new Map(); arr.forEach(a => m.set(a.status, (m.get(a.status) || 0) + 1)); return [...m.entries()].sort((a, b) => b[1] - a[1]); };
  const bar = arr => { const sc2 = stCount(arr), tot = arr.length || 1;
    return arr.length ? `<div class="stk-bar">${sc2.map(([s, n]) => `<i style="width:${n * 100 / tot}%;background:${stkStCol(s)[1]}" title="${esc(s)}: ${n}"></i>`).join('')}</div><div class="stk-leg">${sc2.map(([s, n]) => `<span><i style="background:${stkStCol(s)[1]}"></i>${esc(s)} <b>${n}</b></span>`).join('')}</div>` : '<div class="muted sm">Todavía no hay.</div>'; };
  const byPlace = new Map(); eq.concat(tl).forEach(a => { const l = stkLoc(a); byPlace.set(l.name, (byPlace.get(l.name) || 0) + 1); });
  const tabs = [['eq', `📡 Equipos (${eq.length})`], ['tl', `🧰 Herramientas (${tl.length})`], ['mat', `🧵 Materiales`], ...(['gen', 'prj'].includes(sc.kind) ? [['pl', '🏬 Lugares']] : [])];
  if (!tabs.some(t => t[0] === STK.tab)) STK.tab = 'eq';
  v.innerHTML = `${stkScopeHead(sc)}
    <div class="stk-kpis">
      <div class="stk-kpi"><span>📡 Equipos</span><b>${eq.length}</b><small>${eq.filter(a => /instal|activ/i.test(a.status)).length} instalados / activos</small></div>
      <div class="stk-kpi" style="border-left-color:#1E40AF"><span>📦 En stock</span><b>${eq.filter(a => /stock/i.test(a.status)).length}</b><small>listos para usar</small></div>
      <div class="stk-kpi" style="border-left-color:#991B1B"><span>⚠ Dañados / baja</span><b style="color:${eq.some(a => /dañ|dan|baja/i.test(a.status)) ? 'var(--red)' : 'inherit'}">${eq.filter(a => stkStCol(a.status)[1] === '#991B1B').length}</b><small>a revisar</small></div>
      <div class="stk-kpi" style="border-left-color:#92400E"><span>🧰 Herramientas</span><b>${tl.length}</b><small>${tl.filter(a => a.holder_staff_id).length} asignadas${calib.length ? ` · <b style="color:var(--red)">${calib.length} por calibrar</b>` : ''}</small></div>
      ${sc.kind !== 'site' ? `<div class="stk-kpi" style="border-left-color:#0E7490"><span>🧵 Materiales</span><b>${new Set(bal.filter(b => b.qty > 0).map(b => b.item)).size}</b><small>${low.length ? `<b style="color:var(--red)">${low.length} bajo el mínimo</b>` : 'con saldo'}</small></div>` : ''}
    </div>
    <div class="chart-grid" style="margin-bottom:12px">
      <div class="card"><h2 style="margin-top:0">Equipos por estado</h2>${bar(eq)}${tl.length ? `<h2 style="margin:14px 0 6px">Herramientas por estado</h2>${bar(tl)}` : ''}</div>
      <div class="card"><h2 style="margin-top:0">¿Dónde está?</h2>${byPlace.size ? chartHBars([...byPlace.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([l, n]) => ({ label: l, v: n, c: '#5B5BD6' }))) : '<div class="muted sm">Todavía no hay activos.</div>'}</div>
    </div>
    <div class="card"><div class="seg" id="stk-tabs">${tabs.map(([k, t]) => `<button data-st="${k}" class="${STK.tab === k ? 'on' : ''}">${t}</button>`).join('')}</div><div id="stk-body" style="margin-top:12px"></div></div>`;
  bindTips(v);
  $('#stk-sw')?.addEventListener('change', e => { location.hash = e.target.value === 'gen' ? '#/stock' : '#/stock/p/' + e.target.value; });
  const body = $('#stk-body');
  const show = k => { STK.tab = k; STK.sel.clear(); $$('#stk-tabs [data-st]').forEach(b => b.classList.toggle('on', b.dataset.st === k));
    if (k === 'eq' || k === 'tl') stkAssetsTab(body, sc, k === 'eq' ? 'equipo' : 'herramienta');
    else if (k === 'mat') stkMatTab(body, sc);
    else stkPlacesTab(body, sc); };
  $$('#stk-tabs [data-st]').forEach(b => b.onclick = () => show(b.dataset.st));
  show(STK.tab);
}

/* ---------- pestaña de equipos / herramientas ---------- */
function stkAssetsTab(box, sc, cat){
  const B = STK.base, all = B.assets.filter(a => !a.archived && a.cat === cat && stkInScope(a, sc));
  const types = [...new Set(all.map(a => a.type))].sort((a, b) => a.localeCompare(b, 'es'));
  const sts = [...new Set(all.map(a => a.status))];
  const locs = [...new Map(all.map(a => { const l = stkLoc(a); return [l.name, l]; })).values()];
  const w = stkCan(2), C = STK_CAT[cat];
  const draw = () => {
    const q = stkNorm(STK.q);
    const rows = all.filter(a => (!STK.fType || a.type === STK.fType) && (!STK.fStatus || a.status === STK.fStatus) && (!STK.fPlace || stkLoc(a).name === STK.fPlace)
      && (!q || stkNorm([a.code, a.name, a.type, a.vendor, a.model, a.ext_id, a.notes, stkLoc(a).name, stkHolder(a), ...Object.values(a.extra || {})].join(' ')).includes(q)));
    const shown = rows.slice(0, 500);
    $('#stk-rows').innerHTML = shown.length ? shown.map(a => { const l = stkLoc(a), h = stkHolder(a);
      return `<tr class="click" data-a="${a.id}">${w ? `<td style="width:28px"><input type="checkbox" data-ck="${a.id}" ${STK.sel.has(a.id) ? 'checked' : ''} aria-label="Elegir"></td>` : ''}
        <td class="ic">${C[0]}</td><td><b>${esc(a.name || a.type)}</b><div class="muted sm">${esc(a.code)}${a.vendor || a.model ? ' · ' + esc([a.vendor, a.model].filter(Boolean).join(' ')) : ''}</div></td>
        <td class="stk-hide-m">${esc(a.type)}</td><td>${stkStPill(a.status)}${cat === 'herramienta' && a.service_due && a.service_due <= addDays(todayStr(), 30) ? `<div class="sm" style="color:var(--red)">Calibrar ${stkDate(a.service_due)}</div>` : ''}</td>
        <td class="sm">${l.ic} ${esc(l.name)}${h ? `<div class="muted">👷 ${esc(h)}</div>` : ''}${['place', 'site'].includes(sc.kind) ? `<div class="muted">${a.project_id ? '📁 ' + esc(stkProjName(a.project_id)) : '🏢 General'}</div>` : ''}</td></tr>`; }).join('')
      : `<tr><td colspan="6"><div class="empty">${all.length ? 'Nada coincide con la búsqueda.' : `Todavía no hay ${C[2].toLowerCase()} acá.${w ? ` Cargá el primero con <b>+ ${C[1]}</b> o importá un Excel.` : ''}`}</div></td></tr>`;
    $('#stk-n').textContent = rows.length > shown.length ? `Mostrando ${shown.length} de ${rows.length}` : `${rows.length} ${rows.length === 1 ? C[1].toLowerCase() : C[2].toLowerCase()}`;
    box.querySelectorAll('[data-a]').forEach(tr => tr.onclick = e => { if (e.target.closest('[data-ck]')) return; location.hash = '#/stock/a/' + tr.dataset.a; });
    box.querySelectorAll('[data-ck]').forEach(c => c.onchange = () => { c.checked ? STK.sel.add(c.dataset.ck) : STK.sel.delete(c.dataset.ck); bulk(); });
    STK.rows = rows;
  };
  const bulk = () => {
    const n = STK.sel.size, el = $('#stk-bulk');
    if (!n){ el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    el.innerHTML = `<b>${n} elegido${n === 1 ? '' : 's'}</b><button class="btn small" data-bk="mv">📍 Cambiar lugar</button><button class="btn small" data-bk="st">🔄 Cambiar estado</button>
      ${sc.kind === 'gen' ? '<button class="btn small" data-bk="pj">📁 Asignar a proyecto</button>' : ''}${sc.kind === 'prj' ? '<button class="btn small" data-bk="gen">🏢 Devolver al stock general</button>' : ''}
      <button class="btn small sec" data-bk="qr">🏷️ Etiquetas QR</button><button class="btn small sec" data-bk="x">✕</button>`;
    el.querySelectorAll('[data-bk]').forEach(b => b.onclick = () => {
      const ids = [...STK.sel], k = b.dataset.bk;
      if (k === 'x'){ STK.sel.clear(); draw(); bulk(); return; }
      if (k === 'qr') return stkLabels(B.assets.filter(a => ids.includes(a.id)));
      stkBulkModal(k, ids, sc);
    });
  };
  box.innerHTML = `
    <div class="row between" style="gap:8px;flex-wrap:wrap">
      <div class="row" style="gap:8px;flex-wrap:wrap;flex:1">
        <input id="stk-q" placeholder="🔍 Buscar por ID, nombre, modelo, lugar…" value="${esc(STK.q)}" style="max-width:300px">
        <select id="stk-ft" style="width:auto"><option value="">Todos los tipos</option>${stkOpt(types, STK.fType)}</select>
        <select id="stk-fs" style="width:auto"><option value="">Todos los estados</option>${stkOpt(sts, STK.fStatus)}</select>
        <select id="stk-fp" style="width:auto"><option value="">Todos los lugares</option>${locs.map(l => `<option value="${esc(l.name)}" ${l.name === STK.fPlace ? 'selected' : ''}>${l.ic} ${esc(l.name)}</option>`).join('')}</select>
        <button class="btn sec small" id="stk-scan" title="Escanear QR o código de barras" style="margin:0">📷</button>
      </div>
      <div class="row" style="gap:6px;flex-wrap:wrap">
        ${w && ['gen', 'prj'].includes(sc.kind) ? `<button class="btn" id="stk-new" style="margin:0">+ ${C[1]}</button><label class="btn sec" style="margin:0">⬆ Importar Excel<input type="file" accept=".xlsx,.xls,.csv" id="stk-imp" class="hidden"></label>` : ''}
        <button class="btn sec" id="stk-exp" style="margin:0">⬇ Exportar</button>
      </div>
    </div>
    <div class="muted sm" id="stk-n" style="margin:8px 0"></div>
    <div class="tblwrap"><table class="tbl stk-tbl"><thead><tr>${w ? `<th><input type="checkbox" id="stk-all" aria-label="Elegir todos"></th>` : ''}<th></th><th>Nombre / ID único</th><th class="stk-hide-m">Tipo</th><th>Estado</th><th>Dónde está</th></tr></thead><tbody id="stk-rows"></tbody></table></div>
    <div class="stk-bulk hidden" id="stk-bulk"></div>`;
  let tq = null;
  $('#stk-q').oninput = e => { STK.q = e.target.value; clearTimeout(tq); tq = setTimeout(draw, 150); };
  $('#stk-ft').onchange = e => { STK.fType = e.target.value; draw(); };
  $('#stk-fs').onchange = e => { STK.fStatus = e.target.value; draw(); };
  $('#stk-fp').onchange = e => { STK.fPlace = e.target.value; draw(); };
  $('#stk-all')?.addEventListener('change', e => { (STK.rows || []).slice(0, 500).forEach(a => e.target.checked ? STK.sel.add(a.id) : STK.sel.delete(a.id)); draw(); bulk(); });
  $('#stk-scan').onclick = () => stkScan(txt => { const m = /#\/stock\/a\/([0-9A-Za-z-]{1,40})/.exec(txt); if (m){ location.hash = '#/stock/a/' + m[1]; return; }
    const hit = B.assets.find(a => stkNorm(a.code) === stkNorm(txt)); if (hit){ location.hash = '#/stock/a/' + hit.id; return; }
    STK.q = txt; $('#stk-q').value = txt; draw(); toast('No hay un activo con ese ID: lo busqué en la lista.'); });
  $('#stk-new')?.addEventListener('click', () => stkEdit(null, { cat, project_id: stkScopeProj(sc) }));
  $('#stk-imp')?.addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) stkImport(f, sc, cat); });
  $('#stk-exp').onclick = () => stkExport(all, sc, cat);
  draw(); bulk();
}

/* ---------- ficha (alta / edición) ---------- */
function stkLocOptions(cur){
  const B = STK.base, pl = B.places.filter(p => p.active || p.id === cur.place_id);
  return `<option value="">— Sin lugar —</option>
    <optgroup label="Depósitos, bases y vehículos">${pl.map(p => `<option value="p:${p.id}" ${cur.place_id === p.id ? 'selected' : ''}>${(STK_PLACE_KIND[p.kind] || STK_PLACE_KIND.otro)[0]} ${esc(p.name)}${p.project_id ? ' · ' + esc(stkProjName(p.project_id)) : ''}</option>`).join('')}</optgroup>
    <optgroup label="Sitios (instalado en)">${B.sites.slice(0, 3000).map(s => `<option value="s:${s.id}" ${cur.site_id === s.id ? 'selected' : ''}>📍 ${esc(s.name)}${s.localidad && s.localidad !== s.name ? ' · ' + esc(s.localidad) : ''}</option>`).join('')}</optgroup>`;
}
function stkEdit(a, preset = {}){
  const B = STK.base, isNew = !a, cur = a || { cat: preset.cat || 'equipo', project_id: preset.project_id || null, status: (preset.cat === 'herramienta' ? stkCfg().st_herr : stkCfg().st_equipo)[0], extra: {} };
  let cat = cur.cat;
  const uniq = k => [...new Set(B.assets.map(x => x[k]).filter(Boolean))].sort((x, y) => x.localeCompare(y, 'es'));
  const models = vendor => [...new Set(B.assets.filter(x => !vendor || stkNorm(x.vendor) === stkNorm(vendor)).map(x => x.model).filter(Boolean))].sort();
  const extraRows = Object.entries(cur.extra || {});
  const m = modal(`<h2>${isNew ? '+ Nuevo activo' : 'Editar activo'}</h2>
    <div class="stk-kinds" style="grid-template-columns:1fr 1fr">${Object.entries(STK_CAT).map(([k, c]) => `<button type="button" data-cat="${k}" class="${cat === k ? 'on' : ''}"><b>${c[0]}</b>${c[1]}</button>`).join('')}</div>
    <label>Tipo <span class="muted">(obligatorio)</span></label><input id="se-type" list="se-types" maxlength="80" value="${esc(cur.type || '')}" placeholder="Ej.: AP Outdoor, Antena Satelital, OTDR">
    <datalist id="se-types">${uniq('type').map(x => `<option value="${esc(x)}">`).join('')}</datalist>
    <label>ID único <span class="muted">(obligatorio)</span></label><div class="row" style="gap:6px;flex-wrap:nowrap"><input id="se-code" maxlength="120" value="${esc(cur.code || '')}" placeholder="Número de serie o código" style="flex:1"><button type="button" class="btn sec" id="se-scan" style="margin:0" title="Escanear">📷</button></div>
    <label>Estado</label><select id="se-st"></select>
    <label>Site Name <span class="muted">(dónde está)</span></label><select id="se-loc">${stkLocOptions(cur)}</select>
    <div id="se-holdw"><label>Responsable <span class="muted">(quién la tiene)</span></label><select id="se-hold"><option value="">— Nadie —</option>${B.staff.filter(s => s.active || s.id === cur.holder_staff_id).map(s => `<option value="${s.id}" ${s.id === cur.holder_staff_id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
    <hr style="border:0;border-top:1px solid var(--line);margin:16px 0">
    <label>Nombre mostrado</label><input id="se-name" maxlength="200" value="${esc(cur.name || '')}" placeholder="Ej.: ACCESS POINT MERAKI WI-FI 6 OUTDOOR AP">
    <div class="grid2c" style="display:grid;grid-template-columns:1fr 1fr;gap:0 10px">
      <div><label>Vendor</label><input id="se-vendor" list="se-vendors" maxlength="80" value="${esc(cur.vendor || '')}"><datalist id="se-vendors">${uniq('vendor').map(x => `<option value="${esc(x)}">`).join('')}</datalist></div>
      <div><label>Models</label><input id="se-model" list="se-models" maxlength="80" value="${esc(cur.model || '')}"><datalist id="se-models"></datalist></div>
      <div><label>Fecha de Activación</label><input type="date" id="se-act" value="${esc(cur.activated_on || '')}"></div>
      <div><label>Fecha de Desactivación</label><input type="date" id="se-deact" value="${esc(cur.deactivated_on || '')}"></div>
    </div>
    <div id="se-calw"><label>Vence la calibración / service</label><input type="date" id="se-cal" value="${esc(cur.service_due || '')}"></div>
    <label>Propiedad</label><select id="se-own"><option value="">—</option>${stkOpt([...new Set([...stkCfg().owners, ...(cur.owner ? [cur.owner] : [])])], cur.owner)}</select>
    <label>Comentarios</label><textarea id="se-notes" maxlength="1000" placeholder="Ej.: Entró agua. Se reemplazó. Sin garantía">${esc(cur.notes || '')}</textarea>
    <label>Stock</label><select id="se-proj"><option value="">🏢 Stock general de la empresa</option>${B.projects.filter(p => p.active || p.id === cur.project_id).map(p => `<option value="${p.id}" ${p.id === cur.project_id ? 'selected' : ''}>📁 Proyecto ${esc(p.name)}</option>`).join('')}</select>
    <label>Campos adicionales <span class="muted">(ej.: Número de serie de antena)</span></label><div id="se-ex">${extraRows.map(([k, x]) => stkExRow(k, x)).join('')}</div>
    <button type="button" class="link" id="se-exadd">+ Agregar campo</button>
    <div class="err" id="se-err"></div>
    <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn sec" id="se-x">Cancelar</button><button class="btn" id="se-ok">${isNew ? 'Crear activo' : 'Guardar'}</button></div>`, { wide: true });
  const paint = () => {
    m.el.querySelectorAll('[data-cat]').forEach(b => b.classList.toggle('on', b.dataset.cat === cat));
    const st = $('#se-st'), curSt = st.value || cur.status; const list = stkStatuses(cat); st.innerHTML = stkOpt([...new Set([...list, ...(curSt ? [curSt] : [])])], list.includes(curSt) || curSt === cur.status ? curSt : list[0]);
    $('#se-holdw').classList.toggle('hidden', cat !== 'herramienta' && !cur.holder_staff_id); $('#se-calw').classList.toggle('hidden', cat !== 'herramienta');
  };
  const fillModels = () => { $('#se-models').innerHTML = models($('#se-vendor').value).map(x => `<option value="${esc(x)}">`).join(''); };
  m.el.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => { cat = b.dataset.cat; $('#se-st').value = ''; paint(); });
  $('#se-vendor').oninput = fillModels; fillModels(); paint();
  $('#se-scan').onclick = () => stkScan(t => { $('#se-code').value = String(t).slice(0, 120); });
  $('#se-exadd').onclick = () => { if (m.el.querySelectorAll('.stk-ex').length >= 20) return; $('#se-ex').insertAdjacentHTML('beforeend', stkExRow('', '')); bindEx(); };
  const bindEx = () => m.el.querySelectorAll('[data-exrm]').forEach(b => b.onclick = () => b.closest('.stk-ex').remove()); bindEx();
  $('#se-x').onclick = m.close;
  $('#se-ok').onclick = async () => {
    const err = $('#se-err'); err.textContent = '';
    const code = $('#se-code').value.trim(), type = $('#se-type').value.trim();
    if (!type) return void (err.textContent = 'Falta el tipo.');
    if (!code) return void (err.textContent = 'Falta el ID único.');
    const dup = B.assets.find(x => stkNorm(x.code) === stkNorm(code) && x.id !== cur.id);
    if (dup) return void (err.textContent = `Ya existe un activo con ese ID único (${dup.name || dup.type}).`);
    const loc = $('#se-loc').value, extra = {};
    m.el.querySelectorAll('.stk-ex').forEach(r => { const k = r.querySelector('[data-exk]').value.trim(), x = r.querySelector('[data-exv]').value.trim(); if (k) extra[k.slice(0, 60)] = x.slice(0, 200); });
    const row = { cat, type, code, status: $('#se-st').value, name: $('#se-name').value.trim() || null, vendor: $('#se-vendor').value.trim() || null, model: $('#se-model').value.trim() || null,
      activated_on: $('#se-act').value || null, deactivated_on: $('#se-deact').value || null, service_due: cat === 'herramienta' ? ($('#se-cal').value || null) : null,
      owner: $('#se-own').value || null, notes: $('#se-notes').value.trim() || null, project_id: $('#se-proj').value || null,
      place_id: loc.startsWith('p:') ? loc.slice(2) : null, site_id: loc.startsWith('s:') ? loc.slice(2) : null, holder_staff_id: $('#se-hold').value || null, extra };
    $('#se-ok').disabled = true;
    try {
      const r = isNew ? await sb.from('assets').insert({ ...row, org_id: me.org_id }).select('id').single() : await sb.from('assets').update(row).eq('id', cur.id).select('id').single();
      if (r.error) throw r.error;
      m.close(); stkInval(); toast(isNew ? 'Activo creado' : 'Cambios guardados');
      if (isNew) location.hash = '#/stock/a/' + r.data.id; else route();
    } catch (e){ err.textContent = /assets_code|duplicate/.test(e.message || '') ? 'Ya existe un activo con ese ID único.' : errText(e); $('#se-ok').disabled = false; }
  };
}
const stkExRow = (k, x) => `<div class="stk-ex"><input data-exk maxlength="60" placeholder="Campo" value="${esc(k)}"><input data-exv maxlength="200" placeholder="Valor" value="${esc(x)}"><button type="button" class="btn sec small" data-exrm style="margin:0" title="Quitar">✕</button></div>`;

/* ---------- cambios en lote ---------- */
function stkBulkModal(k, ids, sc){
  const B = STK.base, list = B.assets.filter(a => ids.includes(a.id));
  const cats = [...new Set(list.map(a => a.cat))];
  const title = { mv: '📍 Cambiar lugar', st: '🔄 Cambiar estado', pj: '📁 Asignar a proyecto', gen: '🏢 Devolver al stock general' }[k];
  const body = k === 'mv' ? `<label>Nuevo lugar</label><select id="bk-v">${stkLocOptions({})}</select>`
    : k === 'st' ? `<label>Nuevo estado</label><select id="bk-v">${stkOpt([...new Set(cats.flatMap(stkStatuses))], '')}</select>`
    : k === 'pj' ? `<label>Proyecto</label><select id="bk-v">${B.projects.filter(p => p.active).map(p => `<option value="${p.id}">📁 ${esc(p.name)}</option>`).join('')}</select><p class="muted sm">Pasan del stock general al stock reservado del proyecto. Queda registrado en el historial de cada uno.</p>`
    : `<p>Los ${list.length} activos vuelven al <b>stock general de la empresa</b>. Queda registrado en el historial de cada uno.</p>`;
  const m = modal(`<h2>${title}</h2><p class="muted sm">${list.length} activo${list.length === 1 ? '' : 's'}: ${list.slice(0, 6).map(a => esc(a.code)).join(', ')}${list.length > 6 ? '…' : ''}</p>${body}
    <div class="err" id="bk-err"></div><div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn sec" id="bk-x">Cancelar</button><button class="btn" id="bk-ok">Aplicar</button></div>`);
  $('#bk-x').onclick = m.close;
  $('#bk-ok').onclick = async () => {
    const val = $('#bk-v')?.value || null;
    let patch;
    if (k === 'mv') patch = { place_id: val?.startsWith('p:') ? val.slice(2) : null, site_id: val?.startsWith('s:') ? val.slice(2) : null };
    else if (k === 'st') patch = { status: val };
    else if (k === 'pj'){ if (!val) return; patch = { project_id: val }; }
    else patch = { project_id: null };
    $('#bk-ok').disabled = true;
    try {
      for (let i = 0; i < ids.length; i += 100){ const { error } = await sb.from('assets').update(patch).in('id', ids.slice(i, i + 100)); if (error) throw error; }
      m.close(); STK.sel.clear(); stkInval(); toast('Listo: ' + ids.length + ' actualizado' + (ids.length === 1 ? '' : 's')); route();
    } catch (e){ $('#bk-err').textContent = errText(e); $('#bk-ok').disabled = false; }
  };
}

/* ---------- pantalla del activo ---------- */
const STK_ATABS = [['res', 'Resumen'], ['act', 'Actividad'], ['det', 'Detalles'], ['doc', 'Documentos'], ['img', 'Imágenes'], ['mant', 'Mantenimiento'], ['uso', 'Uso']];
async function stkAsset(v, id){
  const B = STK.base, a = B.assets.find(x => x.id === id);
  if (!a) throw new Error('No se encontró el activo (o no tenés acceso).');
  const w = stkCan(2), C = STK_CAT[a.cat] || STK_CAT.equipo, l = stkLoc(a), back = a.project_id ? '#/stock/p/' + a.project_id : '#/stock';
  let evs = [];
  try { evs = await cached('stk-ev:' + id, () => sb.from('asset_events').select('*').eq('asset_id', id).order('at', { ascending: false }).limit(1000)); } catch {}
  const ctx = { a, evs, w };
  v.innerHTML = `
    <div class="row" style="gap:8px;margin-bottom:10px;font-size:15px"><a href="${back}" style="text-decoration:none">←</a><a href="${back}">${a.project_id ? 'Stock · ' + esc(stkProjName(a.project_id)) : 'Activos'}</a><span class="muted">›</span><span>${esc(a.code)}</span></div>
    <div class="card" style="padding-bottom:0">
      <div class="stk-head">
        <div class="stk-av" id="sa-av">${a.photos?.[0] ? `<img data-path="${esc(a.photos[0])}" alt="">` : C[0]}</div>
        <div style="flex:1;min-width:220px">
          <h1>${esc(a.name || a.type)}</h1>
          <div class="stk-sub"><span><b style="color:var(--ink)">${esc(a.code)}</b></span><span>🏷 ${esc(a.type)}</span><span>${l.ic} ${l.href ? `<a href="${l.href}">${esc(l.name)}</a>` : esc(l.name)}</span>${stkHolder(a) ? `<span>👷 ${esc(stkHolder(a))}</span>` : ''}</div>
          <div class="row" style="gap:8px;flex-wrap:wrap">
            ${w ? `<select id="sa-st" style="width:auto;font-weight:700;border-radius:8px;padding:6px 10px;background:${stkStCol(a.status)[0]};color:${stkStCol(a.status)[1]};border:0">${stkOpt([...new Set([...stkStatuses(a.cat), a.status])], a.status)}</select>` : stkStPill(a.status)}
            <span class="pill ${a.project_id ? '' : 'p-info'}" style="${a.project_id ? 'background:#EDE9FE;color:#5B21B6' : ''}">${a.project_id ? '📁 ' + esc(stkProjName(a.project_id)) : '🏢 Stock general'}</span>
            ${a.archived ? '<span class="pill p-bad">Archivado</span>' : ''}
          </div>
        </div>
        <div class="row" style="gap:6px;flex-wrap:wrap">${w ? `<button class="btn sec small" id="sa-edit">✏️ Editar</button><button class="btn sec small" id="sa-move">📍 Mover</button>` : ''}<button class="btn sec small" id="sa-qr">🏷️ QR</button>${w ? `<button class="btn sec small" id="sa-arch">${a.archived ? '♻️ Recuperar' : '🗄 Archivar'}</button>` : ''}</div>
      </div>
      <div class="stk-tabs" id="sa-tabs">${STK_ATABS.map(([k, t]) => `<button data-at="${k}">${t}</button>`).join('')}</div>
    </div>
    <div id="sa-body" style="margin-top:14px"></div>`;
  hydrate($('#sa-av'));
  $('#sa-st')?.addEventListener('change', async e => { const { error } = await sb.from('assets').update({ status: e.target.value }).eq('id', id); if (error) return toast(errText(error)); stkInval(); toast('Estado actualizado'); route(); });
  $('#sa-edit')?.addEventListener('click', () => stkEdit(a));
  $('#sa-move')?.addEventListener('click', () => stkBulkModal('mv', [a.id], {}));
  $('#sa-qr').onclick = () => stkLabels([a]);
  $('#sa-arch')?.addEventListener('click', async () => { if (!a.archived && !confirm('¿Archivar este activo? Sale de las listas pero se conserva con todo su historial.')) return;
    const { error } = await sb.from('assets').update({ archived: !a.archived }).eq('id', id); if (error) return toast(errText(error)); stkInval(); route(); });
  const show = k => { try { localStorage.setItem('ia_satab', k); } catch {} $$('#sa-tabs [data-at]').forEach(b => b.classList.toggle('on', b.dataset.at === k));
    const body = $('#sa-body'); body.innerHTML = '<div class="card muted">Cargando…</div>';
    ({ res: stkARes, act: stkAAct, det: stkADet, doc: stkADoc, img: stkAImg, mant: stkAMant, uso: stkAUso }[k])(body, ctx).catch?.(e => { body.innerHTML = `<div class="card">${esc(errText(e))}</div>`; }); };
  $$('#sa-tabs [data-at]').forEach(b => b.onclick = () => show(b.dataset.at));
  let t0 = 'act'; try { t0 = localStorage.getItem('ia_satab') || 'act'; } catch {}
  show(STK_ATABS.some(x => x[0] === t0) ? t0 : 'act');
}
async function stkARes(box, { a, evs }){
  const l = stkLoc(a), h = stkHolder(a);
  box.innerHTML = `<div class="chart-grid">
    <div class="card"><h2 style="margin-top:0">📍 Dónde está</h2><div style="font-size:22px;font-weight:700">${l.ic} ${l.href ? `<a href="${l.href}">${esc(l.name)}</a>` : esc(l.name)}</div>
      ${h ? `<div style="margin-top:6px">👷 En manos de <b>${esc(h)}</b></div>` : ''}<div class="muted sm" style="margin-top:6px">${a.project_id ? '📁 Reservado para el proyecto ' + esc(stkProjName(a.project_id)) : '🏢 Del stock general de la empresa'}</div></div>
    <div class="card"><h2 style="margin-top:0">📅 Fechas</h2><dl class="stk-dl"><dt>Activación</dt><dd>${stkDate(a.activated_on)}</dd><dt>Desactivación</dt><dd>${stkDate(a.deactivated_on)}</dd>
      ${a.cat === 'herramienta' ? `<dt>Calibración / service</dt><dd>${a.service_due ? `<b style="color:${a.service_due < todayStr() ? 'var(--red)' : 'inherit'}">${stkDate(a.service_due)}</b>` : '—'}</dd>` : ''}<dt>Alta</dt><dd>${fmtDT(a.created_at)}${a.created_by ? ' · ' + esc(a.created_by) : ''}</dd></dl></div>
    <div class="card"><h2 style="margin-top:0">🕘 Últimos movimientos</h2>${evs.slice(0, 4).map(e => `<div class="sm" style="padding:6px 0;border-bottom:1px solid var(--line)"><b>${esc(stkEvTitle(e))}</b> · ${fmtDT(e.at)}<div class="muted">${e.old_v ? `<s>${esc(e.old_v)}</s> → ` : ''}${esc(e.new_v || '')}</div></div>`).join('') || '<div class="muted sm">Sin movimientos.</div>'}</div>
    ${a.notes ? `<div class="card"><h2 style="margin-top:0">💬 Comentarios</h2><p style="white-space:pre-wrap;margin:0">${esc(a.notes)}</p></div>` : ''}</div>`;
}
const STK_EVT = { alta: ['✨', 'Alta del activo'], estado: ['⇄', 'Estado actualizado'], sitio: ['🏢', 'Sitio actualizado'], proyecto: ['📁', 'Stock cambiado'], detalle: ['ⓘ', 'Detalles actualizados'], nota: ['✎', 'Nota'],
  imagen: ['🖼', 'Imagen agregada'], documento: ['📄', 'Documento agregado'], responsable: ['👷', 'Responsable actualizado'], archivo: ['🗄', 'Archivo'], insp: ['📋', 'Inspección'], task: ['☑', 'Acción'], ticket: ['⚠', 'Contratiempo'] };
const stkEvTitle = e => (STK_EVT[e.kind] || ['', e.kind])[1] + (e.kind === 'detalle' && e.field ? ': ' + e.field : '');
const STK_FIL = [['all', 'Todas', ''], ['insp', 'Inspecciones', '📋'], ['task', 'Acciones', '☑'], ['ticket', 'Contratiempos', '⚠'], ['estado', 'Estado', '⇄'], ['sitio', 'Sitios', '🏢'], ['detalle', 'Detalles', 'ⓘ'], ['nota', 'Notas', '✎']];
const stkFilOf = k => ({ alta: 'sitio', proyecto: 'sitio', responsable: 'detalle', archivo: 'detalle', imagen: 'detalle', documento: 'detalle' }[k] || k);
// tramos de tiempo en cada sitio (para traer inspecciones, tareas y tickets de cuando el equipo estaba ahí)
function stkSiteSpans(evs){
  const asc = [...evs].reverse().filter(e => ['alta', 'sitio'].includes(e.kind)), spans = [];
  asc.forEach((e, i) => { if (e.ref_kind === 'site' && e.ref_id) spans.push({ site: e.ref_id, from: e.at, to: asc[i + 1]?.at || null }); });
  return spans;
}
async function stkExternal(a, evs){
  const spans = stkSiteSpans(evs); if (a.site_id && !spans.some(s => s.site === a.site_id && !s.to)) spans.push({ site: a.site_id, from: a.created_at, to: null });
  const ids = [...new Set(spans.map(s => s.site))]; if (!ids.length) return [];
  const inSpan = (site, at) => at && spans.some(s => s.site === site && at >= s.from && (!s.to || at <= s.to));
  const out = [];
  try { const r = await cached('stk-ins:' + a.id, () => sb.from('inspections').select('id,template_name,site_id,site_name,completed_at,started_at,status,score,max_score,flagged').in('site_id', ids).order('started_at', { ascending: false }).limit(300));
    r.forEach(i => { const at = i.completed_at || i.started_at; if (inSpan(i.site_id, at)) out.push({ kind: 'insp', at, by_name: null, new_v: `${i.template_name || 'Inspección'} · ${i.site_name || ''}`, href: i.status === 'completada' ? '#/informe/' + i.id : '#/insp/' + i.id, extra: i.status === 'completada' && i.max_score ? `Puntaje ${Math.round(i.score * 100 / i.max_score)}%${i.flagged ? ' · ' + i.flagged + ' señalados' : ''}` : (i.status || '') }); }); } catch {}
  try { const r = await cached('stk-tk:' + a.id, () => sb.from('tickets').select('id,ext_no,site_id,site_name,problem,status,created_at').in('site_id', ids).order('created_at', { ascending: false }).limit(200));
    r.forEach(t => { if (inSpan(t.site_id, t.created_at)) out.push({ kind: 'ticket', at: t.created_at, new_v: `Ticket ${t.ext_no || ''} · ${t.problem || t.site_name || ''}`, href: '#/tickets/' + t.id, extra: t.status }); }); } catch {}
  try { const ts = typeof loadAllTasks === 'function' ? await loadAllTasks() : [];
    ts.forEach(t => (t.sites || []).forEach(s => { const at = t.completed_at || t.created_at; if (ids.includes(s.site_id) && inSpan(s.site_id, at)) out.push({ kind: 'task', at, new_v: t.title, href: '#/tasks/' + t.id, extra: (typeof TASK_ST !== 'undefined' && TASK_ST[t.status]) || t.status }); })); } catch {}
  return out;
}
async function stkAAct(box, ctx){
  const { a, evs, w } = ctx;
  if (!ctx.ext) ctx.ext = await stkExternal(a, evs).catch(() => []);
  let fil = 'all', per = '';
  const draw = () => {
    const since = per ? new Date(Date.now() - Number(per) * 86400000).toISOString() : '';
    const all = [...evs, ...ctx.ext].filter(e => (fil === 'all' || stkFilOf(e.kind) === fil) && (!since || e.at >= since)).sort((x, y) => (y.at > x.at ? 1 : -1));
    const groups = new Map(); all.forEach(e => { const k = new Date(e.at).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(e); });
    $('#sa-evs').innerHTML = all.length ? [...groups.entries()].map(([mo, list]) => `<div class="stk-month">${esc(mo)}</div><div class="stk-evs">${list.map(stkEvHTML).join('')}</div>`).join('') : '<div class="card"><div class="empty">No hay actividad con ese filtro.</div></div>';
    box.querySelectorAll('[data-fil]').forEach(b => b.classList.toggle('on', b.dataset.fil === fil));
  };
  box.innerHTML = `<h2 style="margin:4px 0 10px">Actividad</h2>
    <div class="stk-fil"><select id="sa-per" title="Intervalo de fechas"><option value="">📅 Intervalo de fechas</option><option value="7">Últimos 7 días</option><option value="30">Últimos 30 días</option><option value="90">Últimos 90 días</option><option value="365">Último año</option></select>
      ${STK_FIL.map(([k, t, ic]) => `<button data-fil="${k}">${ic ? ic + ' ' : ''}${t}</button>`).join('')}</div>
    ${w ? `<div class="row" style="gap:6px;flex-wrap:nowrap;margin-bottom:6px"><input id="sa-note" maxlength="1000" placeholder="✎ Agregar una nota al historial…"><button class="btn" id="sa-noteok" style="margin:0">Agregar</button></div>` : ''}
    <div id="sa-evs"></div>`;
  box.querySelectorAll('[data-fil]').forEach(b => b.onclick = () => { fil = b.dataset.fil; draw(); });
  $('#sa-per').onchange = e => { per = e.target.value; draw(); };
  $('#sa-noteok')?.addEventListener('click', async () => { const t = $('#sa-note').value.trim(); if (!t) return;
    const { error } = await sb.rpc('asset_note', { p_asset: a.id, p_note: t }); if (error) return toast(errText(error));
    IDB.del('kv', CUR_UID + ':stk-ev:' + a.id).catch(() => {}); toast('Nota agregada'); route(); });
  draw();
}
function stkEvHTML(e){
  const [ic, title] = STK_EVT[e.kind] || ['•', e.kind];
  const d = new Date(e.at).toLocaleString('es-AR', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  let link = '';
  if (e.ref_kind === 'place' && e.ref_id) link = '#/stock/l/' + e.ref_id; else if (e.ref_kind === 'site' && e.ref_id) link = '#/stock/s/' + e.ref_id; else if (e.ref_kind === 'project' && e.ref_id) link = '#/stock/p/' + e.ref_id;
  if (e.href) link = e.href;
  const nv = e.kind === 'estado' ? stkStPill(e.new_v) : link ? `<a href="${esc(link)}">${esc(e.new_v || '')} ↗</a>` : `<span>${esc(e.new_v || '')}</span>`;
  const ov = e.old_v ? (e.kind === 'estado' ? `<s>${stkStPill(e.old_v)}</s>` : `<s>${esc(e.old_v)}</s>`) + ' <span class="muted">→</span> ' : '';
  return `<div class="stk-ev"><div class="stk-evi">${ic}</div><div style="min-width:0;flex:1"><div class="stk-evd">${esc(d)}${e.by_name ? ' · ' + esc(e.by_name) : ''}</div>
    <div class="stk-evt">${esc(e.kind === 'detalle' && e.field ? title + ': ' + e.field : title)}</div><div class="stk-evc">${ov}${nv}${e.extra ? ` <span class="muted">· ${esc(e.extra)}</span>` : ''}</div></div></div>`;
}
async function stkADet(box, { a }){
  const rows = [['Categoría', STK_CAT[a.cat]?.[1]], ['Tipo', a.type], ['ID único', a.code], ['Estado', a.status], ['Site Name', stkLoc(a).name], ['Responsable', stkHolder(a)], ['Nombre mostrado', a.name], ['Vendor', a.vendor], ['Models', a.model],
    ['Fecha de Activación', a.activated_on && stkDate(a.activated_on)], ['Fecha de Desactivación', a.deactivated_on && stkDate(a.deactivated_on)], ...(a.cat === 'herramienta' ? [['Calibración / service', a.service_due && stkDate(a.service_due)]] : []),
    ['Propiedad', a.owner], ['Comentarios', a.notes], ['Stock', a.project_id ? 'Proyecto ' + stkProjName(a.project_id) : 'Stock general'], ['Identificación en otro sistema', a.ext_id], ...Object.entries(a.extra || {})];
  box.innerHTML = `<div class="card"><h2 style="margin-top:0">Detalles</h2><dl class="stk-dl">${rows.map(([k, x]) => `<dt>${esc(k)}</dt><dd>${x ? esc(x) : '<span class="muted">—</span>'}</dd>`).join('')}</dl></div>`;
}
async function stkUpload(a, file, kind){
  const isPdf = /pdf$/i.test(file.type) || /\.pdf$/i.test(file.name);
  if (kind === 'doc' && isPdf){
    if (file.size > 10 * 1024 * 1024) throw new Error('El PDF supera 10 MB.');
    const head = new Uint8Array(await file.slice(0, 5).arrayBuffer()); if (String.fromCharCode(...head) !== '%PDF-') throw new Error('El archivo no es un PDF válido.');
    const path = `${a.org_id}/stock/${a.id}/${uid()}.pdf`;
    const { error } = await sb.storage.from('fotos').upload(path, file, { contentType: 'application/pdf', upsert: false }); if (error) throw error; return path;
  }
  const blob = await compressImage(file, 1600, 0.8), path = `${a.org_id}/stock/${a.id}/${uid()}.jpg`;
  const { error } = await sb.storage.from('fotos').upload(path, blob, { contentType: 'image/jpeg', upsert: false }); if (error) throw error;
  return path;
}
async function stkADoc(box, { a, w }){
  const docs = a.docs || [];
  box.innerHTML = `<div class="card"><div class="row between"><h2 style="margin:0">Documentos</h2>${w ? `<label class="btn" style="margin:0">+ Subir PDF o foto<input type="file" accept="application/pdf,image/jpeg,image/png" id="sa-docf" class="hidden"></label>` : ''}</div>
    <p class="muted sm">Remitos, garantías, actas, manuales. PDF hasta 10 MB.</p>
    ${docs.length ? `<div class="tblwrap"><table class="tbl"><tbody>${docs.map((d, i) => `<tr><td style="width:30px;font-size:20px">${/\.pdf$/i.test(d.path) ? '📄' : '🖼'}</td><td><b>${esc(d.name)}</b><div class="muted sm">${esc(fmtDT(d.at))}</div></td>
      <td class="num"><button class="btn sec small" data-dopen="${i}">Abrir</button>${stkCan(3) ? ` <button class="btn sec small" data-ddel="${i}" style="color:var(--red)">🗑</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Todavía no hay documentos.</div>'}</div>`;
  $('#sa-docf')?.addEventListener('change', async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try { toast('Subiendo…'); const path = await stkUpload(a, f, 'doc'); const name = String(f.name || 'Documento').replace(/[\u0000-\u001f<>]/g, '').slice(0, 120);
      const { error } = await sb.from('assets').update({ docs: [...docs, { path, name, at: new Date().toISOString() }] }).eq('id', a.id); if (error) throw error; stkInval(); toast('Documento agregado'); route(); }
    catch (err){ toast('No se pudo subir: ' + errText(err)); } });
  box.querySelectorAll('[data-dopen]').forEach(b => b.onclick = async () => { const d = docs[Number(b.dataset.dopen)]; if (!needOnline()) return;
    const { data } = await sb.storage.from('fotos').createSignedUrl(d.path, 600); if (!data?.signedUrl) return toast('No se pudo abrir');
    if (/\.pdf$/i.test(d.path)) window.open(data.signedUrl, '_blank', 'noopener'); else photoViewer(data.signedUrl, { name: d.name }); });
  box.querySelectorAll('[data-ddel]').forEach(b => b.onclick = async () => { if (!confirm('¿Quitar este documento?')) return; const i = Number(b.dataset.ddel), d = docs[i];
    const { error } = await sb.from('assets').update({ docs: docs.filter((_, k) => k !== i) }).eq('id', a.id); if (error) return toast(errText(error));
    sb.storage.from('fotos').remove([d.path]).catch(() => {}); stkInval(); route(); });
}
async function stkAImg(box, { a, w }){
  const ph = a.photos || [];
  box.innerHTML = `<div class="card"><div class="row between"><h2 style="margin:0">Imágenes</h2>${w && ph.length < 12 ? `<div class="row" style="gap:6px"><label class="btn" style="margin:0">📷 Sacar foto<input type="file" accept="image/*" capture="environment" id="sa-imgc" class="hidden"></label><label class="btn sec" style="margin:0">🖼️ Galería<input type="file" accept="image/jpeg,image/png,image/webp" id="sa-imgg" class="hidden"></label></div>` : ''}</div>
    <p class="muted sm">Del equipo, de la etiqueta con el número de serie, de cómo quedó instalado. La primera es la que se ve arriba.</p>
    ${ph.length ? `<div class="stk-imgs">${ph.map((p, i) => `<div class="th"><img data-path="${esc(p)}" data-iv="${i}" alt="Imagen ${i + 1}"></div>`).join('')}</div>` : '<div class="empty">Todavía no hay imágenes.</div>'}</div>`;
  hydrate(box);
  const add = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try { toast('Guardando…'); const path = await stkUpload(a, f, 'img'); const { error } = await sb.from('assets').update({ photos: [...ph, path] }).eq('id', a.id); if (error) throw error; stkInval(); toast('Imagen agregada'); route(); }
    catch (err){ toast('No se pudo guardar: ' + errText(err)); } };
  $('#sa-imgc')?.addEventListener('change', add); $('#sa-imgg')?.addEventListener('change', add);
  box.querySelectorAll('[data-iv]').forEach(im => im.onclick = () => { const i = Number(im.dataset.iv); if (!im.src) return;
    photoViewer(im.src, { name: 'activo-' + a.code.replace(/[^\w-]/g, ''), onDel: stkCan(3) ? async () => { if (!confirm('¿Borrar esta imagen?')) return;
      const { error } = await sb.from('assets').update({ photos: ph.filter((_, k) => k !== i) }).eq('id', a.id); if (error) return toast(errText(error)); sb.storage.from('fotos').remove([ph[i]]).catch(() => {}); stkInval(); route(); } : null }); });
}
async function stkAMant(box, ctx){
  const { a, evs } = ctx;
  if (!ctx.ext) ctx.ext = await stkExternal(a, evs).catch(() => []);
  const list = ctx.ext.slice().sort((x, y) => (y.at > x.at ? 1 : -1));
  const cal = a.cat === 'herramienta' && a.service_due;
  box.innerHTML = `${cal ? `<div class="card" style="border-left:4px solid ${a.service_due < todayStr() ? 'var(--red)' : a.service_due <= addDays(todayStr(), 30) ? 'var(--amber)' : 'var(--green)'}"><b>🔧 Calibración / service</b><div style="font-size:20px;margin-top:4px">${a.service_due < todayStr() ? '⚠ Vencida el ' : 'Vence el '}${stkDate(a.service_due)}</div></div>` : ''}
    <div class="card"><h2 style="margin-top:0">Mantenimiento</h2><p class="muted sm">Inspecciones, tareas y tickets del sitio mientras el equipo estuvo ahí.</p>
    ${list.length ? list.map(stkEvHTML).join('') : '<div class="empty">Todavía no hay mantenimiento registrado.</div>'}</div>`;
}
async function stkAUso(box, { a, evs }){
  const asc = [...evs].reverse(), now = new Date().toISOString();
  const spans = (kinds, val) => { const out = new Map(); const ch = asc.filter(e => kinds.includes(e.kind));
    let cur = val(ch[0]) ?? null, from = a.created_at;
    ch.forEach((e, i) => { if (i === 0 && e.kind === 'alta'){ cur = val(e); from = e.at; return; } if (cur != null) out.set(cur, (out.get(cur) || 0) + (new Date(e.at) - new Date(from))); cur = e.new_v; from = e.at; });
    if (cur != null) out.set(cur, (out.get(cur) || 0) + (new Date(now) - new Date(from)));
    return [...out.entries()].map(([k, ms]) => ({ label: k, v: Math.max(0, ms / 86400000) })).sort((x, y) => y.v - x.v); };
  const byLoc = spans(['alta', 'sitio'], e => e?.new_v);
  const stEv = asc.filter(e => e.kind === 'estado');
  const byStCalc = (() => { const out = new Map(); let cur = stEv[0]?.old_v || a.status, from = a.created_at;
    stEv.forEach(e => { out.set(cur, (out.get(cur) || 0) + (new Date(e.at) - new Date(from))); cur = e.new_v; from = e.at; });
    out.set(cur, (out.get(cur) || 0) + (new Date(now) - new Date(from))); return [...out.entries()].map(([k, ms]) => ({ label: k, v: Math.max(0, ms / 86400000) })).sort((x, y) => y.v - x.v); })();
  const fmt = d => d < 1 ? 'menos de 1 día' : Math.round(d) + ' día' + (Math.round(d) === 1 ? '' : 's');
  const total = (new Date(now) - new Date(a.created_at)) / 86400000;
  box.innerHTML = `<div class="stk-kpis"><div class="stk-kpi"><span>⏱ Desde el alta</span><b>${Math.round(total)}</b><small>días</small></div>
      <div class="stk-kpi" style="border-left-color:#5B5BD6"><span>🏢 Lugares por los que pasó</span><b>${byLoc.length}</b></div>
      <div class="stk-kpi" style="border-left-color:#166534"><span>✅ En servicio</span><b>${Math.round(byStCalc.filter(x => /activ|instal|disponib|asignad/i.test(x.label)).reduce((s, x) => s + x.v, 0))}</b><small>días activo o instalado</small></div></div>
    <div class="chart-grid"><div class="card"><h2 style="margin-top:0">Tiempo en cada lugar</h2>${chartHBars(byLoc.map(x => ({ label: x.label, v: Math.round(x.v * 10) / 10, display: fmt(x.v), c: '#5B5BD6' })))}</div>
      <div class="card"><h2 style="margin-top:0">Tiempo en cada estado</h2>${chartHBars(byStCalc.map(x => ({ label: x.label, v: Math.round(x.v * 10) / 10, display: fmt(x.v), c: stkStCol(x.label)[1] })))}</div></div>`;
  bindTips(box);
}

/* ---------- materiales por cantidad ---------- */
function stkMatTab(box, sc){
  const B = STK.base, w = stkCan(2), pid = stkScopeProj(sc);
  const bal = stkBalances().filter(b => sc.kind === 'gen' ? !b.project : sc.kind === 'prj' ? b.project === sc.id : sc.kind === 'place' ? b.place === sc.id : false);
  if (sc.kind === 'site'){ box.innerHTML = '<div class="empty">Los materiales se ven por depósito o por proyecto.</div>'; return; }
  const items = B.items.filter(i => i.active).map(i => { const bs = bal.filter(b => b.item === i.id && b.qty > 1e-9); return { i, bs, tot: bs.reduce((s, b) => s + b.qty, 0) }; });
  const used = items.filter(x => x.tot > 0 || sc.kind === 'gen');
  box.innerHTML = `<div class="row between" style="gap:8px;flex-wrap:wrap"><p class="muted sm" style="margin:0">Cable, conectores, cajas… por cantidad. El saldo sale de los movimientos: nadie lo cambia a mano.</p>
      <div class="row" style="gap:6px">${w && ['gen', 'prj', 'place'].includes(sc.kind) ? `<button class="btn" id="sm-mv" style="margin:0">🔁 Registrar movimiento</button><button class="btn sec" id="sm-new" style="margin:0">+ Material</button>` : ''}<button class="btn sec" id="sm-exp" style="margin:0">⬇ Exportar</button></div></div>
    ${used.length ? `<div class="tblwrap" style="margin-top:10px"><table class="tbl"><thead><tr><th>Material</th><th class="num">Saldo</th><th>Dónde</th></tr></thead><tbody>${used.map(({ i, bs, tot }) => {
      const lowQ = i.min_qty != null && tot < Number(i.min_qty);
      return `<tr class="click" data-mi="${i.id}"><td><b>${esc(i.name)}</b>${i.code ? `<div class="muted sm">${esc(i.code)}</div>` : ''}${lowQ ? `<div class="sm" style="color:var(--red)">⚠ Bajo el mínimo (${stkFmtQty(i.min_qty)} ${esc(i.unit)})</div>` : ''}</td>
        <td class="num"><b style="font-size:18px;color:${lowQ ? 'var(--red)' : 'inherit'}">${stkFmtQty(tot)}</b> <span class="muted sm">${esc(i.unit)}</span></td>
        <td class="sm">${bs.map(b => { const p = B.placeById.get(b.place); return `<span class="pill" style="background:#ECFEFF;color:#0E7490;margin:2px">${(STK_PLACE_KIND[p?.kind] || STK_PLACE_KIND.otro)[0]} ${esc(p?.name || '?')} · ${stkFmtQty(b.qty)}</span>`; }).join('') || '<span class="muted">sin saldo</span>'}</td></tr>`; }).join('')}</tbody></table></div>`
      : `<div class="empty">${B.items.length ? 'No hay saldo de materiales en este stock.' : 'Todavía no hay materiales.'}${w ? ' Empezá con <b>+ Material</b> y después <b>Registrar movimiento → Ingreso</b>.' : ''}</div>`}`;
  $('#sm-new')?.addEventListener('click', () => stkItemEdit(null));
  $('#sm-mv')?.addEventListener('click', () => stkMoveModal(sc));
  $('#sm-exp').onclick = () => xlSave(`Materiales ${sc.kind === 'prj' ? stkProjName(sc.id) : 'stock general'} ${todayStr()}`, [['Saldos', [['Material', 'Código', 'Unidad', 'Lugar', 'Stock', 'Cantidad', 'Mínimo'],
    ...used.flatMap(({ i, bs }) => bs.map(b => [i.name, i.code || '', i.unit, B.placeById.get(b.place)?.name || '', b.project ? stkProjName(b.project) : 'Stock general', Math.round(b.qty * 100) / 100, i.min_qty ?? '']))], [28, 12, 8, 28, 24, 10, 8]],
    ['Movimientos', [['Fecha', 'Material', 'Movimiento', 'Cantidad', 'Desde', 'Hacia', 'Sitio', 'Nota', 'Quién'], ...B.moves.filter(x => sc.kind === 'gen' ? (!x.from_project && x.from_place) || (!x.to_project && x.to_place) : sc.kind === 'prj' ? x.from_project === sc.id || x.to_project === sc.id : x.from_place === sc.id || x.to_place === sc.id)
      .map(x => [fmtDT(x.at), B.itemById.get(x.item_id)?.name || '', STK_MOVE[x.kind]?.[1] || x.kind, Number(x.qty), stkMvSide(x.from_place, x.from_project), stkMvSide(x.to_place, x.to_project), x.site_id ? B.siteById.get(x.site_id)?.name || '' : '', x.note || '', x.by_name || ''])], [16, 26, 16, 8, 30, 30, 20, 30, 18]]]);
  box.querySelectorAll('[data-mi]').forEach(tr => tr.onclick = () => stkItemModal(tr.dataset.mi, sc));
  if (STK.openItem){ const id = STK.openItem; STK.openItem = null; if (B.itemById.has(id)) stkItemModal(id, sc); }
}
const stkMvSide = (pl, pj) => pl ? `${STK.base.placeById.get(pl)?.name || '?'}${pj ? ' (' + stkProjName(pj) + ')' : ' (general)'}` : '—';
const STK_MOVE = { ingreso: ['📥', 'Ingreso', 'Entra material nuevo (remito de proveedor)'], pase: ['🔁', 'Pase entre lugares', 'De un depósito a otro, a un vehículo o a un obrador'], consumo: ['🔧', 'Consumo en obra', 'Se usó en un sitio'],
  baja: ['🗑', 'Baja', 'Rotura, pérdida o vencimiento'], ajuste_mas: ['➕', 'Ajuste +', 'Corrección de inventario (sobra)'], ajuste_menos: ['➖', 'Ajuste −', 'Corrección de inventario (falta)'],
  asignar: ['📁', 'Asignar a proyecto', 'Del stock general al de un proyecto'], devolver: ['🏢', 'Devolver al general', 'Del proyecto al stock general'] };
function stkItemEdit(i){
  const isNew = !i, cur = i || {};
  const m = modal(`<h2>${isNew ? '+ Material' : 'Editar material'}</h2>
    <label>Nombre</label><input id="mi-n" maxlength="160" value="${esc(cur.name || '')}" placeholder="Ej.: Cable UTP Cat6">
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0 10px"><div><label>Unidad</label><input id="mi-u" maxlength="20" value="${esc(cur.unit || 'u')}" list="mi-us"><datalist id="mi-us"><option value="u"><option value="m"><option value="kg"><option value="caja"><option value="rollo"><option value="l"></datalist></div>
      <div><label>Código</label><input id="mi-c" maxlength="60" value="${esc(cur.code || '')}"></div><div><label>Stock mínimo</label><input id="mi-min" type="number" min="0" step="any" value="${cur.min_qty ?? ''}"></div></div>
    <div class="err" id="mi-err"></div><div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn sec" id="mi-x">Cancelar</button><button class="btn" id="mi-ok">Guardar</button></div>`);
  $('#mi-x').onclick = m.close;
  $('#mi-ok').onclick = async () => { const row = { name: $('#mi-n').value.trim(), unit: $('#mi-u').value.trim() || 'u', code: $('#mi-c').value.trim() || null, min_qty: $('#mi-min').value === '' ? null : Number($('#mi-min').value) };
    if (!row.name) return void ($('#mi-err').textContent = 'Falta el nombre.');
    if (STK.base.items.some(x => stkNorm(x.name) === stkNorm(row.name) && x.id !== cur.id)) return void ($('#mi-err').textContent = 'Ya existe un material con ese nombre.');
    const { error } = isNew ? await sb.from('stock_items').insert({ ...row, org_id: me.org_id }) : await sb.from('stock_items').update(row).eq('id', cur.id);
    if (error) return void ($('#mi-err').textContent = errText(error)); m.close(); stkInval(); toast('Material guardado'); route(); };
}
function stkItemModal(id, sc){
  const B = STK.base, i = B.itemById.get(id); if (!i) return;
  const bal = stkBalances().filter(b => b.item === id && b.qty > 1e-9);
  const mv = B.moves.filter(x => x.item_id === id).slice(-60).reverse();
  const m = modal(`<div class="row between"><h2 style="margin:0">🧵 ${esc(i.name)}</h2>${stkCan(3) ? '<button class="btn sec small" id="im-ed">✏️ Editar</button>' : ''}</div>
    <p class="muted sm">${esc(i.unit)}${i.code ? ' · ' + esc(i.code) : ''}${i.min_qty != null ? ' · mínimo ' + stkFmtQty(i.min_qty) : ''}</p>
    <h3 style="margin:12px 0 6px">Saldo por lugar</h3>${bal.length ? chartHBars(bal.map(b => ({ label: `${B.placeById.get(b.place)?.name || '?'} · ${b.project ? stkProjName(b.project) : 'General'}`, v: Math.round(b.qty * 100) / 100, display: stkFmtQty(b.qty) + ' ' + i.unit, c: b.project ? '#7C3AED' : '#0F2A4A' }))) : '<div class="muted sm">Sin saldo.</div>'}
    <h3 style="margin:14px 0 6px">Movimientos</h3><div style="max-height:40vh;overflow:auto">${mv.map(x => `<div class="sm" style="padding:6px 0;border-bottom:1px solid var(--line)"><b>${STK_MOVE[x.kind]?.[0] || ''} ${esc(STK_MOVE[x.kind]?.[1] || x.kind)}</b> · ${stkFmtQty(x.qty)} ${esc(i.unit)} · ${fmtDT(x.at)}
      <div class="muted">${x.from_place ? esc(stkMvSide(x.from_place, x.from_project)) : ''}${x.from_place && x.to_place ? ' → ' : ''}${x.to_place ? esc(stkMvSide(x.to_place, x.to_project)) : ''}${x.site_id ? ' · 📍 ' + esc(B.siteById.get(x.site_id)?.name || '') : ''}${x.note ? ' · ' + esc(x.note) : ''}${x.by_name ? ' · ' + esc(x.by_name) : ''}</div></div>`).join('') || '<div class="muted sm">Sin movimientos.</div>'}</div>
    <div class="row" style="justify-content:flex-end;margin-top:12px">${stkCan(2) ? '<button class="btn" id="im-mv">🔁 Registrar movimiento</button>' : ''}<button class="btn sec" id="im-x">Cerrar</button></div>`, { wide: true });
  bindTips(m.el);
  $('#im-x').onclick = m.close; $('#im-ed')?.addEventListener('click', () => stkItemEdit(i)); $('#im-mv')?.addEventListener('click', () => stkMoveModal(sc, id));
}
function stkMoveModal(sc, itemId){
  const B = STK.base, pid = stkScopeProj(sc), places = B.places.filter(p => p.active);
  if (!B.items.length) return toast('Primero cargá el material con + Material.');
  if (!places.length) return toast('Primero creá un lugar (depósito, base, obrador o vehículo) en la pestaña Lugares.');
  const kinds = ['ingreso', 'pase', 'consumo', 'baja', 'ajuste_mas', 'ajuste_menos', ...(sc.kind === 'gen' ? ['asignar'] : []), ...(sc.kind === 'prj' ? ['devolver'] : [])];
  let kind = 'ingreso';
  const plOpts = (sel) => places.map(p => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${(STK_PLACE_KIND[p.kind] || STK_PLACE_KIND.otro)[0]} ${esc(p.name)}</option>`).join('');
  const m = modal(`<h2>🔁 Registrar movimiento</h2><p class="muted sm" style="margin-top:-6px">${sc.kind === 'prj' ? '📁 Stock del proyecto ' + esc(stkProjName(sc.id)) : '🏢 Stock general de la empresa'}</p>
    <div class="stk-kinds">${kinds.map(k => `<button type="button" data-mk="${k}"><b>${STK_MOVE[k][0]}</b>${STK_MOVE[k][1]}</button>`).join('')}</div>
    <p class="muted sm" id="mv-help"></p>
    <label>Material</label><select id="mv-i">${B.items.filter(i => i.active).map(i => `<option value="${i.id}" ${i.id === itemId ? 'selected' : ''}>${esc(i.name)} (${esc(i.unit)})</option>`).join('')}</select>
    <div id="mv-fw"><label>Sale de</label><select id="mv-f">${plOpts(sc.kind === 'place' ? sc.id : '')}</select><div class="sm" id="mv-have" style="margin-top:4px"></div></div>
    <div id="mv-tw"><label>Va a</label><select id="mv-t">${plOpts(sc.kind === 'place' ? sc.id : '')}</select></div>
    <div id="mv-pw"><label>Proyecto</label><select id="mv-p">${B.projects.filter(p => p.active).map(p => `<option value="${p.id}">📁 ${esc(p.name)}</option>`).join('')}</select></div>
    <div id="mv-sw"><label>Sitio donde se usó <span class="muted">(opcional)</span></label><select id="mv-s"><option value="">—</option>${B.sites.slice(0, 3000).map(s => `<option value="${s.id}">📍 ${esc(s.name)}</option>`).join('')}</select></div>
    <label>Cantidad</label><input id="mv-q" type="number" min="0" step="any" inputmode="decimal" placeholder="0">
    <label>Nota <span class="muted">(remito, motivo…)</span></label><input id="mv-n" maxlength="300">
    <label class="btn sec small" style="margin-top:8px;display:inline-block">📎 Foto o PDF del remito<input type="file" id="mv-doc" accept="image/jpeg,image/png,application/pdf" class="hidden"></label> <span class="sm muted" id="mv-docn"></span>
    <div class="err" id="mv-err"></div><div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn sec" id="mv-x">Cancelar</button><button class="btn" id="mv-ok">Registrar</button></div>`, { wide: true });
  const fromProj = () => kind === 'asignar' ? null : pid, have = () => stkBalances().filter(b => b.item === $('#mv-i').value && b.place === $('#mv-f').value && (b.project || null) === (fromProj() || null)).reduce((s, b) => s + b.qty, 0);
  const paint = () => {
    m.el.querySelectorAll('[data-mk]').forEach(b => b.classList.toggle('on', b.dataset.mk === kind));
    $('#mv-help').textContent = STK_MOVE[kind][2];
    const hasF = !['ingreso', 'ajuste_mas'].includes(kind), hasT = ['ingreso', 'ajuste_mas', 'pase'].includes(kind);
    $('#mv-fw').classList.toggle('hidden', !hasF); $('#mv-tw').classList.toggle('hidden', !hasT); $('#mv-pw').classList.toggle('hidden', kind !== 'asignar'); $('#mv-sw').classList.toggle('hidden', kind !== 'consumo');
    if (hasF){ const u = B.itemById.get($('#mv-i').value)?.unit || ''; const h = have(); $('#mv-have').innerHTML = `Hay <b>${stkFmtQty(h)} ${esc(u)}</b> en ese lugar${pid || kind === 'devolver' ? ' (del proyecto)' : ' (stock general)'}.`; }
  };
  m.el.querySelectorAll('[data-mk]').forEach(b => b.onclick = () => { kind = b.dataset.mk; paint(); });
  ['#mv-i', '#mv-f'].forEach(s => $(s).onchange = paint); paint();
  let doc = null; $('#mv-doc').onchange = e => { doc = e.target.files[0] || null; $('#mv-docn').textContent = doc ? doc.name.slice(0, 60) : ''; };
  $('#mv-x').onclick = m.close;
  $('#mv-ok').onclick = async () => {
    const err = $('#mv-err'); err.textContent = ''; const q = Number($('#mv-q').value);
    if (!(q > 0)) return void (err.textContent = 'Poné una cantidad mayor a cero.');
    const hasF = !['ingreso', 'ajuste_mas'].includes(kind);
    if (hasF && q > have() + 1e-9) return void (err.textContent = `No alcanza: en ese lugar hay ${stkFmtQty(have())}.`);
    if (kind === 'pase' && $('#mv-f').value === $('#mv-t').value) return void (err.textContent = 'Elegí dos lugares distintos.');
    const row = { org_id: me.org_id, item_id: $('#mv-i').value, kind, qty: q, note: $('#mv-n').value.trim() || null,
      from_place: hasF ? $('#mv-f').value : null, from_project: hasF ? (kind === 'asignar' ? null : pid) : null,
      to_place: ['ingreso', 'ajuste_mas', 'pase'].includes(kind) ? $('#mv-t').value : ['asignar', 'devolver'].includes(kind) ? $('#mv-f').value : null,
      to_project: kind === 'asignar' ? $('#mv-p').value : ['ingreso', 'ajuste_mas', 'pase'].includes(kind) ? pid : null,
      site_id: kind === 'consumo' ? ($('#mv-s').value || null) : null };
    $('#mv-ok').disabled = true;
    try {
      if (doc){ if (doc.size > 10 * 1024 * 1024) throw new Error('El archivo supera 10 MB.');
        const pdf = /pdf$/i.test(doc.type); let body = doc;
        if (pdf){ const h = new Uint8Array(await doc.slice(0, 5).arrayBuffer()); if (String.fromCharCode(...h) !== '%PDF-') throw new Error('El archivo no es un PDF válido.'); } else body = await compressImage(doc, 1600, 0.8);
        const path = `${me.org_id}/stock/m/${uid()}.${pdf ? 'pdf' : 'jpg'}`;
        const { error } = await sb.storage.from('fotos').upload(path, body, { contentType: pdf ? 'application/pdf' : 'image/jpeg', upsert: false }); if (error) throw error; row.doc_path = path; }
      const { error } = await sb.from('stock_moves').insert(row); if (error) throw error;
      m.close(); stkInval(); toast('Movimiento registrado'); route();
    } catch (e){ err.textContent = errText(e); $('#mv-ok').disabled = false; }
  };
}

/* ---------- lugares ---------- */
function stkPlacesTab(box, sc){
  const B = STK.base, w = stkCan(3), pid = stkScopeProj(sc), bal = stkBalances();
  const list = B.places.filter(p => sc.kind === 'gen' ? true : p.project_id === pid || !p.project_id);
  const card = p => { const k = STK_PLACE_KIND[p.kind] || STK_PLACE_KIND.otro; const as = B.assets.filter(a => a.place_id === p.id && !a.archived);
    const mats = new Set(bal.filter(b => b.place === p.id && b.qty > 0).map(b => b.item)).size;
    return `<div class="stk-place" style="${p.active ? '' : 'opacity:.6;border-top-color:#9CA3AF'}"><div class="row between"><div><div style="font-size:28px;line-height:1">${k[0]}</div><b style="font-size:16px">${esc(p.name)}</b><div class="muted sm">${k[1]}${p.project_id ? ' · 📁 ' + esc(stkProjName(p.project_id)) : ' · para toda la empresa'}${p.active ? '' : ' · desarmado ' + fmtD(p.closed_at)}</div>${p.address ? `<div class="muted sm">${esc(p.address)}</div>` : ''}</div></div>
      <div class="n"><div><b>${as.filter(a => a.cat === 'equipo').length}</b><span>equipos</span></div><div><b>${as.filter(a => a.cat === 'herramienta').length}</b><span>herramientas</span></div><div><b>${mats}</b><span>materiales</span></div></div>
      <div class="row" style="gap:6px;flex-wrap:wrap"><a class="btn sec small" href="#/stock/l/${p.id}" style="margin:0">Ver lo que hay</a>${w && p.active ? `<button class="btn sec small" data-ple="${p.id}" style="margin:0">✏️</button><button class="btn sec small" data-plc="${p.id}" style="margin:0">📦 Desarmar</button>` : ''}${w && !p.active ? `<button class="btn sec small" data-plo="${p.id}" style="margin:0">♻️ Reabrir</button>` : ''}</div></div>`; };
  box.innerHTML = `<div class="row between" style="gap:8px;flex-wrap:wrap"><p class="muted sm" style="margin:0">Depósitos, bases, obradores y vehículos. Se crean cuando arranca una obra y se desarman cuando termina: al desarmar, la app mueve todo a otro lugar.</p>${w ? '<button class="btn" id="pl-new" style="margin:0">+ Lugar</button>' : ''}</div>
    <div class="stk-places" style="margin-top:12px">${list.filter(p => p.active).map(card).join('') || '<div class="empty">Todavía no hay lugares. Creá el primero con <b>+ Lugar</b>.</div>'}</div>
    ${list.some(p => !p.active) ? `<details style="margin-top:14px"><summary class="sm" style="cursor:pointer">Lugares desarmados (${list.filter(p => !p.active).length})</summary><div class="stk-places" style="margin-top:10px">${list.filter(p => !p.active).map(card).join('')}</div></details>` : ''}`;
  $('#pl-new')?.addEventListener('click', () => stkPlaceEdit(null, pid));
  box.querySelectorAll('[data-ple]').forEach(b => b.onclick = () => stkPlaceEdit(B.placeById.get(b.dataset.ple)));
  box.querySelectorAll('[data-plc]').forEach(b => b.onclick = () => stkPlaceClose(B.placeById.get(b.dataset.plc)));
  box.querySelectorAll('[data-plo]').forEach(b => b.onclick = async () => { const { error } = await sb.from('stock_places').update({ active: true }).eq('id', b.dataset.plo); if (error) return toast(errText(error)); stkInval(); route(); });
}
function stkPlaceEdit(p, pid){
  const isNew = !p, cur = p || { kind: 'deposito', project_id: pid || null }; let kind = cur.kind;
  const m = modal(`<h2>${isNew ? '+ Lugar' : 'Editar lugar'}</h2>
    <div class="stk-kinds">${Object.entries(STK_PLACE_KIND).map(([k, x]) => `<button type="button" data-pk="${k}"><b>${x[0]}</b>${x[1]}</button>`).join('')}</div>
    <label>Nombre</label><input id="pl-n" maxlength="120" value="${esc(cur.name || '')}" placeholder="Ej.: Stock Mantenimiento Pos-Venta - BA">
    <label>Es de</label><select id="pl-p"><option value="">🏢 Toda la empresa</option>${STK.base.projects.filter(x => x.active || x.id === cur.project_id).map(x => `<option value="${x.id}" ${x.id === cur.project_id ? 'selected' : ''}>📁 ${esc(x.name)}</option>`).join('')}</select>
    <label>Dirección</label><input id="pl-a" maxlength="200" value="${esc(cur.address || '')}">
    <label>Notas</label><input id="pl-no" maxlength="500" value="${esc(cur.notes || '')}">
    <div class="err" id="pl-err"></div><div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn sec" id="pl-x">Cancelar</button><button class="btn" id="pl-ok">Guardar</button></div>`);
  const paint = () => m.el.querySelectorAll('[data-pk]').forEach(b => b.classList.toggle('on', b.dataset.pk === kind)); paint();
  m.el.querySelectorAll('[data-pk]').forEach(b => b.onclick = () => { kind = b.dataset.pk; paint(); });
  $('#pl-x').onclick = m.close;
  $('#pl-ok').onclick = async () => { const row = { name: $('#pl-n').value.trim(), kind, project_id: $('#pl-p').value || null, address: $('#pl-a').value.trim() || null, notes: $('#pl-no').value.trim() || null };
    if (!row.name) return void ($('#pl-err').textContent = 'Falta el nombre.');
    if (STK.base.places.some(x => stkNorm(x.name) === stkNorm(row.name) && x.id !== cur.id)) return void ($('#pl-err').textContent = 'Ya existe un lugar con ese nombre.');
    const { error } = isNew ? await sb.from('stock_places').insert({ ...row, org_id: me.org_id }) : await sb.from('stock_places').update(row).eq('id', cur.id);
    if (error) return void ($('#pl-err').textContent = errText(error)); m.close(); stkInval(); toast('Lugar guardado'); route(); };
}
function stkPlaceClose(p){
  const B = STK.base, as = B.assets.filter(a => a.place_id === p.id).length, ms = stkBalances().filter(b => b.place === p.id && b.qty > 0);
  const others = B.places.filter(x => x.active && x.id !== p.id);
  const m = modal(`<h2>📦 Desarmar ${esc(p.name)}</h2>
    ${as || ms.length ? `<p>Todavía tiene <b>${as} activo${as === 1 ? '' : 's'}</b> y <b>${ms.length} material${ms.length === 1 ? '' : 'es'}</b> con saldo. Elegí a dónde se mueve todo:</p>
      <select id="pc-to">${others.map(x => `<option value="${x.id}">${(STK_PLACE_KIND[x.kind] || STK_PLACE_KIND.otro)[0]} ${esc(x.name)}</option>`).join('')}</select>` : '<p>Está vacío: se puede desarmar.</p>'}
    <p class="muted sm">El lugar sale de las listas, pero queda en el historial para saber qué pasó por ahí.</p>
    <div class="err" id="pc-err"></div><div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn sec" id="pc-x">Cancelar</button><button class="btn" id="pc-ok">Desarmar</button></div>`);
  $('#pc-x').onclick = m.close;
  $('#pc-ok').onclick = async () => { if ((as || ms.length) && !others.length) return void ($('#pc-err').textContent = 'Primero creá otro lugar para mover lo que hay.');
    $('#pc-ok').disabled = true;
    const { data, error } = await sb.rpc('stock_place_close', { p_place: p.id, p_to: $('#pc-to')?.value || null });
    if (error){ $('#pc-err').textContent = errText(error); $('#pc-ok').disabled = false; return; }
    m.close(); stkInval(); toast(`Desarmado. Se movieron ${data?.activos ?? 0} activos y ${data?.materiales ?? 0} materiales.`); route(); };
}

/* ---------- etiquetas QR ---------- */
async function stkLabels(list){
  if (!list.length) return;
  try { await needLib('qr'); } catch (e){ return toast(errText(e)); }
  const svg = t => { const q = qrcode(0, 'M'); q.addData(t); q.make(); const n = q.getModuleCount(); let p = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) p += `M${c + 2} ${r + 2}h1v1h-1z`;
    return `<svg viewBox="0 0 ${n + 4} ${n + 4}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"><rect width="${n + 4}" height="${n + 4}" fill="#fff"/><path d="${p}" fill="#000"/></svg>`; };
  const link = a => `${location.origin}${location.pathname}#/stock/a/${a.id}`;
  const html = list.slice(0, 200).map(a => `<div class="stk-lbl">${svg(link(a))}<b>${esc(a.code)}</b><small>${esc([a.type, a.name].filter(Boolean).join(' · ').slice(0, 60))}</small></div>`).join('');
  const m = modal(`<div class="row between"><h2 style="margin:0">🏷️ Etiquetas QR (${Math.min(list.length, 200)})</h2><div class="row" style="gap:6px"><button class="btn" id="lb-p">🖨 Imprimir</button><button class="btn sec" id="lb-x">Cerrar</button></div></div>
    <p class="muted sm">Pegalas en el equipo. Al escanearlas con la app se abre su ficha.</p><div class="stk-lbls">${html}</div>`, { wide: true });
  $('#lb-x').onclick = m.close;
  $('#lb-p').onclick = () => { let pr = document.getElementById('stk-print'); if (!pr){ pr = document.createElement('div'); pr.id = 'stk-print'; document.body.appendChild(pr); }
    pr.innerHTML = `<div class="stk-lbls">${html}</div>`; document.body.classList.add('stk-printing'); setTimeout(() => { window.print(); document.body.classList.remove('stk-printing'); }, 100); };
}

/* ---------- escanear QR o código de barras ---------- */
async function stkScan(onText){
  const m = modal(`<h2>📷 Escanear</h2><div class="stk-scan"><video id="sk-v" playsinline muted></video></div><p class="muted sm" id="sk-m" style="text-align:center">Apuntá al QR o al código de barras del equipo.</p>
    <div class="row" style="justify-content:space-between"><input id="sk-t" placeholder="…o escribilo" maxlength="120" style="max-width:220px"><div class="row" style="gap:6px"><button class="btn sec" id="sk-ok">Usar</button><button class="btn sec" id="sk-x">Cerrar</button></div></div>`);
  let stream = null, alive = true;
  const stop = () => { alive = false; try { stream?.getTracks().forEach(t => t.stop()); } catch {} };
  const done = t => { stop(); m.close(); onText(String(t).trim().slice(0, 300)); };
  $('#sk-x').onclick = () => { stop(); m.close(); };
  $('#sk-ok').onclick = () => { const t = $('#sk-t').value.trim(); if (t) done(t); };
  const obs = new MutationObserver(() => { if (!document.getElementById('sk-v')){ stop(); obs.disconnect(); } }); obs.observe($('#modal-root'), { childList: true });
  try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }); }
  catch { $('#sk-m').textContent = 'No se pudo usar la cámara. Revisá el permiso del navegador, o escribí el código.'; return; }
  const video = $('#sk-v'); if (!video){ stop(); return; } video.srcObject = stream; await video.play().catch(() => {});
  let det = null;
  try { if ('BarcodeDetector' in window){ const f = await BarcodeDetector.getSupportedFormats(); det = new BarcodeDetector({ formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'data_matrix', 'ean_8', 'upc_a'].filter(x => f.includes(x)) }); } } catch {}
  if (!det) needLib('jsqr').catch(() => {});
  const cv = document.createElement('canvas'), cx = cv.getContext('2d', { willReadFrequently: true });
  const tick = async () => { if (!alive) return; let txt = null;
    try { if (det){ const r = await det.detect(video); txt = r[0]?.rawValue || null; }
      else if (typeof jsQR === 'function' && video.videoWidth){ const W = 480, H = Math.round(video.videoHeight * 480 / video.videoWidth); cv.width = W; cv.height = H; cx.drawImage(video, 0, 0, W, H); txt = jsQR(cx.getImageData(0, 0, W, H).data, W, H)?.data || null; } } catch {}
    if (txt) return done(txt);
    setTimeout(tick, 220); };
  tick();
}

/* ---------- Excel: exportar ---------- */
async function stkExport(list, sc, cat){
  const B = STK.base, extraKeys = [...new Set(list.flatMap(a => Object.keys(a.extra || {})))].slice(0, 30);
  const head = ['Identificación única', 'Tipo', 'Nombre mostrado', 'Estado', 'Site Name', 'Vendor', 'Models', 'Propiedad', 'Fecha de Activacion', 'Fecha de Desactivacion', 'Comentarios', 'Categoría', 'Stock', 'Responsable', 'Calibración / service', 'Identificación interna', ...extraKeys];
  const rows = list.map(a => [a.code, a.type, a.name || '', a.status, stkLoc(a).name, a.vendor || '', a.model || '', a.owner || '', a.activated_on || '', a.deactivated_on || '', a.notes || '', STK_CAT[a.cat]?.[1] || a.cat,
    a.project_id ? stkProjName(a.project_id) : 'Stock general', stkHolder(a) || '', a.service_due || '', a.ext_id || '', ...extraKeys.map(k => a.extra?.[k] ?? '')]);
  const sheets = [['Activos', [head, ...rows], [22, 18, 36, 14, 30, 12, 12, 12, 12, 12, 40, 12, 22, 20, 12, 20, ...extraKeys.map(() => 18)]]];
  if (list.length && list.length <= 2000 && online()){
    try { const ids = list.map(a => a.id), evs = [];
      for (let i = 0; i < ids.length; i += 100){ const { data } = await sb.from('asset_events').select('asset_id,at,by_name,kind,field,old_v,new_v').in('asset_id', ids.slice(i, i + 100)).limit(5000); evs.push(...(data || [])); }
      const code = new Map(list.map(a => [a.id, a.code]));
      sheets.push(['Historial', [['ID único', 'Fecha', 'Quién', 'Cambio', 'Antes', 'Después'], ...evs.sort((x, y) => (x.at > y.at ? 1 : -1)).map(e => [code.get(e.asset_id), fmtDT(e.at), e.by_name || '', stkEvTitle(e), e.old_v || '', e.new_v || ''])], [22, 16, 18, 26, 30, 40]]);
    } catch {}
  }
  xlSave(`${STK_CAT[cat][2]} ${sc.kind === 'prj' ? stkProjName(sc.id) : sc.kind === 'gen' ? 'stock general' : 'lugar'} ${todayStr()}`, sheets);
}

/* ---------- Excel: importar (reconoce las columnas exportadas de SafetyCulture) ---------- */
const STK_COLS = { code: ['identificacion unica', 'id unico', 'numero de serie', 'nro de serie', 'serie', 'serial', 'codigo', 'id'], ext_id: ['identificacion interna'], archived: ['archivado'],
  loc: ['site name', 'sitio', 'lugar', 'ubicacion', 'deposito', 'donde esta'], type: ['tipo'], name: ['nombre mostrado', 'nombre', 'descripcion'], vendor: ['vendor', 'marca', 'fabricante'], model: ['models', 'model', 'modelo'],
  owner: ['propiedad', 'propietario'], activated_on: ['fecha de activacion', 'activacion'], deactivated_on: ['fecha de desactivacion', 'desactivacion'], notes: ['comentarios', 'notas', 'observaciones'], status: ['estado'],
  cat: ['categoria'], project: ['stock', 'proyecto'], holder: ['responsable', 'asignada a', 'asignado a'], service_due: ['calibracion / service', 'calibracion', 'service', 'vencimiento calibracion'] };
const STK_IGNORE = ['fecha de creacion', 'fecha de modificacion', 'fecha de la ultima inspeccion', 'enlace', 'id de site name', 'grupo de estados'];
async function stkImport(file, sc, defCat){
  let wb; try { wb = await readWorkbook(file); } catch (e){ return toast(errText(e)); }
  const B = STK.base, rows = sheetRows(wb.Sheets[wb.SheetNames[0]]);
  if (rows.length < 2) return toast('La planilla está vacía.');
  const hdr = rows[0].map(h => stkNorm(h)), col = {}; const extraCols = [];
  hdr.forEach((h, i) => { if (!h) return; const k = Object.entries(STK_COLS).find(([, al]) => al.includes(h))?.[0]; if (k && col[k] === undefined) col[k] = i; else if (!k && !STK_IGNORE.includes(h)) extraCols.push([String(rows[0][i]).trim().slice(0, 60), i]); });
  if (col.code === undefined) return toast('No encontré la columna del ID único ("Identificación única", "ID único" o "Número de serie").');
  const g = (r, k) => col[k] === undefined ? '' : xlStr(r[col[k]]);
  const byCode = new Map(B.assets.map(a => [stkNorm(a.code), a]));
  const placeByName = new Map(B.places.map(p => [stkNorm(p.name), p])), siteByName = new Map(B.sites.map(s => [stkNorm(s.name), s])), projByName = new Map(B.projects.map(p => [stkNorm(p.name), p]));
  const staffByName = new Map(B.staff.map(s => [stkNorm(s.name), s]));
  const items = [], errs = [], newPlaces = new Set(), seen = new Set();
  rows.slice(1).forEach((r, k) => {
    const code = g(r, 'code').slice(0, 120); if (!code) return;
    if (seen.has(stkNorm(code))){ errs.push(`Fila ${k + 2}: el ID ${code} está repetido en la planilla`); return; } seen.add(stkNorm(code));
    const type = g(r, 'type').slice(0, 80), ex = byCode.get(stkNorm(code));
    if (!type && !ex){ errs.push(`Fila ${k + 2}: falta el Tipo de ${code}`); return; }
    const locN = g(r, 'loc'); if (locN && !placeByName.has(stkNorm(locN)) && !siteByName.has(stkNorm(locN))) newPlaces.add(locN.slice(0, 120));
    const catT = stkNorm(g(r, 'cat')); const projN = g(r, 'project');
    const extra = {}; extraCols.forEach(([n, i]) => { const x = xlStr(r[i]); if (x) extra[n] = x.slice(0, 200); });
    items.push({ ex, row: { code, type: type || ex?.type, ext_id: g(r, 'ext_id').slice(0, 80) || null, name: g(r, 'name').slice(0, 200) || null, vendor: g(r, 'vendor').slice(0, 80) || null, model: g(r, 'model').slice(0, 80) || null,
      owner: g(r, 'owner').slice(0, 60) || null, notes: g(r, 'notes').slice(0, 1000) || null, status: g(r, 'status').slice(0, 40) || null,
      activated_on: col.activated_on !== undefined ? xlDate(r[col.activated_on]) : undefined, deactivated_on: col.deactivated_on !== undefined ? xlDate(r[col.deactivated_on]) : undefined,
      service_due: col.service_due !== undefined ? xlDate(r[col.service_due]) : undefined,
      archived: col.archived !== undefined ? /^(true|si|sí|1|verdadero)$/i.test(g(r, 'archived')) : undefined,
      cat: catT ? (/herr/.test(catT) ? 'herramienta' : 'equipo') : undefined, extra },
      locN, projN, holderN: g(r, 'holder') });
  });
  const nNew = items.filter(x => !x.ex).length, nUpd = items.length - nNew;
  const projBad = [...new Set(items.filter(x => x.projN && stkNorm(x.projN) !== 'stock general' && !projByName.has(stkNorm(x.projN))).map(x => x.projN))];
  const m = modal(`<h2>⬆ Importar activos</h2>
    <div class="stk-kpis"><div class="stk-kpi" style="border-left-color:#166534"><span>✨ Nuevos</span><b>${nNew}</b></div><div class="stk-kpi" style="border-left-color:#1E40AF"><span>🔄 Se actualizan</span><b>${nUpd}</b><small>mismo ID único</small></div>
      <div class="stk-kpi" style="border-left-color:#991B1B"><span>⚠ Con error</span><b>${errs.length}</b><small>no se cargan</small></div></div>
    <p class="sm">Columnas reconocidas: ${Object.keys(col).map(k => `<span class="pill p-info" style="margin:2px">${esc(rows[0][col[k]])}</span>`).join('')}${extraCols.length ? `<br>Como campos adicionales: ${extraCols.map(([n]) => `<span class="pill" style="margin:2px">${esc(n)}</span>`).join('')}` : ''}</p>
    ${newPlaces.size ? `<label style="display:flex;gap:8px;align-items:flex-start;margin-top:8px"><input type="checkbox" id="im-np" checked style="width:auto;margin-top:3px"><span>Crear como <b>depósitos</b> los lugares que no existen: ${[...newPlaces].slice(0, 12).map(n => `<span class="pill" style="margin:2px">🏬 ${esc(n)}</span>`).join('')}${newPlaces.size > 12 ? '…' : ''}</span></label>` : ''}
    <label>Los nuevos van a</label><select id="im-sc"><option value="">🏢 Stock general</option>${B.projects.filter(p => p.active).map(p => `<option value="${p.id}" ${stkScopeProj(sc) === p.id ? 'selected' : ''}>📁 Proyecto ${esc(p.name)}</option>`).join('')}</select>
    <p class="muted sm">${col.project !== undefined ? 'Si la fila trae la columna Stock / Proyecto, se usa esa. ' : ''}Categoría por defecto: <b>${STK_CAT[defCat][2]}</b>. Si un activo ya existe, se actualizan sus datos y el cambio queda en su historial.</p>
    ${projBad.length ? `<p class="sm" style="color:var(--amber)">Proyectos que no encontré (esas filas van al destino elegido): ${projBad.slice(0, 6).map(esc).join(', ')}</p>` : ''}
    ${errs.length ? `<details><summary class="sm" style="cursor:pointer;color:var(--red)">Ver errores (${errs.length})</summary><div class="sm" style="max-height:160px;overflow:auto">${errs.slice(0, 200).map(e => `<div>${esc(e)}</div>`).join('')}</div></details>` : ''}
    <div class="progress hidden" id="im-pg" style="height:10px;margin-top:10px"><i style="width:0"></i></div><div class="err" id="im-err"></div>
    <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn sec" id="im-x">Cancelar</button><button class="btn" id="im-ok" ${items.length ? '' : 'disabled'}>Importar ${items.length}</button></div>`, { wide: true });
  $('#im-x').onclick = m.close;
  $('#im-ok').onclick = async () => {
    $('#im-ok').disabled = true; $('#im-pg').classList.remove('hidden'); const bar = $('#im-pg i'), err = $('#im-err');
    try {
      if (newPlaces.size && $('#im-np')?.checked){
        const { data, error } = await sb.from('stock_places').insert([...newPlaces].map(n => ({ org_id: me.org_id, name: n, kind: 'deposito' }))).select('*'); if (error) throw error;
        (data || []).forEach(p => placeByName.set(stkNorm(p.name), p));
      }
      const dest = $('#im-sc').value || null; let done = 0, fails = 0; const ins = [];
      const resolve = x => { const r = { ...x.row }; Object.keys(r).forEach(k => r[k] === undefined && delete r[k]);
        if (x.locN){ const p = placeByName.get(stkNorm(x.locN)), s = siteByName.get(stkNorm(x.locN)); if (p){ r.place_id = p.id; r.site_id = null; } else if (s){ r.site_id = s.id; r.place_id = null; } }
        if (x.projN){ const p = projByName.get(stkNorm(x.projN)); if (p) r.project_id = p.id; else if (stkNorm(x.projN) === 'stock general') r.project_id = null; }
        if (x.holderN){ const h = staffByName.get(stkNorm(x.holderN)); if (h) r.holder_staff_id = h.id; }
        if (!Object.keys(r.extra || {}).length) delete r.extra;
        return r; };
      for (const x of items){
        const r = resolve(x);
        if (x.ex){ if (r.extra) r.extra = { ...(x.ex.extra || {}), ...r.extra }; if (!r.status) delete r.status;
          const { error } = await sb.from('assets').update(r).eq('id', x.ex.id); if (error){ fails++; errs.push(`${x.row.code}: ${errText(error)}`); } done++; }
        else ins.push({ org_id: me.org_id, cat: defCat, project_id: dest, ...r, status: r.status || stkStatuses(r.cat || defCat)[0] });
        if (done % 10 === 0) bar.style.width = Math.round(done * 100 / items.length) + '%';
      }
      for (let i = 0; i < ins.length; i += 200){ const { error } = await sb.from('assets').insert(ins.slice(i, i + 200)); if (error){ fails += Math.min(200, ins.length - i); errs.push(errText(error)); } done += Math.min(200, ins.length - i); bar.style.width = Math.round(done * 100 / items.length) + '%'; }
      stkInval();
      if (fails){ err.textContent = `${fails} no se pudieron guardar: ${errs.slice(-3).join(' · ')}`; $('#im-x').textContent = 'Cerrar'; $('#im-x').onclick = () => { m.close(); route(); }; return; }
      m.close(); toast(`Listo: ${nNew} nuevos y ${nUpd} actualizados.`); route();
    } catch (e){ err.textContent = errText(e); $('#im-ok').disabled = false; }
  };
}

/* ---------- integrantes del proyecto (lo abre la pantalla del proyecto) ---------- */
async function stkMembers(p){
  if (!needOnline()) return;
  const [{ data: mem, error }, { data: users }] = await Promise.all([sb.rpc('proj_members', { p_project: p.id }), sb.from('profiles').select('id,full_name,email,role,active').eq('active', true).order('full_name')]);
  if (error) return toast(errText(error));
  const manage = typeof permCanManage === 'function' && permCanManage() && canWrite();
  const ids = new Set((mem || []).map(x => x.user_id));
  const R = typeof ROLE_TXT !== 'undefined' ? ROLE_TXT : {};
  const cand = (users || []).filter(u => !ids.has(u.id) && u.role !== 'admin' && u.role !== 'contratista');
  const m = modal(`<h2>👥 Integrantes · ${esc(p.name)}</h2>
    <p class="muted sm">Solo los integrantes ven este proyecto (el administrador ve todos). Quien lo creó queda siempre. Los técnicos lo ven también cuando tienen una tarea o un ticket del proyecto.</p>
    <div class="tblwrap"><table class="tbl"><tbody>${(mem || []).map(x => `<tr><td><b>${esc(x.full_name || x.email)}</b><div class="muted sm">${esc(R[x.role] || x.role)}${x.creator ? ' · <b>creó el proyecto</b>' : ''} · ${esc(x.added_by || '')}</div></td>
      <td class="num">${manage && !x.creator ? `<button class="btn sec small" data-rm="${x.user_id}" style="color:var(--red)">Quitar</button>` : ''}</td></tr>`).join('') || '<tr><td class="muted">Todavía no hay integrantes.</td></tr>'}</tbody></table></div>
    ${manage ? `<label>Agregar integrante</label><div class="row" style="gap:6px;flex-wrap:nowrap"><select id="pm-u" style="flex:1">${cand.map(u => `<option value="${u.id}">${esc(u.full_name || u.email)} · ${esc(R[u.role] || u.role)}</option>`).join('')}</select><button class="btn" id="pm-add" style="margin:0" ${cand.length ? '' : 'disabled'}>+ Agregar</button></div>`
      : '<p class="muted sm">Los integrantes los asigna el administrador.</p>'}
    <div class="err" id="pm-err"></div><div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn sec" id="pm-x">Cerrar</button></div>`, { wide: true });
  $('#pm-x').onclick = m.close;
  $('#pm-add')?.addEventListener('click', async () => { const u = $('#pm-u').value; if (!u) return;
    const { error } = await sb.from('project_members').insert({ project_id: p.id, user_id: u, org_id: me.org_id }); if (error) return void ($('#pm-err').textContent = errText(error)); toast('Integrante agregado'); stkMembers(p); });
  m.el.querySelectorAll('[data-rm]').forEach(b => b.onclick = async () => { if (!confirm('¿Quitar a esta persona del proyecto? Deja de verlo.')) return;
    const { error } = await sb.from('project_members').delete().eq('project_id', p.id).eq('user_id', b.dataset.rm); if (error) return void ($('#pm-err').textContent = errText(error)); toast('Quitado'); stkMembers(p); });
}
