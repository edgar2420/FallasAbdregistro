import { app } from './app.js';
import { db } from './db.js';
import { asegurarAdmin, limpiar } from './auth.js';
import { horasDesdeUltimo, respaldar } from './respaldo.js';

const PORT = Number(process.env.PORT) || 4010;
const HOST = process.env.HOST || '0.0.0.0';
const RESPALDO_HORAS = Number(process.env.RESPALDO_HORAS) || 0;

asegurarAdmin();
limpiar();
setInterval(limpiar, 6 * 60 * 60 * 1000).unref();

/* Respaldo automático opcional (RESPALDO_HORAS=24): uno al iniciar si el último es viejo y luego periódico. */
const respaldoSeguro = () => {
  try {
    console.log(`Respaldo automático creado en ${respaldar()}`);
  } catch (e) {
    console.error('No se pudo crear el respaldo automático:', e);
  }
};
if (RESPALDO_HORAS > 0) {
  if (horasDesdeUltimo() >= RESPALDO_HORAS) respaldoSeguro();
  setInterval(respaldoSeguro, RESPALDO_HORAS * 3_600_000).unref();
}

const server = app.listen(PORT, HOST, () => {
  console.log(`API Control de Fallas escuchando en http://localhost:${PORT}`);
});

// Límites de tiempo: una conexión lenta o colgada no puede retener el servidor.
server.requestTimeout = 120_000;
server.headersTimeout = 30_000;
server.keepAliveTimeout = 65_000;

/* Apagado ordenado: termina las peticiones en curso y cierra la base sin corromperla. */
let cerrando = false;
const apagar = (motivo, codigo = 0) => {
  if (cerrando) return;
  cerrando = true;
  console.log(`${motivo}: cerrando el servidor…`);
  server.close(() => {
    try {
      db.close();
    } finally {
      process.exit(codigo);
    }
  });
  setTimeout(() => process.exit(codigo || 1), 10_000).unref();
};

process.on('SIGTERM', () => apagar('SIGTERM'));
process.on('SIGINT', () => apagar('SIGINT'));
process.on('unhandledRejection', (e) => console.error('Promesa rechazada sin manejar:', e));
// Un error imprevisto deja el proceso en estado dudoso: se registra y se reinicia (Docker/systemd lo levantan).
process.on('uncaughtException', (e) => {
  console.error('Error no controlado:', e);
  apagar('uncaughtException', 1);
});
