import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonButton, IonContent, IonIcon, IonInput, IonItem, IonLabel, IonList, IonSegment, IonSegmentButton, IonText } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { logoGoogle } from 'ionicons/icons';
import { AuthService } from '../core/services/auth.service';
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
  rol: RolUsuario = 'estudiante';
  registrando = false;
  error = '';

  constructor() {
    addIcons({ logoGoogle });
  }

  async enviar(): Promise<void> {
    this.error = '';
    try {
      if (this.registrando) await this.auth.registrar(this.nombre, this.correo, this.clave, this.rol);
      else await this.auth.ingresar(this.correo, this.clave, this.rol);
    } catch {
      this.error = 'No pudimos validar tus datos. Revisa el correo y la contraseña.';
    }
  }

  async registrarseConGoogle(): Promise<void> {
    this.error = '';
    try {
      await this.auth.registrarseConGoogle(this.rol);
    } catch {
      this.error = 'No pudimos completar el registro con Google. Intenta nuevamente.';
    }
  }
}