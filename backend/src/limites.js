import { HttpError } from './errors.js';

/**
 * Máximo de caracteres por campo y de archivos por máquina/falla.
 * El frontend usa los mismos valores (frontend-angular/src/app/limites.ts) y los recibe en /api/catalogos.
 */
export const LIMITES = {
  maquina: {
    codigo: 30, nombre: 120, departamento: 80, area: 80, marca: 80, modelo: 80, num_serie: 80,
    capacidad: 60, poe: 200, tension: 60, corriente: 60, potencia: 60, presion_aire: 60,
    presion_vapor: 60, notas: 2000,
  },
  falla: {
    codigo: 30, titulo: 150, descripcion: 2000, causa_raiz: 2000, sintomas: 2000,
    reportado_por: 100, responsable: 100,
  },
  solucion: { descripcion: 4000, repuestos: 500, herramientas: 500, tecnico: 100, preventivo: 2000 },
  tipo: { nombre: 80, descripcion: 300 },
  usuario: { nombre: 100 },
  adjunto: { descripcion: 200, por_maquina: 40, por_falla: 10, mb: 8 },
};

const NOMBRES = {
  codigo: 'Código', nombre: 'Nombre', departamento: 'Departamento', area: 'Área', marca: 'Marca',
  modelo: 'Modelo', num_serie: 'Serie', capacidad: 'Capacidad', poe: 'Ref. (POE)', tension: 'Tensión',
  corriente: 'Corriente', potencia: 'Potencia', presion_aire: 'Presión de aire',
  presion_vapor: 'Presión de vapor', notas: 'Notas', titulo: 'Falla / error',
  descripcion: 'Descripción', causa_raiz: 'Causa', sintomas: 'Síntomas', reportado_por: 'Reportado por',
  responsable: 'Responsable', repuestos: 'Repuestos', herramientas: 'Herramientas', tecnico: 'Técnico',
  preventivo: 'Acción preventiva',
};

/** Rechaza con 400 cualquier texto que supere su máximo de caracteres. */
export const limitar = (datos, maximos) => {
  for (const [campo, max] of Object.entries(maximos)) {
    const v = datos[campo];
    if (typeof v === 'string' && v.length > max) {
      throw new HttpError(400, `«${NOMBRES[campo] ?? campo}» admite como máximo ${max} caracteres (tiene ${v.length})`);
    }
  }
  return datos;
};
