/* =========================================================
   🌐 RED DE FIBRA (Herramientas → Red, y dentro de cada proyecto) · v5.20
   Cada red pertenece a un proyecto. Dos tipos:
     troncal: nodos (tipo 1 a 4), cables de N pelos en buffers, botellas de empalme
     ftth:    OLT → botellas → cajas con splitters → AP (el árbol sale del código del AP)
   Todo se ve y se edita sobre el mapa. Los cambios los registra el técnico y los confirma
   supervisor / coordinador / PM / administrador (net_apply · net_decide en el servidor).
   ========================================================= */
const RD = { net: null, els: [], cbs: [], ch: [], tool: 'sel', sel: null, map: null, lay: null, light: null, draw: null, addKind: null };
const RD_FIB = [['azul', '#1D4ED8'], ['naranja', '#EA7A0C'], ['verde', '#16A34A'], ['marrón', '#7A4A22'], ['gris', '#8A949C'], ['blanco', '#F4F4F4'], ['rojo', '#DC2626'], ['negro', '#1B1B1B'], ['amarillo', '#EAB308'], ['violeta', '#7C3AED'], ['rosa', '#EC6FA8'], ['celeste', '#38BDF8']];
const RD_TIPOS = { 1: { n: 'Tipo 1 · Data center', drop: 'all', dist: 'Distribuidores para todos los buffers' }, 2: { n: 'Tipo 2', drop: [0, 1, 4], dist: 'Distribuidor de 96 hilos' }, 3: { n: 'Tipo 3', drop: [0, 1, 4], dist: 'Distribuidor de 96 hilos (2 buffers G.652 + 1 G.655)' }, 4: { n: 'Tipo 4', drop: [0, 1], dist: 'Distribuidor de 48 hilos (2 buffers)' } };
const RD_KIND = { nodo: 'Nodo', botella: 'Botella de empalme', caja: 'Caja (CDO / NAP)', ap: 'AP', olt: 'OLT', reserva: 'Reserva de cable', poste: 'Poste', otro: 'Otro' };
const RD_ST = { serv: 'en servicio', libre: 'libre', res: 'reserva', cort: 'cortado' };
const rdMgr = () => isManager() && canWrite();
const rdEdit = () => canWrite() && !isContractor();
const rdEl = id => RD.els.find(e => e.id === id), rdCb = id => RD.cbs.find(c => c.id === id);
const rdLL = e => [e.lng, e.lat];
const rdName = e => e.code || e.name || RD_KIND[e.kind];
const rdLen = c => c.length_m != null ? +c.length_m : (c.path.length > 1 ? cumOf(c.path).pop() : 0);
const rdKm = m => (m / 1000).toFixed(3).replace('.', ',') + ' km';
const rdPl = (n, a, b) => `${n} ${n === 1 ? a : b}`;
const rdBufN = c => Math.ceil(c.fibers / c.per_buffer);
const rdFt = (c, i) => c.props?.ft?.[i] || (c.fibers === 96 && c.per_buffer === 12 ? (i < 4 ? 'G.652' : 'G.655') : '');
const rdFName = (c, f) => `B${Math.floor(f / c.per_buffer) + 1}·${f % c.per_buffer + 1}`;
const rdFLong = (c, f) => `pelo ${f + 1} (B${Math.floor(f / c.per_buffer) + 1} ${RD_FIB[Math.floor(f / c.per_buffer) % 12][0]}, ${RD_FIB[f % c.per_buffer % 12][0]})`;
const rdDot = (c, f) => `<span class="rd-dot" style="background:${RD_FIB[f % c.per_buffer % 12][1]}"></span>`;
const rdCableOf = b => rdCb(b.cable_id) || { id: null, fibers: RD.net.cfg?.fibers || 96, per_buffer: RD.net.cfg?.per_buffer || 12, props: {}, path: [] };
const rdSp = b => ({ map: {}, out: {}, loss: {}, ...(b.props?.sp || {}) });
const rdMapOf = (sp, f) => sp.map[f] != null ? +sp.map[f] : f;
const rdUse = (c, f) => c.props?.use?.[f]?.s || 'libre';
const rdOut = (b, c, sp, g) => sp.out[g] || rdUse(c, g);
const rdCutN = b => { const c = rdCableOf(b), sp = rdSp(b); let n = 0; for (const f of Object.keys(sp.out)) if (sp.out[f] === 'cort' && rdUse(c, +f) === 'serv' && rdMapOf(sp, +f) === +f) n++; return n; };
const rdDropOf = n => { const t = RD_TIPOS[n.props?.tipo]; if (Array.isArray(n.props?.drop)) return n.props.drop; if (!t) return []; if (t.drop !== 'all') return t.drop; const nb = Math.max(8, ...RD.cbs.filter(c => c.a_id === n.id || c.b_id === n.id).map(rdBufN)); return [...Array(nb).keys()]; };
const rdNbOf = n => Math.max(8, ...RD.cbs.filter(c => c.a_id === n.id || c.b_id === n.id).map(rdBufN));
// corte de tramo óptico: todos los buffers terminan en el ODF del nodo (la fibra se corta cada ~100 km por el alcance de los equipos de medición)
const rdIsCut = n => n && n.kind === 'nodo' && rdDropOf(n).filter(b => b < rdNbOf(n)).length >= rdNbOf(n);
const rdPorts = c => +(String(c.props?.n2 || '1x8').split('x')[1]) || 8;
const rdKids = id => RD.els.filter(e => e.parent_id === id);
const rdOuts = c => (c.props?.outs && typeof c.props.outs === 'object') ? c.props.outs : {};
const rdFree = c => { const used = [...rdKids(c.id).filter(e => e.kind === 'ap').map(e => e.port), ...Object.keys(rdOuts(c)).map(Number)]; return [...Array(rdPorts(c))].map((_, i) => i + 1).filter(p => !used.includes(p)); };
const rdPend = id => RD.ch.some(h => h.status === 'pendiente' && h.target_id === id);
const rdNear = (ll, list) => list.reduce((b, e) => { const d = havm(ll, rdLL(e)); return !b || d < b.d ? { e, d } : b; }, null);

function rdCss(){
  if (document.getElementById('rd-css')) return;
  const s = document.createElement('style'); s.id = 'rd-css';
  s.textContent = `
.rd-top{display:flex;gap:8px 12px;align-items:center;flex-wrap:wrap;margin-bottom:8px}.rd-top h1{margin:0;font-size:20px}.rd-top > *{min-width:0}
.rd-tools{display:inline-flex;border:1px solid var(--line);border-radius:10px;overflow:hidden;flex-wrap:wrap;background:var(--card)}
.rd-tools button{border:0;border-right:1px solid var(--line);background:transparent;padding:7px 10px;font:inherit;cursor:pointer;color:inherit;white-space:nowrap}
.rd-tools button:last-child{border-right:0}.rd-tools button.on{background:var(--navy);color:#fff;font-weight:600}
.rd-chip{font-size:12px;border-radius:20px;padding:3px 10px;background:#EEF2F7;color:var(--muted);white-space:nowrap;display:inline-block}
.rd-chip.ok{background:var(--ok-bg);color:var(--green-d)}.rd-chip.warn{background:var(--amber-bg);color:var(--amber)}.rd-chip.bad{background:#FDE8E8;color:var(--red)}
.rd-main{display:grid;grid-template-columns:minmax(0,1fr) 400px;gap:10px;align-items:start}
.rd-mapw{position:relative;min-width:0}#rd-map{height:calc(100vh - 235px);min-height:430px;border-radius:14px;border:1px solid var(--line);z-index:1}
.rd-hint{position:absolute;left:50%;top:10px;transform:translateX(-50%);background:var(--navy);color:#fff;border-radius:20px;padding:6px 12px;font-size:13px;z-index:500;max-width:calc(100% - 110px);text-align:center;display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center}
.rd-hint button{border:1px solid rgba(255,255,255,.5);background:transparent;color:#fff;border-radius:14px;padding:2px 9px;font:inherit;font-size:12.5px;cursor:pointer}
.rd-side{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;display:grid;gap:10px;align-content:start;max-height:calc(100vh - 235px);min-height:430px;overflow:auto;min-width:0}
.rd-side h2{margin:0;font-size:17px}.rd-side h3{margin:0;font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}.rd-side p{margin:0}
.rd-kv{display:grid;grid-template-columns:auto minmax(0,1fr);gap:4px 12px;font-size:13px;margin:0}.rd-kv dt{color:var(--muted)}.rd-kv dd{margin:0}
.rd-row{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.rd-item{border:1px solid var(--line);border-radius:10px;padding:7px 9px;display:grid;gap:3px;font-size:13px;background:var(--card);text-align:left;font-family:inherit;color:inherit;width:100%}
button.rd-item{cursor:pointer}.rd-item.pend{border-left:4px solid var(--amber)}.rd-item.ok{border-left:4px solid var(--green)}.rd-item.rej{border-left:4px solid var(--red);opacity:.7}
.rd-alert{border-radius:10px;padding:8px 10px;font-size:13px;background:var(--amber-bg);color:var(--amber)}.rd-alert.bad{background:#FDE8E8;color:var(--red)}.rd-alert.ok{background:var(--ok-bg);color:var(--green-d)}
.rd-buf{border:1px solid var(--line);border-radius:10px;overflow:hidden}
.rd-bh{width:100%;display:flex;gap:8px;align-items:center;border:0;background:var(--card);padding:7px 9px;text-align:left;font:inherit;cursor:pointer;color:inherit}
.rd-sw{width:14px;height:14px;border-radius:4px;border:1px solid rgba(0,0,0,.25);flex:none}
.rd-fr{display:grid;grid-template-columns:70px minmax(0,1fr) 70px 42px;align-items:center;gap:6px;padding:4px 9px;border:0;border-top:1px solid var(--line);font:inherit;font-size:12.5px;background:transparent;width:100%;text-align:left;cursor:pointer;color:inherit;font-variant-numeric:tabular-nums}
.rd-fr:hover,.rd-fr.sel{background:#F1F5F9}.rd-fr.sel{box-shadow:inset 3px 0 0 var(--s1)}
.rd-fc{display:inline-flex;align-items:center;gap:5px;white-space:nowrap}.rd-dot{width:11px;height:11px;border-radius:50%;border:1px solid rgba(0,0,0,.3);flex:none;display:inline-block}
.rd-fl{height:3px;border-radius:2px;background:var(--line)}.rd-fl.serv{background:var(--green)}.rd-fl.res{background:var(--amber)}.rd-fl.der{background:var(--s1)}
.rd-fl.cort{background:repeating-linear-gradient(90deg,var(--red) 0 6px,transparent 6px 10px)}
.rd-act{padding:8px 9px;border-top:1px solid var(--line);background:#F1F5F9;display:grid;gap:8px;font-size:13px}
.rd-pick{display:grid;grid-template-columns:repeat(auto-fill,minmax(62px,1fr));gap:5px}
.rd-pick button{border:1px solid var(--line);background:var(--card);border-radius:8px;padding:5px 3px;font:inherit;font-size:12px;display:flex;gap:4px;align-items:center;justify-content:center;cursor:pointer;color:inherit}
.rd-use{display:grid;grid-template-columns:repeat(12,1fr);gap:3px}.rd-use button{aspect-ratio:1;border:1px solid var(--line);border-radius:5px;font:inherit;font-size:10px;cursor:pointer;background:var(--card);color:inherit;padding:0}
.rd-use button.serv{background:var(--green);color:#fff;border-color:var(--green)}.rd-use button.res{background:var(--amber);color:#fff;border-color:var(--amber)}
.rd-parts{display:flex;gap:4px;flex-wrap:wrap}.rd-parts span{border:1px solid var(--line);border-radius:7px;padding:3px 7px;font-size:11.5px;text-align:center}.rd-parts b{display:block;font-family:ui-monospace,monospace;font-size:13px}
.rd-uni{overflow:auto;border:1px solid var(--line);border-radius:10px;background:#fff;max-height:70vh}
.rd-mk{display:grid;place-items:center;color:#fff;font-weight:700;font-size:11px;box-shadow:0 0 0 2px #fff,0 1px 4px rgba(0,0,0,.4);box-sizing:border-box}
.rd-mk.sel{box-shadow:0 0 0 2px #fff,0 0 0 5px #2563EB}.rd-mk.pend{outline:2px dashed #B45309;outline-offset:3px}
.rd-lab{background:rgba(255,255,255,.88);border:0;box-shadow:none;font-size:11px;font-weight:600;padding:0 3px;color:#12222E}.rd-lab::before{display:none}
.rd-df td,.rd-df th{font-size:12.5px;padding:5px 6px;vertical-align:top}
.rd-nets{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px}
@media(max-width:900px){.rd-main{grid-template-columns:minmax(0,1fr)}#rd-map{height:52vh;min-height:320px}.rd-side{max-height:none;min-height:0}}`;
  document.head.appendChild(s);
}

/* ---------- lista de redes (por proyecto) ---------- */
async function viewRed(v, a, b){
  rdCss();
  if (a && a !== 'p') return rdOpen(v, a);
  let nets, projects;
  try { [nets, projects] = await Promise.all([cached('net-list', () => sb.from('net_networks').select('id,project_id,name,kind,asof,asof_note,updated_at').order('name')), loadProjects().catch(() => [])]); }
  catch (e){ if (/net_networks|relation|schema cache/i.test(e.message || '')){ v.innerHTML = '<div class="card"><h2>🌐 Red de fibra</h2><p>Falta cargar <b>35_red.sql</b> en Supabase (SQL Editor). Avisale al administrador.</p></div>'; return; } throw e; }
  const only = a === 'p' ? b : null, sc = typeof scopeGet === 'function' ? scopeGet() : null;
  const prOf = id => projects.find(p => p.id === id);
  let list = nets.filter(n => only ? n.project_id === only : true);
  if (!only && sc && sc.p && sc.p.length) list = list.filter(n => sc.p.includes(n.project_id));
  const groups = new Map(); list.forEach(n => { if (!groups.has(n.project_id)) groups.set(n.project_id, []); groups.get(n.project_id).push(n); });
  v.innerHTML = `<div class="rd-top"><div><div class="muted sm"><a href="#/tools">Herramientas</a> › Red de fibra${only && prOf(only) ? ' › ' + esc(prOf(only).name) : ''}</div><h1>🌐 Red de fibra</h1></div><span style="flex:1"></span>
    ${rdMgr() ? '<button class="btn" id="rd-new">＋ Nueva red</button>' : ''}</div>
    ${typeof scopeBanner === 'function' && !only && list.length < nets.length ? scopeBanner(list.length, nets.length, 'redes') : ''}
    <p class="muted sm" style="margin:0 0 10px">Cada red pertenece a un proyecto. Troncales: nodos, cables y botellas de empalme. FTTH: OLT, botellas, cajas con splitters y AP. Todo se ve y se modifica sobre el mapa.</p>
    ${[...groups.entries()].map(([pid, ns]) => `<h3 style="margin:14px 0 6px">📁 ${esc(prOf(pid)?.name || 'Proyecto')}</h3><div class="rd-nets">${ns.map(n => `<a class="card" href="#/red/${n.id}" style="text-decoration:none;color:inherit;margin:0;border-left:5px solid ${n.kind === 'troncal' ? '#1D4ED8' : '#EA7A0C'}">
      <div class="row between" style="flex-wrap:nowrap"><h2 style="margin:0;font-size:17px">${esc(n.name)}</h2><span class="rd-chip">${n.kind === 'troncal' ? 'Troncal' : 'FTTH'}</span></div>
      <div class="muted sm" style="margin-top:4px">${n.asof ? 'Actualizada al ' + esc(rdD(n.asof)) + (n.asof_note ? ' · ' + esc(n.asof_note) : '') : 'Sin cargas de información todavía'}</div></a>`).join('')}</div>`).join('')
      || `<div class="card muted">${only ? 'Este proyecto todavía no tiene una red cargada.' : 'Todavía no hay redes.'} ${rdMgr() ? 'Creá la primera con <b>＋ Nueva red</b> y después subí el KMZ.' : ''}</div>`}`;
  $('#rd-new')?.addEventListener('click', () => {
    const ps = projects.filter(p => p.active !== false);
    if (!ps.length) return toast('Primero creá el proyecto.');
    const m = modal(`<h2>＋ Nueva red</h2><label>Proyecto</label><select id="rn-p">${ps.map(p => `<option value="${p.id}" ${p.id === only ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
      <label>Nombre de la red</label><input id="rn-n" maxlength="120" placeholder="Ej.: Troncal Renglón 3 · Barrios OLT 5">
      <label>Tipo</label><select id="rn-k"><option value="troncal">Troncal: nodos, cables y botellas de empalme</option><option value="ftth">FTTH: OLT, botellas, cajas con splitters y AP</option></select>
      <div class="grid2"><div><label>Pelos del cable principal</label><select id="rn-f">${[12, 24, 48, 96, 144].map(x => `<option ${x === 96 ? 'selected' : ''}>${x}</option>`).join('')}</select></div><div><label>Pelos por buffer</label><select id="rn-b">${[6, 12].map(x => `<option ${x === 12 ? 'selected' : ''}>${x}</option>`).join('')}</select></div></div>
      <p class="muted sm">Es el valor por defecto; cada cable puede tener otra cantidad.</p><div class="err" id="rn-e"></div>
      <div class="row" style="justify-content:flex-end;gap:6px"><button class="btn sec" id="rn-x">Cancelar</button><button class="btn" id="rn-ok">Crear</button></div>`);
    $('#rn-x').onclick = m.close;
    $('#rn-ok').onclick = async () => { const name = $('#rn-n').value.trim(); if (!name) return void ($('#rn-e').textContent = 'Falta el nombre.'); if (!needOnline()) return;
      const { data, error } = await sb.rpc('net_new', { p_project: $('#rn-p').value, p_name: name, p_kind: $('#rn-k').value, p_cfg: { fibers: +$('#rn-f').value, per_buffer: +$('#rn-b').value } });
      if (error) return void ($('#rn-e').textContent = errText(error)); m.close(); IDB.del('kv', CUR_UID + ':net-list').catch(() => {}); location.hash = '#/red/' + data; };
  });
}

/* ---------- abrir una red ---------- */
async function rdFetch(id){
  const E = 'id,kind,code,name,lat,lng,parent_id,cable_id,chain_m,port,site_id,pos,props,updated_at,updated_by', C = 'id,name,a_id,b_id,fibers,per_buffer,kind,path,length_m,props';
  const [net, els, cbs, ch] = await Promise.all([
    cached('net-n-' + id, () => sb.from('net_networks').select('*').eq('id', id).maybeSingle()),
    cached('net-e-' + id, () => pageAll(() => sb.from('net_elements').select(E).eq('network_id', id).eq('active', true).order('id'))),
    cached('net-c-' + id, () => pageAll(() => sb.from('net_cables').select(C).eq('network_id', id).eq('active', true).order('id'))),
    cached('net-h-' + id, () => sb.from('net_changes').select('id,target_kind,target_id,op,descr,status,note,created_name,created_at,decided_name,decided_at').eq('network_id', id).order('id', { ascending: false }).limit(200)),
  ]);
  return { net, els: els || [], cbs: cbs || [], ch: ch || [] };
}
async function rdOpen(v, id){
  const d = await rdFetch(id);
  if (!d.net){ v.innerHTML = '<div class="card">No encontré esa red (o no tenés acceso al proyecto). <a href="#/red">Volver</a></div>'; return; }
  Object.assign(RD, d, { tool: 'sel', sel: null, light: null, draw: null }); rdUnifilar.ab = null; RD.usePend = false; RD.open = RD.pick = RD.deriv = RD.moving = null;
  const T = RD.net.kind === 'troncal';
  v.innerHTML = `<div class="rd-top"><div><div class="muted sm"><a href="#/red">Red de fibra</a> › ${T ? 'Troncal' : 'FTTH'}</div><h1>🌐 ${esc(RD.net.name)}</h1></div>
      <span class="rd-chip" id="rd-asof"></span><span style="flex:1"></span>
      <button class="btn sec" id="rd-ch">Cambios <b id="rd-np"></b></button><button class="btn sec" id="rd-uni">Unifilar</button>${!T && rdEdit() ? '<button class="btn sec" id="rd-auto" title="Ubicar cada AP en su caja y salida según el código">AP → cajas</button>' : ''}
      ${rdMgr() ? '<button class="btn" id="rd-up">⬆ Subir información</button>' : ''}<button class="btn sec" id="rd-xl" title="Bajar los elementos en Excel">⬇</button></div>
    <div class="rd-row" style="margin-bottom:8px"><div class="rd-tools" id="rd-tools"></div><span class="muted sm" id="rd-cnt"></span></div>
    <div class="rd-main"><div class="rd-mapw"><div id="rd-map"></div><div class="rd-hint hidden" id="rd-hint"></div></div><aside class="rd-side" id="rd-side"></aside></div>`;
  $('#rd-ch').onclick = rdTray; $('#rd-uni').onclick = rdUnifilar; $('#rd-auto')?.addEventListener('click', rdAutoAssign); $('#rd-xl').onclick = rdExport; $('#rd-up')?.addEventListener('click', rdUpload);
  if (!window.L){ $('#rd-map').innerHTML = '<p class="muted" style="padding:20px">El mapa necesita conexión la primera vez.</p>'; rdSide(); return; }
  RD.map = L.map('rd-map', { preferCanvas: false }); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(RD.map);
  RD.lay = L.layerGroup().addTo(RD.map);
  RD.map.on('click', rdMapClick); RD.map.on('zoomend', () => rdDraw());
  rdFit(); rdBar(); rdDraw(); rdSide();
}
function rdFit(){ const pts = [...RD.els.filter(e => e.lat != null).map(e => [e.lat, e.lng]), ...RD.cbs.flatMap(c => c.path.map(p => [p[1], p[0]]))];
  if (pts.length) RD.map.fitBounds(L.latLngBounds(pts).pad(0.08)); else RD.map.setView([-31.6, -60.7], 9); }
async function rdReload(){ const id = RD.net.id; for (const k of ['n', 'e', 'c', 'h']) await IDB.del('kv', CUR_UID + ':net-' + k + '-' + id).catch(() => {}); const d = await rdFetch(id); Object.assign(RD, d); if (RD.sel && !rdEl(RD.sel) && !rdCb(RD.sel)) RD.sel = null; rdBar(); rdDraw(); rdSide(); }
function rdBar(){
  const T = RD.net.kind === 'troncal', ed = rdEdit() && online();
  const tl = [['sel', 'Seleccionar']].concat(!ed ? [] : [['move', 'Mover'], ...(T ? [['add:nodo', '＋ Nodo'], ['add:botella', '＋ Botella']] : [['add:olt', '＋ OLT'], ['add:botella', '＋ Botella'], ['add:caja', '＋ Caja'], ['add:ap', '＋ AP']]), ['cable', '＋ Cable'], ['add:reserva', '＋ Reserva'], ['del', 'Borrar']]);
  $('#rd-tools').innerHTML = tl.map(([k, t]) => `<button data-rt="${k}" class="${RD.tool === k ? 'on' : ''}">${t}</button>`).join('');
  $('#rd-tools').querySelectorAll('[data-rt]').forEach(b => b.onclick = () => { RD.tool = b.dataset.rt; RD.draw = RD.tool === 'cable' ? [] : null; rdBar(); rdDraw(); });
  const hints = { move: 'Arrastrá el elemento a su lugar', 'add:botella': T ? 'Tocá sobre el cable donde está la botella' : 'Tocá donde está la botella', 'add:nodo': 'Tocá donde está el nodo', 'add:olt': 'Tocá donde está la OLT', 'add:caja': 'Tocá donde está la caja', 'add:ap': 'Tocá donde está el AP', 'add:reserva': 'Tocá donde está la reserva', del: 'Tocá el elemento o el cable que querés borrar' };
  const h = $('#rd-hint');
  if (RD.tool === 'cable'){ h.classList.remove('hidden'); h.innerHTML = `<span>Tocá los puntos del recorrido (${RD.draw.length})</span><button id="rd-dz">Deshacer</button><button id="rd-dk">Terminar</button><button id="rd-dx">Cancelar</button>`;
    $('#rd-dz').onclick = () => { RD.draw.pop(); rdBar(); rdDraw(); }; $('#rd-dx').onclick = () => { RD.tool = 'sel'; RD.draw = null; rdBar(); rdDraw(); }; $('#rd-dk').onclick = rdCableEnd; }
  else { h.classList.toggle('hidden', !hints[RD.tool]); h.textContent = hints[RD.tool] || ''; }
  $('#rd-asof').textContent = RD.net.asof ? 'Actualizada al ' + rdD(RD.net.asof) + (RD.net.asof_note ? ' · ' + RD.net.asof_note : '') : 'Sin cargas de información';
  const np = RD.ch.filter(x => x.status === 'pendiente').length; $('#rd-np').textContent = np ? ' ' + np : ''; $('#rd-ch').classList.toggle('danger', !!np);
  const cnt = k => RD.els.filter(e => e.kind === k).length;
  $('#rd-cnt').textContent = T ? `${cnt('nodo')} nodos · ${cnt('botella')} botellas · ${RD.cbs.length} cables · ${rdKm(RD.cbs.reduce((s, c) => s + rdLen(c), 0))}` : `${cnt('ap')} AP · ${cnt('caja')} cajas · ${cnt('botella')} botellas · ${RD.cbs.length} cables`;
  if (!online() && rdEdit()) $('#rd-cnt').textContent += ' · sin conexión: solo consulta';
}

/* ---------- mapa ---------- */
function rdIcon(e){
  const z = RD.map.getZoom(), sel = RD.sel === e.id ? ' sel' : '', pend = rdPend(e.id) ? ' pend' : '';
  const mk = (w, h, bg, rad, txt = '', extra = '') => L.divIcon({ className: '', iconSize: [w, h], iconAnchor: [w / 2, h / 2], html: `<div class="rd-mk${sel}${pend}" style="width:${w}px;height:${h}px;background:${bg};border-radius:${rad};${extra}">${txt}</div>` });
  if (e.kind === 'nodo') return rdIsCut(e) ? mk(26, 26, '#0F2A4A', '6px', esc(String(e.props?.tipo || '')), 'outline:3px solid #EA580C;outline-offset:1px') : mk(24, 24, '#0F2A4A', '50%', esc(String(e.props?.tipo || '')));
  if (e.kind === 'olt') return mk(34, 20, '#0F2A4A', '5px', 'OLT');
  if (e.kind === 'botella'){ const cut = rdCutN(e); return mk(15, 15, cut ? '#C0262D' : RD.net.kind === 'ftth' ? '#1D4ED8' : e.pos === 'confirmada' ? '#15803D' : '#B45309', '4px'); }
  if (e.kind === 'caja') return mk(17, 15, '#EA7A0C', '3px', '', 'clip-path:polygon(0 0,100% 0,50% 100%);box-shadow:none');
  if (e.kind === 'ap') return mk(z < 14 ? 9 : 13, z < 14 ? 9 : 13, '#0B7A75', '50%');
  if (e.kind === 'reserva') return mk(10, 10, 'transparent', '50%', '', 'border:2px solid #5C6F7C;box-shadow:none');
  return mk(9, 9, '#5C6F7C', '2px');
}
function rdDraw(){
  if (!RD.map) return; RD.lay.clearLayers(); const z = RD.map.getZoom(), T = RD.net.kind === 'troncal';
  for (const c of RD.cbs){ if (c.path.length < 2) continue; const ll = c.path.map(p => [p[1], p[0]]), sel = RD.sel === c.id;
    const col = c.kind === 'drop' ? '#5C6F7C' : c.fibers >= 48 ? '#1D4ED8' : '#EA7A0C';
    L.polyline(ll, { color: '#fff', weight: sel ? 10 : 7, opacity: .9, interactive: false }).addTo(RD.lay);
    L.polyline(ll, { color: sel ? '#2563EB' : col, weight: c.kind === 'drop' ? 2 : 4, dashArray: c.kind === 'subterraneo' ? '8 6' : null, interactive: false }).addTo(RD.lay);
    L.polyline(ll, { color: '#000', weight: 18, opacity: 0 }).on('click', ev => { L.DomEvent.stopPropagation(ev); rdCableClick(c, ev.latlng); }).addTo(RD.lay); }
  // dependencias sin cable dibujado (FTTH): líneas finas
  if (!T) for (const e of RD.els){ const p = e.parent_id && rdEl(e.parent_id); if (!p || p.kind === 'olt' || e.lat == null || p.lat == null) continue;
    L.polyline([[p.lat, p.lng], [e.lat, e.lng]], { color: e.kind === 'ap' ? '#93A6B2' : '#EA7A0C', weight: e.kind === 'ap' ? 1.2 : 2, interactive: false }).addTo(RD.lay); }
  if (RD.light){ const pl = rdPathUp(rdEl(RD.light)); if (pl.length > 1){ L.polyline(pl, { color: '#FACC15', weight: 9, opacity: .85, interactive: false }).addTo(RD.lay); L.polyline(pl, { color: '#12222E', weight: 1.5, dashArray: '5 5', interactive: false }).addTo(RD.lay); } }
  const order = { reserva: 0, poste: 0, otro: 0, ap: 1, caja: 2, botella: 3, olt: 4, nodo: 4 };
  for (const e of [...RD.els].sort((a, b) => order[a.kind] - order[b.kind])){ if (e.lat == null) continue;
    const mv = RD.tool === 'move' && e.kind !== 'reserva' || RD.tool === 'move';
    const m = L.marker([e.lat, e.lng], { icon: rdIcon(e), draggable: mv, zIndexOffset: order[e.kind] * 100, keyboard: false }).addTo(RD.lay);
    m.on('click', ev => { L.DomEvent.stopPropagation(ev); if (RD.tool === 'del') return rdDel('el', e); if (RD.tool === 'cable') return rdMapClick({ latlng: L.latLng(e.lat, e.lng) }); RD.sel = e.id; if (RD.light && RD.light !== e.id) RD.light = null; rdDraw(); rdSide(); });
    if (mv) m.on('dragend', () => rdMoved(e, m.getLatLng()));
    const lab = e.kind === 'nodo' || e.kind === 'olt' ? z >= 9 : e.kind === 'botella' ? z >= 14 : e.kind === 'caja' ? z >= 15 : e.kind === 'ap' ? z >= 17 : false;
    if (lab) m.bindTooltip(esc(e.kind === 'nodo' ? (e.name || e.code || '') : rdName(e)), { permanent: true, direction: 'top', offset: [0, -9], className: 'rd-lab' });
    else m.bindTooltip(esc(rdName(e)), { direction: 'top', offset: [0, -9], className: 'rd-lab' }); }
  if (RD.draw && RD.draw.length){ L.polyline(RD.draw.map(p => [p[1], p[0]]), { color: '#2563EB', weight: 4, dashArray: '6 6', interactive: false }).addTo(RD.lay); RD.draw.forEach(p => L.circleMarker([p[1], p[0]], { radius: 4, color: '#2563EB', fillOpacity: 1, interactive: false }).addTo(RD.lay)); }
}
function rdPathUp(e){ const pl = []; let x = e, n = 0; while (x && n++ < 30){ if (x.lat != null) pl.push([x.lat, x.lng]); x = x.parent_id ? rdEl(x.parent_id) : null; } return pl; }
function rdSnap(ll, cables){ let best = null; for (const c of cables){ if (c.path.length < 2) continue; const cum = cumOf(c.path), r = projectOn(c.path, cum, ll); if (!best || r.off < best.off) best = { off: r.off, chain: r.chain, c, q: pointAt(c.path, cum, r.chain) }; } return best; }
const rdPxM = () => 40075016 * Math.cos(RD.map.getCenter().lat * Math.PI / 180) / Math.pow(2, RD.map.getZoom() + 8); // metros por pixel
function rdCableClick(c, latlng){ if (RD.tool === 'del') return rdDel('cb', c); if (RD.tool.startsWith('add:') || RD.tool === 'cable') return rdMapClick({ latlng }); RD.sel = c.id; rdDraw(); rdSide(); }
function rdMapClick(ev){
  const ll = [ev.latlng.lng, ev.latlng.lat];
  if (RD.tool === 'cable'){ const near = rdNear(ll, RD.els.filter(e => e.lat != null && e.kind !== 'reserva' && e.kind !== 'poste')); RD.draw.push(near && near.d < rdPxM() * 18 ? rdLL(near.e) : ll.map(x => +x.toFixed(6))); rdBar(); rdDraw(); return; }
  if (RD.tool.startsWith('add:')) return rdAdd(RD.tool.slice(4), ll);
  if (RD.tool === 'sel' && RD.sel){ RD.sel = null; RD.light = null; rdDraw(); rdSide(); }
}

/* ---------- escribir (siempre por el servidor) ---------- */
async function rdApply(tk, id, op, data, descr){
  if (!needOnline()) return null;
  const { data: r, error } = await sb.rpc('net_apply', { p_net: RD.net.id, p_tk: tk, p_id: id, p_op: op, p_data: data, p_descr: descr });
  if (error){ toast(errText(error)); return null; }
  const row = r.row, arr = tk === 'el' ? RD.els : RD.cbs, i = arr.findIndex(x => x.id === row.id);
  if (row.active === false){ if (i >= 0) arr.splice(i, 1); if (RD.sel === row.id) RD.sel = null; } else if (i >= 0) arr[i] = row; else arr.push(row);
  RD.ch.unshift({ id: r.change, target_kind: tk, target_id: row.id, op, descr, status: r.status, created_name: me.full_name, created_at: new Date().toISOString() });
  for (const k of ['e', 'c', 'h']) IDB.del('kv', CUR_UID + ':net-' + k + '-' + RD.net.id).catch(() => {});
  toast(r.status === 'pendiente' ? 'Cambio registrado. La red ya quedó actualizada; falta que lo confirme un supervisor.' : 'Cambio registrado.');
  rdBar(); rdDraw(); rdSide(); return row;
}
/* ---------- salidas de la caja ---------- */
// conecta un AP a la salida p de una caja; si la caja tiene código CDO-OLT-rama-botella-caja, el AP toma el código que corresponde
async function rdAssign(ap, caja, p, quiet){
  const m = (ap.code || '').split('-'), cc = (caja.code || '').split('-');
  const nc = m.length >= 7 && cc.length >= 5 && /^cdo$/i.test(cc[0]) ? ['AP', cc[1], cc[2], cc[3], cc[4], p, m[6]].join('-') : ap.code, d = { parent_id: caja.id, port: +p };
  if (!quiet && nc === ap.code && m.length >= 7 && !(cc.length >= 5)) toast('La caja no tiene un código CDO-OLT-rama-botella-caja: el AP conserva su código.');
  if (nc !== ap.code){ d.code = nc; d.props = { ...(ap.props || {}), old: [...(ap.props?.old || []), ap.code].slice(-10) }; }
  return rdApply('el', ap.id, 'upd', d, `${ap.code || 'AP'} a la salida ${p} de ${rdName(caja)}${nc !== ap.code ? '. Código nuevo: ' + nc : ''}`);
}
function rdOutEdit(c, p){
  const ap = rdKids(c.id).find(e => e.kind === 'ap' && e.port === p), tx = rdOuts(c)[p] || '';
  const near = RD.els.filter(e => e.kind === 'ap' && e.lat != null && e.id !== ap?.id).map(e => ({ e, d: havm(rdLL(c), rdLL(e)) })).sort((a, b) => a.d - b.d).slice(0, 12);
  const where = e => { const k = e.parent_id && rdEl(e.parent_id); return k ? `en la salida ${e.port || '?'} de ${rdName(k)}` : 'sin caja'; };
  const m = modal(`<h2>Salida ${p} · ${esc(rdName(c))}</h2>
    <p class="muted sm" style="margin:0 0 8px">${ap ? `Hoy va al AP <b>${esc(rdName(ap))}</b>.` : tx ? `Hoy va a: <b>${esc(tx)}</b>.` : 'Hoy está libre.'}</p>
    <h3 style="margin:8px 0 4px">Conectar un AP (los más cercanos a la caja)</h3>
    <div style="display:grid;gap:4px;max-height:260px;overflow:auto">${near.map(({ e, d }) => `<button class="rd-item" data-ap="${e.id}" style="text-align:left"><b>${esc(rdName(e))}</b><span class="muted sm"> · a ${Math.round(d)} m · ${esc(where(e))}</span></button>`).join('') || '<span class="muted sm">No hay AP cargados.</span>'}</div>
    <h3 style="margin:12px 0 4px">U otro destino</h3><div class="row" style="gap:6px"><input id="ro-t" maxlength="80" value="${esc(tx)}" placeholder="Ej.: drop a Escuela N° 1234, reserva" style="flex:1;margin:0"><button class="btn sec" id="ro-ts">Guardar</button></div>
    <div class="row" style="justify-content:space-between;gap:6px;margin-top:12px">${ap || tx ? '<button class="btn sec" id="ro-free" style="color:var(--red)">Liberar salida</button>' : '<span></span>'}<span class="row" style="gap:6px">${ap ? `<button class="btn sec" id="ro-go">Ver el AP</button>` : ''}<button class="btn sec" id="ro-x">Cerrar</button></span></div>`);
  const props = o => ({ ...(c.props || {}), outs: o });
  const freeAp = () => ap ? rdApply('el', ap.id, 'upd', { parent_id: null, port: null }, `${rdName(ap)} sale de la salida ${p} de ${rdName(c)}`) : true;
  $('#ro-x').onclick = m.close;
  $('#ro-go')?.addEventListener('click', () => { m.close(); RD.sel = ap.id; if (ap.lat != null && RD.map) RD.map.panTo([ap.lat, ap.lng]); rdDraw(); rdSide(); });
  m.el.querySelectorAll('[data-ap]').forEach(b => b.onclick = async () => { const e = rdEl(b.dataset.ap); if (!e) return; m.close();
    if (!(await freeAp())) return; if (tx){ const o = { ...rdOuts(c) }; delete o[p]; if (!(await rdApply('el', c.id, 'upd', { props: props(o) }, `${rdName(c)}: salida ${p} deja de ir a "${tx}"`))) return; }
    const row = await rdAssign(e, rdEl(c.id), p); if (row){ RD.sel = c.id; rdSide(); } });
  $('#ro-ts').onclick = async () => { const v = $('#ro-t').value.replace(/[<>]/g, '').trim().slice(0, 80); if (!v) return toast('Escribí el destino o usá "Liberar salida".'); m.close();
    if (!(await freeAp())) return; const cc = rdEl(c.id); await rdApply('el', c.id, 'upd', { props: { ...(cc.props || {}), outs: { ...rdOuts(cc), [p]: v } } }, `${rdName(c)}: salida ${p} va a "${v}"`); RD.sel = c.id; rdSide(); };
  $('#ro-free')?.addEventListener('click', async () => { m.close(); if (ap){ await freeAp(); } else { const o = { ...rdOuts(c) }; delete o[p]; await rdApply('el', c.id, 'upd', { props: props(o) }, `${rdName(c)}: se libera la salida ${p}`); } RD.sel = c.id; rdSide(); });
}
/* AP → cajas: lee el código AP-OLT-rama-botella-caja-salida-n° y propone en qué caja y salida va cada AP */
function rdAutoAssign(){
  const aps = RD.els.filter(e => e.kind === 'ap' && e.lat != null && (e.code || '').split('-').length >= 7), byK = new Map();
  aps.forEach(a => { const s = a.code.split('-'), k = [s[1], s[2], s[3], s[4]].join('-'); if (!byK.has(k)) byK.set(k, []); byK.get(k).push({ a, p: +s[5] || null }); });
  const cajas = RD.els.filter(e => e.kind === 'caja' && e.lat != null), taken = new Set(), rows = [], cen = l => ({ lat: l.reduce((t, x) => t + x.a.lat, 0) / l.length, lng: l.reduce((t, x) => t + x.a.lng, 0) / l.length });
  const coded = k => cajas.find(c => (c.code || '').toLowerCase() === ('cdo-' + k).toLowerCase());
  [...byK.keys()].forEach(k => { const c = coded(k); if (c) taken.add(c.id); });
  // primero los grupos con caja con código; después cada grupo toma la caja sin código más cercana (hasta 250 m)
  const order = [...byK.entries()].map(([k, l]) => { const ce = cen(l), c = coded(k); if (c) return { k, l, c, d: 0, by: 'código' };
    const cand = cajas.filter(x => !/^cdo-/i.test(x.code || '')).map(x => ({ x, d: havm([ce.lng, ce.lat], rdLL(x)) })).sort((a, b) => a.d - b.d); return { k, l, cand, ce }; });
  order.filter(o => !o.c).map(o => ({ o, d: o.cand.find(x => !taken.has(x.x.id))?.d ?? 1e9 })).sort((a, b) => a.d - b.d).forEach(({ o }) => { const n = o.cand.find(x => !taken.has(x.x.id) && x.d < 250); if (n){ taken.add(n.x.id); o.c = n.x; o.d = n.d; o.by = 'cercanía'; o.setCode = !(n.x.code); } });
  order.forEach(o => { const used = new Map(); o.l.forEach(({ a, p }) => {
    const same = o.c && a.parent_id === o.c.id && a.port === p, np = o.c ? rdPorts(o.c) : 0, other = o.c && p && rdKids(o.c.id).find(x => x.kind === 'ap' && x.port === p && x.id !== a.id && !o.l.some(y => y.a.id === x.id)), dup = p && used.has(p), txt = o.c && p && rdOuts(o.c)[p];
    const prob = !o.c ? 'no hay caja a menos de 250 m' : !p ? 'el código no tiene salida' : p > np ? `la caja tiene ${np} salidas` : dup ? `la salida ${p} se repite (${rdName(used.get(p))})` : other ? `la salida ${p} ya tiene ${rdName(other)}` : txt ? `la salida ${p} tiene "${txt}"` : '';
    if (p) used.set(p, a); rows.push({ a, p, c: o.c, by: o.by, d: o.d, setCode: o.setCode, k: o.k, same, prob }); }); });
  const todo = rows.filter(r => !r.same), ok = todo.filter(r => !r.prob), bad = todo.filter(r => r.prob), done = rows.length - todo.length;
  const codes = [...new Map(ok.filter(r => r.setCode).map(r => [r.c.id, r])).values()];
  const m = modal(`<h2>AP → cajas por código</h2><p class="muted sm">Cada AP va a la caja <b>CDO-OLT-rama-botella-caja</b> de su código y a la salida que marca. Si esa caja no tiene código, se usa la caja sin código más cercana (hasta 250 m) y se le pone el código. Revisá antes de aplicar.</p>
    <p class="sm" style="margin:6px 0">${rdPl(ok.length, 'AP para ubicar', 'AP para ubicar')} · ${done} ya estaban bien · ${bad.length} con problemas${codes.length ? ` · ${codes.length} cajas reciben código` : ''}</p>
    <div style="max-height:46vh;overflow:auto"><table class="tbl"><thead><tr><th></th><th>AP</th><th>Caja</th><th>Salida</th><th></th></tr></thead><tbody>
    ${ok.map((r, i) => `<tr><td><input type="checkbox" data-r="${i}" checked style="width:auto;margin:0"></td><td>${esc(r.a.code)}</td><td>${esc(rdName(r.c))}${r.setCode ? ` <span class="muted sm">→ CDO-${esc(r.k)}</span>` : ''}${r.by === 'cercanía' ? ` <span class="muted sm">(a ${Math.round(r.d)} m)</span>` : ''}</td><td>${r.p}</td><td class="muted sm">${r.a.parent_id ? 'cambia de caja o salida' : 'nuevo'}</td></tr>`).join('')}
    ${bad.map(r => `<tr><td></td><td>${esc(r.a.code)}</td><td>${r.c ? esc(rdName(r.c)) : '—'}</td><td>${r.p || '—'}</td><td style="color:var(--red)" class="sm">${esc(r.prob)}</td></tr>`).join('')}</tbody></table></div>
    <p class="muted sm" id="ra-e"></p><div class="row" style="justify-content:flex-end;gap:6px;margin-top:8px"><button class="btn sec" id="ra-x">Cancelar</button><button class="btn" id="ra-ok" ${ok.length ? '' : 'disabled'}>Aplicar</button></div>`, { wide: true });
  $('#ra-x').onclick = m.close;
  $('#ra-ok').onclick = async () => { if (!needOnline()) return; const sel = ok.filter((r, i) => m.el.querySelector(`[data-r="${i}"]`)?.checked); if (!sel.length) return; const b = $('#ra-ok'); b.disabled = true; let n = 0, err = 0;
    const call = (id, d, descr) => sb.rpc('net_apply', { p_net: RD.net.id, p_tk: 'el', p_id: id, p_op: 'upd', p_data: d, p_descr: descr }).then(({ error }) => { if (error) throw error; });
    for (const r of [...new Map(sel.filter(r => r.setCode).map(r => [r.c.id, r])).values()]){ try { await call(r.c.id, { code: 'CDO-' + r.k }, `${rdName(r.c)} recibe el código CDO-${r.k} (AP → cajas)`); r.c.code = 'CDO-' + r.k; } catch (e){ err++; } }
    for (const r of sel){ $('#ra-e').textContent = `Ubicando ${++n} de ${sel.length}…`;
      try { await call(r.a.id, { parent_id: r.c.id, port: r.p }, `${r.a.code} a la salida ${r.p} de ${r.c.code || rdName(r.c)} (AP → cajas, por código)`); } catch (e){ err++; } }
    m.close(); await rdReload(); toast(err ? `Listo, con ${err} que no se pudieron aplicar. Revisalos en Cambios.` : `Listo: ${sel.length} AP ubicados en su caja. Quedó en Cambios.`); };
}
async function rdMoved(e, latlng){
  let ll = [+latlng.lng.toFixed(6), +latlng.lat.toFixed(6)], extra = {};
  const c = e.cable_id && rdCb(e.cable_id);
  if (e.kind === 'botella' && c && c.path.length > 1){ const s = rdSnap(ll, [c]); ll = s.q.map(x => +x.toFixed(6)); extra.chain_m = Math.round(s.chain); }
  const m = Math.round(havm(rdLL(e), ll)); if (m < 1) return rdDraw();
  if (!await rdApply('el', e.id, 'upd', { lng: ll[0], lat: ll[1], ...extra }, `Mover ${rdName(e)} ${m} m`)) rdDraw();
}
function rdDel(tk, x){
  const nm = tk === 'el' ? rdName(x) : (x.name || 'cable');
  if (tk === 'el' && rdKids(x.id).length) return toast('Tiene elementos que dependen de él: primero movelos o borralos.');
  const m = modal(`<h2>¿Borrar ${esc(nm)}?</h2><p class="muted sm">Queda en el historial y se puede recuperar rechazando el cambio.</p><label>Motivo (opcional)</label><input id="rx-m" maxlength="120">
    <div class="row" style="justify-content:flex-end;gap:6px;margin-top:10px"><button class="btn sec" id="rx-x">Cancelar</button><button class="btn danger" id="rx-ok">Borrar</button></div>`);
  $('#rx-x').onclick = m.close; $('#rx-ok').onclick = async () => { const why = $('#rx-m').value.trim(); m.close(); await rdApply(tk, x.id, 'del', {}, `Borrar ${nm}${why ? ': ' + why : ''}`); };
}
function rdAdd(kind, ll){
  const T = RD.net.kind === 'troncal', cfg = RD.net.cfg || {};
  let snap = null, parent = null, port = null, code = '';
  if (kind === 'botella' && RD.cbs.length){ snap = rdSnap(ll, RD.cbs); if (T && snap.off > rdPxM() * 40) return toast('Tocá sobre el cable para intercalar la botella.'); if (snap.off > rdPxM() * 40) snap = null; else ll = snap.q; }
  if (kind === 'botella' && T && !RD.cbs.length) return toast('Primero dibujá o subí el cable.');
  const bots = RD.els.filter(e => e.kind === 'botella'), cajas = RD.els.filter(e => e.kind === 'caja');
  if (kind === 'caja' && bots.length) parent = rdNear(ll, bots).e;
  if (kind === 'ap'){ const free = cajas.filter(c => rdFree(c).length); if (free.length){ parent = rdNear(ll, free).e; port = rdFree(parent)[0]; } }
  if (kind === 'botella' && !T){ const o = RD.els.filter(e => e.kind === 'olt'); if (o.length) parent = rdNear(ll, o).e; }
  const nextN = (k, pre) => { let n = RD.els.filter(e => e.kind === k).length + 1; while (RD.els.some(e => (e.code || '').toLowerCase() === (pre + String(n).padStart(2, '0')).toLowerCase())) n++; return pre + String(n).padStart(2, '0'); };
  const apCode = () => { const c = parent && (parent.code || '').split('-'); if (!c || c.length < 5) return ''; const n = Math.max(0, ...RD.els.filter(e => e.kind === 'ap').map(e => +(e.code || '').split('-')[6] || 0)) + 1; return ['AP', c[1], c[2], c[3], c[4], port, n].join('-'); };
  code = kind === 'botella' ? nextN('botella', T ? 'BE-' : 'BOT-') : kind === 'caja' ? nextN('caja', 'CDO-') : kind === 'ap' ? apCode() : '';
  const m = modal(`<h2>＋ ${esc(RD_KIND[kind])}</h2>
    <div class="grid2"><div><label>Código</label><input id="ra-c" maxlength="80" value="${esc(code)}"></div><div><label>Nombre / dirección</label><input id="ra-n" maxlength="160"></div></div>
    ${kind === 'nodo' ? `<label>Tipo de nodo</label><select id="ra-t">${Object.entries(RD_TIPOS).map(([k, t]) => `<option value="${k}" ${k === '4' ? 'selected' : ''}>${esc(t.n)} · ${esc(t.dist)}</option>`).join('')}</select>` : ''}
    ${kind === 'caja' ? `<label>Cuelga de la botella</label><select id="ra-p"><option value="">— ninguna —</option>${bots.map(b => `<option value="${b.id}" ${parent?.id === b.id ? 'selected' : ''}>${esc(rdName(b))}</option>`).join('')}</select>
      <div class="grid2"><div><label>Splitter nivel 1</label><select id="ra-n1">${['', '1x2', '1x4', '1x8'].map(x => `<option ${x === '1x2' ? 'selected' : ''} value="${x}">${x || 'sin'}</option>`).join('')}</select></div><div><label>Splitter nivel 2</label><select id="ra-n2">${['1x4', '1x8', '1x16', '1x32'].map(x => `<option ${x === '1x8' ? 'selected' : ''}>${x}</option>`).join('')}</select></div></div>` : ''}
    ${kind === 'ap' ? `<div class="grid2"><div><label>Cuelga de la caja</label><select id="ra-p"><option value="">— ninguna —</option>${cajas.map(c => `<option value="${c.id}" ${parent?.id === c.id ? 'selected' : ''}>${esc(rdName(c))} (${rdFree(c).length} libres)</option>`).join('')}</select></div><div><label>Salida</label><input id="ra-o" type="number" min="1" max="128" value="${port || ''}"></div></div>` : ''}
    ${kind === 'botella' && snap ? `<p class="muted sm">Sobre el cable <b>${esc(snap.c.name || 'sin nombre')}</b>, a ${rdKm(snap.chain)} de su inicio.</p>` : ''}
    <label style="display:flex;gap:8px;align-items:center;font-weight:400"><input type="checkbox" id="ra-ok" style="width:auto"> Estoy en el lugar: la posición es la real</label>
    <div class="err" id="ra-e"></div><div class="row" style="justify-content:flex-end;gap:6px"><button class="btn sec" id="ra-x">Cancelar</button><button class="btn" id="ra-go">Agregar</button></div>`);
  $('#ra-x').onclick = m.close;
  $('#ra-p')?.addEventListener('change', () => { if (kind !== 'ap') return; parent = rdEl($('#ra-p').value) || null; port = parent ? rdFree(parent)[0] : null; $('#ra-o').value = port || ''; $('#ra-c').value = apCode(); });
  $('#ra-o')?.addEventListener('change', () => { port = +$('#ra-o').value || null; $('#ra-c').value = apCode() || $('#ra-c').value; });
  $('#ra-go').onclick = async () => {
    const d = { kind, code: $('#ra-c').value.trim() || null, name: $('#ra-n').value.trim() || null, lng: +ll[0].toFixed(6), lat: +ll[1].toFixed(6), pos: $('#ra-ok').checked ? 'confirmada' : 'estimada', props: {} };
    if (kind === 'nodo'){ d.props.tipo = +$('#ra-t').value; if (!d.name && !d.code) return void ($('#ra-e').textContent = 'Poné el nombre del nodo.'); }
    if (kind === 'caja'){ d.parent_id = $('#ra-p').value || null; d.props.n1 = $('#ra-n1').value; d.props.n2 = $('#ra-n2').value; }
    if (kind === 'ap'){ d.parent_id = $('#ra-p').value || null; d.port = +$('#ra-o').value || null; const c = rdEl(d.parent_id); if (c && d.port && !rdFree(c).includes(d.port)) return void ($('#ra-e').textContent = 'Esa salida ya está ocupada.'); }
    if (kind === 'botella'){ if (snap){ d.cable_id = snap.c.id; d.chain_m = Math.round(snap.chain); } if (parent) d.parent_id = parent.id; }
    $('#ra-go').disabled = true; const row = await rdApply('el', null, 'add', d, `Agregar ${RD_KIND[kind].toLowerCase()} ${d.code || d.name || ''}`.trim());
    if (!row){ $('#ra-go').disabled = false; return; } m.close(); RD.sel = row.id; RD.tool = 'sel'; rdBar(); rdDraw(); rdSide();
  };
}
function rdCableEnd(){
  const pts = RD.draw || []; if (pts.length < 2) return toast('Marcá al menos dos puntos.');
  const ends = [pts[0], pts[pts.length - 1]].map(p => { const n = rdNear(p, RD.els.filter(e => e.lat != null && !['reserva', 'poste'].includes(e.kind))); return n && n.d < 3 ? n.e : null; });
  const cfg = RD.net.cfg || {}, len = Math.round(cumOf(pts).pop());
  const m = modal(`<h2>＋ Cable</h2><p class="muted sm">${ends[0] ? 'Desde <b>' + esc(rdName(ends[0])) + '</b>' : 'Extremo inicial libre'} · ${ends[1] ? 'hasta <b>' + esc(rdName(ends[1])) + '</b>' : 'extremo final libre'} · ${rdKm(len)} sobre el mapa</p>
    <label>Nombre</label><input id="rc-n" maxlength="160" value="${esc(ends[0] && ends[1] ? rdName(ends[0]) + ' – ' + rdName(ends[1]) : '')}">
    <div class="grid2"><div><label>Pelos</label><input id="rc-f" type="number" min="1" max="576" value="${cfg.fibers || 96}"></div><div><label>Pelos por buffer</label><input id="rc-b" type="number" min="1" max="24" value="${cfg.per_buffer || 12}"></div></div>
    <label>Tendido</label><select id="rc-k"><option value="aereo">Aéreo</option><option value="subterraneo">Subterráneo</option><option value="mixto">Mixto</option><option value="drop">Drop / acometida</option></select>
    <div class="row" style="justify-content:flex-end;gap:6px;margin-top:10px"><button class="btn sec" id="rc-x">Cancelar</button><button class="btn" id="rc-ok">Guardar cable</button></div>`);
  $('#rc-x').onclick = m.close;
  $('#rc-ok').onclick = async () => { $('#rc-ok').disabled = true;
    const row = await rdApply('cb', null, 'add', { name: $('#rc-n').value.trim() || null, a_id: ends[0]?.id || null, b_id: ends[1]?.id || null, fibers: +$('#rc-f').value || 96, per_buffer: +$('#rc-b').value || 12, kind: $('#rc-k').value, path: pts, length_m: len }, `Agregar cable ${$('#rc-n').value.trim()}`);
    if (!row){ $('#rc-ok').disabled = false; return; } m.close(); RD.tool = 'sel'; RD.draw = null; RD.sel = row.id; rdBar(); rdDraw(); rdSide(); };
}

/* ---------- panel lateral ---------- */
function rdSide(){
  const s = $('#rd-side'); if (!s) return; const T = RD.net.kind === 'troncal';
  const e = RD.sel && rdEl(RD.sel), c = RD.sel && rdCb(RD.sel);
  const pend = RD.sel && rdPend(RD.sel) ? '<div class="rd-alert">Tiene cambios pendientes de confirmar.</div>' : '';
  if (c) s.innerHTML = pend + rdCablePanel(c);
  else if (!e){
    const cuts = RD.els.filter(x => x.kind === 'botella' && rdCutN(x));
    s.innerHTML = `<h2>${esc(RD.net.name)}</h2>
      ${!RD.els.length && !RD.cbs.length ? `<div class="rd-alert">La red está vacía. ${rdMgr() ? 'Usá <b>⬆ Subir información</b> para cargar el KMZ, o dibujá con las herramientas de arriba.' : 'Todavía no se cargó información.'}</div>` : ''}
      ${T && RD.els.length ? (cuts.length ? `<div class="rd-alert bad"><b>${rdPl(cuts.reduce((n, b) => n + rdCutN(b), 0), 'pelo en servicio cortado', 'pelos en servicio cortados')}</b>${cuts.map(b => `<div class="rd-row" style="margin-top:6px"><span>${esc(rdName(b))}</span><button class="btn sec small" data-go="${b.id}">Abrir botella</button></div>`).join('')}</div>` : '<div class="rd-alert ok">Sin pelos en servicio cortados.</div>') : ''}
      ${T && RD.els.some(rdIsCut) ? `<h3>Cortes de tramo óptico</h3><p class="muted sm">Nodos donde terminan todos los pelos en el ODF. Cada tramo se mide por separado.</p><div class="rd-row">${RD.els.filter(rdIsCut).sort((a, b) => (a.name || a.code || '').localeCompare(b.name || b.code || '', 'es')).map(n => `<button class="btn sec small" data-go="${n.id}">✂ ${esc(n.name || n.code)}</button>`).join('')}</div>` : ''}
      <h3>Cómo se usa</h3>
      <div class="rd-item">${T ? 'Tocá una <b>botella</b> para ver sus empalmes, marcar un pelo cortado o derivarlo.' : 'Tocá un <b>AP</b> para ver de dónde cuelga e iluminar su camino.'}</div>
      <div class="rd-item">${T ? 'Tocá un <b>nodo</b> para ver su tipo y qué buffers bajan. Tocá un <b>cable</b> para ver sus pelos.' : 'Tocá una <b>caja</b> para ver sus splitters y salidas.'}</div>
      ${rdEdit() ? '<div class="rd-item">Con las herramientas de arriba agregás, movés y borrás. Cada cambio queda registrado con tu nombre.</div>' : ''}
      <h3>Referencias</h3><div class="sm muted">${T ? '● Nodo (el número es su tipo) · ▣ con borde naranja: corte de tramo óptico · ■ verde: botella confirmada · ■ ámbar: a confirmar · ■ rojo: con pelo en servicio cortado' : '▬ OLT · ■ azul: botella · ▼ naranja: caja con splitters · ● verde: AP · ○ reserva'}</div>`;
  }
  else if (e.kind === 'nodo') s.innerHTML = pend + rdNodePanel(e);
  else if (e.kind === 'botella' && T) s.innerHTML = pend + rdBotPanel(e);
  else if (e.kind === 'ap') s.innerHTML = pend + rdApPanel(e);
  else if (e.kind === 'caja') s.innerHTML = pend + rdCajaPanel(e);
  else s.innerHTML = pend + `<h2>${esc(rdName(e))}</h2><div class="rd-row"><span class="rd-chip">${esc(RD_KIND[e.kind])}</span>${rdPosChip(e)}</div>${rdBasics(e)}
      ${rdKids(e.id).length ? `<h3>Cuelgan de acá</h3>${rdKids(e.id).map(k => `<button class="rd-item" data-go="${k.id}"><b>${esc(rdName(k))}</b><span class="muted sm">${esc(RD_KIND[k.kind])}${k.name && k.code ? ' · ' + esc(k.name) : ''}</span></button>`).join('')}` : ''}`;
  rdBindSide(e, c);
}
const rdPosChip = e => `<span class="rd-chip ${e.pos === 'confirmada' ? 'ok' : 'warn'}">${e.pos === 'confirmada' ? 'Posición confirmada en campo' : e.pos === 'archivo' ? 'Posición del archivo' : 'Posición estimada'}</span>`;
// elementos "hermanos": mismo tipo y mismo código salvo el número final (ej. E-VERA-MALA-01 … 54, de una misma planilla)
const rdGroup = e => { const m = /^(.*?[-_ ])\d+$/.exec(e.code || ''); if (!m) return []; const pre = m[1].toLowerCase();
  return RD.els.filter(x => x.kind === e.kind && (x.code || '').toLowerCase().startsWith(pre) && /^\d+$/.test((x.code || '').slice(pre.length))); };
const rdBasics = e => `${rdEdit() ? `<div class="rd-row"><button class="btn sec small" id="re-ed">Editar datos</button>${e.pos !== 'confirmada' ? '<button class="btn sec small" id="re-conf">Confirmar posición (estoy en el lugar)</button>' : ''}</div>` : ''}
  ${rdMgr() && online() && rdGroup(e).length > 1 ? `<div><button class="btn sec small" id="re-grp" style="color:var(--red)">Borrar las ${rdGroup(e).length} ${e.kind === 'botella' ? 'botellas' : 'del grupo'} ${esc(/^(.*?[-_ ])\d+$/.exec(e.code)[1])}…</button></div>` : ''}
  <div class="muted sm">${e.name && e.code ? esc(e.name) + ' · ' : ''}${e.lat != null ? `${(+e.lat).toFixed(5)}, ${(+e.lng).toFixed(5)}` : ''}${e.updated_by ? ` · último cambio: ${esc(e.updated_by)} ${esc(fmtDate(e.updated_at))}` : ''}</div>`;
function rdNodePanel(n){
  const t = RD_TIPOS[n.props?.tipo], drop = rdDropOf(n), nb = Math.max(8, ...RD.cbs.filter(c => c.a_id === n.id || c.b_id === n.id).map(rdBufN), 0), ed = rdEdit();
  const cb = RD.cbs.find(c => c.a_id === n.id || c.b_id === n.id) || rdCableOf({});
  const cut = rdIsCut(n);
  return `<h2>${esc(n.name || n.code || 'Nodo')}</h2><div><button class="btn small" id="rn-gab">🗄 Abrir gabinete${n.props?.gab ? '' : ' (armar)'}</button></div><div class="rd-row">${t ? `<span class="rd-chip">${esc(t.n)}</span>` : '<span class="rd-chip warn">Sin tipo</span>'}${cut ? '<span class="rd-chip" style="background:#FFEDD5;color:#C2410C;font-weight:600">✂ Corte de tramo óptico</span>' : ''}${rdPosChip(n)}</div>${t && !cut ? `<div class="muted sm">${esc(t.dist)}</div>` : ''}
    ${cut ? '<div class="rd-alert" style="background:#FFEDD5;color:#9A3412">Todos los pelos terminan en el ODF de este nodo: acá termina un tramo óptico y empieza el siguiente. Cada tramo se mide y se empalma por separado.</div>' : ''}
    ${ed ? `<div><button class="btn sec small" id="rn-cut">${cut ? 'Quitar corte de tramo (vuelve a lo que indica el tipo)' : '✂ Marcar como corte de tramo (bajan todos los buffers)'}</button></div>` : ''}
    ${ed ? `<label class="sm muted" style="margin:0">Tipo de nodo <select id="rn-tipo" style="width:auto;display:inline-block;margin:0 0 0 6px">${Object.entries(RD_TIPOS).map(([k, v]) => `<option value="${k}" ${+k === n.props?.tipo ? 'selected' : ''}>${esc(v.n)}</option>`).join('')}</select></label>` : ''}
    <h3>Buffers que bajan al nodo</h3><p class="muted sm">El tipo propone cuáles bajan.${ed ? ' Tocá un buffer para ajustarlo en este nodo.' : ''}</p>
    ${[...Array(nb)].map((_, i) => `<button class="rd-item" data-buf="${i}" style="grid-template-columns:auto 1fr auto;align-items:center;gap:8px" ${ed ? '' : 'disabled'}><span class="rd-sw" style="background:${RD_FIB[i % 12][1]}"></span><span>B${i + 1} · ${RD_FIB[i % 12][0]} ${rdFt(cb, i) ? '· ' + rdFt(cb, i) : ''}</span><span class="rd-chip ${drop.includes(i) ? 'ok' : ''}">${drop.includes(i) ? 'Baja al distribuidor' : 'Pasa de largo'}</span></button>`).join('')}
    ${rdBasics(n)}`;
}
function rdBotPanel(b){
  const c = rdCableOf(b), sp = rdSp(b), nb = rdBufN(c), ed = rdEdit() && online();
  const der = Object.keys(sp.map).filter(f => +sp.map[f] !== +f).length, hi = Object.values(sp.loss).filter(x => x > 0.2).length, cut = rdCutN(b);
  const A = c.a_id && rdEl(c.a_id), B = c.b_id && rdEl(c.b_id), len = c.id ? rdLen(c) : 0;
  const bufs = [...Array(nb)].map((_, i) => { const fs = [...Array(c.per_buffer)].map((_, k) => i * c.per_buffer + k).filter(f => f < c.fibers), open = RD.open === i;
    const nc = fs.filter(f => rdMapOf(sp, f) === f && sp.out[f] === 'cort').length, nd = fs.filter(f => rdMapOf(sp, f) !== f).length;
    return `<div class="rd-buf"><button class="rd-bh" data-open="${i}"><span class="rd-sw" style="background:${RD_FIB[i % 12][1]}"></span><b>B${i + 1} ${RD_FIB[i % 12][0]}</b><span class="muted sm">${rdFt(c, i)}</span>
      <span class="sm muted" style="margin-left:auto">${nc ? `<b style="color:var(--red)">${nc} cortado${nc > 1 ? 's' : ''}</b> · ` : ''}${nd ? `<b style="color:var(--s1)">${nd} derivado${nd > 1 ? 's' : ''}</b> · ` : ''}${open ? 'cerrar' : 'ver pelos'}</span></button>
      ${open ? fs.map(f => { const g = rdMapOf(sp, f), st = rdOut(b, c, sp, g), dv = g !== f, ls = sp.loss[f];
        return `<button class="rd-fr ${RD.pick === f ? 'sel' : ''}" data-f="${f}"><span class="rd-fc">${rdDot(c, f)}${rdFName(c, f)}</span><span class="rd-fl ${dv ? 'der' : st}"></span><span class="rd-fc">${rdDot(c, g)}${rdFName(c, g)}</span><span style="${ls > 0.2 ? 'color:var(--red);font-weight:700' : ''}">${ls != null ? (+ls).toFixed(2) : ''}</span></button>${RD.pick === f ? rdFiberAct(b, c, sp, f, ed) : ''}`; }).join('') : ''}</div>`; }).join('');
  return `<h2>Botella ${esc(rdName(b))}</h2><div class="rd-row">${rdPosChip(b)}${cut ? `<span class="rd-chip bad">${rdPl(cut, 'pelo en servicio cortado', 'pelos en servicio cortados')}</span>` : ''}${hi ? `<span class="rd-chip warn">${rdPl(hi, 'empalme', 'empalmes')} sobre 0,20 dB</span>` : ''}${der ? `<span class="rd-chip">${rdPl(der, 'derivado', 'derivados')}</span>` : ''}</div>
    <dl class="rd-kv">${c.id ? `<dt>Cable</dt><dd>${esc(c.name || 'sin nombre')} · ${c.fibers} pelos</dd>` : '<dt>Cable</dt><dd>sin cable asociado</dd>'}${b.chain_m != null && c.id ? `<dt>Progresiva</dt><dd>${rdKm(+b.chain_m)} desde ${esc(A ? rdName(A) : 'el inicio')}${len ? ` · ${rdKm(Math.max(0, len - b.chain_m))} desde ${esc(B ? rdName(B) : 'el final')}` : ''}</dd>` : ''}</dl>
    ${rdBasics(b)}
    <h3>Empalmes · ${esc(A ? 'lado ' + rdName(A) : 'entrada')} → ${esc(B ? 'lado ' + rdName(B) : 'salida')}</h3>
    <p class="muted sm">Verde: en servicio · gris: libre · ámbar: reserva · rojo cortado: sin luz · azul: derivado. A la derecha, la atenuación del empalme (dB) si se cargó de la planilla.</p>${bufs}`;
}
function rdFiberAct(b, c, sp, f, ed){
  const g = rdMapOf(sp, f), st = rdOut(b, c, sp, g), dv = g !== f;
  let h = `<div class="rd-act"><div><b>${rdFLong(c, f)}</b> → sale por ${rdFName(c, g)} · ${RD_ST[st]}${c.props?.use?.[f]?.t ? ' · ' + esc(c.props.use[f].t) : ''}</div>`;
  if (!ed) return h + '</div>';
  if (RD.deriv === f){ const taken = new Set(Object.entries(sp.map).filter(([a, x]) => +a !== +x).map(([, x]) => +x));
    const free = [...Array(c.fibers).keys()].filter(i => i !== f && rdOut(b, c, sp, i) === 'libre' && !taken.has(i) && !(sp.loss[i] > 0.2));
    h += `<div class="muted sm">Elegí el pelo libre y sano por el que sale ahora (${free.length} disponibles):</div>${[...Array(rdBufN(c))].map((_, i) => { const fr = free.filter(x => Math.floor(x / c.per_buffer) === i); return fr.length ? `<div><div class="muted sm" style="margin-bottom:3px">B${i + 1} ${RD_FIB[i % 12][0]} ${rdFt(c, i)}</div><div class="rd-pick">${fr.map(x => `<button data-to="${x}">${rdDot(c, x)}${rdFName(c, x)}</button>`).join('')}</div></div>` : ''; }).join('')}
      <label class="sm" style="margin:0">Motivo / ticket<input id="rf-why" maxlength="100" placeholder="Ej.: corte por poda, ticket 11375" style="margin:2px 0 0"></label><div><button class="btn sec small" data-cancel>Cancelar</button></div>`; }
  else h += `<div class="rd-row">${st !== 'cort' && !dv ? '<button class="btn sec small" data-cut style="color:var(--red)">Marcar pelo cortado</button>' : ''}<button class="btn small" data-der>Derivar a otro pelo</button>${dv ? '<button class="btn sec small" data-back>Volver al empalme directo</button>' : ''}${st === 'cort' && !dv ? '<button class="btn sec small" data-fix>Marcar reparado</button>' : ''}</div>`;
  return h + '</div>';
}
function rdCablePanel(c){
  const A = c.a_id && rdEl(c.a_id), B = c.b_id && rdEl(c.b_id), bots = RD.els.filter(e => e.kind === 'botella' && e.cable_id === c.id).sort((x, y) => (x.chain_m || 0) - (y.chain_m || 0)), use = c.props?.use || {}, ed = rdEdit() && online();
  const ns = Object.values(use).filter(u => u.s === 'serv').length, nr = Object.values(use).filter(u => u.s === 'res').length;
  return `<h2>Cable ${esc(c.name || 'sin nombre')}</h2><div class="rd-row"><span class="rd-chip">${c.fibers} pelos · ${rdBufN(c)} buffers de ${c.per_buffer}</span><span class="rd-chip">${{ aereo: 'Aéreo', subterraneo: 'Subterráneo', mixto: 'Mixto', drop: 'Drop' }[c.kind]}</span></div>
    <dl class="rd-kv"><dt>Desde</dt><dd>${esc(A ? rdName(A) : '—')}</dd><dt>Hasta</dt><dd>${esc(B ? rdName(B) : '—')}</dd><dt>Largo</dt><dd>${rdKm(rdLen(c))}</dd><dt>Botellas</dt><dd>${bots.length}</dd></dl>
    ${ed ? '<div class="rd-row"><button class="btn sec small" id="rk-ed">Editar datos del cable</button></div>' : ''}
    <h3>Uso de los pelos</h3><p class="muted sm">${ns} en servicio · ${nr} en reserva · ${c.fibers - ns - nr} libres.${ed ? ' Tocá un pelo para cambiar su uso: libre → en servicio → reserva.' : ''}</p>
    ${[...Array(rdBufN(c))].map((_, i) => `<div><div class="sm muted" style="margin-bottom:3px"><span class="rd-sw" style="display:inline-block;vertical-align:-2px;background:${RD_FIB[i % 12][1]}"></span> B${i + 1} ${RD_FIB[i % 12][0]} ${rdFt(c, i)}</div><div class="rd-use">${[...Array(c.per_buffer)].map((_, k) => { const f = i * c.per_buffer + k; return f < c.fibers ? `<button data-use="${f}" class="${use[f]?.s || ''}" title="${esc(rdFLong(c, f))}${use[f]?.t ? ' · ' + esc(use[f].t) : ''}" ${ed ? '' : 'disabled'}>${k + 1}</button>` : ''; }).join('')}</div></div>`).join('')}
    ${ed && RD.usePend ? '<div class="rd-row"><button class="btn small" id="rk-save">Guardar uso de pelos</button><button class="btn sec small" id="rk-undo">Descartar</button></div>' : ''}
    ${bots.length ? `<h3>Botellas sobre este cable</h3>${bots.map(b => `<button class="rd-item" data-go="${b.id}"><b>${esc(rdName(b))}</b><span class="muted sm">${b.chain_m != null ? rdKm(+b.chain_m) : ''}${rdCutN(b) ? ' · <b style="color:var(--red)">pelo cortado</b>' : ''}</span></button>`).join('')}` : ''}`;
}
function rdApPanel(a){
  const caja = a.parent_id && rdEl(a.parent_id), bot = caja?.parent_id && rdEl(caja.parent_id), m = (a.code || '').split('-'), ok = m.length >= 7, ed = rdEdit() && online();
  const pl = rdPathUp(a), km = pl.length > 1 ? cumOf(pl.map(p => [p[1], p[0]])).pop() / 1000 : 0, fus = Math.max(1, pl.length - 1);
  const sl = s => ({ '1x2': 3.7, '1x4': 7.3, '1x8': 10.5, '1x16': 13.7, '1x32': 17.1 }[s] || 0), n1 = caja?.props?.n1 ?? '1x2', n2 = caja?.props?.n2 || '1x8';
  const pw = 3 - sl(n1) - sl(n2) - fus * 0.1 - 0.6 - km * 0.35, f1 = x => x.toFixed(1).replace('.', ','), old = a.props?.old || [];
  let h = `<h2>${esc(rdName(a))}</h2>${old.length ? `<div class="muted sm">Códigos anteriores: ${old.map(esc).join(', ')}</div>` : ''}<div class="rd-row">${rdPosChip(a)}</div>
    ${ok ? `<div class="rd-parts"><span><b>${esc(m[1])}</b>OLT</span><span><b>${esc(m[2])}</b>rama</span><span><b>${esc(m[3])}</b>botella</span><span><b>${esc(m[4])}</b>caja</span><span><b>${esc(m[5])}</b>salida</span><span><b>${esc(m[6])}</b>n° AP</span></div>` : ''}
    <h3>De dónde cuelga</h3>${bot ? `<button class="rd-item" data-go="${bot.id}">Botella <b>${esc(rdName(bot))}</b></button>` : ''}${caja ? `<button class="rd-item" data-go="${caja.id}">Caja <b>${esc(rdName(caja))}</b><span class="muted sm">${esc(caja.name || '')} · splitter ${esc(n1 || 'sin')} → ${esc(n2)}</span></button><div class="rd-item">Salida <b>${a.port || '—'}</b></div>` : '<div class="rd-alert">Todavía no está asociado a una caja.</div>'}
    <div class="rd-row">${caja ? `<button class="btn small" id="ra-light">${RD.light === a.id ? 'Apagar camino' : 'Iluminar camino'}</button>` : ''}${ed ? '<button class="btn sec small" id="ra-move">Derivar a otra caja o salida</button>' : ''}</div>
    ${caja ? `<h3>Potencia esperada en el AP</h3><dl class="rd-kv"><dt>Salida de la OLT</dt><dd>+3,0 dBm</dd>${n1 ? `<dt>Splitter ${esc(n1)}</dt><dd>−${f1(sl(n1))} dB</dd>` : ''}<dt>Splitter ${esc(n2)}</dt><dd>−${f1(sl(n2))} dB</dd><dt>${fus} fusiones</dt><dd>−${f1(fus * 0.1)} dB</dd><dt>2 conectores</dt><dd>−0,6 dB</dd><dt>${km.toFixed(2).replace('.', ',')} km</dt><dd>−${(km * 0.35).toFixed(2).replace('.', ',')} dB</dd><dt><b>Debería llegar</b></dt><dd><b>${f1(pw)} dBm</b></dd></dl><p class="muted sm">Valores típicos; la distancia es en línea entre elementos.</p>` : ''}
    ${rdBasics(a)}`;
  if (RD.moving === a.id){ const cs = RD.els.filter(x => x.kind === 'caja' && (rdFree(x).length || x.id === a.parent_id)).sort((x, y) => havm(rdLL(a), rdLL(x)) - havm(rdLL(a), rdLL(y))).slice(0, 12);
    h += `<h3>Nueva ubicación (las 12 cajas más cercanas con salidas libres)</h3>${cs.map(x => `<div class="rd-item"><b>${esc(rdName(x))}</b><span class="muted sm">${esc(x.name || '')} · a ${Math.round(havm(rdLL(a), rdLL(x)))} m</span><div class="rd-pick">${rdFree(x).map(p => `<button data-mv="${x.id}|${p}">salida ${p}</button>`).join('')}</div></div>`).join('') || '<p class="muted sm">No hay cajas con salidas libres.</p>'}`; }
  return h;
}
function rdCajaPanel(c){
  const aps = rdKids(c.id).filter(e => e.kind === 'ap'), np = rdPorts(c), n1 = c.props?.n1 ?? '1x2', n2 = c.props?.n2 || '1x8', bot = c.parent_id && rdEl(c.parent_id), ed = rdEdit() && online();
  const H = Math.max(120, 22 + np * 26), o = [], mid = H / 2;
  o.push(`<line x1="6" y1="${mid}" x2="${n1 ? 54 : 130}" y2="${mid}" stroke="#1D4ED8" stroke-width="3"/>`);
  if (n1) o.push(`<path d="M54 ${mid - 16}L54 ${mid + 16}L86 ${mid}Z" fill="#F08A8A" stroke="#12222E"/><text x="56" y="${mid + 30}" font-size="11">${esc(n1)}</text><line x1="86" y1="${mid - 5}" x2="130" y2="${mid - 5}" stroke="#12222E" stroke-width="1.5"/><line x1="86" y1="${mid + 6}" x2="104" y2="${mid + 6}" stroke="#EA7A0C" stroke-width="1.5"/><text x="88" y="${mid + 44}" font-size="9" fill="#B45309">resto: reserva</text>`);
  o.push(`<path d="M130 ${mid - 26}L130 ${mid + 26}L172 ${mid}Z" fill="#F08A8A" stroke="#12222E"/><text x="132" y="${mid + 40}" font-size="11">${esc(n2)}</text>`);
  const outs = rdOuts(c);
  for (let p = 1; p <= np; p++){ const y = 16 + (p - 1) * 26, a = aps.find(x => x.port === p), tx = !a && outs[p], col = a ? '#0B7A75' : tx ? '#B45309' : '#5C6F7C';
    const act = ed ? `data-out="${p}" style="cursor:pointer"` : a ? `data-go="${a.id}" style="cursor:pointer"` : '';
    o.push(`<g ${act}><path d="M172 ${mid}C200 ${mid} 190 ${y} 218 ${y}" fill="none" stroke="${a ? '#15803D' : tx ? '#F59E0B' : '#D5DEE4'}" stroke-width="2" pointer-events="none"/><circle cx="218" cy="${y}" r="5" fill="${a || tx ? col : '#fff'}" stroke="${col}"/><rect x="212" y="${y - 11}" width="166" height="22" fill="transparent"/><text x="228" y="${y + 4}" font-size="11" fill="${a ? '#12222E' : col}" style="${a || tx ? 'font-weight:600' : ''}">${p} · ${a ? esc(rdName(a)) : tx ? esc(String(tx).slice(0, 26)) : 'libre'}${ed ? ' ✎' : ''}</text></g>`); }
  const loose = aps.filter(a => !a.port || a.port > np);
  return `<h2>${esc(rdName(c))}</h2><div class="rd-row"><span class="rd-chip">${esc(c.name || 'Sin dirección cargada')}</span>${rdPosChip(c)}</div>
    ${bot ? `<button class="rd-item" data-go="${bot.id}">Cuelga de la botella <b>${esc(rdName(bot))}</b></button>` : ''}
    <h3>Splitters y salidas</h3><div class="rd-uni"><svg viewBox="0 0 380 ${H}" width="100%" style="max-width:380px;display:block">${o.join('')}</svg></div>
    ${loose.length ? `<div class="rd-alert">AP sin salida válida: ${loose.map(a => esc(rdName(a))).join(', ')}</div>` : ''}
    <dl class="rd-kv"><dt>Nivel 1</dt><dd>${ed ? `<select id="rj-n1" style="width:auto;margin:0">${['', '1x2', '1x4', '1x8'].map(x => `<option value="${x}" ${x === n1 ? 'selected' : ''}>${x || 'sin splitter'}</option>`).join('')}</select>` : esc(n1 || 'sin')}</dd>
      <dt>Nivel 2</dt><dd>${ed ? `<select id="rj-n2" style="width:auto;margin:0">${['1x4', '1x8', '1x16', '1x32'].map(x => `<option ${x === n2 ? 'selected' : ''}>${x}</option>`).join('')}</select>` : esc(n2)}</dd><dt>Salidas</dt><dd>${np - rdFree(c).length} ocupadas · ${rdFree(c).length} libres</dd></dl>${ed ? '<p class="muted sm" style="margin:4px 0 0">Tocá una salida (✎) para conectarle un AP, escribir otro destino o liberarla.</p>' : ''}${rdBasics(c)}`;
}
function rdBindSide(e, c){
  const s = $('#rd-side');
  s.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { RD.sel = b.dataset.go; RD.open = null; RD.pick = null; const t = rdEl(RD.sel); if (t && t.lat != null && RD.map) RD.map.panTo([t.lat, t.lng]); rdDraw(); rdSide(); });
  $('#re-grp')?.addEventListener('click', () => { const g = rdGroup(e), pre = /^(.*?[-_ ])\d+$/.exec(e.code)[1], kids = RD.els.filter(x => g.some(y => y.id === x.parent_id) && !g.includes(x));
    if (kids.length) return toast(`Hay ${rdPl(kids.length, 'elemento que depende', 'elementos que dependen')} de este grupo: primero movelos o borralos.`);
    const m = modal(`<h2>¿Borrar ${g.length} ${e.kind === 'botella' ? 'botellas' : 'elementos'}?</h2><p>Se borran todos los que tienen código <b>${esc(pre)}…</b> (${esc(g.slice(0, 3).map(x => x.code).join(', '))}${g.length > 3 ? '…' : ''}).</p>
      <p class="muted sm">Queda registrado en Cambios y se puede recuperar desde ahí.</p><label>Motivo</label><input id="rg-m" maxlength="120" placeholder="Ej.: planilla cargada con los nodos equivocados">
      <div class="row" style="justify-content:flex-end;gap:6px;margin-top:10px"><button class="btn sec" id="rg-x">Cancelar</button><button class="btn danger" id="rg-ok">Borrar ${g.length}</button></div>`);
    $('#rg-x').onclick = m.close;
    $('#rg-ok').onclick = async () => { if (!needOnline()) return; $('#rg-ok').disabled = true; const why = $('#rg-m').value.trim();
      const { data, error } = await sb.rpc('net_bulk_del', { p_net: RD.net.id, p_ids: g.map(x => x.id), p_descr: `Borrar ${g.length} ${e.kind === 'botella' ? 'botellas' : 'elementos'} ${pre}…${why ? ': ' + why : ''}` });
      if (error){ $('#rg-ok').disabled = false; return toast(errText(error)); } m.close(); RD.sel = null; await rdReload(); toast(`Se borraron ${data}. Se pueden recuperar desde Cambios.`); }; });
  $('#re-conf')?.addEventListener('click', () => rdApply('el', e.id, 'upd', { pos: 'confirmada' }, `Confirmar en campo la posición de ${rdName(e)}`));
  $('#re-ed')?.addEventListener('click', () => { const m = modal(`<h2>Editar ${esc(RD_KIND[e.kind].toLowerCase())}</h2><label>Código</label><input id="rz-c" maxlength="80" value="${esc(e.code || '')}"><label>Nombre / dirección</label><input id="rz-n" maxlength="160" value="${esc(e.name || '')}">
      <div class="row" style="justify-content:flex-end;gap:6px;margin-top:10px"><button class="btn sec" id="rz-x">Cancelar</button><button class="btn" id="rz-ok">Guardar</button></div>`);
    $('#rz-x').onclick = m.close; $('#rz-ok').onclick = async () => { const code = $('#rz-c').value.trim() || null, name = $('#rz-n').value.trim() || null; m.close(); await rdApply('el', e.id, 'upd', { code, name }, `Editar datos de ${rdName(e)}`); }; });
  if (c){
    $('#rk-ed')?.addEventListener('click', () => { const m = modal(`<h2>Editar cable</h2><label>Nombre</label><input id="rz-n" maxlength="160" value="${esc(c.name || '')}">
        <div class="grid2"><div><label>Pelos</label><input id="rz-f" type="number" min="1" max="576" value="${c.fibers}"></div><div><label>Pelos por buffer</label><input id="rz-b" type="number" min="1" max="24" value="${c.per_buffer}"></div></div>
        <div class="grid2"><div><label>Tendido</label><select id="rz-k">${[['aereo', 'Aéreo'], ['subterraneo', 'Subterráneo'], ['mixto', 'Mixto'], ['drop', 'Drop']].map(([k, t]) => `<option value="${k}" ${c.kind === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div><div><label>Largo real (m)</label><input id="rz-l" type="number" min="0" value="${Math.round(rdLen(c))}"></div></div>
        <div class="row" style="justify-content:flex-end;gap:6px;margin-top:10px"><button class="btn sec" id="rz-x">Cancelar</button><button class="btn" id="rz-ok">Guardar</button></div>`);
      $('#rz-x').onclick = m.close; $('#rz-ok').onclick = async () => { const d = { name: $('#rz-n').value.trim() || null, fibers: +$('#rz-f').value || c.fibers, per_buffer: +$('#rz-b').value || c.per_buffer, kind: $('#rz-k').value, length_m: +$('#rz-l').value || null }; m.close(); await rdApply('cb', c.id, 'upd', d, `Editar cable ${c.name || ''}`); }; });
    s.querySelectorAll('[data-use]').forEach(b => b.onclick = () => { const f = b.dataset.use; if (!RD.usePend){ RD.usePend = true; RD.use0 = JSON.stringify(c.props || {}); } c.props = { ...(c.props || {}), use: { ...(c.props?.use || {}) } };
      const cur = c.props.use[f]?.s; if (!cur) c.props.use[f] = { s: 'serv' }; else if (cur === 'serv') c.props.use[f] = { s: 'res' }; else delete c.props.use[f]; rdSide(); });
    $('#rk-undo')?.addEventListener('click', () => { c.props = JSON.parse(RD.use0); RD.usePend = false; rdSide(); });
    $('#rk-save')?.addEventListener('click', async () => { const props = c.props; c.props = JSON.parse(RD.use0); RD.usePend = false; await rdApply('cb', c.id, 'upd', { props }, `Cambiar el uso de los pelos del cable ${c.name || ''}`); });
    return; }
  if (!e) return;
  if (e.kind === 'nodo'){
    $('#rn-gab')?.addEventListener('click', async () => { try { await needLib('gab'); gabOpen(e.id); } catch (err){ toast(errText(err)); } });
    $('#rn-cut')?.addEventListener('click', () => { const props = { ...(e.props || {}) }; if (rdIsCut(e)) delete props.drop; else props.drop = [...Array(rdNbOf(e)).keys()];
      rdApply('el', e.id, 'upd', { props }, `${rdName(e)}: ${rdIsCut(e) ? 'deja de ser corte de tramo' : 'pasa a ser corte de tramo óptico (bajan todos los buffers)'}`); });
    $('#rn-tipo')?.addEventListener('change', ev => { const props = { ...(e.props || {}), tipo: +ev.target.value }; delete props.drop; rdApply('el', e.id, 'upd', { props }, `${rdName(e)}: pasa a ${RD_TIPOS[ev.target.value].n}`); });
    s.querySelectorAll('[data-buf]').forEach(b => b.onclick = () => { const i = +b.dataset.buf, cur = rdDropOf(e).filter(x => x < 24), drop = cur.includes(i) ? cur.filter(x => x !== i) : [...cur, i].sort((x, y) => x - y);
      rdApply('el', e.id, 'upd', { props: { ...(e.props || {}), drop } }, `${rdName(e)}: el buffer B${i + 1} ahora ${drop.includes(i) ? 'baja al distribuidor' : 'pasa de largo'}`); }); }
  if (e.kind === 'botella' && RD.net.kind === 'troncal'){
    const cb = rdCableOf(e), sp = rdSp(e), save = (sp2, descr) => rdApply('el', e.id, 'upd', { props: { ...(e.props || {}), sp: sp2 } }, descr);
    s.querySelectorAll('[data-open]').forEach(x => x.onclick = () => { RD.open = RD.open === +x.dataset.open ? null : +x.dataset.open; RD.pick = null; RD.deriv = null; rdSide(); });
    s.querySelectorAll('.rd-fr').forEach(x => x.onclick = () => { RD.pick = RD.pick === +x.dataset.f ? null : +x.dataset.f; RD.deriv = null; rdSide(); });
    const f = RD.pick; if (f == null) return; const g = rdMapOf(sp, f);
    s.querySelector('[data-cut]')?.addEventListener('click', () => save({ ...sp, out: { ...sp.out, [g]: 'cort' } }, `${rdName(e)}: ${rdFLong(cb, g)} marcado como cortado`));
    s.querySelector('[data-fix]')?.addEventListener('click', () => { const out = { ...sp.out }; delete out[g]; save({ ...sp, out }, `${rdName(e)}: ${rdFLong(cb, g)} reparado`); });
    s.querySelector('[data-der]')?.addEventListener('click', () => { RD.deriv = f; rdSide(); });
    s.querySelector('[data-cancel]')?.addEventListener('click', () => { RD.deriv = null; rdSide(); });
    s.querySelector('[data-back]')?.addEventListener('click', () => { const map = { ...sp.map }, out = { ...sp.out }; delete map[f]; delete out[g]; save({ ...sp, map, out }, `${rdName(e)}: ${rdFLong(cb, f)} vuelve al empalme directo (se libera ${rdFName(cb, g)})`); });
    s.querySelectorAll('[data-to]').forEach(x => x.onclick = async () => { const to = +x.dataset.to, why = ($('#rf-why')?.value || '').trim();
      const next = RD.els.filter(y => y.kind === 'botella' && y.cable_id === e.cable_id && (y.chain_m || 0) > (e.chain_m || 0)).sort((p, q) => p.chain_m - q.chain_m)[0], B = cb.b_id && rdEl(cb.b_id);
      const where = next ? `la botella ${rdName(next)}` : B ? `el nodo ${rdName(B)}` : 'el otro extremo';
      RD.deriv = null;
      const row = await save({ ...sp, map: { ...sp.map, [f]: to }, out: { ...sp.out, [g]: 'cort', [to]: 'serv' } }, `${rdName(e)}: ${rdFLong(cb, f)} derivado a ${rdFLong(cb, to)}${why ? ' · ' + why : ' por corte'}. Falta el regreso en ${where}.`);
      if (row) toast(`Falta el regreso: en ${where} hay que pasar de ${rdFName(cb, to)} a ${rdFName(cb, f)}.`, next ? { label: 'Abrir ' + rdName(next), fn: () => { RD.sel = next.id; RD.open = Math.floor(to / cb.per_buffer); RD.pick = to; rdDraw(); rdSide(); } } : undefined); }); }
  if (e.kind === 'ap'){
    $('#ra-light')?.addEventListener('click', () => { RD.light = RD.light === e.id ? null : e.id; rdDraw(); rdSide(); });
    $('#ra-move')?.addEventListener('click', () => { RD.moving = RD.moving === e.id ? null : e.id; rdSide(); });
    s.querySelectorAll('[data-mv]').forEach(x => x.onclick = async () => { const [cid, p] = x.dataset.mv.split('|'); RD.moving = null; const row = await rdAssign(e, rdEl(cid), +p); if (row){ RD.sel = row.id; rdSide(); } }); }
  if (e.kind === 'caja') s.querySelectorAll('[data-out]').forEach(g => g.onclick = () => rdOutEdit(e, +g.dataset.out));
  if (e.kind === 'caja') for (const k of ['n1', 'n2']) $('#rj-' + k)?.addEventListener('change', ev => rdApply('el', e.id, 'upd', { props: { ...(e.props || {}), [k]: ev.target.value } }, `${rdName(e)}: splitter de nivel ${k === 'n1' ? 1 : 2} pasa a ${ev.target.value || 'sin splitter'}`));
}

/* ---------- cambios: confirmar / rechazar ---------- */
function rdTray(){
  const mgr = rdMgr() && online();
  const m = modal(`<div class="row between"><h2 style="margin:0">Cambios de la red</h2><button class="btn sec small" id="rt-x">Cerrar</button></div>
    <p class="muted sm">El técnico registra el cambio en el lugar y la red queda actualizada al momento. Supervisor, coordinador, PM o administrador lo confirma o lo rechaza; si se rechaza, vuelve a como estaba.</p>
    <div style="display:grid;gap:6px;max-height:60vh;overflow:auto">${RD.ch.map(h => `<div class="rd-item ${h.status === 'pendiente' ? 'pend' : h.status === 'confirmado' ? 'ok' : 'rej'}"><div><b>${esc(h.descr)}</b></div>
      <div class="muted sm">${esc(fmtDT(h.created_at))} · ${esc(h.created_name || '')} · ${h.status === 'pendiente' ? 'pendiente de confirmar' : h.status === 'confirmado' ? 'confirmado' + (h.decided_name && h.decided_name !== h.created_name ? ' por ' + esc(h.decided_name) : '') : 'rechazado' + (h.decided_name ? ' por ' + esc(h.decided_name) : '') + (h.note ? ': ' + esc(h.note) : '')}</div>
      ${mgr && h.target_kind === 'red' && (h.op === 'import' || h.op === 'del') && h.status !== 'rechazado' ? `<div class="rd-row"><button class="btn sec small" data-undo="${h.id}" style="${h.op === 'import' ? 'color:var(--red)' : ''}">${h.op === 'import' ? 'Deshacer esta carga' : 'Recuperar lo borrado'}</button></div>` : ''}
      ${h.status === 'pendiente' && mgr ? `<div class="rd-row"><button class="btn small" data-ok="${h.id}">Confirmar</button><button class="btn sec small" data-rej="${h.id}" style="color:var(--red)">Rechazar</button>${h.target_id && h.op !== 'del' ? `<button class="btn sec small" data-see="${h.target_id}">Ver en el mapa</button>` : ''}</div>` : ''}</div>`).join('') || '<p class="muted">Todavía no hay cambios registrados.</p>'}</div>`, { wide: true });
  $('#rt-x').onclick = m.close;
  const dec = async (id, ok) => { if (!needOnline()) return; const { error } = await sb.rpc('net_decide', { p_change: +id, p_ok: ok, p_note: null }); if (error) return toast(errText(error)); m.close(); await rdReload(); rdTray(); };
  m.el.querySelectorAll('[data-ok]').forEach(b => b.onclick = () => dec(b.dataset.ok, true));
  m.el.querySelectorAll('[data-rej]').forEach(b => b.onclick = () => dec(b.dataset.rej, false));
  m.el.querySelectorAll('[data-undo]').forEach(b => b.onclick = () => { const h = RD.ch.find(x => x.id == b.dataset.undo); if (!h) return;
    const imp = h.op === 'import', c = modal(`<h2>${imp ? '¿Deshacer esta carga?' : '¿Recuperar lo borrado?'}</h2><p class="sm">${esc(h.descr)}</p><p class="muted sm">${imp ? 'Se borran los elementos y cables que creó esa carga. Lo que la carga solo actualizó queda como está.' : 'Vuelven a aparecer en el mapa.'}</p>
      <div class="row" style="justify-content:flex-end;gap:6px"><button class="btn sec" id="ug-x">Cancelar</button><button class="btn ${imp ? 'danger' : ''}" id="ug-ok">${imp ? 'Deshacer' : 'Recuperar'}</button></div>`);
    $('#ug-x').onclick = c.close;
    $('#ug-ok').onclick = async () => { if (!needOnline()) return; const { data, error } = await sb.rpc('net_undo_group', { p_change: +h.id }); if (error){ c.close(); return toast(errText(error)); }
      c.close(); m.close(); await rdReload(); toast(imp ? `Carga deshecha: ${rdPl(data, 'elemento borrado', 'elementos borrados')}.` : `Recuperados: ${data}.`); rdTray(); }; });
  m.el.querySelectorAll('[data-see]').forEach(b => b.onclick = () => { const t = rdEl(b.dataset.see) || rdCb(b.dataset.see); if (!t) return toast('Ese elemento ya no está en el mapa.'); m.close(); RD.sel = t.id; if (t.lat != null) RD.map.setView([t.lat, t.lng], Math.max(RD.map.getZoom(), 16)); rdDraw(); rdSide(); });
}

/* ---------- unifilar automático ---------- */
function rdUnifilar(){
  let svg = '', note = '', sel = '';
  if (RD.net.kind === 'troncal'){
    const nodes = RD.els.filter(e => e.kind === 'nodo' && e.lat != null).sort((a, b) => (a.name || a.code || '').localeCompare(b.name || b.code || '', 'es'));
    let pick = null; try { pick = JSON.parse(localStorage.getItem('ia_rduni:' + RD.net.id) || 'null'); } catch {}
    if (rdUnifilar.ab) pick = rdUnifilar.ab;
    if ((!pick || !rdEl(pick[0]) || !rdEl(pick[1])) && nodes.length >= 2 && nodes.length <= 14){ let best = null; for (const a of nodes) for (const b of nodes){ const d = havm(rdLL(a), rdLL(b)); if (!best || d > best.d) best = { d, p: [a.id, b.id] }; } pick = best.p; }
    const A = pick && rdEl(pick[0]), B = pick && rdEl(pick[1]), rt = A && B && A.id !== B.id ? rdRoute(A, B) : null;
    sel = nodes.length >= 2 ? `<div class="rd-row" style="margin-bottom:8px"><span class="sm muted">Desde</span><select id="ru-a" style="width:auto;margin:0"><option value="">— nodo —</option>${nodes.map(n => `<option value="${n.id}" ${A?.id === n.id ? 'selected' : ''}>${esc(n.name || n.code)}</option>`).join('')}</select><span class="sm muted">hasta</span><select id="ru-b" style="width:auto;margin:0"><option value="">— nodo —</option>${nodes.map(n => `<option value="${n.id}" ${B?.id === n.id ? 'selected' : ''}>${esc(n.name || n.code)}</option>`).join('')}</select></div>` : '';
    if (!rt) note = nodes.length < 2 ? 'Hacen falta al menos dos nodos y el cable que los une.' : A && B ? 'No encuentro un recorrido de cable entre esos dos nodos.' : 'Elegí desde qué nodo hasta qué nodo querés ver el unifilar.';
    else {
      const on = l => l.map(e => ({ e, r: projectOn(rt.path, rt.cum, rdLL(e)) })), st = on(nodes).filter(x => x.r.off < 700).sort((x, y) => x.r.chain - y.r.chain).filter((x, i, a) => !i || x.r.chain - a[i - 1].r.chain > 300 || rdNorm(x.e.name || x.e.code) !== rdNorm(a[i - 1].e.name || a[i - 1].e.code)), bots = on(RD.els.filter(e => e.kind === 'botella' && e.lat != null)).filter(x => x.r.off < 80);
      const trunk = RD.cbs.filter(c => c.kind !== 'drop'), cabAt = m => rdSnap(pointAt(rt.path, rt.cum, m), trunk)?.c || rdCableOf({});
      const W = 250, gap = 13, top = 70, o = [], segs = st.slice(1).map((x, i) => ({ c: cabAt((st[i].r.chain + x.r.chain) / 2), a: st[i].r.chain, b: x.r.chain })), nbAll = Math.max(8, ...segs.map(s => rdBufN(s.c))), H = top + nbAll * gap + 100;
      st.forEach((x, i) => { const n = x.e, cx = i * W + 125, xl = i * W + 10, drop = rdDropOf(n), t = RD_TIPOS[n.props?.tipo], sl = segs[i - 1], sr = segs[i];
        o.push(`<rect x="${cx - 82}" y="8" width="164" height="24" rx="4" fill="#fff" stroke="${rdIsCut(n) ? '#EA580C' : '#12222E'}" stroke-width="${rdIsCut(n) ? 2 : 1}"/><text x="${cx}" y="25" text-anchor="middle" font-size="11" font-weight="700" data-uni="${n.id}" style="cursor:pointer">${esc((n.name || n.code || '').toUpperCase().slice(0, 20))}</text><text x="${cx}" y="46" text-anchor="middle" font-size="10" fill="#5C6F7C">${t ? 'NODO TIPO ' + n.props.tipo : 'NODO'}</text>`);
        o.push(`<circle cx="${cx}" cy="${top + nbAll * gap / 2}" r="${nbAll * gap * 0.58}" fill="none" stroke="#93A6B2" stroke-dasharray="3 3"/>`);
        const nb = Math.max(sl ? rdBufN(sl.c) : 0, sr ? rdBufN(sr.c) : 0);
        for (let j = 0; j < nb; j++){ const y = top + j * gap + 6, col = RD_FIB[j % 12][1] === '#F4F4F4' ? '#93A6B2' : RD_FIB[j % 12][1], dp = drop.includes(j), x0 = sl && j < rdBufN(sl.c) ? xl : cx, x1 = sr && j < rdBufN(sr.c) ? xl + W : cx, ox = cx - 40 + drop.indexOf(j) * 10;
          if (dp){ if (x0 < cx) o.push(`<path d="M${x0} ${y}H${ox - 3}V52" fill="none" stroke="${col}" stroke-width="1.6"/>`); if (x1 > cx) o.push(`<path d="M${x1} ${y}H${ox + 3}V52" fill="none" stroke="${col}" stroke-width="1.6"/>`); }
          else if (x1 > x0) o.push(`<path d="M${x0} ${y}H${x1}" fill="none" stroke="${col}" stroke-width="1.6"/>`);
          if (i === 0) o.push(`<text x="${cx - nbAll * gap * 0.58 - 22}" y="${y + 3}" font-size="9" fill="#5C6F7C">B${j + 1}</text>`); }
        if (sr){ const bs = bots.filter(q => q.r.chain > sr.a && q.r.chain < sr.b), yb = top + nbAll * gap, x1 = cx + 72, x2 = cx + W - 72;
          o.push(`<text x="${cx + W / 2}" y="${yb + 20}" text-anchor="middle" font-size="11" font-weight="600">${((sr.b - sr.a) / 1000).toFixed(1).replace('.', ',')} km · ${sr.c.fibers} pelos</text><text x="${cx + W / 2}" y="${yb + 34}" text-anchor="middle" font-size="10" fill="#5C6F7C">${rdPl(bs.length, 'botella', 'botellas')}${sr.c.kind === 'subterraneo' ? ' · subterráneo' : ''}</text>`);
          bs.forEach(q => { const bx = x1 + (x2 - x1) * (q.r.chain - sr.a) / Math.max(1, sr.b - sr.a), b = q.e;
            o.push(`<rect data-uni="${b.id}" x="${bx - 3.5}" y="${top - 3}" width="7" height="${rdBufN(sr.c) * gap + 6}" rx="3" fill="${rdCutN(b) ? '#C0262D' : b.pos === 'confirmada' ? '#15803D' : '#B45309'}" fill-opacity=".45" stroke="#12222E" stroke-width=".6" style="cursor:pointer"><title>${esc(rdName(b))}</title></rect>`); }); } });
      // tramos ópticos: de corte a corte (los extremos de la vista cuentan como inicio y fin)
      const cuts = st.map((x, i) => rdIsCut(x.e) || i === 0 || i === st.length - 1 ? i : -1).filter(i => i >= 0), yt = top + nbAll * gap + 52;
      st.forEach((x, i) => { if (rdIsCut(x.e)){ const cx = i * W + 125; o.push(`<path d="M${cx} ${top - 8}V${top + nbAll * gap + 10}" stroke="#EA580C" stroke-width="2" stroke-dasharray="5 3"/><text x="${cx}" y="${top + nbAll * gap + 24}" text-anchor="middle" font-size="9.5" font-weight="700" fill="#C2410C">✂ CORTE DE TRAMO</text>`); } });
      cuts.slice(1).forEach((ci, k) => { const a = cuts[k], xa = a * W + 125, xb = ci * W + 125, km = (st[ci].r.chain - st[a].r.chain) / 1000;
        o.push(`<path d="M${xa + 6} ${yt}V${yt + 6}H${xb - 6}V${yt}" fill="none" stroke="#C2410C" stroke-width="1.4"/><text x="${(xa + xb) / 2}" y="${yt + 20}" text-anchor="middle" font-size="11" font-weight="700" fill="#9A3412">TRAMO ÓPTICO ${k + 1}: ${esc((st[a].e.name || st[a].e.code || '').toUpperCase())} → ${esc((st[ci].e.name || st[ci].e.code || '').toUpperCase())} · ${km.toFixed(1).replace('.', ',')} km</text>`); });
      const maxW = st.length * W + 20;
      svg = `<svg viewBox="0 0 ${maxW} ${H}" width="${maxW}" height="${H}" style="display:block;font-family:inherit">${o.join('')}</svg>`;
      note = `${st.length} nodos en ${rdKm(rt.len)}${cuts.length > 2 ? ', ' + (cuts.length - 1) + ' tramos ópticos' : ''}. Los buffers que bajan suben al distribuidor del nodo; el resto pasa de largo. Tocá una botella o un nodo para abrirlo.`;
    }
  } else {
    const o = [], X = [70, 200, 380, 590]; let y = 20; const Y = {};
    const roots = RD.els.filter(e => e.kind === 'botella').sort((a, b) => (a.code || '').localeCompare(b.code || '', 'es', { numeric: true }));
    const cajasOf = b => rdKids(b.id).filter(e => e.kind === 'caja').sort((a, c) => (a.code || '').localeCompare(c.code || '', 'es', { numeric: true }));
    const drawCaja = c => { const as = rdKids(c.id).filter(e => e.kind === 'ap').sort((p, q) => (p.port || 99) - (q.port || 99)), cy = y + Math.max(1, as.length) * 9;
      o.push(`<path d="M${X[2] - 52} ${cy - 9}L${X[2] - 52} ${cy + 9}L${X[2] - 34} ${cy}Z" fill="#F08A8A" stroke="#12222E" data-uni="${c.id}" style="cursor:pointer"/><text x="${X[2] - 28}" y="${cy - 3}" font-size="10" font-weight="600" data-uni="${c.id}" style="cursor:pointer">${esc(rdName(c))}</text><text x="${X[2] - 28}" y="${cy + 9}" font-size="9" fill="#5C6F7C">${esc(c.props?.n1 ?? '1x2')} → ${esc(c.props?.n2 || '1x8')} ${esc((c.name || '').slice(0, 24))}</text>`);
      as.forEach((a, i) => { const ay = y + i * 18 + 9; o.push(`<path d="M${X[2] + 150} ${cy}C${X[3] - 40} ${cy} ${X[3] - 50} ${ay} ${X[3] - 14} ${ay}" fill="none" stroke="#93A6B2"/><circle cx="${X[3] - 8}" cy="${ay}" r="4.5" fill="#0B7A75" data-uni="${a.id}" style="cursor:pointer"/><text x="${X[3] + 2}" y="${ay + 3.5}" font-size="10" data-uni="${a.id}" style="cursor:pointer">${a.port || '?'} · ${esc(rdName(a))}</text>`); });
      Y[c.id] = cy; y += Math.max(1, as.length) * 18 + 14; };
    roots.forEach(b => { const cs = cajasOf(b), y0 = y; if (!cs.length) y += 30; cs.forEach(drawCaja); const by = (y0 + y - 14) / 2; Y[b.id] = by;
      o.push(`<rect x="${X[1] - 50}" y="${by - 11}" width="110" height="22" rx="4" fill="#fff" stroke="#1D4ED8" stroke-width="1.5" data-uni="${b.id}" style="cursor:pointer"/><text x="${X[1] + 5}" y="${by + 4}" text-anchor="middle" font-size="10.5" font-weight="600" data-uni="${b.id}" style="cursor:pointer">${esc(rdName(b))}</text>`);
      cs.forEach(c => o.push(`<path d="M${X[1] + 60} ${by}C${X[2] - 90} ${by} ${X[2] - 100} ${Y[c.id]} ${X[2] - 52} ${Y[c.id]}" fill="none" stroke="#EA7A0C" stroke-width="1.5"/>`)); y += 10; });
    const orphan = RD.els.filter(e => e.kind === 'caja' && !(e.parent_id && rdEl(e.parent_id)));
    if (orphan.length){ o.push(`<text x="${X[1] - 50}" y="${y + 6}" font-size="11" fill="#B45309">Cajas sin botella asociada</text>`); y += 18; orphan.forEach(drawCaja); }
    const H = y + 10, olt = RD.els.find(e => e.kind === 'olt');
    if (roots.length) o.unshift(`<path d="M${X[0]} 20V${H - 20}" stroke="#1D4ED8" stroke-width="5" stroke-linecap="round"/>` + roots.map(b => `<path d="M${X[0]} ${Y[b.id]}H${X[1] - 50}" stroke="#1D4ED8" stroke-width="2"/>`).join('') + `<rect x="${X[0] - 40}" y="${H / 2 - 14}" width="62" height="28" rx="5" fill="#0F2A4A"/><text x="${X[0] - 9}" y="${H / 2 + 4}" text-anchor="middle" font-size="11" fill="#fff" font-weight="700">${esc((olt ? rdName(olt) : 'OLT').slice(0, 9))}</text>`);
    svg = RD.els.some(e => e.kind === 'caja' || e.kind === 'botella') ? `<svg viewBox="0 0 800 ${H}" width="800" height="${H}" style="display:block;font-family:inherit">${o.join('')}</svg>` : '';
    note = svg ? 'Cada rama muestra la botella, la caja con sus splitters y los AP por salida. Tocá cualquier elemento para abrirlo.' : 'Todavía no hay botellas ni cajas cargadas.';
  }
  const m = modal(`<div class="row between"><h2 style="margin:0">Unifilar · ${esc(RD.net.name)}</h2><button class="btn sec small" id="ru-x">Cerrar</button></div>
    <p class="muted sm">Se dibuja solo a partir del mapa, así que siempre está al día. ${note}</p>${sel}${svg ? `<div class="rd-uni">${svg}</div>` : ''}`, { wide: true });
  $('#ru-x').onclick = m.close;
  for (const k of ['a', 'b']) $('#ru-' + k)?.addEventListener('change', () => { const ab = [$('#ru-a').value, $('#ru-b').value]; if (!ab[0] || !ab[1]) return; rdUnifilar.ab = ab; try { localStorage.setItem('ia_rduni:' + RD.net.id, JSON.stringify(ab)); } catch {} m.close(); rdUnifilar(); });
  m.el.querySelectorAll('[data-uni]').forEach(b => b.onclick = () => { const t = rdEl(b.dataset.uni); if (!t) return; m.close(); RD.sel = t.id; if (t.lat != null) RD.map.setView([t.lat, t.lng], Math.max(RD.map.getZoom(), 15)); rdDraw(); rdSide(); });
}

/* ---------- bajar a Excel (mismo formato que se puede volver a subir) ---------- */
async function rdExport(){
  try { await needLib('xlsx'); } catch (e){ return toast(errText(e)); }
  const rows = RD.els.map(e => [RD_KIND[e.kind], e.code || '', e.name || '', e.lat, e.lng, e.parent_id ? rdEl(e.parent_id)?.code || '' : '', e.port || '', e.cable_id ? rdCb(e.cable_id)?.name || '' : '', e.chain_m ?? '', e.kind === 'nodo' ? e.props?.tipo || '' : e.kind === 'caja' ? `${e.props?.n1 ?? '1x2'} + ${e.props?.n2 || '1x8'}` : '', e.pos]);
  const wb = XLSX.utils.book_new(), ws = XLSX.utils.aoa_to_sheet([['Tipo', 'Código', 'Nombre', 'Latitud', 'Longitud', 'Depende de', 'Salida', 'Cable', 'Progresiva (m)', 'Tipo de nodo / splitters', 'Posición'], ...rows]);
  ws['!cols'] = [16, 22, 28, 12, 12, 20, 8, 26, 14, 20, 12].map(w => ({ wch: w })); XLSX.utils.book_append_sheet(wb, ws, 'Elementos');
  const w2 = XLSX.utils.aoa_to_sheet([['Cable', 'Desde', 'Hasta', 'Pelos', 'Pelos por buffer', 'Tendido', 'Largo (m)', 'Botellas'], ...RD.cbs.map(c => [c.name || '', c.a_id ? rdEl(c.a_id)?.code || rdEl(c.a_id)?.name || '' : '', c.b_id ? rdEl(c.b_id)?.code || rdEl(c.b_id)?.name || '' : '', c.fibers, c.per_buffer, c.kind, Math.round(rdLen(c)), RD.els.filter(e => e.cable_id === c.id && e.kind === 'botella').length])]);
  w2['!cols'] = [30, 20, 20, 8, 14, 12, 12, 10].map(w => ({ wch: w })); XLSX.utils.book_append_sheet(wb, w2, 'Cables');
  XLSX.writeFile(wb, `Red_${RD.net.name.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_')}_${todayStr()}.xlsx`);
}

/* ---------- ⬆ subir información: KMZ / KML, Excel de elementos, planilla de empalmes, .sor ---------- */
const rdNorm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
function rdGuess(name, folder, isPoint){
  const n = rdNorm(name), f = rdNorm(folder);
  if (!isPoint) return /radio/.test(f) && !/fo|fibra|tendido/.test(f) ? 'x' : (RD.net.kind === 'ftth' ? /drop|acometida|conexion/ : /drop|acometida/).test(n + ' ' + f) ? 'drop' : 'cable';
  if (/^ap[-_ ]?\d/.test(n)) return 'ap'; if (/^olt/.test(n)) return 'olt';
  if (/^(bot|be)[-_ ]|botella|empalme/.test(n) || /botella|empalme/.test(f)) return 'botella';
  if (/^(cdo|nap|cto|spn)/.test(n) || /caja|splitter/.test(f)) return 'caja';
  if (/^g-?fo|reserva|ganancia|rulo/.test(n) || /ganancia|reserva/.test(f)) return 'reserva';
  if (/poste|columna/.test(n) || /poste/.test(f)) return 'poste';
  if (/nodo|epi/.test(f) || /^nodo|^epi/.test(n)) return 'nodo';
  return RD.net.kind === 'troncal' ? 'nodo' : 'otro';
}
// recorrido entre dos elementos siguiendo los cables dibujados (aunque estén cortados en varios tramos o tengan ramales)
function rdRoute(a, b){
  const lines = []; // sin líneas repetidas (el mismo recorrido dibujado dos veces corta el camino)
  for (const c of RD.cbs){ if (c.kind === 'drop' || c.path.length < 2) continue; const p = c.path, len = rdLen(c);
    if (lines.some(l => Math.abs(l.len - len) < Math.max(5, len * 0.01) && ((havm(l.pts[0], p[0]) < 8 && havm(l.pts[l.pts.length - 1], p[p.length - 1]) < 8) || (havm(l.pts[0], p[p.length - 1]) < 8 && havm(l.pts[l.pts.length - 1], p[0]) < 8)))) continue;
    lines.push({ pts: p, len }); }
  if (!lines.length || !a || !b || a.lat == null || b.lat == null) return null;
  const r = pathAtoB(lines, rdLL(a), rdLL(b)); if (!r || r.path.length < 2 || r.offA > 400 || r.offB > 400) return null;
  const cum = cumOf(r.path); return { path: r.path, cum, len: cum[cum.length - 1] };
}
const rdD = d => d ? String(d).slice(0, 10).split('-').reverse().join('/') : '';
async function rdUpload(){
  if (!rdMgr() || !needOnline()) return;
  const inp = document.createElement('input'); inp.type = 'file'; inp.multiple = true; inp.accept = '.kmz,.kml,.xlsx,.xls,.csv,.sor,.pdf';
  inp.onchange = async () => {
    const files = [...inp.files].slice(0, 30); if (!files.length) return;
    const P = { els: [], cbs: [], probs: [], spl: null };       // spl = empalmes por progresiva (planilla o .sor)
    try {
      for (const f of files){
        if (f.size > 30 * 1024 * 1024){ P.probs.push(`${f.name}: supera 30 MB, no se leyó.`); continue; }
        if (/\.(kmz|kml)$/i.test(f.name)) rdReadKml(parseKML(await readKML(f)), P);
        else if (/\.sor$/i.test(f.name)){ const s = parseSor(await f.arrayBuffer()), end = s.events.find(e => e.end) || s.events[s.events.length - 1];
          (P.spl ||= { src: [], ev: [], total: 0, a: '', b: '' }).src.push(f.name); P.spl.total = Math.max(P.spl.total, end ? end.m : 0);
          s.events.filter(e => !e.end && e.m > 30 && !e.reflective).forEach(e => { if (!P.spl.ev.some(x => Math.abs(x.m - e.m) < 60)) P.spl.ev.push({ m: e.m, loss: {} }); }); }
        else if (/\.pdf$/i.test(f.name)){ if (RD.net.kind !== 'troncal'){ P.probs.push(`${f.name}: el unifilar en PDF se lee en las redes troncales.`); continue; } await rdReadPdf(await f.arrayBuffer(), f.name, P); }
        else { await needLib('xlsx'); rdReadXlsx(XLSX.read(await f.arrayBuffer()), f.name, P); }
      }
    } catch (e){ return toast('No pude leer el archivo: ' + errText(e)); }
    if (P.spl) P.spl.ev.sort((a, b) => a.m - b.m);
    if (P.dupL || P.dupP) P.probs.push(`El archivo tenía ${[P.dupL ? rdPl(P.dupL, 'línea repetida', 'líneas repetidas') : '', P.dupP ? rdPl(P.dupP, 'punto repetido', 'puntos repetidos') : ''].filter(Boolean).join(' y ')}: se cargan una sola vez.`);
    rdPreview(P, files.map(f => f.name).join(', '));
  };
  inp.click();
}
function rdReadKml(pms, P){
  const seen = new Map();
  for (const pm of pms){ if (!pm.pts.length) continue; const folder = pm.path.join(' / '), g = rdGuess(pm.name, folder, pm.isPoint), name = String(pm.name || '').replace(/[<>]/g, '').trim().slice(0, 160);
    if (pm.isPoint){ const ll = [+pm.pts[0][0].toFixed(6), +pm.pts[0][1].toFixed(6)]; if (name && P.els.some(e => e.name === name && havm([e.lng, e.lat], ll) < 100)){ P.dupP = (P.dupP || 0) + 1; continue; }
      P.els.push({ kind: g, name, lng: +pm.pts[0][0].toFixed(6), lat: +pm.pts[0][1].toFixed(6), group: (pm.path[pm.path.length - 1] || 'Sin carpeta') + ' · puntos', pos: 'archivo' }); }
    else if (pm.pts.length > 1 && pm.pts.length <= 20000){ const p0 = pm.pts[0], p1 = pm.pts[pm.pts.length - 1];
      if (P.cbs.some(c => Math.abs(c.path.length - pm.pts.length) <= 2 && havm(c.path[0], p0) < 8 && havm(c.path[c.path.length - 1], p1) < 8)){ P.dupL = (P.dupL || 0) + 1; continue; }   // la misma línea dos veces en el archivo
      const k = rdNorm(name) || 'sin nombre', n = (seen.get(k) || 0) + 1; seen.set(k, n);
      P.cbs.push({ kindG: g, name: n > 1 || !name ? `${name || 'Recorrido'} (${n})` : name, path: pm.pts.map(p => [+p[0].toFixed(6), +p[1].toFixed(6)]), group: (pm.path[pm.path.length - 1] || 'Sin carpeta') + ' · líneas' }); } }
}
/* ---------- unifilar en PDF: qué buffers bajan en cada nodo y el tipo de nodo ----------
   Se lee solo el texto del PDF (no se ejecuta nada del archivo). En cada columna "A NODO X" vienen pares
   "B1-B2: A X" (bajan al nodo) y "B3-…: A <otro>" (siguen). "NODO TIPO n" va arriba del nombre de cada nodo. */
const rdStop = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'a', 'nodo', 'epi', 'y']);
const rdTok = t => rdNorm(t).replace(/[^a-z0-9. ]/g, ' ').split(/\s+/).map(x => x.replace(/\.$/, '')).filter(x => x && !rdStop.has(x));
function rdSame(a, b){ const A = rdTok(a), B = rdTok(b); if (!A.length || !B.length) return false; const [S, L] = A.length <= B.length ? [A, B] : [B, A];
  if (L.length - S.length > 1 && S.length < 2) return false; const ok = (t, u) => t === u || u.startsWith(t) || t.startsWith(u); return S.every(t => L.some(u => ok(t, u))) && ok(S[0], L[0]); }
/* "EPI - Rincón" ↔ "SAN JOSÉ DEL RINCÓN": todas las palabras del nombre del mapa (sin "EPI -") están en el del PDF, y es el único que cumple */
function rdUniGuess(nodes, name){ const pw = new Set(rdNorm(name).split(/[^a-z0-9]+/).filter(w => w.length > 2));
  const c = nodes.filter(x => { const w = rdNorm(String(x.name || x.code || '').replace(/^(epi|nodo)\s*-?\s*/i, '')).split(/[^a-z0-9]+/).filter(w => w.length > 2); return w.length && w.every(z => pw.has(z)); });
  return c.length === 1 ? c[0] : null; }
function rdTitle(s){ const low = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'el']);
  return String(s || '').toLowerCase().split(/\s+/).filter(Boolean).map((w, i) => i && low.has(w) ? w : w.replace(/(^|[.\-])(\p{L})/gu, (m, a, c) => a + c.toUpperCase())).join(' '); }
function rdBufs(str){ const x = rdNorm(str).replace(/:$/, ''), out = new Set(), rg = /b(\d+)\s+a\s+b(\d+)/g; let m;
  while ((m = rg.exec(x))) for (let i = +m[1]; i <= +m[2] && i <= 24; i++) out.add(i - 1);
  for (const n of x.replace(/b\d+\s+a\s+b\d+/g, '').match(/b(\d+)/g) || []) { const i = +n.slice(1); if (i >= 1 && i <= 24) out.add(i - 1); }
  return [...out].sort((p, q) => p - q); }
async function rdReadPdf(buf, fname, P){
  if (buf.byteLength > 30 * 1024 * 1024) throw new Error('El PDF supera 30 MB.');
  await needLib('pdfjs'); pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.js';
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buf), isEvalSupported: false, disableFontFace: true, enableXfa: false, useSystemFonts: false, stopAtErrors: false }).promise;
  if (doc.numPages > 60){ P.probs.push(`${fname}: tiene más de 60 hojas, no se leyó.`); return; }
  const rows = (P.uni ||= []), isList = t => /^\s*b\d+[\s\-+a-z0-9]*:\s*$/i.test(t);
  const rowOf = name => { let r = rows.find(x => rdSame(x.name, name)); if (!r){ r = { name, tipo: null, drop: null, src: fname }; rows.push(r); } return r; };
  for (let p = 1; p <= doc.numPages; p++){
    const tc = await (await doc.getPage(p)).getTextContent();
    const it = tc.items.map(i => ({ s: String(i.str || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim(), x: i.transform[4], y: i.transform[5] })).filter(i => i.s).slice(0, 20000);
    // buffers que bajan
    for (const h of it){ const m = /^a nodo\s+(.+)$/i.exec(h.s); if (!m) continue;
      const col = it.filter(i => i !== h && Math.abs(i.x - h.x) <= 9 && i.y < h.y && i.y > h.y - 50).sort((a, b) => b.y - a.y), pairs = []; let pend = null;
      for (const i of col){ if (isList(i.s)) pend = rdBufs(i.s); else { const t = /^a\s+(?!nodo)(.+)$/i.exec(i.s) || (/^de\s/i.test(i.s) ? null : [0, i.s]); if (!t) break; pairs.push([pend, t[1]]); pend = null; } if (pairs.length >= 4) break; }
      if (!pairs.length) continue;
      const own = pairs.find(([, t]) => rdSame(t, m[1])), name = own ? own[1] : m[1], pass = pairs.filter(x => x !== own && x[0]).flatMap(x => x[0]);
      let drop = own && own[0] ? own[0] : pass.length ? [...Array(8).keys()].filter(b => !pass.includes(b)) : null;
      if (drop){ const r = rowOf(name); r.drop = drop; if (rdTok(name).length > rdTok(r.name).length) r.name = name; } }
    // tipo de nodo
    const skip = /distribuidor|^fo\s|hilos|acometida|caja de empalme|cuplas|acueducto|importante|camara|c[aá]mara|^odf|^nodo tipo|^b\d|^\d|^a\s|^de nodo|^de\s|fusionar|definir/i;
    for (const h of it){ const m = /^nodo tipo\s*(\d)/i.exec(h.s); if (!m) continue;
      const cand = it.filter(i => !skip.test(i.s) && i.y < h.y - 12 && i.y > h.y - 80 && Math.abs(i.x - h.x) < 130 && /[a-z]{3}/i.test(i.s)).sort((a, b) => Math.hypot(a.x - h.x, (a.y - h.y) * 0.6) - Math.hypot(b.x - h.x, (b.y - h.y) * 0.6));
      if (!cand.length) continue; const c = cand[0], grp = it.filter(i => (i === c || !skip.test(i.s) || /^de\s/i.test(i.s)) && Math.abs(i.x - c.x) < 22 && Math.abs(i.y - c.y) < 10).sort((a, b) => b.y - a.y);   // nombres en dos renglones
      const r = rowOf(grp.map(i => i.s).join(' ')); r.tipo = +m[1]; r.pos = { p, x: h.x, y: h.y };
      const hi = it.find(i => /^de\s+(\d+)\s+hilos/i.test(i.s) && Math.abs(i.x - h.x) < 30 && i.y < h.y && i.y > h.y - 40); if (hi) r.hilos = +/(\d+)/.exec(hi.s)[1]; }
    // gabinete: debajo de cada nodo, columna "DE NODO …" (lado sur) y "A NODO …" (lado norte) con cada grupo de buffers
    const isL2 = s => isList(s) || /^\s*b\d+([\s\-+]+(a\s+)?b\d+)*\s*$/i.test(s);
    const colOf = hd => { const col = it.filter(i => i !== hd && Math.abs(i.x - hd.x) <= 9 && i.y < hd.y && i.y > hd.y - 70).sort((a, b) => b.y - a.y), g = []; let pend = null;
      for (const i of col){ if (isL2(i.s)) pend = rdBufs(i.s); else if (pend){ g.push([pend, i.s]); pend = null; } else if (g.length) break; } return g; };
    const nodeName = s => s.replace(/^(de|a)\s+(nodo\s+)?/i, '').trim();
    // encabezado de columna: "DE (NODO) X" / "A (NODO) X" con una lista de buffers debajo y nada de lista justo arriba
    const isHdr = (h, re) => re.test(h.s) && (/^(de|a)\s+nodo\s+/i.test(h.s) || (it.some(i => isL2(i.s) && Math.abs(i.x - h.x) <= 9 && i.y < h.y && i.y > h.y - 22)
      && !it.some(i => isL2(i.s) && Math.abs(i.x - h.x) <= 9 && i.y > h.y && i.y < h.y + 8)));
    const Ls = it.filter(h => isHdr(h, /^de\s+\S/i)), Rs = it.filter(h => isHdr(h, /^a\s+\S/i));
    const put = (own, L, R, x0, x1) => { const y = (L || R).y, two = it.some(i => /^odf\s*2\b/i.test(i.s) && i.x > x0 && i.x < x1 && i.y > y && i.y < own.pos.y);
      own.gab = { sur: L ? { hdr: nodeName(L.s), groups: colOf(L) } : null, norte: R ? { hdr: nodeName(R.s), groups: colOf(R) } : null, two, hilos: own.hilos || null };
      if (two || !L || !R) own.drop = [...Array(8).keys()]; };
    // cada nodo ("NODO TIPO n") toma las columnas que tiene justo debajo (100 a 300 puntos), sin repetir
    const heads = rows.filter(r => r.pos && r.pos.p === p), cand = [];
    const near = (x0, x1, y) => heads.filter(r => r.pos.x > x0 && r.pos.x < x1 && r.pos.y > y + 100 && r.pos.y < y + 300).map(r => ({ r, dy: r.pos.y - y }));
    for (const L of Ls){ const R = Rs.filter(i => Math.abs(i.y - L.y) < 4 && i.x > L.x + 30 && i.x < L.x + 320).sort((a, b) => a.x - b.x)[0]; if (R) near(L.x - 40, R.x, L.y).forEach(c => cand.push({ ...c, k: 0, L, R, x0: L.x - 40, x1: R.x + 60 })); }
    // la fibra nace en este nodo (ej. Data Center): solo tiene "A NODO …"; o termina: solo tiene "DE NODO …"
    for (const R of Rs) near(R.x - 320, R.x, R.y).forEach(c => cand.push({ ...c, k: 1, L: null, R, x0: R.x - 320, x1: R.x + 60 }));
    for (const L of Ls) near(L.x - 40, L.x + 320, L.y).forEach(c => cand.push({ ...c, k: 2, L, R: null, x0: L.x - 40, x1: L.x + 320 }));
    const usedH = new Set(), usedC = new Set();
    for (const c of cand.sort((a, b) => a.k - b.k || a.dy - b.dy)){ if (usedH.has(c.r) || (c.L && usedC.has(c.L)) || (c.R && usedC.has(c.R))) continue;
      usedH.add(c.r); if (c.L) usedC.add(c.L); if (c.R) usedC.add(c.R); put(c.r, c.L, c.R, c.x0, c.x1); }
  }
  if (!rows.length) P.probs.push(`${fname}: no encontré en el PDF los textos "A NODO …" ni "NODO TIPO …". Si el unifilar es una imagen escaneada no se puede leer.`);
}
function rdReadXlsx(wb, fname, P){
  const emp = wb.SheetNames.filter(n => /empalme/i.test(n));
  if (emp.length){ // planilla de empalmes: progresiva de cada evento y atenuación promedio por pelo
    const S = (P.spl ||= { src: [], ev: [], total: 0, a: '', b: '' }); S.src.push(fname);
    const first = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', raw: true });
    for (const r of first){ const k = rdNorm(r[0]); const val = r.slice(1).find(x => x !== ''); if (/nodo origen/.test(k)) S.a = String(val || ''); if (/nodo destino/.test(k)) S.b = String(val || ''); if (/long.*optica/.test(k)){ const x = parseFloat(String(val).replace(',', '.')); if (x > 0) S.total = Math.max(S.total, x < 2000 ? x * 1000 : x); } }
    for (const sn of emp){ const aoa = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '', raw: true });
      let hi = aoa.findIndex(r => r.some(c => /fibra\s*nro/i.test(String(c)))); if (hi < 0) hi = aoa.findIndex(r => r.some(c => /^\s*(n°\s*)?evento/i.test(String(c)))); if (hi < 0) continue;
      const cols = []; aoa[hi].forEach((c, i) => { const m = /fibra\s*nro\.?:?\s*(\d+)/i.exec(String(c)); if (m) cols.push([+m[1] - 1, i]); });
      for (const r of aoa.slice(hi + 2)){ const n = parseInt(r[0]), m = parseFloat(r[1]); if (!(n > 0) || !(m > 0)) continue;
        let ev = S.ev.find(x => Math.abs(x.m - m) < 60); if (!ev){ ev = { m, loss: {} }; S.ev.push(ev); }
        cols.forEach(([f, ci]) => { let prom = parseFloat(r[ci + 2]); const ab = parseFloat(r[ci]), ba = parseFloat(r[ci + 1]);
          if (isNaN(prom)){ const v = [ab, ba].filter(x => !isNaN(x) && x !== 0); if (v.length) prom = v.reduce((t, x) => t + x, 0) / v.length; }   // si el promedio es una fórmula sin valor guardado, se calcula; con un solo sentido vale esa lectura
          if (!isNaN(prom)) ev.loss[f] = +prom.toFixed(3); }); } }
    return; }
  const ws = wb.Sheets['Elementos'] || wb.Sheets[wb.SheetNames[0]], aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
  const hi = aoa.findIndex(r => r.some(c => /^(codigo|tipo|nombre)$/.test(rdNorm(c)))); if (hi < 0){ P.probs.push(`${fname}: no encontré las columnas (Tipo, Código, Nombre, Latitud, Longitud…). Bajá la planilla con ⬇ y usala de modelo.`); return; }
  const H = aoa[hi].map(rdNorm), col = re => H.findIndex(h => re.test(h)), C = { kind: col(/^tipo$/), code: col(/^codigo/), name: col(/^nombre/), lat: col(/^lat/), lng: col(/^lon|^lng/), parent: col(/depende/), port: col(/salida|puerto/), cable: col(/^cable/), chain: col(/progresiva/) };
  const kOf = t => { const x = rdNorm(t); return /nodo/.test(x) ? 'nodo' : /botella|empalme/.test(x) ? 'botella' : /caja|cdo|nap/.test(x) ? 'caja' : /^ap|access/.test(x) ? 'ap' : /olt/.test(x) ? 'olt' : /reserva/.test(x) ? 'reserva' : /poste/.test(x) ? 'poste' : null; };
  aoa.slice(hi + 1).forEach((r, i) => { const v = k => C[k] >= 0 ? String(r[C[k]] ?? '').replace(/[<>]/g, '').trim() : '', code = v('code'), kind = kOf(v('kind')) || (code ? rdGuess(code, '', true) : null);
    if (!kind || (!code && !v('name'))) return; const lat = parseFloat(String(v('lat')).replace(',', '.')), lng = parseFloat(String(v('lng')).replace(',', '.'));
    if (v('lat') && !(Math.abs(lat) <= 90 && Math.abs(lng) <= 180)){ P.probs.push(`${fname}, fila ${hi + 2 + i}: coordenadas inválidas.`); return; }
    P.els.push({ kind, code: code.slice(0, 80) || null, name: v('name').slice(0, 160), lat: isNaN(lat) ? null : lat, lng: isNaN(lng) ? null : lng, parent: v('parent') || null, port: parseInt(v('port')) || null, cable: v('cable') || null, chain_m: parseFloat(v('chain')) || null, group: 'Excel · ' + RD_KIND[kind], pos: 'archivo', fromXl: true }); });
}
function rdPreview(P, src){
  const KS = Object.keys(RD_KIND), groups = new Map();
  P.els.forEach(e => { const k = e.group + '|' + e.kind; if (!groups.has(k)) groups.set(k, { label: e.group, kind: e.kind, items: [], pt: true }); groups.get(k).items.push(e); });
  P.cbs.forEach(c => { const k = c.group + '|' + c.kindG; if (!groups.has(k)) groups.set(k, { label: c.group, kind: c.kindG, items: [], pt: false }); groups.get(k).items.push(c); });
  const G = [...groups.values()], nodes = RD.els.filter(e => e.kind === 'nodo' || e.kind === 'olt'), S = P.spl;
  const guessN = t => { const x = rdNorm(t); return x && nodes.find(n => rdNorm(n.name || n.code).includes(x) || x.includes(rdNorm(n.name || n.code) || '~')); };
  const m = modal(`<div class="row between"><h2 style="margin:0">⬆ Subir información</h2><button class="btn sec small" id="rp-x">Cerrar</button></div>
    <p class="muted sm">${esc(src)}. Revisá qué es cada grupo. Lo que ya existe (mismo código, o mismo tipo a menos de 15 m) no se duplica: se actualiza. No se borra nada.</p>
    ${P.probs.length ? `<div class="rd-alert">${P.probs.slice(0, 6).map(esc).join('<br>')}</div>` : ''}
    ${G.length ? `<div class="tblwrap" style="max-height:38vh;overflow:auto"><table class="tbl rd-df"><thead><tr><th>Grupo del archivo</th><th>Cantidad</th><th>Cargar como</th><th>Resultado</th></tr></thead><tbody>${G.map((g, i) => `<tr><td><b>${esc(g.label)}</b><div class="muted">${esc(g.items.slice(0, 3).map(x => x.code || x.name).filter(Boolean).join(', '))}${g.items.length > 3 ? '…' : ''}</div></td><td>${g.items.length}</td>
      <td><select data-g="${i}" style="margin:0">${g.pt ? KS.map(k => `<option value="${k}" ${g.kind === k ? 'selected' : ''}>${esc(RD_KIND[k])}</option>`).join('') : `<option value="cable" ${g.kind === 'cable' ? 'selected' : ''}>Cable</option><option value="drop" ${g.kind === 'drop' ? 'selected' : ''}>Drop / acometida</option>`}<option value="x" ${g.kind === 'x' ? 'selected' : ''}>No cargar</option></select></td><td id="rp-r${i}" class="muted"></td></tr>`).join('')}</tbody></table></div>` : ''}
    ${RD.net.kind === 'ftth' && P.els.some(e => e.kind === 'ap') ? '<label style="display:flex;gap:8px;align-items:center;font-weight:400"><input type="checkbox" id="rp-tree" style="width:auto" checked> Crear las botellas y cajas que falten leyendo el código de cada AP (posición estimada)</label>' : ''}
    ${S ? `<div class="rd-buf" style="padding:10px;display:grid;gap:8px"><b>Empalmes por progresiva: ${S.ev.length} eventos${S.total ? ` · fibra ${rdKm(S.total)}` : ''}</b><span class="muted sm">${esc(S.src.join(', '))}. Elegí entre qué nodos está medido (normalmente de un corte de tramo ✂ al siguiente): las botellas se dibujan sobre el cable a su progresiva${Object.keys(S.ev[0]?.loss || {}).length ? ', con la atenuación de cada pelo' : ''}.</span>
      ${nodes.length >= 2 ? `<div class="grid2"><div><label>Nodo origen (A)</label><select id="rp-a">${nodes.map(n => `<option value="${n.id}" ${guessN(S.a)?.id === n.id ? 'selected' : ''}>${rdIsCut(n) ? '✂ ' : ''}${esc(n.name || n.code)}</option>`).join('')}</select></div><div><label>Nodo destino (B)</label><select id="rp-b">${nodes.map((n, i) => `<option value="${n.id}" ${(guessN(S.b)?.id || nodes[1].id) === n.id ? 'selected' : ''}>${rdIsCut(n) ? '✂ ' : ''}${esc(n.name || n.code)}</option>`).join('')}</select></div></div><div class="sm" id="rp-s"></div>` : '<div class="rd-alert">Los empalmes se ubican después de cargar los nodos y los cables: al terminar esta carga te pido entre qué nodos está medido.</div>'}</div>` : ''}
    ${P.uni && P.uni.length ? `<div class="rd-buf" style="padding:10px;display:grid;gap:8px"><b>Unifilar: tipo de nodo y buffers que bajan al ODF</b><span class="muted sm">Leído del PDF. Revisá a qué nodo del mapa corresponde cada uno; lo que no tilde no se cambia.</span>
      <div class="tblwrap" style="max-height:34vh;overflow:auto"><table class="tbl rd-df"><thead><tr><th></th><th>En el PDF</th><th>Nodo del mapa</th><th>Tipo</th><th>Bajan</th><th>Siguen</th><th>Gabinete (ODF)</th></tr></thead><tbody>${P.uni.map((u, i) => { const n = nodes.find(x => rdNorm(x.name || x.code) === rdNorm(u.name)) || nodes.find(x => rdSame(x.name || x.code, u.name)) || rdUniGuess(nodes, u.name), nb = 8;
        return `<tr><td><input type="checkbox" id="ru-c${i}" ${n ? 'checked' : ''} style="width:auto"></td><td><b>${esc(u.name)}</b></td><td><select id="ru-n${i}" style="margin:0"><option value="">— elegir —</option>${nodes.map(x => `<option value="${x.id}" ${n?.id === x.id ? 'selected' : ''}>${esc(x.name || x.code)}</option>`).join('')}</select></td>
          <td style="white-space:nowrap">${u.tipo ? 'Tipo ' + u.tipo : '<span class="muted">—</span>'}</td><td>${u.drop ? (u.drop.length >= nb ? '<b style="color:#C2410C">Todos · corte de tramo</b>' : u.drop.map(b => 'B' + (b + 1)).join(' ')) : '<span class="muted">según tipo</span>'}</td><td class="muted">${u.drop ? [...Array(nb).keys()].filter(b => !u.drop.includes(b)).map(b => 'B' + (b + 1)).join(' ') || '—' : ''}</td>
          <td style="white-space:nowrap">${u.gab ? `<label style="display:flex;gap:6px;align-items:center;margin:0"><input type="checkbox" id="ru-g${i}" checked style="width:auto;margin:0"> ${u.gab.two ? '2 ODF de 96' : 'Distrib. ' + (u.gab.hilos || '')} · ${!u.gab.sur ? 'nace acá' : esc(rdTitle(u.gab.sur.hdr))} → ${!u.gab.norte ? 'termina acá' : esc(rdTitle(u.gab.norte.hdr))}</label>` : '<span class="muted">—</span>'}</td></tr>`; }).join('')}</tbody></table></div></div>` : ''}
    <div class="grid2"><div><label>Información al día</label><input type="date" id="rp-d" value="${todayStr()}"></div><div><label>Nota</label><input id="rp-n" maxlength="120" placeholder="Ej.: KMZ entregado por el cliente"></div></div>
    <div class="err" id="rp-e"></div><div class="row" style="justify-content:flex-end;gap:6px"><button class="btn sec" id="rp-c">Cancelar</button><button class="btn" id="rp-ok">Cargar</button></div>`, { wide: true });
  $('#rp-x').onclick = $('#rp-c').onclick = m.close;
  const build = () => { // qué se manda al servidor
    const els = [], cbs = [], stat = G.map(() => ({ n: 0, u: 0, s: 0 })), codes = new Map(), dupName = new Map();
    P.els.forEach(e => dupName.set(rdNorm(e.code || e.name), (dupName.get(rdNorm(e.code || e.name)) || 0) + 1));
    G.forEach((g, gi) => { const kind = m.el.querySelector(`[data-g="${gi}"]`).value; if (kind === 'x') return;
      if (g.pt) g.items.forEach(e => { const raw = e.code || e.name, uniq = raw && dupName.get(rdNorm(raw)) === 1, code = e.fromXl ? e.code : (uniq && /[-_\d]/.test(raw) || (uniq && ['nodo', 'olt', 'ap', 'caja', 'botella'].includes(kind)) ? raw.slice(0, 80) : null);
        const ex = code ? RD.els.find(x => (x.code || '').toLowerCase() === code.toLowerCase()) : e.lat != null ? RD.els.find(x => x.kind === kind && x.lat != null && havm(rdLL(x), [e.lng, e.lat]) < 15) : null;
        if (ex && (!code || (e.lat == null || havm(rdLL(ex), [e.lng, e.lat]) < 2) && !e.parent && !e.cable)){ stat[gi].s++; return; }
        if (code && codes.has(code.toLowerCase())) return; if (code) codes.set(code.toLowerCase(), 1);
        ex ? stat[gi].u++ : stat[gi].n++;
        els.push({ kind, code, name: e.name && e.name !== code ? e.name : null, lat: e.lat, lng: e.lng, pos: e.pos, parent: e.parent, port: e.port, cable: e.cable, chain_m: e.chain_m, ...(kind === 'nodo' && !ex ? { props: { tipo: /data ?center|^dc\b/i.test(e.name || '') ? 1 : 4 } } : {}) }); });
      else g.items.forEach(c => { const ex = RD.cbs.find(x => rdNorm(x.name) === rdNorm(c.name)), len = Math.round(cumOf(c.path).pop());
        if (ex && Math.abs(rdLen(ex) - len) < 5 && ex.path.length === c.path.length){ stat[gi].s++; return; }
        ex ? stat[gi].u++ : stat[gi].n++;
        const all = [...RD.els.filter(x => x.lat != null), ...els.filter(x => x.lat != null && x.code)].filter(x => ['nodo', 'olt', 'botella', 'caja', 'ap'].includes(x.kind));
        const end = p => { const n = all.reduce((b, x) => { const d = havm(p, [x.lng, x.lat]); return !b || d < b.d ? { x, d } : b; }, null); return n && n.d < 60 ? n.x.code : null; };
        cbs.push({ name: c.name, path: c.path, length_m: len, kind: kind === 'drop' ? 'drop' : 'aereo', fibers: kind === 'drop' ? 1 : RD.net.cfg?.fibers || 96, per_buffer: RD.net.cfg?.per_buffer || 12, a: end(c.path[0]), b: end(c.path[c.path.length - 1]) }); }); });
    // FTTH: botellas y cajas que faltan, a partir del código del AP  AP-<olt>-<rama>-<botella>-<caja>-<salida>-<n°>
    if ($('#rp-tree')?.checked){ const aps = [...els.filter(e => e.kind === 'ap'), ...RD.els.filter(e => e.kind === 'ap').map(e => ({ code: e.code, lat: e.lat, lng: e.lng, kept: true }))].filter(a => a.code && a.code.split('-').length >= 7 && a.lat != null), byC = new Map();
      aps.forEach(a => { const s = a.code.split('-'), ck = `CDO-${s[1]}-${s[2]}-${s[3]}-${s[4]}`; if (!byC.has(ck)) byC.set(ck, { s, aps: [] }); byC.get(ck).aps.push(a); if (!a.kept){ a.parent = ck; a.port = +s[5] || null; } });
      const have = c => RD.els.some(x => (x.code || '').toLowerCase() === c.toLowerCase()) || codes.has(c.toLowerCase()), byB = new Map(), cen = l => [l.reduce((t, a) => t + a.lng, 0) / l.length, l.reduce((t, a) => t + a.lat, 0) / l.length];
      const olt = RD.els.find(e => e.kind === 'olt') || els.find(e => e.kind === 'olt');
      // los puntos de splitter del archivo sin código (ej. "SPN1+N2", "SPN2") son la ubicación real de las cajas: se usan para ubicarlas
      const spn = els.filter(e => e.kind === 'caja' && !e.code && e.lat != null), taken = new Set();
      byC.forEach((v, ck) => { const bk = `BOT-${v.s[1]}-${v.s[2]}-${v.s[3]}`; let c = cen(v.aps), pos = 'estimada', props = { n1: '1x2', n2: '1x8' };
        if (!have(ck)){ const nx = spn.filter(x => !taken.has(x)).map(x => ({ x, d: havm(c, [x.lng, x.lat]) })).sort((p, q) => p.d - q.d)[0];
          if (nx && nx.d < 250){ taken.add(nx.x); c = [nx.x.lng, nx.x.lat]; pos = 'archivo'; if (/spn\s*2\b|^n2$/i.test(nx.x.name || '') && !/spn\s*1/i.test(nx.x.name || '')) props = { n1: '', n2: '1x8' }; }
          codes.set(ck.toLowerCase(), 1); els.push({ kind: 'caja', code: ck, lat: +c[1].toFixed(6), lng: +c[0].toFixed(6), pos, parent: bk, props }); }
        if (!byB.has(bk)) byB.set(bk, []); byB.get(bk).push(c); });
      for (let i = els.length - 1; i >= 0; i--) if (taken.has(els[i])) els.splice(i, 1);
      byB.forEach((cs, bk) => { if (have(bk)) return; let c = [cs.reduce((t, x) => t + x[0], 0) / cs.length, cs.reduce((t, x) => t + x[1], 0) / cs.length]; if (olt && olt.lat != null) c = [c[0] + (olt.lng - c[0]) * 0.2, c[1] + (olt.lat - c[1]) * 0.2]; c = [c[0] + 0.00018, c[1] + 0.00015];
        codes.set(bk.toLowerCase(), 1); els.push({ kind: 'botella', code: bk, lat: +c[1].toFixed(6), lng: +c[0].toFixed(6), pos: 'estimada', parent: olt?.code || null }); }); }
    // empalmes por progresiva
    let sNote = '';
    if (S && $('#rp-a')){ const a = rdEl($('#rp-a').value), b = rdEl($('#rp-b').value), ch = a && b && a.id !== b.id ? rdRoute(a, b) : null, trunk = RD.cbs.filter(c => c.kind !== 'drop');
      if (!ch) sNote = '<span style="color:var(--red)">No encuentro un recorrido de cable entre esos dos nodos. Revisá que el cable esté dibujado de punta a punta.</span>';
      else { const k = S.total > 0 ? Math.min(1.02, Math.max(0.85, ch.len / S.total)) : 1, tag = (rdNorm(a.name || a.code).replace(/[^a-z0-9]/g, '').slice(0, 4) + '-' + rdNorm(b.name || b.code).replace(/[^a-z0-9]/g, '').slice(0, 4)).toUpperCase();
        let nn = 0, nu = 0; S.ev.forEach((ev, i) => { const ll = pointAt(ch.path, ch.cum, ev.m * k), at = rdSnap(ll, trunk), code = `E-${tag}-${String(i + 1).padStart(2, '0')}`, ex = RD.els.find(x => (x.code || '').toLowerCase() === code.toLowerCase()); ex ? nu++ : nn++;
          els.push({ kind: 'botella', code, name: `Empalme ${i + 1} · ${Math.round(ev.m)} m de fibra desde ${a.name || a.code}`, lat: +ll[1].toFixed(6), lng: +ll[0].toFixed(6), pos: 'estimada', cable: at && at.off < 60 ? at.c.name : null, chain_m: at && at.off < 60 ? Math.round(at.chain) : null,
            ...(Object.keys(ev.loss).length ? { props: { sp: { ...(ex ? rdSp(ex) : { map: {}, out: {} }), loss: { ...(ex ? rdSp(ex).loss : {}), ...ev.loss } } } } : {}) }); });
        sNote = `Recorrido sobre el mapa ${rdKm(ch.len)}${S.total ? ` · fibra ${rdKm(S.total)} · ajuste ${k.toFixed(3).replace('.', ',')}` : ''}. ${nn} botellas nuevas, ${nu} se actualizan. Quedan "a confirmar" hasta validarlas en el lugar.`; } }
    return { els, cbs, stat, sNote };
  };
  const refresh = () => { const r = build(); G.forEach((g, i) => { const s = r.stat[i], el = $('#rp-r' + i); if (el) el.textContent = m.el.querySelector(`[data-g="${i}"]`).value === 'x' ? 'no se carga' : `${s.n} nuevos · ${s.u} se actualizan · ${s.s} ya estaban`; }); if ($('#rp-s')) $('#rp-s').innerHTML = r.sNote; const nu = (P.uni || []).filter((u, i) => $('#ru-c' + i)?.checked && $('#ru-n' + i)?.value).length; $('#rp-ok').textContent = [r.els.length || r.cbs.length || !nu ? `Cargar ${r.els.length} elementos y ${r.cbs.length} cables` : '', nu ? `${r.els.length || r.cbs.length ? 'y a' : 'A'}ctualizar ${rdPl(nu, 'nodo', 'nodos')} según el unifilar` : ''].filter(Boolean).join(' '); };
  m.el.querySelectorAll('select,input[type=checkbox]').forEach(x => x.addEventListener('change', refresh)); refresh();
  $('#rp-ok').onclick = async () => {
    const r = build(), U = (P.uni || []).map((u, i) => ({ u, on: $('#ru-c' + i)?.checked, n: rdEl($('#ru-n' + i)?.value), g: !!$('#ru-g' + i)?.checked })).filter(x => x.on && x.n);
    if (U.some(x => x.g && x.u.gab)) try { await needLib('gab'); } catch (e){ return void ($('#rp-e').textContent = errText(e)); }
    if (!r.els.length && !r.cbs.length && !U.length) return void ($('#rp-e').textContent = 'No hay nada nuevo para cargar.');
    if (!needOnline()) return; $('#rp-ok').disabled = true; $('#rp-ok').textContent = 'Cargando…';
    const batch = (crypto.randomUUID ? crypto.randomUUID() : null), tot = { el_new: 0, el_upd: 0, cb_new: 0, cb_upd: 0 }, note = $('#rp-n').value.trim() || src.slice(0, 110), asof = $('#rp-d').value || todayStr();
    // primero cables (con sus extremos ya existentes) y elementos sin dependencias; después todo junto para enlazar
    const batches = []; for (let i = 0; i < r.cbs.length; i += 40) batches.push({ els: [], cbs: r.cbs.slice(i, i + 40) });
    const order = { olt: 0, nodo: 0, botella: 1, caja: 2 }, sorted = [...r.els].sort((a, b) => (order[a.kind] ?? 3) - (order[b.kind] ?? 3));
    for (let i = 0; i < sorted.length; i += 400) batches.unshift({ els: sorted.slice(i, i + 400), cbs: [] });
    batches.sort((a, b) => (b.els.length ? 1 : 0) - (a.els.length ? 1 : 0));
    let nU = 0;
    for (const { u, n, g } of U){ const props = { ...(n.props || {}) }; if (u.tipo) props.tipo = u.tipo; const t = RD_TIPOS[props.tipo], def = !t ? null : t.drop === 'all' ? [...Array(8).keys()] : t.drop;
      if (u.drop){ if (def && def.join() === u.drop.join()) delete props.drop; else props.drop = u.drop; }
      if (g && u.gab){ const gab = gabFromUni({ ...n, props }, u); if (gab) props.gab = gab; }
      if (JSON.stringify(props) === JSON.stringify(n.props || {})) continue;
      const row = await rdApply('el', n.id, 'upd', { props }, `${rdName(n)}: según el unifilar (${u.src}) ${u.tipo ? 'tipo ' + u.tipo + ', ' : ''}bajan ${RD_TIPOS[props.tipo]?.drop === 'all' && !u.drop ? 'todos los buffers' : (u.drop || rdDropOf({ props })).map(b => 'B' + (b + 1)).join('-') || 'ninguno'}${g && u.gab ? ' · ODF del gabinete completados' : ''}`); if (row) nU++; }
    for (const b of batches){ const { data, error } = await sb.rpc('net_import', { p_net: RD.net.id, p_els: b.els, p_cbs: b.cbs, p_asof: asof, p_note: note, p_batch: batch });
      if (error){ $('#rp-e').textContent = errText(error); $('#rp-ok').disabled = false; $('#rp-ok').textContent = 'Reintentar'; return; } for (const k in tot) tot[k] += data?.[k] || 0; }
    // segunda pasada corta: dependencias que apuntaban a elementos de un lote posterior
    const late = sorted.filter(e => e.code && (e.parent || e.cable)).map(e => ({ kind: e.kind, code: e.code, parent: e.parent, cable: e.cable }));
    for (let i = 0; i < late.length; i += 1500){ const { error } = await sb.rpc('net_import', { p_net: RD.net.id, p_els: late.slice(i, i + 1500), p_cbs: [], p_asof: asof, p_note: note, p_batch: batch }); if (error) break; }
    m.close(); IDB.del('kv', CUR_UID + ':net-list').catch(() => {}); await rdReload(); rdFit();
    if (S && !r.sNote) setTimeout(() => rdPreview({ els: [], cbs: [], probs: [], spl: S }, src), 400);
    toast(`Cargado: ${tot.el_new} elementos nuevos, ${tot.el_upd} actualizados, ${tot.cb_new} cables nuevos, ${tot.cb_upd} actualizados${U.length ? ` · ${rdPl(nU, 'nodo actualizado', 'nodos actualizados')} según el unifilar` : ''}.`);
  };
}
