import { Injectable } from '@angular/core';
import { ResultadoAgregado } from '../models/domain.models';

@Injectable({ providedIn: 'root' })
export class ResultsService {
  async obtenerPorGrupo(grupo: string, token: string): Promise<ResultadoAgregado[]> {
    const respuesta = await fetch(`/api/resultados/${encodeURIComponent(grupo)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!respuesta.ok) throw new Error('No se pudieron consultar los resultados.');
    return respuesta.json() as Promise<ResultadoAgregado[]>;
  }
}