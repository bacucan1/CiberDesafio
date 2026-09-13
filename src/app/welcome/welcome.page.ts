import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonButton, IonContent, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { arrowForward, lockClosed, play, school, shieldCheckmark } from 'ionicons/icons';

@Component({
  selector: 'app-welcome',
  templateUrl: './welcome.page.html',
  styleUrls: ['./welcome.page.scss'],
  imports: [IonButton, IonContent, IonIcon],
})
export class WelcomePage {
  private readonly router = inject(Router);

  constructor() {
    addIcons({ arrowForward, lockClosed, play, school, shieldCheckmark });
  }

  entrar(): void {
    void this.router.navigateByUrl('/login');
  }
}
