import { Router } from 'express';
import { db, rows, row, ahora, transaccion } from '../db.js';
import { HttpError, wrap } from '../errors.js';
import { p, texto, unoDe, entero, fecha, busqueda } from '../utils.js';
import { admin } from '../auth.js';
import { ABIERTAS_SQL, CATEGORIAS, SEVERIDADES, ESTADOS_FALLA, TURNOS } from '../catalogos.js';
import { sincronizarMaquina, siguienteCodigoFalla } from '../estado.js';
import { normalizarSolucion } from './soluciones.js';
import { archivosDe, borrarArchivos, listarAdjuntos } from './adjuntos.js';

export const fallasRouter = Router();

export const SELECT_FALLAS = `
  SELECT f.*, m.codigo AS maquina_codigo, m.nombre AS maquina_nombre, m.area AS maquina_area,
         t.nombre AS maquina_tipo,
         (SELECT COUNT(*) FROM soluciones s WHERE s.falla_id = f.id) AS soluciones,
         (SELECT s.descripcion FROM soluciones s WHERE s.falla_id = f.id
            ORDER BY s.efectiva DESC, datetime(s.fecha) DESC, s.id DESC LIMIT 1) AS ultima_solucion,
         (SELECT COUNT(*) FROM adjuntos a WHERE a.falla_id = f.id) AS adjuntos
  FROM fallas f
  JOIN maquinas m ON m.id = f.maquina_id
  LEFT JOIN tipos_maquina t ON t.id = m.tipo_id
`;
const obtener = db.prepare(`${SELECT_FALLAS} WHERE f.id = ?`);
const listarSoluciones = db.prepare('SELECT * FROM soluciones WHERE falla_id = ? ORDER BY datetime(fecha) DESC, id DESC');

fallasRouter.get('/', wrap((req, res) => {
  const { q, maquina_id, tipo_id, categoria, severidad, estado, desde, hasta } = req.query;
  const cond = [];
  const args = [];
  if (q) {
    const b = busqueda(['f.codigo', 'f.titulo', 'f.descripcion', 'f.sintomas', 'f.causa_raiz',
      'm.codigo', 'm.nombre', 'm.poe'], q);
    const s = busqueda(['s.descripcion', 's.repuestos'], q);
    cond.push(`(${b.sql} OR EXISTS (SELECT 1 FROM soluciones s WHERE s.falla_id = f.id AND ${s.sql}))`);
    args.push(...b.args, ...s.args);
  }
  if (maquina_id) { cond.push('f.maquina_id = ?'); args.push(Number(maquina_id) || 0); }
  if (tipo_id) { cond.push('m.tipo_id = ?'); args.push(Number(tipo_id) || 0); }
  if (categoria) { cond.push('f.categoria = ?'); args.push(String(categoria)); }
  if (severidad) { cond.push('f.severidad = ?'); args.push(String(severidad)); }
  if (estado === 'abiertas') cond.push(`f.estado IN ${ABIERTAS_SQL}`);
  else if (estado) { cond.push('f.estado = ?'); args.push(String(estado)); }
  if (desde) { cond.push('date(f.fecha_deteccion) >= date(?)'); args.push(fecha(desde, 'desde')); }
  if (hasta) { cond.push('date(f.fecha_deteccion) <= date(?)'); args.push(fecha(hasta, 'hasta')); }
  const sql = `${SELECT_FALLAS} ${cond.length ? `WHERE ${cond.join(' AND ')}` : ''}
               ORDER BY datetime(f.fecha_deteccion) DESC, f.id DESC`;
  res.json(rows(db.prepare(sql), ...args));
}));

fallasRouter.get('/:id', wrap((req, res) => {
  const falla = row(obtener, Number(req.params.id));
  if (!falla) throw new HttpError(404, 'Falla no encontrada');
  falla.soluciones_lista = rows(listarSoluciones, falla.id);
  falla.adjuntos_lista = listarAdjuntos('falla_id', falla.id);
  res.json(falla);
}));

const CAMPOS = ['maquina_id', 'titulo', 'descripcion', 'sintomas', 'categoria', 'severidad', 'estado',
  'causa_raiz', 'reportado_por', 'responsable', 'turno', 'fecha_deteccion', 'fecha_resolucion', 'paro_minutos'];

const normalizar = (v) => {
  const d = {
    maquina_id: entero(v.maquina_id, 'maquina_id', { min: 1 }),
    titulo: texto(v.titulo),
    descripcion: texto(v.descripcion),
    sintomas: texto(v.sintomas),
    categoria: unoDe(v.categoria, CATEGORIAS, 'categoria') || 'Mecánica',
    severidad: unoDe(v.severidad, SEVERIDADES, 'severidad') || 'Media',
    estado: unoDe(v.estado, ESTADOS_FALLA, 'estado') || 'Abierta',
    causa_raiz: texto(v.causa_raiz),
    reportado_por: texto(v.reportado_por),
    responsable: texto(v.responsable),
    turno: unoDe(v.turno, TURNOS, 'turno'),
    fecha_deteccion: fecha(v.fecha_deteccion, 'fecha_deteccion') || ahora(),
    fecha_resolucion: fecha(v.fecha_resolucion, 'fecha_resolucion'),
    paro_minutos: entero(v.paro_minutos, 'paro_minutos', { max: 525600 }) ?? 0,
  };
  if (!d.titulo) throw new HttpError(400, 'El campo "titulo" es obligatorio');
  if (!d.maquina_id) throw new HttpError(400, 'El campo "maquina_id" es obligatorio');
  if (!row(db.prepare('SELECT id FROM maquinas WHERE id = ?'), d.maquina_id)) {
    throw new HttpError(400, 'La máquina indicada no existe');
  }
  if (d.estado === 'Resuelta') d.fecha_resolucion ||= ahora();
  else d.fecha_resolucion = null;
  if (d.fecha_resolucion && d.fecha_resolucion < d.fecha_deteccion) {
    throw new HttpError(400, 'La fecha de resolución no puede ser anterior a la de detección');
  }
  return d;
};

fallasRouter.post('/', admin, wrap((req, res) => {
  const datos = normalizar(req.body);
  const id = transaccion(() => {
    const codigo = texto(req.body.codigo) || siguienteCodigoFalla();
    const { lastInsertRowid } = db.prepare(
      `INSERT INTO fallas (codigo, ${CAMPOS.join(',')}) VALUES (${Array(CAMPOS.length + 1).fill('?').join(',')})`,
    ).run(codigo, ...CAMPOS.map((c) => p(datos[c])));
    sincronizarMaquina(datos.maquina_id);
    return lastInsertRowid;
  });
  res.status(201).json(row(obtener, id));
}));

fallasRouter.put('/:id', admin, wrap((req, res) => {
  const actual = row(obtener, Number(req.params.id));
  if (!actual) throw new HttpError(404, 'Falla no encontrada');
  const datos = normalizar({ ...actual, ...req.body });
  transaccion(() => {
    db.prepare(`UPDATE fallas SET ${CAMPOS.map((c) => `${c} = ?`).join(', ')}, actualizado_en = ? WHERE id = ?`)
      .run(...CAMPOS.map((c) => p(datos[c])), ahora(), actual.id);
    if (datos.maquina_id !== actual.maquina_id) {
      db.prepare('UPDATE adjuntos SET maquina_id = ? WHERE falla_id = ?').run(datos.maquina_id, actual.id);
      sincronizarMaquina(actual.maquina_id);
    }
    sincronizarMaquina(datos.maquina_id);
  });
  res.json(row(obtener, actual.id));
}));

fallasRouter.delete('/:id', admin, wrap((req, res) => {
  const actual = row(obtener, Number(req.params.id));
  if (!actual) throw new HttpError(404, 'Falla no encontrada');
  const archivos = archivosDe('falla_id', actual.id);
  transaccion(() => {
    db.prepare('DELETE FROM fallas WHERE id = ?').run(actual.id);
    sincronizarMaquina(actual.maquina_id);
  });
  borrarArchivos(archivos);
  res.json({ ok: true });
}));

/* ---------- Soluciones de una falla ---------- */

fallasRouter.get('/:id/soluciones', wrap((req, res) => {
  res.json(rows(listarSoluciones, Number(req.params.id)));
}));

fallasRouter.post('/:id/soluciones', admin, wrap((req, res) => {
  const falla = row(obtener, Number(req.params.id));
  if (!falla) throw new HttpError(404, 'Falla no encontrada');
  const s = normalizarSolucion(req.body);
  const id = transaccion(() => {
    const { lastInsertRowid } = db.prepare(`
      INSERT INTO soluciones (falla_id, descripcion, repuestos, herramientas, tiempo_minutos, costo,
                              tecnico, efectiva, preventivo, fecha)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `).run(falla.id, s.descripcion, p(s.repuestos), p(s.herramientas), s.tiempo_minutos, s.costo,
      p(s.tecnico), s.efectiva, p(s.preventivo), s.fecha);

    // Una solución efectiva cierra la falla; una fallida la deja "En proceso".
    if (s.efectiva && !['Resuelta', 'Anulada'].includes(falla.estado)) {
      const cierre = s.fecha > falla.fecha_deteccion ? s.fecha : ahora();
      db.prepare('UPDATE fallas SET estado = ?, fecha_resolucion = ?, actualizado_en = ? WHERE id = ?')
        .run('Resuelta', cierre, ahora(), falla.id);
    } else if (!s.efectiva && falla.estado === 'Abierta') {
      db.prepare('UPDATE fallas SET estado = ?, actualizado_en = ? WHERE id = ?').run('En proceso', ahora(), falla.id);
    }
    sincronizarMaquina(falla.maquina_id);
    return lastInsertRowid;
  });
  res.status(201).json(row(db.prepare('SELECT * FROM soluciones WHERE id = ?'), id));
}));
