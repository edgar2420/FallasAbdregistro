import { Routes } from '@angular/router';
import { DashboardPage, FailuresPage, MachinesPage, SolutionsPage, UsersPage } from './pages';

export const routes: Routes = [
  { path: '', component: DashboardPage, title: 'Tablero · Control de Fallas' },
  { path: 'fallas', component: FailuresPage, title: 'Fallas técnicas · Control de Fallas' },
  { path: 'maquinaria', component: MachinesPage, title: 'Maquinaria · Control de Fallas' },
  { path: 'soluciones', component: SolutionsPage, title: 'Soluciones · Control de Fallas' },
  { path: 'usuarios', component: UsersPage, title: 'Usuarios · Control de Fallas' },
  { path: '**', redirectTo: '' },
];
