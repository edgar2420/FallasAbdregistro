import { Router } from 'express';
import { db, rows, row } from '../db.js';
import { HttpError, wrap, requerido } from '../errors.js';
import { p, texto } from '../utils.js';
import { admin } from '../auth.js';
import { LIMITES, limitar } from '../limites.js';

export const tiposRouter = Router();

const listar = db.prepare(`
  SELECT t.*, (SELECT COUNT(*) FROM maquinas m WHERE m.tipo_id = t.id) AS maquinas
  FROM tipos_maquina t ORDER BY t.nombre
`);
const obtener = db.prepare('SELECT * FROM tipos_maquina WHERE id = ?');
const crear = db.prepare('INSERT INTO tipos_maquina (nombre, descripcion) VALUES (?, ?)');
const actualizar = db.prepare('UPDATE tipos_maquina SET nombre = ?, descripcion = ? WHERE id = ?');
const borrar = db.prepare('DELETE FROM tipos_maquina WHERE id = ?');
const duplicado = (nombre, id = 0) =>
  row(db.prepare('SELECT id FROM tipos_maquina WHERE nombre = ? COLLATE NOCASE AND id <> ?'), nombre, id);

tiposRouter.get('/', wrap((req, res) => res.json(rows(listar))));

tiposRouter.post('/', admin, wrap((req, res) => {
  const nombre = requerido(req.body.nombre, 'nombre');
  limitar({ nombre, descripcion: texto(req.body.descripcion) }, LIMITES.tipo);
  if (duplicado(nombre)) throw new HttpError(409, `Ya existe el tipo de maquinaria "${nombre}"`);
  const { lastInsertRowid } = crear.run(nombre, p(texto(req.body.descripcion)));
  res.status(201).json(row(obtener, lastInsertRowid));
}));

tiposRouter.put('/:id', admin, wrap((req, res) => {
  const actual = row(obtener, Number(req.params.id));
  if (!actual) throw new HttpError(404, 'Tipo de maquinaria no encontrado');
  const nombre = requerido(req.body.nombre ?? actual.nombre, 'nombre');
  limitar({ nombre, descripcion: texto(req.body.descripcion) }, LIMITES.tipo);
  if (duplicado(nombre, actual.id)) throw new HttpError(409, `Ya existe el tipo de maquinaria "${nombre}"`);
  actualizar.run(nombre, p(texto(req.body.descripcion === undefined ? actual.descripcion : req.body.descripcion)), actual.id);
  res.json(row(obtener, actual.id));
}));

tiposRouter.delete('/:id', admin, wrap((req, res) => {
  const actual = row(obtener, Number(req.params.id));
  if (!actual) throw new HttpError(404, 'Tipo de maquinaria no encontrado');
  borrar.run(actual.id);
  res.json({ ok: true });
}));
