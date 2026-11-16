/* =========================================================
   🗄 GABINETE DEL NODO (Red de fibra → tocar un nodo → Abrir gabinete) · v5.20
   Frente y contrafrente del rack, ODF con sus puertos, qué buffers bajan / siguen / salen,
   cordones ODF ⇄ ODF y ODF ⇄ equipo, energía y últimos mantenimientos del sitio.
   Se guarda en el nodo (props.gab) y pasa por el mismo circuito que la Red:
   el técnico registra, supervisor / coordinador / PM / administrador confirma o rechaza.
   ========================================================= */
const GB = { n: null, g: null, tab: 'gab', face: 'front', sel: null, adding: null, odf: null, port: null, eqPort: null, pick: null };
const GB_BUF = [['Azul', '#1D4ED8', 'G.652'], ['Naranja', '#EA7A0C', 'G.652'], ['Verde', '#16A34A', 'G.652'], ['Marrón', '#7A4A22', 'G.652'], ['Gris', '#8A949C', 'G.655'], ['Blanco', '#F4F4F4', 'G.655'], ['Rojo', '#DC2626', 'G.655'], ['Negro', '#1B1B1B', 'G.655'], ['Amarillo', '#EAB308', ''], ['Violeta', '#7C3AED', ''], ['Rosa', '#EC6FA8', ''], ['Celeste', '#38BDF8', '']];
const gbB = i => GB_BUF[((+i % 12) + 12) % 12];
const gbLine = i => gbB(i)[1] === '#F4F4F4' ? '#B8C2C9' : gbB(i)[1];
const gbP = (pre, a, b, ty) => Array.from({ length: b - a + 1 }, (_, i) => ({ n: pre + (a + i), ty }));
/* catálogo: los puertos se muestran igual que en Data Center */
const GB_CAT = {
  f1a: { n: 'NetEngine 8000 F1A', u: 1, kind: 'eq', w: [325, 420], tech: 'MPLS', ports: [...gbP('0/1/', 0, 7, 'sfp+'), ...gbP('0/2/', 0, 11, 'sfp'), { n: 'MGMT', ty: 'mgmt' }, { n: 'CON', ty: 'mgmt' }] },
  m1d: { n: 'NetEngine 8000 M1D', u: 1, kind: 'eq', w: [125.1, 162.2], tech: 'MPLS', ports: [...gbP('0/1/', 0, 7, 'sfp+'), ...gbP('0/2/', 0, 7, 'sfp'), { n: 'MGMT', ty: 'mgmt' }, { n: 'CON', ty: 'mgmt' }] },
  m14: { n: 'NetEngine 8000 M14', u: 5, kind: 'eq', w: [946.62, 1611.72], tech: 'MPLS', ports: [...gbP('1/0/', 0, 11, 'sfp+'), ...gbP('2/0/', 0, 11, 'sfp+'), { n: 'MGMT', ty: 'mgmt' }] },
  s6730: { n: 'Switch S6730', u: 1, kind: 'eq', w: [165, 291], tech: 'Switch', ports: [...gbP('', 1, 24, 'sfp+'), ...gbP('', 25, 30, 'qsfp'), { n: 'MGMT', ty: 'mgmt' }, { n: 'CON', ty: 'mgmt' }] },
  osn2: { n: 'OptiX OSN1800 II', u: 2, kind: 'eq', w: [105, 255], tech: 'DWDM', ports: [{ n: 'L1', ty: 'line' }, { n: 'L2', ty: 'line' }, ...gbP('C', 1, 8, 'sfp'), { n: 'NM', ty: 'mgmt' }] },
  osn5: { n: 'OptiX OSN1800 V', u: 5, kind: 'eq', w: [568, 1446], tech: 'DWDM', ports: [{ n: 'W', ty: 'line' }, { n: 'E', ty: 'line' }, ...gbP('C', 1, 16, 'sfp'), { n: 'NM', ty: 'mgmt' }] },
  usg: { n: 'Firewall USG6680', u: 1, kind: 'eq', w: [368.95, 492.66], tech: 'Seguridad', ports: [...gbP('GE', 0, 11, 'rj45'), ...gbP('XGE', 0, 3, 'sfp+'), { n: 'MGMT', ty: 'mgmt' }] },
  odf48: { n: 'ODF 48 hilos', u: 2, kind: 'odf', hilos: 48 }, odf96: { n: 'ODF 96 hilos', u: 4, kind: 'odf', hilos: 96 }, odf24: { n: 'ODF 24 hilos', u: 1, kind: 'odf', hilos: 24 },
  dpdu: { n: 'DPDU distribución −48 V', u: 1, kind: 'ene' }, rect: { n: 'Rectificador', u: 1, kind: 'ene' }, fsu: { n: 'Unidad de supervisión', u: 1, kind: 'ene' },
  guia: { n: 'Guía de cables', u: 1, kind: 'acc' }, bandeja: { n: 'Bandeja', u: 1, kind: 'acc' }, ciego: { n: 'Panel ciego', u: 1, kind: 'acc' },
  otro: { n: 'Otro equipo', u: 1, kind: 'eq', w: [0, 0], tech: '', ports: [] },
};
const GB_MODEL = { ext41: { n: 'Gabinete exterior · 41 U', H: 41 }, int42: { n: 'Gabinete interior en shelter · 42 U', H: 42 } };
const GB_KIND = { odf: 'ODF', eq: 'Equipo', ene: 'Energía', acc: 'Accesorio' };
const GB_FACE = { front: 'montado al frente', rear: 'montado en el contrafrente', both: 'ocupa frente y contrafrente' };

/* ---------- limpieza: todo lo que viene guardado se valida antes de usarlo ---------- */
const gbT = (s, n = 80) => String(s ?? '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const gbI = (v, a, b, d) => { const x = Math.round(Number(v)); return Number.isFinite(x) ? Math.min(b, Math.max(a, x)) : d; };
const gbId = (s, re = /^[A-Za-z0-9_-]{1,32}$/) => re.test(String(s ?? '')) ? String(s) : null;
function gbClean(x){
  if (!x || typeof x !== 'object') return null;
  const model = GB_MODEL[x.model] ? x.model : 'ext41', H = gbI(x.H, 10, 60, GB_MODEL[model].H);
  const odfs = (Array.isArray(x.odfs) ? x.odfs : []).slice(0, 16).map(o => { const id = gbId(o?.id, /^O\d{1,3}$/); if (!id) return null; const hilos = [12, 24, 48, 72, 96, 144].includes(+o.hilos) ? +o.hilos : 48;
    const ranges = (Array.isArray(o.ranges) ? o.ranges : []).slice(0, 24).map(r => { const from = gbI(r?.from, 1, hilos, 1); if (from + 11 > hilos) return null;
      return { from, to: from + 11, side: r.side === 'norte' ? 'norte' : 'sur', buf: gbI(r.buf, 0, 23, 0), acom: r.acom == null || r.acom === '' ? null : gbI(r.acom, 0, 23, 0), far: gbT(r.far, 80) }; }).filter(Boolean)
      .filter((r, i, a) => !a.slice(0, i).some(q => r.from <= q.to && q.from <= r.to)).sort((a, b) => a.from - b.from);
    return { id, name: gbT(o.name, 60) || 'ODF', hilos, ranges }; }).filter((o, i, a) => o && a.findIndex(q => q && q.id === o.id) === i);
  const oid = new Set(odfs.map(o => o.id));
  const rack = (Array.isArray(x.rack) ? x.rack : []).slice(0, 120).map(r => { const id = gbId(r?.id); if (!id) return null; const kind = GB_KIND[r.kind] ? r.kind : 'acc';
    const h = gbI(r.h, 1, 20, 1), u = gbI(r.u, 1, H, 1); if (u + h - 1 > H) return null;
    return { id, u, h, n: gbT(r.n, 80) || 'Elemento', kind, face: GB_FACE[r.face] ? r.face : 'front', cat: GB_CAT[r.cat] ? r.cat : null, odf: kind === 'odf' && oid.has(r.odf) ? r.odf : null, approx: !!r.approx, det: gbT(r.det, 200) }; })
    .filter((r, i, a) => r && a.findIndex(q => q && q.id === r.id) === i);
  const rid = new Set(rack.map(r => r.id)), okPort = (o, p) => { const od = odfs.find(q => q.id === o); return od && Number.isInteger(p) && p >= 1 && p <= od.hilos; };
  const eq = (Array.isArray(x.eq) ? x.eq : []).slice(0, 800).map(e => { const p = gbI(e?.port, 1, 200, 0); if (!okPort(e?.odf, p) || !rid.has(e.eq)) return null;
    return { odf: e.odf, port: p, eq: e.eq, ep: gbT(e.ep, 20), fx: e.fx === 'Rx' ? 'Rx' : 'Tx', why: gbT(e.why, 100), st: e.st === 'plan' ? 'plan' : 'ok' }; }).filter(Boolean)
    .filter((e, i, a) => a.findIndex(q => q.odf === e.odf && q.port === e.port) === i);
  const cords = (Array.isArray(x.cords) ? x.cords : []).slice(0, 800).map(c => { const a = [c?.a?.[0], gbI(c?.a?.[1], 1, 200, 0)], b = [c?.b?.[0], gbI(c?.b?.[1], 1, 200, 0)];
    if (!okPort(...a) || !okPort(...b) || (a[0] === b[0] && a[1] === b[1])) return null; return { a, b, why: gbT(c.why, 100), st: c.st === 'plan' ? 'plan' : 'ok' }; }).filter(Boolean);
  const used = new Set(eq.map(e => e.odf + '|' + e.port)), cords2 = cords.filter(c => { const k1 = c.a.join('|'), k2 = c.b.join('|'); if (used.has(k1) || used.has(k2)) return false; used.add(k1); used.add(k2); return true; });
  const ene = { rect: gbT(x.ene?.rect, 160), bat: gbT(x.ene?.bat, 160), grupo: gbT(x.ene?.grupo, 160) };
  return { v: 1, model, H, sides: { sur: gbT(x.sides?.sur, 80), norte: gbT(x.sides?.norte, 80) }, acom: !!x.acom, odfs, rack, eq, cords: cords2, ene };
}

/* ---------- plantilla según el tipo de nodo y los buffers que bajan (unifilar) ---------- */
function gbDrop(n){ const nb = Math.min(24, rdNbOf(n)); return { nb, drop: rdDropOf(n).filter(b => b < nb), cut: rdIsCut(n) }; }
function gbOdfsFor(n){
  const { nb, drop, cut } = gbDrop(n), tipo = +n.props?.tipo || 0;
  if (cut || tipo === 1){ const h = nb <= 8 ? 96 : 144, mk = (id, side, name) => ({ id, name, hilos: h, ranges: [...Array(Math.min(nb, h / 12)).keys()].map(b => ({ from: b * 12 + 1, to: b * 12 + 12, side, buf: b, acom: null, far: '' })) });
    return { acom: false, odfs: [mk('O1', 'sur', 'ODF 1 · lado sur'), mk('O2', 'norte', 'ODF 2 · lado norte')] }; }
  // los buffers bajan por la acometida: primero los G.652 (sur y después norte), luego los G.655
  const ranges = []; let k = 0;
  for (const grp of [drop.filter(b => b < 4), drop.filter(b => b >= 4)]){ for (const b of grp) ranges.push({ side: 'sur', buf: b, acom: k++ }); for (const b of grp) ranges.push({ side: 'norte', buf: b, acom: k++ }); }
  const h = k * 12 <= 48 ? 48 : k * 12 <= 96 ? 96 : 144;
  return { acom: true, odfs: [{ id: 'O1', name: `Distribuidor ${h} H`, hilos: h, ranges: ranges.filter(r => r.acom * 12 + 12 <= h).map(r => ({ ...r, from: r.acom * 12 + 1, to: r.acom * 12 + 12, far: '' })) }] };
}
function gbTemplate(n, model){
  const tipo = +n.props?.tipo || 3, M = GB_MODEL[model] || GB_MODEL.ext41, { acom, odfs } = gbOdfsFor(n), rack = []; let u = 1, k = 0;
  const add = (o) => { rack.push({ id: 'r' + (++k), approx: false, det: '', ...o }); };
  const odfU = h => h >= 144 ? 6 : h >= 96 ? 4 : h >= 48 ? 2 : 1;
  if (model === 'int42'){
    odfs.forEach(o => { add({ u, h: odfU(o.hilos), n: o.name, kind: 'odf', odf: o.id, face: 'both' }); u += odfU(o.hilos); add({ u, h: 1, n: 'Guía de cables', kind: 'acc', face: 'front' }); u++; });
  } else {
    if (tipo <= 3) add({ u: 1, h: 1, n: 'DPDU distribución −48 V', kind: 'ene', face: 'rear', cat: 'dpdu' });
    add({ u: 2, h: 3, n: 'Tablero eléctrico AC / DC', kind: 'ene', face: 'both' }); add({ u: 5, h: 1, n: 'Unidad de supervisión DTM2830', kind: 'ene', face: 'front', cat: 'fsu' });
    add({ u: 6, h: 1, n: 'Rectificador', kind: 'ene', face: 'front', cat: 'rect' }); u = 7; add({ u, h: 1, n: 'Guía de cables', kind: 'acc', face: 'front' }); u++;
    odfs.forEach(o => { add({ u, h: odfU(o.hilos), n: o.name, kind: 'odf', odf: o.id, face: 'both' }); u += odfU(o.hilos); add({ u, h: 1, n: 'Guía de cables', kind: 'acc', face: 'front' }); u++; });
  }
  if (tipo === 2 || tipo === 3){ const e0 = u;
    for (let i = 1; i <= 3; i++){ add({ u, h: 2, n: 'OSN1800 II #' + i, kind: 'eq', cat: 'osn2', face: 'front', approx: true }); u += 2; add({ u, h: 1, n: 'Guía de cables', kind: 'acc', face: 'front' }); u++; }
    add({ u, h: 5, n: 'OSN1800 V', kind: 'eq', cat: 'osn5', face: 'front', approx: true }); u += 5;
    add({ u: e0 - 1, h: 1, n: 'NetEngine 8000 F1A', kind: 'eq', cat: 'f1a', face: 'rear', approx: true });
    add({ u: e0 + 5, h: 1, n: 'Switch S6730 #1', kind: 'eq', cat: 's6730', face: 'rear', approx: true }); add({ u: e0 + 6, h: 1, n: 'Switch S6730 #2', kind: 'eq', cat: 's6730', face: 'rear', approx: true }); }
  if (tipo === 4) add({ u: Math.max(u, M.H - 11), h: 1, n: 'NetEngine 8000 M1D', kind: 'eq', cat: 'm1d', face: 'front', approx: true });
  if (model !== 'int42'){ add({ u: M.H - 9, h: 3, n: 'Protección y control de baterías', kind: 'ene', face: 'both' }); add({ u: M.H - 6, h: 1, n: 'Bandeja techo baterías', kind: 'acc', face: 'both' }); add({ u: M.H - 5, h: 6, n: 'Baterías', kind: 'ene', face: 'both' }); }
  // si algo de la plantilla se pisa (muchos ODF), lo que choca se descarta
  const ok = [], occ = { front: new Set(), rear: new Set() };
  for (const r of rack){ const fs = r.face === 'both' ? ['front', 'rear'] : [r.face], us = [...Array(r.h).keys()].map(i => r.u + i);
    if (r.u < 1 || r.u + r.h - 1 > M.H || fs.some(f => us.some(x => occ[f].has(x)))) continue; fs.forEach(f => us.forEach(x => occ[f].add(x))); ok.push(r); }
  return gbClean({ model, H: M.H, sides: gbNeighbors(n), acom, odfs, rack: ok, eq: [], cords: [],
    ene: model === 'int42' ? { rect: 'Del shelter', bat: 'Del shelter', grupo: '' } : { rect: 'E4860 · controladora E4860JKN · 2 módulos E8420 · flote 54 VDC', bat: 'SHOTO 6-GFM-40 · 120 Ah', grupo: '' } });
}

/* vecinos por los cables que llegan al nodo: el de más al sur queda como lado sur (la troncal corre de sur a norte) */
function gbNeighbors(n){
  const nb = RD.cbs.filter(c => c.a_id === n.id || c.b_id === n.id).map(c => rdEl(c.a_id === n.id ? c.b_id : c.a_id)).filter(e => e && e.kind === 'nodo' && e.lat != null)
    .filter((e, i, a) => a.findIndex(x => x.id === e.id) === i).sort((a, b) => a.lat - b.lat);
  const nm = e => gbT(String(e.name || e.code || '').replace(/^EPI\s*-\s*/i, ''));
  if (nb.length >= 2) return { sur: nm(nb[0]), norte: nm(nb[nb.length - 1]) };
  if (nb.length === 1) return nb[0].lat < n.lat ? { sur: nm(nb[0]), norte: '' } : { sur: '', norte: nm(nb[0]) };
  // sin cables unidos al nodo: el nodo tipificado más cercano hacia el sur y hacia el norte
  const all = RD.els.filter(e => e.kind === 'nodo' && e.id !== n.id && e.lat != null && e.props?.tipo && n.lat != null), d = e => havm(rdLL(n), rdLL(e));
  const named = all.filter(e => /^(epi|dc|data ?center|nodo)\b/i.test(String(e.code || e.name || '')) || e.props?.gab), ty = named.length ? named : all;
  const s = ty.filter(e => e.lat < n.lat).sort((a, b) => d(a) - d(b))[0], N = ty.filter(e => e.lat > n.lat).sort((a, b) => d(a) - d(b))[0];
  return { sur: s ? nm(s) : '', norte: N ? nm(N) : '' };
}
/* ---------- completar los ODF desde el unifilar (PDF) ----------
   u.gab = { sur:{hdr, groups:[[bufs, texto]]}, norte:{...}, two, hilos } leído por rdReadPdf.
   Lado sur: "DE X" = viene de X; "A <este nodo>" = baja acá y viene del nodo del encabezado. Lado norte: "A X" o "X" = va a X. */
function gbUniFar(side, b){ const grp = side.groups.find(([bs]) => bs.includes(b)); if (!grp) return rdTitle(side.hdr);
  const s = String(grp[1] || '').trim(); if (/^de\s+/i.test(s)) return rdTitle(s.replace(/^de\s+/i, '')); if (/^a\s+/i.test(s)) return rdTitle(side.isN ? s.replace(/^a\s+/i, '') : side.hdr); return rdTitle(s); }
function gabFromUni(n, u){
  const info = u.gab; if (!info) return null;
  const tipo = +n.props?.tipo || 3, base = gbClean(n.props?.gab) || gbTemplate(n, tipo === 2 ? 'int42' : 'ext41'); if (!base) return null;
  const { acom, odfs } = gbOdfsFor(n);
  if (acom && info.hilos && [24, 48, 72, 96, 144].includes(+info.hilos) && odfs[0] && Math.max(0, ...odfs[0].ranges.map(r => r.to)) <= +info.hilos){ odfs[0].hilos = +info.hilos; odfs[0].name = `Distribuidor ${info.hilos} H`; }
  const S = { ...info.sur, isN: false }, N = { ...info.norte, isN: true };
  odfs.forEach(o => o.ranges.forEach(r => { r.far = gbT(gbUniFar(r.side === 'sur' ? S : N, r.buf), 80); }));
  // si los ODF tienen la misma estructura se conservan cordones y equipos; si cambian, se rearman
  const sig = os => JSON.stringify(os.map(o => [o.id, o.hilos, o.ranges.map(r => [r.from, r.side, r.buf, r.acom])]));
  const g = JSON.parse(JSON.stringify(base)); g.sides = { sur: gbT(rdTitle(info.sur.hdr)), norte: gbT(rdTitle(info.norte.hdr)) }; g.acom = acom;
  if (sig(g.odfs) === sig(odfs)){ g.odfs.forEach((o, i) => o.ranges.forEach((r, k) => r.far = odfs[i].ranges[k].far)); return gbClean(g); }
  const old = g.rack.filter(r => r.kind === 'odf'); g.rack = g.rack.filter(r => r.kind !== 'odf'); g.odfs = odfs; g.eq = []; g.cords = [];
  const fits = (u, h) => { const keep = GB.g; GB.g = g; const ok = gbFits(u, h, 'both'); GB.g = keep; return ok; };
  odfs.forEach((o, i) => { const h = o.hilos >= 144 ? 6 : o.hilos >= 96 ? 4 : o.hilos >= 48 ? 2 : 1, prev = old[i] || old[0]; let at = null;
    for (const c of [prev?.u, prev ? prev.u + prev.h + 1 : null, 8].filter(x => x)) if (at == null && fits(c, h)) at = c;
    for (let x = 1; at == null && x <= g.H - h + 1; x++) if (fits(x, h)) at = x;
    if (at != null) g.rack.push({ id: 'o' + Date.now().toString(36) + i, u: at, h, n: o.name, kind: 'odf', odf: o.id, face: 'both', approx: false, det: '' }); });
  return gbClean(g);
}
/* botón dentro del gabinete: leer un unifilar y completar este nodo */
function gbUniPick(){
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.pdf,application/pdf';
  inp.onchange = async () => { const f = inp.files[0]; if (!f) return; if (f.size > 30 * 1024 * 1024) return toast('El PDF supera 30 MB.');
    toast('Leyendo el unifilar…'); const P = { els: [], cbs: [], probs: [] };
    try { await rdReadPdf(await f.arrayBuffer(), f.name, P); } catch (e){ return toast(errText(e)); }
    const me = String(GB.n.name || GB.n.code || '').replace(/^(epi|nodo)\s*-?\s*/i, ''), rows = (P.uni || []).filter(r => r.gab);
    const hit = rows.find(r => rdNorm(r.name) === rdNorm(me)) || rows.find(r => rdSame(r.name, me));
    const m = modal(`<h2>Completar desde el unifilar</h2><p class="muted sm">${esc(f.name)}</p>
      ${rows.length ? `<label>Nodo del unifilar</label><select id="gx-r">${rows.map((r, i) => `<option value="${i}" ${r === hit ? 'selected' : ''}>${esc(rdTitle(r.name))}${r.tipo ? ' · tipo ' + r.tipo : ''}</option>`).join('')}</select><div id="gx-pv" style="margin-top:8px"></div>
        <div class="row" style="justify-content:flex-end;gap:6px;margin-top:10px"><button class="btn sec" id="gx-x">Cancelar</button><button class="btn" id="gx-ok">Completar los ODF</button></div>`
      : `<div class="gb-alert">${esc(P.probs[0] || 'No encontré en el PDF las columnas "DE NODO …" y "A NODO …" debajo de los nodos.')}</div><div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn sec" id="gx-x">Cerrar</button></div>`}`, { wide: true });
    $('#gx-x').onclick = m.close; if (!rows.length) return;
    const calc = () => { const u = rows[+$('#gx-r').value], props = { ...(GB.n.props || {}) }; if (u.tipo) props.tipo = u.tipo; if (u.drop) props.drop = u.drop; return { u, props, g: gabFromUni({ ...GB.n, props }, u) }; };
    const paint = () => { const { u, g } = calc(), same = g && GB.g && JSON.stringify(g.eq) === JSON.stringify(GB.g.eq) && JSON.stringify(g.cords) === JSON.stringify(GB.g.cords);
      $('#gx-pv').innerHTML = !g ? '<div class="gb-alert">No se pudo armar.</div>' : `${u.tipo ? `<p class="sm" style="margin:0 0 6px">Tipo ${u.tipo}${u.gab.two ? ' · <b>corte de tramo</b>: dos ODF de 96' : ''} · de <b>${esc(g.sides.sur)}</b> a <b>${esc(g.sides.norte)}</b></p>` : ''}
        <div style="overflow-x:auto"><table class="gb-t"><thead><tr><th>ODF</th><th>Puertos</th><th>Buffer</th><th>Viene de / va a</th></tr></thead><tbody>${g.odfs.flatMap(o => o.ranges.map(r => `<tr><td>${esc(o.name)}</td><td>${r.from}–${r.to}</td><td><span class="gb-sq" style="background:${gbB(r.acom ?? r.buf)[1]}"></span>${r.acom != null ? `acom. B${r.acom + 1} → ` : ''}B${r.buf + 1} ${r.side}</td><td>${r.side === 'sur' ? 'de' : 'a'} ${esc(r.far)}</td></tr>`)).join('')}</tbody></table></div>
        ${GB.g && !same && (GB.g.eq.length || GB.g.cords.length) ? '<div class="gb-alert" style="margin-top:8px">Los ODF cambian de estructura: se borran los cordones y las conexiones a equipos cargados en ellos.</div>' : ''}`; };
    $('#gx-r').onchange = paint; paint();
    $('#gx-ok').onclick = async () => { const { u, props, g } = calc(); if (!g) return; m.close(); props.gab = g;
      const row = await rdApply('el', GB.n.id, 'upd', { props }, `${rdName(GB.n)} · gabinete: ODF completados desde el unifilar (${f.name})`.slice(0, 380));
      if (row){ GB.n = row; GB.g = gbClean(row.props?.gab); } gbRender(); };
  };
  inp.click();
}
/* ---------- consultas ---------- */
const gbOdf = id => GB.g.odfs.find(o => o.id === id);
const gbUnit = id => GB.g.rack.find(r => r.id === id);
function gbPI(o, p){ const od = gbOdf(o), r = od && od.ranges.find(r => p >= r.from && p <= r.to); if (!r) return null; return { o, p, r, buf: r.buf, fib: p - r.from, side: r.side, acom: r.acom, phys: r.acom != null ? r.acom : r.buf, far: r.far || GB.g.sides[r.side] || (r.side === 'sur' ? 'lado sur' : 'lado norte') }; }
const gbCord = (o, p) => GB.g.cords.find(x => (x.a[0] === o && x.a[1] === p) || (x.b[0] === o && x.b[1] === p));
const gbEq = (o, p) => GB.g.eq.find(x => x.odf === o && x.port === p);
const gbSideTxt = s => s === 'sur' ? 'cable sur' : 'cable norte';
const gbShort = s => String(s || '').replace('NetEngine 8000 ', 'NE ').replace('OptiX ', '').replace('OSN1800 ', 'OSN ');
const gbOdfShort = o => (gbOdf(o)?.name || o).split(' · ')[0].replace('Distribuidor', 'Distrib.');
function gbOcc(face, skip){ const s = new Set(); GB.g.rack.forEach(r => { if (r === skip) return; if (r.face === 'both' || r.face === face) for (let k = 0; k < r.h; k++) s.add(r.u + k); }); return s; }
function gbFits(u, h, face, skip){ if (u < 1 || u + h - 1 > GB.g.H) return false; const fs = face === 'both' ? ['front', 'rear'] : [face]; return fs.every(f => { const o = gbOcc(f, skip); return [...Array(h).keys()].every(k => !o.has(u + k)); }); }
const gbCanEd = () => rdEdit() && online();
const gbFib = i => RD_FIB[i % 12];
const gbAbbr = () => String(GB.n.name || GB.n.code || 'NOD').replace(/^EPI\s*-\s*/i, '').normalize('NFD').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'NOD';

/* ---------- guardar (pasa por net_apply: queda en Cambios, pendiente si lo hace un técnico) ---------- */
async function gbSave(g, descr){
  const clean = gbClean(g); if (!clean) return toast('Datos inválidos.');
  if (JSON.stringify(clean).length > 100000) return toast('El gabinete quedó demasiado grande para guardarlo.');
  const props = { ...(GB.n.props || {}), gab: clean };
  const row = await rdApply('el', GB.n.id, 'upd', { props }, `${rdName(GB.n)} · gabinete: ${descr}`.slice(0, 380));
  if (row){ GB.n = row; GB.g = gbClean(row.props?.gab); }
  gbRender();
}
const gbCopy = () => JSON.parse(JSON.stringify(GB.g));

/* ---------- abrir / cerrar ---------- */
function gbCss(){
  if (document.getElementById('gb-css')) return;
  const s = document.createElement('style'); s.id = 'gb-css';
  s.textContent = `
#gb-root{position:fixed;inset:0;z-index:1000;background:var(--bg);overflow:auto;-webkit-overflow-scrolling:touch}
.gb-wrap{max-width:1340px;margin:0 auto;padding:14px max(14px,env(safe-area-inset-left,0px)) 40px max(14px,env(safe-area-inset-right,0px));display:grid;gap:12px}
.gb-head{display:flex;gap:10px 16px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap}.gb-head > *{min-width:0}
.gb-head h1{margin:0 0 6px;font-size:22px}
.gb-chips{display:flex;gap:6px;flex-wrap:wrap}
.gb-chip{font-size:12px;border-radius:20px;padding:3px 10px;background:var(--card);color:var(--muted);border:1px solid var(--line);white-space:nowrap}
.gb-chip.cut{background:#FFEDD5;color:#C2410C;border-color:transparent;font-weight:600}.gb-chip.ok{background:var(--ok-bg);color:var(--si);border-color:transparent}.gb-chip.plan{background:var(--amber-bg);color:var(--amber);border-color:transparent}
.gb-tabs{display:flex;gap:2px;flex-wrap:wrap;border-bottom:1px solid var(--line)}
.gb-tabs button{border:0;background:transparent;padding:9px 12px;border-bottom:3px solid transparent;color:var(--muted);font:inherit;font-weight:600;cursor:pointer}
.gb-tabs button.on{color:var(--text);border-bottom-color:var(--green)}
.gb-grid{display:grid;grid-template-columns:minmax(0,1fr) 400px;gap:12px;align-items:start}
.gb-card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px;min-width:0}
.gb-card h2{font-size:17px;margin:0 0 4px}.gb-card h3{font-size:12px;margin:12px 0 6px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}
.gb-side{position:sticky;top:10px;display:grid;gap:10px}
.gb-kv{display:grid;grid-template-columns:auto minmax(0,1fr);gap:4px 12px;font-size:13px;margin:0}.gb-kv dt{color:var(--muted)}.gb-kv dd{margin:0}
.gb-seg{display:inline-flex;border:1px solid var(--line);border-radius:10px;overflow:hidden}
.gb-seg button{border:0;background:var(--card);padding:6px 12px;font:inherit;font-size:13px;font-weight:600;color:var(--muted);cursor:pointer}.gb-seg button.on{background:var(--navy);color:#fff}
.gb-scroll{overflow-x:auto}
.gb-alert{border-radius:10px;padding:8px 10px;font-size:13px;background:var(--amber-bg);color:var(--amber)}.gb-alert.info{background:#EEF4FF;color:#1D4ED8}.gb-alert.ok{background:var(--ok-bg);color:var(--si)}
.gb-pick{display:grid;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:6px}
.gb-pick button{border:1px solid var(--line);background:var(--card);border-radius:10px;padding:8px;text-align:left;display:grid;gap:2px;font:inherit;font-size:12.5px;cursor:pointer;color:inherit}
.gb-pick button span{color:var(--muted);font-size:11.5px}.gb-pick button:disabled{opacity:.4;cursor:not-allowed}
table.gb-t{border-collapse:collapse;width:100%;font-size:13px}table.gb-t th,table.gb-t td{border-bottom:1px solid var(--line);padding:6px 7px;text-align:left;vertical-align:top}table.gb-t th{font-size:12px;color:var(--muted);font-weight:600}
.gb-sq{display:inline-block;width:12px;height:12px;border-radius:3px;border:1px solid rgba(0,0,0,.25);vertical-align:-2px;margin-right:5px}
.gb-trace{display:grid}.gb-trace div{display:grid;grid-template-columns:22px minmax(0,1fr);gap:8px;align-items:start;font-size:13px;min-height:34px}
.gb-trace i{width:12px;height:12px;border-radius:50%;margin:3px 0 0 5px;background:var(--teal);display:block;position:relative}
.gb-trace div:not(:last-child) i::after{content:"";position:absolute;left:5px;top:12px;width:2px;height:26px;background:var(--line)}
.gb-ports{display:flex;flex-wrap:wrap;gap:4px}
.gb-port{min-width:38px;height:34px;border-radius:7px;border:1.5px solid #CBD5E1;background:#fff;font:inherit;font-size:11px;font-weight:600;cursor:pointer;display:grid;place-items:center;color:#334155;padding:0 5px;white-space:nowrap}
.gb-port.on{background:#D4A017;color:#fff;border-color:transparent}.gb-port.plan{border-style:dashed;border-color:#F59E0B;color:#B7791F;background:#FFFBEB}.gb-port.hit{outline:3px solid var(--navy);outline-offset:1px}
.gb-lbl{font-size:11.5px;color:var(--muted);font-weight:600;margin:10px 0 4px;text-transform:uppercase;letter-spacing:.04em}
.gb-legend{display:flex;gap:10px;flex-wrap:wrap;font-size:11.5px;color:var(--muted);margin-top:6px}.gb-legend i{display:inline-block;width:11px;height:11px;border-radius:3px;margin-right:4px;vertical-align:-1px}
.gb-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.gb-ins{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:8px;align-items:center;border:1px solid var(--line);border-radius:10px;padding:8px 10px;font-size:13px;text-decoration:none;color:inherit;background:var(--card)}
@media (max-width:940px){.gb-grid{grid-template-columns:minmax(0,1fr)}.gb-side{position:static}}`;
  document.head.appendChild(s);
}
function gabOpen(id){
  const n = rdEl(id); if (!n) return;
  gbCss(); Object.assign(GB, { n, g: gbClean(n.props?.gab), tab: 'gab', face: 'front', sel: null, adding: null, odf: null, port: null, eqPort: null, pick: null });
  let root = document.getElementById('gb-root'); if (!root){ root = document.createElement('div'); root.id = 'gb-root'; const mr = document.getElementById('modal-root'); mr ? mr.before(root) : document.body.appendChild(root); } // antes del modal-root: los formularios quedan encima
  document.body.style.overflow = 'hidden';
  gbRender();
  if (!gabOpen.bound){ gabOpen.bound = true;
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.getElementById('gb-root') && !document.querySelector('#modal-root .modal')) gabClose(); });
    window.addEventListener('hashchange', () => gabClose()); }
}
function gabClose(){ const r = document.getElementById('gb-root'); if (r){ r.remove(); document.body.style.overflow = ''; } }

/* ---------- vistas ---------- */
function gbRender(){
  const root = document.getElementById('gb-root'); if (!root) return;
  const n = GB.n, t = RD_TIPOS[n.props?.tipo], cut = rdIsCut(n), pend = rdPend(n.id);
  let body;
  if (!GB.g) body = gbEmpty();
  else body = `<div class="gb-tabs" role="tablist">${[['gab', 'Gabinete'], ['odf', 'Buffers y ODF'], ['ic', 'Cordones'], ['ene', 'Energía'], ['mant', 'Mantenimiento']].map(([k, l]) => `<button data-gt="${k}" class="${GB.tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    ${gbDrift()}${GB.tab === 'gab' ? gbVGab() : GB.tab === 'odf' ? gbVOdf() : GB.tab === 'ic' ? gbVIc() : GB.tab === 'ene' ? gbVEne() : gbVMant()}`;
  root.innerHTML = `<div class="gb-wrap"><div class="gb-head"><div><div class="muted sm">${esc(RD.net.name)} › nodo</div><h1>🗄 ${esc(n.name || n.code || 'Nodo')}</h1>
      <div class="gb-chips">${t ? `<span class="gb-chip">${esc(t.n)}</span>` : '<span class="gb-chip plan">Sin tipo</span>'}${cut ? '<span class="gb-chip cut">✂ Corte de tramo óptico</span>' : ''}${GB.g ? `<span class="gb-chip">${esc(GB_MODEL[GB.g.model].n)}</span>` : ''}${pend ? '<span class="gb-chip plan">Cambios pendientes de confirmar</span>' : ''}</div></div>
      <div class="gb-row">${gbCanEd() ? '<button class="btn sec small" id="gb-uni">⬆ Completar desde el unifilar</button>' : ''}${GB.g && gbCanEd() ? '<button class="btn sec small" id="gb-sides">Nombres de los lados</button>' : ''}<button class="btn sec small" id="gb-ch">Cambios</button><button class="btn small" id="gb-x">✕ Cerrar</button></div></div>${body}</div>`;
  gbBind(root);
}
function gbEmpty(){
  const n = GB.n, { drop, cut } = gbDrop(n), tipo = +n.props?.tipo || 0, def = tipo === 2 ? 'int42' : 'ext41';
  return `<div class="gb-card" style="max-width:640px"><h2>Este nodo todavía no tiene el gabinete cargado</h2>
    <p class="muted sm">La plantilla arma el rack, los ODF y qué buffers bajan según el tipo del nodo ${tipo ? `(<b>${esc(RD_TIPOS[tipo]?.n || '')}</b>)` : ''} y lo que marca la Red: ${cut ? '<b>corte de tramo</b>, bajan todos los buffers a dos ODF (uno por lado)' : drop.length ? `bajan <b>${drop.map(b => 'B' + (b + 1)).join(', ')}</b> por la acometida` : 'sin buffers marcados'}. Después se ajusta lo que difiera.</p>
    ${!tipo ? '<div class="gb-alert">Primero elegí el tipo del nodo en el panel de la Red.</div>' : gbCanEd() ? `<label>Modelo de gabinete</label><select id="gb-model">${Object.entries(GB_MODEL).map(([k, m]) => `<option value="${k}" ${k === def ? 'selected' : ''}>${esc(m.n)}</option>`).join('')}</select>
      <div class="gb-row" style="margin-top:10px"><button class="btn" id="gb-tpl">Armar desde la plantilla</button></div><p class="muted sm">Queda registrado en Cambios${rdMgr() ? '' : ' y lo confirma un supervisor'}.</p>` : `<p class="muted sm">${online() ? 'Lo arma alguien con permiso de edición.' : 'Necesitás conexión para armarlo.'}</p>`}</div>`;
}
/* aviso si el nodo cambió de tipo o de buffers y los ODF ya no coinciden */
function gbDrift(){
  const { drop, cut } = gbDrop(GB.n), have = new Set(GB.g.odfs.flatMap(o => o.ranges.filter(r => r.side === 'sur').map(r => r.buf)));
  const want = new Set(cut ? [...Array(Math.min(24, rdNbOf(GB.n))).keys()] : drop);
  if ([...want].every(b => have.has(b)) && [...have].every(b => want.has(b))) return '';
  return `<div class="gb-alert">En la Red este nodo baja ${cut ? 'todos los buffers (corte de tramo)' : [...want].map(b => 'B' + (b + 1)).join(', ') || 'ningún buffer'}, pero los ODF del gabinete tienen ${[...have].map(b => 'B' + (b + 1)).join(', ') || 'ninguno'}. ${gbCanEd() ? '<button class="btn sec small" id="gb-reodf" style="margin-left:6px">Rearmar los ODF según la Red</button>' : ''}</div>`;
}

/* --- gabinete: frente y contrafrente --- */
function gbRackSVG(){
  const g = GB.g, UH = 17, W = 380, X0 = 46, top = 16, H = g.H * UH + top + 20, o = [], face = GB.face, y = u => top + (u - 1) * UH;
  o.push(`<rect x="${X0 - 14}" y="${top - 10}" width="${W + 28}" height="${g.H * UH + 20}" rx="10" fill="#C9D3DA"/><rect x="${X0}" y="${top}" width="${W}" height="${g.H * UH}" fill="#E9EEF1"/>`);
  for (let u = 1; u <= g.H; u++) o.push(`<text x="${X0 - 20}" y="${y(u) + UH / 2 + 4}" font-size="10" text-anchor="end" fill="#5B6878">${u}</text><line x1="${X0}" x2="${X0 + W}" y1="${y(u)}" y2="${y(u)}" stroke="#D5DEE4" stroke-width=".6"/>`);
  const used = gbOcc(face), other = g.rack.filter(r => r.face !== 'both' && r.face !== face);
  let u = 1; while (u <= g.H){ if (used.has(u)){ u++; continue; } let e = u; while (e + 1 <= g.H && !used.has(e + 1)) e++;
    o.push(`<g data-free="${u}|${e}" style="cursor:pointer"><rect x="${X0 + 3}" y="${y(u) + 2}" width="${W - 6}" height="${(e - u + 1) * UH - 4}" rx="4" fill="#F7F9FA" stroke="#D5DEE4" stroke-dasharray="4 3"/>`);
    other.filter(r => r.u + r.h - 1 >= u && r.u <= e).forEach(r => o.push(`<text x="${X0 + 12}" y="${y(Math.max(u, r.u)) + UH / 2 + 4}" font-size="10" fill="#8796A5" font-style="italic">${face === 'front' ? 'detrás' : 'adelante'}: ${esc(r.n)}</text>`));
    o.push(`<text x="${X0 + W - 10}" y="${y(u) + (e - u + 1) * UH / 2 + 4}" text-anchor="end" font-size="10.5" fill="#8796A5">Libre · ${e - u + 1} U${gbCanEd() ? ' · ＋' : ''}</text></g>`); u = e + 1; }
  for (const r of g.rack){ if (!(r.face === 'both' || r.face === face)) continue; const yy = y(r.u) + 2, hh = r.h * UH - 4, sel = GB.sel === r.id;
    const fill = r.kind === 'odf' ? '#FFFFFF' : r.kind === 'eq' ? '#26323A' : r.kind === 'ene' ? '#DCE3E8' : '#B9C6D0', txt = r.kind === 'eq' ? '#FFFFFF' : '#12222E';
    o.push(`<g data-r="${esc(r.id)}" style="cursor:pointer"><rect x="${X0 + 3}" y="${yy}" width="${W - 6}" height="${hh}" rx="4" fill="${fill}" stroke="${sel ? '#2563EB' : r.approx ? '#F59E0B' : '#7D8E99'}" stroke-width="${sel ? 3 : r.approx ? 1.6 : 1}" ${r.approx ? 'stroke-dasharray="6 3"' : ''}/>`);
    const od = r.kind === 'odf' && gbOdf(r.odf);
    if (od){ const cols = 24, rows = Math.ceil(od.hilos / cols), cw = (W - 130) / cols, rh = Math.min(9, (hh - 6) / rows);
      if (face === 'front') for (let p = 1; p <= od.hilos; p++){ const i = gbPI(od.id, p), cx = X0 + 112 + ((p - 1) % cols) * cw + cw / 2, cy = yy + (hh - rows * rh) / 2 + Math.floor((p - 1) / cols) * rh + rh / 2;
        o.push(`<rect x="${cx - cw * .36}" y="${cy - rh * .38}" width="${cw * .72}" height="${rh * .76}" rx="1.5" fill="${i ? gbB(i.phys)[1] : '#E3E8EC'}" stroke="rgba(0,0,0,.3)" stroke-width=".5"/>`); }
      else o.push(`<text x="${X0 + 112}" y="${yy + hh / 2 + 4}" font-size="10.5" fill="#5C6F7C">bandejas de empalme · pigtails ${g.acom ? 'a la acometida' : 'a los cables'}</text>`);
      o.push(`<text x="${X0 + 10}" y="${yy + hh / 2 + 4}" font-size="11" font-weight="700" fill="${txt}">${esc(gbOdfShort(od.id))}</text>`); }
    else { o.push(`<text x="${X0 + 10}" y="${yy + Math.min(hh / 2 + 4, 14)}" font-size="11" font-weight="${r.kind === 'acc' ? 500 : 700}" fill="${txt}">${esc(r.n)}</text>`);
      if (r.kind === 'eq' && r.cat && GB_CAT[r.cat].ports){ const us = new Set(g.eq.filter(x => x.eq === r.id).map(x => x.ep));
        GB_CAT[r.cat].ports.slice(0, 16).forEach((p, k) => o.push(`<rect x="${X0 + 200 + k * 10.5}" y="${yy + hh - 10}" width="8" height="6" rx="1" fill="${us.has(p.n) ? '#D4A017' : '#5B6B76'}"/>`)); } }
    if (r.approx && r.h > 1) o.push(`<text x="${X0 + W - 10}" y="${yy + 12}" font-size="9" text-anchor="end" fill="#F59E0B" font-weight="700">U A CONFIRMAR</text>`);
    o.push('</g>'); }
  return `<svg viewBox="0 0 ${W + 70} ${H}" width="100%" style="max-width:470px;display:block;margin:0 auto;font-family:inherit">${o.join('')}</svg>`;
}
function gbVGab(){
  const r = gbUnit(GB.sel), used = gbOcc(GB.face).size;
  return `<div class="gb-grid"><div class="gb-card"><div class="gb-row" style="justify-content:space-between"><div class="gb-seg"><button data-face="front" class="${GB.face === 'front' ? 'on' : ''}">Frente</button><button data-face="rear" class="${GB.face === 'rear' ? 'on' : ''}">Contrafrente</button></div><span class="muted sm">${used} U ocupadas de este lado · ${GB.g.H - used} libres</span></div>
      <p class="muted sm" style="margin:8px 0">U numeradas de arriba hacia abajo. Lo montado del otro lado se ve en gris dentro de los huecos. Borde naranja punteado: posición a confirmar en campo.</p><div class="gb-scroll">${gbRackSVG()}</div></div>
    <aside class="gb-side">${GB.adding ? gbAddPanel() : r ? gbUnitPanel(r) : `<div class="gb-card"><h2>Tocá un elemento</h2><p class="muted sm" style="margin:0">${gbCanEd() ? 'O un espacio libre para agregar.' : 'Para ver su detalle.'}</p></div>`}</aside></div>`;
}
function gbEqFace(r){
  const links = GB.g.eq.filter(x => x.eq === r.id), hit = GB.eqPort && GB.eqPort[0] === r.id ? GB.eqPort[1] : null;
  const ports = [...(GB_CAT[r.cat]?.ports || [])]; links.forEach(l => { if (!ports.some(p => p.n === l.ep)) ports.push({ n: l.ep, ty: 'otro' }); });
  if (!ports.length) return '<p class="muted sm">Este equipo no tiene puertos en el catálogo.</p>';
  return `<div class="gb-lbl">Puertos</div><div class="gb-ports">${ports.map(p => { const l = links.filter(x => x.ep === p.n); return `<button class="gb-port${l.length ? (l.some(x => x.st === 'plan') ? ' plan' : ' on') : ''}${hit === p.n ? ' hit' : ''}" data-ep="${esc(p.n)}" title="${esc(p.n + (l.length ? ' → ' + (l[0].why || gbOdfShort(l[0].odf)) : ' · libre'))}">${esc(p.n.replace(/^0\//, ''))}</button>`; }).join('')}</div>
    <div class="gb-legend"><span><i style="background:#D4A017"></i>Fibra conectada</span><span><i style="background:#FFFBEB;border:1.5px dashed #F59E0B"></i>Proyectado</span><span><i style="background:#fff;border:1.5px solid #CBD5E1"></i>Libre</span></div>`;
}
function gbUnitPanel(r){
  const c = r.cat ? GB_CAT[r.cat] : null, ed = gbCanEd(); let h = `<div class="gb-card"><div class="gb-row" style="justify-content:space-between"><h2>${esc(r.n)}</h2>${r.approx ? '<span class="gb-chip plan">U a confirmar</span>' : ''}</div>
    <dl class="gb-kv"><dt>Posición</dt><dd>U${r.u}${r.h > 1 ? '–U' + (r.u + r.h - 1) : ''} · ${r.h} U · ${GB_FACE[r.face]}</dd>${c && c.w && c.w[0] ? `<dt>Consumo</dt><dd>${c.w[0]} W típico · ${c.w[1]} W máx.</dd><dt>Tecnología</dt><dd>${esc(c.tech)}</dd>` : ''}${r.det ? `<dt>Detalle</dt><dd>${esc(r.det)}</dd>` : ''}</dl>`;
  if (r.kind === 'odf' && gbOdf(r.odf)){ const od = gbOdf(r.odf), last = Math.max(0, ...od.ranges.map(x => x.to));
    h += `<h3>Casetes</h3><table class="gb-t"><tbody>${od.ranges.map(x => `<tr><td style="white-space:nowrap">${x.from}–${x.to}</td><td><span class="gb-sq" style="background:${gbB(x.acom ?? x.buf)[1]}"></span>${x.acom != null ? `acom. B${x.acom + 1} → ` : ''}B${x.buf + 1}</td><td>${x.side === 'sur' ? 'de' : 'a'} ${esc(x.far || GB.g.sides[x.side] || 'lado ' + x.side)}</td></tr>`).join('')}${od.hilos > last ? `<tr><td>${last + 1}–${od.hilos}</td><td colspan="2" class="muted">Libres</td></tr>` : ''}</tbody></table>
      <div class="gb-row" style="margin-top:8px"><button class="btn small" data-goodf="${esc(od.id)}">Ver puertos y recorridos</button>${ed ? `<button class="btn sec small" data-edodf="${esc(od.id)}">Editar casetes</button>` : ''}</div>`; }
  if (r.kind === 'eq'){ h += gbEqFace(r); if (GB.eqPort && GB.eqPort[0] === r.id) h += gbEqPortPanel(r, GB.eqPort[1]); }
  if (ed) h += `<div class="gb-row" style="margin-top:12px"><button class="btn sec small" data-ued>Editar / mover</button><button class="btn sec small" data-urm style="color:var(--red)">Quitar</button></div>`;
  return h + '</div>';
}
function gbEqPortPanel(r, ep){
  const l = GB.g.eq.filter(x => x.eq === r.id && x.ep === ep), ed = gbCanEd();
  if (!l.length) return `<h3>Puerto ${esc(ep)}</h3><p class="muted sm" style="margin:0 0 6px">Libre.</p>${ed && GB.g.odfs.length ? '<button class="btn small" data-epcon>Conectar a un ODF (Tx / Rx)</button>' : ''}`;
  return `<h3>Puerto ${esc(ep)}${l[0].why ? ' · ' + esc(l[0].why) : ''}</h3>${l.map(x => `<div style="margin-bottom:8px"><b>${x.fx}</b> · ${esc(gbOdf(x.odf)?.name || x.odf)} puerto ${x.port} ${x.st === 'plan' ? '<span class="gb-chip plan">proyectado</span>' : ''}${gbTrace(x.odf, x.port, true)}</div>`).join('')}
    ${ed ? '<button class="btn sec small" data-epdis style="color:var(--red)">Desconectar</button>' : ''}`;
}
function gbAddPanel(){ const [a, b] = GB.adding, free = b - a + 1;
  return `<div class="gb-card"><h2>Agregar en U${a}${b > a ? '–U' + b : ''} · ${GB.face === 'front' ? 'frente' : 'contrafrente'}</h2><p class="muted sm" style="margin:0 0 8px">${free} U libres. Elegí qué va:</p>
    <div class="gb-pick">${Object.entries(GB_CAT).map(([k, c]) => `<button data-add="${k}" ${c.u > free ? 'disabled' : ''}><b>${esc(c.n)}</b><span>${c.u} U${c.w && c.w[0] ? ' · ' + c.w[0] + ' W' : ''}</span></button>`).join('')}</div>
    <div class="gb-row" style="margin-top:8px"><button class="btn sec small" data-cancel>Cancelar</button></div></div>`; }

/* --- buffers: qué baja, qué sigue de largo y qué sale --- */
function gbFlowSVG(){
  const g = GB.g, nb = Math.min(24, Math.max(8, rdNbOf(GB.n))), W = 1010, rowH = 40, top = 54, H = top + nb * rowH + 26, o = [], xL = 34, bxL = 250, bxR = 650, bw = 110, xR = W - 20;
  const rng = side => b => g.odfs.flatMap(od => od.ranges.filter(r => r.side === side && r.buf === b).map(r => [od.id, r]))[0];
  const L = rng('sur'), R = rng('norte'), sN = g.sides.sur || 'lado sur', nN = g.sides.norte || 'lado norte';
  o.push(`<text x="${xL}" y="18" font-size="12" font-weight="700" fill="#14202E">Cable sur</text><text x="${xL}" y="33" font-size="10.5" fill="#5B6878">desde ${esc(sN)}</text><text x="${xR}" y="18" font-size="12" font-weight="700" text-anchor="end" fill="#14202E">Cable norte</text><text x="${xR}" y="33" font-size="10.5" text-anchor="end" fill="#5B6878">hacia ${esc(nN)}</text>`);
  o.push(`<rect x="${bxL - 14}" y="${top - 22}" width="${bxR + bw - bxL + 28}" height="${nb * rowH + 10}" rx="12" fill="rgba(43,179,166,.07)" stroke="#2BB3A6" stroke-opacity=".4"/><text x="${(bxL + bxR + bw) / 2}" y="${top - 8}" text-anchor="middle" font-size="11" font-weight="700" fill="#178A61">${g.acom ? 'Gabinete · llega por la acometida desde la caja de empalme' : 'Gabinete · los cables terminan en ODF'}</text>`);
  for (let b = 0; b < nb; b++){ const y = top + 14 + b * rowH, col = gbLine(b), l = L(b), r = R(b), mid = (bxL + bxR + bw) / 2;
    o.push(`<text x="${xL}" y="${y + 4}" font-size="11" font-weight="600" fill="#5B6878">B${b + 1}</text><text x="${xR}" y="${y + 4}" font-size="11" font-weight="600" text-anchor="end" fill="#5B6878">B${b + 1}</text>`);
    if (!l && !r){ o.push(`<line x1="${xL + 26}" x2="${xR - 26}" y1="${y}" y2="${y}" stroke="${col}" stroke-width="4" opacity=".55"/><rect x="${mid - 150}" y="${y - 10}" width="300" height="20" rx="10" fill="#fff" stroke="#E1E6ED"/><text x="${mid}" y="${y + 4}" text-anchor="middle" font-size="10.5" fill="#5B6878">no baja · sigue de largo en la caja de empalme${g.sides.norte ? ' → ' + esc(g.sides.norte) : ''}</text>`); continue; }
    const box = (x, kr, side) => { const [k, rr] = kr, eqs = g.eq.filter(e => e.odf === k && e.port >= rr.from && e.port <= rr.to), names = [...new Set(eqs.map(e => gbShort(gbUnit(e.eq)?.n)))].join(' / ');
      o.push(`<g data-flow="${esc(k)}|${rr.from}" style="cursor:pointer"><rect x="${x}" y="${y - 13}" width="${bw}" height="26" rx="6" fill="#fff" stroke="#14202E" stroke-opacity=".35"/><text x="${x + bw / 2}" y="${y - 1}" text-anchor="middle" font-size="10.5" font-weight="700" fill="#14202E">${esc(gbOdfShort(k))} ${rr.from}–${rr.to}</text><text x="${x + bw / 2}" y="${y + 10}" text-anchor="middle" font-size="9" fill="#5B6878">${rr.acom != null ? 'acometida B' + (rr.acom + 1) : 'directo del cable'}</text></g>`);
      if (eqs.length) o.push(`<text x="${side === 'sur' ? x + bw + 8 : x - 8}" y="${y + 16}" text-anchor="${side === 'sur' ? 'start' : 'end'}" font-size="10" font-weight="600" fill="#B7791F">${eqs.length} pelos → ${esc(names)}</text>`); };
    if (l){ o.push(`<line x1="${xL + 26}" x2="${bxL}" y1="${y}" y2="${y}" stroke="${col}" stroke-width="4"/><text x="${xL + 30}" y="${y - 6}" font-size="9.5" fill="#5B6878">baja · de ${esc(l[1].far || sN)}</text>`); box(bxL, l, 'sur'); }
    else o.push(`<line x1="${xL + 26}" x2="${bxL - 20}" y1="${y}" y2="${y}" stroke="${col}" stroke-width="4" opacity=".35"/><text x="${bxL - 24}" y="${y - 6}" font-size="9.5" text-anchor="end" fill="#5B6878">se empalma al B${b + 1} norte</text>`);
    if (r){ o.push(`<line x1="${bxR + bw}" x2="${xR - 26}" y1="${y}" y2="${y}" stroke="${col}" stroke-width="4"/><text x="${xR - 30}" y="${y - 6}" font-size="9.5" text-anchor="end" fill="#5B6878">sale · a ${esc(r[1].far || nN)}</text>`); box(bxR, r, 'norte'); }
    else o.push(`<line x1="${bxR + bw + 20}" x2="${xR - 26}" y1="${y}" y2="${y}" stroke="${col}" stroke-width="4" opacity=".35"/>`);
    if (l){ let nc = 0; for (let p = l[1].from; p <= l[1].to; p++) if (gbCord(l[0], p)) nc++;
      if (nc) o.push(`<path d="M${bxL + bw} ${y}H${r ? bxR : bxL + bw + 60}" stroke="#2563EB" stroke-width="${1.5 + nc / 4}" stroke-dasharray="6 4"/><rect x="${(bxL + bw + bxR) / 2 - 58}" y="${y - 19}" width="116" height="14" rx="7" fill="#fff"/><text x="${(bxL + bw + bxR) / 2}" y="${y - 8}" text-anchor="middle" font-size="10" font-weight="600" fill="#2563EB">${nc} cordones ODF ⇄ ODF</text>`); } }
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="display:block;font-family:inherit">${o.join('')}</svg>`;
}
function gbOdfSVG(o){
  const od = gbOdf(o), n = od.hilos, cols = 12, cw = 30, rh = 30, W = cols * cw + 150, rows = Math.ceil(n / cols), H = rows * rh + 20, out = [];
  for (let g = 0; g < Math.ceil(n / 24); g++){ const a = g * 24 + 1, rr = Math.min(2, Math.ceil((n - g * 24) / 12));
    out.push(`<rect x="2" y="${10 + g * 2 * rh}" width="${W - 4}" height="${rr * rh}" rx="6" fill="none" stroke="#E1E6ED"/><text x="10" y="${10 + g * 2 * rh + 15}" font-size="10.5" font-weight="700" fill="#14202E">Casete ${g + 1}</text><text x="10" y="${10 + g * 2 * rh + 28}" font-size="10" fill="#5B6878">${a}–${Math.min(n, a + 23)}</text>`); }
  for (let p = 1; p <= n; p++){ const i = gbPI(o, p), cx = 140 + ((p - 1) % cols) * cw + cw / 2, cy = 10 + Math.floor((p - 1) / cols) * rh + rh / 2, c = gbCord(o, p), e = gbEq(o, p), sel = GB.port && GB.port[0] === o && GB.port[1] === p;
    if (!i){ out.push(`<g data-p="${esc(o)}|${p}" style="cursor:pointer"><rect x="${cx - 12}" y="${cy - 12}" width="24" height="24" rx="5" fill="#F7F9FA" stroke="${sel ? '#14202E' : '#D5DEE4'}" stroke-dasharray="3 2"/><text x="${cx}" y="${cy + 3.5}" font-size="8.5" text-anchor="middle" fill="#8796A5">${p}</text></g>`); continue; }
    const fc = gbFib(i.fib)[1], st = e ? '#D4A017' : c ? '#2563EB' : 'rgba(0,0,0,.3)';
    out.push(`<g data-p="${esc(o)}|${p}" style="cursor:pointer"><rect x="${cx - 12}" y="${cy - 12}" width="24" height="24" rx="5" fill="${gbB(i.phys)[1]}" stroke="${sel ? '#14202E' : 'rgba(0,0,0,.3)'}" stroke-width="${sel ? 2.5 : 1}"/><circle cx="${cx}" cy="${cy}" r="7" fill="${fc}" stroke="${st}" stroke-width="${e || c ? 2.6 : 1}"/><text x="${cx}" y="${cy + 3}" font-size="7.5" text-anchor="middle" fill="${['#F4F4F4', '#EAB308', '#38BDF8', '#8A949C'].includes(fc) ? '#12222E' : '#FFFFFF'}" font-weight="700">${p}</text></g>`); }
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${Math.round(W * 1.2)}px;display:block;font-family:inherit">${out.join('')}</svg>`;
}
function gbBack(i){ const b = gbB(i.buf), s = [];
  if (i.acom != null) s.push(`<b>Trasera del ODF</b>: pigtail fusionado a la <b>acometida</b> · B${i.acom + 1} ${gbB(i.acom)[0].toLowerCase()} pelo ${i.fib + 1}`, `<b>Caja de empalme</b>: acometida B${i.acom + 1} ⇄ ${gbSideTxt(i.side)} B${i.buf + 1}`);
  else s.push(`<b>Trasera del ODF</b>: pigtail fusionado al ${gbSideTxt(i.side)}`);
  s.push(`<b>${i.side === 'sur' ? 'Viene' : 'Va'} por el ${gbSideTxt(i.side)}</b> · B${i.buf + 1} ${b[0].toLowerCase()}${b[2] ? ' (' + b[2] + ')' : ''} pelo ${i.fib + 1} ${gbFib(i.fib)[0]} · ${i.side === 'sur' ? 'desde' : 'hacia'} <b>${esc(i.far)}</b>`);
  return s; }
function gbTrace(o, p, fromEq){
  const i = gbPI(o, p); if (!i) return '<p class="muted sm">Puerto sin pelo asignado (libre).</p>';
  const steps = [...gbBack(i)].reverse(); steps.push(`<b>${esc(gbOdf(o).name)} · puerto ${p}</b>`);
  const c = gbCord(o, p), e = gbEq(o, p);
  if (e && !fromEq) steps.push(`<b>Cordón a ${esc(gbUnit(e.eq)?.n || 'equipo')}</b> · puerto ${esc(e.ep)} ${e.fx}${e.why ? ' — ' + esc(e.why) : ''} ${e.st === 'plan' ? '<span class="gb-chip plan">proyectado</span>' : ''}`);
  else if (c){ const t = c.a[0] === o && c.a[1] === p ? c.b : c.a, j = gbPI(t[0], t[1]);
    steps.push(`<b>Cordón ODF ⇄ ODF</b> a ${esc(gbOdf(t[0]).name)} puerto ${t[1]} ${c.st === 'plan' ? '<span class="gb-chip plan">proyectado</span>' : ''}`, `<b>${esc(gbOdf(t[0]).name)} · puerto ${t[1]}</b>`, ...(j ? gbBack(j) : ['Ese puerto no tiene pelo asignado.'])); }
  else if (!e) steps.push('<b>Sin cordón</b>: el pelo termina en el ODF (libre o reserva).');
  return `<div class="gb-trace">${steps.map(s => `<div><i></i><span>${s}</span></div>`).join('')}</div>`;
}
function gbVOdf(){
  const g = GB.g; if (!g.odfs.length) return '<div class="gb-card"><p class="muted">Este gabinete no tiene ODF. Agregá uno desde la pestaña Gabinete.</p></div>';
  if (!gbOdf(GB.odf)) GB.odf = g.odfs[0].id; const od = gbOdf(GB.odf);
  return `<div class="gb-card"><h2>Qué buffers bajan, cuáles siguen y cuáles salen</h2><p class="muted sm" style="margin:0 0 8px">Sale de lo marcado en la Red para este nodo${rdIsCut(GB.n) ? ' (corte de tramo: bajan todos)' : ''}. Tocá una caja de ODF para ver sus puertos.</p><div class="gb-scroll">${gbFlowSVG()}</div></div>
    <div class="gb-grid"><div class="gb-card"><div class="gb-row" style="justify-content:space-between"><h2>${esc(od.name)} · ${od.hilos} hilos</h2><div class="gb-row">${g.odfs.length > 1 ? g.odfs.map(x => `<button class="btn ${x.id === od.id ? '' : 'sec'} small" data-odf="${esc(x.id)}">${esc(gbOdfShort(x.id))}</button>`).join('') : ''}${gbCanEd() ? `<button class="btn sec small" data-edodf="${esc(od.id)}">Editar casetes</button>` : ''}</div></div>
      <p class="muted sm" style="margin:4px 0 8px">Cuadrado: color del buffer que llega al ODF${g.acom ? ' (el de la acometida)' : ''} · círculo: color del pelo · borde azul: cordón a otro ODF · borde dorado: va a un equipo · punteado: libre.</p>
      <div class="gb-scroll">${gbOdfSVG(od.id)}</div></div><aside class="gb-side">${gbPortPanel()}</aside></div>`;
}
function gbPortPanel(){
  if (!GB.port || !gbOdf(GB.port[0])) return `<div class="gb-card"><h2>Elegí un puerto</h2><p class="muted sm" style="margin:0">Vas a ver de qué cable, buffer y pelo viene, si pasa por la acometida, y adónde va.</p></div>`;
  const [o, p] = GB.port, i = gbPI(o, p), c = gbCord(o, p), e = gbEq(o, p), ed = gbCanEd();
  return `<div class="gb-card"><h2>${esc(gbOdf(o).name)} · puerto ${p}</h2>${i ? `<div class="gb-chips" style="margin:4px 0 8px">${i.acom != null ? `<span class="gb-chip"><span class="gb-sq" style="background:${gbB(i.acom)[1]}"></span>En el ODF: acometida B${i.acom + 1}</span>` : ''}<span class="gb-chip"><span class="gb-sq" style="background:${gbB(i.buf)[1]}"></span>${i.acom != null ? 'Lleva el ' : ''}B${i.buf + 1} ${gbB(i.buf)[0].toLowerCase()} ${gbSideTxt(i.side)}</span><span class="gb-chip"><span class="gb-sq" style="background:${gbFib(i.fib)[1]}"></span>pelo ${i.fib + 1} ${gbFib(i.fib)[0]}</span></div>` : ''}
    <h3>Recorrido</h3>${gbTrace(o, p)}
    ${ed && i ? `<div class="gb-row" style="margin-top:10px">${c ? '<button class="btn sec small" data-unic style="color:var(--red)">Quitar cordón</button>' : e ? '<button class="btn sec small" data-goeq>Ver el equipo</button>' : '<button class="btn small" data-mkic>＋ Cordón a otro puerto de ODF</button>'}</div>` : ''}
    ${GB.pick ? `<div class="gb-alert info" style="margin-top:8px">Tocá el puerto de destino (podés cambiar de ODF arriba). <button class="btn sec small" data-nopick>Cancelar</button></div>` : ''}</div>`;
}

/* --- cordones --- */
function gbVIc(){
  const g = GB.g, grp = new Map(); g.cords.forEach(x => { const k = (x.why || 'Sin descripción') + '|' + x.a[0] + '|' + x.b[0]; if (!grp.has(k)) grp.set(k, []); grp.get(k).push(x); });
  const eg = new Map(); g.eq.forEach(x => { const k = x.eq + '|' + x.why; if (!eg.has(k)) eg.set(k, []); eg.get(k).push(x); });
  const rg = l => { const ps = l.map(Number).sort((a, b) => a - b); const out = []; for (const p of ps){ const last = out[out.length - 1]; if (last && p === last[1] + 1) last[1] = p; else out.push([p, p]); } return out.map(([a, b]) => a === b ? a : a + '–' + b).join(', '); };
  return `<div class="gb-grid"><div class="gb-card"><div class="gb-row" style="justify-content:space-between"><h2>Cordones del nodo</h2>${gbCanEd() && g.odfs.length ? '<button class="btn small" id="gb-bulk">＋ Cordones en bloque</button>' : ''}</div>
      <p class="muted sm" style="margin:0 0 8px">Unen puertos de ODF entre sí (para que un pelo siga de largo dentro del gabinete) o un ODF con un equipo.</p>
      <table class="gb-t"><thead><tr><th>Qué conecta</th><th>Desde</th><th>Hasta</th><th>Pelos</th><th></th></tr></thead><tbody>
      ${grp.size ? [...grp.values()].map(l => `<tr><td>${esc(l[0].why || '—')}</td><td>${esc(gbOdfShort(l[0].a[0]))} ${rg(l.map(x => x.a[1]))}</td><td>${esc(gbOdfShort(l[0].b[0]))} ${rg(l.map(x => x.b[1]))}</td><td>${l.length}</td><td>${l.some(x => x.st === 'plan') ? '<span class="gb-chip plan">proyectado</span>' : ''}</td></tr>`).join('') : `<tr><td colspan="5" class="muted">${g.acom ? 'Sin cordones ODF ⇄ ODF: en este nodo lo que sigue de largo se resuelve en la caja de empalme.' : 'Todavía no hay cordones ODF ⇄ ODF cargados.'}</td></tr>`}
      <tr><td colspan="5" style="padding-top:12px"><b>A equipos</b></td></tr>
      ${eg.size ? [...eg.values()].map(l => `<tr><td>${esc(l[0].why || '—')}</td><td>${esc(gbOdfShort(l[0].odf))} ${rg(l.map(x => x.port))}</td><td>${esc(gbUnit(l[0].eq)?.n || '')} · ${esc([...new Set(l.map(x => x.ep))].join(', '))}</td><td>${l.length}</td><td>${l.some(x => x.st === 'plan') ? '<span class="gb-chip plan">proyectado</span>' : ''}</td></tr>`).join('') : '<tr><td colspan="5" class="muted">Ningún equipo conectado todavía. Se conectan desde el puerto del equipo, en la pestaña Gabinete.</td></tr>'}
      </tbody></table></div>
    <aside class="gb-side"><div class="gb-card"><h2>Cómo se usa</h2><div class="muted sm" style="display:grid;gap:8px">
      <div>🔎 Con los cordones cargados se sigue un pelo de punta a punta: cable, caja de empalme, acometida, ODF, cordón, equipo.</div>
      <div>🔁 Cada cambio queda en Cambios. Si lo hace un técnico, lo confirma un supervisor; rechazarlo lo vuelve atrás.</div>
      <div>🏷 Etiqueta sugerida: <b>${esc(gbAbbr())}-O1-30 ⇄ ${esc(gbAbbr())}-O2-30</b>.</div></div></div></aside></div>`;
}

/* --- energía --- */
function gbVEne(){
  const g = GB.g, eqs = g.rack.filter(r => r.kind === 'eq' && r.cat && GB_CAT[r.cat].w), tw = eqs.reduce((t, r) => t + GB_CAT[r.cat].w[0], 0), mw = eqs.reduce((t, r) => t + GB_CAT[r.cat].w[1], 0);
  const ah = +(/(\d{2,4})\s*ah/i.exec(g.ene.bat || '') || [])[1] || 0, aut = tw && ah ? ah * 48 / 1000 * .8 / (tw / 1000) : 0;
  return `<div class="gb-grid"><div class="gb-card"><div class="gb-row" style="justify-content:space-between"><h2>Energía</h2>${gbCanEd() ? '<button class="btn sec small" id="gb-ene">Editar</button>' : ''}</div>
      <dl class="gb-kv"><dt>Rectificador</dt><dd>${esc(g.ene.rect || '—')}</dd><dt>Baterías</dt><dd>${esc(g.ene.bat || '—')}</dd><dt>Grupo electrógeno</dt><dd>${esc(g.ene.grupo || 'No tiene')}</dd></dl>
      <h3>Consumo de los equipos del gabinete</h3>
      <table class="gb-t"><thead><tr><th>Equipo</th><th>U</th><th>Típico</th><th>Máximo</th></tr></thead><tbody>${eqs.map(r => `<tr><td>${esc(r.n)}</td><td>${r.h}</td><td>${GB_CAT[r.cat].w[0]} W</td><td>${GB_CAT[r.cat].w[1]} W</td></tr>`).join('') || '<tr><td colspan="4" class="muted">Sin equipos cargados.</td></tr>'}
      <tr><td><b>Total</b></td><td></td><td><b>${Math.round(tw)} W</b></td><td><b>${Math.round(mw)} W</b></td></tr></tbody></table>
      ${aut ? `<div class="gb-alert ${aut >= 4 || g.ene.grupo ? 'ok' : ''}" style="margin-top:10px">Autonomía estimada con baterías: <b>${aut.toFixed(1).replace('.', ',')} h</b> al consumo típico (${ah} Ah · 48 V · 80 %). ${g.ene.grupo ? 'Respaldada por el grupo electrógeno.' : 'Sin grupo electrógeno.'}</div>` : ''}</div>
    <aside class="gb-side"><div class="gb-card"><h2>Alarmas y estado</h2><p class="muted sm" style="margin:0">El estado de aires, alarmas, baterías y puesta a tierra sale de los mantenimientos del sitio (pestaña Mantenimiento).</p></div></aside></div>`;
}

/* --- mantenimiento: últimas inspecciones del sitio --- */
function gbVMant(){
  setTimeout(gbLoadMant, 0);
  return `<div class="gb-card" style="max-width:760px"><h2>Mantenimientos del sitio</h2><div id="gb-mant" class="muted sm">Buscando…</div></div>`;
}
async function gbLoadMant(){
  const box = document.getElementById('gb-mant'); if (!box) return;
  try {
    const ss = await cached('sites-min2', () => pageAll(() => sb.from('sites').select('id,name,kind,traza,address,grupo').eq('active', true).order('name').order('id')));
    const raw = String(GB.n.name || GB.n.code || '').replace(/^(epi|nodo)\s*-?\s*/i, ''), nm = rdNorm(raw), st = (GB.n.site_id && ss.find(s => s.id === GB.n.site_id)) || ss.find(s => rdNorm(s.name) === nm) || ss.find(s => rdSame(s.name, raw));
    if (!st){ box.innerHTML = 'No encontré un sitio con el nombre de este nodo. Cuando el sitio exista con el mismo nombre, acá aparecen sus mantenimientos.'; return; }
    const ins = await cached('st-ins:' + st.id, () => sb.from('inspections').select('id,template_name,started_at,completed_at,status,score,max_score,flagged,inspector_name').eq('site_id', st.id).order('started_at', { ascending: false }).limit(200));
    if (!document.getElementById('gb-mant')) return;
    box.innerHTML = `<p style="margin:0 0 8px">Sitio <b>${esc(st.name)}</b> · <a href="#/sitio/${esc(st.id)}">ver ficha del sitio</a></p>${(ins || []).slice(0, 8).map(i => `<a class="gb-ins" href="${i.status === 'completada' ? '#/informe/' : '#/insp/'}${esc(i.id)}"><span>📋</span><span><b>${esc(i.template_name || 'Inspección')}</b><br><span class="muted sm">${esc(fmtDate(i.completed_at || i.started_at))}${i.inspector_name ? ' · ' + esc(i.inspector_name) : ''}${i.flagged ? ' · ' + (+i.flagged) + ' señalados' : ''}</span></span><span class="gb-chip">${i.max_score ? Math.round(i.score * 100 / i.max_score) + ' %' : esc(i.status || '')}</span></a>`).join('') || 'Todavía no hay inspecciones de este sitio.'}`;
    box.className = ''; box.style.display = 'grid'; box.style.gap = '6px';
  } catch (e){ box.textContent = online() ? 'No se pudieron traer los mantenimientos.' : 'Sin conexión: los mantenimientos se ven con internet.'; }
}

/* ---------- formularios ---------- */
function gbFormUnit(r){
  const m = modal(`<h2>${esc(r.n)}</h2><label>Nombre</label><input id="gu-n" maxlength="80" value="${esc(r.n)}">
    <div class="grid2"><div><label>U de arriba</label><input id="gu-u" type="number" min="1" max="${GB.g.H}" value="${r.u}"></div><div><label>Alto (U)</label><input id="gu-h" type="number" min="1" max="20" value="${r.h}"></div></div>
    <label>Lado</label><select id="gu-f">${Object.entries(GB_FACE).map(([k, t]) => `<option value="${k}" ${r.face === k ? 'selected' : ''}>${t}</option>`).join('')}</select>
    <label>Detalle</label><input id="gu-d" maxlength="200" value="${esc(r.det || '')}">
    <label style="display:flex;gap:8px;align-items:center;margin-top:8px"><input type="checkbox" id="gu-a" ${r.approx ? 'checked' : ''} style="width:auto;margin:0"> Posición a confirmar en campo</label>
    <p class="muted sm" id="gu-e"></p><div class="row" style="justify-content:flex-end;gap:6px"><button class="btn sec" id="gu-x">Cancelar</button><button class="btn" id="gu-ok">Guardar</button></div>`);
  $('#gu-x').onclick = m.close;
  $('#gu-ok').onclick = () => { const g = gbCopy(), x = g.rack.find(q => q.id === r.id), u = gbI($('#gu-u').value, 1, g.H, r.u), h = gbI($('#gu-h').value, 1, 20, r.h), face = $('#gu-f').value;
    const keep = GB.g; GB.g = g; const fits = gbFits(u, h, face, x); GB.g = keep;
    if (!fits) return ($('#gu-e').textContent = 'No entra ahí: se pisa con otro elemento o se sale del gabinete.');
    const moved = u !== r.u || face !== r.face; Object.assign(x, { n: gbT($('#gu-n').value) || r.n, u, h, face, det: gbT($('#gu-d').value, 200), approx: $('#gu-a').checked });
    m.close(); gbSave(g, moved ? `${x.n} a U${u} (${GB_FACE[face]})` : `editar ${x.n}`); };
}
function gbFormOdf(id){
  const od = gbOdf(id), rows = od.ranges.map(r => ({ ...r }));
  const draw = () => `<h2>Casetes de ${esc(od.name)}</h2><p class="muted sm">Cada fila son 12 puertos (un buffer). "Acometida" es el buffer del cable que entra al gabinete; vacío si el cable llega directo al ODF.</p>
    <div class="grid2"><div><label>Nombre</label><input id="go-n" maxlength="60" value="${esc(od.name)}"></div><div><label>Hilos</label><select id="go-h">${[24, 48, 72, 96, 144].map(h => `<option ${od.hilos === h ? 'selected' : ''}>${h}</option>`).join('')}</select></div></div>
    <div style="overflow-x:auto"><table class="gb-t" style="min-width:560px"><thead><tr><th>Desde puerto</th><th>Lado</th><th>Buffer del cable</th><th>Acometida</th><th>Viene de / va a</th><th></th></tr></thead><tbody>
    ${rows.map((r, k) => `<tr><td><input data-k="${k}" data-f="from" type="number" min="1" max="144" value="${r.from}" style="width:70px;margin:0"></td><td><select data-k="${k}" data-f="side" style="margin:0"><option value="sur" ${r.side === 'sur' ? 'selected' : ''}>sur (baja)</option><option value="norte" ${r.side === 'norte' ? 'selected' : ''}>norte (sale)</option></select></td>
      <td><select data-k="${k}" data-f="buf" style="margin:0">${GB_BUF.map((b, i) => `<option value="${i}" ${r.buf === i ? 'selected' : ''}>B${i + 1} ${b[0]}</option>`).join('')}</select></td>
      <td><select data-k="${k}" data-f="acom" style="margin:0"><option value="">—</option>${GB_BUF.map((b, i) => `<option value="${i}" ${r.acom === i ? 'selected' : ''}>B${i + 1} ${b[0]}</option>`).join('')}</select></td>
      <td><input data-k="${k}" data-f="far" maxlength="80" value="${esc(r.far)}" placeholder="${esc(GB.g.sides[r.side] || '')}" style="margin:0"></td><td><button class="btn sec small" data-del="${k}" style="color:var(--red)">✕</button></td></tr>`).join('')}</tbody></table></div>
    <button class="btn sec small" id="go-add" style="margin-top:6px">＋ Agregar 12 puertos</button><p class="muted sm" id="go-e"></p>
    <div class="row" style="justify-content:flex-end;gap:6px"><button class="btn sec" id="go-x">Cancelar</button><button class="btn" id="go-ok">Guardar</button></div>`;
  const m = modal('', { wide: true });
  const read = () => m.el.querySelectorAll('[data-k]').forEach(i => { const r = rows[+i.dataset.k], f = i.dataset.f; r[f] = f === 'far' || f === 'side' ? i.value : f === 'acom' ? (i.value === '' ? null : +i.value) : +i.value; });
  const paint = () => { m.el.innerHTML = draw();
    $('#go-x').onclick = m.close;
    m.el.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { read(); rows.splice(+b.dataset.del, 1); paint(); });
    $('#go-add').onclick = () => { read(); const last = Math.max(0, ...rows.map(r => r.from + 11)), prev = rows[rows.length - 1];
      const nb = prev ? Math.min(23, prev.buf + 1) : 0, na = prev && prev.acom != null ? Math.min(23, prev.acom + 1) : GB.g.acom ? 0 : null;
      rows.push({ from: last + 1, side: prev ? prev.side : 'sur', buf: nb, acom: na, far: prev ? prev.far : '' }); paint(); };
    $('#go-ok').onclick = () => { read(); const hilos = +$('#go-h').value, bad = rows.find(r => r.from < 1 || r.from + 11 > hilos), over = rows.find((r, i) => rows.some((q, j) => j !== i && r.from <= q.from + 11 && q.from <= r.from + 11));
      if (bad) return ($('#go-e').textContent = `La fila que empieza en ${bad.from} no entra en un ODF de ${hilos}.`); if (over) return ($('#go-e').textContent = `Hay filas que se pisan (puerto ${over.from}).`);
      const g = gbCopy(), x = g.odfs.find(q => q.id === id); x.name = gbT($('#go-n').value, 60) || x.name; x.hilos = hilos; x.ranges = rows.map(r => ({ ...r, to: r.from + 11 }));
      g.eq = g.eq.filter(e => !(e.odf === id && e.port > hilos)); g.cords = g.cords.filter(c => !((c.a[0] === id && c.a[1] > hilos) || (c.b[0] === id && c.b[1] > hilos)));
      const r = g.rack.find(q => q.odf === id); if (r) r.n = x.name;
      m.close(); gbSave(g, `casetes de ${x.name}`); }; };
  paint();
}
function gbFormSides(){
  const names = RD.els.filter(e => e.kind === 'nodo' && e.id !== GB.n.id).map(e => e.name || e.code).filter(Boolean).sort((a, b) => a.localeCompare(b, 'es'));
  const m = modal(`<h2>Nombres de los lados</h2><p class="muted sm">Se usan cuando un casete no tiene escrito de dónde viene o adónde va.</p><datalist id="gs-dl">${names.map(n => `<option value="${esc(n)}">`).join('')}</datalist>
    <label>Lado sur · el cable viene de</label><input id="gs-s" maxlength="80" list="gs-dl" value="${esc(GB.g.sides.sur)}"><label>Lado norte · el cable va a</label><input id="gs-n" maxlength="80" list="gs-dl" value="${esc(GB.g.sides.norte)}">
    <div class="row" style="justify-content:flex-end;gap:6px;margin-top:10px"><button class="btn sec" id="gs-x">Cancelar</button><button class="btn" id="gs-ok">Guardar</button></div>`);
  $('#gs-x').onclick = m.close; $('#gs-ok').onclick = () => { const g = gbCopy(); g.sides = { sur: gbT($('#gs-s').value), norte: gbT($('#gs-n').value) }; m.close(); gbSave(g, 'nombres de los lados'); };
}
function gbFormEne(){
  const e = GB.g.ene, m = modal(`<h2>Energía</h2><label>Rectificador</label><input id="ge-r" maxlength="160" value="${esc(e.rect)}"><label>Baterías (poné los Ah, ej. "120 Ah")</label><input id="ge-b" maxlength="160" value="${esc(e.bat)}"><label>Grupo electrógeno (vacío si no tiene)</label><input id="ge-g" maxlength="160" value="${esc(e.grupo)}">
    <div class="row" style="justify-content:flex-end;gap:6px;margin-top:10px"><button class="btn sec" id="ge-x">Cancelar</button><button class="btn" id="ge-ok">Guardar</button></div>`);
  $('#ge-x').onclick = m.close; $('#ge-ok').onclick = () => { const g = gbCopy(); g.ene = { rect: gbT($('#ge-r').value, 160), bat: gbT($('#ge-b').value, 160), grupo: gbT($('#ge-g').value, 160) }; m.close(); gbSave(g, 'datos de energía'); };
}
function gbFormEqCon(r, ep){
  const free = (o, p) => !!gbPI(o, p) && !gbEq(o, p) && !gbCord(o, p);
  const m = modal(`<h2>Conectar ${esc(r.n)} · ${esc(ep)}</h2><p class="muted sm">Cada puerto del equipo usa dos pelos: Tx y Rx.</p>
    <label>ODF</label><select id="gq-o">${GB.g.odfs.map(o => `<option value="${esc(o.id)}">${esc(o.name)}</option>`).join('')}</select>
    <div class="grid2"><div><label>Puerto Tx</label><input id="gq-t" type="number" min="1" max="144"></div><div><label>Puerto Rx</label><input id="gq-r" type="number" min="1" max="144"></div></div>
    <label>Para qué (ej. MPLS vecino Cayastá)</label><input id="gq-w" maxlength="100">
    <label style="display:flex;gap:8px;align-items:center;margin-top:8px"><input type="checkbox" id="gq-p" style="width:auto;margin:0"> Proyectado (todavía no instalado)</label>
    <p class="muted sm" id="gq-e"></p><div class="row" style="justify-content:flex-end;gap:6px"><button class="btn sec" id="gq-x">Cancelar</button><button class="btn" id="gq-ok">Conectar</button></div>`);
  $('#gq-t').oninput = () => { if (!$('#gq-r').dataset.touched) $('#gq-r').value = (+$('#gq-t').value || 0) + 1; }; $('#gq-r').oninput = () => $('#gq-r').dataset.touched = '1';
  $('#gq-x').onclick = m.close;
  $('#gq-ok').onclick = () => { const o = $('#gq-o').value, t = +$('#gq-t').value, x = +$('#gq-r').value;
    if (!Number.isInteger(t) || !Number.isInteger(x) || t === x) return ($('#gq-e').textContent = 'Poné dos puertos distintos.');
    for (const p of [t, x]) if (!free(o, p)) return ($('#gq-e').textContent = `El puerto ${p} ${gbPI(o, p) ? 'ya está ocupado' : 'no tiene pelo asignado'}.`);
    const g = gbCopy(), why = gbT($('#gq-w').value, 100), st = $('#gq-p').checked ? 'plan' : 'ok';
    g.eq.push({ odf: o, port: t, eq: r.id, ep, fx: 'Tx', why, st }, { odf: o, port: x, eq: r.id, ep, fx: 'Rx', why, st });
    m.close(); gbSave(g, `${r.n} ${ep} ⇄ ${gbOdfShort(o)} ${t}/${x}`); };
}
function gbFormBulk(){
  const m = modal(`<h2>Cordones en bloque</h2><p class="muted sm">Para unir varios puertos seguidos de un ODF con otro (por ejemplo, un buffer completo que sigue de largo).</p>
    <div class="grid2"><div><label>Desde ODF</label><select id="gk-a">${GB.g.odfs.map(o => `<option value="${esc(o.id)}">${esc(o.name)}</option>`).join('')}</select></div><div><label>Hasta ODF</label><select id="gk-b">${GB.g.odfs.map((o, i) => `<option value="${esc(o.id)}" ${i === 1 ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select></div></div>
    <div class="grid2"><div><label>Puertos desde</label><input id="gk-1" type="number" min="1" max="144"></div><div><label>hasta</label><input id="gk-2" type="number" min="1" max="144"></div></div>
    <label>Empezando en el puerto (del ODF destino)</label><input id="gk-3" type="number" min="1" max="144">
    <label>Qué conecta (ej. Data Center → San Javier, B3)</label><input id="gk-w" maxlength="100">
    <label style="display:flex;gap:8px;align-items:center;margin-top:8px"><input type="checkbox" id="gk-p" style="width:auto;margin:0"> Proyectado (todavía no instalado)</label>
    <p class="muted sm" id="gk-e"></p><div class="row" style="justify-content:flex-end;gap:6px"><button class="btn sec" id="gk-x">Cancelar</button><button class="btn" id="gk-ok">Agregar</button></div>`);
  $('#gk-1').oninput = () => { if (!$('#gk-3').dataset.t) $('#gk-3').value = $('#gk-1').value; }; $('#gk-3').oninput = () => $('#gk-3').dataset.t = '1';
  $('#gk-x').onclick = m.close;
  $('#gk-ok').onclick = () => { const a = $('#gk-a').value, b = $('#gk-b').value, p1 = +$('#gk-1').value, p2 = +$('#gk-2').value || p1, p3 = +$('#gk-3').value, n = p2 - p1 + 1;
    if (!Number.isInteger(p1) || !Number.isInteger(p3) || n < 1 || n > 144) return ($('#gk-e').textContent = 'Revisá los números de puerto.');
    const g = gbCopy(), why = gbT($('#gk-w').value, 100), st = $('#gk-p').checked ? 'plan' : 'ok';
    for (let k = 0; k < n; k++){ const A = [a, p1 + k], B = [b, p3 + k];
      if (a === b && (A[1] === B[1] || (B[1] >= p1 && B[1] <= p2))) return ($('#gk-e').textContent = 'En el mismo ODF los rangos no pueden pisarse.');
      for (const [o, p] of [A, B]){ if (!gbPI(o, p)) return ($('#gk-e').textContent = `${gbOdfShort(o)} puerto ${p} no tiene pelo asignado.`); if (gbEq(o, p) || gbCord(o, p)) return ($('#gk-e').textContent = `${gbOdfShort(o)} puerto ${p} ya está ocupado.`); }
      g.cords.push({ a: A, b: B, why, st }); }
    m.close(); gbSave(g, `${n} cordones ${gbOdfShort(a)} ${p1}–${p2} ⇄ ${gbOdfShort(b)} ${p3}–${p3 + n - 1}`); };
}

/* ---------- eventos ---------- */
function gbBind(root){
  const q = s => root.querySelector(s), qa = s => root.querySelectorAll(s);
  q('#gb-x').onclick = gabClose;
  q('#gb-ch').onclick = () => { gabClose(); rdTray(); };
  q('#gb-sides')?.addEventListener('click', gbFormSides);
  q('#gb-uni')?.addEventListener('click', gbUniPick);
  q('#gb-tpl')?.addEventListener('click', () => { const g = gbTemplate(GB.n, q('#gb-model').value); if (!g) return; gbSave(g, `armado desde la plantilla (${GB_MODEL[g.model].n})`); });
  q('#gb-reodf')?.addEventListener('click', () => { if (!confirm('Se rearman los ODF según la Red. Los cordones y conexiones a equipos de los ODF se borran. ¿Seguir?')) return;
    const g = gbCopy(), { acom, odfs } = gbOdfsFor(GB.n); g.acom = acom; g.odfs = odfs; g.eq = []; g.cords = [];
    const old = g.rack.filter(r => r.kind === 'odf'); g.rack = g.rack.filter(r => r.kind !== 'odf');
    odfs.forEach((o, i) => { const h = o.hilos >= 144 ? 6 : o.hilos >= 96 ? 4 : 2, prev = old[i]; let u = prev && gbFitsIn(g, prev.u, h) ? prev.u : null;
      for (let x = 1; u == null && x <= g.H - h + 1; x++) if (gbFitsIn(g, x, h)) u = x; if (u != null) g.rack.push({ id: 'o' + Date.now().toString(36) + i, u, h, n: o.name, kind: 'odf', odf: o.id, face: 'both', approx: true, det: '' }); });
    gbSave(g, 'ODF rearmados según los buffers de la Red'); });
  qa('[data-gt]').forEach(b => b.onclick = () => { GB.tab = b.dataset.gt; GB.pick = null; gbRender(); });
  qa('[data-face]').forEach(b => b.onclick = () => { GB.face = b.dataset.face; GB.adding = null; const r = gbUnit(GB.sel); if (r && !(r.face === 'both' || r.face === GB.face)) GB.sel = null; gbRender(); });
  qa('[data-r]').forEach(g => g.onclick = () => { GB.sel = g.dataset.r; GB.adding = null; GB.eqPort = null; gbRender(); });
  qa('[data-free]').forEach(g => g.onclick = () => { if (!gbCanEd()) return; GB.adding = g.dataset.free.split('|').map(Number); GB.sel = null; gbRender(); });
  qa('[data-add]').forEach(b => b.onclick = () => { const k = b.dataset.add, c = GB_CAT[k], [a] = GB.adding, g = gbCopy(), id = 'u' + Date.now().toString(36);
    let odf = null, name = c.n;
    if (c.kind === 'odf'){ let i = 1; while (g.odfs.some(o => o.id === 'O' + i)) i++; odf = 'O' + i; name = `ODF ${i}`; g.odfs.push({ id: odf, name, hilos: c.hilos, ranges: [] }); }
    if (k === 'otro'){ const t = prompt('Nombre del equipo', ''); if (!t) return; name = gbT(t); }
    let face = c.kind === 'odf' ? 'both' : GB.face; const keep = GB.g; GB.g = g; if (!gbFits(a, c.u, face)) face = GB.face; const ok = gbFits(a, c.u, face); GB.g = keep;
    if (!ok) return toast('No entra en ese lugar.');
    g.rack.push({ id, u: a, h: c.u, n: name, kind: c.kind, cat: c.kind === 'eq' || c.kind === 'ene' ? k : null, odf, face, approx: false, det: '' });
    GB.sel = id; GB.adding = null; gbSave(g, `agregar ${name} en U${a}`); });
  q('[data-cancel]')?.addEventListener('click', () => { GB.adding = null; gbRender(); });
  q('[data-ued]')?.addEventListener('click', () => gbFormUnit(gbUnit(GB.sel)));
  q('[data-urm]')?.addEventListener('click', () => { const r = gbUnit(GB.sel); if (!r || !confirm(`¿Quitar ${r.n} del gabinete?${r.kind === 'odf' ? ' Se borran también sus casetes y cordones.' : ''}`)) return;
    const g = gbCopy(); g.rack = g.rack.filter(x => x.id !== r.id); if (r.kind === 'odf' && r.odf){ g.odfs = g.odfs.filter(o => o.id !== r.odf); g.eq = g.eq.filter(e => e.odf !== r.odf); g.cords = g.cords.filter(c => c.a[0] !== r.odf && c.b[0] !== r.odf); }
    if (r.kind === 'eq') g.eq = g.eq.filter(e => e.eq !== r.id); GB.sel = null; gbSave(g, `quitar ${r.n} (U${r.u})`); });
  qa('[data-ep]').forEach(b => b.onclick = () => { GB.eqPort = [GB.sel, b.dataset.ep]; gbRender(); });
  q('[data-epcon]')?.addEventListener('click', () => gbFormEqCon(gbUnit(GB.eqPort[0]), GB.eqPort[1]));
  q('[data-epdis]')?.addEventListener('click', () => { const [id, ep] = GB.eqPort, r = gbUnit(id); if (!confirm(`¿Desconectar ${ep} de ${r.n}?`)) return; const g = gbCopy(); g.eq = g.eq.filter(e => !(e.eq === id && e.ep === ep)); gbSave(g, `desconectar ${r.n} ${ep}`); });
  qa('[data-goodf]').forEach(b => b.onclick = () => { GB.tab = 'odf'; GB.odf = b.dataset.goodf; GB.port = null; gbRender(); });
  qa('[data-edodf]').forEach(b => b.onclick = () => gbFormOdf(b.dataset.edodf));
  qa('[data-flow]').forEach(g => g.onclick = () => { const [o, p] = g.dataset.flow.split('|'); GB.odf = o; GB.port = [o, +p]; gbRender(); });
  qa('[data-odf]').forEach(b => b.onclick = () => { GB.odf = b.dataset.odf; if (!GB.pick) GB.port = null; gbRender(); });
  qa('[data-p]').forEach(g => g.onclick = () => { const [o, p] = g.dataset.p.split('|'), P = [o, +p];
    if (GB.pick){ const a = GB.pick; if (a[0] === P[0] && a[1] === P[1]) return; if (!gbPI(...P)) return toast('Ese puerto no tiene pelo asignado.'); if (gbCord(...P) || gbEq(...P)) return toast('Ese puerto ya tiene un cordón.');
      const why = gbT(prompt('¿Qué conecta este cordón? (opcional)', '') || '', 100), g = gbCopy(); g.cords.push({ a, b: P, why, st: 'ok' }); GB.pick = null; GB.port = P;
      gbSave(g, `cordón ${gbOdfShort(a[0])} ${a[1]} ⇄ ${gbOdfShort(P[0])} ${P[1]}`); return; }
    GB.port = P; gbRender(); });
  q('[data-mkic]')?.addEventListener('click', () => { GB.pick = GB.port; gbRender(); });
  q('[data-nopick]')?.addEventListener('click', () => { GB.pick = null; gbRender(); });
  q('[data-goeq]')?.addEventListener('click', () => { const e = gbEq(...GB.port); if (!e) return; const r = gbUnit(e.eq); GB.tab = 'gab'; GB.sel = e.eq; GB.eqPort = [e.eq, e.ep]; if (r && r.face !== 'both') GB.face = r.face; gbRender(); });
  q('[data-unic]')?.addEventListener('click', () => { const c = gbCord(...GB.port); if (!c) return; const g = gbCopy(); g.cords = g.cords.filter(x => !(x.a[0] === c.a[0] && x.a[1] === c.a[1] && x.b[0] === c.b[0] && x.b[1] === c.b[1])); gbSave(g, `quitar cordón ${gbOdfShort(c.a[0])} ${c.a[1]} ⇄ ${gbOdfShort(c.b[0])} ${c.b[1]}`); });
  q('#gb-bulk')?.addEventListener('click', gbFormBulk);
  q('#gb-ene')?.addEventListener('click', gbFormEne);
}
function gbFitsIn(g, u, h){ const keep = GB.g; GB.g = g; const ok = gbFits(u, h, 'both'); GB.g = keep; return ok; }
