import { Router } from 'express';
import { db, rows, row, ahora } from '../db.js';
import { HttpError, wrap, requerido } from '../errors.js';
import { p, num, texto } from '../utils.js';
import { admin } from '../auth.js';

export const maquinasRouter = Router();

const SELECT_BASE = `
  SELECT m.*, t.nombre AS tipo,
         (SELECT COUNT(*) FROM fallas f WHERE f.maquina_id = m.id) AS total_fallas,
         (SELECT COUNT(*) FROM fallas f WHERE f.maquina_id = m.id
            AND f.estado IN ('Abierta','En proceso','Recurrente')) AS fallas_abiertas
  FROM maquinas m LEFT JOIN tipos_maquina t ON t.id = m.tipo_id
`;

const obtener = db.prepare(`${SELECT_BASE} WHERE m.id = ?`);

maquinasRouter.get('/', wrap((req, res) => {
  const { q, tipo_id, estado } = req.query;
  const cond = [];
  const args = [];
  if (q) {
    cond.push('(m.codigo LIKE ? OR m.nombre LIKE ? OR m.marca LIKE ? OR m.modelo LIKE ? OR m.area LIKE ?)');
    args.push(...Array(5).fill(`%${q}%`));
  }
  if (tipo_id) { cond.push('m.tipo_id = ?'); args.push(num(tipo_id)); }
  if (estado) { cond.push('m.estado = ?'); args.push(estado); }
  const sql = `${SELECT_BASE} ${cond.length ? `WHERE ${cond.join(' AND ')}` : ''} ORDER BY m.codigo`;
  res.json(rows(db.prepare(sql), ...args));
}));

maquinasRouter.get('/:id', wrap((req, res) => {
  const maquina = row(obtener, Number(req.params.id));
  if (!maquina) throw new HttpError(404, 'Máquina no encontrada');
  maquina.fallas = rows(db.prepare(`
    SELECT f.*, (SELECT COUNT(*) FROM soluciones s WHERE s.falla_id = f.id) AS soluciones
    FROM fallas f WHERE f.maquina_id = ? ORDER BY datetime(f.fecha_deteccion) DESC
  `), maquina.id);
  res.json(maquina);
}));

const CAMPOS = ['codigo', 'nombre', 'tipo_id', 'marca', 'modelo', 'num_serie', 'area', 'anio', 'estado', 'notas'];

maquinasRouter.post('/', admin, wrap((req, res) => {
  const codigo = requerido(req.body.codigo, 'codigo');
  requerido(req.body.nombre, 'nombre');
  if (row(db.prepare('SELECT id FROM maquinas WHERE codigo = ?'), codigo)) {
    throw new HttpError(409, `Ya existe una máquina con el código "${codigo}"`);
  }
  const valores = CAMPOS.map((c) => (c === 'tipo_id' || c === 'anio'
    ? p(req.body[c] ? num(req.body[c]) : null)
    : p(texto(req.body[c]))));
  const { lastInsertRowid } = db.prepare(
    `INSERT INTO maquinas (${CAMPOS.join(',')}) VALUES (${CAMPOS.map(() => '?').join(',')})`,
  ).run(...valores.map((v, i) => (CAMPOS[i] === 'estado' ? v ?? 'Operativa' : v)));
  res.status(201).json(row(obtener, lastInsertRowid));
}));

maquinasRouter.put('/:id', admin, wrap((req, res) => {
  const actual = row(obtener, Number(req.params.id));
  if (!actual) throw new HttpError(404, 'Máquina no encontrada');
  const merge = { ...actual, ...req.body };
  requerido(merge.codigo, 'codigo');
  requerido(merge.nombre, 'nombre');
  const duplicado = row(db.prepare('SELECT id FROM maquinas WHERE codigo = ? AND id <> ?'), merge.codigo, actual.id);
  if (duplicado) throw new HttpError(409, `Ya existe otra máquina con el código "${merge.codigo}"`);
  db.prepare(`UPDATE maquinas SET ${CAMPOS.map((c) => `${c} = ?`).join(', ')}, actualizado_en = ? WHERE id = ?`)
    .run(
      ...CAMPOS.map((c) => (c === 'tipo_id' || c === 'anio'
        ? p(merge[c] ? num(merge[c]) : null)
        : p(texto(merge[c])))),
      ahora(),
      actual.id,
    );
  res.json(row(obtener, actual.id));
}));

maquinasRouter.delete('/:id', admin, wrap((req, res) => {
  const actual = row(obtener, Number(req.params.id));
  if (!actual) throw new HttpError(404, 'Máquina no encontrada');
  db.prepare('DELETE FROM maquinas WHERE id = ?').run(actual.id);
  res.json({ ok: true, fallas_eliminadas: actual.total_fallas });
}));
