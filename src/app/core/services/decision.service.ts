import { Injectable } from '@angular/core';
import { doc, getFirestore, runTransaction } from 'firebase/firestore';
import type { DocumentData, DocumentReference } from 'firebase/firestore';
import { firebaseApp } from '../firebase.config';
import { Decision } from '../models/domain.models';
import { ESCENARIOS } from '../data/escenarios.data';

const EJES = ['fraude', 'relación de riesgo', 'higiene'] as const;

@Injectable({ providedIn: 'root' })
export class DecisionService {
  private readonly firestore = getFirestore(firebaseApp);

  async guardarDesafioAi(
    uid: string,
    desafio: { id: string; puntos: number; correcta: boolean },
  ): Promise<boolean> {
    if (!/^[a-f0-9-]{32,36}$/.test(desafio.id)
      || (desafio.correcta ? desafio.puntos !== 120 : desafio.puntos !== 25)) {
      throw new Error('El resultado del desafío de IA no es válido.');
    }

    const perfilRef = doc(this.firestore, 'usuarios', uid);
    const eventoRef = doc(this.firestore, 'usuarios', uid, 'resultados_ai', desafio.id);
    let guardado = false;
    await runTransaction(this.firestore, async (transaction) => {
      const [perfil, evento] = await Promise.all([
        transaction.get(perfilRef),
        transaction.get(eventoRef),
      ]);
      if (!perfil.exists() || perfil.data()['rol'] !== 'estudiante') {
        throw new Error('Solo los estudiantes pueden registrar resultados de desafíos.');
      }
      if (evento.exists()) return;

      const grupoId = perfil.data()['grupoId'];
      let miembroRef: DocumentReference<DocumentData> | undefined;
      let miembroDatos: DocumentData | undefined;
      if (typeof grupoId === 'string' && grupoId) {
        miembroRef = doc(this.firestore, 'grupos', grupoId, 'estudiantes', uid);
        const miembro = await transaction.get(miembroRef);
        if (!miembro.exists()) {
          throw new Error('No encontramos tu registro de progreso en el grupo vinculado.');
        }
        miembroDatos = miembro.data();
      }

      const fecha = new Date().toISOString();
      transaction.set(eventoRef, {
        puntos: desafio.puntos,
        correcta: desafio.correcta,
        fecha,
      });
      if (miembroRef && miembroDatos) {
        const xp = this.contador(miembroDatos['xp'], 'XP');
        const xpAi = this.contador(miembroDatos['xpAi'] ?? 0, 'XP de IA');
        const desafiosAi = this.contador(miembroDatos['desafiosAi'] ?? 0, 'desafíos de IA');
        const aciertosAi = this.contador(miembroDatos['aciertosAi'] ?? 0, 'aciertos de IA');
        transaction.update(miembroRef, {
          xp: xp + desafio.puntos,
          xpAi: xpAi + desafio.puntos,
          desafiosAi: desafiosAi + 1,
          aciertosAi: aciertosAi + (desafio.correcta ? 1 : 0),
          ultimoDesafioAi: desafio.id,
          fechaActualizacion: fecha,
        });
      }
      guardado = true;
    });
    return guardado;
  }

  async guardar(decision: Decision): Promise<void> {
    const escenario = ESCENARIOS.find((item) => item.id === decision.escenarioId);
    const nodo = escenario?.nodos.find((item) => item.id === decision.nodoId);
    const opcion = nodo?.opciones.find((item) => item.id === decision.opcionElegida);
    if (!escenario || !nodo || !opcion) {
      throw new Error('La decisión no coincide con el catálogo local de escenarios.');
    }
    const decisionId = decision.id;
    if (!decisionId) {
      throw new Error('La decisión no tiene un identificador para evitar duplicados al sincronizar.');
    }

    const perfilRef = doc(this.firestore, 'usuarios', decision.uid);
    await runTransaction(this.firestore, async (transaction) => {
      const perfil = await transaction.get(perfilRef);
      if (!perfil.exists()) throw new Error('No existe el perfil del estudiante.');
      const datosPerfil = perfil.data();
      if (datosPerfil['rol'] !== 'estudiante') {
        throw new Error('Solo los estudiantes pueden registrar resultados de juego.');
      }

      const resultadoEstudianteRef = doc(perfilRef, 'resultados', escenario.id);
      const decisionProcesadaRef = doc(resultadoEstudianteRef, 'procesadas', decisionId);
      const [resultadoEstudiante, decisionProcesada] = await Promise.all([
        transaction.get(resultadoEstudianteRef),
        transaction.get(decisionProcesadaRef),
      ]);
      if (decisionProcesada.exists()) return;

      const aciertosEstudiante = Number(resultadoEstudiante.data()?.['aciertos'] ?? 0) + (opcion.correcta ? 1 : 0);
      const decisionesEstudiante = Number(resultadoEstudiante.data()?.['decisiones'] ?? 0) + 1;
      const puntosEstudiante = Number(resultadoEstudiante.data()?.['puntos'] ?? 0) + (decision.puntuacion ?? (opcion.correcta ? 100 : 25));
      const resultadoEstudianteDatos = {
        escenarioId: escenario.id,
        eje: escenario.eje,
        aciertos: aciertosEstudiante,
        decisiones: decisionesEstudiante,
        porcentajeAciertos: Math.round((aciertosEstudiante / decisionesEstudiante) * 100),
        puntos: puntosEstudiante,
        fechaActualizacion: new Date().toISOString(),
      };

      const grupoId = datosPerfil['grupoId'];
      if (typeof grupoId !== 'string' || !grupoId) {
        transaction.set(resultadoEstudianteRef, resultadoEstudianteDatos);
        transaction.set(decisionProcesadaRef, { fecha: decision.fecha });
        return;
      }

      const resultadoRef = doc(this.firestore, 'resultados_agregados', `${grupoId}_${escenario.eje}`);
      const miembroRef = doc(this.firestore, 'grupos', grupoId, 'estudiantes', decision.uid);
      const referenciasParticipantes = EJES.map((eje) => doc(
        this.firestore,
        'resultados_agregados',
        `${grupoId}_${eje}`,
        'participantes',
        decision.uid,
      ));
      const [resultado, miembro, ...participantesPorEje] = await Promise.all([
        transaction.get(resultadoRef),
        transaction.get(miembroRef),
        ...referenciasParticipantes.map((referencia) => transaction.get(referencia)),
      ]);
      const indiceEje = EJES.indexOf(escenario.eje);
      const participanteRef = referenciasParticipantes[indiceEje];
      const participante = participantesPorEje[indiceEje];

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

      const nombre = datosPerfil['nombre'];
      if (typeof nombre !== 'string' || !nombre.trim()) {
        throw new Error('El perfil vinculado no tiene un nombre válido para el grupo.');
      }
      const resumenAnterior: {
        misionesCompletadas: number;
        xp: number;
        aciertos: number;
        decisiones: number;
        xpAi: number;
        desafiosAi: number;
        aciertosAi: number;
        ultimoDesafioAi?: string;
        fechaVinculacion: string;
      } = miembro.exists()
        ? {
          misionesCompletadas: this.contador(miembro.data()['misionesCompletadas'], 'misiones completadas'),
          xp: this.contador(miembro.data()['xp'], 'XP'),
          aciertos: this.contador(miembro.data()['aciertos'], 'aciertos'),
          decisiones: this.contador(miembro.data()['decisiones'], 'decisiones'),
          xpAi: this.contador(miembro.data()['xpAi'] ?? 0, 'XP de IA'),
          desafiosAi: this.contador(miembro.data()['desafiosAi'] ?? 0, 'desafíos de IA'),
          aciertosAi: this.contador(miembro.data()['aciertosAi'] ?? 0, 'aciertos de IA'),
          ...(typeof miembro.data()['ultimoDesafioAi'] === 'string'
            ? { ultimoDesafioAi: miembro.data()['ultimoDesafioAi'] as string }
            : {}),
          fechaVinculacion: miembro.data()['fechaVinculacion'],
        }
        : this.resumenParticipantesLegados(participantesPorEje);
      if (typeof resumenAnterior.fechaVinculacion !== 'string') {
        throw new Error('El registro de progreso del estudiante no tiene una fecha de vinculación válida.');
      }
      const misionCompletada = this.terminaEscenario(escenario.nodos, opcion.siguienteNodoId);
      const puntuacion = decision.puntuacion ?? (opcion.correcta ? 100 : 25);
      const resumenActualizado = {
        uid: decision.uid,
        nombre: nombre.trim(),
        misionesCompletadas: resumenAnterior.misionesCompletadas + (misionCompletada ? 1 : 0),
        xp: resumenAnterior.xp + puntuacion,
        xpAi: resumenAnterior.xpAi,
        desafiosAi: resumenAnterior.desafiosAi,
        aciertosAi: resumenAnterior.aciertosAi,
        ...(typeof resumenAnterior.ultimoDesafioAi === 'string'
          ? { ultimoDesafioAi: resumenAnterior.ultimoDesafioAi }
          : {}),
        aciertos: resumenAnterior.aciertos + (opcion.correcta ? 1 : 0),
        decisiones: resumenAnterior.decisiones + 1,
        fechaVinculacion: resumenAnterior.fechaVinculacion,
        fechaActualizacion: new Date().toISOString(),
      };

      transaction.set(resultadoEstudianteRef, resultadoEstudianteDatos);
      transaction.set(decisionProcesadaRef, { fecha: decision.fecha });
      transaction.set(miembroRef, resumenActualizado);
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

  private contador(valor: unknown, etiqueta: string): number {
    if (typeof valor !== 'number' || !Number.isSafeInteger(valor) || valor < 0) {
      throw new Error(`El contador de ${etiqueta} del estudiante no es válido.`);
    }
    return valor;
  }

  private resumenParticipantesLegados(
    participantes: { exists(): boolean; data(): Record<string, unknown> | undefined }[],
  ): {
    misionesCompletadas: number;
    xp: number;
    aciertos: number;
    decisiones: number;
    xpAi: number;
    desafiosAi: number;
    aciertosAi: number;
    ultimoDesafioAi?: string;
    fechaVinculacion: string;
  } {
    let aciertos = 0;
    let decisiones = 0;
    for (const participante of participantes) {
      if (!participante.exists()) continue;
      const data = participante.data();
      if (!data) throw new Error('No se pudo leer el progreso agregado del estudiante.');
      aciertos += this.contador(data['aciertos'], 'aciertos');
      decisiones += this.contador(data['decisiones'], 'decisiones');
    }
    if (aciertos > decisiones) {
      throw new Error('El progreso acumulado del estudiante no es consistente.');
    }
    return {
      misionesCompletadas: 0,
      xp: aciertos * 100 + (decisiones - aciertos) * 25,
      aciertos,
      decisiones,
      xpAi: 0,
      desafiosAi: 0,
      aciertosAi: 0,
      fechaVinculacion: new Date().toISOString(),
    };
  }

  private terminaEscenario(
    nodos: { id: string; opciones: { id: string }[] }[],
    siguienteNodoId: string | undefined,
  ): boolean {
    if (!siguienteNodoId) return true;
    const siguienteNodo = nodos.find((nodo) => nodo.id === siguienteNodoId);
    if (!siguienteNodo) throw new Error('La opción apunta a una situación que no existe.');
    return siguienteNodo.opciones.length === 0;
  }
}
