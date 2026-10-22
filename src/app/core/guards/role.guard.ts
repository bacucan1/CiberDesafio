import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { RolUsuario } from '../models/domain.models';
import { AuthService } from '../services/auth.service';

/**
 * Protege rutas por rol usando el perfil guardado en Firestore, nunca localStorage.
 * Ojo: un guard solo mejora la experiencia (no muestra pantallas que no corresponden);
 * la seguridad real la imponen las reglas de Firestore y la API.
 */
export const roleGuard: CanActivateFn = async (route) => {
  const router = inject(Router);
  const auth = inject(AuthService);
  const rolRequerido = route.data['rol'] as RolUsuario | undefined;
  try {
    if (!(await auth.esperarSesion())) return router.createUrlTree(['/login']);
    const rol = await auth.rolActual();
    if (!rol) return router.createUrlTree(['/login']);
    if (!rolRequerido || rol === rolRequerido) return true;
    return router.createUrlTree([rol === 'docente' ? '/docente' : '/home']);
  } catch {
    return router.createUrlTree(['/login']);
  }
};
