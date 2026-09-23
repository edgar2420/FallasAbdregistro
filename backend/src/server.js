import { app } from './app.js';
import { asegurarAdmin, limpiar } from './auth.js';

const PORT = Number(process.env.PORT) || 4010;
const HOST = process.env.HOST || '0.0.0.0';

asegurarAdmin();
limpiar();
setInterval(limpiar, 6 * 60 * 60 * 1000).unref();

app.listen(PORT, HOST, () => {
  console.log(`API Control de Fallas escuchando en http://localhost:${PORT}`);
});
