import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { Timestamp, deleteDoc, doc, getDoc, increment, runTransaction, setDoc, updateDoc } from 'firebase/firestore';

let environment: RulesTestEnvironment;
const grupoId = 'a'.repeat(64);
const codigoInvitacion = 'A1B2C3D4E5F6';
const grupoNuevoId = 'b'.repeat(64);
const codigoNuevo = 'F6E5D4C3B2A1';

beforeAll(async () => {
  environment = await initializeTestEnvironment({
    projectId: 'demo-ciberdesafio-security',
  });
});

afterAll(async () => {
  if (environment) await environment.cleanup();
});

beforeEach(async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore();
    await deleteDoc(doc(firestore, 'resultados_agregados', `${grupoId}_fraude`, 'participantes', 'estudiante-vinculado'));
    await deleteDoc(doc(firestore, 'grupos', grupoNuevoId));
    await deleteDoc(doc(firestore, 'codigos_vinculacion', codigoNuevo));
    for (const [collection, id] of [
      ['usuarios', 'estudiante-1'],
      ['usuarios', 'estudiante-vinculado'],
      ['usuarios', 'docente-1'],
      ['grupos', grupoId],
      ['codigos_vinculacion', codigoInvitacion],
      ['resultados_agregados', 'resultado-norte'],
      ['resultados_agregados', 'resultado-sur'],
      ['resultados_agregados', `${grupoId}_fraude`],
      ['decisiones', 'decision-estudiante'],
      ['decisiones', 'decision-otra'],
      ['solicitudes_docente', 'estudiante-1'],
    ]) {
      await deleteDoc(doc(firestore, collection, id));
    }
    await setDoc(doc(firestore, 'usuarios', 'estudiante-1'), {
      uid: 'estudiante-1',
      nombre: 'Estudiante',
      rol: 'estudiante',
      institucion: '',
    });
    await setDoc(doc(firestore, 'usuarios', 'docente-1'), {
      uid: 'docente-1',
      nombre: 'Docente',
      rol: 'docente',
      institucion: 'Colegio Norte',
    });
    await setDoc(doc(firestore, 'usuarios', 'estudiante-vinculado'), {
      uid: 'estudiante-vinculado',
      nombre: 'Estudiante Vinculado',
      rol: 'estudiante',
      institucion: 'Colegio Norte',
      grado: 9,
      grupo: '901-A',
      grupoId,
    });
    await setDoc(doc(firestore, 'grupos', grupoId), {
      institucion: 'Colegio Norte',
      grado: 9,
      grupo: '901-A',
      profesores: ['docente-1'],
      fechaActualizacion: Timestamp.now(),
    });
    await setDoc(doc(firestore, 'codigos_vinculacion', codigoInvitacion), {
      codigo: codigoInvitacion,
      grupoId,
      grupo: '901-A',
      institucion: 'Colegio Norte',
      grado: 9,
      creadoPor: 'docente-1',
      estado: 'activo',
      usos: 0,
      maxUsos: 30,
      venceEn: Timestamp.fromMillis(Date.now() + 60 * 60 * 1000),
      fechaCreacion: Timestamp.now(),
    });
    await setDoc(doc(firestore, 'resultados_agregados', 'resultado-norte'), {
      institucion: 'Colegio Norte',
      grupo: '901-A',
    });
    await setDoc(doc(firestore, 'resultados_agregados', 'resultado-sur'), {
      institucion: 'Colegio Sur',
      grupo: '901-A',
    });
    await setDoc(doc(firestore, 'decisiones', 'decision-estudiante'), {
      uid: 'estudiante-1',
      escenarioId: 'phishing',
      nodoId: 'inicio',
      opcionElegida: 'verificar',
      correcta: true,
      fecha: '2026-01-01T00:00:00.000Z',
    });
    await setDoc(doc(firestore, 'decisiones', 'decision-otra'), {
      uid: 'estudiante-2',
      escenarioId: 'phishing',
      nodoId: 'inicio',
      opcionElegida: 'verificar',
      correcta: true,
      fecha: '2026-01-01T00:00:00.000Z',
    });
  });
});

describe('Firestore access by role', () => {
  it('prevents a student from assigning or changing a teacher role', async () => {
    const firestore = environment.authenticatedContext('estudiante-1').firestore();

    await assertFails(updateDoc(doc(firestore, 'usuarios', 'estudiante-1'), { rol: 'docente' }));
    await assertFails(setDoc(doc(firestore, 'usuarios', 'estudiante-1'), {
      uid: 'estudiante-1',
      nombre: 'Estudiante',
      rol: 'docente',
      institucion: 'Colegio Norte',
    }));
  });

  it('prevents an account from creating a teacher profile for another user', async () => {
    const firestore = environment.authenticatedContext('estudiante-1').firestore();

    await assertFails(setDoc(doc(firestore, 'usuarios', 'estudiante-2'), {
      uid: 'estudiante-2',
      nombre: 'Nuevo docente',
      rol: 'docente',
      institucion: 'Colegio Norte',
    }));
  });

  it('prevents direct score writes and limits decision reads to their owner', async () => {
    const firestore = environment.authenticatedContext('estudiante-1').firestore();

    await assertFails(setDoc(doc(firestore, 'decisiones', 'decision-nueva'), {
      uid: 'estudiante-1',
      escenarioId: 'phishing',
      nodoId: 'inicio',
      opcionElegida: 'verificar',
      correcta: true,
      fecha: '2026-01-01T00:00:00.000Z',
    }));
    await assertFails(setDoc(doc(firestore, 'decisiones', 'decision-ajena'), {
      uid: 'estudiante-2',
      escenarioId: 'phishing',
      nodoId: 'inicio',
      opcionElegida: 'verificar',
      correcta: true,
      fecha: '2026-01-01T00:00:00.000Z',
    }));
    await assertSucceeds(getDoc(doc(firestore, 'decisiones', 'decision-estudiante')));
    await assertFails(getDoc(doc(firestore, 'decisiones', 'decision-otra')));
  });

  it('limits teacher results to the assigned institution', async () => {
    const firestore = environment.authenticatedContext('docente-1').firestore();

    await assertSucceeds(getDoc(doc(firestore, 'resultados_agregados', 'resultado-norte')));
    await assertFails(getDoc(doc(firestore, 'resultados_agregados', 'resultado-sur')));
    await assertFails(updateDoc(doc(firestore, 'usuarios', 'docente-1'), { rol: 'estudiante' }));
  });

  it('does not allow students to read teacher-only results', async () => {
    const firestore = environment.authenticatedContext('estudiante-1').firestore();

    await assertFails(getDoc(doc(firestore, 'resultados_agregados', 'resultado-norte')));
  });

  it('allows a student to request teacher approval but not to approve themselves', async () => {
    const firestore = environment.authenticatedContext('estudiante-1', {
      email: 'estudiante@example.com',
    }).firestore();
    const request = doc(firestore, 'solicitudes_docente', 'estudiante-1');

    await assertSucceeds(setDoc(request, {
      uid: 'estudiante-1',
      correo: 'estudiante@example.com',
      nombre: 'Estudiante',
      institucionSolicitada: 'Universidad Libre',
      estado: 'pendiente',
      fechaSolicitud: '2026-01-01T00:00:00.000Z',
    }));
    await assertFails(updateDoc(request, { estado: 'aprobada' }));
    await assertFails(setDoc(doc(firestore, 'solicitudes_docente', 'estudiante-2'), {
      uid: 'estudiante-2',
      correo: 'estudiante@example.com',
      nombre: 'Estudiante',
      institucionSolicitada: 'Universidad Libre',
      estado: 'pendiente',
      fechaSolicitud: '2026-01-01T00:00:00.000Z',
    }));
  });

  it('allows a student to redeem an invitation only as an atomic profile-and-usage update', async () => {
    const firestore = environment.authenticatedContext('estudiante-1').firestore();

    await assertSucceeds(runTransaction(firestore, async (transaction) => {
      const profileRef = doc(firestore, 'usuarios', 'estudiante-1');
      const inviteRef = doc(firestore, 'codigos_vinculacion', codigoInvitacion);
      const [profile, invite] = await Promise.all([
        transaction.get(profileRef),
        transaction.get(inviteRef),
      ]);
      if (!profile.exists() || !invite.exists()) throw new Error('Fixture missing.');
      transaction.update(profileRef, {
        institucion: 'Colegio Norte',
        grupo: '901-A',
        grado: 9,
        grupoId,
        codigoVinculacion: codigoInvitacion,
        fechaActualizacion: new Date().toISOString(),
      });
      transaction.update(inviteRef, { usos: increment(1) });
    }));

    await assertFails(updateDoc(doc(firestore, 'usuarios', 'estudiante-1'), {
      institucion: 'Colegio Sur',
      grupo: '901-A',
      grado: 9,
      grupoId,
      codigoVinculacion: codigoInvitacion,
    }));
  });

  it('allows a linked student to add aggregate counters without exposing participant records to teachers', async () => {
    const firestore = environment.authenticatedContext('estudiante-vinculado').firestore();
    const resultRef = doc(firestore, 'resultados_agregados', `${grupoId}_fraude`);
    const participantRef = doc(resultRef, 'participantes', 'estudiante-vinculado');

    await assertSucceeds(runTransaction(firestore, async (transaction) => {
      const [result, participant] = await Promise.all([
        transaction.get(resultRef),
        transaction.get(participantRef),
      ]);
      if (result.exists() || participant.exists()) throw new Error('Fixture was not cleared.');
      transaction.set(participantRef, { aciertos: 1, decisiones: 1 });
      transaction.set(resultRef, {
        grupoId,
        grupo: '901-A',
        institucion: 'Colegio Norte',
        grado: 9,
        eje: 'fraude',
        estudiantes: 1,
        totalAciertos: 1,
        totalDecisiones: 1,
        porcentajeAciertos: 100,
        fechaCalculo: new Date().toISOString(),
      });
    }));

    await assertSucceeds(runTransaction(firestore, async (transaction) => {
      const [result, participant] = await Promise.all([
        transaction.get(resultRef),
        transaction.get(participantRef),
      ]);
      if (!result.exists() || !participant.exists()) throw new Error('Aggregate fixture missing.');
      transaction.update(participantRef, { aciertos: 1, decisiones: 2 });
      transaction.update(resultRef, {
        totalAciertos: 1,
        totalDecisiones: 2,
        porcentajeAciertos: 50,
        fechaCalculo: new Date().toISOString(),
      });
    }));

    const teacherDb = environment.authenticatedContext('docente-1').firestore();
    await assertSucceeds(getDoc(doc(teacherDb, 'resultados_agregados', `${grupoId}_fraude`)));
    await assertFails(getDoc(doc(teacherDb, 'resultados_agregados', `${grupoId}_fraude`, 'participantes', 'estudiante-vinculado')));
    await assertSucceeds(getDoc(participantRef));
  });

  it('allows an approved teacher to create a group invitation and revoke it', async () => {
    const firestore = environment.authenticatedContext('docente-1').firestore();
    const groupRef = doc(firestore, 'grupos', grupoNuevoId);
    const inviteRef = doc(firestore, 'codigos_vinculacion', codigoNuevo);

    await assertSucceeds(runTransaction(firestore, async (transaction) => {
      const group = await transaction.get(groupRef);
      if (group.exists()) throw new Error('Fixture was not cleared.');
      transaction.set(groupRef, {
        institucion: 'Colegio Norte',
        grupo: '902-B',
        grado: 10,
        profesores: ['docente-1'],
        fechaActualizacion: Timestamp.now(),
      });
      transaction.set(inviteRef, {
        codigo: codigoNuevo,
        grupoId: grupoNuevoId,
        grupo: '902-B',
        institucion: 'Colegio Norte',
        grado: 10,
        creadoPor: 'docente-1',
        estado: 'activo',
        usos: 0,
        maxUsos: 30,
        venceEn: Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000),
        fechaCreacion: Timestamp.now(),
      });
    }));

    await assertSucceeds(updateDoc(inviteRef, {
      estado: 'revocado',
      revocadoEn: Timestamp.now(),
    }));
    await assertFails(getDoc(doc(environment.authenticatedContext('estudiante-1').firestore(), 'codigos_vinculacion', codigoNuevo)));
  });

  it('rejects aggregate counter changes without the matching participant increment', async () => {
    const firestore = environment.authenticatedContext('estudiante-vinculado').firestore();
    await assertFails(setDoc(doc(firestore, 'resultados_agregados', `${grupoId}_fraude`), {
      grupoId,
      grupo: '901-A',
      institucion: 'Colegio Norte',
      grado: 9,
      eje: 'fraude',
      estudiantes: 10,
      totalAciertos: 10,
      totalDecisiones: 10,
      porcentajeAciertos: 100,
      fechaCalculo: new Date().toISOString(),
    }));
  });
});
