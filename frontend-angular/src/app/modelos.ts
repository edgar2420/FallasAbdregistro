export type Rol = 'admin' | 'operador';

export interface Usuario {
  id: number;
  nombre: string;
  email: string;
  rol: Rol;
  activo: number;
  debe_cambiar?: number;
  ultimo_acceso?: string | null;
  creado_en?: string;
}

export interface Actividad {
  id: number;
  usuario_id: number | null;
  nombre: string | null;
  accion: string;
  ruta: string;
  detalle: string | null;
  creado_en: string;
}

export interface Catalogos {
  categorias: string[];
  severidades: string[];
  estados_falla: string[];
  estados_maquina: string[];
  turnos: string[];
  categorias_adjunto: string[];
}

export interface Tipo {
  id: number;
  nombre: string;
  descripcion: string | null;
  maquinas?: number;
}

export interface Adjunto {
  id: number;
  maquina_id: number;
  falla_id: number | null;
  falla_codigo: string | null;
  categoria: string;
  descripcion: string | null;
  mime: string;
  nombre_original: string | null;
  bytes: number;
  creado_en: string;
  subido_por_nombre: string | null;
}

export interface Solucion {
  id: number;
  falla_id: number;
  descripcion: string;
  repuestos: string | null;
  herramientas: string | null;
  tiempo_minutos: number;
  costo: number;
  tecnico: string | null;
  efectiva: number;
  preventivo: string | null;
  fecha: string;
  falla_codigo?: string;
  falla_titulo?: string;
  categoria?: string;
  maquina_id?: number;
  maquina_codigo?: string;
  maquina_nombre?: string;
  maquina_tipo?: string | null;
}

export interface Falla {
  id: number;
  codigo: string;
  maquina_id: number;
  titulo: string;
  descripcion: string | null;
  sintomas: string | null;
  categoria: string;
  severidad: string;
  estado: string;
  causa_raiz: string | null;
  codigo_alarma: string | null;
  reportado_por: string | null;
  responsable: string | null;
  turno: string | null;
  fecha_deteccion: string;
  fecha_resolucion: string | null;
  paro_minutos: number;
  soluciones?: number;
  ultima_solucion?: string | null;
  adjuntos?: number;
  maquina_codigo?: string;
  maquina_nombre?: string;
  maquina_area?: string | null;
  maquina_tipo?: string | null;
  soluciones_lista?: Solucion[];
  adjuntos_lista?: Adjunto[];
}

export interface Maquina {
  id: number;
  codigo: string;
  nombre: string;
  tipo_id: number | null;
  tipo?: string | null;
  marca: string | null;
  modelo: string | null;
  num_serie: string | null;
  departamento: string | null;
  area: string | null;
  capacidad: string | null;
  anio: number | null;
  estado: string;
  poe: string | null;
  tension: string | null;
  corriente: string | null;
  potencia: string | null;
  presion_aire: string | null;
  presion_vapor: string | null;
  notas: string | null;
  total_fallas?: number;
  fallas_abiertas?: number;
  total_adjuntos?: number;
  fallas?: Falla[];
  adjuntos?: Adjunto[];
}

export interface Estadisticas {
  dias: number;
  resumen: {
    maquinas: number;
    maquinas_operativas: number;
    maquinas_en_falla: number;
    fallas_total: number;
    fallas_abiertas: number;
    fallas_criticas: number;
    fallas_resueltas: number;
    soluciones: number;
    paro_minutos_periodo: number;
    fallas_periodo: number;
    mttr_horas: number;
  };
  top_maquinas: { id: number; codigo: string; nombre: string; fallas: number; paro_minutos: number }[];
}
