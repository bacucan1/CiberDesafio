import { Injectable } from '@angular/core';
import { RUTAS_CIBERDESAFIO } from '../data/escenarios.data';
import { Escenario } from '../models/domain.models';

@Injectable({ providedIn: 'root' })
export class ScenarioService {
  private readonly escenariosPorId = new Map<string, Escenario>(
    RUTAS_CIBERDESAFIO.map((escenario) => [escenario.id, escenario]),
  );

  obtenerTodos(): Escenario[] {
    return RUTAS_CIBERDESAFIO;
  }

  obtenerPorId(id: string): Escenario | undefined {
    return this.escenariosPorId.get(id);
  }
}
