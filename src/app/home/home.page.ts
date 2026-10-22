import { Component, inject } from '@angular/core';
import { IonBadge, IonButton, IonCard, IonCardContent, IonCardHeader, IonCardSubtitle, IonCardTitle, IonChip, IonContent, IonHeader, IonIcon, IonProgressBar, IonTitle, IonToolbar } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { arrowForward, cart, chatbubbles, checkmarkCircle, copy, desktop, documentLock, flame, gift, headset, key, location, lockClosed, medal, megaphone, people, personAdd, personCircle, phonePortrait, school, shieldCheckmark, sparkles, star, trophy, videocam, volumeHigh, volumeMute, warning, wifi } from 'ionicons/icons';
import { Decision, Escenario, NodoDecision, OpcionDecision } from '../core/models/domain.models';
import { AuthService } from '../core/services/auth.service';
import { SimulationService } from '../core/services/simulation.service';
import { DecisionService } from '../core/services/decision.service';
import { ScenarioService } from '../core/services/scenario.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss', 'home.futuristic.scss', 'home.gestures.scss'],
  imports: [IonBadge, IonButton, IonCard, IonCardContent, IonCardHeader, IonCardSubtitle, IonCardTitle, IonChip, IonContent, IonHeader, IonIcon, IonProgressBar, IonTitle, IonToolbar],
})
export class HomePage {
  private readonly auth = inject(AuthService);
  private readonly simulation = inject(SimulationService);
  private readonly decisionStore = inject(DecisionService);
  private readonly scenarioCatalog = inject(ScenarioService);
  readonly ejercicios = this.scenarioCatalog.obtenerTodos();
  escenario: Escenario = this.ejercicios[0];
  nodoActual: NodoDecision = this.escenario.nodos[0];
  opcionSeleccionada?: OpcionDecision;
  decisiones: Decision[] = [];
  mostrandoRetroalimentacion = false;
  completado = false;
  puntos = 0;
  racha = 0;
  recompensaActual = 0;
  seguridad = 50;
  confianza = 50;
  reputacion = 50;
  sonidoActivo = false;
  animandoCarta = false;
  desplazamientoCarta = 0;
  arrastrandoCarta = false;
  private inicioGesto?: number;
  private gestoConfirmado = false;
  desplazamientoFeedback = 0;
  private inicioGestoFeedback?: number;
  private inicioDeslizamiento?: number;

  constructor() {
    addIcons({ arrowForward, cart, chatbubbles, checkmarkCircle, copy, desktop, documentLock, flame, gift, headset, key, location, lockClosed, medal, megaphone, people, personAdd, personCircle, phonePortrait, school, shieldCheckmark, sparkles, star, trophy, videocam, volumeHigh, volumeMute, warning, wifi });
  }

  seleccionarRuta(ruta: Escenario): void {
    if (this.escenario.id === ruta.id) return;
    this.escenario = ruta;
    this.reiniciar();
  }

  rutaAnterior(): void {
    const indice = this.ejercicios.findIndex((ruta) => ruta.id === this.escenario.id);
    this.seleccionarRuta(this.ejercicios[(indice - 1 + this.ejercicios.length) % this.ejercicios.length]);
  }

  rutaSiguiente(): void {
    const indice = this.ejercicios.findIndex((ruta) => ruta.id === this.escenario.id);
    this.seleccionarRuta(this.ejercicios[(indice + 1) % this.ejercicios.length]);
  }

  seleccionarOpcion(opcion: OpcionDecision): void {
    this.opcionSeleccionada = opcion;
  }

  elegirOpcion(opcion: OpcionDecision): void {
    this.seleccionarOpcion(opcion);
    this.confirmarDecision();
  }

  elegirPorClic(opcion: OpcionDecision): void {
    if (this.gestoConfirmado) {
      this.gestoConfirmado = false;
      return;
    }
    this.elegirOpcion(opcion);
  }

  iniciarGesto(event: PointerEvent): void {
    if (this.mostrandoRetroalimentacion || this.completado) return;
    this.inicioGesto = event.clientX;
    this.arrastrandoCarta = true;
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  moverGesto(event: PointerEvent): void {
    if (this.inicioGesto === undefined || !this.arrastrandoCarta) return;
    this.desplazamientoCarta = event.clientX - this.inicioGesto;
  }

  terminarGesto(event: PointerEvent): void {
    if (this.inicioGesto === undefined) return;
    const distancia = event.clientX - this.inicioGesto;
    this.inicioGesto = undefined;
    this.arrastrandoCarta = false;
    if (Math.abs(distancia) < 90 || this.nodoActual.opciones.length < 2) {
      this.desplazamientoCarta = 0;
      return;
    }

    event.preventDefault();
    this.gestoConfirmado = true;
    this.desplazamientoCarta = distancia < 0 ? -520 : 520;
    const opcion = distancia < 0 ? this.nodoActual.opciones[0] : this.nodoActual.opciones[1];
    this.elegirOpcion(opcion);
    this.desplazamientoCarta = 0;
    this.gestoConfirmado = false;
  }

  iniciarGestoFeedback(event: PointerEvent): void {
    this.inicioGestoFeedback = event.clientX;
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  moverGestoFeedback(event: PointerEvent): void {
    if (this.inicioGestoFeedback === undefined) return;
    this.desplazamientoFeedback = Math.max(0, event.clientX - this.inicioGestoFeedback);
  }

  terminarGestoFeedback(event: PointerEvent): void {
    if (this.inicioGestoFeedback === undefined) return;
    const distancia = event.clientX - this.inicioGestoFeedback;
    this.inicioGestoFeedback = undefined;
    if (distancia < 80) {
      this.desplazamientoFeedback = 0;
      return;
    }
    event.preventDefault();
    this.desplazamientoFeedback = 280;
    this.continuar();
    this.desplazamientoFeedback = 0;
  }

  iniciarDeslizamiento(event: PointerEvent): void {
    this.inicioDeslizamiento = event.clientX;
  }

  terminarDeslizamiento(event: PointerEvent): void {
    if (this.inicioDeslizamiento === undefined || this.mostrandoRetroalimentacion) return;
    const distancia = event.clientX - this.inicioDeslizamiento;
    this.inicioDeslizamiento = undefined;
    if (Math.abs(distancia) < 60 || this.nodoActual.opciones.length < 2) return;
    this.elegirOpcion(distancia < 0 ? this.nodoActual.opciones[0] : this.nodoActual.opciones[1]);
  }

  confirmarDecision(): void {
    if (!this.opcionSeleccionada) return;

    const decision = this.simulation.crearDecision(this.escenario.id, this.nodoActual, this.opcionSeleccionada, this.auth.usuarioActual()?.uid ?? '');
    decision.situacion = this.nodoActual.pregunta;
    decision.eje = this.escenario.eje;
    this.decisiones = [...this.decisiones, decision];
    void this.decisionStore.guardar(decision).catch(() => undefined);
    this.recompensaActual = decision.correcta ? 100 : 25;
    this.puntos += this.recompensaActual;
    this.racha = decision.correcta ? this.racha + 1 : 0;
    const impacto = this.opcionSeleccionada.impacto;
    this.seguridad = this.limitar(this.seguridad + (impacto?.seguridad ?? 0));
    this.confianza = this.limitar(this.confianza + (impacto?.confianza ?? 0));
    this.reputacion = this.limitar(this.reputacion + (impacto?.reputacion ?? 0));
    this.reproducirSonido(decision.correcta);
    this.mostrandoRetroalimentacion = true;
  }

  continuar(): void {
    this.desplazamientoFeedback = 0;
    const siguienteNodoId = this.opcionSeleccionada?.siguienteNodoId;
    if (!siguienteNodoId) {
      this.completado = true;
      this.mostrandoRetroalimentacion = false;
      return;
    }

    this.nodoActual = this.simulation.obtenerNodo(this.escenario, siguienteNodoId)!;
    if (this.nodoActual.opciones.length === 0) {
      this.completado = true;
      this.mostrandoRetroalimentacion = false;
      return;
    }
    this.opcionSeleccionada = undefined;
    this.mostrandoRetroalimentacion = false;
    this.desplazamientoCarta = 0;
    this.animandoCarta = true;
    window.setTimeout(() => this.animandoCarta = false, 420);
  }

  reiniciar(): void {
    this.nodoActual = this.escenario.nodos[0];
    this.opcionSeleccionada = undefined;
    this.decisiones = [];
    this.mostrandoRetroalimentacion = false;
    this.completado = false;
    this.puntos = 0;
    this.racha = 0;
    this.recompensaActual = 0;
    this.desplazamientoCarta = 0;
    this.seguridad = 50;
    this.confianza = 50;
    this.reputacion = 50;
  }

  get progreso(): number {
    return Math.min(this.decisiones.length / this.totalPasos, 1);
  }

  get totalPasos(): number {
    return this.escenario.nodos.length - 1;
  }

  get nivel(): string {
    if (this.puntos >= 300) return 'Analista';
    if (this.puntos >= 150) return 'Observador';
    return 'Explorador';
  }

  get porcentajeAciertos(): number {
    return this.decisiones.length ? Math.round((this.aciertos / this.decisiones.length) * 100) : 0;
  }

  get progresoPorcentaje(): number {
    return Math.round(this.progreso * 100);
  }

  get aciertos(): number {
    return this.decisiones.filter((decision) => decision.correcta).length;
  }

  get riesgosDetectados(): number {
    return this.decisiones.filter((decision) => !decision.correcta).length;
  }

  get rangoFinal(): string {
    const resultado = this.porcentajeAciertos;
    if (resultado >= 95) return 'Experto en ciberseguridad';
    if (resultado >= 80) return 'Guardián digital';
    if (resultado >= 60) return 'Usuario consciente';
    if (resultado >= 40) return 'Aprendiz digital';
    return 'En riesgo';
  }

  get recomendacionFinal(): string {
    if (this.seguridad < 55) return 'Practica pausar y verificar antes de abrir enlaces o entregar datos.';
    if (this.confianza < 55) return 'Comparte tus dudas con un adulto o canal oficial de soporte.';
    return 'Conserva el hábito de verificar y comparte ese criterio con tu grupo.';
  }

  toggleSonido(): void {
    this.sonidoActivo = !this.sonidoActivo;
  }

  get estadoHistoria(): string {
    const minimo = Math.min(this.seguridad, this.confianza, this.reputacion);
    if (minimo < 30) return 'La tensión aumenta';
    if (this.seguridad > 65 && this.confianza > 65) return 'La comunidad confía en ti';
    return 'La historia sigue abierta';
  }

  get nodoSiguiente(): NodoDecision | undefined {
    const siguienteId = this.nodoActual.opciones[0]?.siguienteNodoId;
    return siguienteId ? this.simulation.obtenerNodo(this.escenario, siguienteId) : undefined;
  }

  get transformacionCarta(): string {
    const rotacion = Math.max(-12, Math.min(12, this.desplazamientoCarta / 18));
    return `translateX(${this.desplazamientoCarta}px) rotate(${rotacion}deg)`;
  }

  private limitar(valor: number): number {
    return Math.max(0, Math.min(100, valor));
  }

  private reproducirSonido(acierto: boolean): void {
    if (!this.sonidoActivo || typeof AudioContext === 'undefined') return;
    const contexto = new AudioContext();
    const oscilador = contexto.createOscillator();
    const ganancia = contexto.createGain();
    oscilador.frequency.value = acierto ? 660 : 220;
    ganancia.gain.setValueAtTime(0.04, contexto.currentTime);
    ganancia.gain.exponentialRampToValueAtTime(0.001, contexto.currentTime + 0.16);
    oscilador.connect(ganancia).connect(contexto.destination);
    oscilador.start();
    oscilador.stop(contexto.currentTime + 0.16);
  }
}
