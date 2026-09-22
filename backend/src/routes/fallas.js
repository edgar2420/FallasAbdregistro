import { Router } from 'express';
import { db, rows, row, ahora } from '../db.js';
import { HttpError, wrap, requerido } from '../errors.js';
import { p, num, texto } from '../utils.js';
import { admin } from '../auth.js';

export const fallasRouter = Router();

const ABIERTAS = "('Abierta','En proceso','Recurrente')";

const SELECT_BASE = `
  SELECT f.*, m.codigo AS maquina_codigo, m.nombre AS maquina_nombre, t.nombre AS maquina_tipo,
         (SELECT COUNT(*) FROM soluciones s WHERE s.falla_id = f.id) AS soluciones
  FROM fallas f
  JOIN maquinas m ON m.id = f.maquina_id
  LEFT JOIN tipos_maquina t ON t.id = m.tipo_id
`;
const obtener = db.prepare(`${SELECT_BASE} WHERE f.id = ?`);

/** Mantiene el estado de la máquina alineado con sus fallas abiertas. */
function sincronizarMaquina(maquinaId) {
  const maquina = row(db.prepare('SELECT * FROM maquinas WHERE id = ?'), maquinaId);
  if (!maquina || maquina.estado === 'Mantenimiento' || maquina.estado === 'Fuera de servicio') return;
  const criticas = row(db.prepare(
    `SELECT COUNT(*) AS n FROM fallas WHERE maquina_id = ? AND estado IN ${ABIERTAS}
       AND severidad IN ('Alta','Crítica')`,
  ), maquinaId).n;
  const nuevo = criticas > 0 ? 'En falla' : 'Operativa';
  if (nuevo !== maquina.estado) {
    db.prepare('UPDATE maquinas SET estado = ?, actualizado_en = ? WHERE id = ?').run(nuevo, ahora(), maquinaId);
  }
}

function siguienteCodigo() {
  const { n } = row(db.prepare('SELECT COUNT(*) AS n FROM fallas'));
  let i = n + 1;
  while (row(db.prepare('SELECT id FROM fallas WHERE codigo = ?'), `FAL-${String(i).padStart(4, '0')}`)) i += 1;
  return `FAL-${String(i).padStart(4, '0')}`;
}

fallasRouter.get('/', wrap((req, res) => {
  const { q, maquina_id, tipo_id, categoria, severidad, estado, desde, hasta } = req.query;
  const cond = [];
  const args = [];
  if (q) {
    cond.push(`(f.codigo LIKE ? OR f.titulo LIKE ? OR f.descripcion LIKE ? OR f.sintomas LIKE ?
                OR f.causa_raiz LIKE ? OR m.codigo LIKE ? OR m.nombre LIKE ?
                OR EXISTS (SELECT 1 FROM soluciones s WHERE s.falla_id = f.id AND s.descripcion LIKE ?))`);
    args.push(...Array(8).fill(`%${q}%`));
  }
  if (maquina_id) { cond.push('f.maquina_id = ?'); args.push(num(maquina_id)); }
  if (tipo_id) { cond.push('m.tipo_id = ?'); args.push(num(tipo_id)); }
  if (categoria) { cond.push('f.categoria = ?'); args.push(categoria); }
  if (severidad) { cond.push('f.severidad = ?'); args.push(severidad); }
  if (estado === 'abiertas') cond.push(`f.estado IN ${ABIERTAS}`);
  else if (estado) { cond.push('f.estado = ?'); args.push(estado); }
  if (desde) { cond.push('date(f.fecha_deteccion) >= date(?)'); args.push(desde); }
  if (hasta) { cond.push('date(f.fecha_deteccion) <= date(?)'); args.push(hasta); }
  const sql = `${SELECT_BASE} ${cond.length ? `WHERE ${cond.join(' AND ')}` : ''}
               ORDER BY datetime(f.fecha_deteccion) DESC, f.id DESC`;
  res.json(rows(db.prepare(sql), ...args));
}));

fallasRouter.get('/:id', wrap((req, res) => {
  const falla = row(obtener, Number(req.params.id));
  if (!falla) throw new HttpError(404, 'Falla no encontrada');
  falla.soluciones_lista = rows(
    db.prepare('SELECT * FROM soluciones WHERE falla_id = ? ORDER BY datetime(fecha) DESC, id DESC'),
    falla.id,
  );
  res.json(falla);
}));

const CAMPOS = ['maquina_id', 'titulo', 'descripcion', 'sintomas', 'categoria', 'severidad', 'estado',
  'causa_raiz', 'reportado_por', 'responsable', 'turno', 'fecha_deteccion', 'fecha_resolucion', 'paro_minutos'];

const normalizar = (v) => ({
  maquina_id: num(v.maquina_id),
  titulo: texto(v.titulo),
  descripcion: texto(v.descripcion),
  sintomas: texto(v.sintomas),
  categoria: texto(v.categoria) || 'Mecánica',
  severidad: texto(v.severidad) || 'Media',
  estado: texto(v.estado) || 'Abierta',
  causa_raiz: texto(v.causa_raiz),
  reportado_por: texto(v.reportado_por),
  responsable: texto(v.responsable),
  turno: texto(v.turno),
  fecha_deteccion: texto(v.fecha_deteccion) || ahora(),
  fecha_resolucion: texto(v.fecha_resolucion),
  paro_minutos: num(v.paro_minutos),
});

fallasRouter.post('/', admin, wrap((req, res) => {
  requerido(req.body.titulo, 'titulo');
  requerido(req.body.maquina_id, 'maquina_id');
  const datos = normalizar(req.body);
  if (!row(db.prepare('SELECT id FROM maquinas WHERE id = ?'), datos.maquina_id)) {
    throw new HttpError(400, 'La máquina indicada no existe');
  }
  if (datos.estado === 'Resuelta' && !datos.fecha_resolucion) datos.fecha_resolucion = ahora();
  const codigo = texto(req.body.codigo) || siguienteCodigo();
  const { lastInsertRowid } = db.prepare(
    `INSERT INTO fallas (codigo, ${CAMPOS.join(',')}) VALUES (${Array(CAMPOS.length + 1).fill('?').join(',')})`,
  ).run(codigo, ...CAMPOS.map((c) => p(datos[c])));
  sincronizarMaquina(datos.maquina_id);
  res.status(201).json(row(obtener, lastInsertRowid));
}));

fallasRouter.put('/:id', admin, wrap((req, res) => {
  const actual = row(obtener, Number(req.params.id));
  if (!actual) throw new HttpError(404, 'Falla no encontrada');
  const datos = normalizar({ ...actual, ...req.body });
  requerido(datos.titulo, 'titulo');
  if (datos.estado === 'Resuelta' && !datos.fecha_resolucion) datos.fecha_resolucion = ahora();
  if (datos.estado !== 'Resuelta') datos.fecha_resolucion = null;
  db.prepare(`UPDATE fallas SET ${CAMPOS.map((c) => `${c} = ?`).join(', ')}, actualizado_en = ? WHERE id = ?`)
    .run(...CAMPOS.map((c) => p(datos[c])), ahora(), actual.id);
  sincronizarMaquina(datos.maquina_id);
  if (datos.maquina_id !== actual.maquina_id) sincronizarMaquina(actual.maquina_id);
  res.json(row(obtener, actual.id));
}));

fallasRouter.delete('/:id', admin, wrap((req, res) => {
  const actual = row(obtener, Number(req.params.id));
  if (!actual) throw new HttpError(404, 'Falla no encontrada');
  db.prepare('DELETE FROM fallas WHERE id = ?').run(actual.id);
  sincronizarMaquina(actual.maquina_id);
  res.json({ ok: true });
}));

/* ---------- Soluciones de una falla ---------- */

fallasRouter.get('/:id/soluciones', wrap((req, res) => {
  res.json(rows(
    db.prepare('SELECT * FROM soluciones WHERE falla_id = ? ORDER BY datetime(fecha) DESC, id DESC'),
    Number(req.params.id),
  ));
}));

fallasRouter.post('/:id/soluciones', admin, wrap((req, res) => {
  const falla = row(obtener, Number(req.params.id));
  if (!falla) throw new HttpError(404, 'Falla no encontrada');
  const descripcion = requerido(req.body.descripcion, 'descripcion');
  const efectiva = req.body.efectiva === undefined ? 1 : (req.body.efectiva ? 1 : 0);
  const { lastInsertRowid } = db.prepare(`
    INSERT INTO soluciones (falla_id, descripcion, repuestos, herramientas, tiempo_minutos, costo,
                            tecnico, efectiva, preventivo, fecha)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `).run(
    falla.id, descripcion, p(texto(req.body.repuestos)), p(texto(req.body.herramientas)),
    num(req.body.tiempo_minutos), num(req.body.costo), p(texto(req.body.tecnico)),
    efectiva, p(texto(req.body.preventivo)), p(texto(req.body.fecha)) || ahora(),
  );

  // Una solución efectiva cierra la falla; una fallida la deja "En proceso".
  if (efectiva && falla.estado !== 'Resuelta') {
    db.prepare('UPDATE fallas SET estado = ?, fecha_resolucion = ?, actualizado_en = ? WHERE id = ?')
      .run('Resuelta', ahora(), ahora(), falla.id);
  } else if (!efectiva && falla.estado === 'Abierta') {
    db.prepare('UPDATE fallas SET estado = ?, actualizado_en = ? WHERE id = ?')
      .run('En proceso', ahora(), falla.id);
  }
  sincronizarMaquina(falla.maquina_id);
  res.status(201).json(row(db.prepare('SELECT * FROM soluciones WHERE id = ?'), lastInsertRowid));
}));
