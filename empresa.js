/* =====================================================================
   InspectApp · Transformándonos — v4.9
   Mi empresa: avisos al teléfono (automáticos / manuales), resumen automático por mail,
   control de presencia, períodos de certificación y copia de seguridad en Excel.
   Este archivo solo declara funciones: no ejecuta nada al cargarse.
   ===================================================================== */

const EMP_DOW = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/* ---------- avisos en ESTE teléfono ---------- */
const empPushOk = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
function empB64(s){ const p = '='.repeat((4 - s.length % 4) % 4); const b = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(b, c => c.charCodeAt(0)); }
async function empPushState(){
  if (!empPushOk()) return 'no';
  if (Notification.permission === 'denied') return 'bloqueado';
  try { const reg = await navigator.serviceWorker.ready; const s = await reg.pushManager.getSubscription(); return s ? 'activo' : 'apagado'; } catch { return 'apagado'; }
}
async function empPushEnable(){
  if (!needOnline()) return false;
  if (!empPushOk()) { toast(isIOS() ? 'En iPhone: primero agregá InspectApp a la pantalla de inicio (Compartir → Agregar a inicio) y abrila desde ahí.' : 'Este navegador no admite avisos.'); return false; }
  const perm = await Notification.requestPermission();
  if (perm !== 'granted'){ toast('No diste permiso para los avisos. Se puede cambiar en los ajustes del navegador → Notificaciones.'); return false; }
  try {
    let key = (await sb.rpc('push_vapid_public')).data;
    if (!key){ const r = await fetch(SUPABASE_URL + '/functions/v1/inspectapp-jobs?a=vapid'); if (r.ok) key = (await r.json()).key; }
    if (!key || !/^[A-Za-z0-9_\-]{80,100}$/.test(key)) throw new Error('El servidor de avisos todavía no está configurado (pedile al administrador que despliegue la función inspectapp-jobs).');
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: empB64(key) });
    const j = sub.toJSON();
    const { error } = await sb.rpc('push_subscribe', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_ua: navigator.userAgent.slice(0, 200) });
    if (error) throw error;
    try { localStorage.setItem('ia_push_ask', 'ok'); } catch {}
    toast('🔔 Avisos activados en este teléfono'); return true;
  } catch (e){ toast(errText(e)); return false; }
}
async function empPushDisable(){
  try { const reg = await navigator.serviceWorker.ready; const s = await reg.pushManager.getSubscription();
    if (s){ await sb.rpc('push_unsubscribe', { p_endpoint: s.endpoint }).catch(() => {}); await s.unsubscribe(); } toast('Avisos apagados en este teléfono'); } catch (e){ toast(errText(e)); }
}
/* aviso en Inicio para activar (una vez; se puede cerrar) */
async function empPushBanner(box){
  if (!box || !online()) return;
  let ask = null; try { ask = localStorage.getItem('ia_push_ask'); } catch {}
  if (ask === 'no' || ask === 'ok') return;
  const st = await empPushState(); if (st !== 'apagado') return;
  box.innerHTML = `<div class="card row between" style="border-left:4px solid var(--green)"><div class="row" style="flex-wrap:nowrap;gap:10px"><span style="font-size:26px">🔔</span><div><b>Activá los avisos en este teléfono</b><div class="sm muted">Te avisa cuando te asignan una tarea, cuando autorizan tus horas o cuando hay algo para validar.</div></div></div>
    <div class="row" style="gap:6px"><button class="btn sec small" id="pa-no">Ahora no</button><button class="btn small" id="pa-ok">Activar</button></div></div>`;
  $('#pa-no').onclick = () => { try { localStorage.setItem('ia_push_ask', 'no'); } catch {} box.innerHTML = ''; };
  $('#pa-ok').onclick = async () => { if (await empPushEnable()) box.innerHTML = ''; };
}

/* =====================================================================
   SECCIÓN EN MI EMPRESA (coordinación / administración)
   ===================================================================== */
async function empOrgSection(box){
  if (!box || !isManager()) return;
  const c = await stxLoadCfg();
  const w = canWrite(), adm = isAdmin();
  const pst = await empPushState();
  box.innerHTML = `
  <div class="card"><h2 style="margin:0 0 6px">🔔 Avisos al teléfono</h2>
    <p class="muted sm" style="margin:0 0 8px">Tarea asignada a un técnico o contratista, horas autorizadas o rechazadas, y pedidos de horas para validar.</p>
    <div class="veh-seg" style="display:flex;border:1px solid var(--line);border-radius:10px;overflow:hidden;margin:6px 0 8px">
      <button type="button" class="emp-pm ${c.push_mode === 'auto' ? 'on' : ''}" data-pm="auto" ${w ? '' : 'disabled'}>⚡ Automáticos</button>
      <button type="button" class="emp-pm ${c.push_mode !== 'auto' ? 'on' : ''}" data-pm="manual" ${w ? '' : 'disabled'}>✋ Manuales</button></div>
    <p class="sm" id="emp-pm-t">${c.push_mode === 'auto' ? 'Se mandan solos cada vez que pasa algo.' : 'No se manda nada solo: coordinación los manda con "Enviar un aviso".'}</p>
    <div class="row" style="gap:6px;flex-wrap:wrap">
      <button class="btn sec small" id="emp-dev">${pst === 'activo' ? '🔕 Apagar en este teléfono' : '🔔 Activar en este teléfono'}</button>
      ${pst === 'activo' ? '<button class="btn sec small" id="emp-test">Probar</button>' : ''}
      ${w ? '<button class="btn small" id="emp-send">📣 Enviar un aviso</button>' : ''}<button class="btn sec small" id="emp-diag">🩺 ¿Por qué no llega un aviso?</button></div>
    ${pst === 'bloqueado' ? '<p class="sm" style="color:var(--amber)">Este navegador tiene los avisos bloqueados: habilitalos en los ajustes del sitio → Notificaciones.</p>' : ''}
    ${pst === 'no' ? `<p class="sm muted">${isIOS() ? 'En iPhone los avisos funcionan con la app agregada a la pantalla de inicio (iOS 16.4 o más).' : 'Este navegador no admite avisos.'}</p>` : ''}
  </div>
  <div class="card"><h2 style="margin:0 0 6px">📧 Resumen automático</h2>
    <p class="muted sm" style="margin:0 0 8px">Mail a coordinación y RRHH con visitas, pendientes atrasados, horas, km e infracciones del período.</p>
    <label style="display:flex;gap:8px;align-items:center;font-weight:600"><input type="checkbox" id="emp-son" style="width:auto" ${c.summary_on ? 'checked' : ''} ${w ? '' : 'disabled'}> Mandarlo automáticamente</label>
    <div class="row" style="gap:10px;flex-wrap:wrap">
      <div><label>Cada cuánto</label><select id="emp-sf" ${w ? '' : 'disabled'}>${['semanal', 'quincenal', 'mensual'].map(f => `<option value="${f}" ${c.summary_freq === f ? 'selected' : ''}>${f.charAt(0).toUpperCase() + f.slice(1)}</option>`).join('')}</select></div>
      <div id="emp-sdw"><label>Día</label><select id="emp-sd" ${w ? '' : 'disabled'}>${EMP_DOW.map((d, i) => `<option value="${i}" ${Number(c.summary_dow) === i ? 'selected' : ''}>${d}</option>`).join('')}</select></div></div>
    <label>Para (mails separados por coma)</label><input id="emp-sto" maxlength="1000" value="${esc(c.summary_to || '')}" placeholder="rrhh@empresa.com, coordinacion@empresa.com" ${w ? '' : 'disabled'}>
    <p class="sm muted" id="emp-snote">${c.summary_freq === 'mensual' ? 'Sale el primer día de cada mes, con el mes anterior.' : 'Sale a las 7 de la mañana del día elegido, con los días anteriores.'}${c.summary_last ? ' Último envío: ' + esc(fmtD(c.summary_last)) + '.' : ''}</p>
    ${w ? '<div class="row" style="gap:6px"><button class="btn small" id="emp-ssave">Guardar</button><button class="btn sec small" id="emp-snow">Enviar ahora</button></div>' : ''}
  </div>
  <div class="card"><h2 style="margin:0 0 6px">📍 Control de presencia y certificación</h2>
    <div class="row" style="gap:10px;flex-wrap:wrap">
      <div><label>Avisar si se carga a más de (metros)</label><input id="emp-pm" type="number" min="50" max="50000" step="50" value="${esc(c.presence_m)}" ${w ? '' : 'disabled'} style="max-width:160px"></div>
      <div><label>Preventivo: período del día</label><input id="emp-cp" type="number" min="1" max="28" value="${esc(c.cert_day_prev)}" ${w ? '' : 'disabled'} style="max-width:100px"></div>
      <div><label>Correctivo: período del día</label><input id="emp-cc" type="number" min="1" max="28" value="${esc(c.cert_day_corr)}" ${w ? '' : 'disabled'} style="max-width:100px"></div></div>
    <p class="sm muted">Ej.: 9 = del 9 de un mes al 8 del siguiente (preventivo y correctivo). Con 1 queda el mes calendario. Lo importado de planillas queda en el mes de su solapa.</p>
    ${w ? '<button class="btn small" id="emp-psave">Guardar</button>' : ''}
  </div>
  ${adm ? `<div class="card row between"><div><h2 style="margin:0">💾 Copia de seguridad</h2><div class="muted sm">Un Excel con todos los datos de la empresa: sitios, inspecciones, tareas, horas, vehículos, estadísticas y más (una solapa por tabla).</div></div><button class="btn" id="emp-bk">⬇ Descargar copia</button></div>` : ''}`;
  const save = async (patch, msg) => {
    const { error } = await sb.from('org_settings').upsert({ org_id: me.org_id, ...patch }, { onConflict: 'org_id' });
    if (error){ toast(errText(error)); return false; }
    await IDB.del('kv', CUR_UID + ':org-cfg').catch(() => {}); Object.assign(STX.cfg, patch); if (msg !== null) toast(msg || 'Guardado'); return true;
  };
  box.querySelectorAll('.emp-pm').forEach(b => { b.style.cssText = 'flex:1;border:0;padding:10px 6px;cursor:pointer;font-weight:600;' + (b.classList.contains('on') ? 'background:var(--navy);color:#fff' : 'background:#fff;color:var(--muted)');
    b.onclick = async () => { if (await save({ push_mode: b.dataset.pm }, b.dataset.pm === 'auto' ? 'Avisos automáticos activados' : 'Avisos en modo manual')) empOrgSection(box); }; });
  $('#emp-dev').onclick = async () => { if (pst === 'activo') await empPushDisable(); else await empPushEnable(); empOrgSection(box); };
  $('#emp-test')?.addEventListener('click', async () => { const { error } = await sb.rpc('push_test'); toast(error ? errText(error) : 'Aviso de prueba en camino (llega en menos de un minuto).'); });
  $('#emp-send')?.addEventListener('click', empSendModal);
  $('#emp-diag')?.addEventListener('click', empDiagModal);
  const showDow = () => { $('#emp-sdw').style.display = $('#emp-sf').value === 'mensual' ? 'none' : ''; }; $('#emp-sf').onchange = showDow; showDow();
  const sumPatch = () => ({ summary_on: $('#emp-son').checked, summary_freq: $('#emp-sf').value, summary_dow: Number($('#emp-sd').value), summary_to: $('#emp-sto').value.trim() || null });
  $('#emp-ssave')?.addEventListener('click', async () => { const p = sumPatch(); if (p.summary_on && !p.summary_to) return toast('Cargá a quién se manda el resumen.'); if (await save(p, p.summary_on ? 'Resumen automático activado' : 'Guardado')) empOrgSection(box); });
  $('#emp-snow')?.addEventListener('click', async () => {
    const p = sumPatch(); if (!p.summary_to) return toast('Cargá a quién se manda el resumen.');
    if (!(await save(p, null))) return;
    const { error } = await sb.rpc('summary_send_now'); toast(error ? errText(error) : 'El resumen sale en el próximo minuto a: ' + p.summary_to);
  });
  $('#emp-psave')?.addEventListener('click', async () => {
    const pm = Number($('#emp-pm').value), cp = Number($('#emp-cp').value), cc = Number($('#emp-cc').value);
    if (!(pm >= 50 && pm <= 50000) || !(cp >= 1 && cp <= 28) || !(cc >= 1 && cc <= 28)) return toast('Revisá los valores: metros entre 50 y 50000, días entre 1 y 28.');
    await save({ presence_m: pm, cert_day_prev: cp, cert_day_corr: cc });
  });
  $('#emp-bk')?.addEventListener('click', e => empBackup(e.target));
}

/* ---------- aviso manual ---------- */
async function empSendModal(){
  if (!needOnline()) return;
  const [{ data: mem }, { data: dev }] = await Promise.all([
    sb.from('profiles').select('id,full_name,email,role,contractor_id,active').eq('org_id', me.org_id).eq('active', true).order('full_name'),
    sb.rpc('push_members')]);
  const devs = new Map((dev || []).map(d => [d.user_id, d.devices]));
  const list = (mem || []).filter(p => p.id !== me.id);
  const m = modal(`<h2>📣 Enviar un aviso</h2>
    <label>Título</label><input id="ns-t" maxlength="100" placeholder="Ej.: Corte programado en Traza 15">
    <label>Mensaje</label><textarea id="ns-b" maxlength="350" rows="3" placeholder="Ej.: Mañana a las 8 h hay ventana de trabajo, confirmen asistencia."></textarea>
    <label>Abrir al tocar</label><select id="ns-u"><option value="#/home">Inicio</option><option value="#/tasks">Tareas</option><option value="#/tools/hh">Horas</option><option value="#/tools/veh">Vehículos</option></select>
    <div class="row between" style="margin-top:10px"><b class="sm">Para</b><span class="sm"><a href="#" id="ns-all">todos</a> · <a href="#" id="ns-dev">solo con avisos activos</a> · <a href="#" id="ns-none">ninguno</a></span></div>
    <div style="max-height:220px;overflow:auto;border:1px solid var(--line);border-radius:10px;padding:6px 10px;margin-top:4px">${list.map(p => `<label style="display:flex;gap:8px;align-items:center;font-weight:400;margin:4px 0"><input type="checkbox" value="${esc(p.id)}" class="ns-c" style="width:auto"> ${esc(p.full_name || p.email)} <span class="muted sm">${esc(ROLE_TXT[p.role] || p.role)}${p.contractor_id ? ' · contratista' : ''}</span>${devs.get(p.id) ? ' <span class="pill p-ok">🔔</span>' : ' <span class="pill" title="No activó los avisos en su teléfono">sin avisos</span>'}</label>`).join('') || '<p class="muted">No hay otros usuarios.</p>'}</div>
    <p class="sm muted">Solo les llega a quienes activaron los avisos en su teléfono (🔔).</p><div class="err" id="ns-err"></div>
    <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn sec" id="ns-x">Cancelar</button><button class="btn" id="ns-ok">Enviar</button></div>`, { wide: true });
  const set = f => m.el.querySelectorAll('.ns-c').forEach(c => { c.checked = f(c.value); });
  $('#ns-all').onclick = e => { e.preventDefault(); set(() => true); };
  $('#ns-dev').onclick = e => { e.preventDefault(); set(id => !!devs.get(id)); };
  $('#ns-none').onclick = e => { e.preventDefault(); set(() => false); };
  $('#ns-x').onclick = m.close;
  $('#ns-ok').onclick = async () => {
    const ids = [...m.el.querySelectorAll('.ns-c:checked')].map(c => c.value), t = $('#ns-t').value.trim();
    if (t.length < 2) return ($('#ns-err').textContent = 'Escribí el título.');
    if (!ids.length) return ($('#ns-err').textContent = 'Elegí al menos una persona.');
    $('#ns-ok').disabled = true;
    const { data, error } = await sb.rpc('notify_users', { p_users: ids, p_title: t, p_body: $('#ns-b').value.trim(), p_url: $('#ns-u').value });
    if (error){ $('#ns-ok').disabled = false; return ($('#ns-err').textContent = errText(error)); }
    m.close(); toast(`Aviso enviado a ${data} persona(s).`);
  };
}

/* ---------- copia de seguridad: todo a un Excel ---------- */
const EMP_BK = [
  ['Sitios', 'sites'], ['Plantillas', 'templates'], ['Inspecciones', 'inspections'], ['Contratistas', 'contractors'], ['Tareas', 'tasks'],
  ['Proyectos', 'projects'], ['Proyecto-sitios', 'project_sites'], ['Proyecto-actividades', 'project_activities'], ['Equipos', 'equipment'],
  ['Fibra-rutas', 'fiber_routes'], ['Fibra-elementos', 'fiber_elements'], ['Fibra-eventos', 'fiber_events'], ['Datacenter', 'dc_objects'], ['Datacenter-cambios', 'dc_changes'],
  ['HH-técnicos', 'hh_staff'], ['HH-registros', 'hh_items'], ['HH-feriados', 'hh_holidays'], ['HH-guardias', 'hh_guard'], ['HH-ajustes', 'hh_settings'],
  ['Vehículos', 'veh_vehicles'], ['Jornadas', 'veh_days'], ['Conductores', 'veh_drives'], ['Infracciones', 'veh_fines'],
  ['Histórico-mant', 'stats_history'], ['Plan-preventivo', 'pm_plan'], ['Ajustes', 'org_settings'], ['Usuarios', 'profiles'], ['Auditoría', 'audit_log'],
];
async function empBackup(btn){
  if (!isAdmin() || !needOnline()) return;
  if (!confirm('Se descarga un Excel con todos los datos de la empresa. Guardalo en un lugar seguro: tiene información de todo el personal.')) return;
  btn.disabled = true; const t0 = btn.textContent;
  const X = v => { if (v == null) return ''; let s = typeof v === 'object' ? JSON.stringify(v) : v;
    if (typeof s === 'string'){ if (s.length > 32000) s = s.slice(0, 32000) + '…(recortado)'; if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; } return s; };
  const wb = XLSX.utils.book_new(), info = [['InspectApp · copia de seguridad'], ['Empresa', org?.name || ''], ['Fecha', new Date().toLocaleString('es-AR')], ['Usuario', me.email || ''], [], ['Solapa', 'Tabla', 'Registros', 'Nota']];
  try {
    for (const [name, tbl] of EMP_BK){
      btn.textContent = `Copiando ${name}…`;
      const max = tbl === 'audit_log' ? 5000 : 100000;
      const q = () => { let b = sb.from(tbl).select('*'); if (tbl === 'audit_log') b = b.order('created_at', { ascending: false }); else if (!['org_settings', 'hh_settings', 'hh_holidays', 'hh_guard'].includes(tbl)) b = b.order('id'); return b; };
      const { data, error } = await pageAll(q, max);
      if (error){ info.push([name, tbl, '', /does not exist|schema cache/i.test(error.message || '') ? 'no está instalada' : 'sin acceso: ' + errText(error)]); continue; }
      const rows = (data || []).map(r => { const o = {}; for (const k of Object.keys(r)) o[k] = X(r[k]); return o; });
      info.push([name, tbl, rows.length, rows.length >= max ? 'recortado a ' + max : '']);
      XLSX.utils.book_append_sheet(wb, rows.length ? XLSX.utils.json_to_sheet(rows) : XLSX.utils.aoa_to_sheet([['(sin registros)']]), name.slice(0, 31));
    }
    const ws0 = XLSX.utils.aoa_to_sheet(info); wb.SheetNames.unshift('Índice'); wb.Sheets['Índice'] = ws0;
    XLSX.writeFile(wb, `InspectApp copia ${String(org?.name || 'empresa').replace(/[^\w\- áéíóúñÁÉÍÓÚÑ]/g, '').slice(0, 40)} ${todayStr()}.xlsx`, { compression: true });
    toast('Copia descargada. Las fotos no van en el Excel: quedan guardadas en el servidor.');
  } catch (e){ toast(errText(e)); }
  finally { btn.disabled = false; btn.textContent = t0; }
}

/* ---------- diagnóstico de avisos: qué paso de la cadena falla ---------- */
async function empDiagModal(){
  if (!needOnline()) return;
  const { data: d, error } = await sb.rpc('push_diag');
  if (error) return toast(errText(error));
  const ok = (b, t, f) => `<div class="item row" style="gap:10px;flex-wrap:nowrap"><span style="font-size:20px">${b ? '✅' : '❌'}</span><div><b>${t}</b>${f ? `<div class="sm muted">${f}</div>` : ''}</div></div>`;
  const cron = Array.isArray(d.tarea_programada) ? d.tarea_programada : null, fn = Array.isArray(d.funcion) ? d.funcion : null;
  const cronOk = !!cron && cron.length > 0 && cron.every(x => /succeed/i.test(x.estado || ''));
  const fnLast = fn && fn[0], fnOk = !!fnLast && Number(fnLast.codigo) === 200;
  const m = modal(`<h2>🩺 Diagnóstico de avisos</h2><p class="muted sm" style="margin-top:-4px">Un aviso pasa por estos pasos. El primero en rojo es lo que hay que arreglar.</p>
    ${ok((d.tecnicos_sin_usuario || []).length === 0, 'Técnicos vinculados a su usuario', (d.tecnicos_sin_usuario || []).length ? 'Sin usuario (no les puede llegar nada): <b>' + esc(d.tecnicos_sin_usuario.join(', ')) + '</b>. Vinculalos en la columna Horas de Mi empresa.' : 'Todos tienen usuario.')}
    ${ok((d.telefonos || []).length > 0, 'Teléfonos con los avisos activados', (d.telefonos || []).length ? esc(d.telefonos.map(x => x.nombre + (x.n > 1 ? ' (' + x.n + ')' : '')).join(', ')) + '. Los demás tienen que tocar "Activar avisos" en Inicio.' : 'Nadie activó los avisos todavía: cada uno toca "Activar avisos" en Inicio, en su teléfono.')}
    ${ok(d.claves_avisos, 'Claves de los avisos creadas', d.claves_avisos ? '' : 'Se crean la primera vez que alguien activa los avisos con la función inspectapp-jobs desplegada.')}
    ${ok(cronOk, 'Tarea programada (cada minuto)', cron ? (cron.length ? esc(cron.map(x => fmtTime(x.hora) + ' ' + x.estado + (x.detalle && !/^\d+ row/.test(x.detalle) ? ': ' + x.detalle : '')).join(' · ')) : 'Todavía no corrió. Corré de nuevo 17_avisos_resumen.sql.') : esc(String(d.tarea_programada)) + ' · Activá pg_cron en Database → Extensions y corré 17_avisos_resumen.sql.')}
    ${ok(fnOk, 'La función inspectapp-jobs responde', fn ? (fnLast ? `Última respuesta ${esc(fmtTime(fnLast.hora))}: código ${esc(fnLast.codigo ?? '—')} ${esc(fnLast.error || fnLast.respuesta || '')}` + (Number(fnLast.codigo) === 401 ? ' · la clave no coincide: corré de nuevo el SQL 17.' : Number(fnLast.codigo) === 404 ? ' · la función no está desplegada con el nombre inspectapp-jobs.' : Number(fnLast.codigo) >= 500 ? ' · error de la función: revisá los secretos y los registros (Logs) en Supabase.' : '') : 'Todavía no la llamó nadie (no hubo avisos para mandar).') : esc(String(d.funcion)) + ' · Activá pg_net en Database → Extensions.')}
    <div class="stats" style="margin-top:10px"><div class="stat"><span>En espera</span><b>${d.pendientes}</b></div><div class="stat"><span>Enviados (24 h)</span><b>${d.enviados_24h}</b></div><div class="stat"><span>Con error (24 h)</span><b style="color:${d.con_error_24h ? 'var(--red)' : 'inherit'}">${d.con_error_24h}</b></div></div>
    <details class="sm" style="margin-top:8px"><summary style="cursor:pointer">Últimos avisos</summary>${(d.ultimos || []).map(x => `<div style="padding:4px 0;border-bottom:1px solid var(--line)">${esc(fmtDT(x.creado))} · ${esc(x.para || '')} · ${esc(x.titulo || '')} · ${x.enviado ? (x.error ? '<span style="color:var(--red)">' + esc(x.error) + '</span>' : 'enviado') : '<b>en espera</b>'}</div>`).join('') || 'Ninguno.'}</details>
    <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn sec" id="dg-x">Cerrar</button></div>`, { wide: true });
  $('#dg-x').onclick = m.close;
}
