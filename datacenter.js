/* =====================================================================
   InspectApp · Transformándonos — v4.4
   Herramientas → Relevamiento DC
   Data centers, salas, plano, racks, equipos, paneles, cableado con
   recorrido punta a punta, energía, carriers, VLAN/IP, etiquetas QR,
   historial, importación del Excel de racks y exportación.
   Trabaja sin señal: todo se guarda primero en el teléfono y se envía
   cuando vuelve internet, con control de versión (si dos técnicos tocan
   lo mismo, la app pregunta en vez de pisar).
   Usa las utilidades de index.html ($, esc, sb, me, org, modal, toast…).
   Este archivo solo declara funciones: no ejecuta nada al cargarse.
   ===================================================================== */

/* ---------- catálogos ---------- */
const DC_ROLE = {
  switch:      { n: 'Switch',            c: '#2A78D6', bg: '#E6F0FB' },
  router:      { n: 'Router',            c: '#7C3AED', bg: '#F1EAFD' },
  firewall:    { n: 'Firewall',          c: '#C8102E', bg: '#FDECEF' },
  server:      { n: 'Servidor',          c: '#0E7490', bg: '#E3F4F7' },
  storage:     { n: 'Storage',           c: '#B7791F', bg: '#FEF6E4' },
  san:         { n: 'Switch SAN',        c: '#6D28D9', bg: '#EFE9FC' },
  carrier:     { n: 'Equipo de carrier', c: '#0F766E', bg: '#E2F5F2' },
  panel_fo:    { n: 'Panel de fibra',    c: '#E08A00', bg: '#FFF4E0' },
  panel_utp:   { n: 'Panel UTP',         c: '#16A34A', bg: '#E8F7EE' },
  ordenador:   { n: 'Ordenador',         c: '#64748B', bg: '#EEF1F5' },
  ciego:       { n: 'Panel ciego',       c: '#94A3B8', bg: '#F1F4F8' },
  bandeja:     { n: 'Bandeja',           c: '#94A3B8', bg: '#F1F4F8' },
  pdu:         { n: 'PDU',               c: '#334155', bg: '#E9EDF2' },
  ups:         { n: 'UPS',               c: '#1E293B', bg: '#E5E9EF' },
  kvm:         { n: 'Monitor / KVM',     c: '#475569', bg: '#EDF0F4' },
  otro:        { n: 'Otro equipo',       c: '#5B6878', bg: '#EEF1F5' },
  externo:     { n: 'Fuera del rack',    c: '#8A94A3', bg: '#F3F5F8' },
  desconocido: { n: 'No identificado',   c: '#DC2626', bg: '#FDECEC' },
};
const DC_STATUS = { activo: 'Activo', planificado: 'Planificado', falla: 'En falla', retirado: 'Retirado', desconocido: 'A identificar' };
const DC_CABLE = {
  fibra_mm: { n: 'Fibra MM',      c: '#0EA5A4' },
  fibra_sm: { n: 'Fibra SM',      c: '#D4A106' },
  utp:      { n: 'UTP',           c: '#2A78D6' },
  dac:      { n: 'DAC / Twinax',  c: '#6B7280' },
  aoc:      { n: 'AOC',           c: '#8B5CF6' },
  fc:       { n: 'Fibre Channel', c: '#DB2777' },
  power:    { n: 'Energía',       c: '#DC2626' },
  coax:     { n: 'Coaxial',       c: '#92400E' },
  otro:     { n: 'Otro',          c: '#5B6878' },
};
const DC_CABLE_ST = { conectado: 'Conectado', planificado: 'Planificado', falla: 'En falla' };
const DC_PORT_TY = { rj45: 'RJ45', sfp: 'SFP/SFP+', sfp28: 'SFP28', qsfp: 'QSFP', lc_mm: 'LC MM', lc_sm: 'LC SM', sc: 'SC', fc: 'FC', mgmt: 'Gestión', console: 'Consola', power: 'Toma', otro: 'Otro' };
const DC_PORT_CABLE = { rj45: 'utp', mgmt: 'utp', console: 'utp', lc_mm: 'fibra_mm', lc_sm: 'fibra_sm', sc: 'fibra_sm', fc: 'fc', power: 'power', sfp: 'fibra_mm', sfp28: 'fibra_mm', qsfp: 'fibra_mm' };
const DC_COLORS = { '': 'Sin color', azul: '#2563EB', amarillo: '#EAB308', naranja: '#F97316', aqua: '#06B6D4', verde: '#16A34A', rojo: '#DC2626', gris: '#6B7280', negro: '#111827', blanco: '#F9FAFB', violeta: '#7C3AED', rosa: '#EC4899' };
const DC_ROOM_KIND = { sala: 'Sala de equipos', carrier: 'Sala de carrier', energia: 'Sala de energía', otro: 'Otro' };
const DC_FEED_KIND = { ups: 'UPS', tablero: 'Tablero', generador: 'Generador', red: 'Red eléctrica' };

/* ---------- biblioteca de modelos (se puede ampliar desde la app) ---------- */
const dcG = (f, t, ty, pre = '') => ({ f, t, ty, pre });
const dcN = (names, ty) => ({ names, ty });
const DC_BUILTIN = [
  // id, marca, modelo, U, rol, puertos, W, reconoce (import)
  ['b-n93180', 'Cisco', 'Nexus 93180YC-FX3', 1, 'switch', [dcG(1, 48, 'sfp28'), dcG(49, 54, 'qsfp'), dcN(['MGMT', 'CON'], 'mgmt')], 425, /93180/],
  ['b-n9332c', 'Cisco', 'Nexus N9K-C9332C', 1, 'switch', [dcG(1, 32, 'qsfp'), dcN(['MGMT', 'CON'], 'mgmt')], 530, /9332c/],
  ['b-n93600', 'Cisco', 'Nexus 93600CD-GX', 1, 'switch', [dcG(1, 36, 'qsfp'), dcN(['MGMT', 'CON'], 'mgmt')], 650, /93600/],
  ['b-c9500', 'Cisco', 'Catalyst C9500-48Y4C', 1, 'switch', [dcG(1, 48, 'sfp28'), dcG(49, 52, 'qsfp'), dcN(['MGMT', 'CON'], 'mgmt')], 400, /9500/],
  ['b-c9200', 'Cisco', 'Catalyst 9200L-24P-4X', 1, 'switch', [dcG(1, 24, 'rj45'), dcG(25, 28, 'sfp'), dcN(['CON'], 'console')], 125, /9200/],
  ['b-c3850', 'Cisco', 'Catalyst 3850-24', 1, 'switch', [dcG(1, 24, 'rj45'), dcG(25, 28, 'sfp'), dcN(['MGMT', 'CON'], 'mgmt')], 350, /3850/],
  ['b-cbs220', 'Cisco', 'Business 220 24 puertos', 1, 'switch', [dcG(1, 24, 'rj45'), dcG(25, 28, 'sfp')], 40, /business 220|cbs ?220/],
  ['b-asr1001', 'Cisco', 'ASR 1001', 1, 'router', [dcN(['GE0', 'GE1', 'GE2', 'GE3', 'GE4', 'GE5', 'TE0', 'TE1', 'MGMT', 'CON'], 'sfp')], 400, /asr ?1001/],
  ['b-fpr3100', 'Cisco', 'Secure Firewall 3100', 1, 'firewall', [dcG(1, 8, 'rj45'), dcG(9, 16, 'sfp'), dcN(['MGMT', 'CON'], 'mgmt')], 400, /(secure|segure) firewall|fpr ?31/],
  ['b-fg1800f', 'Fortinet', 'FortiGate 1800F', 2, 'firewall', [dcG(1, 40, 'sfp'), dcN(['MGMT1', 'MGMT2', 'HA1', 'HA2', 'CON'], 'mgmt')], 550, /1800 ?f/],
  ['b-fsm2200g', 'Fortinet', 'FortiSIEM 2200G', 2, 'server', [dcG(1, 4, 'rj45'), dcG(5, 6, 'sfp'), dcN(['MGMT'], 'mgmt')], 500, /fortisiem|2200g/],
  ['b-mds9148s', 'Cisco', 'MDS DS-C9148S', 1, 'san', [dcG(1, 48, 'fc'), dcN(['MGMT ETH', 'CON'], 'mgmt')], 300, /9148 ?s/],
  ['b-mds9148t', 'Cisco', 'MDS DS-C9148T', 1, 'san', [dcG(1, 48, 'fc'), dcN(['MGMT ETH', 'CON'], 'mgmt')], 350, /9148 ?t/],
  ['b-pure-fa', 'Pure Storage', 'FlashArray', 3, 'storage', [dcG(0, 11, 'sfp', 'ETH '), dcG(0, 7, 'fc', 'FC '), dcN(['MGMT0', 'MGMT1'], 'mgmt')], 1300, /pure.*flash ?array|flash ?array/],
  ['b-pure-df', 'Pure Storage', 'DirectFlash Shelf', 3, 'storage', [dcG(0, 3, 'qsfp', 'SAS ')], 700, /direct ?flash/],
  ['b-aff-a250', 'NetApp', 'AFF A250', 2, 'storage', [dcG(1, 8, 'sfp', 'e0'), dcN(['MGMT'], 'mgmt')], 800, /aff.*a ?250/],
  ['b-aff-c30', 'NetApp', 'AFF C30', 2, 'storage', [dcG(1, 8, 'sfp', 'e0'), dcN(['MGMT'], 'mgmt')], 900, /aff.*c ?30/],
  ['b-r650xs', 'Dell', 'PowerEdge R650xs', 1, 'server', [dcG(0, 3, 'sfp'), dcN(['iDRAC'], 'mgmt')], 600, /r650/],
  ['b-r660xs', 'Dell', 'PowerEdge R660xs', 1, 'server', [dcG(0, 3, 'sfp'), dcN(['iDRAC'], 'mgmt')], 650, /r660/],
  ['b-r760xs', 'Dell', 'PowerEdge R760xs', 2, 'server', [dcG(0, 3, 'sfp'), dcN(['iDRAC'], 'mgmt')], 800, /r760/],
  ['b-r440', 'Dell', 'PowerEdge R440', 1, 'server', [dcG(0, 3, 'rj45'), dcN(['iDRAC'], 'mgmt')], 450, /r440/],
  ['b-lenovo1u', 'Lenovo', 'ThinkSystem 1U', 1, 'server', [dcG(0, 3, 'sfp'), dcN(['XCC'], 'mgmt')], 550, /lenovo/],
  ['b-ciena3924', 'Ciena', '3924', 1, 'carrier', [dcG(1, 24, 'rj45'), dcG(25, 28, 'sfp')], 60, /ciena/],
  ['b-unifi-sw24', 'Ubiquiti', 'UniFi Switch 24', 1, 'switch', [dcG(1, 24, 'rj45'), dcG(25, 26, 'sfp')], 60, /unifi.*switch|switch.*unifi/],
  ['b-unifi-gw', 'Ubiquiti', 'UniFi Gateway', 1, 'router', [dcG(1, 8, 'rj45'), dcG(9, 10, 'sfp')], 40, /unifi/],
  ['b-linksys', 'Linksys', 'Switch 24', 1, 'switch', [dcG(1, 24, 'rj45')], 30, /linksys/],
  ['b-zte', 'ZTE', 'Módem', 0, 'carrier', [dcG(1, 4, 'rj45'), dcN(['WAN'], 'rj45')], 15, /zte/],
  // genéricos
  ['g-pfo-mm24', '', 'Panel de fibra MM 24', 1, 'panel_fo', [dcG(1, 24, 'lc_mm')], 0, null, { panel: true }],
  ['g-pfo-mm48', '', 'Panel de fibra MM 48', 2, 'panel_fo', [dcG(1, 48, 'lc_mm')], 0, null, { panel: true }],
  ['g-pfo-sm24', '', 'Panel de fibra SM 24', 1, 'panel_fo', [dcG(1, 24, 'lc_sm')], 0, null, { panel: true }],
  ['g-pfo-sm48', '', 'Panel de fibra SM 48', 2, 'panel_fo', [dcG(1, 48, 'lc_sm')], 0, null, { panel: true }],
  ['g-putp6a-24', '', 'Panel UTP Cat 6A 24', 1, 'panel_utp', [dcG(1, 24, 'rj45')], 0, null, { panel: true }],
  ['g-putp6a-48', '', 'Panel UTP Cat 6A 48', 2, 'panel_utp', [dcG(1, 48, 'rj45')], 0, null, { panel: true }],
  ['g-putp6-24', '', 'Panel UTP Cat 6 24', 1, 'panel_utp', [dcG(1, 24, 'rj45')], 0, null, { panel: true }],
  ['g-odf', '', 'ODF / bandeja de empalme', 1, 'panel_fo', [dcG(1, 24, 'sc')], 0, null, { panel: true }],
  ['g-carrier-fo', '', 'Fibra de proveedor (pares)', 1, 'panel_fo', [dcG(1, 12, 'lc_sm', 'Par ')], 0, null, { panel: true }],
  ['g-ord1', '', 'Ordenador 1U', 1, 'ordenador', [], 0],
  ['g-ord2', '', 'Ordenador 2U', 2, 'ordenador', [], 0],
  ['g-ciego1', '', 'Panel ciego 1U', 1, 'ciego', [], 0],
  ['g-ciego2', '', 'Panel ciego 2U', 2, 'ciego', [], 0],
  ['g-bandeja', '', 'Bandeja', 1, 'bandeja', [], 0],
  ['g-sw24', '', 'Switch 24 puertos', 1, 'switch', [dcG(1, 24, 'rj45'), dcG(25, 28, 'sfp'), dcN(['MGMT'], 'mgmt')], 150],
  ['g-sw48', '', 'Switch 48 puertos', 1, 'switch', [dcG(1, 48, 'rj45'), dcG(49, 52, 'sfp'), dcN(['MGMT'], 'mgmt')], 250],
  ['g-router', '', 'Router', 1, 'router', [dcG(0, 7, 'rj45', 'GE'), dcN(['MGMT', 'CON'], 'mgmt')], 200],
  ['g-fw', '', 'Firewall', 1, 'firewall', [dcG(1, 8, 'rj45'), dcN(['MGMT'], 'mgmt')], 200],
  ['g-srv1', '', 'Servidor 1U', 1, 'server', [dcG(0, 3, 'rj45'), dcN(['iDRAC'], 'mgmt')], 450],
  ['g-srv2', '', 'Servidor 2U', 2, 'server', [dcG(0, 3, 'rj45'), dcN(['iDRAC'], 'mgmt')], 650],
  ['g-sto2', '', 'Storage 2U', 2, 'storage', [dcG(0, 3, 'sfp'), dcN(['MGMT'], 'mgmt')], 700],
  ['g-kvm', '', 'Monitor / KVM 1U', 1, 'kvm', [], 50],
  ['g-pdu', '', 'PDU (0U, lateral)', 0, 'pdu', [dcG(1, 24, 'power')], 0, null, { capacity_a: 16, voltage: 220 }],
  ['g-pdu1u', '', 'PDU 1U', 1, 'pdu', [dcG(1, 8, 'power')], 0, null, { capacity_a: 16, voltage: 220 }],
  ['g-ups2', '', 'UPS 2U', 2, 'ups', [dcG(1, 8, 'power')], 0],
  ['g-ext', '', 'Equipo fuera del rack', 0, 'externo', [dcG(1, 4, 'rj45')], 0],
  ['g-unknown', '', 'Equipo no identificado', 1, 'desconocido', [], 0],
].map(([id, maker, name, u, role, ports, w, rx, extra]) => ({ id, maker, name, u, role, ports, power_w: w, rx: rx || null, builtin: true, ...(extra || {}) }));

/* ---------- utilidades propias ---------- */
const DC_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const dcNat = (a, b) => String(a ?? '').localeCompare(String(b ?? ''), 'es', { numeric: true, sensitivity: 'base' });
const dcNorm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const dcHex = c => /^#[0-9a-f]{6}$/i.test(String(c || '')) ? c : null;                 // solo colores válidos van a estilos
const dcColorOf = k => dcHex(DC_COLORS[k]) || null;
const dcNum = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const dcClamp = (n, a, b) => Math.max(a, Math.min(b, n));
const dcTxt = (s, max = 200) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
const dcPct = (a, b) => b ? Math.round(a * 100 / b) : 0;
const dcHeat = p => p >= 90 ? '#DC2626' : p >= 75 ? '#F59E0B' : p >= 40 ? '#22B07D' : p > 0 ? '#7FD3B0' : '#E1E6ED';
const dcCanW = () => typeof canWrite === 'function' ? canWrite() : false;
const dcMgr = () => typeof isManager === 'function' && isManager();
const dcContr = () => typeof isContractor === 'function' && isContractor();
/* IP / VLAN / redes: por defecto solo el administrador (permiso dc_net). El servidor tampoco las entrega sin permiso. */
const dcNet = () => typeof can === 'function' ? can('dc_net') : !dcContr();
const dcWho = () => (me && (me.full_name || me.email)) || 'Técnico';
const dcHash = (...p) => '#/tools/dc' + p.filter(x => x !== undefined && x !== null && x !== '').map(x => '/' + encodeURIComponent(x)).join('');
const dcGo = (...p) => { location.hash = dcHash(...p); };

/* ---------- base local en el teléfono (separada de la de inspecciones) ---------- */
const DCDB = (() => {
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open('inspectapp-dc', 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      const o = d.createObjectStore('obj', { keyPath: 'id' }); o.createIndex('site', 'site_id');
      d.createObjectStore('out', { keyPath: 'id' });     // cambios pendientes de enviar (uno por elemento)
      d.createObjectStore('meta');                       // listas, fechas de descarga, conflictos
      d.createObjectStore('blob');                       // fotos sin enviar
    };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
  const tx = async (store, mode, fn) => {
    const d = await open();
    return new Promise((res, rej) => {
      const t = d.transaction(store, mode); const req = fn(t.objectStore(store));
      t.oncomplete = () => res(req && 'result' in req ? req.result : undefined); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    });
  };
  return {
    get: (st, k) => tx(st, 'readonly', s => s.get(k)),
    put: (st, v, k) => tx(st, 'readwrite', s => k === undefined ? s.put(v) : s.put(v, k)),
    del: (st, k) => tx(st, 'readwrite', s => s.delete(k)),
    all: st => tx(st, 'readonly', s => s.getAll()),
    bySite: site => tx('obj', 'readonly', s => s.index('site').getAll(site)),
    putMany: async (st, arr) => { const d = await open(); return new Promise((res, rej) => { const t = d.transaction(st, 'readwrite'); const s = t.objectStore(st); arr.forEach(v => s.put(v)); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }); },
    clear: st => tx(st, 'readwrite', s => s.clear()),
    keys: st => tx(st, 'readonly', s => s.getAllKeys()),
  };
})();

/* ---------- estado del data center abierto ---------- */
const DCS = { site: null, objs: new Map(), I: null, models: [], syncing: false, syncErr: null, pend: 0, rejected: [], conflicts: [], pulledAt: null, timer: null, inited: false, view: {} };
const DC_COLS = 'id,org_id,site_id,kind,data,version,deleted,updated_at';
const DC_KIND_ORDER = ['dc', 'room', 'model', 'power', 'rack', 'device', 'cable', 'circuit', 'vlan', 'prefix', 'ip'];

function dcInit(){
  if (DCS.inited) return; DCS.inited = true;
  dcInjectCSS();
  window.addEventListener('online', () => { dcSyncSoon(200); });
  setInterval(() => { if (online() && DCS.pend) dcSync(); }, 45000);
  // al cerrar sesión se borra la copia local del relevamiento (lo pendiente de enviar se conserva)
  try { sb.auth.onAuthStateChange(ev => { if (ev === 'SIGNED_OUT'){ DCDB.clear('obj').catch(() => {}); DCDB.clear('meta').catch(() => {}); DCS.site = null; DCS.objs.clear(); } }); } catch {}
}

/* Carga en memoria lo que hay en el teléfono para un data center */
async function dcLoadLocal(site){
  const rows = (await DCDB.bySite(site).catch(() => [])).filter(o => o.org_id === me.org_id);
  const models = (await DCDB.bySite('__models').catch(() => [])).filter(o => o.org_id === me.org_id);
  DCS.site = site; DCS.objs = new Map(rows.concat(models).map(o => [o.id, o]));
  dcReindex();
}
/* Trae del servidor lo nuevo (incremental) y lo mezcla con lo local sin pisar lo pendiente */
async function dcPull(site){
  if (!online()) return false;
  const metaKey = `${CUR_UID}:pull:${site}`;
  const since = await DCDB.get('meta', metaKey).catch(() => null);
  const pend = new Set((await DCDB.all('out').catch(() => [])).map(o => o.id));
  const fetchAll = async build => {
    const out = []; let from = 0; const step = 1000;
    for (;;){
      const { data, error } = await build().range(from, from + step - 1);
      if (error) throw error;
      out.push(...(data || [])); if (!data || data.length < step) break; from += step;
      if (from > 60000) break;
    }
    return out;
  };
  const t0 = new Date(Date.now() - 120000).toISOString();
  const rows = await fetchAll(() => { let q = sb.from('dc_objects').select(DC_COLS).eq('site_id', site); if (since) q = q.gt('updated_at', since); return q.order('updated_at').order('id'); });
  const models = await fetchAll(() => { let q = sb.from('dc_objects').select(DC_COLS).eq('kind', 'model').is('site_id', null); return q.order('updated_at').order('id'); });
  const put = [];
  for (const r of rows.concat(models)){
    if (pend.has(r.id)) continue;
    const loc = { ...r, site_id: r.site_id || '__models' };
    put.push(loc);
  }
  if (put.length) await DCDB.putMany('obj', put);
  await DCDB.put('meta', t0, metaKey);
  await DCDB.put('meta', Date.now(), `${CUR_UID}:dl:${site}`);
  DCS.pulledAt = Date.now();
  if (DCS.site === site){ put.forEach(o => DCS.objs.set(o.id, o)); dcReindex(); }
  return put.length > 0;
}

/* Guarda un cambio: primero en el teléfono, después se envía solo */
async function dcSave(kind, id, data, { deleted, site } = {}){
  if (!dcCanW()) throw new Error('Licencia vencida o suspendida: solo lectura.');
  const prev = id ? DCS.objs.get(id) : null;
  const oid = id || uid();
  const siteId = kind === 'dc' ? oid : kind === 'model' ? null : (site || prev?.site_id || DCS.site);
  const obj = { id: oid, org_id: me.org_id, site_id: siteId || '__models', kind, data: data ?? prev?.data ?? {}, version: prev?.version || 0, deleted: deleted ?? prev?.deleted ?? false, updated_at: new Date().toISOString(), _dirty: true };
  await DCDB.put('obj', obj);
  const ex = await DCDB.get('out', oid).catch(() => null);
  await DCDB.put('out', { id: oid, org_id: me.org_id, kind, site_id: siteId, data: obj.data, deleted: obj.deleted, base: ex ? ex.base : (prev?.version || 0), t: Date.now(), rev: (ex?.rev || 0) + 1, err: null });
  if (!DCS.site || DCS.site === siteId || kind === 'model') { DCS.objs.set(oid, obj); }
  dcSyncSoon();
  return obj;
}
async function dcSaveMany(items){ // [{kind,id,data,deleted,site}]
  if (!dcCanW()) throw new Error('Licencia vencida o suspendida: solo lectura.');
  const objs = [], outs = [];
  const exAll = new Map((await DCDB.all('out').catch(() => [])).map(o => [o.id, o]));
  for (const it of items){
    const prev = it.id ? DCS.objs.get(it.id) : null; const oid = it.id || uid();
    const siteId = it.kind === 'dc' ? oid : it.kind === 'model' ? null : (it.site || prev?.site_id || DCS.site);
    const obj = { id: oid, org_id: me.org_id, site_id: siteId || '__models', kind: it.kind, data: it.data ?? prev?.data ?? {}, version: prev?.version || 0, deleted: it.deleted ?? prev?.deleted ?? false, updated_at: new Date().toISOString(), _dirty: true };
    const ex = exAll.get(oid);
    objs.push(obj); outs.push({ id: oid, org_id: me.org_id, kind: it.kind, site_id: siteId, data: obj.data, deleted: obj.deleted, base: ex ? ex.base : (prev?.version || 0), t: Date.now(), rev: (ex?.rev || 0) + 1, err: null });
  }
  await DCDB.putMany('obj', objs); await DCDB.putMany('out', outs);
  objs.forEach(o => { if (o.site_id === DCS.site || o.kind === 'model') DCS.objs.set(o.id, o); });
  dcSyncSoon(); return objs;
}
const dcSyncSoon = (ms = 1500) => { clearTimeout(DCS.timer); DCS.timer = setTimeout(dcSync, ms); dcPendCount(); };
async function dcPendCount(){
  const all = (await DCDB.all('out').catch(() => [])).filter(o => me && o.org_id === me.org_id);
  DCS.pend = all.filter(o => !o.err).length; DCS.rejected = all.filter(o => o.err);
  DCS.conflicts = ((await DCDB.get('meta', `${CUR_UID}:conflicts`).catch(() => null)) || []);
  dcNetPill();
}
/* Envía lo pendiente al servidor, en orden (primero data center, salas, racks; después equipos y cables) */
async function dcSync(){
  if (DCS.syncing || !online() || !me) return;
  DCS.syncing = true; dcNetPill();
  let changed = false;
  try {
    // fotos primero
    for (const key of await dcBlobKeys()){
      const b = await DCDB.get('blob', key).catch(() => null); if (!b) continue;
      const { error } = await sb.storage.from('fotos').upload(key, b, { contentType: b.type || 'image/jpeg', upsert: false });
      if (error && !/exist|duplicate/i.test(error.message || '')) throw error;
      await DCDB.del('blob', key);
    }
    let ops = (await DCDB.all('out')).filter(o => o.org_id === me.org_id && !o.err);
    ops.sort((a, b) => (DC_KIND_ORDER.indexOf(a.kind) - DC_KIND_ORDER.indexOf(b.kind)) || (a.t - b.t));
    const conflicts = (await DCDB.get('meta', `${CUR_UID}:conflicts`).catch(() => null)) || [];
    for (let i = 0; i < ops.length; i += 250){
      const batch = ops.slice(i, i + 250);
      const payload = batch.map(o => ({ id: o.id, kind: o.kind, site_id: o.site_id, data: o.data, deleted: o.deleted, base: o.base, force: !!o.force }));
      const { data: res, error } = await sb.rpc('dc_apply', { p_ops: payload });
      if (error) throw error;
      const byId = new Map(batch.map(o => [o.id, o]));
      for (const r of res || []){
        const op = byId.get(r.id); if (!op) continue;
        const cur = await DCDB.get('out', op.id);
        if (r.st === 'ok'){
          const o = await DCDB.get('obj', op.id);
          if (o){ o.version = r.version; o.updated_at = r.updated_at; if (!cur || cur.rev === op.rev) o._dirty = false; await DCDB.put('obj', o); if (DCS.objs.has(o.id)) DCS.objs.set(o.id, o); }
          if (cur && cur.rev === op.rev) await DCDB.del('out', op.id);
          else if (cur){ cur.base = r.version; await DCDB.put('out', cur); }
          changed = true;
        } else if (r.st === 'conflict'){
          conflicts.push({ id: op.id, kind: op.kind, site_id: op.site_id, mine: op.data, mineDeleted: op.deleted, server: r.server, at: Date.now() });
          await DCDB.del('out', op.id);
          const sv = { ...r.server, site_id: r.server.site_id || '__models' }; await DCDB.put('obj', sv); if (DCS.objs.has(sv.id) || sv.site_id === DCS.site) DCS.objs.set(sv.id, sv);
          changed = true;
        } else if (r.st === 'gone'){
          await DCDB.del('out', op.id); await DCDB.del('obj', op.id); DCS.objs.delete(op.id); changed = true;
        } else {
          if (cur){ cur.err = String(r.msg || 'Rechazado por el servidor').replace(/^PUERTO_OCUPADO:\s*/, ''); await DCDB.put('out', cur); }
        }
      }
    }
    await DCDB.put('meta', conflicts.slice(-200), `${CUR_UID}:conflicts`);
    if (DCS.site && online()){ try { if (await dcPull(DCS.site)) changed = true; } catch {} }
    DCS.syncErr = null;
  } catch (e){ DCS.syncErr = e; console.warn('dc sync', e); }
  finally {
    DCS.syncing = false; await dcPendCount();
    if (changed && DCS.site){ dcReindex(); dcRefresh(); }
  }
}
async function dcBlobKeys(){ const ks = await DCDB.keys('blob').catch(() => []); return (ks || []).filter(k => typeof k === 'string' && me && k.startsWith(me.org_id + '/dc/')); }
function dcNetPill(){
  const el = $('#dc-net'); if (!el) return;
  let t = '', c = '';
  if (!online()){ t = '📴 Sin señal' + (DCS.pend ? ` · ${DCS.pend} cambio${DCS.pend === 1 ? '' : 's'} guardado${DCS.pend === 1 ? '' : 's'} en el teléfono` : ' · trabajando con lo descargado'); c = 'off'; }
  else if (DCS.syncing){ t = '⟳ Sincronizando…'; c = 'busy'; }
  else if (DCS.pend){ t = DCS.syncErr ? `⚠ ${DCS.pend} sin enviar · tocá para reintentar` : `⟳ ${DCS.pend} por enviar`; c = DCS.syncErr ? 'off' : 'busy'; }
  else { t = '✓ Todo sincronizado'; c = 'ok'; }
  el.textContent = t; el.className = 'dc-net ' + c;
  const w = $('#dc-warn'); if (w){
    const n = DCS.rejected.length + DCS.conflicts.filter(x => x.site_id === DCS.site || !DCS.site).length;
    w.classList.toggle('hidden', !n); w.textContent = `⚠ ${n} cambio${n === 1 ? '' : 's'} para revisar`;
  }
}

/* ---------- índice del data center (se recalcula con cada cambio) ---------- */
function dcReindex(){
  const I = { dc: null, rooms: [], racks: [], devices: [], cables: [], circuits: [], power: [], vlans: [], prefixes: [], ips: [], models: [], by: new Map(), devByRack: new Map(), cableAt: new Map(), circAt: new Map(), ipByDev: new Map() };
  for (const o of DCS.objs.values()){
    I.by.set(o.id, o);
    if (o.deleted) continue;
    switch (o.kind){
      case 'dc': if (o.id === DCS.site) I.dc = o; break;
      case 'room': I.rooms.push(o); break;
      case 'rack': I.racks.push(o); break;
      case 'device': I.devices.push(o); break;
      case 'cable': I.cables.push(o); break;
      case 'circuit': I.circuits.push(o); break;
      case 'power': I.power.push(o); break;
      case 'vlan': I.vlans.push(o); break;
      case 'prefix': I.prefixes.push(o); break;
      case 'ip': I.ips.push(o); break;
      case 'model': I.models.push(o); break;
    }
  }
  const RK = { sala: 0, carrier: 1, energia: 2, otro: 3 }; I.rooms.sort((a, b) => (RK[a.data.kind] ?? 3) - (RK[b.data.kind] ?? 3) || dcNat(a.data.name, b.data.name));
  I.racks.sort((a, b) => dcNat(a.data.name, b.data.name));
  for (const d of I.devices){ const k = d.data.rack || ''; if (!I.devByRack.has(k)) I.devByRack.set(k, []); I.devByRack.get(k).push(d); }
  for (const arr of I.devByRack.values()) arr.sort((a, b) => dcNum(b.data.u, -1) - dcNum(a.data.u, -1) || dcNat(a.data.name, b.data.name));
  for (const c of I.cables){ for (const e of ['a', 'b']){ const p = c.data[e]; if (p && p.dev) I.cableAt.set(dcEK(p), { cable: c, end: e }); } }
  for (const c of I.circuits){ const p = c.data.a; if (p && p.dev) I.circAt.set(dcEK(p), c); }
  for (const ip of I.ips){ const k = ip.data.dev; if (k){ if (!I.ipByDev.has(k)) I.ipByDev.set(k, []); I.ipByDev.get(k).push(ip); } }
  I.vlans.sort((a, b) => dcNum(a.data.vid) - dcNum(b.data.vid));
  DCS.I = I; DCS.models = DC_BUILTIN.concat(I.models.map(m => ({ ...m.data, id: m.id, custom: true })));
  return I;
}
const dcEK = p => `${p.dev}|${p.port}|${p.side || ''}`;
function dcModel(id){ return DCS.models.find(m => m.id === id) || DC_BUILTIN.find(m => m.id === id) || null; }
function dcDevModel(d){ return dcModel(d?.data?.model) || null; }
function dcDevRole(d){ const r = d?.data?.role || dcDevModel(d)?.role || 'otro'; return DC_ROLE[r] ? r : 'otro'; }
function dcIsPanel(d){ const m = dcDevModel(d); return !!(d?.data?.panel ?? m?.panel ?? ['panel_fo', 'panel_utp'].includes(dcDevRole(d))); }
function dcDevU(d){ const m = dcDevModel(d); const h = d?.data?.h ?? m?.u ?? 1; return dcClamp(Math.round(dcNum(h, 1)), 0, 60); }
function dcDevName(d){ return d ? (d.data.name || dcDevModel(d)?.name || DC_ROLE[dcDevRole(d)].n) : '—'; }
function dcRackOf(d){ return d ? DCS.I.by.get(d.data.rack) : null; }
function dcRackH(r){ return dcClamp(Math.round(dcNum(r?.data?.u_height, 42)), 1, 60); }
function dcModelPorts(m){
  const out = [];
  for (const g of (m?.ports || [])){
    if (g.names) g.names.forEach(n => out.push({ n: String(n), ty: g.ty }));
    else for (let i = dcNum(g.f); i <= dcNum(g.t) && out.length < 400; i++) out.push({ n: (g.pre || '') + i, ty: g.ty });
  }
  return out;
}
/* puertos de un equipo: los del modelo + los agregados + los que aparecen en cables */
function dcPorts(d){
  const m = dcDevModel(d); const base = dcModelPorts(m); const seen = new Set(base.map(p => p.n));
  const extra = [];
  for (const p of (d.data.extra_ports || [])){ const n = dcTxt(p.n ?? p, 40); if (n && !seen.has(n)){ seen.add(n); extra.push({ n, ty: p.ty || 'otro' }); } }
  for (const [k] of DCS.I.cableAt){ const [dev, port] = k.split('|'); if (dev === d.id && !seen.has(port)){ seen.add(port); extra.push({ n: port, ty: 'otro' }); } }
  for (const c of DCS.I.circuits){ const p = c.data.a; if (p && p.dev === d.id && !seen.has(p.port)){ seen.add(p.port); extra.push({ n: p.port, ty: 'otro' }); } }
  extra.sort((a, b) => dcNat(a.n, b.n));
  return base.concat(extra);
}
function dcPortUse(d){
  const ports = dcPorts(d); const panel = dcIsPanel(d); let used = 0, fail = 0;
  for (const p of ports){
    for (const s of panel ? ['F', 'R'] : ['']){
      const c = DCS.I.cableAt.get(`${d.id}|${p.n}|${s}`);
      if (c){ used++; if (c.cable.data.status === 'falla') fail++; }
    }
  }
  return { total: ports.length * (panel ? 2 : 1), used, fail, ports: ports.length };
}
/* ocupación del rack: U con equipos (los paneles ciegos cuentan como lugar disponible) */
function dcRackUse(r){
  const H = dcRackH(r); const devs = DCS.I.devByRack.get(r.id) || [];
  const occ = new Array(H + 1).fill(0);
  for (const d of devs){
    const u = dcNum(d.data.u, 0), h = dcDevU(d); if (!u || !h) continue;
    const role = dcDevRole(d); if (role === 'ciego') continue;
    for (let k = u; k < u + h && k <= H; k++) occ[k] = 1;
  }
  const used = occ.reduce((a, b) => a + b, 0);
  return { H, used, free: H - used, pct: dcPct(used, H), devs: devs.length, unknown: devs.filter(d => dcDevRole(d) === 'desconocido' || d.data.status === 'desconocido').length };
}
function dcRackPower(r){
  const devs = DCS.I.devByRack.get(r.id) || [];
  const pdus = devs.filter(d => dcDevRole(d) === 'pdu');
  let load = 0, est = false; for (const d of devs){ if (['pdu', 'ciego', 'ordenador', 'bandeja'].includes(dcDevRole(d)) || d.data.status === 'retirado') continue; const real = d.data.power_w !== null && d.data.power_w !== undefined && d.data.power_w !== ''; if (!real && dcDevModel(d)?.power_w) est = true; load += dcNum(real ? d.data.power_w : dcDevModel(d)?.power_w, 0); }
  // solo cuentan las PDU con capacidad cargada a mano (las importadas no la traen)
  const cap = pdus.reduce((a, p) => a + (p.data.capacity_a ? dcNum(p.data.capacity_a, 0) * dcNum(p.data.voltage ?? 220, 220) : 0), 0);
  // con PDU A y B redundantes, la capacidad útil es la de un solo lado
  const capUtil = pdus.length >= 2 ? cap / 2 : cap;
  return { load, cap: capUtil, pct: capUtil ? dcPct(load, capUtil) : 0, pdus, est };
}
/* ¿choca con otro equipo en esas U y esa cara? */
function dcCollides(rackId, u, h, face, exceptId){
  if (!u || !h) return null;
  const devs = DCS.I.devByRack.get(rackId) || [];
  for (const d of devs){
    if (d.id === exceptId) continue;
    const du = dcNum(d.data.u, 0), dh = dcDevU(d); if (!du || !dh) continue;
    const f1 = face || 'both', f2 = d.data.face || 'both';
    if (f1 !== 'both' && f2 !== 'both' && f1 !== f2) continue;
    if (u < du + dh && du < u + h) return d;
  }
  return null;
}
const dcEndTxt = (p, short) => {
  if (!p || !p.dev) return '—';
  const d = DCS.I.by.get(p.dev); const r = d ? dcRackOf(d) : null;
  const side = p.side === 'R' ? ' (trasera)' : p.side === 'F' ? ' (frente)' : '';
  return short ? `${r ? r.data.name + ' · ' : ''}U${d?.data?.u ?? '–'} ${dcDevName(d)} · ${p.port}${side}`
               : `${r ? r.data.name : 'Sin rack'} · U${d?.data?.u ?? '–'} · ${dcDevName(d)} · puerto ${p.port}${side}`;
};

/* ---------- recorrido punta a punta ---------- */
/* Arranca en un puerto, sigue el cable; si llega a un panel pasa a la otra cara del mismo puerto y sigue. */
function dcTrace(start){
  const I = DCS.I, flip = s => s === 'F' ? 'R' : s === 'R' ? 'F' : '';
  const walk = from => {
    const hops = []; let cur = from; const seen = new Set();
    for (let i = 0; i < 40; i++){
      const k = dcEK(cur); if (seen.has(k)) break; seen.add(k);
      const at = I.cableAt.get(k); if (!at) break;
      const other = at.cable.data[at.end === 'a' ? 'b' : 'a']; if (!other || !other.dev) break;
      hops.push({ cable: at.cable, to: { ...other } });
      const od = I.by.get(other.dev);
      if (od && dcIsPanel(od) && other.side){ cur = { dev: other.dev, port: other.port, side: flip(other.side) }; hops[hops.length - 1].thru = cur; }
      else break;
    }
    return hops;
  };
  const fwd = walk(start);
  const d0 = I.by.get(start.dev);
  let back = [];
  if (d0 && dcIsPanel(d0) && start.side) back = walk({ dev: start.dev, port: start.port, side: flip(start.side) });
  // armado como lista de nodos y enlaces: [nodo, enlace, nodo, enlace, …]
  const nodes = [];
  const pushNode = (p, extra) => nodes.push({ t: 'n', p, ...extra });
  const rev = back.slice().reverse();
  if (rev.length){
    pushNode(rev[0].to, { end: true });
    for (let i = 0; i < rev.length; i++){
      nodes.push({ t: 'l', cable: rev[i].cable });
      const prevThru = i + 1 < rev.length ? rev[i + 1].to : null;
      if (prevThru) pushNode(prevThru, { pass: true });
    }
    pushNode(start, { start: true, pass: true });
  } else pushNode(start, { start: true });
  fwd.forEach((h, i) => { nodes.push({ t: 'l', cable: h.cable }); pushNode(h.to, { pass: !!h.thru, end: i === fwd.length - 1 }); });
  // circuito de carrier en alguna punta
  const circ = nodes.filter(n => n.t === 'n').map(n => I.circAt.get(dcEK(n.p))).find(Boolean) || null;
  return { nodes, circ, hops: fwd.length + back.length };
}

/* =====================================================================
   ESTILOS DEL MÓDULO (se agregan una sola vez)
   ===================================================================== */
function dcInjectCSS(){
  if (document.getElementById('dc-css')) return;
  const st = document.createElement('style'); st.id = 'dc-css';
  st.textContent = `
.dc-net{font-size:12px;padding:4px 10px;border-radius:99px;cursor:pointer;white-space:nowrap;border:0;font-weight:600}
.dc-net.ok{background:var(--ok-bg);color:var(--green-d)} .dc-net.busy{background:var(--amber-bg);color:var(--amber)} .dc-net.off{background:var(--red-bg);color:var(--red)}
.dc-warnbtn{font-size:12px;padding:4px 10px;border-radius:99px;border:1px solid #F3C1CB;background:#fff;color:var(--red);cursor:pointer;font-weight:600}
.dc-head{display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap}
.dc-head h1{font-size:21px;margin:0}
.dc-ico{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;font-size:22px;background:linear-gradient(135deg,#0F2A4A,#1A3A6B);color:#fff;flex:none}
.dc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}
.dc-card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:16px;cursor:pointer;transition:box-shadow .15s,transform .15s;position:relative}
.dc-card:hover{box-shadow:0 6px 18px rgba(15,42,74,.12);transform:translateY(-1px)}
.dc-sky{display:flex;align-items:flex-end;gap:3px;height:54px;margin:12px 0 8px;padding:6px 8px;background:linear-gradient(#F8FAFC,#EEF2F7);border-radius:10px}
.dc-sky i{flex:1;max-width:18px;min-width:4px;border-radius:3px 3px 0 0;background:#CBD5E1;display:block}
.dc-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-top:14px}
.dc-tile{background:var(--bg);border-radius:12px;padding:10px 12px;display:flex;gap:10px;align-items:center;min-width:0}
.dc-tile b{display:block;font-size:20px;line-height:1.2} .dc-tile span{font-size:12px;color:var(--muted);display:block}
.dc-tile.click{cursor:pointer} .dc-tile.click:hover{background:#E8EEF6}
.dc-tabs{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding:2px 0 10px;margin-bottom:4px;position:sticky;top:104px;z-index:30;background:var(--bg)}
.dc-tabs::-webkit-scrollbar{display:none}
.dc-tabs button{border:1px solid var(--line);background:#fff;border-radius:99px;padding:7px 14px;cursor:pointer;white-space:nowrap;color:var(--muted);font-weight:500}
.dc-tabs button.on{background:var(--navy);color:#fff;border-color:var(--navy)}
.dc-tabs button .n{display:inline-block;margin-left:6px;font-size:11px;background:rgba(0,0,0,.08);border-radius:99px;padding:0 6px}
.dc-tabs button.on .n{background:rgba(255,255,255,.2)}
.dc-chips{display:flex;gap:6px;flex-wrap:wrap}
.dc-chip{border:1px solid var(--line);background:#fff;border-radius:99px;padding:5px 12px;cursor:pointer;font-size:13px;white-space:nowrap}
.dc-chip.on{background:#E8EEF8;border-color:#BCD0EE;color:var(--navy-2);font-weight:600}
.dc-legend{display:flex;gap:12px;flex-wrap:wrap;font-size:12px;color:var(--muted);margin-top:8px}
.dc-legend i{display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:5px;vertical-align:-2px}
.dc-plan{overflow:auto;border:1px solid var(--line);border-radius:12px;background:#fff;touch-action:pan-x pan-y}
.dc-plan svg{display:block}
.dc-plan .rk{cursor:pointer}
.dc-plan .rk:hover rect.b{stroke:#0F2A4A;stroke-width:2}
.dc-plan.edit .rk{cursor:grab} .dc-plan.edit .rk.drag{cursor:grabbing;opacity:.85}
.dc-thumbs{display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:12px}
.dc-thumb{text-align:center;cursor:pointer;border-radius:12px;padding:8px 4px;border:1px solid transparent}
.dc-thumb:hover{background:#fff;border-color:var(--line)}
.dc-thumb b{display:block;font-size:13px;margin-top:4px} .dc-thumb small{color:var(--muted);font-size:11px}
.dc-rackwrap{display:grid;grid-template-columns:minmax(300px,380px) 1fr;gap:14px;align-items:start}
.dc-rackwrap.two{grid-template-columns:repeat(2,minmax(280px,360px)) 1fr}
.dc-elev{background:#fff;border:1px solid var(--line);border-radius:14px;padding:10px;position:sticky;top:110px}
.dc-elev svg{width:100%;height:auto;display:block;user-select:none;-webkit-user-select:none}
.dc-elev .dv{cursor:pointer} .dc-elev .dv:hover .fr{filter:brightness(.96)} .dc-elev .dv.sel .fr{stroke:#0F2A4A;stroke-width:2.5}
.dc-elev .free{cursor:pointer;fill:transparent} .dc-elev .free:hover{fill:#E7F7F0}
.dc-elev .free:hover + .freet{opacity:1}
.dc-elev .freet{opacity:0;pointer-events:none;font-size:10px;fill:#178A61}
.dc-elev.edit .dv{cursor:grab}
@keyframes dcpulse{0%{opacity:.25}50%{opacity:.7}100%{opacity:.25}}
.dc-elev .cur{animation:dcpulse 1.4s infinite;fill:#22B07D}
.dc-face{display:inline-flex;background:var(--bg);border-radius:10px;padding:3px}
.dc-face button{border:0;background:none;padding:6px 12px;border-radius:8px;cursor:pointer;color:var(--muted);font-weight:500}
.dc-face button.on{background:#fff;color:var(--text);box-shadow:0 1px 2px rgba(0,0,0,.08)}
.dc-bar{height:8px;background:var(--line);border-radius:99px;overflow:hidden;min-width:60px}
.dc-bar i{display:block;height:100%;border-radius:99px}
.dc-meter{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--muted)}
.dc-meter .dc-bar{flex:1}
.dc-ports{display:flex;flex-wrap:wrap;gap:4px}
.dc-port{width:38px;height:34px;border-radius:7px;border:1.5px solid #CBD5E1;background:#fff;font-size:11px;font-weight:600;cursor:pointer;display:grid;place-items:center;color:#334155;position:relative;padding:0;overflow:hidden;white-space:nowrap}
.dc-port.wide{width:auto;min-width:38px;padding:0 6px}
.dc-port.on{color:#fff;border-color:transparent}
.dc-port.plan{border-style:dashed;border-color:#F59E0B;color:#B7791F;background:#FFFBEB}
.dc-port.fail{background:#DC2626!important;color:#fff;border-color:#DC2626}
.dc-port.hit{outline:3px solid #0F2A4A;outline-offset:1px}
.dc-port:disabled{cursor:not-allowed;opacity:.45}
.dc-port .ci{position:absolute;right:2px;top:2px;width:6px;height:6px;border-radius:50%;background:#0F2A4A}
.dc-face-lbl{font-size:11px;color:var(--muted);font-weight:600;letter-spacing:.04em;text-transform:uppercase;margin:10px 0 4px}
.dc-trace{display:flex;align-items:stretch;gap:0;overflow-x:auto;padding:6px 2px 10px}
.dc-tn{min-width:150px;max-width:190px;background:#fff;border:1.5px solid var(--line);border-radius:12px;padding:8px 10px;cursor:pointer;flex:none}
.dc-tn:hover{border-color:#0F2A4A}
.dc-tn.st{border-color:var(--green);box-shadow:0 0 0 3px #E7F7F0}
.dc-tn .rk{font-size:11px;color:var(--muted);font-weight:600}
.dc-tn .nm{font-size:13px;font-weight:600;line-height:1.25;margin:2px 0;word-break:break-word}
.dc-tn .pt{display:inline-block;font-size:12px;font-weight:700;border-radius:6px;padding:1px 7px;background:#0F2A4A;color:#fff}
.dc-tl{min-width:74px;display:flex;flex-direction:column;justify-content:center;align-items:center;flex:none;padding:0 2px}
.dc-tl i{display:block;height:5px;width:100%;border-radius:99px}
.dc-tl small{font-size:10px;color:var(--muted);margin-top:4px;text-align:center;line-height:1.2;max-width:90px}
.dc-tl.fail i{background:repeating-linear-gradient(90deg,#DC2626 0 8px,transparent 8px 12px)!important}
.dc-tl.plan i{background:repeating-linear-gradient(90deg,#F59E0B 0 6px,transparent 6px 10px)!important}
.dc-circ{background:linear-gradient(135deg,#0F766E,#14B8A6);color:#fff;border-radius:12px;padding:8px 12px;min-width:150px;flex:none}
@media (max-width:760px){
  .dc-trace{flex-direction:column;align-items:stretch}
  .dc-tn,.dc-circ{max-width:none;min-width:0}
  .dc-tl{min-height:34px;flex-direction:row;gap:8px;justify-content:flex-start;padding-left:22px}
  .dc-tl i{width:5px;height:30px}
  .dc-tl small{max-width:none;text-align:left;margin:0}
}
.dc-list{display:flex;flex-direction:column;gap:6px}
.dc-li{display:flex;gap:10px;align-items:center;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:#fff;cursor:pointer}
.dc-li:hover{border-color:#BCD0EE;background:#F8FAFC}
.dc-li .sw{width:8px;align-self:stretch;border-radius:99px;flex:none}
.dc-big{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px}
.dc-big button{border:1.5px solid var(--line);background:#fff;border-radius:12px;padding:14px 8px;cursor:pointer;font-weight:600;font-size:13px;display:flex;flex-direction:column;align-items:center;gap:6px;color:var(--text)}
.dc-big button:hover{border-color:var(--green);background:#F3FBF7}
.dc-big button.on{border-color:var(--green);background:#E7F7F0}
.dc-big button i{font-style:normal;font-size:22px}
.dc-step{display:flex;align-items:center;gap:6px}
.dc-step button{width:38px;height:38px;border-radius:10px;border:1px solid var(--line);background:#fff;font-size:18px;cursor:pointer}
.dc-step b{min-width:46px;text-align:center;font-size:16px}
.dc-sticky{position:sticky;bottom:0;background:linear-gradient(transparent,var(--bg) 30%);padding:14px 0 4px;z-index:20}
.dc-ipgrid{display:grid;grid-template-columns:repeat(32,1fr);gap:2px;max-width:640px}
.dc-ipgrid i{aspect-ratio:1;border-radius:2px;background:#E1E6ED;display:block}
.dc-ipgrid i.u{background:#2A78D6} .dc-ipgrid i.g{background:#0F2A4A} .dc-ipgrid i.r{background:#94A3B8}
.dc-kv{display:grid;grid-template-columns:auto 1fr;gap:4px 14px;font-size:14px}
.dc-kv dt{color:var(--muted)} .dc-kv dd{margin:0;word-break:break-word}
.dc-photos{display:flex;gap:8px;flex-wrap:wrap}
.dc-photos img{width:92px;height:92px;object-fit:cover;border-radius:10px;border:1px solid var(--line);cursor:pointer;background:#F1F4F8}
.dc-scan{position:relative;border-radius:14px;overflow:hidden;background:#000;aspect-ratio:3/4;max-height:60vh;margin:0 auto}
.dc-scan video{width:100%;height:100%;object-fit:cover;display:block}
.dc-scan .fr{position:absolute;inset:18%;border:3px solid #22B07D;border-radius:16px;box-shadow:0 0 0 999px rgba(0,0,0,.35)}
.dc-mini-donut{flex:none}
.dc-empty{text-align:center;padding:26px 10px;color:var(--muted)}
.dc-empty .e{font-size:40px;display:block;margin-bottom:6px}
.dc-diff td{vertical-align:top;font-size:13px}
.dc-diff .chg{background:#FEF6E4}
.dc-tagrole{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;border-radius:99px;padding:2px 10px}
@media (max-width:900px){ .dc-rackwrap,.dc-rackwrap.two{grid-template-columns:1fr} .dc-elev{position:static} .dc-tabs{top:100px} .dc-sv .dc-elev{order:2} .dc-sv .card{order:1} }
/* impresión: etiquetas e informe */
.dc-print{background:#fff}
.dc-labels{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm}
.dc-label{border:1px dashed #9CA3AF;border-radius:2mm;padding:2mm;display:flex;gap:2mm;align-items:center;break-inside:avoid;min-height:30mm}
.dc-label svg{width:26mm;height:26mm;flex:none}
.dc-label b{display:block;font-size:10pt;line-height:1.15} .dc-label span{display:block;font-size:8pt;color:#374151;line-height:1.2}
.dc-rep-rack{break-inside:avoid;display:inline-block;vertical-align:top;width:31%;margin:0 1% 4mm}
@media print{
  body.dc-printing .top, body.dc-printing .tabs, body.dc-printing #lic-banner, body.dc-printing .noprint, body.dc-printing .toast{display:none!important}
  body.dc-printing main{max-width:none;padding:0}
  body.dc-printing .card{border:0;padding:0;margin:0 0 4mm}
  @page{margin:10mm}
}
`;
  document.head.appendChild(st);
}

/* =====================================================================
   DIBUJO DEL RACK (SVG) — se usa en miniaturas, rack, relevamiento e informe
   ===================================================================== */
function dcRackSVG(rack, o = {}){
  const H = dcRackH(rack), face = o.face || 'front', mini = !!o.mini;
  const UH = mini ? 4 : (o.uh || 20), RAIL = mini ? 4 : 24, W = mini ? 56 : 300, TOP = mini ? 3 : 14;
  const IW = W - RAIL * 2, HT = TOP * 2 + H * UH;
  const devs = (DCS.I.devByRack.get(rack.id) || []).filter(d => d.data.status !== 'retirado' && dcNum(d.data.u, 0) > 0 && dcDevU(d) > 0 && ((d.data.face || 'both') === 'both' || (d.data.face || 'both') === face));
  const yOf = u => TOP + (H - u) * UH;
  let s = `<svg viewBox="0 0 ${W} ${HT}" ${mini ? `width="${W}" height="${HT}"` : ''} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Rack ${esc(rack.data.name)}">`;
  if (!mini) s += `<defs>
    <pattern id="dc-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#F1F4F8"/><line x1="0" y1="0" x2="0" y2="6" stroke="#CBD5E1" stroke-width="2"/></pattern>
    <pattern id="dc-lines" width="8" height="4" patternUnits="userSpaceOnUse"><rect width="8" height="4" fill="#EEF1F5"/><line x1="0" y1="2" x2="8" y2="2" stroke="#B6C0CD" stroke-width="1"/></pattern>
  </defs>`;
  // gabinete
  s += `<rect x="0.5" y="0.5" width="${W - 1}" height="${HT - 1}" rx="${mini ? 3 : 10}" fill="${mini ? '#1E293B' : '#1E293B'}"/>`;
  s += `<rect x="${RAIL}" y="${TOP}" width="${IW}" height="${H * UH}" fill="${mini ? '#F8FAFC' : '#F8FAFC'}"/>`;
  if (!mini){
    for (let u = H; u >= 1; u--){
      const y = yOf(u);
      if (u % 2 === 0) s += `<rect x="${RAIL}" y="${y}" width="${IW}" height="${UH}" fill="#F1F5F9"/>`;
      s += `<text x="${RAIL - 5}" y="${y + UH / 2 + 4}" text-anchor="end" font-size="10" fill="#94A3B8">${u}</text><text x="${W - RAIL + 5}" y="${y + UH / 2 + 4}" font-size="10" fill="#94A3B8">${u}</text>`;
    }
    if (o.interactive){
      const occ = new Set(); devs.forEach(d => { for (let k = dcNum(d.data.u); k < dcNum(d.data.u) + dcDevU(d); k++) occ.add(k); });
      for (let u = H; u >= 1; u--) if (!occ.has(u)){ const y = yOf(u); s += `<rect class="free" data-free="${u}" x="${RAIL}" y="${y}" width="${IW}" height="${UH}"/><text class="freet" x="${RAIL + IW / 2}" y="${y + UH / 2 + 4}" text-anchor="middle">+ agregar en U${u}</text>`; }
    }
  }
  for (const d of devs){
    const u = dcNum(d.data.u), h = Math.min(dcDevU(d), H - u + 1); if (h <= 0) continue;
    const role = dcDevRole(d), R = DC_ROLE[role], y = yOf(u + h - 1), hh = h * UH - (mini ? 0.6 : 2);
    const rear = face === 'rear' && (d.data.face || 'both') === 'both';
    const unk = role === 'desconocido' || d.data.status === 'desconocido';
    if (mini){
      const fill = role === 'ciego' ? '#E2E8F0' : role === 'ordenador' ? '#CBD5E1' : R.c;
      s += `<rect x="${RAIL + 1}" y="${y + 0.3}" width="${IW - 2}" height="${Math.max(1, hh)}" rx="1" fill="${unk ? '#DC2626' : fill}" opacity="${rear ? .6 : 1}"/>`;
      continue;
    }
    const fill = role === 'ciego' ? 'url(#dc-hatch)' : role === 'ordenador' ? 'url(#dc-lines)' : unk ? '#FDECEC' : R.bg;
    const stroke = unk ? '#DC2626' : d.data.status === 'falla' ? '#DC2626' : d.data.status === 'planificado' ? '#F59E0B' : '#CBD5E1';
    const dash = unk || d.data.status === 'planificado' ? 'stroke-dasharray="5 3"' : '';
    const sel = o.sel === d.id ? ' sel' : '';
    s += `<g class="dv${sel}" data-dev="${esc(d.id)}" opacity="${rear ? .78 : 1}">`;
    s += `<rect class="fr" x="${RAIL + 1}" y="${y + 1}" width="${IW - 2}" height="${hh}" rx="4" fill="${fill}" stroke="${stroke}" stroke-width="${unk || d.data.status === 'falla' ? 2 : 1}" ${dash}/>`;
    if (role !== 'ciego' && role !== 'ordenador') s += `<rect x="${RAIL + 1}" y="${y + 1}" width="6" height="${hh}" rx="2" fill="${unk ? '#DC2626' : R.c}"/>`;
    if (role === 'ciego' || role === 'ordenador'){
      s += `<text x="${RAIL + IW / 2}" y="${y + hh / 2 + 4}" text-anchor="middle" font-size="10" fill="#64748B">${esc(role === 'ciego' ? 'panel ciego' : 'ordenador')}</text>`;
    } else {
      const name = dcDevName(d); const max = Math.floor((IW - 70) / 6.3);
      const label = (unk ? '¿? ' : '') + (name.length > max ? name.slice(0, max - 1) + '…' : name);
      const ty = h >= 2 ? y + 15 : y + hh / 2 + 5;
      s += `<text x="${RAIL + 13}" y="${ty}" font-size="11.5" font-weight="600" fill="${unk ? '#B91C1C' : '#14202E'}">${esc(label)}</text>`;
      if (h >= 2){ const m = dcDevModel(d); s += `<text x="${RAIL + 13}" y="${y + 29}" font-size="10" fill="#5B6878">${esc((m ? (m.maker ? m.maker + ' ' : '') + m.name : R.n).slice(0, 40))}${rear ? ' · vista trasera' : ''}</text>`; }
      const pu = dcPortUse(d);
      if (pu.ports){ const pct = dcPct(pu.used, pu.total); const bx = RAIL + IW - 52, by = y + (h >= 2 ? 9 : hh / 2 - 3);
        s += `<rect x="${bx}" y="${by}" width="44" height="6" rx="3" fill="#E1E6ED"/><rect x="${bx}" y="${by}" width="${44 * pct / 100}" height="6" rx="3" fill="${pu.fail ? '#DC2626' : '#22B07D'}"/>`;
        if (h >= 2) s += `<text x="${bx + 44}" y="${by + 18}" text-anchor="end" font-size="9.5" fill="#5B6878">${pu.used}/${pu.total}</text>`;
      }
    }
    s += `</g>`;
  }
  if (o.cur){ const y = yOf(o.cur); s += `<rect class="cur" x="${RAIL}" y="${y}" width="${IW}" height="${UH}" rx="3" pointer-events="none"/>`; }
  s += `</svg>`;
  return s;
}
function dcDonut(p, color, size = 44){
  const r = size / 2 - 5, c = 2 * Math.PI * r, v = dcClamp(p, 0, 100);
  return `<svg class="dc-mini-donut" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="#E1E6ED" stroke-width="6"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${dcHex(color) || '#22B07D'}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${c * v / 100} ${c}" transform="rotate(-90 ${size / 2} ${size / 2})"/><text x="50%" y="54%" text-anchor="middle" font-size="11" font-weight="700" fill="#14202E">${Math.round(v)}%</text></svg>`;
}
const dcBar = (p, color) => `<div class="dc-bar"><i style="width:${dcClamp(p, 0, 100)}%;background:${dcHex(color) || dcHeat(p)}"></i></div>`;
const dcRolePill = role => { const R = DC_ROLE[role] || DC_ROLE.otro; return `<span class="dc-tagrole" style="background:${R.bg};color:${R.c}">● ${esc(R.n)}</span>`; };

/* =====================================================================
   NAVEGACIÓN DEL MÓDULO  (#/tools/dc/<dc>/<sección>/<id>)
   ===================================================================== */
async function viewDC(v){
  dcInit();
  const parts = location.hash.split('/').slice(3).map(x => { try { return decodeURIComponent(x); } catch { return ''; } });
  const [site, sec, id] = parts;
  DCS.render = null;
  if (!site) return dcViewList(v);
  if (site === 'modelos') return dcViewModels(v);
  if (!DC_UUID.test(site)) return dcGo();
  await dcOpenSite(site);
  if (!DCS.I.dc) { v.innerHTML = `<div class="card"><b>No se encontró el data center</b><p class="muted">Puede que no tengas acceso o que todavía no esté descargado en este teléfono. ${online() ? '' : 'Conectate una vez para descargarlo.'}</p><button class="btn sec" data-dcback="#/tools/dc">← Data centers</button></div>`; return; }
  if (sec === 'rack' && DC_UUID.test(id || '')) return dcViewRack(v, id);
  if (sec === 'dev' && DC_UUID.test(id || '')) return dcViewDevice(v, id);
  if (sec === 'relevar' && DC_UUID.test(id || '')) return dcViewSurvey(v, id);
  if (sec === 'q' && DC_UUID.test(id || '')) return dcResolveQR(id);
  if (sec === 'etiquetas') return dcViewLabels(v);
  if (sec === 'informe') return dcViewReport(v);
  return dcViewSite(v);
}
async function dcOpenSite(site){
  if (DCS.site !== site || !DCS.I) await dcLoadLocal(site);
  if (online()){
    const recent = DCS.pulledAt && DCS.site === site && Date.now() - DCS.pulledAt < 20000;
    if (!recent){ try { await Promise.race([dcPull(site), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 9000))]); } catch (e){ if (!isNetErr(e) && !/timeout/.test(e.message)) console.warn(e); } }
  }
  dcReindex(); dcPendCount();
}
function dcRefresh(){
  if (!/^#\/tools\/dc/.test(location.hash)) return;
  if ($('#modal-root')?.children.length) { DCS.stale = true; return; }
  if (typeof DCS.render === 'function') DCS.render();
}
const dcBack = (label, hash) => `<button class="btn sec small noprint" data-dcback="${esc(hash)}">← ${esc(label)}</button>`;
// "Volver" sin JavaScript en línea: el destino viaja como dato y solo se aceptan rutas internas del módulo
document.addEventListener('click', e => { const b = e.target.closest('[data-dcback]'); if (b && /^#\/tools(\/|$)/.test(b.dataset.dcback)) location.hash = b.dataset.dcback; });
function dcTopBar(extra = ''){
  return `<div class="row between noprint" style="margin-bottom:10px">${extra}<div class="row" style="gap:6px;margin-left:auto"><button class="dc-warnbtn hidden" id="dc-warn"></button><button class="dc-net" id="dc-net"></button></div></div>`;
}
function dcBindTop(scope){
  scope.querySelector('#dc-net')?.addEventListener('click', () => { if (DCS.syncErr) toast('No se pudo enviar: ' + errText(DCS.syncErr)); dcSync(); });
  scope.querySelector('#dc-warn')?.addEventListener('click', dcReviewModal);
  dcNetPill();
}

/* =====================================================================
   LISTA DE DATA CENTERS
   ===================================================================== */
async function dcViewList(v){
  let list = null, fromCache = false;
  const key = `${CUR_UID}:dclist`;
  if (online()){
    try {
      const { data, error } = await sb.from('dc_objects').select(DC_COLS).eq('kind', 'dc').eq('deleted', false).order('updated_at', { ascending: false }).limit(500);
      if (error) throw error; list = data || []; DCDB.put('meta', list, key).catch(() => {});
    } catch (e){ if (!isNetErr(e)) { v.innerHTML = `<div class="card"><b>No se pudo abrir Relevamiento DC</b><p class="muted">${esc(errText(e))}</p><p class="muted sm">Si es la primera vez, el administrador tiene que ejecutar el script de base de datos del módulo en Supabase.</p></div>`; return; } }
  }
  if (!list){ list = (await DCDB.get('meta', key).catch(() => null)) || []; fromCache = true; }
  // también los creados sin señal en este teléfono
  const pendDc = (await DCDB.all('out').catch(() => [])).filter(o => o.kind === 'dc' && o.org_id === me.org_id && !list.some(l => l.id === o.id));
  list = list.concat(pendDc.map(o => ({ id: o.id, kind: 'dc', data: o.data, _local: true }))).filter(x => x.org_id === undefined || x.org_id === me.org_id);
  // resumen con lo que está descargado
  const sums = new Map();
  for (const d of list){
    const rows = (await DCDB.bySite(d.id).catch(() => [])).filter(o => !o.deleted && o.org_id === me.org_id);
    const dl = await DCDB.get('meta', `${CUR_UID}:dl:${d.id}`).catch(() => null);
    if (!rows.length){ sums.set(d.id, { dl }); continue; }
    const racks = rows.filter(o => o.kind === 'rack').sort((a, b) => dcNat(a.data.name, b.data.name));
    const devs = rows.filter(o => o.kind === 'device');
    const sky = racks.map(r => {
      const H = dcClamp(dcNum(r.data.u_height, 42), 1, 60); const occ = new Set();
      devs.filter(x => x.data.rack === r.id && x.data.status !== 'retirado').forEach(x => {
        const m = DC_BUILTIN.find(b => b.id === x.data.model); const role = x.data.role || m?.role; if (role === 'ciego') return;
        const h = dcNum(x.data.h ?? m?.u ?? 1, 1); for (let k = dcNum(x.data.u); k > 0 && k < dcNum(x.data.u) + h; k++) occ.add(k);
      });
      return dcPct(occ.size, H);
    });
    sums.set(d.id, { racks: racks.length, devs: devs.filter(x => !['ciego', 'ordenador'].includes(x.data.role)).length, cables: rows.filter(o => o.kind === 'cable').length, unk: devs.filter(x => x.data.role === 'desconocido' || x.data.status === 'desconocido').length, sky, dl });
  }
  const canNew = dcCanW() && !dcContr();
  const render = () => {
    v.innerHTML = `
      ${dcTopBar(dcBack('Herramientas', '#/tools'))}
      <div class="card"><div class="dc-head"><div class="dc-ico">🗄️</div><div class="grow"><h1>Relevamiento DC</h1>
        <p class="muted sm" style="margin:4px 0 0">Racks, equipos, paneles y cableado de cada data center, con el recorrido punta a punta de cada conexión. Funciona sin señal: lo que cargues queda en el teléfono y se envía solo cuando vuelve internet.</p></div>
        <div class="row" style="gap:8px">${canNew ? '<button class="btn" id="dc-new">+ Data center</button>' : ''}<button class="btn sec" id="dc-scan">📷 Escanear QR</button><button class="btn sec" id="dc-models">📚 Modelos</button></div></div>
        ${fromCache ? '<p class="sm" style="margin:10px 0 0;color:var(--amber)">📴 Sin señal: se muestra la última lista descargada en este teléfono.</p>' : ''}</div>
      ${list.length ? `<div class="dc-grid">${list.map(d => {
        const s = sums.get(d.id) || {};
        return `<div class="dc-card" data-dc="${esc(d.id)}">
          <div class="row between" style="align-items:flex-start"><div style="min-width:0"><b style="font-size:16px">${esc(d.data.name || 'Data center')}</b>
          <div class="muted sm">${esc([d.data.client, d.data.address].filter(Boolean).join(' · ') || 'Sin datos de cliente')}</div></div>
          ${d._local ? '<span class="pill p-pend">sin enviar</span>' : s.dl ? '<span class="pill p-ok" title="Disponible sin señal">📱 en el teléfono</span>' : '<span class="pill p-info">en la nube</span>'}</div>
          ${s.sky && s.sky.length ? `<div class="dc-sky" title="Ocupación de cada rack">${s.sky.map(p => `<i style="height:${Math.max(6, p)}%;background:${dcHeat(p)}"></i>`).join('')}</div>
          <div class="row sm muted" style="gap:14px"><span><b style="color:var(--text)">${s.racks}</b> racks</span><span><b style="color:var(--text)">${s.devs}</b> equipos</span><span><b style="color:var(--text)">${s.cables}</b> conexiones</span>${s.unk ? `<span style="color:var(--red)"><b>${s.unk}</b> a identificar</span>` : ''}</div>`
          : `<div class="dc-sky" style="justify-content:center;align-items:center;color:var(--muted);font-size:12px">${online() ? 'Abrilo para descargarlo al teléfono' : 'No descargado en este teléfono'}</div>`}
        </div>`; }).join('')}</div>`
      : `<div class="card dc-empty"><span class="e">🗄️</span><b>Todavía no hay data centers</b><p>${canNew ? 'Creá el primero con <b>+ Data center</b>, o importá tu Excel de racks.' : 'Cuando tu empresa cargue uno, aparece acá.'}</p></div>`}`;
    dcBindTop(v);
    v.querySelectorAll('[data-dc]').forEach(c => c.onclick = () => dcGo(c.dataset.dc));
    $('#dc-new')?.addEventListener('click', () => dcEditDC(null));
    $('#dc-scan').onclick = dcScanQR;
    $('#dc-models').onclick = () => dcGo('modelos');
  };
  render(); DCS.render = null;
}

/* alta / edición del data center */
async function dcEditDC(dc){
  const d = dc ? dc.data : {};
  let sites = []; try { sites = await cached('sites-min2', () => sb.from('sites').select('id,name,kind,traza,address,grupo').eq('active', true).order('name').limit(2000)); } catch {}
  const m = modal(`<h2>${dc ? 'Datos del data center' : 'Nuevo data center'}</h2>
    <label>Nombre *</label><input id="dce-n" maxlength="120" value="${esc(d.name || '')}" placeholder="Ej.: Suipacha 150">
    <label>Cliente</label><input id="dce-c" maxlength="120" value="${esc(d.client || '')}">
    <label>Dirección</label><input id="dce-a" maxlength="200" value="${esc(d.address || '')}">
    <label>Vincular con un sitio de la app (para inspecciones y tareas)</label>
    <select id="dce-s"><option value="">— Ninguno —</option>${(sites || []).map(s => `<option value="${esc(s.id)}" ${d.site_ref === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>
    <label>Notas</label><textarea id="dce-o" maxlength="2000">${esc(d.notes || '')}</textarea>
    ${dc ? '' : `<label style="display:flex;gap:8px;align-items:center;font-weight:400"><input type="checkbox" id="dce-room" checked style="width:auto"> Crear "Sala de equipos" y "Sala de carrier"</label>`}
    <div class="err" id="dce-e"></div>
    <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn sec" id="dce-x">Cancelar</button><button class="btn" id="dce-g">${dc ? 'Guardar' : 'Crear'}</button></div>`);
  $('#dce-x').onclick = m.close;
  $('#dce-g').onclick = async () => {
    const name = dcTxt($('#dce-n').value, 120); if (!name) return ($('#dce-e').textContent = 'Poné un nombre.');
    const ref = $('#dce-s').value; const data = { ...d, name, client: dcTxt($('#dce-c').value, 120), address: dcTxt($('#dce-a').value, 200), site_ref: DC_UUID.test(ref) ? ref : null, notes: dcTxt($('#dce-o').value, 2000), contractors: Array.isArray(d.contractors) ? d.contractors : [] };
    try {
      const o = await dcSave('dc', dc?.id, data, { site: dc?.id });
      if (!dc){
        DCS.site = o.id; DCS.objs = new Map([[o.id, o]]);
        if ($('#dce-room')?.checked) await dcSaveMany([{ kind: 'room', data: { name: 'Sala de equipos', kind: 'sala', cols: 12, rows: 6 }, site: o.id }, { kind: 'room', data: { name: 'Sala de carrier', kind: 'carrier', cols: 6, rows: 3 }, site: o.id }]);
        await DCDB.put('meta', Date.now(), `${CUR_UID}:dl:${o.id}`);
        m.close(); dcReindex(); dcGo(o.id);
      } else { m.close(); dcReindex(); dcRefresh(); }
    } catch (e){ $('#dce-e').textContent = errText(e); }
  };
}

/* =====================================================================
   DATA CENTER: resumen, plano y pestañas
   ===================================================================== */
const DC_TABS = [['plano', '🗺️ Plano'], ['racks', '🗄️ Racks'], ['cables', '🔌 Cableado'], ['energia', '⚡ Energía'], ['carriers', '📡 Carriers'], ['red', '🌐 IP / VLAN'], ['pend', '⚠️ Pendientes'], ['hist', '🕓 Historial']];
function dcViewSite(v){
  const tab = DCS.view.tab || 'plano';
  const render = () => {
    const I = DCS.I, dc = I.dc, cur = DCS.view.tab || 'plano';
    const racksU = I.racks.map(r => dcRackUse(r)); const H = racksU.reduce((a, b) => a + b.H, 0), U = racksU.reduce((a, b) => a + b.used, 0);
    let pTot = 0, pUse = 0; I.devices.forEach(d => { const pu = dcPortUse(d); pTot += pu.total; pUse += pu.used; });
    const pw = I.racks.map(dcRackPower); const load = pw.reduce((a, b) => a + b.load, 0), cap = pw.reduce((a, b) => a + b.cap, 0);
    const pend = dcPendList();
    const realDevs = I.devices.filter(d => !['ciego', 'ordenador', 'bandeja'].includes(dcDevRole(d)) && d.data.status !== 'retirado');
    const counts = { racks: I.racks.length, cables: I.cables.length, carriers: I.circuits.length, red: I.prefixes.length + I.vlans.length, pend: pend.length };
    const tabs = DC_TABS.filter(([k]) => k !== 'red' || dcNet());
    v.innerHTML = `
      ${dcTopBar(dcBack('Data centers', '#/tools/dc'))}
      <div class="card"><div class="dc-head"><div class="dc-ico">🏢</div><div class="grow" style="min-width:200px"><h1>${esc(dc.data.name)}</h1>
        <div class="muted sm">${esc([dc.data.client, dc.data.address].filter(Boolean).join(' · ') || 'Sin datos de cliente')}</div></div>
        <div class="row" style="gap:6px"><button class="btn sec small" id="dc-search">🔍 Buscar</button><button class="btn sec small" id="dc-scan">📷 QR</button><button class="btn sec small" id="dc-more">⋯ Más</button></div></div>
        <div class="dc-tiles">
          <div class="dc-tile click" data-gt="racks">${dcDonut(dcPct(U, H), dcHeat(dcPct(U, H)))}<div><b>${I.racks.length}</b><span>racks · ${H - U} U libres</span></div></div>
          <div class="dc-tile click" data-gt="racks"><div style="font-size:26px">🖥️</div><div><b>${realDevs.length}</b><span>equipos</span></div></div>
          <div class="dc-tile click" data-gt="cables">${dcDonut(dcPct(pUse, pTot), '#2A78D6')}<div><b>${I.cables.length}</b><span>conexiones · ${pTot - pUse} puertos libres</span></div></div>
          <div class="dc-tile click" data-gt="energia">${dcDonut(cap ? dcPct(load, cap) : 0, cap ? dcHeat(dcPct(load, cap)) : '#CBD5E1')}<div><b>${(load / 1000).toFixed(1).replace('.', ',')} kW</b><span>${pw.some(x => x.est) ? 'estimados · ' : ''}${cap ? 'de ' + (cap / 1000).toFixed(1).replace('.', ',') + ' kW útiles' : 'cargá las PDU'}</span></div></div>
          <div class="dc-tile click" data-gt="pend" style="${pend.length ? 'background:#FDECEF' : ''}"><div style="font-size:26px">${pend.length ? '⚠️' : '✅'}</div><div><b style="${pend.length ? 'color:var(--red)' : ''}">${pend.length}</b><span>pendientes</span></div></div>
        </div></div>
      <div class="dc-tabs noprint">${tabs.map(([k, n]) => `<button data-tab="${k}" class="${cur === k ? 'on' : ''}">${n}${counts[k] !== undefined ? `<span class="n">${counts[k]}</span>` : ''}</button>`).join('')}</div>
      <div id="dc-tab"></div>`;
    dcBindTop(v);
    v.querySelectorAll('.dc-tabs [data-tab]').forEach(b => b.onclick = () => { DCS.view.tab = b.dataset.tab; render(); });
    v.querySelectorAll('[data-gt]').forEach(b => b.onclick = () => { DCS.view.tab = b.dataset.gt; render(); });
    $('#dc-search').onclick = dcSearch; $('#dc-scan').onclick = dcScanQR; $('#dc-more').onclick = dcMoreMenu;
    const box = $('#dc-tab');
    ({ plano: dcTabPlan, racks: dcTabRacks, cables: dcTabCables, energia: dcTabPower, carriers: dcTabCarriers, red: dcTabNet, pend: dcTabPend, hist: dcTabHist }[cur] || dcTabPlan)(box);
  };
  DCS.view.tab = tab;
  DCS.render = render; render();
}
function dcMoreMenu(){
  const dc = DCS.I.dc, w = dcCanW(), mgr = dcMgr();
  const items = [
    w && ['✏️', 'Editar datos del data center', () => dcEditDC(dc)],
    w && mgr && ['👷', 'Contratistas con acceso', dcContractorsModal],
    w && ['📥', 'Importar Excel de racks', dcImportModal],
    ['📤', 'Exportar a Excel', dcExportExcel],
    ['🧾', 'Informe para imprimir / PDF', () => dcGo(DCS.site, 'informe')],
    ['🏷️', 'Etiquetas QR para imprimir', () => dcGo(DCS.site, 'etiquetas')],
    ['📚', 'Biblioteca de modelos', () => dcGo('modelos')],
    ['🔄', 'Volver a descargar todo', async () => { await DCDB.del('meta', `${CUR_UID}:pull:${DCS.site}`); DCS.pulledAt = null; toast('Descargando…'); await dcOpenSite(DCS.site); dcRefresh(); toast('Listo'); }],
    w && mgr && ['🗑️', 'Dar de baja el data center', dcRetireDC],
  ].filter(Boolean);
  const m = modal(`<h2>${esc(dc.data.name)}</h2><div class="dc-list">${items.map(([i, t], k) => `<div class="dc-li" data-k="${k}"><span style="font-size:20px">${i}</span><b style="font-weight:500">${esc(t)}</b></div>`).join('')}</div>
    <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn sec" id="mm-x">Cerrar</button></div>`);
  $('#mm-x').onclick = m.close;
  m.el.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { m.close(); items[Number(b.dataset.k)][2](); });
}
async function dcRetireDC(){
  const dc = DCS.I.dc;
  const ok = prompt(`Se da de baja "${dc.data.name}". Queda en el historial y se puede restaurar desde la base.\n\nEscribí BAJA para confirmar.`);
  if (ok !== 'BAJA') return;
  try { await dcSave('dc', dc.id, dc.data, { deleted: true }); toast('Data center dado de baja'); dcGo(); } catch (e){ toast(errText(e)); }
}
async function dcContractorsModal(){
  const dc = DCS.I.dc; let contrs = [];
  try { contrs = await loadContractors(); } catch (e){ return toast(errText(e)); }
  const sel = new Set(dc.data.contractors || []);
  const m = modal(`<h2>Contratistas con acceso</h2><p class="muted sm">Solo los contratistas marcados ven este data center (nunca ven VLAN, redes ni IP). El personal propio lo ve siempre.</p>
    <div class="dc-list">${contrs.length ? contrs.map(c => `<label class="dc-li" style="margin:0"><input type="checkbox" value="${esc(c.id)}" ${sel.has(c.id) ? 'checked' : ''} style="width:auto"> <b style="font-weight:500">${esc(c.name)}</b></label>`).join('') : '<p class="muted">No hay contratistas cargados (se cargan en Tareas → Contratistas).</p>'}</div>
    <div class="err" id="cm-e"></div><div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn sec" id="cm-x">Cancelar</button><button class="btn" id="cm-g">Guardar</button></div>`);
  $('#cm-x').onclick = m.close;
  $('#cm-g').onclick = async () => {
    const ids = [...m.el.querySelectorAll('input[type=checkbox]:checked')].map(i => i.value).filter(x => DC_UUID.test(x));
    try { await dcSave('dc', dc.id, { ...dc.data, contractors: ids }); m.close(); dcReindex(); toast('Accesos actualizados'); } catch (e){ $('#cm-e').textContent = errText(e); }
  };
}

/* ---------- PLANO DE LA SALA ---------- */
function dcTabPlan(box){
  const I = DCS.I, w = dcCanW();
  const rooms = I.rooms.slice(); const noRoom = I.racks.filter(r => !r.data.room || !I.by.get(r.data.room) || I.by.get(r.data.room).deleted);
  if (noRoom.length) rooms.push({ id: '', data: { name: 'Sin sala', cols: 10, rows: Math.max(2, Math.ceil(noRoom.length / 10)) }, virtual: true });
  let roomId = DCS.view.room; if (!rooms.some(r => r.id === roomId)) roomId = rooms[0]?.id ?? null;
  DCS.view.room = roomId;
  const edit = !!DCS.view.planEdit && w;
  if (!rooms.length){
    box.innerHTML = `<div class="card dc-empty"><span class="e">🗺️</span><b>Todavía no hay salas</b><p>Creá una sala para dibujar el plano con sus racks.</p>${w ? '<button class="btn" id="pl-room">+ Sala</button>' : ''}</div>`;
    $('#pl-room')?.addEventListener('click', () => dcEditRoom(null));
    return;
  }
  const room = rooms.find(r => r.id === roomId);
  const racks = room.virtual ? noRoom : I.racks.filter(r => r.data.room === room.id);
  const cols = dcClamp(dcNum(room.data.cols, 10), 2, 40), rows0 = dcClamp(dcNum(room.data.rows, 6), 1, 30);
  // posiciones: las guardadas; las que faltan se acomodan en celdas libres (sin guardar)
  const taken = new Set(), pos = new Map();
  racks.forEach(r => { const x = dcNum(r.data.x, -1), y = dcNum(r.data.y, -1); if (x >= 0 && y >= 0 && x < cols && !taken.has(x + ',' + y)){ taken.add(x + ',' + y); pos.set(r.id, [x, y]); } });
  let cx = 0, cy = 0; racks.forEach(r => { if (pos.has(r.id)) return; while (taken.has(cx + ',' + cy)){ cx++; if (cx >= cols){ cx = 0; cy++; } } taken.add(cx + ',' + cy); pos.set(r.id, [cx, cy]); });
  const rows = Math.max(rows0, ...[...pos.values()].map(p => p[1] + 1));
  const C = 66, PAD = 26, Wd = PAD * 2 + cols * C, Ht = PAD * 2 + rows * C;
  let svg = `<svg viewBox="0 0 ${Wd} ${Ht}" width="${Math.max(Wd, 320)}" style="min-width:${Math.min(Wd, 640)}px;max-width:100%" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect x="0" y="0" width="${Wd}" height="${Ht}" fill="#FBFCFD"/>`;
  for (let i = 0; i <= cols; i++) svg += `<line x1="${PAD + i * C}" y1="${PAD}" x2="${PAD + i * C}" y2="${PAD + rows * C}" stroke="#EEF2F6"/>`;
  for (let j = 0; j <= rows; j++) svg += `<line x1="${PAD}" y1="${PAD + j * C}" x2="${PAD + cols * C}" y2="${PAD + j * C}" stroke="#EEF2F6"/>`;
  for (let i = 0; i < cols; i++) svg += `<text x="${PAD + i * C + C / 2}" y="${PAD - 9}" text-anchor="middle" font-size="10" fill="#94A3B8">${String.fromCharCode(65 + (i % 26))}</text>`;
  for (let j = 0; j < rows; j++) svg += `<text x="${PAD - 9}" y="${PAD + j * C + C / 2 + 4}" text-anchor="end" font-size="10" fill="#94A3B8">${j + 1}</text>`;
  if (edit) for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) if (!taken.has(i + ',' + j)) svg += `<rect class="cell" data-cx="${i}" data-cy="${j}" x="${PAD + i * C + 3}" y="${PAD + j * C + 3}" width="${C - 6}" height="${C - 6}" rx="8" fill="transparent" stroke="#E1E6ED" stroke-dasharray="3 3" style="cursor:pointer"/>`;
  for (const r of racks){
    const [x, y] = pos.get(r.id), use = dcRackUse(r), pw = dcRackPower(r), col = dcHeat(use.pct);
    const X = PAD + x * C + 5, Y = PAD + y * C + 5, S = C - 10, face = r.data.facing || 'S';
    const fh = (S - 14) * use.pct / 100;
    const nm = String(r.data.name || '').replace(/^rack\s*/i, '');
    const tip = `<b>${esc(r.data.name)}</b><br>${use.used}/${use.H} U ocupadas (${use.pct}%)<br>${use.devs} elementos${use.unknown ? `<br><span style='color:#FCA5A5'>${use.unknown} a identificar</span>` : ''}${pw.cap ? `<br>Energía ${pw.pct}%` : ''}`;
    svg += `<g class="rk" data-rk="${esc(r.id)}" data-tip="${esc(tip)}" transform="translate(${X},${Y})">
      <rect class="b" width="${S}" height="${S}" rx="9" fill="#1E293B" stroke="#0F172A"/>
      <rect x="5" y="5" width="${S - 10}" height="${S - 14}" rx="4" fill="#334155"/>
      <rect x="5" y="${5 + (S - 14) - fh}" width="${S - 10}" height="${fh}" rx="4" fill="${col}"/>
      <text x="${S / 2}" y="${S / 2 + 1}" text-anchor="middle" font-size="${nm.length > 4 ? 10 : 14}" font-weight="700" fill="#fff" style="paint-order:stroke" stroke="#0F172A" stroke-width="2.5">${esc(nm.slice(0, 8))}</text>
      <text x="${S / 2}" y="${S - 2}" text-anchor="middle" font-size="8.5" fill="#CBD5E1">${use.pct}%</text>
      ${face === 'N' ? `<path d="M${S / 2 - 5} -1 L${S / 2} -6 L${S / 2 + 5} -1 Z" fill="#22B07D"/>` : face === 'E' ? `<path d="M${S + 1} ${S / 2 - 5} L${S + 6} ${S / 2} L${S + 1} ${S / 2 + 5} Z" fill="#22B07D"/>` : face === 'W' ? `<path d="M-1 ${S / 2 - 5} L-6 ${S / 2} L-1 ${S / 2 + 5} Z" fill="#22B07D"/>` : `<path d="M${S / 2 - 5} ${S + 1} L${S / 2} ${S + 6} L${S / 2 + 5} ${S + 1} Z" fill="#22B07D"/>`}
      ${use.unknown ? `<circle cx="${S - 4}" cy="4" r="8" fill="#DC2626" stroke="#fff" stroke-width="2"/><text x="${S - 4}" y="7.5" text-anchor="middle" font-size="9" font-weight="700" fill="#fff">${use.unknown}</text>` : ''}
      ${r.data.surveyed ? `<circle cx="4" cy="4" r="7" fill="#22B07D" stroke="#fff" stroke-width="2"/><text x="4" y="7" text-anchor="middle" font-size="8" fill="#fff">✓</text>` : ''}
    </g>`;
  }
  svg += `</svg>`;
  box.innerHTML = `<div class="card">
    <div class="row between" style="margin-bottom:10px"><div class="dc-chips">${rooms.map(r => `<button class="dc-chip ${r.id === roomId ? 'on' : ''}" data-room="${esc(r.id)}">${esc(r.data.name)} <span class="muted">(${r.virtual ? noRoom.length : I.racks.filter(x => x.data.room === r.id).length})</span></button>`).join('')}${w ? '<button class="dc-chip" id="pl-room">+ Sala</button>' : ''}</div>
      <div class="row" style="gap:6px">${w && !room.virtual ? `<button class="btn sec small" id="pl-redit">⚙️ Sala</button>` : ''}${w ? `<button class="btn ${edit ? '' : 'sec'} small" id="pl-edit">${edit ? '✓ Listo' : '✋ Mover racks'}</button><button class="btn small" id="pl-rack">+ Rack</button>` : ''}</div></div>
    ${edit ? '<p class="sm" style="margin:0 0 8px;color:var(--navy-2)">Arrastrá cada rack a su lugar en la sala, o tocá una celda vacía para agregar uno ahí. La flecha verde marca el frente.</p>' : ''}
    <div class="dc-plan ${edit ? 'edit' : ''}" id="pl-svg">${svg}</div>
    <div class="dc-legend"><span><i style="background:#7FD3B0"></i>Poco ocupado</span><span><i style="background:#22B07D"></i>40–75 %</span><span><i style="background:#F59E0B"></i>75–90 %</span><span><i style="background:#DC2626"></i>Más de 90 %</span><span><i style="background:#22B07D;border-radius:50%"></i>Relevado</span><span><i style="background:#DC2626;border-radius:50%"></i>Equipos a identificar</span></div>
  </div>`;
  box.querySelectorAll('[data-room]').forEach(b => b.onclick = () => { DCS.view.room = b.dataset.room; dcTabPlan(box); });
  $('#pl-room')?.addEventListener('click', () => dcEditRoom(null));
  $('#pl-redit')?.addEventListener('click', () => dcEditRoom(room));
  $('#pl-edit')?.addEventListener('click', () => { DCS.view.planEdit = !edit; dcTabPlan(box); });
  $('#pl-rack')?.addEventListener('click', () => dcEditRack(null, { room: room.virtual ? '' : room.id }));
  const holder = $('#pl-svg'); bindTips(holder);
  holder.querySelectorAll('.cell').forEach(c => c.onclick = () => dcEditRack(null, { room: room.virtual ? '' : room.id, x: Number(c.dataset.cx), y: Number(c.dataset.cy) }));
  if (!edit){ holder.querySelectorAll('[data-rk]').forEach(g => g.onclick = () => dcGo(DCS.site, 'rack', g.dataset.rk)); return; }
  // arrastrar para ubicar
  const svgEl = holder.querySelector('svg');
  const toCell = e => { const pt = svgEl.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const p = pt.matrixTransform(svgEl.getScreenCTM().inverse()); return [Math.floor((p.x - PAD) / C), Math.floor((p.y - PAD) / C), p]; };
  holder.querySelectorAll('[data-rk]').forEach(g => {
    g.addEventListener('pointerdown', e => {
      e.preventDefault(); hideTip(); g.setPointerCapture(e.pointerId); g.classList.add('drag');
      const id = g.dataset.rk, [ox, oy] = pos.get(id); let moved = false; const [sx0, sy0, p0] = toCell(e);
      const mv = ev => { const [, , p] = toCell(ev); const dx = p.x - p0.x, dy = p.y - p0.y; if (Math.abs(dx) + Math.abs(dy) > 4) moved = true; g.setAttribute('transform', `translate(${PAD + ox * C + 5 + dx},${PAD + oy * C + 5 + dy})`); };
      const up = async ev => {
        g.removeEventListener('pointermove', mv); g.removeEventListener('pointerup', up); g.classList.remove('drag');
        if (!moved){ dcGo(DCS.site, 'rack', id); return; }
        const [nx, ny] = toCell(ev);
        const busy = [...pos.entries()].some(([k, v]) => k !== id && v[0] === nx && v[1] === ny);
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows + 2 || busy){ toast(busy ? 'Esa celda ya tiene un rack' : 'Fuera de la sala'); dcTabPlan(box); return; }
        const r = I.by.get(id);
        try { await dcSave('rack', id, { ...r.data, x: nx, y: ny, room: room.virtual ? (r.data.room || '') : room.id }); if (ny >= rows0) { const rm = I.by.get(room.id); if (rm) await dcSave('room', rm.id, { ...rm.data, rows: ny + 1 }); } dcReindex(); dcTabPlan(box); }
        catch (err){ toast(errText(err)); dcTabPlan(box); }
      };
      g.addEventListener('pointermove', mv); g.addEventListener('pointerup', up);
    });
  });
}
function dcEditRoom(room){
  const d = room?.data || {};
  const m = modal(`<h2>${room ? 'Sala' : 'Nueva sala'}</h2>
    <label>Nombre *</label><input id="rm-n" maxlength="80" value="${esc(d.name || '')}" placeholder="Ej.: Sala de equipos">
    <label>Tipo</label><select id="rm-k">${Object.entries(DC_ROOM_KIND).map(([k, n]) => `<option value="${k}" ${d.kind === k ? 'selected' : ''}>${n}</option>`).join('')}</select>
    <div class="row"><div class="grow"><label>Columnas del plano</label><input id="rm-c" type="number" min="2" max="40" value="${dcNum(d.cols, 12)}"></div><div class="grow"><label>Filas del plano</label><input id="rm-r" type="number" min="1" max="30" value="${dcNum(d.rows, 6)}"></div></div>
    <div class="err" id="rm-e"></div>
    <div class="row between" style="margin-top:12px">${room && dcMgr() ? '<button class="btn danger" id="rm-d">Dar de baja</button>' : '<span></span>'}<div class="row"><button class="btn sec" id="rm-x">Cancelar</button><button class="btn" id="rm-g">Guardar</button></div></div>`);
  $('#rm-x').onclick = m.close;
  $('#rm-d')?.addEventListener('click', async () => {
    const n = DCS.I.racks.filter(r => r.data.room === room.id).length;
    if (!confirm(n ? `La sala tiene ${n} racks: quedan "sin sala" (no se borran). ¿Dar de baja la sala?` : '¿Dar de baja la sala?')) return;
    try { await dcSave('room', room.id, room.data, { deleted: true }); m.close(); dcReindex(); dcRefresh(); } catch (e){ $('#rm-e').textContent = errText(e); }
  });
  $('#rm-g').onclick = async () => {
    const name = dcTxt($('#rm-n').value, 80); if (!name) return ($('#rm-e').textContent = 'Poné un nombre.');
    const kind = $('#rm-k').value in DC_ROOM_KIND ? $('#rm-k').value : 'sala';
    try { const o = await dcSave('room', room?.id, { ...d, name, kind, cols: dcClamp(dcNum($('#rm-c').value, 12), 2, 40), rows: dcClamp(dcNum($('#rm-r').value, 6), 1, 30) }); DCS.view.room = o.id; m.close(); dcReindex(); dcRefresh(); }
    catch (e){ $('#rm-e').textContent = errText(e); }
  };
}
function dcEditRack(rack, preset = {}){
  const d = rack?.data || {}, I = DCS.I;
  const m = modal(`<h2>${rack ? 'Datos del rack' : 'Nuevo rack'}</h2>
    <label>Nombre *</label><input id="rk-n" maxlength="60" value="${esc(d.name || '')}" placeholder="Ej.: Rack 01">
    <div class="row"><div class="grow"><label>Altura (U)</label><input id="rk-h" type="number" min="1" max="60" value="${dcNum(d.u_height, 42)}"></div>
      <div class="grow"><label>Tipo</label><select id="rk-t">${['Gabinete 4 postes', 'Rack abierto 4 postes', 'Rack abierto 2 postes', 'Gabinete de pared'].map(t => `<option ${d.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div></div>
    <div class="row"><div class="grow"><label>Sala</label><select id="rk-r"><option value="">— Sin sala —</option>${I.rooms.map(r => `<option value="${esc(r.id)}" ${(rack ? d.room : preset.room) === r.id ? 'selected' : ''}>${esc(r.data.name)}</option>`).join('')}</select></div>
      <div class="grow"><label>El frente mira hacia</label><select id="rk-f">${[['S', 'Abajo del plano'], ['N', 'Arriba del plano'], ['E', 'Derecha'], ['W', 'Izquierda']].map(([k, n]) => `<option value="${k}" ${(d.facing || 'S') === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div></div>
    <div class="row"><div class="grow"><label>Fila / pasillo</label><input id="rk-a" maxlength="40" value="${esc(d.aisle || '')}"></div><div class="grow"><label>N° de serie / activo</label><input id="rk-s" maxlength="60" value="${esc(d.asset || '')}"></div></div>
    <label>Notas</label><textarea id="rk-o" maxlength="2000">${esc(d.notes || '')}</textarea>
    <div class="err" id="rk-e"></div>
    <div class="row between" style="margin-top:12px">${rack && dcMgr() ? '<button class="btn danger" id="rk-d">Dar de baja</button>' : '<span></span>'}<div class="row"><button class="btn sec" id="rk-x">Cancelar</button><button class="btn" id="rk-g">Guardar</button></div></div>`);
  $('#rk-x').onclick = m.close;
  $('#rk-d')?.addEventListener('click', async () => {
    const n = (I.devByRack.get(rack.id) || []).length;
    if (!confirm(n ? `El rack tiene ${n} elementos. Se da de baja el rack (queda en el historial). ¿Seguir?` : '¿Dar de baja el rack?')) return;
    try { await dcSave('rack', rack.id, rack.data, { deleted: true }); m.close(); dcReindex(); dcGo(DCS.site); } catch (e){ $('#rk-e').textContent = errText(e); }
  });
  $('#rk-g').onclick = async () => {
    const name = dcTxt($('#rk-n').value, 60); if (!name) return ($('#rk-e').textContent = 'Poné un nombre.');
    if (I.racks.some(r => r.id !== rack?.id && dcNorm(r.data.name) === dcNorm(name))) return ($('#rk-e').textContent = 'Ya hay un rack con ese nombre.');
    const room = $('#rk-r').value; const H = dcClamp(dcNum($('#rk-h').value, 42), 1, 60);
    if (rack){ const hi = Math.max(0, ...(I.devByRack.get(rack.id) || []).map(x => dcNum(x.data.u) + dcDevU(x) - 1)); if (hi > H) return ($('#rk-e').textContent = `Hay equipos hasta la U${hi}: la altura no puede ser menor.`); }
    const data = { ...d, name, u_height: H, type: dcTxt($('#rk-t').value, 40), room: DC_UUID.test(room) ? room : '', facing: ['N', 'S', 'E', 'W'].includes($('#rk-f').value) ? $('#rk-f').value : 'S', aisle: dcTxt($('#rk-a').value, 40), asset: dcTxt($('#rk-s').value, 60), notes: dcTxt($('#rk-o').value, 2000) };
    if (!rack && preset.x !== undefined){ data.x = preset.x; data.y = preset.y; }
    if (rack && data.room !== d.room){ delete data.x; delete data.y; }
    try { const o = await dcSave('rack', rack?.id, data); m.close(); dcReindex(); if (rack) dcRefresh(); else dcGo(DCS.site, 'rack', o.id); }
    catch (e){ $('#rk-e').textContent = errText(e); }
  };
}

/* ---------- RACKS (miniaturas) ---------- */
function dcTabRacks(box){
  const I = DCS.I, w = dcCanW();
  const f = DCS.view.rackRoom ?? 'all';
  const racks = I.racks.filter(r => f === 'all' || (r.data.room || '') === f);
  box.innerHTML = `<div class="card"><div class="row between" style="margin-bottom:12px"><div class="dc-chips"><button class="dc-chip ${f === 'all' ? 'on' : ''}" data-f="all">Todos (${I.racks.length})</button>${I.rooms.map(r => `<button class="dc-chip ${f === r.id ? 'on' : ''}" data-f="${esc(r.id)}">${esc(r.data.name)}</button>`).join('')}</div>${w ? '<button class="btn small" id="rk-new">+ Rack</button>' : ''}</div>
    ${racks.length ? `<div class="dc-thumbs">${racks.map(r => { const u = dcRackUse(r); return `<div class="dc-thumb" data-rk="${esc(r.id)}">${dcRackSVG(r, { mini: true })}<b>${esc(r.data.name)}</b><small>${u.pct}% · ${u.free} U libres${u.unknown ? ` · <span style="color:var(--red)">${u.unknown} ¿?</span>` : ''}</small></div>`; }).join('')}</div>` : '<div class="dc-empty"><span class="e">🗄️</span>No hay racks en esta sala.</div>'}
    <div class="dc-legend">${['switch', 'router', 'firewall', 'server', 'storage', 'san', 'panel_fo', 'panel_utp', 'pdu', 'desconocido'].map(k => `<span><i style="background:${DC_ROLE[k].c}"></i>${DC_ROLE[k].n}</span>`).join('')}</div></div>`;
  box.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { DCS.view.rackRoom = b.dataset.f; dcTabRacks(box); });
  box.querySelectorAll('[data-rk]').forEach(b => b.onclick = () => dcGo(DCS.site, 'rack', b.dataset.rk));
  $('#rk-new')?.addEventListener('click', () => dcEditRack(null, { room: f !== 'all' ? f : (I.rooms[0]?.id || '') }));
}

/* =====================================================================
   RACK: elevación interactiva + detalle del equipo
   ===================================================================== */
function dcViewRack(v, rackId){
  const render = () => {
    const I = DCS.I, rack = I.by.get(rackId);
    if (!rack || rack.deleted || rack.kind !== 'rack'){ v.innerHTML = `<div class="card"><b>Rack no encontrado</b><p class="muted">Puede haber sido dado de baja.</p>${dcBack('Data center', dcHash(DCS.site))}</div>`; return; }
    const w = dcCanW(), face = DCS.view.face || 'front', edit = !!DCS.view.rackEdit && w;
    const use = dcRackUse(rack), pw = dcRackPower(rack), room = I.by.get(rack.data.room);
    const devs = I.devByRack.get(rack.id) || [];
    let sel = DCS.view.sel && I.by.get(DCS.view.sel); if (!sel || sel.data.rack !== rack.id || sel.deleted) sel = null;
    const zeroU = devs.filter(d => !dcNum(d.data.u, 0) || !dcDevU(d));
    const both = face === 'both';
    v.innerHTML = `
      ${dcTopBar(dcBack(I.dc.data.name, dcHash(DCS.site)))}
      <div class="card"><div class="dc-head"><div class="dc-ico" style="background:linear-gradient(135deg,#1E293B,#334155)">🗄️</div>
        <div class="grow" style="min-width:180px"><h1>${esc(rack.data.name)}</h1><div class="muted sm">${esc([room?.data?.name, rack.data.aisle && 'Fila ' + rack.data.aisle, use.H + ' U', rack.data.type].filter(Boolean).join(' · '))}${rack.data.surveyed ? ` · <span style="color:var(--green-d)">✓ relevado ${esc(fmtDate(rack.data.surveyed.at))} por ${esc(rack.data.surveyed.by || '')}</span>` : ''}</div></div>
        <div class="row" style="gap:6px">${w ? `<button class="btn small" id="rk-survey">🧭 Relevar este rack</button><button class="btn sec small" id="rk-add">+ Equipo</button>` : ''}<button class="btn sec small" id="rk-qr">🏷️ QR</button>${w ? '<button class="btn sec small" id="rk-edit">✏️ Rack</button>' : ''}</div></div>
        <div class="row" style="gap:18px;margin-top:12px">
          <div class="grow dc-meter" style="min-width:200px"><span style="width:92px">Espacio ${use.pct}%</span>${dcBar(use.pct)}<span>${use.free} U libres</span></div>
          <div class="grow dc-meter" style="min-width:200px"><span style="width:92px">Energía ${pw.cap ? pw.pct + '%' : '—'}</span>${dcBar(pw.cap ? pw.pct : 0)}<span>${pw.load ? (pw.load / 1000).toFixed(2).replace('.', ',') + ' kW' : 'sin datos'}</span></div>
        </div></div>
      <div class="row between noprint" style="margin-bottom:10px"><div class="dc-face"><button data-face="front" class="${face === 'front' ? 'on' : ''}">Frente</button><button data-face="rear" class="${face === 'rear' ? 'on' : ''}">Trasera</button><button data-face="both" class="${both ? 'on' : ''} hide-sm">Ambas</button></div>
        ${w ? `<button class="btn ${edit ? '' : 'sec'} small" id="rk-move">${edit ? '✓ Listo' : '✋ Mover equipos'}</button>` : ''}</div>
      ${edit ? '<p class="sm" style="margin:-4px 0 10px;color:var(--navy-2)">Arrastrá un equipo hacia arriba o abajo para cambiarlo de U. Si choca con otro, no se mueve.</p>' : ''}
      <div class="dc-rackwrap ${both ? 'two' : ''}">
        ${both ? `<div class="dc-elev" data-f="front"><div class="dc-face-lbl" style="margin-top:0">Frente</div>${dcRackSVG(rack, { face: 'front', interactive: w, sel: sel?.id })}</div><div class="dc-elev" data-f="rear"><div class="dc-face-lbl" style="margin-top:0">Trasera</div>${dcRackSVG(rack, { face: 'rear', interactive: w, sel: sel?.id })}</div>`
               : `<div class="dc-elev ${edit ? 'edit' : ''}" data-f="${face}">${dcRackSVG(rack, { face, interactive: w && !edit, sel: sel?.id })}</div>`}
        <div id="rk-side">${sel ? '' : dcRackSummaryHTML(rack, devs, zeroU)}</div>
      </div>`;
    dcBindTop(v);
    v.querySelectorAll('[data-face]').forEach(b => b.onclick = () => { DCS.view.face = b.dataset.face; render(); });
    $('#rk-survey')?.addEventListener('click', () => dcGo(DCS.site, 'relevar', rack.id));
    $('#rk-add')?.addEventListener('click', () => dcEditDevice(null, { rack: rack.id, face: face === 'rear' ? 'rear' : 'both' }));
    $('#rk-edit')?.addEventListener('click', () => dcEditRack(rack));
    $('#rk-qr').onclick = () => dcQRModal(rack);
    $('#rk-move')?.addEventListener('click', () => { DCS.view.rackEdit = !edit; render(); });
    const side = $('#rk-side');
    if (sel){ side.innerHTML = `<div class="card" style="margin:0">${dcDevicePanelHTML(sel)}</div>`; dcBindDevicePanel(side, sel, render); }
    else dcBindRackSummary(side);
    v.querySelectorAll('.dc-elev').forEach(el => {
      el.querySelectorAll('.free').forEach(f => f.onclick = () => dcEditDevice(null, { rack: rack.id, u: Number(f.dataset.free), face: el.dataset.f === 'rear' ? 'rear' : 'both' }));
      if (edit) dcBindDrag(el, rack, render);
      else el.querySelectorAll('.dv').forEach(g => g.onclick = () => {
        const d = I.by.get(g.dataset.dev);
        if (matchMedia('(max-width:900px)').matches){ dcDeviceSheet(d, render); return; }
        DCS.view.sel = DCS.view.sel === d.id ? null : d.id; render();
      });
    });
  };
  DCS.render = render; render();
}
function dcRackSummaryHTML(rack, devs, zeroU){
  const list = devs.filter(d => dcNum(d.data.u, 0) && !['ciego', 'ordenador', 'bandeja'].includes(dcDevRole(d)));
  return `<div class="card" style="margin:0"><h3>Contenido del rack</h3>
    ${list.length ? `<div class="dc-list">${list.map(d => { const R = DC_ROLE[dcDevRole(d)], pu = dcPortUse(d), h = dcDevU(d), u = dcNum(d.data.u);
      return `<div class="dc-li" data-dev="${esc(d.id)}"><span class="sw" style="background:${R.c}"></span><div class="grow" style="min-width:0"><b style="font-size:14px">${esc(dcDevName(d))}</b><div class="muted sm">U${h > 1 ? u + '–' + (u + h - 1) : u} · ${esc(R.n)}${(d.data.face || 'both') !== 'both' ? ' · solo ' + (d.data.face === 'rear' ? 'trasera' : 'frente') : ''}</div></div>${pu.ports ? `<div class="sm muted" style="text-align:right;min-width:62px">${pu.used}/${pu.total}${dcBar(dcPct(pu.used, pu.total), pu.fail ? '#DC2626' : '#22B07D')}</div>` : ''}</div>`; }).join('')}</div>`
      : '<div class="dc-empty"><span class="e">📭</span>Rack vacío. Tocá una U libre o usá <b>Relevar este rack</b>.</div>'}
    ${zeroU.length ? `<div class="dc-face-lbl">Laterales / 0U / fuera del rack</div><div class="dc-chips">${zeroU.map(d => `<button class="dc-chip" data-dev="${esc(d.id)}">${DC_ROLE[dcDevRole(d)].n === 'PDU' ? '⚡' : '📦'} ${esc(dcDevName(d))}</button>`).join('')}</div>` : ''}
    ${rack.data.notes ? `<div class="dc-face-lbl">Notas</div><p class="sm" style="white-space:pre-wrap;margin:0">${esc(rack.data.notes)}</p>` : ''}
  </div>`;
}
function dcBindRackSummary(scope){
  scope.querySelectorAll('[data-dev]').forEach(b => b.onclick = () => {
    const d = DCS.I.by.get(b.dataset.dev);
    if (matchMedia('(max-width:900px)').matches || !dcNum(d.data.u, 0)) return dcDeviceSheet(d, () => DCS.render && DCS.render());
    DCS.view.sel = d.id; DCS.render && DCS.render();
  });
}
/* mover equipos arrastrando dentro del rack */
function dcBindDrag(el, rack, render){
  const svg = el.querySelector('svg'); const H = dcRackH(rack), UH = 20, TOP = 14;
  const yAt = e => { const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; return pt.matrixTransform(svg.getScreenCTM().inverse()).y; };
  svg.querySelectorAll('.dv').forEach(g => {
    g.style.touchAction = 'none';
    g.addEventListener('pointerdown', e => {
      e.preventDefault(); g.setPointerCapture(e.pointerId);
      const d = DCS.I.by.get(g.dataset.dev), y0 = yAt(e); let dy = 0;
      const mv = ev => { dy = yAt(ev) - y0; g.setAttribute('transform', `translate(0,${dy})`); };
      const up = async () => {
        g.removeEventListener('pointermove', mv); g.removeEventListener('pointerup', up);
        const du = -Math.round(dy / UH); if (!du){ render(); return; }
        const h = dcDevU(d), nu = dcClamp(dcNum(d.data.u) + du, 1, H - h + 1);
        const hit = dcCollides(rack.id, nu, h, d.data.face || 'both', d.id);
        if (hit){ toast(`Choca con ${dcDevName(hit)} (U${hit.data.u})`); render(); return; }
        try { await dcSave('device', d.id, { ...d.data, u: nu }); dcReindex(); toast(`${dcDevName(d)} → U${nu}`); } catch (err){ toast(errText(err)); }
        render();
      };
      g.addEventListener('pointermove', mv); g.addEventListener('pointerup', up);
    });
  });
}

/* ---------- panel del equipo (se usa al costado, en hoja y en página) ---------- */
function dcDevicePanelHTML(d){
  const I = DCS.I, role = dcDevRole(d), R = DC_ROLE[role], m = dcDevModel(d), rack = dcRackOf(d), w = dcCanW();
  const u = dcNum(d.data.u, 0), h = dcDevU(d);
  const ips = !dcNet() ? [] : (I.ipByDev.get(d.id) || []);
  const pdus = [d.data.pdu_a, d.data.pdu_b].map(x => x && I.by.get(x)).filter(Boolean);
  const photos = (d.data.photos || []).filter(p => p && typeof p.path === 'string');
  const kv = [
    ['Modelo', m ? `${m.maker ? m.maker + ' ' : ''}${m.name}` : '—'],
    ['Ubicación', `${rack ? rack.data.name : 'Sin rack'}${u ? ` · U${h > 1 ? u + '–' + (u + h - 1) : u}` : ' · lateral / 0U'}${(d.data.face || 'both') !== 'both' ? ' · solo ' + (d.data.face === 'rear' ? 'trasera' : 'frente') : ''}`],
    d.data.serial && ['N° de serie', d.data.serial],
    d.data.asset && ['Activo fijo', d.data.asset],
    ips.length && ['IP', ips.map(x => x.data.address + (x.data.desc ? ` (${x.data.desc})` : '')).join(', ')],
    (d.data.power_w ?? m?.power_w) && ['Consumo', `${dcNum(d.data.power_w ?? m?.power_w)} W${d.data.power_w === undefined || d.data.power_w === null || d.data.power_w === '' ? ' (típico del modelo)' : ''}`],
    pdus.length && ['Alimentado por', pdus.map(p => dcDevName(p)).join(' + ')],
    role === 'pdu' && ['Capacidad', `${dcNum(d.data.capacity_a ?? m?.capacity_a)} A · ${dcNum(d.data.voltage ?? m?.voltage ?? 220)} V`],
    d.data.surveyed_by && ['Relevado por', `${d.data.surveyed_by}${d.data.surveyed_at ? ' · ' + fmtDate(d.data.surveyed_at) : ''}`],
  ].filter(Boolean);
  return `<div class="row between" style="align-items:flex-start"><div style="min-width:0"><div class="row" style="gap:6px">${dcRolePill(role)}<span class="pill ${d.data.status === 'falla' ? 'p-bad' : d.data.status === 'planificado' || role === 'desconocido' ? 'p-pend' : 'p-ok'}">${esc(DC_STATUS[d.data.status] || (role === 'desconocido' ? 'A identificar' : 'Activo'))}</span></div>
      <h2 style="margin:8px 0 2px">${role === 'desconocido' ? '¿? ' : ''}${esc(dcDevName(d))}</h2></div>
      <div class="row" style="gap:4px">${w ? '<button class="btn sec small" data-act="edit">✏️</button>' : ''}<button class="btn sec small" data-act="qr" title="Etiqueta QR">🏷️</button><button class="btn sec small" data-act="page" title="Abrir en página">↗</button></div></div>
    <dl class="dc-kv" style="margin:10px 0">${kv.map(([k, val]) => `<dt>${esc(k)}</dt><dd>${esc(val)}</dd>`).join('')}</dl>
    ${d.data.notes ? `<p class="sm" style="white-space:pre-wrap;background:var(--bg);padding:8px 10px;border-radius:8px">${esc(d.data.notes)}</p>` : ''}
    <div class="dc-photos" data-photos>${photos.map(p => `<img data-dcph="${esc(p.path)}" alt="Foto">`).join('')}${w ? `<label class="btn sec small" style="display:grid;place-items:center;width:92px;height:92px;cursor:pointer">📷<span class="sm">Foto</span><input type="file" accept="image/*" capture="environment" data-act="photo" hidden></label>` : ''}</div>
    ${dcFaceplateHTML(d)}
    ${w ? `<div class="row" style="gap:6px;margin-top:12px">${dcIsPanel(d) ? '<button class="btn sec small" data-act="trunk">🔗 Troncal a otro panel</button>' : ''}<button class="btn sec small" data-act="addport">+ Puerto</button>${role === 'desconocido' ? '<button class="btn small" data-act="ident">🔎 Identificar equipo</button>' : ''}</div>` : ''}`;
}
function dcFaceplateHTML(d, o = {}){
  const ports = dcPorts(d); if (!ports.length) return o.picker ? '<p class="muted sm">Este equipo no tiene puertos cargados.</p>' : '';
  const panel = dcIsPanel(d), I = DCS.I;
  const btn = (p, side) => {
    const at = I.cableAt.get(`${d.id}|${p.n}|${side}`); const c = at?.cable;
    const circ = I.circAt.get(`${d.id}|${p.n}|${side}`);
    let cls = 'dc-port' + (p.n.length > 3 ? ' wide' : ''), st = '', tip = '';
    if (c){ const ct = DC_CABLE[c.data.type] || DC_CABLE.otro; cls += c.data.status === 'falla' ? ' fail' : c.data.status === 'planificado' ? ' plan' : ' on'; if (c.data.status !== 'falla' && c.data.status !== 'planificado') st = `background:${ct.c}`; tip = '→ ' + dcEndTxt(c.data[at.end === 'a' ? 'b' : 'a'], true); }
    else tip = 'Libre';
    if (circ) tip += ` · ${circ.data.provider || 'Carrier'} ${circ.data.cid || ''}`;
    const dis = o.picker && (c && !(o.allow && o.allow === c.id)) ? 'disabled' : '';
    const hit = o.hit && o.hit.port === p.n && (o.hit.side || '') === side ? ' hit' : '';
    return `<button class="${cls}${hit}" style="${st}" data-port="${esc(p.n)}" data-side="${side}" title="${esc(p.n + ' · ' + (DC_PORT_TY[p.ty] || '') + ' · ' + tip)}" ${dis}>${esc(p.n.replace(/^(ETH|Par|GE|TE|FC|SAS|e0)\s*/i, ''))}${circ ? '<span class="ci"></span>' : ''}</button>`;
  };
  const groups = (side) => `<div class="dc-ports">${ports.map(p => btn(p, side)).join('')}</div>`;
  const legend = o.picker ? '' : `<div class="dc-legend" style="margin-top:6px">${['utp', 'fibra_mm', 'fibra_sm', 'fc', 'power'].map(k => `<span><i style="background:${DC_CABLE[k].c}"></i>${DC_CABLE[k].n}</span>`).join('')}<span><i style="background:#fff;border:1.5px solid #CBD5E1"></i>Libre</span><span><i style="background:#DC2626"></i>Falla</span></div>`;
  if (panel){
    const sides = o.side ? [o.side] : ['F', 'R'];
    return sides.map(s => `<div class="dc-face-lbl">${s === 'F' ? 'Frente (patch cords)' : 'Trasera (troncales / cableado fijo)'}</div>${groups(s)}`).join('') + legend;
  }
  return `<div class="dc-face-lbl">Puertos</div>${groups('')}${legend}`;
}
function dcBindDevicePanel(scope, d, after){
  hydrateDC(scope);
  scope.querySelectorAll('[data-port]').forEach(b => b.onclick = () => dcPortSheet({ dev: d.id, port: b.dataset.port, side: b.dataset.side || '' }, after));
  scope.querySelector('[data-act=edit]')?.addEventListener('click', () => dcEditDevice(d));
  scope.querySelector('[data-act=qr]')?.addEventListener('click', () => dcQRModal(d));
  scope.querySelector('[data-act=page]')?.addEventListener('click', () => { $('#modal-root').innerHTML = ''; dcGo(DCS.site, 'dev', d.id); });
  scope.querySelector('[data-act=trunk]')?.addEventListener('click', () => dcTrunkModal(d, after));
  scope.querySelector('[data-act=addport]')?.addEventListener('click', () => dcAddPort(d, after));
  scope.querySelector('[data-act=ident]')?.addEventListener('click', () => dcEditDevice(d, { identify: true }));
  scope.querySelector('[data-act=photo]')?.addEventListener('change', async e => { const f = e.target.files?.[0]; if (f) { await dcAddPhoto(d, f); after && after(); } });
  scope.querySelectorAll('[data-dcph]').forEach(img => img.onclick = () => { if (img.src) { const mm = modal(`<img src="${esc(img.src)}" style="width:100%;border-radius:10px" alt="Foto"><div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn sec" id="ph-x">Cerrar</button></div>`, { wide: true }); $('#ph-x').onclick = mm.close; } });
}
function dcDeviceSheet(d, after){
  const m = modal(`<div id="dv-sheet">${dcDevicePanelHTML(d)}</div><div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn sec" id="dv-x">Cerrar</button></div>`, { wide: true });
  $('#dv-x').onclick = () => { m.close(); after && after(); };
  dcBindDevicePanel($('#dv-sheet'), d, () => { const nd = DCS.I.by.get(d.id); if (nd && !nd.deleted) dcDeviceSheet(nd, after); else { m.close(); after && after(); } });
}
function dcViewDevice(v, id){
  const render = () => {
    const d = DCS.I.by.get(id);
    if (!d || d.deleted || d.kind !== 'device'){ v.innerHTML = `<div class="card"><b>Equipo no encontrado</b>${dcBack('Data center', dcHash(DCS.site))}</div>`; return; }
    const rack = dcRackOf(d);
    v.innerHTML = `${dcTopBar(dcBack(rack ? rack.data.name : DCS.I.dc.data.name, rack ? dcHash(DCS.site, 'rack', rack.id) : dcHash(DCS.site)))}<div class="card" id="dv-page">${dcDevicePanelHTML(d)}</div>`;
    dcBindTop(v);
    dcBindDevicePanel($('#dv-page'), d, render);
  };
  DCS.render = render; render();
}

/* ---------- fotos ---------- */
const dcBlobURL = new Map();
async function hydrateDC(scope){
  const imgs = [...scope.querySelectorAll('img[data-dcph]')]; if (!imgs.length) return;
  const need = [];
  for (const im of imgs){
    const p = im.dataset.dcph; if (dcBlobURL.has(p)){ im.src = dcBlobURL.get(p); continue; }
    const b = await DCDB.get('blob', p).catch(() => null);
    if (b){ const u = URL.createObjectURL(b); dcBlobURL.set(p, u); im.src = u; } else need.push(im);
  }
  if (need.length && typeof photoURLs === 'function'){ const urls = await photoURLs(need.map(i => i.dataset.dcph)); need.forEach((im, k) => { if (urls[k]) im.src = urls[k]; else im.alt = 'Foto disponible con conexión'; }); }
}
async function dcAddPhoto(obj, file){
  try {
    if (!/^image\//.test(file.type || '')) return toast('Elegí una imagen.');
    const blob = await compressImage(file, 1600, 0.78);
    if (!blob || blob.size > 6e6) return toast('La foto es demasiado grande.');
    const path = `${me.org_id}/dc/${DCS.site}/${uid()}.jpg`;
    await DCDB.put('blob', blob, path);
    const photos = (obj.data.photos || []).concat([{ path, at: new Date().toISOString(), by: dcWho() }]).slice(-20);
    await dcSave(obj.kind, obj.id, { ...obj.data, photos }); dcReindex(); toast('Foto guardada');
  } catch (e){ toast(errText(e)); }
}

/* ---------- alta / edición de equipo ---------- */
function dcModelLabel(m){ return m ? `${m.maker ? m.maker + ' ' : ''}${m.name}` : '—'; }
function dcModelSearch(q, roleFilter){
  const n = dcNorm(q);
  return DCS.models.filter(m => (!roleFilter || m.role === roleFilter) && (!n || dcNorm(dcModelLabel(m) + ' ' + (DC_ROLE[m.role]?.n || '')).includes(n))).slice(0, 40);
}
function dcEditDevice(dev, preset = {}){
  const I = DCS.I, d = dev ? { ...dev.data } : { rack: preset.rack || '', u: preset.u || '', face: preset.face || 'both', status: 'activo' };
  let model = dcModel(d.model) || null;
  let role = d.role || model?.role || preset.role || 'otro';
  let h = d.h ?? model?.u ?? 1;
  const pdus = rid => (I.devByRack.get(rid) || []).filter(x => dcDevRole(x) === 'pdu' && x.id !== dev?.id);
  const m = modal(`<h2>${dev ? (preset.identify ? 'Identificar equipo' : 'Editar equipo') : 'Agregar al rack'}</h2>
    <label>Modelo</label>
    <div class="row" style="gap:6px"><input id="de-q" placeholder="Buscá: Nexus, R650, panel fibra, ciego…" value="${esc(model ? dcModelLabel(model) : '')}" class="grow" autocomplete="off"><button class="btn sec small" id="de-newm" type="button">+ Modelo</button></div>
    <div id="de-ml" class="dc-list" style="max-height:220px;overflow:auto;margin-top:6px"></div>
    <div class="row"><div class="grow"><label>Nombre / hostname</label><input id="de-n" maxlength="120" value="${esc(d.name || '')}" placeholder="Ej.: C3-DESX-01"></div>
      <div class="grow"><label>Rol</label><select id="de-r">${Object.entries(DC_ROLE).map(([k, R]) => `<option value="${k}" ${role === k ? 'selected' : ''}>${R.n}</option>`).join('')}</select></div></div>
    <div class="row"><div class="grow"><label>Rack</label><select id="de-k"><option value="">— Fuera de rack —</option>${I.racks.map(r => `<option value="${esc(r.id)}" ${d.rack === r.id ? 'selected' : ''}>${esc(r.data.name)}</option>`).join('')}</select></div>
      <div><label>U (la más baja)</label><input id="de-u" type="number" min="0" max="60" value="${esc(d.u ?? '')}" style="width:110px" placeholder="0 = lateral"></div>
      <div><label>Altura</label><div class="dc-step"><button type="button" id="de-hm">−</button><b id="de-hv">${dcNum(h, 1)} U</b><button type="button" id="de-hp">+</button></div></div></div>
    <p class="sm muted" id="de-occ" style="margin:6px 0 0"></p>
    <div class="row"><div class="grow"><label>Montaje</label><select id="de-f"><option value="both" ${(d.face || 'both') === 'both' ? 'selected' : ''}>Ocupa frente y fondo</option><option value="front" ${d.face === 'front' ? 'selected' : ''}>Solo frente</option><option value="rear" ${d.face === 'rear' ? 'selected' : ''}>Solo trasera</option></select></div>
      <div class="grow"><label>Estado</label><select id="de-s">${Object.entries(DC_STATUS).map(([k, n]) => `<option value="${k}" ${(d.status || 'activo') === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div></div>
    <div class="row"><div class="grow"><label>N° de serie</label><input id="de-sn" maxlength="80" value="${esc(d.serial || '')}"></div><div class="grow"><label>Activo fijo</label><input id="de-as" maxlength="80" value="${esc(d.asset || '')}"></div></div>
    <div class="row"><div class="grow"><label>Consumo (W)</label><input id="de-w" type="number" min="0" max="50000" value="${esc(d.power_w ?? '')}" placeholder="${esc(model?.power_w ? 'típico ' + model.power_w : '')}"></div>
      <div class="grow"><label>PDU lado A</label><select id="de-pa"></select></div><div class="grow"><label>PDU lado B</label><select id="de-pb"></select></div></div>
    <div id="de-pdu" class="row ${role === 'pdu' ? '' : 'hidden'}"><div class="grow"><label>Capacidad (A)</label><input id="de-ca" type="number" min="0" max="400" value="${esc(d.capacity_a ?? model?.capacity_a ?? 16)}"></div><div class="grow"><label>Tensión (V)</label><input id="de-vo" type="number" min="0" max="600" value="${esc(d.voltage ?? model?.voltage ?? 220)}"></div>
      <div class="grow"><label>Alimentada desde</label><select id="de-fd"><option value="">—</option>${I.power.map(p => `<option value="${esc(p.id)}" ${d.feed === p.id ? 'selected' : ''}>${esc(p.data.name)}</option>`).join('')}</select></div></div>
    <label>Notas</label><textarea id="de-o" maxlength="2000">${esc(d.notes || '')}</textarea>
    <div class="err" id="de-e"></div>
    <div class="row between" style="margin-top:12px">${dev ? '<button class="btn danger" id="de-d">Quitar</button>' : '<span></span>'}<div class="row"><button class="btn sec" id="de-x">Cancelar</button><button class="btn" id="de-g">Guardar</button></div></div>`, { wide: true });
  const fillPdu = () => { const rid = $('#de-k').value; const opts = `<option value="">—</option>` + pdus(rid).map(p => `<option value="${esc(p.id)}">${esc(dcDevName(p))}</option>`).join(''); $('#de-pa').innerHTML = opts; $('#de-pb').innerHTML = opts; $('#de-pa').value = d.pdu_a || ''; $('#de-pb').value = d.pdu_b || ''; };
  const occ = () => {
    const rid = $('#de-k').value, u = dcNum($('#de-u').value, 0), hh = dcNum(h, 1);
    $('#de-hv').textContent = hh + ' U';
    if (!rid || !u || !hh){ $('#de-occ').textContent = rid ? 'Sin U: queda como lateral / 0U (por ejemplo una PDU).' : 'Fuera de rack (equipo externo, radio, AP…).'; return true; }
    const r = I.by.get(rid), H = dcRackH(r);
    if (u + hh - 1 > H){ $('#de-occ').innerHTML = `<span style="color:var(--red)">No entra: el rack tiene ${H} U.</span>`; return false; }
    const hit = dcCollides(rid, u, hh, $('#de-f').value, dev?.id);
    if (hit){ $('#de-occ').innerHTML = `<span style="color:var(--red)">Choca con ${esc(dcDevName(hit))} (U${esc(hit.data.u)}).</span>`; return false; }
    $('#de-occ').innerHTML = `Ocupa <b>U${hh > 1 ? u + '–' + (u + hh - 1) : u}</b> de ${esc(r.data.name)}.`; return true;
  };
  const listModels = () => {
    const res = dcModelSearch($('#de-q').value === dcModelLabel(model) ? '' : $('#de-q').value);
    $('#de-ml').innerHTML = res.map(x => `<div class="dc-li" data-m="${esc(x.id)}" style="padding:7px 10px"><span class="sw" style="background:${DC_ROLE[x.role]?.c || '#999'}"></span><div class="grow"><b style="font-size:13px">${esc(dcModelLabel(x))}</b><div class="muted" style="font-size:12px">${esc(DC_ROLE[x.role]?.n || '')} · ${x.u} U · ${dcModelPorts(x).length} puertos${x.custom ? ' · de la empresa' : ''}</div></div>${model?.id === x.id ? '✓' : ''}</div>`).join('') || '<p class="muted sm" style="margin:6px">No hay modelos con ese nombre. Creá uno con <b>+ Modelo</b>.</p>';
    $('#de-ml').querySelectorAll('[data-m]').forEach(b => b.onclick = () => {
      model = dcModel(b.dataset.m); role = model.role; h = model.u;
      $('#de-q').value = dcModelLabel(model); $('#de-r').value = role; $('#de-pdu').classList.toggle('hidden', role !== 'pdu');
      if (!$('#de-n').value && ['ciego', 'ordenador', 'bandeja'].indexOf(role) < 0) $('#de-n').placeholder = model.name;
      if (dev?.data?.status === 'desconocido' || $('#de-s').value === 'desconocido') $('#de-s').value = 'activo';
      if (model.u === 0) $('#de-u').value = 0;
      $('#de-w').placeholder = model.power_w ? 'típico ' + model.power_w : '';
      listModels(); occ();
    });
  };
  $('#de-q').oninput = listModels; $('#de-q').onfocus = () => { if ($('#de-q').value === dcModelLabel(model)) $('#de-q').select(); };
  listModels(); fillPdu(); occ();
  $('#de-k').onchange = () => { fillPdu(); occ(); }; $('#de-u').oninput = occ; $('#de-f').onchange = occ;
  $('#de-r').onchange = () => { role = $('#de-r').value; $('#de-pdu').classList.toggle('hidden', role !== 'pdu'); };
  $('#de-hm').onclick = () => { h = Math.max(0, dcNum(h, 1) - 1); occ(); }; $('#de-hp').onclick = () => { h = Math.min(20, dcNum(h, 1) + 1); occ(); };
  $('#de-newm').onclick = () => dcEditModel(null, nm => { dcEditDevice(dev, { ...preset, _model: nm.id }); });
  if (preset._model){ model = dcModel(preset._model); if (model){ role = model.role; h = model.u; $('#de-q').value = dcModelLabel(model); $('#de-r').value = role; listModels(); occ(); } }
  $('#de-x').onclick = m.close;
  $('#de-d')?.addEventListener('click', async () => {
    const cables = DCS.I.cables.filter(c => c.data.a?.dev === dev.id || c.data.b?.dev === dev.id);
    const ok = confirm(`¿Quitar "${dcDevName(dev)}"?${cables.length ? `\nTambién se desconectan sus ${cables.length} cables.` : ''}\n\nQueda registrado en el historial.`);
    if (!ok) return;
    try { await dcSaveMany(cables.map(c => ({ kind: 'cable', id: c.id, data: c.data, deleted: true })).concat([{ kind: 'device', id: dev.id, data: dev.data, deleted: true }])); m.close(); dcReindex(); DCS.view.sel = null; dcRefresh(); toast('Equipo quitado'); }
    catch (e){ $('#de-e').textContent = errText(e); }
  });
  $('#de-g').onclick = async () => {
    if (!occ()) return;
    role = $('#de-r').value in DC_ROLE ? $('#de-r').value : 'otro';
    const rid = $('#de-k').value; const u = dcNum($('#de-u').value, 0);
    const pw = $('#de-w').value === '' ? null : dcClamp(dcNum($('#de-w').value, 0), 0, 50000);
    const data = { ...d, model: model?.id || null, role, h: dcNum(h, 1), name: dcTxt($('#de-n').value, 120), rack: DC_UUID.test(rid) ? rid : '', u: rid && u ? u : null, face: ['both', 'front', 'rear'].includes($('#de-f').value) ? $('#de-f').value : 'both',
      status: $('#de-s').value in DC_STATUS ? $('#de-s').value : 'activo', serial: dcTxt($('#de-sn').value, 80), asset: dcTxt($('#de-as').value, 80), power_w: pw,
      pdu_a: DC_UUID.test($('#de-pa').value) ? $('#de-pa').value : null, pdu_b: DC_UUID.test($('#de-pb').value) ? $('#de-pb').value : null, notes: dcTxt($('#de-o').value, 2000) };
    if (role === 'desconocido' && model && model.role !== 'desconocido') data.role = model.role;
    if (data.status === 'desconocido' && model && model.role !== 'desconocido') data.status = 'activo';
    if (role === 'pdu'){ data.capacity_a = dcClamp(dcNum($('#de-ca').value, 16), 0, 400); data.voltage = dcClamp(dcNum($('#de-vo').value, 220), 0, 600); data.feed = DC_UUID.test($('#de-fd').value) ? $('#de-fd').value : null; }
    if (!dev){ data.surveyed_by = dcWho(); data.surveyed_at = new Date().toISOString(); }
    try { const o = await dcSave('device', dev?.id, data); m.close(); dcReindex(); if (dcNum(o.data.u, 0) && /\/rack\//.test(location.hash)) DCS.view.sel = o.id; dcRefresh(); toast(dev ? 'Equipo actualizado' : 'Equipo agregado'); }
    catch (e){ $('#de-e').textContent = errText(e); }
  };
}
function dcAddPort(d, after){
  const m = modal(`<h2>Agregar puertos a ${esc(dcDevName(d))}</h2><p class="muted sm">Para puertos que el modelo no trae (placas adicionales, gestión, etc.).</p>
    <label>Nombres (uno por línea o rango "1-8", "Eth2/1-24")</label><textarea id="ap-n" placeholder="MGMT&#10;Eth2/1-8"></textarea>
    <label>Tipo</label><select id="ap-t">${Object.entries(DC_PORT_TY).map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select>
    <div class="err" id="ap-e"></div><div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn sec" id="ap-x">Cancelar</button><button class="btn" id="ap-g">Agregar</button></div>`);
  $('#ap-x').onclick = m.close;
  $('#ap-g').onclick = async () => {
    const names = [];
    for (const line of $('#ap-n').value.split(/\n|,/).map(s => dcTxt(s, 40)).filter(Boolean)){
      const mm = line.match(/^(.*?)(\d+)\s*-\s*(\d+)$/);
      if (mm){ const a = Number(mm[2]), b = Number(mm[3]); if (b >= a && b - a < 200) for (let i = a; i <= b; i++) names.push(mm[1] + i); }
      else names.push(line);
    }
    if (!names.length) return ($('#ap-e').textContent = 'Escribí al menos un nombre.');
    const ty = $('#ap-t').value in DC_PORT_TY ? $('#ap-t').value : 'otro';
    const have = new Set(dcPorts(d).map(p => p.n));
    const extra = (d.data.extra_ports || []).concat(names.filter(n => !have.has(n)).map(n => ({ n, ty }))).slice(0, 400);
    try { await dcSave('device', d.id, { ...d.data, extra_ports: extra }); m.close(); dcReindex(); after && after(); } catch (e){ $('#ap-e').textContent = errText(e); }
  };
}

/* =====================================================================
   PUERTO: recorrido, conectar, desconectar
   ===================================================================== */
function dcTraceHTML(start){
  const tr = dcTrace(start), I = DCS.I;
  const node = n => { const d = I.by.get(n.p.dev), r = dcRackOf(d), R = DC_ROLE[dcDevRole(d)];
    return `<div class="dc-tn ${n.start ? 'st' : ''}" data-go="${esc(n.p.dev)}|${esc(n.p.port)}|${esc(n.p.side || '')}" style="border-left:5px solid ${R.c}"><div class="rk">${esc(r ? r.data.name : 'Fuera de rack')}${d?.data?.u ? ' · U' + esc(d.data.u) : ''}</div><div class="nm">${esc(dcDevName(d))}</div>
      <span class="pt">${esc(n.p.port)}</span>${n.pass && !n.start ? ' <span class="sm muted">pasa por el panel</span>' : n.p.side ? ` <span class="sm muted">${n.p.side === 'F' ? 'frente' : 'trasera'}</span>` : ''}</div>`; };
  const link = c => { const ct = DC_CABLE[c.data.type] || DC_CABLE.otro;
    return `<div class="dc-tl ${c.data.status === 'falla' ? 'fail' : c.data.status === 'planificado' ? 'plan' : ''}"><i style="background:${ct.c}"></i><small>${esc([ct.n, c.data.length_m ? c.data.length_m + ' m' : '', c.data.label].filter(Boolean).join(' · '))}${c.data.status === 'falla' ? '<br><b style="color:#DC2626">EN FALLA</b>' : c.data.status === 'planificado' ? '<br><b style="color:#B7791F">planificado</b>' : ''}</small></div>`; };
  let h = '<div class="dc-trace">' + tr.nodes.map(n => n.t === 'n' ? node(n) : link(n.cable)).join('');
  if (tr.circ) h += `<div class="dc-tl"><i style="background:#0F766E"></i><small>carrier</small></div><div class="dc-circ"><div style="font-size:11px;opacity:.85">CIRCUITO</div><b>${esc(tr.circ.data.provider || 'Carrier')}</b><div class="sm">${esc([tr.circ.data.cid, tr.circ.data.bw].filter(Boolean).join(' · '))}</div></div>`;
  h += '</div>';
  const ends = tr.nodes.filter(n => n.t === 'n');
  const sum = tr.hops ? `<p class="sm muted" style="margin:0">${tr.hops} tramo${tr.hops === 1 ? '' : 's'} · de <b>${esc(dcDevName(I.by.get(ends[0].p.dev)))}</b> a <b>${esc(dcDevName(I.by.get(ends[ends.length - 1].p.dev)))}</b></p>` : '';
  return { html: h, sum, tr };
}
function dcPortSheet(ep, after){
  const I = DCS.I, d = I.by.get(ep.dev); if (!d) return;
  const w = dcCanW(), at = I.cableAt.get(dcEK(ep)), c = at?.cable, circ = I.circAt.get(dcEK(ep));
  const r = dcRackOf(d), t = dcTraceHTML(ep);
  const pm = (d.data.pm || {})[ep.port + (ep.side ? '|' + ep.side : '')] || {};
  const vl = dcNet() && I.vlans.length;
  const m = modal(`<div class="row between" style="align-items:flex-start"><div><div class="muted sm">${esc(r ? r.data.name : 'Fuera de rack')} · U${esc(d.data.u ?? '–')} · ${esc(dcDevName(d))}</div>
      <h2 style="margin:2px 0 0">Puerto ${esc(ep.port)}${ep.side ? ` <span class="muted" style="font-weight:400">· ${ep.side === 'F' ? 'frente' : 'trasera'}</span>` : ''}</h2></div>
      <span class="pill ${c ? (c.data.status === 'falla' ? 'p-bad' : c.data.status === 'planificado' ? 'p-pend' : 'p-ok') : 'p-info'}">${c ? esc(DC_CABLE_ST[c.data.status] || 'Conectado') : 'Libre'}</span></div>
    <h3 style="margin:14px 0 4px">Recorrido punta a punta</h3>${t.sum}${t.html}
    ${c ? `<dl class="dc-kv" style="margin:6px 0 4px"><dt>Cable</dt><dd>${esc((DC_CABLE[c.data.type] || DC_CABLE.otro).n)}${c.data.color && dcColorOf(c.data.color) ? ` · <i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${dcColorOf(c.data.color)};border:1px solid #999"></i> ${esc(c.data.color)}` : ''}${c.data.length_m ? ' · ' + esc(c.data.length_m) + ' m' : ''}</dd>${c.data.label ? `<dt>Etiqueta</dt><dd>${esc(c.data.label)}</dd>` : ''}<dt>Otro extremo</dt><dd>${esc(dcEndTxt(c.data[at.end === 'a' ? 'b' : 'a']))}</dd>${c.data.notes ? `<dt>Notas</dt><dd>${esc(c.data.notes)}</dd>` : ''}</dl>` : '<p class="muted sm" style="margin:4px 0">Este puerto está libre.</p>'}
    ${circ ? `<div class="banner trial" style="margin-top:8px"><span class="dot" style="background:#0F766E"></span><div><b>Circuito ${esc(circ.data.provider || '')} ${esc(circ.data.cid || '')}</b><div class="sm">${esc([circ.data.type, circ.data.bw, circ.data.noc && 'NOC ' + circ.data.noc].filter(Boolean).join(' · '))}</div></div></div>` : ''}
    ${w ? `<div class="row" style="gap:6px;margin-top:6px"><div class="grow"><label style="margin-top:4px">Descripción del puerto</label><input id="ps-desc" maxlength="120" value="${esc(pm.desc || '')}" placeholder="Ej.: uplink a core, iLO, etc."></div>${vl ? `<div><label style="margin-top:4px">VLAN</label><select id="ps-vlan" style="width:140px"><option value="">—</option>${I.vlans.map(x => `<option value="${esc(x.id)}" ${pm.vlan === x.id ? 'selected' : ''}>${esc(x.data.vid)} ${esc(x.data.name || '')}</option>`).join('')}</select></div>` : ''}</div>` : (pm.desc ? `<p class="sm">${esc(pm.desc)}</p>` : '')}
    <div class="err" id="ps-e"></div>
    <div class="row between" style="margin-top:14px;gap:6px"><div class="row" style="gap:6px">
      ${w && !c ? '<button class="btn" id="ps-con">🔗 Conectar</button>' : ''}
      ${w && c ? `<button class="btn sec" id="ps-ed">✏️ Cable</button><button class="btn sec" id="ps-fl">${c.data.status === 'falla' ? '✅ Funciona' : '⚠️ Marcar falla'}</button><button class="btn danger" id="ps-dis">Desconectar</button>` : ''}
      ${c ? '<button class="btn sec" id="ps-oth">↔ Ver el otro extremo</button>' : ''}</div>
      <button class="btn sec" id="ps-x">Cerrar</button></div>`, { wide: true });
  const saveMeta = async () => {
    if (!w) return; const desc = dcTxt($('#ps-desc')?.value, 120), vlan = $('#ps-vlan')?.value || '';
    if ((pm.desc || '') === desc && (pm.vlan || '') === vlan) return;
    const key = ep.port + (ep.side ? '|' + ep.side : ''); const all = { ...(d.data.pm || {}) };
    if (desc || vlan) all[key] = { desc, vlan: DC_UUID.test(vlan) ? vlan : '' }; else delete all[key];
    await dcSave('device', d.id, { ...d.data, pm: all }).catch(() => {}); dcReindex();
  };
  const close = async () => { await saveMeta(); m.close(); after && after(); };
  $('#ps-x').onclick = close;
  m.el.querySelectorAll('[data-go]').forEach(b => b.onclick = async () => { const [dev, port, side] = b.dataset.go.split('|'); await saveMeta(); dcPortSheet({ dev, port, side }, after); });
  $('#ps-con')?.addEventListener('click', async () => { await saveMeta(); dcConnect(ep, null, after); });
  $('#ps-ed')?.addEventListener('click', () => dcConnect(ep, c, after));
  $('#ps-oth')?.addEventListener('click', () => { const o = c.data[at.end === 'a' ? 'b' : 'a']; dcPortSheet(o, after); });
  $('#ps-fl')?.addEventListener('click', async () => { try { await dcSave('cable', c.id, { ...c.data, status: c.data.status === 'falla' ? 'conectado' : 'falla' }); dcReindex(); dcPortSheet(ep, after); } catch (e){ $('#ps-e').textContent = errText(e); } });
  $('#ps-dis')?.addEventListener('click', async () => {
    if (!confirm(`¿Desconectar ${ep.port} de ${dcDevName(d)}?\nQueda registrado en el historial.`)) return;
    try { await dcSave('cable', c.id, c.data, { deleted: true }); dcReindex(); toast('Desconectado'); m.close(); after && after(); } catch (e){ $('#ps-e').textContent = errText(e); }
  });
}
/* Elegir un extremo: rack → equipo → puerto (sirve para conectar, circuitos e IP) */
function dcPickerHTML(st, o = {}){
  const I = DCS.I;
  const racks = [{ id: '', data: { name: 'Fuera de rack' } }].concat(I.racks);
  const q = dcNorm(st.q || '');
  let devs = (I.devByRack.get(st.rack ?? '') || []).filter(d => !['ciego', 'ordenador', 'bandeja'].includes(dcDevRole(d)) && d.data.status !== 'retirado');
  if (q) devs = I.devices.filter(d => dcNorm(dcDevName(d) + ' ' + (d.data.serial || '') + ' ' + dcModelLabel(dcDevModel(d))).includes(q) && !['ciego', 'ordenador'].includes(dcDevRole(d))).slice(0, 60);
  const dev = st.dev && I.by.get(st.dev);
  return `<div class="row" style="gap:6px"><input id="pk-q" placeholder="🔍 Buscar equipo en todo el data center" value="${esc(st.q || '')}" class="grow" autocomplete="off"></div>
    ${q ? '' : `<div class="dc-chips" style="margin:8px 0;max-height:96px;overflow:auto">${racks.map(r => `<button class="dc-chip ${(st.rack ?? '') === r.id ? 'on' : ''}" data-pr="${esc(r.id)}">${esc(r.data.name)}</button>`).join('')}</div>`}
    <div class="dc-list" style="max-height:${dev ? '150px' : '300px'};overflow:auto;margin-top:6px">${devs.length ? devs.map(d => { const R = DC_ROLE[dcDevRole(d)], pu = dcPortUse(d), r = dcRackOf(d);
      return `<div class="dc-li ${st.dev === d.id ? 'on' : ''}" data-pd="${esc(d.id)}" style="padding:7px 10px;${st.dev === d.id ? 'border-color:var(--green);background:#E7F7F0' : ''}"><span class="sw" style="background:${R.c}"></span><div class="grow" style="min-width:0"><b style="font-size:13px">${esc(dcDevName(d))}</b><div class="muted" style="font-size:12px">${q && r ? esc(r.data.name) + ' · ' : ''}${d.data.u ? 'U' + esc(d.data.u) + ' · ' : ''}${esc(R.n)}</div></div><span class="sm muted">${pu.total - pu.used} libres</span></div>`; }).join('') : '<p class="muted sm" style="margin:6px">No hay equipos con puertos acá.</p>'}</div>
    ${o.allowNewExt ? '<button class="link" id="pk-ext" style="margin-top:6px">+ Crear equipo fuera del rack (radio, AP, cámara, carrier…)</button>' : ''}
    ${dev ? `<div style="margin-top:8px">${dcIsPanel(dev) ? `<div class="dc-face" style="margin-bottom:4px"><button data-ps="F" class="${st.side === 'F' ? 'on' : ''}">Frente</button><button data-ps="R" class="${st.side === 'R' ? 'on' : ''}">Trasera</button></div>` : ''}${dcFaceplateHTML(dev, { picker: true, side: dcIsPanel(dev) ? st.side : undefined, allow: o.allowCable, hit: st.port ? { port: st.port, side: dcIsPanel(dev) ? st.side : '' } : null })}</div>` : ''}`;
}
function dcBindPicker(scope, st, rerender, o = {}){
  const q = scope.querySelector('#pk-q'); if (q){ q.oninput = () => { st.q = q.value; rerender(true); }; if (o.focusQ) { q.focus(); const l = q.value.length; q.setSelectionRange(l, l); } }
  scope.querySelectorAll('[data-pr]').forEach(b => b.onclick = () => { st.rack = b.dataset.pr; st.dev = null; st.port = null; rerender(); });
  scope.querySelectorAll('[data-pd]').forEach(b => b.onclick = () => { st.dev = b.dataset.pd; st.port = null; const d = DCS.I.by.get(st.dev); st.rack = d.data.rack || ''; st.side = dcIsPanel(d) ? (st.side || 'F') : ''; rerender(); });
  scope.querySelectorAll('[data-ps]').forEach(b => b.onclick = () => { st.side = b.dataset.ps; st.port = null; rerender(); });
  scope.querySelectorAll('[data-port]').forEach(b => b.onclick = () => { if (b.disabled) return; st.port = b.dataset.port; rerender(); });
  scope.querySelector('#pk-ext')?.addEventListener('click', () => o.onNewExt && o.onNewExt());
}
function dcGuessCable(a, b){
  const ty = e => { const d = DCS.I.by.get(e.dev); return d ? (dcPorts(d).find(p => p.n === e.port)?.ty || '') : ''; };
  const t1 = DC_PORT_CABLE[ty(a)], t2 = DC_PORT_CABLE[ty(b)];
  if (t1 === 'power' || t2 === 'power') return 'power';
  if (t1 === 'fibra_sm' || t2 === 'fibra_sm') return 'fibra_sm';
  if (t1 === 'fc' || t2 === 'fc') return 'fc';
  if (t1 === 'utp' && t2 === 'utp') return 'utp';
  return t2 || t1 || 'utp';
}
function dcAutoLabel(a, b){
  const s = e => { const d = DCS.I.by.get(e.dev), r = dcRackOf(d); return `${r ? String(r.data.name).replace(/^rack\s*/i, 'R') : 'EXT'}-U${d?.data?.u ?? 0}-${e.port}${e.side === 'R' ? 'T' : ''}`; };
  return `${s(a)} / ${s(b)}`.slice(0, 80);
}
function dcConnect(from, cable, after){
  const I = DCS.I, fd = I.by.get(from.dev);
  const other = cable ? cable.data[cable.data.a && dcEK(cable.data.a) === dcEK(from) ? 'b' : 'a'] : null;
  const st = { rack: other ? (I.by.get(other.dev)?.data.rack || '') : (fd.data.rack || ''), dev: other?.dev || null, port: other?.port || null, side: other?.side || (dcIsPanel(fd) && from.side === 'R' ? 'R' : 'F'), q: '' };
  const cd = cable ? { ...cable.data } : { status: 'conectado' };
  const m = modal(`<div id="cn-body"></div>`, { wide: true });
  const render = (keepFocus) => {
    const to = st.dev && st.port ? { dev: st.dev, port: st.port, side: dcIsPanel(I.by.get(st.dev)) ? st.side : '' } : null;
    const type = cd.type || (to ? dcGuessCable(from, to) : 'utp');
    $('#cn-body').innerHTML = `<h2>${cable ? 'Editar conexión' : 'Conectar puerto'}</h2>
      <div class="banner trial" style="margin-bottom:10px"><span class="dot"></span><div><b>Desde:</b> ${esc(dcEndTxt(from))}<br><b>Hasta:</b> ${to ? esc(dcEndTxt(to)) : '<span class="muted">elegí rack → equipo → puerto</span>'}</div></div>
      ${dcPickerHTML(st, { allowCable: cable?.id, allowNewExt: true })}
      ${to ? `<div class="row" style="margin-top:6px"><div class="grow"><label>Tipo de cable</label><select id="cn-t">${Object.entries(DC_CABLE).map(([k, c]) => `<option value="${k}" ${type === k ? 'selected' : ''}>${c.n}</option>`).join('')}</select></div>
        <div class="grow"><label>Color</label><select id="cn-c">${Object.keys(DC_COLORS).map(k => `<option value="${k}" ${(cd.color || '') === k ? 'selected' : ''}>${k ? k[0].toUpperCase() + k.slice(1) : 'Sin color'}</option>`).join('')}</select></div>
        <div style="width:110px"><label>Largo (m)</label><input id="cn-l" type="number" min="0" max="5000" step="0.5" value="${esc(cd.length_m ?? '')}"></div></div>
        <div class="row"><div class="grow"><label>Etiqueta</label><input id="cn-lb" maxlength="80" value="${esc(cd.label ?? dcAutoLabel(from, to))}"></div><div class="grow"><label>Estado</label><select id="cn-s">${Object.entries(DC_CABLE_ST).map(([k, n]) => `<option value="${k}" ${(cd.status || 'conectado') === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div></div>
        <label>Notas</label><input id="cn-o" maxlength="300" value="${esc(cd.notes || '')}">` : ''}
      <div class="err" id="cn-e"></div>
      <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn sec" id="cn-x">Cancelar</button>${to ? '<button class="btn" id="cn-g">Guardar conexión</button>' : ''}</div>`;
    dcBindPicker(m.el, st, render, { focusQ: keepFocus, onNewExt: () => dcQuickExternal(st.rack, nd => { st.dev = nd.id; st.rack = nd.data.rack || ''; st.port = null; render(); }) });
    const keep = () => { const g = id => m.el.querySelector(id); if (!g('#cn-t')) return; cd.type = g('#cn-t').value; cd.color = g('#cn-c').value; cd.length_m = g('#cn-l').value; cd.label = g('#cn-lb').value; cd.status = g('#cn-s').value; cd.notes = g('#cn-o').value; };
    m.el.querySelectorAll('#cn-t,#cn-c,#cn-l,#cn-lb,#cn-s,#cn-o').forEach(x => x.onchange = keep);
    $('#cn-x').onclick = () => { m.close(); dcPortSheet(from, after); };
    $('#cn-g')?.addEventListener('click', async () => {
      keep();
      if (dcEK(from) === dcEK(to)) return ($('#cn-e').textContent = 'No se puede conectar un puerto consigo mismo.');
      const busy = I.cableAt.get(dcEK(to)); if (busy && busy.cable.id !== cable?.id) return ($('#cn-e').textContent = 'Ese puerto ya está ocupado.');
      const busyA = I.cableAt.get(dcEK(from)); if (busyA && busyA.cable.id !== cable?.id) return ($('#cn-e').textContent = 'El puerto de origen ya tiene un cable.');
      const data = { a: { ...from }, b: { ...to }, type: cd.type in DC_CABLE ? cd.type : 'otro', color: cd.color in DC_COLORS ? cd.color : '', length_m: cd.length_m === '' || cd.length_m === undefined ? null : dcClamp(dcNum(cd.length_m, 0), 0, 5000), label: dcTxt(cd.label, 80), status: cd.status in DC_CABLE_ST ? cd.status : 'conectado', notes: dcTxt(cd.notes, 300) };
      if (!data.a.side) delete data.a.side; if (!data.b.side) delete data.b.side;
      try { await dcSave('cable', cable?.id, data); dcReindex(); m.close(); toast('Conexión guardada'); dcPortSheet(from, after); }
      catch (e){ $('#cn-e').textContent = errText(e); }
    });
  };
  render();
}
function dcQuickExternal(rackId, done){
  const m = modal(`<h2>Equipo fuera del rack</h2><p class="muted sm">Para radios, AP, cámaras, módems de carrier o cualquier destino que no está montado en un rack.</p>
    <label>Nombre *</label><input id="qe-n" maxlength="120" placeholder="Ej.: Radio Yrigoyen">
    <label>Asociado al rack (opcional)</label><select id="qe-r"><option value="">— Ninguno —</option>${DCS.I.racks.map(r => `<option value="${esc(r.id)}" ${rackId === r.id ? 'selected' : ''}>${esc(r.data.name)}</option>`).join('')}</select>
    <label>Rol</label><select id="qe-k">${['externo', 'carrier', 'switch', 'router', 'server', 'pdu', 'otro'].map(k => `<option value="${k}">${DC_ROLE[k].n}</option>`).join('')}</select>
    <div class="err" id="qe-e"></div><div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn sec" id="qe-x">Cancelar</button><button class="btn" id="qe-g">Crear</button></div>`);
  $('#qe-x').onclick = m.close;
  $('#qe-g').onclick = async () => {
    const name = dcTxt($('#qe-n').value, 120); if (!name) return ($('#qe-e').textContent = 'Poné un nombre.');
    const role = $('#qe-k').value in DC_ROLE ? $('#qe-k').value : 'externo';
    try { const o = await dcSave('device', null, { name, role, model: role === 'pdu' ? 'g-pdu' : 'g-ext', h: 0, u: null, rack: DC_UUID.test($('#qe-r').value) ? $('#qe-r').value : '', status: 'activo', face: 'both' }); dcReindex(); m.close(); done(o); }
    catch (e){ $('#qe-e').textContent = errText(e); }
  };
}
/* troncal: conecta en serie los puertos de un panel con los de otro (cara trasera) */
function dcTrunkModal(panel, after){
  const I = DCS.I; const st = { rack: '', dev: null, port: null, side: 'R', q: '' };
  const m = modal(`<div id="tk-b"></div>`, { wide: true });
  const render = keepFocus => {
    const dest = st.dev && I.by.get(st.dev);
    $('#tk-b').innerHTML = `<h2>Troncal desde ${esc(dcDevName(panel))}</h2><p class="muted sm">Conecta de una vez los puertos de este panel con los de otro panel (por ejemplo 24 fibras entre racks). Los puertos ocupados se saltean.</p>
      ${dcPickerHTML({ ...st, port: null }, {})}
      ${dest ? `<div class="row"><div><label>Desde puerto</label><input id="tk-a" type="number" min="1" value="1" style="width:100px"></div><div><label>Al puerto</label><input id="tk-b2" type="number" min="1" value="1" style="width:100px"></div><div><label>Cantidad</label><input id="tk-n" type="number" min="1" max="96" value="${Math.min(dcPorts(panel).length, dcPorts(dest).length)}" style="width:100px"></div>
        <div class="grow"><label>Cara</label><select id="tk-s"><option value="R">Trasera ↔ trasera</option><option value="F">Frente ↔ frente</option></select></div>
        <div class="grow"><label>Tipo</label><select id="tk-t">${['fibra_mm', 'fibra_sm', 'utp', 'otro'].map(k => `<option value="${k}" ${dcGuessCable({ dev: panel.id, port: dcPorts(panel)[0]?.n }, { dev: dest.id, port: dcPorts(dest)[0]?.n }) === k ? 'selected' : ''}>${DC_CABLE[k].n}</option>`).join('')}</select></div></div>` : ''}
      <div class="err" id="tk-e"></div><div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn sec" id="tk-x">Cancelar</button>${dest ? '<button class="btn" id="tk-g">Crear troncal</button>' : ''}</div>`;
    dcBindPicker(m.el, st, render, { focusQ: keepFocus });
    $('#tk-x').onclick = () => { m.close(); after && after(); };
    $('#tk-g')?.addEventListener('click', async () => {
      if (dest.id === panel.id) return ($('#tk-e').textContent = 'Elegí otro panel.');
      const pa = dcPorts(panel), pb = dcPorts(dest), a0 = dcNum($('#tk-a').value, 1) - 1, b0 = dcNum($('#tk-b2').value, 1) - 1, n = dcClamp(dcNum($('#tk-n').value, 1), 1, 96), side = $('#tk-s').value === 'F' ? 'F' : 'R';
      const type = $('#tk-t').value in DC_CABLE ? $('#tk-t').value : 'otro';
      const items = []; let skip = 0;
      for (let i = 0; i < n; i++){
        const A = pa[a0 + i], B = pb[b0 + i]; if (!A || !B) break;
        const ea = { dev: panel.id, port: A.n, side: dcIsPanel(panel) ? side : undefined }, eb = { dev: dest.id, port: B.n, side: dcIsPanel(dest) ? side : undefined };
        if (!ea.side) delete ea.side; if (!eb.side) delete eb.side;
        if (I.cableAt.get(dcEK(ea)) || I.cableAt.get(dcEK(eb))){ skip++; continue; }
        items.push({ kind: 'cable', data: { a: ea, b: eb, type, status: 'conectado', label: dcAutoLabel(ea, eb), color: '' } });
      }
      if (!items.length) return ($('#tk-e').textContent = 'No hay puertos libres en ese rango.');
      try { await dcSaveMany(items); dcReindex(); m.close(); toast(`Troncal creada: ${items.length} conexiones${skip ? ` (${skip} ocupadas salteadas)` : ''}`); after && after(); }
      catch (e){ $('#tk-e').textContent = errText(e); }
    });
  };
  render();
}

/* =====================================================================
   PESTAÑAS: cableado, energía, carriers, IP/VLAN, pendientes, historial
   ===================================================================== */
function dcTabCables(box){
  const I = DCS.I, f = DCS.view.cf || { t: '', q: '', st: '' };
  const q = dcNorm(f.q);
  const rows = I.cables.filter(c => (!f.t || c.data.type === f.t) && (!f.st || (c.data.status || 'conectado') === f.st) && (!q || dcNorm(dcEndTxt(c.data.a) + ' ' + dcEndTxt(c.data.b) + ' ' + (c.data.label || '')).includes(q)));
  // troncales entre racks
  const pairs = new Map();
  for (const c of I.cables){
    const ra = dcRackOf(I.by.get(c.data.a?.dev)), rb = dcRackOf(I.by.get(c.data.b?.dev)); if (!ra || !rb || ra.id === rb.id) continue;
    const [x, y] = [ra, rb].sort((m, n) => dcNat(m.data.name, n.data.name)); const k = x.id + '|' + y.id;
    if (!pairs.has(k)) pairs.set(k, { a: x, b: y, n: 0, t: {} }); const p = pairs.get(k); p.n++; p.t[c.data.type] = (p.t[c.data.type] || 0) + 1;
  }
  const pl = [...pairs.values()].sort((a, b) => b.n - a.n); const maxN = Math.max(1, ...pl.map(p => p.n));
  const types = Object.keys(DC_CABLE).filter(k => I.cables.some(c => c.data.type === k));
  const lim = DCS.view.cLim || 200;
  box.innerHTML = `
    ${pl.length ? `<div class="card"><h3>Troncales entre racks</h3><div class="dc-list">${pl.slice(0, 30).map(p => `<div class="row" style="gap:10px"><span style="min-width:150px" class="sm"><b>${esc(p.a.data.name)}</b> ↔ <b>${esc(p.b.data.name)}</b></span><div class="grow" style="display:flex;height:14px;border-radius:99px;overflow:hidden;background:var(--line);max-width:${dcClamp(p.n / maxN * 100, 8, 100)}%">${Object.entries(p.t).map(([k, n]) => `<i style="display:block;flex:${n};background:${(DC_CABLE[k] || DC_CABLE.otro).c}" title="${esc((DC_CABLE[k] || DC_CABLE.otro).n)}: ${n}"></i>`).join('')}</div><b class="sm" style="min-width:28px;text-align:right">${p.n}</b></div>`).join('')}</div></div>` : ''}
    <div class="card"><div class="row" style="gap:8px;margin-bottom:10px"><input id="cb-q" class="grow" placeholder="🔍 Buscar por equipo, puerto, rack o etiqueta" value="${esc(f.q)}">
      <select id="cb-st" style="width:auto"><option value="">Todos los estados</option>${Object.entries(DC_CABLE_ST).map(([k, n]) => `<option value="${k}" ${f.st === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      <div class="dc-chips" style="margin-bottom:10px"><button class="dc-chip ${!f.t ? 'on' : ''}" data-t="">Todos (${I.cables.length})</button>${types.map(k => `<button class="dc-chip ${f.t === k ? 'on' : ''}" data-t="${k}"><i style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${DC_CABLE[k].c};margin-right:5px"></i>${DC_CABLE[k].n} (${I.cables.filter(c => c.data.type === k).length})</button>`).join('')}</div>
      ${rows.length ? `<div class="tblwrap"><table class="tbl"><thead><tr><th></th><th>Extremo A</th><th>Extremo B</th><th class="hide-sm">Etiqueta</th><th class="num hide-sm">Largo</th></tr></thead><tbody>
        ${rows.slice(0, lim).map(c => `<tr class="click" data-c="${esc(c.id)}"><td><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${(DC_CABLE[c.data.type] || DC_CABLE.otro).c}"></i>${c.data.status === 'falla' ? ' ⚠️' : c.data.status === 'planificado' ? ' 🕓' : ''}</td><td class="sm">${esc(dcEndTxt(c.data.a, true))}</td><td class="sm">${esc(dcEndTxt(c.data.b, true))}</td><td class="sm hide-sm">${esc(c.data.label || '')}</td><td class="num sm hide-sm">${c.data.length_m ? esc(c.data.length_m) + ' m' : ''}</td></tr>`).join('')}
      </tbody></table></div>${rows.length > lim ? `<button class="btn sec small" id="cb-more" style="margin-top:8px">Mostrar más (${rows.length - lim})</button>` : ''}` : '<div class="dc-empty"><span class="e">🔌</span>No hay conexiones con ese filtro. Se cargan tocando un puerto en el rack.</div>'}
    </div>`;
  const keep = () => { DCS.view.cf = { ...f, q: $('#cb-q').value, st: $('#cb-st').value }; };
  $('#cb-q').oninput = () => { keep(); clearTimeout(DCS.cbT); DCS.cbT = setTimeout(() => { dcTabCables(box); const i = $('#cb-q'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250); };
  $('#cb-st').onchange = () => { keep(); dcTabCables(box); };
  box.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { DCS.view.cf = { ...f, t: b.dataset.t }; dcTabCables(box); });
  box.querySelectorAll('[data-c]').forEach(tr => tr.onclick = () => { const c = I.by.get(tr.dataset.c); dcPortSheet(c.data.a, () => dcTabCables(box)); });
  $('#cb-more')?.addEventListener('click', () => { DCS.view.cLim = lim + 300; dcTabCables(box); });
}

/* ---------- energía ---------- */
function dcPduLoads(){
  const I = DCS.I, L = new Map();
  for (const p of I.devices.filter(d => dcDevRole(d) === 'pdu')) L.set(p.id, { pdu: p, normal: 0, worst: 0, devs: 0 });
  let noPdu = 0;
  for (const d of I.devices){
    const role = dcDevRole(d); if (['pdu', 'ciego', 'ordenador', 'bandeja', 'externo'].includes(role) || d.data.status === 'retirado') continue;
    const w = dcNum(d.data.power_w ?? dcDevModel(d)?.power_w, 0); const ps = [d.data.pdu_a, d.data.pdu_b].filter(x => x && L.has(x));
    if (!ps.length){ if (w) noPdu++; continue; }
    ps.forEach(x => { const l = L.get(x); l.normal += w / ps.length; l.worst += w; l.devs++; });
  }
  return { L, noPdu };
}
function dcTabPower(box){
  const I = DCS.I, w = dcCanW(), { L, noPdu } = dcPduLoads();
  const capOf = p => p.data.capacity_a ? dcNum(p.data.capacity_a, 0) * dcNum(p.data.voltage ?? 220, 220) : 0;
  const feeds = I.power.map(f => { const pd = [...L.values()].filter(l => l.pdu.data.feed === f.id); const load = pd.reduce((a, b) => a + b.normal, 0); return { f, pd, load, cap: dcNum(f.data.capacity_kw, 0) * 1000 }; });
  const loose = [...L.values()].filter(l => !l.pdu.data.feed || !I.by.get(l.pdu.data.feed));
  const pduRow = l => { const cap = capOf(l.pdu), pn = cap ? dcPct(l.normal, cap) : 0, pw = cap ? dcPct(l.worst, cap) : 0, r = dcRackOf(l.pdu);
    return `<div class="dc-li" data-pdu="${esc(l.pdu.id)}"><span class="sw" style="background:${dcHeat(pw)}"></span><div class="grow" style="min-width:0"><b style="font-size:13px">${esc(dcDevName(l.pdu))}</b><div class="muted" style="font-size:12px">${esc(r ? r.data.name : '')} · ${l.devs} equipos · ${cap ? (cap / 1000).toFixed(1).replace('.', ',') + ' kW' : 'sin capacidad'}</div>
      <div class="dc-meter" style="margin-top:4px"><span style="width:58px">normal</span>${dcBar(pn)}<span style="width:72px;text-align:right">${Math.round(l.normal)} W</span></div>
      <div class="dc-meter"><span style="width:58px">si cae B</span>${dcBar(pw)}<span style="width:72px;text-align:right;${pw > 100 ? 'color:var(--red);font-weight:700' : ''}">${Math.round(l.worst)} W</span></div></div></div>`; };
  box.innerHTML = `
    <div class="card"><div class="row between"><div><h3 style="margin:0">Alimentación</h3><p class="muted sm" style="margin:4px 0 0">UPS y tableros → PDU de cada rack → equipos. "Si cae B" muestra cuánto tendría que aguantar cada PDU si se corta el otro lado.</p></div>${w ? '<button class="btn small" id="pw-new">+ UPS / tablero</button>' : ''}</div>
      ${feeds.length ? `<div class="dc-grid" style="margin-top:12px">${feeds.map(x => { const p = x.cap ? dcPct(x.load, x.cap) : 0; return `<div class="dc-card" data-feed="${esc(x.f.id)}" style="cursor:${w ? 'pointer' : 'default'}"><div class="row between"><b>⚡ ${esc(x.f.data.name)}</b><span class="pill p-info">${esc(DC_FEED_KIND[x.f.data.type] || 'Fuente')}</span></div>
        <div class="row" style="gap:12px;margin-top:10px">${dcDonut(p, dcHeat(p), 56)}<div class="sm"><b style="font-size:18px">${(x.load / 1000).toFixed(2).replace('.', ',')} kW</b><br><span class="muted">de ${x.cap ? (x.cap / 1000).toFixed(1).replace('.', ',') + ' kW' : '— (cargá la capacidad)'} · ${x.pd.length} PDU</span></div></div></div>`; }).join('')}</div>` : '<p class="muted sm" style="margin-top:10px">Todavía no hay UPS ni tableros cargados.</p>'}
    </div>
    <div class="card"><div class="row between"><h3 style="margin:0">PDU</h3>${w && L.size ? '<button class="btn sec small" id="pw-auto">⚡ Asignar equipos a PDU A/B</button>' : ''}</div>
      ${(() => { const all = [...L.values()].sort((a, b) => dcNat(dcRackOf(a.pdu)?.data?.name, dcRackOf(b.pdu)?.data?.name)); const used = all.filter(l => l.devs), idle = all.filter(l => !l.devs);
        return !all.length ? '<p class="muted sm">No hay PDU cargadas. Se agregan en cada rack (+ Equipo → "PDU (0U, lateral)").</p>'
          : (used.length ? `<div class="dc-list" style="margin-top:10px">${used.map(pduRow).join('')}</div>` : '')
          + (idle.length ? `<div class="dc-face-lbl">Sin equipos asignados (${idle.length})</div><div class="dc-chips">${idle.map(l => `<button class="dc-chip" data-pdu="${esc(l.pdu.id)}">⚡ ${esc(dcDevName(l.pdu))}${capOf(l.pdu) ? '' : ' <span class="muted">· sin capacidad</span>'}</button>`).join('')}</div>` : ''); })()}
      ${loose.length && feeds.length ? `<p class="sm" style="color:var(--amber);margin:10px 0 0">${loose.length} PDU sin UPS/tablero asignado.</p>` : ''}
      ${noPdu ? `<p class="sm" style="color:var(--amber);margin:6px 0 0">${noPdu} equipos con consumo cargado no tienen PDU asignada.</p>` : ''}</div>
    <div class="card"><h3>Por rack</h3><div class="tblwrap"><table class="tbl"><thead><tr><th>Rack</th><th>Carga</th><th class="num">kW</th><th class="num hide-sm">Útil</th></tr></thead><tbody>
      ${I.racks.map(r => { const p = dcRackPower(r); return `<tr class="click" data-rk="${esc(r.id)}"><td><b>${esc(r.data.name)}</b></td><td style="min-width:120px">${p.cap ? dcBar(p.pct) : '<span class="muted sm">cargá la capacidad de las PDU</span>'}</td><td class="num">${(p.load / 1000).toFixed(2).replace('.', ',')}${p.est ? '<span class="muted" title="Incluye consumos típicos del modelo">*</span>' : ''}</td><td class="num hide-sm">${p.cap ? (p.cap / 1000).toFixed(1).replace('.', ',') : '—'}</td></tr>`; }).join('')}
    </tbody></table></div><p class="muted sm" style="margin:8px 0 0">* estimado con el consumo típico del modelo; cargá el consumo real en cada equipo para afinarlo.</p></div>`;
  $('#pw-auto')?.addEventListener('click', async () => {
    const items = [];
    for (const r of I.racks){
      const ps = (I.devByRack.get(r.id) || []).filter(d => dcDevRole(d) === 'pdu');
      const A = ps.find(p => /\ba\s*$|[^a-z]a$/i.test(dcDevName(p).trim())) || ps[0], B = ps.find(p => p !== A && /\bb\s*$|[^a-z]b$/i.test(dcDevName(p).trim())) || ps.find(p => p !== A);
      if (!A) continue;
      for (const d of (I.devByRack.get(r.id) || [])){ if (['pdu', 'ciego', 'ordenador', 'bandeja', 'externo'].includes(dcDevRole(d)) || d.data.pdu_a || d.data.pdu_b) continue; items.push({ kind: 'device', id: d.id, data: { ...d.data, pdu_a: A.id, pdu_b: B ? B.id : null } }); }
    }
    if (!items.length) return toast('No hay equipos sin PDU en racks con PDU.');
    if (!confirm(`Se asignan ${items.length} equipos a la PDU A y B de su rack (solo los que no tienen PDU). ¿Seguir?`)) return;
    try { await dcSaveMany(items); dcReindex(); dcTabPower(box); toast(`${items.length} equipos asignados`); } catch (e){ toast(errText(e)); }
  });
  $('#pw-new')?.addEventListener('click', () => dcEditFeed(null));
  box.querySelectorAll('[data-feed]').forEach(b => b.onclick = () => w && dcEditFeed(I.by.get(b.dataset.feed)));
  box.querySelectorAll('[data-pdu]').forEach(b => b.onclick = () => dcDeviceSheet(I.by.get(b.dataset.pdu), () => dcTabPower(box)));
  box.querySelectorAll('[data-rk]').forEach(b => b.onclick = () => dcGo(DCS.site, 'rack', b.dataset.rk));
}
function dcEditFeed(f){
  const d = f?.data || {};
  const m = modal(`<h2>${f ? 'Fuente de energía' : 'Nueva UPS / tablero'}</h2>
    <label>Nombre *</label><input id="fd-n" maxlength="80" value="${esc(d.name || '')}" placeholder="Ej.: UPS A 40 kVA">
    <div class="row"><div class="grow"><label>Tipo</label><select id="fd-t">${Object.entries(DC_FEED_KIND).map(([k, n]) => `<option value="${k}" ${d.type === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      <div class="grow"><label>Capacidad útil (kW)</label><input id="fd-c" type="number" min="0" max="10000" step="0.1" value="${esc(d.capacity_kw ?? '')}"></div>
      <div class="grow"><label>Autonomía (min)</label><input id="fd-a" type="number" min="0" max="10000" value="${esc(d.autonomy_min ?? '')}"></div></div>
    <label>Notas</label><textarea id="fd-o" maxlength="1000">${esc(d.notes || '')}</textarea>
    <div class="err" id="fd-e"></div><div class="row between" style="margin-top:12px">${f ? '<button class="btn danger" id="fd-d">Quitar</button>' : '<span></span>'}<div class="row"><button class="btn sec" id="fd-x">Cancelar</button><button class="btn" id="fd-g">Guardar</button></div></div>`);
  $('#fd-x').onclick = m.close;
  $('#fd-d')?.addEventListener('click', async () => { if (!confirm('¿Quitar esta fuente? Las PDU quedan sin asignar.')) return; try { await dcSave('power', f.id, f.data, { deleted: true }); m.close(); dcReindex(); dcRefresh(); } catch (e){ $('#fd-e').textContent = errText(e); } });
  $('#fd-g').onclick = async () => {
    const name = dcTxt($('#fd-n').value, 80); if (!name) return ($('#fd-e').textContent = 'Poné un nombre.');
    try { await dcSave('power', f?.id, { ...d, name, type: $('#fd-t').value in DC_FEED_KIND ? $('#fd-t').value : 'ups', capacity_kw: dcClamp(dcNum($('#fd-c').value, 0), 0, 10000), autonomy_min: dcClamp(dcNum($('#fd-a').value, 0), 0, 10000), notes: dcTxt($('#fd-o').value, 1000) }); m.close(); dcReindex(); dcRefresh(); }
    catch (e){ $('#fd-e').textContent = errText(e); }
  };
}

/* ---------- carriers ---------- */
function dcTabCarriers(box){
  const I = DCS.I, w = dcCanW();
  const initials = s => String(s || '?').split(/\s+/).map(x => x[0]).join('').slice(0, 3).toUpperCase();
  const hue = s => { let h = 0; for (const ch of String(s || '')) h = (h * 31 + ch.charCodeAt(0)) % 360; return h; };
  box.innerHTML = `<div class="card"><div class="row between"><div><h3 style="margin:0">Circuitos de carrier</h3><p class="muted sm" style="margin:4px 0 0">Cada enlace con su proveedor, número de servicio y dónde termina dentro del data center.</p></div>${w ? '<button class="btn small" id="ci-new">+ Circuito</button>' : ''}</div>
    ${I.circuits.length ? `<div class="dc-grid" style="margin-top:12px">${I.circuits.slice().sort((a, b) => dcNat(a.data.provider, b.data.provider)).map(c => `<div class="dc-card" data-ci="${esc(c.id)}"><div class="row" style="gap:10px;align-items:flex-start"><div style="width:42px;height:42px;border-radius:12px;display:grid;place-items:center;color:#fff;font-weight:800;background:hsl(${hue(c.data.provider)} 55% 38%)">${esc(initials(c.data.provider))}</div>
      <div class="grow" style="min-width:0"><b>${esc(c.data.provider || 'Proveedor')}</b><div class="muted sm">${esc([c.data.cid && 'Servicio ' + c.data.cid, c.data.type, c.data.bw].filter(Boolean).join(' · ') || 'Sin datos')}</div></div>
      <span class="pill ${c.data.status === 'baja' ? 'p-bad' : c.data.status === 'pendiente' ? 'p-pend' : 'p-ok'}">${esc({ activo: 'Activo', pendiente: 'Pendiente', baja: 'Baja' }[c.data.status] || 'Activo')}</span></div>
      <div class="sm" style="margin-top:10px">${c.data.a?.dev ? `📍 ${esc(dcEndTxt(c.data.a, true))}` : '<span class="muted">Sin terminación cargada</span>'}</div>
      ${c.data.noc ? `<div class="sm muted">NOC: ${esc(c.data.noc)}</div>` : ''}</div>`).join('')}</div>` : '<div class="dc-empty"><span class="e">📡</span>No hay circuitos cargados.</div>'}</div>`;
  $('#ci-new')?.addEventListener('click', () => dcEditCircuit(null));
  box.querySelectorAll('[data-ci]').forEach(b => b.onclick = () => { const c = I.by.get(b.dataset.ci); if (c.data.a?.dev && !w) dcPortSheet(c.data.a); else if (w) dcEditCircuit(c); });
}
function dcEditCircuit(c){
  const I = DCS.I, d = c ? { ...c.data } : { status: 'activo' };
  const st = { rack: d.a?.dev ? (I.by.get(d.a.dev)?.data.rack || '') : '', dev: d.a?.dev || null, port: d.a?.port || null, side: d.a?.side || 'F', q: '' };
  const m = modal(`<div id="ci-b"></div>`, { wide: true });
  const keep = () => { const g = s => m.el.querySelector(s)?.value; if (!m.el.querySelector('#ci-p')) return; d.provider = g('#ci-p'); d.cid = g('#ci-i'); d.type = g('#ci-t'); d.bw = g('#ci-w'); d.noc = g('#ci-n'); d.status = g('#ci-s'); d.notes = g('#ci-o'); };
  const render = keepFocus => {
    keep();
    $('#ci-b').innerHTML = `<h2>${c ? 'Circuito' : 'Nuevo circuito'}</h2>
      <div class="row"><div class="grow"><label>Proveedor *</label><input id="ci-p" maxlength="80" value="${esc(d.provider || '')}" placeholder="Ej.: METROTEL"></div><div class="grow"><label>N° de servicio / circuito</label><input id="ci-i" maxlength="80" value="${esc(d.cid || '')}"></div></div>
      <div class="row"><div class="grow"><label>Tipo</label><select id="ci-t">${['Internet', 'MPLS', 'Enlace L2', 'Fibra oscura', 'Telefonía', 'Otro'].map(t => `<option ${d.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div><div class="grow"><label>Ancho de banda</label><input id="ci-w" maxlength="40" value="${esc(d.bw || '')}" placeholder="Ej.: 1 Gbps"></div>
        <div class="grow"><label>Estado</label><select id="ci-s">${[['activo', 'Activo'], ['pendiente', 'Pendiente'], ['baja', 'Baja']].map(([k, n]) => `<option value="${k}" ${d.status === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div></div>
      <label>Contacto NOC del proveedor</label><input id="ci-n" maxlength="120" value="${esc(d.noc || '')}" placeholder="Teléfono / mail de reclamos">
      <h3 style="margin:14px 0 4px">Dónde termina</h3>${dcPickerHTML(st, {})}
      <label>Notas</label><textarea id="ci-o" maxlength="1000">${esc(d.notes || '')}</textarea>
      <div class="err" id="ci-e"></div><div class="row between" style="margin-top:12px">${c ? '<button class="btn danger" id="ci-d">Quitar</button>' : '<span></span>'}<div class="row"><button class="btn sec" id="ci-x">Cancelar</button><button class="btn" id="ci-g">Guardar</button></div></div>`;
    dcBindPicker(m.el, st, render, { focusQ: keepFocus });
    $('#ci-x').onclick = m.close;
    $('#ci-d')?.addEventListener('click', async () => { if (!confirm('¿Quitar el circuito?')) return; try { await dcSave('circuit', c.id, c.data, { deleted: true }); m.close(); dcReindex(); dcRefresh(); } catch (e){ $('#ci-e').textContent = errText(e); } });
    $('#ci-g').onclick = async () => {
      keep(); const provider = dcTxt(d.provider, 80); if (!provider) return ($('#ci-e').textContent = 'Poné el proveedor.');
      const a = st.dev && st.port ? { dev: st.dev, port: st.port, ...(dcIsPanel(I.by.get(st.dev)) ? { side: st.side } : {}) } : null;
      try { await dcSave('circuit', c?.id, { provider, cid: dcTxt(d.cid, 80), type: dcTxt(d.type, 40), bw: dcTxt(d.bw, 40), noc: dcTxt(d.noc, 120), status: ['activo', 'pendiente', 'baja'].includes(d.status) ? d.status : 'activo', notes: dcTxt(d.notes, 1000), a }); m.close(); dcReindex(); dcRefresh(); }
      catch (e){ $('#ci-e').textContent = errText(e); }
    };
  };
  render();
}

/* ---------- IP / VLAN ---------- */
const dcIp2n = s => { const m = String(s || '').trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/); if (!m) return null; const p = m.slice(1).map(Number); if (p.some(x => x > 255)) return null; return ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3]; };
const dcN2ip = n => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
const dcCidr = s => { const m = String(s || '').trim().match(/^([\d.]+)\/(\d{1,2})$/); if (!m) return null; const ip = dcIp2n(m[1]), len = Number(m[2]); if (ip === null || len > 32) return null; const mask = len ? (~0 << (32 - len)) >>> 0 : 0; const net = (ip & mask) >>> 0; return { net, len, size: 2 ** (32 - len), txt: dcN2ip(net) + '/' + len }; };
function dcTabNet(box){
  if (!dcNet()){ box.innerHTML = '<div class="card dc-empty">IP, VLAN y redes: solo con permiso del administrador.</div>'; return; }
  const I = DCS.I, w = dcCanW();
  const vcol = vid => `hsl(${(dcNum(vid) * 47) % 360} 60% 45%)`;
  const ipsIn = p => { const c = dcCidr(p.data.cidr); if (!c) return []; return I.ips.filter(x => { const n = dcIp2n(x.data.address); return n !== null && n >= c.net && n < c.net + c.size; }); };
  box.innerHTML = `
    <div class="card"><div class="row between"><h3 style="margin:0">VLAN</h3>${w ? '<button class="btn sec small" id="vl-new">+ VLAN</button>' : ''}</div>
      ${I.vlans.length ? `<div class="dc-chips" style="margin-top:10px">${I.vlans.map(v => `<button class="dc-chip" data-vl="${esc(v.id)}" style="border-color:${vcol(v.data.vid)}"><b style="color:${vcol(v.data.vid)}">${esc(v.data.vid)}</b> ${esc(v.data.name || '')}</button>`).join('')}</div>` : '<p class="muted sm">Sin VLAN cargadas.</p>'}</div>
    <div class="card"><div class="row between"><h3 style="margin:0">Redes</h3><div class="row" style="gap:6px">${w ? '<button class="btn sec small" id="px-new">+ Red</button><button class="btn small" id="ip-new">+ IP</button>' : ''}</div></div>
      ${I.prefixes.length ? I.prefixes.slice().sort((a, b) => (dcCidr(a.data.cidr)?.net || 0) - (dcCidr(b.data.cidr)?.net || 0)).map(p => { const c = dcCidr(p.data.cidr), used = ipsIn(p), vl = I.by.get(p.data.vlan); const cap = c ? Math.max(1, c.len >= 31 ? c.size : c.size - 2) : 1; const pct = dcPct(used.length, cap);
        const setU = new Set(used.map(x => dcIp2n(x.data.address))); const gw = dcIp2n(p.data.gateway);
        return `<div style="border-top:1px solid var(--line);padding:12px 0;margin-top:10px"><div class="row between"><div class="click" data-px="${esc(p.id)}" style="cursor:pointer"><b style="font-family:ui-monospace,monospace">${esc(c ? c.txt : p.data.cidr)}</b> ${vl ? `<span class="pill" style="background:${vcol(vl.data.vid)};color:#fff">VLAN ${esc(vl.data.vid)}</span>` : ''} <span class="muted sm">${esc(p.data.desc || '')}</span></div><span class="sm muted">${used.length} de ${cap} usadas · ${pct}%</span></div>
          ${c && c.size <= 1024 ? `<div class="dc-ipgrid" style="margin-top:8px">${Array.from({ length: c.size }, (_, i) => { const n = c.net + i; const cls = n === gw ? 'g' : setU.has(n) ? 'u' : (i === 0 || i === c.size - 1) && c.len < 31 ? 'r' : ''; return `<i class="${cls}" title="${dcN2ip(n)}"></i>`; }).join('')}</div>` : `<div style="margin-top:8px">${dcBar(pct, '#2A78D6')}</div>`}
          ${used.length ? `<div class="tblwrap" style="margin-top:8px"><table class="tbl"><tbody>${used.sort((a, b) => dcIp2n(a.data.address) - dcIp2n(b.data.address)).map(x => { const d = I.by.get(x.data.dev); return `<tr class="click" data-ip="${esc(x.id)}"><td style="font-family:ui-monospace,monospace">${esc(x.data.address)}</td><td class="sm">${d ? esc(dcDevName(d)) + (x.data.port ? ' · ' + esc(x.data.port) : '') : '<span class="muted">sin equipo</span>'}</td><td class="sm muted hide-sm">${esc(x.data.desc || '')}</td></tr>`; }).join('')}</tbody></table></div>` : ''}</div>`; }).join('') : '<p class="muted sm">Sin redes cargadas.</p>'}
      ${(() => { const loose = I.ips.filter(x => !I.prefixes.some(p => ipsIn(p).includes(x))); return loose.length ? `<h3 style="margin-top:14px">IP fuera de las redes cargadas</h3><div class="dc-chips">${loose.map(x => `<button class="dc-chip" data-ip="${esc(x.id)}">${esc(x.data.address)}</button>`).join('')}</div>` : ''; })()}
    </div>
    <div class="legend dc-legend"><span><i style="background:#2A78D6"></i>Usada</span><span><i style="background:#0F2A4A"></i>Gateway</span><span><i style="background:#94A3B8"></i>Red / broadcast</span><span><i style="background:#E1E6ED"></i>Libre</span></div>`;
  $('#vl-new')?.addEventListener('click', () => dcEditVlan(null));
  $('#px-new')?.addEventListener('click', () => dcEditPrefix(null));
  $('#ip-new')?.addEventListener('click', () => dcEditIP(null));
  box.querySelectorAll('[data-vl]').forEach(b => b.onclick = () => w && dcEditVlan(I.by.get(b.dataset.vl)));
  box.querySelectorAll('[data-px]').forEach(b => b.onclick = () => w && dcEditPrefix(I.by.get(b.dataset.px)));
  box.querySelectorAll('[data-ip]').forEach(b => b.onclick = () => w && dcEditIP(I.by.get(b.dataset.ip)));
}
function dcSimpleForm(title, fields, obj, kind, validate){
  const d = obj?.data || {};
  const m = modal(`<h2>${esc(title)}</h2>${fields.map(f => `<label>${esc(f.l)}</label>${f.opts ? `<select id="sf-${f.k}">${f.opts.map(([v, n]) => `<option value="${esc(v)}" ${String(d[f.k] ?? '') === String(v) ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>` : `<input id="sf-${f.k}" maxlength="${f.max || 120}" value="${esc(d[f.k] ?? '')}" placeholder="${esc(f.ph || '')}" ${f.num ? 'type="number"' : ''}>`}`).join('')}
    <div class="err" id="sf-e"></div><div class="row between" style="margin-top:12px">${obj ? '<button class="btn danger" id="sf-d">Quitar</button>' : '<span></span>'}<div class="row"><button class="btn sec" id="sf-x">Cancelar</button><button class="btn" id="sf-g">Guardar</button></div></div>`);
  $('#sf-x').onclick = m.close;
  $('#sf-d')?.addEventListener('click', async () => { if (!confirm('¿Quitar?')) return; try { await dcSave(kind, obj.id, obj.data, { deleted: true }); m.close(); dcReindex(); dcRefresh(); } catch (e){ $('#sf-e').textContent = errText(e); } });
  $('#sf-g').onclick = async () => {
    const out = { ...d }; fields.forEach(f => { out[f.k] = dcTxt($('#sf-' + f.k).value, f.max || 120); });
    const err = validate(out); if (err) return ($('#sf-e').textContent = err);
    try { await dcSave(kind, obj?.id, out); m.close(); dcReindex(); dcRefresh(); } catch (e){ $('#sf-e').textContent = errText(e); }
  };
}
function dcEditVlan(v){ dcSimpleForm(v ? 'VLAN' : 'Nueva VLAN', [{ k: 'vid', l: 'Número (1–4094) *', num: true }, { k: 'name', l: 'Nombre', max: 60 }, { k: 'desc', l: 'Descripción', max: 200 }], v, 'vlan', o => { const n = dcNum(o.vid, 0); if (!(n >= 1 && n <= 4094)) return 'La VLAN va de 1 a 4094.'; if (DCS.I.vlans.some(x => x.id !== v?.id && dcNum(x.data.vid) === n)) return 'Esa VLAN ya existe.'; o.vid = n; }); }
function dcEditPrefix(p){ dcSimpleForm(p ? 'Red' : 'Nueva red', [{ k: 'cidr', l: 'Red (CIDR) *', ph: '10.10.20.0/24', max: 20 }, { k: 'gateway', l: 'Gateway', ph: '10.10.20.1', max: 20 }, { k: 'vlan', l: 'VLAN', opts: [['', '—']].concat(DCS.I.vlans.map(v => [v.id, v.data.vid + ' ' + (v.data.name || '')])) }, { k: 'desc', l: 'Descripción', max: 200 }], p, 'prefix', o => { const c = dcCidr(o.cidr); if (!c) return 'Escribí la red como 10.10.20.0/24.'; o.cidr = c.txt; if (o.gateway && dcIp2n(o.gateway) === null) return 'El gateway no es una IP válida.'; if (o.vlan && !DC_UUID.test(o.vlan)) o.vlan = ''; }); }
function dcEditIP(ip){
  const I = DCS.I;
  const devs = I.devices.filter(d => !['ciego', 'ordenador', 'bandeja', 'pdu'].includes(dcDevRole(d))).sort((a, b) => dcNat(dcRackOf(a)?.data?.name, dcRackOf(b)?.data?.name) || dcNum(b.data.u) - dcNum(a.data.u));
  dcSimpleForm(ip ? 'Dirección IP' : 'Nueva IP', [{ k: 'address', l: 'IP *', ph: '10.10.20.15', max: 20 }, { k: 'dev', l: 'Equipo', opts: [['', '— Ninguno —']].concat(devs.map(d => [d.id, `${dcRackOf(d)?.data?.name || 'Ext.'} · ${dcDevName(d)}`])) }, { k: 'port', l: 'Interfaz / puerto', max: 40, ph: 'MGMT' }, { k: 'role', l: 'Uso', opts: [['gestion', 'Gestión'], ['servicio', 'Servicio'], ['vip', 'VIP'], ['otro', 'Otro']] }, { k: 'desc', l: 'Descripción', max: 200 }], ip, 'ip', o => { if (dcIp2n(o.address) === null) return 'IP inválida.'; if (I.ips.some(x => x.id !== ip?.id && x.data.address === o.address)) return 'Esa IP ya está cargada.'; if (o.dev && !DC_UUID.test(o.dev)) o.dev = ''; });
}

/* ---------- pendientes ---------- */
function dcPendList(){
  const I = DCS.I, out = [];
  for (const d of I.devices){ const r = dcRackOf(d);
    if (dcDevRole(d) === 'desconocido' || d.data.status === 'desconocido') out.push({ i: '❓', t: `Identificar: ${dcDevName(d)}`, s: `${r ? r.data.name : 'Fuera de rack'}${d.data.u ? ' · U' + d.data.u : ''}`, go: () => dcEditDevice(d, { identify: true }), c: '#DC2626' });
    else if (d.data.status === 'falla') out.push({ i: '🛠️', t: `Equipo en falla: ${dcDevName(d)}`, s: r ? r.data.name : '', go: () => dcDeviceSheet(d, dcRefresh), c: '#DC2626' });
  }
  for (const c of I.cables) if (c.data.status === 'falla') out.push({ i: '⚠️', t: 'Conexión en falla', s: `${dcEndTxt(c.data.a, true)} ↔ ${dcEndTxt(c.data.b, true)}`, go: () => dcPortSheet(c.data.a, dcRefresh), c: '#DC2626' });
  for (const c of I.cables) if (c.data.status === 'planificado') out.push({ i: '🕓', t: 'Conexión planificada (sin hacer)', s: `${dcEndTxt(c.data.a, true)} ↔ ${dcEndTxt(c.data.b, true)}`, go: () => dcPortSheet(c.data.a, dcRefresh), c: '#F59E0B' });
  for (const r of I.racks) if (!r.data.surveyed) out.push({ i: '🧭', t: `Rack sin relevar: ${r.data.name}`, s: `${dcRackUse(r).devs} elementos cargados`, go: () => dcGo(DCS.site, 'relevar', r.id), c: '#2A78D6' });
  for (const x of (I.dc?.data?.import_issues || []).slice(0, 300)) out.push({ i: '📥', t: 'Revisar del Excel importado', s: x, go: null, c: '#B7791F' });
  for (const o of DCS.rejected.filter(o => o.site_id === DCS.site)) out.push({ i: '⛔', t: 'Cambio rechazado por el servidor', s: o.err, go: dcReviewModal, c: '#DC2626' });
  for (const o of DCS.conflicts.filter(o => o.site_id === DCS.site)) out.push({ i: '🔀', t: 'Conflicto: otro técnico cambió lo mismo', s: o.kind, go: dcReviewModal, c: '#7C3AED' });
  return out;
}
function dcTabPend(box){
  const L = dcPendList(), I = DCS.I;
  box.innerHTML = `<div class="card"><div class="row between"><h3 style="margin:0">Pendientes</h3>${(I.dc?.data?.import_issues || []).length && dcCanW() ? '<button class="btn sec small" id="pd-clr">Marcar revisado lo del Excel</button>' : ''}</div>
    ${L.length ? `<div class="dc-list" style="margin-top:10px">${L.map((x, k) => `<div class="dc-li" data-k="${k}" style="${x.go ? '' : 'cursor:default'}"><span class="sw" style="background:${dcHex(x.c) || '#999'}"></span><span style="font-size:18px">${x.i}</span><div class="grow" style="min-width:0"><b style="font-size:13px">${esc(x.t)}</b><div class="muted" style="font-size:12px">${esc(x.s)}</div></div></div>`).join('')}</div>` : '<div class="dc-empty"><span class="e">✅</span>No hay pendientes.</div>'}</div>`;
  box.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { const x = L[Number(b.dataset.k)]; x.go && x.go(); });
  $('#pd-clr')?.addEventListener('click', async () => { if (!confirm('¿Marcar como revisadas las observaciones del Excel importado?')) return; try { await dcSave('dc', I.dc.id, { ...I.dc.data, import_issues: [] }); dcReindex(); dcRefresh(); } catch (e){ toast(errText(e)); } });
}

/* ---------- historial ---------- */
async function dcTabHist(box){
  if (!online()){ box.innerHTML = '<div class="card dc-empty"><span class="e">📴</span>El historial se consulta con conexión.</div>'; return; }
  box.innerHTML = '<div class="card muted">Cargando historial…</div>';
  const { data, error } = await sb.from('dc_changes').select('id,object_id,kind,op,before,after,by_name,at').eq('site_id', DCS.site).order('at', { ascending: false }).limit(300);
  if (error){ box.innerHTML = `<div class="card">${esc(errText(error))}</div>`; return; }
  const KI = { dc: '🏢', room: '🗺️', rack: '🗄️', device: '🖥️', cable: '🔌', circuit: '📡', power: '⚡', vlan: '🏷️', prefix: '🌐', ip: '🌐', model: '📚' };
  const OP = { alta: ['p-ok', 'alta'], cambio: ['p-info', 'cambio'], baja: ['p-bad', 'baja'], restaurado: ['p-ok', 'restaurado'], borrado: ['p-bad', 'borrado'] };
  const nameOf = r => { const x = r.after || r.before || {}; if (r.kind === 'cable') return `${dcEndTxt(x.a, true)} ↔ ${dcEndTxt(x.b, true)}`; if (r.kind === 'circuit') return `${x.provider || ''} ${x.cid || ''}`; if (r.kind === 'ip') return x.address; if (r.kind === 'vlan') return 'VLAN ' + x.vid; if (r.kind === 'prefix') return x.cidr; return x.name || '—'; };
  const LBL = { name: 'nombre', u: 'U', h: 'altura', rack: 'rack', model: 'modelo', status: 'estado', serial: 'serie', notes: 'notas', photos: 'fotos', x: 'posición', y: 'posición', face: 'montaje', pdu_a: 'PDU A', pdu_b: 'PDU B', power_w: 'consumo', label: 'etiqueta', type: 'tipo', length_m: 'largo', color: 'color', a: 'extremo A', b: 'extremo B', pm: 'descripción de puertos', extra_ports: 'puertos', surveyed: 'relevamiento', contractors: 'accesos', import_issues: 'observaciones' };
  const diff = r => { if (r.op !== 'cambio' || !r.before || !r.after) return ''; const ks = [...new Set(Object.keys(r.before).concat(Object.keys(r.after)))].filter(k => JSON.stringify(r.before[k]) !== JSON.stringify(r.after[k])); return [...new Set(ks.map(k => LBL[k] || k))].slice(0, 6).join(', '); };
  let lastDay = '';
  box.innerHTML = `<div class="card"><h3>Últimos cambios</h3>${(data || []).length ? (data || []).map(r => { const day = fmtDate(r.at); const hd = day !== lastDay ? `<div class="dc-face-lbl" style="margin-top:14px">${esc(day)}</div>` : ''; lastDay = day; const [cls, t] = OP[r.op] || ['p-info', r.op];
    return `${hd}<div class="row" style="gap:10px;padding:7px 0;border-bottom:1px solid var(--line);flex-wrap:nowrap"><span style="font-size:18px">${KI[r.kind] || '•'}</span><div class="grow" style="min-width:0"><div class="sm"><span class="pill ${cls}">${esc(t)}</span> <b>${esc(nameOf(r))}</b></div><div class="muted" style="font-size:12px">${esc(fmtTime(r.at))} · ${esc(r.by_name || 'usuario')}${diff(r) ? ' · cambió ' + esc(diff(r)) : ''}</div></div></div>`; }).join('') : '<p class="muted">Sin cambios registrados.</p>'}</div>`;
}

/* ---------- cambios para revisar (rechazos y conflictos de sincronización) ---------- */
async function dcReviewModal(){
  await dcPendCount();
  const rej = DCS.rejected, conf = DCS.conflicts;
  const label = (kind, data) => { if (!data) return kind; if (kind === 'cable') return `Cable ${dcEndTxt(data.a, true)} ↔ ${dcEndTxt(data.b, true)}`; return `${({ device: 'Equipo', rack: 'Rack', room: 'Sala', dc: 'Data center', circuit: 'Circuito', ip: 'IP', vlan: 'VLAN', prefix: 'Red', power: 'Energía', model: 'Modelo' })[kind] || kind}: ${data.name || data.provider || data.address || data.vid || ''}`; };
  const LB = { name: 'Nombre', u: 'U', h: 'Altura', rack: 'Rack', model: 'Modelo', status: 'Estado', serial: 'N° de serie', notes: 'Notas', x: 'Posición X', y: 'Posición Y', face: 'Montaje', pdu_a: 'PDU A', pdu_b: 'PDU B', power_w: 'Consumo', label: 'Etiqueta', type: 'Tipo', length_m: 'Largo', color: 'Color', a: 'Extremo A', b: 'Extremo B', room: 'Sala', u_height: 'Altura del rack', provider: 'Proveedor', cid: 'Servicio', address: 'IP' };
  const show = (k, v) => { if (v === null || v === undefined || v === '') return '—'; if (k === 'a' || k === 'b') return dcEndTxt(v, true); if (typeof v === 'string' && DC_UUID.test(v)){ const o = DCS.I.by.get(v); return o ? (o.kind === 'device' ? dcDevName(o) : o.data.name || '…') : '…'; } if (k === 'model') return dcModelLabel(dcModel(v)); return typeof v === 'object' ? JSON.stringify(v).slice(0, 80) : String(v).slice(0, 80); };
  const diffRows = (a, b) => { const ks = [...new Set(Object.keys(a || {}).concat(Object.keys(b || {})))].filter(k => !['photos', 'pm', 'extra_ports', 'import_issues', 'free_ok', 'surveyed_at', 'surveyed_by'].includes(k) && JSON.stringify(a?.[k] ?? '') !== JSON.stringify(b?.[k] ?? '')); return ks.length ? ks.map(k => `<tr class="chg"><td class="muted">${esc(LB[k] || k)}</td><td>${esc(show(k, a?.[k]))}</td><td>${esc(show(k, b?.[k]))}</td></tr>`).join('') : '<tr><td colspan="3" class="muted">Mismos datos (cambió otra cosa, por ejemplo fotos).</td></tr>'; };
  const m = modal(`<h2>Cambios para revisar</h2>
    ${rej.length ? `<h3>Rechazados por el servidor</h3><div class="dc-list">${rej.map((o, k) => `<div class="dc-li" style="cursor:default;flex-wrap:wrap"><div class="grow"><b style="font-size:13px">${esc(label(o.kind, o.data))}</b><div class="sm" style="color:var(--red)">${esc(o.err)}</div></div><button class="btn sec small" data-rr="${k}">Reintentar</button><button class="btn danger small" data-rd="${k}">Descartar</button></div>`).join('')}</div>` : ''}
    ${conf.length ? `<h3 style="margin-top:12px">Conflictos</h3><p class="muted sm">Otro técnico cambió lo mismo antes de que se enviara lo tuyo. Elegí qué versión queda.</p>${conf.map((c, k) => `<div style="border:1px solid var(--line);border-radius:10px;padding:10px;margin-bottom:8px"><b class="sm">${esc(label(c.kind, c.mine))}</b><div class="tblwrap"><table class="tbl dc-diff"><thead><tr><th></th><th>Tu versión</th><th>En el servidor (${esc(fmtDT(c.server.updated_at))})</th></tr></thead><tbody>${diffRows(c.mine, c.server.data)}</tbody></table></div>
      <div class="row" style="justify-content:flex-end;margin-top:6px;gap:6px"><button class="btn sec small" data-cs="${k}">Quedarme con la del servidor</button><button class="btn small" data-cm="${k}">Usar la mía</button></div></div>`).join('')}` : ''}
    ${!rej.length && !conf.length ? '<p class="muted">No hay nada para revisar. 👍</p>' : ''}
    <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn sec" id="rv-x">Cerrar</button></div>`, { wide: true });
  $('#rv-x').onclick = () => { m.close(); dcRefresh(); };
  const saveConf = async list => { await DCDB.put('meta', list, `${CUR_UID}:conflicts`); await dcPendCount(); };
  m.el.querySelectorAll('[data-rr]').forEach(b => b.onclick = async () => { const o = rej[Number(b.dataset.rr)]; o.err = null; await DCDB.put('out', o); m.close(); await dcSync(); dcReviewModal(); });
  m.el.querySelectorAll('[data-rd]').forEach(b => b.onclick = async () => {
    const o = rej[Number(b.dataset.rd)]; await DCDB.del('out', o.id);
    // vuelve a lo que tiene el servidor
    if (online()){ const { data } = await sb.from('dc_objects').select(DC_COLS).eq('id', o.id).maybeSingle(); if (data){ const sv = { ...data, site_id: data.site_id || '__models' }; await DCDB.put('obj', sv); DCS.objs.set(sv.id, sv); } else { await DCDB.del('obj', o.id); DCS.objs.delete(o.id); } }
    else { await DCDB.del('obj', o.id); DCS.objs.delete(o.id); }
    dcReindex(); m.close(); await dcPendCount(); dcReviewModal();
  });
  m.el.querySelectorAll('[data-cs]').forEach(b => b.onclick = async () => { const list = conf.slice(); list.splice(Number(b.dataset.cs), 1); await saveConf(list); m.close(); dcReindex(); dcReviewModal(); });
  m.el.querySelectorAll('[data-cm]').forEach(b => b.onclick = async () => {
    const list = conf.slice(); const c = list.splice(Number(b.dataset.cm), 1)[0];
    await DCDB.put('out', { id: c.id, org_id: me.org_id, kind: c.kind, site_id: c.site_id, data: c.mine, deleted: !!c.mineDeleted, base: c.server.version, t: Date.now(), rev: 1, err: null });
    const loc = { ...c.server, data: c.mine, deleted: !!c.mineDeleted, site_id: c.server.site_id || '__models', _dirty: true }; await DCDB.put('obj', loc); DCS.objs.set(loc.id, loc);
    await saveConf(list); dcReindex(); m.close(); await dcSync(); dcReviewModal();
  });
}

/* =====================================================================
   RELEVAMIENTO GUIADO DE UN RACK (U por U, de arriba hacia abajo)
   ===================================================================== */
const DC_QUICK = [
  ['libre', '⬜', 'Libre'], ['ciego', '▦', 'Panel ciego', 'g-ciego1'], ['ordenador', '☰', 'Ordenador', 'g-ord1'],
  ['pfo_mm', '🟧', 'Panel fibra MM', 'g-pfo-mm24'], ['pfo_sm', '🟨', 'Panel fibra SM', 'g-pfo-sm24'], ['putp', '🟩', 'Panel UTP', 'g-putp6a-24'],
  ['switch', '🔀', 'Switch', 'g-sw48'], ['server', '🖥️', 'Servidor', 'g-srv1'], ['storage', '💾', 'Storage', 'g-sto2'],
  ['router', '🌐', 'Router', 'g-router'], ['firewall', '🛡️', 'Firewall', 'g-fw'], ['pdu', '⚡', 'PDU 1U', 'g-pdu1u'],
  ['lib', '📚', 'Modelo de la biblioteca…'], ['unk', '❓', 'No identificado', 'g-unknown'],
];
function dcViewSurvey(v, rackId){
  const I0 = DCS.I, rack0 = I0.by.get(rackId); if (!rack0) return dcGo(DCS.site);
  if (!DCS.view.sv || DCS.view.sv.rack !== rackId) DCS.view.sv = { rack: rackId, u: dcRackH(rack0), face: 'front', step: 'u', h: 1, name: '', serial: '' };
  const S = DCS.view.sv;
  const render = () => {
    const I = DCS.I, rack = I.by.get(rackId); if (!rack || rack.deleted) return dcGo(DCS.site);
    const H = dcRackH(rack), devs = I.devByRack.get(rack.id) || [], freeOk = new Set((rack.data.free_ok || []).map(Number));
    const covered = new Set(); devs.forEach(d => { const u = dcNum(d.data.u); for (let k = u; k > 0 && k < u + dcDevU(d); k++) covered.add(k); });
    const done = [...Array(H)].map((_, i) => i + 1).filter(u => covered.has(u) || freeOk.has(u)).length;
    const at = devs.find(d => { const u = dcNum(d.data.u), h = dcDevU(d); const f = d.data.face || 'both'; return u && S.u >= u && S.u < u + h && (f === 'both' || f === S.face); });
    const w = dcCanW();
    let side = '';
    if (S.step === 'u' && S.u >= 1){
      side = `<div class="row between"><div><div class="muted sm">${esc(rack.data.name)} · ${S.face === 'front' ? 'frente' : 'trasera'}</div><h1 style="font-size:28px;margin:0">U ${S.u}</h1></div>
        <div class="row" style="gap:6px"><button class="btn sec" id="sv-up" title="Subir">↑</button><button class="btn sec" id="sv-dn" title="Bajar">↓</button></div></div>
        ${at ? `<div class="dc-li" style="margin:12px 0;cursor:default;border-left:6px solid ${DC_ROLE[dcDevRole(at)].c}"><div class="grow"><b>${esc(dcDevName(at))}</b><div class="muted sm">${esc(DC_ROLE[dcDevRole(at)].n)} · U${dcNum(at.data.u)}${dcDevU(at) > 1 ? '–' + (dcNum(at.data.u) + dcDevU(at) - 1) : ''}</div></div></div>
          <div class="row" style="gap:8px"><button class="btn" id="sv-ok">✓ Está bien, siguiente</button>${w ? '<button class="btn sec" id="sv-ed">✏️ Corregir</button><button class="btn danger" id="sv-rm">Quitar</button>' : ''}</div>`
        : `<p class="muted sm" style="margin:6px 0 10px">¿Qué hay en esta U? Tocá una opción y la app baja sola a la siguiente.</p>
          <div class="row" style="gap:14px;margin-bottom:10px"><div><label style="margin:0 0 4px">Altura</label><div class="dc-step"><button id="sv-hm">−</button><b id="sv-hv">${S.h} U</b><button id="sv-hp">+</button></div></div>
            <div class="grow"><label style="margin:0 0 4px">Nombre / hostname (opcional)</label><input id="sv-n" value="${esc(S.name)}" maxlength="120" placeholder="Ej.: C3-DESX-08"></div></div>
          <div class="dc-big">${DC_QUICK.map(([k, i, n]) => `<button data-q="${k}" ${w ? '' : 'disabled'}><i>${i}</i>${esc(n)}</button>`).join('')}</div>
          <p class="sm muted" style="margin:10px 0 0">Si ocupa varias U, poné la altura antes de elegir: se registra desde U${Math.max(1, S.u - S.h + 1)} hasta U${S.u}.</p>`}
        <div class="row" style="gap:8px;margin-top:14px">${w ? '<label class="btn sec small" style="cursor:pointer">📷 Foto del rack<input type="file" accept="image/*" capture="environment" id="sv-ph" hidden></label>' : ''}<button class="btn sec small" id="sv-skip">Ir al cableado →</button></div>`;
    } else {
      const withPorts = devs.filter(d => dcPorts(d).length && !['ciego', 'ordenador'].includes(dcDevRole(d))).sort((a, b) => (dcIsPanel(b) - dcIsPanel(a)) || dcNum(b.data.u) - dcNum(a.data.u));
      side = `<h2 style="margin:0">Paso 2 · Cableado</h2><p class="muted sm">Tocá cada equipo y conectá sus puertos. Empezá por los paneles: con <b>Troncal</b> cargás de una vez todas las fibras hacia otro rack.</p>
        <div class="dc-list">${withPorts.map(d => { const pu = dcPortUse(d), R = DC_ROLE[dcDevRole(d)]; return `<div class="dc-li" data-dev="${esc(d.id)}"><span class="sw" style="background:${R.c}"></span><div class="grow" style="min-width:0"><b style="font-size:13px">${esc(dcDevName(d))}</b><div class="muted" style="font-size:12px">U${esc(d.data.u ?? '–')} · ${esc(R.n)}</div></div><div style="width:90px" class="sm muted">${pu.used}/${pu.total}${dcBar(dcPct(pu.used, pu.total), '#2A78D6')}</div></div>`; }).join('') || '<p class="muted">No hay equipos con puertos todavía.</p>'}</div>
        <div class="row" style="gap:8px;margin-top:14px">${w ? '<button class="btn sec small" id="sv-0u">+ PDU / equipo lateral</button>' : ''}<button class="btn sec small" id="sv-back">← Volver a las U</button>${w ? `<button class="btn" id="sv-fin">${rack.data.surveyed ? '✓ Actualizar fin de relevamiento' : '🏁 Terminar relevamiento'}</button>` : ''}</div>`;
    }
    v.innerHTML = `${dcTopBar(dcBack(rack.data.name, dcHash(DCS.site, 'rack', rack.id)))}
      <div class="card" style="padding:12px 16px"><div class="row between"><b>🧭 Relevando ${esc(rack.data.name)}</b><span class="sm muted">${done} de ${H} U relevadas</span></div><div style="margin-top:8px">${dcBar(dcPct(done, H), '#22B07D')}</div></div>
      <div class="row noprint" style="margin-bottom:10px"><div class="dc-face"><button data-face="front" class="${S.face === 'front' ? 'on' : ''}">Frente</button><button data-face="rear" class="${S.face === 'rear' ? 'on' : ''}">Trasera</button></div></div>
      <div class="dc-rackwrap dc-sv"><div class="dc-elev">${dcRackSVG(rack, { face: S.face, cur: S.step === 'u' && S.u >= 1 ? S.u : null, sel: at?.id, uh: matchMedia('(max-width:900px)').matches ? 13 : 20 })}</div><div class="card" style="margin:0">${side}</div></div>`;
    dcBindTop(v);
    const next = n => { S.u = Math.max(0, S.u - (n || 1)); S.h = 1; S.name = ''; if (S.u < 1) S.step = 'ports'; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    v.querySelectorAll('[data-face]').forEach(b => b.onclick = () => { S.face = b.dataset.face; render(); });
    v.querySelectorAll('.dc-elev .dv').forEach(g => g.onclick = () => { const d = I.by.get(g.dataset.dev); S.step = 'u'; S.u = dcNum(d.data.u) + dcDevU(d) - 1; render(); });
    $('#sv-up')?.addEventListener('click', () => { S.u = Math.min(H, S.u + 1); render(); });
    $('#sv-dn')?.addEventListener('click', () => next(1));
    $('#sv-ok')?.addEventListener('click', () => next(S.u - dcNum(at.data.u) + 1));
    $('#sv-ed')?.addEventListener('click', () => dcEditDevice(at));
    $('#sv-rm')?.addEventListener('click', async () => { if (!confirm(`¿Quitar ${dcDevName(at)}?`)) return; const cables = I.cables.filter(c => c.data.a?.dev === at.id || c.data.b?.dev === at.id); try { await dcSaveMany(cables.map(c => ({ kind: 'cable', id: c.id, data: c.data, deleted: true })).concat([{ kind: 'device', id: at.id, data: at.data, deleted: true }])); dcReindex(); render(); } catch (e){ toast(errText(e)); } });
    const hv = () => { const t = $('#sv-hv'); if (t) t.textContent = S.h + ' U'; };
    $('#sv-hm')?.addEventListener('click', () => { S.h = Math.max(1, S.h - 1); hv(); });
    $('#sv-hp')?.addEventListener('click', () => { S.h = Math.min(Math.min(20, S.u), S.h + 1); hv(); });
    $('#sv-n')?.addEventListener('input', e => { S.name = e.target.value; });
    $('#sv-skip')?.addEventListener('click', () => { S.step = 'ports'; render(); });
    $('#sv-back')?.addEventListener('click', () => { S.step = 'u'; S.u = H; render(); });
    $('#sv-ph')?.addEventListener('change', async e => { const f = e.target.files?.[0]; if (f){ await dcAddPhoto(I.by.get(rack.id), f); render(); } });
    v.querySelectorAll('[data-q]').forEach(b => b.onclick = async () => {
      const k = b.dataset.q, q = DC_QUICK.find(x => x[0] === k); const low = Math.max(1, S.u - S.h + 1);
      const hit = dcCollides(rack.id, low, S.u - low + 1, S.face === 'front' ? 'front' : 'rear', null);
      if (hit && k !== 'libre') return toast(`Choca con ${dcDevName(hit)} (U${hit.data.u}). Bajá la altura.`);
      if (k === 'libre'){ const fo = new Set((rack.data.free_ok || []).map(Number)); for (let u = low; u <= S.u; u++) fo.add(u); try { await dcSave('rack', rack.id, { ...rack.data, free_ok: [...fo].sort((a, b) => a - b) }); dcReindex(); } catch (e){ return toast(errText(e)); } return next(S.u - low + 1); }
      if (k === 'lib') return dcEditDevice(null, { rack: rack.id, u: low, face: 'both' });
      const model = dcModel(q[3]); const role = model?.role || 'otro';
      const data = { model: q[3], role, h: S.u - low + 1, u: low, rack: rack.id, face: ['ciego', 'ordenador'].includes(role) ? (S.face === 'rear' ? 'rear' : 'both') : 'both', name: dcTxt(S.name, 120), status: k === 'unk' ? 'desconocido' : 'activo', surveyed_by: dcWho(), surveyed_at: new Date().toISOString() };
      if (role === 'server' && data.h >= 2) data.model = 'g-srv2';
      if (role === 'ciego' && data.h >= 2) data.model = 'g-ciego2';
      if (role === 'ordenador' && data.h >= 2) data.model = 'g-ord2';
      try { await dcSave('device', null, data); dcReindex(); next(S.u - low + 1); } catch (e){ toast(errText(e)); }
    });
    v.querySelectorAll('[data-dev]').forEach(b => b.onclick = () => dcDeviceSheet(I.by.get(b.dataset.dev), render));
    $('#sv-0u')?.addEventListener('click', () => dcEditDevice(null, { rack: rack.id, u: 0, role: 'pdu', _model: 'g-pdu' }));
    $('#sv-fin')?.addEventListener('click', async () => { try { await dcSave('rack', rack.id, { ...rack.data, surveyed: { at: new Date().toISOString(), by: dcWho() } }); dcReindex(); DCS.view.sv = null; toast('🏁 Rack relevado'); dcGo(DCS.site, 'rack', rack.id); } catch (e){ toast(errText(e)); } });
  };
  DCS.render = render; render();
}

/* =====================================================================
   BÚSQUEDA
   ===================================================================== */
function dcSearch(){
  const m = modal(`<h2>Buscar en ${esc(DCS.I.dc.data.name)}</h2><input id="sr-q" placeholder="Hostname, serie, modelo, etiqueta de cable, carrier${dcNet() ? ', IP' : ''}…" autocomplete="off"><div id="sr-r" style="margin-top:10px;max-height:60vh;overflow:auto"></div>
    <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn sec" id="sr-x">Cerrar</button></div>`, { wide: true });
  $('#sr-x').onclick = m.close;
  const run = () => {
    const q = dcNorm($('#sr-q').value), I = DCS.I; if (q.length < 2){ $('#sr-r').innerHTML = '<p class="muted sm">Escribí al menos 2 letras.</p>'; return; }
    const res = [];
    I.racks.forEach(r => { if (dcNorm(r.data.name + ' ' + (r.data.asset || '')).includes(q)) res.push({ i: '🗄️', t: r.data.name, s: 'Rack', go: () => { m.close(); dcGo(DCS.site, 'rack', r.id); } }); });
    I.devices.forEach(d => { if (dcNorm(dcDevName(d) + ' ' + (d.data.serial || '') + ' ' + (d.data.asset || '') + ' ' + dcModelLabel(dcDevModel(d))).includes(q)) res.push({ i: '🖥️', t: dcDevName(d), s: `${dcRackOf(d)?.data?.name || 'Fuera de rack'}${d.data.u ? ' · U' + d.data.u : ''}${d.data.serial ? ' · S/N ' + d.data.serial : ''}`, go: () => { m.close(); if (dcNum(d.data.u) && d.data.rack){ DCS.view.sel = d.id; dcGo(DCS.site, 'rack', d.data.rack); } else dcDeviceSheet(d, dcRefresh); } }); });
    I.cables.forEach(c => { if (c.data.label && dcNorm(c.data.label).includes(q)) res.push({ i: '🔌', t: c.data.label, s: `${dcEndTxt(c.data.a, true)} ↔ ${dcEndTxt(c.data.b, true)}`, go: () => { m.close(); dcPortSheet(c.data.a, dcRefresh); } }); });
    I.circuits.forEach(c => { if (dcNorm(`${c.data.provider} ${c.data.cid}`).includes(q)) res.push({ i: '📡', t: `${c.data.provider || ''} ${c.data.cid || ''}`, s: c.data.a?.dev ? dcEndTxt(c.data.a, true) : 'Circuito', go: () => { m.close(); c.data.a?.dev ? dcPortSheet(c.data.a, dcRefresh) : (DCS.view.tab = 'carriers', dcRefresh()); } }); });
    if (dcNet()) I.ips.forEach(x => { if (dcNorm(x.data.address + ' ' + (x.data.desc || '')).includes(q)) res.push({ i: '🌐', t: x.data.address, s: I.by.get(x.data.dev) ? dcDevName(I.by.get(x.data.dev)) : 'IP', go: () => { m.close(); DCS.view.tab = 'red'; dcGo(DCS.site); } }); });
    $('#sr-r').innerHTML = res.length ? `<div class="dc-list">${res.slice(0, 80).map((x, k) => `<div class="dc-li" data-k="${k}"><span style="font-size:18px">${x.i}</span><div class="grow" style="min-width:0"><b style="font-size:13px">${esc(x.t)}</b><div class="muted" style="font-size:12px">${esc(x.s)}</div></div></div>`).join('')}</div>` : '<p class="muted">Sin resultados.</p>';
    $('#sr-r').querySelectorAll('[data-k]').forEach(b => b.onclick = () => res[Number(b.dataset.k)].go());
  };
  $('#sr-q').oninput = run; $('#sr-q').focus(); run();
}

/* =====================================================================
   QR: etiquetas, lectura con la cámara
   ===================================================================== */
function dcQRLink(obj){ return `${location.origin}${location.pathname}#/tools/dc/${obj.site_id && obj.site_id !== '__models' ? obj.site_id : DCS.site}/q/${obj.id}`; }
function dcQRSVG(text){
  if (typeof qrcode !== 'function') return '<svg viewBox="0 0 10 10"><text x="1" y="6" font-size="3">QR</text></svg>';
  const q = qrcode(0, 'M'); q.addData(text); q.make(); const n = q.getModuleCount(); let p = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) p += `M${c + 2} ${r + 2}h1v1h-1z`;
  return `<svg viewBox="0 0 ${n + 4} ${n + 4}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"><rect width="${n + 4}" height="${n + 4}" fill="#fff"/><path d="${p}" fill="#000"/></svg>`;
}
function dcLabelTxt(o){
  const I = DCS.I;
  if (o.kind === 'rack') return { t: o.data.name, s: [I.dc.data.name, I.by.get(o.data.room)?.data?.name].filter(Boolean).join(' · ') };
  if (o.kind === 'device'){ const r = dcRackOf(o); return { t: dcDevName(o), s: [r ? r.data.name : '', o.data.u ? 'U' + o.data.u : '', o.data.serial ? 'S/N ' + o.data.serial : ''].filter(Boolean).join(' · ') }; }
  return { t: o.data.name || '', s: '' };
}
function dcQRModal(obj){
  const L = dcLabelTxt(obj);
  const m = modal(`<div style="text-align:center"><div style="width:220px;margin:0 auto">${dcQRSVG(dcQRLink(obj))}</div><h2 style="margin:10px 0 2px">${esc(L.t)}</h2><div class="muted sm">${esc(L.s)}</div>
    <p class="sm muted">Pegá esta etiqueta en el ${obj.kind === 'rack' ? 'rack' : 'equipo'}. Al escanearla con la cámara se abre su ficha, también sin señal.</p></div>
    <div class="row" style="justify-content:flex-end;margin-top:12px;gap:6px"><button class="btn sec" id="qr-p">🖨️ Imprimir</button><button class="btn sec" id="qr-x">Cerrar</button></div>`);
  $('#qr-x').onclick = m.close;
  $('#qr-p').onclick = () => { m.close(); DCS.view.labels = { ids: [obj.id] }; dcGo(DCS.site, 'etiquetas'); };
}
function dcViewLabels(v){
  const I = DCS.I, pre = DCS.view.labels?.ids;
  const opt = DCS.view.lopt || { racks: true, devs: true, panels: true, rack: 'all' };
  const render = () => {
    let items = [];
    if (pre && pre.length) items = pre.map(id => I.by.get(id)).filter(Boolean);
    else {
      const racks = I.racks.filter(r => opt.rack === 'all' || r.id === opt.rack);
      for (const r of racks){
        if (opt.racks) items.push(r);
        for (const d of (I.devByRack.get(r.id) || [])){ const role = dcDevRole(d); if (['ciego', 'ordenador', 'bandeja'].includes(role)) continue; const p = dcIsPanel(d); if ((p && opt.panels) || (!p && opt.devs)) items.push(d); }
      }
    }
    v.innerHTML = `<div class="noprint">${dcTopBar(dcBack(I.dc.data.name, dcHash(DCS.site)))}
      <div class="card"><h2>🏷️ Etiquetas QR</h2>${pre && pre.length ? '<p class="muted sm">Etiqueta individual.</p><button class="btn sec small" id="lb-all">Ver todas</button>' : `
        <div class="row" style="gap:14px"><label style="display:flex;gap:6px;align-items:center;font-weight:400;margin:0"><input type="checkbox" id="lb-r" ${opt.racks ? 'checked' : ''} style="width:auto"> Racks</label><label style="display:flex;gap:6px;align-items:center;font-weight:400;margin:0"><input type="checkbox" id="lb-d" ${opt.devs ? 'checked' : ''} style="width:auto"> Equipos</label><label style="display:flex;gap:6px;align-items:center;font-weight:400;margin:0"><input type="checkbox" id="lb-p" ${opt.panels ? 'checked' : ''} style="width:auto"> Paneles</label>
        <select id="lb-k" style="width:auto"><option value="all">Todos los racks</option>${I.racks.map(r => `<option value="${esc(r.id)}" ${opt.rack === r.id ? 'selected' : ''}>${esc(r.data.name)}</option>`).join('')}</select></div>`}
        <div class="row" style="justify-content:space-between;margin-top:10px"><span class="muted sm">${items.length} etiquetas · hoja A4, 3 por fila</span><button class="btn" id="lb-print">🖨️ Imprimir / PDF</button></div></div></div>
      <div class="card dc-print"><div class="dc-labels">${items.map(o => { const L = dcLabelTxt(o); return `<div class="dc-label">${dcQRSVG(dcQRLink(o))}<div><b>${esc(L.t)}</b><span>${esc(L.s)}</span><span style="color:#6B7280">${esc(I.dc.data.name)}</span></div></div>`; }).join('')}</div></div>`;
    dcBindTop(v);
    $('#lb-all')?.addEventListener('click', () => { DCS.view.labels = null; dcViewLabels(v); });
    ['#lb-r', '#lb-d', '#lb-p'].forEach((s, i) => $(s)?.addEventListener('change', e => { opt[['racks', 'devs', 'panels'][i]] = e.target.checked; DCS.view.lopt = opt; render(); }));
    $('#lb-k')?.addEventListener('change', e => { opt.rack = e.target.value; DCS.view.lopt = opt; render(); });
    $('#lb-print').onclick = dcPrint;
  };
  DCS.render = render; render();
}
function dcPrint(){ document.body.classList.add('dc-printing'); const off = () => { document.body.classList.remove('dc-printing'); window.removeEventListener('afterprint', off); }; window.addEventListener('afterprint', off); setTimeout(() => window.print(), 50); }
function dcResolveQR(id){
  const o = DCS.I.by.get(id);
  if (!o || o.deleted){ toast('Ese QR no corresponde a nada cargado (o fue dado de baja).'); location.replace(dcHash(DCS.site)); return; }
  if (o.kind === 'rack') location.replace(dcHash(DCS.site, 'rack', o.id));
  else if (o.kind === 'device') location.replace(dcHash(DCS.site, 'dev', o.id));
  else location.replace(dcHash(DCS.site));
}
/* lector: solo acepta QR de esta misma app (nunca abre enlaces externos) */
function dcParseQR(text){
  const s = String(text || '').trim().slice(0, 500);
  const mm = s.match(/#\/tools\/dc\/([0-9a-f-]{36})\/q\/([0-9a-f-]{36})$/i); if (!mm) return null;
  if (/^https?:\/\//i.test(s)){ try { const u = new URL(s); if (u.origin !== location.origin || u.pathname !== location.pathname) return null; } catch { return null; } }
  if (!DC_UUID.test(mm[1]) || !DC_UUID.test(mm[2])) return null;
  return { site: mm[1], id: mm[2] };
}
async function dcScanQR(){
  const m = modal(`<h2>📷 Escanear etiqueta</h2><div class="dc-scan"><video id="qs-v" playsinline muted></video><div class="fr"></div></div><p class="muted sm" id="qs-m" style="text-align:center">Apuntá a la etiqueta QR del rack o del equipo.</p>
    <div class="row" style="justify-content:flex-end"><button class="btn sec" id="qs-x">Cerrar</button></div>`);
  let stream = null, alive = true;
  const stop = () => { alive = false; try { stream?.getTracks().forEach(t => t.stop()); } catch {} };
  $('#qs-x').onclick = () => { stop(); m.close(); };
  const obs = new MutationObserver(() => { if (!document.getElementById('qs-v')){ stop(); obs.disconnect(); } }); obs.observe($('#modal-root'), { childList: true });
  try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }); }
  catch { $('#qs-m').textContent = 'No se pudo usar la cámara. Revisá el permiso del navegador.'; return; }
  const video = $('#qs-v'); if (!video){ stop(); return; } video.srcObject = stream; await video.play().catch(() => {});
  const det = 'BarcodeDetector' in window ? new BarcodeDetector({ formats: ['qr_code'] }) : null;
  if (!det) needLib('jsqr').catch(() => {});
  const cv = document.createElement('canvas'), cx = cv.getContext('2d', { willReadFrequently: true });
  const tick = async () => {
    if (!alive) return;
    let txt = null;
    try {
      if (det){ const r = await det.detect(video); txt = r[0]?.rawValue || null; }
      else if (typeof jsQR === 'function' && video.videoWidth){ const W = 480, H = Math.round(video.videoHeight * 480 / video.videoWidth); cv.width = W; cv.height = H; cx.drawImage(video, 0, 0, W, H); const r = jsQR(cx.getImageData(0, 0, W, H).data, W, H, { inversionAttempts: 'dontInvert' }); txt = r?.data || null; }
    } catch {}
    if (txt){
      const q = dcParseQR(txt);
      if (q){ stop(); m.close(); location.hash = dcHash(q.site, 'q', q.id); return; }
      $('#qs-m').innerHTML = '<span style="color:var(--red)">Ese QR no es una etiqueta de esta app: no se abre.</span>';
    }
    setTimeout(tick, 220);
  };
  tick();
}

/* =====================================================================
   EXPORTAR A EXCEL  (las celdas que empiezan con = + - @ se neutralizan)
   ===================================================================== */
const dcXs = v => { if (v === null || v === undefined) return ''; if (typeof v === 'number') return v; const s = String(v); return /^[=+\-@\t\r]/.test(s) ? "'" + s : s; };
function dcExportExcel(){
  if (typeof XLSX === 'undefined') return void needLib('xlsx').then(dcExportExcel, e => toast(errText(e)));
  const I = DCS.I, wb = XLSX.utils.book_new(), add = (name, rows, widths) => { const ws = XLSX.utils.aoa_to_sheet(rows.map(r => r.map(dcXs))); if (widths) ws['!cols'] = widths.map(w => ({ wch: w })); XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31)); };
  const rk = d => dcRackOf(d)?.data?.name || 'Fuera de rack';
  add('Resumen', [['Data center', I.dc.data.name], ['Cliente', I.dc.data.client || ''], ['Dirección', I.dc.data.address || ''], ['Exportado', fmtDT(new Date())], ['Por', dcWho()], [], ['Racks', I.racks.length], ['Equipos', I.devices.filter(d => !['ciego', 'ordenador'].includes(dcDevRole(d))).length], ['Conexiones', I.cables.length], ['Circuitos', I.circuits.length]], [22, 50]);
  const elev = [['Rack', 'U', 'Frente', 'Trasera']];
  for (const r of I.racks){
    const H = dcRackH(r), devs = I.devByRack.get(r.id) || [];
    const at = (u, f) => devs.find(d => { const du = dcNum(d.data.u), h = dcDevU(d), ff = d.data.face || 'both'; return du && u >= du && u < du + h && (ff === 'both' || ff === f); });
    for (let u = H; u >= 1; u--){ const fa = at(u, 'front'), re = at(u, 'rear'); const lbl = (d, u) => !d ? 'Libre' : dcNum(d.data.u) + dcDevU(d) - 1 === u ? dcDevName(d) : '〃'; elev.push([r.data.name, u, lbl(fa, u), lbl(re, u)]); }
    elev.push([]);
  }
  add('Elevaciones', elev, [12, 5, 44, 44]);
  add('Equipos', [['Rack', 'U', 'Altura', 'Montaje', 'Nombre', 'Rol', 'Marca', 'Modelo', 'N° serie', 'Activo fijo', 'Estado', 'Consumo W', 'PDU A', 'PDU B', 'Notas']].concat(
    I.devices.slice().sort((a, b) => dcNat(rk(a), rk(b)) || dcNum(b.data.u) - dcNum(a.data.u)).map(d => { const m = dcDevModel(d); return [rk(d), d.data.u ?? '', dcDevU(d), { both: 'Frente y fondo', front: 'Frente', rear: 'Trasera' }[d.data.face || 'both'], dcDevName(d), DC_ROLE[dcDevRole(d)].n, m?.maker || '', m?.name || '', d.data.serial || '', d.data.asset || '', DC_STATUS[d.data.status] || 'Activo', dcNum(d.data.power_w ?? m?.power_w, 0) || '', dcDevName(I.by.get(d.data.pdu_a)) === '—' ? '' : dcDevName(I.by.get(d.data.pdu_a)), dcDevName(I.by.get(d.data.pdu_b)) === '—' ? '' : dcDevName(I.by.get(d.data.pdu_b)), d.data.notes || '']; })), [12, 5, 7, 14, 36, 16, 14, 26, 18, 14, 12, 10, 18, 18, 30]);
  const end = p => { const d = I.by.get(p?.dev); return [rk(d), d?.data?.u ?? '', dcDevName(d), p?.port ?? '', p?.side === 'F' ? 'Frente' : p?.side === 'R' ? 'Trasera' : '']; };
  add('Conexiones', [['Rack A', 'U A', 'Equipo A', 'Puerto A', 'Cara A', 'Rack B', 'U B', 'Equipo B', 'Puerto B', 'Cara B', 'Tipo', 'Color', 'Largo m', 'Etiqueta', 'Estado']].concat(
    I.cables.map(c => [...end(c.data.a), ...end(c.data.b), (DC_CABLE[c.data.type] || DC_CABLE.otro).n, c.data.color || '', c.data.length_m ?? '', c.data.label || '', DC_CABLE_ST[c.data.status] || 'Conectado'])), [12, 5, 32, 10, 8, 12, 5, 32, 10, 8, 12, 10, 8, 26, 12]);
  // recorridos completos (uno por cada par de puntas)
  const seen = new Set(), rec = [['Desde', 'Hasta', 'Tramos', 'Recorrido completo']];
  for (const d of I.devices){ if (dcIsPanel(d)) continue; for (const p of dcPorts(d)){ const at = I.cableAt.get(`${d.id}|${p.n}|`); if (!at) continue; const tr = dcTrace({ dev: d.id, port: p.n, side: '' }); const ns = tr.nodes.filter(n => n.t === 'n'); const a = dcEK(ns[0].p), b = dcEK(ns[ns.length - 1].p); const k = [a, b].sort().join('~'); if (seen.has(k)) continue; seen.add(k);
    rec.push([dcEndTxt(ns[0].p, true), dcEndTxt(ns[ns.length - 1].p, true), tr.hops, ns.map(n => dcEndTxt(n.p, true)).join('  →  ') + (tr.circ ? `  →  ${tr.circ.data.provider || ''} ${tr.circ.data.cid || ''}` : '')]); } }
  add('Recorridos', rec, [40, 40, 7, 140]);
  add('Carriers', [['Proveedor', 'Servicio', 'Tipo', 'Ancho de banda', 'Estado', 'Termina en', 'NOC', 'Notas']].concat(I.circuits.map(c => [c.data.provider || '', c.data.cid || '', c.data.type || '', c.data.bw || '', c.data.status || '', c.data.a?.dev ? dcEndTxt(c.data.a, true) : '', c.data.noc || '', c.data.notes || ''])), [16, 16, 12, 12, 10, 50, 26, 30]);
  const { L } = dcPduLoads();
  add('Energía', [['Rack', 'Carga W', 'Capacidad útil W', '%', 'PDU']].concat(I.racks.map(r => { const p = dcRackPower(r); return [r.data.name, Math.round(p.load), Math.round(p.cap), p.cap ? p.pct : '', p.pdus.map(x => dcDevName(x)).join(', ')]; })).concat([[], ['PDU', 'Rack', 'Normal W', 'Si cae el otro lado W', 'Equipos']]).concat([...L.values()].map(l => [dcDevName(l.pdu), rk(l.pdu), Math.round(l.normal), Math.round(l.worst), l.devs])), [24, 12, 16, 22, 40]);
  if (dcNet()){
    add('IP', [['IP', 'Equipo', 'Interfaz', 'Uso', 'Descripción']].concat(I.ips.slice().sort((a, b) => dcIp2n(a.data.address) - dcIp2n(b.data.address)).map(x => [x.data.address, dcDevName(I.by.get(x.data.dev)) === '—' ? '' : dcDevName(I.by.get(x.data.dev)), x.data.port || '', x.data.role || '', x.data.desc || ''])), [16, 32, 12, 10, 30]);
    add('Redes y VLAN', [['Red', 'Gateway', 'VLAN', 'Descripción']].concat(I.prefixes.map(p => [p.data.cidr, p.data.gateway || '', I.by.get(p.data.vlan)?.data?.vid ?? '', p.data.desc || ''])).concat([[], ['VLAN', 'Nombre', 'Descripción']]).concat(I.vlans.map(v => [v.data.vid, v.data.name || '', v.data.desc || ''])), [18, 16, 8, 40]);
  }
  const fn = `Relevamiento DC - ${String(I.dc.data.name).replace(/[\\/:*?"<>|]+/g, '-')} - ${todayStr ? todayStr() : new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fn);
  toast('Excel descargado');
}

/* =====================================================================
   INFORME PARA IMPRIMIR / PDF
   ===================================================================== */
function dcViewReport(v){
  const I = DCS.I;
  const racksU = I.racks.map(r => dcRackUse(r)); const H = racksU.reduce((a, b) => a + b.H, 0), U = racksU.reduce((a, b) => a + b.used, 0);
  const hasRear = r => (I.devByRack.get(r.id) || []).some(d => d.data.face === 'rear');
  v.innerHTML = `<div class="noprint">${dcTopBar(dcBack(I.dc.data.name, dcHash(DCS.site)))}<div class="card row between"><div><b>🧾 Informe del data center</b><div class="muted sm">Elevaciones de todos los racks, inventario y conexiones. Usá "Guardar como PDF" en la ventana de impresión.</div></div><button class="btn" id="rp-p">🖨️ Imprimir / PDF</button></div></div>
    <div class="card dc-print">
      <div class="row between" style="align-items:flex-start"><div><h1>${esc(I.dc.data.name)}</h1><div class="muted">${esc([I.dc.data.client, I.dc.data.address].filter(Boolean).join(' · '))}</div></div><div class="sm muted" style="text-align:right">Relevamiento DC · InspectApp<br>${esc(fmtDT(new Date()))}<br>${esc(dcWho())}</div></div>
      <div class="dc-tiles"><div class="dc-tile"><div><b>${I.racks.length}</b><span>racks</span></div></div><div class="dc-tile"><div><b>${dcPct(U, H)}%</b><span>ocupación (${H - U} U libres)</span></div></div><div class="dc-tile"><div><b>${I.devices.filter(d => !['ciego', 'ordenador'].includes(dcDevRole(d))).length}</b><span>equipos</span></div></div><div class="dc-tile"><div><b>${I.cables.length}</b><span>conexiones</span></div></div><div class="dc-tile"><div><b>${I.circuits.length}</b><span>circuitos</span></div></div></div>
      <h2 style="margin-top:18px">Elevaciones</h2>
      <div>${I.racks.map(r => `<div class="dc-rep-rack"><b>${esc(r.data.name)}</b> <span class="muted sm">${dcRackUse(r).pct}% · ${esc(I.by.get(r.data.room)?.data?.name || '')}</span>${dcRackSVG(r, { face: 'front', uh: 14 })}${hasRear(r) ? `<div class="sm muted">Trasera</div>${dcRackSVG(r, { face: 'rear', uh: 14 })}` : ''}</div>`).join('')}</div>
      <h2 style="margin-top:18px">Inventario</h2>
      <table class="tbl"><thead><tr><th>Rack</th><th>U</th><th>Equipo</th><th>Modelo</th><th>Serie</th><th>Estado</th></tr></thead><tbody>${I.devices.filter(d => !['ciego', 'ordenador', 'bandeja'].includes(dcDevRole(d))).sort((a, b) => dcNat(dcRackOf(a)?.data?.name, dcRackOf(b)?.data?.name) || dcNum(b.data.u) - dcNum(a.data.u)).map(d => `<tr><td>${esc(dcRackOf(d)?.data?.name || '—')}</td><td>${esc(d.data.u ?? '')}</td><td>${esc(dcDevName(d))}</td><td class="sm">${esc(dcModelLabel(dcDevModel(d)))}</td><td class="sm">${esc(d.data.serial || '')}</td><td class="sm">${esc(DC_STATUS[d.data.status] || 'Activo')}</td></tr>`).join('')}</tbody></table>
      <h2 style="margin-top:18px">Conexiones</h2>
      <table class="tbl"><thead><tr><th>Extremo A</th><th>Extremo B</th><th>Tipo</th><th>Etiqueta</th></tr></thead><tbody>${I.cables.map(c => `<tr><td class="sm">${esc(dcEndTxt(c.data.a, true))}</td><td class="sm">${esc(dcEndTxt(c.data.b, true))}</td><td class="sm">${esc((DC_CABLE[c.data.type] || DC_CABLE.otro).n)}</td><td class="sm">${esc(c.data.label || '')}</td></tr>`).join('')}</tbody></table>
      ${I.circuits.length ? `<h2 style="margin-top:18px">Circuitos de carrier</h2><table class="tbl"><thead><tr><th>Proveedor</th><th>Servicio</th><th>Tipo</th><th>Termina en</th></tr></thead><tbody>${I.circuits.map(c => `<tr><td>${esc(c.data.provider || '')}</td><td>${esc(c.data.cid || '')}</td><td>${esc([c.data.type, c.data.bw].filter(Boolean).join(' · '))}</td><td class="sm">${esc(c.data.a?.dev ? dcEndTxt(c.data.a, true) : '')}</td></tr>`).join('')}</tbody></table>` : ''}
    </div>`;
  dcBindTop(v); $('#rp-p').onclick = dcPrint;
}

/* =====================================================================
   BIBLIOTECA DE MODELOS
   ===================================================================== */
async function dcLoadModels(){
  if (!DCS.I){ DCS.objs = new Map(); dcReindex(); }
  const loc = (await DCDB.bySite('__models').catch(() => [])).filter(o => o.org_id === me.org_id);
  loc.forEach(o => DCS.objs.set(o.id, o));
  if (online()){ try { const { data } = await sb.from('dc_objects').select(DC_COLS).eq('kind', 'model').is('site_id', null).limit(2000); const pend = new Set((await DCDB.all('out').catch(() => [])).map(o => o.id)); const rows = (data || []).filter(r => !pend.has(r.id)).map(r => ({ ...r, site_id: '__models' })); if (rows.length) await DCDB.putMany('obj', rows); rows.forEach(o => DCS.objs.set(o.id, o)); } catch {} }
  dcReindex();
}
async function dcViewModels(v){
  await dcLoadModels();
  const render = () => {
    const q = dcNorm(DCS.view.mq || ''), rf = DCS.view.mr || '';
    const list = DCS.models.filter(m => (!rf || m.role === rf) && (!q || dcNorm(dcModelLabel(m)).includes(q)));
    v.innerHTML = `${dcTopBar(dcBack(DCS.site && DCS.I?.dc ? DCS.I.dc.data.name : 'Data centers', DCS.site && DCS.I?.dc ? dcHash(DCS.site) : '#/tools/dc'))}
      <div class="card"><div class="row between"><div><h2 style="margin:0">📚 Biblioteca de modelos</h2><p class="muted sm" style="margin:4px 0 0">Cada modelo define cuántas U ocupa y qué puertos tiene. Los de la empresa sirven para todos sus data centers.</p></div>${dcCanW() && !dcContr() ? '<button class="btn" id="md-new">+ Modelo</button>' : ''}</div>
        <div class="row" style="gap:8px;margin-top:12px"><input id="md-q" class="grow" placeholder="🔍 Buscar modelo" value="${esc(DCS.view.mq || '')}"><select id="md-r" style="width:auto"><option value="">Todos los roles</option>${Object.entries(DC_ROLE).map(([k, R]) => `<option value="${k}" ${rf === k ? 'selected' : ''}>${R.n}</option>`).join('')}</select></div></div>
      <div class="card"><div class="dc-list">${list.map(m => `<div class="dc-li" data-m="${esc(m.id)}"><span class="sw" style="background:${DC_ROLE[m.role]?.c || '#999'}"></span><div class="grow" style="min-width:0"><b style="font-size:14px">${esc(dcModelLabel(m))}</b><div class="muted" style="font-size:12px">${esc(DC_ROLE[m.role]?.n || '')} · ${m.u} U · ${dcModelPorts(m).length} puertos${m.power_w ? ' · ' + m.power_w + ' W' : ''}</div></div><span class="pill ${m.custom ? 'p-ok' : 'p-info'}">${m.custom ? 'de la empresa' : 'incluido'}</span></div>`).join('') || '<p class="muted">Sin resultados.</p>'}</div></div>`;
    dcBindTop(v);
    $('#md-q').oninput = e => { DCS.view.mq = e.target.value; clearTimeout(DCS.mqT); DCS.mqT = setTimeout(() => { render(); const i = $('#md-q'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250); };
    $('#md-r').onchange = e => { DCS.view.mr = e.target.value; render(); };
    $('#md-new')?.addEventListener('click', () => dcEditModel(null, render));
    v.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { const m = dcModel(b.dataset.m); dcEditModel(m, render); });
  };
  DCS.render = render; render();
}
const dcPortsToText = m => (m?.ports || []).map(g => g.names ? `${g.names.join(', ')} ${g.ty}` : `${g.pre || ''}${g.f}-${g.t} ${g.ty}`).join('\n');
function dcTextToPorts(t){
  const out = [];
  for (const line of String(t || '').split('\n').map(s => s.trim()).filter(Boolean).slice(0, 40)){
    const mm = line.match(/^(.*?)\s+([a-z0-9_]+)$/i); const body = mm ? mm[1] : line; let ty = mm ? mm[2].toLowerCase() : 'otro'; if (!(ty in DC_PORT_TY)) ty = 'otro';
    const r = body.match(/^(.*?)(\d+)\s*-\s*(\d+)$/);
    if (r){ const f = Number(r[2]), to = Number(r[3]); if (to >= f && to - f < 400) out.push({ pre: dcTxt(r[1], 20), f, t: to, ty }); }
    else out.push({ names: body.split(',').map(s => dcTxt(s, 30)).filter(Boolean).slice(0, 60), ty });
  }
  return out;
}
function dcEditModel(model, done){
  const ro = model && model.builtin; const d = model || { role: 'switch', u: 1, ports: [] };
  const m = modal(`<h2>${ro ? 'Modelo incluido' : model ? 'Modelo de la empresa' : 'Nuevo modelo'}</h2>${ro ? '<p class="muted sm">Los modelos incluidos no se editan. Podés duplicarlo y ajustarlo.</p>' : ''}
    <div class="row"><div class="grow"><label>Marca</label><input id="mo-mk" maxlength="60" value="${esc(d.maker || '')}" ${ro ? 'disabled' : ''}></div><div class="grow"><label>Modelo *</label><input id="mo-n" maxlength="80" value="${esc(d.name || '')}" ${ro ? 'disabled' : ''}></div></div>
    <div class="row"><div class="grow"><label>Rol</label><select id="mo-r" ${ro ? 'disabled' : ''}>${Object.entries(DC_ROLE).map(([k, R]) => `<option value="${k}" ${d.role === k ? 'selected' : ''}>${R.n}</option>`).join('')}</select></div><div><label>Altura (U)</label><input id="mo-u" type="number" min="0" max="20" value="${dcNum(d.u, 1)}" style="width:100px" ${ro ? 'disabled' : ''}></div><div><label>Consumo típico (W)</label><input id="mo-w" type="number" min="0" max="50000" value="${esc(d.power_w || '')}" style="width:140px" ${ro ? 'disabled' : ''}></div></div>
    <label style="display:flex;gap:8px;align-items:center;font-weight:400"><input type="checkbox" id="mo-p" ${d.panel ? 'checked' : ''} style="width:auto" ${ro ? 'disabled' : ''}> Es un panel de parcheo (cada puerto tiene frente y trasera)</label>
    <label>Puertos (una línea por grupo: "1-48 sfp28", "Eth1/1-24 rj45", "MGMT, CON mgmt")</label><textarea id="mo-ports" style="min-height:110px;font-family:ui-monospace,monospace" ${ro ? 'disabled' : ''}>${esc(dcPortsToText(d))}</textarea>
    <p class="sm muted" style="margin:4px 0 0">Tipos: ${Object.keys(DC_PORT_TY).join(', ')}</p>
    <div class="err" id="mo-e"></div>
    <div class="row between" style="margin-top:12px">${model ? '<button class="btn sec" id="mo-dup">Duplicar</button>' : '<span></span>'}<div class="row"><button class="btn sec" id="mo-x">${ro ? 'Cerrar' : 'Cancelar'}</button>${ro ? '' : '<button class="btn" id="mo-g">Guardar</button>'}</div></div>`, { wide: true });
  $('#mo-x').onclick = () => { m.close(); done && !model && done(null); };
  $('#mo-dup')?.addEventListener('click', () => { m.close(); dcEditModel({ maker: d.maker, name: d.name + ' (copia)', role: d.role, u: d.u, ports: d.ports, power_w: d.power_w, panel: d.panel }, done); });
  $('#mo-g')?.addEventListener('click', async () => {
    const name = dcTxt($('#mo-n').value, 80); if (!name) return ($('#mo-e').textContent = 'Poné el nombre del modelo.');
    const ports = dcTextToPorts($('#mo-ports').value);
    const data = { maker: dcTxt($('#mo-mk').value, 60), name, role: $('#mo-r').value in DC_ROLE ? $('#mo-r').value : 'otro', u: dcClamp(dcNum($('#mo-u').value, 1), 0, 20), power_w: dcClamp(dcNum($('#mo-w').value, 0), 0, 50000), panel: $('#mo-p').checked, ports };
    try { const o = await dcSave('model', model?.custom ? model.id : null, data); dcReindex(); m.close(); toast('Modelo guardado'); done && done({ ...o.data, id: o.id }); }
    catch (e){ $('#mo-e').textContent = errText(e); }
  });
}

/* =====================================================================
   IMPORTAR EL EXCEL DE RACKS (formato "una hoja por rack")
   Columnas: U | Frente | (Trasera) | … "Interconexión en Rack XX":
   Unidad · Detalle · Port | Unidad · Detalle · Port | INTER RACK | …
   Cada fila es un recorrido: equipo → panel → (troncal) → panel → equipo.
   ===================================================================== */
function dcImportModal(){
  const m = modal(`<h2>📥 Importar Excel de racks</h2>
    <p class="muted sm">Leé la planilla actual (una hoja por rack con su elevación y la tabla de interconexión). La app arma racks, equipos y conexiones, y te marca lo que no cierra para revisarlo en sitio. Formatos: .xlsx, .xlsb, .xls.</p>
    <input type="file" id="im-f" accept=".xlsx,.xlsb,.xls,.xlsm">
    <div id="im-r" style="margin-top:12px"></div>
    <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn sec" id="im-x">Cerrar</button><button class="btn hidden" id="im-g">Importar</button></div>`, { wide: true });
  $('#im-x').onclick = m.close;
  let plan = null;
  $('#im-f').onchange = async e => {
    const f = e.target.files?.[0]; if (!f) return;
    if (f.size > 15 * 1024 * 1024) return ($('#im-r').innerHTML = '<p class="err">El archivo es demasiado grande (máx. 15 MB).</p>');
    if (!/\.(xlsx|xlsb|xls|xlsm)$/i.test(f.name)) return ($('#im-r').innerHTML = '<p class="err">Elegí un archivo de Excel.</p>');
    $('#im-r').innerHTML = '<p class="muted">Leyendo…</p>';
    try {
      await needLib('xlsx');
      const wb = XLSX.read(new Uint8Array(await f.arrayBuffer()), { type: 'array', cellFormula: false, cellHTML: false, cellStyles: false, bookVBA: false, WTF: false });
      const sheets = wb.SheetNames.slice(0, 80).map(n => ({ name: n, rows: XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null, blankrows: true }).slice(0, 2000) }));
      plan = dcBuildImport(dcParseRackBook(sheets));
      const P = plan;
      $('#im-r').innerHTML = `<div class="dc-tiles" style="margin-top:0"><div class="dc-tile"><div><b>${P.newRacks.length}</b><span>racks nuevos</span></div></div><div class="dc-tile"><div><b>${P.devices.length}</b><span>equipos y paneles</span></div></div><div class="dc-tile"><div><b>${P.cables.length}</b><span>conexiones</span></div></div><div class="dc-tile" style="${P.issues.length ? 'background:#FEF6E4' : ''}"><div><b>${P.issues.length}</b><span>para revisar</span></div></div></div>
        ${P.skipRacks.length ? `<p class="sm" style="color:var(--amber)">Ya existen y no se tocan: ${esc(P.skipRacks.join(', '))}</p>` : ''}
        <div class="dc-chips" style="margin:10px 0">${P.newRacks.map(r => `<span class="dc-chip">${esc(r.data.name)} · ${esc(r.data.u_height)}U</span>`).join('')}</div>
        ${P.issues.length ? `<details><summary class="sm" style="cursor:pointer">Ver lo que hay que revisar (${P.issues.length})</summary><ul class="sm" style="max-height:220px;overflow:auto">${P.issues.slice(0, 300).map(x => `<li>${esc(x)}</li>`).join('')}</ul></details>` : ''}`;
      $('#im-g').classList.toggle('hidden', !(P.newRacks.length || P.cables.length));
    } catch (err){ console.error(err); $('#im-r').innerHTML = `<p class="err">No se pudo leer el archivo: ${esc(err.message || err)}</p>`; }
  };
  $('#im-g').onclick = async () => {
    if (!plan) return; $('#im-g').disabled = true; $('#im-g').textContent = 'Guardando…';
    try {
      const items = [...plan.rooms, ...plan.newRacks, ...plan.devices, ...plan.cables].map(o => ({ kind: o.kind, id: o.id, data: o.data }));
      for (let i = 0; i < items.length; i += 400) await dcSaveMany(items.slice(i, i + 400));
      const dc = DCS.I.dc; await dcSave('dc', dc.id, { ...dc.data, import_issues: (dc.data.import_issues || []).concat(plan.issues).slice(-300) });
      dcReindex(); m.close(); toast(`Importado: ${plan.newRacks.length} racks, ${plan.devices.length} equipos, ${plan.cables.length} conexiones`); DCS.view.tab = 'plano'; dcRefresh();
    } catch (e){ $('#im-g').disabled = false; $('#im-g').textContent = 'Reintentar'; toast(errText(e)); }
  };
}
const dcCell = v => v === null || v === undefined ? '' : String(v).replace(/\s+/g, ' ').trim();
const dcIsNum = v => typeof v === 'number' || /^\d{1,2}$/.test(dcCell(v));
function dcRackKey(s){ const t = dcNorm(s).replace(/\b(frente|trasero|trasera|atras|carrier)\b/g, '').trim(); const m = t.match(/rack\s*0*(\d+)/) || t.match(/^0*(\d{1,3})$/); return m ? 'r' + Number(m[1]) : t; }
const dcRackLbl = k => /^r\d+$/.test(k) ? 'Rack ' + k.slice(1).padStart(2, '0') : k;
function dcRackName(s){ const m = dcNorm(s).match(/rack\s*0*(\d+)/); return m ? 'Rack ' + String(Number(m[1])).padStart(2, '0') : dcTxt(s, 60); }
/* 1) lectura cruda: elevaciones y recorridos por hoja */
function dcParseRackBook(sheets){
  const racks = new Map(), paths = [], issues = [];
  DCS._lastBlock = null;
  for (const sh of sheets){
    const R = sh.rows; if (!R.length) continue;
    const carrier = /carrier/i.test(sh.name);
    // elevaciones: encabezados "Rack NN [Frente|Trasero]" en la primera fila con datos
    const hr = R.findIndex(r => (r || []).some(v => /^rack\s*\d+/i.test(dcCell(v))));
    if (hr < 0) continue;
    const head = R[hr] || [];
    for (let c = 0; c < head.length; c++){
      const t = dcCell(head[c]); if (!/^rack\s*\d+/i.test(t) || /interconex/i.test(t)) continue;
      const rear = /trasero|trasera|atr[aá]s/i.test(t);
      let ucol, ncol;
      const sample = R.slice(hr + 1, hr + 8).map(r => (r || [])[c]);
      if (sample.filter(dcIsNum).length >= 3){ ucol = c; ncol = c + 1; } else { ncol = c; ucol = [...Array(c).keys()].reverse().find(k => R.slice(hr + 1, hr + 8).filter(r => dcIsNum((r || [])[k])).length >= 3) ?? 0; }
      const key = dcRackKey(t); if (!racks.has(key)) racks.set(key, { key, name: dcRackName(t), H: 0, front: new Map(), rear: new Map(), carrier, sheet: sh.name });
      const rk = racks.get(key);
      for (let i = hr + 1; i < R.length; i++){
        const row = R[i] || []; const u = Number(dcCell(row[ucol])); if (!(u >= 1 && u <= 60) || !dcIsNum(row[ucol])) continue;
        rk.H = Math.max(rk.H, u);
        const v = row[ncol]; (rear ? rk.rear : rk.front).set(u, v === null || v === undefined || dcCell(v) === '' ? null : dcCell(v));
      }
    }
    // bloques de interconexión
    for (let i = 0; i < R.length; i++){
      const row = R[i] || [];
      const marks = []; row.forEach((v, c) => { if (/^interconex/i.test(dcCell(v))) marks.push(c); });
      for (let mi = 0; mi < marks.length; mi++){
        const c0 = marks[mi], c1 = marks[mi + 1] ?? Infinity;
        const label = dcCell(row[c0]); const bKey = dcRackKey(label.replace(/^interconexi[oó]n\s*(en)?/i, ''));
        const hdr = R[i + 1] || [];
        let starts = []; let rackCols = [];
        for (let c = c0; c < Math.min(c1, hdr.length + 1); c++){ const h = dcNorm(hdr[c]); if (h === 'unidad') starts.push(c); if (/inter ?rack/.test(h)) rackCols.push(c); }
        let first = i + 2;
        if (!starts.length){ // bloque sin encabezado: se usa la misma estructura (U·detalle·puerto ×2 + rack)
          const prev = DCS._lastBlock && DCS._lastBlock.c0 === c0 ? DCS._lastBlock : null;
          if (prev){ starts = prev.starts; rackCols = prev.rackCols; }
          else for (let c = c0, k = 0; c < Math.min(c1, c0 + 42); k++){ starts.push(c, c + 3); rackCols.push(c + 6); c += 7; }
          first = i + 1;
        } else DCS._lastBlock = { c0, starts, rackCols };
        for (let k = first; k < R.length; k++){
          const rr = R[k] || [];
          if (rr.slice(c0, Math.min(c1, rr.length)).some(v => /^interconex/i.test(dcCell(v)))) break;
          const trip = s => { const u = dcCell(rr[s]), n = dcCell(rr[s + 1]), p = dcCell(rr[s + 2]); return (u || n || p) ? { u, n, p } : null; };
          // segmentos: [T, T] | rack | [T, T] | rack | …
          const segs = []; let cur = { rack: bKey, rear: /tras|atr/i.test(label), t: [] };
          for (let c = c0; c < Math.min(c1, Math.max(rr.length, c0 + 1)); c++){
            if (rackCols.includes(c)){ segs.push(cur); cur = { rack: dcRackKey(dcCell(rr[c])) || '', rear: /tras|atr/i.test(dcCell(rr[c])), t: [] }; continue; }
            if (starts.includes(c)){ cur.t.push(trip(c)); }
          }
          segs.push(cur);
          if (!segs[0].t[0]) continue;
          paths.push({ sheet: sh.name, row: k + 1, segs: segs.filter(s => s.t.some(Boolean)) });
        }
      }
    }
  }
  return { racks: [...racks.values()].filter(r => r.H > 0).sort((a, b) => dcNat(a.name, b.name)), paths, issues };
}
function dcGuessModelId(name){
  const n = dcNorm(name);
  if (/panel.*ciego|^ciego/.test(n)) return 'g-ciego1';
  if (/^ordenador/.test(n)) return 'g-ord1';
  if (/fibra proveedor|proveedor/.test(n)) return 'g-carrier-fo';
  if (/panel.*(fibra|fo\b|optic)/.test(n)) return /\bsm\b|monomodo/.test(n) ? 'g-pfo-sm24' : 'g-pfo-mm24';
  if (/panel.*(utp|cat ?6|cat ?5)/.test(n)) return /6a/.test(n.replace(/\s/g, '')) ? 'g-putp6a-24' : 'g-putp6-24';
  if (/^cord|patch ?cord/.test(n)) return null;
  if (/\bpdu\b/.test(n)) return 'g-pdu';
  if (/monitor|kvm/.test(n)) return 'g-kvm';
  for (const m of DC_BUILTIN) if (m.rx && m.rx.test(n)) return m.id;
  if (/net ?app|pure storage|storage/.test(n)) return 'g-sto2';
  if (/switch|catalyst|nexus/.test(n)) return 'g-sw48';
  if (/firewall|fortigate|\bfw\b/.test(n)) return 'g-fw';
  if (/router/.test(n)) return 'g-router';
  if (/\bsrv|server|servidor|dell|hp |lenovo/.test(n)) return 'g-srv1';
  return null;
}
const dcCleanName = s => dcTxt(String(s || '').replace(/¿\s*\?/g, '').replace(/^equipo\s+/i, '').replace(/\s+/g, ' '), 120);
function dcNormPort(raw, dev){
  let s = dcCell(raw).replace(/\.0$/, ''); if (!s) return '';
  let m;
  if ((m = s.match(/^(?:port|puerto|pto|p)\s*0*(\d+)$/i))) return String(Number(m[1]));
  if (/^\d+$/.test(s)) return String(Number(s));
  if ((m = s.match(/^(eth|ge|te|gi|fc|sas|e0)\s*0*(\d+)$/i))) { const pre = m[1].toUpperCase(); const ports = dev ? dcPorts(dev).map(p => p.n) : []; const cand = [pre + ' ' + Number(m[2]), pre + Number(m[2])]; return cand.find(c => ports.includes(c)) || cand[ports.some(p => / /.test(p)) ? 0 : 1]; }
  if (/^(eth|mgmt|mgmt ?eth|gestion|gesti[oó]n|mgmt0)$/i.test(s)) { const ports = dev ? dcPorts(dev) : []; return (ports.find(p => p.ty === 'mgmt') || { n: 'MGMT' }).n; }
  if ((m = s.match(/^par\s*0*(\d+)$/i))) return 'Par ' + Number(m[1]);
  return s.slice(0, 40);
}
/* 2) armado de racks, equipos y cables contra lo que ya hay en el data center */
function dcBuildImport(raw){
  const I = DCS.I, issues = raw.issues.slice(), rooms = [], newRacks = [], devices = [], cables = [];
  // salas
  const roomFor = carrier => {
    const kind = carrier ? 'carrier' : 'sala';
    let r = I.rooms.find(x => x.data.kind === kind) || rooms.find(x => x.data.kind === kind);
    if (!r){ r = { kind: 'room', id: uid(), data: { name: carrier ? 'Sala de carrier' : 'Sala de equipos', kind, cols: carrier ? 6 : 12, rows: carrier ? 3 : 6 } }; rooms.push(r); }
    return r;
  };
  const rackByKey = new Map(); I.racks.forEach(r => rackByKey.set(dcRackKey(r.data.name), { obj: r, existing: true }));
  const skipRacks = [];
  const pos = new Map();
  for (const rk of raw.racks){
    if (rackByKey.has(rk.key)){ skipRacks.push(rk.name); continue; }
    const room = roomFor(rk.carrier); const k = room.id; const n = pos.get(k) || 0; pos.set(k, n + 1);
    const cols = room.data.cols || 12;
    const obj = { kind: 'rack', id: uid(), data: { name: rk.name, u_height: Math.max(rk.H, 1), room: room.id, x: n % cols, y: Math.floor(n / cols), facing: 'S', type: 'Gabinete 4 postes', notes: `Importado de la hoja "${rk.sheet}"` } };
    newRacks.push(obj); rackByKey.set(rk.key, { obj, existing: false, raw: rk });
  }
  // equipos desde la elevación (nombre en la U superior, celdas vacías debajo = mismo equipo)
  const devsOf = new Map(); // rackId -> [{obj,u,h,face,name}]
  const pushDev = (rackId, o) => { if (!devsOf.has(rackId)) devsOf.set(rackId, []); devsOf.get(rackId).push(o); };
  for (const [, ent] of rackByKey){
    if (ent.existing){ for (const d of (I.devByRack.get(ent.obj.id) || [])) pushDev(ent.obj.id, { obj: d, u: dcNum(d.data.u), h: dcDevU(d), face: d.data.face || 'both', name: dcDevName(d), existing: true }); continue; }
    const rk = ent.raw;
    const runs = face => {
      const map = face === 'rear' ? rk.rear : rk.front; const out = [];
      const dense = [...map.values()].filter(x => x !== null).length >= rk.H * 0.6; // columna completa: vacío = sigue el equipo de arriba
      let u = rk.H;
      while (u >= 1){
        const v = map.get(u);
        if (!v || /^libre$/i.test(v)){ u--; continue; }
        let low = u;
        if (dense) while (low - 1 >= 1 && map.has(low - 1) && map.get(low - 1) === null) low--;
        else { const mu = dcModel(dcGuessModelId(v))?.u || 1; low = Math.max(1, u - mu + 1); }
        out.push({ name: v, top: u, low }); u = low - 1;
      }
      return out;
    };
    const fr = runs('front'), re = rk.rear.size ? runs('rear') : [];
    const overl = (a, b) => a.low <= b.top && b.low <= a.top;
    const mk = (r, face) => {
      const unk = /¿|\?|no identificad/i.test(r.name); const mid = dcGuessModelId(r.name); const model = dcModel(mid);
      const role = unk ? 'desconocido' : (model?.role || 'otro');
      const name = ['ciego', 'ordenador'].includes(role) ? '' : (/^panel\b/i.test(r.name) || role === 'panel_fo' || role === 'panel_utp' ? dcTxt(r.name, 120) : dcCleanName(r.name));
      const o = { kind: 'device', id: uid(), data: { model: mid, role: unk ? 'desconocido' : role, h: r.top - r.low + 1, u: r.low, rack: ent.obj.id, face, name, status: unk ? 'desconocido' : 'activo', notes: unk ? `En el Excel figuraba como "${dcTxt(r.name, 120)}"` : '' } };
      if (unk) issues.push(`${rk.name} U${r.low}${r.top > r.low ? '–' + r.top : ''}: equipo a identificar ("${dcTxt(r.name, 80)}")`);
      if (!mid && !unk) issues.push(`${rk.name} U${r.low}: no se reconoció el modelo de "${dcTxt(r.name, 80)}" (quedó como "Otro equipo")`);
      devices.push(o); pushDev(ent.obj.id, { obj: o, u: r.low, h: r.top - r.low + 1, face, name: r.name });
    };
    fr.forEach(r => mk(r, re.some(x => overl(x, r)) ? 'front' : 'both'));
    re.forEach(r => mk(r, 'rear'));
  }
  // resolver un "Unidad · Detalle" de una planilla contra los equipos del rack
  const extByName = new Map();
  const resolve = (rackKey, t, ctx, rearRack) => {
    if (!t) return null; const nm = dcCell(t.n); if (!nm && !t.u) return null;
    if (/^(libre|sin conexi[oó]n|-|n\/?a)$/i.test(nm)) return null;
    const ent = rackByKey.get(rackKey);
    if (!ent){ issues.push(`${ctx}: el rack "${dcRackLbl(rackKey)}" no existe en la planilla`); return null; }
    const list = devsOf.get(ent.obj.id) || [];
    const um = String(t.u || '').match(/(\d+)/); const u = um ? Number(um[1]) : null; const rearHint = rearRack || /tras|atr/i.test(String(t.u || ''));
    const wantPanel = /panel|fibra proveedor/i.test(nm);
    if (u){
      const cands = list.filter(x => u >= x.u && u < x.u + x.h && !['ciego', 'ordenador'].includes(x.obj.data.role));
      let hit = cands.find(x => rearHint ? x.face === 'rear' : x.face !== 'rear') || cands[0];
      if (cands.length > 1){ const byName = cands.find(x => dcNorm(x.name).includes(dcNorm(nm).slice(0, 12))); if (byName) hit = byName; }
      if (hit){
        const isPanel = dcIsPanel(hit.obj);
        if (wantPanel !== isPanel){ issues.push(`${ctx}: dice "${dcTxt(nm, 60)}" en U${u} de ${dcRackLbl(rackKey)}, pero ahí está "${dcTxt(hit.name, 60)}" — conexión no importada`); return null; }
        return hit.obj;
      }
    }
    // por nombre dentro del rack
    const byN = list.find(x => dcNorm(x.name) === dcNorm(nm));
    if (byN) return byN.obj;
    if (u && !/pdu|radio|ap\b|ap-/i.test(nm)){ issues.push(`${ctx}: "${dcTxt(nm, 60)}" en U${u} de ${dcRackLbl(rackKey)} no figura en la elevación — conexión no importada`); return null; }
    // equipos fuera del rack (PDU, radios, AP…)
    const k = ent.obj.id + '|' + dcNorm(nm);
    if (!extByName.has(k)){
      const pdu = /\bpdu\b/i.test(nm);
      const o = { kind: 'device', id: uid(), data: { model: pdu ? 'g-pdu' : 'g-ext', role: pdu ? 'pdu' : 'externo', h: 0, u: null, rack: ent.obj.id, face: 'both', name: dcTxt(nm, 120), status: 'activo' } };
      devices.push(o); extByName.set(k, o); pushDev(ent.obj.id, { obj: o, u: 0, h: 0, face: 'both', name: nm });
    }
    return extByName.get(k);
  };
  // cables: equipo —frente→ panel —trasera→ panel —frente→ equipo …
  const used = new Map(); I.cableAt.forEach((v, k) => used.set(k, 'existente'));
  const keyOf = new Set(I.cables.map(c => [dcEK(c.data.a), dcEK(c.data.b)].sort().join('~')));
  const pendingPorts = new Map(); // devId -> Set(ports)
  const portOf = (dev, raw) => dcNormPort(raw, dev);
  const link = (A, pa, sa, B, pb, sb2, kind, ctx) => {
    if (!A || !B || !pa || !pb) return;
    const ea = { dev: A.id, port: pa }, eb = { dev: B.id, port: pb };
    if (dcIsPanelObj(A)) ea.side = sa; if (dcIsPanelObj(B)) eb.side = sb2;
    const k1 = dcEK(ea), k2 = dcEK(eb); if (k1 === k2) return;
    const key = [k1, k2].sort().join('~'); if (keyOf.has(key)) return;
    const u1 = used.get(k1), u2 = used.get(k2);
    if (u1 || u2){ issues.push(`${ctx}: ${dcTxt(dcDevLabelImp(u1 ? A : B), 50)} puerto ${u1 ? pa : pb} ya estaba conectado (${u1 || u2}) — se dejó la primera conexión`); return; }
    const type = kind === 'trunk' ? dcGuessCableImp(A, B) : dcGuessCableImp(A, B);
    cables.push({ kind: 'cable', id: uid(), data: { a: ea, b: eb, type, status: 'conectado', label: '', color: '', notes: `Importado (${ctx})` } });
    keyOf.add(key); used.set(k1, ctx); used.set(k2, ctx);
    [[A, pa], [B, pb]].forEach(([d, p]) => { if (!pendingPorts.has(d.id)) pendingPorts.set(d.id, new Set()); pendingPorts.get(d.id).add(p); });
  };
  for (const P of raw.paths){
    const ctx = `hoja "${P.sheet}" fila ${P.row}`;
    const seg = P.segs; if (!seg.length) continue;
    const s0 = seg[0]; const T0 = resolve(s0.rack, s0.t[0], ctx, s0.rear); const T1 = resolve(s0.rack, s0.t[1], ctx, s0.rear);
    const p0 = T0 && portOf(T0, s0.t[0].p), p1 = T1 && portOf(T1, s0.t[1]?.p);
    if (T0 && T1) link(T1, p1, 'F', T0, p0, 'F', 'patch', ctx);
    let prev = T0, prevP = p0;
    for (let i = 1; i < seg.length; i++){
      const s = seg[i]; if (!s.rack){ break; }
      const A = resolve(s.rack, s.t[0], ctx, s.rear), B = resolve(s.rack, s.t[1], ctx, s.rear);
      const pa = A && portOf(A, s.t[0].p), pb = B && portOf(B, s.t[1]?.p);
      if (prev && A){ if (dcIsPanelObj(prev) && dcIsPanelObj(A)) link(prev, prevP, 'R', A, pa, 'R', 'trunk', ctx); else issues.push(`${ctx}: el salto a ${dcRackLbl(s.rack)} no sale de un panel — revisar`); }
      if (A && B) link(A, pa, 'F', B, pb, 'F', 'patch', ctx);
      prev = B && dcIsPanelObj(B) ? B : null; prevP = pb;
    }
  }
  // puertos que no estaban en el modelo → se agregan al equipo; paneles con más de 24 puertos → modelo de 48
  for (const d of devices){
    const ps = pendingPorts.get(d.id); if (!ps) continue;
    const m = dcModel(d.data.model);
    if (m?.panel){ const max = Math.max(...[...ps].map(p => Number(String(p).replace(/\D/g, '')) || 0)); if (max > 24){ const alt = d.data.model.replace(/24$/, '48'); if (dcModel(alt)) d.data.model = alt; } }
    const have = new Set(dcModelPorts(dcModel(d.data.model)).map(p => p.n));
    const extra = [...ps].filter(p => !have.has(p)).sort(dcNat).map(n => ({ n, ty: 'otro' }));
    if (extra.length) d.data.extra_ports = extra.slice(0, 200);
  }
  for (const [id, ps] of pendingPorts){ const ex = I.by.get(id); if (!ex) continue; const have = new Set(dcPorts(ex).map(p => p.n)); const extra = [...ps].filter(p => !have.has(p)).map(n => ({ n, ty: 'otro' })); if (extra.length) devices.push({ kind: 'device', id: ex.id, data: { ...ex.data, extra_ports: (ex.data.extra_ports || []).concat(extra) } }); }
  return { rooms, newRacks, devices, cables, issues: [...new Set(issues)], skipRacks };
}
function dcIsPanelObj(o){ if (!o) return false; const m = dcModel(o.data.model); return !!(o.data.panel ?? m?.panel ?? ['panel_fo', 'panel_utp'].includes(o.data.role || m?.role)); }
function dcDevLabelImp(o){ return o?.data?.name || dcModel(o?.data?.model)?.name || 'Equipo'; }
function dcGuessCableImp(A, B){
  const r = o => o.data.role || dcModel(o.data.model)?.role, mm = o => dcModel(o.data.model)?.id || '';
  const ids = [mm(A), mm(B)];
  if (ids.some(x => /pfo-sm|carrier-fo/.test(x))) return 'fibra_sm';
  if (ids.some(x => /pfo-mm/.test(x))) return 'fibra_mm';
  if (ids.some(x => /putp/.test(x))) return 'utp';
  if ([r(A), r(B)].includes('san')) return 'fc';
  if ([r(A), r(B)].includes('pdu')) return 'utp';
  return 'otro';
}
