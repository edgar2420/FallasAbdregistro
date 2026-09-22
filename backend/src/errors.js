export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Envuelve handlers async para propagar errores al middleware de Express. */
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export const requerido = (valor, campo) => {
  if (valor === undefined || valor === null || String(valor).trim() === '') {
    throw new HttpError(400, `El campo "${campo}" es obligatorio`);
  }
  return String(valor).trim();
};
