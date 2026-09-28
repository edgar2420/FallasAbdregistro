import { Router } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { db, rows, row, adjuntosDir } from '../db.js';
import { HttpError, wrap, requerido } from '../errors.js';
import { texto, unoDe, entero } from '../utils.js';
import { admin } from '../auth.js';
import { CATEGORIAS_ADJUNTO } from '../catalogos.js';
import { LIMITES, limitar } from '../limites.js';

export const adjuntosRouter = Router();

export const MAX_BYTES = LIMITES.adjunto.mb * 1024 * 1024;

const FORMATOS = [
  { mime: 'image/jpeg', ext: 'jpg', es: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/png', ext: 'png', es: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: 'image/webp', ext: 'webp', es: (b) => b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP' },
  { mime: 'application/pdf', ext: 'pdf', es: (b) => b.toString('latin1', 0, 5) === '%PDF-' },
];

const SELECT = `
  SELECT a.id, a.maquina_id, a.falla_id, a.categoria, a.descripcion, a.mime, a.nombre_original,
         a.bytes, a.creado_en, f.codigo AS falla_codigo, u.nombre AS subido_por_nombre
  FROM adjuntos a
  LEFT JOIN fallas f ON f.id = a.falla_id
  LEFT JOIN usuarios u ON u.id = a.subido_por`;

export const listarAdjuntos = (campo, id) =>
  rows(db.prepare(`${SELECT} WHERE a.${campo} = ? ORDER BY datetime(a.creado_en) DESC, a.id DESC`), id);

export const archivosDe = (campo, id) =>
  rows(db.prepare(`SELECT archivo FROM adjuntos WHERE ${campo} = ?`), id).map((r) => r.archivo);

export const borrarArchivos = (nombres) => {
  for (const nombre of nombres) fs.rm(path.join(adjuntosDir, path.basename(nombre)), { force: true }, () => {});
};

adjuntosRouter.get('/', wrap((req, res) => {
  const fallaId = entero(req.query.falla_id, 'falla_id', { min: 1 });
  const maquinaId = entero(req.query.maquina_id, 'maquina_id', { min: 1 });
  if (fallaId) return res.json(listarAdjuntos('falla_id', fallaId));
  if (maquinaId) return res.json(listarAdjuntos('maquina_id', maquinaId));
  throw new HttpError(400, 'Indica maquina_id o falla_id');
}));

adjuntosRouter.get('/:id/archivo', wrap((req, res) => {
  const a = row(db.prepare('SELECT * FROM adjuntos WHERE id = ?'), Number(req.params.id));
  if (!a) throw new HttpError(404, 'Archivo no encontrado');
  const ruta = path.join(adjuntosDir, path.basename(a.archivo));
  if (!fs.existsSync(ruta)) throw new HttpError(404, 'El archivo ya no está en el servidor');
  const nombre = encodeURIComponent(a.nombre_original || a.archivo);
  res.set({
    'Content-Type': a.mime,
    'Content-Disposition': `inline; filename*=UTF-8''${nombre}`,
    'Cache-Control': 'private, max-age=3600',
  });
  res.sendFile(ruta);
}));

adjuntosRouter.post('/', admin, wrap((req, res) => {
  const categoria = unoDe(req.body.categoria, CATEGORIAS_ADJUNTO, 'categoria') || 'Otra';
  const fallaId = entero(req.body.falla_id, 'falla_id', { min: 1 });
  let maquinaId = entero(req.body.maquina_id, 'maquina_id', { min: 1 });
  if (fallaId) {
    const falla = row(db.prepare('SELECT maquina_id FROM fallas WHERE id = ?'), fallaId);
    if (!falla) throw new HttpError(400, 'La falla indicada no existe');
    maquinaId = falla.maquina_id;
  }
  if (!maquinaId || !row(db.prepare('SELECT id FROM maquinas WHERE id = ?'), maquinaId)) {
    throw new HttpError(400, 'La máquina indicada no existe');
  }
  limitar({ descripcion: texto(req.body.descripcion) }, LIMITES.adjunto);
  const cuenta = (campo, id) => row(db.prepare(`SELECT COUNT(*) AS n FROM adjuntos WHERE ${campo} = ?`), id).n;
  const cuentaDirecta = (id) =>
    row(db.prepare('SELECT COUNT(*) AS n FROM adjuntos WHERE maquina_id = ? AND falla_id IS NULL'), id).n;
  if (fallaId && cuenta('falla_id', fallaId) >= LIMITES.adjunto.por_falla) {
    throw new HttpError(409, `Cada falla admite como máximo ${LIMITES.adjunto.por_falla} fotos o documentos. Quita alguno para subir otro.`);
  }
  if (!fallaId && cuentaDirecta(maquinaId) >= LIMITES.adjunto.equipo) {
    throw new HttpError(409, `El equipo admite como máximo ${LIMITES.adjunto.equipo} fotos generales (equipo y placa). Quita alguna para subir otra.`);
  }
  if (cuenta('maquina_id', maquinaId) >= LIMITES.adjunto.por_maquina) {
    throw new HttpError(409, `Cada máquina admite como máximo ${LIMITES.adjunto.por_maquina} fotos o documentos (incluidas las de sus fallas). Quita alguno para subir otro.`);
  }

  const base64 = requerido(req.body.datos, 'datos').replace(/^data:[^,]*,/, '');
  const buffer = Buffer.from(base64, 'base64');
  if (!buffer.length) throw new HttpError(400, 'El archivo está vacío');
  if (buffer.length > MAX_BYTES) throw new HttpError(413, `El archivo supera el máximo de ${LIMITES.adjunto.mb} MB`);
  const formato = FORMATOS.find((f) => f.es(buffer));
  if (!formato) throw new HttpError(415, 'Sólo se aceptan fotos JPG, PNG o WEBP y documentos PDF');

  const archivo = `${crypto.randomUUID()}.${formato.ext}`;
  fs.writeFileSync(path.join(adjuntosDir, archivo), buffer, { flag: 'wx' });
  try {
    const { lastInsertRowid } = db.prepare(`
      INSERT INTO adjuntos (maquina_id, falla_id, categoria, descripcion, archivo, mime, nombre_original, bytes, subido_por)
      VALUES (?,?,?,?,?,?,?,?,?)`).run(
      maquinaId, fallaId, categoria, texto(req.body.descripcion), archivo, formato.mime,
      texto(req.body.nombre)?.slice(0, 200) ?? null, buffer.length, req.usuario.id,
    );
    res.status(201).json(row(db.prepare(`${SELECT} WHERE a.id = ?`), lastInsertRowid));
  } catch (e) {
    borrarArchivos([archivo]);
    throw e;
  }
}));

adjuntosRouter.patch('/:id', admin, wrap((req, res) => {
  const a = row(db.prepare('SELECT * FROM adjuntos WHERE id = ?'), Number(req.params.id));
  if (!a) throw new HttpError(404, 'Archivo no encontrado');
  const categoria = unoDe(req.body.categoria ?? a.categoria, CATEGORIAS_ADJUNTO, 'categoria');
  const descripcion = req.body.descripcion === undefined ? a.descripcion : texto(req.body.descripcion);
  limitar({ descripcion }, LIMITES.adjunto);
  db.prepare('UPDATE adjuntos SET categoria = ?, descripcion = ? WHERE id = ?').run(categoria, descripcion, a.id);
  res.json(row(db.prepare(`${SELECT} WHERE a.id = ?`), a.id));
}));

adjuntosRouter.delete('/:id', admin, wrap((req, res) => {
  const a = row(db.prepare('SELECT * FROM adjuntos WHERE id = ?'), Number(req.params.id));
  if (!a) throw new HttpError(404, 'Archivo no encontrado');
  db.prepare('DELETE FROM adjuntos WHERE id = ?').run(a.id);
  borrarArchivos([a.archivo]);
  res.json({ ok: true });
}));
