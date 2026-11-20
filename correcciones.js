/* =========================================================
   ✏️ CORREGIR UN DATO DE UNA INSPECCIÓN ENVIADA · v5.21
   Quien la hizo (técnico o contratista) corrige respuestas, notas y fotos hasta 7 días después.
   Se aplica en el momento por la función del servidor insp_fix (valida todo y guarda el antes / después).
   Supervisor, coordinador, PM o administrador: "Visto, queda así" o "Revertir" (insp_fix_decide).
   Nada de esto sale en el PDF: las marcas y el historial llevan .no-print.
   ========================================================= */
const FX_DAYS = 7;
const FX_YN = { yesno: [['si', 'Sí'], ['no', 'No'], ['na', 'N/A']], okfail: [['ok', 'OK'], ['falla', 'Falla'], ['na', 'N/A']], brm: [['b', 'Bueno'], ['r', 'Regular'], ['m', 'Malo'], ['na', 'N/A']] };
const fxLimit = ins => new Date(Date.parse(ins.completed_at) + FX_DAYS * 864e5);
const fxCan = ins => canWrite() && online() && ins.status === 'completada' && (isManager() || (ins.inspector_id === me.id && Date.now() <= fxLimit(ins).getTime()));
function fxTxt(it, a){
  a = a || {}; if (a.na === true) return 'N/A';
  const v = a.value; if (v === undefined || v === null || v === '') return '—';
  if (FX_YN[it.type]) return (FX_YN[it.type].find(x => x[0] === v) || [0, String(v)])[1];
  if (it.type === 'number') return `${v} ${it.unit || ''}`.trim();
  return String(v);
}
function fxCss(){
  if (document.getElementById('fx-css')) return;
  const s = document.createElement('style'); s.id = 'fx-css';
  s.textContent = `
.fx-mark{grid-column:1/-1;font-size:12px;border-radius:8px;padding:5px 9px;background:#FEF3C7;color:#92400E;margin-top:4px}
.fx-mark.seen{background:#DCFCE7;color:#166534}
.fx-panel{margin-top:14px;display:grid;gap:10px}
.fx-card{border:1px solid var(--line);border-radius:12px;padding:10px 12px;display:grid;gap:6px;font-size:13px;background:var(--card)}
.fx-hd{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center}
.fx-ba{display:grid;grid-template-columns:1fr 1fr;gap:8px}.fx-ba > div{background:var(--bg);border-radius:8px;padding:6px 8px;min-width:0;overflow-wrap:anywhere}
.fx-ba small{display:block;font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:2px}
.fx-ths{display:flex;gap:6px;flex-wrap:wrap}.fx-ths img{width:84px;height:100px;object-fit:cover;border-radius:6px;border:1px solid var(--line);display:block;background:#E5E7EB}
.fx-chip{font-size:11.5px;border-radius:20px;padding:2px 9px;white-space:nowrap}.fx-chip.open{background:#FEF3C7;color:#92400E}.fx-chip.seen{background:#DCFCE7;color:#166534}.fx-chip.rev{background:#FDE8E8;color:#B91C1C}
#fx-root{position:fixed;inset:0;z-index:1000;background:rgba(10,20,30,.5);display:grid;place-items:center;padding:16px max(16px,env(safe-area-inset-right,0px)) calc(16px + env(safe-area-inset-bottom,0px)) max(16px,env(safe-area-inset-left,0px))}
.fx-sheet{background:var(--card);border-radius:16px;max-width:560px;width:100%;max-height:calc(100vh - 32px);overflow:auto;padding:18px;display:grid;gap:8px}
.fx-sheet h2{margin:0 0 4px}
.fx-opts{display:flex;gap:6px;flex-wrap:wrap}.fx-opts button{border:1px solid var(--line);background:var(--card);border-radius:9px;padding:7px 14px;font-weight:600;cursor:pointer;color:inherit;font:inherit}
.fx-opts button.on{background:var(--navy);border-color:var(--navy);color:#fff}
.fx-th{position:relative;width:92px}.fx-th img{width:92px;height:108px;object-fit:cover;border-radius:8px;display:block;border:1px solid var(--line);background:#E5E7EB}
.fx-th.gone img{opacity:.3;filter:grayscale(1)}.fx-th button{position:absolute;top:4px;right:4px;border:0;border-radius:6px;background:rgba(0,0,0,.65);color:#fff;font-size:11px;padding:2px 6px;cursor:pointer}
.fx-th .vid{width:92px;height:108px;border-radius:8px;background:#1F2937;color:#fff;display:grid;place-items:center;font-size:22px}
@media print{.no-print{display:none!important}}`;
  document.head.appendChild(s);
}

/* ---------- en el informe: botón, marcas por ítem e historial ---------- */
async function fixDecorate(v, ins, def){
  fxCss();
  if (!v.isConnected || ins.status !== 'completada') return;
  let list = [];
  try { const { data, error } = await sb.from('insp_fixes').select('*').eq('inspection_id', ins.id).order('id'); if (error) throw error; list = data || []; } catch { return; }
  if (!v.isConnected) return;
  const items = def.sections.flatMap(s => s.items), itOf = id => items.find(i => i.id === id);
  // marcas (solo en la app)
  v.querySelectorAll('.fx-mark').forEach(x => x.remove());
  const last = new Map(); list.filter(f => f.status !== 'revertida').forEach(f => last.set(f.item_id, f));
  last.forEach((f, id) => { const el = v.querySelector(`.rp-item[data-it="${CSS.escape(id)}"]`); if (!el) return;
    const d = document.createElement('div'); d.className = 'fx-mark no-print' + (f.status === 'vista' ? ' seen' : '');
    d.textContent = `✏️ Corregido el ${fmtDT(f.at)} por ${f.by_name || 'quien la hizo'}: ${f.reason}${f.status === 'vista' ? ' · revisado ✓' : ' · sin revisar'}`; el.appendChild(d); });
  // botón
  const bar = v.querySelector('.report-bar .row');
  v.querySelector('#b-fix')?.remove();
  if (bar && fxCan(ins)){ const b = document.createElement('button'); b.className = 'btn'; b.id = 'b-fix'; b.textContent = '✏️ Corregir un dato'; b.onclick = () => fixSheet(v, ins, def); bar.prepend(b); }
  // historial
  v.querySelector('#fx-panel')?.remove();
  const mine = ins.inspector_id === me.id, lim = fxLimit(ins), open = list.filter(f => f.status === 'sin_revisar');
  if (!list.length && !(mine && fxCan(ins))) return;
  const p = document.createElement('div'); p.id = 'fx-panel'; p.className = 'fx-panel no-print';
  const head = mine && !isManager() ? (Date.now() <= lim.getTime() ? `Podés corregir datos hasta el ${fmtDate(lim.toISOString())}. La corrección se aplica en el momento y la revisa tu supervisor. El PDF que va al cliente sale sin marcas.` : 'Pasaron 7 días desde que la enviaste: para corregir algo, pedíselo al supervisor.')
    : isManager() && open.length ? `${open.length} ${open.length > 1 ? 'correcciones' : 'corrección'} sin revisar. Ya están aplicadas; si alguna no corresponde, revertila y el ítem vuelve a como estaba.` : '';
  p.innerHTML = `<div class="row between" style="flex-wrap:wrap;gap:6px"><h3 style="margin:0">✏️ Correcciones</h3><span class="muted sm">No salen en el PDF</span></div>${head ? `<p class="muted sm" style="margin:0">${esc(head)}</p>` : ''}
    ${list.slice().reverse().map(f => { const it = itOf(f.item_id) || { label: f.item_label || f.item_id, type: 'text' };
      const show = a => { const ph = (a?.photos || []); return `${it.type === 'photo' ? '' : `<b>${esc(fxTxt(it, a))}</b>`}${a?.note ? `<div class="muted sm">${esc(a.note)}</div>` : ''}${ph.length ? `<div class="fx-ths">${ph.map(x => x.kind === 'video' ? '<div class="fx-th"><div class="vid">▶</div></div>' : `<img alt="Foto" data-path="${esc(x.path)}">`).join('')}</div>` : ''}`; };
      const warn = (f.after?.photos || []).filter(x => x.fix).map(x => (x.src === 'galeria' ? 'Foto de la galería' : 'Foto de la cámara') + (x.ts ? ', sacada el ' + fmtDT(x.ts) : '') + (x.warn ? ' · ' + x.warn.replace(/^De la galería,\s*/, '') : ''));
      return `<div class="fx-card"><div class="fx-hd"><b>${esc(it.label)}</b><span class="fx-chip ${f.status === 'vista' ? 'seen' : f.status === 'revertida' ? 'rev' : 'open'}">${f.status === 'vista' ? 'Revisada ✓' : f.status === 'revertida' ? 'Revertida' : 'Sin revisar'}</span></div>
        <div class="muted sm">${esc(f.by_name || '')}${f.by_role === 'contratista' ? ' (contratista)' : ''} · ${esc(fmtDT(f.at))}</div><div>Motivo: ${esc(f.reason)}</div>
        <div class="fx-ba"><div><small>Antes</small>${show(f.before)}</div><div><small>Después</small>${show(f.after)}</div></div>
        ${warn.length ? `<div class="muted sm">📷 ${esc(warn.join(' · '))}</div>` : ''}
        ${f.decided_at ? `<div class="muted sm">${f.status === 'revertida' ? 'Revertida' : 'Revisada'} por ${esc(f.decided_name || '')} el ${esc(fmtDT(f.decided_at))}${f.decided_note ? ': ' + esc(f.decided_note) : ''}</div>` : ''}
        ${isManager() && canWrite() && f.status === 'sin_revisar' ? `<div class="row" style="gap:6px"><button class="btn small" data-fxok="${f.id}">Visto, queda así</button><button class="btn sec small" data-fxrev="${f.id}" style="color:var(--no)">Revertir</button></div>`
          : isManager() && canWrite() && f.status === 'vista' ? `<div><button class="btn sec small" data-fxrev="${f.id}" style="color:var(--no)">Revertir</button></div>` : ''}</div>`; }).join('') || '<p class="muted sm" style="margin:0">Todavía no hay correcciones.</p>'}`;
  (v.querySelector('#report') || v).after(p);
  hydrate(p);
  p.querySelectorAll('[data-fxok]').forEach(b => b.onclick = async () => { b.disabled = true;
    const { error } = await sb.rpc('insp_fix_decide', { p_fix: +b.dataset.fxok, p_ok: true, p_note: '' }); if (error){ b.disabled = false; return toast(errText(error)); }
    toast('Corrección revisada.'); fixDecorate(v, ins, def); });
  p.querySelectorAll('[data-fxrev]').forEach(b => b.onclick = () => fixRevert(v, ins, def, list.find(f => f.id === +b.dataset.fxrev)));
}
async function fxReload(v, ins){ IDB.del('insp', ins.id).catch(() => {}); await viewReport(v, ins.id); }
function fxRoot(html){ fxCss(); let r = document.getElementById('fx-root'); if (!r){ r = document.createElement('div'); r.id = 'fx-root'; const mr = document.getElementById('modal-root'); mr ? mr.before(r) : document.body.appendChild(r); } r.innerHTML = html; return r; }
const fxClose = () => document.getElementById('fx-root')?.remove();

function fixRevert(v, ins, def, f){
  const r = fxRoot(`<div class="fx-sheet" role="dialog" aria-label="Revertir corrección"><h2>Revertir corrección</h2><p class="muted sm" style="margin:0">"${esc(f.item_label || '')}" vuelve a como estaba antes de esa corrección. Quien la hizo recibe el motivo.</p>
    <label for="fx-rn">Motivo (obligatorio)</label><input id="fx-rn" maxlength="300" placeholder="Ej.: la foto nueva no es de este sitio"><p class="muted sm" id="fx-re" style="margin:0"></p>
    <div class="row" style="justify-content:flex-end;gap:6px"><button class="btn sec" id="fx-rx">Cancelar</button><button class="btn" id="fx-rok" style="background:var(--no)">Revertir</button></div></div>`);
  r.querySelector('#fx-rx').onclick = fxClose;
  r.querySelector('#fx-rok').onclick = async () => { const note = r.querySelector('#fx-rn').value.trim(); if (note.length < 5) return (r.querySelector('#fx-re').textContent = 'Escribí el motivo.');
    if (!needOnline()) return; const b = r.querySelector('#fx-rok'); b.disabled = true;
    const cur = (await loadInspection(ins.id)) || ins, ans = { ...(cur.answers || {}), [f.item_id]: f.before }, sc = computeScore(def, ans);
    const { error } = await sb.rpc('insp_fix_decide', { p_fix: f.id, p_ok: false, p_note: note, p_score: sc.score, p_max: sc.max, p_flagged: sc.flagged, p_flagged_items: sc.flaggedItems });
    if (error){ b.disabled = false; return (r.querySelector('#fx-re').textContent = errText(error)); }
    fxClose(); toast('Corrección revertida: el ítem volvió a como estaba.'); fxReload(v, ins); };
}

/* ---------- hoja: corregir un dato ---------- */
function fixSheet(v, ins, def){
  if (!needOnline()) return;
  const items = def.sections.flatMap(s => s.items).filter(it => !['heading', 'signature'].includes(it.type));
  if (!items.length) return toast('Esta inspección no tiene ítems para corregir.');
  let it = items[0], d = null, busy = 0;
  const load = () => { const a = (ins.answers || {})[it.id] || {}; d = { value: a.value ?? '', na: a.na === true, note: a.note || '', photos: (a.photos || []).map(p => ({ ...p, keep: true })) }; };
  load();
  const editor = () => {
    if (FX_YN[it.type]) return `<label>Respuesta</label><div class="fx-opts">${FX_YN[it.type].map(([k, t]) => `<button type="button" data-fv="${k}" class="${d.value === k ? 'on' : ''}">${t}</button>`).join('')}</div>`;
    if (it.type === 'select') return `<label>Respuesta</label><div class="fx-opts">${(it.options || []).map(o => `<button type="button" data-fv="${esc(o)}" class="${!d.na && d.value === o ? 'on' : ''}">${esc(o)}</button>`).join('')}<button type="button" data-fna class="${d.na ? 'on' : ''}">N/A</button></div>`;
    if (it.type === 'multi'){ const sel = d.na ? [] : multiVals(d.value); return `<label>Respuesta (podés marcar varias)</label><div class="fx-opts">${(it.options || []).map(o => `<button type="button" data-fmv="${esc(o)}" class="${sel.includes(o) ? 'on' : ''}">${sel.includes(o) ? '☑' : '☐'} ${esc(o)}</button>`).join('')}<button type="button" data-fna class="${d.na ? 'on' : ''}">N/A</button></div>`; }
    if (it.type === 'number') return `<label for="fx-v">Valor${it.unit ? ' (' + esc(it.unit) + ')' : ''}</label><input id="fx-v" inputmode="decimal" value="${esc(d.na ? '' : d.value)}">`;
    if (it.type === 'date' || it.type === 'time') return `<label for="fx-v">Respuesta</label><input id="fx-v" type="${it.type}" value="${esc(d.value)}">`;
    if (it.type === 'text') return `<label for="fx-v">Respuesta</label>${it.long ? `<textarea id="fx-v" rows="3" maxlength="4000">${esc(d.value)}</textarea>` : `<input id="fx-v" maxlength="4000" value="${esc(d.value)}">`}`;
    if (it.type === 'photo') return '';
    return `<p class="muted sm" style="margin:0">En este tipo de ítem se corrigen la nota y las fotos.</p>`;
  };
  const r = fxRoot('');
  const keep = () => { const x = r.querySelector('#fx-v'); if (x){ d.value = x.value; if (x.value !== '') d.na = false; } d.note = r.querySelector('#fx-n')?.value ?? d.note; };
  const paint = () => {
    r.innerHTML = `<div class="fx-sheet" role="dialog" aria-label="Corregir un dato"><h2>✏️ Corregir un dato</h2>
      <p class="muted sm" style="margin:0">Sitio, fecha, horas, ubicación y técnico no se cambian. La foto que quitás no se borra: queda en el historial.</p>
      <label for="fx-it">Ítem</label><select id="fx-it">${items.map(x => `<option value="${esc(x.id)}" ${x === it ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</select>
      ${editor()}
      <label>Fotos</label><div class="fx-ths" id="fx-ths">${d.photos.map((p, k) => `<div class="fx-th ${p.keep ? '' : 'gone'}">${p.kind === 'video' ? '<div class="vid">▶</div>' : `<img alt="Foto" ${p._url ? `src="${p._url}"` : `data-path="${esc(p.path)}"`}>`}<button type="button" data-fk="${k}">${p.keep ? 'Quitar' : 'Volver'}</button></div>`).join('') || '<span class="muted sm">Sin fotos</span>'}</div>
      <div class="row" style="gap:6px"><button type="button" class="btn sec small" id="fx-cam">📷 Sacar foto</button><label class="btn sec small" style="cursor:pointer">🖼️ Galería<input type="file" accept="image/jpeg,image/png,image/webp" multiple id="fx-gal" class="hidden"></label><input type="file" accept="image/*" capture="environment" id="fx-camf" class="hidden">${busy ? `<span class="muted sm">Subiendo ${busy} foto${busy > 1 ? 's' : ''}…</span>` : ''}</div>
      <label for="fx-n">Nota del ítem</label><input id="fx-n" maxlength="1000" value="${esc(d.note)}">
      <label for="fx-r">Motivo de la corrección (obligatorio)</label><input id="fx-r" maxlength="300" placeholder="Ej.: subí la foto del aire en vez de la del tablero" value="${esc(r._reason || '')}">
      <p class="muted sm" id="fx-e" style="margin:0;color:var(--no)"></p>
      <div class="row" style="justify-content:flex-end;gap:6px"><button class="btn sec" id="fx-x">Cancelar</button><button class="btn" id="fx-ok" ${busy ? 'disabled' : ''}>Guardar corrección</button></div></div>`;
    hydrate(r.querySelector('#fx-ths'));
    r.querySelector('#fx-it').onchange = e => { r._reason = r.querySelector('#fx-r').value; it = items.find(x => x.id === e.target.value); load(); paint(); };
    r.querySelectorAll('[data-fv]').forEach(b => b.onclick = () => { keep(); r._reason = r.querySelector('#fx-r').value; d.value = b.dataset.fv; d.na = false; paint(); });
    r.querySelectorAll('[data-fmv]').forEach(b => b.onclick = () => { keep(); r._reason = r.querySelector('#fx-r').value; let sel = d.na ? [] : multiVals(d.value); const o = b.dataset.fmv;
      sel = sel.includes(o) ? sel.filter(x => x !== o) : [...sel, o]; sel = (it.options || []).filter(x => sel.includes(x)); d.value = sel.join(MULTI_SEP); d.na = false; paint(); });
    r.querySelector('[data-fna]')?.addEventListener('click', () => { keep(); r._reason = r.querySelector('#fx-r').value; d.na = true; d.value = null; paint(); });
    r.querySelectorAll('[data-fk]').forEach(b => b.onclick = () => { keep(); r._reason = r.querySelector('#fx-r').value; const p = d.photos[+b.dataset.fk]; if (p.fix && p._new) d.photos.splice(+b.dataset.fk, 1); else p.keep = !p.keep; paint(); });
    r.querySelector('#fx-x').onclick = fxClose;
    const add = async (files, gal) => { keep(); r._reason = r.querySelector('#fx-r').value; busy += files.length; paint();
      const t0 = Date.parse(ins.started_at) || Date.now(); let warned = 0;
      for (const f of files){
        try {
          if (!/^image\//.test(f.type)) throw new Error('Solo fotos.');
          const meta = await jpegMeta(f), blob = await compressImage(f, ...photoQ(), meta), path = `${ins.org_id}/${ins.id}/${uid()}.jpg`;
          const { error } = await sb.storage.from('fotos').upload(path, blob, { contentType: 'image/jpeg', upsert: false }); if (error) throw error;
          let rec;
          if (gal){ const taken = meta.taken || (f.lastModified ? new Date(f.lastModified) : null), w = [];
            if (taken && Math.abs(taken.getTime() - t0) > 12 * 3600000) w.push('sacada el ' + fmtDT(taken.toISOString()));
            if (meta.lat != null && ins.lat != null && kmBetween({ lat: meta.lat, lng: meta.lng }, { lat: ins.lat, lng: ins.lng }) > 1) w.push(`a ${kmBetween({ lat: meta.lat, lng: meta.lng }, { lat: ins.lat, lng: ins.lng }).toFixed(1)} km del sitio`);
            if (w.length) warned++;
            rec = { path, ts: (taken && !isNaN(taken) ? taken : new Date()).toISOString(), lat: meta.lat ?? null, lng: meta.lng ?? null, src: 'galeria', warn: w.length ? 'De la galería, ' + w.join(' y ') : null };
          } else { const pos = geoNow() || (meta.lat != null ? { lat: meta.lat, lng: meta.lng, acc: null } : null);
            rec = { path, ts: new Date().toISOString(), lat: pos?.lat ?? null, lng: pos?.lng ?? null, acc: pos?.acc ?? null, src: 'camara' }; }
          d.photos.push({ ...rec, fix: true, _new: true, keep: true, _url: URL.createObjectURL(blob) });
        } catch (e){ toast('No se pudo subir la foto: ' + errText(e)); }
        busy--; }
      if (warned) toast('Una foto de la galería no es del día o del lugar de la visita: queda marcada para el supervisor.');
      paint(); };
    r.querySelector('#fx-gal').onchange = e => { const fs = [...e.target.files].slice(0, 10); e.target.value = ''; if (fs.length) add(fs, true); };
    r.querySelector('#fx-camf').onchange = e => { const fs = [...e.target.files].slice(0, 5); e.target.value = ''; if (fs.length) add(fs, false); };
    r.querySelector('#fx-cam').onclick = async () => { const ok = await photoCam(f => add([f], false)); if (ok === false) camFallback(r.querySelector('#fx-camf')); };
    r.querySelector('#fx-ok').onclick = async () => {
      keep(); const reason = r.querySelector('#fx-r').value.trim(), e = r.querySelector('#fx-e');
      if (reason.length < 5) return (e.textContent = 'Escribí el motivo: el supervisor lo ve junto con el cambio.');
      if (it.type === 'number' && !d.na && d.value !== '' && isNaN(Number(String(d.value).replace(',', '.')))) return (e.textContent = 'El valor tiene que ser un número.');
      if (it.type === 'number' && d.value !== '' && d.value != null) d.value = String(d.value).replace(',', '.');
      const ans = { note: d.note.trim(), photos: d.photos.filter(p => p.keep).map(({ keep, _new, _url, ...p }) => p) };
      if (FX_YN[it.type] || ['select', 'multi', 'number', 'date', 'time', 'text'].includes(it.type)){ ans.value = d.na ? null : (d.value === '' ? null : d.value); if (d.na) ans.na = true; }
      if (!needOnline()) return; const b = r.querySelector('#fx-ok'); b.disabled = true; b.textContent = 'Guardando…';
      const cur = (await loadInspection(ins.id)) || ins, prev = (cur.answers || {})[it.id] || {}, nx = { ...prev, note: ans.note, photos: ans.photos };
      if ('value' in ans){ nx.value = ans.value; delete nx.na; if (ans.na) nx.na = true; }
      const sc = computeScore(def, { ...(cur.answers || {}), [it.id]: nx });
      const { error } = await sb.rpc('insp_fix', { p_ins: ins.id, p_item: it.id, p_answer: ans, p_reason: reason, p_score: sc.score, p_max: sc.max, p_flagged: sc.flagged, p_flagged_items: sc.flaggedItems });
      if (error){ b.disabled = false; b.textContent = 'Guardar corrección'; return (e.textContent = errText(error)); }
      d.photos.forEach(p => p._url && URL.revokeObjectURL(p._url));
      fxClose(); toast('Corrección guardada. Ya se ve en el informe y le avisamos al supervisor.'); fxReload(v, ins);
    };
  };
  paint();
}
