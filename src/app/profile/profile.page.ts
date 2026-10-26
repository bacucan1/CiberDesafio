import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonButton, IonContent, IonHeader, IonInput, IonItem, IonLabel, IonList, IonText, IonTitle, IonToolbar } from '@ionic/angular';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { firebaseApp } from '../core/firebase.config';
import { Usuario } from '../core/models/domain.models';
import { AuthService } from '../core/services/auth.service';
import { InstitutionalService } from '../core/services/institutional.service';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  imports: [FormsModule, RouterLink, IonButton, IonContent, IonHeader, IonInput, IonItem, IonLabel, IonList, IonText, IonTitle, IonToolbar],
})
export class ProfilePage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly institutional = inject(InstitutionalService);
  private readonly router = inject(Router);

  perfil: Usuario | null = null;
  usuario: User | null = null;
  nombre = '';
  codigoGrupo = '';
  institucionSolicitada = '';
  estadoSolicitudDocente = '';
  cargando = true;
  guardando = false;
  vinculando = false;
  solicitandoDocente = false;
  error = '';
  mensaje = '';

  async ngOnInit(): Promise<void> {
    try {
      this.usuario = await this.auth.esperarSesion();
      if (!this.usuario) {
        await this.router.navigateByUrl('/login');
        return;
      }
      this.perfil = await this.auth.obtenerPerfil(this.usuario);
      if (!this.perfil) {
        this.error = 'No encontramos un perfil válido para esta cuenta. Contacta al equipo administrador.';
        return;
      }
      this.nombre = this.perfil.nombre;
      if (this.perfil.rol === 'estudiante') {
        this.institucionSolicitada = this.perfil.institucion;
        const solicitud = await getDoc(doc(getFirestore(firebaseApp), 'solicitudes_docente', this.usuario.uid));
        this.estadoSolicitudDocente = solicitud.exists() ? String(solicitud.data()['estado'] ?? '') : '';
      }
    } catch (error: unknown) {
      console.error('No se pudo cargar el perfil del usuario.', error);
      this.error = 'No se pudo cargar tu perfil. Revisa tu conexión e intenta nuevamente.';
    } finally {
      this.cargando = false;
    }
  }

  async guardar(): Promise<void> {
    if (!this.usuario || !this.perfil || this.guardando) return;
    const nombreLimpio = this.nombre.trim();
    if (!nombreLimpio) {
      this.error = 'Escribe tu nombre para guardar los cambios.';
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

  async solicitarInstitucion(): Promise<void> {
    if (!this.usuario || this.solicitandoDocente || this.estadoSolicitudDocente) return;
    this.solicitandoDocente = true;
    this.error = '';
    this.mensaje = '';
    try {
      await this.auth.solicitarAccesoDocente(this.usuario, this.institucionSolicitada);
      this.estadoSolicitudDocente = 'pendiente';
      this.mensaje = 'La solicitud se envió para revisión administrativa. Tu rol no cambia hasta su aprobación.';
    } catch (error: unknown) {
      console.error('No se pudo enviar la solicitud de acceso docente.', error);
      this.error = this.mensajeServicio(error, 'No se pudo enviar la solicitud. Revisa el nombre de la institución e intenta nuevamente.');
    } finally {
      this.solicitandoDocente = false;
    }
  }

  cancelarEdicion(): void {
    this.nombre = this.perfil?.nombre ?? '';
    this.error = '';
    this.mensaje = '';
  }

  cerrarSesion(): Promise<void> {
    return this.auth.salir();
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

  private mensajeServicio(error: unknown, mensajePredeterminado: string): string {
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
