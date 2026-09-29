import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, '..', 'data');
export const adjuntosDir = path.join(dataDir, 'adjuntos');
fs.mkdirSync(adjuntosDir, { recursive: true });

export const db = new DatabaseSync(path.join(dataDir, 'fallas.db'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON;');
db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

export const rows = (stmt, ...params) => stmt.all(...params).map((r) => ({ ...r }));
export const row = (stmt, ...params) => {
  const r = stmt.get(...params);
  return r ? { ...r } : null;
};

export const ahora = () => new Date().toLocaleString('sv-SE').replace('T', ' ');

export const transaccion = (fn) => {
  db.exec('BEGIN');
  try {
    const resultado = fn();
    db.exec('COMMIT');
    return resultado;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
};

const agregarColumnas = (tabla, columnas) => {
  const existentes = new Set(rows(db.prepare(`PRAGMA table_info(${tabla})`)).map((c) => c.name));
  for (const [nombre, definicion] of Object.entries(columnas)) {
    if (!existentes.has(nombre)) db.exec(`ALTER TABLE ${tabla} ADD COLUMN ${nombre} ${definicion}`);
  }
};

agregarColumnas('usuarios', { debe_cambiar: 'INTEGER NOT NULL DEFAULT 0 CHECK (debe_cambiar IN (0,1))' });
agregarColumnas('maquinas', {
  departamento: 'TEXT',
  capacidad: 'TEXT',
  poe: 'TEXT',
  tension: 'TEXT',
  tension_mando: 'TEXT',
  corriente: 'TEXT',
  potencia: 'TEXT',
  presion_aire: 'TEXT',
  consumo_aire: 'TEXT',
  presion_vapor: 'TEXT',
  consumo_vapor: 'TEXT',
  presion_hidraulica: 'TEXT',
});
agregarColumnas('fallas', { codigo_alarma: 'TEXT' });

// La categoría de falla dejó de tener una lista fija: reconstruye la tabla si todavía
// trae el CHECK antiguo (SQLite no permite quitar un CHECK con ALTER TABLE).
const tablaFallas = row(db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'fallas'"));
if (tablaFallas?.sql && /CHECK\s*\(\s*categoria/i.test(tablaFallas.sql)) {
  const columnas = rows(db.prepare('PRAGMA table_info(fallas)')).map((c) => c.name).join(',');
  db.exec('PRAGMA foreign_keys = OFF');
  db.exec('BEGIN');
  try {
    db.exec('ALTER TABLE fallas RENAME TO fallas_migracion_categoria');
    // Los índices se quedan atados a la tabla renombrada: se sueltan para que el
    // schema.sql de abajo los vuelva a crear sobre la tabla "fallas" nueva.
    db.exec('DROP INDEX IF EXISTS idx_fallas_maquina');
    db.exec('DROP INDEX IF EXISTS idx_fallas_estado');
    db.exec('DROP INDEX IF EXISTS idx_fallas_fecha');
    db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
    db.exec(`INSERT INTO fallas (${columnas}) SELECT ${columnas} FROM fallas_migracion_categoria`);
    db.exec('DROP TABLE fallas_migracion_categoria');
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  db.exec('PRAGMA foreign_keys = ON');
}
