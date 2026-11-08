/* =====================================================================
   InspectApp · Contenido de SEGURIDAD E HIGIENE (v5.12)
   Redactado a partir de la normativa oficial argentina. Las normas tienen su link a la fuente.
   IMPORTANTE: es material de apoyo. Antes de usarlo, lo revisa y valida el profesional de
   Higiene y Seguridad de la empresa (Mi empresa → Seguridad e Higiene → "Revisado por").
   ===================================================================== */
const HYS_NORMS = {
  ley19587: ['Ley 19.587 · Higiene y Seguridad en el Trabajo', 'https://www.argentina.gob.ar/normativa/nacional/ley-19587-17612', 'Marco general: obligaciones del empleador y del trabajador.'],
  dec351: ['Decreto 351/79 · Reglamento de la Ley 19.587', 'https://www.argentina.gob.ar/normativa/nacional/decreto-351-1979-32030/actualizacion', 'Condiciones de trabajo: electricidad, incendio, EPP, capacitación, señalización.'],
  dec911: ['Decreto 911/96 · Higiene y Seguridad en la Construcción', 'https://www.argentina.gob.ar/normativa/nacional/decreto-911-1996-38568/texto', 'Obras: trabajos en altura, excavaciones, andamios, soldadura, aparatos elevadores.'],
  res319: ['Res. SRT 319/99 · Programa de Seguridad (construcción)', 'https://www.argentina.gob.ar/normativa/nacional/norma-59941/texto', 'Programa de seguridad para obras y contratistas.'],
  ley24557: ['Ley 24.557 · Riesgos del Trabajo', 'https://www.argentina.gob.ar/normativa/nacional/ley-24557-27971/actualizacion', 'Sistema de ART: prestaciones ante accidentes y enfermedades.'],
  res525: ['Res. SRT 525/15 · Denuncia de accidentes y enfermedades', 'https://www.argentina.gob.ar/normativa/nacional/resoluci%C3%B3n-525-2015-243329/texto', 'Qué hacer y en qué plazos ante un accidente de trabajo.'],
  ley20744: ['Ley 20.744 · Contrato de Trabajo (art. 75: deber de seguridad)', 'https://www.argentina.gob.ar/normativa/nacional/ley-20744-25552/actualizacion', 'El trabajador puede rehusar tareas ante peligro grave e inminente.'],
  ley25212: ['Ley 25.212 · Pacto Federal del Trabajo (régimen de sanciones)', 'https://www.argentina.gob.ar/normativa/nacional/ley-25212-61876/actualizacion', 'Infracciones y sanciones en materia de higiene y seguridad.'],
  res299: ['Res. SRT 299/11 · Constancia de entrega de ropa y EPP', 'https://www.argentina.gob.ar/normativa/nacional/norma-180669/texto', 'Formulario obligatorio por trabajador.'],
  disp2_21: ['Disp. SRT 2/21 · Registro digital de entrega de EPP', 'https://www.argentina.gob.ar/normativa/nacional/norma-349285', 'Permite registrar la constancia con aplicaciones informáticas.'],
  res61_23: ['Res. SRT 61/23 · Medidas de seguridad en altura', 'https://www.argentina.gob.ar/normativa/nacional/resoluci%C3%B3n-61-2023-394625', 'Andamios, plataformas elevadoras, sistemas anticaídas, silletas y trabajos en postes.'],
  res503_14: ['Res. SRT 503/14 · Excavaciones', 'https://www.argentina.gob.ar/normativa/nacional/227747/texto', 'Excavaciones a cielo abierto de más de 1,20 m (zanjas, pozos, canales).'],
  res953_10: ['Res. SRT 953/10 · Espacios confinados (construcción)', 'https://www.argentina.gob.ar/normativa/nacional/norma-169317', 'Requisitos para trabajar en espacios confinados.'],
  res11_22: ['Res. SRT 11/22 · Trabajos con tensión en instalaciones mayores a 1 kV', 'https://www.argentina.gob.ar/normativa/nacional/norma-361518/texto', 'Reglamento para trabajos con tensión en media y alta tensión.'],
  res900_15: ['Res. SRT 900/15 · Protocolo de puesta a tierra', 'https://www.argentina.gob.ar/normativa/nacional/resoluci%C3%B3n-900-2015-246348/texto', 'Medición de puesta a tierra y continuidad de masas.'],
  res960_15: ['Res. SRT 960/15 · Autoelevadores', 'https://www.argentina.gob.ar/normativa/nacional/norma-246619/texto', 'Operación segura, capacitación y credencial del operador.'],
  res30_23: ['Res. SRT 30/23 · Estrés y tensión térmica', 'https://www.argentina.gob.ar/normativa/nacional/resoluci%C3%B3n-30-2023-387450', 'Trabajo con calor: pausas, hidratación, evaluación.'],
  ley24449: ['Ley 24.449 · Tránsito', 'https://www.argentina.gob.ar/normativa/nacional/ley-24449-818/actualizacion', 'Conducción y obras en la vía pública.'],
  dec779: ['Decreto 779/95 · Reglamento de tránsito (señalización)', 'https://www.argentina.gob.ar/normativa/nacional/norma-30389/texto', 'Sistema de señalización vial, incluida la de obras.'],
  res3690: ['Res. CNC 3690/04 · Protocolo de medición de radiaciones no ionizantes', 'https://www.argentina.gob.ar/normativa/nacional/resoluci%C3%B3n-3690-2004-100853/texto', 'Medición de exposición en estaciones radioeléctricas.'],
  resms202: ['Res. MS 202/95 · Estándar de exposición a radiofrecuencias', 'https://www.argentina.gob.ar/salud/ambiental/normativas', 'Límites de exposición a radiaciones no ionizantes.'],
  srt_conf: ['SRT · Ficha técnica: espacios confinados', 'https://www.argentina.gob.ar/sites/default/files/ft_espacios_confinados_web.pdf', 'Guía oficial de prevención.'],
  srt_epp: ['SRT · Elementos de protección personal', 'https://www.argentina.gob.ar/srt/prevencion/epp', 'Guía oficial sobre EPP.'],
};

const HYS_PROV = {
  nac: { name: 'Nacional', norms: ['ley19587', 'dec351', 'dec911', 'res319', 'ley24557', 'res525', 'ley20744', 'ley25212', 'res299', 'disp2_21', 'res61_23', 'res503_14', 'res953_10', 'res11_22', 'res900_15', 'res960_15', 'res30_23', 'ley24449', 'dec779', 'res3690', 'resms202'] },
  sf: { name: 'Santa Fe', items: [
    ['Ley 12.913 · Comités de Salud y Seguridad en el Trabajo', 'https://www.santafe.gov.ar/index.php/web/content/view/full/111793/(subtema)/93761', 'Empresas con 50 o más trabajadores: comité paritario. De 10 a 49: delegado de prevención. Se registran en el Ministerio de Trabajo provincial (trámite en línea).'] ] },
  ba: { name: 'Buenos Aires', items: [
    ['Ley 14.408 · Comités Mixtos de Salud, Higiene y Seguridad en el Empleo', 'https://normas.gba.gob.ar/documentos/VwleaSW0.html', 'Empresas con 50 o más trabajadores: comité mixto (reunión mensual y extraordinaria ante accidentes). De 10 a 49: delegado. Plan anual de prevención con el comité.'] ] },
  cba: { name: 'Córdoba', items: [
    ['Ley 8.015 · Inspección y sanciones del Ministerio de Trabajo', 'https://www.cba.gov.ar/wp-content/4p96humuzp/2013/04/Ley-8015-de-la-Provincia-de-C%C3%B3rdoba.pdf', 'Procedimiento de inspección, actas de infracción y sanciones; también el procedimiento ante accidentes.'],
    ['Res. ST 40/22 · Construcción: peligro grave e inminente', 'https://comercioyjusticia.info/leyes-y-comentarios/construccion-cordoba-establecio-hechos-que-configuran-violaciones-a-las-normas-de-seguridad-e-higiene/', 'Lista de incumplimientos que habilitan suspender o clausurar (bordes sin protección desde 2 m, excavaciones sin baranda o entibado, tableros sin disyuntor o puesta a tierra, etc.) e investigación de accidentes graves. (Nota periodística: verificar el texto en el Boletín Oficial de Córdoba).'],
    ['Ley 10.666 · Ejercicio profesional de Higiene y Seguridad', null, 'Régimen de las actividades profesionales de HyS en la provincia.'] ] },
  sl: { name: 'San Luis', items: [
    ['Res. PRL 100/12 · Registro de profesionales y Libro de Higiene y Seguridad', 'https://www.ecofield.net/Legales/Sanluis/res100-12_SLuis.htm', 'Solo pueden actuar profesionales inscriptos. El empleador presenta un Libro de HyS para rubricar y registra allí las visitas del profesional. (Fuente no oficial: verificar en el Boletín Oficial de San Luis).'],
    ['Ley XIV-1013-2019 · Colegio de Profesionales de Higiene y Seguridad', 'https://leyes-ar.com/colegio_de_profesionales_de_higiene_y_seguridad_en_el_trabajo_san_luis.htm', 'Matrícula de los profesionales de HyS. (Fuente no oficial: verificar).'] ] },
};
// todas las jurisdicciones: las que no tienen contenido cargado se pueden completar desde Configuración
const HYS_ALL_PROV = { caba: 'Ciudad de Buenos Aires', ba: 'Buenos Aires', ca: 'Catamarca', ch: 'Chaco', cht: 'Chubut', cba: 'Córdoba', cr: 'Corrientes', er: 'Entre Ríos', fo: 'Formosa', ju: 'Jujuy', lp: 'La Pampa', lr: 'La Rioja',
  mz: 'Mendoza', mi: 'Misiones', nq: 'Neuquén', rn: 'Río Negro', sa: 'Salta', sj: 'San Juan', sl: 'San Luis', sc: 'Santa Cruz', sf: 'Santa Fe', se: 'Santiago del Estero', tf: 'Tierra del Fuego', tu: 'Tucumán' };

const HYS_EMERG = [['911', 'Emergencias / Policía', '🚓'], ['107', 'Emergencias médicas (ambulancia)', '🚑'], ['100', 'Bomberos', '🚒'], ['103', 'Defensa Civil', '🛟']];

// trabajos de riesgo
const HYS_JOBS = {
  altura: { ic: '🧗', name: 'Trabajo en altura y torres', permit: true,
    desc: 'Toda tarea con riesgo de caída a distinto nivel: torres, postes, techos, escaleras, andamios, plataformas elevadoras.',
    risks: ['Caída de la persona a distinto nivel', 'Caída de herramientas u objetos sobre quienes están abajo', 'Trauma por suspensión si queda colgado del arnés', 'Descarga atmosférica y viento fuerte', 'Contacto con líneas eléctricas cercanas'],
    before: ['Permiso de trabajo firmado y personal con apto médico para altura', 'Plan de rescate definido ANTES de subir (quién y con qué baja a una persona colgada)', 'Revisar arnés, cabos, conectores y línea de vida: sin cortes, costuras sanas, mosquetones que cierran', 'Punto de anclaje resistente y por encima de la cabeza; nunca anclarse a cables ni a elementos sueltos', 'Delimitar y señalizar la zona de abajo; nadie debajo de la vertical de trabajo', 'Herramientas atadas o en bolso; nada suelto en los bolsillos', 'Suspender con viento fuerte, lluvia o tormenta eléctrica', 'Escaleras: apoyo firme, tres puntos de contacto, sobrepasar 1 m el punto de llegada'],
    epp: ['Casco con barbijo (mentonera)', 'Arnés de cuerpo completo', 'Doble cabo con absorbedor de energía', 'Conectores con traba', 'Calzado de seguridad', 'Guantes', 'Anteojos de seguridad'],
    never: ['Subir sin estar enganchado en todo momento (100% amarrado)', 'Trabajar solo en altura', 'Usar un arnés que ya frenó una caída', 'Improvisar plataformas con cajones o tachos'],
    talk: ['Por qué la caída de altura es la primera causa de muerte en obras', 'Cómo se revisa el arnés y el cabo antes de usarlo', 'Dónde anclarse y dónde no', 'Qué hacemos si alguien queda colgado: el rescate tiene que ser rápido'],
    norms: ['res61_23', 'dec911', 'dec351', 'ley19587'] },
  electrico: { ic: '⚡', name: 'Riesgo eléctrico (BT / MT)', permit: true,
    desc: 'Trabajos en tableros, rectificadores, energía de nodos, grupos electrógenos, líneas y cualquier instalación con tensión.',
    risks: ['Electrocución por contacto directo o indirecto', 'Arco eléctrico: quemaduras graves y lesión ocular', 'Retorno de tensión por grupo electrógeno o UPS', 'Incendio por cortocircuito'],
    before: ['Permiso de trabajo y personal capacitado y autorizado para tareas eléctricas', 'LAS 5 REGLAS DE ORO: 1) cortar todas las fuentes, 2) bloquear y señalizar (candado y tarjeta), 3) verificar ausencia de tensión con detector probado, 4) poner a tierra y en cortocircuito, 5) delimitar la zona de trabajo', 'Identificar también grupos electrógenos, UPS y baterías que puedan realimentar', 'Herramientas aisladas y detector de tensión verificado antes y después', 'Tableros con disyuntor diferencial y puesta a tierra', 'En media y alta tensión con tensión: solo personal habilitado y según el reglamento de la SRT'],
    epp: ['Casco dieléctrico', 'Guantes dieléctricos de la clase adecuada', 'Protector facial o anteojos contra arco', 'Ropa ignífuga (sin prendas sintéticas)', 'Calzado dieléctrico', 'Alfombra o banqueta aislante si corresponde'],
    never: ['Trabajar "con cuidado" en tensión cuando se puede cortar', 'Puentear protecciones o disyuntores', 'Confiar en que "ya lo cortó otro" sin verificar', 'Usar anillos, relojes o cadenas metálicas'],
    talk: ['Las 5 reglas de oro, una por una', 'Quién pone el candado y quién lo saca', 'Riesgo de retorno por grupo o UPS en nodos', 'Qué hacer si alguien queda pegado: cortar la energía antes de tocarlo'],
    norms: ['dec351', 'res11_22', 'res900_15', 'ley19587'] },
  confinado: { ic: '🕳️', name: 'Espacio confinado (cámaras, sótanos, tanques)', permit: true,
    desc: 'Cámaras subterráneas, pozos, sótanos, tanques o recintos con entrada estrecha y ventilación pobre.',
    risks: ['Falta de oxígeno', 'Gases tóxicos (sulfhídrico, monóxido) o inflamables', 'Atrapamiento o inundación', 'Rescatista que entra sin protección y también se accidenta'],
    before: ['Permiso de trabajo de ingreso a espacio confinado', 'Medir la atmósfera ANTES de entrar y durante toda la tarea: oxígeno, inflamables, monóxido y sulfhídrico, con detector calibrado', 'Ventilar (forzado si hace falta) y volver a medir', 'Vigía en el exterior todo el tiempo, con comunicación permanente con quien está adentro', 'Equipo de rescate listo (trípode, arnés, cuerda) y plan de rescate conocido', 'Señalizar y proteger la boca de la cámara'],
    epp: ['Detector multigas', 'Arnés con punto de rescate', 'Casco', 'Guantes', 'Calzado de seguridad', 'Equipo de respiración si la medición lo exige', 'Linterna antiexplosiva'],
    never: ['Entrar sin medir', 'Entrar a rescatar sin equipo: la mayoría de las muertes en espacios confinados son de rescatistas', 'Usar motores a combustión cerca de la boca', 'Quedarse adentro si suena la alarma del detector'],
    talk: ['Por qué un espacio "con aire" puede no tener oxígeno', 'Cómo se lee el detector y qué hacer si alarma', 'Rol del vigía y cómo nos comunicamos', 'El rescate se hace desde afuera'],
    norms: ['res953_10', 'srt_conf', 'dec351', 'ley19587'] },
  excavacion: { ic: '⛏️', name: 'Zanjas y excavaciones', permit: false,
    desc: 'Zanjeo para fibra o energía, pozos para postes, cámaras y fundaciones.',
    risks: ['Derrumbe de paredes y sepultamiento', 'Rotura de servicios enterrados: gas, electricidad, agua, telecomunicaciones', 'Caída de personas o vehículos a la zanja', 'Caída de material del borde'],
    before: ['Pedir y revisar planos de interferencias (gas, energía, agua, cloacas, telecom) y hacer cateos manuales', 'Más de 1,20 m de profundidad: entibado o talud según el tipo de suelo (Res. SRT 503/14)', 'Material extraído y máquinas lejos del borde', 'Barandas o vallado y señalización, también de noche', 'Escalera de acceso y salida dentro de la zanja', 'Revisar paredes después de lluvia o vibraciones'],
    epp: ['Casco', 'Calzado de seguridad', 'Guantes', 'Ropa de alta visibilidad', 'Protección auditiva con máquinas'],
    never: ['Bajar a una zanja profunda sin entibar', 'Excavar con máquina sobre un servicio sin cateo previo', 'Dejar la zanja abierta sin vallado'],
    talk: ['Señales de que una pared va a ceder', 'Qué hacer si aparece un caño o un cable no previsto', 'Distancia del material al borde'],
    norms: ['res503_14', 'dec911', 'ley19587'] },
  via_publica: { ic: '🚧', name: 'Trabajo en la vía pública', permit: false,
    desc: 'Tareas en veredas, calzadas, banquinas y cruces: tendido, cámaras, postes, gabinetes.',
    risks: ['Atropello', 'Caída de peatones en la zona de trabajo', 'Conflictos con el tránsito'],
    before: ['Permiso municipal o de vialidad cuando corresponda', 'Señalizar ANTES de empezar: conos, vallas, cartel de obra; de noche, luces', 'Chaleco o ropa de alta visibilidad todo el tiempo', 'Banderillero si se ocupa calzada', 'Vehículo de la empresa como barrera y con balizas', 'Paso seguro para peatones'],
    epp: ['Chaleco / ropa de alta visibilidad', 'Casco', 'Calzado de seguridad', 'Guantes'],
    never: ['Trabajar en calzada sin señalización', 'Dejar cámaras abiertas sin vallar', 'Dar la espalda al tránsito'],
    talk: ['Cómo se arma la señalización en el sentido del tránsito', 'Rol del banderillero', 'Qué hacer al terminar: retirar todo y dejar la vereda transitable'],
    norms: ['ley24449', 'dec779', 'ley19587'] },
  fibra: { ic: '🧵', name: 'Fibra óptica (empalmes y mediciones)', permit: false,
    desc: 'Empalmes, mediciones OTDR, conectorizado, trabajo en cajas, ODF y cámaras.',
    risks: ['Láser invisible: lesión ocular', 'Restos de fibra: astillas que se clavan en la piel o se ingieren', 'Químicos de limpieza (alcohol isopropílico) inflamables', 'Posturas prolongadas'],
    before: ['Tratar toda fibra como si estuviera iluminada', 'Contenedor para descartar los restos de fibra (cerrado y señalizado)', 'Superficie limpia y despejada para empalmar', 'Ventilación al usar alcohol; sin fuego cerca', 'Si es en altura, cámara o vía pública: sumar esos trabajos'],
    epp: ['Anteojos de seguridad', 'Guantes de nitrilo para limpieza', 'Delantal o ropa sin pelusas'],
    never: ['Mirar el extremo de una fibra o un conector (ni con microscopio sin filtro con la fibra iluminada)', 'Comer, beber o fumar mientras se empalma', 'Tirar restos de fibra al piso o a la basura común', 'Frotarse los ojos con las manos sin lavar'],
    talk: ['El láser de comunicaciones no se ve: por qué no hay que mirar nunca', 'Dónde van los restos de fibra', 'Pausas y postura en jornadas largas de empalme'],
    norms: ['dec351', 'ley19587'] },
  antenas: { ic: '📡', name: 'Antenas y microondas (radiofrecuencia)', permit: false,
    desc: 'Trabajos en torres y azoteas cerca de antenas en servicio: microondas, celulares, radioenlaces.',
    risks: ['Exposición a radiaciones no ionizantes por encima de los límites cerca de las antenas', 'Caída de altura (sumar ese trabajo)', 'Descarga atmosférica'],
    before: ['Coordinar con el operador o dueño de las antenas: bajar potencia o apagar antes de acercarse al frente de las antenas', 'Identificar las antenas en servicio y su zona de exclusión (señalización)', 'No quedarse delante de antenas de panel o parábolas en servicio', 'Si es en torre: permiso de trabajo en altura'],
    epp: ['Monitor personal de RF (si la empresa lo tiene)', 'Todo el EPP de trabajo en altura'],
    never: ['Pararse frente a una antena en servicio', 'Retirar la señalización de zona de exclusión', 'Trabajar con tormenta'],
    talk: ['Qué son las radiaciones no ionizantes y por qué importa la distancia', 'Con quién coordinamos el apagado', 'Cómo reconocemos la zona de exclusión'],
    norms: ['resms202', 'res3690', 'res61_23', 'ley19587'] },
  izaje: { ic: '🏗️', name: 'Izaje de cargas', permit: false,
    desc: 'Grúas, hidrogrúas, autoelevadores, aparejos y poleas para subir equipos, bobinas o postes.',
    risks: ['Caída de la carga', 'Vuelco del equipo', 'Atrapamiento y golpes', 'Contacto con líneas eléctricas'],
    before: ['Operador habilitado y con credencial; equipo con mantenimiento al día', 'Conocer el peso de la carga y la capacidad del equipo a ese radio', 'Revisar eslingas, grilletes y ganchos (con traba)', 'Terreno firme y estabilizadores extendidos', 'Zona de exclusión y un solo señalero', 'Distancia segura a líneas eléctricas'],
    epp: ['Casco', 'Guantes', 'Calzado de seguridad', 'Ropa de alta visibilidad'],
    never: ['Pasar o quedarse debajo de una carga suspendida', 'Transportar personas en la carga o en la uña del autoelevador', 'Izar con viento fuerte'],
    talk: ['Señales de mano del señalero', 'Cómo se revisa una eslinga', 'Distancia a líneas eléctricas'],
    norms: ['dec911', 'res960_15', 'dec351'] },
  caliente: { ic: '🔥', name: 'Trabajo en caliente (soldadura, corte, amolado)', permit: true,
    desc: 'Soldadura, corte con amoladora o soplete, termofusión cerca de materiales combustibles.',
    risks: ['Incendio o explosión', 'Quemaduras', 'Lesiones oculares y radiación del arco', 'Humos de soldadura'],
    before: ['Permiso de trabajo en caliente', 'Retirar o cubrir materiales combustibles de la zona', 'Extintor adecuado al alcance de la mano', 'Verificar que no haya atmósfera inflamable (cámaras, tanques)', 'Biombos o pantallas para proteger a otros', 'Vigilancia de fuego después de terminar'],
    epp: ['Careta de soldar o protector facial', 'Guantes de descarne', 'Delantal y polainas de cuero', 'Ropa de algodón o ignífuga', 'Protección respiratoria si hay humos'],
    never: ['Soldar o cortar recipientes que contuvieron combustible sin limpiar y desgasificar', 'Retirarse apenas termina sin revisar puntos calientes', 'Usar la amoladora sin protector del disco'],
    talk: ['Dónde está el extintor y cómo se usa', 'Radio de chispas de una amoladora', 'Vigilancia de fuego al terminar'],
    norms: ['dec351', 'dec911', 'ley19587'] },
  vehiculos: { ic: '🚐', name: 'Manejo de vehículos', permit: false,
    desc: 'Traslados a sitios, rutas y caminos rurales, transporte de materiales y escaleras.',
    risks: ['Choque o vuelco', 'Cansancio y somnolencia', 'Carga mal sujeta', 'Accidente in itinere'],
    before: ['Control del vehículo: luces, frenos, neumáticos, nivel de aceite y agua', 'Matafuego, balizas, botiquín y documentación al día', 'Carga y escaleras bien sujetas', 'Licencia de conducir vigente y de la categoría correcta', 'Descanso suficiente; planificar paradas en viajes largos'],
    epp: ['Cinturón de seguridad (todos los ocupantes)', 'Chaleco reflectivo para bajar en ruta'],
    never: ['Usar el celular mientras se maneja', 'Manejar con sueño, alcohol o medicación que afecte', 'Exceder la velocidad, menos aún en caminos de tierra'],
    talk: ['Control previo del vehículo', 'Cansancio: cuándo parar', 'Qué hacer ante un accidente en ruta'],
    norms: ['ley24449', 'ley24557'] },
  solitario: { ic: '🧍', name: 'Trabajo en solitario', permit: false,
    desc: 'Tareas en sitios alejados o fuera de horario sin otra persona cerca.',
    risks: ['Demora en recibir ayuda ante un accidente o descompensación', 'Agresiones o robos'],
    before: ['Avisar al supervisor el inicio, el lugar y la hora estimada de fin', 'Celular cargado y con señal (o equipo de comunicación alternativo)', 'Acordar llamadas de control periódicas', 'Compartir la ubicación desde la app', 'No hacer solo trabajos en altura, eléctricos o en espacios confinados'],
    epp: ['El EPP de la tarea que se va a hacer', 'Linterna'],
    never: ['Hacer solo una tarea que exige vigía o compañero', 'Dejar de avisar el fin de la tarea'],
    talk: ['Cómo y cada cuánto avisamos que estamos bien', 'Qué hace el supervisor si no hay respuesta'],
    norms: ['ley19587', 'dec351'] },
};

// pasos ante un accidente
const HYS_ACC = [
  ['🛑', 'Asegurar la zona', 'Antes de acercarte, que no haya otro peligro: cortá la energía, detené máquinas, señalizá. No te conviertas en otra víctima.'],
  ['📞', 'Pedir ayuda', 'Llamá a emergencias (botones de arriba) y a la ART. Decí dónde estás, qué pasó y cuántos heridos hay. La app puede compartir tu ubicación.'],
  ['🩹', 'Primeros auxilios básicos', 'Solo lo que sepas hacer. Ver "Qué hacer y qué no" más abajo.'],
  ['📣', 'Avisar al supervisor y a HyS', 'Con el botón de WhatsApp de este paso. El empleador tiene que pedir de inmediato la atención médica a través de la ART.'],
  ['📸', 'Preservar la escena', 'No muevas herramientas ni equipos salvo para salvar vidas. Sacá fotos y anotá testigos en el registro del accidente.'],
  ['📝', 'Denuncia a la ART', 'El empleador denuncia el accidente a la ART de inmediato y completa el formulario de denuncia dentro de las 48 h; el trabajador recibe una copia (Res. SRT 525/15).'],
  ['🔎', 'Investigar', 'Se abre un caso con los 5 porqués: buscar la causa raíz, no al culpable. Definir acciones correctivas y la lección aprendida.'],
];
const HYS_FIRSTAID = {
  do: ['Hablarle y tranquilizarlo; no dejarlo solo', 'Hemorragia: presión directa con un paño limpio', 'Quemadura: agua fría corriente 10 a 20 minutos', 'Electrocución: cortar la energía ANTES de tocar a la persona', 'Si no respira y estás capacitado: RCP hasta que llegue la ambulancia', 'Caída de altura: inmovilizar, no sacar el casco', 'Persona colgada del arnés: rescatarla lo antes posible (trauma por suspensión)'],
  dont: ['Mover al herido salvo peligro inmediato', 'Darle de beber o comer', 'Poner hielo, cremas o pasta dental en quemaduras', 'Retirar objetos clavados', 'Entrar a un espacio confinado a rescatar sin equipo'],
};
// pasos ante un incumplimiento
const HYS_DEV = [
  ['⛔', 'Detener la tarea', 'Cualquier persona puede y debe frenar un trabajo con riesgo grave e inminente. El trabajador puede negarse a hacer una tarea que lo pone en peligro (Ley 20.744, art. 75).'],
  ['📸', 'Registrar el desvío', 'Qué se incumple, foto, lugar y quién o qué contratista. Se registra desde la app, aunque no haya señal.'],
  ['📣', 'Avisar', 'Al supervisor y al responsable de HyS. Si es una contratista, a su responsable.'],
  ['🔧', 'Corregir antes de seguir', 'La tarea se retoma solo cuando la condición insegura está resuelta y verificada.'],
  ['📋', 'Acción correctiva', 'Se abre un caso con responsable y plazo. Si se repite, se escala y queda en el historial de calidad de la contratista.'],
];
const HYS_DUE_KIND = { capacitacion: ['🎓', 'Capacitación'], examen: ['🩺', 'Examen médico'], epp: ['🦺', 'Entrega / recambio de EPP'], extintor: ['🧯', 'Extintor'], calibracion: ['📏', 'Calibración'], seguro: ['📄', 'Seguro / ART'], habilitacion: ['🪪', 'Habilitación / licencia'], otro: ['📌', 'Otro'] };
