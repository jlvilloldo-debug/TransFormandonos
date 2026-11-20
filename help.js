/* =====================================================================
   InspectApp · ❓ AYUDA
   Manual de uso: qué hace cada parte y cómo hacer cada cosa, con buscador.
   Abre en el tema de la pantalla donde estás.
   ===================================================================== */
const HELP = [
  { id: 'inicio', ic: '🏠', t: 'Inicio y proyectos', hash: ['#/home', '#/proj'], d: 'Todo se trabaja dentro de cada proyecto. Inicio muestra tus proyectos, lo urgente y tu día.', q: [
    ['Crear un proyecto', 'Inicio → "+ Nuevo proyecto". Cargá nombre, tipo, cliente, etapas y elementos. Después sumá sus sitios desde la pestaña Sitios y mapa (lista, Excel o KMZ).'],
    ['Cambiar de proyecto sin volver a Inicio', 'Usá el selector de arriba, al lado de InspectApp. "🏠 Mis proyectos" te lleva a Inicio.'],
    ['Elegir qué pestañas tiene un proyecto', 'Dentro del proyecto → "⚙ Editar proyecto" → "Pestañas que usa este proyecto". Las que no marques no aparecen. Resumen siempre está.'],
    ['Ver lo de toda la empresa junto', 'Mi empresa → "Vistas de toda la empresa": Mesa con todos los tickets, todas las tareas e inspecciones, sitios, estadísticas generales y todos los proyectos.'],
    ['Comparar proyectos', 'Inicio → "Comparación entre proyectos" (coordinación): avance, sitios, tareas abiertas, vencidas y pendientes. Tocá un proyecto para entrar.'],
    ['Chequeo del proyecto', 'Proyecto → Resumen → "🩺 Chequeo del proyecto": avisa sitios sin coordenadas, enlaces o equipos fuera del proyecto, falta de ticketera, planillas o gente. Cada aviso tiene su botón para arreglarlo.']] },
  { id: 'tickets', ic: '🎫', t: 'Tickets (Mesa)', hash: ['#/mesa', '/tk'], d: 'Cada proyecto tiene su pestaña Tickets con su ticketera. Proyectos del mismo cliente pueden compartirla.', q: [
    ['Cargar un ticket', 'Proyecto → Tickets → pegá la captura o el texto del ticket (Ctrl+V) en el recuadro, o arrastrá la imagen. También "cargar a mano".'],
    ['Asignar un ticket', 'Tocá el ticket → elegí la persona o contratista. "Gente hoy" muestra quién del proyecto tiene jornada, guardia o tickets abiertos.'],
    ['Tickets que llegan por mail', 'Mesa → ⚙ Ticketeras → la ticketera → "📨 Tickets por mail". Elegís cada cuánto se lee la casilla o "Leer ahora".'],
    ['Asignar la ticketera a un proyecto', 'Proyecto → pestaña "Contrato y SLA" → Ticketera.'],
    ['Mandar una nota al NOC', 'Abrí el ticket → "Nota al NOC": arma el mail con el asunto correcto para que el NOC lo tome.']] },
  { id: 'tareas', ic: '📋', t: 'Tareas', hash: ['#/tasks', '/ta'], d: 'Cada tarea pertenece a un proyecto. Las que no tienen proyecto van a Infraestructura.', q: [
    ['Asignar una tarea', 'Proyecto → "📋 Asignar tarea" (o pestaña Tareas → "+ Nueva tarea"). Queda en ese proyecto.'],
    ['Tarea para todos los sitios del proyecto', 'En la tarea → "+ Todos los sitios del proyecto" (útil para preventivos).'],
    ['Pasar las tareas sin proyecto a Infraestructura', 'Creá el proyecto "Infraestructura" y entrá: aparece "Hay N tareas sin proyecto → Pasarlas acá".']] },
  { id: 'inspecciones', ic: '🔍', t: 'Inspecciones y planillas', hash: ['#/insp', '#/tpl', '/in', '/pl'], d: 'Las inspecciones se hacen con las planillas (plantillas) del proyecto.', q: [
    ['Hacer una inspección', 'Proyecto → Inspecciones → "+ Nueva": se ofrecen solo las planillas y los sitios del proyecto.'],
    ['Elegir las planillas de un proyecto', 'Proyecto → Planillas → "Agregar desde la biblioteca". "Quitar" la saca del proyecto (no la borra).'],
    ['Crear una planilla nueva', 'Arriba → Plantillas (biblioteca de todas) → nueva. Después agregala al proyecto desde Planillas.'],
    ['Importar una planilla en PDF', 'Plantillas → "📄 Importar PDF". Lee plantillas exportadas de SafetyCulture, informes de InspectApp y otros PDF con texto. Revisás y corregís en la vista previa y tocás Crear. El PDF original queda guardado (botón "📄 PDF original" en la plantilla). Las preguntas condicionales quedan visibles con la aclaración «completar si…».'],
    ['Preguntas que aparecen según la respuesta', 'Plantillas → Editar → en la pregunta, "🔀 Mostrar solo si" → elegí la pregunta y la opción (podés sumar varias con "o"). Las ocultas no cuentan para el puntaje y en el informe salen "No aplica".'],
    ['Opción múltiple', 'Tipo "Opción múltiple (varias)": el técnico marca todas las que correspondan. Sirve como condición: "incluye MX68" abre la serie y la foto del MX68.'],
    ['Foto obligatoria según la respuesta', 'En la pregunta: "📷 Foto obligatoria si responde" → marcá las respuestas (por ejemplo Deficiente). Con esa respuesta no deja terminar sin foto.'],
    ['Completar solo con el sitio', 'Pregunta de texto → Valor por defecto: [sitio]. También [traza], [fecha], [técnico], [dirección del sitio].'],
    ['Convertir una plantilla importada antes', 'Si la importaste de PDF con la versión anterior, en el editor aparece "⚡ Activar lógica": convierte esa misma plantilla. Después tocá Guardar.'],
    ['Terminar un borrador', 'Inspecciones → los que dicen "Borrador" → abrir y completar.']] },
  { id: 'mapa', ic: '🗺', t: 'Sitios, mapa y KMZ', hash: ['#/map', '#/sites', '/sit'], d: 'El mapa general muestra todo; cada proyecto tiene su mapa con sus sitios, trazas y radioenlaces.', q: [
    ['Subir o actualizar el KMZ del proyecto', 'Proyecto → Sitios y mapa → "📥 Subir / actualizar KMZ". Elegí qué es cada carpeta (sitio de radio, EPI, radioenlace, tramo de fibra o no importar). Volver a subirlo agrega lo nuevo y actualiza lo existente, sin duplicar.'],
    ['Ver la ficha de un radioenlace', 'En el mapa tocá la línea del enlace: muestra la ficha completa del KMZ (banda, capacidad, IP, equipos, azimut…).'],
    ['Ver las trazas como en Google Earth', 'Botón "🧵 Trazas" del mapa: cada traza con su color.'],
    ['Acercarse a un grupo de puntos', 'Tocá el círculo con el número: se acerca a esa zona.'],
    ['Ver los nombres de los sitios', 'Acercate: los nombres fijos aparecen cuando hay pocos puntos en pantalla.']] },
  { id: 'inventario', ic: '📦', t: 'Inventario de equipos', hash: ['/inv'], d: 'Cada equipo con su serie, estado, dónde está, quién lo tiene, fallas, reemplazos y RMA. Todo queda en el historial.', q: [
    ['Importar la planilla de equipos', 'Inventario → "Importar Excel" (Sitio, Equipo, Serie / MAC, IP, Estado, obs). Si la serie ya existe la actualiza, no duplica.'],
    ['Reemplazar un equipo con falla', 'Tocá el equipo → "🔄 Reemplazar" → cargá la serie nueva. El nuevo queda instalado; el retirado queda Con falla y a cargo de quien lo sacó.'],
    ['Mandar a RMA y recibirlo', 'Equipo → "📦 Enviar a RMA" (proveedor y nº). Cuando vuelve → "✅ Recibir reparado".'],
    ['Cambiar estado, sitio u obs rápido', '"✏ Edición rápida" (coordinación): se edita en la tabla.'],
    ['Exportar', '"Exportar Excel": mismo formato + dónde está, quién lo tiene, RMA y una hoja con todos los movimientos.']] },
  { id: 'stock', ic: '🧰', t: 'Stock y materiales', hash: ['#/stock', '/stk'], d: 'Materiales y equipos de la empresa y lo reservado para cada proyecto.', q: [
    ['Ver el stock de un proyecto', 'Proyecto → pestaña "🧰 Stock y materiales".'],
    ['Agregar un activo', 'Stock → Activos → "+". El sitio se elige escribiendo para buscar.']] },
  { id: 'bases', ic: '🗺', t: 'Bases y cuadrillas', hash: ['#/bases', '/ba'], d: 'Dónde está cada base, qué cuadrilla cubre cada sitio y tramo, guardias y rotación.', q: [
    ['Asignar qué cubre una cuadrilla', 'Bases y cuadrillas → elegí la cuadrilla → modo pintar → tocá o marcá en área los sitios y tramos (titular o apoyo).'],
    ['Ver quién cubre un sitio', 'Pestaña "¿Quién cubre?" o tocá el sitio en el mapa.'],
    ['Cargar guardias y rotación', 'Editar cuadrilla → Rotación: semanas con francos y guardia. La guardia de hoy se ve en los tickets.'],
    ['Probar cambios sin tocar lo vigente', 'Trabajá en "Borrador" y después "Pasar a vigente".']] },
  { id: 'red', ic: '🌐', t: 'Red de fibra, gabinetes y ODF', hash: ['#/red'], d: 'La red del proyecto: nodos, cables, buffers, ODF, cordones y equipos. Al tocar un nodo se abre su gabinete.', q: [
    ['Abrir el gabinete (rack) de un nodo', 'Proyecto → "🌐 Red de fibra" → tocá el nodo → pestañas Gabinete, Buffers y ODF, Cordones, Energía, Mantenimiento.'],
    ['Crear un cordón ODF ⇄ ODF', 'Buffers y ODF → tocá un puerto → "＋ Cordón a otro puerto de ODF" → tocá el puerto de destino (podés cambiar de ODF arriba). Para muchos: Cordones → "＋ Cordones en bloque".'],
    ['Borrar (quitar) un cordón', 'Uno: Buffers y ODF → tocá el puerto con borde azul → a la derecha "Quitar cordón". Varios juntos: pestaña Cordones → en la fila del grupo "🗑 Quitar". Queda registrado en Cambios.'],
    ['Desconectar puertos de un equipo', 'Pestaña Cordones → sección "A equipos" → "🗑 Quitar" en la fila.'],
    ['Seguir un pelo de punta a punta', 'Tocá el puerto: "Recorrido" muestra cable, caja de empalme, ODF, cordón y equipo.'],
    ['Quién aprueba los cambios', 'Lo que cambia un técnico queda en Cambios y lo confirma un supervisor; si se rechaza, vuelve atrás.']] },
  { id: 'fibra', ic: '🧵', t: 'Fibra óptica y OTDR', hash: ['#/tools'], d: 'Herramientas → Fibra óptica: tramos, botellas de empalme (desde la planilla de empalmes o mediciones) y ubicación de eventos.', q: [
    ['Ubicar un evento con el OTDR', 'Fibra óptica → el tramo → "Ubicar un evento" → distancia o "Subir .sor". La app reconoce el OTDR por su serie y avisa si la calibración está vencida.'],
    ['Cargar botellas de empalme', 'Fibra óptica → el tramo → subir la planilla de empalmes o las mediciones.']] },
  { id: 'instr', ic: '🔧', t: 'Instrumental', hash: ['#/instr'], d: 'Calibraciones, certificados, quién tiene cada instrumento y avisos antes de que venzan.', q: [
    ['Importar el listado DO-05-02', 'Instrumental → "Importar Excel".'],
    ['Entregar y devolver', 'Tocá el instrumento → "📤 Entregar" / "📥 Devolver". Si está vencido, avisa.'],
    ['Registrar una calibración', 'Instrumento → "✅ Registrar calibración": fecha, certificado (PDF), frecuencia. El vencimiento se calcula solo.'],
    ['Avisos de vencimiento', '"⚙ Responsables y avisos": mail, WhatsApp y días de aviso. "📣 Avisar" manda el aviso con un toque.'],
    ['Borrar un instrumento cargado mal', 'Instrumento → "🗑 Eliminar": pide motivo y la identificación. Queda constancia en "🗑 Eliminados".']] },
  { id: 'agenda', ic: '📅', t: 'Agenda', hash: ['#/agenda'], d: 'La semana de cada persona y cuadrilla: tareas, guardias, francos y horas.', q: [
    ['Ver las tareas de uno o varios técnicos', 'Agenda → "👥 Técnicos" → marcá a quiénes querés ver (con buscador) → Ver. Queda guardado en ese equipo hasta que lo cambies; "Ninguno" vuelve a mostrar a todos.'],
    ['Filtrar por base, tipo o habilidad', 'Usá los filtros de arriba: base, propios o contratistas, y las habilidades (FO, OTDR, Energía…).']] },
  { id: 'jornada', ic: '⏱', t: 'Jornada y horas', hash: ['#/tools/hh', '#/tools/veh'], d: 'Inicio de jornada, vehículo y horas extra.', q: [
    ['Iniciar la jornada', 'Inicio → "Iniciar jornada": con o sin vehículo, km y foto.'],
    ['Pedir horas extra', 'Inicio → "Pedir horas extra" o los botones "Empiezo ahora / +1 h / +2 h".']] },
  { id: 'empresa', ic: '🏢', t: 'Mi empresa y licencias', hash: ['#/org', '#/admin', '#/recursos'], d: 'Usuarios, permisos, equipo de cada proyecto y licencias.', q: [
    ['Dar acceso a alguien a un proyecto', 'Proyecto → "👥 Integrantes".'],
    ['Asignar personal a un proyecto', 'Proyecto → "🏗 Equipo".'],
    ['Permisos por módulo', 'Mi empresa → usuarios → permisos.']] }
];
function helpTopicFor(hash){
  const h = hash || location.hash || '';
  let best = null, bl = 0;
  for (const t of HELP) for (const k of t.hash) if (h.includes(k) && k.length > bl){ best = t; bl = k.length; }
  return best?.id || 'inicio';
}
async function viewHelp(v, id){
  const cur = HELP.some(t => t.id === id) ? id : 'inicio';
  v.innerHTML = `<div class="card"><div class="row between" style="gap:10px"><div><h1 style="margin:0">❓ Ayuda</h1><div class="muted sm">Qué hace cada parte de InspectApp y cómo hacer cada cosa.</div></div>
      <input id="hp-q" placeholder="Buscar: borrar cordón, KMZ, reemplazar equipo…" style="max-width:360px"></div>
      <div class="row" style="gap:6px;flex-wrap:wrap;margin-top:12px">${HELP.map(t => `<a class="btn ${t.id === cur ? '' : 'sec'} small" href="#/ayuda/${t.id}">${t.ic} ${esc(t.t)}</a>`).join('')}</div></div>
    <div id="hp-body"></div>`;
  const body = $('#hp-body');
  const topic = t => `<div class="card"><h2 style="margin:0 0 4px">${t.ic} ${esc(t.t)}</h2><p class="muted" style="margin:0 0 10px">${esc(t.d)}</p>
    ${t.q.map(([q, a]) => `<details style="border-top:1px solid var(--line);padding:10px 0"><summary style="cursor:pointer;font-weight:700">${esc(q)}</summary><p style="margin:8px 0 0;line-height:1.5">${esc(a)}</p></details>`).join('')}</div>`;
  const draw = () => {
    const q = norm($('#hp-q').value);
    if (!q){ body.innerHTML = topic(HELP.find(t => t.id === cur)); body.querySelector('details')?.setAttribute('open', ''); return; }
    const words = q.split(' ').filter(Boolean);
    const hits = HELP.flatMap(t => t.q.filter(([a, b]) => { const n = norm(a + ' ' + b + ' ' + t.t); return words.every(w => n.includes(w)); }).map(x => [t, x]));
    body.innerHTML = hits.length ? `<div class="card">${hits.map(([t, [a, b]]) => `<details open style="border-top:1px solid var(--line);padding:10px 0"><summary style="cursor:pointer;font-weight:700">${t.ic} ${esc(a)} <span class="muted sm">· ${esc(t.t)}</span></summary><p style="margin:8px 0 0;line-height:1.5">${esc(b)}</p></details>`).join('')}</div>`
      : '<div class="card muted">No encontré nada con esas palabras. Probá con otra (por ejemplo: cordón, ticket, KMZ, calibración).</div>';
  };
  $('#hp-q').oninput = draw;
  draw();
}
