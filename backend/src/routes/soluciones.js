import { Router } from 'express';
import { db, rows, row } from '../db.js';
import { HttpError, wrap, requerido } from '../errors.js';
import { p, num, texto } from '../utils.js';
import { admin } from '../auth.js';

export const solucionesRouter = Router();

/** Base de conocimiento: soluciones con el contexto de su falla y su máquina. */
solucionesRouter.get('/', wrap((req, res) => {
  const { q, tipo_id, categoria, solo_efectivas } = req.query;
  const cond = [];
  const args = [];
  if (q) {
    cond.push(`(s.descripcion LIKE ? OR s.repuestos LIKE ? OR s.preventivo LIKE ?
                OR f.titulo LIKE ? OR f.sintomas LIKE ? OR f.causa_raiz LIKE ?)`);
    args.push(...Array(6).fill(`%${q}%`));
  }
  if (tipo_id) { cond.push('m.tipo_id = ?'); args.push(num(tipo_id)); }
  if (categoria) { cond.push('f.categoria = ?'); args.push(categoria); }
  if (solo_efectivas === '1') cond.push('s.efectiva = 1');
  res.json(rows(db.prepare(`
    SELECT s.*, f.codigo AS falla_codigo, f.titulo AS falla_titulo, f.sintomas, f.categoria,
           f.severidad, f.causa_raiz, m.codigo AS maquina_codigo, m.nombre AS maquina_nombre,
           t.nombre AS maquina_tipo
    FROM soluciones s
    JOIN fallas f ON f.id = s.falla_id
    JOIN maquinas m ON m.id = f.maquina_id
    LEFT JOIN tipos_maquina t ON t.id = m.tipo_id
    ${cond.length ? `WHERE ${cond.join(' AND ')}` : ''}
    ORDER BY datetime(s.fecha) DESC, s.id DESC
  `), ...args));
}));

solucionesRouter.put('/:id', admin, wrap((req, res) => {
  const actual = row(db.prepare('SELECT * FROM soluciones WHERE id = ?'), Number(req.params.id));
  if (!actual) throw new HttpError(404, 'Solución no encontrada');
  const m = { ...actual, ...req.body };
  requerido(m.descripcion, 'descripcion');
  db.prepare(`
    UPDATE soluciones SET descripcion = ?, repuestos = ?, herramientas = ?, tiempo_minutos = ?,
      costo = ?, tecnico = ?, efectiva = ?, preventivo = ?, fecha = ? WHERE id = ?
  `).run(
    texto(m.descripcion), p(texto(m.repuestos)), p(texto(m.herramientas)), num(m.tiempo_minutos),
    num(m.costo), p(texto(m.tecnico)), m.efectiva ? 1 : 0, p(texto(m.preventivo)),
    p(texto(m.fecha)), actual.id,
  );
  res.json(row(db.prepare('SELECT * FROM soluciones WHERE id = ?'), actual.id));
}));

solucionesRouter.delete('/:id', admin, wrap((req, res) => {
  const actual = row(db.prepare('SELECT * FROM soluciones WHERE id = ?'), Number(req.params.id));
  if (!actual) throw new HttpError(404, 'Solución no encontrada');
  db.prepare('DELETE FROM soluciones WHERE id = ?').run(actual.id);
  res.json({ ok: true });
}));
