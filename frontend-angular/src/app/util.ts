/** Utilidades de presentación compartidas por las páginas. */

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

/** "2026-09-22 14:30:00" → "22/09/2026 14:30". */
export function fechaCorta(valor: string | null | undefined, conHora = true) {
  if (!valor) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(valor);
  if (!m) return valor;
  const dia = `${m[3]}/${m[2]}/${m[1]}`;
  return conHora && m[4] ? `${dia} ${m[4]}:${m[5]}` : dia;
}

/** Valor para <input type="datetime-local">. */
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

/** Llama a fn cuando el usuario deja de escribir. */
export function conPausa<T extends unknown[]>(fn: (...args: T) => void, ms = 300) {
  let t: ReturnType<typeof setTimeout> | undefined;
  return (...args: T) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/** Arma "?a=1&b=2" omitiendo los filtros vacíos. */
export function consulta(filtros: Record<string, string | number | boolean | null | undefined>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(filtros)) {
    if (v !== null && v !== undefined && v !== '' && v !== false) p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}
