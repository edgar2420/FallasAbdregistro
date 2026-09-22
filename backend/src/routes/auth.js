import { Router } from 'express';
import { db, row, rows, ahora } from '../db.js';
import { HttpError, requerido, wrap } from '../errors.js';
import { admin, auth, crearHash, iniciarSesion, valido, registrar } from '../auth.js';

export const authRouter = Router();
const perfil = (u) => ({ id: u.id, nombre: u.nombre, email: u.email, rol: u.rol, activo: u.activo, ultimo_acceso: u.ultimo_acceso });

authRouter.post('/login', wrap((req, res) => {
  const email = requerido(req.body.email, 'email').toLowerCase();
  const password = requerido(req.body.password, 'password');
  const u = row(db.prepare('SELECT * FROM usuarios WHERE email=?'), email);
  if (!u || !u.activo || !valido(password, u.password_hash)) throw new HttpError(401, 'Correo o contraseña incorrectos');
  const token = iniciarSesion(u.id); registrar(u.id, 'inicio_sesion', '/api/auth/login');
  res.json({ token, usuario: perfil({ ...u, ultimo_acceso: ahora() }) });
}));
authRouter.get('/me', auth, (req, res) => res.json({ usuario: perfil(req.usuario) }));
authRouter.post('/logout', auth, wrap((req, res) => { db.prepare('DELETE FROM sesiones WHERE token=?').run(req.usuario.token); registrar(req.usuario.id, 'cierre_sesion', '/api/auth/logout'); res.json({ ok: true }); }));

authRouter.get('/usuarios', auth, admin, wrap((_req, res) => res.json(rows(db.prepare('SELECT id,nombre,email,rol,activo,ultimo_acceso,creado_en FROM usuarios ORDER BY nombre')))));
authRouter.get('/actividad', auth, admin, wrap((_req, res) => res.json(rows(db.prepare(`SELECT a.*, u.nombre, u.email FROM actividad_usuarios a LEFT JOIN usuarios u ON u.id=a.usuario_id ORDER BY datetime(a.creado_en) DESC LIMIT 300`)))));
authRouter.post('/usuarios', auth, admin, wrap((req, res) => {
  const nombre = requerido(req.body.nombre, 'nombre'); const email = requerido(req.body.email, 'email').toLowerCase(); const password = requerido(req.body.password, 'password');
  if (row(db.prepare('SELECT id FROM usuarios WHERE email=?'), email)) throw new HttpError(409, 'Ese correo ya está registrado');
  const rol = req.body.rol === 'admin' ? 'admin' : 'operador';
  const r = db.prepare('INSERT INTO usuarios (nombre,email,password_hash,rol) VALUES (?,?,?,?)').run(nombre, email, crearHash(password), rol);
  registrar(req.usuario.id, 'crear_usuario', '/api/auth/usuarios', email);
  res.status(201).json(row(db.prepare('SELECT id,nombre,email,rol,activo,ultimo_acceso,creado_en FROM usuarios WHERE id=?'), r.lastInsertRowid));
}));
authRouter.patch('/usuarios/:id', auth, admin, wrap((req, res) => {
  const id = Number(req.params.id); const u = row(db.prepare('SELECT * FROM usuarios WHERE id=?'), id); if (!u) throw new HttpError(404, 'Usuario no encontrado');
  db.prepare('UPDATE usuarios SET nombre=?, rol=?, activo=? WHERE id=?').run(req.body.nombre ?? u.nombre, req.body.rol === 'admin' ? 'admin' : (req.body.rol === 'operador' ? 'operador' : u.rol), req.body.activo === undefined ? u.activo : (req.body.activo ? 1 : 0), id);
  if (req.body.password) db.prepare('UPDATE usuarios SET password_hash=? WHERE id=?').run(crearHash(req.body.password), id);
  registrar(req.usuario.id, 'actualizar_usuario', `/api/auth/usuarios/${id}`, u.email);
  res.json(row(db.prepare('SELECT id,nombre,email,rol,activo,ultimo_acceso,creado_en FROM usuarios WHERE id=?'), id));
}));
