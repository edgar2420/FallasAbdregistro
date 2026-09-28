export function claseSeveridad(severidad: string | null | undefined) {
  if (severidad === 'Crítica' || severidad === 'Alta') return 'red';
  return severidad === 'Media' ? 'orange' : 'green';
}

export function claseEstadoFalla(estado: string | null | undefined) {
  if (estado === 'Resuelta') return 'green';
  if (estado === 'En proceso') return 'orange';
  if (estado === 'Anulada') return '';
  return 'red';
}

export function claseEstadoMaquina(estado: string | null | undefined) {
  if (estado === 'Operativa') return 'green';
  if (estado === 'En falla') return 'red';
  return 'orange';
}

export function fechaCorta(valor: string | null | undefined, conHora = true) {
  if (!valor) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(valor);
  if (!m) return valor;
  const dia = `${m[3]}/${m[2]}/${m[1]}`;
  return conHora && m[4] ? `${dia} ${m[4]}:${m[5]}` : dia;
}

export function aInputFecha(valor: string | null | undefined) {
  return valor ? valor.replace(' ', 'T').slice(0, 16) : '';
}

export function contiene(texto: string, consulta: string) {
  const q = consulta.trim().toLowerCase();
  return !q || texto.toLowerCase().includes(q);
}

export function tamano(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function conPausa<T extends unknown[]>(fn: (...args: T) => void, ms = 300) {
  let t: ReturnType<typeof setTimeout> | undefined;
  return (...args: T) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function consulta(filtros: Record<string, string | number | boolean | null | undefined>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(filtros)) {
    if (v !== null && v !== undefined && v !== '' && v !== false) p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function aFecha(valor: string | null | undefined) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(valor ?? '');
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0)) : null;
}

export function fechaLarga(valor: string | null | undefined) {
  const d = aFecha(valor);
  return d ? `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}` : '—';
}

export function haceCuanto(valor: string | null | undefined) {
  const d = aFecha(valor);
  if (!d) return '';
  const hoy = new Date();
  const dias = Math.round(
    (new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime() -
      new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86_400_000,
  );
  const plural = (n: number, s: string, p: string) => `hace ${n} ${n === 1 ? s : p}`;
  if (dias < 0) return 'programada';
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'ayer';
  if (dias < 7) return plural(dias, 'día', 'días');
  if (dias < 30) return plural(Math.floor(dias / 7), 'semana', 'semanas');
  if (dias < 365) return plural(Math.floor(dias / 30), 'mes', 'meses');
  return plural(Math.floor(dias / 365), 'año', 'años');
}

export function diaISO(d: Date) {
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

export const PERIODOS = [
  { id: '', texto: 'Cualquier fecha' },
  { id: 'hoy', texto: 'Hoy' },
  { id: '7', texto: 'Últimos 7 días' },
  { id: '30', texto: 'Últimos 30 días' },
  { id: '90', texto: 'Últimos 3 meses' },
  { id: 'anio', texto: 'Este año' },
  { id: 'personalizado', texto: 'Personalizado…' },
];

export function rangoPeriodo(id: string): { desde: string; hasta: string } | null {
  const hoy = new Date();
  if (!id) return { desde: '', hasta: '' };
  if (id === 'hoy') return { desde: diaISO(hoy), hasta: diaISO(hoy) };
  if (id === 'anio') return { desde: `${hoy.getFullYear()}-01-01`, hasta: diaISO(hoy) };
  const n = Number(id);
  if (n > 0) {
    const desde = new Date(hoy);
    desde.setDate(desde.getDate() - (n - 1));
    return { desde: diaISO(desde), hasta: diaISO(hoy) };
  }
  return null;
}

export function slugCategoria(c: string | null | undefined) {
  return (c ?? 'otra')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[\s/(]/)[0];
}

const PALETA_DEPARTAMENTOS = ['#3b82f6', '#14b8a6', '#8b5cf6', '#f59e0b', '#f43f5e', '#10b981', '#0ea5e9', '#d946ef'];
const DEPARTAMENTOS_CONOCIDOS: Record<string, string> = {
  produccion: '#3b82f6',
  'servicios de apoyo': '#14b8a6',
  acondicionamiento: '#8b5cf6',
  mantenimiento: '#f59e0b',
  calidad: '#10b981',
  'control de calidad': '#10b981',
  almacen: '#0ea5e9',
};

export function colorDepartamento(nombre: string | null | undefined) {
  const clave = (nombre ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
  if (!clave) return '#94a3b8';
  if (DEPARTAMENTOS_CONOCIDOS[clave]) return DEPARTAMENTOS_CONOCIDOS[clave];
  let h = 0;
  for (const c of clave) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETA_DEPARTAMENTOS[h % PALETA_DEPARTAMENTOS.length];
}
