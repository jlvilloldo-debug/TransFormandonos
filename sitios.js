/* =====================================================================
   InspectApp · Transformándonos — v5.11
   SITIOS Y VÍNCULOS: ficha de cada sitio (datos, activos, actividad, proyectos, vínculos),
   exportar a Excel y a KMZ (Google Earth), actualización masiva, cambios en lote y
   vínculos entre dos sitios (microondas, fibra, radio) dibujados en el mapa:
   línea recta, por ruta (servicio de rutas), punto a punto o importando un KMZ de Google Earth.
   Se carga recién al abrirlo. Todo texto que viene de la base pasa por esc().
   ===================================================================== */

const LNK_KIND = { mw: ['📡', 'Microondas', '#7C3AED', '8 6'], fo: ['🧵', 'Fibra óptica', '#F2A93B', null], radio: ['📶', 'Radio', '#0E7490', '3 6'], otro: ['🔗', 'Otro', '#475569', '2 4'] };
const LNK_ST = { planificado: ['Planificado', '#1E40AF'], activo: ['Activo', '#166534'], fuera_servicio: ['Fuera de servicio', '#991B1B'], baja: ['Baja', '#6B7280'] };
const LNK_METHOD = { recta: ['📏', 'Línea recta'], ruta: ['🛣', 'Por ruta'], manual: ['✍', 'Punto a punto'], kmz: ['🌍', 'KMZ de Google Earth'] };
const SITE_TILE = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const sitN = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

function sitCss(){
  if (document.getElementById('sit-css')) return;
  const s = document.createElement('style'); s.id = 'sit-css';
  s.textContent = `
.sit-head{display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap}.sit-ic{width:64px;height:64px;border-radius:14px;display:grid;place-items:center;font-size:30px;color:#fff;flex:none}
.sit-head h1{margin:0;font-size:22px}.sit-sub{color:var(--muted);font-size:14px;margin:4px 0 8px;display:flex;gap:12px;flex-wrap:wrap}
.sit-tabs{display:flex;gap:2px;border-bottom:1px solid var(--line);overflow-x:auto;margin:14px -4px 0}
.sit-tabs button{background:none;border:0;padding:10px 12px;font-size:14px;color:var(--muted);cursor:pointer;border-bottom:3px solid transparent;white-space:nowrap}
.sit-tabs button.on{color:var(--navy);font-weight:700;border-bottom-color:#5B5BD6}
.sit-map{height:300px;border-radius:12px;overflow:hidden}.sit-map.big{height:58vh;min-height:320px}
.sit-dl{display:grid;grid-template-columns:minmax(120px,190px) 1fr;gap:6px 14px;margin:0}.sit-dl dt{color:var(--muted)}.sit-dl dd{margin:0;word-break:break-word}
.sit-ev{display:flex;gap:12px;padding:10px 0;border-bottom:1px solid var(--line)}.sit-ev .i{width:32px;height:32px;border-radius:9px;background:#ECEBFB;display:grid;place-items:center;flex:none}
.lnk-kinds{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;margin:8px 0}
.lnk-kinds button{background:#fff;border:2px solid var(--line);border-radius:12px;padding:8px;cursor:pointer;font-size:13px;text-align:center}.lnk-kinds button b{display:block;font-size:22px}
.lnk-kinds button.on{border-color:var(--navy);background:#EEF2F8}
.lnk-grid{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:14px}.lnk-side{max-height:70vh;overflow:auto;padding-right:4px}
.lnk-info{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;margin:8px 0}.lnk-info div{background:#F5F7FA;border-radius:10px;padding:8px 10px}.lnk-info b{display:block;font-size:18px}.lnk-info span{font-size:12px;color:var(--muted)}
.lnk-prof svg{width:100%;height:auto;background:#F8FAFC;border-radius:10px}
.sit-bulk{position:sticky;bottom:80px;z-index:20;background:var(--navy);color:#fff;border-radius:12px;padding:10px 12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px;box-shadow:0 6px 20px rgba(0,0,0,.25)}
.sit-bulk .btn{margin:0}
.diff s{color:var(--red)}.diff b{color:var(--green-d)}
@media (max-width:820px){.lnk-grid{grid-template-columns:1fr}.lnk-side{max-height:none}.sit-dl{grid-template-columns:1fr}.sit-dl dt{margin-top:6px}}`;
  document.head.appendChild(s);
}

/* ---------- utilidades geográficas ---------- */
const sitRad = d => d * Math.PI / 180;
function sitDist(a, b){ const R = 6371000, dla = sitRad(b[0] - a[0]), dlo = sitRad(b[1] - a[1]); const x = Math.sin(dla / 2) ** 2 + Math.cos(sitRad(a[0])) * Math.cos(sitRad(b[0])) * Math.sin(dlo / 2) ** 2; return 2 * R * Math.asin(Math.min(1, Math.sqrt(x))); }
function sitAz(a, b){ const y = Math.sin(sitRad(b[1] - a[1])) * Math.cos(sitRad(b[0])); const x = Math.cos(sitRad(a[0])) * Math.sin(sitRad(b[0])) - Math.sin(sitRad(a[0])) * Math.cos(sitRad(b[0])) * Math.cos(sitRad(b[1] - a[1])); return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360; }
const sitLen = pts => pts.reduce((s, p, i) => i ? s + sitDist(pts[i - 1], p) : 0, 0);
const sitKm = m => m >= 1000 ? (m / 1000).toLocaleString('es-AR', { maximumFractionDigits: 2 }) + ' km' : Math.round(m) + ' m';
const sitAzTxt = d => `${Math.round(d * 10) / 10}° ${['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'][Math.round(d / 45) % 8]}`;
// simplifica un recorrido largo para poder editarlo a mano (Douglas-Peucker, tolerancia en metros)
function sitSimplify(pts, tol = 15){
  if (pts.length < 3) return pts.slice();
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const segD = (p, a, b) => { const k = Math.cos(sitRad(a[0])) * 111320, ax = a[1] * k, ay = a[0] * 110540, bx = b[1] * k - ax, by = b[0] * 110540 - ay, px = p[1] * k - ax, py = p[0] * 110540 - ay; const L = bx * bx + by * by; const t = L ? Math.max(0, Math.min(1, (px * bx + py * by) / L)) : 0; return Math.hypot(px - t * bx, py - t * by); };
  const st = [[0, pts.length - 1]];
  while (st.length){ const [i, j] = st.pop(); let mx = 0, ix = -1; for (let k = i + 1; k < j; k++){ const d = segD(pts[k], pts[i], pts[j]); if (d > mx){ mx = d; ix = k; } } if (mx > tol){ keep[ix] = 1; st.push([i, ix], [ix, j]); } }
  return pts.filter((_, i) => keep[i]);
}
const sitXml = s => String(s ?? '').replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
const sitKmlColor = hex => { const h = hex.replace('#', ''); return 'ff' + h.slice(4, 6) + h.slice(2, 4) + h.slice(0, 2); };
async function sitKmzSave(name, kml){
  await needLib('jszip'); const z = new JSZip(); z.file('doc.kml', kml);
  const blob = await z.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/vnd.google-earth.kmz' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name.replace(/[^\w\- áéíóúñÁÉÍÓÚÑ]/g, '_').slice(0, 80) + '.kmz'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}
async function sitLinks(){ try { return await cachedQuick('site-links-full', () => pageAll(() => sb.from('site_links').select('*').order('name').order('id'))); } catch { return []; } }
function sitLinkPts(l){ return l.geom?.length > 1 ? l.geom : [[l.a_lat, l.a_lng], [l.b_lat, l.b_lng]]; }
function sitDrawLink(layer, l, onClick){
  const k = LNK_KIND[l.kind] || LNK_KIND.otro, off = ['fuera_servicio', 'baja'].includes(l.status);
  const pl = L.polyline(sitLinkPts(l), { color: off ? '#9CA3AF' : k[2], weight: l.kind === 'fo' ? 4 : 3, opacity: .9, dashArray: k[3] || (l.status === 'planificado' ? '2 6' : null) }).addTo(layer);
  pl.bindTooltip(`${k[0]} ${esc(l.name)} · ${sitKm(Number(l.length_m) || 0)}`, { sticky: true });
  if (onClick) pl.on('click', () => onClick(l));
  return pl;
}

/* =====================================================================
   EXPORTAR SITIOS
   ===================================================================== */
async function siteExportXlsx(list){
  await needLib('xlsx');
  const rows = list.map(s => [s.name, SITE_KINDS[s.kind] || s.kind, s.address || '', s.localidad || '', s.provincia || '', s.grupo || '', s.traza || '', s.lat ?? '', s.lng ?? '', s.node_type ?? '', (s.aliases || []).join(', '), s.active ? 'Sí' : 'No', s.id]);
  const wb = XLSX.utils.book_new(), ws = XLSX.utils.aoa_to_sheet([[...SITE_XL_HEAD, 'Activo', 'ID interno (no tocar)'], ...rows.map(r => r.map(c => typeof c === 'string' && /^[=+\-@]/.test(c) ? "'" + c : c))]);
  ws['!cols'] = [{wch:30},{wch:16},{wch:30},{wch:18},{wch:16},{wch:24},{wch:8},{wch:12},{wch:12},{wch:8},{wch:28},{wch:7},{wch:38}];
  XLSX.utils.book_append_sheet(wb, ws, 'Sitios');
  const wi = XLSX.utils.aoa_to_sheet([['Para actualizar en masa: corregí los datos en esta planilla y subila con "Importar Excel".'], ['La columna "ID interno" identifica cada sitio: no la borres ni la cambies.'], ['Las celdas vacías no borran datos: solo se cambian las que tienen un valor distinto.'], ['Las filas nuevas (sin ID interno) se crean como sitios nuevos.']]);
  wi['!cols'] = [{ wch: 110 }]; XLSX.utils.book_append_sheet(wb, wi, 'Instrucciones');
  XLSX.writeFile(wb, `Sitios_${todayStr()}.xlsx`);
}
async function siteExportKmz(list, links){
  const kinds = [...new Set(list.map(s => s.kind))];
  const style = Object.entries(SITE_COLORS).map(([k, c]) => `<Style id="k_${k}"><IconStyle><color>${sitKmlColor(c)}</color><scale>0.9</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon></IconStyle><LineStyle><color>${sitKmlColor(c)}</color><width>3</width></LineStyle></Style>`).join('')
    + Object.entries(LNK_KIND).map(([k, x]) => `<Style id="l_${k}"><LineStyle><color>${sitKmlColor(x[2])}</color><width>${k === 'fo' ? 4 : 3}</width></LineStyle></Style>`).join('');
  const pm = s => { const d = [SITE_KINDS[s.kind], s.traza ? 'Traza ' + s.traza : '', s.localidad, s.provincia, s.address].filter(Boolean).join(' · ');
    if (s.path?.length > 1) return `<Placemark><name>${sitXml(s.name)}</name><description>${sitXml(d)}</description><styleUrl>#k_${s.kind}</styleUrl><LineString><tessellate>1</tessellate><coordinates>${s.path.map(([x, y]) => `${x},${y},0`).join(' ')}</coordinates></LineString></Placemark>`;
    if (s.lat == null) return '';
    return `<Placemark><name>${sitXml(s.name)}</name><description>${sitXml(d)}</description><styleUrl>#k_${s.kind}</styleUrl><Point><coordinates>${Number(s.lng)},${Number(s.lat)},0</coordinates></Point></Placemark>`; };
  const folders = kinds.map(k => `<Folder><name>${sitXml(SITE_KINDS[k] || k)}</name>${list.filter(s => s.kind === k).map(pm).join('')}</Folder>`).join('');
  const lk = (links || []).length ? `<Folder><name>Vínculos</name>${links.map(l => `<Placemark><name>${sitXml(l.name)}</name><description>${sitXml([LNK_KIND[l.kind]?.[1], LNK_ST[l.status]?.[0], sitKm(Number(l.length_m) || 0)].join(' · '))}</description><styleUrl>#l_${l.kind}</styleUrl><LineString><tessellate>1</tessellate><coordinates>${sitLinkPts(l).map(([la, lo]) => `${lo},${la},0`).join(' ')}</coordinates></LineString></Placemark>`).join('')}</Folder>` : '';
  const kml = `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${sitXml('Sitios ' + todayStr())}</name>${style}${folders}${lk}</Document></kml>`;
  await sitKmzSave(`Sitios_${todayStr()}`, kml);
}

/* =====================================================================
   IMPORTAR / ACTUALIZAR SITIOS DESDE EXCEL
   ===================================================================== */
async function siteImport(file, existing){
  if (!file) return;
  await needLib('xlsx');
  const F = { name: 'Nombre', kind: 'Tipo', address: 'Dirección', localidad: 'Localidad', provincia: 'Provincia', grupo: 'Grupo', traza: 'Traza', lat: 'Latitud', lng: 'Longitud', node_type: 'Tipo de nodo', aliases: 'Otros nombres', active: 'Activo' };
  let rows = [];
  try {
    const wb = await readWorkbook(file);
    const ws = wb.Sheets['Sitios'] || wb.Sheets[wb.SheetNames[0]];
    const data = sheetRows(ws).map(r => r.map(c => c instanceof Date ? dStr(c) : c));
    const hi = data.findIndex(r => r.some(c => norm(c) === 'nombre'));
    if (hi < 0) throw new Error('No encontré la columna "Nombre". Usá el modelo de Excel de sitios.');
    const head = data[hi].map(norm); const col = n => head.findIndex(x => x.startsWith(n));
    const C = { n: col('nombre'), t: col('tipo de nodo') >= 0 ? head.findIndex(x => x === 'tipo') : col('tipo'), a: col('direccion'), loc: col('localidad'), pr: col('provincia'), g: col('grupo'), tr: col('traza'), la: col('latitud'), lo: col('longitud'), nt: col('tipo de nodo'), al: col('otros nombres'), ac: head.findIndex(x => x === 'activo'), id: col('id interno') };
    const g = (r, k) => C[k] >= 0 ? String(r[C[k]] ?? '').trim().replace(/^'/, '') : '';
    const num = v => { const x = Number(String(v).replace(',', '.')); return v === '' || isNaN(x) ? null : x; };
    rows = data.slice(hi + 1).filter(r => g(r, 'n')).slice(0, 20000).map((r, i) => ({ _row: hi + i + 2, _id: /^[0-9a-f-]{36}$/i.test(g(r, 'id')) ? g(r, 'id').toLowerCase() : null,
      name: g(r, 'n').slice(0, 200), kind: g(r, 't') ? siteKind(g(r, 't')) : null, address: g(r, 'a').slice(0, 300) || null, localidad: g(r, 'loc').slice(0, 120) || null, provincia: g(r, 'pr').slice(0, 120) || null,
      grupo: g(r, 'g').slice(0, 120) || null, traza: g(r, 'tr').slice(0, 60) || null, lat: num(g(r, 'la')), lng: num(g(r, 'lo')), node_type: [1, 2, 3, 4].includes(Number(g(r, 'nt'))) ? Number(g(r, 'nt')) : null,
      aliases: g(r, 'al') ? g(r, 'al').split(',').map(x => x.trim().slice(0, 80)).filter(Boolean).slice(0, 20) : null, active: g(r, 'ac') ? /^(si|sí|s|1|true|verdadero)$/i.test(g(r, 'ac')) : null }));
  } catch (e){ return toast('No se pudo leer el Excel: ' + errText(e)); }
  if (!rows.length) return toast('El archivo no tiene sitios.');
  // cómo se reconoce un sitio que ya existe: 1) ID interno (planilla exportada), 2) el nombre (sin mayúsculas ni tildes);
  //   si hay varios sitios con el mismo nombre, desempata el Tipo. El tipo ya no hace falta para reconocerlo y se puede cambiar.
  const byId = new Map(existing.map(s => [s.id, s])), byName = new Map();
  for (const s of existing){ const k = sitN(s.name); if (!byName.has(k)) byName.set(k, []); byName.get(k).push(s); }
  let fixed = 0; const outside = [], nuevos = [], cambios = [], iguales = [], probs = [], seen = new Map();
  for (const r of rows){
    const c = coordCheck(r.lat, r.lng); if (!c.ok){ if (c.fix){ r.lat = c.fix[0]; r.lng = c.fix[1]; fixed++; } else outside.push(r.name); }
    let ex = r._id ? byId.get(r._id) : null;
    if (r._id && !ex){ probs.push([r._row, r.name, 'El ID interno no corresponde a ningún sitio de tu empresa (¿borrado?). No se tocó.']); continue; }
    if (!ex){ const cand = byName.get(sitN(r.name)) || [];
      if (cand.length === 1) ex = cand[0];
      else if (cand.length > 1){ ex = r.kind ? cand.find(s => s.kind === r.kind) : null;
        if (!ex){ probs.push([r._row, r.name, `Hay ${cand.length} sitios con ese nombre (${cand.map(s => SITE_KINDS[s.kind] || s.kind).join(', ')}): completá la columna Tipo o usá la planilla exportada.`]); continue; } } }
    const key = ex ? 'id:' + ex.id : 'n:' + sitN(r.name) + '|' + (r.kind || 'otro');
    if (seen.has(key)){ probs.push([r._row, r.name, `Repetido en la planilla (ya está en la fila ${seen.get(key)}): se tomó solo la primera.`]); continue; }
    seen.set(key, r._row);
    if (!ex){ nuevos.push({ ...r, kind: r.kind || 'otro' }); continue; }
    const patch = {}, diff = [];
    for (const k of Object.keys(F)){ let v = r[k]; if (v == null || v === '' ) continue; if (k === 'name' && !r._id) continue;
      const old = ex[k]; const same = k === 'aliases' ? JSON.stringify(old || []) === JSON.stringify(v) : (k === 'lat' || k === 'lng') ? Math.abs(Number(old) - Number(v)) < 1e-7 : String(old ?? '') === String(v);
      if (!same){ patch[k] = v; diff.push([F[k], k === 'kind' ? SITE_KINDS[old] : k === 'active' ? (old ? 'Sí' : 'No') : Array.isArray(old) ? old.join(', ') : old, k === 'kind' ? SITE_KINDS[v] : k === 'active' ? (v ? 'Sí' : 'No') : Array.isArray(v) ? v.join(', ') : v]); } }
    if (diff.length) cambios.push({ ex, patch, diff, row: r._row }); else iguales.push(ex);
  }
  const probHTML = list => `<div class="tblwrap" style="max-height:200px;overflow:auto"><table class="tbl"><thead><tr><th>Fila</th><th>Sitio</th><th>Motivo</th></tr></thead><tbody>${list.slice(0, 300).map(([f, n, why]) => `<tr><td>${f || '—'}</td><td>${esc(n)}</td><td class="sm">${esc(why)}</td></tr>`).join('')}</tbody></table></div>`;
  const m = modal(`<h2>Importar sitios</h2>
    <div class="stk-kpis" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px"><div class="card" style="margin:0;padding:10px"><span class="muted sm">✨ Nuevos</span><b style="display:block;font-size:24px">${nuevos.length}</b></div>
      <div class="card" style="margin:0;padding:10px"><span class="muted sm">🔄 Con cambios</span><b style="display:block;font-size:24px">${cambios.length}</b></div><div class="card" style="margin:0;padding:10px"><span class="muted sm">= Sin cambios</span><b style="display:block;font-size:24px">${iguales.length}</b></div></div>
    ${fixed ? `<div class="banner trial" style="margin:8px 0"><span class="dot"></span><div><b>Se corrigieron ${fixed} coordenada${fixed === 1 ? '' : 's'}</b> que venían sin el signo menos o invertidas.</div></div>` : ''}
    ${outside.length ? `<div class="banner warn" style="margin:8px 0"><span class="dot"></span><div><b>${outside.length} con coordenadas fuera de ${COORD_BOX.name}</b>: ${outside.slice(0, 8).map(esc).join(', ')}${outside.length > 8 ? '…' : ''}.</div></div>` : ''}
    ${cambios.length ? `<h3 style="margin:12px 0 6px">Cambios</h3><label style="display:flex;gap:8px;align-items:center;font-weight:400"><input type="checkbox" id="sx-upd" checked style="width:auto"> Actualizar los ${cambios.length} sitios que cambian</label>
      <div class="tblwrap diff" style="max-height:240px;overflow:auto"><table class="tbl"><tbody>${cambios.slice(0, 150).map(c => `<tr><td><b>${esc(c.ex.name)}</b></td><td class="sm">${c.diff.map(([f, o, n]) => `${esc(f)}: <s>${esc(o ?? '—')}</s> → <b>${esc(n)}</b>`).join('<br>')}</td></tr>`).join('')}</tbody></table></div>` : ''}
    ${probs.length ? `<h3 style="margin:12px 0 6px;color:#B45309">⚠️ Filas que no se van a cargar (${probs.length})</h3>${probHTML(probs)}` : ''}
    ${nuevos.length ? `<h3 style="margin:12px 0 6px">Nuevos</h3><div class="tblwrap" style="max-height:180px;overflow:auto"><table class="tbl"><tbody>${nuevos.slice(0, 80).map(r => `<tr><td>${esc(r.name)}</td><td class="sm">${SITE_KINDS[r.kind]}</td><td class="sm">${esc([r.localidad, r.grupo].filter(Boolean).join(' · '))}</td></tr>`).join('')}</tbody></table></div>` : ''}
    <p class="muted sm">Las celdas vacías no borran datos. Cada sitio se reconoce por la columna "ID interno" (si la planilla viene de ⬇ Excel) o por el <b>nombre</b>; podés subir la misma planilla las veces que quieras: solo se cambia lo distinto.</p>
    <div class="progress hidden" id="sx-pg" style="height:10px"><i style="width:0"></i></div><div class="err" id="sx-err"></div>
    <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn sec" id="sx-x">Cancelar</button><button class="btn" id="sx-go" ${nuevos.length || cambios.length ? '' : 'disabled'}>Guardar</button></div>`, { wide: true });
  $('#sx-x').onclick = m.close;
  $('#sx-go').onclick = async () => {
    const upd = cambios.length && $('#sx-upd')?.checked ? cambios : [], tot = nuevos.length + upd.length; let done = 0, okN = 0, okU = 0; const errs = [];
    $('#sx-go').disabled = true; $('#sx-x').disabled = true; $('#sx-pg').classList.remove('hidden'); const bar = $('#sx-pg i');
    const why = e => /duplicate|unique|23505/i.test((e && (e.message || '') + (e.code || '')) || '') ? 'Ya hay otro sitio con ese nombre y ese tipo.' : errText(e);
    const toRow = ({ _row, _id, active, ...r }) => ({ ...r, aliases: r.aliases || [], active: active ?? true, org_id: me.org_id });
    const step = () => { bar.style.width = Math.round(done * 100 / Math.max(1, tot)) + '%'; };
    try {
      for (let i = 0; i < nuevos.length; i += 100){
        const part = nuevos.slice(i, i + 100);
        const { error } = await sb.from('sites').insert(part.map(toRow));
        if (!error) okN += part.length;
        else if (isNetErr(error)) throw error;
        else for (const r of part){ const { error: e1 } = await sb.from('sites').insert(toRow(r)); if (e1){ if (isNetErr(e1)) throw e1; errs.push([r._row, r.name, why(e1)]); } else okN++; }
        done += part.length; step();
      }
      for (const c of upd){ const { error } = await sb.from('sites').update(c.patch).eq('id', c.ex.id);
        if (error){ if (isNetErr(error)) throw error; errs.push([c.row, c.ex.name, why(error)]); } else okU++;
        done++; if (done % 10 === 0) step(); }
    } catch (e){ errs.push([null, '—', 'Se cortó la conexión: ' + errText(e) + '. Volvé a subir la planilla: lo que ya se guardó no se duplica.']); }
    try { await IDB.del('kv', CUR_UID + ':sites-all'); await IDB.del('kv', CUR_UID + ':sites-map'); await IDB.del('kv', CUR_UID + ':sites-min2'); } catch {}
    m.close();
    await route();
    const all = [...probs, ...errs];
    const r = modal(`<div style="text-align:center"><div style="font-size:42px">${all.length ? '📋' : '✅'}</div><h2 style="margin:4px 0">Importación terminada</h2></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:10px 0"><div class="card" style="margin:0;padding:10px;text-align:center"><span class="muted sm">✨ Creados</span><b style="display:block;font-size:24px">${okN}</b></div>
        <div class="card" style="margin:0;padding:10px;text-align:center"><span class="muted sm">🔄 Actualizados</span><b style="display:block;font-size:24px">${okU}</b></div>
        <div class="card" style="margin:0;padding:10px;text-align:center"><span class="muted sm">⚠️ No cargados</span><b style="display:block;font-size:24px;color:${all.length ? '#B45309' : 'inherit'}">${all.length}</b></div></div>
      ${all.length ? probHTML(all) : ''}
      <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn" data-close-modal>Listo</button></div>`, { wide: true });
  };
}

/* ---------- cambios en lote desde la lista ---------- */
function siteBulk(ids, sites){
  const list = sites.filter(s => ids.includes(s.id));
  const trazas = [...new Set(sites.map(s => s.traza).filter(Boolean))], grupos = [...new Set(sites.map(s => s.grupo).filter(Boolean))];
  const m = modal(`<h2>✏️ Cambiar ${list.length} sitio${list.length === 1 ? '' : 's'}</h2><p class="muted sm">Completá solo lo que querés cambiar; lo que dejes vacío no se toca.</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 10px">
      <div><label>Tipo</label><select id="sb-k"><option value="">— Sin cambio —</option>${Object.entries(SITE_KINDS).map(([k, t]) => `<option value="${k}">${t}</option>`).join('')}</select></div>
      <div><label>Estado</label><select id="sb-a"><option value="">— Sin cambio —</option><option value="1">Activo</option><option value="0">Inactivo</option></select></div>
      <div><label>Traza</label><input id="sb-t" maxlength="60" list="sb-tl"><datalist id="sb-tl">${trazas.map(t => `<option value="${esc(t)}">`).join('')}</datalist></div>
      <div><label>Grupo / contrato</label><input id="sb-g" maxlength="120" list="sb-gl"><datalist id="sb-gl">${grupos.map(t => `<option value="${esc(t)}">`).join('')}</datalist></div>
      <div><label>Localidad</label><input id="sb-l" maxlength="120"></div><div><label>Provincia</label><input id="sb-p" maxlength="120"></div></div>
    <div class="err" id="sb-err"></div><div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn sec" id="sb-x">Cancelar</button><button class="btn" id="sb-ok">Aplicar a ${list.length}</button></div>`);
  $('#sb-x').onclick = m.close;
  $('#sb-ok').onclick = async () => {
    const p = {}; const v = id => $(id).value.trim();
    if (v('#sb-k')) p.kind = v('#sb-k'); if (v('#sb-a')) p.active = v('#sb-a') === '1'; if (v('#sb-t')) p.traza = v('#sb-t'); if (v('#sb-g')) p.grupo = v('#sb-g'); if (v('#sb-l')) p.localidad = v('#sb-l'); if (v('#sb-p')) p.provincia = v('#sb-p');
    if (!Object.keys(p).length) return void ($('#sb-err').textContent = 'No elegiste ningún cambio.');
    $('#sb-ok').disabled = true;
    try { for (let i = 0; i < ids.length; i += 100){ const { error } = await sb.from('sites').update(p).in('id', ids.slice(i, i + 100)); if (error) throw error; }
      m.close(); toast(`Listo: ${ids.length} sitio${ids.length === 1 ? '' : 's'} actualizado${ids.length === 1 ? '' : 's'}`); try { await IDB.del('kv', CUR_UID + ':sites-all'); await IDB.del('kv', CUR_UID + ':sites-map'); } catch {} route(); }
    catch (e){ $('#sb-err').textContent = /duplicate|unique/i.test(e.message || '') ? 'Ya hay otro sitio con ese nombre y ese tipo: no se puede cambiar el tipo así.' : errText(e); $('#sb-ok').disabled = false; }
  };
}

/* =====================================================================
   FICHA DEL SITIO  #/sitio/<id>
   ===================================================================== */
const SIT_TABS = [['res', 'Resumen'], ['act', 'Activos'], ['hist', 'Actividad'], ['proj', 'Proyectos'], ['lnk', 'Vínculos']];
let sitMap = null;
async function viewSite(v, id){
  sitCss();
  const sites = await loadSitesAll();
  const s = sites.find(x => x.id === id); if (!s) throw new Error('No se encontró el sitio.');
  const manage = isManager() && canWrite() && online();
  const col = SITE_COLORS[s.kind] || '#475569';
  v.innerHTML = `<div class="row" style="gap:8px;margin-bottom:10px"><a href="#/sites">← Sitios</a><span class="muted">›</span><span>${esc(s.name)}</span></div>
    <div class="card" style="padding-bottom:0"><div class="sit-head"><div class="sit-ic" style="background:${col}">${s.kind === 'deposito' ? '🏬' : s.kind === 'contratista' ? '🚚' : s.kind === 'escuela' ? '🏫' : s.kind === 'radioenlace' || s.kind === 'repetidora' ? '📡' : '📍'}</div>
      <div style="flex:1;min-width:200px"><h1>${esc(s.name)}</h1><div class="sit-sub"><span><span class="kind-dot" style="background:${col}"></span>${esc(SITE_KINDS[s.kind] || s.kind)}</span>${s.traza ? `<span>Traza ${esc(s.traza)}</span>` : ''}${s.localidad || s.provincia ? `<span>📍 ${esc([s.localidad, s.provincia].filter(Boolean).join(', '))}</span>` : ''}${s.active ? '' : '<span class="pill p-bad">Inactivo</span>'}</div></div>
      <div class="row" style="gap:6px;flex-wrap:wrap">${s.lat != null ? `<a class="btn sec small" target="_blank" rel="noopener noreferrer" href="${mapsLink(s.lat, s.lng)}">🧭 Cómo llegar</a>` : ''}${manage ? `<button class="btn sec small" id="st-lnk">🔗 + Vínculo</button><button class="btn small" id="st-ed">✏️ Editar</button>` : ''}</div></div>
      <div class="sit-tabs" id="st-tabs">${SIT_TABS.map(([k, t]) => `<button data-t="${k}">${t}</button>`).join('')}</div></div>
    <div id="st-body" style="margin-top:12px"></div>`;
  $('#st-ed')?.addEventListener('click', () => editSite(s));
  $('#st-lnk')?.addEventListener('click', () => linkEditor(null, { a: s.id }));
  const show = async k => { try { localStorage.setItem('ia_sittab', k); } catch {} $$('#st-tabs [data-t]').forEach(b => b.classList.toggle('on', b.dataset.t === k));
    const b = $('#st-body'); b.innerHTML = '<div class="card muted">Cargando…</div>';
    try { await ({ res: sitTabRes, act: sitTabAssets, hist: sitTabHist, proj: sitTabProj, lnk: sitTabLinks }[k])(b, s, sites); } catch (e){ b.innerHTML = `<div class="card">${esc(errText(e))}</div>`; } };
  $$('#st-tabs [data-t]').forEach(b => b.onclick = () => show(b.dataset.t));
  let t0 = 'res'; try { t0 = localStorage.getItem('ia_sittab') || 'res'; } catch {}
  show(SIT_TABS.some(x => x[0] === t0) ? t0 : 'res');
}
async function sitTabRes(box, s, sites){
  const links = (await sitLinks()).filter(l => l.site_a === s.id || l.site_b === s.id);
  const rows = [['Tipo', SITE_KINDS[s.kind]], ['Dirección', s.address], ['Localidad', s.localidad], ['Provincia', s.provincia], ['Grupo / contrato', s.grupo], ['Traza', s.traza], ['Tipo de nodo', s.node_type], ['Coordenadas', s.lat != null ? `${Number(s.lat).toFixed(6)}, ${Number(s.lng).toFixed(6)}` : null], ['Otros nombres', (s.aliases || []).join(', ')], ['Notas', s.notes]];
  const cc = coordCheck(s.lat, s.lng);
  box.innerHTML = `<div class="chart-grid"><div class="card"><h2 style="margin-top:0">Datos</h2>${cc.ok ? '' : `<div class="banner warn" style="margin-bottom:8px"><span class="dot"></span><div>La coordenada ${esc(cc.why)}${cc.fix ? `: ¿es ${coordTxt(cc.fix[0], cc.fix[1])}?` : '.'}</div></div>`}
      <dl class="sit-dl">${rows.map(([k, x]) => `<dt>${esc(k)}</dt><dd>${x ? esc(x) : '<span class="muted">—</span>'}</dd>`).join('')}</dl></div>
    <div class="card"><h2 style="margin-top:0">Mapa</h2><div class="sit-map" id="st-map"></div>${links.length ? `<p class="muted sm">${links.length} vínculo${links.length === 1 ? '' : 's'} desde este sitio.</p>` : ''}</div></div>`;
  if (!window.L || (s.lat == null && !s.path)) { $('#st-map').innerHTML = '<p class="muted" style="padding:20px">Sin coordenadas cargadas.</p>'; return; }
  if (sitMap){ try { sitMap.remove(); } catch {} sitMap = null; }
  sitMap = L.map('st-map', { preferCanvas: true }); L.tileLayer(SITE_TILE, { maxZoom: 18, attribution: '© OpenStreetMap' }).addTo(sitMap);
  const g = L.featureGroup().addTo(sitMap);
  if (s.path?.length > 1) L.polyline(s.path.map(([x, y]) => [y, x]), { color: SITE_COLORS[s.kind], weight: 4 }).addTo(g);
  else L.circleMarker([s.lat, s.lng], { radius: 9, color: '#fff', weight: 2, fillColor: SITE_COLORS[s.kind], fillOpacity: 1 }).addTo(g).bindTooltip(esc(s.name), { permanent: true, direction: 'top', offset: [0, -8] });
  const byId = new Map(sites.map(x => [x.id, x]));
  links.forEach(l => { sitDrawLink(g, l, x => linkEditor(x)); const o = byId.get(l.site_a === s.id ? l.site_b : l.site_a); if (o?.lat != null) L.circleMarker([o.lat, o.lng], { radius: 6, color: '#fff', weight: 1.5, fillColor: SITE_COLORS[o.kind], fillOpacity: 1 }).addTo(g).bindTooltip(esc(o.name)); });
  sitMap.fitBounds(g.getBounds(), { padding: [30, 30], maxZoom: 15 });
}
async function sitTabAssets(box, s){
  if (!(typeof can === 'function' && can('stock'))){ box.innerHTML = '<div class="card muted">No tenés acceso a Activos y stock.</div>'; return; }
  await needLib('stock'); stkCss(); await stkLoadBase(true);
  const B = STK.base, sc = { kind: 'site', id: s.id }, list = B.assets.filter(a => !a.archived && stkInScope(a, sc));
  const places = B.places.filter(p => p.site_id === s.id && p.active);
  const bal = stkBalances().filter(b => B.placeById.get(b.place)?.site_id === s.id && b.qty > 0);
  const st = new Map(); list.forEach(a => st.set(a.status, (st.get(a.status) || 0) + 1));
  box.innerHTML = `<div class="stk-kpis"><div class="stk-kpi"><span>📡 Equipos</span><b>${list.filter(a => a.cat === 'equipo').length}</b></div><div class="stk-kpi" style="border-left-color:#92400E"><span>🧰 Herramientas</span><b>${list.filter(a => a.cat === 'herramienta').length}</b></div>
      <div class="stk-kpi" style="border-left-color:#0E7490"><span>🧵 Materiales</span><b>${new Set(bal.map(b => b.item)).size}</b></div>${places.length ? `<div class="stk-kpi" style="border-left-color:#B45309"><span>🏬 Lugares de stock acá</span><b>${places.length}</b><small>${places.map(p => esc(p.name)).join(', ')}</small></div>` : ''}</div>
    ${st.size ? `<div class="card"><div class="stk-leg">${[...st.entries()].map(([k, n]) => `<span>${stkStPill(k)} <b>${n}</b></span>`).join('')}</div></div>` : ''}
    <div class="card"><div class="row between"><h2 style="margin:0">Activos en este sitio</h2><a class="btn sec small" href="#/stock/s/${s.id}" style="margin:0">Abrir en Activos y stock →</a></div>
    ${list.length ? `<div class="tblwrap" style="margin-top:10px"><table class="tbl"><thead><tr><th></th><th>Nombre / ID único</th><th>Tipo</th><th>Estado</th><th>Stock</th></tr></thead><tbody>${list.map(a => `<tr class="click" data-a="${a.id}"><td style="font-size:20px">${a.cat === 'herramienta' ? '🧰' : '📡'}</td><td><b>${esc(a.name || a.type)}</b><div class="muted sm">${esc(a.code)}${a.vendor ? ' · ' + esc([a.vendor, a.model].filter(Boolean).join(' ')) : ''}</div></td><td>${esc(a.type)}</td><td>${stkStPill(a.status)}</td><td class="sm">${a.project_id ? '📁 ' + esc(stkProjName(a.project_id)) : '🏢 General'}</td></tr>`).join('')}</tbody></table></div>`
      : '<div class="empty">No hay activos registrados en este sitio.</div>'}
    ${bal.length ? `<h3 style="margin:14px 0 6px">Materiales</h3>${bal.map(b => `<span class="pill" style="background:#ECFEFF;color:#0E7490;margin:2px">${esc(B.itemById.get(b.item)?.name || '?')} · ${stkFmtQty(b.qty)} ${esc(B.itemById.get(b.item)?.unit || '')}</span>`).join('')}` : ''}</div>`;
  box.querySelectorAll('[data-a]').forEach(tr => tr.onclick = () => { location.hash = '#/stock/a/' + tr.dataset.a; });
}
async function sitTabHist(box, s){
  const [ins, tks, tasks] = await Promise.all([
    cached('st-ins:' + s.id, () => sb.from('inspections').select('id,template_name,started_at,completed_at,status,score,max_score,flagged,inspector_name').eq('site_id', s.id).order('started_at', { ascending: false }).limit(200)).catch(() => []),
    cached('st-tk:' + s.id, () => sb.from('tickets').select('id,ext_no,problem,category,status,created_at').eq('site_id', s.id).order('created_at', { ascending: false }).limit(200)).catch(() => []),
    (typeof loadAllTasks === 'function' ? loadAllTasks() : Promise.resolve([])).catch(() => [])]);
  const ev = [...ins.map(i => ({ ic: '📋', at: i.completed_at || i.started_at, t: i.template_name || 'Inspección', d: [i.status, i.max_score ? `Puntaje ${Math.round(i.score * 100 / i.max_score)}%` : '', i.flagged ? i.flagged + ' señalados' : '', i.inspector_name].filter(Boolean).join(' · '), href: i.status === 'completada' ? '#/informe/' + i.id : '#/insp/' + i.id })),
    ...tks.map(t => ({ ic: '🎫', at: t.created_at, t: `Ticket ${t.ext_no || ''} · ${t.problem || t.category || ''}`, d: t.status, href: '#/tickets/' + t.id })),
    ...tasks.filter(t => (t.sites || []).some(x => x.site_id === s.id)).map(t => ({ ic: '☑', at: t.completed_at || t.created_at, t: t.title, d: (typeof TASK_ST !== 'undefined' && TASK_ST[t.status]) || t.status, href: '#/tasks/' + t.id }))]
    .filter(e => e.at).sort((a, b) => (b.at > a.at ? 1 : -1));
  box.innerHTML = `<div class="card"><h2 style="margin-top:0">Actividad del sitio</h2><p class="muted sm">${ins.length} inspecciones · ${tks.length} tickets · ${ev.filter(e => e.ic === '☑').length} tareas</p>
    ${ev.length ? ev.slice(0, 300).map(e => `<a class="sit-ev" href="${esc(e.href)}" style="text-decoration:none;color:inherit"><div class="i">${e.ic}</div><div><div class="muted sm">${fmtDT(e.at)}</div><b>${esc(e.t)}</b><div class="muted sm">${esc(e.d || '')}</div></div></a>`).join('') : '<div class="empty">Todavía no hay actividad registrada.</div>'}</div>`;
}
async function sitTabProj(box, s){
  const [pss, projects, contrs] = await Promise.all([cached('st-ps:' + s.id, () => sb.from('project_sites').select('id,project_id,stage,contractor_id,updated_at').eq('site_id', s.id)).catch(() => []), loadProjects().catch(() => []), loadContractors().catch(() => [])]);
  const pj = new Map(projects.map(p => [p.id, p]));
  const rows = pss.filter(x => pj.has(x.project_id));
  box.innerHTML = `<div class="card"><h2 style="margin-top:0">Proyectos</h2>${rows.length ? `<div class="tblwrap"><table class="tbl"><thead><tr><th>Proyecto</th><th>Etapa</th><th>Contratista</th></tr></thead><tbody>${rows.map(x => { const p = pj.get(x.project_id); const st = p.stages || [], ix = st.indexOf(x.stage);
    return `<tr class="click" data-p="${p.id}"><td><b>${esc(p.name)}</b>${p.client ? `<div class="muted sm">${esc(p.client)}</div>` : ''}</td><td><span class="pill p-info">${esc(x.stage || '—')}</span>${st.length ? `<div class="progress" style="height:6px;margin-top:4px;max-width:160px"><i style="width:${Math.round((ix + 1) * 100 / st.length)}%"></i></div>` : ''}</td><td class="sm">${esc(contrs.find(c => c.id === x.contractor_id)?.name || '—')}</td></tr>`; }).join('')}</tbody></table></div>`
    : '<div class="empty">Este sitio no está en ningún proyecto que puedas ver.</div>'}</div>`;
  box.querySelectorAll('[data-p]').forEach(tr => tr.onclick = () => { location.hash = '#/proj/' + tr.dataset.p; });
}
async function sitTabLinks(box, s){
  const links = (await sitLinks()).filter(l => l.site_a === s.id || l.site_b === s.id);
  box.innerHTML = `<div class="card"><div class="row between"><h2 style="margin:0">Vínculos</h2>${isManager() && canWrite() ? '<button class="btn small" id="st-nl">🔗 + Vínculo</button>' : ''}</div>${sitLinksTable(links)}</div>`;
  $('#st-nl')?.addEventListener('click', () => linkEditor(null, { a: s.id }));
  sitBindLinksTable(box, links);
}
function sitLinksTable(links){
  return links.length ? `<div class="tblwrap" style="margin-top:10px"><table class="tbl"><thead><tr><th></th><th>Vínculo</th><th>Largo</th><th>Estado</th><th class="hide-sm">Método</th></tr></thead><tbody>${links.map(l => { const k = LNK_KIND[l.kind] || LNK_KIND.otro, st = LNK_ST[l.status] || LNK_ST.activo;
    return `<tr class="click" data-l="${l.id}"><td style="font-size:20px">${k[0]}</td><td><b>${esc(l.name)}</b>${l.topology === 'ptmp' ? ` <span class="pill p-info" title="Punto a multipunto">✳ ${esc(l.group_name || 'PtMP')}</span>` : ''}<div class="muted sm">${k[1]}${l.band ? ' · ' + esc(l.band) : ''}${l.capacity ? ' · ' + esc(l.capacity) : ''}${l.traza ? ' · Traza ' + esc(l.traza) : ''}</div></td><td>${sitKm(Number(l.length_m) || 0)}</td>
      <td><span class="pill" style="background:${st[1]}22;color:${st[1]}">${st[0]}</span></td><td class="hide-sm sm">${LNK_METHOD[l.method]?.[0] || ''} ${LNK_METHOD[l.method]?.[1] || ''}</td></tr>`; }).join('')}</tbody></table></div>` : '<div class="empty">Todavía no hay vínculos.</div>';
}
function sitBindLinksTable(box, links){ box.querySelectorAll('[data-l]').forEach(tr => tr.onclick = () => linkEditor(links.find(l => l.id === tr.dataset.l))); }

/* =====================================================================
   VÍNCULOS  #/vinc
   ===================================================================== */
let lnkMap = null;
async function viewLinks(v){
  sitCss();
  const [links, sites] = await Promise.all([sitLinks(), loadSitesAll()]);
  const manage = isManager() && canWrite() && online();
  const tot = k => links.filter(l => l.kind === k).reduce((s, l) => s + (Number(l.length_m) || 0), 0);
  v.innerHTML = `<div class="card"><div class="row between" style="flex-wrap:wrap;gap:8px"><div><h2 style="margin:0">🔗 Vínculos</h2><p class="muted sm" style="margin:4px 0 0">Enlaces entre sitios: microondas, fibra óptica y radio, punto a punto o punto a multipunto (una base con varios remotos). Tocá una línea del mapa para modificarla, corregirla o borrarla.</p></div>
      <div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn sec" id="lk-kmz">🌍 Exportar KMZ</button><button class="btn sec" id="lk-xls">⬇ Excel</button>${manage ? '<button class="btn" id="lk-new">+ Vínculo</button>' : ''}</div></div>
    <div class="lnk-info">${Object.entries(LNK_KIND).filter(([k]) => links.some(l => l.kind === k) || k === 'mw' || k === 'fo').map(([k, x]) => `<div><span>${x[0]} ${x[1]}</span><b>${links.filter(l => l.kind === k).length}</b><span>${sitKm(tot(k))}</span></div>`).join('')}</div>
    <div class="row" style="gap:6px;flex-wrap:wrap;margin-top:6px"><input id="lk-q" placeholder="🔍 Buscar vínculo o sitio" style="max-width:280px"><select id="lk-k" style="width:auto"><option value="">Todos los tipos</option>${Object.entries(LNK_KIND).map(([k, x]) => `<option value="${k}">${x[0]} ${x[1]}</option>`).join('')}</select>
      <select id="lk-s" style="width:auto"><option value="">Todos los estados</option>${Object.entries(LNK_ST).map(([k, x]) => `<option value="${k}">${x[0]}</option>`).join('')}</select></div></div>
    <div class="card"><div class="sit-map big" id="lk-map"></div><div class="row sm muted" style="margin-top:8px;gap:14px">${Object.values(LNK_KIND).map(x => `<span><svg width="26" height="8"><line x1="0" y1="4" x2="26" y2="4" stroke="${x[2]}" stroke-width="3" ${x[3] ? `stroke-dasharray="${x[3]}"` : ''}/></svg> ${x[1]}</span>`).join('')}<span><svg width="26" height="8"><line x1="0" y1="4" x2="26" y2="4" stroke="#9CA3AF" stroke-width="3"/></svg> Fuera de servicio / baja</span></div></div>
    <div class="card" id="lk-list"></div>`;
  if (lnkMap){ try { lnkMap.remove(); } catch {} lnkMap = null; }
  let layer = null;
  if (window.L){ lnkMap = L.map('lk-map', { preferCanvas: false }).setView([-31, -61], 6); L.tileLayer(SITE_TILE, { maxZoom: 18, attribution: '© OpenStreetMap' }).addTo(lnkMap); }
  const sById = new Map(sites.map(s => [s.id, s]));
  let shown = links;
  const draw = () => {
    const q = sitN($('#lk-q').value), k = $('#lk-k').value, st = $('#lk-s').value;
    shown = links.filter(l => (!k || l.kind === k) && (!st || l.status === st) && (!q || sitN([l.name, l.band, l.traza, l.group_name, l.link_ref, sById.get(l.site_a)?.name, sById.get(l.site_b)?.name].join(' ')).includes(q)));
    $('#lk-list').innerHTML = `<h2 style="margin-top:0">${shown.length} vínculo${shown.length === 1 ? '' : 's'}</h2>` + sitLinksTable(shown);
    sitBindLinksTable($('#lk-list'), shown);
    if (lnkMap){ if (layer) layer.remove(); layer = L.featureGroup().addTo(lnkMap);
      const ends = new Set(); shown.forEach(l => { linkLine(layer, l, lnkMap); [l.site_a, l.site_b].forEach(x => x && ends.add(x)); });
      ends.forEach(id => { const s = sById.get(id); if (s?.lat != null) L.circleMarker([s.lat, s.lng], { radius: 5, color: '#fff', weight: 1.5, fillColor: SITE_COLORS[s.kind], fillOpacity: 1 }).addTo(layer).bindTooltip(esc(s.name)); });
      if (layer.getLayers().length) lnkMap.fitBounds(layer.getBounds(), { padding: [30, 30], maxZoom: 13 }); }
  };
  $('#lk-q').oninput = draw; $('#lk-k').onchange = draw; $('#lk-s').onchange = draw; draw();
  $('#lk-new')?.addEventListener('click', () => linkEditor(null));
  $('#lk-kmz').onclick = () => siteExportKmz(sites.filter(s => shown.some(l => l.site_a === s.id || l.site_b === s.id)), shown).catch(e => toast(errText(e)));
  $('#lk-xls').onclick = () => xlSave(`Vinculos ${todayStr()}`, [['Vínculos', [['Nombre', 'Tipo', 'Estado', 'Sitio A', 'Sitio B', 'Largo (m)', 'Método', 'Banda', 'Frecuencia (MHz)', 'Capacidad', 'Altura A (m)', 'Altura B (m)', 'Traza', 'Notas'],
    ...shown.map(l => [l.name, LNK_KIND[l.kind]?.[1], LNK_ST[l.status]?.[0], sById.get(l.site_a)?.name || `${l.a_lat}, ${l.a_lng}`, sById.get(l.site_b)?.name || `${l.b_lat}, ${l.b_lng}`, Number(l.length_m) || 0, LNK_METHOD[l.method]?.[1], l.band || '', l.freq_mhz ?? '', l.capacity || '', l.h_a ?? '', l.h_b ?? '', l.traza || '', l.notes || ''])], [34, 14, 14, 28, 28, 10, 16, 10, 10, 12, 8, 8, 16, 40]]]);
}

/* ---------- editor de vínculo ---------- */
async function linkEditor(l, preset = {}){
  sitCss();
  const sites = (await loadSitesAll()).filter(s => s.lat != null);
  const sById = new Map(sites.map(s => [s.id, s]));
  const w = isManager() && canWrite() && online(), isNew = !l;
  const st = { kind: l?.kind || preset.kind || 'mw', method: l?.method || 'recta', A: null, B: null, aSite: l?.site_a || preset.a || null, bSite: l?.site_b || null, pts: l?.geom?.length > 1 ? l.geom.map(p => [p[0], p[1]]) : [], via: [], pick: null,
    topo: isNew && preset.ptmp ? 'ptmp' : 'ptp', rem: [], group: preset.group || null };
  const C0 = l || preset.cfg || {};   // datos de radio de partida (al sumar remotos se copian los del multipunto)
  const isR = () => ['mw', 'radio'].includes(st.kind), isM = () => isNew && st.topo === 'ptmp' && isR();
  const setEnd = (k, siteId, ll) => { const s = siteId && sById.get(siteId); st[k] = s ? [s.lat, s.lng] : ll || null; st[k === 'A' ? 'aSite' : 'bSite'] = s ? s.id : null; };
  if (l){ st.A = [l.a_lat, l.a_lng]; st.B = [l.b_lat, l.b_lng]; } else { setEnd('A', st.aSite); }
  const siteOpts = cur => `<option value="">— Elegí un sitio —</option>${sites.map(s => `<option value="${s.id}" ${s.id === cur ? 'selected' : ''}>${esc(s.name)}${s.localidad && s.localidad !== s.name ? ' · ' + esc(s.localidad) : ''}</option>`).join('')}`;
  const k0 = LNK_KIND[st.kind];
  const m = modal(`<div class="row between"><h2 style="margin:0">${isNew ? '🔗 Nuevo vínculo' : `${k0[0]} ${esc(l.name)}`}</h2><button class="btn sec small" id="le-x">Cerrar</button></div>
    <div class="lnk-grid" style="margin-top:10px"><div><div class="sit-map big" id="le-map"></div><div class="muted sm" id="le-hint" style="margin-top:6px"></div></div>
    <div class="lnk-side">
      <div class="lnk-kinds">${Object.entries(LNK_KIND).map(([k, x]) => `<button type="button" data-k="${k}" ${w ? '' : 'disabled'}><b>${x[0]}</b>${x[1]}</button>`).join('')}</div>
      ${isNew && w ? `<div class="lnk-kinds le-r" id="le-topo" style="margin-top:8px"><button type="button" data-tp="ptp"><b>↔</b>Punto a punto</button><button type="button" data-tp="ptmp"><b>✳</b>Punto a multipunto</button></div>` : ''}
      ${!isNew && l.topology === 'ptmp' ? `<div class="banner trial" style="margin:8px 0"><span class="dot"></span><div style="flex:1"><b>✳ Parte del multipunto ${esc(l.group_name || '')}</b><div class="sm">Acá editás este remoto. La base es el Sitio A.</div></div>${w ? '<button class="btn small sec" id="le-more" type="button">+ Remotos</button>' : ''}</div>` : ''}
      <label id="le-la">Sitio A</label><div class="row" style="gap:6px;flex-wrap:nowrap"><select id="le-a" style="flex:1" ${w ? '' : 'disabled'}>${siteOpts(st.aSite)}</select>${w ? '<button class="btn sec small" id="le-pa" title="Tocar en el mapa" style="margin:0">📍</button>' : ''}</div>
      <div id="le-bw"><label>Sitio B</label><div class="row" style="gap:6px;flex-wrap:nowrap"><select id="le-b" style="flex:1" ${w ? '' : 'disabled'}>${siteOpts(st.bSite)}</select>${w ? '<button class="btn sec small" id="le-pb" title="Tocar en el mapa" style="margin:0">📍</button>' : ''}</div></div>
      <div id="le-pm" class="hidden">
        <label>Remotos <span class="muted" id="le-rc"></span></label>
        <select id="le-ra"><option value="">+ Agregar un remoto</option>${sites.map(s => `<option value="${s.id}">${esc(s.name)}${s.localidad && s.localidad !== s.name ? ' · ' + esc(s.localidad) : ''}</option>`).join('')}</select>
        <div class="row" style="gap:6px;margin-top:6px;flex-wrap:nowrap;align-items:center"><span class="sm">o todos los sitios a menos de</span><input id="le-rk" type="number" min="1" max="100" value="10" style="width:74px"><span class="sm">km</span><button class="btn sec small" id="le-rn" type="button" style="margin:0">Agregar</button></div>
        <p class="muted sm" style="margin:4px 0">También podés tocar un sitio en el mapa para sumarlo o quitarlo.</p>
        <div id="le-rl" style="max-height:190px;overflow:auto"></div>
        <label>Nombre del multipunto</label><input id="le-gn" maxlength="200" value="${esc(st.group?.name || '')}" ${st.group ? 'disabled' : ''} placeholder="Se arma con el nombre de la base">
        <div style="display:grid;grid-template-columns:1fr 1fr auto;gap:0 8px;align-items:end"><div><label>Azimut del sector (°)</label><input id="le-saz" type="number" min="0" max="360" value="${C0.sector_az ?? ''}"></div><div><label>Apertura (°)</label><input id="le-sbw" type="number" min="1" max="360" value="${C0.sector_bw ?? ''}"></div><button class="btn sec small" id="le-sauto" type="button" title="Calcula el sector que cubre a todos los remotos" style="margin-bottom:10px">Calcular</button></div>
      </div>
      <div id="le-mw" class="lnk-info"></div>
      ${w ? `<div id="le-mwrap"><label>Cómo se dibuja</label><div class="lnk-kinds" id="le-meths">${Object.entries(LNK_METHOD).map(([k, x]) => `<button type="button" data-m="${k}"><b>${x[0]}</b>${x[1]}</button>`).join('')}</div>
        <div id="le-ruta" class="hidden"><label>Pasar por <span class="muted">(opcional, en orden)</span></label><select id="le-via"><option value="">+ Agregar sitio intermedio</option>${sites.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select><div id="le-vias" class="sm" style="margin:4px 0"></div>
          <button class="btn small" id="le-go" type="button">🛣 Calcular ruta</button> <span class="sm muted">Después la podés ajustar con ✍ Punto a punto.</span></div>
        <div id="le-man" class="hidden"><div class="row" style="gap:6px;margin-top:6px"><button class="btn sec small" id="le-undo" type="button">↶ Deshacer punto</button><button class="btn sec small" id="le-clr" type="button">🗑 Borrar puntos</button></div></div>
        <div id="le-kmzw" class="hidden"><label class="btn sec small" style="margin-top:6px;display:inline-block">🌍 Elegir KMZ / KML<input type="file" id="le-kmz" accept=".kmz,.kml" class="hidden"></label><p class="muted sm">En Google Earth: Agregar → Ruta, y después clic derecho → Guardar lugar como… KMZ.</p></div></div>` : ''}
      <label>Nombre</label><input id="le-n" maxlength="200" value="${esc(l?.name || '')}" placeholder="Se arma con Sitio A ↔ Sitio B" ${w ? '' : 'disabled'}>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 10px">
        <div><label>Estado</label><select id="le-st" ${w ? '' : 'disabled'}>${Object.entries(LNK_ST).map(([k, x]) => `<option value="${k}" ${k === (l?.status || 'activo') ? 'selected' : ''}>${x[0]}</option>`).join('')}</select></div>
        <div><label>Traza</label><input id="le-tz" maxlength="120" value="${esc(l?.traza || '')}" ${w ? '' : 'disabled'}></div>
        <div class="le-r"><label>Banda</label><input id="le-band" maxlength="40" value="${esc(l?.band || '')}" placeholder="Ej.: 18 GHz" ${w ? '' : 'disabled'}></div>
        <div class="le-r"><label>Frecuencia (MHz)</label><input id="le-f" type="number" min="1" max="300000" value="${l?.freq_mhz ?? ''}" ${w ? '' : 'disabled'}></div>
        <div><label>Capacidad</label><input id="le-cap" maxlength="60" value="${esc(l?.capacity || '')}" placeholder="Ej.: 1 Gbps · 48 FO" ${w ? '' : 'disabled'}></div>
        <div class="le-r"><label>Alt. antena A / B (m)</label><div class="row" style="gap:4px;flex-wrap:nowrap"><input id="le-ha" type="number" min="0" max="500" value="${l?.h_a ?? 30}" ${w ? '' : 'disabled'}><input id="le-hb" type="number" min="0" max="500" value="${l?.h_b ?? 30}" ${w ? '' : 'disabled'}></div></div></div>
      <details class="le-r" id="le-cfg" style="margin-top:10px;border:1px solid var(--line);border-radius:10px;padding:8px 10px" ${['bw_mhz', 'polar', 'tx_dbm', 'gain_a', 'gain_b', 'rssi_a', 'rssi_b', 'link_ref'].some(k => C0[k] != null && C0[k] !== '') ? 'open' : ''}><summary style="cursor:pointer;font-weight:600">⚙️ Configuración de radio</summary>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 10px">
          <div><label>Ancho de canal (MHz)</label><input id="le-bwm" type="number" min="0.1" max="5000" step="any" value="${C0.bw_mhz ?? ''}" placeholder="Ej.: 20, 40, 80" ${w ? '' : 'disabled'}></div>
          <div><label>Polarización</label><select id="le-pol" ${w ? '' : 'disabled'}><option value="">—</option>${[['H', 'Horizontal'], ['V', 'Vertical'], ['dual', 'Dual (H+V)'], ['circular', 'Circular']].map(([k, t]) => `<option value="${k}" ${C0.polar === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
          <div><label>Potencia TX (dBm)</label><input id="le-tx" type="number" min="-30" max="60" step="any" value="${C0.tx_dbm ?? ''}" ${w ? '' : 'disabled'}></div>
          <div><label>ID / SSID del enlace</label><input id="le-ref" maxlength="80" value="${esc(C0.link_ref || '')}" placeholder="Sin contraseñas" ${w ? '' : 'disabled'}></div>
          <div><label id="le-lga">Ganancia antena A (dBi)</label><input id="le-ga" type="number" min="0" max="70" step="any" value="${C0.gain_a ?? ''}" ${w ? '' : 'disabled'}></div>
          <div><label id="le-lgb">Ganancia antena B (dBi)</label><input id="le-gb" type="number" min="0" max="70" step="any" value="${C0.gain_b ?? ''}" ${w ? '' : 'disabled'}></div>
          <div class="le-p2p"><label>Nivel medido en A (dBm)</label><input id="le-ra1" type="number" min="-130" max="0" step="any" value="${l?.rssi_a ?? ''}" ${w ? '' : 'disabled'}></div>
          <div class="le-p2p"><label>Nivel medido en B (dBm)</label><input id="le-rb1" type="number" min="-130" max="0" step="any" value="${l?.rssi_b ?? ''}" ${w ? '' : 'disabled'}></div></div>
        <p class="muted sm" style="margin:4px 0 0">Con frecuencia, potencia y ganancias, la app estima el nivel de recepción (espacio libre, sin pérdidas de cables ni lluvia).</p></details>
      <label>Notas</label><textarea id="le-no" maxlength="2000" ${w ? '' : 'disabled'}>${esc(l?.notes || '')}</textarea>
      <div class="le-r" style="margin-top:8px"><button class="btn sec small" id="le-prof" type="button">⛰ Perfil del terreno</button></div><div id="le-pw" class="lnk-prof" style="margin-top:8px"></div>
      ${w ? `<div id="le-fow" class="hidden" style="margin-top:8px">${l?.fiber_route_id ? `<a class="btn sec small" href="#/tools/${l.fiber_route_id}">🧵 Abrir la traza de fibra</a>` : `<label style="display:flex;gap:8px;align-items:center;font-weight:400"><input type="checkbox" id="le-fr" style="width:auto"> Guardar también como <b>traza de fibra</b> (para mediciones OTDR y empalmes)</label>
        <div class="row" style="gap:6px"><label class="sm" style="font-weight:400">Reserva %</label><input id="le-res" type="number" min="0" max="50" value="8" style="width:80px"></div>`}</div>` : ''}
      <div class="err" id="le-err"></div>
      ${w ? `<div class="row" style="justify-content:space-between;margin-top:10px">${!isNew ? '<button class="btn sec" id="le-del" style="color:var(--red)">🗑 Borrar</button>' : '<span></span>'}<button class="btn" id="le-ok">${isNew ? 'Crear vínculo' : 'Guardar'}</button></div>` : ''}
    </div></div>`, { wide: true });
  m.el.style.maxWidth = '1150px';
  const close = () => { try { map?.remove(); } catch {} m.close(); };
  $('#le-x').onclick = close;
  // mapa
  let map = null, g = null;
  if (window.L){ map = L.map('le-map'); L.tileLayer(SITE_TILE, { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map); g = L.featureGroup().addTo(map); map.setView(st.A || [-31, -61], st.A ? 10 : 6); setTimeout(() => map.invalidateSize(), 200); }
  const pathPts = () => st.method === 'recta' || st.pts.length < 2 ? (st.A && st.B ? [st.A, st.B] : []) : st.pts;
  const numv = id => { const x = $(id)?.value; return x === '' || x == null || isNaN(Number(x)) ? null : Number(x); };
  // nivel de recepción estimado (pérdida en espacio libre): TX + ganancias − (32,44 + 20·log f[MHz] + 20·log d[km])
  const rxEst = dM => { const f = numv('#le-f'), tx = numv('#le-tx'), ga = numv('#le-ga'), gb = numv('#le-gb'); if (!f || tx == null || ga == null || gb == null || !(dM > 0)) return null; return tx + ga + gb - (32.44 + 20 * Math.log10(f) + 20 * Math.log10(dM / 1000)); };
  const rxTxt = v => v == null ? '' : `${v.toFixed(1).replace('.', ',')} dBm`;
  const rxCol = v => v == null ? 'inherit' : v >= -65 ? '#059669' : v >= -75 ? '#D97706' : '#DC2626';
  const remS = () => st.rem.map(id => sById.get(id)).filter(Boolean);
  const sectorAuto = () => { const R = remS(); if (!st.A || !R.length) return null; const az = R.map(x => sitAz(st.A, [x.lat, x.lng])).sort((a, b) => a - b);
    if (az.length === 1) return [Math.round(az[0]), 60];
    let gap = -1, gi = 0; for (let i = 0; i < az.length; i++){ const d = (az[(i + 1) % az.length] - az[i] + 360) % 360 || 360; if (d > gap){ gap = d; gi = i; } }
    const from = az[(gi + 1) % az.length], span = 360 - gap; return [Math.round((from + span / 2) % 360), Math.max(10, Math.min(360, Math.ceil(span + 10)))]; };
  const dest = (p, azDeg, dM) => { const R = 6371000, a = azDeg * Math.PI / 180, la = p[0] * Math.PI / 180, lo = p[1] * Math.PI / 180, dr = dM / R;
    const la2 = Math.asin(Math.sin(la) * Math.cos(dr) + Math.cos(la) * Math.sin(dr) * Math.cos(a)); const lo2 = lo + Math.atan2(Math.sin(a) * Math.sin(dr) * Math.cos(la), Math.cos(dr) - Math.sin(la) * Math.sin(la2)); return [la2 * 180 / Math.PI, lo2 * 180 / Math.PI]; };
  const toggleRem = id => { const i = st.rem.indexOf(id); if (i >= 0) st.rem.splice(i, 1); else { if (id === st.aSite) return toast('Ese sitio es la base.'); if (st.rem.length >= 60) return toast('Máximo 60 remotos por multipunto.'); st.rem.push(id); } redraw(); };
  const redrawM = (fit) => {
    const k = LNK_KIND[st.kind], R = remS();
    $('#le-rc').textContent = R.length ? `(${R.length})` : '';
    $('#le-gn').placeholder = st.aSite ? `PtMP ${sById.get(st.aSite)?.name || ''}` : 'Se arma con el nombre de la base';
    $('#le-rl').innerHTML = !st.A ? '<p class="muted sm">Primero elegí la base.</p>' : R.length ? `<table class="tbl" style="font-size:13px"><thead><tr><th>Remoto</th><th>Dist.</th><th>Azimut</th><th>RX est.</th><th></th></tr></thead><tbody>${R.map(x => { const d = sitDist(st.A, [x.lat, x.lng]), rx = rxEst(d);
      return `<tr><td><b>${esc(x.name)}</b></td><td>${sitKm(d)}</td><td>${sitAzTxt(sitAz(st.A, [x.lat, x.lng]))}</td><td style="color:${rxCol(rx)};font-weight:600">${rxTxt(rx) || '—'}</td><td><button class="link" data-rrm="${x.id}" type="button">✕</button></td></tr>`; }).join('')}</tbody></table>` : '<p class="muted sm">Todavía no hay remotos.</p>';
    m.el.querySelectorAll('[data-rrm]').forEach(b => b.onclick = () => toggleRem(b.dataset.rrm));
    const far = R.length ? Math.max(...R.map(x => sitDist(st.A, [x.lat, x.lng]))) : 0;
    $('#le-mw').innerHTML = st.A ? `<div><span>Remotos</span><b>${R.length}</b></div><div><span>El más lejano</span><b>${R.length ? sitKm(far) : '—'}</b></div><div><span>Suma de enlaces</span><b>${sitKm(R.reduce((a, x) => a + sitDist(st.A, [x.lat, x.lng]), 0))}</b></div>` : '<div><span>Elegí la base</span><b>—</b></div>';
    $('#le-hint').textContent = st.pick ? 'Tocá el mapa para ubicar la base.' : 'Tocá un sitio del mapa para sumarlo como remoto (o quitarlo).';
    if (!g) return; g.clearLayers();
    // sector de la base
    const saz = numv('#le-saz'), sbw = numv('#le-sbw');
    if (st.A && saz != null && sbw != null && far > 0){ const rad = far * 1.12, pts = sbw >= 360 ? [] : [st.A];
      for (let a = saz - sbw / 2; a <= saz + sbw / 2 + .01; a += Math.max(2, sbw / 40)) pts.push(dest(st.A, a, rad));
      L.polygon(pts, { color: k[2], weight: 1, fillColor: k[2], fillOpacity: .08, interactive: false }).addTo(g); }
    // sitios cercanos para elegir con un toque
    if (st.A){ const lim = Math.max(30000, far * 1.6); sites.forEach(x => { if (x.id === st.aSite || st.rem.includes(x.id)) return; if (sitDist(st.A, [x.lat, x.lng]) > lim) return;
      L.circleMarker([x.lat, x.lng], { radius: 6, color: '#fff', weight: 1.5, fillColor: '#94A3B8', fillOpacity: 1 }).addTo(g).bindTooltip(esc(x.name)).on('click', e => { L.DomEvent.stopPropagation(e); toggleRem(x.id); }); }); }
    R.forEach((x, i) => { const p = [x.lat, x.lng], rx = rxEst(sitDist(st.A, p));
      L.polyline([st.A, p], { color: k[2], weight: 3, dashArray: k[3] }).addTo(g);
      L.marker(p, { icon: L.divIcon({ className: '', html: `<div style="width:22px;height:22px;border-radius:50%;background:#fff;color:${k[2]};border:3px solid ${k[2]};box-shadow:0 1px 4px rgba(0,0,0,.4);display:grid;place-items:center;font:700 11px sans-serif">${i + 1}</div>`, iconSize: [22, 22], iconAnchor: [11, 11] }) }).addTo(g)
        .bindTooltip(`${esc(x.name)} · ${sitKm(sitDist(st.A, p))}${rx != null ? ' · ' + rxTxt(rx) : ''}`).on('click', e => { L.DomEvent.stopPropagation(e); toggleRem(x.id); }); });
    if (st.A) L.marker(st.A, { icon: L.divIcon({ className: '', html: `<div style="width:30px;height:30px;border-radius:50%;background:${k[2]};color:#fff;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);display:grid;place-items:center;font:700 9px sans-serif">BASE</div>`, iconSize: [30, 30], iconAnchor: [15, 15] }) }).addTo(g).bindTooltip(esc(sById.get(st.aSite)?.name || 'Base'));
    if (fit && st.A){ const b = L.latLngBounds([st.A, ...R.map(x => [x.lat, x.lng])]); R.length ? map.fitBounds(b, { padding: [50, 50], maxZoom: 14 }) : map.setView(st.A, 12); }
  };
  const redraw = (fit) => {
    const k = LNK_KIND[st.kind];
    if (st.topo === 'ptmp' && !isR()) st.topo = 'ptp';
    const M = isM();
    m.el.querySelectorAll('[data-tp]').forEach(b => b.classList.toggle('on', b.dataset.tp === st.topo));
    $('#le-la').textContent = M ? 'Base (nodo central)' : 'Sitio A';
    $('#le-bw').classList.toggle('hidden', M); $('#le-pm').classList.toggle('hidden', !M); $('#le-mwrap')?.classList.toggle('hidden', M);
    $('#le-lga').textContent = M ? 'Ganancia antena base (dBi)' : 'Ganancia antena A (dBi)'; $('#le-lgb').textContent = M ? 'Ganancia antena remotos (dBi)' : 'Ganancia antena B (dBi)';
    $('#le-ok') && ($('#le-ok').textContent = !isNew ? 'Guardar' : M ? `Crear multipunto${st.rem.length ? ` (${st.rem.length} enlaces)` : ''}` : 'Crear vínculo');
    m.el.querySelectorAll('[data-k]').forEach(b => b.classList.toggle('on', b.dataset.k === st.kind));
    m.el.querySelectorAll('[data-m]').forEach(b => b.classList.toggle('on', b.dataset.m === st.method));
    m.el.querySelectorAll('.le-r').forEach(e => e.classList.toggle('hidden', !isR()));
    m.el.querySelectorAll('.le-p2p').forEach(e => e.classList.toggle('hidden', M));
    $('#le-prof')?.classList.toggle('hidden', M);
    if (M){ $('#le-n').disabled = true; $('#le-n').placeholder = 'Cada enlace se nombra Base → Remoto'; return redrawM(fit); }
    if (isNew && w){ $('#le-n').disabled = false; $('#le-n').placeholder = 'Se arma con Sitio A ↔ Sitio B'; }
    $('#le-fow')?.classList.toggle('hidden', st.kind !== 'fo');
    $('#le-ruta')?.classList.toggle('hidden', st.method !== 'ruta'); $('#le-man')?.classList.toggle('hidden', st.method !== 'manual'); $('#le-kmzw')?.classList.toggle('hidden', st.method !== 'kmz');
    $('#le-vias') && ($('#le-vias').innerHTML = st.via.map((id, i) => `<span class="pill" style="margin:2px">${i + 1}. ${esc(sById.get(id)?.name || '')} <button class="link" data-vrm="${i}" type="button">✕</button></span>`).join(''));
    m.el.querySelectorAll('[data-vrm]').forEach(b => b.onclick = () => { st.via.splice(Number(b.dataset.vrm), 1); redraw(); });
    const P = pathPts(), len = sitLen(P);
    $('#le-mw').innerHTML = st.A && st.B ? `<div><span>Largo</span><b>${sitKm(len)}</b></div>${['mw', 'radio'].includes(st.kind) ? `<div><span>Azimut A → B</span><b>${sitAzTxt(sitAz(st.A, st.B))}</b></div><div><span>Azimut B → A</span><b>${sitAzTxt(sitAz(st.B, st.A))}</b></div>${rxEst(len) != null ? `<div><span>Nivel RX estimado</span><b style="color:${rxCol(rxEst(len))}">${rxTxt(rxEst(len))}</b></div>` : ''}` : `<div><span>En línea recta</span><b>${sitKm(sitDist(st.A, st.B))}</b></div>`}` : '<div><span>Elegí los dos extremos</span><b>—</b></div>';
    $('#le-hint').textContent = st.pick ? `Tocá el mapa para ubicar el extremo ${st.pick}.` : st.method === 'manual' && w ? 'Tocá el mapa para agregar puntos; arrastralos para moverlos.' : st.method === 'ruta' ? 'La ruta sale del servicio de rutas: revisala y ajustala.' : '';
    if (!g) return; g.clearLayers();
    if (P.length > 1) L.polyline(P, { color: k[2], weight: st.kind === 'fo' ? 4 : 3, dashArray: k[3] }).addTo(g);
    [['A', st.A, st.aSite], ['B', st.B, st.bSite]].forEach(([n, p, sid]) => p && L.marker(p, { draggable: w && !sid, title: n, icon: L.divIcon({ className: '', html: `<div style="width:26px;height:26px;border-radius:50%;background:${k[2]};color:#fff;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);display:grid;place-items:center;font:700 13px sans-serif">${n}</div>`, iconSize: [26, 26], iconAnchor: [13, 13] }) }).addTo(g).bindTooltip(`${n}${sid ? ': ' + esc(sById.get(sid)?.name || '') : ''}`, { permanent: true, direction: 'top', offset: [0, -14] })
      .on('dragend', e => { const ll = e.target.getLatLng(); st[n] = [ll.lat, ll.lng]; redraw(); }));
    st.via.forEach(id => { const s = sById.get(id); if (s) L.circleMarker([s.lat, s.lng], { radius: 6, color: '#111', fillColor: '#FDE047', fillOpacity: 1 }).addTo(g).bindTooltip(esc(s.name)); });
    if (st.method === 'manual' && w) st.pts.forEach((p, i) => { if (i === 0 || i === st.pts.length - 1) return;
      L.marker(p, { draggable: true, icon: L.divIcon({ className: '', html: '<div style="width:12px;height:12px;border-radius:50%;background:#fff;border:3px solid ' + k[2] + '"></div>', iconSize: [12, 12], iconAnchor: [6, 6] }) }).addTo(g)
        .on('dragend', e => { const ll = e.target.getLatLng(); st.pts[i] = [ll.lat, ll.lng]; redraw(); }).on('contextmenu', () => { st.pts.splice(i, 1); redraw(); }); });
    if (fit && g.getLayers().length) map.fitBounds(g.getBounds(), { padding: [40, 40], maxZoom: 15 });
  };
  const autoName = () => { if (!isNew || $('#le-n').value.trim()) return; const a = sById.get(st.aSite)?.name, b = sById.get(st.bSite)?.name; if (a && b) $('#le-n').placeholder = `${a} ↔ ${b}`; };
  const anchorEnds = () => { if (st.method !== 'manual') return; if (st.pts.length < 2 && st.A && st.B) st.pts = [st.A, st.B]; else if (st.pts.length >= 2){ if (st.A) st.pts[0] = st.A; if (st.B) st.pts[st.pts.length - 1] = st.B; } };
  m.el.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { st.kind = b.dataset.k; if (st.kind !== 'fo' && st.method === 'ruta') st.method = 'recta'; redraw(); });
  m.el.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { const was = st.method; st.method = b.dataset.m;
    if (st.method === 'manual'){ if (st.pts.length > 400){ st.pts = sitSimplify(st.pts, 15); toast(`Simplifiqué el recorrido a ${st.pts.length} puntos para poder editarlo.`); } anchorEnds(); }
    if (st.method === 'recta') st.pts = []; if (was === 'recta' && st.method === 'ruta') st.pts = []; redraw(); });
  m.el.querySelectorAll('[data-tp]').forEach(b => b.onclick = () => { st.topo = b.dataset.tp; if (st.topo === 'ptmp'){ st.method = 'recta'; st.pts = []; if (st.bSite && !st.rem.includes(st.bSite)) st.rem.push(st.bSite); } redraw(true); });
  $('#le-ra')?.addEventListener('change', e => { const id = e.target.value; e.target.value = ''; if (!id) return; if (!st.A) return toast('Primero elegí la base.'); if (!st.rem.includes(id)) toggleRem(id); redraw(true); });
  $('#le-rn')?.addEventListener('click', () => { if (!st.A) return toast('Primero elegí la base.'); const km = Math.max(1, Math.min(100, Number($('#le-rk').value) || 10)); let n = 0;
    sites.map(x => [x, sitDist(st.A, [x.lat, x.lng])]).filter(([x, d]) => x.id !== st.aSite && d <= km * 1000 && !st.rem.includes(x.id)).sort((a, b) => a[1] - b[1]).forEach(([x]) => { if (st.rem.length < 60){ st.rem.push(x.id); n++; } });
    toast(n ? `${n} remoto${n === 1 ? '' : 's'} agregado${n === 1 ? '' : 's'}` : `No hay más sitios a menos de ${km} km.`); redraw(true); });
  $('#le-sauto')?.addEventListener('click', () => { const r = sectorAuto(); if (!r) return toast('Elegí la base y al menos un remoto.'); $('#le-saz').value = r[0]; $('#le-sbw').value = r[1]; redraw(); });
  ['#le-saz', '#le-sbw', '#le-f', '#le-tx', '#le-ga', '#le-gb'].forEach(id => $(id)?.addEventListener('input', () => redraw()));
  $('#le-more')?.addEventListener('click', () => { close(); linkEditor(null, { a: l.site_a, kind: l.kind, ptmp: true, group: { id: l.group_id, name: l.group_name }, cfg: { ...l, rssi_a: null, rssi_b: null } }); });
  $('#le-a')?.addEventListener('change', e => { setEnd('A', e.target.value); st.rem = st.rem.filter(id => id !== st.aSite); anchorEnds(); autoName(); redraw(true); });
  $('#le-b')?.addEventListener('change', e => { setEnd('B', e.target.value); anchorEnds(); autoName(); redraw(true); });
  $('#le-pa')?.addEventListener('click', () => { st.pick = 'A'; redraw(); }); $('#le-pb')?.addEventListener('click', () => { st.pick = 'B'; redraw(); });
  $('#le-via')?.addEventListener('change', e => { if (e.target.value && st.via.length < 20) st.via.push(e.target.value); e.target.value = ''; redraw(); });
  $('#le-undo')?.addEventListener('click', () => { if (st.pts.length > 2) st.pts.splice(st.pts.length - 2, 1); redraw(); });
  $('#le-clr')?.addEventListener('click', () => { st.pts = st.A && st.B ? [st.A, st.B] : []; redraw(); });
  map?.on('click', e => { if (!w) return; const ll = [e.latlng.lat, e.latlng.lng];
    if (st.pick){ const n = st.pick; st.pick = null; st[n] = ll; st[n === 'A' ? 'aSite' : 'bSite'] = null; $(n === 'A' ? '#le-a' : '#le-b').value = ''; anchorEnds(); redraw(); return; }
    if (st.method === 'manual'){ if (!st.A || !st.B) return toast('Primero elegí los dos extremos.'); if (st.pts.length < 2) st.pts = [st.A, st.B];
      // el punto nuevo se inserta en el tramo más cercano
      let best = st.pts.length - 1, bd = Infinity; for (let i = 1; i < st.pts.length; i++){ const d = sitDist(st.pts[i - 1], ll) + sitDist(ll, st.pts[i]) - sitDist(st.pts[i - 1], st.pts[i]); if (d < bd){ bd = d; best = i; } }
      if (st.pts.length >= 5000) return toast('Demasiados puntos.'); st.pts.splice(best, 0, ll); redraw(); } });
  $('#le-go')?.addEventListener('click', async () => {
    if (!st.A || !st.B) return toast('Elegí los dos extremos.'); if (!needOnline()) return;
    const b = $('#le-go'); b.disabled = true; b.textContent = 'Calculando…'; $('#le-err').textContent = '';
    try {
      const points = [st.A, ...st.via.map(id => [sById.get(id).lat, sById.get(id).lng]), st.B];
      if (!sb.functions?.invoke) throw new Error('El ruteo automático no está disponible en esta versión.');
      const { data, error } = await sb.functions.invoke('inspectapp-route', { body: { points } });
      if (error){ let msg = ''; try { msg = (await error.context?.json?.())?.error || ''; } catch {} throw new Error(msg || (/not found|404|Failed to send/i.test(error.message || '') ? 'El ruteo automático todavía no está activado: falta cargar la clave del servicio de rutas en Supabase (ver LEEME). Mientras tanto usá ✍ Punto a punto o 🌍 KMZ.' : error.message)); }
      if (!Array.isArray(data?.path) || data.path.length < 2) throw new Error(data?.error || 'No vino un recorrido.');
      st.pts = data.path.filter(p => Array.isArray(p) && isFinite(p[0]) && isFinite(p[1])).slice(0, 20000);
      st.pts[0] = st.A; st.pts[st.pts.length - 1] = st.B; redraw(true); toast(`Ruta calculada: ${sitKm(sitLen(st.pts))}`);
    } catch (e){ $('#le-err').textContent = errText(e); }
    b.disabled = false; b.textContent = '🛣 Calcular ruta';
  });
  $('#le-kmz')?.addEventListener('change', async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try { const pms = parseKML(await readKML(f)); const lines = pms.filter(p => !p.isPoint && p.pts.length > 1);
      if (!lines.length) throw new Error('El archivo no tiene ninguna línea (ruta). En Google Earth usá Agregar → Ruta.');
      const ln = lines.sort((a, b) => b.pts.length - a.pts.length)[0];
      let pts = ln.pts.slice(0, 20000).map(p => [p[1], p[0]]).filter(p => Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180);
      // si los extremos ya están elegidos, se orienta la línea de A a B; si no, los extremos salen de la línea
      if (st.A && sitDist(st.A, pts[pts.length - 1]) < sitDist(st.A, pts[0])) pts.reverse();
      const near = p => { let b = null, d = 300; sites.forEach(s => { const x = sitDist(p, [s.lat, s.lng]); if (x < d){ d = x; b = s; } }); return b; };
      if (!st.aSite){ const s = near(pts[0]); s ? setEnd('A', s.id) : (st.A = pts[0]); if (s) $('#le-a').value = s.id; } if (!st.bSite){ const s = near(pts[pts.length - 1]); s ? setEnd('B', s.id) : (st.B = pts[pts.length - 1]); if (s) $('#le-b').value = s.id; }
      const far = [st.A && sitDist(st.A, pts[0]) > 500 ? 'A' : null, st.B && sitDist(st.B, pts[pts.length - 1]) > 500 ? 'B' : null].filter(Boolean);
      st.pts = pts; st.method = 'kmz'; if (!$('#le-n').value && ln.name) $('#le-n').value = ln.name.slice(0, 200); autoName(); redraw(true);
      toast(`Recorrido importado: ${sitKm(sitLen(pts))}${far.length ? ` · ojo: la línea no termina en el extremo ${far.join(' ni ')}` : ''}`);
    } catch (err){ $('#le-err').textContent = errText(err); } });
  $('#le-prof')?.addEventListener('click', () => linkProfile(st, $('#le-pw')));
  $('#le-del')?.addEventListener('click', async () => { if (!confirm('¿Borrar este vínculo? La traza de fibra asociada (si hay) no se borra.')) return;
    const { error } = await sb.from('site_links').delete().eq('id', l.id); if (error) return void ($('#le-err').textContent = errText(error));
    IDB.del('kv', CUR_UID + ':site-links').catch(() => {}); IDB.del('kv', CUR_UID + ':site-links-full').catch(() => {}); close(); toast('Vínculo borrado'); route(); });
  $('#le-ok')?.addEventListener('click', async () => {
    const err = $('#le-err'); err.textContent = '';
    const radio = () => isR() ? { bw_mhz: numv('#le-bwm'), polar: $('#le-pol').value || null, tx_dbm: numv('#le-tx'), gain_a: numv('#le-ga'), gain_b: numv('#le-gb'), link_ref: $('#le-ref').value.trim() || null }
      : { bw_mhz: null, polar: null, tx_dbm: null, gain_a: null, gain_b: null, link_ref: null };
    const sqlMiss = e => /column|schema cache|PGRST204|42703/i.test((e.message || '') + (e.code || '')) ? 'Falta cargar 31_vinculos_multipunto.sql en Supabase (ver LEEME).' : null;
    if (isM()){
      if (!st.aSite) return void (err.textContent = 'La base tiene que ser un sitio.');
      const R = remS(); if (!R.length) return void (err.textContent = 'Agregá al menos un remoto.');
      const base = sById.get(st.aSite), gname = (st.group?.name || $('#le-gn').value.trim() || `PtMP ${base.name}`).slice(0, 200), gid = st.group?.id || uid();
      const num = id => numv(id);
      const rows = R.map(x => ({ org_id: me.org_id, kind: st.kind, topology: 'ptmp', group_id: gid, group_name: gname, name: `${base.name} → ${x.name}`.slice(0, 200), site_a: base.id, site_b: x.id, a_lat: base.lat, a_lng: base.lng, b_lat: x.lat, b_lng: x.lng, method: 'recta', geom: [],
        status: $('#le-st').value, traza: $('#le-tz').value.trim() || null, capacity: $('#le-cap').value.trim() || null, notes: $('#le-no').value.trim() || null,
        band: $('#le-band').value.trim() || null, freq_mhz: num('#le-f'), h_a: num('#le-ha'), h_b: num('#le-hb'), sector_az: num('#le-saz'), sector_bw: num('#le-sbw'), ...radio() }));
      $('#le-ok').disabled = true;
      const r = await sb.from('site_links').insert(rows);
      if (r.error){ err.textContent = sqlMiss(r.error) || errText(r.error); $('#le-ok').disabled = false; return; }
      IDB.del('kv', CUR_UID + ':site-links').catch(() => {}); IDB.del('kv', CUR_UID + ':site-links-full').catch(() => {}); close(); toast(`Multipunto creado: ${rows.length} enlace${rows.length === 1 ? '' : 's'}`); route(); return;
    }
    if (!st.A || !st.B) return void (err.textContent = 'Elegí los dos extremos (sitio o punto en el mapa).');
    if (st.method !== 'recta' && st.pts.length < 2) return void (err.textContent = st.method === 'ruta' ? 'Calculá la ruta o elegí otra forma de dibujarlo.' : 'Falta el recorrido.');
    const a = sById.get(st.aSite)?.name, b = sById.get(st.bSite)?.name;
    const name = ($('#le-n').value.trim() || (a && b ? `${a} ↔ ${b}` : '')).slice(0, 200); if (!name) return void (err.textContent = 'Poné un nombre.');
    const num = id => { const x = $(id)?.value; return x === '' || x == null ? null : Number(x); };
    const row = { kind: st.kind, name, site_a: st.aSite, site_b: st.bSite, a_lat: st.A[0], a_lng: st.A[1], b_lat: st.B[0], b_lng: st.B[1], method: st.method, geom: st.method === 'recta' ? [] : st.pts,
      status: $('#le-st').value, traza: $('#le-tz').value.trim() || null, capacity: $('#le-cap').value.trim() || null, notes: $('#le-no').value.trim() || null,
      band: ['mw', 'radio'].includes(st.kind) ? ($('#le-band').value.trim() || null) : null, freq_mhz: ['mw', 'radio'].includes(st.kind) ? num('#le-f') : null, h_a: ['mw', 'radio'].includes(st.kind) ? num('#le-ha') : null, h_b: ['mw', 'radio'].includes(st.kind) ? num('#le-hb') : null };
    // los datos de radio solo se mandan si se cargó alguno (así la app sigue andando aunque falte el SQL 31)
    const rc = { ...radio(), rssi_a: isR() ? numv('#le-ra1') : null, rssi_b: isR() ? numv('#le-rb1') : null };
    if (Object.values(rc).some(x => x != null) || (l && ['bw_mhz', 'polar', 'tx_dbm', 'gain_a', 'gain_b', 'rssi_a', 'rssi_b', 'link_ref'].some(k => l[k] != null))) Object.assign(row, rc);
    $('#le-ok').disabled = true;
    try {
      const r = isNew ? await sb.from('site_links').insert({ ...row, org_id: me.org_id }).select('*').single() : await sb.from('site_links').update(row).eq('id', l.id).select('*').single();
      if (r.error) throw r.error;
      if (st.kind === 'fo' && $('#le-fr')?.checked && !r.data.fiber_route_id){
        const P = pathPts(), Lr = sitLen(P), res = Math.max(0, Math.min(50, Number($('#le-res').value) || 0));
        const fr = { org_id: me.org_id, name: name.slice(0, 200), traza: row.traza, end_a: (a || 'Punto A').slice(0, 120), end_b: (b || 'Punto B').slice(0, 120), site_a: { name: a || 'Punto A', lat: st.A[0], lng: st.A[1] }, site_b: { name: b || 'Punto B', lat: st.B[0], lng: st.B[1] },
          route_length_m: Math.round(Lr), optical_length_m: Math.round(Lr * (1 + res / 100) * 10) / 10, path: P.map(p => [p[1], p[0]]), splices: [], created_by: me.id, notes: `Creada desde Vínculos (${LNK_METHOD[st.method][1].toLowerCase()}), reserva ${res}%.` };
        const f = await sb.from('fiber_routes').insert(fr).select('id').single();
        if (f.error) toast('El vínculo se guardó, pero no la traza de fibra: ' + (/duplicate|unique/i.test(f.error.message) ? 'ya existe una traza con ese nombre.' : errText(f.error)));
        else { await sb.from('site_links').update({ fiber_route_id: f.data.id }).eq('id', r.data.id); IDB.del('kv', CUR_UID + ':fr-list').catch(() => {}); }
      }
      IDB.del('kv', CUR_UID + ':site-links').catch(() => {}); IDB.del('kv', CUR_UID + ':site-links-full').catch(() => {}); close(); toast(isNew ? 'Vínculo creado' : 'Cambios guardados'); route();
    } catch (e){ err.textContent = /duplicate|unique/i.test(e.message || '') ? 'Ya existe un vínculo con ese nombre.' : sqlMiss(e) || errText(e); $('#le-ok').disabled = false; }
  });
  autoName(); redraw(true);
  if (l && preset.manual && w) m.el.querySelector('[data-m="manual"]')?.click();
}

/* ---------- perfil del terreno (microondas): curvatura de la tierra y zona de Fresnel ---------- */
async function linkProfile(st, box){
  if (!st.A || !st.B) return toast('Elegí los dos extremos.');
  if (!needOnline()) return;
  const N = 100, D = sitDist(st.A, st.B); if (D < 50) return toast('Los extremos están demasiado cerca.');
  box.innerHTML = '<div class="muted sm">Consultando la altura del terreno…</div>';
  const pts = Array.from({ length: N }, (_, i) => [st.A[0] + (st.B[0] - st.A[0]) * i / (N - 1), st.A[1] + (st.B[1] - st.A[1]) * i / (N - 1)]);
  let elev;
  try {
    const q = `latitude=${pts.map(p => p[0].toFixed(5)).join(',')}&longitude=${pts.map(p => p[1].toFixed(5)).join(',')}`;
    const r = await fetch('https://api.open-meteo.com/v1/elevation?' + q, { credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!r.ok) throw new Error('El servicio de alturas respondió ' + r.status);
    const j = await r.json(); elev = (j.elevation || []).map(Number);
    if (elev.length !== N || elev.some(x => !isFinite(x) || Math.abs(x) > 9000)) throw new Error('Datos de altura inválidos');
  } catch (e){ box.innerHTML = `<div class="err">No se pudo traer el perfil: ${esc(errText(e))}</div>`; return; }
  const hA = Math.max(0, Number($('#le-ha')?.value) || 0), hB = Math.max(0, Number($('#le-hb')?.value) || 0), f = Math.max(1, Number($('#le-f')?.value) || 0) / 1000 || 0, R = 6371000 * 4 / 3;
  const rows = pts.map((_, i) => { const d1 = D * i / (N - 1), d2 = D - d1, bulge = d1 * d2 / (2 * R), terr = elev[i] + bulge;
    const los = (elev[0] + hA) + ((elev[N - 1] + hB) - (elev[0] + hA)) * d1 / D;
    const fr = f > 0.001 && d1 > 0 && d2 > 0 ? 17.32 * Math.sqrt((d1 / 1000) * (d2 / 1000) / (f * D / 1000)) : 0;
    return { d1, terr, los, fr, clear: los - terr }; });
  const worst = rows.slice(1, -1).reduce((w, r) => (r.clear - 0.6 * r.fr < w.clear - 0.6 * w.fr ? r : w), rows[1]);
  const blocked = rows.slice(1, -1).filter(r => r.clear < 0), fresnelBad = rows.slice(1, -1).filter(r => r.clear < 0.6 * r.fr);
  const yMin = Math.min(...rows.map(r => r.terr)) - 10, yMax = Math.max(...rows.map(r => r.los + r.fr), ...rows.map(r => r.terr)) + 10;
  const W = 600, H = 220, X = d => 30 + d / D * (W - 40), Y = h => H - 20 - (h - yMin) / (yMax - yMin) * (H - 30);
  const terr = `M${X(0)},${Y(yMin)} ` + rows.map(r => `L${X(r.d1).toFixed(1)},${Y(r.terr).toFixed(1)}`).join(' ') + ` L${X(D)},${Y(yMin)} Z`;
  const fresL = rows.map((r, i) => `${i ? 'L' : 'M'}${X(r.d1).toFixed(1)},${Y(r.los - 0.6 * r.fr).toFixed(1)}`).join(' ');
  const ok = !blocked.length && !fresnelBad.length;
  box.innerHTML = `<div class="banner ${ok ? 'trial' : 'warn'}" style="margin-bottom:6px"><span class="dot"></span><div><b>${blocked.length ? `⛔ Sin línea de vista: obstruido a ${sitKm(blocked[0].d1)} de A` : fresnelBad.length ? `⚠ Línea de vista, pero el 60% de la zona de Fresnel toca el terreno a ${sitKm(worst.d1)} de A` : '✅ Despejado: línea de vista y 60% de Fresnel libres'}</b>
      <div class="sm">Despeje mínimo ${Math.round(worst.clear)} m a ${sitKm(worst.d1)} de A${f > 0.001 ? '' : ' · cargá la frecuencia para calcular Fresnel'}. Altura terreno A ${Math.round(elev[0])} m · B ${Math.round(elev[N - 1])} m.</div></div></div>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Perfil del terreno"><path d="${terr}" fill="#D6C7A8" stroke="#8B6B3E" stroke-width="1"/>
      ${f > 0.001 ? `<path d="${fresL}" fill="none" stroke="#7C3AED" stroke-width="1.5" stroke-dasharray="4 4"/>` : ''}
      <line x1="${X(0)}" y1="${Y(rows[0].los)}" x2="${X(D)}" y2="${Y(rows[N - 1].los)}" stroke="${blocked.length ? '#DC2626' : '#16A34A'}" stroke-width="2"/>
      <line x1="${X(0)}" y1="${Y(elev[0])}" x2="${X(0)}" y2="${Y(rows[0].los)}" stroke="#111" stroke-width="3"/><line x1="${X(D)}" y1="${Y(elev[N - 1])}" x2="${X(D)}" y2="${Y(rows[N - 1].los)}" stroke="#111" stroke-width="3"/>
      ${blocked.map(r => `<circle cx="${X(r.d1)}" cy="${Y(r.terr)}" r="3" fill="#DC2626"/>`).join('')}
      <text x="${X(0)}" y="${H - 4}" font-size="11">A</text><text x="${X(D) - 8}" y="${H - 4}" font-size="11">B</text><text x="${W / 2 - 30}" y="${H - 4}" font-size="11">${sitKm(D)}</text>
      <text x="2" y="${Y(yMax) + 10}" font-size="10">${Math.round(yMax)} m</text><text x="2" y="${Y(yMin)}" font-size="10">${Math.round(yMin)} m</text></svg>
    <div class="muted sm">Verde: línea de vista. Violeta punteado: 60% de la primera zona de Fresnel. Con curvatura de la tierra (k = 4/3). Datos de altura: Open-Meteo (Copernicus DEM, 90 m). Es una estimación: confirmá en campo.</div>`;
}
