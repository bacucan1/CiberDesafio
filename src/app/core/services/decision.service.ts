import { Injectable } from '@angular/core';
import { doc, getFirestore, runTransaction } from 'firebase/firestore';
import { firebaseApp } from '../firebase.config';
import { Decision } from '../models/domain.models';
import { ESCENARIOS } from '../data/escenarios.data';

@Injectable({ providedIn: 'root' })
export class DecisionService {
  private readonly firestore = getFirestore(firebaseApp);

  async guardar(decision: Decision): Promise<void> {
    const escenario = ESCENARIOS.find((item) => item.id === decision.escenarioId);
    const nodo = escenario?.nodos.find((item) => item.id === decision.nodoId);
    const opcion = nodo?.opciones.find((item) => item.id === decision.opcionElegida);
    if (!escenario || !nodo || !opcion) {
      throw new Error('La decisión no coincide con el catálogo local de escenarios.');
    }

    const perfilRef = doc(this.firestore, 'usuarios', decision.uid);
    await runTransaction(this.firestore, async (transaction) => {
      const perfil = await transaction.get(perfilRef);
      if (!perfil.exists()) throw new Error('No existe el perfil del estudiante.');
      const datosPerfil = perfil.data();
      if (datosPerfil['rol'] !== 'estudiante') {
        throw new Error('Solo los estudiantes pueden registrar resultados de juego.');
      }
      const grupoId = datosPerfil['grupoId'];
      if (typeof grupoId !== 'string' || !grupoId) return;

      const resultadoRef = doc(this.firestore, 'resultados_agregados', `${grupoId}_${escenario.eje}`);
      const participanteRef = doc(resultadoRef, 'participantes', decision.uid);
      const [resultado, participante] = await Promise.all([
        transaction.get(resultadoRef),
        transaction.get(participanteRef),
      ]);

      const cantidadEstudiantes = participante.exists()
        ? Number(resultado.data()?.['estudiantes'] ?? 0)
        : Number(resultado.data()?.['estudiantes'] ?? 0) + 1;
      const totalDecisiones = Number(resultado.data()?.['totalDecisiones'] ?? 0) + 1;
      const totalAciertos = Number(resultado.data()?.['totalAciertos'] ?? 0) + (opcion.correcta ? 1 : 0);
      const aciertosParticipante = Number(participante.data()?.['aciertos'] ?? 0) + (opcion.correcta ? 1 : 0);
      const decisionesParticipante = Number(participante.data()?.['decisiones'] ?? 0) + 1;
      const grupo = datosPerfil['grupo'];
      const institucion = datosPerfil['institucion'];

      if (typeof grupo !== 'string' || typeof institucion !== 'string' || !institucion) {
        throw new Error('El perfil vinculado no tiene los datos institucionales requeridos.');
      }

      transaction.set(participanteRef, {
        aciertos: aciertosParticipante,
        decisiones: decisionesParticipante,
      });
      transaction.set(resultadoRef, {
        grupoId,
        grupo,
        institucion,
        ...(typeof datosPerfil['grado'] === 'number' ? { grado: datosPerfil['grado'] } : {}),
        eje: escenario.eje,
        estudiantes: cantidadEstudiantes,
        totalAciertos,
        totalDecisiones,
        porcentajeAciertos: Math.round((totalAciertos / totalDecisiones) * 100),
        fechaCalculo: new Date().toISOString(),
      });
    });
  }
}
