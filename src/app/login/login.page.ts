import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonButton, IonContent, IonIcon, IonInput, IonItem, IonLabel, IonList, IonSegment, IonSegmentButton, IonText } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { logoGoogle } from 'ionicons/icons';
import { AuthService, CodigoDocenteInvalidoError } from '../core/services/auth.service';
import { RolUsuario } from '../core/models/domain.models';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  imports: [FormsModule, IonButton, IonContent, IonIcon, IonInput, IonItem, IonLabel, IonList, IonSegment, IonSegmentButton, IonText],
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  correo = '';
  clave = '';
  nombre = '';
  codigoInvitacion = '';
  rol: RolUsuario = 'estudiante';
  registrando = false;
  error = this.auth.consumirErrorAcceso();

  constructor() {
    addIcons({ logoGoogle });
  }

  async enviar(): Promise<void> {
    this.error = '';
    try {
      if (this.registrando) await this.auth.registrar(this.nombre, this.correo, this.clave, this.rol, this.codigoInvitacion.trim());
      else await this.auth.ingresar(this.correo, this.clave);
    } catch (error) {
      this.error = error instanceof CodigoDocenteInvalidoError
        ? 'El código de invitación no es válido o ya no está activo.'
        : 'No pudimos validar tus datos. Revisa el correo y la contraseña.';
    }
  }

  async registrarseConGoogle(): Promise<void> {
    this.error = '';
    try {
      // Al ingresar (no registrar) se ignora el rol elegido: manda el perfil guardado.
      await this.auth.registrarseConGoogle(this.registrando ? this.rol : 'estudiante', this.registrando ? this.codigoInvitacion.trim() : undefined);
    } catch (error) {
      this.error = error instanceof CodigoDocenteInvalidoError
        ? 'El código de invitación no es válido o ya no está activo.'
        : 'No pudimos completar el registro con Google. Intenta nuevamente.';
    }
  }
}
