import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const roleGuard: CanActivateFn = (route) => {
  const router = inject(Router);
  const rol = route.data['rol'] as string | undefined;
  const rolGuardado = localStorage.getItem('ciberdesafio-rol');
  return rol === rolGuardado ? true : router.createUrlTree(['/login']);
};