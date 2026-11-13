/* =========================================================
   👥 RECURSOS (Mi empresa → Recursos) · v5.18
   Una sola ficha por persona: de quién depende, de qué empresa es, qué función cumple,
   si usa la app, si pide horas, si recibe tareas y en qué proyectos está.
   Contratistas afectadas a proyectos con alcance (lista), zona, fechas, responsable y N° de contrato / OC.
   Importar y exportar en Excel.  Ordenan: administrador, PM y coordinador.
   ========================================================= */
const RS = { view: 'tree', q: '', fco: '', fpr: '', folded: new Set(), pview: '', D: null };
const RS_FUNC = { pm: 'PM', coordinador: 'Coordinador', supervisor: 'Supervisor', tecnico: 'Técnico', ayudante: 'Ayudante', administrativo: 'Administrativo', responsable: 'Responsable contratista', chofer: 'Chofer', otro: 'Otro' };
const RS_SKILLS = ['FO', 'OTDR', 'Energía', 'Radio', 'Redes', 'Infraestructura'];
const rsCan = () => ['admin', 'pm', 'coordinador'].includes(me.role) && canWrite();
const rsNorm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const rsIni = n => String(n || '?').split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
const rsFmtD = d => d ? String(d).slice(0, 10).split('-').reverse().join('/') : 'sin fecha';
const rsPl = (n, a, b) => `${n} ${n === 1 ? a : b}`;
const rsFuncOf = t => { const x = rsNorm(t); if (!x) return null;
  if (/^pm$|project|jefe de proy/.test(x)) return 'pm'; if (/coordin/.test(x)) return 'coordinador'; if (/superv/.test(x)) return 'supervisor';
  if (/ayud/.test(x)) return 'ayudante'; if (/tecn|operari|instalad|empalm/.test(x)) return 'tecnico'; if (/administr/.test(x)) return 'administrativo';
  if (/chofer|conduct/.test(x)) return 'chofer'; if (/respons|encargad|capataz|jefe/.test(x)) return 'responsable'; return 'otro'; };

function rsCss(){
  if (document.getElementById('rs-css')) return;
  const s = document.createElement('style'); s.id = 'rs-css';
  s.textContent = `
.rs-head{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;margin-bottom:12px}.rs-head h1{margin:0;font-size:21px}.rs-head > *{min-width:0}
.rs-seg{display:inline-flex;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:3px;flex-wrap:wrap}
.rs-seg button{border:0;background:transparent;padding:7px 12px;border-radius:9px;font:inherit;color:var(--muted);cursor:pointer}.rs-seg button.on{background:var(--navy);color:#fff}
.rs-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:12px}
.rs-kpi{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px 12px;display:grid;gap:3px}.rs-kpi .n{font-size:23px;font-weight:700;font-variant-numeric:tabular-nums}.rs-kpi .t{font-size:12.5px;color:var(--muted)}
.rs-seat{height:6px;background:#EEF2F7;border-radius:4px;overflow:hidden}.rs-seat i{display:block;height:100%;background:var(--s1)}
.rs-alerts{background:var(--amber-bg);border-radius:12px;padding:10px 12px;display:grid;gap:6px;margin-bottom:12px}
.rs-alerts .r{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:13px}
.rs-filters{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px}.rs-filters input,.rs-filters select{width:auto;flex:1 1 160px;min-width:0;margin:0}
.rs-hint{background:var(--navy-2);color:#fff;border-radius:12px;padding:9px 12px;font-size:13px;margin-bottom:10px}
.rs-chart{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px;overflow:auto}
.rs-tree,.rs-tree ul{list-style:none;margin:0;padding:0}.rs-tree ul{padding-left:34px;position:relative}.rs-tree li{position:relative;padding:5px 0}
.rs-tree ul > li::before{content:"";position:absolute;left:-18px;top:0;bottom:0;border-left:2px solid #B9C6D8}
.rs-tree ul > li:last-child::before{bottom:auto;height:34px}.rs-tree ul > li::after{content:"";position:absolute;left:-18px;top:34px;width:16px;border-top:2px solid #B9C6D8}
.rs-node{display:inline-flex;gap:10px;align-items:center;background:var(--card);border:1px solid var(--line);border-left:5px solid var(--s1);border-radius:12px;padding:8px 12px 8px 8px;min-width:240px;max-width:100%;cursor:pointer;text-align:left}
.rs-node.ct{border-left-color:var(--s2);background:#FFF6EF}.rs-node.co{border-left-color:var(--navy-2);background:#EFF5FF;min-width:250px}.rs-node.co.ct{border-left-color:var(--s2);background:#FFF6EF}
.rs-node:hover{box-shadow:0 2px 10px rgba(15,42,74,.12)}.rs-node.drop{background:#DBEAFE;outline:2px dashed var(--s1)}.rs-node[draggable="true"]{cursor:grab}.rs-node.dim{opacity:.3}
.rs-av{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;font-weight:700;font-size:14px;color:#fff;flex:none;background:var(--s1)}.rs-node.ct .rs-av,.rs-av.ct{background:var(--s2)}.rs-av.sq{border-radius:10px;font-size:18px}
.rs-nm{min-width:0}.rs-nm b{display:block;font-size:14px;line-height:1.2}.rs-nm .r{font-size:12px;color:var(--muted)}
.rs-ics{display:flex;gap:4px;margin-top:4px;flex-wrap:wrap}.rs-ic{font-size:11px;border-radius:6px;padding:1px 6px;background:#EEF2F7;color:var(--muted);white-space:nowrap}
.rs-ic.on{background:var(--ok-bg);color:var(--green-d);font-weight:600}.rs-ic.warn{background:var(--amber-bg);color:var(--amber);font-weight:600}.rs-ic.pj{background:#E8F0FD;color:var(--s1);font-weight:600}
.rs-cnt{margin-left:auto;font-size:11.5px;color:var(--muted);white-space:nowrap;padding-left:8px}
.rs-fold{border:1px solid var(--line);background:var(--card);border-radius:50%;width:22px;height:22px;font-size:12px;line-height:1;display:inline-grid;place-items:center;margin-left:6px;cursor:pointer;padding:0}
.rs-who{display:flex;gap:9px;align-items:center}.rs-who .rs-av{width:30px;height:30px;font-size:12px}
.rs-tag{font-size:11px;font-weight:700;border-radius:6px;padding:1px 7px;color:#fff;background:var(--s1);white-space:nowrap}.rs-tag.ct{background:var(--s2)}
.rs-mx{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:auto;max-height:70vh}
.rs-mx table{border-collapse:separate;border-spacing:0;min-width:760px;width:100%}
.rs-mx th,.rs-mx td{border-bottom:1px solid var(--line);border-right:1px solid var(--line);padding:7px;vertical-align:top;font-size:13px;text-align:left}
.rs-mx thead th{position:sticky;top:0;background:var(--card);z-index:2}.rs-mx thead th small{display:block;color:var(--muted);font-weight:500;font-size:11.5px}
.rs-mx .rh{position:sticky;left:0;background:#FFF6EF;z-index:1;min-width:180px}.rs-mx thead th.rh{z-index:3;background:var(--card)}.rs-mx .rh.own{background:#EFF5FF}
.rs-slot{width:100%;min-height:50px;border:1px dashed var(--line);border-radius:10px;background:transparent;color:var(--muted);font-size:12px;cursor:pointer}.rs-slot:hover{border-color:var(--s1);color:var(--s1)}
.rs-inv{width:100%;text-align:left;border:1px solid var(--line);border-left:4px solid var(--s2);border-radius:10px;background:var(--card);padding:6px 8px;display:grid;gap:2px;font-size:12px;cursor:pointer;font-family:inherit;color:inherit}
.rs-inv.own{border-left-color:var(--s1)}.rs-inv.fin{opacity:.55;border-left-color:var(--muted)}.rs-inv .m{color:var(--muted)}
.rs-pgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:10px;align-items:start}
.rs-pcard{border:1px solid var(--line);border-left:5px solid var(--s2);border-radius:12px;padding:10px 12px;display:grid;gap:6px;background:#FFF6EF}.rs-pcard.own{border-left-color:var(--s1);background:#EFF5FF}
.rs-pcard .kv{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;text-align:center}.rs-pcard .kv div{background:var(--card);border-radius:8px;padding:5px}.rs-pcard .kv b{display:block;font-size:17px}.rs-pcard .kv span{font-size:11px;color:var(--muted)}
.rs-scrim{position:fixed;inset:0;background:rgba(10,20,35,.45);z-index:900;display:flex;justify-content:flex-end}
.rs-sheet{background:var(--card);width:min(480px,100%);height:100%;overflow:auto;padding:18px 18px calc(18px + env(safe-area-inset-bottom,0px));display:grid;gap:12px;align-content:start}
@media(max-width:600px){.rs-scrim{align-items:flex-end}.rs-sheet{height:auto;max-height:92%;border-radius:18px 18px 0 0}}
.rs-sheet h2{margin:0;font-size:19px}.rs-sheet label{margin:0;display:grid;gap:4px;font-size:12.5px;color:var(--muted);font-weight:600}.rs-sheet input,.rs-sheet select{margin:0}
.rs-blk{border:1px solid var(--line);border-radius:12px;padding:10px 12px;display:grid;gap:8px}.rs-blk h3{margin:0;font-size:14px;display:flex;justify-content:space-between;align-items:center;gap:8px}
.rs-two{display:grid;grid-template-columns:1fr 1fr;gap:10px}.rs-two > *{min-width:0}
.rs-sw{display:flex;gap:10px;align-items:center;justify-content:space-between;font-size:13.5px}
.rs-tog{position:relative;width:42px;height:24px;flex:none;display:inline-block}.rs-tog input{opacity:0;position:absolute;inset:0;margin:0;cursor:pointer;width:100%;height:100%}
.rs-tog i{position:absolute;inset:0;background:#CBD5E1;border-radius:20px;transition:background .15s;pointer-events:none}.rs-tog i::after{content:"";position:absolute;width:18px;height:18px;border-radius:50%;background:#fff;top:3px;left:3px;transition:left .15s}
.rs-tog input:checked + i{background:var(--green)}.rs-tog input:checked + i::after{left:21px}.rs-tog input:disabled + i{opacity:.5}
.rs-chips{display:flex;gap:6px;flex-wrap:wrap}.rs-chips button{border:1px solid var(--line);background:var(--bg);border-radius:20px;padding:5px 10px;font:inherit;font-size:12.5px;cursor:pointer;color:inherit}.rs-chips button.on{background:var(--navy-2);border-color:var(--navy-2);color:#fff}
.rs-steps{display:flex;gap:6px}.rs-steps span{flex:1;height:4px;border-radius:3px;background:var(--line)}.rs-steps span.on{background:var(--green)}
.rs-pick{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;max-height:46vh;overflow:auto}
.rs-pick button{border:1px solid var(--line);background:var(--bg);border-radius:12px;padding:11px;text-align:left;display:grid;gap:3px;font:inherit;cursor:pointer;color:inherit}
.rs-pick button b{font-size:14px}.rs-pick button span{font-size:12px;color:var(--muted)}.rs-pick button.on{border-color:var(--green);box-shadow:inset 0 0 0 1px var(--green);background:var(--ok-bg)}
.rs-acts{display:flex;gap:8px;flex-wrap:wrap}.rs-err{color:var(--red);font-size:13px}
.rs-prev{max-height:46vh;overflow:auto}.rs-prev td,.rs-prev th{font-size:12.5px;padding:5px 6px}
@media(max-width:640px){.rs-node{min-width:0;width:100%}.rs-tree ul{padding-left:22px}.rs-tree ul > li::before,.rs-tree ul > li::after{left:-12px}.rs-tree ul > li::after{width:10px}.rs-two{grid-template-columns:1fr}}`;
  document.head.appendChild(s);
}

/* ---------- datos ---------- */
async function rsLoad(){
  const W = rsCan();
  if (W) await sb.rpc('res_autolink').catch(() => {});
  const q = (t, cols, f) => { let x = sb.from(t).select(cols); if (f) x = f(x); return x.then(r => { if (r.error) throw r.error; return r.data || []; }); };
  let staff, contrs, users, pcs, pss, scopes, tasks, sites, projects;
  try {
    [staff, contrs, users, pcs, pss, scopes, tasks, sites, projects] = await Promise.all([
      q('hh_staff', 'id,name,kind,company,phone,base,active,user_id,func,boss_id,company_id,email,merged_into,skills', x => x.order('name').limit(3000)),
      q('contractors', 'id,name,active,staff_id,phone,contact_name,boss_staff_id,skills,base', x => x.order('name').limit(3000)),
      q('profiles', 'id,full_name,email,role,active,hh_enabled,contractor_id', x => x.order('full_name')),
      q('project_contractors', 'project_id,contractor_id,scopes,zone,date_from,date_to,resp_staff_id,status,contract_ref,added_at'),
      q('project_staff', 'project_id,staff_id,scopes,date_from,date_to,status,added_at'),
      sb.rpc('res_scopes').then(r => { if (r.error) throw r.error; return r.data || []; }),
      q('tasks', 'id,contractor_id,project_id,status,due_date', x => x.in('status', ['asignada', 'vista', 'en_curso', 'rechazada']).limit(5000)).catch(() => []),
      q('project_sites', 'project_id,contractor_id', x => x.not('contractor_id', 'is', null).limit(20000)).catch(() => []),
      loadProjects().catch(() => []),
    ]);
  } catch (e){ if (/boss_id|func|company_id|project_staff|res_scopes|merged_into|column|relation/i.test(e.message || '')) return { missingSql: true }; throw e; }
  const live = staff.filter(s => !s.merged_into);
  const crewOf = new Map(contrs.filter(c => c.staff_id).map(c => [c.staff_id, c]));
  const uById = new Map(users.map(u => [u.id, u]));
  const P = live.map(s => { const u = s.user_id ? uById.get(s.user_id) : null, cr = crewOf.get(s.id);
    return { ...s, co: s.company_id || 'own', u, app: !!(u && u.active), role: u?.role || null, hrs: !!u?.hh_enabled, tasks: !!(cr && cr.active), crew: cr || null, sk: s.skills || [] }; });
  const COS = contrs.filter(c => !c.staff_id);
  const noFicha = users.filter(u => u.active && !staff.some(s => s.user_id === u.id));
  const today = todayStr();
  const stat = (co, pr) => { const t = tasks.filter(x => x.contractor_id === co && x.project_id === pr); return { open: t.length, late: t.filter(x => x.due_date < today).length, sites: sites.filter(x => x.contractor_id === co && x.project_id === pr).length }; };
  return { P, COS, users, noFicha, PC: pcs, PP: pss, SCOPES: scopes, projects: projects.filter(p => p.active !== false), allProjects: projects, stat, W };
}
const rsD = () => RS.D;
const rsBy = id => rsD().P.find(x => x.id === id);
const rsCo = id => id === 'own' ? { id: 'own', name: org?.name || 'Empresa propia', own: true } : (rsD().COS.find(c => c.id === id) || { id, name: 'Contratista' });
const rsPr = id => rsD().allProjects.find(x => x.id === id) || { id, name: 'Proyecto' };
const rsNProj = id => rsD().PP.filter(x => x.staff_id === id && x.status === 'activa').length;
const rsScTxt = a => (a || []).join(' · ') || 'Sin alcance';
const rsFuncTxt = p => RS_FUNC[p.func] || (p.role ? ROLE_TXT[p.role] : '') || (p.co !== 'own' ? 'Contratista' : 'Sin función');
function rsWarns(p){
  const w = [];
  if (!p.phone) w.push('sin teléfono');
  if (!p.func) w.push('sin función');
  if (p.co !== 'own' && !p.boss_id && !rsCo(p.co).boss_staff_id) w.push('no se sabe de quién depende');
  return w;
}
function rsDupes(){
  const m = {}; rsD().P.filter(p => p.active).forEach(p => { const k = rsNorm(p.name); (m[k] ||= []).push(p); });
  return Object.values(m).filter(a => a.length > 1);
}
const rsOk = p => p.active && (!RS.fco || p.co === RS.fco) && (!RS.q || rsNorm(`${p.name} ${rsFuncTxt(p)} ${rsCo(p.co).name} ${p.base || ''} ${p.phone || ''}`).includes(rsNorm(RS.q)));
const rsIsBelow = (a, b) => { let x = rsBy(a), n = 0; while (x && x.boss_id && n++ < 50){ if (x.boss_id === b) return true; x = rsBy(x.boss_id); } return false; };

/* ---------- pantalla ---------- */
async function viewRecursos(v, sub, id){
  rsCss();
  if (!isManager()){ v.innerHTML = '<div class="card"><b>Recursos lo ven administración y coordinación.</b></div>'; return; }
  RS.D = await rsLoad();
  if (RS.D.missingSql){ v.innerHTML = `<div class="card"><h2>👥 Recursos</h2><p>Falta cargar <b>34_recursos.sql</b> en Supabase (SQL Editor). Avisale al administrador.</p></div>`; return; }
  if (sub === 'p' && id){ RS.view = 'pview'; RS.pview = id; }
  if (!RS.pview || !RS.D.allProjects.some(p => p.id === RS.pview)) RS.pview = RS.D.projects[0]?.id || '';
  rsRender(v);
}
function rsRender(v){
  v = v || $('#view'); const D = rsD(); if (!D) return;
  const W = D.W, act = D.P.filter(p => p.active);
  const used = D.users.filter(u => u.active).length, seats = org?.seat_limit || used;
  const own = act.filter(p => p.co === 'own').length, ct = act.length - own;
  const dup = rsDupes(), miss = act.filter(p => rsWarns(p).length);
  const nRev = dup.length + miss.length + D.noFicha.length;
  v.innerHTML = `
  <div class="rs-head"><div><div class="muted sm"><a href="#/org">Mi empresa</a> › Recursos</div><h1>👥 Recursos</h1></div>
    <div class="rs-acts">${W ? '<button class="btn" id="rs-add">＋ Persona</button><button class="btn sec" id="rs-addco">🏗 ＋ Contratista</button>' : ''}
      <button class="btn sec" id="rs-xl">⬇ Excel</button>${W ? '<button class="btn sec" id="rs-imp">⬆ Cargar Excel</button>' : ''}</div></div>
  <div class="rs-kpis">
    <div class="rs-kpi"><span class="t">👥 Personas</span><span class="n">${act.length}</span><span class="t">${own} propias · ${ct} de contratistas</span></div>
    <div class="rs-kpi"><span class="t">📱 Usan la app</span><span class="n">${used} <span class="t" style="font-size:14px">de ${seats}</span></span><div class="rs-seat"><i style="width:${Math.min(100, used * 100 / Math.max(1, seats))}%;${used >= seats ? 'background:var(--red)' : ''}"></i></div><span class="t">${seats - used > 0 ? `Queda${seats - used === 1 ? '' : 'n'} ${rsPl(seats - used, 'lugar', 'lugares')}` : 'Cupo completo'}</span></div>
    <div class="rs-kpi"><span class="t">🏗 Contratistas</span><span class="n">${D.COS.filter(c => c.active).length}</span><span class="t">${rsPl(D.PC.filter(x => x.status === 'activa').length, 'afectación activa', 'afectaciones activas')}</span></div>
    <div class="rs-kpi"><span class="t">⚠ Para revisar</span><span class="n" style="color:${nRev ? 'var(--amber)' : 'var(--green-d)'}">${nRev}</span><span class="t">${nRev ? 'datos que faltan o repetidos' : 'todo en orden'}</span></div></div>
  ${nRev ? `<div class="rs-alerts"><b>⚠ Para revisar</b>
    ${dup.map(a => `<div class="r">👯 <span><b>${esc(a[0].name)}</b> aparece ${a.length} veces.</span>${W ? `<button class="btn sec small" data-merge="${a.map(x => x.id).join(',')}">Unificar en una ficha</button>` : ''}</div>`).join('')}
    ${D.noFicha.slice(0, 6).map(u => `<div class="r">📱 <span><b>${esc(u.full_name || u.email)}</b> usa la app (${esc(ROLE_TXT[u.role] || u.role)}) pero no tiene ficha: no aparece en el organigrama.</span>${W ? `<button class="btn sec small" data-mkficha="${esc(u.id)}">Crear ficha</button>` : ''}</div>`).join('')}
    ${D.noFicha.length > 6 ? `<div class="r muted">y ${D.noFicha.length - 6} usuarios más sin ficha.</div>` : ''}
    ${W && D.noFicha.length > 1 ? `<div class="r"><button class="btn small" id="rs-mkall">Crear las ${D.noFicha.length} fichas que faltan</button></div>` : ''}
    ${miss.slice(0, 4).map(p => `<div class="r">• <span><b>${esc(p.name)}</b>: ${esc(rsWarns(p).join(', '))}.</span><button class="btn sec small" data-open="${p.id}">Completar</button></div>`).join('')}
    ${miss.length > 4 ? `<div class="r muted">y ${miss.length - 4} más…</div>` : ''}</div>` : ''}
  <div class="rs-filters"><div class="rs-seg">${[['tree', '🌳 Organigrama'], ['list', '📋 Lista'], ['proj', '🔗 Proyectos'], ['pview', '📁 Equipo de un proyecto']].map(([k, t]) => `<button data-rv="${k}" class="${RS.view === k ? 'on' : ''}">${t}</button>`).join('')}</div>
    ${RS.view !== 'pview' ? `<input id="rs-q" placeholder="🔍 Buscar persona, función, base" value="${esc(RS.q)}">
    <select id="rs-fco"><option value="">Todas las empresas</option><option value="own" ${RS.fco === 'own' ? 'selected' : ''}>🏢 ${esc(rsCo('own').name)}</option>${D.COS.filter(c => c.active).map(c => `<option value="${c.id}" ${RS.fco === c.id ? 'selected' : ''}>🏗 ${esc(c.name)}</option>`).join('')}</select>
    <select id="rs-fpr"><option value="">Todos los proyectos</option>${D.projects.map(j => `<option value="${j.id}" ${RS.fpr === j.id ? 'selected' : ''}>📁 ${esc(j.name)}</option>`).join('')}</select>` : ''}
    <a class="btn sec small" href="#/org" title="Usuarios, roles y permisos (pantalla anterior)">⚙ Avanzado</a></div>
  ${W && RS.view === 'tree' ? '<div class="rs-hint">💡 <b>Arrastrá una tarjeta sobre otra</b> para cambiar de quién depende. En el celular: tocá la tarjeta y elegí "Depende de".</div>' : ''}
  ${W && RS.view === 'proj' ? '<div class="rs-hint">💡 <b>Tocá una celda</b> para afectar una contratista o una persona a un proyecto, o editar su alcance, fechas, responsable y contrato.</div>' : ''}
  <div id="rs-body">${RS.view === 'tree' ? rsTreeHTML() : RS.view === 'list' ? rsListHTML() : RS.view === 'proj' ? rsMatrixHTML() : rsProjHTML()}</div>`;
  rsBind(v);
}
function rsIcons(p){
  const w = rsWarns(p), n = rsNProj(p.id);
  return `<div class="rs-ics">${n ? `<span class="rs-ic pj" title="${esc(rsD().PP.filter(x => x.staff_id === p.id && x.status === 'activa').map(x => rsPr(x.project_id).name).join(', '))}">📁 ${rsPl(n, 'proyecto', 'proyectos')}</span>` : ''}<span class="rs-ic ${p.app ? 'on' : ''}">📱 ${p.app ? esc(ROLE_TXT[p.role] || p.role) : 'Sin app'}</span>${p.hrs ? '<span class="rs-ic on">⏱ Horas</span>' : ''}${p.tasks ? '<span class="rs-ic on">📋 Tareas</span>' : ''}${w.length ? `<span class="rs-ic warn" title="${esc(w.join(', '))}">⚠ ${w.length}</span>` : ''}</div>`;
}
function rsDim(p){
  const D = rsD(), f = RS.fpr; if (!f) return false;
  if (p.co !== 'own') return !D.PC.some(x => x.contractor_id === p.co && x.project_id === f && x.status === 'activa');
  return !D.PP.some(x => x.staff_id === p.id && x.project_id === f && x.status === 'activa');
}
function rsCard(p){
  const D = rsD(), ct = p.co !== 'own';
  const kids = D.P.filter(x => x.active && x.boss_id === p.id).length + D.COS.filter(c => c.active && c.boss_staff_id === p.id).length;
  return `<div class="rs-node ${ct ? 'ct' : ''} ${rsDim(p) ? 'dim' : ''}" role="button" tabindex="0" ${D.W ? 'draggable="true"' : ''} data-p="${p.id}">
    <span class="rs-av">${esc(rsIni(p.name))}</span><div class="rs-nm"><b>${esc(p.name)}</b><div class="r">${esc(rsFuncTxt(p))}${p.base ? ' · ' + esc(p.base) : ''}</div>${rsIcons(p)}</div>
    ${kids ? `<span class="rs-cnt">${kids} a cargo <button type="button" class="rs-fold" data-fold="${p.id}" aria-label="Plegar">${RS.folded.has(p.id) ? '+' : '−'}</button></span>` : ''}</div>`;
}
function rsCoCard(c){
  const D = rsD(), n = D.P.filter(x => x.active && x.co === c.id).length;
  const prs = D.PC.filter(x => x.contractor_id === c.id && x.status === 'activa');
  const dim = RS.fpr && !prs.some(x => x.project_id === RS.fpr);
  return `<div class="rs-node co ct ${dim ? 'dim' : ''}" role="button" tabindex="0" ${D.W ? 'draggable="true"' : ''} data-co="${c.id}"><span class="rs-av sq ct">🏗</span>
    <div class="rs-nm"><b>${esc(c.name)}</b><div class="r">Contratista · ${rsPl(n, 'persona', 'personas')}</div>
      <div class="rs-ics">${prs.map(x => `<span class="rs-ic pj" title="${esc(rsScTxt(x.scopes))}">📁 ${esc(rsPr(x.project_id).name)}</span>`).join('') || '<span class="rs-ic warn">sin proyectos</span>'}</div></div>
    <span class="rs-cnt"><button type="button" class="rs-fold" data-fold="${c.id}" aria-label="Plegar">${RS.folded.has(c.id) ? '+' : '−'}</button></span></div>`;
}
function rsBranch(p, seen = new Set()){
  if (RS.folded.has(p.id) || seen.has(p.id)) return ''; seen.add(p.id);
  const D = rsD();
  const kids = D.P.filter(x => x.active && x.boss_id === p.id && x.co === 'own' && (rsOk(x) || D.P.some(y => y.boss_id === x.id)));
  const cos = D.COS.filter(c => c.active && c.boss_staff_id === p.id && (!RS.fco || RS.fco === c.id));
  if (!kids.length && !cos.length) return '';
  return `<ul>${kids.map(k => `<li>${rsCard(k)}${rsBranch(k, seen)}</li>`).join('')}${cos.map(c => `<li>${rsCoCard(c)}${rsCoBranch(c)}</li>`).join('')}</ul>`;
}
function rsCoBranch(c){
  if (RS.folded.has(c.id)) return '';
  const D = rsD(), mine = D.P.filter(x => x.active && x.co === c.id);
  const top = mine.filter(x => !x.boss_id || rsBy(x.boss_id)?.co !== c.id);
  const sub = (p, d = 0) => { const k = mine.filter(x => x.boss_id === p.id); return k.length && d < 20 && !RS.folded.has(p.id) ? `<ul>${k.map(x => `<li>${rsCard(x)}${sub(x, d + 1)}</li>`).join('')}</ul>` : ''; };
  return top.length ? `<ul>${top.filter(rsOk).map(p => `<li>${rsCard(p)}${sub(p)}</li>`).join('')}</ul>` : '';
}
function rsTreeHTML(){
  const D = rsD();
  const ownP = D.P.filter(x => x.active && x.co === 'own');
  const roots = ownP.filter(x => !x.boss_id || !rsBy(x.boss_id)?.active || rsBy(x.boss_id)?.co !== 'own');
  const loose = D.COS.filter(c => c.active && (!c.boss_staff_id || !rsBy(c.boss_staff_id)?.active) && (!RS.fco || RS.fco === c.id));
  const showOwn = !RS.fco || RS.fco === 'own';
  return `<div class="rs-chart"><ul class="rs-tree"><li><div class="rs-node co" data-co="own"><span class="rs-av sq" style="background:var(--navy-2)">🏢</span><div class="rs-nm"><b>${esc(rsCo('own').name)}</b><div class="r">Empresa · ${rsPl(ownP.length, 'persona', 'personas')}</div></div></div>
    <ul>${showOwn ? roots.filter(r => rsOk(r) || D.P.some(x => x.boss_id === r.id)).map(r => `<li>${rsCard(r)}${rsBranch(r)}</li>`).join('') : roots.map(r => rsBranch(r)).join('')}
    ${loose.map(c => `<li>${rsCoCard(c)}${rsCoBranch(c)}</li>`).join('')}</ul></li></ul>
    ${!D.P.some(p => p.active) ? '<p class="muted">Todavía no hay personas cargadas. Usá <b>＋ Persona</b> o <b>⬆ Cargar Excel</b>.</p>' : ''}</div>`;
}
function rsListHTML(){
  const D = rsD();
  const rows = D.P.filter(rsOk).sort((a, b) => (a.co === 'own' ? 0 : 1) - (b.co === 'own' ? 0 : 1) || a.name.localeCompare(b.name, 'es'));
  return `<div class="tblwrap"><table class="tbl"><thead><tr><th>Persona</th><th>Empresa</th><th>Función</th><th class="hide-sm">Depende de</th><th>App</th><th class="hide-sm">Horas</th><th class="hide-sm">Tareas</th><th class="hide-sm">Proyectos</th><th>Teléfono</th></tr></thead><tbody>
    ${rows.map(p => { const ct = p.co !== 'own', b = p.boss_id ? rsBy(p.boss_id) : ct && rsCo(p.co).boss_staff_id ? rsBy(rsCo(p.co).boss_staff_id) : null;
      return `<tr data-open="${p.id}" style="cursor:pointer"><td><div class="rs-who"><span class="rs-av ${ct ? 'ct' : ''}">${esc(rsIni(p.name))}</span><b>${esc(p.name)}</b></div></td>
        <td><span class="rs-tag ${ct ? 'ct' : ''}">${esc(rsCo(p.co).name)}</span></td><td>${esc(rsFuncTxt(p))}</td><td class="hide-sm">${b ? esc(b.name) : '<span class="muted">—</span>'}</td>
        <td>${p.app ? '✅' : '—'}</td><td class="hide-sm">${p.hrs ? '✅' : '—'}</td><td class="hide-sm">${p.tasks ? '✅' : '—'}</td><td class="hide-sm">${ct ? '' : rsNProj(p.id) || '—'}</td><td>${p.phone ? esc(p.phone) : '<span class="rs-ic warn">⚠ falta</span>'}</td></tr>`; }).join('') || '<tr><td colspan="9" class="muted">No hay personas con ese filtro.</td></tr>'}</tbody></table></div>`;
}
function rsMatrixHTML(){
  const D = rsD();
  const cos = D.COS.filter(c => c.active && (!RS.fco || RS.fco === c.id));
  const prs = D.projects.filter(j => !RS.fpr || j.id === RS.fpr);
  const ppl = D.P.filter(p => p.active && p.co === 'own' && (!RS.fco || RS.fco === 'own') && rsOk(p));
  if (!prs.length) return '<div class="card muted">No hay proyectos activos.</div>';
  const cellC = (c, j) => { const x = D.PC.find(y => y.contractor_id === c.id && y.project_id === j.id), s = D.stat(c.id, j.id);
    return `<td>${x ? `<button type="button" class="rs-inv ${x.status === 'finalizada' ? 'fin' : ''}" data-inv="${c.id}|${j.id}"><b>${esc(rsScTxt(x.scopes))}</b>${x.zone ? `<span class="m">📍 ${esc(x.zone)}</span>` : ''}${x.contract_ref ? `<span class="m">📄 ${esc(x.contract_ref)}</span>` : ''}<span class="m">${x.status === 'finalizada' ? '✔ Finalizada' : `🗓 ${x.date_to ? 'hasta ' + rsFmtD(x.date_to) : 'sin fecha de fin'}`}</span>${x.status === 'activa' ? `<span class="m">${rsPl(s.open, 'tarea abierta', 'tareas abiertas')}${s.late ? ` · <b style="color:var(--red)">${s.late} vencidas</b>` : ''}</span>` : ''}</button>`
      : D.W ? `<button type="button" class="rs-slot" data-inv="${c.id}|${j.id}">＋ Afectar</button>` : ''}</td>`; };
  const cellP = (p, j) => { const x = D.PP.find(y => y.staff_id === p.id && y.project_id === j.id);
    return `<td>${x ? `<button type="button" class="rs-inv own ${x.status === 'finalizada' ? 'fin' : ''}" data-pp="${p.id}|${j.id}"><b>${esc(rsScTxt(x.scopes))}</b><span class="m">${x.status === 'finalizada' ? '✔ Finalizada' : `🗓 ${x.date_to ? 'hasta ' + rsFmtD(x.date_to) : 'sin fecha de fin'}`}</span></button>`
      : D.W ? `<button type="button" class="rs-slot" data-pp="${p.id}|${j.id}">＋</button>` : ''}</td>`; };
  return `<div class="rs-mx"><table><thead><tr><th class="rh">Contratista / persona</th>${prs.map(j => `<th>📁 <a href="#/recursos/p/${j.id}">${esc(j.name)}</a><small>${D.PC.filter(x => x.project_id === j.id && x.status === 'activa').length} contratistas · ${D.PP.filter(x => x.project_id === j.id && x.status === 'activa').length} propios</small></th>`).join('')}</tr></thead>
    <tbody>${cos.length ? `<tr><td class="rh" colspan="${prs.length + 1}" style="font-weight:700">🏗 Contratistas</td></tr>` : ''}
    ${cos.map(c => `<tr><td class="rh"><div class="rs-who"><span class="rs-av sq ct">🏗</span><div><b>${esc(c.name)}</b><div class="muted sm">${(n => rsPl(n, 'proyecto activo', 'proyectos activos'))(D.PC.filter(x => x.contractor_id === c.id && x.status === 'activa').length)}</div></div></div></td>${prs.map(j => cellC(c, j)).join('')}</tr>`).join('')}
    ${ppl.length ? `<tr><td class="rh own" colspan="${prs.length + 1}" style="font-weight:700">🏢 Personal propio</td></tr>` : ''}
    ${ppl.map(p => `<tr><td class="rh own"><div class="rs-who"><span class="rs-av">${esc(rsIni(p.name))}</span><div><b>${esc(p.name)}</b><div class="muted sm">${esc(rsFuncTxt(p))} · ${rsPl(rsNProj(p.id), 'proyecto', 'proyectos')}</div></div></div></td>${prs.map(j => cellP(p, j)).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function rsProjHTML(){
  const D = rsD(); if (!D.projects.length && !RS.pview) return '<div class="card muted">No hay proyectos activos.</div>';
  const j = rsPr(RS.pview), inv = D.PC.filter(x => x.project_id === j.id), mine = D.PP.filter(x => x.project_id === j.id);
  const list = D.projects.some(p => p.id === j.id) ? D.projects : [j, ...D.projects];
  return `<div class="rs-filters"><span class="muted sm">Proyecto:</span><select id="rs-pv">${list.map(x => `<option value="${x.id}" ${x.id === j.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select><a class="btn sec small" href="#/proj/${j.id}">Abrir el proyecto</a></div>
  <div class="card"><div class="row between" style="flex-wrap:wrap;gap:8px"><div><h2 style="margin:0">🏗 Equipo del proyecto</h2><div class="muted sm">${esc(j.name)}${j.client ? ' · ' + esc(j.client) : ''} · ${rsPl(inv.filter(x => x.status === 'activa').length, 'contratista', 'contratistas')} · ${rsPl(mine.filter(x => x.status === 'activa').length, 'persona propia', 'personas propias')}</div></div>
    ${D.W ? `<div class="rs-acts"><button class="btn" data-pp="|${j.id}">＋ Persona</button><button class="btn sec" data-inv="|${j.id}">＋ Contratista</button><button class="btn sec" data-impp="${j.id}">⬆ Cargar equipo desde Excel</button></div>` : ''}</div>
    <div class="rs-pgrid" style="margin-top:12px">${inv.filter(x => x.status === 'activa').map(x => { const c = rsCo(x.contractor_id), r = x.resp_staff_id ? rsBy(x.resp_staff_id) : null, s = D.stat(c.id, j.id), ppl = D.P.filter(p => p.active && p.co === c.id);
      return `<div class="rs-pcard"><div class="row" style="gap:10px;flex-wrap:nowrap"><span class="rs-av sq ct">🏗</span><div style="min-width:0;flex:1"><b>${esc(c.name)}</b><div class="muted sm">${esc(rsScTxt(x.scopes))}</div></div>${D.W ? `<button class="btn sec small" data-inv="${c.id}|${j.id}">Editar</button>` : ''}</div>
        <div class="muted sm">${x.zone ? `📍 ${esc(x.zone)} · ` : ''}🗓 ${x.date_to ? `${rsFmtD(x.date_from)} al ${rsFmtD(x.date_to)}` : x.date_from ? `desde ${rsFmtD(x.date_from)}, sin fecha de fin` : 'sin fechas cargadas'}${x.contract_ref ? ` · 📄 ${esc(x.contract_ref)}` : ''}<br>👷 Responsable: <b>${esc(r?.name || '—')}</b>${c.phone ? ` · 📞 ${esc(c.phone)}` : ''}</div>
        <div class="kv"><div><b>${s.sites}</b><span>sitios</span></div><div><b style="${s.late ? 'color:var(--red)' : ''}">${s.open}</b><span>tareas abiertas</span></div><div><b style="${s.late ? 'color:var(--red)' : ''}">${s.late}</b><span>vencidas</span></div></div>
        <div class="muted sm">Su gente: ${ppl.map(p => esc(p.name)).join(', ') || '—'}</div>
        <div class="rs-acts">${c.phone ? `<a class="btn sec small" target="_blank" rel="noopener noreferrer" href="https://wa.me/${esc(String(c.phone).replace(/\D/g, ''))}">💬 WhatsApp</a>` : ''}<a class="btn sec small" href="#/tasks">Ver tareas</a></div></div>`; }).join('') || '<div class="muted">Todavía no hay contratistas afectadas a este proyecto.</div>'}
      <div class="rs-pcard own"><div class="row" style="gap:10px;flex-wrap:nowrap"><span class="rs-av sq" style="background:var(--s1)">🏢</span><div style="flex:1"><b>Personal propio</b><div class="muted sm">${rsPl(mine.filter(x => x.status === 'activa').length, 'persona afectada', 'personas afectadas')}</div></div></div>
        ${mine.filter(x => x.status === 'activa').map(x => { const p = rsBy(x.staff_id); return p ? `<button type="button" class="rs-inv own" data-pp="${p.id}|${j.id}"><b>${esc(p.name)} <span class="m" style="font-weight:400">· ${esc(rsFuncTxt(p))} · en ${rsPl(rsNProj(p.id), 'proyecto', 'proyectos')}</span></b><span class="m">${esc(rsScTxt(x.scopes))}${p.app ? '' : ' · sin app'}</span></button>` : ''; }).join('') || '<div class="muted sm">Nadie afectado todavía.</div>'}</div></div>
    ${inv.some(x => x.status === 'finalizada') || mine.some(x => x.status === 'finalizada') ? `<p class="muted sm">Finalizadas: ${[...inv.filter(x => x.status === 'finalizada').map(x => esc(rsCo(x.contractor_id).name)), ...mine.filter(x => x.status === 'finalizada').map(x => esc(rsBy(x.staff_id)?.name || ''))].join(', ')}</p>` : ''}</div>`;
}

/* ---------- eventos ---------- */
let rsDrag = null;
function rsBind(v){
  const D = rsD();
  v.querySelectorAll('[data-rv]').forEach(b => b.onclick = () => { RS.view = b.dataset.rv; if (location.hash.startsWith('#/recursos/p/')) history.replaceState(null, '', '#/recursos'); rsRender(v); });
  $('#rs-q')?.addEventListener('input', e => { RS.q = e.target.value; const pos = e.target.selectionStart; rsRender(v); const q = $('#rs-q'); q.focus(); try { q.setSelectionRange(pos, pos); } catch {} });
  $('#rs-fco')?.addEventListener('change', e => { RS.fco = e.target.value; rsRender(v); });
  $('#rs-fpr')?.addEventListener('change', e => { RS.fpr = e.target.value; rsRender(v); if (RS.fpr && RS.view === 'tree') toast('Quien no está en ese proyecto se ve atenuado.'); });
  $('#rs-pv')?.addEventListener('change', e => { RS.pview = e.target.value; rsRender(v); });
  $('#rs-add')?.addEventListener('click', () => rsWizard({}));
  $('#rs-addco')?.addEventListener('click', () => rsCoSheet(null));
  $('#rs-xl')?.addEventListener('click', () => rsExport());
  $('#rs-imp')?.addEventListener('click', () => rsImport(null));
  $('#rs-mkall')?.addEventListener('click', async () => { if (!needOnline()) return;
    if (!confirm(`Se crea una ficha para cada uno de los ${D.noFicha.length} usuarios que no la tienen, con su nombre y su rol. ¿Seguir?`)) return;
    for (const u of D.noFicha){ const { error } = await sb.rpc('res_save_person', { p: rsFichaOf(u) }); if (error) return toast(errText(error)); }
    toast('Fichas creadas'); rsReload(); });
  v.querySelectorAll('[data-mkficha]').forEach(b => b.onclick = async () => { const u = D.users.find(x => x.id === b.dataset.mkficha); if (!u || !needOnline()) return;
    const { data, error } = await sb.rpc('res_save_person', { p: rsFichaOf(u) });
    if (error) return toast(errText(error)); toast('Ficha creada: completá de quién depende.'); await rsReload(); rsPerson(data); });
  v.querySelectorAll('[data-merge]').forEach(b => b.onclick = () => rsMerge(b.dataset.merge.split(',')));
  v.querySelectorAll('[data-fold]').forEach(b => b.onclick = e => { e.stopPropagation(); const k = b.dataset.fold; RS.folded.has(k) ? RS.folded.delete(k) : RS.folded.add(k); rsRender(v); });
  v.querySelectorAll('[data-open]').forEach(b => b.onclick = () => rsPerson(b.dataset.open));
  v.querySelectorAll('.rs-node[data-p]').forEach(n => { n.onclick = () => rsPerson(n.dataset.p); n.onkeydown = e => { if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); n.click(); } }; });
  v.querySelectorAll('.rs-node[data-co]').forEach(n => { if (n.dataset.co === 'own') return; n.onclick = () => rsCoSheet(n.dataset.co); n.onkeydown = e => { if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); n.click(); } }; });
  v.querySelectorAll('[data-pp]').forEach(b => b.onclick = () => { const [pid, j] = b.dataset.pp.split('|'); rsPPSheet(pid, j); });
  v.querySelectorAll('[data-inv]').forEach(b => b.onclick = () => { const [c, j] = b.dataset.inv.split('|'); rsPCSheet(c, j); });
  v.querySelectorAll('[data-impp]').forEach(b => b.onclick = () => rsImport(b.dataset.impp));
  if (!D.W) return;
  v.querySelectorAll('.rs-node').forEach(n => {
    n.addEventListener('dragstart', e => { if (n.dataset.co === 'own') return e.preventDefault(); rsDrag = n.dataset.p ? { p: n.dataset.p } : { co: n.dataset.co }; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', 'x'); } catch {} });
    n.addEventListener('dragover', e => { if (!rsDrag) return; e.preventDefault(); v.querySelectorAll('.rs-node.drop').forEach(x => x.classList.remove('drop')); n.classList.add('drop'); });
    n.addEventListener('dragend', () => { rsDrag = null; v.querySelectorAll('.rs-node.drop').forEach(x => x.classList.remove('drop')); });
    n.addEventListener('drop', e => { e.preventDefault(); v.querySelectorAll('.rs-node.drop').forEach(x => x.classList.remove('drop')); const d = rsDrag; rsDrag = null; if (d) rsDrop(d, n); });
  });
}
const rsFichaOf = u => ({ name: u.full_name || u.email.split('@')[0], email: u.email, user_id: u.id, func: rsRoleFunc(u.role), company_id: u.role === 'contratista' && u.contractor_id && rsD().COS.some(c => c.id === u.contractor_id) ? u.contractor_id : null });
const rsRoleFunc = r => ({ pm: 'pm', coordinador: 'coordinador', supervisor: 'supervisor', inspector: 'tecnico', contratista: 'responsable' })[r] || null;
async function rsReload(){ IDB.del('kv', CUR_UID + ':hh-staff').catch(() => {}); RS.D = await rsLoad(); rsRender(); }
async function rsCall(fn, args, ok){ if (!needOnline()) return false; const { error } = await sb.rpc(fn, args); if (error){ toast(errText(error)); return false; } if (ok) toast(ok.msg || ok, ok.undo); return true; }

async function rsDrop(d, n){
  const to = n.dataset.p ? rsBy(n.dataset.p) : null, toCo = n.dataset.co;
  if (d.co){
    const c = rsCo(d.co); if (!to || to.co !== 'own') return toast('Una contratista depende de alguien de la empresa propia.');
    const prev = c.boss_staff_id || null;
    if (await rsCall('res_set_co_boss', { p_contr: c.id, p_staff: to.id }, { msg: `${c.name} ahora depende de ${to.name}.`, undo: { label: 'Deshacer', fn: async () => { await rsCall('res_set_co_boss', { p_contr: c.id, p_staff: prev }); rsReload(); } } })) rsReload();
    return;
  }
  const p = rsBy(d.p); if (!p) return;
  if (toCo){ // soltar sobre una empresa = pasa a esa empresa
    const nc = toCo === 'own' ? null : toCo; if ((p.company_id || null) === nc) return;
    const prev = p.company_id || null;
    if (await rsCall('res_set_company', { p_staff: p.id, p_company: nc }, { msg: `${p.name} pasó a ${rsCo(toCo).name}.`, undo: { label: 'Deshacer', fn: async () => { await rsCall('res_set_company', { p_staff: p.id, p_company: prev }); rsReload(); } } })) rsReload();
    return;
  }
  if (!to || to.id === p.id) return;
  if (rsIsBelow(to.id, p.id)) return toast(`No: ${to.name} depende de ${p.name}.`);
  if (p.co !== 'own' && to.co !== p.co && to.co !== 'own') return toast('Alguien de una contratista depende de su propia empresa o de la empresa propia.');
  if (p.co === 'own' && to.co !== 'own') return toast('El personal propio depende de alguien de la empresa propia.');
  const prev = p.boss_id || null;
  if (await rsCall('res_set_boss', { p_staff: p.id, p_boss: to.id }, { msg: `${p.name} ahora depende de ${to.name}.`, undo: { label: 'Deshacer', fn: async () => { await rsCall('res_set_boss', { p_staff: p.id, p_boss: prev }); rsReload(); } } })) rsReload();
}

/* ---------- panel lateral ---------- */
function rsSheet(html, mount){
  const root = $('#modal-root');
  root.innerHTML = `<div class="rs-scrim"><div class="rs-sheet" role="dialog" aria-modal="true">${html}</div></div>`;
  const el = root.querySelector('.rs-sheet'), close = () => { root.innerHTML = ''; document.removeEventListener('keydown', esc1); };
  const esc1 = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', esc1);
  root.querySelector('.rs-scrim').addEventListener('mousedown', e => { if (e.target.classList.contains('rs-scrim')) close(); });
  el.querySelectorAll('[data-close]').forEach(b => b.onclick = close);
  const S = { el, close, $: s => el.querySelector(s), $$: s => [...el.querySelectorAll(s)] };
  mount && mount(S);
  el.querySelector('input,select,button')?.focus();
  return S;
}
const rsTog = (id, on, dis) => `<span class="rs-tog"><input type="checkbox" id="${id}" ${on ? 'checked' : ''} ${dis ? 'disabled' : ''}><i></i></span>`;
const rsBossOpts = p => rsD().P.filter(x => x.active && x.id !== p.id && !rsIsBelow(x.id, p.id) && (p.co === 'own' ? x.co === 'own' : x.co === p.co || x.co === 'own') && !['tecnico', 'ayudante', 'chofer'].includes(x.func));
const rsFuncSel = (id, cur) => `<select id="${id}"><option value="">— Elegí —</option>${Object.entries(RS_FUNC).map(([k, t]) => `<option value="${k}" ${cur === k ? 'selected' : ''}>${t}</option>`).join('')}</select>`;

function rsPerson(id){
  const D = rsD(), p = rsBy(id); if (!p) return;
  const W = D.W, ct = p.co !== 'own', adm = isAdmin();
  const free = D.noFicha;
  rsSheet(`<div class="row" style="gap:12px;flex-wrap:nowrap"><span class="rs-av ${ct ? 'ct' : ''}" style="width:52px;height:52px;font-size:18px">${esc(rsIni(p.name))}</span><div style="min-width:0;flex:1"><h2>${esc(p.name)}</h2><div class="muted sm">${esc(rsCo(p.co).name)} · ${esc(rsFuncTxt(p))}</div></div><button class="btn sec small" data-close>Cerrar</button></div>
    ${rsWarns(p).length ? `<div class="rs-alerts" style="margin:0;font-size:13px">⚠ Falta: ${esc(rsWarns(p).join(', '))}.</div>` : ''}
    <div class="rs-blk"><h3>👤 Datos</h3>
      <div class="rs-two"><label>Nombre<input id="e-n" value="${esc(p.name)}" maxlength="120" ${W ? '' : 'disabled'}></label><label>Teléfono / WhatsApp<input id="e-ph" value="${esc(p.phone || '')}" maxlength="30" inputmode="tel" ${W ? '' : 'disabled'}></label></div>
      <div class="rs-two"><label>Mail<input id="e-em" type="email" value="${esc(p.email || '')}" maxlength="200" ${W ? '' : 'disabled'}></label><label>Base<input id="e-b" value="${esc(p.base || '')}" maxlength="120" ${W ? '' : 'disabled'}></label></div>
      <div class="rs-two"><label>Empresa<select id="e-co" ${W ? '' : 'disabled'}><option value="own">🏢 ${esc(rsCo('own').name)}</option>${D.COS.filter(c => c.active || c.id === p.company_id).map(c => `<option value="${c.id}" ${p.company_id === c.id ? 'selected' : ''}>🏗 ${esc(c.name)}</option>`).join('')}</select></label><label>Función${rsFuncSel('e-fn', p.func)}</label></div>
      <label>Depende de<select id="e-boss" ${W ? '' : 'disabled'}><option value="">— Nadie (encabeza su grupo) —</option>${rsBossOpts(p).map(x => `<option value="${x.id}" ${p.boss_id === x.id ? 'selected' : ''}>${esc(x.name)} · ${esc(rsFuncTxt(x))}${x.co !== 'own' ? ' (' + esc(rsCo(x.co).name) + ')' : ''}</option>`).join('')}</select></label></div>
    <div class="rs-blk"><h3>📱 Usa la app <span class="sm ${p.app ? '' : 'muted'}" style="font-weight:400">${p.app ? '✅ ' + esc(ROLE_TXT[p.role] || p.role) : p.u ? 'cuenta desactivada' : 'no'}</span></h3>
      ${p.u ? `<div class="muted sm">Cuenta: ${esc(p.u.email)}${p.app ? ' · ocupa 1 lugar del cupo' : ''}.</div>
          ${adm && p.u.id !== me.id ? `<div class="rs-acts"><label style="flex:1">Rol en la app<select id="e-role">${Object.entries(ROLE_TXT).filter(([k]) => ct ? k === 'contratista' : k !== 'contratista').map(([k, t]) => `<option value="${k}" ${p.role === k ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label></div>
          <div class="rs-acts"><button class="btn sec small" id="e-acc">${p.u.active ? 'Desactivar acceso' : 'Activar acceso'}</button><button class="btn sec small" id="e-unl">Desvincular cuenta</button></div>` : '<div class="muted sm">El rol y el acceso los cambia el administrador.</div>'}`
        : W ? `<div class="muted sm">Para que use la app: invitalo (le llega un link, entra con su mail sin código) o vinculalo con una cuenta que ya existe.</div>
          <div class="rs-acts"><button class="btn small" id="e-inv">✉ Invitar a la app</button></div>
          ${free.length ? `<div class="rs-acts" style="flex-wrap:nowrap"><select id="e-lnk" style="flex:1"><option value="">Vincular con un usuario existente…</option>${free.map(u => `<option value="${u.id}">${esc(u.full_name || u.email)} · ${esc(ROLE_TXT[u.role] || u.role)}</option>`).join('')}</select><button class="btn sec small" id="e-lnkok">Vincular</button></div>` : ''}` : '<div class="muted sm">No usa la app.</div>'}</div>
    ${ct ? '' : `<div class="rs-blk"><h3>📁 Proyectos <span class="muted sm" style="font-weight:400">${rsPl(rsNProj(p.id), 'activo', 'activos')}</span></h3>
      ${D.PP.filter(x => x.staff_id === p.id).map(x => `<button type="button" class="rs-inv own ${x.status === 'finalizada' ? 'fin' : ''}" data-epp="${x.project_id}"><b>${esc(rsPr(x.project_id).name)}</b><span class="m">${esc(rsScTxt(x.scopes))}${x.status === 'finalizada' ? ' · finalizada' : ''}</span></button>`).join('') || '<div class="muted sm">No está afectado a ningún proyecto.</div>'}
      ${W ? '<div><button class="btn sec small" id="e-addpp">＋ Afectar a un proyecto</button></div>' : ''}</div>`}
    <div class="rs-blk"><div class="rs-sw"><span>⏱ <b>Pide horas extra</b><br><span class="muted sm">${p.u ? 'Aparece en Horas y guardias para pedir horas, guardias y francos.' : 'Necesita usar la app.'}</span></span>${rsTog('e-hrs', p.hrs, !p.u || !W)}</div></div>
    <div class="rs-blk"><div class="rs-sw"><span>📋 <b>Recibe tareas</b><br><span class="muted sm">Aparece como fila en la Agenda y se le asignan tareas y tickets.</span></span>${rsTog('e-tk', p.tasks, !W)}</div>
      <div class="rs-chips" id="e-sk">${[...new Set([...RS_SKILLS, ...(p.sk || [])])].map(s => `<button type="button" data-sk="${esc(s)}" class="${(p.sk || []).includes(s) ? 'on' : ''}" ${W ? '' : 'disabled'}>${esc(s)}</button>`).join('')}</div></div>
    <div class="rs-err" id="e-err"></div>
    ${W ? `<div class="rs-acts" style="justify-content:space-between"><button class="btn sec small" id="e-del" style="color:var(--red)">Dar de baja</button><button class="btn" id="e-ok">Guardar</button></div>` : ''}`, S => {
      S.$$('#e-sk [data-sk]').forEach(b => b.onclick = () => b.classList.toggle('on'));
      S.$$('[data-epp]').forEach(b => b.onclick = () => rsPPSheet(p.id, b.dataset.epp));
      S.$('#e-addpp')?.addEventListener('click', () => rsPPSheet(p.id, ''));
      S.$('#e-inv')?.addEventListener('click', () => rsInvite(p, S.$('#e-em').value.trim()));
      S.$('#e-lnkok')?.addEventListener('click', async () => { const u = S.$('#e-lnk').value; if (!u) return;
        if (await rsCall('res_save_person', { p: { id: p.id, name: p.name, user_id: u } }, 'Vinculado')){ S.close(); rsReload(); } });
      S.$('#e-role')?.addEventListener('change', async e => { if (await rsCall('org_update_member', { p_user: p.u.id, p_role: e.target.value, p_contractor: e.target.value === 'contratista' ? p.company_id : null }, 'Rol actualizado')) rsReload(); });
      S.$('#e-acc')?.addEventListener('click', async () => { if (await rsCall('org_update_member', { p_user: p.u.id, p_active: !p.u.active }, p.u.active ? 'Acceso desactivado: liberó un lugar del cupo.' : 'Acceso activado')){ S.close(); rsReload(); } });
      S.$('#e-unl')?.addEventListener('click', async () => { if (!confirm('La ficha queda sin cuenta de la app (la cuenta sigue existiendo). ¿Seguir?') || !needOnline()) return;
        const { error } = await sb.from('hh_staff').update({ user_id: null }).eq('id', p.id); if (error) return toast(errText(error)); S.close(); rsReload(); });
      S.$('#e-hrs')?.addEventListener('change', async e => { if (!await rsCall('org_set_hh', { p_user: p.u.id, p_on: e.target.checked }, e.target.checked ? 'Puede pedir horas' : 'Ya no ve el pedido de horas')) e.target.checked = !e.target.checked; });
      S.$('#e-del')?.addEventListener('click', async () => {
        const kids = D.P.filter(x => x.active && x.boss_id === p.id).length;
        if (!confirm(`¿Dar de baja a ${p.name}? No se borra: queda el historial de horas y tareas.${kids ? `\nSus ${kids} personas a cargo pasan a depender de ${p.boss_id ? rsBy(p.boss_id)?.name : 'la empresa'}.` : ''}${p.app ? '\nSu cuenta de la app sigue activa: desactivala si ya no trabaja.' : ''}`)) return;
        if (await rsCall('res_deactivate', { p_staff: p.id }, `${p.name} dado de baja.`)){ S.close(); rsReload(); } });
      S.$('#e-ok')?.addEventListener('click', async () => {
        const name = S.$('#e-n').value.trim(), email = S.$('#e-em').value.trim();
        if (!name) return void (S.$('#e-err').textContent = 'Falta el nombre.');
        if (email && !/^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/.test(email)) return void (S.$('#e-err').textContent = 'Revisá el mail.');
        const co = S.$('#e-co').value;
        const dup = D.P.find(x => x.active && x.id !== p.id && rsNorm(x.name) === rsNorm(name));
        if (dup && !confirm(`Ya hay otra ficha con el nombre "${dup.name}". ¿Es otra persona? (Si es la misma, cancelá y usá "Unificar".)`)) return;
        S.$('#e-ok').disabled = true;
        const { error } = await sb.rpc('res_save_person', { p: { id: p.id, name, phone: S.$('#e-ph').value.trim(), email, base: S.$('#e-b').value.trim(), func: S.$('#e-fn').value || null,
          boss_id: S.$('#e-boss').value || null, company_id: co === 'own' ? null : co, tasks: S.$('#e-tk').checked, skills: S.$$('#e-sk .on').map(b => b.dataset.sk) } });
        if (error){ S.$('#e-err').textContent = errText(error); S.$('#e-ok').disabled = false; return; }
        S.close(); toast('Guardado'); rsReload();
      });
    });
}

/* invitar a la app: usa las invitaciones de siempre (link de un solo uso, 7 días) y suma sus proyectos */
async function rsInvite(p, email){
  if (!needOnline()) return;
  const D = rsD(), ct = p.co !== 'own';
  const role = ct ? 'contratista' : ({ pm: 'pm', coordinador: 'coordinador', supervisor: 'supervisor' })[p.func] || 'inspector';
  rsSheet(`<h2>✉ Invitar a ${esc(p.name)}</h2><div class="muted sm">Le llega un link de un solo uso (vale 7 días). Entra con su mail, sin código, ya con su rol${ct ? ' y su contratista' : ' y sus proyectos'}.</div>
    <label>Mail con el que va a entrar<input id="i-m" type="email" maxlength="200" value="${esc(email || p.email || '')}" placeholder="nombre@empresa.com"></label>
    <label>Rol en la app<select id="i-r">${Object.entries(ROLE_TXT).filter(([k]) => k !== 'admin' && (ct ? k === 'contratista' : k !== 'contratista')).map(([k, t]) => `<option value="${k}" ${k === role ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
    ${ct ? '' : `<div class="muted sm">Proyectos: ${D.PP.filter(x => x.staff_id === p.id && x.status === 'activa').map(x => esc(rsPr(x.project_id).name)).join(', ') || 'ninguno todavía (lo podés afectar después)'}.</div>`}
    <div class="muted sm">Usuarios: ${D.users.filter(u => u.active).length} de ${org?.seat_limit ?? '—'}. Ocupa un lugar cuando acepte.</div>
    <div class="rs-err" id="i-err"></div>
    <div class="rs-acts" style="justify-content:flex-end"><button class="btn sec" data-close>Cancelar</button><button class="btn" id="i-go">Crear invitación</button></div>`, S => {
      S.$('#i-go').onclick = async () => {
        const em = S.$('#i-m').value.trim(); if (!/^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/.test(em)) return void (S.$('#i-err').textContent = 'Revisá el mail.');
        S.$('#i-go').disabled = true;
        if (em.toLowerCase() !== (p.email || '').toLowerCase()) await sb.rpc('res_save_person', { p: { id: p.id, name: p.name, email: em } });
        const r = S.$('#i-r').value;
        const { data, error } = await sb.from('org_invites').insert({ org_id: me.org_id, email: em, full_name: p.name, role: r, contractor_id: r === 'contratista' ? p.company_id : null,
          project_ids: r === 'contratista' ? [] : D.PP.filter(x => x.staff_id === p.id && x.status === 'activa').map(x => x.project_id) }).select('*').single();
        if (error){ S.$('#i-err').textContent = errText(error); S.$('#i-go').disabled = false; return; }
        S.close(); inviteShare(data);
      };
    });
}

/* ---------- unificar duplicados (de a uno, con confirmación) ---------- */
function rsMerge(ids){
  const D = rsD(), list = ids.map(rsBy).filter(Boolean); if (list.length < 2) return;
  const score = p => (p.app ? 4 : 0) + (p.boss_id ? 1 : 0) + (p.phone ? 1 : 0) + rsNProj(p.id);
  list.sort((a, b) => score(b) - score(a));
  const desc = p => [rsCo(p.co).name, rsFuncTxt(p), p.app ? '📱 usa la app' : '', p.phone || '', p.base || '', rsNProj(p.id) ? rsPl(rsNProj(p.id), 'proyecto', 'proyectos') : ''].filter(Boolean).join(' · ');
  rsSheet(`<h2>👯 Unificar fichas</h2><div class="muted sm">Elegí la ficha que queda. La otra se da de baja y todo lo suyo pasa a la que queda: tareas, cuadrilla, proyectos, personas a cargo y la cuenta de la app. Su historial de horas y guardias queda guardado.</div>
    <div class="rs-pick">${list.map((p, i) => `<button type="button" data-keep="${p.id}" class="${i === 0 ? 'on' : ''}"><b>${esc(p.name)}</b><span>${esc(desc(p))}</span></button>`).join('')}</div>
    <div class="rs-err" id="m-err"></div>
    <div class="rs-acts" style="justify-content:flex-end"><button class="btn sec" data-close>Cancelar</button><button class="btn" id="m-ok">Unificar</button></div>`, S => {
      let keep = list[0].id;
      S.$$('[data-keep]').forEach(b => b.onclick = () => { keep = b.dataset.keep; S.$$('[data-keep]').forEach(x => x.classList.toggle('on', x === b)); });
      S.$('#m-ok').onclick = async () => {
        const drops = list.filter(p => p.id !== keep), k = rsBy(keep);
        if (drops.filter(p => p.app).length && k.app) return void (S.$('#m-err').textContent = 'Las dos fichas tienen cuenta de la app: desvinculá una antes de unificar (Mi empresa → Avanzado).');
        if (!confirm(`Queda "${k.name}" y se ${drops.length === 1 ? 'da de baja la otra ficha' : `dan de baja ${drops.length} fichas`}. ¿Seguir?`) || !needOnline()) return;
        S.$('#m-ok').disabled = true;
        for (const d of drops){ const { error } = await sb.rpc('res_merge', { p_keep: keep, p_drop: d.id }); if (error){ S.$('#m-err').textContent = errText(error); S.$('#m-ok').disabled = false; return; } }
        S.close(); toast(`Unificado: ${k.name} queda como una sola ficha.`); rsReload();
      };
    });
}

/* ---------- alcances: lista fija + agregar uno nuevo ---------- */
const rsScopePick = cur => `<div><div class="muted sm" style="font-weight:600;margin-bottom:4px">Alcance (qué hace en este proyecto · podés elegir varios)</div>
  <div class="rs-chips" id="a-scs">${[...new Set([...rsD().SCOPES, ...(cur || [])])].map(x => `<button type="button" data-sc="${esc(x)}" class="${(cur || []).includes(x) ? 'on' : ''}">${esc(x)}</button>`).join('')}${rsD().W ? '<button type="button" id="a-scn" style="border-style:dashed">＋ Otro alcance</button>' : ''}</div>
  <div id="a-scbox" class="hidden" style="display:flex;gap:6px;margin-top:6px"><input id="a-scv" maxlength="40" placeholder="Ej.: Poda, Pintura de torres" style="flex:1"><button type="button" class="btn small" id="a-scadd">Agregar a la lista</button></div></div>`;
function rsScopeBind(S){
  const tg = b => b.onclick = () => b.classList.toggle('on');
  S.$$('#a-scs [data-sc]').forEach(tg);
  S.$('#a-scn')?.addEventListener('click', () => { S.$('#a-scbox').classList.remove('hidden'); S.$('#a-scv').focus(); });
  S.$('#a-scadd')?.addEventListener('click', async () => {
    const v = S.$('#a-scv').value.trim().replace(/[<>"]/g, ''); if (!v || !needOnline()) return;
    const { data, error } = await sb.rpc('res_scope_add', { p: v }); if (error) return toast(errText(error));
    rsD().SCOPES = data || rsD().SCOPES;
    const same = (data || []).find(x => rsNorm(x) === rsNorm(v)) || v;
    let b = S.$$('#a-scs [data-sc]').find(x => x.dataset.sc === same);
    if (!b){ b = document.createElement('button'); b.type = 'button'; b.dataset.sc = same; b.textContent = same; tg(b); S.$('#a-scs').insertBefore(b, S.$('#a-scn')); }
    b.classList.add('on'); S.$('#a-scv').value = ''; S.$('#a-scbox').classList.add('hidden'); toast(`"${same}" quedó en la lista para todos los proyectos.`);
  });
}
const rsScopeVal = S => S.$$('#a-scs [data-sc].on').map(b => b.dataset.sc);

/* ---------- afectar personal propio a un proyecto ---------- */
function rsPPSheet(pid, prId){
  const D = rsD(); if (!D.W) return pid ? rsPerson(pid) : null;
  const x = pid && prId ? D.PP.find(y => y.staff_id === pid && y.project_id === prId) : null;
  const st = x ? { ...x } : { staff_id: pid || '', project_id: prId || '', scopes: [], date_from: todayStr(), date_to: '', status: 'activa' };
  const cand = D.P.filter(p => p.active && p.co === 'own');
  rsSheet(`<h2>${x ? '✏️ Afectación' : '＋ Afectar persona'}</h2>
    ${prId ? `<div class="muted sm">📁 ${esc(rsPr(prId).name)}</div>` : `<label>Proyecto<select id="a-pr">${D.projects.map(j => `<option value="${j.id}" ${D.PP.some(y => y.staff_id === pid && y.project_id === j.id) ? 'disabled' : ''}>${esc(j.name)}</option>`).join('')}</select></label>`}
    ${pid ? `<div class="muted sm">👤 ${esc(rsBy(pid)?.name || '')}</div>` : `<label>Persona<select id="a-p"><option value="">— Elegí —</option>${cand.map(p => `<option value="${p.id}" ${D.PP.some(y => y.staff_id === p.id && y.project_id === prId) ? 'disabled' : ''}>${esc(p.name)} · ${esc(rsFuncTxt(p))} · en ${rsPl(rsNProj(p.id), 'proyecto', 'proyectos')}</option>`).join('')}</select></label>
      <div class="muted sm">¿Es alguien nuevo (por ejemplo, un PM o un técnico que se suma mañana)? <button type="button" class="btn sec small" id="a-new">＋ Persona nueva</button> Queda en el organigrama y en el proyecto de una vez.</div>`}
    ${rsScopePick(st.scopes)}
    <div class="rs-two"><label>Desde<input id="a-fr" type="date" value="${esc(st.date_from || '')}"></label><label>Hasta<input id="a-to" type="date" value="${esc(st.date_to || '')}"></label></div>
    ${x ? `<label>Estado<select id="a-st"><option value="activa" ${st.status === 'activa' ? 'selected' : ''}>Activa</option><option value="finalizada" ${st.status === 'finalizada' ? 'selected' : ''}>Finalizada (queda en el historial)</option></select></label>` : ''}
    <div class="muted sm">Si usa la app, ve el proyecto en su celular. Se cuenta en cuántos proyectos participa.</div>
    <div class="rs-err" id="a-err"></div>
    <div class="rs-acts" style="justify-content:space-between">${x ? '<button class="btn sec small" id="a-del" style="color:var(--red)">Quitar del proyecto</button>' : '<span></span>'}<div class="rs-acts"><button class="btn sec" data-close>Cancelar</button><button class="btn" id="a-ok">${x ? 'Guardar' : 'Afectar'}</button></div></div>`, S => {
      rsScopeBind(S);
      S.$('#a-new')?.addEventListener('click', () => rsWizard({ project: prId }));
      S.$('#a-ok').onclick = async () => {
        const sid = pid || S.$('#a-p')?.value, pr = prId || S.$('#a-pr')?.value, sc = rsScopeVal(S);
        if (!sid) return void (S.$('#a-err').textContent = 'Elegí la persona.'); if (!pr) return void (S.$('#a-err').textContent = 'Elegí el proyecto.');
        if (!sc.length) return void (S.$('#a-err').textContent = 'Elegí al menos un alcance.');
        const fr = S.$('#a-fr').value || null, to = S.$('#a-to').value || null; if (fr && to && to < fr) return void (S.$('#a-err').textContent = 'La fecha "hasta" es anterior a "desde".');
        if (!needOnline()) return; S.$('#a-ok').disabled = true;
        const row = { scopes: sc, date_from: fr, date_to: to, status: S.$('#a-st')?.value || 'activa' };
        const { error } = x ? await sb.from('project_staff').update(row).eq('project_id', pr).eq('staff_id', sid) : await sb.from('project_staff').insert({ ...row, project_id: pr, staff_id: sid, org_id: me.org_id });
        if (error){ S.$('#a-err').textContent = errText(error); S.$('#a-ok').disabled = false; return; }
        S.close(); rsUncache(); await rsReload(); const p = rsBy(sid); toast(x ? 'Guardado' : `${p?.name}: ahora en ${rsPl(rsNProj(sid), 'proyecto', 'proyectos')}.`);
      };
      S.$('#a-del')?.addEventListener('click', async () => { if (!needOnline()) return;
        const { error } = await sb.from('project_staff').delete().eq('project_id', prId).eq('staff_id', pid); if (error) return void (S.$('#a-err').textContent = errText(error));
        S.close(); rsUncache(); rsReload(); toast('Quitado del proyecto', { label: 'Deshacer', fn: async () => { await sb.from('project_staff').insert({ project_id: x.project_id, staff_id: x.staff_id, org_id: me.org_id, scopes: x.scopes, date_from: x.date_from, date_to: x.date_to, status: x.status }); rsReload(); } }); });
    });
}
const rsUncache = () => { for (const k of ['projects', 'ps-all', 'proj-mem']) IDB.del('kv', CUR_UID + ':' + k).catch(() => {}); };

/* ---------- afectar una contratista a un proyecto ---------- */
function rsPCSheet(coId, prId){
  const D = rsD(); if (!D.W) return;
  const x = coId && prId ? D.PC.find(y => y.contractor_id === coId && y.project_id === prId) : null;
  const st = x ? { ...x } : { contractor_id: coId || '', project_id: prId || '', scopes: [], zone: '', date_from: todayStr(), date_to: '', resp_staff_id: '', status: 'activa', contract_ref: '' };
  rsSheet(`<h2>${x ? '✏️ Afectación' : '＋ Afectar contratista'}</h2>
    ${prId ? `<div class="muted sm">📁 ${esc(rsPr(prId).name)}</div>` : `<label>Proyecto<select id="a-pr">${D.projects.map(j => `<option value="${j.id}" ${D.PC.some(y => y.contractor_id === coId && y.project_id === j.id) ? 'disabled' : ''}>${esc(j.name)}</option>`).join('')}</select></label>`}
    ${coId ? `<div class="muted sm">🏗 ${esc(rsCo(coId).name)}</div>` : `<label>Contratista<select id="a-co"><option value="">— Elegí —</option>${D.COS.filter(c => c.active).map(c => `<option value="${c.id}" ${D.PC.some(y => y.contractor_id === c.id && y.project_id === prId) ? 'disabled' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
      <div class="muted sm">¿No está? <button type="button" class="btn sec small" id="a-newco">🏗 ＋ Contratista nueva</button></div>`}
    ${rsScopePick(st.scopes)}
    <label>Zona / traza / sitios<input id="a-zo" value="${esc(st.zone || '')}" maxlength="200" placeholder="Ej.: Traza 4 y 6, Santa Fe norte"></label>
    <div class="rs-two"><label>Desde<input id="a-fr" type="date" value="${esc(st.date_from || '')}"></label><label>Hasta<input id="a-to" type="date" value="${esc(st.date_to || '')}"></label></div>
    <div class="rs-two"><label>Responsable nuestro<select id="a-re"><option value="">—</option>${D.P.filter(p => p.active && p.co === 'own' && !['tecnico', 'ayudante', 'chofer'].includes(p.func)).map(p => `<option value="${p.id}" ${st.resp_staff_id === p.id ? 'selected' : ''}>${esc(p.name)} · ${esc(rsFuncTxt(p))}</option>`).join('')}</select></label>
      <label>N° de contrato / OC<input id="a-oc" value="${esc(st.contract_ref || '')}" maxlength="80" placeholder="Ej.: OC 4500012345"></label></div>
    ${x ? `<label>Estado<select id="a-st"><option value="activa" ${st.status === 'activa' ? 'selected' : ''}>Activa</option><option value="finalizada" ${st.status === 'finalizada' ? 'selected' : ''}>Finalizada (queda en el historial)</option></select></label>` : ''}
    <div class="muted sm">Mientras esté activa, la contratista ve este proyecto en su app, aparece en el equipo del proyecto y se le asignan sus tareas y sitios.</div>
    <div class="rs-err" id="a-err"></div>
    <div class="rs-acts" style="justify-content:space-between">${x ? '<button class="btn sec small" id="a-del" style="color:var(--red)">Quitar del proyecto</button>' : '<span></span>'}<div class="rs-acts"><button class="btn sec" data-close>Cancelar</button><button class="btn" id="a-ok">${x ? 'Guardar' : 'Afectar'}</button></div></div>`, S => {
      rsScopeBind(S);
      S.$('#a-newco')?.addEventListener('click', () => rsCoSheet(null, prId));
      S.$('#a-ok').onclick = async () => {
        const co = coId || S.$('#a-co')?.value, pr = prId || S.$('#a-pr')?.value, sc = rsScopeVal(S);
        if (!co) return void (S.$('#a-err').textContent = 'Elegí la contratista.'); if (!pr) return void (S.$('#a-err').textContent = 'Elegí el proyecto.');
        if (!sc.length) return void (S.$('#a-err').textContent = 'Elegí al menos un alcance.');
        const fr = S.$('#a-fr').value || null, to = S.$('#a-to').value || null; if (fr && to && to < fr) return void (S.$('#a-err').textContent = 'La fecha "hasta" es anterior a "desde".');
        if (!needOnline()) return; S.$('#a-ok').disabled = true;
        const row = { scopes: sc, zone: S.$('#a-zo').value.trim() || null, date_from: fr, date_to: to, resp_staff_id: S.$('#a-re').value || null, contract_ref: S.$('#a-oc').value.trim() || null, status: S.$('#a-st')?.value || 'activa' };
        const { error } = x ? await sb.from('project_contractors').update(row).eq('project_id', pr).eq('contractor_id', co) : await sb.from('project_contractors').insert({ ...row, project_id: pr, contractor_id: co, org_id: me.org_id });
        if (error){ S.$('#a-err').textContent = errText(error); S.$('#a-ok').disabled = false; return; }
        S.close(); rsUncache(); toast(x ? 'Guardado' : `${rsCo(co).name} afectada a ${rsPr(pr).name}. Ya ve el proyecto en su app.`); rsReload();
      };
      S.$('#a-del')?.addEventListener('click', async () => {
        const n = D.stat(coId, prId).sites;
        if (!confirm(n ? `${rsCo(coId).name} tiene ${rsPl(n, 'sitio asignado', 'sitios asignados')} en este proyecto: quedan sin asignar y deja de ver el proyecto. ¿Seguir?` : `¿Quitar a ${rsCo(coId).name} del proyecto?`) || !needOnline()) return;
        if (n){ const { error } = await sb.from('project_sites').update({ contractor_id: null, last_reason: 'Se quitó la contratista del proyecto' }).eq('project_id', prId).eq('contractor_id', coId); if (error) return void (S.$('#a-err').textContent = errText(error)); }
        const { error } = await sb.from('project_contractors').delete().eq('project_id', prId).eq('contractor_id', coId); if (error) return void (S.$('#a-err').textContent = errText(error));
        S.close(); rsUncache(); toast('Quitada del proyecto'); rsReload(); });
    });
}

/* ---------- contratista: alta o datos ---------- */
function rsCoSheet(coId, prId){
  const D = rsD(), c = coId ? rsCo(coId) : null, W = D.W;
  const bosses = D.P.filter(p => p.active && p.co === 'own' && !['tecnico', 'ayudante', 'chofer'].includes(p.func));
  const ppl = c ? D.P.filter(p => p.active && p.co === c.id) : [];
  rsSheet(`<div class="row between" style="flex-wrap:nowrap"><h2>🏗 ${c ? esc(c.name) : '＋ Contratista'}</h2><button class="btn sec small" data-close>Cerrar</button></div>
    <label>Nombre de la empresa<input id="c-n" maxlength="120" value="${esc(c?.name || '')}" ${W ? '' : 'disabled'}></label>
    <div class="rs-two"><label>Teléfono / WhatsApp<input id="c-ph" maxlength="30" value="${esc(c?.phone || '')}" ${W ? '' : 'disabled'}></label><label>Contacto<input id="c-ct" maxlength="120" value="${esc(c?.contact_name || '')}" ${W ? '' : 'disabled'}></label></div>
    <label>La maneja (de quién depende)<select id="c-b" ${W ? '' : 'disabled'}><option value="">—</option>${bosses.map(x => `<option value="${x.id}" ${c?.boss_staff_id === x.id ? 'selected' : ''}>${esc(x.name)} · ${esc(rsFuncTxt(x))}</option>`).join('')}</select></label>
    ${c ? `<div class="rs-blk"><h3>👷 Su gente <span class="muted sm" style="font-weight:400">${ppl.length}</span></h3>${ppl.map(p => `<button type="button" class="rs-inv" data-op="${p.id}"><b>${esc(p.name)}</b><span class="m">${esc(rsFuncTxt(p))}${p.phone ? ' · ' + esc(p.phone) : ''}</span></button>`).join('') || '<div class="muted sm">Sin personas cargadas.</div>'}
        ${W ? '<div><button class="btn sec small" id="c-addp">＋ Persona de esta contratista</button></div>' : ''}</div>
      <div class="rs-blk"><h3>📁 Proyectos</h3>${D.PC.filter(x => x.contractor_id === c.id).map(x => `<button type="button" class="rs-inv ${x.status === 'finalizada' ? 'fin' : ''}" data-cpc="${x.project_id}"><b>${esc(rsPr(x.project_id).name)}</b><span class="m">${esc(rsScTxt(x.scopes))}${x.contract_ref ? ' · 📄 ' + esc(x.contract_ref) : ''}${x.status === 'finalizada' ? ' · finalizada' : ''}</span></button>`).join('') || '<div class="muted sm">No está afectada a ningún proyecto.</div>'}
        ${W ? '<div><button class="btn sec small" id="c-addpc">＋ Afectar a un proyecto</button></div>' : ''}</div>`
      : '<label>Responsable de la contratista<input id="c-r" maxlength="120" placeholder="Nombre y apellido (opcional)"></label><div class="muted sm">Después sumás a su gente con ＋ Persona, eligiendo esta empresa.</div>'}
    <div class="rs-err" id="c-err"></div>
    ${W ? `<div class="rs-acts" style="justify-content:${c ? 'space-between' : 'flex-end'}">${c ? '<button class="btn sec small" id="c-off" style="color:var(--red)">Dar de baja</button>' : ''}<button class="btn" id="c-ok">${c ? 'Guardar' : 'Crear'}</button></div>` : ''}`, S => {
      S.$$('[data-op]').forEach(b => b.onclick = () => rsPerson(b.dataset.op));
      S.$$('[data-cpc]').forEach(b => b.onclick = () => rsPCSheet(c.id, b.dataset.cpc));
      S.$('#c-addp')?.addEventListener('click', () => rsWizard({ co: c.id }));
      S.$('#c-addpc')?.addEventListener('click', () => rsPCSheet(c.id, ''));
      S.$('#c-off')?.addEventListener('click', async () => { if (!confirm(`¿Dar de baja a ${c.name}? Deja de aparecer para asignar tareas. No se borra el historial.`) || !needOnline()) return;
        const { error } = await sb.from('contractors').update({ active: false }).eq('id', c.id); if (error) return void (S.$('#c-err').textContent = errText(error)); S.close(); toast('Contratista dada de baja'); rsReload(); });
      S.$('#c-ok')?.addEventListener('click', async () => {
        const n = S.$('#c-n').value.trim().replace(/[<>]/g, ''); if (!n) return void (S.$('#c-err').textContent = 'Falta el nombre.');
        const same = D.COS.find(x => x.id !== c?.id && rsNorm(x.name) === rsNorm(n));
        if (same) return void (S.$('#c-err').textContent = `Ya existe la contratista "${same.name}"${same.active ? '' : ' (dada de baja: reactivala desde Avanzado)'}.`);
        if (!needOnline()) return; S.$('#c-ok').disabled = true;
        const row = { name: n, phone: S.$('#c-ph').value.trim() || null, contact_name: S.$('#c-ct').value.trim() || null };
        let id = c?.id;
        const r = c ? await sb.from('contractors').update(row).eq('id', c.id) : await sb.from('contractors').insert({ ...row, org_id: me.org_id, active: true }).select('id').single();
        if (r.error){ S.$('#c-err').textContent = errText(r.error); S.$('#c-ok').disabled = false; return; }
        if (!c) id = r.data.id;
        const b = S.$('#c-b').value || null;
        if ((c?.boss_staff_id || null) !== b){ const { error } = await sb.rpc('res_set_co_boss', { p_contr: id, p_staff: b }); if (error) toast(errText(error)); }
        const resp = S.$('#c-r')?.value.trim();
        if (resp) await sb.rpc('res_save_person', { p: { name: resp, company_id: id, func: 'responsable', tasks: false, phone: row.phone } });
        if (!c && prId) await sb.from('project_contractors').insert({ project_id: prId, contractor_id: id, org_id: me.org_id });
        IDB.del('kv', CUR_UID + ':contractors').catch(() => {});
        S.close(); toast(c ? 'Guardado' : `${n} creada.`); await rsReload();
        if (!c && prId) rsPCSheet(id, prId);
      });
    });
}

/* ---------- asistente: agregar persona (opcional: directo a un proyecto) ---------- */
function rsWizard(opt = {}){
  const D = rsD(); if (!D.W) return;
  const st = { step: 1, name: '', phone: '', email: '', co: opt.co || 'own', boss: '', func: 'tecnico', tasks: true, invite: false, projects: opt.project ? [opt.project] : [], scopes: [] };
  const draw = () => {
    const ct = st.co !== 'own';
    rsSheet(`<h2>＋ Agregar persona</h2><div class="rs-steps"><span class="on"></span><span class="${st.step >= 2 ? 'on' : ''}"></span><span class="${st.step >= 3 ? 'on' : ''}"></span></div>
      ${st.step === 1 ? `<div class="muted sm">Paso 1 de 3 · ¿Quién es?</div>
        <label>Nombre y apellido<input id="w-n" value="${esc(st.name)}" maxlength="120" autocomplete="off"></label><div id="w-dup" class="sm" style="color:var(--amber)"></div>
        <div class="rs-two"><label>Teléfono / WhatsApp<input id="w-ph" value="${esc(st.phone)}" maxlength="30" inputmode="tel"></label><label>Mail (para la app)<input id="w-em" type="email" value="${esc(st.email)}" maxlength="200"></label></div>
        <div class="muted sm" style="font-weight:600">¿De qué empresa es?</div>
        <div class="rs-pick"><button type="button" data-wco="own" class="${st.co === 'own' ? 'on' : ''}"><b>🏢 ${esc(rsCo('own').name)}</b><span>Personal propio</span></button>${D.COS.filter(c => c.active).map(c => `<button type="button" data-wco="${c.id}" class="${st.co === c.id ? 'on' : ''}"><b>🏗 ${esc(c.name)}</b><span>Contratista</span></button>`).join('')}</div>`
      : st.step === 2 ? `<div class="muted sm">Paso 2 de 3 · ¿Qué hace y de quién depende?</div>
        <label>Función${rsFuncSel('w-fn', st.func)}</label>
        <div class="muted sm" style="font-weight:600">Depende de</div>
        <div class="rs-pick">${D.P.filter(x => x.active && (ct ? x.co === st.co || x.co === 'own' : x.co === 'own') && !['tecnico', 'ayudante', 'chofer'].includes(x.func)).map(x => `<button type="button" data-wb="${x.id}" class="${st.boss === x.id ? 'on' : ''}"><b>${esc(x.name)}</b><span>${esc(rsFuncTxt(x))}${x.co !== 'own' ? ' · ' + esc(rsCo(x.co).name) : ''}</span></button>`).join('')}
          <button type="button" data-wb="" class="${st.boss === '' ? 'on' : ''}"><b>Nadie</b><span>Encabeza su grupo</span></button></div>`
      : `<div class="muted sm">Paso 3 de 3 · ¿Dónde trabaja?</div>
        <div class="rs-blk"><div class="rs-sw"><span>📋 <b>Recibe tareas</b><br><span class="muted sm">Aparece en la Agenda y en la Mesa</span></span>${rsTog('w-tk', st.tasks)}</div></div>
        <div class="rs-blk"><div class="rs-sw"><span>📱 <b>Invitarlo a la app</b><br><span class="muted sm">${st.email ? 'Le llega un link a ' + esc(st.email) : 'Necesita un mail (paso 1)'} · ocupa 1 lugar del cupo (${D.users.filter(u => u.active).length} de ${org?.seat_limit ?? '—'})</span></span>${rsTog('w-inv', st.invite && !!st.email, !st.email)}</div></div>
        ${ct ? `<div class="muted sm">Los proyectos de una contratista se manejan por empresa (🔗 Proyectos).</div>` : `<div class="rs-blk"><h3>📁 Proyectos</h3><div class="rs-chips" id="w-prs">${D.projects.map(j => `<button type="button" data-wp="${j.id}" class="${st.projects.includes(j.id) ? 'on' : ''}">${esc(j.name)}</button>`).join('') || '<span class="muted sm">No hay proyectos activos.</span>'}</div>
          <div id="w-scw" class="${st.projects.length ? '' : 'hidden'}">${rsScopePick(st.scopes)}</div></div>`}`}
      <div class="rs-err" id="w-err"></div>
      <div class="rs-acts" style="justify-content:space-between"><button class="btn sec" id="w-back">${st.step === 1 ? 'Cancelar' : '← Atrás'}</button><button class="btn" id="w-next">${st.step === 3 ? 'Agregar' : 'Siguiente →'}</button></div>`, S => {
        const keep1 = () => { if (st.step === 1){ st.name = S.$('#w-n').value.trim(); st.phone = S.$('#w-ph').value.trim(); st.email = S.$('#w-em').value.trim(); } };
        const dupChk = () => { const n = rsNorm(S.$('#w-n')?.value); const d = n && D.P.find(x => rsNorm(x.name) === n); if (S.$('#w-dup')) S.$('#w-dup').innerHTML = d ? `⚠ Ya existe <b>${esc(d.name)}</b> (${esc(rsCo(d.co).name)}${d.active ? '' : ', dado de baja'}). Si es la misma persona, se usa esa ficha.` : ''; };
        S.$('#w-n')?.addEventListener('input', dupChk); dupChk();
        S.$$('[data-wco]').forEach(b => b.onclick = () => { keep1(); st.co = b.dataset.wco; st.boss = ''; if (st.co !== 'own' && st.func === 'tecnico') st.func = 'tecnico'; draw(); });
        S.$$('[data-wb]').forEach(b => b.onclick = () => { st.func = S.$('#w-fn').value; st.boss = b.dataset.wb; draw(); });
        S.$$('[data-wp]').forEach(b => b.onclick = () => { b.classList.toggle('on'); const on = S.$$('[data-wp].on').length; S.$('#w-scw').classList.toggle('hidden', !on); });
        if (st.step === 3 && !ct) rsScopeBind(S);
        S.$('#w-back').onclick = () => { if (st.step === 1) return S.close(); if (st.step === 2) st.func = S.$('#w-fn').value; st.step--; draw(); };
        S.$('#w-next').onclick = async () => {
          if (st.step === 1){ keep1(); if (!st.name){ S.$('#w-n').focus(); return void (S.$('#w-err').textContent = 'Falta el nombre.'); }
            if (st.email && !/^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/.test(st.email)) return void (S.$('#w-err').textContent = 'Revisá el mail (o dejalo vacío).'); st.invite = !!st.email; }
          if (st.step === 2) st.func = S.$('#w-fn').value || null;
          if (st.step < 3){ st.step++; return draw(); }
          st.tasks = S.$('#w-tk').checked; st.invite = !!S.$('#w-inv')?.checked;
          const prs = ct ? [] : S.$$('[data-wp].on').map(b => b.dataset.wp), sc = ct ? [] : rsScopeVal(S);
          if (prs.length && !sc.length) return void (S.$('#w-err').textContent = 'Elegí al menos un alcance para el proyecto.');
          if (!needOnline()) return; S.$('#w-next').disabled = true;
          const { data: sid, error } = await sb.rpc('res_save_person', { p: { name: st.name, phone: st.phone, email: st.email, func: st.func, boss_id: st.boss || null, company_id: ct ? st.co : null, tasks: st.tasks } });
          if (error){ S.$('#w-err').textContent = errText(error); S.$('#w-next').disabled = false; return; }
          for (const pr of prs){ const { error: e2 } = await sb.from('project_staff').upsert({ project_id: pr, staff_id: sid, org_id: me.org_id, scopes: sc, date_from: todayStr(), status: 'activa' }); if (e2) toast(errText(e2)); }
          if (ct && opt.project) await sb.from('project_contractors').insert({ project_id: opt.project, contractor_id: st.co, org_id: me.org_id }).then(() => {}, () => {});
          if (prs.length) rsUncache();
          S.close(); await rsReload();
          toast(`${st.name} agregado${prs.length ? ` y afectado a ${rsPl(prs.length, 'proyecto', 'proyectos')}` : ''}.`);
          if (st.invite) rsInvite(rsBy(sid), st.email);
        };
      });
  };
  draw();
}

/* ---------- Excel: exportar y cargar ---------- */
const RS_COLS = ['Nombre', 'Teléfono', 'Email', 'Empresa', 'Función', 'Depende de', 'Base', 'Proyectos', 'Alcance'];
async function rsExport(){
  try { await needLib('xlsx'); } catch (e){ return toast(errText(e)); }
  const D = rsD();
  const rows = D.P.filter(p => p.active).sort((a, b) => (a.co === 'own' ? 0 : 1) - (b.co === 'own' ? 0 : 1) || a.name.localeCompare(b.name, 'es')).map(p => {
    const prs = p.co === 'own' ? D.PP.filter(x => x.staff_id === p.id && x.status === 'activa') : D.PC.filter(x => x.contractor_id === p.co && x.status === 'activa');
    return [p.name, p.phone || '', p.email || '', rsCo(p.co).name, RS_FUNC[p.func] || '', p.boss_id ? rsBy(p.boss_id)?.name || '' : '', p.base || '',
      prs.map(x => rsPr(x.project_id).name).join('; '), [...new Set(prs.flatMap(x => x.scopes || []))].join(', ')]; });
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([RS_COLS, ...rows]); ws['!cols'] = [{ wch: 26 }, { wch: 15 }, { wch: 26 }, { wch: 22 }, { wch: 16 }, { wch: 24 }, { wch: 16 }, { wch: 30 }, { wch: 34 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Recursos');
  const ref = [['Funciones válidas', 'Alcances válidos'], ...Array.from({ length: Math.max(Object.keys(RS_FUNC).length, D.SCOPES.length) }, (_, i) => [Object.values(RS_FUNC)[i] || '', D.SCOPES[i] || ''])];
  const w2 = XLSX.utils.aoa_to_sheet(ref); w2['!cols'] = [{ wch: 24 }, { wch: 30 }]; XLSX.utils.book_append_sheet(wb, w2, 'Listas');
  XLSX.writeFile(wb, `Recursos_${todayStr()}.xlsx`);
}
async function rsImport(projectId){
  const D = rsD(); if (!D.W || !needOnline()) return;
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.xlsx,.xls,.csv';
  inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return;
    if (f.size > 8 * 1024 * 1024) return toast('El archivo es muy grande (máximo 8 MB).');
    try { await needLib('xlsx'); } catch (e){ return toast(errText(e)); }
    let wb; try { wb = XLSX.read(await f.arrayBuffer()); } catch { return toast('No pude leer el archivo. Subí un .xlsx o .csv.'); }
    const ws = wb.Sheets['Recursos'] || wb.Sheets[wb.SheetNames[0]];
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
    const hi = aoa.findIndex(r => r.some(c => /^nombre/i.test(rsNorm(c))));
    if (hi < 0) return toast('No encontré la columna "Nombre". Bajá la planilla con ⬇ Excel y usala de modelo.');
    const H = aoa[hi].map(rsNorm);
    const col = re => H.findIndex(h => re.test(h));
    const C = { name: col(/^nombre|apellido/), phone: col(/tel|celu|whats|movil/), email: col(/mail|correo/), company: col(/empresa|contratista|compan/), func: col(/funci|rol|puesto|cargo/),
      boss: col(/depende|jefe|superior|responsable de|reporta/), base: col(/^base|zona|localidad/), projects: col(/proyect/), scopes: col(/alcance|tarea|scope/) };
    const val = (r, k) => C[k] >= 0 ? String(r[C[k]] ?? '').replace(/[<>]/g, '').trim() : '';
    // filas → sin repetidos (misma persona dos veces en el archivo = una sola, se juntan sus proyectos y alcances)
    const byKey = new Map(), probs = [];
    aoa.slice(hi + 1).forEach((r, i) => {
      const name = val(r, 'name').replace(/\s+/g, ' '); if (!name) return;
      const em = val(r, 'email').toLowerCase();
      const row = { name: name.slice(0, 120), phone: val(r, 'phone').slice(0, 30), email: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em) ? em : '', company: val(r, 'company').slice(0, 120),
        func: rsFuncOf(val(r, 'func')), funcTxt: val(r, 'func'), boss: val(r, 'boss').slice(0, 120), base: val(r, 'base').slice(0, 120), projects: val(r, 'projects'), scopes: val(r, 'scopes'), line: hi + 2 + i };
      if (em && !row.email) probs.push(`Fila ${row.line}: el mail "${em}" no es válido (se ignora).`);
      const k = rsNorm(name), prev = byKey.get(k);
      if (prev){ for (const f2 of ['phone', 'email', 'company', 'func', 'boss', 'base']) prev[f2] ||= row[f2];
        prev.projects = [prev.projects, row.projects].filter(Boolean).join('; '); prev.scopes = [prev.scopes, row.scopes].filter(Boolean).join(', '); prev.dup = true; }
      else byKey.set(k, row);
    });
    const rows = [...byKey.values()]; if (!rows.length) return toast('El archivo no tiene personas.');
    if (rows.length > 1000) return toast('Máximo 1000 personas por archivo.');
    const own = rsNorm(rsCo('own').name);
    const isOwn = c => !c || ['propia', 'propio'].includes(rsNorm(c)) || rsNorm(c) === own || (own && rsNorm(c).includes(own));
    const pNames = new Set(D.allProjects.map(p => rsNorm(p.name)));
    const sNames = new Set(D.SCOPES.map(rsNorm));
    const newCos = new Set();
    rows.forEach(r => {
      const ex = D.P.find(x => !x.merged_into && (rsNorm(x.name) === rsNorm(r.name) || (r.email && (x.email || '').toLowerCase() === r.email)));
      r.st = ex ? 'upd' : 'new';
      if (!isOwn(r.company) && !D.COS.some(c => rsNorm(c.name) === rsNorm(r.company))) newCos.add(r.company);
      if (r.funcTxt && r.func === 'otro' && rsNorm(r.funcTxt) !== 'otro') probs.push(`${r.name}: la función "${r.funcTxt}" no está en la lista; queda como "Otro".`);
      if (r.boss && !rows.some(y => rsNorm(y.name) === rsNorm(r.boss)) && !D.P.some(y => rsNorm(y.name) === rsNorm(r.boss))) probs.push(`${r.name}: no encuentro a "${r.boss}" (depende de).`);
      r.projects.split(/[;\n]/).map(s => s.trim()).filter(Boolean).forEach(pn => { if (!pNames.has(rsNorm(pn))) probs.push(`${r.name}: no existe el proyecto "${pn}".`); });
      r.scopes.split(/[,;/]/).map(s => s.trim()).filter(Boolean).forEach(sn => { if (!sNames.has(rsNorm(sn))) probs.push(`${r.name}: el alcance "${sn}" no está en la lista (se ignora; agregalo antes con "＋ Otro alcance").`); });
    });
    const nNew = rows.filter(r => r.st === 'new').length, nUpd = rows.length - nNew, nDup = rows.filter(r => r.dup).length;
    rsSheet(`<h2>⬆ Cargar recursos desde Excel</h2>${projectId ? `<div class="muted sm">📁 Todos quedan afectados a <b>${esc(rsPr(projectId).name)}</b>.</div>` : ''}
      <div class="rs-kpis" style="margin:0"><div class="rs-kpi"><span class="t">Nuevas</span><span class="n">${nNew}</span></div><div class="rs-kpi"><span class="t">Ya existen (se actualizan)</span><span class="n">${nUpd}</span></div>${newCos.size ? `<div class="rs-kpi"><span class="t">Contratistas nuevas</span><span class="n">${newCos.size}</span></div>` : ''}</div>
      ${nDup ? `<div class="muted sm">👯 ${rsPl(nDup, 'persona aparecía', 'personas aparecían')} más de una vez en el archivo: se cargan una sola vez.</div>` : ''}
      <div class="muted sm">No se duplica nadie: si el nombre (o el mail) ya existe, se completa esa ficha. Lo que viene vacío no borra lo que ya está.</div>
      <div class="tblwrap rs-prev"><table class="tbl"><thead><tr><th></th><th>Nombre</th><th>Empresa</th><th>Función</th><th>Depende de</th><th>Proyectos</th></tr></thead><tbody>
        ${rows.slice(0, 300).map(r => `<tr><td>${r.st === 'new' ? '<span class="rs-ic on">nueva</span>' : '<span class="rs-ic">actualiza</span>'}</td><td><b>${esc(r.name)}</b><div class="muted sm">${esc([r.phone, r.email].filter(Boolean).join(' · '))}</div></td><td>${esc(isOwn(r.company) ? rsCo('own').name : r.company)}</td><td>${esc(RS_FUNC[r.func] || '—')}</td><td>${esc(r.boss || '—')}</td><td class="sm">${esc(r.projects || '—')}</td></tr>`).join('')}
        ${rows.length > 300 ? `<tr><td colspan="6" class="muted">y ${rows.length - 300} más…</td></tr>` : ''}</tbody></table></div>
      ${probs.length ? `<details ${probs.length < 8 ? 'open' : ''}><summary class="sm" style="color:var(--amber);cursor:pointer">⚠ ${rsPl(probs.length, 'cosa para revisar', 'cosas para revisar')} (igual se puede cargar)</summary><ul class="sm">${probs.slice(0, 80).map(p => `<li>${esc(p)}</li>`).join('')}</ul></details>` : ''}
      <div class="rs-err" id="x-err"></div>
      <div class="rs-acts" style="justify-content:flex-end"><button class="btn sec" data-close>Cancelar</button><button class="btn" id="x-ok">Cargar ${rows.length}</button></div>`, S => {
        S.$('#x-ok').onclick = async () => {
          if (!needOnline()) return; S.$('#x-ok').disabled = true; S.$('#x-ok').textContent = 'Cargando…';
          const payload = rows.map(r => ({ name: r.name, phone: r.phone || null, email: r.email || null, company: isOwn(r.company) ? (r.company ? 'propia' : null) : r.company, func: r.func, boss: r.boss || null, base: r.base || null, projects: r.projects || null, scopes: r.scopes || null }))
            .map(o => Object.fromEntries(Object.entries(o).filter(([, x]) => x != null && x !== '')));
          const tot = { nuevos: 0, actualizados: 0, empresas: 0, afectaciones: 0, problemas: [] };
          for (let i = 0; i < payload.length; i += 300){
            const { data, error } = await sb.rpc('res_import', { p_rows: payload.slice(i, i + 300), p_project: projectId || null });
            if (error){ S.$('#x-err').textContent = errText(error); S.$('#x-ok').disabled = false; S.$('#x-ok').textContent = 'Reintentar'; return; }
            for (const k of ['nuevos', 'actualizados', 'empresas', 'afectaciones']) tot[k] += data?.[k] || 0; tot.problemas.push(...(data?.problemas || []));
          }
          rsUncache(); IDB.del('kv', CUR_UID + ':contractors').catch(() => {});
          S.close(); await rsReload();
          rsSheet(`<h2>✅ Recursos cargados</h2><div class="rs-kpis" style="margin:0"><div class="rs-kpi"><span class="t">Nuevas</span><span class="n">${tot.nuevos}</span></div><div class="rs-kpi"><span class="t">Actualizadas</span><span class="n">${tot.actualizados}</span></div><div class="rs-kpi"><span class="t">Contratistas nuevas</span><span class="n">${tot.empresas}</span></div><div class="rs-kpi"><span class="t">Afectaciones a proyectos</span><span class="n">${tot.afectaciones}</span></div></div>
            ${tot.problemas.length ? `<div class="rs-alerts" style="margin:0"><b>⚠ No se pudo completar</b><ul class="sm" style="margin:0">${tot.problemas.slice(0, 60).map(p => `<li>${esc(p.nombre || '')}: ${esc(p.motivo || '')}</li>`).join('')}</ul></div>` : ''}
            <div class="rs-acts" style="justify-content:flex-end"><button class="btn" data-close>Listo</button></div>`);
        };
      });
  };
  inp.click();
}
