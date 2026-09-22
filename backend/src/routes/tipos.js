import { Router } from 'express';
import { db, rows, row } from '../db.js';
import { HttpError, wrap, requerido } from '../errors.js';
import { p, texto } from '../utils.js';

export const tiposRouter = Router();

const listar = db.prepare(`
  SELECT t.*, (SELECT COUNT(*) FROM maquinas m WHERE m.tipo_id = t.id) AS maquinas
  FROM tipos_maquina t ORDER BY t.nombre
`);
const obtener = db.prepare('SELECT * FROM tipos_maquina WHERE id = ?');
const crear = db.prepare('INSERT INTO tipos_maquina (nombre, descripcion) VALUES (?, ?)');
const actualizar = db.prepare('UPDATE tipos_maquina SET nombre = ?, descripcion = ? WHERE id = ?');
const borrar = db.prepare('DELETE FROM tipos_maquina WHERE id = ?');

tiposRouter.get('/', wrap((req, res) => res.json(rows(listar))));

tiposRouter.post('/', wrap((req, res) => {
  const nombre = requerido(req.body.nombre, 'nombre');
  if (row(db.prepare('SELECT id FROM tipos_maquina WHERE nombre = ?'), nombre)) {
    throw new HttpError(409, `Ya existe el tipo de maquinaria "${nombre}"`);
  }
  const { lastInsertRowid } = crear.run(nombre, p(texto(req.body.descripcion)));
  res.status(201).json(row(obtener, lastInsertRowid));
}));

tiposRouter.put('/:id', wrap((req, res) => {
  const actual = row(obtener, Number(req.params.id));
  if (!actual) throw new HttpError(404, 'Tipo de maquinaria no encontrado');
  actualizar.run(
    requerido(req.body.nombre ?? actual.nombre, 'nombre'),
    p(texto(req.body.descripcion ?? actual.descripcion)),
    actual.id,
  );
  res.json(row(obtener, actual.id));
}));

tiposRouter.delete('/:id', wrap((req, res) => {
  const actual = row(obtener, Number(req.params.id));
  if (!actual) throw new HttpError(404, 'Tipo de maquinaria no encontrado');
  borrar.run(actual.id);
  res.json({ ok: true });
}));
