import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

export const db = new DatabaseSync(path.join(dataDir, 'fallas.db'));
db.exec('PRAGMA foreign_keys = ON;');
db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

/** node:sqlite devuelve objetos con prototipo null; los normalizamos para JSON. */
export const rows = (stmt, ...params) => stmt.all(...params).map((r) => ({ ...r }));
export const row = (stmt, ...params) => {
  const r = stmt.get(...params);
  return r ? { ...r } : null;
};

export const ahora = () => new Date().toLocaleString('sv-SE').replace('T', ' ');
