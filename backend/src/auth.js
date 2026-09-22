import crypto from 'node:crypto';
import { db, row, ahora } from './db.js';
import { HttpError } from './errors.js';

const hash = (password, salt = crypto.randomBytes(16).toString('hex')) => {
  const digest = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${digest}`;
};
const valido = (password, stored) => {
  const [salt, digest] = String(stored).split(':');
  if (!salt || !digest) return false;
  const actual = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(digest));
};

export const crearHash = hash;
export const auth = (req, _res, next) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  const sesion = token && row(db.prepare(`SELECT s.token, s.expira_en, u.id, u.nombre, u.email, u.rol, u.activo FROM sesiones s JOIN usuarios u ON u.id=s.usuario_id WHERE s.token=?`), token);
  if (!sesion || !sesion.activo || new Date(sesion.expira_en) < new Date()) return next(new HttpError(401, 'Sesión no válida o expirada'));
  req.usuario = sesion;
  const accion = req.method === 'GET' ? 'consulta' : `${req.method.toLowerCase()}_${req.path.split('/')[1] || 'recurso'}`;
  db.prepare('INSERT INTO actividad_usuarios (usuario_id, accion, ruta, detalle) VALUES (?, ?, ?, ?)')
    .run(sesion.id, accion, req.path, null);
  next();
};
export const admin = (req, _res, next) => req.usuario?.rol === 'admin' ? next() : next(new HttpError(403, 'Se requiere rol administrador'));
export const registrar = (usuarioId, accion, ruta, detalle = null) => db.prepare('INSERT INTO actividad_usuarios (usuario_id, accion, ruta, detalle) VALUES (?, ?, ?, ?)').run(usuarioId, accion, ruta, detalle);
export const iniciarSesion = (usuarioId) => {
  const token = crypto.randomBytes(32).toString('hex');
  const expira = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
  db.prepare('INSERT INTO sesiones (token, usuario_id, expira_en) VALUES (?, ?, ?)').run(token, usuarioId, expira);
  db.prepare('UPDATE usuarios SET ultimo_acceso=? WHERE id=?').run(ahora(), usuarioId);
  return token;
};
export { valido };
