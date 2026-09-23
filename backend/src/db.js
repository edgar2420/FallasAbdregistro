import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** DATA_DIR permite mover la base y los adjuntos (Docker, pruebas). */
export const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, '..', 'data');
export const adjuntosDir = path.join(dataDir, 'adjuntos');
fs.mkdirSync(adjuntosDir, { recursive: true });

export const db = new DatabaseSync(path.join(dataDir, 'fallas.db'));
// WAL: lecturas y escrituras simultáneas sin bloquearse; busy_timeout espera en vez de fallar si la base está ocupada.
db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON;');
db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

/** node:sqlite devuelve objetos con prototipo null; los normalizamos para JSON. */
export const rows = (stmt, ...params) => stmt.all(...params).map((r) => ({ ...r }));
export const row = (stmt, ...params) => {
  const r = stmt.get(...params);
  return r ? { ...r } : null;
};

export const ahora = () => new Date().toLocaleString('sv-SE').replace('T', ' ');

/** Ejecuta fn dentro de una transacción: o se guardan todos los cambios o ninguno. */
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

/* Migraciones: las bases creadas con versiones anteriores reciben las columnas nuevas. */
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
  corriente: 'TEXT',
  potencia: 'TEXT',
  presion_aire: 'TEXT',
  consumo_aire: 'TEXT',
  presion_vapor: 'TEXT',
  consumo_vapor: 'TEXT',
});
