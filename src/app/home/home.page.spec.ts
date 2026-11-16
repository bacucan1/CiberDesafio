import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { DecisionQueueService } from '../core/services/decision-queue.service';
import { HomePage } from './home.page';

describe('HomePage', () => {
  const onboardingStorageKey = 'ciberdesafio.onboarding-completado';
  let component: HomePage;
  let fixture: ComponentFixture<HomePage>;
  let sesionesCerradas: number;
  let colaDecisiones: {
    encolar: ReturnType<typeof vi.fn>;
    sincronizarPendientes: ReturnType<typeof vi.fn>;
    cantidadPendiente: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    window.localStorage.removeItem(onboardingStorageKey);
    sesionesCerradas = 0;
    colaDecisiones = {
      encolar: vi.fn().mockResolvedValue(undefined),
      sincronizarPendientes: vi.fn().mockResolvedValue(0),
      cantidadPendiente: vi.fn().mockReturnValue(0),
    };
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: DecisionQueueService, useValue: colaDecisiones },
        {
          provide: AuthService,
          useValue: {
            usuarioActual: () => ({ uid: 'estudiante-1' }),
            salir: async () => { sesionesCerradas += 1; },
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(HomePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('muestra la bienvenida en la primera visita', () => {
    expect(component.mostrarTutorial).toBe(true);
    expect(component.pasoTutorial.title).toBe('¡Bienvenido a CiberDesafío!');
  });

  it('avanza y retrocede por los pasos del tutorial', () => {
    component.siguientePasoTutorial();
    expect(component.pasoTutorial.target).toBe('controls');

    component.anteriorPasoTutorial();
    expect(component.pasoTutorial.title).toBe('¡Bienvenido a CiberDesafío!');
  });

  it('permite saltar y guarda la preferencia en el navegador', () => {
    component.saltarTutorial();

    expect(component.mostrarTutorial).toBe(false);
    expect(window.localStorage.getItem(onboardingStorageKey)).toBe('true');
  });

  it('permite volver a abrir la guía desde ayuda', () => {
    component.saltarTutorial();

    component.abrirAyuda();

    expect(component.mostrarTutorial).toBe(true);
    expect(component.indicePasoTutorial).toBe(0);
  });

  it('avanza aunque la decisión no pueda sincronizarse', async () => {
    colaDecisiones.sincronizarPendientes.mockRejectedValue(new Error('Sin conexión'));
    colaDecisiones.cantidadPendiente.mockReturnValue(1);
    const opcion = component.nodoActual.opciones[0];
    component.mostrarTutorial = false;

    component.elegirOpcion(opcion);
    await vi.waitFor(() => expect(component.errorPersistencia).toContain('guardado en este dispositivo'));

    expect(colaDecisiones.encolar).toHaveBeenCalledOnce();
    component.continuar();

    expect(component.mostrandoRetroalimentacion).toBe(false);
    expect(component.guardadoPendiente).toBe(true);
  });

  it('avanza con las flechas del teclado', () => {
    component.mostrarTutorial = false;
    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true });

    component.manejarTecla(event);

    expect(component.mostrandoRetroalimentacion).toBe(true);
    expect(event.defaultPrevented).toBe(true);
  });

  it('cierra la sesión desde la página de inicio', async () => {
    await component.cerrarSesion();

    expect(sesionesCerradas).toBe(1);
  });

  it('abre y cierra el modo de desafío con IA y acumula puntos', () => {
    expect(component.mostrarModalAi).toBe(false);
    component.abrirModoAi();
    expect(component.mostrarModalAi).toBe(true);

    const puntosPrevios = component.puntos;
    const rachaPrevia = component.racha;
    component.onAiPuntos(120);
    expect(component.puntos).toBe(puntosPrevios + 120);
    expect(component.racha).toBe(rachaPrevia + 1);

    component.cerrarModoAi();
    expect(component.mostrarModalAi).toBe(false);
  });
});
