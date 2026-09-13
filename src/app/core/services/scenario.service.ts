import { Injectable } from '@angular/core';
import { RUTAS_CIBERDESAFIO } from '../data/escenarios.data';
import { Escenario } from '../models/domain.models';

@Injectable({ providedIn: 'root' })
export class ScenarioService {
  obtenerTodos(): Escenario[] {
    return RUTAS_CIBERDESAFIO;
  }

  obtenerPorId(id: string): Escenario | undefined {
    return this.obtenerTodos().find((escenario) => escenario.id === id);
  }
}