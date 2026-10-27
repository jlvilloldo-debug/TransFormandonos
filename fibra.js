/* =====================================================================
   InspectApp · Transformándonos — v4.2
   Herramientas → Fibra óptica: tramos Sitio A → Sitio B (KMZ validado con el .sor),
   ubicar eventos del OTDR (.sor o distancia), actualizar elementos en
   campo con GPS e historial, exportar KMZ.
   Solo declara funciones (y un listener de conexión): no ejecuta nada al cargarse.
   ===================================================================== */

const FE_KINDS = { botella: 'Botella / empalme', cruz: 'Cruz de ganancia', reserva: 'Reserva', poste: 'Poste', camara: 'Cámara', epi: 'EPI / nodo', dc: 'DC / central', otro: 'Otro' };
const FE_STATUS = { kmz: 'Del KMZ', aproximado: 'A confirmar', actualizado: 'Actualizado' };
const RES_KINDS = ['botella', 'cruz', 'reserva'];
let fmap = null;

/* ---------- geometría ---------- */
function havm(a, b){ // a, b = [lng, lat]
  const R = 6371008.8, r = Math.PI / 180;
  const dla = (b[1] - a[1]) * r, dlo = (b[0] - a[0]) * r;
  const x = Math.sin(dla / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dlo / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
}
function cumOf(path){ const c = [0]; for (let i = 1; i < path.length; i++) c.push(c[i - 1] + havm(path[i - 1], path[i])); return c; }
/* Recorrido de A a B: camino más corto sobre la red de líneas del KMZ
   (una línea larga de toda la traza, o varias líneas cortadas, con ramales). */
function pathAtoB(lines, A, B){
  const nodes = [], adj = [];
  const add = p => { nodes.push(p); adj.push([]); return nodes.length - 1; };
  const link = (i, j) => { const w = havm(nodes[i], nodes[j]); adj[i].push([j, w]); adj[j].push([i, w]); };
  const segs = []; // [i, j] aristas para proyectar
  const lineNodes = lines.map(l => { const ids = l.pts.map(add); for (let k = 1; k < ids.length; k++){ link(ids[k - 1], ids[k]); segs.push([ids[k - 1], ids[k]]); } return ids; });
  // unir extremos de cada línea con el punto más cercano de otra línea (hasta 250 m)
  lineNodes.forEach((ids, li) => [ids[0], ids[ids.length - 1]].forEach(e => {
    let best = null;
    lineNodes.forEach((o, lj) => { if (lj === li) return; for (const k of o){ const d = havm(nodes[e], nodes[k]); if (d < 250 && (!best || d < best.d)) best = { k, d }; } });
    if (best) link(e, best.k);
  }));
  const snap = p => { // proyecta el punto sobre la arista más cercana y crea un nodo ahí
    let best = null;
    for (const [i, j] of segs){
      const a = nodes[i], b = nodes[j], kx = Math.cos(a[1] * Math.PI / 180) * 111320, ky = 110540;
      const bx = (b[0] - a[0]) * kx, by = (b[1] - a[1]) * ky, px = (p[0] - a[0]) * kx, py = (p[1] - a[1]) * ky;
      const L2 = bx * bx + by * by, t = L2 ? Math.max(0, Math.min(1, (px * bx + py * by) / L2)) : 0, d = Math.hypot(px - t * bx, py - t * by);
      if (!best || d < best.d) best = { i, j, t, d };
    }
    if (!best) return null;
    const a = nodes[best.i], b = nodes[best.j], q = add([a[0] + best.t * (b[0] - a[0]), a[1] + best.t * (b[1] - a[1])]);
    link(q, best.i); link(q, best.j);
    return { id: q, off: best.d };
  };
  const sa = snap(A), sb_ = snap(B);
  if (!sa || !sb_) return null;
  // Dijkstra con montículo binario
  const N = nodes.length, dist = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), heap = [];
  const push = (d, i) => { heap.push([d, i]); let c = heap.length - 1; while (c > 0){ const p2 = (c - 1) >> 1; if (heap[p2][0] <= heap[c][0]) break; [heap[p2], heap[c]] = [heap[c], heap[p2]]; c = p2; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length){ heap[0] = last; let c = 0; for (;;){ const l = 2 * c + 1, r = l + 1; let m = c; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m; } } return top; };
  dist[sa.id] = 0; push(0, sa.id);
  while (heap.length){ const [d, i] = pop(); if (d > dist[i]) continue; if (i === sb_.id) break; for (const [j, w] of adj[i]){ const nd = d + w; if (nd < dist[j]){ dist[j] = nd; prev[j] = i; push(nd, j); } } }
  if (!isFinite(dist[sb_.id])) return null;
  const out = []; for (let i = sb_.id; i !== -1; i = prev[i]) out.push(nodes[i]); out.reverse();
  const path = out.filter((p, i) => i === 0 || p[0] !== out[i - 1][0] || p[1] !== out[i - 1][1]).map(p => [Math.round(p[0] * 1e7) / 1e7, Math.round(p[1] * 1e7) / 1e7]);
  return { path, offA: sa.off, offB: sb_.off };
}
function projectOn(path, cum, p){
  let best = null;
  for (let i = 0; i < path.length - 1; i++){
    const a = path[i], b = path[i + 1];
    const kx = Math.cos(a[1] * Math.PI / 180) * 111320, ky = 110540;
    const bx = (b[0] - a[0]) * kx, by = (b[1] - a[1]) * ky, px = (p[0] - a[0]) * kx, py = (p[1] - a[1]) * ky;
    const L2 = bx * bx + by * by, t = L2 ? Math.max(0, Math.min(1, (px * bx + py * by) / L2)) : 0;
    const d = Math.hypot(px - t * bx, py - t * by);
    if (!best || d < best.off) best = { off: d, chain: cum[i] + t * Math.sqrt(L2) };
  }
  return best || { off: 0, chain: 0 };
}
function pointAt(path, cum, c){
  c = Math.max(0, Math.min(cum[cum.length - 1], c));
  let lo = 0, hi = cum.length - 1;
  while (hi - lo > 1){ const m = (lo + hi) >> 1; if (cum[m] <= c) lo = m; else hi = m; }
  const t = cum[hi] > cum[lo] ? (c - cum[lo]) / (cum[hi] - cum[lo]) : 0, a = path[lo], b = path[hi];
  return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
}
function pathBetween(path, cum, c1, c2){
  const out = [pointAt(path, cum, c1)];
  for (let i = 0; i < cum.length; i++) if (cum[i] > c1 && cum[i] < c2) out.push(path[i]);
  out.push(pointAt(path, cum, c2));
  return out;
}

/* ---------- modelo fibra ↔ recorrido ----------
   Anclas: empalmes del .sor emparejados con una caja confirmada (coincide con el KMZ o
   actualizada en campo), cortes reparados con ubicación real y las dos puntas.
   Entre dos anclas la fibra = recorrido × k + reservas intermedias (+ media reserva de las cajas ancla). */
function fiberModel(route, elements, events, val){
  const L = Number(route.route_length_m) || 0, R = Number(route.reserve_m ?? 30);
  const res = elements.filter(e => RES_KINDS.includes(e.kind) && e.chain_m != null && e.status !== 'aproximado').map(e => ({ c: Number(e.chain_m), r: Number(e.reserve_m ?? R), e })).sort((a, b) => a.c - b.c);
  val = val || validateRoute(route, elements);
  const anchors = [{ o: 0, c: 0, h: 0, label: route.end_a || 'Sitio A' }];
  for (const p of val.pairs){ if (p.e && p.anchor) anchors.push({ o: p.s.a, c: Number(p.e.chain_m), h: (RES_KINDS.includes(p.e.kind) ? Number(p.e.reserve_m ?? R) : 0) / 2, label: `Empalme ${p.s.n}`, e: p.e }); }
  for (const ev of events || []) if (ev.real_lat != null && ev.chain_real !== undefined) anchors.push({ o: Number(ev.otdr_a), c: ev.chain_real, h: 0, label: 'Corte reparado ' + fmtDate(ev.created_at) });
  const Lopt = Number(route.optical_length_m) || null;
  const totalRes = res.reduce((a, x) => a + x.r, 0);
  anchors.push({ o: Lopt || (L * 1.02 + totalRes), c: L, h: 0, label: route.end_b || 'Sitio B', est: !Lopt });
  anchors.sort((a, b) => a.o - b.o);
  const clean = [anchors[0]];
  for (const a of anchors.slice(1)) if (a.c > clean[clean.length - 1].c + 1 && a.o > clean[clean.length - 1].o) clean.push(a);
  const vanos = [];
  for (let i = 0; i < clean.length - 1; i++){
    const A = clean[i], B = clean[i + 1];
    const inside = res.filter(x => x.c > A.c + 2 && x.c < B.c - 2 && !(A.e && x.e.id === A.e.id) && !(B.e && x.e.id === B.e.id));
    const budget = (B.o - A.o) - A.h - B.h - inside.reduce((s, x) => s + x.r, 0);
    let k = budget / Math.max(1, B.c - A.c), low = false;
    if (!(k > 0.85 && k < 1.35)){ low = true; k = Math.max(0.85, Math.min(1.35, (B.o - A.o) / Math.max(1, B.c - A.c))); }
    vanos.push({ A, B, inside, k, low });
  }
  return { anchors: clean, vanos, Lopt, L, R, val };
}
/* Une los eventos de uno o más .sor (A→B y B→A) en una lista de empalmes medidos desde A */
function combineSors(files){
  const ends = files.map(f => f.end).filter(x => x > 0);
  const Lopt = ends.length ? ends.reduce((a, b) => a + b, 0) / ends.length : null;
  const pts = [];
  for (const f of files){
    for (const ev of f.events){
      if (ev.end || ev.m - f.launch < 30) continue;
      const o = ev.m - f.launch;
      const a = f.dir === 'AB' ? o : (Lopt ? Lopt - o : null);
      if (a == null || a <= 20 || (Lopt && a >= Lopt - 20)) continue;
      pts.push({ a, dir: f.dir, loss: ev.loss });
    }
  }
  pts.sort((x, y) => x.a - y.a);
  const out = [];
  for (const p of pts){
    const last = out[out.length - 1];
    if (last && p.a - last.aMax <= 30){ last.items.push(p); last.aMax = p.a; continue; }
    out.push({ items: [p], aMax: p.a });
  }
  return { Lopt, splices: out.map((g, i) => {
    const ab = g.items.filter(x => x.dir === 'AB').map(x => x.loss), ba = g.items.filter(x => x.dir === 'BA').map(x => x.loss);
    const lab = ab.length ? ab.reduce((a, b) => a + b, 0) / ab.length : null, lba = ba.length ? ba.reduce((a, b) => a + b, 0) / ba.length : null;
    const avg = lab != null && lba != null ? (lab + lba) / 2 : (lab ?? lba);
    return { n: i + 1, a: Math.round(g.items.reduce((s, x) => s + x.a, 0) / g.items.length * 10) / 10, ab: lab, ba: lba, avg, worst: Math.max(...g.items.map(x => x.loss)), seen: ab.length && ba.length ? 'AB/BA' : ab.length ? 'AB' : 'BA', fibers: 1, vals: [avg] };
  }) };
}
/* Contrasta los empalmes del .sor con las cajas del KMZ */
function validateRoute(route, elements, margin = 50){
  const splices = route.splices || [], R = Number(route.reserve_m ?? 30), L = Number(route.route_length_m) || 0;
  const cand = elements.filter(e => (e.kind === 'botella' || e.kind === 'epi' || e.kind === 'dc') && e.chain_m != null && Number(e.chain_m) > 40 && Number(e.chain_m) < L - 40).sort((a, b) => a.chain_m - b.chain_m);
  const resC = elements.filter(e => RES_KINDS.includes(e.kind) && e.chain_m != null && e.status !== 'aproximado').map(e => Number(e.chain_m)).sort((a, b) => a - b);
  const model = (c, h) => c * (1 + h) + R * resC.filter(x => x < c - 1).length;
  const fixed = new Map(); // empalmes ya ligados a una caja (creada o confirmada en campo)
  elements.forEach(e => { if (e.splice_no && (e.status === 'actualizado' || e.status === 'aproximado')) fixed.set(e.splice_no, e); });
  let best = { err: Infinity, h: 0.02 };
  const kmzB = cand.filter(e => e.status === 'kmz' && !e.splice_no);
  if (splices.length && kmzB.length) for (let h = 0; h <= 0.08; h += 0.0025){
    const err = kmzB.reduce((s, e) => s + Math.min(...splices.map(x => Math.abs(model(e.chain_m, h) - x.a)), 3000), 0);
    if (err < best.err) best = { err, h };
  }
  // emparejar en orden (programación dinámica): el .sor y el KMZ van en el mismo sentido
  const free = splices.filter(x => !fixed.has(x.n)), pool = cand.filter(e => e.status !== 'aproximado' && !(e.splice_no && fixed.get(e.splice_no) === e));
  const align = (resid, tolOf) => {
    const n = free.length, m = pool.length, f = Array.from({ length: n + 1 }, () => new Float64Array(m + 1)), w = (i, j) => { const r = resid(i, j), t = tolOf(i); return Math.abs(r) < t ? 1 - 0.7 * Math.abs(r) / t : -1; };
    for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) f[i][j] = Math.max(f[i - 1][j], f[i][j - 1], f[i - 1][j - 1] + Math.max(w(i - 1, j - 1), -1e9) * (w(i - 1, j - 1) > 0 ? 1 : 0) - (w(i - 1, j - 1) > 0 ? 0 : 1e9));
    const res = new Map(); let i = n, j = m;
    while (i > 0 && j > 0){ const ww = w(i - 1, j - 1); if (ww > 0 && Math.abs(f[i][j] - (f[i - 1][j - 1] + ww)) < 1e-9){ res.set(i - 1, j - 1); i--; j--; } else if (f[i - 1][j] >= f[i][j - 1]) i--; else j--; }
    return res;
  };
  const d0 = (i, j) => model(pool[j].chain_m, best.h) - free[i].a;
  const mt = align(d0, i => Math.max(300, 0.05 * free[i].a));
  // margen de estimación: crece con la distancia al punto firme más cercano (las puntas o una caja confirmada en campo)
  const Lo = Number(route.optical_length_m) || (splices.length ? splices[splices.length - 1].a : L);
  const firm = [0, Lo, ...[...fixed.entries()].filter(([, e]) => e.status === 'actualizado').map(([n]) => (splices.find(x => x.n === n) || {}).a).filter(x => x != null)];
  const marginAt = x => Math.round(Math.max(margin, 0.012 * Math.min(...firm.map(f => Math.abs(f - x)))));
  const used = new Set([...fixed.values()].map(e => e.id)), pairs = [];
  for (const sp of splices){
    const fe = fixed.get(sp.n), mg = marginAt(sp.a);
    if (fe){ pairs.push({ s: sp, e: fe, d: null, mg, status: fe.status === 'actualizado' ? 'confirmada' : 'a_confirmar', anchor: fe.status === 'actualizado' }); continue; }
    const i = free.indexOf(sp), j = mt.get(i);
    if (j == null){ pairs.push({ s: sp, e: null, d: null, mg, status: 'falta', anchor: false }); continue; }
    const e = pool[j], d = d0(i, j); used.add(e.id);
    const ok = Math.abs(d) <= mg || e.status === 'actualizado';
    pairs.push({ s: sp, e, d, mg, status: ok ? 'coincide' : 'desplazada', anchor: Math.abs(d) <= margin || e.status === 'actualizado' });
  }
  const orphans = cand.filter(e => e.kind === 'botella' && !used.has(e.id));
  return { pairs, orphans, h: best.h };
}
function otdrToChain(model, o){
  const v = model.vanos.find(x => o >= x.A.o && o <= x.B.o) || (o < 0 ? model.vanos[0] : model.vanos[model.vanos.length - 1]);
  if (!v) return null;
  let pos = v.A.o + v.A.h, prev = v.A.c, n = 0;
  const done = (c, inRes) => ({ chain: Math.max(0, Math.min(model.L, c)), inRes, v, k: v.k,
    window: Math.round(12 + 0.02 * Math.min(Math.abs(o - v.A.o), Math.abs(v.B.o - o)) + 6 * Math.sqrt(n) + (v.low ? 0.02 * Math.abs(v.B.o - v.A.o) : 0) + (v.B.est ? 0.03 * Math.abs(o - v.A.o) : 0)) });
  if (o <= pos) return done(v.A.c, v.A.e || null);
  for (const r of v.inside){
    const seg = (r.c - prev) * v.k;
    if (o <= pos + seg) return done(prev + (o - pos) / v.k, null);
    pos += seg; n++;
    if (o <= pos + r.r) return done(r.c, r.e);
    pos += r.r; prev = r.c;
  }
  const segB = (v.B.c - prev) * v.k;
  if (o <= pos + segB) return done(prev + (o - pos) / v.k, null);
  return done(v.B.c, v.B.e || null);
}
function chainToOtdr(model, c){
  const v = model.vanos.find(x => c >= x.A.c && c <= x.B.c); if (!v) return null;
  let o = v.A.o + v.A.h, prev = v.A.c;
  for (const r of v.inside){ if (r.c >= c) break; o += (r.c - prev) * v.k + r.r; prev = r.c; }
  return o + (c - prev) * v.k;
}

/* ---------- lectura del archivo .sor (Bellcore SR-4731 versión 2) ---------- */
function parseSor(buf){
  if (buf.byteLength > 25 * 1024 * 1024) throw new Error('El archivo .sor es demasiado grande.');
  const dv = new DataView(buf), u8 = new Uint8Array(buf);
  const need = (p, n) => { if (p < 0 || p + n > u8.length) throw new Error('El archivo .sor está dañado o no es compatible.'); };
  const cstr = p => { let e = p; while (e < u8.length && u8[e] !== 0 && e - p < 400) e++; need(p, e - p + 1); return [String.fromCharCode(...u8.slice(p, e)), e + 1]; };
  let [name, p] = cstr(0);
  if (name !== 'Map') throw new Error('Solo se leen archivos .sor versión 2 (los actuales de EXFO, VIAVI, Yokogawa, Anritsu).');
  need(p, 8); const size = dv.getUint32(p + 2, true), nb = dv.getUint16(p + 6, true); p += 8;
  if (nb > 60) throw new Error('El archivo .sor está dañado.');
  const blocks = {}; let off = size;
  for (let i = 0; i < nb - 1; i++){ let n; [n, p] = cstr(p); need(p, 6); const s = dv.getUint32(p + 2, true); p += 6; blocks[n] = { off, s }; off += s; }
  const start = n => { const b = blocks[n]; if (!b) return null; let o = b.off; const [nm, o2] = cstr(o); return nm === n ? o2 : o; };
  let o = start('FxdParams'); if (o == null) throw new Error('El .sor no tiene parámetros de medición.');
  need(o, 6 + 2 + 8 + 2); o += 6; const wl = dv.getUint16(o, true) / 10; o += 2; o += 8;
  const npw = dv.getUint16(o, true); o += 2; if (npw > 10) throw new Error('El .sor está dañado.');
  need(o, npw * 10 + 4); const pulse = dv.getUint16(o, true); o += npw * 10;
  const ior = dv.getInt32(o, true) / 100000;
  if (!(ior > 1.3 && ior < 1.7)) throw new Error('Índice de refracción inválido en el .sor.');
  o = start('KeyEvents'); if (o == null) throw new Error('El .sor no tiene tabla de eventos.');
  need(o, 2); const ne = dv.getUint16(o, true); o += 2; if (ne > 2000) throw new Error('El .sor está dañado.');
  const c = 299792458, events = [];
  for (let i = 0; i < ne; i++){
    need(o, 42); const n = dv.getUint16(o, true), tt = dv.getInt32(o + 2, true), loss = dv.getInt16(o + 8, true) / 1000, rl = dv.getInt32(o + 10, true);
    const type = String.fromCharCode(...u8.slice(o + 14, o + 22)); o += 42; let com; [com, o] = cstr(o);
    events.push({ n, m: tt * 1e-10 * c / ior, loss, refl: rl ? -Math.abs(rl) / 1000 : null, end: type[1] === 'E', reflective: type[0] === '1', comment: com.trim().slice(0, 80) });
  }
  let label = ''; const g = start('GenParams'); if (g != null){ try { let q = g + 2, t; [t, q] = cstr(q); [label] = cstr(q); } catch {} }
  return { wl, pulse, ior, events, label: label.trim().slice(0, 80) };
}

function kindOf(name, folder){
  const n = norm(name), f = norm(folder || '').split(' / ').pop() || '';
  if (/^vanos?$|^linea vano|^progresiva/.test(f)) return null;          // etiquetas: no son elementos
  if (/ganancia|cruz/.test(f) || /cruz|ganancia/.test(n)) return 'cruz';
  if (/reserva|rulo/.test(f) || /reserva|rulo/.test(n)) return 'reserva';
  if (/caja|empalme|botella/.test(f) || /botella|empalme|caja de empalme/.test(n)) return 'botella';
  if (/^nodo|^epi|shelter/.test(f) || /^epi|^nodo|shelter/.test(n)) return 'epi';
  if (/^dc$|data ?center|central|^cpd/.test(n)) return 'dc';
  if (/camara/.test(f) || /camara/.test(n)) return 'camara';
  if (/poste|mensula|columna/.test(f) || /poste|mensula|luminaria|columna/.test(n)) return 'poste';
  return 'otro';
}

/* =====================================================================
   PANTALLAS
   ===================================================================== */
const FR_COLS = 'id,name,traza,end_a,end_b,cable,optical_length_m,route_length_m,reserve_m,threshold_db,ior,notes,updated_at';
async function viewTools(v){
  const cf = typeof can !== 'function' || can('fibra'), cd = typeof can !== 'function' || can('dc'), ch = typeof can !== 'function' || can('horas'), cv = typeof can === 'function' && (can('veh') || can('veh_inf'));
  const routes = cf ? await cached('fr-list', () => sb.from('fiber_routes').select(FR_COLS).order('name')) : [];
  const manage = isManager() && canWrite() && online();
  const groups = new Map(); routes.forEach(r => { const k = r.traza || 'Sin traza'; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); });
  const keys = [...groups.keys()].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
  v.innerHTML = `
    <div class="card"><h2 style="margin:0">🧰 Herramientas</h2><p class="muted sm" style="margin:6px 0 0">Funcionan también sin señal con lo que ya está descargado en el teléfono.</p></div>
    ${isManager() ? `<div class="card" id="tool-donde" style="cursor:pointer;border:2px solid #0F2A4A"><div class="row between"><div class="row" style="gap:14px;flex-wrap:nowrap"><div style="font-size:34px;line-height:1">📍</div><div><h2 style="margin:0">¿Dónde está cada uno?</h2>
      <p class="muted sm" style="margin:4px 0 0">Mapa con cada técnico y contratista sobre la localidad de su tarea: hoy, mañana o la semana. Para repartir mejor las tareas.</p></div></div><span class="btn" style="pointer-events:none">Abrir →</span></div></div>` : ''}
    <div class="card" id="tool-shirt" style="cursor:pointer"><div class="row between"><div class="row" style="gap:14px;flex-wrap:nowrap"><div style="font-size:34px;line-height:1">👕</div><div><h2 style="margin:0">Mi camiseta</h2>
      <p class="muted sm" style="margin:4px 0 0">Elegí los colores de tu club para tu muñequito en el mapa.</p></div></div><span class="btn sec" style="pointer-events:none">Elegir →</span></div></div>
    ${cv ? `<div class="card" id="tool-veh" style="cursor:pointer;border:2px solid #2A78D6"><div class="row between"><div class="row" style="gap:14px;flex-wrap:nowrap"><div style="font-size:34px;line-height:1">🚗</div><div><h2 style="margin:0">Control de vehículos</h2>
      <p class="muted sm" style="margin:4px 0 0">Jornada con km y foto del odómetro, cambio de conductor, flota con vencimientos e infracciones.</p></div></div><span class="btn" style="pointer-events:none">Abrir →</span></div></div>` : ''}
    ${cd ? `<div class="card" id="tool-dc" style="cursor:pointer;background:linear-gradient(135deg,#0F2A4A,#1A3A6B);color:#fff;border:0"><div class="row between"><div class="row" style="gap:14px;flex-wrap:nowrap"><div style="font-size:34px;line-height:1">🗄️</div><div><h2 style="margin:0;color:#fff">Relevamiento DC</h2>
      <p class="sm" style="margin:4px 0 0;opacity:.85">Data centers: plano de la sala, racks, equipos, paneles y cableado con el recorrido punta a punta. Energía, carriers, IP/VLAN y etiquetas QR. Funciona sin señal.</p></div></div><span class="btn" style="pointer-events:none">Abrir →</span></div></div>` : ''}
    ${ch ? `<div class="card" id="tool-hh" style="cursor:pointer;border:2px solid var(--green)"><div class="row between"><div class="row" style="gap:14px;flex-wrap:nowrap"><div style="font-size:34px;line-height:1">⏱️</div><div><h2 style="margin:0">Validación de horas y tareas</h2>
      <p class="muted sm" style="margin:4px 0 0">Tarea del día, pedido y validación de horas extra y de viaje, avisos por WhatsApp, guardias y reporte para Recursos Humanos.</p><div id="tool-hh-c" style="margin-top:6px"></div></div></div><span class="btn" style="pointer-events:none">Abrir →</span></div></div>` : ''}
    ${cf ? `<div class="card"><div class="row between"><div><h2 style="margin:0">Fibra óptica: tramos, validación con .sor y ubicación de eventos</h2>
      <p class="muted sm" style="margin:4px 0 0">Cada tramo va de un Sitio A a un Sitio B. Se carga con su KMZ y se valida con el .sor, que es la referencia: la app marca qué cajas coinciden, cuáles están corridas y cuáles faltan, y los técnicos corrigen la posición en el lugar.</p></div>
      ${manage ? '<button class="btn" id="fr-new">+ Tramo</button>' : ''}</div>
      ${routes.length ? keys.map(k => `<h3 style="margin:16px 0 4px">${esc(k)}</h3><div class="tblwrap"><table class="tbl"><tbody>
        ${groups.get(k).map(r => `<tr class="click" data-fr="${r.id}"><td><b>${esc(r.end_a || 'A')} → ${esc(r.end_b || 'B')}</b><div class="muted sm">${esc(r.name)}${r.cable ? ' · ' + esc(r.cable) : ''}</div></td>
          <td class="num sm">${r.optical_length_m ? 'Fibra ' + (r.optical_length_m / 1000).toFixed(3).replace('.', ',') + ' km' : '<span class="muted">sin .sor</span>'}<div class="muted">recorrido ${r.route_length_m ? (r.route_length_m / 1000).toFixed(2).replace('.', ',') + ' km' : '—'}</div></td><td style="width:20px">›</td></tr>`).join('')}
      </tbody></table></div>`).join('') : `<p class="muted" style="margin-top:12px">${manage ? 'Todavía no hay tramos. Cargá el primero con <b>+ Tramo</b>.' : 'Todavía no hay tramos cargados.'}</p>`}</div>` : ''}`;
  v.querySelectorAll('[data-fr]').forEach(tr => tr.onclick = () => location.hash = '#/tools/' + tr.dataset.fr);
  $('#tool-dc')?.addEventListener('click', () => { location.hash = '#/tools/dc'; });
  $('#tool-hh')?.addEventListener('click', () => { location.hash = '#/tools/hh'; });
  $('#tool-veh')?.addEventListener('click', () => { location.hash = '#/tools/veh'; });
  $('#tool-donde')?.addEventListener('click', () => { location.hash = '#/tools/donde'; });
  $('#tool-shirt')?.addEventListener('click', () => { location.hash = '#/tools/camiseta'; });
  if (typeof hhToolCount === 'function') hhToolCount($('#tool-hh-c'));
  $('#fr-new')?.addEventListener('click', () => newRouteModal(routes));
  fiberFlush();
}

/* ---------- lectura de varios .sor con su sentido ---------- */
const sorGuessDir = (fname, a, b) => {
  const f = norm(fname).replace(/[^a-z0-9 ]/g, ' '), k = x => norm(x).replace(/^epi\s*-?\s*/, '').slice(0, 5);
  const ia = a ? f.indexOf(k(a)) : -1, ib = b ? f.indexOf(k(b)) : -1;
  if (ia >= 0 && ib >= 0) return ia < ib ? 'AB' : 'BA';
  if (ia >= 0) return 'AB'; if (ib >= 0) return 'BA'; return null;
};
function sorPanel(box, getNames, onChange){
  const files = [];
  const draw = () => {
    box.innerHTML = files.length ? `<div class="tblwrap"><table class="tbl"><thead><tr><th>Archivo .sor</th><th>Sentido</th><th class="num">Fin de fibra</th><th class="num">Empalmes</th><th></th></tr></thead><tbody>
      ${files.map((f, i) => `<tr><td class="sm">${esc(f.name)}<div class="muted">${f.wl} nm · ${f.pulse} ns</div></td>
        <td><select data-sd="${i}" style="width:auto;padding:6px"><option value="AB" ${f.dir === 'AB' ? 'selected' : ''}>${esc(getNames().a || 'A')} → ${esc(getNames().b || 'B')}</option><option value="BA" ${f.dir === 'BA' ? 'selected' : ''}>${esc(getNames().b || 'B')} → ${esc(getNames().a || 'A')}</option></select></td>
        <td class="num sm">${f.end ? fmtM(f.end - f.launch) : '<span style="color:var(--amber)">sin fin (¿cortada?)</span>'}</td><td class="num">${f.events.filter(x => !x.end && x.m - f.launch > 30).length}</td>
        <td><button class="iconbtn" data-sx="${i}" type="button" title="Quitar">✕</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="muted sm" style="margin:4px 0">Subí uno o dos .sor del tramo (ideal: uno de cada punta).</p>';
    box.querySelectorAll('[data-sd]').forEach(x => x.onchange = () => { files[x.dataset.sd].dir = x.value; onChange(); });
    box.querySelectorAll('[data-sx]').forEach(x => x.onclick = () => { files.splice(Number(x.dataset.sx), 1); draw(); onChange(); });
  };
  return {
    files, draw,
    async add(fileList, launch){
      for (const f of [...fileList].slice(0, 6)){
        try { const r = parseSor(await f.arrayBuffer()); const endEv = r.events.find(x => x.end);
          const n = getNames(); files.push({ name: f.name.slice(0, 120), wl: r.wl, pulse: r.pulse, ior: r.ior, events: r.events, end: endEv ? endEv.m : null, launch, dir: sorGuessDir(f.name, n.a, n.b) || (files.some(x => x.dir === 'AB') && !files.some(x => x.dir === 'BA') ? 'BA' : 'AB') }); }
        catch (x){ toast(f.name + ': ' + errText(x)); }
      }
      draw(); onChange();
    },
    setLaunch(l){ files.forEach(f => f.launch = l); draw(); onChange(); },
    combined(){ return files.length ? combineSors(files.map(f => ({ ...f, end: f.end ? f.end - f.launch : null }))) : null; },
    meta(){ return files.map(f => ({ name: f.name, dir: f.dir, launch: f.launch, end: f.end ? Math.round((f.end - f.launch) * 10) / 10 : null, wl: f.wl, pulse: f.pulse, events: f.events.filter(x => !x.end).length })); },
  };
}
const valTxt = { coincide: '🟢 Coincide', desplazada: '🟡 Fuera del margen', falta: '🔴 Falta en el KMZ', a_confirmar: '❔ A confirmar', confirmada: '✅ Confirmada en campo' };

/* ---------- alta de tramo: KMZ + Sitio A / Sitio B + .sor ---------- */
function newRouteModal(existing){
  if (!needOnline()) return;
  let kmz = null, built = null, exported = null;
  const trazas = [...new Set((existing || []).map(r => r.traza).filter(Boolean))];
  const m = modal(`<h2>Nuevo tramo de fibra</h2>
    <div class="row"><div class="grow"><label>Traza</label><input id="nr-tz" maxlength="120" list="nr-tzl" placeholder="Ej.: Traza 4"><datalist id="nr-tzl">${trazas.map(t => `<option value="${esc(t)}">`).join('')}</datalist></div>
      <div class="grow"><label>Nombre del tramo (opcional)</label><input id="nr-n" maxlength="200" placeholder="Se arma con Sitio A → Sitio B"></div></div>
    <label>KMZ / KML del tramo</label><input type="file" id="nr-k" accept=".kmz,.kml">
    <div id="nr-info" class="sm" style="margin-top:8px"></div>
    <div id="nr-more" class="hidden">
      <div class="row" style="align-items:flex-start">
        <div class="grow"><label>Sitio A</label><select id="nr-as"></select><input id="nr-an" maxlength="120" placeholder="Nombre del Sitio A" style="margin-top:6px"><input id="nr-ac" class="hidden" placeholder="Coordenadas: -31.4110, -60.7460" style="margin-top:6px"></div>
        <div class="grow"><label>Sitio B</label><select id="nr-bs"></select><input id="nr-bn" maxlength="120" placeholder="Nombre del Sitio B" style="margin-top:6px"><input id="nr-bc" class="hidden" placeholder="Coordenadas: -31.2705, -60.7622" style="margin-top:6px"></div></div>
      <label>Mediciones .sor del tramo (la referencia)</label>
      <div class="row"><label class="btn sec small" style="margin:0">Agregar .sor<input type="file" id="nr-s" accept=".sor" multiple class="hidden"></label>
        <label style="display:flex;gap:6px;align-items:center;margin:0;font-weight:400"><input type="checkbox" id="nr-bob" style="width:auto"> Con bobina de lanzamiento</label>
        <input id="nr-bl" type="number" min="0" value="1000" style="width:100px" class="hidden" title="Largo de la bobina (m)"></div>
      <div id="nr-sor"></div>
      <div class="row"><div class="grow"><label>Longitud óptica del tramo (m)</label><input id="nr-l" type="number" min="0" step="0.1" placeholder="Sale del .sor; si no hay o está cortado, cargala a mano"></div>
        <div style="width:150px"><label>Reserva por caja / cruz (m)</label><input id="nr-r" type="number" min="0" value="30"></div>
        <div style="width:130px"><label>Umbral empalme (dB)</label><input id="nr-t" type="number" min="0" step="0.01" value="0.10"></div>
        <div style="width:120px"><label>Cable</label><input id="nr-c" maxlength="120" placeholder="96FO"></div></div>
    </div>
    <div id="nr-val" class="sm" style="margin-top:10px"></div>
    <div class="err" id="nr-err"></div>
    <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn sec" id="nr-x2">Cancelar</button><button class="btn" id="nr-go" disabled>Procesar</button></div>`, { wide: true });
  $('#nr-x2').onclick = m.close;
  const reset = () => { built = null; $('#nr-go').textContent = 'Procesar'; $('#nr-val').innerHTML = ''; };
  const names = () => ({ a: $('#nr-an')?.value.trim(), b: $('#nr-bn')?.value.trim() });
  const sor = sorPanel($('#nr-sor'), names, () => { const c = sor.combined(); if (c && c.Lopt) $('#nr-l').value = Math.round(c.Lopt * 10) / 10; reset(); });
  sor.draw();
  const launch = () => $('#nr-bob').checked ? Number($('#nr-bl').value) || 0 : 0;
  $('#nr-bob').onchange = () => { $('#nr-bl').classList.toggle('hidden', !$('#nr-bob').checked); sor.setLaunch(launch()); };
  $('#nr-bl').oninput = () => sor.setLaunch(launch());
  $('#nr-s').onchange = e => sor.add(e.target.files, launch());
  const siteOpts = () => {
    const ends = [];
    kmz.lines.forEach(l => { ends.push({ name: `Inicio de la línea "${l.name}"`, p: l.pts[0] }); ends.push({ name: `Fin de la línea "${l.name}"`, p: l.pts[l.pts.length - 1] }); });
    kmz.sites = [...kmz.nodes, ...ends.slice(0, 20)];
    return kmz.sites.map((x, i) => `<option value="${i}">${esc(x.name)}</option>`).join('') + '<option value="coord">Otro punto: ingresar coordenadas…</option>';
  };
  const bindSite = (sel, nm, co) => { $(sel).onchange = () => { const v = $(sel).value; $(co).classList.toggle('hidden', v !== 'coord'); if (v !== 'coord'){ const x = kmz.sites[Number(v)]; $(nm).value = (x.short || x.name).slice(0, 120); } reset(); sor.draw(); }; $(nm).oninput = () => sor.draw(); $(co).oninput = reset; };
  $('#nr-k').onchange = async e => {
    $('#nr-err').textContent = ''; kmz = null; exported = null; reset(); $('#nr-go').disabled = true;
    try {
      const txt = await readKML(e.target.files[0]);
      exported = /Exportado de InspectApp/i.test(txt.slice(0, 5000)) ? ((/<Document>\s*<name>([^<]{0,300})<\/name>/i.exec(txt.slice(0, 5000)) || [])[1] || 'otro tramo').replace(/&amp;/g, '&').replace(/ · actualizado.*$/, '') : null;
      const pms = parseKML(txt);
      const isVano = x => /vano/i.test(x.name || '') || x.path.some(f => /vano/i.test(f));
      const lines = pms.filter(x => !x.isPoint && x.pts.length > 1 && !isVano(x)).map(x => ({ name: (x.name || 'Recorrido').slice(0, 120), pts: x.pts.map(p => [p[0], p[1]]) }));
      const pts = pms.filter(x => x.isPoint && x.pts.length).map(x => ({ name: (x.name || '').trim().slice(0, 200), folder: x.path.join(' / '), p: [x.pts[0][0], x.pts[0][1]] }))
        .map(x => ({ ...x, kind: kindOf(x.name, x.folder) })).filter(x => x.kind);
      if (!lines.length) throw new Error('El KMZ no tiene líneas con el recorrido de la fibra.');
      if (pts.length > 25000) throw new Error('El KMZ tiene demasiados elementos.');
      const nodes = pts.filter(x => x.kind === 'epi' || x.kind === 'dc').map(x => ({ ...x, short: x.name.replace(/^caja de empalme\s*/i, '').replace(/^epi\s*-?\s*/i, '') }));
      // un mismo nodo puede venir como "Nodo" y como "Caja de empalme EPI…": dejar uno por lugar
      const uniq = []; nodes.forEach(n => { if (!uniq.some(u => havm(u.p, n.p) < 30)) uniq.push(n); });
      kmz = { lines, pts, nodes: uniq };
      const cnt = {}; pts.forEach(x => { cnt[x.kind] = (cnt[x.kind] || 0) + 1; });
      $('#nr-info').innerHTML = (exported ? `<div class="banner warn" style="margin:0 0 8px"><span class="dot"></span><div><b>Ojo: este archivo es una exportación de InspectApp del tramo "${esc(exported)}"</b>, no un KMZ original.</div></div>` : '') +
        `<b>KMZ:</b> ${lines.length} línea${lines.length === 1 ? '' : 's'} de recorrido (${lines.map(l => esc(l.name) + ' ' + (cumOf(l.pts).pop() / 1000).toFixed(1).replace('.', ',') + ' km').slice(0, 4).join(' · ')}${lines.length > 4 ? '…' : ''}) · ${Object.entries(cnt).map(([k, n]) => `${n} ${esc(FE_KINDS[k].toLowerCase())}`).join(' · ')}`;
      $('#nr-as').innerHTML = siteOpts(); $('#nr-bs').innerHTML = siteOpts();
      if (kmz.sites.length > 1){ $('#nr-as').value = '0'; $('#nr-bs').value = String(uniq.length > 1 ? uniq.length - 1 : 1); }
      bindSite('#nr-as', '#nr-an', '#nr-ac'); bindSite('#nr-bs', '#nr-bn', '#nr-bc');
      $('#nr-as').onchange(); $('#nr-bs').onchange();
      $('#nr-more').classList.remove('hidden'); $('#nr-go').disabled = false;
    } catch (x){ $('#nr-err').textContent = 'KMZ: ' + errText(x); }
  };
  const siteP = (sel, co) => { const v = $(sel).value; if (v === 'coord'){ const m2 = /(-?\d+(?:[.,]\d+)?)\s*[,; ]\s*(-?\d+(?:[.,]\d+)?)/.exec($(co).value); if (!m2) return null; const la = Number(m2[1].replace(',', '.')), lo = Number(m2[2].replace(',', '.')); return Math.abs(la) <= 90 && Math.abs(lo) <= 180 ? [lo, la] : null; } return kmz.sites[Number(v)]?.p || null; };
  $('#nr-go').onclick = async () => {
    if (!kmz) return;
    if (built) return saveRoute();
    $('#nr-err').textContent = '';
    const A = siteP('#nr-as', '#nr-ac'), B = siteP('#nr-bs', '#nr-bc');
    if (!A || !B) return ($('#nr-err').textContent = 'Indicá Sitio A y Sitio B (si elegís coordenadas, escribilas como -31.4110, -60.7460).');
    if (!names().a || !names().b) return ($('#nr-err').textContent = 'Poné el nombre de Sitio A y Sitio B.');
    if (havm(A, B) < 50) return ($('#nr-err').textContent = 'Sitio A y Sitio B son el mismo punto.');
    $('#nr-go').disabled = true; $('#nr-go').textContent = 'Calculando…';
    await new Promise(r => setTimeout(r, 30));
    const pr = pathAtoB(kmz.lines, A, B);
    $('#nr-go').disabled = false; $('#nr-go').textContent = 'Procesar';
    if (!pr || pr.path.length < 2) return ($('#nr-err').textContent = 'No encontré un recorrido que una Sitio A con Sitio B en las líneas del KMZ.');
    const cum = cumOf(pr.path), L = cum[cum.length - 1];
    const R = Number($('#nr-r').value) || 0;
    // elementos del tramo: cerca del recorrido entre A y B
    const els = [];
    for (const x of kmz.pts){
      const q = projectOn(pr.path, cum, x.p); const lim = ['botella', 'epi', 'dc'].includes(x.kind) ? 300 : 150;
      if (q.off > lim || q.chain < -50 || q.chain > L + 50) continue;
      if (q.chain <= 0.5 && havm(x.p, pr.path[0]) > lim) continue;
      if (q.chain >= L - 0.5 && havm(x.p, pr.path[pr.path.length - 1]) > lim) continue;
      els.push({ id: uid(), kind: x.kind, name: x.name || FE_KINDS[x.kind], subtype: x.name.slice(0, 120), lat: x.p[1], lng: x.p[0], chain_m: Math.round(q.chain * 10) / 10, reserve_m: RES_KINDS.includes(x.kind) ? R : null, status: 'kmz' });
    }
    const comb = sor.combined();
    const Lopt = Number($('#nr-l').value) || (comb && comb.Lopt) || null;
    const tmpRoute = { route_length_m: L, reserve_m: R, splices: comb ? comb.splices : [], optical_length_m: Lopt, end_a: names().a, end_b: names().b };
    const val = validateRoute(tmpRoute, els);
    const model = fiberModel(tmpRoute, els, [], val);
    const faltan = [];
    for (const p of val.pairs) if (p.status === 'falta'){ const r = otdrToChain(model, p.s.a); if (!r) continue; const ll = pointAt(pr.path, cum, r.chain);
      faltan.push({ id: uid(), kind: 'botella', name: `Empalme ${p.s.n} (a confirmar)`, subtype: 'Caja de empalme', lat: ll[1], lng: ll[0], chain_m: Math.round(r.chain * 10) / 10, reserve_m: R, splice_no: p.s.n, status: 'aproximado', est: r }); }
    const cnt = st => val.pairs.filter(p => p.status === st).length;
    const resN = els.filter(e => RES_KINDS.includes(e.kind)).length;
    built = { A, B, pr, L, R, els: els.concat(faltan), comb, Lopt, val };
    $('#nr-val').innerHTML = `<div class="stats">
      <div class="stat"><span>Recorrido ${esc(names().a)} → ${esc(names().b)}</span><b>${(L / 1000).toFixed(3).replace('.', ',')} km</b><small>${els.length} elementos del KMZ en el tramo</small></div>
      <div class="stat"><span>Fibra (.sor)</span><b>${Lopt ? (Lopt / 1000).toFixed(3).replace('.', ',') + ' km' : '—'}</b><small>${Lopt ? `recorrido + reservas = ${((L + resN * R) / 1000).toFixed(3).replace('.', ',')} km` : 'sin longitud: cargala a mano'}</small></div>
      ${comb ? `<div class="stat"><span>Empalmes en el .sor</span><b>${comb.splices.length}</b><small>${comb.splices.filter(s => s.seen === 'AB/BA').length} vistos desde las dos puntas</small></div>
      <div class="stat"><span>Contra el KMZ</span><b style="font-size:16px">🟢 ${cnt('coincide')} · 🟡 ${cnt('desplazada')} · 🔴 ${cnt('falta')}</b><small>${val.orphans.length} cajas del KMZ sin evento en el .sor</small></div>` : ''}</div>
      ${pr.offA > 100 || pr.offB > 100 ? `<p style="color:var(--amber)">Sitio ${pr.offA > 100 ? 'A' : 'B'} queda a ${Math.round(Math.max(pr.offA, pr.offB))} m de la línea del recorrido: revisá que sea el punto correcto.</p>` : ''}
      ${!comb ? '<p class="muted">Sin .sor no se puede validar el KMZ. Podés guardar el tramo igual y validarlo después desde el tramo.</p>' : ''}
      ${faltan.length ? `<p>Los ${faltan.length} empalmes que el .sor muestra y el KMZ no tiene se crean como cajas <b>"a confirmar"</b> en su posición estimada, para que los técnicos las ubiquen en el lugar.</p>` : ''}`;
    $('#nr-go').textContent = 'Guardar tramo';
  };
  const saveRoute = async () => {
    if (exported && !confirm(`Este KMZ fue exportado por InspectApp desde el tramo "${exported}".\n\n¿Seguro que corresponde a este tramo?`)) return;
    const a = names().a, b = names().b;
    const dup = (existing || []).find(r => norm(r.end_a) === norm(a) && norm(r.end_b) === norm(b) || norm(r.end_a) === norm(b) && norm(r.end_b) === norm(a));
    if (dup && !confirm(`Ya existe el tramo "${dup.end_a} → ${dup.end_b}" (${dup.name}). ¿Crear otro igual?`)) return;
    $('#nr-go').disabled = true; $('#nr-go').textContent = 'Guardando…';
    const traza = $('#nr-tz').value.trim().slice(0, 120) || null;
    const name = ($('#nr-n').value.trim() || `${traza ? traza + ' · ' : ''}${a} → ${b}`).slice(0, 200);
    const row = { org_id: me.org_id, name, traza, end_a: a.slice(0, 120), end_b: b.slice(0, 120), site_a: { name: a, lat: built.A[1], lng: built.A[0] }, site_b: { name: b, lat: built.B[1], lng: built.B[0] },
      cable: $('#nr-c').value.trim() || null, optical_length_m: built.Lopt ? Math.round(built.Lopt * 10) / 10 : null, route_length_m: Math.round(built.L), path: built.pr.path,
      splices: built.comb ? built.comb.splices.map(({ vals, ...x }) => x) : [], sor_meta: sor.meta(), reserve_m: built.R, threshold_db: Number($('#nr-t').value) || 0.1, created_by: me.id };
    const { data, error } = await sb.from('fiber_routes').insert(row).select('id').single();
    if (error){ $('#nr-go').disabled = false; $('#nr-go').textContent = 'Guardar tramo'; return ($('#nr-err').textContent = /duplicate|unique/i.test(error.message) ? 'Ya existe un tramo con ese nombre: cambiá el nombre.' : errText(error)); }
    const rows = built.els.map(e => ({ id: e.id, org_id: me.org_id, route_id: data.id, kind: e.kind, name: e.name, subtype: e.subtype, lat: e.lat, lng: e.lng, chain_m: e.chain_m, reserve_m: e.reserve_m, splice_no: e.splice_no || null, status: e.status }));
    for (let i = 0; i < rows.length; i += 500){
      $('#nr-go').textContent = `Guardando ${Math.min(i + 500, rows.length)} de ${rows.length}…`;
      const { error: e2 } = await sb.from('fiber_elements').insert(rows.slice(i, i + 500));
      if (e2){ $('#nr-err').textContent = errText(e2); await sb.from('fiber_routes').delete().eq('id', data.id); $('#nr-go').disabled = false; $('#nr-go').textContent = 'Reintentar'; return; }
    }
    m.close(); toast('Tramo cargado'); try { await IDB.del('kv', CUR_UID + ':fr-list'); } catch {} location.hash = '#/tools/' + data.id;
  };
}

/* ---------- validar de nuevo un tramo con otros .sor ---------- */
function revalidateModal(ctx){
  if (!needOnline()) return;
  const { route } = ctx;
  const m = modal(`<h2>Validar con .sor</h2><p class="muted sm" style="margin-top:-6px">${esc(route.end_a)} → ${esc(route.end_b)}. Los empalmes de estos .sor pasan a ser la referencia del tramo.</p>
    <div class="row"><label class="btn sec small" style="margin:0">Agregar .sor<input type="file" id="rv-s" accept=".sor" multiple class="hidden"></label>
      <label style="display:flex;gap:6px;align-items:center;margin:0;font-weight:400"><input type="checkbox" id="rv-bob" style="width:auto"> Con bobina</label><input id="rv-bl" type="number" min="0" value="1000" style="width:100px" class="hidden"></div>
    <div id="rv-sor"></div>
    <label>Longitud óptica (m)</label><input id="rv-l" type="number" min="0" step="0.1" value="${route.optical_length_m ?? ''}">
    <div id="rv-res" class="sm"></div><div class="err" id="rv-err"></div>
    <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn sec" id="rv-x">Cancelar</button><button class="btn" id="rv-ok" disabled>Guardar validación</button></div>`, { wide: true });
  $('#rv-x').onclick = m.close;
  const launch = () => $('#rv-bob').checked ? Number($('#rv-bl').value) || 0 : 0;
  const sor = sorPanel($('#rv-sor'), () => ({ a: route.end_a, b: route.end_b }), () => {
    const c = sor.combined(); $('#rv-ok').disabled = !c;
    if (c && c.Lopt) $('#rv-l').value = Math.round(c.Lopt * 10) / 10;
    $('#rv-res').innerHTML = c ? `${c.splices.length} empalmes (${c.splices.filter(s => s.seen === 'AB/BA').length} vistos desde las dos puntas)${c.Lopt ? ` · fibra ${fmtM(c.Lopt)}` : ''}` : '';
  });
  sor.draw();
  $('#rv-bob').onchange = () => { $('#rv-bl').classList.toggle('hidden', !$('#rv-bob').checked); sor.setLaunch(launch()); };
  $('#rv-bl').oninput = () => sor.setLaunch(launch());
  $('#rv-s').onchange = e => sor.add(e.target.files, launch());
  $('#rv-ok').onclick = async () => {
    const c = sor.combined(); if (!c) return;
    const nl = Number($('#rv-l').value) || c.Lopt || null, ol = Number(route.optical_length_m) || null;
    if (ol && nl && Math.abs(nl - ol) > 1 && !confirm(`La longitud óptica del tramo cambia de ${fmtM(ol)} a ${fmtM(nl)}. ¿Confirmar?`)) return;
    $('#rv-ok').disabled = true;
    // las cajas "a confirmar" que nunca se tocaron se recalculan con los nuevos .sor
    const stale = ctx.elements.filter(e => e.status === 'aproximado' && !(e.history || []).length).map(e => e.id);
    const { error } = await sb.from('fiber_routes').update({ splices: c.splices.map(({ vals, ...x }) => x), optical_length_m: nl, sor_meta: sor.meta() }).eq('id', route.id);
    if (error){ $('#rv-ok').disabled = false; return ($('#rv-err').textContent = errText(error)); }
    if (stale.length) await sb.from('fiber_elements').delete().in('id', stale);
    // las cajas confirmadas en campo se vuelven a emparejar con los empalmes nuevos
    await sb.from('fiber_elements').update({ splice_no: null }).eq('route_id', route.id).eq('status', 'actualizado').not('splice_no', 'is', null);
    const keep = ctx.elements.filter(e => !stale.includes(e.id)).map(e => ({ ...e, splice_no: e.status === 'actualizado' ? null : e.splice_no }));
    const r2 = { ...route, splices: c.splices, optical_length_m: nl };
    const val = validateRoute(r2, keep), model = fiberModel(r2, keep, [], val);
    const rows = [];
    for (const p of val.pairs) if (p.status === 'falta'){ const r = otdrToChain(model, p.s.a); if (!r) continue; const ll = pointAt(ctx.path, ctx.cum, r.chain);
      rows.push({ org_id: me.org_id, route_id: route.id, kind: 'botella', name: `Empalme ${p.s.n} (a confirmar)`, subtype: 'Caja de empalme', lat: ll[1], lng: ll[0], chain_m: Math.round(r.chain * 10) / 10, reserve_m: route.reserve_m, splice_no: p.s.n, status: 'aproximado' }); }
    if (rows.length){ const { error: e3 } = await sb.from('fiber_elements').insert(rows); if (e3) return ($('#rv-err').textContent = errText(e3)); }
    m.close(); toast('Validación guardada'); await IDB.del('kv', CUR_UID + ':fe:' + route.id).catch(() => {}); await IDB.del('kv', CUR_UID + ':fr:' + route.id).catch(() => {}); route_();
  };
}

let FSTATE = {};
async function viewFiberRoute(v, id){
  const route = await cached('fr:' + id, () => sb.from('fiber_routes').select('*').eq('id', id).single());
  let elements = await cached('fe:' + id, () => pageAll(() => sb.from('fiber_elements').select('*').eq('route_id', id).order('chain_m').order('id'), 30000));
  let events = []; try { events = await cached('fev:' + id, () => sb.from('fiber_events').select('*').eq('route_id', id).order('created_at', { ascending: false }).limit(200)); } catch {}
  elements = applyQueued(id, elements);
  const path = route.path || [], cum = cumOf(path);
  route.route_length_m = route.route_length_m || cum[cum.length - 1];
  const Lopt = Number(route.optical_length_m) || null;
  events.forEach(ev => { ev.otdr_a = ev.from_end === 'B' && Lopt ? Lopt - (ev.otdr_m - ev.launch_m) : ev.otdr_m - ev.launch_m; if (ev.real_lat != null) ev.chain_real = projectOn(path, cum, [ev.real_lng, ev.real_lat]).chain; });
  const val = validateRoute(route, elements);
  const model = fiberModel(route, elements, events, val);
  const pairOf = new Map(val.pairs.filter(p => p.e).map(p => [p.e.id, p]));
  const ctx = { route, elements, events, path, cum, model, val, pairOf };
  const thr = Number(route.threshold_db || 0.1);
  const splices = route.splices || [];
  const badSp = splices.filter(s => s.worst != null && s.worst > thr);
  const manage = isManager() && canWrite();
  let saved = {}; try { saved = JSON.parse(localStorage.getItem('ia_fiber') || '{}'); } catch {}
  FSTATE = { launch: saved.launch ?? 0, launchLen: saved.launchLen ?? 1000, unit: saved.unit || 'm', from: 'A', mode: 'otdr', layers: saved.layers || { botella: true, cruz: true, poste: true, camara: true, eventos: true } };
  v.innerHTML = `
    <div class="card"><div class="row between"><div class="row"><button class="btn sec small" data-go="#/tools">← Herramientas</button>
      <div><h1 style="margin:0">${esc(route.end_a || 'A')} → ${esc(route.end_b || 'B')}</h1><div class="muted sm">${route.traza ? esc(route.traza) + ' · ' : ''}${esc(route.name)} · recorrido ${(route.route_length_m / 1000).toFixed(2).replace('.', ',')} km${Lopt ? ` · fibra ${(Lopt / 1000).toFixed(3).replace('.', ',')} km` : ''}${route.cable ? ' · ' + esc(route.cable) : ''}</div></div></div>
      <div class="row"><button class="btn sec small" id="fr-kmz">Exportar KMZ</button>${manage && online() ? '<button class="btn sec small" id="fr-edit">Editar tramo</button>' : ''}</div></div>
      <div class="stats" style="margin-top:12px">
        <div class="stat"><span>Empalmes (.sor)</span><b>${splices.length || '—'}</b><small>${splices.length ? `${splices.filter(s => s.avg != null && s.avg > thr).length} sobre ${String(thr).replace('.', ',')} dB` : 'sin .sor: validalo'}</small></div>
        <div class="stat"><span>KMZ contra .sor</span><b style="font-size:16px">${splices.length ? `🟢 ${val.pairs.filter(p => p.status === 'coincide' || p.status === 'confirmada').length} · 🟡 ${val.pairs.filter(p => p.status === 'desplazada').length} · 🔴 ${val.pairs.filter(p => p.status === 'falta' || p.status === 'a_confirmar').length}` : '—'}</b><small>${val.orphans.length} cajas sin evento</small></div>
        <div class="stat"><span>Botellas</span><b>${elements.filter(e => e.kind === 'botella').length}</b><small>${elements.filter(e => e.status === 'aproximado').length} a confirmar · ${elements.filter(e => e.status === 'actualizado').length} actualizadas</small></div>
        <div class="stat"><span>Cruces y reservas</span><b>${elements.filter(e => e.kind === 'cruz' || e.kind === 'reserva').length}</b><small>${route.reserve_m} m c/u (editable)</small></div>
        <div class="stat"><span>Eventos ubicados</span><b>${events.length}</b><small>${events.filter(e => e.real_lat != null).length} con ubicación real</small></div>
      </div></div>
    <div class="card" id="fl-val"></div>
    <div class="card" id="fl-card"><h2>Ubicar un evento</h2>
      <div class="seg" id="fl-mode" style="max-width:520px"><button type="button" data-m="otdr" class="on">Distancia OTDR (fibra)</button><button type="button" data-m="ruta">Distancia sobre el recorrido</button></div>
      <div class="row" style="align-items:flex-end">
        <div style="width:170px"><label>Distancia</label><div class="row" style="flex-wrap:nowrap;gap:4px"><input id="fl-d" type="number" min="0" step="any" inputmode="decimal" placeholder="15696"><select id="fl-u" style="width:70px"><option value="m">m</option><option value="km">km</option></select></div></div>
        <div style="min-width:170px"><label>Medido desde</label><select id="fl-f"><option value="A">${esc(route.end_a || 'Sitio A')} (A)</option><option value="B">${esc(route.end_b || 'Sitio B')} (B)</option></select></div>
        <div class="fl-otdr" style="min-width:150px"><label>Bobina de lanzamiento</label><select id="fl-b"><option value="0">Sin bobina</option><option value="1">Con bobina</option></select></div>
        <div class="fl-otdr ${FSTATE.launch ? '' : 'hidden'}" id="fl-bl-w" style="width:120px"><label>Largo bobina (m)</label><input id="fl-bl" type="number" min="0" value="${Number(FSTATE.launchLen)}"></div>
        <button class="btn" id="fl-go">Ubicar</button>
        <label class="btn sec fl-otdr" style="margin:0">Subir .sor<input type="file" id="fl-sor" accept=".sor" class="hidden"></label>
      </div>
      <div id="fl-sorbox"></div><div id="fl-res"></div></div>
    <div class="card" style="padding:10px"><div class="layerbar" id="fl-layers" style="margin:0 0 8px">${[['botella', 'Botellas'], ['cruz', 'Cruces / reservas'], ['poste', 'Postes'], ['camara', 'Cámaras'], ['eventos', 'Eventos']].map(([k, t]) => `<button type="button" data-ly="${k}" class="${FSTATE.layers[k] ? 'on' : ''}">${t}</button>`).join('')}</div>
      <div id="fmap"></div>
      <div class="sem-legend"><span><i class="fe-ic fe-bot q-ok"></i>Empalme OK (promedio)</span><span><i class="fe-ic fe-bot q-warn"></i>Cerca del umbral</span><span><i class="fe-ic fe-bot q-bad"></i>Promedio sobre el umbral</span><span><i class="fe-ic fe-bot q-unk">?</i>A confirmar</span><span><i class="fe-ic fe-cruz"></i>Cruz / reserva</span><span><i class="fe-ic fe-epi"></i>EPI / DC</span><span><span class="fe-upd-dot"></span>Actualizado</span></div></div>
    <div class="card" id="fl-events"></div>`;
  $('#fl-b').value = FSTATE.launch ? '1' : '0'; $('#fl-u').value = FSTATE.unit;
  const saveSt = () => { try { localStorage.setItem('ia_fiber', JSON.stringify({ launch: FSTATE.launch, launchLen: FSTATE.launchLen, unit: FSTATE.unit, layers: FSTATE.layers })); } catch {} };
  $('#fl-b').onchange = () => { FSTATE.launch = $('#fl-b').value === '1'; $('#fl-bl-w').classList.toggle('hidden', !FSTATE.launch); saveSt(); };
  $('#fl-bl').oninput = () => { FSTATE.launchLen = Number($('#fl-bl').value) || 0; saveSt(); };
  $('#fl-u').onchange = () => { FSTATE.unit = $('#fl-u').value; saveSt(); };
  $$('#fl-mode [data-m]').forEach(b => b.onclick = () => { FSTATE.mode = b.dataset.m; $$('#fl-mode [data-m]').forEach(x => x.classList.toggle('on', x === b)); $$('.fl-otdr').forEach(x => x.classList.toggle('hidden', FSTATE.mode !== 'otdr' || (x.id === 'fl-bl-w' && !FSTATE.launch))); });

  /* mapa */
  if (fmap){ fmap.remove(); fmap = null; }
  if (!window.L){ $('#fmap').innerHTML = '<p class="muted" style="padding:20px">No se pudo cargar el mapa.</p>'; return; }
  fmap = L.map('fmap', { preferCanvas: true });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(fmap);
  const line = L.polyline(path.map(p => [p[1], p[0]]), { color: '#1A3A6B', weight: 4, opacity: .85 }).addTo(fmap);
  fmap.fitBounds(line.getBounds(), { padding: [20, 20] });
  L.marker([path[0][1], path[0][0]], { icon: L.divIcon({ className: 'mk-wrap', iconSize: [0, 0], html: `<div class="fe-end">A · ${esc(route.end_a || '')}</div>` }) }).addTo(fmap);
  L.marker([path[path.length - 1][1], path[path.length - 1][0]], { icon: L.divIcon({ className: 'mk-wrap', iconSize: [0, 0], html: `<div class="fe-end">B · ${esc(route.end_b || '')}</div>` }) }).addTo(fmap);
  let elLayer = null, evLayer = L.featureGroup().addTo(fmap), resLayer = L.featureGroup().addTo(fmap);
  const spOf = e => ctx.pairOf.get(e.id)?.s || null;
  // color de la botella: promedio de sus fibras contra el umbral (en el detalle se ve la peor fibra)
  const qual = e => { const s = spOf(e); if (!s || s.avg == null) return e.status === 'aproximado' ? 'unk' : 'none'; return s.avg > thr ? 'bad' : s.avg > thr * 0.7 ? 'warn' : 'ok'; };
  const drawElements = () => {
    if (elLayer) elLayer.remove(); elLayer = L.featureGroup().addTo(fmap);
    const z = fmap.getZoom();
    for (const e of ctx.elements){
      if (e.lat == null || e.lat === undefined) continue;
      const lay = e.kind === 'reserva' ? 'cruz' : ['epi', 'dc', 'otro'].includes(e.kind) ? 'botella' : e.kind;
      if (!FSTATE.layers[lay]) continue;
      if (e.kind === 'poste' && z < 15){ continue; }
      let mk;
      if (e.kind === 'poste') mk = L.circleMarker([e.lat, e.lng], { radius: 3, color: '#5B6878', weight: 1, fillColor: '#fff', fillOpacity: 1 });
      else {
        const cls = e.kind === 'botella' ? `fe-bot q-${e.status === 'aproximado' ? 'unk' : qual(e)}` : e.kind === 'cruz' || e.kind === 'reserva' ? 'fe-cruz' : e.kind === 'camara' ? 'fe-cam' : e.kind === 'otro' ? 'fe-otro' : 'fe-epi';
        if (e.kind === 'cruz' && z < 12) continue;
        mk = L.marker([e.lat, e.lng], { icon: L.divIcon({ className: 'mk-wrap', iconSize: [0, 0], html: `<i class="fe-ic ${cls}">${e.status === 'aproximado' ? '?' : ''}</i>${e.status === 'actualizado' ? '<span class="fe-upd-dot fe-upd-abs"></span>' : ''}` }), keyboard: false, zIndexOffset: e.kind === 'botella' ? 500 : 0 });
      }
      mk.bindPopup(() => elementPopup(ctx, e), { maxWidth: 300 }).addTo(elLayer);
    }
  };
  const drawEvents = () => {
    evLayer.clearLayers(); if (!FSTATE.layers.eventos) return;
    for (const ev of ctx.events){ if (ev.lat == null) continue;
      L.marker([ev.lat, ev.lng], { icon: L.divIcon({ className: 'mk-wrap', iconSize: [0, 0], html: `<div class="mk-pin" style="background:#7C3AED;width:20px;height:20px"><b style="font-size:11px">${ev.real_lat != null ? '✓' : '!'}</b></div>` }) })
        .bindPopup(`<b>Evento ${fmtDate(ev.created_at)}</b><br>${(ev.otdr_m / 1000).toFixed(3).replace('.', ',')} km desde ${esc(ev.from_end)}${ev.loss_db != null ? ` · ${esc(ev.loss_db)} dB` : ''}<br>${esc(ev.note || '')}<br><span class="muted">${esc(ev.created_by_name || '')}</span>`).addTo(evLayer);
      if (ev.real_lat != null) L.circleMarker([ev.real_lat, ev.real_lng], { radius: 5, color: '#7C3AED', weight: 2, fillColor: '#fff', fillOpacity: 1 }).bindTooltip('Ubicación real').addTo(evLayer);
    }
  };
  drawElements(); drawEvents();
  fmap.on('zoomend', drawElements);
  fmap.on('popupopen', e => bindElementPopup(ctx, e.popup.getElement()));
  $$('#fl-layers [data-ly]').forEach(b => b.onclick = () => { FSTATE.layers[b.dataset.ly] = !FSTATE.layers[b.dataset.ly]; b.classList.toggle('on'); saveSt(); drawElements(); drawEvents(); });

  /* ubicar */
  const locate = (dist, opts = {}) => {
    resLayer.clearLayers();
    let c, r = null, oA = null;
    const from = $('#fl-f').value;
    if (FSTATE.mode === 'ruta' && !opts.sor){
      c = from === 'A' ? dist : route.route_length_m - dist;
      if (c < 0 || c > route.route_length_m) return toast('La distancia supera el largo del recorrido.');
      r = { chain: c, window: 5, inRes: null };
    } else {
      const launch = FSTATE.launch ? Number(FSTATE.launchLen) || 0 : 0;
      let o = dist - launch;
      if (o < 0) return toast('La distancia es menor que la bobina de lanzamiento.');
      if (from === 'B'){ if (!Lopt) return toast('Para medir desde B hace falta la longitud óptica del tramo (Editar tramo).'); o = Lopt - o; }
      oA = o;
      if (o > model.anchors[model.anchors.length - 1].o + 300) toast('La distancia supera la longitud óptica del tramo: el resultado es aproximado.');
      r = otdrToChain(model, o); if (!r) return toast('No se pudo calcular.');
      c = r.chain;
    }
    const ll = pointAt(path, cum, c);
    const w = Math.max(5, r.window);
    L.polyline(pathBetween(path, cum, Math.max(0, c - w), Math.min(route.route_length_m, c + w)).map(p => [p[1], p[0]]), { color: '#DC2626', weight: 10, opacity: .55 }).addTo(resLayer);
    const pin = L.marker([ll[1], ll[0]], { icon: L.divIcon({ className: 'mk-wrap', iconSize: [0, 0], html: '<div class="mk-pin pulse"><b>!</b></div>' }), zIndexOffset: 2000 }).addTo(resLayer);
    fmap.setView([ll[1], ll[0]], Math.max(fmap.getZoom(), 16));
    const near = ctx.elements.filter(e => e.chain_m != null).map(e => ({ e, d: Number(e.chain_m) - c })).sort((a, b) => Math.abs(a.d) - Math.abs(b.d)).slice(0, 6);
    const v_ = r.v;
    const lat = ll[1].toFixed(6), lng = ll[0].toFixed(6);
    $('#fl-res').innerHTML = `<div class="banner off" style="margin-top:12px"><span class="dot"></span><div class="grow">
      <b>Evento a ${fmtM(dist)}${FSTATE.mode === 'otdr' || opts.sor ? ` de fibra desde ${from === 'A' ? esc(route.end_a || 'A') : esc(route.end_b || 'B')}` : ' de recorrido'}</b>
      <div style="font-size:15px;margin-top:4px">📍 <b>${lat}, ${lng}</b> · zona de búsqueda <b>±${Math.round(w)} m</b> sobre el recorrido</div>
      <div class="sm">A ${fmtM(c)} de recorrido desde ${esc(route.end_a || 'A')} (${fmtM(route.route_length_m - c)} desde ${esc(route.end_b || 'B')})${v_ ? ` · entre ${esc(v_.A.label)} y ${esc(v_.B.label)}` : ''}${r.inRes ? ` · <b>cae en la reserva de ${esc(r.inRes.name || FE_KINDS[r.inRes.kind])}</b>` : ''}${v_ && v_.low ? ' · <span style="color:var(--amber)">vano con datos dudosos: margen ampliado</span>' : ''}${v_ && v_.B.est ? ' · <span style="color:var(--amber)">sin longitud óptica ni empalmes: estimación gruesa</span>' : ''}</div>
      <div class="row" style="margin-top:8px;gap:6px"><a class="btn small" target="_blank" rel="noopener noreferrer" href="${mapsLink(ll[1], ll[0])}">Cómo llegar</a>
        <button class="btn sec small" id="fl-copy">Copiar coordenadas</button>
        ${canWrite() ? '<button class="btn sec small" id="fl-save">Guardar evento</button>' : ''}
        ${isManager() && canWrite() ? '<button class="btn sec small" id="fl-task">Crear correctivo</button>' : ''}</div></div></div>
      <h3 style="margin-top:12px">Lo más cercano</h3>
      ${near.map(x => `<div class="sm" style="padding:3px 0">${esc(FE_KINDS[x.e.kind])}: <b>${esc(x.e.name || '')}</b> — ${fmtM(Math.abs(x.d))} ${x.d < 0 ? 'hacia ' + esc(route.end_a || 'A') : 'hacia ' + esc(route.end_b || 'B')}${x.e.status === 'aproximado' ? ' <span class="pill p-pend">a confirmar</span>' : ''}</div>`).join('')}`;
    $('#fl-copy').onclick = () => navigator.clipboard.writeText(`${lat}, ${lng}`).then(() => toast('Coordenadas copiadas'));
    const evRow = () => ({ org_id: me.org_id, route_id: route.id, from_end: from, otdr_m: Math.round(dist * 10) / 10, launch_m: FSTATE.mode === 'otdr' && FSTATE.launch ? Number(FSTATE.launchLen) || 0 : 0,
      loss_db: opts.loss ?? null, fiber_no: opts.fiber ?? null, chain_m: Math.round(c), lat: ll[1], lng: ll[0], window_m: Math.round(w), created_by: me.id, created_by_name: me.full_name || me.email });
    $('#fl-save')?.addEventListener('click', async () => {
      if (FSTATE.mode === 'ruta' && !opts.sor) return toast('Se guardan los eventos ubicados con distancia OTDR.');
      const note = prompt('Nota del evento (opcional): causa, fibras afectadas…') ?? null;
      const row = { ...evRow(), note: note ? note.slice(0, 1000) : null };
      if (!online()){ await queueFiber({ t: 'event', row }); toast('Guardado en el teléfono: se envía cuando vuelva la señal.'); return; }
      const { error } = await sb.from('fiber_events').insert(row); if (error) return toast(errText(error));
      toast('Evento guardado'); await IDB.del('kv', CUR_UID + ':fev:' + route.id).catch(() => {}); route_();
    });
    $('#fl-task')?.addEventListener('click', async () => {
      const contrs = await loadContractors().catch(() => []);
      editTask(null, contrs, { task_type: 'reparacion', priority: 'critica', is_pending: true, title: `Evento / corte FO — ${route.name}`.slice(0, 300), due_date: addDays(todayStr(), 1),
        sites: [{ site_id: null, site_name: `${route.name} · ${fmtM(c)} desde ${route.end_a || 'A'} (${lat}, ${lng})`.slice(0, 300), inspection_id: null, done: false }],
        description: `Evento OTDR a ${fmtM(dist)} desde ${from === 'A' ? route.end_a : route.end_b}${opts.loss !== undefined ? ` (pérdida ${opts.loss} dB)` : ''}.\nUbicación estimada: ${lat}, ${lng} (±${Math.round(w)} m).\nCómo llegar: https://maps.google.com/?q=${lat},${lng}` });
    });
  };
  $('#fl-go').onclick = () => { const d = Number($('#fl-d').value); if (!(d > 0)) return toast('Ingresá la distancia.'); locate(FSTATE.unit === 'km' ? d * 1000 : d); };
  $('#fl-d').onkeydown = e => { if (e.key === 'Enter') $('#fl-go').click(); };
  $('#fl-sor').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    let sor; try { sor = parseSor(await f.arrayBuffer()); } catch (x){ return toast(errText(x)); }
    const fib = (f.name.match(/(\d+)(?=\D*\.sor$)/i) || [])[1];
    const endEv = sor.events.find(x => x.end);
    $('#fl-sorbox').innerHTML = `<div class="card" style="margin:12px 0 0;background:var(--bg)"><div class="row between"><b>${esc(f.name)}</b><span class="muted sm">${sor.wl} nm · pulso ${sor.pulse} ns · IOR ${sor.ior}${endEv ? ` · fin de fibra ${fmtM(endEv.m)}` : ''}</span></div>
      <p class="sm muted" style="margin:4px 0">Elegí desde qué punta se midió (arriba) y tocá un evento. Los que superan ${String(thr).replace('.', ',')} dB están en rojo.</p>
      <div class="tblwrap" style="max-height:260px;overflow:auto"><table class="tbl"><thead><tr><th>#</th><th class="num">Distancia</th><th class="num">Pérdida</th><th class="hide-sm">Tipo</th><th></th></tr></thead><tbody>
      ${sor.events.map((x, i) => `<tr class="${x.loss > thr ? 'sor-bad' : ''}"><td>${x.n}</td><td class="num">${fmtM(x.m)}</td><td class="num">${x.loss ? x.loss.toFixed(3).replace('.', ',') + ' dB' : '—'}</td><td class="hide-sm sm">${x.end ? 'Fin de fibra' : x.reflective ? 'Reflectivo (conector / corte)' : 'Empalme / curvatura'}${x.comment ? ' · ' + esc(x.comment) : ''}</td>
        <td><button class="btn small ${x.loss > thr || x.end ? '' : 'sec'}" data-sev="${i}">Ubicar</button></td></tr>`).join('')}</tbody></table></div></div>`;
    $('#fl-sorbox').querySelectorAll('[data-sev]').forEach(b => b.onclick = () => { const x = sor.events[Number(b.dataset.sev)]; $('#fl-d').value = Math.round(x.m * 10) / 10; $('#fl-u').value = 'm'; FSTATE.unit = 'm'; locate(x.m, { sor: true, loss: x.loss || null, fiber: fib ? Number(fib) : null }); });
    if (!Lopt && endEv && isManager() && canWrite() && online() && confirm(`Tramo "${route.name}" (${route.end_a || 'A'} → ${route.end_b || 'B'}): no tiene longitud óptica cargada.\n\nEl archivo ${f.name} termina a ${fmtM(endEv.m)}. ¿Guardar ese valor como longitud óptica de ESTE tramo?\n\nSi el .sor es de otro tramo, tocá Cancelar.`)){
      await sb.from('fiber_routes').update({ optical_length_m: Math.round(endEv.m - (FSTATE.launch ? Number(FSTATE.launchLen) || 0 : 0)) }).eq('id', route.id); route_();
    }
  };
  $('#fr-kmz').onclick = () => exportFiberKMZ(ctx);
  $('#fr-edit')?.addEventListener('click', () => editRouteModal(route));
  renderFiberEvents(ctx);
  renderValidation(ctx, (lat, lng) => { fmap.setView([lat, lng], 17); $('#fmap').scrollIntoView({ behavior: 'smooth', block: 'center' }); });
}
const route_ = () => route();
const fmtM = m => m >= 1000 ? (m / 1000).toFixed(3).replace('.', ',') + ' km' : Math.round(m) + ' m';

function elementPopup(ctx, e){
  const { route, model } = ctx, pr = ctx.pairOf?.get(e.id), s = pr ? pr.s : null;
  const oA = e.chain_m != null ? chainToOtdr(model, Number(e.chain_m)) : null, Lopt = Number(route.optical_length_m) || null;
  const last = (e.history || [])[e.history.length - 1];
  return `<div class="pp"><b style="font-size:15px">${esc(e.name || FE_KINDS[e.kind])}</b>
    <div class="muted sm">${esc(FE_KINDS[e.kind])}${e.subtype && e.subtype !== e.name ? ' · ' + esc(e.subtype) : ''} · <span class="pill ${e.status === 'aproximado' ? 'p-pend' : e.status === 'actualizado' ? 'p-ok' : 'p-info'}">${FE_STATUS[e.status]}</span></div>
    ${e.status === 'actualizado' ? `<div class="sm" style="color:var(--green-d)">Actualizado el ${fmtDate(e.updated_at)} por ${esc(e.updated_by || '')}</div>` : ''}
    ${e.status === 'aproximado' ? '<div class="sm" style="color:var(--amber)">Ubicación estimada con el .sor: confirmala en el lugar.</div>' : ''}
    <div class="pp-sec sm">${e.chain_m != null ? `Recorrido: ${fmtM(Number(e.chain_m))} desde ${esc(route.end_a || 'A')}<br>` : ''}
      ${oA != null ? `OTDR esperado: <b>${fmtM(oA)}</b> desde A${Lopt ? ` · <b>${fmtM(Lopt - oA)}</b> desde B` : ''}<br>` : ''}
      ${e.reserve_m != null && e.reserve_m !== undefined ? `Reserva: ${e.reserve_m} m<br>` : ''}
      ${pr ? `<b>${valTxt[pr.status]}</b>${pr.d != null ? ` (${pr.d > 0 ? '+' : ''}${Math.round(pr.d)} m)` : ''}<br>` : ''}${s ? `Empalme ${s.n} del .sor: ${fmtM(s.a)} desde ${esc(route.end_a || 'A')}${s.seen ? ' · visto ' + s.seen : ''}${s.worst != null ? ` · promedio ${s.avg.toFixed(3).replace('.', ',')} dB · peor fibra ${s.worst.toFixed(3).replace('.', ',')} dB · ${(s.vals || []).filter(x => x > Number(route.threshold_db || 0.1)).length} de ${s.fibers} fibras sobre ${String(route.threshold_db || 0.1).replace('.', ',')} dB` : ''}<br>` : ''}
      ${Number(e.lat).toFixed(6)}, ${Number(e.lng).toFixed(6)}${e.notes ? `<br>${esc(e.notes)}` : ''}</div>
    <div class="row" style="margin-top:8px;gap:6px">
      ${canWrite() ? `<button class="btn small" data-feupd="${e.id}">📍 Actualizar ubicación</button><button class="btn sec small" data-fedat="${e.id}">Editar datos</button>` : ''}
      <a class="btn sec small" target="_blank" rel="noopener noreferrer" href="${mapsLink(e.lat, e.lng)}">Cómo llegar</a>
      ${isManager() && canWrite() && last && !last.revertido ? `<button class="btn danger small" data-ferev="${e.id}">Revertir</button>` : ''}</div>
    ${(e.history || []).length ? `<details class="sm" style="margin-top:6px"><summary style="cursor:pointer">Historial (${e.history.length})</summary>${e.history.slice().reverse().map(h => `<div>${fmtDT(h.at)} · ${esc(h.by || '')}${h.revertido ? ' · revertido' : h.nuevo?.lat ? ` · de ${Number(h.lat).toFixed(5)}, ${Number(h.lng).toFixed(5)}${h.nuevo.precision_m ? ` (±${Math.round(h.nuevo.precision_m)} m)` : ''}` : ' · datos'}</div>`).join('')}</details>` : ''}</div>`;
}
function bindElementPopup(ctx, el){
  if (!el) return;
  el.querySelectorAll('[data-feupd]').forEach(b => b.onclick = () => updateElementGPS(ctx, ctx.elements.find(x => x.id === b.dataset.feupd)));
  el.querySelectorAll('[data-fedat]').forEach(b => b.onclick = () => editElementData(ctx, ctx.elements.find(x => x.id === b.dataset.fedat)));
  el.querySelectorAll('[data-ferev]').forEach(b => b.onclick = async () => {
    if (!needOnline() || !confirm('¿Volver a la ubicación y datos anteriores de este elemento?')) return;
    const { error } = await sb.rpc('fiber_revert_element', { p_id: b.dataset.ferev }); if (error) return toast(errText(error));
    toast('Cambio revertido'); await IDB.del('kv', CUR_UID + ':fe:' + ctx.route.id).catch(() => {}); route_();
  });
}

/* ---------- actualizar en campo ---------- */
function getPosAccurate(){
  return new Promise(res => {
    if (!navigator.geolocation) return res(null);
    let best = null, done = false; const t0 = Date.now();
    const id = navigator.geolocation.watchPosition(p => {
      const r = { lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy) };
      if (!best || r.acc < best.acc) best = r;
      if (!done && (best.acc <= 8 || Date.now() - t0 > 12000)){ done = true; navigator.geolocation.clearWatch(id); res(best); }
    }, () => { if (!done){ done = true; navigator.geolocation.clearWatch(id); res(best); } }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
    setTimeout(() => { if (!done){ done = true; navigator.geolocation.clearWatch(id); res(best); } }, 15000);
  });
}
async function updateElementGPS(ctx, e){
  if (!e) return;
  const m = modal(`<h2>Actualizar ubicación</h2><p>${esc(e.name || FE_KINDS[e.kind])} · <span class="muted">${esc(FE_KINDS[e.kind])}</span></p>
    <p>¿Querés actualizar la ubicación con tu posición actual? Parate al lado del elemento.</p>
    <div id="ug-st" class="sm muted"></div>
    ${RES_KINDS.includes(e.kind) ? `<label>Reserva (m)</label><input id="ug-r" type="number" min="0" value="${e.reserve_m ?? ctx.route.reserve_m}">` : ''}
    <label>Observación (opcional)</label><input id="ug-n" maxlength="1000" placeholder="Ej.: botella en poste 33 kV, frente a la escuela">
    <div class="err" id="ug-err"></div>
    <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn sec" id="ug-x">No, cancelar</button><button class="btn" id="ug-ok">Sí, tomar mi ubicación</button></div>`);
  $('#ug-x').onclick = m.close;
  $('#ug-ok').onclick = async () => {
    $('#ug-ok').disabled = true; $('#ug-st').textContent = 'Buscando la mejor señal GPS (hasta 12 segundos)…';
    const pos = await getPosAccurate();
    if (!pos){ $('#ug-ok').disabled = false; $('#ug-st').textContent = ''; return ($('#ug-err').textContent = 'No se pudo obtener la ubicación. Revisá que el GPS esté activado y que la app tenga permiso.'); }
    const moved = e.lat != null ? havm([e.lng, e.lat], [pos.lng, pos.lat]) : 0;
    const pr = projectOn(ctx.path, ctx.cum, [pos.lng, pos.lat]);
    $('#ug-st').innerHTML = `Tu posición: <b>${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}</b> · precisión <b>±${pos.acc} m</b>${pos.acc > 20 ? ' <span style="color:var(--red)">(baja: alejate de techos o esperá unos segundos)</span>' : ''}<br>Se mueve ${fmtM(moved)} de donde estaba · a ${Math.round(pr.off)} m del recorrido.`;
    if (pos.acc > 20 && !confirm(`La precisión del GPS es baja (±${pos.acc} m). ¿Usarla igual?`)){ $('#ug-ok').disabled = false; $('#ug-ok').textContent = 'Volver a intentar'; return; }
    if ((moved > 300 || pr.off > 300) && !confirm(`Ojo: la nueva posición queda a ${fmtM(moved)} de la anterior y a ${Math.round(pr.off)} m del recorrido. ¿Seguro que estás al lado del elemento?`)){ $('#ug-ok').disabled = false; return; }
    const args = { p_id: e.id, p_lat: pos.lat, p_lng: pos.lng, p_acc: pos.acc, p_chain: Math.round(pr.chain * 10) / 10,
      p_reserve: $('#ug-r') ? Number($('#ug-r').value) : null, p_name: e.status === 'aproximado' ? String(e.name || '').replace(/\s*\(a confirmar\)\s*/i, '') : null, p_notes: $('#ug-n').value.trim() || null };
    await saveElementUpdate(ctx, e, args, m);
  };
}
function editElementData(ctx, e){
  if (!e) return;
  const m = modal(`<h2>Editar datos</h2><p class="muted sm">${esc(FE_KINDS[e.kind])}</p>
    <label>Nombre</label><input id="ed-n" maxlength="200" value="${esc(e.name || '')}">
    ${RES_KINDS.includes(e.kind) ? `<label>Reserva (m)</label><input id="ed-r" type="number" min="0" value="${e.reserve_m ?? ctx.route.reserve_m}">` : ''}
    <label>Observación</label><input id="ed-o" maxlength="1000" value="${esc(e.notes || '')}">
    <div class="err" id="ed-err"></div>
    <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn sec" id="ed-x">Cancelar</button><button class="btn" id="ed-ok">Guardar</button></div>`);
  $('#ed-x').onclick = m.close;
  $('#ed-ok').onclick = () => saveElementUpdate(ctx, e, { p_id: e.id, p_reserve: $('#ed-r') ? Number($('#ed-r').value) : null, p_name: $('#ed-n').value.trim() || null, p_notes: $('#ed-o').value.trim() || null }, m);
}
async function saveElementUpdate(ctx, e, args, m){
  // si la caja está ligada a un empalme del .sor y se ubica en el lugar, queda confirmada para ese empalme
  const pr = ctx.pairOf?.get(e.id); if (pr && args.p_lat != null && args.p_splice == null) args.p_splice = pr.s.n;
  const local = () => { // reflejar el cambio en el teléfono
    if (args.p_lat !== undefined && args.p_lat != null){ e.lat = args.p_lat; e.lng = args.p_lng; e.chain_m = args.p_chain; }
    if (args.p_reserve != null && args.p_reserve !== undefined) e.reserve_m = args.p_reserve;
    if (args.p_name) e.name = args.p_name; if (args.p_notes) e.notes = args.p_notes;
    e.status = 'actualizado'; if (args.p_splice != null) e.splice_no = args.p_splice; e.updated_at = new Date().toISOString(); e.updated_by = me.full_name || me.email;
  };
  if (!online()){
    await queueFiber({ t: 'el', route: ctx.route.id, args }); local();
    await IDB.put('kv', ctx.elements, CUR_UID + ':fe:' + ctx.route.id).catch(() => {});
    m.close(); toast('Guardado en el teléfono: se actualiza cuando vuelva la señal.'); return route_();
  }
  const { error } = await sb.rpc('fiber_update_element', args);
  if (error) return ($('#modal-root .err') || {}).textContent = errText(error);
  m.close(); toast('Elemento actualizado'); await IDB.del('kv', CUR_UID + ':fe:' + ctx.route.id).catch(() => {}); route_();
}
/* cola sin señal */
async function queueFiber(item){ const k = CUR_UID + ':fq'; const q = (await IDB.get('kv', k).catch(() => null)) || []; q.push({ ...item, at: Date.now() }); await IDB.put('kv', q.slice(-500), k); }
function applyQueued(routeId, elements){ return elements; }
let fqBusy = false;
async function fiberFlush(){
  if (fqBusy || !online() || !CUR_UID) return; fqBusy = true;
  try {
    const k = CUR_UID + ':fq'; let q = (await IDB.get('kv', k).catch(() => null)) || [];
    const rest = [];
    for (const it of q){
      const { error } = it.t === 'el' ? await sb.rpc('fiber_update_element', it.args) : await sb.from('fiber_events').insert(it.row);
      if (error && isNetErr(error)) rest.push(it);
      else if (error) console.warn('fibra', error);
    }
    await IDB.put('kv', rest, k);
    if (q.length && q.length !== rest.length) toast(`Se enviaron ${q.length - rest.length} actualizaciones de fibra guardadas sin señal.`);
  } finally { fqBusy = false; }
}
window.addEventListener('online', () => setTimeout(() => { try { fiberFlush(); } catch {} }, 2000));

function renderValidation(ctx, goTo){
  const box = $('#fl-val'); if (!box) return;
  const { route, val, model } = ctx, splices = route.splices || [], thr = Number(route.threshold_db || 0.1);
  const manage = isManager() && canWrite() && online();
  if (!splices.length){ box.innerHTML = `<h2>Validación con .sor</h2><p class="muted">Este tramo todavía no tiene .sor. Subí uno o dos (uno de cada punta) para contrastar el KMZ: el .sor es la referencia.</p>${manage ? '<button class="btn" id="fv-go">Validar con .sor</button>' : ''}`; $('#fv-go')?.addEventListener('click', () => revalidateModal(ctx)); return; }
  const est = p => { const r = otdrToChain(model, p.s.a); if (!r) return null; const ll = pointAt(ctx.path, ctx.cum, r.chain); return { lat: ll[1], lng: ll[0], chain: r.chain, w: r.window }; };
  box.innerHTML = `<div class="row between"><h2 style="margin:0">Validación con .sor</h2>${manage ? '<button class="btn sec small" id="fv-go">Validar con otros .sor</button>' : ''}</div>
    <p class="muted sm" style="margin:6px 0 8px">${(route.sor_meta || []).map(f => esc(f.name) + ' (' + (f.dir === 'AB' ? 'A→B' : 'B→A') + ')').join(' · ') || 'Referencia cargada'} · fibra ${route.optical_length_m ? fmtM(route.optical_length_m) : '—'}</p>
    <div class="tblwrap" style="max-height:340px;overflow:auto"><table class="tbl"><thead><tr><th>#</th><th class="num">Desde ${esc(route.end_a || 'A')}</th><th class="hide-sm">Visto</th><th class="num hide-sm">Pérdida</th><th>Estado</th><th class="hide-sm">Caja</th><th></th></tr></thead><tbody>
    ${val.pairs.map((p, i) => `<tr><td>${p.s.n}</td><td class="num">${fmtM(p.s.a)}</td><td class="hide-sm sm">${esc(p.s.seen || '')}</td>
      <td class="num hide-sm ${p.s.avg != null && p.s.avg > thr ? '' : ''}" style="${p.s.avg != null && p.s.avg > thr ? 'color:var(--red);font-weight:600' : ''}">${p.s.avg != null ? p.s.avg.toFixed(3).replace('.', ',') : '—'}</td>
      <td class="sm">${valTxt[p.status]}${p.status === 'coincide' && p.d != null ? `<div class="muted">${Math.abs(Math.round(p.d))} m · margen ±${p.mg} m</div>` : ''}${p.status === 'desplazada' ? `<div class="muted">${Math.abs(Math.round(p.d))} m (margen ±${p.mg} m)</div>` : ''}</td><td class="hide-sm sm">${p.e ? esc(p.e.name || '') : '—'}</td>
      <td style="white-space:nowrap"><button class="btn sec small" data-vgo="${i}">Ver</button>${p.status === 'desplazada' && canWrite() ? ` <button class="btn small" data-vmv="${i}">Mover</button>` : ''}</td></tr>`).join('')}
    </tbody></table></div>
    ${val.orphans.length ? `<details style="margin-top:8px"><summary class="sm" style="cursor:pointer">⚪ ${val.orphans.length} caja${val.orphans.length === 1 ? '' : 's'} del KMZ sin evento en el .sor</summary><p class="sm muted">Puede ser un empalme tan bueno que el OTDR no lo detecta, o una caja que no existe o está en otro lugar. Revisalas en campo.</p>
      ${val.orphans.map(e => `<div class="sm" style="padding:2px 0">${esc(e.name || 'Caja')} · ${fmtM(Number(e.chain_m))} de recorrido desde ${esc(route.end_a || 'A')} <button class="link" data-vor="${e.id}">ver</button></div>`).join('')}</details>` : ''}
    <p class="muted sm" style="margin:8px 0 0">El .sor da la distancia de fibra exacta; pasarla al mapa tiene un margen (sobrante de fibra, reservas) que crece lejos de las puntas y se achica con cada caja confirmada en campo.<br>🟢 la caja del KMZ está dentro del margen · 🟡 está más lejos de lo que da el .sor: revisala, o <b>Mover</b> la lleva a la posición del .sor y queda "a confirmar" · 🔴/❔ el KMZ no tiene esa caja: se creó "a confirmar" · en el lugar, <b>📍 Actualizar ubicación</b> la confirma y mejora todas las estimaciones.</p>`;
  box.querySelectorAll('[data-vgo]').forEach(b => b.onclick = () => { const p = val.pairs[Number(b.dataset.vgo)]; const t = p.e && p.status !== 'desplazada' ? { lat: p.e.lat, lng: p.e.lng } : est(p); if (t) goTo(t.lat, t.lng); });
  box.querySelectorAll('[data-vor]').forEach(b => b.onclick = () => { const e = ctx.elements.find(x => x.id === b.dataset.vor); if (e) goTo(e.lat, e.lng); });
  $('#fv-go')?.addEventListener('click', () => revalidateModal(ctx));
  box.querySelectorAll('[data-vmv]').forEach(b => b.onclick = async () => {
    const p = val.pairs[Number(b.dataset.vmv)], t = est(p); if (!t || !p.e) return;
    if (!confirm(`Mover "${p.e.name}" ${Math.abs(Math.round(p.d))} m, a la posición que indica el .sor (empalme ${p.s.n}, ${fmtM(p.s.a)} desde ${route.end_a})?\n\nQueda "a confirmar" hasta que un técnico la ubique en el lugar.`)) return;
    const args = { p_id: p.e.id, p_lat: t.lat, p_lng: t.lng, p_chain: Math.round(t.chain * 10) / 10, p_status: 'aproximado', p_splice: p.s.n, p_notes: `Movida según .sor (empalme ${p.s.n})` };
    if (!online()){ await queueFiber({ t: 'el', route: route.id, args }); toast('Guardado en el teléfono: se envía cuando vuelva la señal.'); return; }
    const { error } = await sb.rpc('fiber_update_element', args); if (error) return toast(errText(error));
    toast('Caja movida: queda a confirmar'); await IDB.del('kv', CUR_UID + ':fe:' + route.id).catch(() => {}); route_();
  });
}
function renderFiberEvents(ctx){
  const box = $('#fl-events'); if (!box) return;
  const { events, route } = ctx;
  box.innerHTML = `<h2>Eventos ubicados (${events.length})</h2>${events.length ? `<div class="tblwrap"><table class="tbl"><thead><tr><th>Fecha</th><th class="num">OTDR</th><th>Ubicación estimada</th><th class="hide-sm">Real</th><th></th></tr></thead><tbody>
    ${events.slice(0, 50).map(ev => { const err = ev.real_lat != null ? havm([ev.lng, ev.lat], [ev.real_lng, ev.real_lat]) : null;
      return `<tr><td class="sm">${fmtDate(ev.created_at)}<div class="muted">${esc(ev.created_by_name || '')}</div></td><td class="num sm">${fmtM(ev.otdr_m)} desde ${ev.from_end}${ev.loss_db != null ? `<div class="muted">${ev.loss_db} dB</div>` : ''}</td>
      <td class="sm">${Number(ev.lat).toFixed(5)}, ${Number(ev.lng).toFixed(5)} ±${Math.round(ev.window_m || 0)} m${ev.note ? `<div class="muted">${esc(ev.note)}</div>` : ''}</td>
      <td class="hide-sm sm">${err != null ? `a ${Math.round(err)} m de lo estimado` : '—'}</td>
      <td>${canWrite() && ev.real_lat == null ? `<button class="btn sec small" data-real="${ev.id}">Marcar ubicación real</button>` : ''}</td></tr>`; }).join('')}</tbody></table></div>
    <p class="muted sm">Cuando la cuadrilla encuentra el corte, tocá <b>Marcar ubicación real</b> parado en el lugar: la app lo usa para mejorar los próximos cálculos de este tramo.</p>` : '<div class="empty">Todavía no se guardaron eventos en este tramo.</div>'}`;
  box.querySelectorAll('[data-real]').forEach(b => b.onclick = async () => {
    if (!needOnline()) return;
    if (!confirm('¿Estás parado donde se encontró el corte o evento? Se guarda tu posición actual como ubicación real.')) return;
    b.disabled = true; b.textContent = 'Buscando GPS…';
    const pos = await getPosAccurate(); if (!pos){ b.disabled = false; b.textContent = 'Marcar ubicación real'; return toast('No se pudo obtener la ubicación.'); }
    const { error } = await sb.from('fiber_events').update({ real_lat: pos.lat, real_lng: pos.lng }).eq('id', b.dataset.real);
    if (error) return toast(errText(error));
    toast(`Ubicación real guardada (±${pos.acc} m)`); await IDB.del('kv', CUR_UID + ':fev:' + route.id).catch(() => {}); route_();
  });
}

function editRouteModal(r){
  if (!needOnline()) return;
  const m = modal(`<h2>Editar tramo</h2>
    <div class="row"><div class="grow"><label>Traza</label><input id="er-z" maxlength="120" value="${esc(r.traza || '')}"></div><div class="grow"><label>Nombre</label><input id="er-n" maxlength="200" value="${esc(r.name)}"></div></div>
    <div class="row"><div class="grow"><label>Nombre Sitio A</label><input id="er-a" maxlength="120" value="${esc(r.end_a || '')}"></div><div class="grow"><label>Nombre Sitio B</label><input id="er-b" maxlength="120" value="${esc(r.end_b || '')}"></div></div>
    <div class="row"><div class="grow"><label>Longitud óptica (m)</label><input id="er-l" type="number" min="0" value="${r.optical_length_m ?? ''}"></div>
      <div class="grow"><label>Reserva por defecto (m)</label><input id="er-r" type="number" min="0" value="${r.reserve_m}"></div>
      <div class="grow"><label>Umbral empalme (dB)</label><input id="er-t" type="number" min="0" step="0.01" value="${r.threshold_db}"></div></div>
    <label>Cable</label><input id="er-c" maxlength="120" value="${esc(r.cable || '')}">
    <p class="muted sm">La reserva por defecto se usa en los elementos que no tienen una reserva propia cargada.</p>
    <div class="err" id="er-err"></div>
    <div class="row between" style="margin-top:10px">${isAdmin() ? '<button class="btn danger small" id="er-del">Eliminar tramo</button>' : '<span></span>'}<div class="row"><button class="btn sec" id="er-x">Cancelar</button><button class="btn" id="er-ok">Guardar</button></div></div>`);
  $('#er-x').onclick = m.close;
  $('#er-ok').onclick = async () => {
    const nl = Number($('#er-l').value) || null, ol = Number(r.optical_length_m) || null;
    if (nl !== ol && !confirm(`Vas a cambiar la longitud óptica del tramo "${r.name}":\n\nAntes: ${ol ? ol + ' m (' + fmtM(ol) + ')' : 'sin cargar'}\nAhora: ${nl ? nl + ' m (' + fmtM(nl) + ')' : 'sin cargar'}\n\nOjo: el valor va en METROS. ¿Confirmar?`)) return;
    const { error } = await sb.from('fiber_routes').update({ traza: $('#er-z').value.trim() || null, name: $('#er-n').value.trim() || r.name, end_a: $('#er-a').value.trim() || null, end_b: $('#er-b').value.trim() || null,
      optical_length_m: Number($('#er-l').value) || null, reserve_m: Number($('#er-r').value) || 0, threshold_db: Number($('#er-t').value) || 0.1, cable: $('#er-c').value.trim() || null }).eq('id', r.id);
    if (error) return ($('#er-err').textContent = errText(error)); m.close(); toast('Tramo guardado'); route_();
  };
  $('#er-del')?.addEventListener('click', async () => {
    if ((prompt(`Se elimina el tramo "${r.name}" con sus elementos y eventos.\n\nEscribí ELIMINAR para confirmar.`) || '').trim().toUpperCase() !== 'ELIMINAR') return;
    const { error } = await sb.from('fiber_routes').delete().eq('id', r.id); if (error) return toast(errText(error));
    m.close(); location.hash = '#/tools';
  });
}

/* ---------- exportar KMZ con las actualizaciones ---------- */
async function exportFiberKMZ(ctx){
  if (!window.JSZip) return toast('No se pudo cargar el generador de KMZ.');
  const x = s => String(s ?? '').replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  const { route, elements, events } = ctx, sp = n => (route.splices || []).find(s => s.n === n);
  const col = { botella: 'ff2020dc', cruz: 'ffd03a7c', reserva: 'ffd03a7c', poste: 'ff787878', camara: 'ff13458b', epi: 'ff6b3a1a', dc: 'ff6b3a1a', otro: 'ff999999' };
  const style = Object.entries(col).map(([k, c]) => `<Style id="${k}"><IconStyle><color>${c}</color><scale>${k === 'poste' ? 0.5 : 0.9}</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon></IconStyle><LabelStyle><scale>${k === 'poste' ? 0 : 0.7}</scale></LabelStyle></Style>`).join('') +
    '<Style id="upd"><IconStyle><color>ff22b07d</color><scale>1</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon></IconStyle></Style><Style id="apx"><IconStyle><color>ff00a5ff</color><scale>1</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon></IconStyle></Style><Style id="ev"><IconStyle><color>ffed3a7c</color><scale>1.1</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/caution.png</href></Icon></IconStyle></Style><Style id="rec"><LineStyle><color>ff6b3a1a</color><width>4</width></LineStyle></Style>';
  const pm = e => { const s = e.splice_no ? sp(e.splice_no) : null;
    const desc = [FE_KINDS[e.kind], e.status === 'actualizado' ? `ACTUALIZADO el ${fmtDate(e.updated_at)} por ${e.updated_by || ''}` : e.status === 'aproximado' ? 'A CONFIRMAR (ubicación estimada)' : '',
      e.reserve_m != null && e.reserve_m !== undefined ? `Reserva: ${e.reserve_m} m` : '', s ? `Empalme ${s.n} · progresiva ${Math.round(s.a)} m desde ${route.end_a || 'A'}` : '', e.notes || ''].filter(Boolean).join('<br>');
    return `<Placemark><name>${x(e.name || FE_KINDS[e.kind])}${e.status === 'actualizado' ? ' (actualizado)' : ''}</name><description><![CDATA[${desc.replace(/]]>/g, '')}]]></description><styleUrl>#${e.status === 'actualizado' ? 'upd' : e.status === 'aproximado' ? 'apx' : e.kind}</styleUrl><Point><coordinates>${Number(e.lng).toFixed(7)},${Number(e.lat).toFixed(7)},0</coordinates></Point></Placemark>`; };
  const folders = Object.keys(FE_KINDS).map(k => { const l = elements.filter(e => e.kind === k && e.lat != null); return l.length ? `<Folder><name>${x(FE_KINDS[k])} (${l.length})</name>${l.map(pm).join('')}</Folder>` : ''; }).join('');
  const evs = events.filter(e => e.lat != null).map(e => `<Placemark><name>Evento ${x(fmtDate(e.created_at))}</name><description><![CDATA[${(`OTDR ${Math.round(e.otdr_m)} m desde ${e.from_end}${e.loss_db != null ? ` · ${e.loss_db} dB` : ''} · ±${Math.round(e.window_m || 0)} m${e.note ? '<br>' + x(e.note) : ''}`).replace(/]]>/g, '')}]]></description><styleUrl>#ev</styleUrl><Point><coordinates>${Number(e.lng).toFixed(7)},${Number(e.lat).toFixed(7)},0</coordinates></Point></Placemark>`).join('');
  const kml = `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${x(route.name)} · actualizado ${x(fmtDate(new Date()))}</name><description>Exportado de InspectApp el ${x(fmtDT(new Date()))}</description>${style}
    <Folder><name>Recorrido de la fibra</name><Placemark><name>${x(route.end_a || 'A')} → ${x(route.end_b || 'B')}</name><styleUrl>#rec</styleUrl><LineString><tessellate>1</tessellate><coordinates>${(route.path || []).map(p => `${p[0]},${p[1]},0`).join(' ')}</coordinates></LineString></Placemark></Folder>
    <Folder><name>Elementos</name>${folders}</Folder>${evs ? `<Folder><name>Eventos ubicados</name>${evs}</Folder>` : ''}</Document></kml>`;
  const zip = new JSZip(); zip.file('doc.kml', kml);
  const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.google-earth.kmz' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `InspectApp - ${route.name.replace(/[\\/:*?"<>|]/g, '').slice(0, 100)} - exportado ${todayStr()}.kmz`;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}
