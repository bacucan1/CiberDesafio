import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { createUserWithEmailAndPassword, getAuth, GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup, signOut, updateProfile, User } from 'firebase/auth';
import { doc, getFirestore, setDoc } from 'firebase/firestore';
import { firebaseApp } from '../firebase.config';
import { RolUsuario } from '../models/domain.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly router = inject(Router);
  private readonly auth = getAuth(firebaseApp);
  private readonly firestore = getFirestore(firebaseApp);

  usuarioActual(): User | null {
    return this.auth.currentUser;
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
}