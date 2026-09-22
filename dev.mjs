/** Levanta la API y el servidor de desarrollo de Angular en un solo comando: npm run dev */
import { spawn } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const lanzar = (nombre, args) => {
  const hijo = spawn(npm, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  hijo.on('exit', (codigo) => {
    console.log(`[${nombre}] terminó con código ${codigo}`);
    process.exit(codigo ?? 0);
  });
  return hijo;
};

const procesos = [
  lanzar('api', ['--prefix', 'backend', 'run', 'dev']),
  lanzar('web', ['--prefix', 'frontend-angular', 'run', 'start']),
];

console.log('\n  API   → http://localhost:4010');
console.log('  Web   → http://localhost:4200\n');

const cerrar = () => procesos.forEach((p) => p.kill());
process.on('SIGINT', () => { cerrar(); process.exit(0); });
process.on('SIGTERM', cerrar);
