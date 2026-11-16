import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { HomePage } from './home.page';

describe('HomePage', () => {
  const onboardingStorageKey = 'ciberdesafio.onboarding-completado';
  let component: HomePage;
  let fixture: ComponentFixture<HomePage>;
  let sesionesCerradas: number;

  beforeEach(async () => {
    window.localStorage.removeItem(onboardingStorageKey);
    sesionesCerradas = 0;
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
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

  it('cierra la sesión desde la página de inicio', async () => {
    await component.cerrarSesion();

    expect(sesionesCerradas).toBe(1);
  });
});
