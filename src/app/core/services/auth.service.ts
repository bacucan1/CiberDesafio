import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { browserLocalPersistence, createUserWithEmailAndPassword, getAuth, getRedirectResult, GoogleAuthProvider, sendPasswordResetEmail, setPersistence, signInWithEmailAndPassword, signInWithPopup, signInWithRedirect, signOut, updateProfile, User } from 'firebase/auth';
import { DocumentData, doc, getDoc, getFirestore, setDoc, updateDoc } from 'firebase/firestore';
import { firebaseApp } from '../firebase.config';
import { RolUsuario, Usuario } from '../models/domain.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly router = inject(Router);
  private readonly auth = getAuth(firebaseApp);
  private readonly firestore = getFirestore(firebaseApp);
  private cachePerfiles = new Map<string, { rol: RolUsuario | null; perfil: Usuario | null }>();

  constructor() {
    void setPersistence(this.auth, browserLocalPersistence);
    void this.completarRedireccionGoogle();
  }

  invalidarCache(): void {
    this.cachePerfiles.clear();
  }

  usuarioActual(): User | null {
    return this.auth.currentUser;
  }

  esperarSesion(): Promise<User | null> {
    return this.auth.authStateReady().then(() => this.auth.currentUser);
  }

  async ingresar(correo: string, clave: string): Promise<void> {
    const credencial = await signInWithEmailAndPassword(this.auth, correo, clave);
    await this.entrarConPerfil(credencial.user);
  }

  async registrar(nombre: string, correo: string, clave: string, institucionSolicitada?: string): Promise<void> {
    const credencial = await createUserWithEmailAndPassword(this.auth, correo, clave);
    await updateProfile(credencial.user, { displayName: nombre });
    await this.guardarPerfilEstudiante(credencial.user, nombre);
    if (institucionSolicitada?.trim()) {
      await this.solicitarAccesoDocente(credencial.user, institucionSolicitada.trim());
      await this.router.navigateByUrl('/perfil');
      return;
    }
    await this.irAlInicio('estudiante');
  }

  async recuperarClave(correo: string): Promise<void> {
    await sendPasswordResetEmail(this.auth, correo.trim());
  }

  async solicitarAccesoDocente(usuario: User, institucion: string): Promise<void> {
    const nombreInstitucion = institucion.trim();
    if (nombreInstitucion.length < 3 || nombreInstitucion.length > 120) {
      throw new Error('La institución debe tener entre 3 y 120 caracteres.');
    }
    await setDoc(doc(this.firestore, 'solicitudes_docente', usuario.uid), {
      uid: usuario.uid,
      correo: usuario.email ?? '',
      nombre: usuario.displayName ?? '',
      institucionSolicitada: nombreInstitucion,
      estado: 'pendiente',
      fechaSolicitud: new Date().toISOString(),
    });
  }

  async ingresarConGoogle(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      await signInWithRedirect(this.auth, new GoogleAuthProvider());
      return;
    }
    const credencial = await signInWithPopup(this.auth, new GoogleAuthProvider());
    const nombre = credencial.user.displayName ?? 'Usuario CiberDesafio';
    await this.entrarConPerfil(credencial.user, nombre);
  }

  async salir(): Promise<void> {
    await signOut(this.auth);
    this.invalidarCache();
    await this.router.navigateByUrl('/login');
  }

  private irAlInicio(rol: RolUsuario): Promise<boolean> {
    return this.router.navigateByUrl(rol === 'docente' ? '/docente' : '/home');
  }

  async obtenerRol(usuario: User): Promise<RolUsuario | null> {
    const cache = this.cachePerfiles.get(usuario.uid);
    if (cache) return cache.rol;
    const perfil = await getDoc(doc(this.firestore, 'usuarios', usuario.uid));
    const datos = perfil.data() ?? {};
    const rol = perfil.exists() ? this.extraerRol(datos) : null;
    const perfilConstruido = perfil.exists() ? this.construirPerfil(usuario.uid, datos) : null;
    const entrada = { rol, perfil: perfilConstruido };
    this.cachePerfiles.set(usuario.uid, entrada);
    return rol;
  }

  async obtenerPerfil(usuario: User): Promise<Usuario | null> {
    const cache = this.cachePerfiles.get(usuario.uid);
    if (cache) return cache.perfil;
    const perfil = await getDoc(doc(this.firestore, 'usuarios', usuario.uid));
    const datos = perfil.data() ?? {};
    const perfilConstruido = perfil.exists() ? this.construirPerfil(usuario.uid, datos) : null;
    this.cachePerfiles.set(usuario.uid, { rol: perfil.exists() ? this.extraerRol(datos) : null, perfil: perfilConstruido });
    return perfilConstruido;
  }

  private extraerRol(datos: DocumentData): RolUsuario | null {
    const rol = datos['rol'];
    return rol === 'estudiante' || rol === 'docente' ? rol : null;
  }

  private construirPerfil(uid: string, datos: DocumentData): Usuario | null {
    if (datos['uid'] !== uid || typeof datos['nombre'] !== 'string') return null;
    const rol = this.extraerRol(datos);
    if (!rol || typeof datos['institucion'] !== 'string') return null;
    return {
      uid,
      nombre: datos['nombre'],
      rol,
      institucion: datos['institucion'],
      ...(typeof datos['grado'] === 'number' ? { grado: datos['grado'] } : {}),
      ...(typeof datos['grupo'] === 'string' ? { grupo: datos['grupo'] } : {}),
      ...(typeof datos['grupoId'] === 'string' ? { grupoId: datos['grupoId'] } : {}),
      ...(typeof datos['fechaActualizacion'] === 'string' ? { fechaActualizacion: datos['fechaActualizacion'] } : {}),
    };
  }

  async actualizarNombre(usuario: User, nombre: string): Promise<void> {
    const nombreLimpio = nombre.trim();
    if (!nombreLimpio) throw new Error('El nombre no puede estar vacío.');
    await updateDoc(doc(this.firestore, 'usuarios', usuario.uid), {
      nombre: nombreLimpio,
      fechaActualizacion: new Date().toISOString(),
    });
    await updateProfile(usuario, { displayName: nombreLimpio });
    this.invalidarCache();
  }

  private async guardarPerfilEstudiante(usuario: User, nombre: string): Promise<void> {
    await setDoc(doc(this.firestore, 'usuarios', usuario.uid), {
      uid: usuario.uid,
      nombre,
      rol: 'estudiante',
      institucion: '',
      fechaActualizacion: new Date().toISOString(),
    });
    this.invalidarCache();
  }

  private async entrarConPerfil(usuario: User, nombre = usuario.displayName ?? 'Usuario CiberDesafio'): Promise<void> {
    let rol = await this.obtenerRol(usuario);
    if (!rol) {
      await this.guardarPerfilEstudiante(usuario, nombre);
      rol = await this.obtenerRol(usuario);
    }
    if (!rol) {
      await signOut(this.auth);
      throw new Error('No existe un perfil autorizado para esta cuenta.');
    }
    await this.irAlInicio(rol);
  }

  private async completarRedireccionGoogle(): Promise<void> {
    const credencial = await getRedirectResult(this.auth);
    if (!credencial) return;
    const nombre = credencial.user.displayName ?? 'Usuario CiberDesafio';
    await this.entrarConPerfil(credencial.user, nombre);
  }
}