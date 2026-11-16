import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { DecisionService } from './decision.service';
import { Decision } from '../models/domain.models';

const QUEUE_PREFIX = 'ciberdesafio.pending-decisions.v1.';

@Injectable({ providedIn: 'root' })
export class DecisionQueueService {
  private readonly auth = inject(AuthService);
  private readonly decisionStore = inject(DecisionService);
  private readonly activeSyncs = new Map<string, Promise<number>>();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.reintentarAlConectar);
    }
  }

  async encolar(decision: Decision): Promise<void> {
    if (!decision.id) decision.id = this.nuevoId();
    const pendientes = this.leer(decision.uid);
    if (!pendientes.some((pendiente) => pendiente.id === decision.id)) {
      pendientes.push(decision);
      this.escribir(decision.uid, pendientes);
    }
  }

  sincronizarPendientes(uid: string): Promise<number> {
    const sincronizacionExistente = this.activeSyncs.get(uid);
    if (sincronizacionExistente) return sincronizacionExistente;

    const sincronizacion = this.procesarCola(uid).finally(() => {
      this.activeSyncs.delete(uid);
    });
    this.activeSyncs.set(uid, sincronizacion);
    return sincronizacion;
  }

  cantidadPendiente(uid: string): number {
    return this.leer(uid).length;
  }

  private async procesarCola(uid: string): Promise<number> {
    while (true) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return this.cantidadPendiente(uid);
      }

      const pendientes = this.leer(uid);
      if (!pendientes.length) return 0;

      for (const decision of pendientes) {
        try {
          await this.decisionStore.guardar(decision);
          const restantes = this.leer(uid).filter((pendiente) => pendiente.id !== decision.id);
          this.escribir(uid, restantes);
        } catch (error: unknown) {
          console.error('La decisión permanece en la cola local y se volverá a intentar.', error);
          throw error;
        }
      }
    }
  }

  private leer(uid: string): Decision[] {
    if (typeof window === 'undefined') return [];
    const datos = window.localStorage.getItem(this.clave(uid));
    if (!datos) return [];

    let valor: unknown;
    try {
      valor = JSON.parse(datos);
    } catch (error: unknown) {
      console.error('La cola local de decisiones tiene un formato no válido.', error);
      throw new Error('No se pudo leer el progreso pendiente de este dispositivo.');
    }

    if (!Array.isArray(valor) || !valor.every((item) => this.esDecision(item, uid))) {
      throw new Error('La cola local de decisiones no contiene datos válidos.');
    }
    return valor;
  }

  private escribir(uid: string, pendientes: Decision[]): void {
    if (typeof window === 'undefined') {
      throw new Error('El almacenamiento local no está disponible en este dispositivo.');
    }
    try {
      window.localStorage.setItem(this.clave(uid), JSON.stringify(pendientes));
    } catch (error: unknown) {
      console.error('No se pudo guardar localmente la cola de decisiones.', error);
      throw new Error('No se pudo guardar el progreso en este dispositivo. Libera espacio e inténtalo de nuevo.');
    }
  }

  private esDecision(valor: unknown, uid: string): valor is Decision {
    if (typeof valor !== 'object' || valor === null) return false;
    const decision = valor as Record<string, unknown>;
    return decision['uid'] === uid
      && typeof decision['id'] === 'string'
      && typeof decision['escenarioId'] === 'string'
      && typeof decision['nodoId'] === 'string'
      && typeof decision['opcionElegida'] === 'string'
      && typeof decision['correcta'] === 'boolean'
      && typeof decision['fecha'] === 'string';
  }

  private clave(uid: string): string {
    return `${QUEUE_PREFIX}${encodeURIComponent(uid)}`;
  }

  private nuevoId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    if (typeof crypto !== 'undefined') {
      const hexadecimal = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
        byte.toString(16).padStart(2, '0')).join('');
      return `${hexadecimal.slice(0, 8)}-${hexadecimal.slice(8, 12)}-${hexadecimal.slice(12, 16)}-${hexadecimal.slice(16, 20)}-${hexadecimal.slice(20)}`;
    }
    throw new Error('Este dispositivo no permite generar un identificador de decisión.');
  }

  private readonly reintentarAlConectar = (): void => {
    void this.auth.esperarSesion()
      .then((usuario) => usuario ? this.sincronizarPendientes(usuario.uid) : 0)
      .catch((error: unknown) => {
        console.error('No se pudieron sincronizar las decisiones al recuperar la conexión.', error);
      });
  };
}
