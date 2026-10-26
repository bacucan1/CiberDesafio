import { Component } from '@angular/core';
import { Router, provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../services/auth.service';
import { roleGuard } from './role.guard';

@Component({ standalone: true, template: '' })
class TestPage {}

describe('roleGuard', () => {
  const usuario = { uid: 'usuario-1' };
  let router: Router;
  let perfilRol: 'estudiante' | 'docente';

  beforeEach(() => {
    const values = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        clear: () => values.clear(),
        setItem: (key: string, value: string) => values.set(key, value),
        getItem: (key: string) => values.get(key) ?? null,
      },
    });
    perfilRol = 'estudiante';
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'login', component: TestPage },
          { path: 'perfil', component: TestPage, canActivate: [roleGuard] },
          { path: 'home', component: TestPage, canActivate: [roleGuard], data: { rol: 'estudiante' } },
          { path: 'docente', component: TestPage, canActivate: [roleGuard], data: { rol: 'docente' } },
        ]),
        {
          provide: AuthService,
          useValue: {
            esperarSesion: async () => usuario,
            obtenerRol: async () => perfilRol,
          },
        },
      ],
    });
    router = TestBed.inject(Router);
  });

  it('does not grant teacher access when local storage claims the teacher role', async () => {
    globalThis.localStorage.setItem('ciberdesafio-rol', 'docente');

    await router.navigateByUrl('/docente');

    expect(router.url).toBe('/login');
  });

  it('allows a student to access the student route only', async () => {
    await router.navigateByUrl('/perfil');
    expect(router.url).toBe('/perfil');

    await router.navigateByUrl('/home');
    expect(router.url).toBe('/home');

    await router.navigateByUrl('/docente');
    expect(router.url).toBe('/login');
  });

  it('allows a teacher profile to access the teacher route', async () => {
    perfilRol = 'docente';

    await router.navigateByUrl('/perfil');
    expect(router.url).toBe('/perfil');

    await router.navigateByUrl('/docente');
    expect(router.url).toBe('/docente');

    await router.navigateByUrl('/home');
    expect(router.url).toBe('/login');
  });
});
