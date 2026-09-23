import { Router } from 'express';
import { db, rows, row, ahora, transaccion } from '../db.js';
import { HttpError, wrap } from '../errors.js';
import { p, texto, unoDe, entero, busqueda } from '../utils.js';
import { admin } from '../auth.js';
import { ABIERTAS_SQL, ESTADOS_MAQUINA } from '../catalogos.js';
import { sincronizarMaquina } from '../estado.js';
import { archivosDe, borrarArchivos, listarAdjuntos } from './adjuntos.js';

export const maquinasRouter = Router();

const SELECT_BASE = `
  SELECT m.*, t.nombre AS tipo,
         (SELECT COUNT(*) FROM fallas f WHERE f.maquina_id = m.id) AS total_fallas,
         (SELECT COUNT(*) FROM fallas f WHERE f.maquina_id = m.id AND f.estado IN ${ABIERTAS_SQL}) AS fallas_abiertas,
         (SELECT COUNT(*) FROM adjuntos a WHERE a.maquina_id = m.id) AS total_adjuntos
  FROM maquinas m LEFT JOIN tipos_maquina t ON t.id = m.tipo_id
`;

const obtener = db.prepare(`${SELECT_BASE} WHERE m.id = ?`);

maquinasRouter.get('/', wrap((req, res) => {
  const { q, tipo_id, estado, area, departamento } = req.query;
  const cond = [];
  const args = [];
  if (q) {
    const b = busqueda(['m.codigo', 'm.nombre', 'm.departamento', 'm.marca', 'm.modelo', 'm.area', 'm.poe', 'm.num_serie'], q);
    cond.push(b.sql);
    args.push(...b.args);
  }
  if (tipo_id) { cond.push('m.tipo_id = ?'); args.push(Number(tipo_id) || 0); }
  if (estado) { cond.push('m.estado = ?'); args.push(String(estado)); }
  if (area) { cond.push('m.area = ?'); args.push(String(area)); }
  if (departamento) { cond.push('m.departamento = ?'); args.push(String(departamento)); }
  const sql = `${SELECT_BASE} ${cond.length ? `WHERE ${cond.join(' AND ')}` : ''} ORDER BY m.codigo`;
  res.json(rows(db.prepare(sql), ...args));
}));

maquinasRouter.get('/:id', wrap((req, res) => {
  const maquina = row(obtener, Number(req.params.id));
  if (!maquina) throw new HttpError(404, 'Máquina no encontrada');
  maquina.fallas = rows(db.prepare(`
    SELECT f.*,
           (SELECT COUNT(*) FROM soluciones s WHERE s.falla_id = f.id) AS soluciones,
           (SELECT s.descripcion FROM soluciones s WHERE s.falla_id = f.id
              ORDER BY s.efectiva DESC, datetime(s.fecha) DESC, s.id DESC LIMIT 1) AS ultima_solucion,
           (SELECT COUNT(*) FROM adjuntos a WHERE a.falla_id = f.id) AS adjuntos
    FROM fallas f WHERE f.maquina_id = ? ORDER BY datetime(f.fecha_deteccion) DESC, f.id DESC
  `), maquina.id);
  maquina.adjuntos = listarAdjuntos('maquina_id', maquina.id);
  res.json(maquina);
}));

/** Ficha técnica: datos de texto libre para admitir valores como "380 V trifásico" o "6-8 bar". */
const TEXTOS = ['codigo', 'nombre', 'departamento', 'marca', 'modelo', 'num_serie', 'capacidad', 'area', 'poe', 'tension', 'corriente',
  'potencia', 'presion_aire', 'consumo_aire', 'presion_vapor', 'consumo_vapor', 'notas'];
const CAMPOS = [...TEXTOS, 'tipo_id', 'anio', 'estado'];

const normalizar = (v) => {
  const d = Object.fromEntries(TEXTOS.map((c) => [c, texto(v[c])]));
  if (!d.codigo) throw new HttpError(400, 'El campo "codigo" es obligatorio');
  if (!d.nombre) throw new HttpError(400, 'El campo "nombre" es obligatorio');
  d.codigo = d.codigo.toUpperCase();
  d.tipo_id = entero(v.tipo_id, 'tipo_id', { min: 1 });
  if (d.tipo_id && !row(db.prepare('SELECT id FROM tipos_maquina WHERE id = ?'), d.tipo_id)) {
    throw new HttpError(400, 'El tipo de maquinaria indicado no existe');
  }
  d.anio = entero(v.anio, 'anio', { min: 1900, max: new Date().getFullYear() + 1 });
  d.estado = unoDe(v.estado, ESTADOS_MAQUINA, 'estado') || 'Operativa';
  return d;
};

const codigoDuplicado = (codigo, id = 0) =>
  row(db.prepare('SELECT id FROM maquinas WHERE codigo = ? COLLATE NOCASE AND id <> ?'), codigo, id);

maquinasRouter.post('/', admin, wrap((req, res) => {
  const d = normalizar(req.body);
  if (codigoDuplicado(d.codigo)) throw new HttpError(409, `Ya existe una máquina con el código "${d.codigo}"`);
  const { lastInsertRowid } = db.prepare(
    `INSERT INTO maquinas (${CAMPOS.join(',')}) VALUES (${CAMPOS.map(() => '?').join(',')})`,
  ).run(...CAMPOS.map((c) => p(d[c])));
  res.status(201).json(row(obtener, lastInsertRowid));
}));

maquinasRouter.put('/:id', admin, wrap((req, res) => {
  const actual = row(obtener, Number(req.params.id));
  if (!actual) throw new HttpError(404, 'Máquina no encontrada');
  const d = normalizar({ ...actual, ...req.body });
  if (codigoDuplicado(d.codigo, actual.id)) throw new HttpError(409, `Ya existe otra máquina con el código "${d.codigo}"`);
  transaccion(() => {
    db.prepare(`UPDATE maquinas SET ${CAMPOS.map((c) => `${c} = ?`).join(', ')}, actualizado_en = ? WHERE id = ?`)
      .run(...CAMPOS.map((c) => p(d[c])), ahora(), actual.id);
    // Al salir de un estado manual, el estado vuelve a depender de las fallas abiertas.
    if (d.estado !== actual.estado) sincronizarMaquina(actual.id);
  });
  res.json(row(obtener, actual.id));
}));

maquinasRouter.delete('/:id', admin, wrap((req, res) => {
  const actual = row(obtener, Number(req.params.id));
  if (!actual) throw new HttpError(404, 'Máquina no encontrada');
  if (String(req.query.confirmar || '').toUpperCase() !== actual.codigo.toUpperCase()) {
    throw new HttpError(400, `Para borrar la máquina y sus ${actual.total_fallas} fallas confirma escribiendo su código`);
  }
  const archivos = archivosDe('maquina_id', actual.id);
  db.prepare('DELETE FROM maquinas WHERE id = ?').run(actual.id);
  borrarArchivos(archivos);
  res.json({ ok: true, fallas_eliminadas: actual.total_fallas });
}));
