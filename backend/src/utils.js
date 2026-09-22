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
