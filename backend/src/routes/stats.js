import { Router } from 'express';
import { db, rows, row } from '../db.js';
import { wrap } from '../errors.js';
import { ABIERTAS_SQL as ABIERTAS } from '../catalogos.js';

export const statsRouter = Router();

statsRouter.get('/', wrap((req, res) => {
  const dias = Math.min(Math.max(Math.trunc(Number(req.query.dias)) || 30, 1), 3650);
  const desde = `-${dias} days`;

  const resumen = row(db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM maquinas) AS maquinas,
      (SELECT COUNT(*) FROM maquinas WHERE estado = 'Operativa') AS maquinas_operativas,
      (SELECT COUNT(*) FROM maquinas WHERE estado = 'En falla') AS maquinas_en_falla,
      (SELECT COUNT(*) FROM fallas) AS fallas_total,
      (SELECT COUNT(*) FROM fallas WHERE estado IN ${ABIERTAS}) AS fallas_abiertas,
      (SELECT COUNT(*) FROM fallas WHERE estado IN ${ABIERTAS} AND severidad = 'Crítica') AS fallas_criticas,
      (SELECT COUNT(*) FROM fallas WHERE estado = 'Resuelta') AS fallas_resueltas,
      (SELECT COUNT(*) FROM soluciones) AS soluciones,
      (SELECT IFNULL(SUM(paro_minutos), 0) FROM fallas
         WHERE date(fecha_deteccion) >= date('now', 'localtime', ?)) AS paro_minutos_periodo,
      (SELECT COUNT(*) FROM fallas WHERE date(fecha_deteccion) >= date('now', 'localtime', ?)) AS fallas_periodo
  `), desde, desde);

  const mttr = row(db.prepare(`
    SELECT ROUND(AVG((julianday(fecha_resolucion) - julianday(fecha_deteccion)) * 24), 2) AS horas
    FROM fallas WHERE estado = 'Resuelta' AND fecha_resolucion IS NOT NULL
  `));

  res.json({
    dias,
    resumen: { ...resumen, mttr_horas: mttr.horas ?? 0 },
    por_categoria: rows(db.prepare(`
      SELECT categoria AS etiqueta, COUNT(*) AS total,
             SUM(CASE WHEN estado IN ${ABIERTAS} THEN 1 ELSE 0 END) AS abiertas
      FROM fallas GROUP BY categoria ORDER BY total DESC
    `)),
    por_severidad: rows(db.prepare(`
      SELECT severidad AS etiqueta, COUNT(*) AS total FROM fallas
      GROUP BY severidad
      ORDER BY CASE severidad WHEN 'Crítica' THEN 1 WHEN 'Alta' THEN 2 WHEN 'Media' THEN 3 ELSE 4 END
    `)),
    por_estado: rows(db.prepare(
      'SELECT estado AS etiqueta, COUNT(*) AS total FROM fallas GROUP BY estado ORDER BY total DESC',
    )),
    por_tipo: rows(db.prepare(`
      SELECT IFNULL(t.nombre, 'Sin tipo') AS etiqueta, COUNT(f.id) AS total,
             IFNULL(SUM(f.paro_minutos), 0) AS paro_minutos
      FROM maquinas m
      LEFT JOIN tipos_maquina t ON t.id = m.tipo_id
      LEFT JOIN fallas f ON f.maquina_id = m.id
      GROUP BY etiqueta ORDER BY total DESC
    `)),
    top_maquinas: rows(db.prepare(`
      SELECT m.id, m.codigo, m.nombre, COUNT(f.id) AS fallas,
             IFNULL(SUM(f.paro_minutos), 0) AS paro_minutos
      FROM maquinas m JOIN fallas f ON f.maquina_id = m.id
      GROUP BY m.id ORDER BY fallas DESC, paro_minutos DESC LIMIT 8
    `)),
    tendencia: rows(db.prepare(`
      SELECT strftime('%Y-%m', fecha_deteccion) AS mes, COUNT(*) AS total,
             IFNULL(SUM(paro_minutos), 0) AS paro_minutos
      FROM fallas GROUP BY mes ORDER BY mes DESC LIMIT 12
    `)).reverse(),
    recientes: rows(db.prepare(`
      SELECT f.id, f.codigo, f.titulo, f.severidad, f.estado, f.fecha_deteccion,
             m.codigo AS maquina_codigo, m.nombre AS maquina_nombre
      FROM fallas f JOIN maquinas m ON m.id = f.maquina_id
      ORDER BY datetime(f.fecha_deteccion) DESC, f.id DESC LIMIT 8
    `)),
  });
}));
