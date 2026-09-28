import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { db, dataDir, adjuntosDir } from './db.js';

export const respaldosDir = process.env.RESPALDOS_DIR
  ? path.resolve(process.env.RESPALDOS_DIR)
  : path.join(dataDir, 'respaldos');
const GUARDAR = Math.max(1, Number(process.env.RESPALDOS_GUARDAR) || 14);

const listar = () => (fs.existsSync(respaldosDir)
  ? fs.readdirSync(respaldosDir).filter((n) => fs.statSync(path.join(respaldosDir, n)).isDirectory()).sort()
  : []);

export function respaldar() {
  const d = new Date();
  const dos = (n) => String(n).padStart(2, '0');
  const sello = `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}-${dos(d.getHours())}-${dos(d.getMinutes())}`;
  const destino = path.join(respaldosDir, sello);
  fs.mkdirSync(destino, { recursive: true });
  const archivoDb = path.join(destino, 'fallas.db');
  fs.rmSync(archivoDb, { force: true });
  db.exec(`VACUUM INTO '${archivoDb.replace(/'/g, "''")}'`);
  fs.cpSync(adjuntosDir, path.join(destino, 'adjuntos'), { recursive: true });

  const todos = listar();
  for (const viejo of todos.slice(0, Math.max(0, todos.length - GUARDAR))) {
    fs.rmSync(path.join(respaldosDir, viejo), { recursive: true, force: true });
  }
  return destino;
}

export function horasDesdeUltimo() {
  const ultimo = listar().pop();
  if (!ultimo) return Infinity;
  return (Date.now() - fs.statSync(path.join(respaldosDir, ultimo)).mtimeMs) / 3_600_000;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(`Respaldo creado en ${respaldar()}`);
}
