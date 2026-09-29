import { HttpError } from './errors.js';

export const LIMITES = {
  maquina: {
    codigo: 30, nombre: 120, departamento: 80, area: 80, marca: 80, modelo: 80, num_serie: 80,
    capacidad: 60, poe: 200, tension: 60, tension_mando: 60, corriente: 60, potencia: 60, presion_aire: 60,
    presion_vapor: 60, presion_hidraulica: 60, notas: 2000,
  },
  falla: {
    codigo: 30, titulo: 150, descripcion: 2000, causa_raiz: 2000, sintomas: 2000,
    codigo_alarma: 30, reportado_por: 100, responsable: 100, categoria: 60,
  },
  solucion: { descripcion: 4000, repuestos: 500, herramientas: 500, tecnico: 100, preventivo: 2000 },
  tipo: { nombre: 80, descripcion: 300 },
  usuario: { nombre: 100 },
  adjunto: { descripcion: 200, equipo: 2, por_maquina: 40, por_falla: 10, mb: 8 },
};

const NOMBRES = {
  codigo: 'Código', nombre: 'Nombre', departamento: 'Departamento', area: 'Área', marca: 'Marca',
  modelo: 'Modelo', num_serie: 'Serie', capacidad: 'Capacidad', poe: 'Ref. (POE)', tension: 'Tensión de servicio',
  corriente: 'Intensidad nominal', potencia: 'Potencia', presion_aire: 'Presión de aire',
  presion_vapor: 'Presión de vapor', notas: 'Notas', titulo: 'Falla / error',
  tension_mando: 'Tensión de mando', presion_hidraulica: 'Presión hidráulica',
  descripcion: 'Descripción', causa_raiz: 'Causa', sintomas: 'Síntomas', codigo_alarma: 'Código de alarma',
  reportado_por: 'Reportado por', categoria: 'Categoría',
  responsable: 'Responsable', repuestos: 'Repuestos', herramientas: 'Herramientas', tecnico: 'Técnico',
  preventivo: 'Acción preventiva',
};

export const limitar = (datos, maximos) => {
  for (const [campo, max] of Object.entries(maximos)) {
    const v = datos[campo];
    if (typeof v === 'string' && v.length > max) {
      throw new HttpError(400, `«${NOMBRES[campo] ?? campo}» admite como máximo ${max} caracteres (tiene ${v.length})`);
    }
  }
  return datos;
};
