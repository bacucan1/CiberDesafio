import { Injectable } from '@angular/core';
import { Decision, Escenario, NodoDecision, OpcionDecision } from '../models/domain.models';

@Injectable({ providedIn: 'root' })
export class SimulationService {
  obtenerNodo(escenario: Escenario, nodoId: string): NodoDecision | undefined {
    return escenario.nodos.find((nodo) => nodo.id === nodoId);
  }

  obtenerOpcion(nodo: NodoDecision, opcionId: string): OpcionDecision | undefined {
    return nodo.opciones.find((opcion) => opcion.id === opcionId);
  }

  crearDecision(escenarioId: string, nodo: NodoDecision, opcion: OpcionDecision, uid: string): Decision {
    return {
      uid,
      escenarioId,
      nodoId: nodo.id,
      opcionElegida: opcion.id,
      correcta: opcion.correcta,
      puntuacion: opcion.correcta ? 100 : 25,
      resultado: opcion.consecuencia,
      fecha: new Date().toISOString(),
    };
  }
}
