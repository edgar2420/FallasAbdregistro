export class HttpError extends Error {
  constructor(status, message, codigo) {
    super(message);
    this.status = status;
    this.codigo = codigo;
  }
}

export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export const requerido = (valor, campo) => {
  if (valor === undefined || valor === null || String(valor).trim() === '') {
    throw new HttpError(400, `El campo "${campo}" es obligatorio`);
  }
  return String(valor).trim();
};
