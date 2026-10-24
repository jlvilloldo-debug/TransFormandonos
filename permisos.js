/* =====================================================================
   InspectApp · Transformándonos — v4.6
   Permisos por módulo. Los define el administrador (o el coordinador que él designe).
   El servidor aplica los permisos sensibles (IP/VLAN, vehículos, infracciones);
   acá se ocultan pestañas y botones según el mismo criterio.
   Este archivo solo declara funciones: no ejecuta nada al cargarse.
   ===================================================================== */

const PERM_MODS = ['insp', 'tasks', 'proj', 'map', 'sites', 'stats', 'tpl', 'org', 'fibra', 'dc', 'dc_net', 'horas', 'rrhh', 'veh', 'veh_inf'];
const PERM_NAMES = { insp: 'Inspecciones', tasks: 'Tareas', proj: 'Proyectos', map: 'Mapa', sites: 'Sitios', stats: 'Estadísticas', tpl: 'Plantillas', org: 'Mi empresa (usuarios)',
  fibra: 'Herramienta de fibra', dc: 'Relevamiento DC', dc_net: 'DC: IP / VLAN / redes', horas: 'Horas y tareas', rrhh: 'Reporte RRHH y guardias', veh: 'Vehículos (jornadas)', veh_inf: 'Infracciones' };
const PERM_LV = ['No ve', 'Ve', 'Carga', 'Gestiona'];
const PERM_ROLES = { supervisor: 'Supervisor', pm: 'PM', coordinador: 'Coordinador', inspector: 'Técnico', contratista: 'Contratista' };
const PERM_TAB = { map: 'map', proj: 'proj', insp: 'insp', tasks: 'tasks', stats: 'stats', sites: 'sites', tpl: 'tpl', org: 'org' };
let PERMS = null;

function permDefault(role, mod){
  if (role === 'admin') return 3;
  if (['supervisor', 'pm', 'coordinador'].includes(role)) return mod === 'dc_net' ? 0 : 3;
  if (role === 'inspector') return { insp: 2, tasks: 2, proj: 1, map: 1, sites: 1, tpl: 1, fibra: 2, dc: 2, horas: 2, veh: 2 }[mod] || 0;
  if (role === 'contratista') return { insp: 2, tasks: 2, proj: 1, map: 1, fibra: 2, dc: 2, horas: 2, veh: 2 }[mod] || 0;
  return 0;
}
async function permLoad(){ try { PERMS = await cached('perms', () => sb.rpc('perm_my')); } catch { PERMS = PERMS || null; } }
function can(mod, lvl = 1){
  if (!me) return false; if (me.role === 'admin') return true;
  const l = PERMS?.levels?.[mod]; return (l ?? permDefault(me.role, mod)) >= lvl;
}
const permCanManage = () => me && (me.role === 'admin' || !!PERMS?.manage);
function permApplyTabs(){
  for (const [t, m] of Object.entries(PERM_TAB)){ const b = document.querySelector(`#tabs [data-tab="${t}"]`); if (b && !can(m)) b.classList.add('hidden'); }
}
function permOk(tab, id){
  if (tab === 'perms') return permCanManage();
  if (PERM_TAB[tab]) return can(PERM_TAB[tab]);
  if (tab === 'tools'){ if (id === 'dc') return can('dc'); if (id === 'hh') return can('horas'); if (id === 'veh') return can('veh') || can('veh_inf'); if (id) return can('fibra'); }
  return true;
}

/* ---------- pantalla de permisos ---------- */
async function viewPerms(v){
  if (!needOnline()){ v.innerHTML = '<div class="card">Necesita señal.</div>'; return; }
  await permLoad();
  if (!permCanManage()){ v.innerHTML = '<div class="card"><b>Solo el administrador (o el coordinador que él designe) maneja los permisos.</b></div>'; return; }
  const [roles, users, profs, log] = await Promise.all([
    sb.from('perm_role').select('role,module,level').then(r => r.data || []),
    sb.from('perm_user').select('user_id,module,level').then(r => r.data || []),
    sb.from('profiles').select('id,full_name,email,role,active').order('full_name').then(r => r.data || []),
    sb.from('perm_log').select('at,by_name,what').order('at', { ascending: false }).limit(40).then(r => r.data || []),
  ]);
  const isAdm = me.role === 'admin';
  const R = (role, m) => roles.find(x => x.role === role && x.module === m);
  const sel = (attrs, cur, def) => `<select ${attrs} style="width:auto;padding:4px 6px;font-size:12px;${cur != null ? 'border-color:var(--navy-2);font-weight:600' : ''}"><option value="">Por defecto (${PERM_LV[def]})</option>${PERM_LV.map((n, i) => `<option value="${i}" ${cur === i ? 'selected' : ''}>${n}</option>`).join('')}</select>`;
  const coords = profs.filter(p => p.role === 'coordinador' && p.active);
  const others = profs.filter(p => p.role !== 'admin' && p.active);
  let uSel = HHS?.permUser || others[0]?.id || '';
  v.innerHTML = `<div class="row between" style="margin-bottom:8px"><button class="btn sec small" id="pm-back">← Mi empresa</button></div>
    <div class="card"><h2 style="margin:0">🔐 Permisos por módulo</h2><p class="muted sm" style="margin:6px 0 0">El administrador siempre ve todo. Los cambios rigen la próxima vez que cada usuario abre la app. IP/VLAN, vehículos e infracciones los controla además el servidor.</p></div>
    <div class="card"><h2 style="margin:0 0 6px">Quién maneja los permisos</h2>
      ${isAdm ? `<div class="row"><select id="pm-del" style="width:auto"><option value="">Solo el administrador</option>${coords.map(p => `<option value="${esc(p.id)}" ${PERMS?.delegate === p.id ? 'selected' : ''}>${esc(p.full_name || p.email)} (coordinador)</option>`).join('')}</select><button class="btn small" id="pm-dels">Guardar</button></div>
        <p class="muted sm" style="margin:6px 0 0">Podés designar a un solo coordinador. No puede cambiar sus propios permisos ni los del administrador.</p>`
      : `<p class="sm">Te designó el administrador para manejar los permisos. No podés cambiar los tuyos ni los del administrador.</p>`}</div>
    <div class="card"><h2 style="margin:0 0 6px">Por perfil</h2><div class="tblwrap"><table class="tbl"><thead><tr><th>Módulo</th>${Object.values(PERM_ROLES).map(n => `<th>${n}</th>`).join('')}</tr></thead><tbody>
      ${PERM_MODS.map(m => `<tr><td><b>${PERM_NAMES[m]}</b></td>${Object.keys(PERM_ROLES).map(r => `<td>${sel(`data-pr="${r}" data-pm="${m}"`, R(r, m)?.level ?? null, permDefault(r, m))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      <p class="muted sm" style="margin:6px 0 0">Ve = puede mirar · Carga = puede cargar lo suyo · Gestiona = puede cambiar lo de todos. Las contratistas además solo ven lo que se les asignó.</p></div>
    <div class="card"><h2 style="margin:0 0 6px">Excepciones por persona</h2>
      <select id="pm-u" style="width:auto">${others.map(p => `<option value="${esc(p.id)}" ${p.id === uSel ? 'selected' : ''}>${esc(p.full_name || p.email)} · ${esc(PERM_ROLES[p.role] || p.role)}</option>`).join('')}</select>
      <div id="pm-ub" style="margin-top:8px"></div></div>
    <div class="card"><h2 style="margin:0 0 6px">Últimos cambios</h2>${log.length ? log.map(l => `<div class="sm" style="padding:3px 0;border-bottom:1px solid var(--line)">${esc(fmtDT(l.at))} · <b>${esc(l.by_name || '')}</b> · ${esc(l.what || '')}</div>`).join('') : '<p class="muted">Sin cambios todavía.</p>'}</div>`;
  $('#pm-back').onclick = () => { location.hash = '#/org'; };
  $('#pm-dels')?.addEventListener('click', async () => { const { error } = await sb.rpc('perm_set_delegate', { p_user: $('#pm-del').value || null }); if (error) return toast(errText(error)); await IDB.del('kv', CUR_UID + ':perms').catch(() => {}); toast('Guardado'); viewPerms(v); });
  v.querySelectorAll('[data-pr]').forEach(s => s.onchange = async () => {
    const role = s.dataset.pr, module = s.dataset.pm, val = s.value;
    const { error } = val === '' ? await sb.from('perm_role').delete().eq('role', role).eq('module', module) : await sb.from('perm_role').upsert({ role, module, level: Number(val) }, { onConflict: 'org_id,role,module' });
    if (error){ toast(errText(error)); return viewPerms(v); } toast('Permiso actualizado'); s.style.borderColor = val === '' ? '' : 'var(--navy-2)';
  });
  const drawUser = () => {
    const uid2 = $('#pm-u').value; if (HHS) HHS.permUser = uid2; const p = profs.find(x => x.id === uid2); if (!p){ $('#pm-ub').innerHTML = '<p class="muted">No hay usuarios.</p>'; return; }
    $('#pm-ub').innerHTML = `<div class="tblwrap"><table class="tbl"><thead><tr><th>Módulo</th><th>Según su perfil</th><th>Para esta persona</th></tr></thead><tbody>
      ${PERM_MODS.map(m => { const base = R(p.role, m)?.level ?? permDefault(p.role, m); const cur = users.find(x => x.user_id === uid2 && x.module === m)?.level ?? null;
        return `<tr><td>${PERM_NAMES[m]}</td><td class="sm muted">${PERM_LV[base]}</td><td>${p.id === me.id && !isAdm ? '<span class="sm muted">no podés cambiar los tuyos</span>' : sel(`data-pu="${m}"`, cur, base).replace('Por defecto', 'Como su perfil')}</td></tr>`; }).join('')}</tbody></table></div>`;
    $('#pm-ub').querySelectorAll('[data-pu]').forEach(s => s.onchange = async () => {
      const module = s.dataset.pu, val = s.value;
      const { error } = val === '' ? await sb.from('perm_user').delete().eq('user_id', uid2).eq('module', module) : await sb.from('perm_user').upsert({ user_id: uid2, module, level: Number(val) }, { onConflict: 'org_id,user_id,module' });
      if (error){ toast(errText(error)); return viewPerms(v); }
      const ix = users.findIndex(x => x.user_id === uid2 && x.module === module); if (ix >= 0) users.splice(ix, 1); if (val !== '') users.push({ user_id: uid2, module, level: Number(val) });
      toast('Permiso actualizado');
    });
  };
  $('#pm-u')?.addEventListener('change', drawUser); drawUser();
}
