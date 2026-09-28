import { db, row, ahora } from './db.js';
import { ABIERTAS_SQL } from './catalogos.js';

export function sincronizarMaquina(maquinaId) {
  const maquina = row(db.prepare('SELECT * FROM maquinas WHERE id = ?'), maquinaId);
  if (!maquina || maquina.estado === 'Mantenimiento' || maquina.estado === 'Fuera de servicio') return;
  const { n } = row(db.prepare(
    `SELECT COUNT(*) AS n FROM fallas WHERE maquina_id = ? AND estado IN ${ABIERTAS_SQL}
       AND severidad IN ('Alta','Crítica')`,
  ), maquinaId);
  const nuevo = n > 0 ? 'En falla' : 'Operativa';
  if (nuevo !== maquina.estado) {
    db.prepare('UPDATE maquinas SET estado = ?, actualizado_en = ? WHERE id = ?').run(nuevo, ahora(), maquinaId);
  }
}

export function recalcularFalla(fallaId) {
  const falla = row(db.prepare('SELECT * FROM fallas WHERE id = ?'), fallaId);
  if (!falla || falla.estado === 'Anulada') return;
  const r = row(db.prepare(`
    SELECT COUNT(*) AS total, IFNULL(SUM(efectiva), 0) AS efectivas,
           MAX(CASE WHEN efectiva = 1 THEN fecha END) AS ultima
    FROM soluciones WHERE falla_id = ?`), fallaId);
  if (r.efectivas > 0 && falla.estado !== 'Resuelta') {
    const cierre = r.ultima && r.ultima > falla.fecha_deteccion ? r.ultima : ahora();
    db.prepare('UPDATE fallas SET estado = ?, fecha_resolucion = ?, actualizado_en = ? WHERE id = ?')
      .run('Resuelta', cierre, ahora(), fallaId);
  } else if (r.efectivas === 0 && falla.estado === 'Resuelta') {
    db.prepare('UPDATE fallas SET estado = ?, fecha_resolucion = NULL, actualizado_en = ? WHERE id = ?')
      .run(r.total > 0 ? 'En proceso' : 'Abierta', ahora(), fallaId);
  }
  sincronizarMaquina(falla.maquina_id);
}

export function siguienteCodigoFalla() {
  const { n } = row(db.prepare(
    "SELECT IFNULL(MAX(CAST(SUBSTR(codigo, 5) AS INTEGER)), 0) AS n FROM fallas WHERE codigo LIKE 'FAL-%'",
  ));
  return `FAL-${String(n + 1).padStart(4, '0')}`;
}
