import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Base temporaria: las pruebas nunca tocan backend/data.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fallas-test-'));
process.env.DATA_DIR = dir;
process.env.FRONTEND_DIST = path.join(dir, 'sin-frontend');

const { app } = await import('../src/app.js');
const { asegurarAdmin } = await import('../src/auth.js');
const { db } = await import('../src/db.js');

let server;
let base;
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

const api = async (metodo, ruta, { token, body, crudo } = {}) => {
  const r = await fetch(base + ruta, {
    method: metodo,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined || crudo ? { 'Content-Type': 'application/json' } : {}),
    },
    body: crudo ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
  const tipo = r.headers.get('content-type') || '';
  return { status: r.status, datos: tipo.includes('json') ? await r.json() : await r.text(), headers: r.headers };
};

const login = async (usuario, password) => (await api('POST', '/api/auth/login', { body: { email: usuario, password } })).datos.token;

let adminToken;
let operadorToken;
let maquina;

before(async () => {
  asegurarAdmin();
  server = app.listen(0);
  await new Promise((ok) => server.once('listening', ok));
  base = `http://127.0.0.1:${server.address().port}`;

  const t = await login('admin', 'Admin1234!');
  await api('POST', '/api/auth/cambiar-password', { token: t, body: { actual: 'Admin1234!', nueva: 'ClaveNueva2026' } });
  adminToken = t;
  await api('POST', '/api/auth/usuarios', {
    token: adminToken, body: { nombre: 'Op', email: 'op1', password: 'Inicial123', rol: 'operador' },
  });
  const to = await login('op1', 'Inicial123');
  await api('POST', '/api/auth/cambiar-password', { token: to, body: { actual: 'Inicial123', nueva: 'Operador2026' } });
  operadorToken = to;

  maquina = (await api('POST', '/api/maquinas', {
    token: adminToken,
    body: { codigo: 'osm-01', nombre: 'Ósmosis', area: 'Ósmosis', poe: 'POE-080', tension: '380 V', corriente: '32 A' },
  })).datos;
});

after(() => {
  server?.close();
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('el administrador inicial debe cambiar su contraseña antes de usar la API', async () => {
  db.exec("INSERT INTO usuarios (nombre, email, password_hash, rol, debe_cambiar) SELECT 'Nuevo', 'nuevo', password_hash, 'operador', 1 FROM usuarios WHERE email = 'op1'");
  const t = await login('nuevo', 'Operador2026');
  const r = await api('GET', '/api/fallas', { token: t });
  assert.equal(r.status, 403);
  assert.equal(r.datos.codigo, 'DEBE_CAMBIAR_PASSWORD');
  assert.equal((await api('GET', '/api/auth/me', { token: t })).status, 200);
});

test('la exportación CSV exige sesión y neutraliza fórmulas', async () => {
  assert.equal((await api('GET', '/api/export/fallas.csv')).status, 401);
  await api('POST', '/api/fallas', { token: adminToken, body: { maquina_id: maquina.id, titulo: '=HYPERLINK("x")' } });
  const r = await api('GET', '/api/export/fallas.csv', { token: operadorToken });
  assert.equal(r.status, 200);
  assert.match(r.datos, /"'=HYPERLINK\(""x""\)"/);
});

test('el operador sólo consulta: no crea tipos, máquinas, fallas ni soluciones', async () => {
  assert.equal((await api('POST', '/api/tipos', { token: operadorToken, body: { nombre: 'X' } })).status, 403);
  assert.equal((await api('POST', '/api/maquinas', { token: operadorToken, body: { codigo: 'X', nombre: 'X' } })).status, 403);
  assert.equal((await api('POST', '/api/fallas', { token: operadorToken, body: { maquina_id: maquina.id, titulo: 'x' } })).status, 403);
  const lista = await api('GET', `/api/fallas?q=${encodeURIComponent('OSM-01')}`, { token: operadorToken });
  assert.equal(lista.status, 200);
  assert.ok(lista.datos.length > 0);
});

test('la ficha técnica se guarda y el código se normaliza', async () => {
  assert.equal(maquina.codigo, 'OSM-01');
  assert.equal(maquina.poe, 'POE-080');
  assert.equal(maquina.corriente, '32 A');
  const dup = await api('POST', '/api/maquinas', { token: adminToken, body: { codigo: 'OSM-01', nombre: 'otra' } });
  assert.equal(dup.status, 409);
});

test('JSON malformado y valores fuera de catálogo devuelven 400', async () => {
  assert.equal((await api('POST', '/api/auth/login', { crudo: '{mal' })).status, 400);
  const r = await api('POST', '/api/fallas', { token: adminToken, body: { maquina_id: maquina.id, titulo: 'x', severidad: 'Grave' } });
  assert.equal(r.status, 400);
  assert.match(r.datos.error, /severidad/);
});

test('una solución efectiva cierra la falla y la máquina; al desmarcarla se reabre', async () => {
  const falla = (await api('POST', '/api/fallas', {
    token: adminToken, body: { maquina_id: maquina.id, titulo: 'Membrana', severidad: 'Crítica' },
  })).datos;
  let m = (await api('GET', `/api/maquinas/${maquina.id}`, { token: adminToken })).datos;
  assert.equal(m.estado, 'En falla');

  const sol = (await api('POST', `/api/fallas/${falla.id}/soluciones`, {
    token: adminToken, body: { descripcion: 'Cambio de membrana', efectiva: true },
  })).datos;
  assert.equal((await api('GET', `/api/fallas/${falla.id}`, { token: adminToken })).datos.estado, 'Resuelta');
  m = (await api('GET', `/api/maquinas/${maquina.id}`, { token: adminToken })).datos;
  assert.equal(m.estado, 'Operativa');

  await api('PUT', `/api/soluciones/${sol.id}`, { token: adminToken, body: { efectiva: false } });
  assert.equal((await api('GET', `/api/fallas/${falla.id}`, { token: adminToken })).datos.estado, 'En proceso');
  m = (await api('GET', `/api/maquinas/${maquina.id}`, { token: adminToken })).datos;
  assert.equal(m.estado, 'En falla');
});

test('fotos: se suben, se descargan con sesión y se rechaza lo que no es imagen o PDF', async () => {
  const subida = await api('POST', '/api/adjuntos', {
    token: adminToken,
    body: { maquina_id: maquina.id, categoria: 'Eléctrica', nombre: 'tablero.png', datos: `data:image/png;base64,${PNG.toString('base64')}` },
  });
  assert.equal(subida.status, 201);
  assert.equal(subida.datos.mime, 'image/png');

  assert.equal((await api('GET', `/api/adjuntos/${subida.datos.id}/archivo`)).status, 401);
  const archivo = await fetch(`${base}/api/adjuntos/${subida.datos.id}/archivo`, { headers: { Authorization: `Bearer ${operadorToken}` } });
  assert.equal(archivo.status, 200);
  assert.equal(Buffer.from(await archivo.arrayBuffer()).length, PNG.length);

  const html = await api('POST', '/api/adjuntos', {
    token: adminToken, body: { maquina_id: maquina.id, datos: Buffer.from('<script>alert(1)</script>').toString('base64') },
  });
  assert.equal(html.status, 415);
  const operador = await api('POST', '/api/adjuntos', {
    token: operadorToken, body: { maquina_id: maquina.id, datos: PNG.toString('base64') },
  });
  assert.equal(operador.status, 403);
});

test('borrar una máquina exige confirmar su código', async () => {
  const m = (await api('POST', '/api/maquinas', { token: adminToken, body: { codigo: 'TMP-1', nombre: 'Temporal' } })).datos;
  assert.equal((await api('DELETE', `/api/maquinas/${m.id}`, { token: adminToken })).status, 400);
  assert.equal((await api('DELETE', `/api/maquinas/${m.id}?confirmar=tmp-1`, { token: adminToken })).status, 200);
});

test('un administrador no puede quitarse el rol ni desactivarse', async () => {
  const yo = (await api('GET', '/api/auth/me', { token: adminToken })).datos.usuario;
  const r = await api('PATCH', `/api/auth/usuarios/${yo.id}`, { token: adminToken, body: { activo: false } });
  assert.equal(r.status, 400);
});

test('restablecer la contraseña cierra las sesiones del usuario', async () => {
  const lista = (await api('GET', '/api/auth/usuarios', { token: adminToken })).datos;
  const op = lista.find((u) => u.email === 'op1');
  const r = await api('PATCH', `/api/auth/usuarios/${op.id}`, { token: adminToken, body: { password: 'corta' } });
  assert.equal(r.status, 400);
  await api('PATCH', `/api/auth/usuarios/${op.id}`, { token: adminToken, body: { password: 'Temporal2026' } });
  assert.equal((await api('GET', '/api/fallas', { token: operadorToken })).status, 401);
});

test('tras 5 intentos fallidos el acceso se bloquea temporalmente', async () => {
  const estados = [];
  for (let i = 0; i < 6; i += 1) {
    estados.push((await api('POST', '/api/auth/login', { body: { email: 'admin', password: 'mala' } })).status);
  }
  assert.deepEqual(estados, [401, 401, 401, 401, 401, 429]);
});
