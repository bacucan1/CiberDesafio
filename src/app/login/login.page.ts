import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonButton, IonContent, IonIcon, IonInput } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { alertCircle, arrowForward, business, checkmarkCircle, eye, eyeOff, informationCircle, key, lockClosed, logoGoogle, mail, people, person, school, shieldCheckmark } from 'ionicons/icons';
import { AuthService } from '../core/services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  imports: [FormsModule, RouterLink, IonButton, IonContent, IonIcon, IonInput],
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  correo = '';
  clave = '';
  nombre = '';
  institucion = '';
  registrando = false;
  solicitandoDocencia = false;
  mostrarClave = false;
  cargando = false;
  error = '';
  mensaje = '';

  constructor() {
    addIcons({ alertCircle, arrowForward, business, checkmarkCircle, eye, eyeOff, informationCircle, key, lockClosed, logoGoogle, mail, people, person, school, shieldCheckmark });
  }

  async enviar(): Promise<void> {
    this.error = '';
    this.mensaje = '';
    if (this.cargando) return;
    const correo = this.correo.trim();
    if (!correo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      this.error = 'Escribe un correo electrónico válido.';
      return;
    }
    if (!this.clave || this.clave.length < 6) {
      this.error = 'La contraseña debe tener al menos 6 caracteres.';
      return;
    }
    if (this.registrando && !this.nombre.trim()) {
      this.error = 'Escribe tu nombre para crear la cuenta.';
      return;
    }
    if (this.registrando && this.solicitandoDocencia && this.institucion.trim().length < 3) {
      this.error = 'Escribe el nombre de la institución para solicitar acceso docente.';
      return;
    }
    this.cargando = true;
    try {
      if (this.registrando) {
        await this.auth.registrar(
          this.nombre.trim(),
          correo,
          this.clave,
          this.solicitandoDocencia ? this.institucion.trim() : undefined,
        );
      } else {
        await this.auth.ingresar(correo, this.clave);
      }
    } catch (error: unknown) {
      this.error = this.mensajeError(error);
    } finally {
      this.cargando = false;
    }
  }

  async registrarseConGoogle(): Promise<void> {
    this.error = '';
    this.mensaje = '';
    if (this.cargando) return;
    this.cargando = true;
    try {
      await this.auth.ingresarConGoogle();
    } catch (error: unknown) {
      this.error = this.mensajeError(error);
    } finally {
      this.cargando = false;
    }
  }

  async recuperarClave(): Promise<void> {
    this.error = '';
    this.mensaje = '';
    const correo = this.correo.trim();
    if (!correo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      this.error = 'Escribe tu correo para enviarte el enlace de recuperación.';
      return;
    }
    this.cargando = true;
    try {
      await this.auth.recuperarClave(correo);
      this.mensaje = 'Si existe una cuenta con ese correo, recibirás un enlace para cambiar tu contraseña.';
    } catch (error: unknown) {
      this.error = this.mensajeError(error);
    } finally {
      this.cargando = false;
    }
  }

  alternarRegistro(): void {
    this.registrando = !this.registrando;
    this.error = '';
    this.mensaje = '';
  }

  private mensajeError(error: unknown): string {
    const codigo = error && typeof error === 'object' && 'code' in error
      ? String(error.code)
      : '';
    switch (codigo) {
      case 'auth/invalid-credential':
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        return 'El correo o la contraseña no son correctos.';
      case 'auth/email-already-in-use':
        return 'Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña.';
      case 'auth/weak-password':
        return 'La contraseña debe tener al menos 6 caracteres.';
      case 'auth/invalid-email':
        return 'El correo electrónico no tiene un formato válido.';
      case 'auth/too-many-requests':
        return 'Hubo demasiados intentos. Espera unos minutos antes de probar de nuevo.';
      case 'auth/network-request-failed':
        return 'No hay conexión. Revisa tu internet e intenta nuevamente.';
      case 'auth/popup-closed-by-user':
        return 'Se cerró la ventana de Google antes de terminar el acceso.';
      case 'auth/popup-blocked':
        return 'El navegador bloqueó la ventana de Google. Permite las ventanas emergentes e intenta de nuevo.';
      case 'auth/unauthorized-domain':
        return 'Este dominio no está autorizado en Firebase Authentication.';
      case 'auth/operation-not-allowed':
        return 'Este método de inicio de sesión no está habilitado. Contacta al equipo administrador.';
      default:
        console.error('Fallo en el flujo de autenticación.', error);
        return 'No pudimos completar la solicitud. Revisa los datos y vuelve a intentarlo.';
    }
  }
}