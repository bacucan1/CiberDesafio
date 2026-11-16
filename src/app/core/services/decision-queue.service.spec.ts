import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { DecisionQueueService } from './decision-queue.service';
import { DecisionService } from './decision.service';
import { Decision } from '../models/domain.models';

describe('DecisionQueueService', () => {
  const uid = 'queue-test-student';
  const storageKey = `ciberdesafio.pending-decisions.v1.${uid}`;
  let queue: DecisionQueueService;
  let store: { guardar: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    window.localStorage.removeItem(storageKey);
    store = { guardar: vi.fn().mockResolvedValue(undefined) };
    TestBed.configureTestingModule({
      providers: [
        DecisionQueueService,
        { provide: AuthService, useValue: { esperarSesion: vi.fn().mockResolvedValue(null) } },
        { provide: DecisionService, useValue: store },
      ],
    });
    queue = TestBed.inject(DecisionQueueService);
  });

  afterEach(() => {
    window.localStorage.removeItem(storageKey);
    TestBed.resetTestingModule();
  });

  it('guarda localmente y sincroniza una decisión pendiente', async () => {
    const decision: Decision = {
      uid,
      escenarioId: 'phishing',
      nodoId: 'inicio',
      opcionElegida: 'verificar',
      correcta: true,
      fecha: new Date().toISOString(),
    };

    await queue.encolar(decision);
    expect(queue.cantidadPendiente(uid)).toBe(1);
    expect(decision.id).toBeTruthy();

    await expect(queue.sincronizarPendientes(uid)).resolves.toBe(0);

    expect(store.guardar).toHaveBeenCalledWith(decision);
    expect(queue.cantidadPendiente(uid)).toBe(0);
  });

  it('conserva la decisión local cuando la sincronización falla', async () => {
    store.guardar.mockRejectedValue(new Error('permission-denied'));
    const decision = {
      id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      uid,
      escenarioId: 'phishing',
      nodoId: 'inicio',
      opcionElegida: 'verificar',
      correcta: true,
      fecha: new Date().toISOString(),
    };

    await queue.encolar(decision);
    await expect(queue.sincronizarPendientes(uid)).rejects.toThrow('permission-denied');

    expect(queue.cantidadPendiente(uid)).toBe(1);
  });

  it('no agrega dos veces una decisión con el mismo identificador', async () => {
    const decision = {
      id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      uid,
      escenarioId: 'phishing',
      nodoId: 'inicio',
      opcionElegida: 'verificar',
      correcta: true,
      fecha: new Date().toISOString(),
    };

    await queue.encolar(decision);
    await queue.encolar(decision);

    expect(queue.cantidadPendiente(uid)).toBe(1);
  });
});
