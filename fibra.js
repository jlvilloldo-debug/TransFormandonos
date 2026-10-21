/* =====================================================================
   InspectApp · Transformándonos — v4.2
   Herramientas → Fibra óptica: tramos (KMZ + planilla de empalmes),
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
/* encadena los tramos del recorrido empezando por la punta A */
function chainLines(lines, start){
  const segs = lines.map(l => l.pts), used = new Set(); let cur = start, path = [start];
  const order = [];
  for (;;){
    let best = null;
    segs.forEach((P, i) => { if (used.has(i) || P.length < 2) return;
      for (const rev of [false, true]){ const Q = rev ? [...P].reverse() : P; const d = havm(cur, Q[0]); if (!best || d < best.d) best = { d, i, Q }; } });
    if (!best || best.d > 600) break;
    used.add(best.i); order.push({ name: lines[best.i].name, gap: Math.round(best.d) });
    path = path.concat(best.Q); cur = best.Q[best.Q.length - 1];
  }
  // quitar puntos repetidos consecutivos
  path = path.filter((p, i) => i === 0 || p[0] !== path[i - 1][0] || p[1] !== path[i - 1][1]).map(p => [Math.round(p[0] * 1e7) / 1e7, Math.round(p[1] * 1e7) / 1e7]);
  return { path, order, unused: lines.filter((l, i) => !used.has(i)).map(l => l.name) };
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
   Anclas: puntos con progresiva óptica conocida (empalmes emparejados con su botella,
   cortes reparados con ubicación real y las dos puntas). Entre dos anclas la fibra =
   recorrido × k + reservas intermedias (+ media reserva de cada botella ancla). */
function fiberModel(route, elements, events){
  const L = Number(route.route_length_m) || 0, R = Number(route.reserve_m ?? 30);
  const res = elements.filter(e => RES_KINDS.includes(e.kind) && e.chain_m != null && e.chain_m !== undefined).map(e => ({ c: Number(e.chain_m), r: Number(e.reserve_m ?? R), e })).sort((a, b) => a.c - b.c);
  const splices = route.splices || [];
  const anchors = [{ o: 0, c: 0, h: 0, label: route.end_a || 'Punta A' }];
  for (const e of elements){
    if (!e.splice_no || e.status === 'aproximado' || e.chain_m == null) continue;
    const s = splices.find(x => x.n === e.splice_no); if (!s || !(s.a > 0)) continue;
    anchors.push({ o: Number(s.a), c: Number(e.chain_m), h: (RES_KINDS.includes(e.kind) ? Number(e.reserve_m ?? R) : 0) / 2, label: `Empalme ${s.n}`, e });
  }
  for (const ev of events || []) if (ev.real_lat != null && ev.real_lat !== undefined && ev.chain_real !== undefined) anchors.push({ o: Number(ev.otdr_a), c: ev.chain_real, h: 0, label: 'Corte reparado ' + fmtDate(ev.created_at) });
  const Lopt = Number(route.optical_length_m) || null;
  const totalRes = res.reduce((a, x) => a + x.r, 0);
  anchors.push({ o: Lopt || (L * 1.02 + totalRes), c: L, h: 0, label: route.end_b || 'Punta B', est: !Lopt });
  anchors.sort((a, b) => a.o - b.o);
  // descartar anclas que contradicen el orden del recorrido
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
  return { anchors: clean, vanos, Lopt, L, R };
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

/* ---------- planilla de empalmes ---------- */
function parseSpliceSheet(wb){
  const ev = new Map(); let Lopt = null, endA = null, endB = null, cable = null, nFib = 0;
  for (const sn of wb.SheetNames){
    const rows = sheetRows(wb.Sheets[sn]);
    for (const r of rows.slice(0, 20)){
      const k = norm(r[0]); const val = r.slice(1).find(x => xlStr(x) !== '');
      if (/^long\.? ?optica/.test(k) && val !== undefined && Lopt == null){ const n = xlNumber(val); if (n) Lopt = n < 2000 ? n * 1000 : n; }
      if (/^nodo origen/.test(k) && val && !endA) endA = xlStr(val);
      if (/^nodo destino/.test(k) && val && !endB) endB = xlStr(val);
      if (/^cable/.test(k) && val && !cable) cable = xlStr(val);
    }
    if (!/empalme/i.test(sn) && !rows.some(r => r.some(c => /^evento/.test(norm(c))))) continue;
    const hi = rows.findIndex(r => r.some(c => /^evento/.test(norm(c))) && r.some(c => /progresiva/.test(norm(c))));
    if (hi < 0) continue;
    const sub = rows[hi + 1] || [];
    // cada fibra: columnas De A→B · De B→A · At Prom (el promedio puede venir vacío)
    const trip = []; sub.forEach((c, i) => { if (/prom/.test(norm(c))) trip.push({ ab: i - 2, ba: i - 1, pr: i }); });
    if (!trip.length) sub.forEach((c, i) => { if (/a.?→.?b|a->b/.test(norm(c)) && i > 2) trip.push({ ab: i, ba: -1, pr: -1 }); });
    nFib += trip.length;
    for (const r of rows.slice(hi + 2)){
      const n = xlNumber(r[0]), a = xlNumber(r[1]), b = xlNumber(r[2]);
      if (!n || a == null) continue;
      const vals = trip.map(t => { const pr = t.pr >= 0 ? xlNumber(r[t.pr]) : null; if (pr != null && xlStr(r[t.pr]) !== '') return pr;
        const ab = xlNumber(r[t.ab]), ba = t.ba >= 0 ? xlNumber(r[t.ba]) : null;
        if (ab != null && ba != null && ab !== 0 && ba !== 0) return (ab + ba) / 2;
        return ab != null ? ab : ba; }).filter(x => x != null);
      const cur = ev.get(n) || { n, a, b, vals: [] };
      cur.vals.push(...vals); ev.set(n, cur);
    }
  }
  const splices = [...ev.values()].sort((x, y) => x.a - y.a).map(s => {
    const v = s.vals.filter(x => x !== 0);
    return { n: s.n, a: s.a, b: s.b, worst: v.length ? Math.max(...v) : null, avg: v.length ? v.reduce((p, q) => p + q, 0) / v.length : null, fibers: s.vals.length, vals: s.vals.map(x => Math.round(x * 1000) / 1000) };
  });
  return { splices, Lopt, endA, endB, cable, nFib };
}
/* empareja empalmes con botellas / nodos del recorrido (en orden) */
function matchSplices(splices, elements, R){
  const cand = elements.filter(e => ['botella', 'epi', 'dc'].includes(e.kind) && e.chain_m != null).sort((a, b) => a.chain_m - b.chain_m);
  const res = elements.filter(e => RES_KINDS.includes(e.kind)).map(e => e.chain_m).sort((a, b) => a - b);
  const model = (c, h) => c * (1 + h) + R * res.filter(x => x < c - 1).length;
  let best = { err: Infinity, h: 0.02 };
  for (let h = 0; h <= 0.08; h += 0.0025){
    const err = cand.filter(e => e.kind === 'botella').reduce((s, e) => s + Math.min(...splices.map(x => Math.abs(model(e.chain_m, h) - x.a)), 5000), 0);
    if (err < best.err) best = { err, h };
  }
  const used = new Set(); let lastC = -1; const pairs = [];
  for (const s of splices){
    const tol = Math.max(250, 0.03 * s.a);
    let pick = null;
    for (const e of cand){ if (used.has(e.id) || e.chain_m <= lastC) continue; const d = Math.abs(model(e.chain_m, best.h) - s.a); if (d <= tol && (!pick || d < pick.d)) pick = { e, d }; }
    if (pick){ used.add(pick.e.id); lastC = pick.e.chain_m; pairs.push({ s, e: pick.e, d: pick.d }); }
  }
  return { pairs, h: best.h };
}
function kindOf(name, folder){
  const n = norm(name), f = norm(folder || '');
  if (/botella|empalme|caja de empalme/.test(n)) return 'botella';
  if (/cruz|ganancia/.test(n)) return 'cruz';
  if (/reserva|rulo/.test(n)) return 'reserva';
  if (/^epi|nodo|shelter/.test(n)) return 'epi';
  if (/^dc$|data ?center|central|^cpd/.test(n)) return 'dc';
  if (/camara/.test(n)) return 'camara';
  if (/poste|mensula|luminaria|columna/.test(n)) return 'poste';
  if (/botella/.test(f)) return 'botella';
  if (/poste/.test(f)) return 'poste';
  return 'otro';
}

/* =====================================================================
   PANTALLAS
   ===================================================================== */
const FR_COLS = 'id,name,end_a,end_b,cable,optical_length_m,route_length_m,reserve_m,threshold_db,ior,notes,updated_at';
async function viewTools(v){
  const routes = await cached('fr-list', () => sb.from('fiber_routes').select(FR_COLS).order('name'));
  const manage = isManager() && canWrite() && online();
  v.innerHTML = `
    <div class="card"><h2 style="margin:0">🧰 Herramientas</h2><p class="muted sm" style="margin:6px 0 0">Funcionan también sin señal con lo que ya está descargado en el teléfono.</p></div>
    <div class="card"><div class="row between"><div><h2 style="margin:0">Fibra óptica: ubicar eventos y cortes</h2>
      <p class="muted sm" style="margin:4px 0 0">Cargás el KMZ del tramo y la planilla de empalmes. Después ubicás cualquier evento del OTDR (distancia o archivo .sor) en el mapa, y los técnicos actualizan la posición de botellas, reservas y postes desde el lugar.</p></div>
      ${manage ? '<button class="btn" id="fr-new">+ Tramo</button>' : ''}</div>
      <div class="tblwrap" style="margin-top:12px"><table class="tbl"><thead><tr><th>Tramo</th><th class="hide-sm">Puntas</th><th class="num">Recorrido</th><th class="num hide-sm">Long. óptica</th><th></th></tr></thead><tbody>
      ${routes.map(r => `<tr class="click" data-fr="${r.id}"><td><b>${esc(r.name)}</b>${r.cable ? `<div class="muted sm">${esc(r.cable)}</div>` : ''}</td><td class="hide-sm sm">${esc(r.end_a || '')} → ${esc(r.end_b || '')}</td>
        <td class="num">${r.route_length_m ? (r.route_length_m / 1000).toFixed(2).replace('.', ',') + ' km' : '—'}</td><td class="num hide-sm">${r.optical_length_m ? (r.optical_length_m / 1000).toFixed(3).replace('.', ',') + ' km' : '—'}</td><td>›</td></tr>`).join('') || `<tr><td colspan="5" class="muted">${manage ? 'Todavía no hay tramos. Cargá el primero con <b>+ Tramo</b>.' : 'Todavía no hay tramos cargados.'}</td></tr>`}
      </tbody></table></div></div>`;
  v.querySelectorAll('[data-fr]').forEach(tr => tr.onclick = () => location.hash = '#/tools/' + tr.dataset.fr);
  $('#fr-new')?.addEventListener('click', newRouteModal);
  fiberFlush();
}

/* ---------- alta de tramo: KMZ + planilla ---------- */
function newRouteModal(){
  if (!needOnline()) return;
  let kmz = null, sheet = null, built = null;
  const m = modal(`<h2>Nuevo tramo de fibra</h2>
    <label>Nombre del tramo</label><input id="nr-n" maxlength="200" placeholder="Ej.: Traza 15 · Santa Fe – Helvecia">
    <label>KMZ / KML con el recorrido y los elementos</label><input type="file" id="nr-k" accept=".kmz,.kml">
    <label>Planilla de empalmes (opcional, recomendada)</label><input type="file" id="nr-x" accept=".xlsx,.xls">
    <div id="nr-info" class="sm" style="margin-top:10px"></div>
    <div id="nr-more" class="hidden">
      <div class="row"><div class="grow"><label>Punta A (origen de las progresivas)</label><select id="nr-a"></select></div><div class="grow"><label>Punta B</label><input id="nr-b" maxlength="120"></div></div>
      <div class="row"><div class="grow"><label>Reserva por botella / cruz (m)</label><input id="nr-r" type="number" min="0" value="30"></div>
        <div class="grow"><label>Umbral de empalme (dB)</label><input id="nr-t" type="number" min="0" step="0.01" value="0.10"></div>
        <div class="grow"><label>Longitud óptica (m)</label><input id="nr-l" type="number" min="0" step="1" placeholder="de la planilla o del .sor"></div></div>
      <label>Cable</label><input id="nr-c" maxlength="120" placeholder="Ej.: 96FO">
    </div>
    <div class="err" id="nr-err"></div>
    <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn sec" id="nr-x2">Cancelar</button><button class="btn" id="nr-go" disabled>Procesar</button></div>`, { wide: true });
  $('#nr-x2').onclick = m.close;
  const ready = () => { $('#nr-go').disabled = !kmz; };
  $('#nr-k').onchange = async e => {
    $('#nr-err').textContent = ''; kmz = null; ready();
    try {
      const pms = parseKML(await readKML(e.target.files[0]));
      const lines = pms.filter(x => !x.isPoint && x.pts.length > 1).map(x => ({ name: x.name || 'Tramo', pts: x.pts.map(p => [p[0], p[1]]) }));
      const pts = pms.filter(x => x.isPoint && x.pts.length).map(x => ({ name: (x.name || '').trim().slice(0, 200), folder: x.path.join(' / '), p: [x.pts[0][0], x.pts[0][1]] }));
      if (!lines.length) throw new Error('El KMZ no tiene líneas con el recorrido de la fibra.');
      if (pts.length > 20000) throw new Error('El KMZ tiene demasiados elementos (más de 20.000).');
      kmz = { lines, pts };
      const ends = pts.filter(x => ['epi', 'dc'].includes(kindOf(x.name, x.folder)));
      $('#nr-a').innerHTML = (ends.length ? ends : pts.slice(0, 200)).map((x, i) => `<option value="${i}">${esc(x.name)}</option>`).join('');
      kmz.ends = ends.length ? ends : pts.slice(0, 200);
      const pref = kmz.ends.findIndex(x => /^dc$|santa fe/i.test(x.name)); if (pref >= 0) $('#nr-a').value = String(pref);
      $('#nr-more').classList.remove('hidden');
      const cnt = {}; pts.forEach(x => { const k = kindOf(x.name, x.folder); cnt[k] = (cnt[k] || 0) + 1; });
      $('#nr-info').innerHTML = `<b>KMZ:</b> ${lines.length} líneas de recorrido · ${Object.entries(cnt).map(([k, n]) => `${n} ${esc(FE_KINDS[k].toLowerCase())}`).join(' · ')}` + ($('#nr-info').dataset.x || '');
      if (!$('#nr-n').value) $('#nr-n').value = e.target.files[0].name.replace(/\.(kmz|kml)$/i, '').replace(/[_]+/g, ' ').slice(0, 120);
    } catch (x){ $('#nr-err').textContent = 'KMZ: ' + errText(x); }
    ready();
  };
  $('#nr-x').onchange = async e => {
    $('#nr-err').textContent = ''; sheet = null;
    try {
      sheet = parseSpliceSheet(await readWorkbook(e.target.files[0]));
      if (!sheet.splices.length) throw new Error('No encontré la tabla de empalmes (columnas Evento y Progresiva).');
      const t = `<br><b>Planilla:</b> ${sheet.splices.length} empalmes${sheet.Lopt ? ` · longitud óptica ${(sheet.Lopt / 1000).toFixed(3).replace('.', ',')} km` : ''}${sheet.endA ? ` · ${esc(sheet.endA)} → ${esc(sheet.endB || '')}` : ''}`;
      $('#nr-info').dataset.x = t; $('#nr-info').innerHTML += t;
      if (sheet.Lopt) $('#nr-l').value = Math.round(sheet.Lopt);
      if (sheet.endB) $('#nr-b').value = sheet.endB;
      if (sheet.cable) $('#nr-c').value = sheet.cable;
      if (sheet.endA && kmz){ const i = kmz.ends.findIndex(x => norm(x.name).includes(norm(sheet.endA)) || (/santa fe/i.test(sheet.endA) && /^dc$/i.test(x.name))); if (i >= 0) $('#nr-a').value = String(i); }
    } catch (x){ $('#nr-err').textContent = 'Planilla: ' + errText(x); }
  };
  $('#nr-go').onclick = async () => {
    if (!kmz) return;
    if (built) return saveRoute();
    const A = kmz.ends[Number($('#nr-a').value)];
    if (!A) return ($('#nr-err').textContent = 'Elegí la punta A.');
    const R = Number($('#nr-r').value) || 0;
    const ch = chainLines(kmz.lines, A.p);
    const cum = cumOf(ch.path), L = cum[cum.length - 1];
    if (L < 50) return ($('#nr-err').textContent = 'No pude armar el recorrido desde esa punta. Probá con la otra punta.');
    const els = kmz.pts.map(x => { const pr = projectOn(ch.path, cum, x.p); const kind = kindOf(x.name, x.folder);
      return { id: uid(), kind, name: x.name || FE_KINDS[kind], subtype: x.name.slice(0, 120), lat: x.p[1], lng: x.p[0], chain_m: Math.round(pr.chain * 10) / 10, off: pr.off, reserve_m: RES_KINDS.includes(kind) ? R : null, status: 'kmz' }; });
    let approx = [], match = { pairs: [], h: 0 };
    if (sheet){
      match = matchSplices(sheet.splices, els, R);
      match.pairs.forEach(p => { p.e.splice_no = p.s.n; });
      const tmpRoute = { route_length_m: L, reserve_m: R, splices: sheet.splices, optical_length_m: Number($('#nr-l').value) || null, end_a: A.name, end_b: $('#nr-b').value };
      const model = fiberModel(tmpRoute, els, []);
      for (const s of sheet.splices){
        if (match.pairs.some(p => p.s.n === s.n)) continue;
        const r = otdrToChain(model, s.a); if (!r) continue;
        const ll = pointAt(ch.path, cum, r.chain);
        approx.push({ id: uid(), kind: 'botella', name: `Empalme ${s.n} (a confirmar)`, subtype: 'Botella', lat: ll[1], lng: ll[0], chain_m: Math.round(r.chain * 10) / 10, reserve_m: R, splice_no: s.n, status: 'aproximado' });
      }
    }
    const far = els.filter(e => e.off > 150).length;
    built = { A, R, ch, L, els: els.concat(approx), match };
    $('#nr-info').innerHTML = `<div class="stats" style="margin-top:6px">
      <div class="stat"><span>Recorrido encadenado</span><b>${(L / 1000).toFixed(2).replace('.', ',')} km</b><small>${ch.order.length} líneas desde ${esc(A.name)}</small></div>
      <div class="stat"><span>Elementos</span><b>${els.length}</b><small>${far ? far + ' a más de 150 m del recorrido' : 'todos sobre el recorrido'}</small></div>
      ${sheet ? `<div class="stat"><span>Empalmes con botella</span><b>${match.pairs.length} / ${sheet.splices.length}</b><small>${approx.length} quedan "a confirmar"</small></div>` : ''}</div>
      ${ch.unused.length ? `<p class="sm" style="color:var(--amber)">Líneas sin encadenar (derivaciones cortas o separadas): ${esc(ch.unused.slice(0, 8).join(', '))}${ch.unused.length > 8 ? '…' : ''}</p>` : ''}
      ${ch.order.some(o => o.gap > 50) ? `<p class="sm muted">Saltos entre líneas: ${ch.order.filter(o => o.gap > 50).map(o => esc(o.name) + ' ' + o.gap + ' m').join(' · ')}</p>` : ''}
      ${approx.length ? `<p class="sm">Los ${approx.length} empalmes sin botella en el KMZ se ubican aproximados en el mapa con "?" para que los técnicos confirmen la posición en el lugar.</p>` : ''}`;
    $('#nr-go').textContent = 'Guardar tramo';
    ['#nr-a', '#nr-r', '#nr-l'].forEach(s => $(s).onchange = () => { built = null; $('#nr-go').textContent = 'Procesar'; });
  };
  const saveRoute = async () => {
    const name = $('#nr-n').value.trim(); if (!name) return ($('#nr-err').textContent = 'Poné el nombre del tramo.');
    $('#nr-go').disabled = true; $('#nr-go').textContent = 'Guardando…';
    const row = { org_id: me.org_id, name, end_a: built.A.name.slice(0, 120), end_b: $('#nr-b').value.trim().slice(0, 120) || null, cable: $('#nr-c').value.trim() || null,
      optical_length_m: Number($('#nr-l').value) || null, route_length_m: Math.round(built.L), path: built.ch.path, splices: sheet ? sheet.splices : [],
      reserve_m: built.R, threshold_db: Number($('#nr-t').value) || 0.1, created_by: me.id };
    const { data, error } = await sb.from('fiber_routes').insert(row).select('id').single();
    if (error){ $('#nr-go').disabled = false; $('#nr-go').textContent = 'Guardar tramo'; return ($('#nr-err').textContent = /duplicate|unique/i.test(error.message) ? 'Ya existe un tramo con ese nombre.' : errText(error)); }
    const rows = built.els.map(e => ({ id: e.id, org_id: me.org_id, route_id: data.id, kind: e.kind, name: e.name, subtype: e.subtype, lat: e.lat, lng: e.lng, chain_m: e.chain_m, reserve_m: e.reserve_m, splice_no: e.splice_no || null, status: e.status }));
    for (let i = 0; i < rows.length; i += 500){
      $('#nr-go').textContent = `Guardando ${Math.min(i + 500, rows.length)} de ${rows.length}…`;
      const { error: e2 } = await sb.from('fiber_elements').insert(rows.slice(i, i + 500));
      if (e2){ $('#nr-err').textContent = errText(e2); await sb.from('fiber_routes').delete().eq('id', data.id); $('#nr-go').disabled = false; $('#nr-go').textContent = 'Reintentar'; return; }
    }
    m.close(); toast('Tramo cargado'); location.hash = '#/tools/' + data.id;
  };
}

/* ---------- vista del tramo ---------- */
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
  const model = fiberModel(route, elements, events);
  const ctx = { route, elements, events, path, cum, model };
  const thr = Number(route.threshold_db || 0.1);
  const splices = route.splices || [];
  const badSp = splices.filter(s => s.worst != null && s.worst > thr);
  const manage = isManager() && canWrite();
  let saved = {}; try { saved = JSON.parse(localStorage.getItem('ia_fiber') || '{}'); } catch {}
  FSTATE = { launch: saved.launch ?? 0, launchLen: saved.launchLen ?? 1000, unit: saved.unit || 'm', from: 'A', mode: 'otdr', layers: saved.layers || { botella: true, cruz: true, poste: true, camara: true, eventos: true } };
  v.innerHTML = `
    <div class="card"><div class="row between"><div class="row"><button class="btn sec small" onclick="location.hash='#/tools'">← Herramientas</button>
      <div><h1 style="margin:0">${esc(route.name)}</h1><div class="muted sm">${esc(route.end_a || 'A')} → ${esc(route.end_b || 'B')} · recorrido ${(route.route_length_m / 1000).toFixed(2).replace('.', ',')} km${Lopt ? ` · fibra ${(Lopt / 1000).toFixed(3).replace('.', ',')} km` : ''}${route.cable ? ' · ' + esc(route.cable) : ''}</div></div></div>
      <div class="row"><button class="btn sec small" id="fr-kmz">Exportar KMZ</button>${manage && online() ? '<button class="btn sec small" id="fr-edit">Editar tramo</button>' : ''}</div></div>
      <div class="stats" style="margin-top:12px">
        <div class="stat"><span>Empalmes (planilla)</span><b>${splices.length || '—'}</b><small>${splices.length ? `${splices.filter(s => s.avg != null && s.avg > thr).length} con promedio sobre ${String(thr).replace('.', ',')} dB` : 'sin planilla'}</small></div>
        <div class="stat"><span>Botellas</span><b>${elements.filter(e => e.kind === 'botella').length}</b><small>${elements.filter(e => e.status === 'aproximado').length} a confirmar · ${elements.filter(e => e.status === 'actualizado').length} actualizadas</small></div>
        <div class="stat"><span>Cruces y reservas</span><b>${elements.filter(e => e.kind === 'cruz' || e.kind === 'reserva').length}</b><small>${route.reserve_m} m c/u (editable)</small></div>
        <div class="stat"><span>Eventos ubicados</span><b>${events.length}</b><small>${events.filter(e => e.real_lat != null).length} con ubicación real</small></div>
      </div></div>
    <div class="card" id="fl-card"><h2>Ubicar un evento</h2>
      <div class="seg" id="fl-mode" style="max-width:520px"><button type="button" data-m="otdr" class="on">Distancia OTDR (fibra)</button><button type="button" data-m="ruta">Distancia sobre el recorrido</button></div>
      <div class="row" style="align-items:flex-end">
        <div style="width:170px"><label>Distancia</label><div class="row" style="flex-wrap:nowrap;gap:4px"><input id="fl-d" type="number" min="0" step="any" inputmode="decimal" placeholder="15696"><select id="fl-u" style="width:70px"><option value="m">m</option><option value="km">km</option></select></div></div>
        <div style="min-width:170px"><label>Medido desde</label><select id="fl-f"><option value="A">${esc(route.end_a || 'Punta A')} (A)</option><option value="B">${esc(route.end_b || 'Punta B')} (B)</option></select></div>
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
  const spOf = e => e.splice_no ? splices.find(s => s.n === e.splice_no) : null;
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
        .bindPopup(`<b>Evento ${fmtDate(ev.created_at)}</b><br>${(ev.otdr_m / 1000).toFixed(3).replace('.', ',')} km desde ${ev.from_end}${ev.loss_db != null ? ` · ${ev.loss_db} dB` : ''}<br>${esc(ev.note || '')}<br><span class="muted">${esc(ev.created_by_name || '')}</span>`).addTo(evLayer);
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
    if (!Lopt && endEv && isManager() && canWrite() && online() && confirm(`El tramo no tiene longitud óptica cargada. ¿Usar el fin de fibra de este .sor (${fmtM(endEv.m)}) como longitud óptica?`)){
      await sb.from('fiber_routes').update({ optical_length_m: Math.round(endEv.m - (FSTATE.launch ? Number(FSTATE.launchLen) || 0 : 0)) }).eq('id', route.id); route_();
    }
  };
  $('#fr-kmz').onclick = () => exportFiberKMZ(ctx);
  $('#fr-edit')?.addEventListener('click', () => editRouteModal(route));
  renderFiberEvents(ctx);
}
const route_ = () => route();
const fmtM = m => m >= 1000 ? (m / 1000).toFixed(3).replace('.', ',') + ' km' : Math.round(m) + ' m';

function elementPopup(ctx, e){
  const { route, model } = ctx, s = e.splice_no ? (route.splices || []).find(x => x.n === e.splice_no) : null;
  const oA = e.chain_m != null ? chainToOtdr(model, Number(e.chain_m)) : null, Lopt = Number(route.optical_length_m) || null;
  const last = (e.history || [])[e.history.length - 1];
  return `<div class="pp"><b style="font-size:15px">${esc(e.name || FE_KINDS[e.kind])}</b>
    <div class="muted sm">${esc(FE_KINDS[e.kind])}${e.subtype && e.subtype !== e.name ? ' · ' + esc(e.subtype) : ''} · <span class="pill ${e.status === 'aproximado' ? 'p-pend' : e.status === 'actualizado' ? 'p-ok' : 'p-info'}">${FE_STATUS[e.status]}</span></div>
    ${e.status === 'actualizado' ? `<div class="sm" style="color:var(--green-d)">Actualizado el ${fmtDate(e.updated_at)} por ${esc(e.updated_by || '')}</div>` : ''}
    ${e.status === 'aproximado' ? '<div class="sm" style="color:var(--amber)">Ubicación estimada desde la planilla: confirmala en el lugar.</div>' : ''}
    <div class="pp-sec sm">${e.chain_m != null ? `Recorrido: ${fmtM(Number(e.chain_m))} desde ${esc(route.end_a || 'A')}<br>` : ''}
      ${oA != null ? `OTDR esperado: <b>${fmtM(oA)}</b> desde A${Lopt ? ` · <b>${fmtM(Lopt - oA)}</b> desde B` : ''}<br>` : ''}
      ${e.reserve_m != null && e.reserve_m !== undefined ? `Reserva: ${e.reserve_m} m<br>` : ''}
      ${s ? `Empalme ${s.n}: progresiva ${fmtM(s.a)}${s.worst != null ? ` · promedio ${s.avg.toFixed(3).replace('.', ',')} dB · peor fibra ${s.worst.toFixed(3).replace('.', ',')} dB · ${(s.vals || []).filter(x => x > Number(route.threshold_db || 0.1)).length} de ${s.fibers} fibras sobre ${String(route.threshold_db || 0.1).replace('.', ',')} dB` : ''}<br>` : ''}
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
  const local = () => { // reflejar el cambio en el teléfono
    if (args.p_lat !== undefined && args.p_lat != null){ e.lat = args.p_lat; e.lng = args.p_lng; e.chain_m = args.p_chain; }
    if (args.p_reserve != null && args.p_reserve !== undefined) e.reserve_m = args.p_reserve;
    if (args.p_name) e.name = args.p_name; if (args.p_notes) e.notes = args.p_notes;
    e.status = 'actualizado'; e.updated_at = new Date().toISOString(); e.updated_by = me.full_name || me.email;
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
    <label>Nombre</label><input id="er-n" maxlength="200" value="${esc(r.name)}">
    <div class="row"><div class="grow"><label>Punta A</label><input id="er-a" maxlength="120" value="${esc(r.end_a || '')}"></div><div class="grow"><label>Punta B</label><input id="er-b" maxlength="120" value="${esc(r.end_b || '')}"></div></div>
    <div class="row"><div class="grow"><label>Longitud óptica (m)</label><input id="er-l" type="number" min="0" value="${r.optical_length_m ?? ''}"></div>
      <div class="grow"><label>Reserva por defecto (m)</label><input id="er-r" type="number" min="0" value="${r.reserve_m}"></div>
      <div class="grow"><label>Umbral empalme (dB)</label><input id="er-t" type="number" min="0" step="0.01" value="${r.threshold_db}"></div></div>
    <label>Cable</label><input id="er-c" maxlength="120" value="${esc(r.cable || '')}">
    <p class="muted sm">La reserva por defecto se usa en los elementos que no tienen una reserva propia cargada.</p>
    <div class="err" id="er-err"></div>
    <div class="row between" style="margin-top:10px">${isAdmin() ? '<button class="btn danger small" id="er-del">Eliminar tramo</button>' : '<span></span>'}<div class="row"><button class="btn sec" id="er-x">Cancelar</button><button class="btn" id="er-ok">Guardar</button></div></div>`);
  $('#er-x').onclick = m.close;
  $('#er-ok').onclick = async () => {
    const { error } = await sb.from('fiber_routes').update({ name: $('#er-n').value.trim() || r.name, end_a: $('#er-a').value.trim() || null, end_b: $('#er-b').value.trim() || null,
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
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${route.name.replace(/[\\/:*?"<>|]/g, '').slice(0, 100)} - ${todayStr()}.kmz`;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}
