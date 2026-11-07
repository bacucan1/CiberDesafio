import '@angular/compiler';
import { Injector, runInInjectionContext } from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RolUsuario } from '../models/domain.models';

// El guard solo depende de AuthService y Router: se simulan para no tocar Firebase.
vi.mock('../services/auth.service', () => ({ AuthService: class AuthService {} }));
import { AuthService } from '../services/auth.service';
import { roleGuard } from './role.guard';

interface Escenario { sesion: boolean; rol: RolUsuario | null; falla?: boolean; }

function ejecutar(rolRequerido: RolUsuario, e: Escenario): Promise<boolean | UrlTree | unknown> {
  const router = { createUrlTree: (comandos: string[]) => ({ comandos }) };
  const auth = {
    esperarSesion: async () => (e.sesion ? { uid: 'u1' } : null),
    rolActual: async () => { if (e.falla) throw new Error('sin permisos'); return e.rol; },
  };
  const injector = Injector.create({ providers: [{ provide: Router, useValue: router }, { provide: AuthService, useValue: auth }] });
  const ruta = { data: { rol: rolRequerido } } as unknown as ActivatedRouteSnapshot;
  return runInInjectionContext(injector, () => roleGuard(ruta, {} as RouterStateSnapshot)) as Promise<unknown>;
}

describe('roleGuard', () => {
  beforeEach(() => localStorage.clear());

  it('sin sesion manda al login', async () => {
    expect(await ejecutar('estudiante', { sesion: false, rol: null })).toEqual({ comandos: ['/login'] });
  });
  it('con sesion pero sin perfil manda al login', async () => {
    expect(await ejecutar('estudiante', { sesion: true, rol: null })).toEqual({ comandos: ['/login'] });
  });
  it('el estudiante entra a /home', async () => {
    expect(await ejecutar('estudiante', { sesion: true, rol: 'estudiante' })).toBe(true);
  });
  it('el docente entra a /docente', async () => {
    expect(await ejecutar('docente', { sesion: true, rol: 'docente' })).toBe(true);
  });
  it('el estudiante NO entra a /docente: se le devuelve a /home', async () => {
    expect(await ejecutar('docente', { sesion: true, rol: 'estudiante' })).toEqual({ comandos: ['/home'] });
  });
  it('el docente NO entra a /home: se le devuelve a /docente', async () => {
    expect(await ejecutar('estudiante', { sesion: true, rol: 'docente' })).toEqual({ comandos: ['/docente'] });
  });
  it('editar localStorage no da acceso de docente', async () => {
    localStorage.setItem('ciberdesafio-rol', 'docente');
    sessionStorage.setItem('ciberdesafio-google-rol', 'docente');
    expect(await ejecutar('docente', { sesion: true, rol: 'estudiante' })).toEqual({ comandos: ['/home'] });
  });
  it('si falla la lectura del perfil, no deja pasar', async () => {
    expect(await ejecutar('docente', { sesion: true, rol: 'docente', falla: true })).toEqual({ comandos: ['/login'] });
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
