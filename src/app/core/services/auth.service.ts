import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { browserLocalPersistence, createUserWithEmailAndPassword, getAuth, getRedirectResult, GoogleAuthProvider, setPersistence, signInWithEmailAndPassword, signInWithPopup, signInWithRedirect, signOut, updateProfile, User } from 'firebase/auth';
import { doc, getFirestore, setDoc } from 'firebase/firestore';
import { firebaseApp } from '../firebase.config';
import { RolUsuario } from '../models/domain.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly router = inject(Router);
  private readonly auth = getAuth(firebaseApp);
  private readonly firestore = getFirestore(firebaseApp);

  constructor() {
    void setPersistence(this.auth, browserLocalPersistence);
    void this.completarRedireccionGoogle();
  }

  usuarioActual(): User | null {
    return this.auth.currentUser;
  }

  esperarSesion(): Promise<User | null> {
    return this.auth.authStateReady().then(() => this.auth.currentUser);
  }

  async ingresar(correo: string, clave: string, rol: RolUsuario): Promise<void> {
    await signInWithEmailAndPassword(this.auth, correo, clave);
    localStorage.setItem('ciberdesafio-rol', rol);
    await this.irAlInicio(rol);
  }

  async registrar(nombre: string, correo: string, clave: string, rol: RolUsuario): Promise<void> {
    const credencial = await createUserWithEmailAndPassword(this.auth, correo, clave);
    await updateProfile(credencial.user, { displayName: nombre });
    localStorage.setItem('ciberdesafio-rol', rol);
    void this.guardarPerfil(credencial.user, rol, nombre).catch(() => undefined);
    await this.irAlInicio(rol);
  }

  async registrarseConGoogle(rol: RolUsuario): Promise<void> {
    sessionStorage.setItem('ciberdesafio-google-rol', rol);
    if (Capacitor.isNativePlatform()) {
      await signInWithRedirect(this.auth, new GoogleAuthProvider());
      return;
    }
    const credencial = await signInWithPopup(this.auth, new GoogleAuthProvider());
    const nombre = credencial.user.displayName ?? 'Usuario CiberDesafio';
    localStorage.setItem('ciberdesafio-rol', rol);
    void this.guardarPerfil(credencial.user, rol, nombre).catch(() => undefined);
    await this.irAlInicio(rol);
  }

  async salir(): Promise<void> {
    await signOut(this.auth);
    await this.router.navigateByUrl('/login');
  }

  private irAlInicio(rol: RolUsuario): Promise<boolean> {
    return this.router.navigateByUrl(rol === 'docente' ? '/docente' : '/home');
  }

  private guardarPerfil(usuario: User, rol: RolUsuario, nombre: string): Promise<void> {
    return setDoc(doc(this.firestore, 'usuarios', usuario.uid), {
      uid: usuario.uid,
      nombre,
      rol,
      institucion: '',
      fechaActualizacion: new Date().toISOString(),
    }, { merge: true });
  }

  private async completarRedireccionGoogle(): Promise<void> {
    const credencial = await getRedirectResult(this.auth);
    if (!credencial) return;
    const rol = (sessionStorage.getItem('ciberdesafio-google-rol') ?? 'estudiante') as RolUsuario;
    const nombre = credencial.user.displayName ?? 'Usuario CiberDesafio';
    localStorage.setItem('ciberdesafio-rol', rol);
    sessionStorage.removeItem('ciberdesafio-google-rol');
    await this.guardarPerfil(credencial.user, rol, nombre).catch(() => undefined);
    await this.irAlInicio(rol);
  }
}