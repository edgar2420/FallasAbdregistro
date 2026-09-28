import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { db, rows } from './db.js';
import { HttpError, wrap } from './errors.js';
import { catalogos } from './catalogos.js';
import { LIMITES } from './limites.js';
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

if (process.env.TRUST_PROXY) {
  const v = process.env.TRUST_PROXY;
  app.set('trust proxy', /^\d+$/.test(v) ? Number(v) : v);
}

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "frame-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  if (req.secure) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

const VENTANA_MS = 60_000;
const MAX_POR_MINUTO = Number(process.env.LIMITE_PETICIONES) || 600;
const peticiones = new Map();
setInterval(() => {
  const ahora = Date.now();
  for (const [ip, c] of peticiones) if (ahora - c.desde > VENTANA_MS) peticiones.delete(ip);
}, VENTANA_MS).unref();
app.use('/api', (req, res, next) => {
  const ahora = Date.now();
  let c = peticiones.get(req.ip);
  if (!c || ahora - c.desde > VENTANA_MS) {
    c = { n: 0, desde: ahora };
    peticiones.set(req.ip, c);
  }
  c.n += 1;
  if (c.n > MAX_POR_MINUTO) {
    res.setHeader('Retry-After', String(Math.ceil((c.desde + VENTANA_MS - ahora) / 1000)));
    return res.status(429).json({ error: 'Demasiadas peticiones seguidas. Espera un momento y vuelve a intentar.' });
  }
  next();
});

const jsonChico = express.json({ limit: '200kb' });
app.use((req, res, next) => (req.path.startsWith('/api/adjuntos') ? next() : jsonChico(req, res, next)));

app.get('/api/salud', (req, res) => {
  try {
    db.prepare('SELECT 1').get();
    res.json({ ok: true, servicio: 'control-fallas' });
  } catch {
    res.status(503).json({ ok: false, error: 'La base de datos no responde' });
  }
});
app.use('/api/auth', authRouter);
app.get('/api/catalogos', (req, res) => res.json({ ...catalogos, limites: LIMITES }));

app.use('/api/tipos', auth, tiposRouter);
app.use('/api/maquinas', auth, maquinasRouter);
app.use('/api/fallas', auth, fallasRouter);
app.use('/api/soluciones', auth, solucionesRouter);
app.use('/api/stats', auth, statsRouter);
app.use('/api/adjuntos', auth, express.json({ limit: '12mb' }), adjuntosRouter);



app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

const dist = process.env.FRONTEND_DIST
  || path.join(__dirname, '..', '..', 'frontend-angular', 'dist', 'frontend-angular', 'browser');
if (fs.existsSync(path.join(dist, 'index.html'))) {
  app.use(express.static(dist, {
    index: false,
    setHeaders: (res, archivo) => {
      const conHash = /-[A-Z0-9]{8}\.(js|css)$/.test(archivo) || archivo.includes(`${path.sep}media${path.sep}`);
      res.setHeader('Cache-Control', conHash ? 'public, max-age=31536000, immutable' : 'no-cache');
    },
  }));
  app.get('*', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(dist, 'index.html'));
  });
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
