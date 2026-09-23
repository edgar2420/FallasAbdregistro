import { HttpError } from './errors.js';

/** node:sqlite sólo acepta null, number, string, bigint o Uint8Array como parámetros. */
export const p = (v) => {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'number' || typeof v === 'string' || typeof v === 'bigint') return v;
  return String(v);
};

export const num = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

export const texto = (v) => (v === undefined || v === null ? null : String(v).trim() || null);

const vacio = (v) => v === undefined || v === null || String(v).trim() === '';

/** Valida que el valor pertenezca a un catálogo; null/vacío pasa como null. */
export const unoDe = (valor, lista, campo) => {
  const v = texto(valor);
  if (v === null) return null;
  if (!lista.includes(v)) throw new HttpError(400, `Valor no permitido en "${campo}": ${v}`);
  return v;
};

export const entero = (v, campo, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) => {
  if (vacio(v)) return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new HttpError(400, `"${campo}" debe ser un número entero entre ${min} y ${max}`);
  }
  return n;
};

export const decimal = (v, campo, { min = 0, max = 1e12 } = {}) => {
  if (vacio(v)) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw new HttpError(400, `"${campo}" debe ser un número válido`);
  return n;
};

/** Acepta "YYYY-MM-DD", "YYYY-MM-DDTHH:mm" o "YYYY-MM-DD HH:mm:ss" y guarda siempre "YYYY-MM-DD HH:mm:ss". */
export const fecha = (v, campo) => {
  const t = texto(v);
  if (t === null) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(t);
  const valida = m && (() => {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return d.getMonth() === Number(m[2]) - 1 && Number(m[4] ?? 0) < 24 && Number(m[5] ?? 0) < 60;
  })();
  if (!valida) throw new HttpError(400, `Fecha no válida en "${campo}"`);
  return `${m[1]}-${m[2]}-${m[3]} ${m[4] ?? '00'}:${m[5] ?? '00'}:${m[6] ?? '00'}`;
};

/** Condición LIKE sobre varias columnas con los comodines del usuario escapados. */
export const busqueda = (columnas, q) => {
  const patron = `%${String(q).trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  return {
    sql: `(${columnas.map((c) => `${c} LIKE ? ESCAPE '\\'`).join(' OR ')})`,
    args: columnas.map(() => patron),
  };
};
