import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonButton, IonContent, IonHeader, IonInput, IonItem, IonLabel, IonList, IonSelect, IonSelectOption, IonText, IonTitle, IonToolbar } from '@ionic/angular';
import { User } from 'firebase/auth';
import { RolUsuario, Usuario } from '../core/models/domain.models';
import { AuthService } from '../core/services/auth.service';
import { InstitutionalService } from '../core/services/institutional.service';
import { OperationTimeoutError, remainingTime, withTimeout } from '../core/utils/async.utils';

const TIMEOUT_CARGA_MS = 8_000;

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  imports: [FormsModule, RouterLink, IonButton, IonContent, IonHeader, IonInput, IonItem, IonLabel, IonList, IonSelect, IonSelectOption, IonText, IonTitle, IonToolbar],
})
export class ProfilePage {
  private readonly auth = inject(AuthService);
  private readonly institutional = inject(InstitutionalService);
  private readonly router = inject(Router);
  private vistaInicializada = false;

  perfil: Usuario | null = null;
  usuario: User | null = null;
  nombre = '';
  rolInicial: RolUsuario = 'estudiante';
  institucionInicial = '';
  perfilPorCompletar = false;
  creandoPerfil = false;
  codigoGrupo = '';
  institucionSolicitada = '';
  grupoSolicitado = '';
  gradoSolicitado?: number;
  solicitandoDatos = false;
  solicitudPendiente = false;
  cargando = true;
  guardando = false;
  vinculando = false;
  cerrandoSesion = false;
  error = '';
  mensaje = '';

  async ionViewWillEnter(): Promise<void> {
    if (!this.vistaInicializada) {
      this.vistaInicializada = true;
      await this.cargarPerfil();
      return;
    }

    if (!this.esDispositivoMovil()
      || this.cargando
      || this.guardando
      || this.perfilPorCompletar
      || this.hayCambios
      || this.institucionSolicitada !== (this.perfil?.institucion ?? '')
      || this.grupoSolicitado !== (this.perfil?.grupo ?? '')
      || this.gradoSolicitado !== this.perfil?.grado) {
      return;
    }

    await this.reintentarCarga();
  }

  private esDispositivoMovil(): boolean {
    return typeof window !== 'undefined'
      && window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;
  }

  async cargarPerfil(): Promise<void> {
    this.cargando = true;
    this.error = '';
    this.perfil = null;
    this.perfilPorCompletar = false;
    const inicioCarga = Date.now();
    try {
      this.usuario = await withTimeout(
        this.auth.esperarSesion(),
        remainingTime(inicioCarga, TIMEOUT_CARGA_MS),
        'La conexión con Firebase está tardando demasiado. Revisa tu conexión e intenta cargar de nuevo.',
      );
      if (!this.usuario) {
        await this.router.navigateByUrl('/login');
        return;
      }
      this.perfil = await withTimeout(
        this.auth.obtenerPerfil(),
        remainingTime(inicioCarga, TIMEOUT_CARGA_MS),
        'La información de tu perfil tardó más de 8 segundos. Revisa tu conexión e intenta cargar de nuevo.',
      );
      if (!this.perfil) {
        this.perfilPorCompletar = true;
        this.nombre = this.usuario.displayName ?? '';
        return;
      }
      this.nombre = this.perfil.nombre;
      this.institucionSolicitada = this.perfil.institucion ?? '';
      this.grupoSolicitado = this.perfil.grupo ?? '';
      this.gradoSolicitado = this.perfil.grado;
    } catch (error: unknown) {
      console.error('No se pudo cargar el perfil del usuario.', error);
      this.error = error instanceof OperationTimeoutError
        ? error.message
        : 'No se pudo cargar tu perfil. Revisa tu conexión e intenta nuevamente.';
    } finally {
      this.cargando = false;
    }
  }

  async reintentarCarga(): Promise<void> {
    this.auth.invalidarCache();
    await this.cargarPerfil();
  }

  async guardar(): Promise<void> {
    if (!this.usuario || !this.perfil || this.guardando) return;
    const nombreLimpio = this.normalizarNombre(this.nombre);
    if (!nombreLimpio) {
      this.error = 'Escribe tu nombre para guardar los cambios.';
      this.mensaje = '';
      return;
    }
    if (nombreLimpio.length > 80) {
      this.error = 'El nombre no puede superar los 80 caracteres.';
      this.mensaje = '';
      return;
    }
    if (nombreLimpio === this.perfil.nombre) {
      this.nombre = this.perfil.nombre;
      this.error = '';
      this.mensaje = '';
      return;
    }
    this.guardando = true;
    this.error = '';
    this.mensaje = '';
    try {
      await this.auth.actualizarNombre(this.usuario, nombreLimpio);
      this.perfil = { ...this.perfil, nombre: nombreLimpio, fechaActualizacion: new Date().toISOString() };
      this.nombre = nombreLimpio;
      this.mensaje = 'Tu nombre se guardó correctamente.';
    } catch (error: unknown) {
      console.error('No se pudo actualizar el perfil del usuario.', error);
      this.error = 'No se pudieron guardar los cambios. Verifica tu conexión e intenta de nuevo.';
    } finally {
      this.guardando = false;
    }
  }

  async crearPerfilInicial(): Promise<void> {
    if (!this.usuario || this.creandoPerfil) return;
    this.creandoPerfil = true;
    this.error = '';
    this.mensaje = '';
    try {
      this.perfil = await this.auth.crearPerfilInicial(
        this.nombre,
        this.rolInicial,
        this.rolInicial === 'docente' ? this.institucionInicial : undefined,
      );
      this.perfilPorCompletar = false;
      this.nombre = this.perfil.nombre;
      this.institucionSolicitada = this.perfil.institucion ?? '';
      this.grupoSolicitado = this.perfil.grupo ?? '';
      this.gradoSolicitado = this.perfil.grado;
      this.mensaje = 'Tu perfil quedó creado. Completa los datos académicos pendientes para continuar.';
    } catch (error: unknown) {
      console.error('No se pudo completar el perfil del usuario.', error);
      this.error = error instanceof Error ? error.message : 'No se pudo crear tu perfil. Intenta nuevamente.';
    } finally {
      this.creandoPerfil = false;
    }
  }

  async solicitarActualizacionPerfil(): Promise<void> {
    if (!this.perfil || this.solicitandoDatos || this.solicitudPendiente) return;
    this.solicitandoDatos = true;
    this.error = '';
    this.mensaje = '';
    try {
      await this.institutional.solicitarActualizacionPerfil({
        institucion: this.institucionSolicitada,
        ...(this.perfil.rol === 'estudiante'
          ? { grupo: this.grupoSolicitado, ...(this.gradoSolicitado !== undefined ? { grado: this.gradoSolicitado } : {}) }
          : {}),
      });
      this.solicitudPendiente = true;
      this.mensaje = 'Recibimos tus datos y quedaron pendientes de revisión. No se cambiarán los permisos ni tu perfil hasta que sean validados.';
    } catch (error: unknown) {
      console.error('No se pudo enviar la solicitud de actualización del perfil.', error);
      this.error = this.mensajeServicio(error, 'No se pudo enviar la solicitud. Revisa los datos e intenta nuevamente.');
    } finally {
      this.solicitandoDatos = false;
    }
  }

  async vincularGrupo(): Promise<void> {
    if (!this.perfil || this.perfil.rol !== 'estudiante' || this.vinculando) return;
    this.vinculando = true;
    this.error = '';
    this.mensaje = '';
    try {
      const vinculacion = await this.institutional.vincularConCodigo(this.codigoGrupo);
      this.codigoGrupo = '';
      this.perfil = {
        ...this.perfil,
        institucion: vinculacion.institucion,
        grupo: vinculacion.grupo,
        grupoId: vinculacion.grupoId,
        grado: vinculacion.grado,
      };
      this.mensaje = `Te vinculaste a ${vinculacion.institucion}, grupo ${vinculacion.grupo}.`;
    } catch (error: unknown) {
      console.error('No se pudo vincular el estudiante con el grupo.', error);
      this.error = this.mensajeServicio(error, 'No se pudo validar el código. Revisa que esté vigente y vuelve a intentarlo.');
    } finally {
      this.vinculando = false;
    }
  }

  cancelarEdicion(): void {
    this.nombre = this.perfil?.nombre ?? '';
    this.error = '';
    this.mensaje = '';
  }

  get hayCambios(): boolean {
    return !!this.perfil && this.normalizarNombre(this.nombre) !== this.perfil.nombre;
  }

  get datosAcademicosIncompletos(): boolean {
    if (!this.perfil) return false;
    if (this.perfil.rol === 'docente') return !this.perfil.institucion;
    return !this.perfil.institucion || !this.perfil.grupo || !this.perfil.grupoId;
  }

  async cerrarSesion(): Promise<void> {
    if (this.cerrandoSesion) return;
    this.cerrandoSesion = true;
    this.error = '';
    try {
      await this.auth.salir();
    } catch (error: unknown) {
      console.error('No se pudo cerrar la sesión del usuario.', error);
      this.error = 'No se pudo cerrar la sesión. Intenta nuevamente.';
      this.cerrandoSesion = false;
    }
  }

  get proveedor(): string {
    const proveedores = this.usuario?.providerData.map((dato) => dato.providerId) ?? [];
    if (proveedores.includes('google.com')) return 'Google';
    if (proveedores.includes('password')) return 'Correo y contraseña';
    return 'Cuenta externa';
  }

  get fechaRegistro(): string {
    const fecha = this.usuario?.metadata.creationTime;
    if (!fecha) return 'No disponible';
    const instante = new Date(fecha);
    return Number.isNaN(instante.getTime())
      ? 'No disponible'
      : new Intl.DateTimeFormat('es-CO', { dateStyle: 'long' }).format(instante);
  }

  private normalizarNombre(nombre: string): string {
    return nombre.trim().replace(/\s+/g, ' ');
  }

  private mensajeServicio(error: unknown, mensajePredeterminado: string): string {
    if (error && typeof error === 'object' && 'code' in error) {
      const code = String(error.code);
      if (code === 'permission-denied') return 'El código no está vigente o no corresponde a la institución y grupo.';
      if (code === 'unavailable' || code === 'network-request-failed') return 'No hay conexión con el servicio. Intenta nuevamente en unos minutos.';
    }
    if (error && typeof error === 'object' && 'message' in error) {
      const message = String(error.message);
      if (message.includes('already-exists')) return 'Esta cuenta ya está vinculada a una institución. Contacta a un administrador para cambiarla.';
      if (message.includes('failed-precondition')) return 'El código venció, fue revocado o alcanzó el límite de usos.';
      if (message.includes('permission-denied')) return 'Tu cuenta no tiene permiso para completar esta acción.';
      if (message.includes('invalid-argument')) return 'Revisa los datos ingresados e intenta de nuevo.';
      if (message.includes('functions/unavailable') || message.includes('network-request-failed')) return 'No hay conexión con el servicio. Intenta nuevamente en unos minutos.';
    }
    return mensajePredeterminado;
  }
}
