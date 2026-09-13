import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const roleGuard: CanActivateFn = async (route) => {
  const router = inject(Router);
  const auth = inject(AuthService);
  const rol = route.data['rol'] as string | undefined;
  const rolGuardado = localStorage.getItem('ciberdesafio-rol');
  const usuario = await auth.esperarSesion();
  return usuario && rol === rolGuardado ? true : router.createUrlTree(['/login']);
};