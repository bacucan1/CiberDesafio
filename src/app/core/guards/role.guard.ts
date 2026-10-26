import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { RolUsuario } from '../models/domain.models';
import { AuthService } from '../services/auth.service';

export const roleGuard: CanActivateFn = async (route) => {
  const router = inject(Router);
  const auth = inject(AuthService);
  const rol = route.data['rol'] as RolUsuario | undefined;
  const usuario = await auth.esperarSesion();
  if (!usuario) {
    return router.createUrlTree(['/login']);
  }
  const rolUsuario = await auth.obtenerRol(usuario);
  if (!rolUsuario || (rol && rolUsuario !== rol)) {
    return router.createUrlTree(['/login']);
  }
  return true;
};