import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { db, rows } from './db.js';
import { HttpError } from './errors.js';
import { tiposRouter } from './routes/tipos.js';
import { maquinasRouter } from './routes/maquinas.js';
import { fallasRouter } from './routes/fallas.js';
import { solucionesRouter } from './routes/soluciones.js';
import { statsRouter } from './routes/stats.js';
import { authRouter } from './routes/auth.js';
import { auth } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4010;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/salud', (req, res) => res.json({ ok: true, servicio: 'control-fallas' }));
app.use('/api/auth', authRouter);

// Valores permitidos para los selectores del frontend (espejo de los CHECK del esquema).
app.get('/api/catalogos', (req, res) => {
  res.json({
    categorias: ['Mecánica', 'Eléctrica', 'Neumática', 'Hidráulica', 'Electrónica / Control',
      'Software / HMI', 'Operativa', 'Calidad de producto', 'Servicios (agua/vapor/aire)', 'Otra'],
    severidades: ['Baja', 'Media', 'Alta', 'Crítica'],
    estados_falla: ['Abierta', 'En proceso', 'Resuelta', 'Recurrente', 'Anulada'],
    estados_maquina: ['Operativa', 'En falla', 'Mantenimiento', 'Fuera de servicio'],
    turnos: ['Mañana', 'Tarde', 'Noche'],
  });
});

app.use('/api/tipos', auth, tiposRouter);
app.use('/api/maquinas', auth, maquinasRouter);
app.use('/api/fallas', auth, fallasRouter);
app.use('/api/soluciones', auth, solucionesRouter);
app.use('/api/stats', auth, statsRouter);

// Exportación a CSV del historial completo de fallas y soluciones.
app.get('/api/export/fallas.csv', (req, res) => {
  const datos = rows(db.prepare(`
    SELECT f.codigo, m.codigo AS maquina, m.nombre AS maquina_nombre, t.nombre AS tipo,
           f.titulo, f.sintomas, f.categoria, f.severidad, f.estado, f.causa_raiz,
           f.fecha_deteccion, f.fecha_resolucion, f.paro_minutos, f.responsable,
           (SELECT GROUP_CONCAT(s.descripcion, ' | ') FROM soluciones s WHERE s.falla_id = f.id) AS soluciones
    FROM fallas f
    JOIN maquinas m ON m.id = f.maquina_id
    LEFT JOIN tipos_maquina t ON t.id = m.tipo_id
    ORDER BY datetime(f.fecha_deteccion) DESC
  `));
  const cabecera = datos.length ? Object.keys(datos[0]) : ['codigo'];
  const escapar = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [cabecera.join(';'), ...datos.map((d) => cabecera.map((c) => escapar(d[c])).join(';'))].join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="fallas.csv"');
  res.send(`﻿${csv}`);
});

// En producción sirve el frontend Angular compilado.
const dist = path.join(__dirname, '..', '..', 'frontend-angular', 'dist', 'frontend-angular', 'browser');
if (fs.existsSync(path.join(dist, 'index.html'))) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

app.use((err, req, res, next) => {
  let status = err instanceof HttpError ? err.status : 500;
  // Las violaciones de CHECK/UNIQUE de SQLite son datos inválidos, no fallos del servidor.
  if (status === 500 && /constraint failed/i.test(err.message || '')) status = 400;
  if (status === 500) console.error(err);
  res.status(status).json({ error: err.message || 'Error interno del servidor' });
});

app.listen(PORT, () => {
  console.log(`API Control de Fallas escuchando en http://localhost:${PORT}`);
});
