/* =====================================================================
   InspectApp · Transformándonos — v4.6
   Control de vehículos: jornada con km y foto del odómetro al inicio y al final,
   tramos de manejo (responsable + conductor ocasional), flota con vencimientos,
   infracciones con "¿quién lo tenía?" y aviso por WhatsApp.
   Todo lo que define responsabilidades lo valida el servidor (funciones veh_*).
   Este archivo solo declara funciones: no ejecuta nada al cargarse.
   ===================================================================== */

const VEH_ORIG = { propio: 'Propio (Trans)', alquilado: 'Alquilado', contratista: 'De contratista' };
const VEH_FST = { cargada: ['Cargada', 'p-pend'], notificada: ['Notificada', 'p-info'], descargo: ['Con descargo', 'p-pend'], pagada: ['Pagada', 'p-ok'], anulada: ['Anulada', 'p-bad'] };
const VEH_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VEHS = { tab: null, day: null, vehicles: [], names: new Map() };
const vehName = id => { const n = hhStaffName(id); return n !== '—' ? n : VEHS.names.get(id) || 'Conductor'; };
const vehKm = n => n == null || n === '' ? '—' : Number(n).toLocaleString('es-AR', { maximumFractionDigits: 0 }) + ' km';
const vehPlate = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const vehLink = id => `${location.origin}${location.pathname}#/tools/veh/start/${id}`;
const vehDT = s => s ? fmtDate(s) + ' ' + fmtTime(s) : '—';
const vehDaysTo = d => d ? Math.round((dOf(d) - dOf(todayStr())) / 86400000) : null;

function vehCss(){
  if (document.getElementById('veh-css')) return;
  const st = document.createElement('style'); st.id = 'veh-css';
  st.textContent = `
.veh-plate{display:inline-block;font-family:ui-monospace,Menlo,monospace;font-weight:700;letter-spacing:1px;border:2px solid #0F2A4A;border-radius:6px;padding:1px 8px;background:#fff;color:#0F2A4A}
.veh-tl{border-left:3px solid var(--line);margin:8px 0 0 6px;padding-left:12px}
.veh-tl>div{position:relative;padding:4px 0 8px}
.veh-tl>div:before{content:'';position:absolute;left:-19px;top:8px;width:11px;height:11px;border-radius:50%;background:#2A78D6;border:2px solid #fff}
.veh-tl>div.oc:before{background:#F59E0B}.veh-tl>div.end:before{background:#16A34A}
.veh-seg{display:flex;border:1px solid var(--line);border-radius:10px;overflow:hidden;margin:6px 0 10px}
.veh-seg button{flex:1;border:0;background:#fff;padding:12px 6px;cursor:pointer;color:var(--muted);font-weight:600}
.veh-seg button.on{background:var(--navy);color:#fff}
.veh-ph{border:2px dashed var(--line);border-radius:12px;padding:14px;text-align:center;cursor:pointer;background:var(--bg)}
.veh-ph img{max-width:100%;max-height:180px;border-radius:8px;display:block;margin:0 auto}
#veh-print{display:none}
@media print{body.veh-printing>*:not(#veh-print){display:none!important}body.veh-printing #veh-print{display:block}}`;
  document.head.appendChild(st);
}

async function vehLoadVehicles(){
  VEHS.vehicles = await cached('veh-list', () => sb.from('veh_vehicles').select('*').eq('active', true).order('plate')).catch(() => VEHS.vehicles || []) || [];
  return VEHS.vehicles;
}
async function vehUpload(file){
  const blob = await compressImage(file, 1600, 0.8);
  const p = `${me.org_id}/veh/${uid()}/${uid()}.jpg`;
  const { error } = await sb.storage.from('fotos').upload(p, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error; return p;
}
async function vehPhoto(p){ if (!p || !needOnline()) return; const { data } = await sb.storage.from('fotos').createSignedUrl(p, 600); if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener'); }
/* campo de foto del odómetro (obligatoria): muestra la vista previa */
function vehPhotoField(id, label){
  return `<label>${label}</label><div class="veh-ph" id="${id}-box"><div id="${id}-pv">📷 <b>Sacar foto del odómetro</b><div class="sm muted">Que se lean bien los km</div></div></div><input id="${id}" type="file" accept="image/*" capture="environment" class="hidden">`;
}
function vehBindPhoto(id){
  $('#' + id + '-box').onclick = () => $('#' + id).click();
  $('#' + id).onchange = () => { const f = $('#' + id).files[0]; if (!f) return; const u = URL.createObjectURL(f);
    $('#' + id + '-pv').innerHTML = `<img src="${u}" alt="odómetro"><div class="sm muted" style="margin-top:4px">Tocá para sacarla de nuevo</div>`; };
}
function vehDueChips(v){
  const c = [];
  const due = (d, n, fem) => { const k = vehDaysTo(d); if (k == null) return; if (k < 0) c.push(`<span class="pill p-bad">${n} ${fem ? 'vencida' : 'vencido'}</span>`); else if (k <= 30) c.push(`<span class="pill p-pend">${n} vence en ${k} d</span>`); };
  due(v.vtv_due, 'VTV', true); due(v.insurance_due, 'Seguro', false);
  if (v.service_km && v.km_last != null && Number(v.km_last) >= Number(v.service_km) - 500) c.push(`<span class="pill ${Number(v.km_last) >= Number(v.service_km) ? 'p-bad' : 'p-pend'}">Service a los ${vehKm(v.service_km)}</span>`);
  return c.join(' ');
}

/* =====================================================================
   INICIO: botón de jornada y cartel rojo si quedó una abierta
   ===================================================================== */
async function vehMyState(){
  const snap = await vehSnap();
  if (!online()) return { open: snap, drv: null, offline: true };
  const [open, drv] = await Promise.all([
    sb.rpc('veh_my_open').then(r => r.data || null),
    HHS.mine ? sb.from('veh_drives').select('id,day_id,vehicle_id,from_at,from_km').eq('driver_id', HHS.mine.id).is('to_at', null).order('from_at', { ascending: false }).limit(1).then(r => (r.data || [])[0] || null) : null,
  ]);
  const q = await vehQ();
  let o = open;
  if (!o && snap && q.some(x => x.args?.p_id === snap.id || x.args?.p_day === snap.id)) o = snap;      // iniciada sin señal, todavía no llegó
  if (o && o.id !== snap?.id) await vehSetSnap({ id: o.id, plate: o.plate, vehicle_id: o.vehicle_id, start_at: o.start_at, start_km: o.start_km, day: o.day });
  if (!o && snap && !q.length) await vehSetSnap(null);
  return { open: o, drv: drv && (!o || drv.day_id !== o.id) ? drv : null };
}
async function vehHomeSlot(btnBox, redBox, after){
  if (!btnBox) return; vehCss();
  const go = (cls, i, l, s, fn) => { btnBox.innerHTML = `<button class="hq-b ${cls}" id="hq-vb"><span class="i">${i}</span><div><div class="l">${l}</div><div class="s">${s}</div></div></button>`; $('#hq-vb').onclick = fn; };
  let s; try { s = await vehMyState(); } catch { go('', '🚗', 'Jornada del vehículo', 'Abrir', () => { location.hash = '#/tools/veh'; }); return; }
  const o = s.open;
  if (o && o.day < todayStr() && redBox){
    redBox.innerHTML = `<div class="hq-red"><span style="font-size:24px">⚠️</span><div>Tenés la jornada del ${esc(fmtD(o.day))}${o.plate ? ' (' + esc(o.plate) + ')' : ''} sin cerrar.<div class="sm" style="font-weight:400">Cerrala con los km y la foto del odómetro antes de iniciar la de hoy.</div></div><button id="hq-vclose">Cerrar ahora</button></div>`;
    $('#hq-vclose').onclick = () => vehCloseModal(o, after);
  }
  if (o) go('stop', '🏁', 'Terminar jornada', `${esc(o.plate || '')} · desde ${esc(fmtTime(o.start_at))}${o.day < todayStr() ? ' del ' + esc(fmtD(o.day)) : ''}`, () => vehCloseModal(o, after));
  else if (s.drv) go('', '🚗', 'Estás manejando', 'Tocá para ver la jornada', () => { location.hash = '#/tools/veh'; });
  else if (canWrite() && can('veh', 2)) go('go', '🚗', 'Iniciar jornada', 'Con o sin vehículo · km y foto', () => vehStartModal(null, after));
}

/* =====================================================================
   INICIAR · TOMO EL VOLANTE · TERMINAR
   ===================================================================== */
async function vehStartModal(preVehicle, after){
  if (!HHS.mine){ try { await hhLoadBase(); } catch {} }
  if (!HHS.mine) return toast('Tu usuario no está vinculado a un técnico: pedile al coordinador que te vincule en Validación de horas → Recursos.');
  const [vs, inUse, mine] = online() ? await Promise.all([vehLoadVehicles(), sb.rpc('veh_open_list').then(r => r.data || []), vehMyState().then(x => x.open)])
    : await Promise.all([vehLoadVehicles(), [], vehSnap()]);
  if (mine){ toast(`Tenés la jornada del ${fmtD(mine.day)} sin cerrar: cerrala primero.`); return vehCloseModal(mine, after); }
  let withV = true;
  const pre = vs.find(v => v.id === preVehicle);
  const busy = id => inUse.find(x => x.vehicle_id === id);
  const m = modal(`<h2>🚗 Iniciar jornada</h2><p class="muted sm" style="margin:-4px 0 4px">${esc(HHS.mine.name)} · ${esc(hhFmtDay(todayStr()))}</p>
    <div class="veh-seg"><button type="button" data-w="1" class="on">Con vehículo</button><button type="button" data-w="0">Sin vehículo</button></div>
    <div id="vs-v"><label>Vehículo</label><select id="vs-car"><option value="">— Elegí la patente —</option>${vs.map(v => { const b = busy(v.id); return `<option value="${esc(v.id)}" ${v.id === pre?.id ? 'selected' : ''}>${esc(v.plate)} · ${esc([v.brand, v.model].filter(Boolean).join(' ') || VEH_ORIG[v.origin])}${b ? ' · en uso por ' + esc(b.responsible) : ''}</option>`; }).join('')}</select>
      <div id="vs-info"></div>
      <label>Km del odómetro</label><input id="vs-km" type="number" inputmode="numeric" min="0" step="1" placeholder="Ej.: 48213">
      ${vehPhotoField('vs-ph', 'Foto del odómetro (obligatoria)')}</div>
    <p class="muted sm hidden" id="vs-none"></p>
    <div class="sm muted" id="vs-s">${online() ? 'Se registra la hora y tu ubicación.' : '📵 Sin señal: se guarda en el teléfono con la hora de ahora y se envía sola cuando vuelva la señal.'}</div><div class="err" id="vs-err"></div>
    <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn sec" id="vs-x">Cancelar</button><button class="btn" id="vs-ok">Iniciar jornada</button></div>`);
  vehBindPhoto('vs-ph');
  const info = () => { const v = vs.find(x => x.id === $('#vs-car').value), b = v && busy(v.id);
    $('#vs-info').innerHTML = !v ? '' : b ? `<div class="banner warn" style="margin:6px 0"><span class="dot"></span><div><b>Lo tiene ${esc(b.responsible)} desde las ${esc(fmtTime(b.start_at))}${b.driver && b.driver !== b.responsible ? ' (maneja ' + esc(b.driver) + ')' : ''}.</b><div class="sm">Si ahora manejás vos, usá "Tomo el volante": ${esc(b.responsible)} sigue como responsable del día y vos quedás como conductor desde este momento.</div><button class="btn small" id="vs-take" style="margin-top:6px">🔄 Tomo el volante</button></div></div>`
      : `<div class="sm muted" style="margin:4px 0">${v.km_last != null ? 'Último cierre: ' + vehKm(v.km_last) : 'Sin km anteriores'} ${vehDueChips(v)}</div>`;
    $('#vs-take')?.addEventListener('click', () => vehTakeModal(b, after));
    if (v?.km_last != null && !$('#vs-km').value) $('#vs-km').placeholder = 'Último: ' + Math.round(v.km_last); };
  $('#vs-car').onchange = info; info();
  m.el.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { withV = b.dataset.w === '1'; m.el.querySelectorAll('[data-w]').forEach(x => x.classList.toggle('on', x === b));
    $('#vs-v').classList.toggle('hidden', !withV); $('#vs-none').classList.toggle('hidden', withV); $('#vs-none').textContent = withV ? '' : 'Queda registrado que hoy trabajás sin vehículo.'; $('#vs-ok').textContent = withV ? 'Iniciar jornada' : 'Confirmar sin vehículo'; });
  $('#vs-x').onclick = m.close;
  $('#vs-ok').onclick = async () => {
    $('#vs-err').textContent = '';
    let car = null, km = null, photo = null;
    if (withV){
      car = $('#vs-car').value; km = $('#vs-km').value === '' ? null : Number($('#vs-km').value); const f = $('#vs-ph').files[0];
      if (!car) return ($('#vs-err').textContent = 'Elegí el vehículo.');
      if (busy(car)) return ($('#vs-err').textContent = 'Ese vehículo está en uso: usá "Tomo el volante".');
      if (km == null || !(km >= 0)) return ($('#vs-err').textContent = 'Cargá los km del odómetro.');
      const v = vs.find(x => x.id === car);
      if (v?.km_last != null && km < Number(v.km_last) && !confirm(`Cargaste ${vehKm(km)} y el último cierre fue ${vehKm(v.km_last)}. ¿Seguro?`)) return;
      if (v?.km_last != null && km - Number(v.km_last) > 300 && !confirm(`Hay ${vehKm(km - v.km_last)} de diferencia con el último cierre. ¿Los km son correctos?`)) return;
      if (!f) return ($('#vs-err').textContent = 'Falta la foto del odómetro.');
    }
    $('#vs-ok').disabled = true; $('#vs-s').textContent = 'Tomando ubicación…';
    const pos = await getPos(), dayId = uid(), v = vs.find(x => x.id === car);
    let r;
    try { $('#vs-s').textContent = withV ? 'Guardando la foto…' : 'Guardando…';
      r = await vehDo('start', { p_vehicle: car, p_km: km, p_lat: pos?.lat ?? null, p_lng: pos?.lng ?? null, p_id: dayId }, withV ? $('#vs-ph').files[0] : null, withV ? 'Inicio ' + (v?.plate || '') : 'Sin vehículo');
    } catch (x){ $('#vs-ok').disabled = false; return ($('#vs-err').textContent = errText(x)); }
    if (withV) await vehSetSnap({ id: dayId, plate: v?.plate || '', vehicle_id: car, start_at: new Date().toISOString(), start_km: km, day: todayStr() });
    m.close(); await IDB.del('kv', CUR_UID + ':veh-list').catch(() => {});
    toast(r.queued ? '📵 Guardado en el teléfono: se envía solo cuando vuelva la señal.' : withV ? '¡Jornada iniciada! Buen viaje.' : 'Registrado: hoy sin vehículo.'); after && after();
  };
}
/* cambio de conductor: el nuevo conductor lo carga desde su celular, o el responsable carga a un conductor ocasional */
async function vehTakeModal(day, after){
  if (!HHS.mine){ try { await hhLoadBase(); } catch {} }
  const resp = HHS.mine && day.responsible_id === HHS.mine.id, mgr = isManager();
  const drivers = (resp || mgr) ? ((await cached('veh-drivers', () => sb.rpc('veh_drivers')).catch(() => [])) || []) : [];
  const meDrive = HHS.mine && !resp;
  const m = modal(`<h2>🔄 Cambio de conductor</h2><p class="muted sm" style="margin:-4px 0 6px"><span class="veh-plate">${esc(day.plate)}</span> · responsable del día: <b>${esc(day.responsible)}</b>${day.driver ? ' · maneja ahora: ' + esc(day.driver) : ''}</p>
    ${meDrive ? `<p>Desde este momento <b>vos (${esc(HHS.mine.name)})</b> quedás como conductor y responsable de lo que pase con el vehículo.</p>` : `
      <label>¿Quién maneja desde ahora?</label><select id="vt-d"><option value="">— Elegí —</option>${drivers.filter(d => d.id !== (HHS.mine?.id)).map(d => `<option value="${esc(d.id)}">${esc(d.name)}${d.company ? ' · ' + esc(d.company) : ''}</option>`).join('')}${resp ? `<option value="${esc(HHS.mine.id)}">Vuelvo a manejar yo</option>` : ''}<option value="__new">+ Otra persona (no está en la lista)</option></select>
      <div id="vt-new" class="hidden"><div class="row"><div class="grow"><label>Nombre y apellido</label><input id="vt-nn" maxlength="120"></div><div class="grow"><label>WhatsApp</label><input id="vt-np" maxlength="40" inputmode="tel" placeholder="11 5555 5555"></div></div><label>Empresa</label><input id="vt-nc" maxlength="120" placeholder="Trans, Palma, Hidrocons…"></div>
      <p class="muted sm">El conductor ocasional queda como responsable de lo que pase con el vehículo desde este momento. Vos seguís como responsable del día.</p>`}
    <label>Km del odómetro ahora</label><input id="vt-km" type="number" inputmode="numeric" min="0" step="1" placeholder="${day.km != null ? 'Mínimo ' + Math.round(day.km) : ''}">
    ${vehPhotoField('vt-ph', 'Foto del odómetro (obligatoria)')}
    <div class="err" id="vt-err"></div>
    <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn sec" id="vt-x">Cancelar</button><button class="btn" id="vt-ok">Registrar cambio</button></div>`);
  vehBindPhoto('vt-ph');
  $('#vt-d')?.addEventListener('change', () => $('#vt-new').classList.toggle('hidden', $('#vt-d').value !== '__new'));
  $('#vt-x').onclick = m.close;
  $('#vt-ok').onclick = async () => {
    $('#vt-err').textContent = '';
    let drv = meDrive ? null : $('#vt-d').value;
    const km = $('#vt-km').value === '' ? null : Number($('#vt-km').value), f = $('#vt-ph').files[0];
    if (!meDrive && !drv) return ($('#vt-err').textContent = 'Elegí quién maneja.');
    if (km == null || !(km >= 0)) return ($('#vt-err').textContent = 'Cargá los km.');
    if (day.km != null && km < Number(day.km)) return ($('#vt-err').textContent = `Los km no pueden ser menos que ${vehKm(day.km)}.`);
    if (!f) return ($('#vt-err').textContent = 'Falta la foto del odómetro.');
    $('#vt-ok').disabled = true;
    try {
      if (drv === '__new' && !online()) throw new Error('Sin señal no se puede sumar una persona nueva: elegila de la lista o cargalo cuando vuelva la señal.');
      if (drv === '__new'){ const r = await sb.rpc('veh_add_driver', { p_name: $('#vt-nn').value, p_phone: $('#vt-np').value || null, p_company: $('#vt-nc').value || null }); if (r.error) throw r.error; drv = r.data; }
      const pos = await getPos();
      var r = await vehDo('take', { p_day: day.day_id, p_km: km, p_driver: drv, p_lat: pos?.lat ?? null, p_lng: pos?.lng ?? null }, f, 'Cambio de conductor ' + (day.plate || ''));
    } catch (x){ $('#vt-ok').disabled = false; return ($('#vt-err').textContent = errText(x)); }
    m.close(); toast(r.queued ? '📵 Cambio de conductor guardado en el teléfono: se envía cuando vuelva la señal.' : 'Cambio de conductor registrado'); after && after();
  };
}
async function vehCloseModal(day, after){
  const id = day.id || day.day_id;
  const drives = online() ? ((await sb.from('veh_drives').select('from_km').eq('day_id', id)).data || []) : [];
  for (const q of await vehQ()) if (q.op === 'take' && q.args.p_day === id) drives.push({ from_km: q.args.p_km });
  const minKm = Math.max(Number(day.start_km || 0), ...(drives || []).map(d => Number(d.from_km || 0)));
  const m = modal(`<h2>🏁 Terminar jornada</h2><p class="muted sm" style="margin:-4px 0 6px">${day.plate ? `<span class="veh-plate">${esc(day.plate)}</span> · ` : ''}iniciada el ${esc(vehDT(day.start_at))} con ${vehKm(day.start_km)}</p>
    ${day.day < todayStr() ? `<div class="banner off" style="margin:6px 0"><span class="dot"></span><div><b>Esta jornada es del ${esc(fmtD(day.day))}.</b><div class="sm">Cargá los km que marca el odómetro ahora. Si hubo un uso después, avisale al coordinador.</div></div></div>` : ''}
    <label>Km del odómetro al llegar</label><input id="vc-km" type="number" inputmode="numeric" min="${minKm}" step="1" placeholder="Mínimo ${Math.round(minKm)}">
    <div class="sm muted" id="vc-rec"></div>
    ${vehPhotoField('vc-ph', 'Foto del odómetro (obligatoria)')}
    <label>Observaciones (opcional)</label><input id="vc-n" maxlength="300" placeholder="Ej.: quedó en la base, falta combustible, ruido en el tren delantero">
    <div class="err" id="vc-err"></div>
    <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn sec" id="vc-x">Cancelar</button><button class="btn" id="vc-ok" style="background:var(--red);border-color:var(--red)">Terminar jornada</button></div>`);
  vehBindPhoto('vc-ph');
  $('#vc-km').oninput = () => { const k = Number($('#vc-km').value); $('#vc-rec').textContent = $('#vc-km').value !== '' && k >= minKm ? 'Recorrido del día: ' + vehKm(k - Number(day.start_km || 0)) : ''; };
  $('#vc-x').onclick = m.close;
  $('#vc-ok').onclick = async () => {
    $('#vc-err').textContent = '';
    const km = $('#vc-km').value === '' ? null : Number($('#vc-km').value), f = $('#vc-ph').files[0];
    if (km == null || km < minKm) return ($('#vc-err').textContent = `Los km no pueden ser menos que ${vehKm(minKm)}.`);
    if (km - Number(day.start_km || 0) > 1500 && !confirm(`Son ${vehKm(km - day.start_km)} en el día. ¿Los km son correctos?`)) return;
    if (!f) return ($('#vc-err').textContent = 'Falta la foto del odómetro.');
    $('#vc-ok').disabled = true;
    let r;
    try { const pos = await getPos();
      r = await vehDo('close', { p_day: id, p_km: km, p_lat: pos?.lat ?? null, p_lng: pos?.lng ?? null, p_notes: $('#vc-n').value || null }, f, 'Fin de jornada ' + (day.plate || ''));
    } catch (x){ $('#vc-ok').disabled = false; return ($('#vc-err').textContent = errText(x)); }
    await vehSetSnap(null);
    m.close(); await IDB.del('kv', CUR_UID + ':veh-list').catch(() => {}); toast(`${r.queued ? '📵 Guardado en el teléfono (se envía con señal) · ' : 'Jornada cerrada · '}${vehKm(km - Number(day.start_km || 0))} recorridos`); after && after();
  };
}

/* =====================================================================
   PANTALLA PRINCIPAL  #/tools/veh[/pestaña]   ·   #/tools/veh/start/<vehículo> (QR del parabrisas)
   ===================================================================== */
async function viewVeh(v){
  vehCss();
  try { await hhLoadBase(); } catch {}
  if (online() && can('veh', 2) && !isManager()){ try { VEHS.names = new Map(((await sb.rpc('veh_drivers')).data || []).map(d => [d.id, d.name])); } catch {} }
  const parts = location.hash.split('/'), sub = (parts[3] || '').replace(/[^a-z]/g, '');
  const mgr = can('veh', 3), inf = can('veh_inf');
  const tabs = [];
  if (can('veh', 2) || HHS.mine) tabs.push(['jornada', 'Mi jornada']);
  if (can('veh')) tabs.push(['enuso', 'En uso ahora']);
  if (mgr) tabs.push(['jornadas', 'Jornadas'], ['flota', 'Flota']);
  if (inf) tabs.push(['multas', 'Infracciones']);
  if (!tabs.length){ v.innerHTML = '<div class="card">No tenés acceso al control de vehículos.</div>'; return; }
  if (sub === 'start' && VEH_UUID.test(parts[4] || '')){ history.replaceState(null, '', '#/tools/veh'); setTimeout(() => vehStartModal(parts[4], () => viewVeh($('#view'))), 50); }
  const tab = tabs.some(t => t[0] === sub) ? sub : tabs[0][0]; VEHS.tab = tab;
  v.innerHTML = `<div class="row between" style="margin-bottom:8px"><button class="btn sec small" id="veh-back">← Herramientas</button></div>
    <div class="card" style="background:#0F2A4A;color:#fff;border:0;padding:14px 16px"><div class="row" style="gap:12px;flex-wrap:nowrap"><div style="font-size:30px;line-height:1">🚗</div><div><h2 style="margin:0;color:#fff">Control de vehículos</h2><div class="sm" style="opacity:.85">Km y foto del odómetro al iniciar y terminar, quién manejó cada tramo, flota e infracciones.</div></div></div></div>
    <div class="hh-tabs">${tabs.map(([k, n]) => `<button data-vt="${k}" class="${k === tab ? 'on' : ''}">${n}</button>`).join('')}</div>
    <div id="veh-body"><div class="card muted">Cargando…</div></div>`;
  hhCss();
  $('#veh-back').onclick = () => { location.hash = '#/tools'; };
  v.querySelectorAll('[data-vt]').forEach(b => b.onclick = () => { history.replaceState(null, '', '#/tools/veh/' + b.dataset.vt); viewVeh(v); });
  const body = $('#veh-body');
  if (!online() && tab !== 'jornada'){ body.innerHTML = '<div class="card">📵 Sin señal. En "Mi jornada" podés iniciar o terminar la jornada: se guarda en el teléfono y se envía sola cuando vuelva la señal.</div>'; return; }
  if (tab === 'jornada') await vehViewMine(body);
  else if (tab === 'enuso') await vehViewInUse(body);
  else if (tab === 'jornadas') await vehViewDays(body);
  else if (tab === 'flota') await vehViewFleet(body);
  else if (tab === 'multas') await vehViewFines(body);
}
const vehReload = () => viewVeh($('#view'));

function vehDrivesHTML(drives, day){
  if (!drives.length) return '';
  return `<div class="veh-tl">${drives.map(d => `<div class="${d.occasional ? 'oc' : ''}"><b>${esc(fmtTime(d.from_at))}</b> · ${esc(vehName(d.driver_id))}${d.occasional ? ' <span class="pill p-pend">ocasional</span>' : ''}<div class="sm muted">desde ${vehKm(d.from_km)}${d.to_at ? ' hasta las ' + esc(fmtTime(d.to_at)) + ' · ' + vehKm(d.to_km) + ' (' + vehKm(Number(d.to_km) - Number(d.from_km)) + ')' : ' · manejando ahora'}${d.from_photo ? ` · <a href="#" data-vph="${esc(d.from_photo)}">foto</a>` : ''}</div></div>`).join('')}
    ${day?.status === 'cerrada' && day.end_at ? `<div class="end"><b>${esc(fmtTime(day.end_at))}</b> · fin de jornada<div class="sm muted">${vehKm(day.end_km)} · recorrido ${vehKm(Number(day.end_km) - Number(day.start_km))}${day.end_photo ? ` · <a href="#" data-vph="${esc(day.end_photo)}">foto</a>` : ''}</div></div>` : ''}</div>`;
}
function vehBindPh(box){ box.querySelectorAll('[data-vph]').forEach(a => a.onclick = e => { e.preventDefault(); vehPhoto(a.dataset.vph); }); }

async function vehViewMine(body){
  const st = HHS.mine;
  const qbox = await vehQueueHTML();
  if (!online()) return vehViewOffline(body, qbox);
  if (!st){ body.innerHTML = `<div class="card"><b>Tu usuario todavía no está vinculado a un técnico.</b><p class="muted">Pedile al coordinador que te vincule en Validación de horas → Recursos.</p></div>`; return; }
  const [s, vs, days, fines] = await Promise.all([
    vehMyState(), vehLoadVehicles(),
    hhItems(sb.from('veh_days').select('*').eq('staff_id', st.id).order('start_at', { ascending: false }).limit(20)),
    hhItems(sb.from('veh_fines').select('id,vehicle_id,at,place,description,amount,status,act_no').eq('driver_id', st.id).order('at', { ascending: false }).limit(20)),
  ]);
  const o = s.open, plate = id => vs.find(x => x.id === id)?.plate || '';
  const ids = days.map(d => d.id).concat(s.drv ? [s.drv.day_id] : []);
  const drives = ids.length ? await hhItems(sb.from('veh_drives').select('*').in('day_id', ids).order('from_at')) : [];
  let html = '';
  if (o && o.day < todayStr()) html += `<div class="hq-red"><span style="font-size:24px">⚠️</span><div>Tenés la jornada del ${esc(fmtD(o.day))} sin cerrar.<div class="sm" style="font-weight:400">Cerrala antes de iniciar la de hoy.</div></div><button id="vm-close2">Cerrar ahora</button></div>`;
  if (o){
    html += `<div class="card"><div class="row between"><div><h2 style="margin:0">Jornada abierta</h2><div class="sm muted">desde ${esc(vehDT(o.start_at))}</div></div><span class="veh-plate">${esc(o.plate || '')}</span></div>
      ${o.km_gap ? `<div class="sm" style="color:var(--amber);margin-top:4px">⚠ ${vehKm(Math.abs(o.km_gap))} de diferencia con el último cierre del vehículo</div>` : ''}
      ${vehDrivesHTML(drives.filter(d => d.day_id === o.id))}
      ${canWrite() ? `<div class="row" style="margin-top:10px;flex-wrap:wrap"><button class="btn sec" id="vm-take" style="flex:1 1 220px">🔄 Cambio de conductor</button><button class="btn" id="vm-close" style="flex:1 1 220px;background:var(--red);border-color:var(--red)">🏁 Terminar jornada</button></div>` : ''}</div>`;
  } else if (s.drv){
    const dd = drives.filter(d => d.day_id === s.drv.day_id);
    html += `<div class="card"><h2 style="margin:0">Estás manejando <span class="veh-plate">${esc(plate(s.drv.vehicle_id))}</span></h2><p class="sm muted">Desde las ${esc(fmtTime(s.drv.from_at))} con ${vehKm(s.drv.from_km)}. El responsable del día cierra la jornada; si se lo devolvés, que registre el cambio de conductor.</p>${vehDrivesHTML(dd)}</div>`;
  } else {
    html += `<div class="card" style="text-align:center"><div style="font-size:40px">🚗</div><h2 style="margin:4px 0">Sin jornada abierta</h2><p class="muted sm">Al salir cargá la patente, los km y la foto del odómetro. Si hoy no usás vehículo, marcá "Sin vehículo".</p>
      ${canWrite() && can('veh', 2) ? '<button class="btn" id="vm-start" style="font-size:17px;padding:12px 22px">Iniciar jornada</button>' : ''}</div>`;
  }
  if (fines.length) html += `<div class="card"><h2 style="margin:0 0 6px">Mis infracciones</h2>${fines.map(f => `<div class="hh-it"><div class="row between"><b>${esc(plate(f.vehicle_id))} · ${esc(vehDT(f.at))}</b><span class="pill ${VEH_FST[f.status][1]}">${VEH_FST[f.status][0]}</span></div><div class="sm">${esc([f.place, f.description, f.act_no ? 'Acta ' + f.act_no : ''].filter(Boolean).join(' · '))}</div></div>`).join('')}<p class="muted sm">Si tenés un descargo, hablalo con el coordinador.</p></div>`;
  html += `<div class="card"><h2 style="margin:0 0 6px">Mis últimas jornadas</h2>${days.filter(d => d.status === 'cerrada').map(d => `<div class="hh-it"><div class="row between"><b>${esc(hhFmtDay(d.day))}</b>${d.vehicle_id ? `<span class="veh-plate">${esc(plate(d.vehicle_id))}</span>` : '<span class="pill p-info">Sin vehículo</span>'}</div>
      ${d.vehicle_id ? `<div class="sm muted">${esc(fmtTime(d.start_at))} a ${esc(fmtTime(d.end_at))} · ${vehKm(d.start_km)} → ${vehKm(d.end_km)} · <b>${vehKm(Number(d.end_km) - Number(d.start_km))}</b>${d.closed_by_name && d.closed_by_name !== d.created_by_name ? ' · cerró ' + esc(d.closed_by_name) : ''}</div>` : ''}</div>`).join('') || '<p class="muted">Todavía no hay jornadas.</p>'}</div>`;
  body.innerHTML = qbox + html;
  vehBindPh(body); vehBindQueue(body);
  const rowOf = () => ({ day_id: o.id, plate: o.plate, responsible: st.name, responsible_id: st.id, km: Math.max(Number(o.start_km || 0), ...drives.filter(d => d.day_id === o.id).map(d => Number(d.from_km || 0))), driver: vehName(drives.filter(d => d.day_id === o.id && !d.to_at).pop()?.driver_id) });
  $('#vm-start')?.addEventListener('click', () => vehStartModal(null, vehReload));
  $('#vm-close')?.addEventListener('click', () => vehCloseModal(o, vehReload));
  $('#vm-close2')?.addEventListener('click', () => vehCloseModal(o, vehReload));
  $('#vm-take')?.addEventListener('click', () => vehTakeModal(rowOf(), vehReload));
}

async function vehViewInUse(body){
  const list = (await sb.rpc('veh_open_list')).data || [];
  body.innerHTML = `<div class="card"><h2 style="margin:0 0 4px">Vehículos en uso ahora</h2><p class="muted sm" style="margin:0 0 8px">Si vas a manejar uno de estos, tocá "Tomo el volante": quedás como conductor desde ese momento.</p>
    ${list.length ? list.map((x, k) => `<div class="hh-it"><div class="row between" style="flex-wrap:nowrap"><div><span class="veh-plate">${esc(x.plate)}</span> <span class="sm muted">${esc(x.model || '')}</span>
      <div class="sm" style="margin-top:4px">Responsable: <b>${esc(x.responsible)}</b> desde ${esc(fmtTime(x.start_at))}${x.driver && x.driver !== x.responsible ? ' · maneja <b>' + esc(x.driver) + '</b>' : ''}</div></div>
      ${canWrite() && can('veh', 2) ? `<button class="btn small" data-vtk="${k}">🔄 Tomo el volante</button>` : ''}</div></div>`).join('') : '<p class="muted">No hay vehículos en uso.</p>'}</div>`;
  body.querySelectorAll('[data-vtk]').forEach(b => b.onclick = () => vehTakeModal(list[Number(b.dataset.vtk)], () => vehViewInUse(body)));
}

/* ---------- jornadas de todos (gestores) ---------- */
async function vehViewDays(body){
  const day = VEHS.day || todayStr(); VEHS.day = day;
  const vs = await vehLoadVehicles();
  const [days, open] = await Promise.all([
    hhItems(sb.from('veh_days').select('*').eq('day', day).order('start_at')),
    hhItems(sb.from('veh_days').select('*').eq('status', 'abierta').lt('day', day).order('day')),
  ]);
  const all = open.concat(days), ids = all.map(d => d.id);
  const drives = ids.length ? await hhItems(sb.from('veh_drives').select('*').in('day_id', ids).order('from_at')) : [];
  const vOf = id => vs.find(x => x.id === id);
  const tech = HHS.staff.filter(s => s.active && s.kind === 'tecnico');
  const noDay = day === todayStr() ? tech.filter(t => !days.some(d => d.staff_id === t.id) && !drives.some(x => x.driver_id === t.id && x.from_at.slice(0, 10) >= addDays(day, -1))) : [];
  const card = d => { const v = vOf(d.vehicle_id), dd = drives.filter(x => x.day_id === d.id), late = d.status === 'abierta' && d.day < todayStr();
    return `<div class="hh-it ${late ? 'urg' : ''}"><div class="row between" style="flex-wrap:nowrap"><div><b>${esc(hhStaffName(d.staff_id))}</b> <span class="sm muted">responsable</span>${late ? ` <span class="pill p-bad">sin cerrar desde el ${esc(fmtD(d.day))}</span>` : ''}</div>
      ${d.vehicle_id ? `<span class="veh-plate">${esc(v?.plate || '?')}</span>` : '<span class="pill p-info">Sin vehículo</span>'}</div>
      ${d.vehicle_id ? `<div class="sm muted">Inicio ${esc(fmtTime(d.start_at))} · ${vehKm(d.start_km)}${d.start_photo ? ` · <a href="#" data-vph="${esc(d.start_photo)}">foto inicio</a>` : ''}${d.km_gap ? ` · <span style="color:var(--amber);font-weight:600">⚠ ${vehKm(Math.abs(d.km_gap))} de diferencia con el cierre anterior</span>` : ''}</div>${vehDrivesHTML(dd, d)}` : ''}
      ${d.notes ? `<div class="sm">📝 ${esc(d.notes)}</div>` : ''}
      ${d.status === 'abierta' && canWrite() ? `<div class="row" style="gap:6px;margin-top:6px"><button class="btn sec small" data-vtd="${esc(d.id)}">🔄 Cambio de conductor</button><button class="btn sec small" data-vcd="${esc(d.id)}">🏁 Cerrar</button>${hhStaffPhone(d.staff_id) ? `<button class="btn sec small" data-vwa="${esc(d.id)}">💬 Recordar cierre</button>` : ''}</div>` : ''}</div>`; };
  const kmDay = days.filter(d => d.end_km != null).reduce((a, d) => a + Number(d.end_km) - Number(d.start_km || 0), 0);
  body.innerHTML = `<div class="card"><div class="row between"><div class="row" style="gap:6px"><button class="btn sec small" id="vd-prev">‹</button><input type="date" id="vd-day" value="${esc(day)}" style="width:auto"><button class="btn sec small" id="vd-next">›</button><button class="btn sec small" id="vd-today">Hoy</button></div>
      <button class="btn sec small" id="vd-xl">⬇ Excel del mes</button></div>
      <div class="stats" style="margin-top:10px"><div class="stat"><span>Jornadas</span><b>${days.length}</b></div><div class="stat"><span>Abiertas</span><b>${all.filter(d => d.status === 'abierta').length}</b></div><div class="stat"><span>Km del día (cerradas)</span><b>${vehKm(kmDay)}</b></div></div></div>
    ${open.length ? `<div class="card" style="border-color:#F3C1CB"><h2 style="margin:0 0 4px;color:var(--red)">⚠ Jornadas de días anteriores sin cerrar</h2>${open.map(card).join('')}</div>` : ''}
    <div class="card"><h2 style="margin:0 0 4px">${esc(hhFmtDay(day))}</h2>${days.map(card).join('') || '<p class="muted">No hay jornadas cargadas.</p>'}
      ${noDay.length ? `<p class="sm muted" style="margin-top:8px">Sin jornada cargada hoy: ${noDay.map(t => esc(t.name)).join(', ')}</p>` : ''}</div>`;
  vehBindPh(body);
  const go = d => { VEHS.day = d; vehViewDays(body); };
  $('#vd-prev').onclick = () => go(addDays(day, -1)); $('#vd-next').onclick = () => go(addDays(day, 1)); $('#vd-today').onclick = () => go(todayStr()); $('#vd-day').onchange = e => e.target.value && go(e.target.value);
  $('#vd-xl').onclick = () => vehExcel(day);
  const dOfId = id => all.find(x => x.id === id);
  const row = d => { const dd = drives.filter(x => x.day_id === d.id); return { day_id: d.id, plate: vOf(d.vehicle_id)?.plate || '', responsible: hhStaffName(d.staff_id), responsible_id: d.staff_id, km: Math.max(Number(d.start_km || 0), ...dd.map(x => Number(x.from_km || 0))), driver: hhStaffName(dd.filter(x => !x.to_at).pop()?.driver_id) }; };
  body.querySelectorAll('[data-vtd]').forEach(b => b.onclick = () => vehTakeModal(row(dOfId(b.dataset.vtd)), () => vehViewDays(body)));
  body.querySelectorAll('[data-vcd]').forEach(b => b.onclick = () => { const d = dOfId(b.dataset.vcd); vehCloseModal({ ...d, plate: vOf(d.vehicle_id)?.plate }, () => vehViewDays(body)); });
  body.querySelectorAll('[data-vwa]').forEach(b => b.onclick = () => { const d = dOfId(b.dataset.vwa), s = HHS.staff.find(x => x.id === d.staff_id);
    hhWa(s?.phone, `${HHS.cfg?.greeting || 'Buena jornada laboral'}, ${hhFirst(s?.name)}.\nTe recordamos cerrar en InspectApp la jornada del ${fmtD(d.day)} con el vehículo ${vOf(d.vehicle_id)?.plate || ''}: km y foto del odómetro.\n${hhSig()}`); });
}
const hhStaffPhone = id => HHS.staff.find(s => s.id === id)?.phone || '';

/* Excel del mes: jornadas y tramos (sin fórmulas, textos neutralizados) */
async function vehExcel(day){
  if (!needOnline()) return;
  const from = day.slice(0, 8) + '01', to = addDays(dStr(new Date(dOf(from).getFullYear(), dOf(from).getMonth() + 1, 1)), -1);
  const [days, vs] = await Promise.all([hhItems(sb.from('veh_days').select('*').gte('day', from).lte('day', to).order('day').order('start_at').limit(5000)), vehLoadVehicles()]);
  const ids = days.map(d => d.id), drives = [];
  for (let i = 0; i < ids.length; i += 200) drives.push(...await hhItems(sb.from('veh_drives').select('*').in('day_id', ids.slice(i, i + 200)).order('from_at')));
  await hhLoadExcelJS();
  const X = s => { s = s == null ? '' : String(s); return /^[=+\-@\t\r]/.test(s) ? "'" + s : s; };
  const wb = new ExcelJS.Workbook(); wb.creator = 'InspectApp';
  const hd = ws => { const r = ws.getRow(1); r.font = { bold: true, color: { argb: 'FFFFFFFF' } }; r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F2A4A' } }; ws.views = [{ state: 'frozen', ySplit: 1 }]; };
  const plate = id => vs.find(v => v.id === id)?.plate || '';
  const w1 = wb.addWorksheet('Jornadas');
  w1.columns = [{ header: 'Fecha', key: 'a', width: 12 }, { header: 'Responsable', key: 'b', width: 26 }, { header: 'Patente', key: 'c', width: 11 }, { header: 'Inicio', key: 'd', width: 8 }, { header: 'Km inicio', key: 'e', width: 11 }, { header: 'Fin', key: 'f', width: 8 }, { header: 'Km fin', key: 'g', width: 11 }, { header: 'Km recorridos', key: 'h', width: 13 }, { header: 'Dif. con cierre anterior', key: 'i', width: 14 }, { header: 'Estado', key: 'j', width: 10 }, { header: 'Observaciones', key: 'k', width: 40 }];
  days.forEach(d => w1.addRow({ a: hhXDate(d.day), b: X(hhStaffName(d.staff_id)), c: d.vehicle_id ? X(plate(d.vehicle_id)) : 'Sin vehículo', d: d.vehicle_id ? fmtTime(d.start_at) : '', e: d.start_km, f: d.end_at && d.vehicle_id ? fmtTime(d.end_at) : '', g: d.end_km, h: d.end_km != null ? Number(d.end_km) - Number(d.start_km || 0) : null, i: d.km_gap || null, j: d.status, k: X(d.notes || '') }));
  w1.getColumn('a').numFmt = 'dd/mm/yyyy'; hd(w1);
  const w2 = wb.addWorksheet('Tramos de manejo');
  w2.columns = [{ header: 'Fecha', key: 'a', width: 12 }, { header: 'Patente', key: 'b', width: 11 }, { header: 'Conductor', key: 'c', width: 26 }, { header: 'Tipo', key: 'd', width: 12 }, { header: 'Desde', key: 'e', width: 8 }, { header: 'Km desde', key: 'f', width: 11 }, { header: 'Hasta', key: 'g', width: 8 }, { header: 'Km hasta', key: 'h', width: 11 }, { header: 'Km', key: 'i', width: 9 }, { header: 'Responsable del día', key: 'j', width: 26 }];
  drives.forEach(x => { const d = days.find(y => y.id === x.day_id); w2.addRow({ a: hhXDate(d.day), b: X(plate(x.vehicle_id)), c: X(hhStaffName(x.driver_id)), d: x.occasional ? 'Ocasional' : 'Responsable', e: fmtTime(x.from_at), f: x.from_km, g: x.to_at ? fmtTime(x.to_at) : '', h: x.to_km, i: x.to_km != null ? Number(x.to_km) - Number(x.from_km) : null, j: X(hhStaffName(d.staff_id)) }); });
  w2.getColumn('a').numFmt = 'dd/mm/yyyy'; hd(w2);
  const buf = await wb.xlsx.writeBuffer();
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  a.download = `Vehiculos ${HH_MONTHS[dOf(from).getMonth()]} ${dOf(from).getFullYear()}.xlsx`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/* ---------- flota ---------- */
async function vehViewFleet(body){
  const { data: all } = await sb.from('veh_vehicles').select('*').order('active', { ascending: false }).order('plate');
  const list = all || [];
  const alerts = list.filter(v => v.active && vehDueChips(v)).length;
  body.innerHTML = `<div class="card"><div class="row between"><h2 style="margin:0">Flota · ${list.filter(v => v.active).length} vehículo(s)</h2>${canWrite() ? '<button class="btn small" id="vf-add">+ Vehículo</button>' : ''}</div>
      ${alerts ? `<p class="sm" style="color:var(--red);margin:6px 0 0">⚠ ${alerts} con vencimientos o service próximos</p>` : ''}</div>
    ${list.map(v => `<div class="hh-it" style="${v.active ? '' : 'opacity:.55'}"><div class="row between" style="flex-wrap:nowrap"><div><span class="veh-plate">${esc(v.plate)}</span> <b>${esc([v.brand, v.model].filter(Boolean).join(' '))}</b>${v.active ? '' : ' <span class="pill">de baja</span>'}
        <div class="sm muted" style="margin-top:4px">${esc(VEH_ORIG[v.origin])}${v.company ? ' · ' + esc(v.company) : ''} · ${v.km_last != null ? vehKm(v.km_last) : 'sin km'}${v.vtv_due ? ' · VTV ' + esc(fmtD(v.vtv_due)) : ''}${v.insurance_due ? ' · Seguro ' + esc(fmtD(v.insurance_due)) : ''}</div>
        <div style="margin-top:4px">${vehDueChips(v)}</div></div>
      <div class="row" style="gap:4px;flex-wrap:nowrap"><button class="btn sec small" data-vqr="${esc(v.id)}" title="QR para el parabrisas">🏷️</button>${canWrite() ? `<button class="btn sec small" data-ved="${esc(v.id)}">✏️</button>` : ''}</div></div></div>`).join('') || '<div class="card muted">Cargá los vehículos con + Vehículo.</div>'}`;
  $('#vf-add')?.addEventListener('click', () => vehEditModal(null, () => vehViewFleet(body)));
  body.querySelectorAll('[data-ved]').forEach(b => b.onclick = () => vehEditModal(list.find(v => v.id === b.dataset.ved), () => vehViewFleet(body)));
  body.querySelectorAll('[data-vqr]').forEach(b => b.onclick = () => vehQR(list.find(v => v.id === b.dataset.vqr)));
}
function vehEditModal(v, after){
  const x = v || { origin: 'propio', active: true };
  const m = modal(`<h2>${v ? 'Editar vehículo' : 'Nuevo vehículo'}</h2>
    <div class="row"><div class="grow"><label>Patente</label><input id="ve-p" maxlength="10" value="${esc(x.plate || '')}" placeholder="AB123CD" style="text-transform:uppercase"></div><div class="grow"><label>Origen</label><select id="ve-o">${Object.entries(VEH_ORIG).map(([k, n]) => `<option value="${k}" ${x.origin === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div></div>
    <div class="row"><div class="grow"><label>Marca</label><input id="ve-b" maxlength="60" value="${esc(x.brand || '')}"></div><div class="grow"><label>Modelo</label><input id="ve-m" maxlength="60" value="${esc(x.model || '')}"></div></div>
    <label>Empresa (alquiler o contratista)</label><input id="ve-c" maxlength="120" value="${esc(x.company || '')}">
    <div class="row"><div class="grow"><label>Vence VTV</label><input id="ve-v" type="date" value="${esc(x.vtv_due || '')}"></div><div class="grow"><label>Vence seguro</label><input id="ve-s" type="date" value="${esc(x.insurance_due || '')}"></div></div>
    <div class="row"><div class="grow"><label>Km actuales</label><input id="ve-k" type="number" min="0" value="${x.km_last ?? ''}"></div><div class="grow"><label>Próximo service (km)</label><input id="ve-sk" type="number" min="0" value="${x.service_km ?? ''}"></div></div>
    <label>Notas</label><input id="ve-n" maxlength="500" value="${esc(x.notes || '')}">
    ${v ? `<label style="display:flex;gap:8px;align-items:center;font-weight:400;margin-top:10px"><input type="checkbox" id="ve-a" style="width:auto" ${x.active ? 'checked' : ''}> Activo (destildar para dar de baja: el historial se conserva)</label>` : ''}
    <div class="err" id="ve-err"></div>
    <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn sec" id="ve-x">Cancelar</button><button class="btn" id="ve-ok">Guardar</button></div>`);
  $('#ve-x').onclick = m.close;
  $('#ve-ok').onclick = async () => {
    const num = id => $(id).value === '' ? null : Number($(id).value);
    const row = { plate: vehPlate($('#ve-p').value), origin: $('#ve-o').value, brand: $('#ve-b').value.trim() || null, model: $('#ve-m').value.trim() || null, company: $('#ve-c').value.trim() || null,
      vtv_due: $('#ve-v').value || null, insurance_due: $('#ve-s').value || null, km_last: num('#ve-k'), service_km: num('#ve-sk'), notes: $('#ve-n').value.trim() || null, active: v ? $('#ve-a').checked : true };
    if (!/^[A-Z0-9]{5,10}$/.test(row.plate)) return ($('#ve-err').textContent = 'Patente inválida (letras y números, sin espacios).');
    if (!needOnline()) return;
    $('#ve-ok').disabled = true;
    const { error } = v ? await sb.from('veh_vehicles').update(row).eq('id', v.id) : await sb.from('veh_vehicles').insert(row);
    $('#ve-ok').disabled = false;
    if (error) return ($('#ve-err').textContent = /duplicate|unique/i.test(error.message || '') ? 'Esa patente ya está cargada.' : errText(error));
    await IDB.del('kv', CUR_UID + ':veh-list').catch(() => {}); m.close(); toast('Guardado'); after && after();
  };
}
function vehQR(v){
  const svg = typeof dcQRSVG === 'function' ? dcQRSVG(vehLink(v.id)) : '';
  const m = modal(`<div style="text-align:center"><div style="width:220px;margin:0 auto">${svg}</div><h2 style="margin:10px 0 2px"><span class="veh-plate" style="font-size:22px">${esc(v.plate)}</span></h2><div class="muted sm">${esc([v.brand, v.model].filter(Boolean).join(' '))}</div>
    <p class="sm">Pegalo en el parabrisas: escaneándolo con la cámara del celular se abre "Iniciar jornada" con este vehículo ya elegido.</p>
    <div class="row" style="justify-content:center"><button class="btn sec" id="vq-x">Cerrar</button><button class="btn" id="vq-p">🖨️ Imprimir</button></div></div>`);
  $('#vq-x').onclick = m.close;
  $('#vq-p').onclick = () => vehPrint(`<div style="text-align:center;font-family:sans-serif;padding:30px"><div style="width:9cm;margin:0 auto">${svg}</div><div style="font-size:40px;font-weight:800;letter-spacing:3px;margin-top:10px">${esc(v.plate)}</div><div style="font-size:18px">Escaneá para iniciar o terminar la jornada · InspectApp</div></div>`);
}
function vehPrint(html){
  let p = document.getElementById('veh-print'); if (!p){ p = document.createElement('div'); p.id = 'veh-print'; document.body.appendChild(p); }
  p.innerHTML = html; document.body.classList.add('veh-printing');
  const done = () => { document.body.classList.remove('veh-printing'); p.innerHTML = ''; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done); setTimeout(() => window.print(), 50);
}

/* ---------- infracciones ---------- */
async function vehViewFines(body){
  const vs = await vehLoadVehicles();
  const { data } = await sb.from('veh_fines').select('*').order('at', { ascending: false }).limit(300);
  const list = data || [], w = can('veh_inf', 2) && canWrite();
  const plate = id => vs.find(v => v.id === id)?.plate || '?';
  body.innerHTML = `<div class="card"><div class="row between"><h2 style="margin:0">Infracciones</h2><div class="row" style="gap:6px"><button class="btn sec small" id="vi-who">🔍 ¿Quién lo tenía?</button>${w ? '<button class="btn small" id="vi-add">+ Cargar infracción</button>' : ''}</div></div>
      <p class="muted sm" style="margin:6px 0 0">Al cargarla, la app busca sola quién conducía en ese momento según los tramos registrados.</p></div>
    ${list.map(f => `<div class="hh-it" data-vf="${esc(f.id)}"><div class="row between" style="flex-wrap:nowrap"><div><span class="veh-plate">${esc(plate(f.vehicle_id))}</span> <b>${esc(vehDT(f.at))}</b></div><span class="pill ${VEH_FST[f.status][1]}">${VEH_FST[f.status][0]}</span></div>
      <div class="sm" style="margin-top:4px">${esc([f.place, f.description, f.act_no ? 'Acta ' + f.act_no : '', f.amount ? '$ ' + Number(f.amount).toLocaleString('es-AR') : ''].filter(Boolean).join(' · '))}</div>
      <div class="sm">${f.driver_id ? `Conducía: <b>${esc(hhStaffName(f.driver_id))}</b>${f.responsible_id && f.responsible_id !== f.driver_id ? ' · responsable del día: ' + esc(hhStaffName(f.responsible_id)) : ''}` : '<span style="color:var(--red)">⚠ No hay un tramo registrado a esa hora</span>'}${f.notified_at ? ' · avisado ' + esc(vehDT(f.notified_at)) : ''}</div>
      <div class="row" style="gap:6px;margin-top:6px">${f.driver_id ? '<button class="btn small" data-vfa="wa">💬 Avisar por WhatsApp</button>' : ''}<button class="btn sec small" data-vfa="det">Ver tramo</button><button class="btn sec small" data-vfa="pdf">📄 Constancia</button>${w ? `<select data-vfa="st" style="width:auto;padding:4px 6px;font-size:12px">${Object.entries(VEH_FST).map(([k, [n]]) => `<option value="${k}" ${f.status === k ? 'selected' : ''}>${n}</option>`).join('')}</select>` : ''}${f.photo_path ? '<button class="btn sec small" data-vfa="foto">Ver acta</button>' : ''}</div></div>`).join('') || '<div class="card muted">No hay infracciones cargadas.</div>'}`;
  $('#vi-who').onclick = () => vehWhoModal(vs);
  $('#vi-add')?.addEventListener('click', () => vehFineModal(vs, () => vehViewFines(body)));
  body.querySelectorAll('[data-vf]').forEach(card => { const f = list.find(x => x.id === card.dataset.vf);
    card.querySelectorAll('[data-vfa]').forEach(b => { const a = b.dataset.vfa;
      if (a === 'st') b.onchange = async () => { const { error } = await sb.from('veh_fines').update({ status: b.value }).eq('id', f.id); if (error){ toast(errText(error)); } else toast('Estado actualizado'); vehViewFines(body); };
      else b.onclick = async () => {
        if (a === 'wa') return vehFineWa(f, plate(f.vehicle_id), () => vehViewFines(body));
        if (a === 'foto') return vehPhoto(f.photo_path);
        const who = (await sb.rpc('veh_who', { p_vehicle: f.vehicle_id, p_at: f.at })).data;
        if (a === 'det') return vehWhoShow(who, plate(f.vehicle_id), f.at);
        if (a === 'pdf') return vehFinePdf(f, who, plate(f.vehicle_id));
      }; }); });
}
function vehFineMsg(f, plate, who){
  const d = HHS.staff.find(s => s.id === f.driver_id);
  return `${HHS.cfg?.greeting || 'Buena jornada laboral'}, ${hhFirst(d?.name || who?.driver?.name)}.\nTe informamos que se registró una infracción con el vehículo ${plate} el ${fmtDate(f.at)} a las ${fmtTime(f.at)}${f.place ? ' en ' + f.place : ''}.\n${f.description ? 'Motivo: ' + f.description + '\n' : ''}${f.act_no ? 'Acta: ' + f.act_no + '\n' : ''}Según el registro de InspectApp, en ese momento conducías vos${who?.from_at ? ' (tramo desde las ' + fmtTime(who.from_at) + ' con ' + vehKm(who.from_km) + ')' : ''}.\nSi tenés un descargo, respondé este mensaje.\n${hhSig()}`;
}
async function vehFineWa(f, plate, after){
  const d = HHS.staff.find(s => s.id === f.driver_id);
  const who = (await sb.rpc('veh_who', { p_vehicle: f.vehicle_id, p_at: f.at })).data;
  const phone = d?.phone || who?.driver?.phone;
  if (!phone) return toast('El conductor no tiene WhatsApp cargado (Validación de horas → Recursos).');
  const msg = vehFineMsg(f, plate, who);
  const m = modal(`<h2>💬 Avisar a ${esc(hhFirst(d?.name || who?.driver?.name))}</h2><div class="card" style="background:#E7F7F0;font-size:13px;white-space:pre-wrap">${esc(msg)}</div>
    <div class="row" style="justify-content:flex-end"><button class="btn sec" id="vw-x">Cancelar</button><button class="btn" id="vw-ok">Enviar por WhatsApp</button></div>`);
  $('#vw-x').onclick = m.close;
  $('#vw-ok').onclick = async () => { hhWa(phone, msg); m.close(); if (f.status === 'cargada' && can('veh_inf', 2)) await sb.from('veh_fines').update({ status: 'notificada' }).eq('id', f.id); after && after(); };
}
function vehFineModal(vs, after){
  const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const m = modal(`<h2>Cargar infracción</h2>
    <div class="row"><div class="grow"><label>Patente</label><select id="vf-v"><option value="">— Elegí —</option>${vs.map(v => `<option value="${esc(v.id)}">${esc(v.plate)}</option>`).join('')}</select></div><div class="grow"><label>Fecha y hora</label><input id="vf-at" type="datetime-local" max="${now}"></div></div>
    <div id="vf-who" class="sm" style="margin:6px 0"></div>
    <div class="row"><div class="grow"><label>N° de acta</label><input id="vf-n" maxlength="60"></div><div class="grow"><label>Monto</label><input id="vf-a" type="number" min="0" step="0.01"></div></div>
    <label>Lugar</label><input id="vf-pl" maxlength="200" placeholder="Ruta 9 km 512">
    <label>Motivo</label><input id="vf-d" maxlength="500" placeholder="Exceso de velocidad">
    <label>Foto del acta (opcional)</label><input id="vf-ph" type="file" accept="image/*">
    <div class="err" id="vf-err"></div>
    <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn sec" id="vf-x">Cancelar</button><button class="btn" id="vf-ok">Guardar</button></div>`);
  let who = null;
  const look = async () => { const v = $('#vf-v').value, at = $('#vf-at').value; who = null; if (!v || !at) return ($('#vf-who').innerHTML = '');
    const r = await sb.rpc('veh_who', { p_vehicle: v, p_at: new Date(at).toISOString() }); who = r.data;
    $('#vf-who').innerHTML = r.error ? esc(errText(r.error)) : who?.found ? `<div class="banner" style="margin:0;background:#DCFCE7;border-color:#BFE8D5"><span class="dot"></span><div>Conducía <b>${esc(who.driver?.name)}</b>${who.occasional ? ' (conductor ocasional)' : ''} desde las ${esc(fmtTime(who.from_at))} · responsable del día: ${esc(who.responsible?.name)}</div></div>`
      : `<div class="banner warn" style="margin:0"><span class="dot"></span><div><b>No hay un tramo registrado a esa hora.</b>${who?.before ? '<div>Antes: ' + esc(who.before.driver) + ' hasta ' + esc(vehDT(who.before.to_at)) + '</div>' : ''}${who?.after ? '<div>Después: ' + esc(who.after.driver) + ' desde ' + esc(vehDT(who.after.from_at)) + '</div>' : ''}</div></div>`; };
  $('#vf-v').onchange = look; $('#vf-at').onchange = look;
  $('#vf-x').onclick = m.close;
  $('#vf-ok').onclick = async () => {
    $('#vf-err').textContent = '';
    const v = $('#vf-v').value, at = $('#vf-at').value;
    if (!v || !at) return ($('#vf-err').textContent = 'Elegí la patente y la fecha y hora.');
    if (new Date(at) > new Date()) return ($('#vf-err').textContent = 'La fecha no puede ser futura.');
    $('#vf-ok').disabled = true;
    try {
      const f = $('#vf-ph').files[0], row = { vehicle_id: v, at: new Date(at).toISOString(), act_no: $('#vf-n').value.trim() || null, amount: $('#vf-a').value === '' ? null : Number($('#vf-a').value), place: $('#vf-pl').value.trim() || null, description: $('#vf-d').value.trim() || null };
      if (f) row.photo_path = await vehUpload(f);
      const { data, error } = await sb.from('veh_fines').insert(row).select('*').single(); if (error) throw error;
      m.close(); toast(data.driver_id ? 'Cargada. Conducía ' + hhStaffName(data.driver_id) : 'Cargada, sin conductor registrado a esa hora');
      if (data.driver_id) return vehFineWa(data, vs.find(x => x.id === v)?.plate || '', after);
      after && after();
    } catch (x){ $('#vf-ok').disabled = false; $('#vf-err').textContent = errText(x); }
  };
}
function vehWhoModal(vs){
  const m = modal(`<h2>🔍 ¿Quién lo tenía?</h2><div class="row"><div class="grow"><label>Patente</label><select id="vw-v"><option value="">— Elegí —</option>${vs.map(v => `<option value="${esc(v.id)}">${esc(v.plate)}</option>`).join('')}</select></div><div class="grow"><label>Fecha y hora</label><input id="vw-at" type="datetime-local"></div></div>
    <div class="err" id="vw-err"></div><div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn sec" id="vw-x">Cerrar</button><button class="btn" id="vw-ok">Buscar</button></div>`);
  $('#vw-x').onclick = m.close;
  $('#vw-ok').onclick = async () => { const v = $('#vw-v').value, at = $('#vw-at').value; if (!v || !at) return ($('#vw-err').textContent = 'Elegí la patente y la fecha y hora.');
    const r = await sb.rpc('veh_who', { p_vehicle: v, p_at: new Date(at).toISOString() }); if (r.error) return ($('#vw-err').textContent = errText(r.error));
    vehWhoShow(r.data, vs.find(x => x.id === v)?.plate || '', new Date(at).toISOString()); };
}
function vehWhoShow(w, plate, at){
  const body = !w?.found ? `<div class="banner warn"><span class="dot"></span><div><b>No hay un tramo registrado a esa hora.</b>${w?.before ? '<div class="sm">Antes: ' + esc(w.before.driver) + ' hasta ' + esc(vehDT(w.before.to_at)) + '</div>' : ''}${w?.after ? '<div class="sm">Después: ' + esc(w.after.driver) + ' desde ' + esc(vehDT(w.after.from_at)) + '</div>' : ''}</div></div>`
    : `<div class="card" style="background:var(--bg)"><div class="sm muted">Conducía</div><div class="hh-big">${esc(w.driver?.name)}</div><div class="sm">${w.occasional ? 'Conductor ocasional · ' : ''}${esc(w.driver?.company || '')}${w.driver?.phone ? ' · ' + esc(w.driver.phone) : ''}</div>
        <div class="sm" style="margin-top:6px">Tramo desde las ${esc(fmtTime(w.from_at))} con ${vehKm(w.from_km)}${w.to_at ? ' hasta las ' + esc(fmtTime(w.to_at)) + ' con ' + vehKm(w.to_km) : ''} · responsable del día: <b>${esc(w.responsible?.name)}</b></div></div>
      <h3 style="margin:8px 0 2px">Tramos de ese día</h3>${(w.drives || []).map(d => `<div class="sm">${esc(fmtTime(d.from_at))}${d.to_at ? '–' + esc(fmtTime(d.to_at)) : ''} · ${esc(d.driver)}${d.occasional ? ' (ocasional)' : ''} · ${vehKm(d.from_km)}${d.to_km != null ? ' → ' + vehKm(d.to_km) : ''}</div>`).join('')}
      ${(w.tasks || []).length ? `<h3 style="margin:8px 0 2px">Tareas cargadas ese día</h3>${w.tasks.map(t => `<div class="sm">${esc(HH_KIND_S[t.kind] || t.kind)}${t.start ? ' ' + esc(hhT(t.start)) + '–' + esc(hhT(t.end)) : ''} · ${esc(t.title)}</div>`).join('')}` : ''}
      <div class="row" style="gap:6px;margin-top:8px">${w.from_photo ? `<button class="btn sec small" data-vph="${esc(w.from_photo)}">Foto al tomar el volante</button>` : ''}${w.end_photo ? `<button class="btn sec small" data-vph="${esc(w.end_photo)}">Foto de cierre</button>` : ''}${w.lat ? `<a class="btn sec small" target="_blank" rel="noopener" href="https://www.google.com/maps?q=${Number(w.lat)},${Number(w.lng)}">📍 Dónde tomó el volante</a>` : ''}</div>`;
  const m = modal(`<h2><span class="veh-plate">${esc(plate)}</span> · ${esc(vehDT(at))}</h2>${body}<div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn sec" id="vws-x">Cerrar</button></div>`);
  m.el.querySelectorAll('[data-vph]').forEach(b => b.onclick = () => vehPhoto(b.dataset.vph));
  $('#vws-x').onclick = m.close;
}
function vehFinePdf(f, w, plate){
  const L = (k, v) => `<tr><td style="padding:6px 10px;border:1px solid #CBD5E1;background:#F1F5F9;width:38%"><b>${k}</b></td><td style="padding:6px 10px;border:1px solid #CBD5E1">${v}</td></tr>`;
  vehPrint(`<div style="font-family:Arial,sans-serif;max-width:720px;margin:0 auto;padding:24px;color:#0F172A">
    <div style="border-bottom:3px solid #0F2A4A;padding-bottom:8px;margin-bottom:16px"><div style="font-size:12px;color:#64748B">${esc(org?.name || '')} · InspectApp</div><div style="font-size:22px;font-weight:700">Constancia de conductor del vehículo</div></div>
    <table style="border-collapse:collapse;width:100%;font-size:14px">
      ${L('Vehículo', esc(plate))}${L('Fecha y hora de la infracción', esc(vehDT(f.at)))}${L('Lugar', esc(f.place || '—'))}${L('Motivo', esc(f.description || '—'))}${L('N° de acta', esc(f.act_no || '—'))}${f.amount ? L('Monto', '$ ' + esc(Number(f.amount).toLocaleString('es-AR'))) : ''}
      ${w?.found ? L('Conductor en ese momento', '<b>' + esc(w.driver?.name) + '</b>' + (w.occasional ? ' (conductor ocasional)' : '') + (w.driver?.company ? ' · ' + esc(w.driver.company) : '')) + L('Tramo de manejo', 'desde ' + esc(vehDT(w.from_at)) + ' con ' + vehKm(w.from_km) + (w.to_at ? ' hasta ' + esc(vehDT(w.to_at)) + ' con ' + vehKm(w.to_km) : ' (sin cierre)')) + L('Responsable del día', esc(w.responsible?.name)) : L('Conductor', 'No hay un tramo registrado a esa hora')}
      ${L('Estado', esc(VEH_FST[f.status][0]))}${f.notified_at ? L('Notificado', esc(vehDT(f.notified_at))) : ''}
    </table>
    ${w?.found && (w.drives || []).length ? `<div style="margin-top:14px;font-size:13px"><b>Tramos registrados ese día</b>${w.drives.map(d => `<div>${esc(fmtTime(d.from_at))}${d.to_at ? '–' + esc(fmtTime(d.to_at)) : ''} · ${esc(d.driver)}${d.occasional ? ' (ocasional)' : ''} · ${vehKm(d.from_km)}${d.to_km != null ? ' → ' + vehKm(d.to_km) : ''}</div>`).join('')}</div>` : ''}
    <p style="font-size:12px;color:#64748B;margin-top:16px">Los tramos se registran en InspectApp con hora del servidor, km y foto del odómetro al tomar el volante. Emitido el ${esc(vehDT(new Date().toISOString()))} por ${esc(me.full_name || me.email)}.</p>
    <div style="display:flex;gap:40px;margin-top:60px;font-size:13px"><div style="flex:1;border-top:1px solid #0F172A;padding-top:4px;text-align:center">Firma del conductor</div><div style="flex:1;border-top:1px solid #0F172A;padding-top:4px;text-align:center">Firma de coordinación</div></div></div>`);
}


/* =====================================================================
   SIN SEÑAL: la jornada se guarda en el teléfono y se envía sola
   ===================================================================== */
const VEH_RPC = { start: 'veh_start_day', take: 'veh_take_wheel', close: 'veh_close_day' };
const vehQ = async () => (await IDB.get('kv', CUR_UID + ':vehq').catch(() => null)) || [];
const vehQSave = q => IDB.put('kv', q, CUR_UID + ':vehq').catch(() => {});
const vehQFail = async () => (await IDB.get('kv', CUR_UID + ':vehq-err').catch(() => null)) || [];
const vehSnap = async () => (await IDB.get('kv', CUR_UID + ':veh-open').catch(() => null)) || null;
const vehSetSnap = o => o ? IDB.put('kv', o, CUR_UID + ':veh-open').catch(() => {}) : IDB.del('kv', CUR_UID + ':veh-open').catch(() => {});
/* hace la operación ya; si no hay señal (o se corta) la deja en cola. Devuelve { queued } */
async function vehDo(op, args, file, label){
  const blob = file ? await compressImage(file, 1600, 0.8) : null;
  const photo = blob ? `${me.org_id}/veh/${uid()}/${uid()}.jpg` : null;
  const a = { ...args, p_photo: photo, p_at: new Date().toISOString() };
  const pend = (await vehQ()).length;
  if (online() && !pend){
    try {
      if (blob){ const { error } = await sb.storage.from('fotos').upload(photo, blob, { contentType: 'image/jpeg', upsert: false }); if (error && !/exist|duplicate/i.test(error.message || '')) throw error; }
      const { error } = await sb.rpc(VEH_RPC[op], a); if (error) throw error;
      return { queued: false };
    } catch (e){ if (!isNetErr(e)) throw e; }
  }
  const id = uid();
  if (blob) await IDB.put('blobs', blob, 'vehq:' + id);
  const q = await vehQ(); q.push({ id, op, args: a, photo, label: label || op, at: a.p_at }); await vehQSave(q);
  if (online()) setTimeout(() => vehFlush(), 500);
  return { queued: true };
}
let VEHQ_BUSY = false;
async function vehFlush(){
  if (VEHQ_BUSY || !online() || !me || !CUR_UID) return;
  let q = await vehQ(); if (!q.length) return;
  VEHQ_BUSY = true; let sent = 0, photos = 0, failed = 0;
  try {
    while (q.length){
      const it = q[0];
      try {
        if (it.photo){
          const blob = await IDB.get('blobs', 'vehq:' + it.id).catch(() => null);
          if (blob){ const { error } = await sb.storage.from('fotos').upload(it.photo, blob, { contentType: 'image/jpeg', upsert: false }); if (error && !/exist|duplicate/i.test(error.message || '')) throw error; }
        }
        const { error } = await sb.rpc(VEH_RPC[it.op], it.args); if (error) throw error;
        sent++; if (it.photo) photos++;
      } catch (e){
        if (isNetErr(e)) break;                                           // se cortó otra vez: sigue después
        failed++; const f = await vehQFail(); f.push({ ...it, err: errText(e) }); await IDB.put('kv', f.slice(-30), CUR_UID + ':vehq-err').catch(() => {});
        if (it.op === 'start') await vehSetSnap(null);
      }
      await IDB.del('blobs', 'vehq:' + it.id).catch(() => {});
      q.shift(); await vehQSave(q);
    }
  } finally { VEHQ_BUSY = false; }
  if (sent){
    await IDB.del('kv', CUR_UID + ':veh-list').catch(() => {});
    vehNotify('✅ Vehículo: datos enviados', `Se enviaron ${sent} registro(s) de la jornada${photos ? ` con ${photos} foto(s) del odómetro. Ya podés borrar la foto de la galería del teléfono si quedó guardada` : ''}.`);
  }
  if (failed) vehNotify('⚠️ Vehículo: no se pudo enviar', `${failed} registro(s) cargados sin señal no los aceptó el servidor. Abrí Vehículos → Mi jornada para ver el motivo.`);
  if ((sent || failed) && location.hash.startsWith('#/tools/veh')) vehReload();
}
function vehNotify(title, body){
  toast(body);
  try { if ('Notification' in window && Notification.permission === 'granted' && navigator.serviceWorker) navigator.serviceWorker.ready.then(r => r.showNotification(title, { body, icon: 'icon-192.png', badge: 'icon-192.png', tag: 'veh-sync', data: { url: '#/tools/veh' } })).catch(() => {}); } catch {}
}
async function vehQueueHTML(){
  const q = await vehQ(), f = await vehQFail();
  let h = '';
  if (q.length) h += `<div class="banner warn" style="margin:0 0 12px"><span class="dot"></span><div><b>📤 ${q.length} registro(s) del vehículo por enviar</b><div class="sm">${q.map(x => esc(x.label) + ' · ' + esc(fmtTime(x.at))).join(' · ')}</div><div class="sm">Se envían solos cuando vuelve la señal. No borres la foto del odómetro hasta que te avise.</div>${online() ? '<button class="btn small" id="vq-go" style="margin-top:6px">Enviar ahora</button>' : ''}</div></div>`;
  if (f.length) h += `<div class="banner off" style="margin:0 0 12px"><span class="dot"></span><div><b>⚠️ No se pudo enviar</b>${f.map((x, i) => `<div class="sm">${esc(x.label)} (${esc(fmtDT(x.at))}): ${esc(x.err)} <a href="#" data-vqx="${i}">quitar aviso</a></div>`).join('')}<div class="sm">Avisale al coordinador para que lo cargue a mano.</div></div></div>`;
  return h;
}
function vehBindQueue(box){
  box.querySelector('#vq-go')?.addEventListener('click', () => vehFlush());
  box.querySelectorAll('[data-vqx]').forEach(a => a.onclick = async e => { e.preventDefault(); const f = await vehQFail(); f.splice(Number(a.dataset.vqx), 1); await IDB.put('kv', f, CUR_UID + ':vehq-err').catch(() => {}); vehReload(); });
}
async function vehViewOffline(body, qbox){
  const o = await vehSnap();
  body.innerHTML = qbox + (o ? `<div class="card"><div class="row between"><div><h2 style="margin:0">Jornada abierta</h2><div class="sm muted">desde ${esc(vehDT(o.start_at))} · ${vehKm(o.start_km)}</div></div><span class="veh-plate">${esc(o.plate || '')}</span></div>
      <p class="sm muted">📵 Sin señal: lo que cargues se guarda en el teléfono y se envía solo.</p>
      ${canWrite() ? `<div class="row" style="margin-top:10px;flex-wrap:wrap"><button class="btn sec" id="vo-take" style="flex:1 1 220px">🔄 Cambio de conductor</button><button class="btn" id="vo-close" style="flex:1 1 220px;background:var(--red);border-color:var(--red)">🏁 Terminar jornada</button></div>` : ''}</div>`
    : `<div class="card" style="text-align:center"><div style="font-size:40px">🚗</div><h2 style="margin:4px 0">📵 Sin señal</h2><p class="muted sm">Podés iniciar la jornada igual: se guarda en el teléfono con la hora de ahora y se envía sola cuando vuelva la señal.</p>
      ${canWrite() && can('veh', 2) ? '<button class="btn" id="vo-start" style="font-size:17px;padding:12px 22px">Iniciar jornada</button>' : ''}</div>`);
  vehBindQueue(body);
  $('#vo-start')?.addEventListener('click', () => vehStartModal(null, vehReload));
  $('#vo-close')?.addEventListener('click', () => vehCloseModal(o, vehReload));
  $('#vo-take')?.addEventListener('click', () => vehTakeModal({ day_id: o.id, plate: o.plate, responsible: HHS.mine?.name || '', responsible_id: HHS.mine?.id, km: o.start_km }, vehReload));
}
