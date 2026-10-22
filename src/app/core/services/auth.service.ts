import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { browserLocalPersistence, createUserWithEmailAndPassword, deleteUser, getAdditionalUserInfo, getAuth, getRedirectResult, GoogleAuthProvider, onAuthStateChanged, setPersistence, signInWithEmailAndPassword, signInWithPopup, signInWithRedirect, signOut, updateProfile, User } from 'firebase/auth';
import { doc, getDoc, getFirestore, setDoc } from 'firebase/firestore';
import { firebaseApp } from '../firebase.config';
import { RolUsuario, Usuario } from '../models/domain.models';

/** El codigo de invitacion docente no tiene el formato esperado o fue rechazado por las reglas de Firestore. */
export class CodigoDocenteInvalidoError extends Error {
  constructor() {
    super('Codigo de invitacion docente invalido');
    this.name = 'CodigoDocenteInvalidoError';
  }
}

// Mismo formato que valida firestore.rules: <institucion>-<secreto>
export const FORMATO_CODIGO_DOCENTE = /^[a-z0-9]{2,30}-[A-Za-z0-9]{6,32}$/;

// Solo guarda lo que el usuario PIDIO al registrarse con Google (flujo con redireccion en movil).
// No concede privilegios: el rol real lo deciden las reglas de Firestore al crear el perfil.
const CLAVE_REGISTRO_GOOGLE = 'ciberdesafio-registro-google';
const CLAVE_ERROR_ACCESO = 'ciberdesafio-error-acceso';

interface SolicitudRegistro { rol: RolUsuario; codigoInvitacion?: string; }

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly router = inject(Router);
  private readonly auth = getAuth(firebaseApp);
  private readonly firestore = getFirestore(firebaseApp);
  // Cache solo en memoria: no se guarda el rol en localStorage porque el usuario podria editarlo.
  private perfilEnMemoria: Usuario | null = null;

  constructor() {
    void setPersistence(this.auth, browserLocalPersistence);
    onAuthStateChanged(this.auth, (usuario) => {
      if (this.perfilEnMemoria && this.perfilEnMemoria.uid !== usuario?.uid) this.perfilEnMemoria = null;
    });
    void this.completarRedireccionGoogle();
  }

  usuarioActual(): User | null {
    return this.auth.currentUser;
  }

  esperarSesion(): Promise<User | null> {
    return this.auth.authStateReady().then(() => this.auth.currentUser);
  }

  /** Perfil guardado en Firestore (fuente de verdad del rol). Devuelve null si no hay sesion o no hay perfil. */
  async obtenerPerfil(forzar = false): Promise<Usuario | null> {
    const usuario = await this.esperarSesion();
    if (!usuario) { this.perfilEnMemoria = null; return null; }
    if (!forzar && this.perfilEnMemoria?.uid === usuario.uid) return this.perfilEnMemoria;
    const captura = await getDoc(doc(this.firestore, 'usuarios', usuario.uid));
    this.perfilEnMemoria = captura.exists() ? (captura.data() as Usuario) : null;
    return this.perfilEnMemoria;
  }

  async rolActual(): Promise<RolUsuario | null> {
    return (await this.obtenerPerfil())?.rol ?? null;
  }

  /** Mensaje pendiente de un registro con Google por redireccion; se muestra una sola vez en el login. */
  consumirErrorAcceso(): string {
    const mensaje = sessionStorage.getItem(CLAVE_ERROR_ACCESO) ?? '';
    sessionStorage.removeItem(CLAVE_ERROR_ACCESO);
    return mensaje;
  }

  async ingresar(correo: string, clave: string): Promise<void> {
    const credencial = await signInWithEmailAndPassword(this.auth, correo, clave);
    try {
      // Cuentas antiguas sin perfil: se crean como estudiante. Nadie puede elegir ser docente al ingresar.
      const perfil = await this.asegurarPerfil(credencial.user, { rol: 'estudiante' }, credencial.user.displayName ?? 'Usuario CiberDesafio');
      await this.irAlInicio(perfil.rol);
    } catch (error) {
      await signOut(this.auth);
      throw error;
    }
  }

  async registrar(nombre: string, correo: string, clave: string, rol: RolUsuario, codigoInvitacion?: string): Promise<void> {
    this.validarSolicitud({ rol, codigoInvitacion });
    const credencial = await createUserWithEmailAndPassword(this.auth, correo, clave);
    try {
      await updateProfile(credencial.user, { displayName: nombre });
      const perfil = await this.asegurarPerfil(credencial.user, { rol, codigoInvitacion }, nombre);
      await this.irAlInicio(perfil.rol);
    } catch (error) {
      // No dejamos cuentas de Auth sin perfil (por ejemplo, con un codigo docente invalido).
      await deleteUser(credencial.user).catch(() => signOut(this.auth));
      throw error;
    }
  }

  async registrarseConGoogle(rol: RolUsuario, codigoInvitacion?: string): Promise<void> {
    const solicitud: SolicitudRegistro = { rol, codigoInvitacion };
    this.validarSolicitud(solicitud);
    if (Capacitor.isNativePlatform()) {
      sessionStorage.setItem(CLAVE_REGISTRO_GOOGLE, JSON.stringify(solicitud));
      await signInWithRedirect(this.auth, new GoogleAuthProvider());
      return;
    }
    const credencial = await signInWithPopup(this.auth, new GoogleAuthProvider());
    await this.terminarAccesoGoogle(credencial, solicitud);
  }

  async salir(): Promise<void> {
    this.perfilEnMemoria = null;
    await signOut(this.auth);
    await this.router.navigateByUrl('/login');
  }

  private validarSolicitud(solicitud: SolicitudRegistro): void {
    if (solicitud.rol === 'docente' && !FORMATO_CODIGO_DOCENTE.test(solicitud.codigoInvitacion ?? '')) {
      throw new CodigoDocenteInvalidoError();
    }
  }

  private irAlInicio(rol: RolUsuario): Promise<boolean> {
    return this.router.navigateByUrl(rol === 'docente' ? '/docente' : '/home');
  }

  /**
   * Devuelve el perfil existente SIN modificarlo (el rol pedido en pantalla se ignora si ya hay perfil).
   * Si no existe, lo crea; las reglas de Firestore deciden si el rol solicitado es valido.
   */
  private async asegurarPerfil(usuario: User, solicitud: SolicitudRegistro, nombre: string): Promise<Usuario> {
    const existente = await this.obtenerPerfil(true);
    if (existente) return existente;

    const base = { uid: usuario.uid, nombre, fechaActualizacion: new Date().toISOString() };
    const nuevo: Record<string, unknown> = solicitud.rol === 'docente' && solicitud.codigoInvitacion
      ? { ...base, rol: 'docente', institucion: solicitud.codigoInvitacion.split('-')[0], codigoInvitacion: solicitud.codigoInvitacion }
      : { ...base, rol: 'estudiante', institucion: '' };
    try {
      await setDoc(doc(this.firestore, 'usuarios', usuario.uid), nuevo);
    } catch (error) {
      if (solicitud.rol === 'docente' && (error as { code?: string }).code === 'permission-denied') throw new CodigoDocenteInvalidoError();
      throw error;
    }
    return (await this.obtenerPerfil(true)) as Usuario;
  }

  private async terminarAccesoGoogle(credencial: Awaited<ReturnType<typeof signInWithPopup>>, solicitud: SolicitudRegistro): Promise<void> {
    const esNueva = getAdditionalUserInfo(credencial)?.isNewUser ?? false;
    try {
      const perfil = await this.asegurarPerfil(credencial.user, solicitud, credencial.user.displayName ?? 'Usuario CiberDesafio');
      await this.irAlInicio(perfil.rol);
    } catch (error) {
      if (esNueva) await deleteUser(credencial.user).catch(() => signOut(this.auth));
      else await signOut(this.auth);
      throw error;
    }
  }

  private async completarRedireccionGoogle(): Promise<void> {
    try {
      const credencial = await getRedirectResult(this.auth);
      if (!credencial) return;
      const guardado = sessionStorage.getItem(CLAVE_REGISTRO_GOOGLE);
      sessionStorage.removeItem(CLAVE_REGISTRO_GOOGLE);
      let solicitud: SolicitudRegistro = { rol: 'estudiante' };
      try { if (guardado) solicitud = JSON.parse(guardado) as SolicitudRegistro; } catch { /* se usa estudiante */ }
      await this.terminarAccesoGoogle(credencial, solicitud);
    } catch (error) {
      sessionStorage.setItem(CLAVE_ERROR_ACCESO, error instanceof CodigoDocenteInvalidoError
        ? 'El código de invitación no es válido o ya no está activo.'
        : 'No pudimos completar el registro con Google. Intenta nuevamente.');
      await this.router.navigateByUrl('/login');
    }
  }
}
