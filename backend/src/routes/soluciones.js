import { Router } from 'express';
import { db, rows, row, ahora, transaccion } from '../db.js';
import { HttpError, wrap } from '../errors.js';
import { p, texto, entero, decimal, fecha, busqueda } from '../utils.js';
import { admin } from '../auth.js';
import { recalcularFalla } from '../estado.js';

export const solucionesRouter = Router();

/** Valida una solución; `previo` aporta los valores actuales al editar. */
export const normalizarSolucion = (v, previo = {}) => {
  const m = { ...previo, ...v };
  const descripcion = texto(m.descripcion);
  if (!descripcion) throw new HttpError(400, 'El campo "descripcion" es obligatorio');
  return {
    descripcion,
    repuestos: texto(m.repuestos),
    herramientas: texto(m.herramientas),
    tiempo_minutos: entero(m.tiempo_minutos, 'tiempo_minutos', { max: 525600 }) ?? 0,
    costo: decimal(m.costo, 'costo') ?? 0,
    tecnico: texto(m.tecnico),
    efectiva: m.efectiva === undefined ? 1 : (m.efectiva && m.efectiva !== '0' ? 1 : 0),
    preventivo: texto(m.preventivo),
    fecha: fecha(m.fecha, 'fecha') || previo.fecha || ahora(),
  };
};

/** Base de conocimiento: soluciones con el contexto de su falla y su máquina. */
solucionesRouter.get('/', wrap((req, res) => {
  const { q, tipo_id, maquina_id, categoria, solo_efectivas } = req.query;
  const cond = [];
  const args = [];
  if (q) {
    const b = busqueda(['s.descripcion', 's.repuestos', 's.herramientas', 's.preventivo', 'f.codigo',
      'f.titulo', 'f.sintomas', 'f.causa_raiz', 'm.codigo', 'm.nombre'], q);
    cond.push(b.sql);
    args.push(...b.args);
  }
  if (tipo_id) { cond.push('m.tipo_id = ?'); args.push(Number(tipo_id) || 0); }
  if (maquina_id) { cond.push('f.maquina_id = ?'); args.push(Number(maquina_id) || 0); }
  if (categoria) { cond.push('f.categoria = ?'); args.push(String(categoria)); }
  if (solo_efectivas === '1') cond.push('s.efectiva = 1');
  res.json(rows(db.prepare(`
    SELECT s.*, f.codigo AS falla_codigo, f.titulo AS falla_titulo, f.sintomas, f.categoria,
           f.severidad, f.causa_raiz, f.maquina_id, m.codigo AS maquina_codigo, m.nombre AS maquina_nombre,
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
  const s = normalizarSolucion(req.body, actual);
  transaccion(() => {
    db.prepare(`
      UPDATE soluciones SET descripcion = ?, repuestos = ?, herramientas = ?, tiempo_minutos = ?,
        costo = ?, tecnico = ?, efectiva = ?, preventivo = ?, fecha = ? WHERE id = ?
    `).run(s.descripcion, p(s.repuestos), p(s.herramientas), s.tiempo_minutos, s.costo, p(s.tecnico),
      s.efectiva, p(s.preventivo), s.fecha, actual.id);
    if (s.efectiva !== actual.efectiva) recalcularFalla(actual.falla_id);
  });
  res.json(row(db.prepare('SELECT * FROM soluciones WHERE id = ?'), actual.id));
}));

solucionesRouter.delete('/:id', admin, wrap((req, res) => {
  const actual = row(db.prepare('SELECT * FROM soluciones WHERE id = ?'), Number(req.params.id));
  if (!actual) throw new HttpError(404, 'Solución no encontrada');
  transaccion(() => {
    db.prepare('DELETE FROM soluciones WHERE id = ?').run(actual.id);
    if (actual.efectiva) recalcularFalla(actual.falla_id);
  });
  res.json({ ok: true });
}));
