export const CATEGORIAS = ['Mecánica', 'Eléctrica', 'Neumática', 'Hidráulica', 'Electrónica / Control',
  'Software / HMI', 'Operativa', 'Calidad de producto', 'Servicios (agua/vapor/aire)', 'Otra'];
export const SEVERIDADES = ['Baja', 'Media', 'Alta', 'Crítica'];
export const ESTADOS_FALLA = ['Abierta', 'En proceso', 'Resuelta', 'Recurrente', 'Anulada'];
export const ESTADOS_MAQUINA = ['Operativa', 'En falla', 'Mantenimiento', 'Fuera de servicio'];
export const TURNOS = ['Mañana', 'Tarde', 'Noche'];
export const CATEGORIAS_ADJUNTO = ['Eléctrica', 'Electrónica', 'Mecánica', 'Ficha técnica', 'Otra'];

export const ABIERTAS = ['Abierta', 'En proceso', 'Recurrente'];
export const ABIERTAS_SQL = `(${ABIERTAS.map((e) => `'${e}'`).join(',')})`;

export const catalogos = {
  categorias: CATEGORIAS,
  severidades: SEVERIDADES,
  estados_falla: ESTADOS_FALLA,
  estados_maquina: ESTADOS_MAQUINA,
  turnos: TURNOS,
  categorias_adjunto: CATEGORIAS_ADJUNTO,
};
