import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { browserLocalPersistence, createUserWithEmailAndPassword, deleteUser, getAdditionalUserInfo, getAuth, getRedirectResult, GoogleAuthProvider, inMemoryPersistence, onAuthStateChanged, sendPasswordResetEmail, setPersistence, signInWithEmailAndPassword, signInWithPopup, signInWithRedirect, signOut, updateProfile, User, UserCredential } from 'firebase/auth';
import { doc, getDoc, getFirestore, runTransaction, updateDoc } from 'firebase/firestore';
import { firebaseApp } from '../firebase.config';
import { RolUsuario, Usuario } from '../models/domain.models';

/** El codigo docente no existe, vencio, fue revocado o no corresponde a la institucion indicada. */
export class CodigoDocenteInvalidoError extends Error {
  constructor() {
    super('Codigo de invitacion docente invalido');
    this.name = 'CodigoDocenteInvalidoError';
  }
}

// Los codigos se crean administrativamente; el documento vincula el codigo con su institucion aprobada.
export const FORMATO_CODIGO_DOCENTE = /^[A-Za-z0-9-]{8,90}$/;

// Solo guarda lo que el usuario PIDIO al registrarse con Google durante la redireccion.
// No concede privilegios: el rol real lo deciden las reglas de Firestore al crear el perfil.
const CLAVE_REGISTRO_GOOGLE = 'ciberdesafio-registro-google';
const CLAVE_ERROR_ACCESO = 'ciberdesafio-error-acceso';

interface SolicitudRegistro { rol: RolUsuario; codigoInvitacion?: string; institucion?: string; }

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly router = inject(Router);
  private readonly auth = getAuth(firebaseApp);
  private readonly firestore = getFirestore(firebaseApp);
  private readonly persistenceReady: Promise<void>;
  // Cache solo en memoria: no se guarda el rol en localStorage porque el usuario podria editarlo.
  private perfilEnMemoria: Usuario | null = null;
  private perfilEnCarga: { uid: string; promise: Promise<Usuario | null> } | null = null;
  private perfilRevision = 0;
  constructor() {
    this.persistenceReady = setPersistence(this.auth, browserLocalPersistence).catch((error: unknown) => {
      if (!this.esErrorPersistenciaNoDisponible(error)) throw error;
      console.warn('El navegador bloqueó la persistencia local; la sesión se mantendrá solo en esta pestaña.', error);
      return setPersistence(this.auth, inMemoryPersistence);
    });
    onAuthStateChanged(this.auth, (usuario) => {
      if (this.perfilEnMemoria && this.perfilEnMemoria.uid !== usuario?.uid) this.invalidarCache();
    });
    void this.completarRedireccionGoogle();
  }

  invalidarCache(): void {
    this.perfilRevision += 1;
    this.perfilEnMemoria = null;
    this.perfilEnCarga = null;
  }

  usuarioActual(): User | null {
    return this.auth.currentUser;
  }

  esperarSesion(): Promise<User | null> {
    return this.persistenceReady
      .then(() => this.auth.authStateReady())
      .then(() => this.auth.currentUser);
  }

  /** Perfil guardado en Firestore (fuente de verdad del rol). Devuelve null si no hay sesion o no hay perfil. */
  async obtenerPerfil(forzar = false): Promise<Usuario | null> {
    const usuario = await this.esperarSesion();
    if (!usuario) { this.perfilEnMemoria = null; return null; }
    if (!forzar && this.perfilEnMemoria?.uid === usuario.uid) return this.perfilEnMemoria;
    if (this.perfilEnCarga?.uid === usuario.uid) return this.perfilEnCarga.promise;
    if (this.auth.currentUser?.uid !== usuario.uid) return null;

    const revision = this.perfilRevision;
    const consulta = getDoc(doc(this.firestore, 'usuarios', usuario.uid)).then((captura) => {
      const perfil = captura.exists() ? (captura.data() as Usuario) : null;
      if (this.auth.currentUser?.uid === usuario.uid && this.perfilRevision === revision) {
        this.perfilEnMemoria = perfil;
      }
      return perfil;
    });
    this.perfilEnCarga = { uid: usuario.uid, promise: consulta };
    try {
      return await consulta;
    } finally {
      if (this.perfilEnCarga?.promise === consulta) this.perfilEnCarga = null;
    }
  }

  async rolActual(): Promise<RolUsuario | null> {
    return (await this.obtenerPerfil())?.rol ?? null;
  }

  async recuperarClave(correo: string): Promise<void> {
    await this.persistenceReady;
    await sendPasswordResetEmail(this.auth, correo.trim());
  }

  private esErrorPersistenciaNoDisponible(error: unknown): boolean {
    if (!error || typeof error !== 'object' || !('code' in error)) return false;
    return error.code === 'auth/web-storage-unsupported'
      || error.code === 'auth/unsupported-persistence-type';
  }

  /** Mensaje pendiente de un registro con Google por redireccion; se muestra una sola vez en el login. */
  consumirErrorAcceso(): string {
    const mensaje = sessionStorage.getItem(CLAVE_ERROR_ACCESO) ?? '';
    sessionStorage.removeItem(CLAVE_ERROR_ACCESO);
    return mensaje;
  }

  async ingresar(correo: string, clave: string): Promise<void> {
    await this.persistenceReady;
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

  async registrar(nombre: string, correo: string, clave: string, rol: RolUsuario, codigoInvitacion?: string, institucion?: string): Promise<void> {
    await this.persistenceReady;
    const nombreLimpio = nombre.trim().replace(/\s+/g, ' ');
    if (!nombreLimpio || nombreLimpio.length > 80) {
      throw new Error('El nombre debe tener entre 1 y 80 caracteres.');
    }
    const solicitud: SolicitudRegistro = { rol, codigoInvitacion, institucion };
    this.validarSolicitud(solicitud);
    const credencial = await createUserWithEmailAndPassword(this.auth, correo, clave);
    try {
      await updateProfile(credencial.user, { displayName: nombreLimpio });
      const perfil = await this.asegurarPerfil(credencial.user, solicitud, nombreLimpio);
      await this.irAlInicio(perfil.rol);
    } catch (error) {
      // No dejamos cuentas de Auth sin perfil (por ejemplo, con un codigo docente invalido).
      await deleteUser(credencial.user).catch(() => signOut(this.auth));
      throw error;
    }
  }

  async registrarseConGoogle(rol: RolUsuario, codigoInvitacion?: string, institucion?: string): Promise<void> {
    await this.persistenceReady;
    const solicitud: SolicitudRegistro = { rol, codigoInvitacion, institucion };
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
    this.invalidarCache();
    await this.router.navigateByUrl('/login');
  }

  async crearPerfilInicial(nombre: string, rol: RolUsuario, institucion?: string): Promise<Usuario> {
    const usuario = await this.esperarSesion();
    if (!usuario) throw new Error('Debes iniciar sesión para completar tu perfil.');

    const nombreLimpio = nombre.trim().replace(/\s+/g, ' ');
    if (!nombreLimpio || nombreLimpio.length > 80) {
      throw new Error('El nombre debe tener entre 1 y 80 caracteres.');
    }

    const solicitud: SolicitudRegistro = rol === 'docente'
      ? { rol, institucion: institucion?.trim().replace(/\s+/g, ' ') }
      : { rol: 'estudiante' };
    this.validarSolicitud(solicitud);
    return this.asegurarPerfil(usuario, solicitud, nombreLimpio);
  }

  private validarSolicitud(solicitud: SolicitudRegistro): void {
    if (solicitud.rol !== 'docente') return;
    if (solicitud.codigoInvitacion?.trim() && !FORMATO_CODIGO_DOCENTE.test(solicitud.codigoInvitacion.trim())) {
      throw new CodigoDocenteInvalidoError();
    }
    const institucion = solicitud.institucion?.trim().replace(/\s+/g, ' ') ?? '';
    if (institucion.length < 3 || institucion.length > 100) {
      throw new Error('Escribe el nombre de la institución (entre 3 y 100 caracteres).');
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

    const nombreLimpio = nombre.trim().replace(/\s+/g, ' ');
    if (!nombreLimpio || nombreLimpio.length > 80) throw new Error('El nombre debe tener entre 1 y 80 caracteres.');
    const profileRef = doc(this.firestore, 'usuarios', usuario.uid);
    let perfilExistente: Usuario | null = null;
    try {
      await runTransaction(this.firestore, async (transaction) => {
        perfilExistente = null;
        const captura = await transaction.get(profileRef);
        if (captura.exists()) {
          perfilExistente = captura.data() as Usuario;
          return;
        }

        const base = { uid: usuario.uid, nombre: nombreLimpio, fechaActualizacion: new Date().toISOString() };
        let nuevo: Record<string, unknown> = { ...base, rol: 'estudiante', institucion: '' };
        if (solicitud.rol === 'docente') {
          const institucion = solicitud.institucion?.trim().replace(/\s+/g, ' ') ?? '';
          if (solicitud.codigoInvitacion?.trim()) {
            const codigo = solicitud.codigoInvitacion.trim();
            const codigoRef = doc(this.firestore, 'codigos_invitacion', codigo);
            const invitacion = await transaction.get(codigoRef);
            const datosInvitacion = invitacion.data();
            const usos = datosInvitacion?.['usos'];
            const maxUsos = datosInvitacion?.['maxUsos'];
            if (!invitacion.exists()
              || datosInvitacion?.['activo'] !== true
              || datosInvitacion?.['institucion'] !== institucion
              || !Number.isInteger(usos)
              || !Number.isInteger(maxUsos)
              || usos >= maxUsos) {
              throw new CodigoDocenteInvalidoError();
            }
            transaction.update(codigoRef, { usos: usos + 1 });
            nuevo = {
              ...base,
              rol: 'docente',
              institucion: datosInvitacion['institucion'],
              codigoInvitacion: codigo,
            };
          } else {
            nuevo = { ...base, rol: 'docente', institucion, modoPrueba: true };
          }
        }
        transaction.set(profileRef, nuevo);
      });
    } catch (error) {
      if (solicitud.rol === 'docente' && solicitud.codigoInvitacion?.trim() && error && typeof error === 'object'
        && 'code' in error && error.code === 'permission-denied') {
        throw new CodigoDocenteInvalidoError();
      }
      throw error;
    }
    if (perfilExistente) return perfilExistente;
    const creado = await this.obtenerPerfil(true);
    if (!creado) throw new Error('No se pudo crear el perfil de la cuenta.');
    return creado;
  }

  private async terminarAccesoGoogle(credencial: UserCredential, solicitud: SolicitudRegistro): Promise<void> {
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
      await this.persistenceReady;
      const credencial = await getRedirectResult(this.auth);
      if (!credencial) return;
      const guardado = sessionStorage.getItem(CLAVE_REGISTRO_GOOGLE);
      sessionStorage.removeItem(CLAVE_REGISTRO_GOOGLE);
      let solicitud: SolicitudRegistro = { rol: 'estudiante' };
      try { if (guardado) solicitud = JSON.parse(guardado) as SolicitudRegistro; } catch { /* se usa estudiante */ }
      await this.terminarAccesoGoogle(credencial, solicitud);
    } catch (error) {
      sessionStorage.setItem(CLAVE_ERROR_ACCESO, error instanceof CodigoDocenteInvalidoError
        ? 'El código docente no está activo o no corresponde al nombre de institución indicado.'
        : 'No pudimos completar el registro con Google. Intenta nuevamente.');
      await this.router.navigateByUrl('/login');
    }
  }

  async actualizarNombre(usuario: User, nombre: string): Promise<void> {
    const nombreLimpio = nombre.trim().replace(/\s+/g, ' ');
    if (!nombreLimpio) throw new Error('El nombre no puede estar vacío.');
    if (nombreLimpio.length > 80) throw new Error('El nombre no puede superar los 80 caracteres.');
    await updateDoc(doc(this.firestore, 'usuarios', usuario.uid), {
      nombre: nombreLimpio,
      fechaActualizacion: new Date().toISOString(),
    });
    await updateProfile(usuario, { displayName: nombreLimpio });
    this.invalidarCache();
  }
}
