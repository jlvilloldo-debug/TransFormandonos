/* =====================================================================
   InspectApp · 🔧 INSTRUMENTAL
   Calibraciones con vencimiento automático, préstamos (entregar / devolver), certificados en PDF,
   avisos por mail (los manda la casilla de la app) y por WhatsApp, y mediciones OTDR hechas con cada uno.
   Cada instrumento es un activo de Stock: lo que pasa acá se ve también en Stock → Activos.
   ===================================================================== */
const IN = { list: [], cfg: null, filter: '', q: '', who: '', showOut: false };
const IN_COLS = 'id,org_id,project_id,code,type,name,model,vendor,status,cal_na,cal_freq_m,cal_last,cal_cert,cal_lab,service_due,holder_name,obra,out_at,notes,docs,archived';
const IN_CLS = {
  venc:   ['Vencidos', '#DC2626', '#FEE2E2'],
  pronto: ['Vencen en 30 días', '#EA580C', '#FFEDD5'],
  prox:   ['En 31 a 90 días', '#CA8A04', '#FEF9C3'],
  ok:     ['Al día', '#16A34A', '#DCFCE7'],
  nd:     ['Sin dato de calibración', '#64748B', '#F1F5F9'],
  na:     ['No requiere calibración', '#475569', '#E2E8F0'],
  out:    ['Baja / perdidos', '#334155', '#E5E7EB']
};
const IN_ST = ['Apto', 'No apto', 'En calibración', 'En reparación', 'Roto', 'Perdido', 'Baja'];
const IN_TYPES = ['OTDR', 'Certificador', 'Power meter', 'Fusionadora', 'Cleaver', 'Anemómetro', 'Telurímetro', 'Multímetro', 'Estación total', 'Tester de cables', 'Instrumento'];
const IN_FREQ = [['', 'Sin frecuencia (vencimiento a mano)'], ['na', 'No aplica (no requiere calibración)'], ['6', 'Cada 6 meses'], ['12', 'Anual (12 meses)'], ['24', 'Cada 2 años'], ['36', 'Cada 3 años']];
const inDays = a => a.service_due ? Math.round((new Date(a.service_due + 'T12:00:00') - new Date(todayStr() + 'T12:00:00')) / 86400000) : null;
function inCls(a){
  if (['Baja', 'Perdido'].includes(a.status)) return 'out';
  if (a.cal_na) return 'na';
  const d = inDays(a); if (d === null) return 'nd';
  return d < 0 ? 'venc' : d <= 30 ? 'pronto' : d <= 90 ? 'prox' : 'ok';
}
const inName = a => a.name || a.type || a.code;
const inDue = a => a.cal_na ? 'No requiere calibración' : a.service_due ? fmtDate(a.service_due + 'T12:00:00') : 'Sin vencimiento cargado';
function inBig(a){
  const c = inCls(a), d = inDays(a);
  if (c === 'out') return esc(a.status);
  if (c === 'na') return 'No requiere';
  if (c === 'nd') return 'Sin dato';
  if (d < 0) return `Vencido hace ${-d} día${d === -1 ? '' : 's'}`;
  if (d === 0) return 'Vence HOY';
  return `${d} día${d === 1 ? '' : 's'}`;
}
function inFrac(a){   // parte del período de calibración que ya pasó (0 a 1)
  if (!a.service_due || a.cal_na) return null;
  const start = a.cal_last ? new Date(a.cal_last + 'T12:00:00') : new Date(new Date(a.service_due + 'T12:00:00').getTime() - 365 * 86400000);
  const end = new Date(a.service_due + 'T12:00:00'), now = new Date(todayStr() + 'T12:00:00');
  return Math.max(0, Math.min(1, (now - start) / Math.max(1, end - start)));
}
const inCanW = () => canWrite() && online() && (typeof can !== 'function' || can('stock', 2));
const inCanCfg = () => canWrite() && online() && (isManager() || (typeof can === 'function' && can('stock', 3)));
async function inLoad(){
  const [{ data, error }, cfg] = await Promise.all([sb.from('assets').select(IN_COLS).eq('is_instr', true).order('service_due', { ascending: true, nullsFirst: false }).limit(500),
    sb.from('instr_cfg').select('*').maybeSingle().then(r => r.data).catch(() => null)]);
  if (error){ if (/is_instr|column/i.test(error.message || '')) throw new Error('Falta correr 43_instrumental.sql en Supabase.'); throw error; }
  IN.list = (data || []).filter(a => !a.archived); IN.cfg = cfg || { resp: [], days: [60, 30, 15, 7, 0], mail: true, push: true };
}

/* ---------------- tablero ---------------- */
async function viewInstr(v, id){
  v.innerHTML = '<div class="card muted">Cargando instrumental…</div>';
  await inLoad();
  const w = inCanW();
  v.innerHTML = `<style>
    .in-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:14px}
    .in-kpi{border:0;border-radius:14px;padding:12px 14px;text-align:left;cursor:pointer;font:inherit;transition:transform .12s}
    .in-kpi:hover{transform:translateY(-2px)} .in-kpi b{display:block;font-size:30px;line-height:1.1} .in-kpi.on{outline:3px solid var(--text);outline-offset:2px}
    .in-tl{display:flex;gap:8px;overflow-x:auto;padding-bottom:6px} .in-col{min-width:118px;flex:1 0 118px;background:var(--bg);border-radius:12px;padding:8px}
    .in-col h4{margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);display:flex;justify-content:space-between}
    .in-chip{display:block;font-size:12px;border-radius:8px;padding:4px 7px;margin-bottom:4px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border:0;width:100%;text-align:left;font-family:inherit}
    .in-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}
    .in-card{background:var(--card);border:1px solid var(--line);border-top:5px solid;border-radius:14px;padding:12px 14px;cursor:pointer;transition:box-shadow .12s}
    .in-card:hover{box-shadow:0 6px 18px rgba(15,42,74,.12)} .in-big{font-size:22px;font-weight:800;margin:6px 0 2px}
    .in-bar{height:8px;background:var(--line);border-radius:6px;overflow:hidden;margin:8px 0 6px} .in-bar i{display:block;height:100%;border-radius:6px}
    .in-ring{flex:0 0 auto} .in-sec{margin-top:14px} .in-sec h3{margin:0 0 6px}
    .in-tlrow{display:flex;gap:10px;padding:7px 0;border-bottom:1px solid var(--line)} .in-tlrow:last-child{border:0}
  </style>
  <div class="card"><div class="row between"><div><h2 style="margin:0">🔧 Instrumental</h2><p class="muted sm" style="margin:4px 0 0">Calibraciones, certificados, quién tiene cada instrumento y avisos antes de que venzan.</p></div>
    <div class="row" style="gap:6px;flex-wrap:wrap">${w ? '<button class="btn small" id="in-new">+ Instrumento</button><label class="btn sec small" style="margin:0">Importar Excel<input type="file" accept=".xlsx,.xls" id="in-xl" class="hidden"></label>' : ''}
      <button class="btn sec small" id="in-exp">Exportar DO-05-02</button><button class="btn sec small" id="in-wa">📣 Avisar</button>${inCanCfg() ? '<button class="btn sec small" id="in-cfg">⚙ Responsables y avisos</button><button class="btn sec small" id="in-delh">🗑 Eliminados</button>' : ''}</div></div>
    <div id="in-resp" class="sm muted" style="margin-top:8px"></div></div>
  <div class="in-kpis" id="in-kpis"></div>
  <div class="card"><div class="row between"><h2 style="margin:0">📅 Calendario de vencimientos</h2><span class="muted sm">próximos 12 meses · tocá un instrumento</span></div><div class="in-tl" id="in-tl" style="margin-top:10px"></div></div>
  <div class="card"><div class="row" style="gap:8px;flex-wrap:wrap"><input id="in-q" placeholder="Buscar equipo, identificación, certificado o quién lo tiene" style="max-width:340px">
    <select id="in-who" style="width:auto"><option value="">Todos (en obra y en depósito)</option><option value="__dep">🏢 En depósito / oficina</option><option value="__obra">👷 Entregados</option></select>
    <label class="sm" style="display:flex;gap:6px;align-items:center;font-weight:400"><input type="checkbox" id="in-out" style="width:auto"> Ver bajas y perdidos</label></div></div>
  <div class="in-grid" id="in-grid"></div>`;
  const resp = IN.cfg.resp || [];
  $('#in-resp').innerHTML = resp.length ? `Responsables: ${resp.map(r => `<b>${esc(r.name)}</b>`).join(', ')} · avisos ${(IN.cfg.days || []).map(d => d ? d + ' d' : 'el día').join(', ')} antes${IN.cfg.mail ? ' por mail' : ''}${IN.cfg.push ? ' y al teléfono' : ''}`
    : `<span style="color:var(--amber)">⚠ Todavía no hay responsables para los avisos.${inCanCfg() ? ' Cargalos en <b>⚙ Responsables y avisos</b>.' : ''}</span>`;
  const draw = () => {
    const cnt = {}; IN.list.forEach(a => { const c = inCls(a); cnt[c] = (cnt[c] || 0) + 1; });
    $('#in-kpis').innerHTML = Object.entries(IN_CLS).filter(([k]) => k !== 'out' || cnt.out).map(([k, [t, fg, bg]]) => `<button type="button" class="in-kpi ${IN.filter === k ? 'on' : ''}" data-k="${k}" style="background:${bg};color:${fg}"><b>${cnt[k] || 0}</b><span class="sm" style="font-weight:600">${t}</span></button>`).join('');
    $('#in-kpis').querySelectorAll('[data-k]').forEach(b => b.onclick = () => { IN.filter = IN.filter === b.dataset.k ? '' : b.dataset.k; if (IN.filter === 'out') { IN.showOut = true; $('#in-out').checked = true; } draw(); });
    // calendario
    const now = new Date(); const months = []; for (let i = 0; i < 12; i++){ const d = new Date(now.getFullYear(), now.getMonth() + i, 1); months.push([d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'), d.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' })]); }
    const act = IN.list.filter(a => inCls(a) !== 'out' && !a.cal_na && a.service_due);
    const chip = a => { const [, fg, bg] = IN_CLS[inCls(a)]; return `<button type="button" class="in-chip" data-a="${a.id}" style="background:${bg};color:${fg}" title="${esc(inName(a))} · ${esc(inDue(a))}">${esc(inName(a))}</button>`; };
    const venc = act.filter(a => inDays(a) < 0);
    $('#in-tl').innerHTML = `<div class="in-col" style="background:#FEF2F2"><h4 style="color:#DC2626"><span>Vencidos</span><span>${venc.length}</span></h4>${venc.map(chip).join('') || '<span class="muted sm">Ninguno 👍</span>'}</div>`
      + months.map(([k, t]) => { const l = act.filter(a => inDays(a) >= 0 && a.service_due.slice(0, 7) === k); return `<div class="in-col"><h4><span>${esc(t)}</span><span>${l.length || ''}</span></h4>${l.map(chip).join('')}</div>`; }).join('');
    // tarjetas
    const q = norm($('#in-q').value), who = $('#in-who').value, showOut = $('#in-out').checked;
    const rows = IN.list.filter(a => (showOut || inCls(a) !== 'out') && (!IN.filter || inCls(a) === IN.filter) && (!who || (who === '__dep' ? !a.holder_name : who === '__obra' ? !!a.holder_name : a.holder_name === who))
      && (!q || norm([a.name, a.type, a.code, a.model, a.cal_cert, a.holder_name, a.obra].join(' ')).includes(q)))
      .sort((x, y) => (inDays(x) ?? 99999) - (inDays(y) ?? 99999));
    $('#in-grid').innerHTML = rows.map(a => { const c = inCls(a), [, fg] = IN_CLS[c], f = inFrac(a);
      return `<div class="in-card" data-a="${a.id}" style="border-top-color:${fg}"><div class="row between" style="flex-wrap:nowrap;gap:8px"><div style="min-width:0"><b>${esc(inName(a))}</b><div class="muted sm" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${[a.code !== a.name ? a.code : '', a.model && a.model !== a.name ? a.model : ''].filter(Boolean).map(esc).join(' · ') || esc(a.type || '')}</div></div>
          <span class="pill ${a.status === 'Apto' ? 'p-ok' : ['En calibración', 'En reparación'].includes(a.status) ? 'p-info' : 'p-bad'}" style="flex:0 0 auto">${esc(a.status)}</span></div>
        <div class="in-big" style="color:${fg}">${inBig(a)}</div><div class="sm muted">${c === 'venc' || c === 'pronto' || c === 'prox' || c === 'ok' ? 'Vence ' + inDue(a) : esc(inDue(a))}${a.cal_cert ? ' · cert. ' + esc(a.cal_cert) : ''}</div>
        ${f !== null ? `<div class="in-bar" title="Período de calibración usado: ${Math.round(f * 100)}%"><i style="width:${Math.round(f * 100)}%;background:${fg}"></i></div>` : '<div style="height:8px;margin:8px 0 6px"></div>'}
        <div class="sm">${a.holder_name ? `👤 <b>${esc(a.holder_name)}</b>${a.obra ? ' · ' + esc(a.obra) : ''}${a.out_at ? ` <span class="muted">· hace ${Math.max(0, -inDays({ service_due: a.out_at }))} días</span>` : ''}` : '🏢 En depósito / oficina'}</div></div>`; }).join('')
      || `<div class="card muted">${IN.list.length ? 'Ningún instrumento con ese filtro.' : 'Todavía no hay instrumentos. ' + (w ? 'Cargá uno con <b>+ Instrumento</b> o importá tu Excel DO-05-02.' : '')}</div>`;
    v.querySelectorAll('[data-a]').forEach(el => el.onclick = () => inDetail(el.dataset.a));
  };
  const holders = [...new Set(IN.list.map(a => a.holder_name).filter(Boolean))].sort();
  $('#in-who').insertAdjacentHTML('beforeend', holders.map(h => `<option value="${esc(h)}">👤 ${esc(h)}</option>`).join(''));
  $('#in-q').oninput = draw; $('#in-who').onchange = draw; $('#in-out').onchange = draw;
  $('#in-new')?.addEventListener('click', () => inEdit(null));
  $('#in-xl')?.addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; inImport(f); });
  $('#in-exp').onclick = inExport;
  $('#in-wa').onclick = () => inAvisar(null);
  $('#in-cfg')?.addEventListener('click', inCfg);
  $('#in-delh')?.addEventListener('click', inDeletedList);
  draw();
  if (id && IN.list.some(a => a.id === id)) inDetail(id);
}
const inReload = () => { if (location.hash.startsWith('#/instr')) route(); };

/* ---------------- ficha ---------------- */
function inRing(a){
  const c = inCls(a), [, fg] = IN_CLS[c], f = inFrac(a), r = 42, L = 2 * Math.PI * r, left = f === null ? (c === 'na' ? 1 : 0) : 1 - f;
  const d = inDays(a), txt = c === 'na' ? 'N/A' : c === 'nd' || c === 'out' ? '—' : d < 0 ? 'Vencido' : String(d), sub = c === 'na' ? 'no requiere' : c === 'nd' ? 'sin dato' : c === 'out' ? esc(a.status) : d < 0 ? `hace ${-d} d` : 'días';
  return `<svg class="in-ring" width="112" height="112" viewBox="0 0 112 112" role="img" aria-label="${esc(inBig(a))}"><circle cx="56" cy="56" r="${r}" fill="none" stroke="var(--line)" stroke-width="10"/>
    <circle cx="56" cy="56" r="${r}" fill="none" stroke="${fg}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${(L * left).toFixed(1)} ${L.toFixed(1)}" transform="rotate(-90 56 56)"/>
    <text x="56" y="56" text-anchor="middle" font-size="${txt.length > 4 ? 16 : 26}" font-weight="800" fill="${fg}">${txt}</text><text x="56" y="74" text-anchor="middle" font-size="11" fill="var(--muted)">${sub}</text></svg>`;
}
async function inDetail(id){
  const a = IN.list.find(x => x.id === id); if (!a) return;
  const w = inCanW(), c = inCls(a), d = inDays(a);
  const row = (k, v) => v ? `<div><span class="muted">${k}:</span> ${v}</div>` : '';
  const m = modal(`<div class="row" style="gap:14px;flex-wrap:nowrap;align-items:center">${inRing(a)}<div style="min-width:0"><h2 style="margin:0">${esc(inName(a))}</h2>
      <div class="muted sm">${esc(a.type || '')} · ${esc(a.code)}${a.model ? ' · ' + esc(a.model) : ''}</div><div style="margin-top:6px">${esc(a.status)} · ${a.holder_name ? `👤 <b>${esc(a.holder_name)}</b>${a.obra ? ' en ' + esc(a.obra) : ''}${a.out_at ? ' desde el ' + fmtDate(a.out_at + 'T12:00:00') : ''}` : '🏢 En depósito / oficina'}</div></div></div>
    ${c === 'venc' ? `<div class="banner" style="background:#FEE2E2;color:#991B1B;margin-top:10px;padding:10px;border-radius:10px">⚠ <b>Calibración vencida hace ${-d} días.</b> Las mediciones con este instrumento pueden objetarse: enviarlo a calibrar.</div>`
      : c === 'pronto' ? `<div class="banner" style="background:#FFEDD5;color:#9A3412;margin-top:10px;padding:10px;border-radius:10px">⏰ Vence en ${d} días: coordiná la calibración.</div>` : ''}
    <div class="sm" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:4px 16px;margin-top:10px">
      ${row('Frecuencia', a.cal_na ? 'No aplica' : a.cal_freq_m ? (a.cal_freq_m === 12 ? 'Anual' : `Cada ${a.cal_freq_m} meses`) : 'Sin frecuencia')}${row('Última calibración', a.cal_last ? fmtDate(a.cal_last + 'T12:00:00') : '')}
      ${row('Vencimiento', esc(inDue(a)))}${row('Nº certificado', esc(a.cal_cert || ''))}${row('Laboratorio', esc(a.cal_lab || ''))}${row('Marca', esc(a.vendor || ''))}${row('Notas', esc(a.notes || ''))}</div>
    <div class="row" style="gap:6px;flex-wrap:wrap;margin-top:12px">
      ${w ? (a.holder_name ? '<button class="btn small" data-x="back">📥 Devolver</button>' : `<button class="btn small" data-x="out" ${['Baja', 'Perdido'].includes(a.status) ? 'disabled' : ''}>📤 Entregar</button>`) : ''}
      ${w && a.status !== 'En calibración' && !a.cal_na ? '<button class="btn sec small" data-x="send">🧪 Enviar a calibrar</button>' : ''}
      ${w ? '<button class="btn sec small" data-x="cal">✅ Registrar calibración</button><button class="btn sec small" data-x="edit">✏️ Editar</button>' : ''}
      <button class="btn sec small" data-x="avisar">📣 Avisar</button><a class="btn sec small" href="#/stock/a/${a.id}">📦 Ver en Stock</a>${inCanCfg() ? '<button class="btn sec small" data-x="del" style="color:var(--red)">🗑 Eliminar</button>' : ''}</div>
    <div class="in-sec"><h3>📄 Certificados</h3><div id="in-cals" class="sm muted">Cargando…</div></div>
    <div class="in-sec"><h3>👷 Préstamos</h3><div id="in-loans" class="sm muted">Cargando…</div></div>
    <div class="in-sec"><h3>📏 Mediciones OTDR con este instrumento</h3><div id="in-meas" class="sm muted">Cargando…</div></div>
    <details class="in-sec"><summary class="sm" style="cursor:pointer"><b>Historial completo</b></summary><div id="in-hist" class="sm muted">Cargando…</div></details>
    <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn sec" id="in-x">Cerrar</button></div>`, { wide: true });
  $('#in-x').onclick = () => { m.close(); if (location.hash !== '#/instr') history.replaceState(null, '', '#/instr'); };
  m.el.querySelectorAll('[data-x]').forEach(b => b.onclick = () => ({ out: inOut, back: inBack, send: inSend, cal: inCal, edit: inEdit, avisar: inAvisar, del: inDel })[b.dataset.x](a));
  const [cals, loans, meas, hist] = await Promise.all([
    sb.from('instr_cals').select('*').eq('asset_id', a.id).order('cal_date', { ascending: false }).limit(50).then(r => r.data || []).catch(() => []),
    sb.from('instr_loans').select('*').eq('asset_id', a.id).order('out_date', { ascending: false }).order('id', { ascending: false }).limit(200).then(r => r.data || []).catch(() => []),
    sb.from('fiber_events').select('id,created_at,otdr_m,loss_db,created_by_name,instr_info,route_id,fiber_routes(name)').eq('instr_id', a.id).order('created_at', { ascending: false }).limit(30).then(r => r.data || []).catch(() => []),
    sb.from('asset_events').select('at,by_name,kind,field,old_v,new_v').eq('asset_id', a.id).order('at', { ascending: false }).limit(200).then(r => r.data || []).catch(() => [])]);
  const box = id => document.getElementById(id); if (!box('in-cals')) return;
  const docs = (a.docs || []).filter(x => /\.pdf$/i.test(x.path));
  box('in-cals').classList.remove('muted');
  box('in-cals').innerHTML = (cals.length || docs.length) ? cals.map(k => `<div class="in-tlrow"><span>${k.result === 'Apto' ? '✅' : '❌'}</span><div class="grow"><b>${fmtDate(k.cal_date + 'T12:00:00')}</b>${k.cert_no ? ' · cert. ' + esc(k.cert_no) : ''}${k.lab ? ' · ' + esc(k.lab) : ''}
      <div class="muted">${k.due ? 'Vencimiento ' + fmtDate(k.due + 'T12:00:00') : 'Sin vencimiento'} · ${esc(k.result)} · cargó ${esc(k.by_name || '')}${k.note ? ' · ' + esc(k.note) : ''}</div></div>${k.doc ? `<button class="btn sec small" data-doc="${esc(k.doc)}">📄 PDF</button>` : ''}</div>`).join('')
    + docs.filter(x => !cals.some(k => k.doc === x.path)).map(x => `<div class="in-tlrow"><span>📄</span><div class="grow">${esc(x.name)}<div class="muted">${esc(fmtDT(x.at))}</div></div><button class="btn sec small" data-doc="${esc(x.path)}">Abrir</button></div>`).join('')
    : '<span class="muted">Sin certificados cargados. Usá <b>✅ Registrar calibración</b> para cargar el PDF.</span>';
  box('in-cals').querySelectorAll('[data-doc]').forEach(b => b.onclick = async () => { if (!needOnline()) return; const { data } = await sb.storage.from('fotos').createSignedUrl(b.dataset.doc, 600); if (!data?.signedUrl) return toast('No se pudo abrir'); window.open(data.signedUrl, '_blank', 'noopener'); });
  box('in-loans').classList.remove('muted');
  box('in-loans').innerHTML = loans.length ? loans.slice(0, 60).map(l => { const days = Math.round(((l.back_date ? new Date(l.back_date) : new Date(todayStr())) - new Date(l.out_date)) / 86400000);
    return `<div class="in-tlrow"><span>${l.back_date ? '↩️' : '👷'}</span><div class="grow"><b>${esc(l.to_name)}</b>${l.obra ? ' · ' + esc(l.obra) : ''}<div class="muted">${fmtDate(l.out_date + 'T12:00:00')} → ${l.back_date ? fmtDate(l.back_date + 'T12:00:00') : '<b style="color:var(--text)">lo tiene ahora</b>'} · ${days} día${days === 1 ? '' : 's'}${l.out_by ? ' · entregó ' + esc(l.out_by) : ''}${l.back_by ? ' · recibió ' + esc(l.back_by) : ''}${l.note ? ' · ' + esc(l.note) : ''}</div></div></div>`; }).join('')
    : '<span class="muted">Sin préstamos registrados.</span>';
  box('in-meas').classList.remove('muted');
  box('in-meas').innerHTML = meas.length ? meas.map(e => `<div class="in-tlrow"><span>${e.instr_info?.ok ? '✅' : '⚠️'}</span><div class="grow"><a href="#/tools/${e.route_id}">${esc(e.fiber_routes?.name || 'Tramo')}</a> · ${Math.round(e.otdr_m)} m${e.loss_db != null ? ' · ' + e.loss_db + ' dB' : ''}
      <div class="muted">${fmtDT(e.created_at)} · ${esc(e.created_by_name || '')} · ${e.instr_info?.ok ? 'calibración vigente' : 'calibración VENCIDA al medir'}${e.instr_info?.cert ? ' · cert. ' + esc(e.instr_info.cert) : ''}</div></div></div>`).join('')
    : '<span class="muted">Ninguna todavía. Al ubicar un evento con un .sor, la app reconoce el OTDR por su número de serie y lo registra acá.</span>';
  const evTxt = h => h.kind === 'responsable' ? `${esc(h.field || '')}: ${esc(h.new_v || '')}` : h.field ? `${esc(h.field)}: ${esc(h.old_v || '—')} → ${esc(h.new_v || '—')}` : esc(h.new_v || h.kind);
  box('in-hist').classList.remove('muted');
  box('in-hist').innerHTML = hist.map(h => `<div class="in-tlrow"><div class="grow">${evTxt(h)}<div class="muted">${fmtDT(h.at)} · ${esc(h.by_name || '')}</div></div></div>`).join('') || '<span class="muted">Sin movimientos.</span>';
}

/* ---------------- acciones ---------------- */
async function inNames(){
  let staff = [];
  try { staff = (await cached('bs-staff', () => sb.from('hh_staff').select('id,name').order('name'))).map(x => x.name).filter(Boolean); } catch {}
  const prev = IN.list.map(a => a.holder_name).filter(Boolean);
  let obras = []; try { obras = (await loadProjects()).filter(p => p.active !== false).map(p => p.name); } catch {}
  return { people: [...new Set([...staff, ...prev])].sort(), obras: [...new Set([...obras, ...IN.list.map(a => a.obra).filter(Boolean)])].sort() };
}
async function inRpc(fn, args, okMsg, m){
  const b = m.el.querySelector('#ia-ok'); if (b) b.disabled = true;
  const { error } = await sb.rpc(fn, args);
  if (error){ if (b) b.disabled = false; const e = m.el.querySelector('#ia-err'); if (e) e.textContent = errText(error); return false; }
  m.close(); toast(okMsg); IDB.del('kv', CUR_UID + ':stk-base').catch(() => {});
  if (args.p_asset) history.replaceState(null, '', '#/instr/' + args.p_asset);
  inReload(); return true;
}
const inFoot = (lbl = 'Guardar') => `<div class="err" id="ia-err"></div><div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn sec" id="ia-x">Volver</button><button class="btn" id="ia-ok">${lbl}</button></div>`;
const inVal = id => (document.getElementById(id)?.value || '').trim();
async function inOut(a){
  if (!needOnline()) return;
  const { people, obras } = await inNames(), c = inCls(a), d = inDays(a);
  const warn = c === 'venc' ? `⚠ La calibración está <b>vencida hace ${-d} días</b>. Podés entregarlo igual, pero las mediciones pueden objetarse.`
    : a.status !== 'Apto' ? `⚠ El instrumento figura como <b>${esc(a.status)}</b>.` : c === 'pronto' ? `⏰ La calibración vence en ${d} días (${inDue(a)}).` : '';
  const m = modal(`<h2>📤 Entregar ${esc(inName(a))}</h2>
    ${warn ? `<div style="background:#FEF3C7;color:#92400E;padding:10px;border-radius:10px;margin-bottom:6px" class="sm">${warn}</div>` : ''}
    <label>¿A quién? *</label><input id="ia-to" maxlength="120" list="ia-pl" autocomplete="off"><datalist id="ia-pl">${people.map(n => `<option value="${esc(n)}">`).join('')}</datalist>
    <label>Obra / proyecto</label><input id="ia-ob" maxlength="120" list="ia-ol"><datalist id="ia-ol">${obras.map(n => `<option value="${esc(n)}">`).join('')}</datalist>
    <label>Fecha</label><input id="ia-dt" type="date" value="${todayStr()}"><label>Nota</label><input id="ia-n" maxlength="500" placeholder="Accesorios: bobina de lanzamiento, lápiz óptico…">${inFoot('Entregar')}`);
  $('#ia-x').onclick = () => inDetail(a.id);
  $('#ia-ok').onclick = () => { if (!inVal('ia-to')) return ($('#ia-err').textContent = 'Indicá a quién se entrega.');
    inRpc('instr_out', { p_asset: a.id, p_to: inVal('ia-to'), p_obra: inVal('ia-ob') || null, p_date: inVal('ia-dt') || null, p_note: inVal('ia-n') || null }, 'Entregado', m); };
}
function inBack(a){
  if (!needOnline()) return;
  const m = modal(`<h2>📥 Devolución de ${esc(inName(a))}</h2><p class="muted sm" style="margin-top:-6px">Lo tenía ${esc(a.holder_name || '')}${a.obra ? ' en ' + esc(a.obra) : ''}.</p>
    <label>Fecha</label><input id="ia-dt" type="date" value="${todayStr()}">
    <label>¿Cómo vuelve?</label><select id="ia-st"><option value="Apto">Apto</option><option value="No apto">No apto (falla)</option><option value="Roto">Roto</option><option value="Perdido">No volvió: perdido</option></select>
    <label>Nota</label><input id="ia-n" maxlength="500">${inFoot('Registrar devolución')}`);
  $('#ia-x').onclick = () => inDetail(a.id);
  $('#ia-ok').onclick = () => inRpc('instr_back', { p_asset: a.id, p_date: inVal('ia-dt') || null, p_status: inVal('ia-st'), p_note: inVal('ia-n') || null }, 'Devolución registrada', m);
}
function inSend(a){
  if (!needOnline()) return;
  const m = modal(`<h2>🧪 Enviar a calibrar</h2><p class="muted sm" style="margin-top:-6px">${esc(inName(a))} · ${esc(a.code)}${a.holder_name ? ` · se registra la devolución de ${esc(a.holder_name)}` : ''}</p>
    <label>Laboratorio</label><input id="ia-lab" maxlength="120" value="${esc(a.cal_lab || '')}"><label>Nota</label><input id="ia-n" maxlength="500">${inFoot('Enviar')}`);
  $('#ia-x').onclick = () => inDetail(a.id);
  $('#ia-ok').onclick = () => inRpc('instr_cal_send', { p_asset: a.id, p_lab: inVal('ia-lab') || null, p_note: inVal('ia-n') || null }, 'Queda En calibración', m);
}
const inAddMonths = (d, n) => { const x = new Date(d + 'T12:00:00'); const day = x.getDate(); x.setMonth(x.getMonth() + n); if (x.getDate() < day) x.setDate(0); return x.toISOString().slice(0, 10); };
function inFreqSel(a){
  const cur = a?.cal_na ? 'na' : a?.cal_freq_m ? String(a.cal_freq_m) : '';
  const opts = IN_FREQ.some(([k]) => k === cur) ? IN_FREQ : [...IN_FREQ, [cur, `Cada ${cur} meses`]];
  return `<select id="ia-fq">${opts.map(([k, t]) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
}
function inCal(a){
  if (!needOnline()) return;
  const m = modal(`<h2>✅ Registrar calibración</h2><p class="muted sm" style="margin-top:-6px">${esc(inName(a))} · ${esc(a.code)}</p>
    <div class="row"><div class="grow"><label>Fecha de calibración *</label><input id="ia-dt" type="date" value="${todayStr()}"></div><div class="grow"><label>Resultado</label><select id="ia-rs"><option>Apto</option><option>No apto</option></select></div></div>
    <div class="row"><div class="grow"><label>Nº de certificado</label><input id="ia-ce" maxlength="80"></div><div class="grow"><label>Laboratorio</label><input id="ia-lab" maxlength="120" value="${esc(a.cal_lab || '')}"></div></div>
    <label>Frecuencia de calibración</label>${inFreqSel(a)}
    <div id="ia-duew"><label>Vencimiento</label><input id="ia-due" type="date"></div><p class="sm" id="ia-dueh" style="margin:4px 0 0"></p>
    <label>Certificado (PDF, hasta 10 MB)</label><input id="ia-pdf" type="file" accept="application/pdf">
    <label>Nota</label><input id="ia-n" maxlength="500">${inFoot('Guardar calibración')}`);
  const upd = () => { const fq = inVal('ia-fq'), dt = inVal('ia-dt'), auto = fq && fq !== 'na';
    $('#ia-duew').classList.toggle('hidden', fq === 'na' || auto);
    $('#ia-dueh').innerHTML = fq === 'na' ? 'No requiere calibración: no tendrá vencimiento.' : auto && dt ? `Vence el <b>${fmtDate(inAddMonths(dt, Number(fq)) + 'T12:00:00')}</b> (se calcula solo).` : 'Cargá el vencimiento que figura en el certificado.'; };
  $('#ia-fq').onchange = upd; $('#ia-dt').onchange = upd; upd();
  $('#ia-x').onclick = () => inDetail(a.id);
  $('#ia-ok').onclick = async () => {
    const fq = inVal('ia-fq'), f = $('#ia-pdf').files[0];
    if (!inVal('ia-dt')) return ($('#ia-err').textContent = 'Indicá la fecha.');
    if (!fq && !inVal('ia-due')) return ($('#ia-err').textContent = 'Cargá el vencimiento o elegí una frecuencia.');
    let path = null;
    if (f){
      try {
        if (f.size > 10 * 1024 * 1024) throw new Error('El PDF supera 10 MB.');
        const head = new Uint8Array(await f.slice(0, 5).arrayBuffer()); if (String.fromCharCode(...head) !== '%PDF-') throw new Error('El archivo no es un PDF válido.');
        $('#ia-ok').disabled = true; $('#ia-ok').textContent = 'Subiendo PDF…';
        path = `${a.org_id}/stock/${a.id}/${uid()}.pdf`;
        const { error } = await sb.storage.from('fotos').upload(path, f, { contentType: 'application/pdf', upsert: false }); if (error) throw error;
      } catch (e){ $('#ia-ok').disabled = false; $('#ia-ok').textContent = 'Guardar calibración'; return ($('#ia-err').textContent = errText(e)); }
    }
    inRpc('instr_cal_done', { p_asset: a.id, p_date: inVal('ia-dt'), p_cert: inVal('ia-ce') || null, p_lab: inVal('ia-lab') || null, p_result: inVal('ia-rs'),
      p_freq: fq && fq !== 'na' ? Number(fq) : null, p_na: fq === 'na', p_due: !fq ? inVal('ia-due') : null, p_doc: path, p_doc_name: f ? String(f.name).replace(/[\u0000-\u001f<>]/g, '').slice(0, 120) : null, p_note: inVal('ia-n') || null }, 'Calibración registrada', m);
  };
}
function inEdit(a){
  if (!needOnline()) return;
  const isNew = !a; a = a || { status: 'Apto', cal_freq_m: 12 };
  const m = modal(`<h2>${isNew ? '+ Instrumento' : '✏️ Editar instrumento'}</h2>
    <label>Equipo *</label><input id="ia-nm" maxlength="200" value="${esc(a.name || '')}" placeholder="Ej.: OTDR VeEX">
    <div class="row"><div class="grow"><label>Identificación interna / serie *</label><input id="ia-cd" maxlength="120" value="${esc(a.code || '')}"></div>
      <div class="grow"><label>Tipo</label><input id="ia-tp" maxlength="80" list="ia-tl" value="${esc(a.type || '')}"><datalist id="ia-tl">${IN_TYPES.map(t => `<option value="${esc(t)}">`).join('')}</datalist></div></div>
    <div class="row"><div class="grow"><label>Características / modelo</label><input id="ia-md" maxlength="80" value="${esc(a.model || '')}"></div><div class="grow"><label>Marca</label><input id="ia-vd" maxlength="80" value="${esc(a.vendor || '')}"></div></div>
    <label>Frecuencia de calibración</label>${inFreqSel(a)}
    <div class="row"><div class="grow"><label>Última calibración</label><input id="ia-ls" type="date" value="${esc(a.cal_last || '')}"></div><div class="grow" id="ia-duew"><label>Vencimiento</label><input id="ia-due" type="date" value="${esc(a.service_due || '')}"></div></div>
    <p class="sm" id="ia-dueh" style="margin:4px 0 0"></p>
    <div class="row"><div class="grow"><label>Nº de certificado</label><input id="ia-ce" maxlength="80" value="${esc(a.cal_cert || '')}"></div><div class="grow"><label>Estado</label><select id="ia-st">${IN_ST.map(s => `<option ${s === a.status ? 'selected' : ''}>${s}</option>`).join('')}</select></div></div>
    <label>Notas</label><input id="ia-no" maxlength="1000" value="${esc(a.notes || '')}">${inFoot(isNew ? 'Crear' : 'Guardar')}`);
  const upd = () => { const fq = inVal('ia-fq'), ls = inVal('ia-ls'), auto = fq && fq !== 'na';
    $('#ia-duew').classList.toggle('hidden', fq === 'na' || auto);
    $('#ia-dueh').innerHTML = fq === 'na' ? 'No requiere calibración.' : auto ? (ls ? `Vence el <b>${fmtDate(inAddMonths(ls, Number(fq)) + 'T12:00:00')}</b> (se calcula solo).` : 'Cargá la última calibración para calcular el vencimiento.') : ''; };
  $('#ia-fq').onchange = upd; $('#ia-ls').onchange = upd; upd();
  $('#ia-x').onclick = () => isNew ? m.close() : inDetail(a.id);
  $('#ia-ok').onclick = async () => {
    const fq = inVal('ia-fq');
    if (!inVal('ia-nm') || !inVal('ia-cd')) return ($('#ia-err').textContent = 'Completá el equipo y su identificación.');
    const row = { name: inVal('ia-nm'), code: inVal('ia-cd'), type: inVal('ia-tp') || 'Instrumento', model: inVal('ia-md') || null, vendor: inVal('ia-vd') || null,
      cal_na: fq === 'na', cal_freq_m: fq && fq !== 'na' ? Number(fq) : null, cal_last: inVal('ia-ls') || null, service_due: !fq ? inVal('ia-due') || null : null,
      cal_cert: inVal('ia-ce') || null, status: inVal('ia-st'), notes: inVal('ia-no') || null, is_instr: true };
    $('#ia-ok').disabled = true;
    let error, data;
    if (isNew){
      const ex = await sb.from('assets').select('id,is_instr,name').ilike('code', row.code.replace(/[%_\\]/g, '\\$&')).limit(1);
      if (ex.data?.[0]){ if (ex.data[0].is_instr){ $('#ia-ok').disabled = false; return ($('#ia-err').textContent = 'Ya hay un instrumento con esa identificación.'); }
        ({ error } = await sb.from('assets').update(row).eq('id', ex.data[0].id)); data = ex.data[0]; }
      else ({ data, error } = await sb.from('assets').insert({ ...row, org_id: me.org_id, cat: 'herramienta' }).select('id').single());
    } else ({ error } = await sb.from('assets').update(row).eq('id', a.id));
    if (error){ $('#ia-ok').disabled = false; return ($('#ia-err').textContent = /assets_code/.test(error.message || '') ? 'Ya existe un activo con esa identificación.' : errText(error)); }
    m.close(); toast(isNew ? 'Instrumento creado' : 'Guardado'); IDB.del('kv', CUR_UID + ':stk-base').catch(() => {});
    if (isNew && data?.id) history.replaceState(null, '', '#/instr/' + data.id);
    inReload();
  };
}

/* ---------------- avisos: WhatsApp con un toque y mail por la casilla de la app ---------------- */
function inAvisar(a){
  const resp = IN.cfg?.resp || [];
  const list = a ? [a] : IN.list.filter(x => ['venc', 'pronto'].includes(inCls(x)));
  const line = x => `• ${inName(x)} (${x.code}): ${inCls(x) === 'venc' ? `VENCIDA hace ${-inDays(x)} días` : x.service_due ? `vence el ${fmtDate(x.service_due + 'T12:00:00')} (${inDays(x)} días)` : 'sin vencimiento'}${x.holder_name ? ` · lo tiene ${x.holder_name}${x.obra ? ' en ' + x.obra : ''}` : ''}`;
  const txt = n => `Hola${n ? ' ' + n : ''}, aviso de InspectApp sobre calibraciones:\n\n${list.map(line).join('\n')}\n\nVer: ${location.origin + location.pathname}#/instr${a ? '/' + a.id : ''}`;
  if (!list.length) return toast('No hay instrumentos vencidos ni por vencer en 30 días 👍');
  const m = modal(`<h2>📣 Avisar</h2><p class="sm muted" style="margin-top:-6px">${a ? esc(inName(a)) : `${list.length} instrumento${list.length === 1 ? '' : 's'} vencido${list.length === 1 ? '' : 's'} o por vencer en 30 días`}</p>
    <pre class="sm" style="white-space:pre-wrap;background:var(--bg);padding:10px;border-radius:10px;max-height:180px;overflow:auto">${esc(list.map(line).join('\n'))}</pre>
    <h3 style="margin:10px 0 6px">WhatsApp</h3>
    <div class="row" style="gap:6px;flex-wrap:wrap">${resp.filter(r => r.phone).map((r, i) => `<a class="btn small" style="background:#25D366;border-color:#25D366" target="_blank" rel="noopener noreferrer" data-wa="${i}" href="https://wa.me/${waPhone(r.phone)}?text=${encodeURIComponent(txt(r.name))}">📲 ${esc(r.name)}</a>`).join('')}
      <a class="btn sec small" target="_blank" rel="noopener noreferrer" href="https://wa.me/?text=${encodeURIComponent(txt(''))}">📲 Elegir contacto…</a></div>
    ${resp.some(r => r.phone) ? '' : '<p class="sm muted">Cargá el WhatsApp de los responsables en ⚙ Responsables y avisos para mandarlo con un toque.</p>'}
    <h3 style="margin:14px 0 6px">Mail</h3>
    ${a ? `<button class="btn sec small" id="ia-mail" ${resp.some(r => r.email) && canWrite() ? '' : 'disabled'}>📧 Mandar mail a los responsables ahora</button>` : '<p class="sm muted" style="margin:0">Los mails salen solos todos los días a las 8 (60, 30, 15, 7 días antes, el día y los lunes si está vencido). Para un instrumento puntual, abrilo y tocá 📣 Avisar.</p>'}
    <div class="err" id="ia-err"></div><div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn sec" id="ia-x">Cerrar</button></div>`);
  $('#ia-x').onclick = () => a ? inDetail(a.id) : m.close();
  $('#ia-mail')?.addEventListener('click', async () => { if (!needOnline()) return; $('#ia-mail').disabled = true;
    const { data, error } = await sb.rpc('instr_notify', { p_asset: a.id }); if (error){ $('#ia-mail').disabled = false; return ($('#ia-err').textContent = errText(error)); }
    toast(`Mail en cola para ${data} responsable${data === 1 ? '' : 's'}: lo manda la casilla de la app en el próximo minuto.`); });
}
async function inCfg(){
  if (!needOnline()) return;
  const c = IN.cfg || { resp: [], days: [60, 30, 15, 7, 0], mail: true, push: true };
  let st = null; try { st = (await sb.rpc('instr_mail_status')).data; } catch {}
  const DAYS = [90, 60, 45, 30, 15, 7, 3, 1, 0];
  const rowH = (r = {}) => `<div class="row ia-r" style="gap:6px;flex-wrap:wrap;margin-bottom:6px"><input class="ia-rn" maxlength="80" placeholder="Nombre" value="${esc(r.name || '')}" style="flex:1 1 150px">
    <input class="ia-re" maxlength="160" type="email" placeholder="mail@empresa.com" value="${esc(r.email || '')}" style="flex:1 1 190px"><input class="ia-rp" maxlength="25" placeholder="WhatsApp +54 9 …" value="${esc(r.phone || '')}" style="flex:1 1 150px">
    <button class="iconbtn ia-rx" type="button" title="Quitar">✕</button></div>`;
  const ago = t => t ? Math.round((Date.now() - new Date(t)) / 60000) : null;
  const m = modal(`<h2>⚙ Responsables y avisos</h2>
    <p class="sm muted" style="margin-top:-6px">Reciben los avisos de vencimiento por mail (y al teléfono si usan la app con ese mail). El WhatsApp se usa en 📣 Avisar.</p>
    <div id="ia-rs">${(c.resp?.length ? c.resp : [{}]).map(rowH).join('')}</div><button class="btn sec small" id="ia-add" type="button">+ Responsable</button>
    <label style="margin-top:12px">¿Cuándo avisar?</label><div class="row" style="gap:6px;flex-wrap:wrap">${DAYS.map(d => `<label class="pill p-info" style="cursor:pointer;font-weight:400;display:inline-flex;gap:6px;align-items:center"><input type="checkbox" class="ia-d" value="${d}" ${(c.days || []).includes(d) ? 'checked' : ''} style="width:auto;margin:0"> ${d ? d + ' días antes' : 'el día que vence'}</label>`).join('')}</div>
    <p class="sm muted" style="margin:4px 0 0">Los vencidos se avisan al día siguiente y después todos los lunes.</p>
    <label style="display:flex;gap:8px;align-items:center;font-weight:400;margin-top:10px"><input type="checkbox" id="ia-ml" style="width:auto" ${c.mail !== false ? 'checked' : ''}> Mandar mail (sale desde la casilla de la app)</label>
    <label style="display:flex;gap:8px;align-items:center;font-weight:400"><input type="checkbox" id="ia-pu" style="width:auto" ${c.push !== false ? 'checked' : ''}> Aviso al teléfono a los responsables que usan la app</label>
    <div class="sm" style="background:var(--bg);padding:10px;border-radius:10px;margin-top:10px">${!st ? '' : !st.source ? '⚠ <b>La casilla de la app no está conectada</b>: los mails quedan en espera. Conectala en Mesa → ⚙ Ticketeras → 📨 Tickets por mail (es el mismo script de Gmail; actualizalo con el de la versión 5.25).'
      : `📨 Casilla de la app conectada · último contacto ${ago(st.poll_at) === null ? '—' : ago(st.poll_at) < 2 ? 'recién' : `hace ${ago(st.poll_at)} min`} · ${st.pend} mail${st.pend === 1 ? '' : 's'} en espera${st.last_sent ? ' · último enviado ' + fmtDT(st.last_sent) : ''}`}</div>
    ${inFoot()}`, { wide: true });
  const bindX = () => m.el.querySelectorAll('.ia-rx').forEach(b => b.onclick = () => b.closest('.ia-r').remove());
  bindX(); $('#ia-add').onclick = () => { if (m.el.querySelectorAll('.ia-r').length >= 10) return toast('Hasta 10 responsables.'); $('#ia-rs').insertAdjacentHTML('beforeend', rowH()); bindX(); };
  $('#ia-x').onclick = m.close;
  $('#ia-ok').onclick = () => {
    const resp = [...m.el.querySelectorAll('.ia-r')].map(r => ({ name: r.querySelector('.ia-rn').value.trim(), email: r.querySelector('.ia-re').value.trim(), phone: r.querySelector('.ia-rp').value.trim() })).filter(r => r.name);
    const bad = resp.find(r => r.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(r.email)); if (bad) return ($('#ia-err').textContent = `Revisá el mail de ${bad.name}.`);
    inRpc('instr_cfg_save', { p_resp: resp, p_days: [...m.el.querySelectorAll('.ia-d:checked')].map(x => Number(x.value)), p_mail: $('#ia-ml').checked, p_push: $('#ia-pu').checked }, 'Avisos guardados', m);
  };
}

/* ---------------- Excel: importar DO-05-02 y exportar ---------------- */
const inCode = v => { let s = xlStr(v).replace(/\s+/g, ' ').trim(); s = s.replace(/^(n[º°o]\.?\s*(de\s*)?serie|nro\.?\s*(de\s*serie)?|n[º°]\.?|serie|s\/n)\s*[:.]?\s*/i, '').replace(/[.\s]+$/, '').trim(); return s; };
function inFreqTxt(t){ const n = norm(t); if (!n) return null; if (/^n\/?a$|no aplica/.test(n)) return 'na'; if (/bi.?anual|cada 2/.test(n)) return 24; if (/semestr/.test(n)) return 6; if (/trimestr/.test(n)) return 3; if (/mensual/.test(n)) return 1; if (/anual/.test(n)) return 12; const m = /(\d{1,3})\s*mes/.exec(n); return m ? Number(m[1]) : null; }
const inMonthsBetween = (a, b) => { const x = new Date(a), y = new Date(b); const mm = (y.getFullYear() - x.getFullYear()) * 12 + y.getMonth() - x.getMonth(); return mm >= 1 && mm <= 120 ? mm : null; };
function inStTxt(t){ const n = norm(t); if (!n) return null; if (/perdid/.test(n)) return 'Perdido'; if (/rot/.test(n)) return 'Roto'; if (/baja|desgua/.test(n)) return 'Baja'; if (/no apto/.test(n)) return 'No apto'; if (/calibra/.test(n)) return 'En calibración'; if (/repar/.test(n)) return 'En reparación'; if (/apto/.test(n)) return 'Apto'; return null; }
function inTypeOf(name){ const n = norm(name); return /otdr/.test(n) ? 'OTDR' : /fluke|certific|tg500|mapit/.test(n) ? 'Certificador' : /power ?meter|exfo|ets/.test(n) ? 'Power meter' : /empalme|fusion/.test(n) ? 'Fusionadora' : /cleaver|cortadora/.test(n) ? 'Cleaver'
  : /anemom/.test(n) ? 'Anemómetro' : /teluri/.test(n) ? 'Telurímetro' : /estacion total/.test(n) ? 'Estación total' : 'Instrumento'; }
async function inImport(file){
  if (!file || !needOnline()) return;
  let wb; try { wb = await readWorkbook(file); } catch (e){ return toast('No se pudo leer el Excel: ' + errText(e)); }
  const items = new Map(), loans = [];
  const put = it => { const k = norm(it.code); const cur = items.get(k);
    if (!cur){ items.set(k, it); return; }
    const newer = it.last && (!cur.last || it.last > cur.last);   // queda la calibración más reciente
    for (const f of ['name', 'model', 'type']) if (!cur[f] && it[f]) cur[f] = it[f];
    if (newer) Object.assign(cur, { last: it.last, due: it.due, cert: it.cert || cur.cert, freq: it.freq || cur.freq, na: it.na, status: it.status || cur.status });
    else if (!cur.status && it.status) cur.status = it.status; };
  for (const sn of wb.SheetNames){
    const rows = sheetRows(wb.Sheets[sn]);
    const hi = rows.slice(0, 8).findIndex(r => r.some(c => /^equipo/.test(norm(c))) && r.some(c => /^(identificacion|estado|fecha)/.test(norm(c))));
    if (hi < 0) continue;
    const H = rows[hi].map(norm), at = re => H.findIndex(h => re.test(h)), all = re => H.map((h, i) => re.test(h) ? i : -1).filter(i => i >= 0);
    const C = { eq: at(/^equipo/), id: at(/^identificacion/), car: at(/^caracteristica/), fq: at(/^frecuencia/), cert: at(/^n[º°o]? ?certificado|^nro certificado/), last: at(/ultima calib|ultima verif/), due: at(/vencimiento/),
      st: at(/^estado$/), out: at(/^fecha entrega/), back: at(/^fecha devoluc/), obra: at(/^obra/), by: at(/^entregado por/) };
    const recv = all(/^recibido por|^entregado a/);   // el primero (antes de la devolución) es quien lo recibe en la entrega
    C.to = recv.find(i => C.back < 0 || i < C.back) ?? -1; C.backBy = recv.find(i => C.back >= 0 && i > C.back) ?? -1;
    let lastName = '', lastCode = '';
    for (const r of rows.slice(hi + 1)){
      let name = C.eq >= 0 ? xlStr(r[C.eq]) : ''; let code = C.id >= 0 ? inCode(r[C.id]) : '';
      if (!name && !code && C.out >= 0 && xlDate(r[C.out])){ name = lastName; code = lastCode; }   // filas de préstamo sin nombre repetido
      if (!name && !code) continue;
      if (/^calibracion$/.test(norm(name)) || /^calibracion$/.test(norm(C.fq >= 0 ? r[C.fq] : ''))) continue;
      if (code && code.split(' ').length > 3 && !/\d/.test(code)) code = '';   // "Ethernet Cabling Tester Main Unit" no es una identificación
      if (!code) code = name.replace(/\s+/g, ' ').trim();
      code = code.slice(0, 120); lastName = name; lastCode = code;
      const fqTxt = C.fq >= 0 ? xlStr(r[C.fq]) : '', last = C.last >= 0 ? xlDate(r[C.last]) : null, dueRaw = C.due >= 0 ? r[C.due] : '', due = xlDate(dueRaw);
      let freq = inFreqTxt(fqTxt); const naDue = /^n\/?a$/i.test(xlStr(dueRaw));
      if (last && due && freq !== 'na') freq = inMonthsBetween(last, due) || (typeof freq === 'number' ? freq : null);
      const na = (freq === 'na' && !due) || naDue;
      const stTxt = [C.st >= 0 ? r[C.st] : '', ...r.slice(Math.max(C.st, C.due, C.fq) + 1).filter(x => typeof x === 'string' && /perdid|rot|baja/.test(norm(x)))].map(x => inStTxt(x)).filter(Boolean);
      const st = stTxt.find(s => ['Perdido', 'Roto', 'Baja'].includes(s)) || stTxt[0] || null;
      const isLoanSheet = C.out >= 0;
      // hojas de calibración (o listado) cargan instrumentos; las hojas de préstamos solo completan los que ya están en el listado
      if (C.fq >= 0 || C.cert >= 0 || C.last >= 0 || !isLoanSheet || items.has(norm(code)))
        put({ code, name: name.slice(0, 200) || null, model: C.car >= 0 ? xlStr(r[C.car]).slice(0, 80) || null : null, type: inTypeOf(name), freq: na ? null : (typeof freq === 'number' ? freq : null), na,
          last: freq === 'na' && !due ? null : last, due: na ? null : (freq && freq !== 'na' && last ? null : due), cert: C.cert >= 0 && !/^n\/?a$/i.test(xlStr(r[C.cert])) ? xlStr(r[C.cert]).slice(0, 80) || null : null, status: st });
      if (isLoanSheet){
        const out = xlDate(r[C.out]), to = C.to >= 0 ? xlStr(r[C.to]) : '';
        if (out && to) loans.push({ code, out, to: to.slice(0, 120), by: C.by >= 0 ? xlStr(r[C.by]).slice(0, 120) || null : null, obra: C.obra >= 0 ? xlStr(r[C.obra]).slice(0, 120) || null : null,
          back: C.back >= 0 ? xlDate(r[C.back]) : null, back_by: C.backBy >= 0 ? xlStr(r[C.backBy]).slice(0, 120) || null : null });
      }
    }
  }
  const list = [...items.values()];
  if (!list.length) return toast('No encontré el listado de instrumentos (columnas Equipo, Identificación interna, Frecuencia, Fecha vencimiento…).');
  const known = new Set(IN.list.map(a => norm(a.code)));
  const nNew = list.filter(i => !known.has(norm(i.code))).length;
  const prev = list.map(i => { const a = { ...i, service_due: i.due || (i.last && i.freq ? inAddMonths(i.last, i.freq) : null), cal_na: i.na, status: i.status || 'Apto' }; return a; });
  const cnt = {}; prev.forEach(a => { const c = inCls(a); cnt[c] = (cnt[c] || 0) + 1; });
  const m = modal(`<h2>Importar instrumental</h2>
    <p><b>${list.length}</b> instrumentos (${nNew} nuevos, ${list.length - nNew} ya cargados) y <b>${loans.length}</b> préstamos del historial.</p>
    <div class="row" style="gap:6px;flex-wrap:wrap">${Object.entries(IN_CLS).filter(([k]) => cnt[k]).map(([k, [t, fg, bg]]) => `<span class="pill" style="background:${bg};color:${fg}">${t}: <b>${cnt[k]}</b></span>`).join('')}</div>
    <div class="tblwrap" style="max-height:260px;overflow:auto;margin-top:10px"><table class="tbl"><thead><tr><th>Equipo</th><th>Identificación</th><th>Frecuencia</th><th>Vence</th><th>Estado</th></tr></thead><tbody>
      ${prev.map(a => `<tr><td class="sm">${esc(a.name || '')}</td><td class="sm">${esc(a.code)}</td><td class="sm">${a.cal_na ? 'No aplica' : a.freq ? a.freq + ' meses' : '—'}</td><td class="sm" style="color:${IN_CLS[inCls(a)][1]}">${a.service_due ? fmtDate(a.service_due + 'T12:00:00') : '—'}</td><td class="sm">${esc(a.status)}</td></tr>`).join('')}</tbody></table></div>
    <p class="sm muted">Si un equipo aparece en varias hojas, queda la calibración más reciente. Los préstamos repetidos no se duplican. El que tiene una entrega sin devolución es quien lo tiene ahora.</p>
    ${inFoot('Importar')}`, { wide: true });
  $('#ia-x').onclick = m.close;
  $('#ia-ok').onclick = async () => { $('#ia-ok').disabled = true; $('#ia-ok').textContent = 'Importando…';
    const { data, error } = await sb.rpc('instr_import', { p: { items: list, loans } });
    if (error){ $('#ia-ok').disabled = false; $('#ia-ok').textContent = 'Importar'; return ($('#ia-err').textContent = errText(error)); }
    m.close(); toast(`Instrumental: ${data.nuevos} nuevos · ${data.actualizados} actualizados · ${data.prestamos} préstamos`); IDB.del('kv', CUR_UID + ':stk-base').catch(() => {}); inReload(); };
}
async function inExport(){
  let loans = [], cals = [];
  try { const r = await pageAll(() => sb.from('instr_loans').select('asset_id,out_date,to_name,out_by,obra,back_date,back_by,note').order('out_date').order('id')); loans = r?.data || []; } catch {}
  try { const r = await pageAll(() => sb.from('instr_cals').select('asset_id,cal_date,due,cert_no,lab,result,by_name').order('cal_date').order('id')); cals = r?.data || []; } catch {}
  const byId = new Map(IN.list.map(a => [a.id, a])), resp = (IN.cfg?.resp || []).map(r => r.name).join(', ');
  const d = s => s ? fmtDate(s + 'T12:00:00') : '';
  xlSave(`DO-05-02 Listado de instrumentos ${todayStr()}`, [
    ['Listado', [['LISTADO DE INSTRUMENTOS'], ['DO-05-02 · generado por InspectApp el ' + fmtDate(new Date())], [],
      ['Equipo', 'Identificación interna', 'Características', 'Frecuencia', 'Nº certificado', 'Fecha última calib/verif', 'Fecha vencimiento', 'Días para vencer', 'ESTADO', 'Situación', 'Lo tiene', 'Obra', 'Desde', 'Revisado por:', 'Fecha Revision'],
      ...IN.list.map(a => [inName(a), a.code, a.model || '', a.cal_na ? 'N/A' : a.cal_freq_m ? (a.cal_freq_m === 12 ? 'Anual' : a.cal_freq_m + ' meses') : '', a.cal_cert || '', d(a.cal_last), a.cal_na ? 'N/A' : d(a.service_due),
        a.cal_na || !a.service_due ? '' : inDays(a), a.status, IN_CLS[inCls(a)][0], a.holder_name || 'Depósito / oficina', a.obra || '', d(a.out_at), resp, fmtDate(new Date())])],
      [30, 24, 20, 10, 16, 14, 14, 10, 12, 20, 20, 20, 11, 22, 12]],
    ['Préstamos', [['Equipo', 'Identificación', 'Fecha entrega', 'Recibido por', 'Entregado por', 'Obra', 'Fecha devolución', 'Recibido por', 'Días', 'Nota'],
      ...loans.map(l => { const a = byId.get(l.asset_id) || {}; return [inName(a), a.code || '', d(l.out_date), l.to_name, l.out_by || '', l.obra || '', d(l.back_date), l.back_by || '',
        Math.round(((l.back_date ? new Date(l.back_date) : new Date(todayStr())) - new Date(l.out_date)) / 86400000), l.note || '']; })], [28, 20, 12, 20, 18, 20, 12, 18, 6, 30]],
    ['Calibraciones', [['Equipo', 'Identificación', 'Fecha calibración', 'Vencimiento', 'Nº certificado', 'Laboratorio', 'Resultado', 'Cargó'],
      ...cals.map(k => { const a = byId.get(k.asset_id) || {}; return [inName(a), a.code || '', d(k.cal_date), d(k.due), k.cert_no || '', k.lab || '', k.result, k.by_name || '']; })], [28, 20, 12, 12, 16, 20, 10, 18]]]);
}

/* ---------------- borrar con evidencia ---------------- */
async function inDel(a){
  if (!needOnline()) return;
  const [nc, nl, nm] = await Promise.all([
    sb.from('instr_cals').select('id', { count: 'exact', head: true }).eq('asset_id', a.id).then(r => r.count || 0).catch(() => 0),
    sb.from('instr_loans').select('id', { count: 'exact', head: true }).eq('asset_id', a.id).then(r => r.count || 0).catch(() => 0),
    sb.from('fiber_events').select('id', { count: 'exact', head: true }).eq('instr_id', a.id).then(r => r.count || 0).catch(() => 0)]);
  const m = modal(`<h2 style="color:var(--red)">🗑 Eliminar instrumento</h2>
    <p style="margin-top:-4px"><b>${esc(inName(a))}</b> · ${esc(a.code)}</p>
    <div class="sm" style="background:#FEF2F2;color:#991B1B;padding:10px;border-radius:10px">Se borra de Instrumental y de Stock junto con ${nc} calibración${nc === 1 ? '' : 'es'} y ${nl} préstamo${nl === 1 ? '' : 's'}.
      ${nm ? `Las ${nm} medición${nm === 1 ? '' : 'es'} OTDR hechas con él conservan los datos del instrumento de ese día.` : ''}
      Antes de borrar se guarda una copia completa con tu nombre, la fecha y el motivo, que nadie puede modificar (🗑 Eliminados).</div>
    <label>Motivo *</label><input id="ia-rs" maxlength="500" placeholder="Ej.: cargado con la serie equivocada, duplicado…">
    <label>Para confirmar, escribí la identificación: <b>${esc(a.code)}</b></label><input id="ia-cd" maxlength="120" autocomplete="off">
    ${inFoot('Eliminar definitivamente')}`);
  $('#ia-ok').classList.add('danger');
  m.el.querySelectorAll('#ia-rs,#ia-cd').forEach(x => x.oninput = () => { $('#ia-err').textContent = ''; });
  $('#ia-x').onclick = () => inDetail(a.id);
  $('#ia-ok').onclick = async () => {
    const rs = inVal('ia-rs'), cd = inVal('ia-cd');
    if (rs.length < 5) return ($('#ia-err').textContent = 'Escribí el motivo.');
    if (norm(cd) !== norm(a.code)) return ($('#ia-err').textContent = 'La identificación no coincide.');
    $('#ia-ok').disabled = true;
    const { error } = await sb.rpc('instr_delete', { p_asset: a.id, p_code: cd, p_reason: rs });
    if (error){ $('#ia-ok').disabled = false; return ($('#ia-err').textContent = errText(error)); }
    m.close(); toast('Instrumento eliminado. Quedó la constancia en 🗑 Eliminados.'); IDB.del('kv', CUR_UID + ':stk-base').catch(() => {});
    history.replaceState(null, '', '#/instr'); inReload();
  };
}
async function inDeletedList(){
  if (!needOnline()) return;
  const { data, error } = await sb.from('instr_deleted').select('id,code,name,reason,by_name,at,snapshot').order('at', { ascending: false }).limit(200);
  if (error) return toast(errText(error));
  const m = modal(`<h2>🗑 Instrumentos eliminados</h2><p class="muted sm" style="margin-top:-6px">Constancia de cada borrado: quién, cuándo y por qué, con la copia completa de los datos. No se puede modificar.</p>
    <div class="tblwrap"><table class="tbl"><thead><tr><th>Fecha</th><th>Instrumento</th><th>Motivo</th><th>Quién</th><th></th></tr></thead><tbody>
    ${(data || []).map(d => `<tr><td class="sm">${fmtDT(d.at)}</td><td><b>${esc(d.name || '')}</b><div class="muted sm">${esc(d.code || '')}</div></td><td class="sm">${esc(d.reason)}</td><td class="sm">${esc(d.by_name || '')}</td>
      <td><button class="btn sec small" data-xl="${d.id}">Excel</button></td></tr>`).join('') || '<tr><td colspan="5" class="muted">No se eliminó ningún instrumento.</td></tr>'}</tbody></table></div>
    <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn sec" id="ia-x">Cerrar</button></div>`, { wide: true });
  $('#ia-x').onclick = m.close;
  m.el.querySelectorAll('[data-xl]').forEach(b => b.onclick = () => {
    const d = data.find(x => String(x.id) === b.dataset.xl); if (!d) return;
    const sn = d.snapshot || {}, a = sn.asset || {};
    xlSave(`Instrumento eliminado ${d.code} ${String(d.at).slice(0, 10)}`, [
      ['Constancia', [['Instrumento', d.name || ''], ['Identificación', d.code || ''], ['Eliminado el', fmtDT(d.at)], ['Por', d.by_name || ''], ['Motivo', d.reason],
        ['Mediciones OTDR hechas con él', sn.measurements ?? 0], [], ['Datos al momento de borrar'], ...Object.entries(a).filter(([k]) => !['org_id', 'docs', 'extra'].includes(k)).map(([k, v]) => [k, v == null ? '' : String(v)])], [30, 60]],
      ['Calibraciones', [['Fecha', 'Vencimiento', 'Certificado', 'Laboratorio', 'Resultado', 'Cargó'], ...(sn.cals || []).map(c => [c.cal_date, c.due || '', c.cert_no || '', c.lab || '', c.result, c.by_name || ''])], [12, 12, 16, 20, 10, 18]],
      ['Préstamos', [['Entrega', 'A quién', 'Obra', 'Devolución', 'Recibió'], ...(sn.loans || []).map(l => [l.out_date, l.to_name, l.obra || '', l.back_date || '', l.back_by || ''])], [12, 22, 22, 12, 18]],
      ['Historial', [['Fecha', 'Quién', 'Qué', 'Antes', 'Después'], ...(sn.events || []).map(e => [fmtDT(e.at), e.by_name || '', e.field || e.kind || '', e.old_v || '', e.new_v || ''])], [16, 18, 20, 30, 40]]]);
  });
}
