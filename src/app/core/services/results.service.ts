import { Injectable } from '@angular/core';
import { collection, getDocs, getFirestore } from 'firebase/firestore';
import { ResultadoAgregado } from '../models/domain.models';
import type { EjeRiesgo } from '../models/domain.models';
import { firebaseApp } from '../firebase.config';

export interface ResultadoEstudiante {
  escenarioId: string;
  eje: EjeRiesgo;
  aciertos: number;
  decisiones: number;
}


const EJES_RIESGO: readonly string[] = ['fraude', 'relación de riesgo', 'higiene'];

@Injectable({ providedIn: 'root' })
export class ResultsService {
  private readonly firestore = getFirestore(firebaseApp);

  async obtenerPorGrupo(grupo: string, token: string): Promise<ResultadoAgregado[]> {
    const respuesta = await fetch(`/api/resultados/${encodeURIComponent(grupo)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!respuesta.ok) throw new Error('No se pudieron consultar los resultados.');
    return respuesta.json() as Promise<ResultadoAgregado[]>;
  }

  async obtenerResultadosEstudiante(uid: string): Promise<ResultadoEstudiante[]> {
    const snapshot = await getDocs(collection(this.firestore, 'usuarios', uid, 'resultados'));
    return snapshot.docs.map((documento) => {
      const data = documento.data();
      const eje = data['eje'];
      const aciertos = data['aciertos'];
      const decisiones = data['decisiones'];
      if (typeof eje !== 'string'
        || !EJES_RIESGO.includes(eje)
        || typeof aciertos !== 'number'
        || !Number.isSafeInteger(aciertos)
        || aciertos < 0
        || typeof decisiones !== 'number'
        || !Number.isSafeInteger(decisiones)
        || decisiones <= 0
        || aciertos > decisiones) {
        throw new Error(`El resultado de "${documento.id}" tiene datos inválidos.`);
      }

      return {
        escenarioId: documento.id,
        eje: eje as EjeRiesgo,
        aciertos,
        decisiones,
      };
    });
  }
}