import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { InstitutionalService } from '../core/services/institutional.service';
import { ProfilePage } from './profile.page';

describe('ProfilePage', () => {
  let component: ProfilePage;
  let fixture: ComponentFixture<ProfilePage>;
  let auth: {
    esperarSesion: ReturnType<typeof vi.fn>;
    obtenerPerfil: ReturnType<typeof vi.fn>;
    invalidarCache: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    auth = {
      esperarSesion: vi.fn().mockResolvedValue({ uid: 'estudiante-1', displayName: 'Estudiante' }),
      obtenerPerfil: vi.fn().mockResolvedValue({
        uid: 'estudiante-1',
        nombre: 'Estudiante',
        rol: 'estudiante',
        institucion: '',
        grupo: '',
      }),
      invalidarCache: vi.fn(),
    };

    await TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: InstitutionalService, useValue: {} },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfilePage);
    component = fixture.componentInstance;
  });

  it('carga el perfil al entrar por primera vez', async () => {
    await component.ionViewWillEnter();

    expect(auth.esperarSesion).toHaveBeenCalledOnce();
    expect(auth.obtenerPerfil).toHaveBeenCalledOnce();
  });

  it('vuelve a consultar Firestore al reingresar desde un dispositivo móvil', async () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: true }),
    });

    await component.ionViewWillEnter();
    await component.ionViewWillEnter();

    expect(auth.invalidarCache).toHaveBeenCalledOnce();
    expect(auth.obtenerPerfil).toHaveBeenCalledTimes(2);
  });
});
