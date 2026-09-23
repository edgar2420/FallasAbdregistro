import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { Api } from './api';
import { TableroPage } from './paginas/tablero';
import { FallasPage } from './paginas/fallas';
import { MaquinariaPage } from './paginas/maquinaria';
import { MaquinaDetallePage } from './paginas/maquina-detalle';
import { UsuariosPage } from './paginas/usuarios';
import { CuentaPage } from './paginas/cuenta';

/** La API ya protege las rutas de administración; esto evita mostrar una pantalla vacía. */
const soloAdmin = () => inject(Api).esAdmin() || inject(Router).parseUrl('/');

export const routes: Routes = [
  { path: '', component: TableroPage, title: 'Tablero · Control de Fallas' },
  { path: 'fallas', component: FallasPage, title: 'Fallas técnicas · Control de Fallas' },
  { path: 'maquinaria', component: MaquinariaPage, title: 'Maquinaria · Control de Fallas' },
  { path: 'maquinaria/:id', component: MaquinaDetallePage, title: 'Ficha de máquina · Control de Fallas' },
  // Las soluciones se consultan dentro de cada máquina.
  { path: 'soluciones', redirectTo: 'maquinaria' },
  { path: 'usuarios', component: UsuariosPage, canActivate: [soloAdmin], title: 'Usuarios · Control de Fallas' },
  { path: 'cuenta', component: CuentaPage, title: 'Mi cuenta · Control de Fallas' },
  { path: '**', redirectTo: '' },
];
