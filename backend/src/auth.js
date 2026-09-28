import crypto from 'node:crypto';
import { db, row, ahora } from './db.js';
import { HttpError } from './errors.js';

const SESION_DIAS = 7;
const ACTIVIDAD_DIAS = 180;

export const crearHash = (password, salt = crypto.randomBytes(16).toString('hex')) => {
  const digest = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${digest}`;
};

export const valido = (password, stored) => {
  const [salt, digest] = String(stored).split(':');
  if (!salt || !digest || digest.length !== 128) return false;
  const actual = crypto.scryptSync(String(password), salt, 64);
  return crypto.timingSafeEqual(actual, Buffer.from(digest, 'hex'));
};

export const HASH_SEÑUELO = crearHash(crypto.randomBytes(12).toString('hex'));

export const politica = (password) => {
  const p = typeof password === 'string' ? password : '';
  if (p.length < 8 || p.length > 128 || !/\p{L}/u.test(p) || !/\d/.test(p)) {
    throw new HttpError(400, 'La contraseña debe tener entre 8 y 128 caracteres e incluir letras y números');
  }
  return p;
};

export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const buscarSesion = db.prepare(`
  SELECT s.token, s.expira_en, u.id, u.nombre, u.email, u.rol, u.activo, u.debe_cambiar, u.ultimo_acceso
  FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id WHERE s.token = ?`);
const insertarActividad = db.prepare(
  'INSERT INTO actividad_usuarios (usuario_id, accion, ruta, detalle) VALUES (?, ?, ?, ?)');

export const registrar = (usuarioId, accion, ruta, detalle = null) =>
  insertarActividad.run(usuarioId, accion, String(ruta).slice(0, 300), detalle);

const VERBOS = { POST: 'crear', PUT: 'editar', PATCH: 'editar', DELETE: 'borrar' };

const auditar = (req, res, usuarioId) => {
  const ruta = req.originalUrl.split('?')[0];
  if (req.baseUrl === '/api/auth') return;
  if (req.method === 'GET') {
    if (/^\/\d+$/.test(req.path)) registrar(usuarioId, 'consulta', ruta);
    return;
  }
  res.on('finish', () => {
    if (res.statusCode >= 400) return;
    const recurso = ruta.split('/').filter((s) => s && s !== 'api' && !/^\d+$/.test(s)).pop() || 'recurso';
    registrar(usuarioId, `${VERBOS[req.method] || req.method.toLowerCase()}_${recurso}`, ruta);
  });
};

const tokenDeQuery = (req) =>
  req.method === 'GET' && /^[a-f0-9]{64}$/i.test(req.query.token || '') ? req.query.token : undefined;

const autenticar = (permitirCambio) => (req, res, next) => {
  const token = /^Bearer\s+([a-f0-9]{64})$/i.exec(req.headers.authorization || '')?.[1] || tokenDeQuery(req);
  const sesion = token && row(buscarSesion, hashToken(token.toLowerCase()));
  if (!sesion || !sesion.activo || new Date(sesion.expira_en) < new Date()) {
    return next(new HttpError(401, 'Sesión no válida o expirada'));
  }
  if (sesion.debe_cambiar && !permitirCambio) {
    return next(new HttpError(403, 'Debes cambiar tu contraseña antes de continuar', 'DEBE_CAMBIAR_PASSWORD'));
  }
  req.usuario = sesion;
  auditar(req, res, sesion.id);
  next();
};

export const auth = autenticar(false);
export const authPermitirCambio = autenticar(true);

export const admin = (req, _res, next) =>
  (req.usuario?.rol === 'admin' ? next() : next(new HttpError(403, 'Se requiere rol administrador')));

export const iniciarSesion = (usuarioId) => {
  const token = crypto.randomBytes(32).toString('hex');
  const expira = new Date(Date.now() + 1000 * 60 * 60 * 24 * SESION_DIAS).toISOString();
  db.prepare('INSERT INTO sesiones (token, usuario_id, expira_en) VALUES (?, ?, ?)').run(hashToken(token), usuarioId, expira);
  db.prepare('UPDATE usuarios SET ultimo_acceso = ? WHERE id = ?').run(ahora(), usuarioId);
  return token;
};

export const cerrarSesiones = (usuarioId, exceptoToken = null) => {
  if (exceptoToken) db.prepare('DELETE FROM sesiones WHERE usuario_id = ? AND token <> ?').run(usuarioId, exceptoToken);
  else db.prepare('DELETE FROM sesiones WHERE usuario_id = ?').run(usuarioId);
};

export const limpiar = () => {
  db.prepare('DELETE FROM sesiones WHERE expira_en < ?').run(new Date().toISOString());
  db.prepare(`DELETE FROM actividad_usuarios WHERE creado_en < datetime('now','localtime', ?)`)
    .run(`-${ACTIVIDAD_DIAS} days`);
};

export const asegurarAdmin = () => {
  if (row(db.prepare('SELECT COUNT(*) AS n FROM usuarios')).n > 0) return;
  const clave = process.env.ADMIN_PASSWORD || 'Admin1234!';
  db.prepare('INSERT INTO usuarios (nombre, email, password_hash, rol, debe_cambiar) VALUES (?, ?, ?, ?, 1)')
    .run('Administrador', 'admin', crearHash(clave), 'admin');
  console.log(process.env.ADMIN_PASSWORD
    ? 'Se creó el usuario "admin" con la contraseña de ADMIN_PASSWORD.'
    : 'Se creó el usuario "admin" con la contraseña inicial "Admin1234!".');
  console.log('El sistema pedirá cambiarla en el primer ingreso.');
};
