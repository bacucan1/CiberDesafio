import { Component } from '@angular/core';
import { IonBadge, IonButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';
import { ResultadoAgregado } from '../core/models/domain.models';

@Component({
  selector: 'app-teacher',
  templateUrl: './teacher.page.html',
  styleUrls: ['./teacher.page.scss'],
  imports: [IonBadge, IonButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonContent, IonHeader, IonTitle, IonToolbar],
})
export class TeacherPage {
  readonly resultados: ResultadoAgregado[] = [
    { grupo: '901-A', institucion: 'Demo', eje: 'fraude', porcentajeAciertos: 82, estudiantes: 24, fechaCalculo: new Date().toISOString() },
    { grupo: '901-A', institucion: 'Demo', eje: 'relación de riesgo', porcentajeAciertos: 71, estudiantes: 24, fechaCalculo: new Date().toISOString() },
    { grupo: '901-A', institucion: 'Demo', eje: 'higiene', porcentajeAciertos: 64, estudiantes: 24, fechaCalculo: new Date().toISOString() },
  ];

  readonly temas = [
    { nombre: 'Phishing', porcentaje: 82 }, { nombre: 'Smishing', porcentaje: 71 },
    { nombre: 'Ingeniería social', porcentaje: 64 }, { nombre: 'Ciberacoso', porcentaje: 91 },
    { nombre: 'Contraseñas', porcentaje: 76 }, { nombre: 'Privacidad', porcentaje: 58 },
  ];

  get promedio(): number {
    return Math.round(this.temas.reduce((total, tema) => total + tema.porcentaje, 0) / this.temas.length);
  }

  get temaPrioritario(): string {
    return this.temas.reduce((anterior, actual) => actual.porcentaje < anterior.porcentaje ? actual : anterior).nombre;
  }
}