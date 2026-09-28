import fs from 'node:fs';
import { db, row, adjuntosDir } from './db.js';
import { p } from './utils.js';
import { crearHash } from './auth.js';

const crearUsuario = db.prepare(`INSERT OR IGNORE INTO usuarios (nombre, email, password_hash, rol, debe_cambiar) VALUES (?, ?, ?, ?, 1)`);
crearUsuario.run('Administrador', 'admin', crearHash(process.env.ADMIN_PASSWORD || 'Admin1234!'), 'admin');
crearUsuario.run('Operador de planta', 'operador', crearHash(process.env.OPERADOR_PASSWORD || 'Operador1234!'), 'operador');

const reset = process.argv.includes('--reset');
if (reset) {
  db.exec('DELETE FROM adjuntos; DELETE FROM soluciones; DELETE FROM fallas; DELETE FROM maquinas; DELETE FROM tipos_maquina;');
  db.exec("DELETE FROM sqlite_sequence WHERE name IN ('adjuntos','soluciones','fallas','maquinas','tipos_maquina');");
  for (const archivo of fs.readdirSync(adjuntosDir)) fs.rmSync(`${adjuntosDir}/${archivo}`, { force: true });
  console.log('Base vaciada.');
}

const TIPOS = [
  ['Bottelpack', 'Equipos Blow-Fill-Seal (soplado-llenado-sellado) para soluciones estériles'],
  ['Shinva', 'Líneas de llenado y esterilización Shinva (autoclaves, llenadoras de ampollas)'],
  ['Taponadora', 'Equipos de tapado, roscado y sellado de envases'],
  ['Llenadora', 'Llenadoras volumétricas y de pistón'],
  ['Etiquetadora', 'Etiquetadoras autoadhesivas y de cola'],
  ['Autoclave', 'Esterilizadores por vapor saturado'],
  ['Compresor', 'Compresores de aire de planta'],
  ['Envasadora', 'Envasadoras de blíster y sachet'],
  ['Ósmosis inversa', 'Sistemas de tratamiento de agua purificada por ósmosis inversa'],
];

const MAQUINAS = [
  ['BP-460', 'Bottelpack 460 - Línea estériles 1', 'Bottelpack', 'Rommelag', 'bottelpack 460', 'Estériles', 2016],
  ['BP-321', 'Bottelpack 321 - Línea estériles 2', 'Bottelpack', 'Rommelag', 'bottelpack 321', 'Estériles', 2012],
  ['SHV-AMP1', 'Shinva llenadora-selladora de ampollas', 'Shinva', 'Shinva', 'AGF-8', 'Inyectables', 2018],
  ['SHV-AUT1', 'Shinva autoclave de vapor 1000 L', 'Shinva', 'Shinva', 'XG1.DMQ-1.0', 'Esterilización', 2018],
  ['TAP-01', 'Taponadora roscadora lineal 4 cabezales', 'Taponadora', 'Zonesun', 'ZS-XG440', 'Líquidos', 2020],
  ['TAP-02', 'Taponadora de presión para viales', 'Taponadora', 'Marchesini', 'ML-60', 'Inyectables', 2015],
  ['LLE-01', 'Llenadora volumétrica 8 boquillas', 'Llenadora', 'IMA', 'Volumetrix 8', 'Líquidos', 2017],
  ['ETI-01', 'Etiquetadora autoadhesiva doble cara', 'Etiquetadora', 'Herma', '400', 'Acondicionado', 2019],
  ['COM-01', 'Compresor de tornillo 75 HP', 'Compresor', 'Atlas Copco', 'GA55', 'Servicios', 2014],
  ['ENV-01', 'Blistera alternativa', 'Envasadora', 'Uhlmann', 'UPS4', 'Sólidos', 2013],
  ['AM-015-01', 'Osmosis inversa IPA', 'Ósmosis inversa', 'N.A', 'DP-050-SV', 'Osmosis', null],
];

const FICHAS = {
  'BP-460': ['Producción', '4000 u/h', 'POE-MAN-011; POE-PRO-021', '380 V trifásico 60 Hz', '95 A', '45 kW', '6-8 bar', '3 bar'],
  'BP-321': ['Producción', '3000 u/h', 'POE-MAN-012; POE-PRO-022', '380 V trifásico 60 Hz', '70 A', '32 kW', '6-8 bar', '3 bar'],
  'SHV-AMP1': ['Producción', '6000 amp/h', 'POE-MAN-020', '380 V trifásico 60 Hz', '25 A', '11 kW', '6 bar', null],
  'SHV-AUT1': ['Producción', '1000 L', 'POE-MAN-021; POE-VAL-004', '380 V trifásico 60 Hz', '16 A', '7.5 kW', '6 bar', '3.5 bar'],
  'TAP-01': ['Producción', '2400 u/h', 'POE-MAN-030', '220 V monofásico 60 Hz', '8 A', '1.5 kW', '6 bar', null],
  'TAP-02': ['Producción', '3600 u/h', 'POE-MAN-031', '220 V monofásico 60 Hz', '10 A', '2.2 kW', '6 bar', null],
  'LLE-01': ['Producción', '3000 u/h', 'POE-MAN-040', '380 V trifásico 60 Hz', '12 A', '4 kW', '6 bar', null],
  'ETI-01': ['Acondicionamiento', '6000 u/h', 'POE-MAN-050', '220 V monofásico 60 Hz', '6 A', '1.2 kW', null, null],
  'COM-01': ['Servicios de apoyo', '9.5 m³/min', 'POE-MAN-060', '380 V trifásico 60 Hz', '105 A', '55 kW', '7.5 bar (descarga)', null],
  'ENV-01': ['Producción', '120 ciclos/min', 'POE-MAN-070', '380 V trifásico 60 Hz', '40 A', '18 kW', '6 bar', null],
  'AM-015-01': ['Servicios de apoyo', '1400 L/H', 'ASA-POE-003', null, null, null, null, null],
};

const CASOS = [
  ['BP-460', 'Sellado deficiente en ampollas BFS',
    'Fugas en el cordón de sellado, ampollas con goteo en control visual',
    'Mecánica', 'Crítica', 'Desgaste del inserto de sellado y presión de cierre por debajo de parámetro', 240, 12,
    { descripcion: '1) Parada de línea y bloqueo LOTO. 2) Desmontaje del molde de sellado. 3) Reemplazo del inserto de sellado desgastado. 4) Ajuste de presión de cierre a 120 bar según ficha técnica. 5) Prueba de hermeticidad (blue dye test) sobre 30 unidades. 6) Liberación por Calidad.',
      repuestos: 'Inserto de sellado molde BFS (2 u.)', tiempo_minutos: 210, costo: 850, tecnico: 'Mantenimiento mecánico',
      preventivo: 'Inspección del inserto cada 500 h de operación y registro de presión de cierre por lote' }],
  ['BP-460', 'Parison irregular / espesor variable',
    'Espesor de pared desigual, envases deformes al desmoldar',
    'Operativa', 'Alta', 'Temperatura de extrusión fuera de rango en zona 3 y resina con humedad', 90, 34,
    { descripcion: 'Verificación de perfil de temperaturas del extrusor, recalibración de zona 3 (termopar flojo), secado de resina PE por 4 h a 80 °C y purga del husillo. Se descartaron 120 unidades del arranque.',
      repuestos: 'Termopar tipo J zona 3', tiempo_minutos: 120, costo: 60, tecnico: 'Mantenimiento eléctrico',
      preventivo: 'Control diario del perfil de temperaturas y verificación de humedad de resina antes de cada lote' }],
  ['BP-460', 'Alarma de baja presión de aire estéril',
    'HMI muestra alarma A-114, la máquina detiene el ciclo de soplado',
    'Neumática', 'Alta', 'Filtro HEPA de aire de soplado saturado', 75, 5,
    { descripcion: 'Cambio del filtro de aire estéril del soplado, prueba de integridad del filtro nuevo y purga de la línea. Presión restablecida a 6 bar.',
      repuestos: 'Filtro estéril 0.22 µm línea de soplado', tiempo_minutos: 60, costo: 420, tecnico: 'Mantenimiento',
      preventivo: 'Cambio programado de filtro cada 6 meses o ante caída de presión > 0.8 bar' }],
  ['BP-321', 'Fuga de aceite en unidad hidráulica',
    'Charco de aceite bajo la central hidráulica, nivel del tanque descendiendo',
    'Hidráulica', 'Media', 'Retén del cilindro de cierre de molde vencido', 180, 47,
    { descripcion: 'Reemplazo del kit de sellos del cilindro de cierre, limpieza del área, reposición de 12 L de aceite ISO VG 46 y purga del circuito. Prueba en vacío por 30 ciclos sin fuga.',
      repuestos: 'Kit de sellos cilindro Ø80, aceite ISO VG 46 (12 L)', tiempo_minutos: 165, costo: 320, tecnico: 'Mantenimiento mecánico',
      preventivo: 'Inspección mensual de retenes y análisis de aceite semestral' }],
  ['BP-321', 'Corte irregular del cuchillo de parison',
    'Rebabas en la base del envase y hilos de PE en el molde',
    'Mecánica', 'Media', 'Cuchilla desafilada y desalineada respecto al molde', 60, 20,
    { descripcion: 'Afilado y realineación de la cuchilla, ajuste del recorrido del actuador y limpieza de restos de PE en el molde.',
      repuestos: '—', tiempo_minutos: 55, costo: 0, tecnico: 'Mantenimiento mecánico',
      preventivo: 'Afilado de cuchilla cada 250 h y verificación de alineación en cada cambio de formato' }],

  ['SHV-AMP1', 'Ampollas con sellado abierto (cuello largo)',
    'Llama de sellado despareja, ampollas con punta abierta al final del carril',
    'Mecánica', 'Crítica', 'Desregulación de la mezcla oxígeno/GLP y pinzas de estirado con juego', 300, 8,
    { descripcion: 'Regulación de la relación O2/GLP a 2.5:1, limpieza de los picos de quemador, reemplazo de dos pinzas de estirado con juego excesivo y calibración de la altura de llama. Rechazo del material del arranque y muestreo de 100 ampollas conforme.',
      repuestos: 'Pinzas de estirado (2 u.), picos de quemador (4 u.)', tiempo_minutos: 280, costo: 640, tecnico: 'Mantenimiento mecánico',
      preventivo: 'Verificación diaria de la relación de gases y limpieza semanal de quemadores' }],
  ['SHV-AMP1', 'Volumen de llenado fuera de especificación',
    'Control de peso detecta desviación de -4% en boquillas 3 y 5',
    'Calidad de producto', 'Alta', 'Desgaste de émbolos de las bombas dosificadoras 3 y 5', 120, 26,
    { descripcion: 'Reemplazo de émbolos y sellos de las bombas 3 y 5, recalibración volumétrica de las 8 boquillas y verificación con 20 pesadas por boquilla.',
      repuestos: 'Émbolo dosificador (2 u.), juego de sellos', tiempo_minutos: 110, costo: 780, tecnico: 'Mantenimiento mecánico',
      preventivo: 'Calibración volumétrica al inicio de cada lote y cambio de émbolos cada 12 meses' }],
  ['SHV-AMP1', 'Atasco de ampollas en el carril de alimentación',
    'Acumulación de ampollas al ingreso, sensor de atasco activo',
    'Operativa', 'Baja', 'Guías del carril desajustadas tras el cambio de formato', 25, 3,
    { descripcion: 'Reajuste de las guías laterales al formato de 5 mL y verificación del sensor de acumulación.',
      repuestos: '—', tiempo_minutos: 20, costo: 0, tecnico: 'Operador senior',
      preventivo: 'Usar plantilla de cambio de formato y registrar las medidas de guía por presentación' }],
  ['SHV-AUT1', 'Ciclo de esterilización no alcanza 121 °C',
    'Aborta el ciclo en la fase de exposición, alarma de temperatura baja',
    'Servicios (agua/vapor/aire)', 'Crítica', 'Trampa de vapor obstruida y presión de vapor de red por debajo de 3 bar', 360, 15,
    { descripcion: 'Limpieza y reemplazo de la trampa de vapor de la cámara, purga de condensado, ajuste de la válvula reductora a 3.5 bar y validación con ciclo de prueba + indicadores biológicos (resultado conforme).',
      repuestos: 'Trampa de vapor termodinámica 1/2"', tiempo_minutos: 330, costo: 290, tecnico: 'Mantenimiento / Servicios',
      preventivo: 'Inspección trimestral de trampas de vapor y registro diario de presión de red' }],
  ['SHV-AUT1', 'Puerta no sella - alarma de vacío',
    'La cámara no mantiene vacío en la fase de prevacío',
    'Neumática', 'Alta', 'Empaquetadura de puerta agrietada por envejecimiento', 150, 40,
    { descripcion: 'Reemplazo de la empaquetadura de silicona de la puerta, verificación del canal de inflado y prueba de fuga de vacío (leak test) conforme.',
      repuestos: 'Empaquetadura de puerta silicona', tiempo_minutos: 140, costo: 510, tecnico: 'Mantenimiento',
      preventivo: 'Leak test semanal y cambio preventivo de empaquetadura cada 24 meses' }],

  ['TAP-01', 'Torque de tapado inconsistente',
    'Tapas flojas en un 8% de las unidades, control de torque fuera de rango',
    'Mecánica', 'Alta', 'Embragues magnéticos descalibrados en cabezales 2 y 4', 90, 10,
    { descripcion: 'Calibración de los cuatro embragues magnéticos con torquímetro patrón a 12 kgf·cm, reemplazo del resorte del cabezal 4 y verificación sobre 50 envases.',
      repuestos: 'Resorte de cabezal (1 u.)', tiempo_minutos: 85, costo: 45, tecnico: 'Mantenimiento mecánico',
      preventivo: 'Verificación de torque por muestreo cada 2 h de producción y calibración mensual' }],
  ['TAP-01', 'Tapas mal orientadas en el alimentador vibratorio',
    'Tapas caen invertidas, atascos frecuentes en la rampa de bajada',
    'Operativa', 'Media', 'Amplitud de vibración excesiva y deflector de rechazo mal posicionado', 45, 6,
    { descripcion: 'Reducción de la amplitud del vibrador al 65%, reposicionamiento del deflector de rechazo y limpieza del tazón. Se eliminó el atasco en la rampa.',
      repuestos: '—', tiempo_minutos: 40, costo: 0, tecnico: 'Mantenimiento',
      preventivo: 'Registrar el % de amplitud por tipo de tapa en la hoja de cambio de formato' }],
  ['TAP-02', 'Viales con tapa aluminio mal engargolada',
    'Bordes cortantes y sellos flojos en el engargolado',
    'Mecánica', 'Alta', 'Rodillos de engargolado desgastados y altura de plato incorrecta', 120, 22,
    { descripcion: 'Cambio del juego de rodillos de engargolado, ajuste de la altura del plato a la presentación de 10 mL y prueba de hermeticidad sobre 30 viales.',
      repuestos: 'Juego de rodillos de engargolado', tiempo_minutos: 115, costo: 690, tecnico: 'Mantenimiento mecánico',
      preventivo: 'Inspección de rodillos cada 300 000 unidades' }],
  ['TAP-02', 'Servo del plato indexador en falla F-32',
    'La máquina se detiene con error de seguimiento del servo',
    'Electrónica / Control', 'Crítica', 'Encoder del servomotor con cable dañado por fatiga en la cadena portacables', 210, 30,
    { descripcion: 'Reemplazo del cable de encoder, revisión de la cadena portacables, reseteo de la falla en el drive y homing del plato indexador.',
      repuestos: 'Cable de encoder blindado 5 m', tiempo_minutos: 195, costo: 380, tecnico: 'Mantenimiento eléctrico',
      preventivo: 'Inspección semestral de cables en cadenas portacables' }],

  ['LLE-01', 'Goteo en boquillas al final del llenado',
    'Producto derramado sobre el cuello del envase',
    'Neumática', 'Media', 'Válvulas antigoteo con resorte fatigado', 70, 18,
    { descripcion: 'Reemplazo de resortes en 3 válvulas antigoteo, limpieza de asientos y ajuste del retroceso de succión en la receta del PLC.',
      repuestos: 'Resortes de válvula antigoteo (3 u.)', tiempo_minutos: 65, costo: 90, tecnico: 'Mantenimiento mecánico',
      preventivo: 'Cambio de resortes cada 12 meses y ajuste de succión al cambiar viscosidad de producto' }],
  ['ETI-01', 'Etiquetas descentradas en el envase',
    'Desplazamiento de ±3 mm respecto a la posición nominal',
    'Electrónica / Control', 'Media', 'Sensor de marca sucio y velocidad de dispensado no sincronizada con la cinta', 50, 9,
    { descripcion: 'Limpieza del sensor de marca, recalibración del sensor con la etiqueta en uso y sincronización de la velocidad de dispensado con el encoder de la cinta.',
      repuestos: '—', tiempo_minutos: 45, costo: 0, tecnico: 'Mantenimiento eléctrico',
      preventivo: 'Limpieza del sensor de marca en cada cambio de bobina' }],
  ['COM-01', 'Parada por alta temperatura de descarga',
    'Alarma de temperatura 110 °C y parada del compresor',
    'Mecánica', 'Alta', 'Radiador de aceite obstruido con polvo y nivel de aceite bajo', 180, 28,
    { descripcion: 'Limpieza del radiador con aire comprimido y desengrasante, reposición de aceite, cambio del filtro de aceite y del separador. Temperatura estabilizada en 78 °C.',
      repuestos: 'Filtro de aceite, separador aire-aceite, aceite 20 L', tiempo_minutos: 170, costo: 950, tecnico: 'Mantenimiento / Servicios',
      preventivo: 'Limpieza del radiador cada 500 h y cambio de aceite cada 4000 h' }],
  ['ENV-01', 'Blísteres con sellado incompleto',
    'Alvéolos con bordes despegados y rechazo por control de hermeticidad',
    'Mecánica', 'Alta', 'Placa de sellado con desgaste desigual y temperatura por debajo del set point', 140, 16,
    { descripcion: 'Rectificado de la placa de sellado, reemplazo de dos resistencias, calibración del control de temperatura a 180 °C y prueba de hermeticidad por vacío conforme.',
      repuestos: 'Resistencias cartucho (2 u.)', tiempo_minutos: 130, costo: 240, tecnico: 'Mantenimiento',
      preventivo: 'Verificación de uniformidad térmica de la placa cada 3 meses' }],
];

const ABIERTAS = [
  ['BP-460', 'Ruido anormal en el reductor del extrusor',
    'Golpeteo metálico al aumentar revoluciones, vibración perceptible',
    'Mecánica', 'Alta', 'En proceso', 0, 2, 'Se sospecha desgaste de rodamiento; a la espera del repuesto'],
  ['SHV-AUT1', 'Registrador de temperatura sin comunicación',
    'El software de registro pierde conexión con la sonda 2 de forma intermitente',
    'Software / HMI', 'Media', 'Abierta', 0, 1, null],
  ['TAP-01', 'Vibración del alimentador intermitente',
    'El tazón se detiene por algunos segundos y se reanuda solo',
    'Eléctrica', 'Media', 'Recurrente', 0, 4, 'Falla recurrente: ya se limpió el control de vibración dos veces'],
  ['LLE-01', 'Manguera de producto con microfisura',
    'Humedad en el acople de la boquilla 6',
    'Calidad de producto', 'Crítica', 'Abierta', 0, 0, null],
];

const insertTipo = db.prepare('INSERT OR IGNORE INTO tipos_maquina (nombre, descripcion) VALUES (?, ?)');
const insertMaquina = db.prepare(`
  INSERT OR IGNORE INTO maquinas (codigo, nombre, tipo_id, marca, modelo, area, anio, estado)
  VALUES (?,?,?,?,?,?,?,?)
`);
const insertFalla = db.prepare(`
  INSERT INTO fallas (codigo, maquina_id, titulo, descripcion, sintomas, categoria, severidad, estado,
                      causa_raiz, reportado_por, responsable, turno, fecha_deteccion, fecha_resolucion, paro_minutos)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
`);
const insertSolucion = db.prepare(`
  INSERT INTO soluciones (falla_id, descripcion, repuestos, tiempo_minutos, costo, tecnico, efectiva, preventivo, fecha)
  VALUES (?,?,?,?,?,?,1,?,?)
`);

const fechaHace = (dias, horas = 8) => {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  d.setHours(horas, 30, 0, 0);
  return d.toLocaleString('sv-SE').replace('T', ' ');
};
const idMaquina = (codigo) => row(db.prepare('SELECT id FROM maquinas WHERE codigo = ?'), codigo)?.id;
const idTipo = (nombre) => row(db.prepare('SELECT id FROM tipos_maquina WHERE nombre = ?'), nombre)?.id;

TIPOS.forEach(([nombre, desc]) => insertTipo.run(nombre, desc));
MAQUINAS.forEach(([codigo, nombre, tipo, marca, modelo, area, anio]) =>
  insertMaquina.run(codigo, nombre, p(idTipo(tipo)), marca, modelo, area, anio, 'Operativa'));

const completarFicha = db.prepare(`
  UPDATE maquinas SET departamento = ?, capacidad = ?, poe = ?, tension = ?, corriente = ?, potencia = ?,
    presion_aire = ?, presion_vapor = ?
  WHERE codigo = ? AND departamento IS NULL AND capacidad IS NULL AND poe IS NULL`);
Object.entries(FICHAS).forEach(([codigo, ficha]) => completarFicha.run(...ficha.map(p), codigo));
db.prepare("UPDATE maquinas SET num_serie = 'N.A' WHERE codigo = 'AM-015-01' AND num_serie IS NULL").run();

const yaHayFallas = row(db.prepare('SELECT COUNT(*) AS n FROM fallas')).n;
if (yaHayFallas > 0) {
  console.log(`Ya existen ${yaHayFallas} fallas registradas; no se vuelven a sembrar (usar --reset).`);
} else {
  let n = 0;
  CASOS.forEach(([maq, titulo, sintomas, categoria, severidad, causa, paro, dias, sol]) => {
    n += 1;
    const codigo = `FAL-${String(n).padStart(4, '0')}`;
    const deteccion = fechaHace(dias);
    const resolucion = fechaHace(dias, 8 + Math.min(10, Math.ceil(sol.tiempo_minutos / 60)));
    const { lastInsertRowid } = insertFalla.run(
      codigo, idMaquina(maq), titulo, `Falla detectada en ${maq} durante producción.`, sintomas,
      categoria, severidad, 'Resuelta', causa, 'Operador de línea', sol.tecnico, 'Mañana',
      deteccion, resolucion, paro,
    );
    insertSolucion.run(lastInsertRowid, sol.descripcion, p(sol.repuestos), sol.tiempo_minutos,
      sol.costo, sol.tecnico, p(sol.preventivo), resolucion);
  });

  ABIERTAS.forEach(([maq, titulo, sintomas, categoria, severidad, estado, paro, dias, nota]) => {
    n += 1;
    insertFalla.run(
      `FAL-${String(n).padStart(4, '0')}`, idMaquina(maq), titulo, p(nota), sintomas,
      categoria, severidad, estado, null, 'Operador de línea', null, 'Tarde',
      fechaHace(dias, 14), null, paro,
    );
  });

  db.exec(`
    UPDATE maquinas SET estado = 'En falla' WHERE id IN (
      SELECT maquina_id FROM fallas
      WHERE estado IN ('Abierta','En proceso','Recurrente') AND severidad IN ('Alta','Crítica'))
  `);
  console.log(`Sembradas ${n} fallas con sus soluciones.`);
}

console.log('Tipos:', row(db.prepare('SELECT COUNT(*) AS n FROM tipos_maquina')).n,
  '| Máquinas:', row(db.prepare('SELECT COUNT(*) AS n FROM maquinas')).n,
  '| Fallas:', row(db.prepare('SELECT COUNT(*) AS n FROM fallas')).n,
  '| Soluciones:', row(db.prepare('SELECT COUNT(*) AS n FROM soluciones')).n);
