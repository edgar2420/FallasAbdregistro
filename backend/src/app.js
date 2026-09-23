import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { db, rows } from './db.js';
import { HttpError, wrap } from './errors.js';
import { catalogos } from './catalogos.js';
import { tiposRouter } from './routes/tipos.js';
import { maquinasRouter } from './routes/maquinas.js';
import { fallasRouter } from './routes/fallas.js';
import { solucionesRouter } from './routes/soluciones.js';
import { statsRouter } from './routes/stats.js';
import { authRouter } from './routes/auth.js';
import { adjuntosRouter } from './routes/adjuntos.js';
import { auth, registrar } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const app = express();

app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});

// Sin CORS: el frontend se sirve desde el mismo origen (proxy de Angular en desarrollo, Express en planta).
// Las fotos viajan en base64 y necesitan un límite mayor; se aplica sólo después de autenticar.
const jsonChico = express.json({ limit: '200kb' });
app.use((req, res, next) => (req.path.startsWith('/api/adjuntos') ? next() : jsonChico(req, res, next)));

app.get('/api/salud', (req, res) => res.json({ ok: true, servicio: 'control-fallas' }));
app.use('/api/auth', authRouter);
app.get('/api/catalogos', (req, res) => res.json(catalogos));

app.use('/api/tipos', auth, tiposRouter);
app.use('/api/maquinas', auth, maquinasRouter);
app.use('/api/fallas', auth, fallasRouter);
app.use('/api/soluciones', auth, solucionesRouter);
app.use('/api/stats', auth, statsRouter);
app.use('/api/adjuntos', auth, express.json({ limit: '12mb' }), adjuntosRouter);

/** Excel ejecuta como fórmula las celdas que empiezan por = + - @; se neutralizan con un apóstrofo. */
const celdaCsv = (v) => {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

app.get('/api/export/fallas.csv', auth, wrap((req, res) => {
  const datos = rows(db.prepare(`
    SELECT f.codigo, m.codigo AS maquina, m.nombre AS maquina_nombre, t.nombre AS tipo, m.area, m.poe,
           f.titulo, f.sintomas, f.categoria, f.severidad, f.estado, f.causa_raiz,
           f.fecha_deteccion, f.fecha_resolucion, f.paro_minutos, f.responsable,
           (SELECT GROUP_CONCAT(s.descripcion, ' | ') FROM soluciones s WHERE s.falla_id = f.id) AS soluciones
    FROM fallas f
    JOIN maquinas m ON m.id = f.maquina_id
    LEFT JOIN tipos_maquina t ON t.id = m.tipo_id
    ORDER BY datetime(f.fecha_deteccion) DESC
  `));
  const cabecera = datos.length ? Object.keys(datos[0]) : ['codigo'];
  const csv = [cabecera.join(';'), ...datos.map((d) => cabecera.map((c) => celdaCsv(d[c])).join(';'))].join('\r\n');
  registrar(req.usuario.id, 'exportar_csv', '/api/export/fallas.csv');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="fallas.csv"');
  res.send(`﻿${csv}`);
}));

app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

// En producción sirve el frontend Angular compilado.
const dist = process.env.FRONTEND_DIST
  || path.join(__dirname, '..', '..', 'frontend-angular', 'dist', 'frontend-angular', 'browser');
if (fs.existsSync(path.join(dist, 'index.html'))) {
  app.use(express.static(dist));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

const RESTRICCIONES = [
  [/UNIQUE constraint failed/i, 409, 'Ya existe un registro con ese valor único (por ejemplo, el código)'],
  [/FOREIGN KEY constraint failed/i, 400, 'El registro relacionado no existe'],
  [/CHECK constraint failed/i, 400, 'Algún valor no está permitido'],
];

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, ...(err.codigo ? { codigo: err.codigo } : {}) });
  }
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'El cuerpo de la petición no es JSON válido' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'La petición es demasiado grande' });
  const restriccion = RESTRICCIONES.find(([re]) => re.test(err.message || ''));
  if (restriccion) return res.status(restriccion[1]).json({ error: restriccion[2] });
  if (Number.isInteger(err.status) && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ error: 'Petición no válida' });
  }
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});
