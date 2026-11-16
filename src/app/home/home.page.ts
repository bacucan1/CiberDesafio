import { ChangeDetectorRef, Component, ElementRef, HostListener, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonBadge, IonButton, IonCard, IonCardContent, IonCardHeader, IonCardSubtitle, IonCardTitle, IonChip, IonContent, IonHeader, IonIcon, IonProgressBar, IonTitle, IonToolbar } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { arrowForward, cart, chatbubbles, checkmarkCircle, copy, desktop, documentLock, flame, gift, headset, helpCircle, key, location, lockClosed, logOut, medal, megaphone, people, personAdd, personCircle, phonePortrait, school, shieldCheckmark, sparkles, star, trophy, videocam, volumeHigh, volumeMute, warning, wifi } from 'ionicons/icons';
import { Decision, Escenario, NodoDecision, OpcionDecision } from '../core/models/domain.models';
import { AuthService } from '../core/services/auth.service';
import { SimulationService } from '../core/services/simulation.service';
import { DecisionQueueService } from '../core/services/decision-queue.service';
import { DecisionService } from '../core/services/decision.service';
import { ScenarioService } from '../core/services/scenario.service';
import { LanguageSelectorComponent } from '../core/components/language-selector/language-selector.component';
import { AiChallengeModalComponent } from '../core/components/ai-challenge-modal/ai-challenge-modal.component';
import { TranslatePipe } from '../core/pipes/translate.pipe';

interface TutorialStep {
  label: string;
  title: string;
  description: string;
  target?: string;
}

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss', 'home.futuristic.scss', 'home.gestures.scss', 'home.responsive.scss'],
  imports: [
    RouterLink,
    IonBadge,
    IonButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardSubtitle,
    IonCardTitle,
    IonChip,
    IonContent,
    IonHeader,
    IonIcon,
    IonProgressBar,
    IonTitle,
    IonToolbar,
    LanguageSelectorComponent,
    AiChallengeModalComponent,
    TranslatePipe,
  ],
})
export class HomePage {
  mostrarModalAi = false;
  private readonly onboardingStorageKey = 'ciberdesafio.onboarding-completado';
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly auth = inject(AuthService);
  private readonly simulation = inject(SimulationService);
  private readonly decisionQueue = inject(DecisionQueueService);
  private readonly decisionService = inject(DecisionService);
  private readonly scenarioCatalog = inject(ScenarioService);
  readonly pasosTutorial: TutorialStep[] = [
    {
      label: 'BIENVENIDA',
      title: '¡Bienvenido a CiberDesafío!',
      description: 'Enfrenta situaciones digitales, elige cómo actuar y descubre qué tan seguras son tus decisiones. Ganas puntos al decidir con cuidado; no hay eliminación: cada error te enseña algo nuevo.',
    },
    {
      label: 'CONTROLES',
      title: 'Tus controles',
      description: 'Activa o silencia el sonido, consulta tu perfil o cierra la sesión. Usa “Cómo jugar” cuando quieras repetir este recorrido.',
      target: 'controls',
    },
    {
      label: 'TU PROGRESO',
      title: 'Puntos, racha y nivel',
      description: 'Aquí ves los XP que ganas, tus decisiones seguras seguidas y tu nivel. Cada respuesta suma puntos y te ayuda a avanzar.',
      target: 'stats',
    },
    {
      label: 'LA HISTORIA',
      title: 'Cuida el equilibrio',
      description: 'Seguridad, confianza y reputación cambian con tus decisiones. Observa sus barras para entender cómo afectan a la comunidad.',
      target: 'balance',
    },
    {
      label: 'RUTAS',
      title: 'Elige una historia',
      description: 'Selecciona un tema del mazo para jugar otra misión. Cada historia presenta situaciones distintas y varios caminos.',
      target: 'missions',
    },
    {
      label: 'NAVEGACIÓN',
      title: 'Explora otras misiones',
      description: 'Las flechas a los lados de la carta cambian a la ruta anterior o siguiente. También puedes escogerla directamente en el mazo.',
      target: 'arrows',
    },
    {
      label: 'SITUACIÓN',
      title: 'Lee y sigue tu avance',
      description: 'La carta cuenta lo que ocurre; el indicador muestra cuántas situaciones has resuelto. Puedes arrastrar la carta hacia un lado o elegir una respuesta.',
      target: 'scenario',
    },
    {
      label: 'DECIDE',
      title: 'Elige cómo actuar',
      description: 'Pulsa una de las opciones para tomar una decisión. La primera va a la izquierda y la segunda a la derecha; después verás sus consecuencias y una explicación.',
      target: 'options',
    },
    {
      label: 'APRENDE',
      title: 'Revisa y continúa',
      description: 'Después de cada decisión, lee la explicación y pulsa “Continuar” para seguir. Al terminar la misión conocerás tu resultado y podrás repetirla.',
      target: 'scenario',
    },
  ];
  mostrarTutorial = false;
  indicePasoTutorial = 0;
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
  guardandoDecision = false;
  desplazamientoCarta = 0;
  arrastrandoCarta = false;
  errorPersistencia = '';
  private aciertosConocidos = 0;
  private inicioGesto?: number;
  private gestoConfirmado = false;
  desplazamientoFeedback = 0;
  private inicioGestoFeedback?: number;
  private inicioDeslizamiento?: number;
  cerrandoSesion = false;
  errorSesion = '';
  aiAwardSaving = false;
  aiAwardError = '';
  aiSavedAwardId = '';
  private readonly aiAwardsInSession = new Set<string>();

  constructor() {
    addIcons({ arrowForward, cart, chatbubbles, checkmarkCircle, copy, desktop, documentLock, flame, gift, headset, helpCircle, key, location, lockClosed, logOut, medal, megaphone, people, personAdd, personCircle, phonePortrait, school, shieldCheckmark, sparkles, star, trophy, videocam, volumeHigh, volumeMute, warning, wifi });
    this.mostrarTutorial = !this.tutorialCompletado();
  }

  get pasoTutorial(): TutorialStep {
    return this.pasosTutorial[this.indicePasoTutorial];
  }

  ionViewWillEnter(): void {
    void this.guardarDecisionPendiente();
  }

  abrirAyuda(): void {
    this.indicePasoTutorial = 0;
    this.mostrarTutorial = true;
  }

  abrirModoAi(): void {
    this.mostrarModalAi = true;
  }

  cerrarModoAi(): void {
    this.mostrarModalAi = false;
  }

  async onAiPuntos(desafio: { id: string; puntos: number; correcta: boolean }): Promise<void> {
    if (this.aiAwardSaving) return;
    const uid = this.auth.usuarioActual()?.uid;
    if (!uid) {
      this.aiAwardError = 'Tu sesión no está activa. Vuelve a iniciar sesión para guardar tu puntaje.';
      return;
    }

    this.aiAwardSaving = true;
    this.aiAwardError = '';
    try {
      await this.decisionService.guardarDesafioAi(uid, desafio);
      if (!this.aiAwardsInSession.has(desafio.id)) {
        this.aiAwardsInSession.add(desafio.id);
        this.puntos += desafio.puntos;
        this.racha = desafio.correcta ? this.racha + 1 : 0;
      }
      this.aiSavedAwardId = desafio.id;
    } catch (error: unknown) {
      console.error('No se pudo guardar el puntaje del desafío de IA.', error);
      this.aiAwardError = error instanceof Error
        ? error.message
        : 'No se pudo guardar el puntaje. Intenta nuevamente.';
    } finally {
      this.aiAwardSaving = false;
      this.changeDetector.markForCheck();
    }
  }

  siguientePasoTutorial(): void {
    if (this.indicePasoTutorial < this.pasosTutorial.length - 1) {
      this.indicePasoTutorial += 1;
      return;
    }

    this.terminarTutorial();
  }

  anteriorPasoTutorial(): void {
    if (this.indicePasoTutorial > 0) this.indicePasoTutorial -= 1;
  }

  saltarTutorial(): void {
    this.terminarTutorial();
  }

  private terminarTutorial(): void {
    this.mostrarTutorial = false;
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(this.onboardingStorageKey, 'true');
      }
    } catch (error: unknown) {
      console.error('No se pudo guardar la preferencia del tutorial.', error);
    }
  }

  private tutorialCompletado(): boolean {
    try {
      return typeof window !== 'undefined'
        && window.localStorage.getItem(this.onboardingStorageKey) === 'true';
    } catch (error: unknown) {
      console.error('No se pudo leer la preferencia del tutorial.', error);
      return false;
    }
  }

  ionViewWillLeave(): void {
    const page = this.host.nativeElement;
    const focusedElement = document.activeElement;
    if (!(focusedElement instanceof HTMLElement) || !page.contains(focusedElement)) return;

    let deepestFocusedElement: Element | null = focusedElement;
    while (deepestFocusedElement instanceof HTMLElement && deepestFocusedElement.shadowRoot?.activeElement) {
      deepestFocusedElement = deepestFocusedElement.shadowRoot.activeElement;
    }
    if (deepestFocusedElement instanceof HTMLElement) deepestFocusedElement.blur();
  }

  async cerrarSesion(): Promise<void> {
    if (this.cerrandoSesion) return;
    this.cerrandoSesion = true;
    this.errorSesion = '';
    try {
      await this.auth.salir();
    } catch (error: unknown) {
      console.error('No se pudo cerrar la sesión del estudiante.', error);
      this.errorSesion = 'No se pudo cerrar la sesión. Intenta nuevamente.';
      this.cerrandoSesion = false;
    }
  }

  async guardarDecisionPendiente(): Promise<void> {
    const uid = this.auth.usuarioActual()?.uid;
    if (!uid || this.guardandoDecision) return;
    this.guardandoDecision = true;
    this.errorPersistencia = '';
    try {
      const pendientes = await this.decisionQueue.sincronizarPendientes(uid);
      this.errorPersistencia = pendientes
        ? `Tu progreso quedó guardado en este dispositivo. Se sincronizarán ${pendientes} decisión(es) cuando vuelva la conexión.`
        : '';
    } catch (error: unknown) {
      console.error('No se pudo guardar la decisión del estudiante.', error);
      let pendientes = 0;
      try {
        pendientes = this.decisionQueue.cantidadPendiente(uid);
      } catch (errorLectura: unknown) {
        console.error('No se pudo consultar la cola local de decisiones.', errorLectura);
        this.errorPersistencia = 'No se pudo leer el progreso pendiente de este dispositivo. Libera espacio y vuelve a intentarlo.';
        return;
      }
      this.errorPersistencia = pendientes
        ? `Tu progreso quedó guardado en este dispositivo. Se sincronizarán ${pendientes} decisión(es) cuando vuelva la conexión. ${this.mensajeErrorDecision(error)}`
        : this.mensajeErrorDecision(error);
    } finally {
      this.guardandoDecision = false;
      this.changeDetector.markForCheck();
    }
  }

  private async guardarDecisionEnCola(decision: Decision): Promise<void> {
    try {
      await this.decisionQueue.encolar(decision);
      await this.guardarDecisionPendiente();
    } catch (error: unknown) {
      console.error('No se pudo guardar la decisión localmente.', error);
      this.errorPersistencia = error instanceof Error
        ? error.message
        : 'No se pudo guardar el progreso en este dispositivo.';
      this.changeDetector.markForCheck();
    }
  }

  private mensajeErrorDecision(error: unknown): string {
    const codigo = error && typeof error === 'object' && 'code' in error
      ? String(error.code)
      : '';
    if (codigo === 'permission-denied') {
      return 'Firebase rechazó el guardado. Revisa las reglas publicadas y los permisos de la cuenta.';
    }
    if (codigo === 'unavailable' || codigo === 'deadline-exceeded' || codigo === 'network-request-failed') {
      return 'Firebase no respondió o no hay conexión; se volverá a intentar automáticamente.';
    }
    return error instanceof Error
      ? error.message
      : 'No se pudo sincronizar el progreso. La decisión permanece pendiente en este dispositivo.';
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
    if (this.mostrandoRetroalimentacion || this.completado) return;
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
    if (this.mostrandoRetroalimentacion || this.completado
      || (event.target instanceof Element && event.target.closest('button, ion-button, a, input, select, ion-input, ion-select'))) return;
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
    if (event.target instanceof Element && event.target.closest('button, ion-button, a, input, select, ion-input, ion-select')) return;
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
    if (!this.opcionSeleccionada || this.mostrandoRetroalimentacion || this.completado) return;
    const uid = this.auth.usuarioActual()?.uid;
    if (!uid) {
      this.errorPersistencia = 'Tu sesión no está activa. Vuelve a iniciar sesión para guardar tu progreso.';
      return;
    }

    this.errorPersistencia = '';
    const decision = this.simulation.crearDecision(this.escenario.id, this.nodoActual, this.opcionSeleccionada, uid);
    decision.situacion = this.nodoActual.pregunta;
    decision.eje = this.escenario.eje;
    this.decisiones = [...this.decisiones, decision];
    if (decision.correcta) {
      this.aciertosConocidos += 1;
    }
    void this.guardarDecisionEnCola(decision);
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
    if (!this.mostrandoRetroalimentacion) return;
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
    this.aciertosConocidos = 0;
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

  get guardadoPendiente(): boolean {
    const uid = this.auth.usuarioActual()?.uid;
    if (!uid) return false;
    try {
      return this.decisionQueue.cantidadPendiente(uid) > 0;
    } catch (error: unknown) {
      console.error('No se pudo consultar la cola local de decisiones.', error);
      return false;
    }
  }

  @HostListener('window:keydown', ['$event'])
  manejarTecla(event: KeyboardEvent): void {
    if (this.mostrarTutorial || event.altKey || event.ctrlKey || event.metaKey
      || (event.target instanceof Element
        && event.target.closest('button, a, ion-button, input, textarea, select, ion-input, ion-select'))) return;

    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      if (this.mostrandoRetroalimentacion) {
        if (event.key === 'ArrowRight') this.continuar();
      } else if (!this.completado && this.nodoActual.opciones.length > 1) {
        this.elegirOpcion(this.nodoActual.opciones[event.key === 'ArrowLeft' ? 0 : 1]);
      }
      event.preventDefault();
      return;
    }

    if ((event.key === 'Enter' || event.key === ' ') && this.mostrandoRetroalimentacion) {
      this.continuar();
      event.preventDefault();
    }
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
    return this.decisiones.length ? Math.round((this.aciertosConocidos / this.decisiones.length) * 100) : 0;
  }

  get progresoPorcentaje(): number {
    return Math.round(this.progreso * 100);
  }

  get aciertos(): number {
    return this.aciertosConocidos;
  }

  get riesgosDetectados(): number {
    return this.decisiones.length - this.aciertosConocidos;
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
