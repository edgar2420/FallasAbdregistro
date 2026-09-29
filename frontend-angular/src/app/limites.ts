export const LIMITES = {
  maquina: {
    codigo: 30, nombre: 120, departamento: 80, area: 80, marca: 80, modelo: 80, num_serie: 80,
    capacidad: 60, poe: 200, tension: 60, tension_mando: 60, corriente: 60, potencia: 60, presion_aire: 60,
    presion_vapor: 60, presion_hidraulica: 60, notas: 2000,
  },
  falla: {
    codigo: 30, titulo: 150, descripcion: 2000, causa_raiz: 2000, codigo_alarma: 30, responsable: 100,
    categoria: 60,
  },
  solucion: { descripcion: 4000, repuestos: 500, herramientas: 500, tecnico: 100, preventivo: 2000 },
  tipo: { nombre: 80, descripcion: 300 },
  usuario: { nombre: 100, usuario: 60 },
  adjunto: { descripcion: 200, equipo: 2, por_maquina: 40, por_falla: 10, mb: 8 },
} as const;

export const POR_PAGINA = [10, 20, 50];
