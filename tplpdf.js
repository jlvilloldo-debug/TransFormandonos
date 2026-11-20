/* =====================================================================
   InspectApp · Importar plantillas desde PDF
   Lee SOLO el texto del PDF (sin scripts, formularios ni links), arma la plantilla
   y la muestra editable antes de crearla. El PDF original queda guardado como referencia.
   Formatos reconocidos:
     · Plantilla exportada de SafetyCulture/iAuditor (tipos, opciones, obligatorias, condiciones)
     · Informe de InspectApp ya completado (secciones, preguntas, tipo según la respuesta, rangos)
     · Cualquier otro PDF con texto: cada renglón una pregunta (se corrige en la vista previa)
   ===================================================================== */
const TP_MAX_MB = 30, TP_MAX_PAGES = 120, TP_MAX_ITEMS = 1500;

async function tpLines(buf){
  await needLib('pdfjs'); pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.js';
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buf), isEvalSupported: false, disableFontFace: true, enableXfa: false, useSystemFonts: false, stopAtErrors: false }).promise;
  if (doc.numPages > TP_MAX_PAGES) throw new Error(`El PDF tiene más de ${TP_MAX_PAGES} hojas.`);
  const out = [];
  for (let p = 1; p <= doc.numPages; p++){
    const tc = await (await doc.getPage(p)).getTextContent();
    const it = tc.items.map(i => ({ s: String(i.str || '').replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' '), x: i.transform[4], y: i.transform[5], w: i.width || 0, h: Math.abs(i.transform[3]) || i.height || 0 }))
      .filter(i => i.s.trim()).slice(0, 20000);
    it.sort((a, b) => b.y - a.y || a.x - b.x);
    const rows = [];
    for (const i of it){ const r = rows.find(r => Math.abs(r.y - i.y) <= 2.5); if (r) r.it.push(i); else rows.push({ y: i.y, it: [i] }); }
    rows.sort((a, b) => b.y - a.y);
    for (const r of rows){
      r.it.sort((a, b) => a.x - b.x);
      const cells = []; let cur = null, end = -1e9;
      for (const i of r.it){ if (cur !== null && i.x - end < 14) cur.s += (i.x - end > 1.5 && !/\s$/.test(cur.s) ? ' ' : '') + i.s; else { cur = { s: i.s, x: i.x }; cells.push(cur); } end = i.x + i.w; }
      const c = cells.map(x => x.s.replace(/\s+/g, ' ').trim()).filter(Boolean);
      if (c.length) out.push({ p, c, x: cells[0].x, h: Math.max(...r.it.map(i => i.h)), t: c.join(' ') });
    }
  }
  return out;
}

const tpCut = (s, n = 300) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);
const tpNum = s => { const n = Number(String(s).replace(/\s/g, '').replace(',', '.')); return isFinite(n) ? n : undefined; };

/* ---------- SafetyCulture / iAuditor (plantilla vacía) ---------- */
const SC_TYPES = { 'text answer': 'text', 'select one': 'select', 'multiple choice': 'multi', 'media': 'photo', 'date/time': 'date', 'signature': 'signature', 'number': 'number', 'checkbox': 'yesno',
  'slider': 'number', 'temperature': 'number', 'location': 'text', 'person': 'text', 'site': 'text', 'annotation': 'photo', 'instruction': 'heading', 'document number': 'text', 'inspection date': 'date' };
function tpParseSC(L){
  const sizes = L.filter(l => SC_TYPES[norm(l.c[l.c.length - 1])]).map(l => l.h).sort((a, b) => a - b);
  const qH = sizes[Math.floor(sizes.length / 2)] || 10;
  const name = L[0]?.c.length === 1 && L[0].p === 1 ? tpCut(L[0].t, 120) : '';
  const secs = []; let sec = null, last = null, lastQ = null, lastIf = null, numNext = null; const pend = new Map(), all = []; let nCond = 0, nMulti = 0;
  const newSec = t => { if (sec && !sec.items.length){ sec.title = tpCut(sec.title + ' · ' + t, 150); last = null; return; } sec = { title: tpCut(t, 150) || 'General', items: [] }; secs.push(sec); last = null; };
  const add = it => { if (!sec) newSec(name || 'General'); sec.items.push(it); all.push(it); last = it; if (it.type !== 'heading') lastQ = it; return it; };
  const parentOf = val => { const v = norm(val); for (let i = all.length - 1; i >= 0; i--){ const q = all[i]; if ((q._opts || q.options || []).some(o => norm(o) === v)) return q; } return null; };
  L.forEach((l, idx) => {
    const t = l.t, c = l.c, kw = SC_TYPES[norm(c[c.length - 1])];
    if (idx === 0 && name) return;
    if (lastIf && /^[\d.,\s]+$/.test(t) && /\d\.\d/.test(t)){ t.split(/[,\s]+/).filter(Boolean).forEach(id => pend.set(id.replace(/\.$/, ''), lastIf)); return; }
    let mn0 = /^(\d+(?:\.\d+)+)\s*-?$/.exec(t); if (mn0){ numNext = mn0[1]; return; }
    if (/^\d+\s*\/\s*\d+$/.test(t) || /^enter date and time:?$/i.test(t) || /^[\s/:]*(am\s*\/\s*pm)?[\s/:]*$/i.test(t) || /^date:\s*[\s/]*$/i.test(t) || /^[\d.,\s]+$/.test(t)) return;
    let m;
    if ((m = /^if (answer is (.+)|checkbox is (checked|not checked))$/i.exec(c[0]))){
      const val = m[2] ? m[2].trim() : (/not/i.test(m[3]) ? 'No' : 'Sí');
      const par = m[2] ? parentOf(val) : [...all].reverse().find(q => q._cb);
      const act = c.slice(1).join(' ');
      if (!par){ lastIf = null; return; }
      lastIf = { par, val };
      if (/require evidence/i.test(act)) (par.ev_if ||= []).push(['yesno', 'okfail', 'brm'].includes(par.type) ? (COND_EQ[norm(val)] || val) : val);
      const ids = /answer question\(s\)\s*(.+)$/i.exec(act); if (ids) ids[1].split(/[,\s]+/).filter(Boolean).forEach(id => pend.set(id.replace(/\.$/, ''), { par, val }));
      return;
    }
    if ((m = /^\[\s*\]\s*(.+)$/.exec(c[0])) && !kw){ const q = lastQ; if (q && (q.type === 'select' || q.type === 'multi')) (q._opts ||= []).push(tpCut(m[1], 120)); return; }
    if (kw){
      let label = c.slice(0, -1).join(' ').trim(); const req = /^\*/.test(label); label = label.replace(/^\*\s*/, '').replace(/^\[\s*\]\s*/, '');
      const nm = /^(\d+(?:\.\d+)*)\.?\s*(?:-\s*)?(.*)$/.exec(label); let num = null;
      if (nm && /\d\.\d|^\d+$/.test(nm[1]) && /\s-\s|^\d+(\.\d+)+\.\s/.test(label + ' ')){ num = nm[1]; label = nm[2]; }
      if (!num && numNext){ num = numNext; } numNext = null; lastIf = null;
      const it = { type: kw === 'multi' ? 'multi' : kw, label: tpCut(label) || 'Pregunta' }; it._lbl = it.label;
      if (req) it.required = true; if (kw === 'yesno'){ it._cb = true; it.good = 'none'; }
      if (kw === 'date' && /date\/time/i.test(c[c.length - 1])) it._dt = true;
      const pc = num && pend.get(num); if (pc){ pend.delete(num); it._cond = { par: pc.par, val: pc.val }; nCond++; }
      add(it); return;
    }
    // continuación del texto de la pregunta anterior
    if (last && last.type !== 'heading' && /^[a-záéíóúñ(]/.test(t) && !(last._opts || []).length){ last.label = last._lbl = tpCut(last.label + ' ' + t); return; }
    if (l.h > qH + 0.8 || !sec) newSec(t); else add({ type: 'heading', label: tpCut(t, 200) });
  });
  // opción múltiple real; preguntas condicionales con su lógica; "sitio" se completa solo con el sitio de la inspección
  const sections = secs.map(s => { const items = [];
    for (const it of s.items){
      if (it.type === 'multi' || it.type === 'select'){ it.options = [...new Set((it._opts || []).map(o => o.replace(/\|/g, '/').trim()).filter(Boolean))]; if (!it.options.length) it.type = 'text'; else if (it.type === 'multi') nMulti++; }
      if (it._cond){ const { par, val } = it._cond; it._show = [{ _p: par, eq: ['yesno', 'okfail', 'brm'].includes(par.type) ? (COND_EQ[norm(val)] || val) : val.replace(/\|/g, '/').trim() }]; }
      if (it.type === 'text' && /\bsitio\b/i.test(it.label) && !/serie|nro|n[uú]mero|c[oó]digo/i.test(it.label)) it.default = '[sitio]';
      items.push(it);
      if (it._dt) items.push({ type: 'time', label: 'Hora', required: it.required, _show: it._show });
    } return { title: s.title, items }; });
  return { name, sections, notes: [nCond && `${nCond} preguntas aparecen solo cuando corresponde según la respuesta (lógica condicional).`, nMulti && `${nMulti} preguntas de opción múltiple (se marcan varias).`].filter(Boolean) };
}
function tpClean(parsed){
  let n = 0; const sections = [], src = new Map();
  for (const [si, s] of parsed.sections.entries()){
    const items = [];
    for (const it of s.items){
      if (n >= TP_MAX_ITEMS) break;
      if (!ITEM_TYPES[it.type]) it.type = 'text';
      const o = { id: `s${si + 1}i${items.length + 1}`, type: it.type, label: tpCut(it.label, 400) || 'Pregunta' };
      for (const k of ['required', 'photos', 'video', 'unit', 'good', 'default']) if (it[k] !== undefined && it[k] !== false) o[k] = typeof it[k] === 'string' ? tpCut(it[k], 40) : it[k];
      if (it.type === 'number'){ if (isFinite(it.min)) o.min = it.min; if (isFinite(it.max)) o.max = it.max; }
      if (it.type === 'select' || it.type === 'multi') o.options = (it.options || []).map(x => tpCut(x, 120).replace(/\|/g, '/')).filter(Boolean).slice(0, 40);
      Object.defineProperty(o, '_src', { value: it, enumerable: false }); src.set(it, o);
      if (it.ev_if) o.ev_if = [...new Set(it.ev_if)].map(x => tpCut(x, 120)).slice(0, 10);
      if (o.type === 'heading'){ delete o.required; delete o.photos; }
      items.push(o); if (o.type !== 'heading') n++;
    }
    if (items.some(i => i.type !== 'heading')) sections.push({ id: 's' + (sections.length + 1), title: tpCut(s.title, 150) || 'Sección', items });
  }
  sections.forEach((s, si) => s.items.forEach((it, ii) => it.id = `s${si + 1}i${ii + 1}`));
  for (const s of sections) for (const o of s.items){ const sh = (o._src?._show || []).map(c => ({ q: src.get(c._p)?.id, eq: tpCut(c.eq, 120) })).filter(c => c.q && c.q !== o.id); if (sh.length) o.show = sh; }
  return { sections, n };
}

async function importTemplatePdf(file){
  if (!file) return; if (!needOnline()) return;
  if (!/\.pdf$/i.test(file.name)) return toast('Elegí un archivo PDF.');
  if (file.size > TP_MAX_MB * 1024 * 1024) return toast(`El PDF supera ${TP_MAX_MB} MB.`);
  toast('Leyendo el PDF…');
  let L, parsed, fmt;
  try {
    const buf = await file.arrayBuffer();
    if (new TextDecoder('latin1').decode(new Uint8Array(buf, 0, 5)) !== '%PDF-') throw new Error('El archivo no es un PDF válido.');
    L = await tpLines(buf);
  } catch (e){ return toast('No se pudo leer el PDF: ' + errText(e)); }
  if (L.length < 3) return toast('El PDF no tiene texto (parece escaneado o una foto). Por ahora solo se leen PDF con texto.');
  const tx = L.map(l => l.c[l.c.length - 1]).map(norm);
  if (tx.filter(x => SC_TYPES[x]).length >= 3){ fmt = 'SafetyCulture'; parsed = tpParseSC(L); }
  else if (L.some(l => /generado con inspectapp/i.test(l.t)) || L.slice(0, 15).some(l => /^puntuaci[oó]n/i.test(l.c[0]))){ fmt = 'Informe de InspectApp'; parsed = tpParseIA(L); }
  else { fmt = 'Genérico'; parsed = tpParseGeneric(L); }
  const { sections, n } = tpClean(parsed);
  if (!n) return toast('No encontré preguntas en el PDF.');
  tpPreview(file, { name: parsed.name || file.name.replace(/\.pdf$/i, '').replace(/_+/g, ' '), sections, notes: parsed.notes, fmt, n });
}

function tpPreview(file, P){
  const def = { sections: P.sections };
  const types = Object.entries(ITEM_TYPES);
  const m = modal(`<h2>Importar plantilla desde PDF</h2>
    <p class="sm muted" style="margin-top:-4px">Formato detectado: <b>${esc(P.fmt)}</b> · revisá y corregí antes de crearla. El PDF original queda guardado en la plantilla.</p>
    ${P.notes.length ? `<div class="banner warn"><span class="dot"></span><div class="sm">${P.notes.map(esc).join('<br>')}</div></div>` : ''}
    <div class="row"><div class="grow"><label>Nombre de la plantilla</label><input id="tp-name" maxlength="150" value="${esc(P.name)}"></div>
      <div style="width:180px"><label>Tipo</label><select id="tp-kind"><option value="preventivo">Preventivo</option><option value="correctivo">Correctivo</option><option value="otro">Otro</option></select></div></div>
    <p class="sm" id="tp-cnt" style="margin:8px 0 4px"></p>
    <div id="tp-list" style="max-height:52vh;overflow:auto;border:1px solid var(--line);border-radius:10px;padding:6px 10px"></div>
    <div class="err" id="tp-err"></div>
    <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn sec" id="tp-x">Cancelar</button><button class="btn" id="tp-go">Crear plantilla</button></div>`, { wide: true });
  let byId = new Map();
  const draw = () => {
    byId = new Map(def.sections.flatMap(s => s.items).map(i => [i.id, i]));
    const nq = def.sections.reduce((a, s) => a + s.items.filter(i => i.type !== 'heading').length, 0);
    $('#tp-cnt').innerHTML = `<b>${def.sections.length}</b> secciones · <b>${nq}</b> preguntas`;
    $('#tp-list').innerHTML = def.sections.map((s, si) => `<div style="margin:10px 0 4px;display:flex;gap:6px;align-items:center"><b class="muted sm">Sección</b><input data-st="${si}" value="${esc(s.title)}" style="font-weight:700"><button class="btn sec small" data-sdel="${si}" title="Quitar sección">✕</button></div>
      ${s.items.map((it, ii) => `<div style="display:flex;gap:6px;align-items:center;margin:3px 0 3px ${it.type === 'heading' ? 0 : 14}px;flex-wrap:wrap">
        <select data-ty="${si}.${ii}" style="width:150px;flex:none">${types.map(([k, x]) => `<option value="${k}" ${it.type === k ? 'selected' : ''}>${x}</option>`).join('')}</select>
        <input data-lb="${si}.${ii}" value="${esc(it.label)}" style="flex:1;min-width:200px;${it.type === 'heading' ? 'font-weight:700' : ''}">
        ${it.type === 'select' || it.type === 'multi' ? `<input data-op="${si}.${ii}" value="${esc((it.options || []).join(', '))}" title="Opciones separadas por coma" style="flex:1;min-width:160px">` : ''}
        ${it.type === 'number' ? `<span class="sm muted">${it.min ?? ''}${it.min !== undefined || it.max !== undefined ? '–' : ''}${it.max ?? ''} ${esc(it.unit || '')}</span>` : ''}
        ${it.type !== 'heading' ? `<label class="sm" style="font-weight:400;margin:0;display:flex;gap:4px;align-items:center"><input type="checkbox" data-rq="${si}.${ii}" style="width:auto" ${it.required ? 'checked' : ''}>Oblig.</label>
          <label class="sm" style="font-weight:400;margin:0;display:flex;gap:4px;align-items:center"><input type="checkbox" data-ph="${si}.${ii}" style="width:auto" ${it.photos ? 'checked' : ''}>Foto</label>` : ''}
        <button class="btn sec small" data-del="${si}.${ii}" title="Quitar">✕</button>
        ${(it.show || []).length ? `<div class="sm" style="flex-basis:100%;color:#1D4ED8;margin:-2px 0 0 156px">🔀 aparece si ${it.show.map(c => `«${esc((byId.get(c.q)?.label || '¿pregunta quitada?').slice(0, 60))}» ${byId.get(c.q)?.type === 'multi' ? 'incluye' : '='} ${esc(COND_TXT[c.eq] || c.eq)}`).join(' o ')}</div>` : ''}${(it.ev_if || []).length ? `<div class="sm" style="flex-basis:100%;color:#B45309;margin:-2px 0 0 156px">📷 foto obligatoria si: ${esc(it.ev_if.map(e => COND_TXT[e] || e).join(', '))}</div>` : ''}${it.default ? `<div class="sm muted" style="flex-basis:100%;margin:-2px 0 0 156px">Se completa con ${esc(it.default)}</div>` : ''}</div>`).join('')}`).join('');
    const at = k => { const [a, b] = k.split('.').map(Number); return def.sections[a].items[b]; };
    m.el.querySelectorAll('[data-st]').forEach(i => i.oninput = () => def.sections[i.dataset.st].title = tpCut(i.value, 150));
    m.el.querySelectorAll('[data-lb]').forEach(i => i.oninput = () => at(i.dataset.lb).label = tpCut(i.value, 400));
    m.el.querySelectorAll('[data-op]').forEach(i => i.oninput = () => at(i.dataset.op).options = i.value.split(/[,;|]/).map(x => tpCut(x, 120)).filter(Boolean).slice(0, 40));
    m.el.querySelectorAll('[data-rq]').forEach(i => i.onchange = () => { const it = at(i.dataset.rq); if (i.checked) it.required = true; else delete it.required; });
    m.el.querySelectorAll('[data-ph]').forEach(i => i.onchange = () => { const it = at(i.dataset.ph); if (i.checked) it.photos = true; else delete it.photos; });
    m.el.querySelectorAll('[data-ty]').forEach(i => i.onchange = () => { const it = at(i.dataset.ty); it.type = i.value; if ((it.type === 'select' || it.type === 'multi') && !it.options) it.options = ['Opción 1', 'Opción 2']; if (it.type === 'heading'){ delete it.required; delete it.photos; } draw(); });
    m.el.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { const [a, c] = b.dataset.del.split('.').map(Number); def.sections[a].items.splice(c, 1); draw(); });
    m.el.querySelectorAll('[data-sdel]').forEach(b => b.onclick = () => { def.sections.splice(+b.dataset.sdel, 1); draw(); });
  };
  draw();
  $('#tp-x').onclick = m.close;
  $('#tp-go').onclick = async () => {
    // los ids se conservan (las condiciones apuntan a ellos); se quitan condiciones a preguntas borradas
    const keep = new Set(def.sections.flatMap(s => s.items.map(i => i.id)));
    const out = { sections: def.sections.map((s, si) => ({ id: 's' + (si + 1), title: s.title || 'Sección', items: s.items.map(it => { const o = { ...it }; if (o.show){ o.show = o.show.filter(c => keep.has(c.q)); if (!o.show.length) delete o.show; } return o; }) })).filter(s => s.items.some(i => i.type !== 'heading')) };
    if (!out.sections.length) return ($('#tp-err').textContent = 'La plantilla quedó sin preguntas.');
    for (const s of out.sections) for (const it of s.items) if ((it.type === 'select' || it.type === 'multi') && !(it.options || []).length) return ($('#tp-err').textContent = `"${it.label}" es de opciones pero no tiene opciones.`);
    out.source = { kind: 'pdf', file: tpCut(file.name, 150), fmt: P.fmt, at: new Date().toISOString(), by: tpCut(me.full_name || me.email, 120) };
    $('#tp-go').disabled = true; $('#tp-go').textContent = 'Creando…';
    const { data, error } = await sb.from('templates').insert({ org_id: me.org_id, name: tpCut($('#tp-name').value, 150) || 'Plantilla importada', kind: $('#tp-kind').value,
      definition: out, published: true, description: `Importada desde PDF (${P.fmt})`, created_by: me.id }).select('id').single();
    if (error){ $('#tp-go').disabled = false; $('#tp-go').textContent = 'Crear plantilla'; return ($('#tp-err').textContent = errText(error)); }
    let warn = '';
    try {
      const path = `${me.org_id}/tpl/${data.id}/${uid()}.pdf`;
      const up = await sb.storage.from('fotos').upload(path, file, { contentType: 'application/pdf', upsert: false }); if (up.error) throw up.error;
      out.source.path = path;
      const { error: e2 } = await sb.from('templates').update({ definition: out }).eq('id', data.id); if (e2) throw e2;
    } catch (e){ warn = ' (no se pudo guardar el PDF original: ' + errText(e) + ')'; }
    try { await IDB.del('kv', CUR_UID + ':tpl-all'); } catch {}
    m.close(); toast('Plantilla creada' + warn + '. Ya la podés sumar a cualquier proyecto desde Planillas.'); location.hash = '#/tpl/' + data.id;
  };
}

async function tplOpenSourcePdf(path){
  if (!needOnline()) return;
  if (typeof path !== 'string' || !path.startsWith(me.org_id + '/tpl/') || !/^[\w\-/.]+\.pdf$/.test(path)) return toast('PDF no disponible.');
  const { data } = await sb.storage.from('fotos').createSignedUrl(path, 600);
  if (!data?.signedUrl) return toast('No se pudo abrir el PDF.');
  window.open(data.signedUrl, '_blank', 'noopener');
}
