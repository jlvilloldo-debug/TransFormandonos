/* =====================================================================
   InspectApp · Transformándonos — v5.12
   SEGURIDAD E HIGIENE: qué tener en cuenta antes de cada trabajo, botones de emergencia,
   qué hacer ante un accidente o un incumplimiento, charlas de 5 minutos, permisos de trabajo,
   ATS, entrega de EPP, vencimientos y normativa (nacional + provincias).
   Se carga recién al abrir la sección. Todo texto que viene de la base pasa por esc().
   Los registros firmados se pueden hacer sin señal: quedan en el teléfono y se envían solos.
   ===================================================================== */

const HYS = { cfg: null, contacts: [], notes: {}, loaded: 0 };
const HYS_REC_KIND = { charla: ['🗣️', 'Charla de 5 minutos'], permiso: ['📝', 'Permiso de trabajo'], ats: ['🧩', 'Análisis de trabajo seguro (ATS)'], epp: ['🦺', 'Entrega de EPP'] };
const HYS_EV_KIND = { accidente: ['🚑', 'Accidente'], incidente: ['⚠️', 'Incidente (casi accidente)'], desvio: ['⛔', 'Incumplimiento / desvío'] };
const HYS_SEV = { accidente: { leve: 'Leve', grave: 'Grave', mortal: 'Mortal' }, otro: { bajo: 'Bajo', medio: 'Medio', alto: 'Alto' } };
const HYS_CONTACT_KIND = { emergencia: ['🆘', 'Emergencias'], art: ['🏥', 'ART'], hys: ['🦺', 'Seguridad e Higiene'], supervisor: ['👷', 'Supervisor'], medico: ['🩺', 'Servicio médico'], bomberos: ['🚒', 'Bomberos'], policia: ['🚓', 'Policía'], otro: ['📞', 'Otro'] };
const HYS_GATE_DEF = { altura: 'permiso', electrico: 'permiso', confinado: 'permiso', caliente: 'permiso', excavacion: 'charla', izaje: 'charla', antenas: 'charla', via_publica: 'charla', fibra: 'charla', solitario: 'charla', vehiculos: 'no' };
const HYS_GATE_TXT = { no: 'Sin requisito', charla: 'Charla del día', permiso: 'Permiso de trabajo' };
const HYS_ID = /^[0-9A-Za-z-]{1,40}$/;   // los id solo van como parámetro de consulta o escapados
const HYS_URL = /^https:\/\/[^\s<>"']{4,400}$/;

function hysCss(){
  if (document.getElementById('hys-css')) return;
  const s = document.createElement('style'); s.id = 'hys-css';
  s.textContent = `
.hys-hero{border-radius:14px;padding:14px 16px;color:#fff;background:linear-gradient(135deg,#065F46,#059669);margin-bottom:12px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.hys-hero .big{font-size:34px;line-height:1}.hys-hero h1{margin:0;color:#fff;font-size:21px}.hys-hero p{margin:2px 0 0;opacity:.9;font-size:13px}
.hys-sos{background:#FEF2F2;border:2px solid #FCA5A5;border-radius:14px;padding:12px;margin-bottom:12px}
.hys-sos h2{margin:0 0 8px;color:#B91C1C;font-size:17px}
.hys-calls{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}
.hys-call{display:flex;gap:10px;align-items:center;background:#DC2626;color:#fff!important;border-radius:12px;padding:10px 12px;text-decoration:none;font-weight:700;min-height:52px}
.hys-call .i{font-size:24px}.hys-call small{display:block;font-weight:400;opacity:.92;font-size:12px}.hys-call.co{background:#0F2A4A}.hys-call.art{background:#0E7490}.hys-call.wa{background:#15803D}
.hys-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-bottom:12px}
.hys-tile{background:#fff;border-radius:14px;padding:14px;box-shadow:0 1px 3px rgba(0,0,0,.08);cursor:pointer;border:0;text-align:left;font:inherit;color:inherit;display:flex;gap:12px;align-items:flex-start;border-left:5px solid var(--navy-2)}
.hys-tile .i{font-size:30px;line-height:1}.hys-tile b{display:block;font-size:16px}.hys-tile span{font-size:13px;color:var(--muted)}
.hys-tile.red{border-left-color:#DC2626}.hys-tile.amb{border-left-color:#D97706}.hys-tile.grn{border-left-color:#059669}.hys-tile.vio{border-left-color:#7C3AED}
.hys-jobs{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}
.hys-job{background:#fff;border:1px solid var(--line);border-radius:12px;padding:10px;cursor:pointer;text-align:center;font:inherit;color:inherit}
.hys-job .i{font-size:28px;display:block}.hys-job b{font-size:13px;display:block;margin-top:4px}.hys-job small{font-size:11px}
.hys-sec{border-radius:12px;padding:12px 14px;margin-bottom:10px;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.06)}
.hys-sec h3{margin:0 0 6px;font-size:15px}.hys-sec ul{margin:0;padding-left:20px}.hys-sec li{margin:3px 0}
.hys-sec.risk{border-left:5px solid #D97706}.hys-sec.do{border-left:5px solid #059669}.hys-sec.epp{border-left:5px solid #2563EB}.hys-sec.no{border-left:5px solid #DC2626;background:#FFF5F5}.hys-sec.co{border-left:5px solid #7C3AED;background:#FAF5FF}
.hys-chk{display:flex;gap:8px;align-items:flex-start;padding:6px 0;border-bottom:1px solid var(--line);font-weight:400;cursor:pointer}.hys-chk input{width:auto;margin-top:3px}
.hys-step{display:flex;gap:12px;padding:10px 0;border-bottom:1px solid var(--line)}.hys-step .n{flex:none;width:38px;height:38px;border-radius:50%;background:#FEE2E2;display:flex;align-items:center;justify-content:center;font-size:20px}
.hys-step b{display:block}.hys-step p{margin:2px 0 0;font-size:14px}
.hys-stop{background:#DC2626;color:#fff;border-radius:14px;padding:16px;text-align:center;margin-bottom:12px}.hys-stop b{font-size:24px;display:block}
.hys-pill{display:inline-block;border-radius:20px;padding:2px 10px;font-size:12px;font-weight:600;white-space:nowrap}
.hys-pill.r{background:#FEE2E2;color:#B91C1C}.hys-pill.a{background:#FEF3C7;color:#92400E}.hys-pill.g{background:#D1FAE5;color:#065F46}.hys-pill.n{background:#E5E7EB;color:#374151}.hys-pill.b{background:#DBEAFE;color:#1E40AF}
.hys-tg{display:inline-flex;gap:6px;align-items:center;border:1px solid var(--line);border-radius:20px;padding:5px 10px;font-size:13px;cursor:pointer;background:#fff;font-weight:400;margin:2px}
.hys-tg input{width:auto;margin:0}.hys-tg.on{background:#ECFDF5;border-color:#059669}
.hys-yn{display:flex;gap:4px;flex:none}.hys-yn button{border:1px solid var(--line);background:#fff;border-radius:8px;padding:4px 9px;font-size:12px;cursor:pointer}
.hys-yn button.on[data-v=si]{background:#059669;color:#fff;border-color:#059669}.hys-yn button.on[data-v=no]{background:#DC2626;color:#fff;border-color:#DC2626}.hys-yn button.on[data-v=na]{background:#6B7280;color:#fff;border-color:#6B7280}
.hys-row{display:flex;gap:8px;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--line)}
.hys-sigc{border:1px dashed var(--muted);border-radius:8px;background:#fff;width:100%;height:160px;touch-action:none;display:block}
.hys-sigs{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px}.hys-sigs div{border:1px solid var(--line);border-radius:10px;padding:6px;text-align:center;font-size:12px}.hys-sigs img{max-width:100%;height:70px;object-fit:contain}
.hys-tbl{width:100%;border-collapse:collapse;font-size:14px}.hys-tbl td,.hys-tbl th{border-bottom:1px solid var(--line);padding:6px;text-align:left;vertical-align:top}
.hys-warn{background:#FFFBEB;border:1px solid #FCD34D;border-radius:12px;padding:10px 12px;font-size:13px;margin-bottom:12px}
.hys-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}.hys-tabs a{border:1px solid var(--line);background:#fff;border-radius:20px;padding:6px 12px;font-size:13px;color:var(--ink);text-decoration:none}.hys-tabs a.on{background:var(--navy);color:#fff;border-color:var(--navy)}
@media print{header.top,#tabs,#bnav,.hys-noprint,.toast{display:none!important}body{background:#fff}.hys-print{box-shadow:none!important}}`;
  document.head.appendChild(s);
}

/* ---------- utilidades ---------- */
const hysTelOk = p => { const d = String(p || '').replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '').slice(0, 20); return /^\+?\d{2,19}$/.test(d) ? d : null; };
const hysCall = (num, label, sub, cls = '', ic = '📞') => { const d = hysTelOk(num); return d ? `<a class="hys-call ${cls}" href="tel:${d}"><span class="i">${ic}</span><span>${esc(num)}<small>${esc(label)}${sub ? ' · ' + esc(sub) : ''}</small></span></a>` : ''; };
const hysLink = (url, txt) => url && HYS_URL.test(url) ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(txt)}</a>` : esc(txt);
const hysGate = job => ((HYS.cfg || {}).gate || {})[job] || HYS_GATE_DEF[job] || 'no';
const hysJobsOk = a => (a || []).filter(k => HYS_JOBS[k]);
const hysIsMgr = () => typeof isManager === 'function' && isManager();
const hysAdmin = () => typeof permCanManage === 'function' ? permCanManage() : isAdmin();
const hysStaff = () => (typeof HHS !== 'undefined' && HHS.staff || []).filter(s => s.active !== false);
const hysOutKey = () => 'hys-out:' + (me && me.org_id);
const hysUncache = k => IDB.del('kv', CUR_UID + ':' + k);
const hysToday0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

async function hysBase(force){
  if (!force && HYS.cfg && Date.now() - HYS.loaded < 120000) return;
  const [cfg, contacts, notes] = await Promise.all([
    cached('hys-cfg', () => sb.rpc('hys_cfg')).catch(() => HYS.cfg || {}),
    cached('hys-contacts', () => sb.from('hys_contacts').select('*').order('sort').order('name').limit(200)).catch(() => HYS.contacts || []),
    cached('hys-notes', () => sb.from('hys_job_notes').select('job,notes,extra_checks,updated_by,updated_at').limit(50)).catch(() => []),
  ]);
  HYS.cfg = cfg && typeof cfg === 'object' ? cfg : {};
  HYS.contacts = Array.isArray(contacts) ? contacts : [];
  HYS.notes = Object.fromEntries((notes || []).map(n => [n.job, n]));
  HYS.loaded = Date.now();
  try { if (typeof hhLoadBase === 'function' && !hysStaff().length) await hhLoadBase(); } catch {}
}

/* ---------- registros sin señal: cola en el teléfono ---------- */
async function hysOut(){ try { return (await IDB.get('kv', hysOutKey())) || []; } catch { return []; } }
async function hysOutSet(a){ try { await IDB.put('kv', a, hysOutKey()); } catch {} }
let hysSyncing = false;
async function hysSync(){
  if (hysSyncing || !online() || !me) return;
  hysSyncing = true;
  try {
    let q = await hysOut(); if (!q.length) return;
    const keep = [];
    for (const it of q){
      const tbl = it.t === 'ev' ? 'hys_events' : 'hys_records';
      const { error } = await sb.from(tbl).insert(it.row);
      if (error && !/duplicate key|23505/i.test(error.message + (error.code || ''))){
        if (isNetErr(error)){ keep.push(it); continue; }
        keep.push({ ...it, err: errText(error).slice(0, 200) }); continue;
      }
      for (const p of it.blobs || []){
        const b = await IDB.get('blobs', p).catch(() => null); if (!b) continue;
        const up = await sb.storage.from('fotos').upload(p, b, { contentType: 'image/jpeg', upsert: false });
        if (up.error && !/exists|duplicate/i.test(up.error.message)){ keep.push({ t: 'blob', blobs: [p] }); continue; }
        IDB.del('blobs', p).catch(() => {});
      }
    }
    // fotos que quedaron sin subir (el registro ya está en la base)
    const fin = [];
    for (const it of keep){
      if (it.t !== 'blob'){ fin.push(it); continue; }
      const b = await IDB.get('blobs', it.blobs[0]).catch(() => null); if (!b) continue;
      const up = await sb.storage.from('fotos').upload(it.blobs[0], b, { contentType: 'image/jpeg', upsert: false });
      if (up.error && !/exists|duplicate/i.test(up.error.message)) fin.push(it); else IDB.del('blobs', it.blobs[0]).catch(() => {});
    }
    await hysOutSet(fin);
    if (fin.length < q.length) toast('Seguridad e Higiene: registros enviados');
  } finally { hysSyncing = false; }
}
window.addEventListener('online', () => setTimeout(hysSync, 2500));

/* ---------- emergencias: botón 🆘 de la barra ---------- */
function hysCallsHTML(){
  const c = HYS.cfg || {};
  const emerg = HYS_EMERG.map(([n, l, i]) => hysCall(n, l, '', '', i)).join('');
  const art = c.art_phone ? hysCall(c.art_phone, 'ART' + (c.art_name ? ': ' + c.art_name : ''), c.art_policy ? 'Póliza ' + c.art_policy : '', 'art', '🏥') : '';
  const hy = c.hys_phone ? hysCall(c.hys_phone, 'Seguridad e Higiene', c.hys_name || '', 'co', '🦺') : '';
  const co = (HYS.contacts || []).map(x => hysCall(x.phone, x.name, [x.role, x.zone].filter(Boolean).join(' · '), x.kind === 'art' ? 'art' : 'co', (HYS_CONTACT_KIND[x.kind] || HYS_CONTACT_KIND.otro)[0])).join('');
  return `<div class="hys-calls">${emerg}${art}${hy}${co}</div>
    ${!c.art_phone && !(HYS.contacts || []).length ? `<p class="sm muted" style="margin:8px 0 0">La empresa todavía no cargó el teléfono de la ART ni sus contactos.${hysAdmin() ? ' <a href="#/hys/cfg">Cargarlos ahora</a>' : ' Pedíselo al administrador.'}</p>` : ''}`;
}
async function hysSOS(){
  hysCss(); await hysBase().catch(() => {});
  const m = modal(`<h2 style="color:#B91C1C;margin-top:0">🆘 Emergencia</h2>
    <p class="sm" style="margin-top:-4px">Tocá un número para llamar. Decí <b>dónde estás</b>, <b>qué pasó</b> y <b>cuántos heridos</b> hay.</p>
    ${hysCallsHTML()}
    <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:12px">
      <button class="btn" id="sos-loc" style="background:#15803D">📍 Mandar mi ubicación por WhatsApp</button>
      <a class="btn danger" href="#/hys/acc" data-close-modal>🚑 Qué hacer ante un accidente</a>
      <a class="btn sec" href="#/hys/desvio" data-close-modal>⛔ Detecté un incumplimiento</a>
      <button class="btn sec" data-close-modal>Cerrar</button></div>`, { wide: true });
  m.el.querySelector('#sos-loc').onclick = () => hysShareLoc();
}
async function hysShareLoc(extra){
  const p = (typeof geoNow === 'function' && geoNow()) || await getPos();
  const c = HYS.cfg || {};
  const txt = `${extra || '🆘 Necesito ayuda.'}\n${me?.full_name || ''}${p ? `\nMi ubicación: https://www.google.com/maps?q=${p.lat.toFixed(6)},${p.lng.toFixed(6)}` : '\n(no pude obtener la ubicación)'}`;
  const ph = c.hys_phone && typeof waPhone === 'function' ? waPhone(c.hys_phone) : '';
  window.open(`https://wa.me/${ph && /^\d{6,16}$/.test(ph) ? ph : ''}?text=${encodeURIComponent(txt)}`, '_blank', 'noopener');
}

/* ---------- control antes de empezar una tarea ---------- */
// devuelve true si se puede empezar; si falta la charla o el permiso, muestra qué hacer
async function hysGateCheck(t){
  const jobs = hysJobsOk(t && t.hys_jobs); if (!jobs.length) return true;
  await hysBase().catch(() => {});
  const need = jobs.map(j => [j, hysGate(j)]).filter(([, g]) => g !== 'no'); if (!need.length) return true;
  const since = hysToday0().toISOString();
  let recs = [];
  try { recs = await cached('hys-rt:' + t.id, () => sb.from('hys_records').select('id,kind,jobs,status,created_at').eq('task_id', t.id).gte('created_at', since).neq('status', 'anulado').limit(200)); } catch {}
  const out = (await hysOut()).filter(i => i.t === 'rec' && i.row.task_id === t.id).map(i => i.row);
  const all = [...recs, ...out].filter(r => String(r.created_at || '') >= since && r.status !== 'anulado');
  const has = (job, g) => all.some(r => (r.jobs || []).includes(job) && (g === 'permiso' ? r.kind === 'permiso' && r.status !== 'cerrado' : ['charla', 'permiso', 'ats'].includes(r.kind)));
  const miss = need.filter(([j, g]) => !has(j, g));
  if (!miss.length) return true;
  hysCss();
  const needP = miss.some(([, g]) => g === 'permiso'), needC = miss.some(([, g]) => g === 'charla');
  const m = modal(`<div style="text-align:center"><div style="font-size:44px">🦺</div><h2 style="margin:4px 0">Antes de empezar</h2>
    <p class="muted" style="margin-top:0">Esta tarea incluye trabajos de riesgo. La empresa pide completar esto hoy, antes de iniciar:</p></div>
    ${miss.map(([j, g]) => `<div class="hys-row"><span>${HYS_JOBS[j].ic} <b>${esc(HYS_JOBS[j].name)}</b></span><span class="hys-pill ${g === 'permiso' ? 'r' : 'a'}">${HYS_GATE_TXT[g]}</span></div>`).join('')}
    <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:14px;justify-content:center">
      ${needP ? `<a class="btn" href="#/hys/permiso/${esc(t.id)}" data-close-modal>📝 Hacer el permiso de trabajo</a>` : ''}
      ${needC ? `<a class="btn ${needP ? 'sec' : ''}" href="#/hys/charla/${esc(t.id)}" data-close-modal>🗣️ Hacer la charla de 5 minutos</a>` : ''}
      <button class="btn sec" data-close-modal>Ahora no</button></div>
    <p class="sm muted" style="text-align:center;margin-bottom:0">Se puede hacer sin señal: queda guardado en el teléfono y se envía solo.</p>`);
  return false;
}
// tarjeta "Seguridad antes de empezar" en el detalle de una tarea
function hysTaskCard(t){
  const jobs = hysJobsOk(t && t.hys_jobs); if (!jobs.length) return '';
  return `<div class="card" style="border-left:5px solid #059669"><div class="row between" style="flex-wrap:wrap;gap:8px"><h2 style="margin:0">🦺 Seguridad antes de empezar</h2>
    <a class="btn small sec" href="#/hys">Ver todo</a></div>
    <div style="margin-top:8px">${jobs.map(j => `<a class="hys-tg" style="text-decoration:none;color:inherit" href="#/hys/job/${j}">${HYS_JOBS[j].ic} ${esc(HYS_JOBS[j].name)}${hysGate(j) !== 'no' ? ` <span class="hys-pill ${hysGate(j) === 'permiso' ? 'r' : 'a'}">${HYS_GATE_TXT[hysGate(j)]}</span>` : ''}</a>`).join('')}</div>
    <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:10px">
      <a class="btn small" href="#/hys/charla/${esc(t.id)}">🗣️ Charla</a><a class="btn small" href="#/hys/permiso/${esc(t.id)}">📝 Permiso</a>
      <a class="btn small sec" href="#/hys/ats/${esc(t.id)}">🧩 ATS</a><a class="btn small sec" href="#/hys/desvio/${esc(t.id)}">⛔ Desvío</a><a class="btn small danger" href="#/hys/acc/${esc(t.id)}">🚑 Accidente</a></div></div>`;
}

/* =========================================================
   PANTALLAS
   ========================================================= */
async function viewHys(v, id, id2){
  hysCss(); await hysBase(); hysSync().catch(() => {});
  if (!id) return hysHome(v);
  if (id === 'job' && HYS_JOBS[id2]) return hysJob(v, id2);
  if (id === 'norma') return hysNorms(v);
  if (id === 'acc') return hysAcc(v, id2);
  if (id === 'desvio') return hysDesvio(v, id2);
  if (HYS_REC_KIND[id]) return hysRecForm(v, id, id2);
  if (id === 'reg') return hysRegs(v, id2);
  if (id === 'r' && HYS_ID.test(id2 || '')) return hysRecView(v, id2);
  if (id === 'ev' && HYS_ID.test(id2 || '')) return hysEvView(v, id2);
  if (id === 'venc') return hysDues(v);
  if (id === 'cfg'){ if (!hysAdmin()) { location.hash = '#/hys'; return; } return hysCfg(v); }
  location.hash = '#/hys';
}
const hysBack = (to = '#/hys', txt = '← Seguridad e Higiene') => `<div class="report-bar hys-noprint" style="max-width:none"><button class="btn sec" data-go="${to}">${txt}</button></div>`;

async function hysHome(v){
  const c = HYS.cfg || {};
  const out = await hysOut();
  let openEv = 0, dues = 0;
  if (hysIsMgr() && online()){
    try { const r = await sb.from('hys_events').select('id', { count: 'exact', head: true }).neq('status', 'cerrado'); openEv = r.count || 0; } catch {}
    try { const r = await sb.from('hys_dues').select('id', { count: 'exact', head: true }).is('done_date', null).lte('due_date', addDays(todayStr(), 30)); dues = r.count || 0; } catch {}
  }
  v.innerHTML = `
    <div class="hys-hero"><div class="big">🦺</div><div style="flex:1;min-width:200px"><h1>Seguridad e Higiene</h1><p>Antes de empezar, durante el trabajo y si algo sale mal.</p></div>
      ${hysAdmin() ? '<a class="btn sec small" href="#/hys/cfg" style="background:#fff">⚙️ Configurar</a>' : ''}</div>
    ${!c.reviewed_by ? `<div class="hys-warn">⚠️ <b>Contenido de referencia sin validar.</b> El profesional de Higiene y Seguridad de la empresa tiene que revisarlo y adaptarlo${hysAdmin() ? ' (Configurar → Revisado por)' : ''}. No reemplaza el programa de seguridad ni las indicaciones del responsable.</div>` : `<p class="sm muted" style="margin:-4px 0 10px">✔ Revisado por ${esc(c.reviewed_by)}${c.reviewed_at ? ' el ' + esc(fmtDate(c.reviewed_at + 'T12:00')) : ''}</p>`}
    ${out.length ? `<div class="banner trial"><span class="dot"></span><div><b>${out.length} registro${out.length === 1 ? '' : 's'} esperando señal</b><div class="sm">Se envían solos al volver internet.${out.some(x => x.err) ? ' Alguno dio error: <a href="#/hys/reg">ver</a>.' : ''}</div></div></div>` : ''}
    <div class="hys-sos"><h2>🆘 Llamadas de emergencia</h2>${hysCallsHTML()}
      <div class="row" style="gap:8px;margin-top:8px;flex-wrap:wrap"><button class="btn small" id="h-loc" style="background:#15803D">📍 Mandar mi ubicación</button></div></div>
    <div class="hys-grid">
      <button class="hys-tile red" data-go="#/hys/acc"><span class="i">🚑</span><div><b>Ocurrió un accidente</b><span>Qué hacer paso a paso, primeros auxilios y denuncia a la ART</span></div></button>
      <button class="hys-tile red" data-go="#/hys/desvio"><span class="i">⛔</span><div><b>Detecté un incumplimiento</b><span>Detener la tarea, registrar y avisar</span></div></button>
      <button class="hys-tile grn" data-go="#/hys/charla"><span class="i">🗣️</span><div><b>Charla de 5 minutos</b><span>Con firma de los asistentes</span></div></button>
      <button class="hys-tile grn" data-go="#/hys/permiso"><span class="i">📝</span><div><b>Permiso de trabajo</b><span>Altura, eléctrico, espacio confinado, en caliente</span></div></button>
      <button class="hys-tile" data-go="#/hys/ats"><span class="i">🧩</span><div><b>ATS</b><span>Análisis de trabajo seguro: pasos, riesgos y controles</span></div></button>
      <button class="hys-tile" data-go="#/hys/epp"><span class="i">🦺</span><div><b>Entrega de EPP</b><span>Constancia firmada por el trabajador</span></div></button>
      <button class="hys-tile vio" data-go="#/hys/reg"><span class="i">📋</span><div><b>Registros y eventos</b><span>${openEv ? `<b style="color:#B91C1C;display:inline">${openEv} evento${openEv === 1 ? '' : 's'} abierto${openEv === 1 ? '' : 's'}</b>` : 'Charlas, permisos, accidentes y desvíos'}</span></div></button>
      <button class="hys-tile amb" data-go="#/hys/venc"><span class="i">📅</span><div><b>Vencimientos</b><span>${dues ? `<b style="color:#B45309;display:inline">${dues} vencido${dues === 1 ? '' : 's'} o por vencer</b>` : 'Capacitaciones, exámenes, extintores, calibraciones'}</span></div></button>
      <button class="hys-tile" data-go="#/hys/norma"><span class="i">📚</span><div><b>Normativa</b><span>Nacional y de cada provincia, con link a la fuente oficial</span></div></button>
    </div>
    <div class="card"><h2 style="margin-top:0">Antes de empezar: elegí el trabajo</h2>
      <div class="hys-jobs">${Object.entries(HYS_JOBS).map(([k, j]) => `<button class="hys-job" data-go="#/hys/job/${k}"><span class="i">${j.ic}</span><b>${esc(j.name)}</b>${hysGate(k) !== 'no' ? `<small class="hys-pill ${hysGate(k) === 'permiso' ? 'r' : 'a'}">${HYS_GATE_TXT[hysGate(k)]}</small>` : ''}</button>`).join('')}</div></div>`;
  $('#h-loc').onclick = () => hysShareLoc('📍 Te comparto mi ubicación.');
}

async function hysJob(v, k){
  const j = HYS_JOBS[k], n = HYS.notes[k] || {}, g = hysGate(k);
  const li = a => a.map(x => `<li>${esc(x)}</li>`).join('');
  v.innerHTML = `${hysBack()}
    <div class="hys-hero" style="background:linear-gradient(135deg,#0F2A4A,#1A3A6B)"><div class="big">${j.ic}</div><div style="flex:1;min-width:200px"><h1>${esc(j.name)}</h1><p>${esc(j.desc)}</p></div>
      ${g !== 'no' ? `<span class="hys-pill ${g === 'permiso' ? 'r' : 'a'}" style="font-size:13px">Antes de iniciar: ${HYS_GATE_TXT[g]}</span>` : ''}</div>
    <div class="row hys-noprint" style="gap:8px;flex-wrap:wrap;margin-bottom:12px">
      <a class="btn" href="#/hys/charla">🗣️ Charla de 5 min</a>${j.permit || g === 'permiso' ? '<a class="btn" href="#/hys/permiso">📝 Permiso de trabajo</a>' : ''}<a class="btn sec" href="#/hys/ats">🧩 ATS</a>
      <button class="btn sec" id="j-print">🖨 Imprimir</button></div>
    <div class="hys-sec risk"><h3>⚠️ Riesgos principales</h3><ul>${li(j.risks)}</ul></div>
    <div class="hys-sec do"><h3>✅ Antes de empezar (tildá a medida que lo verificás)</h3>
      ${[...j.before, ...(n.extra_checks || [])].map((x, i) => `<label class="hys-chk"><input type="checkbox" data-c="${i}"> <span>${esc(x)}</span></label>`).join('')}
      <p class="sm muted" style="margin:6px 0 0" id="j-cnt"></p></div>
    <div class="hys-sec epp"><h3>🦺 Elementos de protección personal</h3><ul>${li(j.epp)}</ul></div>
    <div class="hys-sec no"><h3>🚫 Nunca</h3><ul>${li(j.never)}</ul></div>
    ${n.notes ? `<div class="hys-sec co"><h3>🏢 Procedimiento de la empresa</h3><p style="white-space:pre-wrap;margin:0">${esc(n.notes)}</p>${n.updated_by ? `<p class="sm muted" style="margin:6px 0 0">Actualizado por ${esc(n.updated_by)} · ${esc(fmtDate(n.updated_at))}</p>` : ''}</div>` : ''}
    <div class="hys-sec"><h3>🗣️ Temas para la charla</h3><ul>${li(j.talk)}</ul></div>
    <div class="hys-sec"><h3>📚 Normas que aplican</h3><ul>${j.norms.map(x => HYS_NORMS[x]).filter(Boolean).map(([t, u, d]) => `<li>${hysLink(u, t)} <span class="sm muted">— ${esc(d)}</span></li>`).join('')}</ul></div>
    <p class="sm muted">Material de apoyo. Seguí siempre las indicaciones del responsable de Higiene y Seguridad.</p>`;
  const cnt = () => { const a = v.querySelectorAll('[data-c]'), b = v.querySelectorAll('[data-c]:checked'); $('#j-cnt').textContent = `${b.length} de ${a.length} verificados` + (b.length === a.length ? ' ✔ listo para empezar' : ''); };
  v.querySelectorAll('[data-c]').forEach(c => c.onchange = cnt); cnt();
  $('#j-print').onclick = () => window.print();
}

async function hysNorms(v){
  const c = HYS.cfg || {}, prov = (c.provinces && c.provinces.length ? c.provinces : ['sf', 'ba', 'cba', 'sl']).filter(p => HYS_ALL_PROV[p]);
  const cust = (c.custom_norms || []).filter(x => x && x.title);
  const provs = [...new Set([...prov, ...cust.map(x => x.prov).filter(p => HYS_ALL_PROV[p])])];
  const item = (t, u, d) => `<div style="padding:8px 0;border-bottom:1px solid var(--line)"><b>${hysLink(u, t)}</b>${u && HYS_URL.test(u) ? ' <span class="sm">↗</span>' : ''}${d ? `<div class="sm muted">${esc(d)}</div>` : ''}</div>`;
  v.innerHTML = `${hysBack()}
    <div class="hys-hero" style="background:linear-gradient(135deg,#1E3A8A,#2563EB)"><div class="big">📚</div><div><h1>Normativa</h1><p>Cada norma abre su texto en la fuente oficial. Verificá siempre la versión vigente.</p></div></div>
    <div class="card"><h2 style="margin-top:0">🇦🇷 Nacional</h2>${HYS_PROV.nac.norms.map(k => item(...HYS_NORMS[k])).join('')}</div>
    ${provs.map(p => { const base = (HYS_PROV[p] || {}).items || [], extra = cust.filter(x => x.prov === p);
      return `<div class="card"><h2 style="margin-top:0">📍 ${esc(HYS_ALL_PROV[p])}</h2>${base.map(x => item(...x)).join('')}${extra.map(x => item(x.title, x.url, x.note)).join('')}
        ${!base.length && !extra.length ? `<p class="muted sm">Todavía no hay normas cargadas para esta provincia.${hysAdmin() ? ' <a href="#/hys/cfg">Agregar</a>' : ''}</p>` : ''}</div>`; }).join('')}
    ${hysAdmin() ? '<p class="sm"><a href="#/hys/cfg">⚙️ Agregar provincias o normas propias</a></p>' : ''}`;
}

/* ---------- accidente ---------- */
async function hysAcc(v, taskId){
  v.innerHTML = `${hysBack()}
    <div class="hys-stop" style="background:#B91C1C"><b>🚑 Ocurrió un accidente</b><span>Mantené la calma. Primero tu seguridad, después la del herido.</span></div>
    <div class="hys-sos"><h2>📞 Llamar ahora</h2>${hysCallsHTML()}
      <div class="row" style="gap:8px;margin-top:8px"><button class="btn small" id="a-loc" style="background:#15803D">📍 Mandar mi ubicación a HyS</button></div></div>
    <div class="card"><h2 style="margin-top:0">Paso a paso</h2>${HYS_ACC.map(([i, t, d]) => `<div class="hys-step"><span class="n">${i}</span><div><b>${esc(t)}</b><p>${esc(d)}</p></div></div>`).join('')}</div>
    <div class="hys-grid" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">
      <div class="hys-sec do"><h3>🩹 Qué hacer</h3><ul>${HYS_FIRSTAID.do.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
      <div class="hys-sec no"><h3>🚫 Qué NO hacer</h3><ul>${HYS_FIRSTAID.dont.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div></div>
    <div class="card"><h2 style="margin-top:0">📝 Registrar lo que pasó</h2><p class="sm muted" style="margin-top:-4px">Cuando la situación esté controlada. Se abre automáticamente un caso de mejora para investigar la causa.</p><div id="a-form"></div></div>
    <p class="sm muted">Plazos de la denuncia según la Res. SRT 525/15: ${hysLink(HYS_NORMS.res525[1], 'ver la norma')}. La ART cubre la atención médica desde el primer momento.</p>`;
  $('#a-loc').onclick = () => hysShareLoc('🚑 Hubo un accidente. Estoy acá.');
  hysEvForm($('#a-form'), 'accidente', taskId);
}
async function hysDesvio(v, taskId){
  v.innerHTML = `${hysBack()}
    <div class="hys-stop"><b>⛔ Detené la tarea</b><span>Si hay riesgo grave e inminente, nadie sigue trabajando hasta corregirlo.</span></div>
    <div class="card"><h2 style="margin-top:0">Qué hacer</h2>${HYS_DEV.map(([i, t, d]) => `<div class="hys-step"><span class="n" style="background:#FEF3C7">${i}</span><div><b>${esc(t)}</b><p>${esc(d)}</p></div></div>`).join('')}</div>
    <div class="card"><h2 style="margin-top:0">📝 Registrar el incumplimiento</h2><div id="d-form"></div></div>`;
  hysEvForm($('#d-form'), 'desvio', taskId);
}
async function hysTaskCtx(taskId){
  if (!taskId || !HYS_ID.test(taskId)) return null;
  try { return await cached('task:' + taskId, () => sb.from('tasks').select(TASK_COLS).eq('id', taskId).single()); } catch { return null; }
}
async function hysSites(){ try { return await cached('hys-sites', () => sb.from('sites').select('id,name').eq('active', true).order('name').limit(5000)); } catch { return []; } }
async function hysContrs(){ if (isContractor()) return []; try { return (await loadContractors()).filter(c => c.active); } catch { return []; } }

async function hysEvForm(box, kind0, taskId){
  const t = await hysTaskCtx(taskId), sites = await hysSites(), contrs = await hysContrs();
  const id = uid(); const photos = []; let kind = kind0;
  let jobs = new Set(hysJobsOk(t && t.hys_jobs));
  const sevs = () => kind === 'accidente' ? HYS_SEV.accidente : HYS_SEV.otro;
  box.innerHTML = `
    ${kind0 === 'desvio' ? `<label>Tipo</label><select id="e-k"><option value="desvio">⛔ Incumplimiento / condición o acto inseguro</option><option value="incidente">⚠️ Incidente: casi accidente, sin heridos</option></select>` : ''}
    <label>Qué pasó (título corto)</label><input id="e-t" maxlength="200" placeholder="${kind0 === 'accidente' ? 'Ej.: Corte en la mano al pelar cable' : 'Ej.: Trabajo en torre sin doble cabo'}">
    <div class="row"><div class="grow"><label>Gravedad</label><select id="e-s"></select></div>
      <div class="grow"><label>Fecha y hora</label><input type="datetime-local" id="e-at"></div></div>
    <label>Trabajos involucrados</label><div id="e-j"></div>
    ${kind0 !== 'accidente' ? `<label>Qué regla se incumple</label><select id="e-ns"><option value="">— Elegí o escribí abajo —</option></select><input id="e-n" maxlength="300" placeholder="O escribila con tus palabras" style="margin-top:6px">` : ''}
    <label>Descripción</label><textarea id="e-d" maxlength="4000" placeholder="${kind0 === 'accidente' ? 'Cómo ocurrió, qué estaba haciendo, qué lesión tiene' : 'Qué viste, dónde, qué riesgo genera'}"></textarea>
    <label>Lugar / sitio</label><input id="e-site" list="e-sl" maxlength="200" value="${esc(t && t.sites && t.sites[0] ? t.sites[0].site_name : '')}" autocomplete="off"><datalist id="e-sl">${sites.map(s => `<option value="${esc(s.name)}">`).join('')}</datalist>
    ${contrs.length ? `<label>Contratista involucrada</label><select id="e-c"><option value="">— Ninguna / personal propio —</option>${contrs.map(c => `<option value="${esc(c.id)}" ${t && t.contractor_id === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>` : ''}
    ${kind0 === 'accidente' ? `<label>Persona lesionada</label><input id="e-inj" maxlength="300" placeholder="Nombre y apellido">` : ''}
    <label>Testigos</label><input id="e-w" maxlength="500" placeholder="Nombres (opcional)">
    <label class="hys-chk" style="border:0"><input type="checkbox" id="e-stop" ${kind0 !== 'accidente' ? 'checked' : ''}> <span>Se detuvo la tarea</span></label>
    <label>Fotos (hasta 6)</label><div class="row" style="gap:8px;flex-wrap:wrap"><label class="btn sec small" style="margin:0">📷 Agregar foto<input type="file" id="e-ph" accept="image/*" capture="environment" style="display:none"></label><span id="e-phs" class="sm muted">Sin fotos</span></div>
    <div class="err" id="e-err"></div>
    <div class="row" style="justify-content:flex-end;gap:8px;margin-top:10px;flex-wrap:wrap"><button class="btn ${kind0 === 'accidente' ? 'danger' : ''}" id="e-ok">Registrar</button></div>`;
  const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); $('#e-at').value = d.toISOString().slice(0, 16);
  const fillSev = () => { $('#e-s').innerHTML = Object.entries(sevs()).map(([k, x]) => `<option value="${k}" ${k === (kind === 'accidente' ? 'leve' : 'medio') ? 'selected' : ''}>${x}</option>`).join(''); };
  const fillNorm = () => { const s = $('#e-ns'); if (!s) return; const opts = [...new Set([...jobs].flatMap(k => HYS_JOBS[k].never))];
    s.innerHTML = '<option value="">— Elegí o escribí abajo —</option>' + opts.map(x => `<option>${esc(x)}</option>`).join(''); };
  const fillJobs = () => { $('#e-j').innerHTML = Object.entries(HYS_JOBS).map(([k, j]) => `<label class="hys-tg ${jobs.has(k) ? 'on' : ''}"><input type="checkbox" value="${k}" ${jobs.has(k) ? 'checked' : ''}> ${j.ic} ${esc(j.name)}</label>`).join('');
    $('#e-j').querySelectorAll('input').forEach(c => c.onchange = () => { c.checked ? jobs.add(c.value) : jobs.delete(c.value); c.parentElement.classList.toggle('on', c.checked); fillNorm(); }); };
  fillSev(); fillJobs(); fillNorm();
  $('#e-k') && ($('#e-k').onchange = () => { kind = $('#e-k').value; fillSev(); });
  $('#e-ns') && ($('#e-ns').onchange = () => { if ($('#e-ns').value) $('#e-n').value = $('#e-ns').value; });
  const phs = () => { $('#e-phs').textContent = photos.length ? `${photos.length} foto${photos.length === 1 ? '' : 's'} lista${photos.length === 1 ? '' : 's'}` : 'Sin fotos'; };
  $('#e-ph').onchange = async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    if (photos.length >= 6) return toast('Máximo 6 fotos.');
    if (!/^image\//.test(f.type)) return toast('Elegí una imagen.');
    try { const b = await compressImage(f, 1280, 0.7); photos.push(b); phs(); } catch (er){ toast(errText(er)); }
  };
  $('#e-ok').onclick = async () => {
    const err = $('#e-err'); err.textContent = '';
    const title = $('#e-t').value.trim(); if (!title) return (err.textContent = 'Poné un título corto.');
    const siteName = $('#e-site').value.trim(), s = sites.find(x => x.name.toLowerCase() === siteName.toLowerCase());
    const at = $('#e-at').value ? new Date($('#e-at').value) : new Date();
    const pos = (typeof geoNow === 'function' && geoNow()) || await getPos();
    const paths = photos.map(() => `${me.org_id}/hys/${id}/${uid()}.jpg`);
    const row = { id, org_id: me.org_id, kind, severity: $('#e-s').value, at: isNaN(at) ? new Date().toISOString() : at.toISOString(), title,
      description: $('#e-d').value.trim() || null, norm: ($('#e-n') && $('#e-n').value.trim()) || null, jobs: [...jobs], stopped: $('#e-stop').checked,
      task_id: t ? t.id : null, site_id: s ? s.id : null, site_name: s ? s.name : (siteName || null),
      contractor_id: ($('#e-c') && $('#e-c').value) || (isContractor() ? me.contractor_id || null : null),
      staff_ids: t ? (t.staff_ids || []) : [], injured: ($('#e-inj') && $('#e-inj').value.trim()) || null, witnesses: $('#e-w').value.trim() || null,
      photos: paths, lat: pos ? pos.lat : null, lng: pos ? pos.lng : null };
    $('#e-ok').disabled = true;
    for (let i = 0; i < photos.length; i++) await IDB.put('blobs', photos[i], paths[i]).catch(() => {});
    const q = await hysOut(); q.push({ t: 'ev', row, blobs: paths }); await hysOutSet(q);
    if (online()) await hysSync();
    const left = (await hysOut()).some(x => x.row && x.row.id === id);
    toast(left ? 'Guardado en el teléfono: se envía al volver la señal' : 'Registrado. Se abrió el caso para investigar.');
    hysAfterEvent(row);
  };
}
function hysAfterEvent(row){
  const c = HYS.cfg || {}, ph = c.hys_phone && typeof waPhone === 'function' ? waPhone(c.hys_phone) : '';
  const txt = `${HYS_EV_KIND[row.kind][0]} ${HYS_EV_KIND[row.kind][1]} · ${row.title}\nGravedad: ${(row.kind === 'accidente' ? HYS_SEV.accidente : HYS_SEV.otro)[row.severity]}\nLugar: ${row.site_name || '—'}${row.stopped ? '\nSe detuvo la tarea.' : ''}${row.lat ? `\nUbicación: https://www.google.com/maps?q=${row.lat.toFixed(6)},${row.lng.toFixed(6)}` : ''}\nInformó: ${me.full_name || me.email}`;
  const m = modal(`<div style="text-align:center"><div style="font-size:44px">✅</div><h2 style="margin:4px 0">Quedó registrado</h2>
    <p>Avisale ahora al supervisor y al responsable de Seguridad e Higiene.</p></div>
    <div class="row" style="gap:8px;flex-wrap:wrap;justify-content:center">
      <a class="btn" style="background:#15803D" target="_blank" rel="noopener noreferrer" href="https://wa.me/${ph && /^\d{6,16}$/.test(ph) ? ph : ''}?text=${encodeURIComponent(txt)}">💬 Avisar por WhatsApp</a>
      ${row.kind === 'accidente' && c.art_phone && hysTelOk(c.art_phone) ? `<a class="btn" style="background:#0E7490" href="tel:${hysTelOk(c.art_phone)}">🏥 Llamar a la ART</a>` : ''}
      <a class="btn sec" href="#/hys/reg/ev" data-close-modal>Ver eventos</a><a class="btn sec" href="#/hys" data-close-modal>Listo</a></div>`);
}

/* ---------- firma: recuadro liviano (imagen chica, sin fondo) ---------- */
function hysSigPad(title){
  return new Promise(res => {
    const m = modal(`<h2 style="margin-top:0">✍️ ${esc(title)}</h2><canvas class="hys-sigc" id="sg-c" width="500" height="160"></canvas>
      <div class="row between" style="margin-top:8px"><button class="btn sec" id="sg-r">Borrar</button><div class="row" style="gap:6px"><button class="btn sec" id="sg-x">Cancelar</button><button class="btn" id="sg-ok">Guardar firma</button></div></div>`);
    const cv = $('#sg-c'), ctx = cv.getContext('2d'); ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#111';
    let on = false, has = false;
    const pt = e => { const b = cv.getBoundingClientRect(); return [(e.clientX - b.left) * cv.width / b.width, (e.clientY - b.top) * cv.height / b.height]; };
    cv.onpointerdown = e => { on = true; has = true; cv.setPointerCapture(e.pointerId); ctx.beginPath(); ctx.moveTo(...pt(e)); };
    cv.onpointermove = e => { if (on){ ctx.lineTo(...pt(e)); ctx.stroke(); } };
    cv.onpointerup = cv.onpointercancel = () => { on = false; };
    $('#sg-r').onclick = () => { ctx.clearRect(0, 0, cv.width, cv.height); has = false; };
    $('#sg-x').onclick = () => { m.close(); res(null); };
    $('#sg-ok').onclick = () => { if (!has) return toast('Firmá en el recuadro.'); const u = cv.toDataURL('image/png'); m.close(); res(u.length < 160000 ? u : null); };
  });
}

/* ---------- charla / permiso / ATS / EPP ---------- */
async function hysRecForm(v, kind, taskId){
  const t = await hysTaskCtx(taskId), sites = await hysSites(), staff = hysStaff().filter(s => s.kind !== 'contratista' || isContractor());
  const [ic, name] = HYS_REC_KIND[kind];
  const jobs = new Set(hysJobsOk(t && t.hys_jobs));
  const people = [];   // {name, staff_id, role, img}
  (kind !== 'epp' && t && t.staff_ids || []).forEach(sid => { const s = staff.find(z => z.id === sid); if (s && !(kind === 'permiso' && s.user_id === me.id)) people.push({ name: s.name, staff_id: s.id, role: kind === 'permiso' ? 'Ejecutor' : 'Asistente', img: null }); });
  if (kind === 'permiso' && !people.some(p => p.role === 'Emisor')) people.unshift({ name: me.full_name || me.email, staff_id: null, role: 'Emisor (responsable)', img: null });
  if (kind === 'charla' && !people.length) people.push({ name: me.full_name || me.email, staff_id: null, role: 'Disertante', img: null });
  const checks = {};   // texto → si/no/na
  let steps = [['', '', ''], ['', '', ''], ['', '', '']];
  let eppItems = [];
  v.innerHTML = `${hysBack(t ? '#/tasks/' + t.id : '#/hys', t ? '← Volver a la tarea' : '← Seguridad e Higiene')}
    <div class="hys-hero"><div class="big">${ic}</div><div><h1>${esc(name)}</h1><p>${t ? 'Tarea: ' + esc(t.title) : 'Se guarda aunque no haya señal.'}</p></div></div>
    <div class="card">
      <label>Trabajos que se van a hacer</label><div id="r-j"></div>
      <label>Lugar / sitio</label><input id="r-site" list="r-sl" maxlength="200" autocomplete="off" value="${esc(t && t.sites && t.sites[0] ? t.sites[0].site_name : '')}"><datalist id="r-sl">${sites.map(s => `<option value="${esc(s.name)}">`).join('')}</datalist>
      <div id="r-body"></div>
      <label>Observaciones</label><textarea id="r-obs" maxlength="2000"></textarea>
    </div>
    <div class="card"><h2 style="margin-top:0">✍️ ${kind === 'permiso' ? 'Firmas del permiso' : kind === 'epp' ? 'Firma del trabajador' : 'Asistentes y firmas'}</h2>
      <div id="r-ppl"></div>
      ${kind !== 'epp' ? `<div class="row" style="gap:6px;margin-top:8px;flex-wrap:wrap">${staff.length ? `<select id="r-ps" style="width:auto;max-width:100%"><option value="">+ Agregar del equipo…</option>${staff.map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select>` : ''}
        <input id="r-pn" maxlength="120" placeholder="O escribí nombre y apellido" style="flex:1;min-width:160px"><button class="btn sec" id="r-pa">Agregar</button></div>` : ''}
    </div>
    <div class="err" id="r-err"></div>
    <div class="row hys-noprint" style="justify-content:flex-end;gap:8px;margin:10px 0 30px"><button class="btn" id="r-ok">Guardar ${esc(name.toLowerCase())}</button></div>`;
  const body = $('#r-body');
  const yn = key => `<div class="hys-yn" data-k="${esc(key)}">${[['si', 'Sí'], ['no', 'No'], ['na', 'N/A']].map(([k, l]) => `<button type="button" data-v="${k}" class="${checks[key] === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const renderBody = () => {
    const J = [...jobs].map(k => HYS_JOBS[k]);
    if (kind === 'charla'){
      const topics = [...new Set(J.flatMap(j => j.talk))];
      body.innerHTML = `<label>Temas tratados</label>${topics.length ? topics.map(x => `<label class="hys-chk"><input type="checkbox" class="r-top" value="${esc(x)}" checked> <span>${esc(x)}</span></label>`).join('') : '<p class="sm muted">Elegí los trabajos y aparecen los temas sugeridos.</p>'}
        <label>Otros temas</label><input id="r-ot" maxlength="300" placeholder="Ej.: pronóstico de tormenta por la tarde">
        <label>Duración (minutos)</label><input id="r-min" type="number" min="1" max="120" value="5" style="width:120px">`;
    } else if (kind === 'permiso'){
      const items = [...new Set([...J.flatMap(j => j.before), ...[...jobs].flatMap(k => (HYS.notes[k] || {}).extra_checks || [])])];
      const epp = [...new Set(J.flatMap(j => j.epp))];
      body.innerHTML = `<label>Descripción del trabajo</label><input id="r-desc" maxlength="300" placeholder="Ej.: cambio de antena a 40 m en torre">
        <div class="row"><div class="grow"><label>Válido hasta (hoy)</label><input type="time" id="r-until" value="${String(Math.min(23, new Date().getHours() + 8)).padStart(2, '0')}:00"></div></div>
        <h3 style="margin:14px 0 4px">Verificaciones</h3>${items.length ? items.map(x => `<div class="hys-row"><span>${esc(x)}</span>${yn(x)}</div>`).join('') : '<p class="sm muted">Elegí los trabajos.</p>'}
        <h3 style="margin:14px 0 4px">EPP verificado</h3>${epp.map(x => `<div class="hys-row"><span>${esc(x)}</span>${yn('EPP: ' + x)}</div>`).join('')}
        <p class="sm muted">Si algo da <b>No</b>, el permiso no se puede emitir: primero hay que corregirlo.</p>`;
    } else if (kind === 'ats'){
      body.innerHTML = `<label>Tarea</label><input id="r-desc" maxlength="300" placeholder="Qué se va a hacer">
        <h3 style="margin:14px 0 4px">Pasos, riesgos y controles</h3>
        <div id="r-steps"></div><button class="btn sec small" id="r-sadd" type="button">+ Agregar paso</button>
        <p class="sm muted">Riesgos frecuentes de los trabajos elegidos: ${esc([...new Set(J.flatMap(j => j.risks))].join(' · ') || '—')}</p>`;
      const rs = () => { $('#r-steps').innerHTML = steps.map((s, i) => `<div class="row" style="gap:6px;margin-bottom:6px;flex-wrap:wrap"><input data-s="${i}-0" maxlength="200" placeholder="${i + 1}. Paso" value="${esc(s[0])}" style="flex:1;min-width:140px"><input data-s="${i}-1" maxlength="200" placeholder="Riesgo" value="${esc(s[1])}" style="flex:1;min-width:140px"><input data-s="${i}-2" maxlength="200" placeholder="Control" value="${esc(s[2])}" style="flex:1;min-width:140px"></div>`).join('');
        $('#r-steps').querySelectorAll('[data-s]').forEach(x => x.oninput = () => { const [i, j] = x.dataset.s.split('-').map(Number); steps[i][j] = x.value; }); };
      rs(); $('#r-sadd').onclick = () => { if (steps.length < 30){ steps.push(['', '', '']); rs(); } };
    } else if (kind === 'epp'){
      if (!eppItems.length) eppItems = [...new Set(J.flatMap(j => j.epp))].map(x => ({ p: x, m: '', c: true, n: 1 }));
      body.innerHTML = `<label>Trabajador</label>${staff.length ? `<select id="r-w"><option value="">— Elegí —</option>${staff.map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}<option value="_">Otra persona…</option></select>` : ''}
        <input id="r-wn" maxlength="120" placeholder="Nombre y apellido" class="${staff.length ? 'hidden' : ''}" style="margin-top:6px">
        <label>DNI / CUIL (opcional)</label><input id="r-dni" maxlength="15" inputmode="numeric" style="width:200px">
        <h3 style="margin:14px 0 4px">Elementos entregados</h3><div id="r-epp"></div><button class="btn sec small" type="button" id="r-eadd">+ Agregar elemento</button>
        <p class="sm muted">Constancia según la Res. SRT 299/11 (registro digital admitido por la Disp. SRT 2/21).</p>`;
      const re = () => { $('#r-epp').innerHTML = eppItems.map((e, i) => `<div class="row" style="gap:6px;margin-bottom:6px;flex-wrap:wrap;align-items:center"><input data-e="${i}-p" maxlength="120" value="${esc(e.p)}" placeholder="Producto" style="flex:2;min-width:150px"><input data-e="${i}-m" maxlength="120" value="${esc(e.m)}" placeholder="Marca / modelo" style="flex:1;min-width:110px"><input data-e="${i}-n" type="number" min="1" max="99" value="${Number(e.n) || 1}" style="width:64px"><label class="hys-tg" style="margin:0"><input type="checkbox" data-e="${i}-c" ${e.c ? 'checked' : ''}> Certificado</label><button class="btn sec small" data-erm="${i}" type="button">✕</button></div>`).join('');
        $('#r-epp').querySelectorAll('[data-e]').forEach(x => x.oninput = x.onchange = () => { const [i, k] = x.dataset.e.split('-'); eppItems[i][k] = k === 'c' ? x.checked : k === 'n' ? Number(x.value) : x.value; });
        $('#r-epp').querySelectorAll('[data-erm]').forEach(b => b.onclick = () => { eppItems.splice(Number(b.dataset.erm), 1); re(); }); };
      re(); $('#r-eadd').onclick = () => { if (eppItems.length < 30){ eppItems.push({ p: '', m: '', c: true, n: 1 }); re(); } };
      if ($('#r-w')) $('#r-w').onchange = () => { const val = $('#r-w').value; $('#r-wn').classList.toggle('hidden', val !== '_');
        const s = staff.find(z => z.id === val); people.length = 0; if (s || val === '_') people.push({ name: s ? s.name : '', staff_id: s ? s.id : null, role: 'Trabajador', img: null }); renderPpl(); };
      if (!staff.length && !people.length){ people.push({ name: '', staff_id: null, role: 'Trabajador', img: null }); }
    }
    body.querySelectorAll('.hys-yn').forEach(g => g.querySelectorAll('button').forEach(b => b.onclick = () => { checks[g.dataset.k] = b.dataset.v; g.querySelectorAll('button').forEach(z => z.classList.toggle('on', z === b)); }));
  };
  const renderJobs = () => { $('#r-j').innerHTML = Object.entries(HYS_JOBS).map(([k, j]) => `<label class="hys-tg ${jobs.has(k) ? 'on' : ''}"><input type="checkbox" value="${k}" ${jobs.has(k) ? 'checked' : ''}> ${j.ic} ${esc(j.name)}</label>`).join('');
    $('#r-j').querySelectorAll('input').forEach(c => c.onchange = () => { c.checked ? jobs.add(c.value) : jobs.delete(c.value); c.parentElement.classList.toggle('on', c.checked); if (kind === 'epp') eppItems = []; renderBody(); }); };
  const renderPpl = () => {
    $('#r-ppl').innerHTML = people.length ? people.map((p, i) => `<div class="hys-row"><span><b>${esc(p.name || (kind === 'epp' ? '(escribí el nombre arriba)' : ''))}</b> <span class="sm muted">${esc(p.role)}</span></span>
      <span class="row" style="gap:6px">${p.img ? `<img src="${esc(p.img)}" alt="firma" style="height:34px;border:1px solid var(--line);border-radius:6px;background:#fff">` : ''}<button class="btn small ${p.img ? 'sec' : ''}" data-sg="${i}" type="button">${p.img ? 'Volver a firmar' : '✍️ Firmar'}</button>${kind === 'epp' || (kind === 'permiso' && i === 0) ? '' : `<button class="btn sec small" data-prm="${i}" type="button">✕</button>`}</span></div>`).join('') : '<p class="sm muted">Todavía no hay personas.</p>';
    $('#r-ppl').querySelectorAll('[data-sg]').forEach(b => b.onclick = async () => { const p = people[Number(b.dataset.sg)];
      if (kind === 'epp' && $('#r-wn') && !$('#r-wn').classList.contains('hidden')) p.name = $('#r-wn').value.trim();
      if (!p.name) return toast('Falta el nombre.'); const img = await hysSigPad('Firma de ' + p.name); if (img){ p.img = img; renderPpl(); } });
    $('#r-ppl').querySelectorAll('[data-prm]').forEach(b => b.onclick = () => { people.splice(Number(b.dataset.prm), 1); renderPpl(); });
  };
  renderJobs(); renderBody(); renderPpl();
  $('#r-pa') && ($('#r-pa').onclick = () => {
    const sid = $('#r-ps') ? $('#r-ps').value : '', s = staff.find(z => z.id === sid), nm = s ? s.name : $('#r-pn').value.trim();
    if (!nm) return toast('Elegí o escribí la persona.'); if (people.length >= 40) return toast('Máximo 40 personas.');
    if (people.some(p => p.name.toLowerCase() === nm.toLowerCase())) return toast('Ya está en la lista.');
    people.push({ name: nm.slice(0, 120), staff_id: s ? s.id : null, role: kind === 'permiso' ? 'Ejecutor' : 'Asistente', img: null });
    if ($('#r-ps')) $('#r-ps').value = ''; $('#r-pn').value = ''; renderPpl(); });
  $('#r-ok').onclick = async () => {
    const err = $('#r-err'); err.textContent = '';
    if (!jobs.size && kind !== 'epp') return (err.textContent = 'Elegí al menos un trabajo.');
    const data = { obs: $('#r-obs').value.trim().slice(0, 2000) || null };
    if (kind === 'charla'){ data.topics = [...v.querySelectorAll('.r-top:checked')].map(x => x.value); const ot = $('#r-ot').value.trim(); if (ot) data.topics.push(ot.slice(0, 300));
      data.minutes = Math.max(1, Math.min(120, Number($('#r-min').value) || 5)); if (!data.topics.length) return (err.textContent = 'Indicá al menos un tema.'); }
    if (kind === 'permiso'){
      const keys = [...v.querySelectorAll('.hys-yn')].map(g => g.dataset.k);
      const missing = keys.filter(k => !checks[k]); if (missing.length) return (err.textContent = `Faltan ${missing.length} verificaciones por responder.`);
      const bad = keys.filter(k => checks[k] === 'no'); if (bad.length) return (err.textContent = `No se puede emitir el permiso: ${bad.length} punto${bad.length === 1 ? '' : 's'} en "No". Corregilo y volvé a verificar.`);
      data.desc = $('#r-desc').value.trim().slice(0, 300) || null; data.until = /^\d{2}:\d{2}$/.test($('#r-until').value) ? $('#r-until').value : null;
      data.checks = keys.map(k => ({ t: k.slice(0, 200), v: checks[k] }));
      if (!people.some(p => /Emisor/.test(p.role) && p.img) || !people.some(p => p.role === 'Ejecutor' && p.img)) return (err.textContent = 'El permiso necesita la firma del emisor y de al menos un ejecutor.');
    }
    if (kind === 'ats'){ data.desc = $('#r-desc').value.trim().slice(0, 300) || null; data.steps = steps.filter(s => s.some(x => x.trim())).map(s => s.map(x => x.trim().slice(0, 200)));
      if (!data.steps.length) return (err.textContent = 'Cargá al menos un paso con su riesgo y control.'); }
    if (kind === 'epp'){
      if ($('#r-wn') && !$('#r-wn').classList.contains('hidden') && people[0]) people[0].name = $('#r-wn').value.trim();
      data.items = eppItems.filter(e => String(e.p).trim()).map(e => ({ p: String(e.p).trim().slice(0, 120), m: String(e.m || '').trim().slice(0, 120), n: Math.max(1, Math.min(99, Number(e.n) || 1)), c: !!e.c }));
      data.dni = ($('#r-dni').value || '').replace(/[^\d-]/g, '').slice(0, 15) || null;
      if (!data.items.length) return (err.textContent = 'Agregá al menos un elemento.');
      if (!people[0] || !people[0].name || !people[0].img) return (err.textContent = 'Falta el nombre y la firma del trabajador.');
    }
    const signed = people.filter(p => p.img);
    if (kind === 'charla' && signed.length < 1) return (err.textContent = 'Que firme al menos una persona.');
    if (people.some(p => !p.img) && !confirm(`${people.filter(p => !p.img).length} persona(s) no firmaron y no van a figurar. ¿Guardar igual?`)) return;
    data.signatures = signed.map(p => ({ name: p.name.slice(0, 120), role: p.role, staff_id: p.staff_id || null, img: p.img }));
    const siteName = $('#r-site').value.trim(), s = sites.find(x => x.name.toLowerCase() === siteName.toLowerCase());
    const pos = (typeof geoNow === 'function' && geoNow()) || await getPos();
    const row = { id: uid(), org_id: me.org_id, kind, jobs: [...jobs], task_id: t ? t.id : null, site_id: s ? s.id : null, site_name: s ? s.name : (siteName || null),
      contractor_id: t ? t.contractor_id || null : (isContractor() ? me.contractor_id || null : null),
      staff_ids: [...new Set(signed.map(p => p.staff_id).filter(Boolean))], data, lat: pos ? pos.lat : null, lng: pos ? pos.lng : null,
      created_at: new Date().toISOString(), status: 'abierto', created_by_name: me.full_name || me.email };
    $('#r-ok').disabled = true;
    const q = await hysOut(); q.push({ t: 'rec', row }); await hysOutSet(q);
    if (online()) await hysSync();
    const left = (await hysOut()).some(x => x.row && x.row.id === row.id);
    toast(left ? 'Guardado en el teléfono: se envía al volver la señal' : name + ' registrada');
    if (t){ try { await hysUncache('hys-rt:' + t.id); } catch {} location.hash = '#/tasks/' + t.id; }
    else location.hash = left ? '#/hys/reg' : '#/hys/r/' + row.id;
  };
}

/* ---------- listados ---------- */
async function hysRegs(v, tab){
  const ev = tab === 'ev';
  const out = await hysOut();
  let rows = [];
  try { rows = ev ? await cached('hys-evs', () => sb.from('hys_events').select('id,kind,severity,at,title,site_name,status,stopped,case_id,created_by_name,art_reported_at').order('at', { ascending: false }).limit(300))
                  : await cached('hys-recs', () => sb.from('hys_records').select('id,kind,jobs,site_name,status,created_at,created_by_name,task_id').order('created_at', { ascending: false }).limit(300)); } catch {}
  const pend = out.filter(x => x.t === (ev ? 'ev' : 'rec'));
  const stP = s => `<span class="hys-pill ${s === 'abierto' ? 'a' : s === 'en_curso' ? 'b' : s === 'anulado' ? 'n' : 'g'}">${esc({ abierto: 'Abierto', en_curso: 'En curso', cerrado: 'Cerrado', anulado: 'Anulado' }[s] || s)}</span>`;
  v.innerHTML = `${hysBack()}
    <div class="hys-tabs"><a href="#/hys/reg" class="${ev ? '' : 'on'}">📋 Charlas, permisos, ATS y EPP</a><a href="#/hys/reg/ev" class="${ev ? 'on' : ''}">🚑 Accidentes, incidentes y desvíos</a></div>
    ${pend.length ? `<div class="card" style="border-left:5px solid #D97706"><h3 style="margin-top:0">⏳ Esperando señal (${pend.length})</h3>${pend.map((x, i) => `<div class="hys-row"><span>${ev ? HYS_EV_KIND[x.row.kind][0] + ' ' + esc(x.row.title) : HYS_REC_KIND[x.row.kind][0] + ' ' + esc(HYS_REC_KIND[x.row.kind][1])} · ${esc(fmtDT(x.row.created_at || x.row.at))}${x.err ? `<div class="err sm">${esc(x.err)}</div>` : ''}</span>${x.err ? `<button class="btn sec small" data-drop="${esc(x.row.id)}">Descartar</button>` : ''}</div>`).join('')}
      <button class="btn small" id="g-sync" style="margin-top:8px">Enviar ahora</button></div>` : ''}
    <div class="card">${rows.length ? `<table class="hys-tbl"><tr><th>Fecha</th><th>${ev ? 'Evento' : 'Registro'}</th><th class="hide-sm">Lugar</th><th>Estado</th></tr>
      ${rows.map(r => ev ? `<tr style="cursor:pointer" data-go="#/hys/ev/${esc(r.id)}"><td>${esc(fmtDT(r.at))}</td><td>${HYS_EV_KIND[r.kind] ? HYS_EV_KIND[r.kind][0] : ''} <b>${esc(r.title)}</b><div class="sm muted">${esc((r.kind === 'accidente' ? HYS_SEV.accidente : HYS_SEV.otro)[r.severity] || '')}${r.stopped ? ' · tarea detenida' : ''} · ${esc(r.created_by_name || '')}</div></td><td class="hide-sm">${esc(r.site_name || '—')}</td><td>${stP(r.status)}</td></tr>`
        : `<tr style="cursor:pointer" data-go="#/hys/r/${esc(r.id)}"><td>${esc(fmtDT(r.created_at))}</td><td>${HYS_REC_KIND[r.kind] ? HYS_REC_KIND[r.kind][0] + ' ' + esc(HYS_REC_KIND[r.kind][1]) : ''}<div class="sm muted">${esc(hysJobsOk(r.jobs).map(k => HYS_JOBS[k].name).join(', '))} · ${esc(r.created_by_name || '')}</div></td><td class="hide-sm">${esc(r.site_name || '—')}</td><td>${stP(r.status)}</td></tr>`).join('')}</table>`
      : `<p class="muted">${online() ? 'Todavía no hay registros.' : 'Sin conexión: se muestran los guardados en el teléfono.'}</p>`}</div>`;
  $('#g-sync') && ($('#g-sync').onclick = async () => { if (!needOnline()) return; await hysSync(); route(); });
  v.querySelectorAll('[data-drop]').forEach(b => b.onclick = async () => { if (!confirm('¿Descartar este registro? No se va a enviar.')) return; await hysOutSet((await hysOut()).filter(x => !x.row || x.row.id !== b.dataset.drop)); route(); });
}

async function hysRecView(v, id){
  let r = (await hysOut()).map(x => x.row).find(x => x && x.id === id);
  const local = !!r;
  if (!r){ const q = await sb.from('hys_records').select('*').eq('id', id).maybeSingle(); if (q.error) throw q.error; r = q.data; }
  if (!r){ v.innerHTML = `${hysBack('#/hys/reg', '← Registros')}<div class="card">No encontré el registro.</div>`; return; }
  const d = r.data || {}, [ic, name] = HYS_REC_KIND[r.kind] || ['📄', r.kind];
  const canClose = !local && r.status === 'abierto' && (hysIsMgr() || r.created_by === me.id) && canWrite();
  const ynT = { si: '✔ Sí', no: '✘ No', na: 'N/A' };
  v.innerHTML = `${hysBack('#/hys/reg', '← Registros')}
    <div class="row hys-noprint" style="gap:8px;flex-wrap:wrap;margin-bottom:10px"><button class="btn" id="v-pr">🖨 Imprimir / PDF</button>
      ${canClose && r.kind === 'permiso' ? '<button class="btn sec" id="v-cl">✅ Cerrar permiso (trabajo terminado)</button>' : ''}${canClose ? '<button class="btn danger" id="v-an">Anular</button>' : ''}</div>
    <div class="card hys-print">
      <div class="row between" style="flex-wrap:wrap;gap:8px"><div><div class="sm muted">${esc(org && org.name || '')}</div><h1 style="margin:2px 0">${ic} ${esc(name)}</h1></div>
        <div style="text-align:right">${local ? '<span class="hys-pill a">Esperando señal</span>' : `<span class="hys-pill ${r.status === 'abierto' ? 'a' : r.status === 'anulado' ? 'n' : 'g'}">${esc(r.status)}</span>`}<div class="sm muted">${esc(fmtDT(r.created_at))}</div></div></div>
      ${r.status === 'anulado' ? `<div class="banner off" style="margin:10px 0"><span class="dot"></span><div><b>Anulado</b><div>${esc(r.status_note || '')}</div></div></div>` : ''}
      <table class="hys-tbl" style="margin-top:8px"><tr><th style="width:160px">Lugar</th><td>${esc(r.site_name || '—')}</td></tr>
        <tr><th>Trabajos</th><td>${esc(hysJobsOk(r.jobs).map(k => HYS_JOBS[k].name).join(', ') || '—')}</td></tr>
        <tr><th>Registró</th><td>${esc(r.created_by_name || '')}</td></tr>
        ${d.desc ? `<tr><th>Trabajo</th><td>${esc(d.desc)}</td></tr>` : ''}${d.until ? `<tr><th>Válido hasta</th><td>${esc(d.until)} h del ${esc(fmtDate(r.created_at))}</td></tr>` : ''}
        ${d.minutes ? `<tr><th>Duración</th><td>${Number(d.minutes)} min</td></tr>` : ''}${d.dni ? `<tr><th>DNI / CUIL</th><td>${esc(d.dni)}</td></tr>` : ''}
        ${r.lat ? `<tr><th>Ubicación</th><td>${Number(r.lat).toFixed(5)}, ${Number(r.lng).toFixed(5)}</td></tr>` : ''}
        ${r.closed_at ? `<tr><th>${r.status === 'anulado' ? 'Anulado' : 'Cerrado'}</th><td>${esc(fmtDT(r.closed_at))}</td></tr>` : ''}</table>
      ${(d.topics || []).length ? `<h3>Temas tratados</h3><ul>${d.topics.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      ${(d.checks || []).length ? `<h3>Verificaciones</h3><table class="hys-tbl">${d.checks.map(c => `<tr><td>${esc(c.t)}</td><td style="width:70px">${esc(ynT[c.v] || c.v)}</td></tr>`).join('')}</table>` : ''}
      ${(d.steps || []).length ? `<h3>Pasos, riesgos y controles</h3><table class="hys-tbl"><tr><th>Paso</th><th>Riesgo</th><th>Control</th></tr>${d.steps.map(s => `<tr><td>${esc(s[0])}</td><td>${esc(s[1])}</td><td>${esc(s[2])}</td></tr>`).join('')}</table>` : ''}
      ${(d.items || []).length ? `<h3>Elementos entregados</h3><table class="hys-tbl"><tr><th>Producto</th><th>Marca / modelo</th><th>Cant.</th><th>Certificado</th></tr>${d.items.map(e => `<tr><td>${esc(e.p)}</td><td>${esc(e.m)}</td><td>${Number(e.n) || 1}</td><td>${e.c ? 'Sí' : 'No'}</td></tr>`).join('')}</table>` : ''}
      ${d.obs ? `<h3>Observaciones</h3><p style="white-space:pre-wrap">${esc(d.obs)}</p>` : ''}
      <h3>Firmas</h3><div class="hys-sigs">${(d.signatures || []).map(s => `<div>${/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(s.img || '') ? `<img src="${s.img}" alt="firma">` : ''}<br><b>${esc(s.name)}</b><br>${esc(s.role || '')}</div>`).join('') || '<span class="muted">Sin firmas</span>'}</div>
    </div>`;
  $('#v-pr').onclick = () => window.print();
  $('#v-cl') && ($('#v-cl').onclick = async () => { if (!needOnline() || !confirm('¿Cerrar el permiso? Confirmás que el trabajo terminó y la zona quedó segura.')) return;
    const { error } = await sb.from('hys_records').update({ status: 'cerrado' }).eq('id', id); if (error) return toast(errText(error)); toast('Permiso cerrado'); route(); });
  $('#v-an') && ($('#v-an').onclick = async () => { if (!needOnline()) return; const why = (prompt('Motivo de la anulación:') || '').trim(); if (!why) return;
    const { error } = await sb.from('hys_records').update({ status: 'anulado', status_note: why.slice(0, 500) }).eq('id', id); if (error) return toast(errText(error)); toast('Registro anulado'); route(); });
}

async function hysEvView(v, id){
  const q = await sb.from('hys_events').select('*').eq('id', id).maybeSingle(); if (q.error) throw q.error;
  const e = q.data; if (!e){ v.innerHTML = `${hysBack('#/hys/reg/ev', '← Eventos')}<div class="card">No encontré el evento (o no tenés acceso).</div>`; return; }
  const mgr = hysIsMgr() && canWrite();
  const sev = (e.kind === 'accidente' ? HYS_SEV.accidente : HYS_SEV.otro)[e.severity] || e.severity;
  v.innerHTML = `${hysBack('#/hys/reg/ev', '← Eventos')}
    <div class="row hys-noprint" style="gap:8px;flex-wrap:wrap;margin-bottom:10px"><button class="btn sec" id="ev-pr">🖨 Imprimir / PDF</button>${e.case_id && typeof can === 'function' && hysIsMgr() ? `<a class="btn" href="#/control/mejora/${esc(e.case_id)}">🔧 Abrir el caso (5 porqués y acciones)</a>` : ''}</div>
    <div class="card hys-print">
      <div class="row between" style="flex-wrap:wrap;gap:8px"><div><div class="sm muted">${esc(org && org.name || '')}</div><h1 style="margin:2px 0">${HYS_EV_KIND[e.kind][0]} ${esc(e.title)}</h1><div class="muted">${esc(HYS_EV_KIND[e.kind][1])} · Gravedad <b>${esc(sev)}</b></div></div>
        <div style="text-align:right"><span class="hys-pill ${e.status === 'cerrado' ? 'g' : e.status === 'en_curso' ? 'b' : 'a'}">${esc({ abierto: 'Abierto', en_curso: 'En curso', cerrado: 'Cerrado' }[e.status])}</span><div class="sm muted">${esc(fmtDT(e.at))}</div></div></div>
      <table class="hys-tbl" style="margin-top:8px">
        <tr><th style="width:170px">Lugar</th><td>${esc(e.site_name || '—')}${e.lat ? ` · <a target="_blank" rel="noopener noreferrer" href="https://www.google.com/maps?q=${Number(e.lat)},${Number(e.lng)}">ver en el mapa</a>` : ''}</td></tr>
        <tr><th>Trabajos</th><td>${esc(hysJobsOk(e.jobs).map(k => HYS_JOBS[k].name).join(', ') || '—')}</td></tr>
        ${e.norm ? `<tr><th>Regla incumplida</th><td>${esc(e.norm)}</td></tr>` : ''}
        ${e.injured ? `<tr><th>Lesionado</th><td>${esc(e.injured)}</td></tr>` : ''}${e.witnesses ? `<tr><th>Testigos</th><td>${esc(e.witnesses)}</td></tr>` : ''}
        <tr><th>Se detuvo la tarea</th><td>${e.stopped ? 'Sí' : 'No'}</td></tr><tr><th>Informó</th><td>${esc(e.created_by_name || '')} · ${esc(fmtDT(e.created_at))}</td></tr>
        ${e.kind === 'accidente' ? `<tr><th>Denuncia a la ART</th><td>${e.art_reported_at ? esc(fmtDT(e.art_reported_at)) + (e.art_case ? ' · Siniestro ' + esc(e.art_case) : '') : '<span class="hys-pill r">Sin registrar</span>'}</td></tr>` : ''}</table>
      ${e.description ? `<h3>Descripción</h3><p style="white-space:pre-wrap">${esc(e.description)}</p>` : ''}
      <div id="ev-ph" class="row" style="gap:8px;flex-wrap:wrap"></div></div>
    ${mgr ? `<div class="card hys-noprint"><h2 style="margin-top:0">Seguimiento</h2>
      <div class="row"><div class="grow"><label>Estado</label><select id="ev-st">${[['abierto', 'Abierto'], ['en_curso', 'En curso'], ['cerrado', 'Cerrado']].map(([k, l]) => `<option value="${k}" ${e.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        ${e.kind === 'accidente' ? `<div class="grow"><label>Denunciado a la ART</label><input type="datetime-local" id="ev-art"></div><div class="grow"><label>N° de siniestro</label><input id="ev-ac" maxlength="80" value="${esc(e.art_case || '')}"></div>` : ''}</div>
      ${e.kind === 'accidente' && !e.art_reported_at ? `<p class="sm" style="color:#B91C1C">La denuncia a la ART es inmediata y el formulario se completa dentro de las 48 h (Res. SRT 525/15).</p>` : ''}
      <div class="err" id="ev-err"></div><div class="row" style="justify-content:flex-end"><button class="btn" id="ev-ok">Guardar seguimiento</button></div></div>` : ''}`;
  if (e.art_reported_at && $('#ev-art')){ const d = new Date(e.art_reported_at); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); $('#ev-art').value = d.toISOString().slice(0, 16); }
  $('#ev-pr').onclick = () => window.print();
  if ((e.photos || []).length){ photoURLs(e.photos).then(us => { const box = $('#ev-ph'); if (!box) return;
    box.innerHTML = us.map(u => u ? `<img src="${esc(u)}" alt="foto" style="height:120px;border-radius:8px;cursor:pointer" data-ph="1">` : '').join('');
    box.querySelectorAll('[data-ph]').forEach(i => i.onclick = () => photoViewer(i.src)); }).catch(() => {}); }
  $('#ev-ok') && ($('#ev-ok').onclick = async () => {
    if (!needOnline()) return;
    const up = { status: $('#ev-st').value };
    if ($('#ev-art')){ up.art_reported_at = $('#ev-art').value ? new Date($('#ev-art').value).toISOString() : null; up.art_case = $('#ev-ac').value.trim() || null; }
    const { error } = await sb.from('hys_events').update(up).eq('id', id); if (error) return ($('#ev-err').textContent = errText(error));
    toast('Seguimiento guardado'); route();
  });
}

/* ---------- vencimientos ---------- */
async function hysDues(v){
  const mgr = hysIsMgr() && canWrite();
  let dues = [], tools = [];
  try { dues = await cached('hys-dues', () => sb.from('hys_dues').select('*').order('due_date').limit(1000)); } catch {}
  if (typeof can === 'function' && can('stock') && !isContractor()) try { tools = await cached('hys-tools', () => sb.from('assets').select('id,code,name,type,service_due').not('service_due', 'is', null).lte('service_due', addDays(todayStr(), 60)).order('service_due').limit(300)); } catch {}
  const staff = hysStaff(), contrs = await hysContrs();
  const who = d => d.staff_id ? (staff.find(s => s.id === d.staff_id) || {}).name || 'Persona' : d.contractor_id ? (contrs.find(c => c.id === d.contractor_id) || {}).name || 'Contratista' : d.place || 'Empresa';
  const light = d => { if (d.done_date) return ['n', 'Hecho']; const n = daysLeft(d.due_date + 'T23:59'); return n < 0 ? ['r', `Vencido hace ${-n} d`] : n <= 30 ? ['a', `Vence en ${n} d`] : ['g', `Vence en ${n} d`]; };
  const open = dues.filter(d => !d.done_date);
  const cnt = k => open.filter(d => light(d)[0] === k).length;
  v.innerHTML = `${hysBack()}
    <div class="hys-hero" style="background:linear-gradient(135deg,#92400E,#D97706)"><div class="big">📅</div><div style="flex:1"><h1>Vencimientos</h1><p>Capacitaciones, exámenes médicos, EPP, extintores, calibraciones, seguros y habilitaciones.</p></div>${mgr ? '<button class="btn sec small" id="d-new" style="background:#fff">+ Nuevo</button>' : ''}</div>
    <div class="stats" style="margin-bottom:12px"><div class="stat"><span>🔴 Vencidos</span><b>${cnt('r')}</b></div><div class="stat"><span>🟡 Próximos 30 días</span><b>${cnt('a')}</b></div><div class="stat"><span>🟢 Al día</span><b>${cnt('g')}</b></div></div>
    <div class="card">${dues.length ? `<table class="hys-tbl"><tr><th>Qué</th><th>Quién / dónde</th><th>Vence</th><th></th></tr>${dues.map(d => { const [c, l] = light(d); return `<tr><td>${(HYS_DUE_KIND[d.kind] || HYS_DUE_KIND.otro)[0]} <b>${esc(d.title)}</b><div class="sm muted">${esc((HYS_DUE_KIND[d.kind] || HYS_DUE_KIND.otro)[1])}${d.notes ? ' · ' + esc(d.notes) : ''}</div></td><td>${esc(who(d))}</td><td>${esc(fmtDate(d.due_date + 'T12:00'))}<br><span class="hys-pill ${c}">${esc(l)}</span></td><td>${mgr ? `<button class="btn sec small" data-de="${esc(d.id)}">Editar</button>` : ''}</td></tr>`; }).join('')}</table>` : '<p class="muted">No hay vencimientos cargados.</p>'}</div>
    ${tools.length ? `<div class="card"><h2 style="margin-top:0">🧰 Calibración / service de herramientas y equipos (60 días)</h2><table class="hys-tbl">${tools.map(a => { const n = daysLeft(a.service_due + 'T23:59'); return `<tr style="cursor:pointer" data-go="#/stock/a/${esc(a.id)}"><td><b>${esc(a.name || a.type)}</b><div class="sm muted">${esc(a.code)}</div></td><td>${esc(fmtDate(a.service_due + 'T12:00'))} <span class="hys-pill ${n < 0 ? 'r' : 'a'}">${n < 0 ? 'Vencida' : 'En ' + n + ' d'}</span></td></tr>`; }).join('')}</table></div>` : ''}`;
  const edit = d => {
    d = d || { kind: 'capacitacion', due_date: addDays(todayStr(), 30) };
    const m = modal(`<h2 style="margin-top:0">${d.id ? 'Editar' : 'Nuevo'} vencimiento</h2>
      <div class="row"><div class="grow"><label>Tipo</label><select id="dv-k">${Object.entries(HYS_DUE_KIND).map(([k, x]) => `<option value="${k}" ${d.kind === k ? 'selected' : ''}>${x[0]} ${x[1]}</option>`).join('')}</select></div><div class="grow"><label>Vence</label><input type="date" id="dv-d" value="${esc(d.due_date || '')}"></div></div>
      <label>Descripción</label><input id="dv-t" maxlength="200" value="${esc(d.title || '')}" placeholder="Ej.: Curso de trabajo en altura / Extintor ABC 5 kg camioneta AB123CD">
      <div class="row"><div class="grow"><label>Persona</label><select id="dv-s"><option value="">—</option>${staff.map(s => `<option value="${esc(s.id)}" ${d.staff_id === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
        <div class="grow"><label>Contratista</label><select id="dv-c"><option value="">—</option>${contrs.map(c => `<option value="${esc(c.id)}" ${d.contractor_id === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div></div>
      <label>Lugar / equipo</label><input id="dv-p" maxlength="200" value="${esc(d.place || '')}">
      <label>Notas</label><input id="dv-n" maxlength="500" value="${esc(d.notes || '')}">
      ${d.id ? `<label>Hecho / renovado el</label><input type="date" id="dv-dn" value="${esc(d.done_date || '')}">` : ''}
      <div class="err" id="dv-err"></div>
      <div class="row between" style="margin-top:10px">${d.id ? '<button class="btn danger" id="dv-del">Borrar</button>' : '<span></span>'}<div class="row" style="gap:6px"><button class="btn sec" data-close-modal>Cancelar</button><button class="btn" id="dv-ok">Guardar</button></div></div>`);
    $('#dv-ok').onclick = async () => {
      if (!needOnline()) return;
      const row = { kind: $('#dv-k').value, due_date: $('#dv-d').value, title: $('#dv-t').value.trim(), staff_id: $('#dv-s').value || null, contractor_id: $('#dv-c').value || null,
        place: $('#dv-p').value.trim() || null, notes: $('#dv-n').value.trim() || null, ...(d.id ? { done_date: $('#dv-dn').value || null } : {}) };
      if (!row.title || !row.due_date) return ($('#dv-err').textContent = 'Completá la descripción y la fecha.');
      const r = d.id ? await sb.from('hys_dues').update(row).eq('id', d.id) : await sb.from('hys_dues').insert({ ...row, org_id: me.org_id });
      if (r.error) return ($('#dv-err').textContent = errText(r.error));
      m.close(); try { await hysUncache('hys-dues'); } catch {} toast('Guardado'); route();
    };
    $('#dv-del') && ($('#dv-del').onclick = async () => { if (!needOnline() || !confirm('¿Borrar este vencimiento?')) return; const r = await sb.from('hys_dues').delete().eq('id', d.id); if (r.error) return toast(errText(r.error)); m.close(); try { await hysUncache('hys-dues'); } catch {} route(); });
  };
  $('#d-new') && ($('#d-new').onclick = () => { if (needOnline()) edit(); });
  v.querySelectorAll('[data-de]').forEach(b => b.onclick = () => edit(dues.find(d => d.id === b.dataset.de)));
}

/* ---------- configuración (administrador) ---------- */
async function hysCfg(v){
  if (!needOnline()){ v.innerHTML = `${hysBack()}<div class="card">La configuración necesita conexión.</div>`; return; }
  await hysBase(true);
  const c = JSON.parse(JSON.stringify(HYS.cfg || {}));
  c.provinces = c.provinces && c.provinces.length ? c.provinces : ['sf', 'ba', 'cba', 'sl'];
  c.gate = { ...HYS_GATE_DEF, ...(c.gate || {}) }; c.custom_norms = c.custom_norms || [];
  const f = (k, l, ph = '', type = 'text', max = 120) => `<div class="grow"><label>${l}</label><input id="cf-${k}" type="${type}" maxlength="${max}" value="${esc(c[k] || '')}" placeholder="${esc(ph)}"></div>`;
  const draw = () => {
    v.innerHTML = `${hysBack()}
      <div class="hys-hero" style="background:linear-gradient(135deg,#334155,#475569)"><div class="big">⚙️</div><div><h1>Configuración de Seguridad e Higiene</h1><p>Lo que cargues acá lo ve todo el equipo, también sin señal.</p></div></div>
      <div class="card"><h2 style="margin-top:0">🏥 ART</h2><div class="row" style="flex-wrap:wrap">${f('art_name', 'Nombre de la ART')}${f('art_phone', 'Teléfono de emergencias de la ART', '0800-…', 'tel', 30)}</div>
        <div class="row" style="flex-wrap:wrap">${f('art_policy', 'N° de contrato / póliza')}${f('art_web', 'Web de la ART', 'https://…', 'url', 120)}</div></div>
      <div class="card"><h2 style="margin-top:0">🦺 Responsable de Higiene y Seguridad</h2><div class="row" style="flex-wrap:wrap">${f('hys_name', 'Nombre y matrícula')}${f('hys_phone', 'Teléfono / WhatsApp', '', 'tel', 30)}${f('hys_email', 'Mail', '', 'email')}</div>
        <div class="row" style="flex-wrap:wrap">${f('reviewed_by', 'Contenido revisado por (profesional HyS)', 'Nombre y matrícula')}</div>
        <p class="sm muted" style="margin:4px 0 0">${c.reviewed_at ? 'Última revisión: ' + esc(fmtDate(c.reviewed_at + 'T12:00')) + '. ' : ''}Al guardar con este dato, queda registrada la fecha de revisión y se quita el aviso de "contenido sin validar".</p>
        <label>Notas generales para todos</label><textarea id="cf-notes" maxlength="1000">${esc(c.notes || '')}</textarea></div>
      <div class="card"><h2 style="margin-top:0">🚦 Qué se exige antes de empezar cada trabajo</h2><p class="sm muted" style="margin-top:-4px">Si una tarea tiene marcado un trabajo de riesgo, la app no deja iniciarla hasta hacer esto en el día.</p>
        ${Object.entries(HYS_JOBS).map(([k, j]) => `<div class="hys-row"><span>${j.ic} ${esc(j.name)}</span><select data-g="${k}" style="width:auto">${Object.entries(HYS_GATE_TXT).map(([g, l]) => `<option value="${g}" ${c.gate[k] === g ? 'selected' : ''}>${l}</option>`).join('')}</select></div>`).join('')}</div>
      <div class="card"><h2 style="margin-top:0">📍 Provincias donde trabajan</h2>
        <div>${Object.entries(HYS_ALL_PROV).map(([k, n]) => `<label class="hys-tg ${c.provinces.includes(k) ? 'on' : ''}"><input type="checkbox" data-pv="${k}" ${c.provinces.includes(k) ? 'checked' : ''}> ${esc(n)}${HYS_PROV[k] ? ' ✔' : ''}</label>`).join('')}</div>
        <p class="sm muted">✔ = la app ya trae normas de esa provincia. Para las demás, agregalas abajo.</p>
        <h3>Normas propias / de otras provincias</h3>
        ${c.custom_norms.map((x, i) => `<div class="hys-row"><span><b>${esc(HYS_ALL_PROV[x.prov] || x.prov)}</b> · ${hysLink(x.url, x.title)}${x.note ? `<div class="sm muted">${esc(x.note)}</div>` : ''}</span><button class="btn sec small" data-nrm="${i}">✕</button></div>`).join('') || '<p class="sm muted">Ninguna.</p>'}
        <div class="row" style="gap:6px;flex-wrap:wrap;margin-top:8px"><select id="cn-p" style="width:auto">${Object.entries(HYS_ALL_PROV).map(([k, n]) => `<option value="${k}">${esc(n)}</option>`).join('')}</select>
          <input id="cn-t" maxlength="200" placeholder="Norma (ej.: Ley 1234 · …)" style="flex:2;min-width:180px"><input id="cn-u" maxlength="400" placeholder="https://… (fuente oficial)" style="flex:2;min-width:180px">
          <input id="cn-n" maxlength="300" placeholder="Para qué sirve (opcional)" style="flex:2;min-width:180px"><button class="btn sec" id="cn-a">Agregar</button></div></div>
      <div class="err" id="cf-err"></div><div class="row" style="justify-content:flex-end;margin-bottom:14px"><button class="btn" id="cf-ok">💾 Guardar configuración</button></div>
      <div class="card"><div class="row between"><h2 style="margin:0">📞 Contactos de emergencia de la empresa</h2><button class="btn small" id="ct-new">+ Agregar</button></div>
        <p class="sm muted">Aparecen en el botón 🆘 de todos. Ej.: supervisor de guardia, médico laboral, bomberos o comisaría de la zona.</p>
        ${(HYS.contacts || []).map(x => `<div class="hys-row"><span>${(HYS_CONTACT_KIND[x.kind] || HYS_CONTACT_KIND.otro)[0]} <b>${esc(x.name)}</b> · ${esc(x.phone)}<div class="sm muted">${esc([(HYS_CONTACT_KIND[x.kind] || HYS_CONTACT_KIND.otro)[1], x.role, x.zone].filter(Boolean).join(' · '))}</div></span><button class="btn sec small" data-ct="${esc(x.id)}">Editar</button></div>`).join('') || '<p class="muted">Todavía no hay contactos.</p>'}</div>
      <div class="card"><h2 style="margin-top:0">🏢 Procedimientos propios por trabajo</h2><p class="sm muted" style="margin-top:-4px">Se suman a la ficha de cada trabajo y al permiso.</p>
        ${Object.entries(HYS_JOBS).map(([k, j]) => `<div class="hys-row"><span>${j.ic} ${esc(j.name)}${HYS.notes[k] ? ` <span class="hys-pill g">${(HYS.notes[k].extra_checks || []).length} verif. extra</span>` : ''}</span><button class="btn sec small" data-jn="${k}">Editar</button></div>`).join('')}</div>`;
    const keep = () => { ['art_name', 'art_phone', 'art_policy', 'art_web', 'hys_name', 'hys_phone', 'hys_email', 'reviewed_by'].forEach(k => { c[k] = $('#cf-' + k).value.trim(); }); c.notes = $('#cf-notes').value.trim();
      v.querySelectorAll('[data-g]').forEach(s => c.gate[s.dataset.g] = s.value); c.provinces = [...v.querySelectorAll('[data-pv]:checked')].map(x => x.dataset.pv); };
    v.querySelectorAll('[data-pv]').forEach(x => x.onchange = () => x.parentElement.classList.toggle('on', x.checked));
    v.querySelectorAll('[data-nrm]').forEach(b => b.onclick = () => { keep(); c.custom_norms.splice(Number(b.dataset.nrm), 1); draw(); });
    $('#cn-a').onclick = () => { const t = $('#cn-t').value.trim(), u = $('#cn-u').value.trim();
      if (!t) return toast('Escribí el nombre de la norma.'); if (u && !HYS_URL.test(u)) return toast('El link tiene que empezar con https://');
      if (c.custom_norms.length >= 100) return toast('Máximo 100 normas.');
      keep(); c.custom_norms.push({ prov: $('#cn-p').value, title: t, url: u || null, note: $('#cn-n').value.trim() || null });
      if (!c.provinces.includes($('#cn-p').value)) c.provinces.push($('#cn-p').value); draw(); toast('Agregada: tocá Guardar configuración'); };
    $('#cf-ok').onclick = async () => {
      keep(); const err = $('#cf-err'); err.textContent = '';
      if (c.art_web && !HYS_URL.test(c.art_web)) return (err.textContent = 'La web de la ART tiene que empezar con https://');
      for (const k of ['art_phone', 'hys_phone']) if (c[k] && !/^[0-9+()\s-]{3,30}$/.test(c[k])) return (err.textContent = 'Revisá el teléfono: solo números, espacios, guiones y +.');
      const p = { ...c }; delete p.reviewed_at; if (!p.reviewed_by) delete p.reviewed_by;
      const { data, error } = await sb.rpc('hys_cfg_set', { p }); if (error) return (err.textContent = errText(error));
      HYS.cfg = data; try { await hysUncache('hys-cfg'); } catch {} HYS.loaded = 0; toast('Configuración guardada'); await hysBase(true); hysCfg(v);
    };
    $('#ct-new').onclick = () => hysContactEdit(null, () => hysCfg(v));
    v.querySelectorAll('[data-ct]').forEach(b => b.onclick = () => hysContactEdit(HYS.contacts.find(x => x.id === b.dataset.ct), () => hysCfg(v)));
    v.querySelectorAll('[data-jn]').forEach(b => b.onclick = () => hysNoteEdit(b.dataset.jn, () => hysCfg(v)));
  };
  draw();
}
function hysContactEdit(x, done){
  x = x || { kind: 'supervisor', sort: (HYS.contacts || []).length };
  const m = modal(`<h2 style="margin-top:0">${x.id ? 'Editar' : 'Nuevo'} contacto</h2>
    <div class="row"><div class="grow"><label>Tipo</label><select id="ce-k">${Object.entries(HYS_CONTACT_KIND).map(([k, y]) => `<option value="${k}" ${x.kind === k ? 'selected' : ''}>${y[0]} ${y[1]}</option>`).join('')}</select></div><div class="grow"><label>Orden</label><input id="ce-o" type="number" min="0" max="999" value="${Number(x.sort) || 0}"></div></div>
    <label>Nombre</label><input id="ce-n" maxlength="120" value="${esc(x.name || '')}" placeholder="Ej.: Supervisor de guardia">
    <label>Teléfono</label><input id="ce-p" type="tel" maxlength="30" value="${esc(x.phone || '')}" placeholder="Ej.: 0341 155 123456">
    <div class="row"><div class="grow"><label>Cargo / detalle</label><input id="ce-r" maxlength="120" value="${esc(x.role || '')}"></div><div class="grow"><label>Zona</label><input id="ce-z" maxlength="120" value="${esc(x.zone || '')}" placeholder="Ej.: Rosario y alrededores"></div></div>
    <div class="err" id="ce-err"></div>
    <div class="row between" style="margin-top:10px">${x.id ? '<button class="btn danger" id="ce-del">Borrar</button>' : '<span></span>'}<div class="row" style="gap:6px"><button class="btn sec" data-close-modal>Cancelar</button><button class="btn" id="ce-ok">Guardar</button></div></div>`);
  const fin = async () => { m.close(); try { await hysUncache('hys-contacts'); } catch {} HYS.loaded = 0; await hysBase(true); done(); };
  $('#ce-ok').onclick = async () => {
    const row = { kind: $('#ce-k').value, name: $('#ce-n').value.trim(), phone: $('#ce-p').value.trim(), role: $('#ce-r').value.trim() || null, zone: $('#ce-z').value.trim() || null, sort: Math.max(0, Math.min(999, Number($('#ce-o').value) || 0)) };
    if (!row.name) return ($('#ce-err').textContent = 'Falta el nombre.');
    if (!/^[0-9+()\s-]{3,30}$/.test(row.phone)) return ($('#ce-err').textContent = 'Teléfono inválido: solo números, espacios, guiones y +.');
    const r = x.id ? await sb.from('hys_contacts').update(row).eq('id', x.id) : await sb.from('hys_contacts').insert({ ...row, org_id: me.org_id });
    if (r.error) return ($('#ce-err').textContent = errText(r.error)); fin();
  };
  $('#ce-del') && ($('#ce-del').onclick = async () => { if (!confirm('¿Borrar el contacto?')) return; const r = await sb.from('hys_contacts').delete().eq('id', x.id); if (r.error) return toast(errText(r.error)); fin(); });
}
function hysNoteEdit(k, done){
  const n = HYS.notes[k] || {}, j = HYS_JOBS[k];
  const m = modal(`<h2 style="margin-top:0">${j.ic} ${esc(j.name)}</h2>
    <label>Procedimiento / indicaciones de la empresa</label><textarea id="jn-n" maxlength="4000" style="min-height:140px">${esc(n.notes || '')}</textarea>
    <label>Verificaciones extra (una por renglón; se suman al permiso)</label><textarea id="jn-c" maxlength="6000" style="min-height:100px">${esc((n.extra_checks || []).join('\n'))}</textarea>
    <div class="err" id="jn-err"></div>
    <div class="row" style="justify-content:flex-end;gap:6px;margin-top:10px"><button class="btn sec" data-close-modal>Cancelar</button><button class="btn" id="jn-ok">Guardar</button></div>`, { wide: true });
  $('#jn-ok').onclick = async () => {
    const checks = $('#jn-c').value.split('\n').map(x => x.trim()).filter(Boolean).slice(0, 30).map(x => x.slice(0, 200));
    const r = await sb.from('hys_job_notes').upsert({ org_id: me.org_id, job: k, notes: $('#jn-n').value.trim() || null, extra_checks: checks }, { onConflict: 'org_id,job' });
    if (r.error) return ($('#jn-err').textContent = errText(r.error));
    m.close(); try { await hysUncache('hys-notes'); } catch {} HYS.loaded = 0; await hysBase(true); toast('Guardado'); done();
  };
}
