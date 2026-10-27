/* =====================================================================
   InspectApp · Transformándonos — v4.9
   Histórico de mantenimiento (planilla Excel por mes), estadísticas mes a mes que se actualizan solas
   con lo que se carga en la app, plan de preventivos y planilla de certificación mensual.
   Este archivo solo declara funciones: no ejecuta nada al cargarse.
   ===================================================================== */

const STX_MES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const STX_CATS = ['Energía', 'Fibra óptica', 'Seguridad física', 'Equipamiento', 'Otros'];
const STX_SMT = ['SMTCGySH', 'SMTCFOyRE', 'SMTCGInfra', 'SMTCGFO', 'SMTPI'];
const STX_FREQ = { 1: 'Mensual', 2: 'Bimestral', 3: 'Trimestral', 4: 'Cuatrimestral', 6: 'Semestral', 12: 'Anual' };
const STX_ST = { ok: ['Hecho', '#16A34A'], pendiente: ['Le toca', '#F59E0B'], atrasado: ['Atrasado', '#DC2626'], no_toca: ['No le toca', '#94A3B8'] };
const STX = { cfg: null };

const stxPer = s => String(s).slice(0, 7);                                         // 'YYYY-MM'
const stxPerLabel = p => { const [y, m] = String(p).split('-'); return STX_MES[Number(m) - 1].slice(0, 3) + ' ' + y.slice(2); };
const stxPerLong = p => { const [y, m] = String(p).split('-'); const n = STX_MES[Number(m) - 1]; return n.charAt(0).toUpperCase() + n.slice(1) + ' ' + y; };
const stxAddMonths = (p, n) => { const [y, m] = String(p).split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); return d.toISOString().slice(0, 7); };
const stxMonthsBetween = (a, b) => { const [y1, m1] = String(a).split('-').map(Number), [y2, m2] = String(b).split('-').map(Number); return (y2 - y1) * 12 + (m2 - m1); };
function stxPeriodOf(day, cut){ const d = dOf(day); d.setDate(d.getDate() - (Math.max(1, cut) - 1)); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
const stxK = s => norm(s).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

async function stxLoadCfg(){
  try { STX.cfg = await cached('org-cfg', () => sb.from('org_settings').select('*').maybeSingle()); } catch {}
  STX.cfg = { cert_day_prev: 9, cert_day_corr: 1, presence_m: 1000, push_mode: 'manual', summary_on: false, summary_freq: 'semanal', summary_dow: 1, pm_auto_tasks: false, ...(STX.cfg || {}) };
  return STX.cfg;
}
function stxCurPeriod(kind = 'preventivo'){ const c = STX.cfg || {}; return stxPeriodOf(todayStr(), kind === 'preventivo' ? c.cert_day_prev || 9 : c.cert_day_corr || 1); }

/* =====================================================================
   LECTURA DE LA PLANILLA (una solapa por mes: "Preventivo <mes> [año]" y "Correctivo <mes> [año]")
   ===================================================================== */
const stxDate = v => { if (typeof v !== 'number' || !isFinite(v) || v < 20000 || v > 80000) return null; const c = XLSX.SSF.parse_date_code(v); return c ? { y: c.y, m: c.m, d: c.d } : null; };
const stxTime = v => { if (typeof v !== 'number' || !isFinite(v)) return null; const f = v % 1; const mins = Math.round(f * 1440); return { H: Math.floor(mins / 60) % 24, M: mins % 60 }; };
const stxIso = (d, t) => d ? `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}T${String(t?.H ?? 0).padStart(2, '0')}:${String(t?.M ?? 0).padStart(2, '0')}:00-03:00` : null;
const stxDay = d => d ? `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}` : null;
function stxCat(s){
  const n = norm(s);
  if (!n) return null;
  if (/energ|ge\b|grupo|combust|fase|disyunt|tension|rectific|bateri|ups/.test(n)) return 'Energía';
  if (/^fo$|fibra|optic|atenua|corte de fo/.test(n)) return 'Fibra óptica';
  if (/segur|puerta|intrus|sensor/.test(n)) return 'Seguridad física';
  if (/equipam|radio|switch|router/.test(n)) return 'Equipamiento';
  if (/otro|temperat|nodo caido/.test(n)) return 'Otros';
  return String(s).trim().slice(0, 60);
}
function stxTtr(v){
  if (typeof v === 'number' && isFinite(v)) return v > 0 && v < 1 ? Math.round(v * 24) : v;     // número de horas (o fracción de día)
  const s = norm(v); if (!s) return null;
  let m = s.match(/(\d+(?:[.,]\d+)?)\s*(dias?|days?)/); if (m) return Math.round(Number(m[1].replace(',', '.')) * 24);
  m = s.match(/(\d+(?:[.,]\d+)?)/); return m ? Number(m[1].replace(',', '.')) : null;
}
const stxTtype = v => { const n = norm(v); return !n ? null : n.charAt(0).toUpperCase() + n.slice(1, 40); };
const stxAfect = v => { const n = norm(v); return !n ? null : /sin/.test(n) ? 'Sin afectación' + (/dwdm/.test(n) ? ' (solo DWDM)' : '') : /afect/.test(n) ? 'Afectado' : String(v).trim().slice(0, 60); };
function stxSheetPeriod(title, firstText, dates){
  // el mes sale del nombre de la solapa; el encabezado de adentro a veces quedó copiado de otro mes
  let mi = STX_MES.findIndex(m => norm(title).includes(m));
  if (mi < 0) mi = STX_MES.findIndex(m => norm(firstText || '').includes(m));
  if (mi < 0) return null;
  let y = (norm(title).match(/\b(20\d\d)\b/) || [])[1];
  if (!y){
    const ys = dates.map(d => d.y).filter(x => x > 2000); const cnt = {}; ys.forEach(x => { cnt[x] = (cnt[x] || 0) + 1; });
    y = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0] || (norm(firstText).match(/\b(20\d\d)\b/) || [])[1];
  }
  return y ? `${y}-${String(mi + 1).padStart(2, '0')}` : null;
}
function stxParse(wb){
  const out = [], rep = { sheets: [], skipped: [], yearFix: 0, dups: 0, tramos: 0, na: 0, noTicket: 0 };
  for (const name of wb.SheetNames){
    const ws = wb.Sheets[name], title = name.trim(), low = norm(title);
    const kind = low.startsWith('preventivo') ? 'preventivo' : low.startsWith('correctivo') ? 'correctivo' : null;
    if (!kind){ rep.skipped.push(title); continue; }
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true, blankrows: false }).slice(0, 3000).map(r => (r || []).slice(0, 40));
    const first = rows.slice(0, 3).flat().find(c => typeof c === 'string' && c.length > 10) || '';
    if (kind === 'preventivo'){
      const h = rows.findIndex(r => r.some(c => norm(c) === 'traza')); if (h < 0){ rep.skipped.push(title); continue; }
      const ci = rows[h].findIndex(c => norm(c) === 'traza');
      const data = rows.slice(h + 1).map(r => r.slice(ci)).filter(r => r[1] != null && String(r[1]).trim());
      const per = stxSheetPeriod(title, first, data.map(r => stxDate(r[2])).filter(Boolean)); if (!per){ rep.skipped.push(title); continue; }
      let n = 0;
      data.forEach((r, idx) => {
        const site = String(r[1]).trim().slice(0, 200), d = stxDate(r[2]);
        const na = !d && (/^n\s*\/?\s*a$/i.test(String(r[2] ?? '').trim()) || /no aplica/i.test(String(r[3] ?? '')));
        if (na) rep.na++;
        out.push({ kind, period: per + '-01', day: stxDay(d), na, site_name: site, traza: r[0] == null ? null : String(r[0]).trim().slice(0, 20),
                   note: r[3] == null ? null : String(r[3]).trim().slice(0, 4000), _sort: idx, _sheet: title });
        n++;
      });
      rep.sheets.push({ title, kind, per, n });
    } else {
      const h = rows.findIndex(r => r.some(c => /^nro\.?\s*ti[ck]+et/i.test(String(c ?? '').trim()))); if (h < 0){ rep.skipped.push(title); continue; }
      const off = rows[h].findIndex(c => /^nro\.?\s*ti[ck]+et/i.test(String(c ?? '').trim()));
      const data = rows.slice(h + 1).map(r => r.slice(off)).filter(r => r[0] != null || r[1] != null);
      const per = stxSheetPeriod(title, first, data.map(r => stxDate(r[1])).filter(Boolean)); if (!per){ rep.skipped.push(title); continue; }
      const [py, pm] = per.split('-').map(Number);
      const seen = new Set(); let n = 0;
      for (const r of data){
        const raw = typeof r[0] === 'string' ? r[0].replace(/\s+/g, ' ').trim() : '';
        let od = stxDate(r[1]);
        if (!raw && !od) continue;                                   // pie de la planilla (totales, punitorios)
        if (raw && !od && !/\d{4,6}/.test(raw)) continue;
        if (od && od.m === pm && Math.abs(od.y - py) === 1){ od = { ...od, y: py }; rep.yearFix++; }
        let cd = stxDate(r[6]); if (cd && od && cd.y - od.y === 1 && cd.m === od.m){ cd = { ...cd, y: od.y }; rep.yearFix++; }
        const mm = raw.match(/(\d{4,6})\s*:?\s*(.*)$/);
        const num = mm ? mm[1] : null; if (!num) rep.noTicket++;
        const parts = (mm ? mm[2] : raw).split('/').map(s => s.trim()).filter(Boolean);
        const sitesTxt = parts[0] || 'Sin sitio';
        const nodes = sitesTxt.split(/\s+-\s+|\s+–\s+/).map(s => s.trim()).filter(Boolean).slice(0, 3);
        if (nodes.length > 1) rep.tramos++;
        const base = { kind, period: per + '-01', day: stxDay(od), ticket: num, ticket_raw: raw.slice(0, 400) || null,
          category: stxCat(parts[1]), problem: parts.slice(2).join(' / ').slice(0, 200) || null,
          ttype: stxTtype(r[3]), node_type: ['3', '4'].includes(String(r[4] ?? '').trim()) ? String(r[4]).trim() : null, afect: stxAfect(r[5]),
          open_at: stxIso(od, stxTime(r[2])), close_at: stxIso(cd, stxTime(r[7])), ttr_h: stxTtr(r[9]),
          smt: /^smt/i.test(String(r[10] ?? '').trim()) ? String(r[10]).trim().slice(0, 40) : null,
          note: r[11] == null ? null : String(r[11]).trim().slice(0, 4000), _sheet: title };
        for (const nd of nodes){
          const key = (num || raw) + '|' + stxK(nd);
          if (seen.has(key)){ rep.dups++; continue; } seen.add(key);
          out.push({ ...base, site_name: nd.slice(0, 200) }); n++;
        }
      }
      rep.sheets.push({ title, kind, per, n });
    }
  }
  return { rows: out, rep };
}

/* ---------- asociar con los sitios de la app ---------- */
async function stxSites(){
  const r = await pageAll(() => sb.from('sites').select('id,name,traza,kind,aliases,lat,lng').eq('active', true).order('name').order('id')); if (r.error) throw r.error; const list = r.data || [];
  const m = new Map();
  for (const s of list){ m.set(stxK(s.name), s); for (const a of (s.aliases || [])) if (!m.has(stxK(a))) m.set(stxK(a), s); }
  return { list, byKey: m };
}

/* =====================================================================
   IMPORTAR (vista previa → confirmar)
   ===================================================================== */
function stxImportModal(after){
  if (!needOnline()) return;
  const m = modal(`<h2>⬆ Importar planilla de mantenimiento</h2>
    <p class="muted sm" style="margin-top:-4px">Una solapa por mes: "Preventivo &lt;mes&gt;" y "Correctivo &lt;mes&gt;", como la planilla de certificación. Se puede volver a subir cuando quieras: lo que ya está no se duplica.</p>
    <input type="file" id="sx-f" accept=".xlsx,.xls,.xlsm">
    <div id="sx-r" style="margin-top:10px"></div>
    <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn sec" id="sx-x">Cerrar</button><button class="btn hidden" id="sx-go">Importar</button></div>`, { wide: true });
  $('#sx-x').onclick = m.close;
  let parsed = null, sites = null;
  $('#sx-f').onchange = async () => {
    const f = $('#sx-f').files[0]; if (!f) return;
    $('#sx-r').innerHTML = '<p class="muted">Leyendo…</p>'; $('#sx-go').classList.add('hidden');
    try {
      if (f.size > 15 * 1024 * 1024) throw new Error('El archivo supera 15 MB.');
      if (!/\.(xlsx|xlsm|xls)$/i.test(f.name)) throw new Error('Tiene que ser un Excel (.xlsx).');
      const wb = XLSX.read(await f.arrayBuffer(), { type: 'array', cellDates: false, cellFormula: false, cellHTML: false, cellStyles: false, bookVBA: false, sheetRows: 3000 });
      parsed = stxParse(wb); sites = await stxSites();
    } catch (e){ $('#sx-r').innerHTML = `<p class="err">${esc(errText(e))}</p>`; return; }
    const { rows, rep } = parsed;
    const miss = new Map(); for (const r of rows){ const s = sites.byKey.get(stxK(r.site_name)); if (s) r.site_id = s.id; else { const k = stxK(r.site_name); const x = miss.get(k) || { name: r.site_name, traza: r.traza, n: 0, prev: false }; x.n++; if (r.kind === 'preventivo'){ x.prev = true; x.traza = x.traza || r.traza; } miss.set(k, x); } }
    const missPrev = [...miss.values()].filter(x => x.prev), missCorr = [...miss.values()].filter(x => !x.prev);
    const prevN = rows.filter(r => r.kind === 'preventivo' && !r.na).length, corrT = new Set(rows.filter(r => r.kind === 'correctivo').map(r => r.ticket || r.ticket_raw)).size;
    const pers = [...new Set(rows.map(r => stxPer(r.period)))].sort();
    let planN = 0; try { const { count } = await sb.from('pm_plan').select('id', { count: 'exact', head: true }); planN = count || 0; } catch {}
    $('#sx-r').innerHTML = `<div class="stats"><div class="stat"><span>Visitas preventivas</span><b>${prevN}</b></div><div class="stat"><span>Tickets correctivos</span><b>${corrT}</b></div><div class="stat"><span>Meses</span><b>${pers.length}</b><small>${pers.length ? esc(stxPerLabel(pers[0]) + ' a ' + stxPerLabel(pers[pers.length - 1])) : ''}</small></div></div>
      <div class="tblwrap" style="max-height:180px;overflow:auto;margin-top:8px"><table class="tbl"><thead><tr><th>Solapa</th><th>Mes certificado</th><th>Registros</th></tr></thead><tbody>${rep.sheets.map(s => `<tr><td>${esc(s.title)}</td><td>${esc(stxPerLong(s.per))}</td><td class="num">${s.n}</td></tr>`).join('')}</tbody></table></div>
      <ul class="sm" style="margin:8px 0">
        ${rep.yearFix ? `<li>Se corrigió el año en <b>${rep.yearFix}</b> fecha(s) mal tipeadas (ej. diciembre 2026 en la solapa de diciembre 2025).</li>` : ''}
        ${rep.dups ? `<li><b>${rep.dups}</b> ticket(s) repetidos en la misma solapa: se cuentan una vez.</li>` : ''}
        ${rep.tramos ? `<li><b>${rep.tramos}</b> correctivo(s) de tramo (Nodo A – Nodo B): se suman a los dos nodos.</li>` : ''}
        ${rep.na ? `<li><b>${rep.na}</b> preventivo(s) "no aplica este mes": no cuentan como faltantes.</li>` : ''}
        ${rep.noTicket ? `<li><b>${rep.noTicket}</b> correctivo(s) sin número de ticket legible.</li>` : ''}
        ${rep.skipped.length ? `<li>Solapas que no se leen (no son de mantenimiento): ${esc(rep.skipped.join(', '))}.</li>` : ''}
      </ul>
      ${missPrev.length ? `<label style="display:flex;gap:8px;align-items:flex-start;font-weight:400"><input type="checkbox" id="sx-mk" checked style="width:auto;margin-top:3px"> Crear en Sitios los <b>${missPrev.length}</b> nodos de los preventivos que no están cargados (${esc(missPrev.slice(0, 8).map(x => x.name).join(', '))}${missPrev.length > 8 ? '…' : ''})</label>` : ''}
      ${missCorr.length ? `<p class="muted sm">${missCorr.length} nombre(s) de los correctivos no coinciden con un sitio (${esc(missCorr.slice(0, 6).map(x => x.name).join(', '))}${missCorr.length > 6 ? '…' : ''}): quedan como texto y cuentan igual en las estadísticas. Podés sumarlos como alias del sitio en Sitios.</p>` : ''}
      ${!planN ? `<label style="display:flex;gap:8px;align-items:flex-start;font-weight:400;margin-top:6px"><input type="checkbox" id="sx-mkplan" checked style="width:auto;margin-top:3px"> Armar el <b>plan de preventivos</b> con los nodos de la última solapa (mensual; los que figuran "no aplica" con la frecuencia que surge de la planilla)</label>` : ''}`;
    $('#sx-go').classList.remove('hidden'); $('#sx-go').disabled = false;
    $('#sx-go').onclick = async () => {
      $('#sx-go').disabled = true; const st = t => { $('#sx-go').textContent = t; };
      try {
        if ($('#sx-mk')?.checked){
          st('Creando sitios…');
          for (let i = 0; i < missPrev.length; i += 100){
            const { error } = await sb.from('sites').insert(missPrev.slice(i, i + 100).map(x => ({ org_id: me.org_id, name: x.name, kind: /^ac/i.test(x.traza || '') ? 'acueducto' : 'epi', traza: x.traza && !/^ac/i.test(x.traza) ? x.traza : null })));
            if (error && !/duplicate|unique/i.test(error.message || '')) throw error;
          }
          await IDB.del('kv', CUR_UID + ':sites-min2').catch(() => {});
          sites = await stxSites(); for (const r of rows) if (!r.site_id){ const s = sites.byKey.get(stxK(r.site_name)); if (s) r.site_id = s.id; }
        }
        const batch = uid(); let ins = 0;
        const clean = rows.map(r => { const o = { ...r, batch }; delete o._sort; delete o._sheet; return o; });
        for (let i = 0; i < clean.length; i += 500){
          st(`Importando ${Math.min(i + 500, clean.length)} de ${clean.length}…`);
          const { data, error } = await sb.rpc('stats_import', { p_rows: clean.slice(i, i + 500) }); if (error) throw error; ins += data || 0;
        }
        let planMsg = '';
        if ($('#sx-mkplan')?.checked){ st('Armando el plan…'); planMsg = await stxPlanFromRows(rows); }
        await IDB.del('kv', CUR_UID + ':stx').catch(() => {});
        m.close(); toast(`Importados ${ins} registro(s) nuevos${ins < clean.length ? ` (${clean.length - ins} ya estaban)` : ''}.${planMsg}`); after && after();
      } catch (e){ $('#sx-go').disabled = false; st('Importar'); toast(errText(e)); }
    };
  };
}
/* plan inicial a partir de la planilla: nodos de la última solapa de preventivo */
async function stxPlanFromRows(rows){
  const prev = rows.filter(r => r.kind === 'preventivo'); if (!prev.length) return '';
  const lastPer = prev.map(r => stxPer(r.period)).sort().pop();
  const perCount = new Set(prev.map(r => stxPer(r.period))).size;
  const last = prev.filter(r => stxPer(r.period) === lastPer).sort((a, b) => a._sort - b._sort);
  const items = last.map((r, i) => {
    const hist = prev.filter(x => stxK(x.site_name) === stxK(r.site_name) && !x.na);
    let freq = 1;
    if (prev.some(x => stxK(x.site_name) === stxK(r.site_name) && x.na)){ const f = Math.round(perCount / Math.max(1, hist.length)); freq = [1, 2, 3, 4, 6, 12].reduce((a, b) => Math.abs(b - f) < Math.abs(a - f) ? b : a, 1); }
    const lastVisit = hist.map(x => stxPer(x.period)).sort().pop() || lastPer;
    return { site_id: r.site_id || null, site_name: r.site_name, traza: r.traza, freq_months: freq, start_period: (freq === 1 ? lastPer : lastVisit) + '-01', sort: i + 1, active: true };
  });
  const { error } = await sb.from('pm_plan').insert(items);
  if (error) throw error;
  return ` Plan de preventivos armado con ${items.length} nodo(s).`;
}

/* =====================================================================
   ESTADÍSTICAS MES A MES (arriba de Estadísticas)
   ===================================================================== */
async function stxSection(box){
  if (!box) return;
  await stxLoadCfg();
  const mgr = isManager() && canWrite();
  const cur = stxCurPeriod('preventivo'), from = stxAddMonths(cur, -12);
  let rows = [], plan = [];
  try {
    [rows, plan] = await Promise.all([
      cached('stx', () => sb.rpc('stats_rows', { p_from: from + '-01', p_to: cur + '-01' })),
      cached('stx-plan', () => sb.from('pm_plan').select('id,site_id,site_name,traza,freq_months,start_period,active').eq('active', true).limit(3000)),
    ]);
  } catch (e){ box.innerHTML = `<div class="card"><b>Histórico</b><p class="muted">${esc(errText(e))}</p></div>`; return; }
  rows = rows || []; plan = plan || [];
  const pers = Array.from({ length: 13 }, (_, i) => stxAddMonths(from, i));
  const P = Object.fromEntries(pers.map(p => [p, { prev: new Set(), corr: new Set(), due: 0, done: 0, res: [], inTtr: 0, withTtr: 0 }]));
  const corrRows = [];
  for (const r of rows){
    const p = stxPer(r.period); if (!P[p]) continue;
    if (r.kind === 'preventivo'){ if (!r.na) P[p].prev.add(stxK(r.site_name)); }
    else {
      const tk = r.ticket || r.inspection_id || r.ticket_raw || (r.site_name + r.day);
      if (!P[p].corr.has(tk)){
        P[p].corr.add(tk);
        if (r.open_at && r.close_at){ const h = (new Date(r.close_at) - new Date(r.open_at)) / 3600000; if (h >= 0 && h < 24 * 90){ P[p].res.push(h); if (r.ttr_h){ P[p].withTtr++; if (h <= Number(r.ttr_h)) P[p].inTtr++; } } }
      }
      corrRows.push(r);
    }
  }
  // cumplimiento del plan por período (misma regla que la base)
  for (const p of pers) for (const pl of plan){
    const st = stxPer(pl.start_period), k = stxMonthsBetween(st, p);
    if (k < 0 || k % pl.freq_months) continue;
    P[p].due++; if (P[p].prev.has(stxK(pl.site_name))) P[p].done++;
  }
  const last12 = pers.slice(-12), mx = Math.max(1, ...last12.map(p => Math.max(P[p].prev.size, P[p].corr.size)));
  const curP = P[cur], pct = curP.due ? Math.round(curP.done * 100 / curP.due) : null;
  const allRes = last12.flatMap(p => P[p].res), mttr = allRes.length ? allRes.reduce((a, b) => a + b, 0) / allRes.length : null;
  const inT = last12.reduce((a, p) => a + P[p].inTtr, 0), wT = last12.reduce((a, p) => a + P[p].withTtr, 0);
  const cats = {}; const bySite = {}; const probs = {};
  const seenT = new Set();
  for (const r of corrRows){ if (!last12.includes(stxPer(r.period))) continue;
    bySite[r.site_name] = (bySite[r.site_name] || 0) + 1;
    const tk = (r.ticket || r.inspection_id || r.ticket_raw) + '|' + stxPer(r.period); if (seenT.has(tk)) continue; seenT.add(tk);
    const c = r.category || 'Sin categoría'; cats[c] = (cats[c] || 0) + 1;
    if (r.problem){ const k = r.problem.replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 50); probs[k] = (probs[k] || 0) + 1; } }
  const top = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n);
  const fromApp = rows.some(r => r.src === 'app'), fromXl = rows.some(r => r.src === 'excel');
  box.innerHTML = `<div class="card">
      <div class="row between"><div><h2 style="margin:0">📈 Mantenimiento mes a mes</h2><div class="muted sm">Períodos de certificación: preventivo del ${STX.cfg.cert_day_prev} al ${STX.cfg.cert_day_prev} · correctivo por mes. ${fromXl ? 'Histórico de la planilla' : 'Sin histórico importado'}${fromApp ? ' + lo cargado en la app (se actualiza solo)' : ''}.</div></div>
        <div class="row" style="gap:6px">${mgr ? '<button class="btn sec small" id="sx-imp">⬆ Importar planilla</button>' : ''}<button class="btn sec small" id="sx-plan">🗓 Plan de preventivos</button>${mgr ? '<button class="btn small" id="sx-cert">⬇ Certificación</button>' : ''}</div></div>
      <div class="stats" style="margin-top:12px">
        <div class="stat"><span>Preventivos ${esc(stxPerLabel(cur))}</span><b>${curP.prev.size}</b>${curP.due ? `<small>de ${curP.due} del plan</small>` : ''}</div>
        <div class="stat"><span>Cumplimiento del plan</span><b style="color:${pct == null ? 'inherit' : pct >= 90 ? 'var(--green-d)' : pct >= 70 ? 'var(--amber)' : 'var(--red)'}">${pct == null ? '—' : pct + '%'}</b><small>período en curso</small></div>
        <div class="stat"><span>Correctivos ${esc(stxPerLabel(stxCurPeriod('correctivo')))}</span><b>${(P[stxCurPeriod('correctivo')]?.corr.size) ?? 0}</b></div>
        <div class="stat"><span>Tiempo medio de resolución</span><b>${mttr == null ? '—' : hhH(mttr)}</b><small>últimos 12 meses</small></div>
        <div class="stat"><span>Dentro del TTR</span><b>${wT ? Math.round(inT * 100 / wT) + '%' : '—'}</b><small>${wT ? inT + ' de ' + wT + ' tickets' : ''}</small></div>
      </div>
      <div class="viz-legend" style="margin-top:12px"><span><i style="background:${COL_PREV}"></i>Preventivos (sitios visitados)</span><span><i style="background:${COL_CORR}"></i>Correctivos (tickets)</span></div>
      <div class="stx-bars">${last12.map(p => { const a = P[p].prev.size, b = P[p].corr.size;
        const tip = `<b>${esc(stxPerLong(p))}</b><br>Preventivos: ${a}${P[p].due ? ' de ' + P[p].due + ' (' + Math.round(P[p].done * 100 / P[p].due) + '%)' : ''}<br>Correctivos: ${b}`;
        return `<div class="g" data-tip="${esc(tip)}"><div class="b" style="height:${a * 100 / mx}%;background:${COL_PREV}"><span>${a || ''}</span></div><div class="b" style="height:${b * 100 / mx}%;background:${COL_CORR}"><span>${b || ''}</span></div></div>`; }).join('')}</div>
      <div class="stx-lbl">${last12.map(p => `<span>${esc(stxPerLabel(p))}</span>`).join('')}</div>
    </div>
    <div class="grid2">
      <div class="card"><h2 style="margin:0 0 8px">Correctivos por categoría</h2>${chartHBars(top(cats, 8).map(([k, v]) => ({ label: k, v, c: COL_CORR })))}</div>
      <div class="card"><h2 style="margin:0 0 8px">Sitios con más correctivos</h2>${chartHBars(top(bySite, 10).map(([k, v]) => ({ label: k, v, c: COL_CORR })))}</div>
    </div>
    ${Object.keys(probs).length ? `<div class="card"><h2 style="margin:0 0 8px">Problemas que más se repiten</h2>${chartHBars(top(probs, 10).map(([k, v]) => ({ label: k.charAt(0).toUpperCase() + k.slice(1), v, c: COL_CORR })))}</div>` : ''}
    <div class="card"><h2 style="margin:0 0 8px">Detalle por mes</h2><div class="tblwrap"><table class="tbl"><thead><tr><th>Período</th><th class="num">Preventivos</th><th class="num">Plan</th><th class="num">Cumpl.</th><th class="num">Correctivos</th><th class="num">Resolución media</th><th class="num">Dentro del TTR</th></tr></thead><tbody>
      ${last12.slice().reverse().map(p => { const x = P[p], r = x.res.length ? x.res.reduce((a, b) => a + b, 0) / x.res.length : null;
        return `<tr><td>${esc(stxPerLong(p))}</td><td class="num">${x.prev.size}</td><td class="num">${x.due || '—'}</td><td class="num">${x.due ? Math.round(x.done * 100 / x.due) + '%' : '—'}</td><td class="num">${x.corr.size}</td><td class="num">${r == null ? '—' : hhH(r)}</td><td class="num">${x.withTtr ? Math.round(x.inTtr * 100 / x.withTtr) + '%' : '—'}</td></tr>`; }).join('')}</tbody></table></div></div>`;
  const lim = STX.cfg.presence_m || 1000, far = rows.filter(r => r.src === 'app' && r.dist_m != null && Number(r.dist_m) > lim && last12.includes(stxPer(r.period)));
  { const u = new Map(); far.forEach(r => u.set(r.inspection_id || Math.random(), r)); far.length = 0; far.push(...u.values()); }
  if (far.length) box.insertAdjacentHTML('beforeend', `<div class="card"><h2 style="margin:0 0 4px">📍 Cargadas lejos del sitio (${far.length})</h2><p class="muted sm" style="margin:0 0 8px">La ubicación del teléfono al iniciar quedó a más de ${esc(stxDistTxt(lim))} del sitio. Puede ser falta de señal GPS o que se cargó desde otro lugar.</p>
    <div class="tblwrap"><table class="tbl"><thead><tr><th>Fecha</th><th>Sitio</th><th>Tipo</th><th class="num">Distancia</th><th></th></tr></thead><tbody>${far.sort((a, b) => String(b.day).localeCompare(String(a.day))).slice(0, 50).map(r => `<tr><td>${esc(fmtD(r.day))}</td><td>${esc(r.site_name)}</td><td>${esc(r.kind)}</td><td class="num">${esc(stxDistTxt(Number(r.dist_m)))}</td><td>${r.inspection_id ? `<a href="#/informe/${esc(r.inspection_id)}">Ver</a>` : ''}</td></tr>`).join('')}</tbody></table></div></div>`);
  bindTips(box);
  $('#sx-imp')?.addEventListener('click', () => stxImportModal(() => stxSection(box)));
  $('#sx-plan')?.addEventListener('click', () => { location.hash = '#/stats/plan'; });
  $('#sx-cert')?.addEventListener('click', () => stxCertModal());
}
function stxCss(){
  if (document.getElementById('stx-css')) return;
  const st = document.createElement('style'); st.id = 'stx-css';
  st.textContent = `.stx-bars{display:flex;align-items:flex-end;gap:6px;height:180px;margin-top:8px;border-bottom:1px solid var(--line)}
.stx-bars .g{flex:1;display:flex;align-items:flex-end;gap:2px;height:100%}
.stx-bars .b{flex:1;border-radius:4px 4px 0 0;position:relative;min-height:1px}
.stx-bars .b span{position:absolute;top:-16px;left:0;right:0;text-align:center;font-size:10px;color:var(--muted)}
.stx-lbl{display:flex;gap:6px;margin-top:4px}.stx-lbl span{flex:1;text-align:center;font-size:10px;color:var(--muted)}
.grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px}
.stx-dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:4px;vertical-align:-1px}`;
  document.head.appendChild(st);
}

/* =====================================================================
   PLAN DE PREVENTIVOS  #/stats/plan
   ===================================================================== */
let stxMap = null;
async function viewPlan(v){
  stxCss(); await stxLoadCfg();
  if (!needOnline()){ v.innerHTML = '<div class="card">El plan necesita señal.</div>'; return; }
  const w = isManager() && canWrite();
  const per = STX.planPer || stxCurPeriod('preventivo'); STX.planPer = per;
  const [st, plan, ctrs, tpls] = await Promise.all([
    sb.rpc('pm_status', { p_period: per + '-01' }).then(r => { if (r.error) throw r.error; return r.data || []; }),
    sb.from('pm_plan').select('*').order('sort').order('site_name').limit(3000).then(r => r.data || []),
    sb.from('contractors').select('id,name').eq('active', true).order('name').then(r => r.data || []),
    w ? sb.from('templates').select('id,name,kind').eq('published', true).order('name').then(r => r.data || []) : Promise.resolve([]),
  ]);
  const sOf = id => st.find(x => x.plan_id === id);
  const cnt = k => st.filter(x => x.status === k).length;
  const due = st.filter(x => x.due || x.status === 'atrasado').length, done = cnt('ok');
  const pct = due ? Math.round(done * 100 / due) : null;
  const trazas = [...new Set(plan.map(p => p.traza || 'Sin traza'))].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
  const fT = STX.planTraza || '';
  v.innerHTML = `<div class="row between" style="margin-bottom:8px"><button class="btn sec small" id="pl-back">← Estadísticas</button></div>
    <div class="card"><div class="row between"><div><h2 style="margin:0">🗓 Plan de preventivos</h2><div class="muted sm">Cada cuánto se visita cada sitio. Período de certificación del ${STX.cfg.cert_day_prev} al ${STX.cfg.cert_day_prev}.</div></div>
      <div class="row" style="gap:6px"><button class="btn sec small" id="pl-prev">‹</button><b>${esc(stxPerLong(per))}</b><button class="btn sec small" id="pl-next">›</button></div></div>
      <div class="stats" style="margin-top:12px">
        <div class="stat"><span>Cumplimiento</span><b style="color:${pct == null ? 'inherit' : pct >= 90 ? 'var(--green-d)' : pct >= 70 ? 'var(--amber)' : 'var(--red)'}">${pct == null ? '—' : pct + '%'}</b><small>${done} de ${due}</small></div>
        <div class="stat"><span><span class="stx-dot" style="background:${STX_ST.pendiente[1]}"></span>Le toca y falta</span><b>${cnt('pendiente')}</b></div>
        <div class="stat"><span><span class="stx-dot" style="background:${STX_ST.atrasado[1]}"></span>Atrasados</span><b>${cnt('atrasado')}</b></div>
        <div class="stat"><span><span class="stx-dot" style="background:${STX_ST.ok[1]}"></span>Hechos</span><b>${done}</b></div>
      </div>
      ${w ? `<div class="row" style="gap:6px;margin-top:10px"><button class="btn small" id="pl-gen">📋 Armar las tareas del período</button><button class="btn sec small" id="pl-add">+ Sitio al plan</button>
        <label class="sm" style="display:flex;gap:6px;align-items:center;font-weight:400;margin:0"><input type="checkbox" id="pl-auto" style="width:auto" ${STX.cfg.pm_auto_tasks ? 'checked' : ''}> Armarlas solas el día ${STX.cfg.cert_day_prev} de cada mes</label>
        <select id="pl-tpl" style="width:auto;padding:4px 6px;font-size:12px"><option value="">Plantilla: la primera de preventivo</option>${tpls.map(t => `<option value="${esc(t.id)}" ${STX.cfg.pm_template_id === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></div>` : ''}
    </div>
    <div class="card"><div id="pl-map" style="height:340px;border-radius:12px"></div><div class="viz-legend" style="margin-top:6px">${Object.values(STX_ST).map(([n, c]) => `<span><i style="background:${c}"></i>${n}</span>`).join('')}</div></div>
    <div class="card"><div class="row between"><h2 style="margin:0">Sitios del plan (${plan.length})</h2><select id="pl-tr" style="width:auto"><option value="">Todas las trazas</option>${trazas.map(t => `<option ${t === fT ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></div>
      <div class="tblwrap" style="margin-top:8px"><table class="tbl"><thead><tr><th>Sitio</th><th>Traza</th><th>Frecuencia</th><th>Estado</th><th>Última visita</th>${w ? '<th>Contratista</th><th></th>' : ''}</tr></thead><tbody>
      ${plan.filter(p => !fT || (p.traza || 'Sin traza') === fT).map(p => { const s = sOf(p.id), k = p.active ? (s?.status || 'no_toca') : null;
        return `<tr style="${p.active ? '' : 'opacity:.5'}"><td><b>${esc(p.site_name)}</b>${p.site_id ? '' : ' <span class="pill p-pend" title="No está en Sitios: sin ubicación en el mapa">sin sitio</span>'}</td><td>${esc(p.traza || '')}</td>
          <td>${w ? `<select data-pf="${esc(p.id)}" style="width:auto;padding:4px 6px;font-size:12px">${Object.entries(STX_FREQ).map(([f, n]) => `<option value="${f}" ${Number(f) === p.freq_months ? 'selected' : ''}>${n}</option>`).join('')}</select>` : esc(STX_FREQ[p.freq_months])}</td>
          <td>${k ? `<span class="pill" style="background:${STX_ST[k][1]}22;color:${STX_ST[k][1]}">${STX_ST[k][0]}</span>` : '<span class="pill">Pausado</span>'}${s?.done_day ? ' <span class="sm muted">' + esc(fmtD(s.done_day)) + '</span>' : ''}</td>
          <td class="sm">${s?.last_day ? esc(fmtD(s.last_day)) : '—'}</td>
          ${w ? `<td><select data-pc="${esc(p.id)}" style="width:auto;max-width:150px;padding:4px 6px;font-size:12px"><option value="">—</option>${ctrs.map(c => `<option value="${esc(c.id)}" ${c.id === p.contractor_id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></td>
            <td style="white-space:nowrap"><button class="btn sec small" data-pa="${esc(p.id)}" data-on="${p.active}">${p.active ? 'Pausar' : 'Activar'}</button> <button class="btn sec small" data-pd="${esc(p.id)}">🗑</button></td>` : ''}</tr>`; }).join('') || '<tr><td colspan="7" class="muted">Todavía no hay plan. Importá la planilla desde Estadísticas o sumá sitios con "+ Sitio al plan".</td></tr>'}
      </tbody></table></div></div>`;
  $('#pl-back').onclick = () => { location.hash = '#/stats'; };
  $('#pl-prev').onclick = () => { STX.planPer = stxAddMonths(per, -1); viewPlan(v); };
  $('#pl-next').onclick = () => { STX.planPer = stxAddMonths(per, 1); viewPlan(v); };
  $('#pl-tr').onchange = e => { STX.planTraza = e.target.value; viewPlan(v); };
  const upd = async (id, patch, msg) => { const { error } = await sb.from('pm_plan').update(patch).eq('id', id); if (error) return toast(errText(error)); await IDB.del('kv', CUR_UID + ':stx-plan').catch(() => {}); toast(msg || 'Guardado'); viewPlan(v); };
  v.querySelectorAll('[data-pf]').forEach(s => s.onchange = () => upd(s.dataset.pf, { freq_months: Number(s.value) }, 'Frecuencia actualizada'));
  v.querySelectorAll('[data-pc]').forEach(s => s.onchange = () => upd(s.dataset.pc, { contractor_id: s.value || null }, 'Contratista actualizada'));
  v.querySelectorAll('[data-pa]').forEach(b => b.onclick = () => upd(b.dataset.pa, { active: b.dataset.on !== 'true' }));
  v.querySelectorAll('[data-pd]').forEach(b => b.onclick = async () => { if (!confirm('¿Quitar este sitio del plan? Su historial de visitas se conserva.')) return; const { error } = await sb.from('pm_plan').delete().eq('id', b.dataset.pd); if (error) return toast(errText(error)); viewPlan(v); });
  $('#pl-gen')?.addEventListener('click', async () => {
    if (!confirm(`¿Armar las tareas de ${stxPerLong(per)}? Se crea una tarea por traza con los sitios que faltan (no se duplica si ya existe).`)) return;
    const { data, error } = await sb.rpc('pm_generate_tasks', { p_period: per + '-01' }); if (error) return toast(errText(error));
    await IDB.del('kv', CUR_UID + ':tasks').catch(() => {}); toast(data ? `Listo: ${data} tarea(s) nuevas en Tareas` : 'No había tareas nuevas para armar (ya estaban o no falta nada).');
  });
  const saveCfg = async patch => { const { error } = await sb.from('org_settings').upsert({ org_id: me.org_id, ...patch }, { onConflict: 'org_id' }); if (error) return toast(errText(error)); await IDB.del('kv', CUR_UID + ':org-cfg').catch(() => {}); Object.assign(STX.cfg, patch); toast('Guardado'); };
  $('#pl-auto')?.addEventListener('change', e => saveCfg({ pm_auto_tasks: e.target.checked }));
  $('#pl-tpl')?.addEventListener('change', e => saveCfg({ pm_template_id: e.target.value || null }));
  $('#pl-add')?.addEventListener('click', async () => {
    const sites = (await pageAll(() => sb.from('sites').select('id,name,traza').eq('active', true).order('name').order('id'))).data || [];
    const inPlan = new Set(plan.map(p => p.site_id));
    const m = modal(`<h2>+ Sitio al plan</h2><label>Sitio</label><select id="pa-s">${sites.filter(s => !inPlan.has(s.id)).map(s => `<option value="${esc(s.id)}">${esc(s.name)}${s.traza ? ' · Traza ' + esc(s.traza) : ''}</option>`).join('')}</select>
      <label>Frecuencia</label><select id="pa-f">${Object.entries(STX_FREQ).map(([f, n]) => `<option value="${f}">${n}</option>`).join('')}</select>
      <label>Desde el período</label><input id="pa-p" type="month" value="${esc(per)}">
      <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn sec" id="pa-x">Cancelar</button><button class="btn" id="pa-ok">Agregar</button></div>`);
    $('#pa-x').onclick = m.close;
    $('#pa-ok').onclick = async () => { const s = sites.find(x => x.id === $('#pa-s').value); if (!s) return;
      const { error } = await sb.from('pm_plan').insert({ site_id: s.id, site_name: s.name, traza: s.traza, freq_months: Number($('#pa-f').value), start_period: ($('#pa-p').value || per) + '-01', sort: 900, active: true });
      if (error) return toast(/duplicate|unique/i.test(error.message || '') ? 'Ese sitio ya está en el plan.' : errText(error)); m.close(); viewPlan(v); };
  });
  // mapa con semáforo del plan
  try {
    if (stxMap){ stxMap.remove(); stxMap = null; }
    let coords = typeof SITE_COORDS !== 'undefined' ? SITE_COORDS : new Map();
    if (!coords.size && typeof loadSitesMap === 'function'){ try { rememberCoords(await loadSitesMap()); coords = SITE_COORDS; } catch {} }
    stxMap = L.map('pl-map', { zoomControl: true }); L.tileLayer(MAP_TILE_URL_SAFE(), { maxZoom: 18, attribution: '© OpenStreetMap' }).addTo(stxMap);
    const pts = [];
    for (const p of plan){ if (!p.active || !p.site_id) continue; const c = coords.get(p.site_id); if (!c) continue; const s = sOf(p.id), k = s?.status || 'no_toca';
      L.circleMarker(c, { radius: 7, color: '#fff', weight: 1.5, fillColor: STX_ST[k][1], fillOpacity: 1 }).bindTooltip(`<b>${esc(p.site_name)}</b><br>${esc(STX_ST[k][0])}${s?.last_day ? ' · última ' + esc(fmtD(s.last_day)) : ''}`).addTo(stxMap); pts.push(c); }
    if (pts.length) stxMap.fitBounds(pts, { padding: [20, 20] }); else stxMap.setView([-31.6, -60.7], 7);
  } catch {}
}
const MAP_TILE_URL_SAFE = () => (typeof MAP_TILE_URL !== 'undefined' ? MAP_TILE_URL : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');

/* =====================================================================
   PLANILLA DE CERTIFICACIÓN DEL MES (mismo formato que la de hoy)
   ===================================================================== */
function stxCertModal(){
  const per = stxCurPeriod('preventivo'), prevP = stxAddMonths(per, -1);
  const m = modal(`<h2>⬇ Certificación mensual</h2><p class="muted sm" style="margin-top:-4px">Genera el Excel con las solapas Preventivo y Correctivo del período, en el formato de la planilla de certificación.</p>
    <label>Período</label><input id="ce-p" type="month" value="${esc(prevP)}">
    <label>Título del preventivo</label><input id="ce-tp" maxlength="200" value="${esc(STX.cfg.cert_title_prev || 'SERVICIO DE MANTENIMIENTO PREVENTIVO {MES} RENGLON 3 ZONA NORTE 1')}">
    <label>Título del correctivo</label><input id="ce-tc" maxlength="200" value="${esc(STX.cfg.cert_title_corr || 'CERTIFICACIÓN DE SERVICIO DE MANTENIMIENTO CORRECTIVO – ZONA NORTE 1 – {MES}')}">
    <p class="muted sm">{MES} se reemplaza por el mes y el año. Los títulos quedan guardados.</p>
    <div class="err" id="ce-err"></div>
    <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn sec" id="ce-x">Cancelar</button><button class="btn" id="ce-ok">Generar Excel</button></div>`);
  $('#ce-x').onclick = m.close;
  $('#ce-ok').onclick = async () => {
    const p = $('#ce-p').value; if (!p) return; $('#ce-ok').disabled = true;
    const tp = $('#ce-tp').value.trim(), tc = $('#ce-tc').value.trim();
    try {
      if (tp !== (STX.cfg.cert_title_prev || '') || tc !== (STX.cfg.cert_title_corr || '')){ await sb.from('org_settings').upsert({ org_id: me.org_id, cert_title_prev: tp, cert_title_corr: tc }, { onConflict: 'org_id' }); STX.cfg.cert_title_prev = tp; STX.cfg.cert_title_corr = tc; await IDB.del('kv', CUR_UID + ':org-cfg').catch(() => {}); }
      await stxCertExcel(p, tp, tc); m.close();
    } catch (e){ $('#ce-ok').disabled = false; $('#ce-err').textContent = errText(e); }
  };
}
async function stxCertExcel(per, tp, tc){
  const [st, rows] = await Promise.all([
    sb.rpc('pm_status', { p_period: per + '-01' }).then(r => { if (r.error) throw r.error; return r.data || []; }),
    sb.rpc('stats_rows', { p_from: per + '-01', p_to: per + '-01' }).then(r => { if (r.error) throw r.error; return r.data || []; }),
  ]);
  await hhLoadExcelJS();
  const X = s => { s = s == null ? '' : String(s); return /^[=+\-@\t\r]/.test(s) ? "'" + s : s; };
  const mes = stxPerLong(per).toUpperCase();
  const wb = new ExcelJS.Workbook(); wb.creator = 'InspectApp';
  const border = { top: { style: 'thin', color: { argb: 'FF9CA3AF' } }, left: { style: 'thin', color: { argb: 'FF9CA3AF' } }, bottom: { style: 'thin', color: { argb: 'FF9CA3AF' } }, right: { style: 'thin', color: { argb: 'FF9CA3AF' } } };
  const head = (ws, row) => { ws.getRow(row).eachCell(c => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F2A4A' } }; c.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' }; c.border = border; }); ws.getRow(row).height = 32; };
  const dt = s => { if (!s) return null; const d = new Date(s); return isNaN(d) ? null : d; };
  // ---- Preventivo ----
  const wp = wb.addWorksheet(X(('Preventivo ' + stxPerLong(per)).slice(0, 31)));
  wp.columns = [{ width: 8 }, { width: 28 }, { width: 14 }, { width: 70 }];
  wp.mergeCells(1, 1, 1, 4); wp.getCell(1, 1).value = X(tp.replace('{MES}', mes)); wp.getCell(1, 1).font = { bold: true, size: 13 }; wp.getCell(1, 1).alignment = { horizontal: 'center' };
  wp.addRow(['Traza', 'Nodo / Localidad:', 'Fecha\nChek List ', 'Observaciones']); head(wp, 2);
  const prevRows = rows.filter(r => r.kind === 'preventivo');
  const noteOf = s => prevRows.find(r => stxK(r.site_name) === stxK(s.site_name))?.note || null;
  for (const s of st.slice().sort((a, b) => (a.sort - b.sort) || a.site_name.localeCompare(b.site_name))){
    const r = wp.addRow([/^\d+$/.test(s.traza || '') ? Number(s.traza) : X(s.traza || ''), X(s.site_name), s.status === 'no_toca' ? 'N/A' : (s.done_day ? hhXDate(s.done_day) : null), X(s.status === 'no_toca' ? 'No aplica este mes.' : (noteOf(s) || (s.status === 'ok' ? '' : 'Pendiente')))]);
    r.getCell(3).numFmt = 'dd/mm/yyyy'; r.eachCell({ includeEmpty: true }, c => { c.border = border; c.alignment = { vertical: 'top', wrapText: true }; });
    if (s.status === 'pendiente' || s.status === 'atrasado') r.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
  }
  // ---- Correctivo ----
  const wc = wb.addWorksheet(X(('Correctivo ' + stxPerLong(per)).slice(0, 31)));
  wc.columns = [{ width: 48 }, { width: 12 }, { width: 8 }, { width: 12 }, { width: 10 }, { width: 16 }, { width: 12 }, { width: 8 }, { width: 14 }, { width: 9 }, { width: 14 }, { width: 70 }, { width: 22 }];
  wc.mergeCells(1, 1, 1, 13); wc.getCell(1, 1).value = X(tc.replace('{MES}', mes)); wc.getCell(1, 1).font = { bold: true, size: 13 }; wc.getCell(1, 1).alignment = { horizontal: 'center' };
  const refs = ['Referencias de certificación', 'tipificación de incidente', 'Nro Ticket: Número del ticket creado en el NOC', 'Fecha Apertura: Fecha de apertura del Ticket', 'Hora: Hora de apertura del Ticket',
    'Tipo de Ticket: Indica la naturaleza del ticket creado', 'Incidente: El problema afecta algun servicio ', 'Informativo: El problema es solo informativo ', 'Tipo de Nodo Afectado: Indica el tipo de Nodo',
    'Afectación del Servicio: Indica si el servicio fue afectado', 'Fecha Solución: Fecha de cierre del ticket', 'Hora: Hora de cierre del Ticket', 'Horas que exceden el SLA comprometido : Horas fuera del TTR',
    'Comentarios: Informes incorporados al Ticket '];
  refs.forEach((t, i) => { wc.getCell(2 + i, 1).value = t; wc.getCell(2 + i, 1).font = { italic: i > 0, bold: i === 0, color: { argb: 'FF374151' }, size: 9 }; });
  const hr = 2 + refs.length + 2;
  wc.getRow(hr).values = ['Nro.Tiket', 'Fecha Apertura', 'Hora:', 'Tipo de Ticket\n', 'Tipo de Nodo Afectado', 'Afectación de Servicio', 'Fecha Solución', 'Hora:', 'Horas que exceden el SLA comprometido', 'TTR MAX (HS)', 'Tipo de SMT Correctivo afectado', 'Comentarios', 'Coordenadas'];
  head(wc, hr);
  const coords = typeof SITE_COORDS !== 'undefined' ? SITE_COORDS : new Map();
  const groups = new Map();
  for (const r of rows.filter(r => r.kind === 'correctivo')){ const k = r.ticket || r.inspection_id || r.ticket_raw || (r.site_name + r.day); const g = groups.get(k) || { r, sites: [] }; g.sites.push(r.site_name); if (!g.coord && r.site_id && coords.get(r.site_id)) g.coord = coords.get(r.site_id); groups.set(k, g); }
  const lDay = d => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())), lTime = d => (d.getHours() * 60 + d.getMinutes()) / 1440;
  const hm = h => { const m = Math.round(h * 60); return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
  let rn = hr + 1;
  for (const { r, sites, coord } of [...groups.values()].sort((a, b) => String(a.r.open_at || a.r.day).localeCompare(String(b.r.open_at || b.r.day)))){
    const o = dt(r.open_at), c = dt(r.close_at), res = o && c ? (c - o) / 3600000 : null, exc = res != null && r.ttr_h ? Math.max(0, res - Number(r.ttr_h)) : null;
    const tk = r.ticket_raw || `Ticket ${r.ticket || 's/n'}: ${sites.join(' - ')}${r.category ? ' / ' + r.category : ''}${r.problem ? ' / ' + r.problem : ''}`;
    const row = wc.getRow(rn++);
    row.values = [X(tk), o ? lDay(o) : null, o ? lTime(o) : null, X(r.ttype || 'Incidente'), r.node_type ? Number(r.node_type) : null, X(r.afect || ''),
      c ? lDay(c) : null, c ? lTime(c) : null, exc == null ? null : hm(exc), r.ttr_h ? Number(r.ttr_h) : null, X(r.smt || ''), X(r.note || ''), coord ? `${coord[0].toFixed(6)}, ${coord[1].toFixed(6)}` : null];
    row.getCell(2).numFmt = 'dd/mm/yyyy'; row.getCell(7).numFmt = 'dd/mm/yyyy'; row.getCell(3).numFmt = 'hh:mm'; row.getCell(8).numFmt = 'hh:mm';
    row.eachCell({ includeEmpty: true }, cc => { cc.border = border; cc.alignment = { vertical: 'top', wrapText: true }; });
    if (exc) row.getCell(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
  }
  wc.getCell(rn + 1, 1).value = `Total tickets: ${groups.size}`; wc.getCell(rn + 1, 1).font = { bold: true };
  const buf = await wb.xlsx.writeBuffer();
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  a.download = `Certificación ${stxPerLong(per)}.xlsx`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/* =====================================================================
   CORRECTIVO: datos del ticket (como la planilla de certificación)
   ===================================================================== */
const STX_TTYPES = ['Incidente', 'Informativo', 'Mantenimiento'];
const STX_AFECT = ['Afectado', 'Sin afectación', 'Sin afectación (solo DWDM)'];
const stxLocalDT = iso => { if (!iso) return ''; const d = new Date(iso); if (isNaN(d)) return ''; const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 16); };
function stxCorrFields(c = {}, ticket = '', sites = [], site2 = ''){
  const opt = (arr, v) => arr.map(x => `<option ${x === v ? 'selected' : ''}>${esc(x)}</option>`).join('');
  return `<div class="cf-box" style="border:1px solid var(--line);border-radius:12px;padding:10px;margin-top:10px">
    <b class="sm">Datos del ticket (para la certificación)</b>
    <div class="grid2" style="gap:8px 10px">
      <div><label>Nro. de ticket</label><input id="cf-tk" inputmode="numeric" maxlength="60" value="${esc(ticket || '')}" placeholder="Ej. 191720"></div>
      <div><label>Categoría</label><select id="cf-cat"><option value="">—</option>${opt(STX_CATS, c.category)}</select></div>
      <div style="grid-column:1/-1"><label>Problema</label><input id="cf-pr" maxlength="200" value="${esc(c.problem || '')}" placeholder="Ej. Corte de energía comercial"></div>
      <div><label>Tipo de ticket</label><select id="cf-tt">${opt(STX_TTYPES, c.ttype || 'Incidente')}</select></div>
      <div><label>Tipo de nodo</label><select id="cf-nt"><option value="">—</option>${opt(['3', '4'], c.node_type)}</select></div>
      <div><label>Afectación del servicio</label><select id="cf-af"><option value="">—</option>${opt(STX_AFECT, c.afect)}</select></div>
      <div><label>TTR máximo (horas)</label><input id="cf-ttr" type="number" min="0" max="2000" step="1" value="${esc(c.ttr_h ?? '')}"></div>
      <div><label>Apertura del ticket</label><input id="cf-op" type="datetime-local" value="${esc(stxLocalDT(c.open_at))}"></div>
      <div><label>Cierre del ticket</label><input id="cf-cl" type="datetime-local" value="${esc(stxLocalDT(c.close_at))}"></div>
      <div><label>SMT afectado</label><select id="cf-smt"><option value="">—</option>${opt(STX_SMT, c.smt)}</select></div>
      <div><label>Tramo: hasta el nodo <span class="muted sm">(si afecta a dos)</span></label><input id="cf-s2" list="cf-s2l" maxlength="200" value="${esc(site2 || '')}" autocomplete="off"><datalist id="cf-s2l">${sites.map(s => `<option value="${esc(s.name)}">`).join('')}</datalist></div>
    </div></div>`;
}
function stxCorrRead(sites = []){
  const v = id => ($('#' + id)?.value || '').trim();
  const dt = id => { const x = v(id); if (!x) return null; const d = new Date(x); return isNaN(d) ? null : d.toISOString(); };
  const corr = { category: v('cf-cat') || null, problem: v('cf-pr') || null, ttype: v('cf-tt') || null, node_type: v('cf-nt') || null, afect: v('cf-af') || null,
    ttr_h: v('cf-ttr') ? Number(v('cf-ttr')) : null, smt: v('cf-smt') || null, open_at: dt('cf-op'), close_at: dt('cf-cl') };
  Object.keys(corr).forEach(k => corr[k] == null && delete corr[k]);
  const s2 = v('cf-s2'), s2s = s2 ? sites.find(s => s.name.toLowerCase() === s2.toLowerCase()) : null;
  return { ticket: v('cf-tk').replace(/[^\w\-\/ ]/g, '').slice(0, 60) || null, corr: Object.keys(corr).length ? corr : null, site2_id: s2s?.id || null, site2_name: s2s ? s2s.name : (s2 || null) };
}
/* editar los datos del ticket de una inspección ya empezada */
async function stxCorrModal(ins, onSave){
  let sites = []; try { sites = await cached('sites-min2', () => pageAll(() => sb.from('sites').select('id,name,kind,traza,address,grupo').eq('active', true).order('name').order('id'))); } catch {}
  const m = modal(`<h2>🎫 Datos del ticket</h2>${stxCorrFields(ins.corr || {}, ins.ticket, sites, ins.site2_name)}
    <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn sec" id="cf-x">Cancelar</button><button class="btn" id="cf-ok">Guardar</button></div>`, { wide: true });
  $('#cf-x').onclick = m.close;
  $('#cf-ok').onclick = async () => { Object.assign(ins, stxCorrRead(sites)); m.close(); onSave && await onSave(); };
}

/* =====================================================================
   CONTROL DE PRESENCIA: distancia entre donde se cargó y el sitio
   ===================================================================== */
function stxDist(a, b){ const R = 6371000, r = x => x * Math.PI / 180; const dLa = r(b[0] - a[0]), dLo = r(b[1] - a[1]);
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); }
const stxDistTxt = m => m == null ? '' : m < 1000 ? Math.round(m) + ' m' : (m / 1000).toLocaleString('es-AR', { maximumFractionDigits: 1 }) + ' km';
async function stxSiteCoord(siteId){
  if (!siteId) return null;
  try { if (!SITE_COORDS.size) rememberCoords(await loadSitesMap()); } catch {}
  return SITE_COORDS.get(siteId) || null;
}
/* devuelve true para seguir; si está lejos pregunta */
async function stxPresenceCheck(siteId, pos){
  const lim = (STX.cfg || await stxLoadCfg()).presence_m || 1000;
  const c = await stxSiteCoord(siteId); if (!c) return true;
  if (!pos) return confirm('No se pudo tomar la ubicación del teléfono. Quedará registrado que no se pudo controlar la presencia en el sitio.\n\n¿Seguir igual?');
  const d = stxDist([pos.lat, pos.lng], c);
  if (d <= lim + (pos.acc || 0)) return true;
  return confirm(`📍 Estás a ${stxDistTxt(d)} del sitio (el límite es ${stxDistTxt(lim)}).\n\nSi seguís, la inspección queda marcada como "cargada lejos del sitio" para coordinación.\n\n¿Seguir igual?`);
}
const stxFarPill = r => (r?.dist_m != null && r.dist_m > ((STX.cfg?.presence_m) || 1000)) ? ` <span class="pill p-bad" title="Cargada a ${esc(stxDistTxt(r.dist_m))} del sitio">📍 lejos (${esc(stxDistTxt(r.dist_m))})</span>` : '';
