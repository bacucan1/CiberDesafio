import { Routes } from '@angular/router';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  {
    path: 'inicio',
    loadComponent: () => import('./welcome/welcome.page').then((m) => m.WelcomePage),
  },
  {
    path: 'login',
    loadComponent: () => import('./login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'perfil',
    canActivate: [roleGuard],
    loadComponent: () => import('./profile/profile.page').then((m) => m.ProfilePage),
  },
  {
    path: 'docente',
    canActivate: [roleGuard],
    data: { rol: 'docente' },
    loadComponent: () => import('./teacher/teacher.page').then((m) => m.TeacherPage),
  },
  {
    path: 'home',
    canActivate: [roleGuard],
    data: { rol: 'estudiante' },
    loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
  },
  {
    path: '',
    redirectTo: 'inicio',
    pathMatch: 'full',
  },
];
