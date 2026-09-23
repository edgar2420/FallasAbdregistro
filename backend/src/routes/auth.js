import { Router } from 'express';
import { db, row, rows, ahora, transaccion } from '../db.js';
import { HttpError, requerido, wrap } from '../errors.js';
import {
  admin, auth, authPermitirCambio, cerrarSesiones, crearHash, HASH_SEÑUELO, iniciarSesion, politica,
  registrar, valido,
} from '../auth.js';

export const authRouter = Router();

const perfil = (u) => ({
  id: u.id, nombre: u.nombre, email: u.email, rol: u.rol, activo: u.activo,
  debe_cambiar: u.debe_cambiar, ultimo_acceso: u.ultimo_acceso,
});
const CAMPOS_USUARIO = 'id, nombre, email, rol, activo, debe_cambiar, ultimo_acceso, creado_en';
const obtenerUsuario = db.prepare(`SELECT ${CAMPOS_USUARIO} FROM usuarios WHERE id = ?`);

/* ---------- Límite de intentos de acceso (por IP+usuario y por IP) ---------- */

const VENTANA_MS = 15 * 60 * 1000;
const MAX_POR_USUARIO = 5;
const MAX_POR_IP = 30;
const intentos = new Map();

const contador = (clave) => {
  const i = intentos.get(clave);
  if (!i || Date.now() - i.desde > VENTANA_MS) return null;
  return i;
};
const sumarFallo = (clave) => {
  const i = contador(clave);
  if (i) i.n += 1;
  else intentos.set(clave, { n: 1, desde: Date.now() });
};
setInterval(() => {
  for (const [clave] of intentos) if (!contador(clave)) intentos.delete(clave);
}, VENTANA_MS).unref();

const normalizarUsuario = (v) => {
  const u = requerido(v, 'usuario').toLowerCase();
  if (!/^[a-z0-9._@-]{3,60}$/.test(u)) {
    throw new HttpError(400, 'El usuario debe tener de 3 a 60 caracteres: letras, números, punto, guion, _ o @');
  }
  return u;
};

authRouter.post('/login', wrap((req, res) => {
  const email = requerido(req.body.email, 'usuario').toLowerCase();
  const password = requerido(req.body.password, 'contraseña');
  const claveIp = `ip:${req.ip}`;
  const claveUsuario = `u:${req.ip}:${email}`;
  if ((contador(claveUsuario)?.n ?? 0) >= MAX_POR_USUARIO || (contador(claveIp)?.n ?? 0) >= MAX_POR_IP) {
    throw new HttpError(429, 'Demasiados intentos fallidos. Espera 15 minutos antes de volver a intentar.');
  }
  const u = row(db.prepare('SELECT * FROM usuarios WHERE email = ?'), email);
  const ok = valido(password, u?.password_hash ?? HASH_SEÑUELO);
  if (!u || !ok || !u.activo) {
    sumarFallo(claveUsuario);
    sumarFallo(claveIp);
    if (u) registrar(u.id, 'acceso_fallido', '/api/auth/login');
    throw new HttpError(401, 'Usuario o contraseña incorrectos');
  }
  intentos.delete(claveUsuario);
  const token = iniciarSesion(u.id);
  registrar(u.id, 'inicio_sesion', '/api/auth/login');
  res.json({ token, usuario: perfil({ ...u, ultimo_acceso: ahora() }) });
}));

authRouter.get('/me', authPermitirCambio, (req, res) => res.json({ usuario: perfil(req.usuario) }));

authRouter.post('/logout', authPermitirCambio, wrap((req, res) => {
  db.prepare('DELETE FROM sesiones WHERE token = ?').run(req.usuario.token);
  registrar(req.usuario.id, 'cierre_sesion', '/api/auth/logout');
  res.json({ ok: true });
}));

/** Cambio de la propia contraseña (obligatorio en el primer ingreso). Cierra las demás sesiones. */
authRouter.post('/cambiar-password', authPermitirCambio, wrap((req, res) => {
  const actual = requerido(req.body.actual, 'contraseña actual');
  const nueva = politica(req.body.nueva);
  const u = row(db.prepare('SELECT password_hash FROM usuarios WHERE id = ?'), req.usuario.id);
  if (!valido(actual, u.password_hash)) throw new HttpError(400, 'La contraseña actual no es correcta');
  if (actual === nueva) throw new HttpError(400, 'La nueva contraseña debe ser distinta de la actual');
  transaccion(() => {
    db.prepare('UPDATE usuarios SET password_hash = ?, debe_cambiar = 0 WHERE id = ?').run(crearHash(nueva), req.usuario.id);
    cerrarSesiones(req.usuario.id, req.usuario.token);
    registrar(req.usuario.id, 'cambio_password', '/api/auth/cambiar-password');
  });
  res.json({ usuario: perfil({ ...req.usuario, debe_cambiar: 0 }) });
}));

/* ---------- Administración de cuentas ---------- */

authRouter.get('/usuarios', auth, admin, wrap((_req, res) =>
  res.json(rows(db.prepare(`SELECT ${CAMPOS_USUARIO} FROM usuarios ORDER BY nombre`)))));

authRouter.get('/actividad', auth, admin, wrap((req, res) => {
  const usuarioId = Number(req.query.usuario_id) || null;
  res.json(rows(db.prepare(`
    SELECT a.*, u.nombre, u.email FROM actividad_usuarios a
    LEFT JOIN usuarios u ON u.id = a.usuario_id
    ${usuarioId ? 'WHERE a.usuario_id = ?' : ''}
    ORDER BY datetime(a.creado_en) DESC, a.id DESC LIMIT 300`), ...(usuarioId ? [usuarioId] : [])));
}));

authRouter.post('/usuarios', auth, admin, wrap((req, res) => {
  const nombre = requerido(req.body.nombre, 'nombre');
  const email = normalizarUsuario(req.body.email);
  const password = politica(req.body.password);
  if (row(db.prepare('SELECT id FROM usuarios WHERE email = ?'), email)) throw new HttpError(409, 'Ese usuario ya está registrado');
  const rol = req.body.rol === 'admin' ? 'admin' : 'operador';
  const r = db.prepare('INSERT INTO usuarios (nombre, email, password_hash, rol, debe_cambiar) VALUES (?, ?, ?, ?, 1)')
    .run(nombre, email, crearHash(password), rol);
  registrar(req.usuario.id, 'crear_usuario', '/api/auth/usuarios', email);
  res.status(201).json(row(obtenerUsuario, r.lastInsertRowid));
}));

authRouter.patch('/usuarios/:id', auth, admin, wrap((req, res) => {
  const id = Number(req.params.id);
  const u = row(db.prepare('SELECT * FROM usuarios WHERE id = ?'), id);
  if (!u) throw new HttpError(404, 'Usuario no encontrado');

  const nombre = req.body.nombre === undefined ? u.nombre : requerido(req.body.nombre, 'nombre');
  const rol = ['admin', 'operador'].includes(req.body.rol) ? req.body.rol : u.rol;
  const activo = req.body.activo === undefined ? u.activo : (req.body.activo ? 1 : 0);
  const password = req.body.password ? politica(req.body.password) : null;

  const pierdeAdmin = u.rol === 'admin' && u.activo && (rol !== 'admin' || !activo);
  if (pierdeAdmin && id === req.usuario.id) {
    throw new HttpError(400, 'No puedes quitarte el rol de administrador ni desactivar tu propia cuenta');
  }
  if (pierdeAdmin) {
    const { n } = row(db.prepare("SELECT COUNT(*) AS n FROM usuarios WHERE rol = 'admin' AND activo = 1"));
    if (n <= 1) throw new HttpError(400, 'Debe quedar al menos un administrador activo');
  }

  transaccion(() => {
    db.prepare('UPDATE usuarios SET nombre = ?, rol = ?, activo = ? WHERE id = ?').run(nombre, rol, activo, id);
    if (password) {
      // Clave asignada por el administrador: el usuario debe cambiarla al entrar.
      db.prepare('UPDATE usuarios SET password_hash = ?, debe_cambiar = 1 WHERE id = ?').run(crearHash(password), id);
    }
    if (password || !activo) cerrarSesiones(id);
    registrar(req.usuario.id, password ? 'restablecer_password' : 'actualizar_usuario', `/api/auth/usuarios/${id}`, u.email);
  });
  res.json(row(obtenerUsuario, id));
}));
