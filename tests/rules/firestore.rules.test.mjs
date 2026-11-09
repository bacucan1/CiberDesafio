// Ejecutar con npm run test:security (requiere Firebase CLI y Java 21+).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, it } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, setDoc, Timestamp, updateDoc, where } from 'firebase/firestore';

const INSTITUCION = 'Colegio Central';
const GRUPO_ID = 'a'.repeat(64);
const CODIGO_DOCENTE = 'colegio-central-TEACHER42';
const CODIGO_DOCENTE_PRUEBA = 'colegio-central-OTHER42';
const CODIGO_GRUPO = 'AABBCCDDEEFF';
let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-ciberdesafio',
    firestore: { rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8') },
  });
});
after(async () => { await env.cleanup(); });

const como = (uid) => env.authenticatedContext(uid).firestore();
const perfilEstudiante = (uid, extra = {}) => ({
  uid, nombre: 'Estudiante', rol: 'estudiante', institucion: '', fechaActualizacion: new Date().toISOString(), ...extra,
});
const perfilDocente = (uid, institucion = INSTITUCION, extra = {}) => ({
  uid, nombre: 'Docente', rol: 'docente', institucion, codigoInvitacion: CODIGO_DOCENTE, ...extra,
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all([
      setDoc(doc(db, 'usuarios/est1'), perfilEstudiante('est1')),
      setDoc(doc(db, 'usuarios/est2'), perfilEstudiante('est2')),
      setDoc(doc(db, 'usuarios/docA'), perfilDocente('docA')),
      setDoc(doc(db, 'usuarios/docB'), perfilDocente('docB', 'Colegio Norte', { codigoInvitacion: 'colegio-norte-TEACHER42' })),
      setDoc(doc(db, `codigos_invitacion/${CODIGO_DOCENTE}`), { activo: true, institucion: INSTITUCION, usos: 0, maxUsos: 1 }),
      setDoc(doc(db, `codigos_invitacion/${CODIGO_DOCENTE_PRUEBA}`), {
        activo: true, institucion: INSTITUCION, usos: 0, maxUsos: 1,
      }),
      setDoc(doc(db, 'codigos_invitacion/colegio-central-DESACTIVADO'), {
        activo: false, institucion: INSTITUCION, usos: 0, maxUsos: 1,
      }),
      setDoc(doc(db, `grupos/${GRUPO_ID}`), {
        institucion: INSTITUCION, grupo: '901-A', grado: 9, profesores: ['docA'], fechaActualizacion: Timestamp.now(),
      }),
      setDoc(doc(db, `codigos_vinculacion/${CODIGO_GRUPO}`), {
        codigo: CODIGO_GRUPO, grupoId: GRUPO_ID, grupo: '901-A', grado: 9, institucion: INSTITUCION,
        creadoPor: 'docA', estado: 'activo', usos: 0, maxUsos: 1,
        venceEn: Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000)), fechaCreacion: Timestamp.now(),
      }),
      setDoc(doc(db, `resultados_agregados/${GRUPO_ID}_fraude`), {
        grupoId: GRUPO_ID, grupo: '901-A', grado: 9, institucion: INSTITUCION, eje: 'fraude',
        estudiantes: 1, totalAciertos: 1, totalDecisiones: 2, porcentajeAciertos: 50,
        fechaCalculo: new Date().toISOString(),
      }),
      setDoc(doc(db, `resultados_agregados/${GRUPO_ID}_fraude/participantes/est1`), { aciertos: 1, decisiones: 2 }),
    ]);
    await setDoc(doc(db, 'usuarios/est-vinculado'), perfilEstudiante('est-vinculado', {
      institucion: INSTITUCION, grupo: '901-A', grupoId: GRUPO_ID, grado: 9, codigoVinculacion: CODIGO_GRUPO,
    }));
  });
});

describe('registro y protección de perfiles', () => {
  it('permite crear perfiles de estudiante sin datos académicos', async () => {
    await assertSucceeds(setDoc(doc(como('nuevo'), 'usuarios/nuevo'), perfilEstudiante('nuevo')));
  });

  it('permite solicitar datos de perfil faltantes sin modificar el perfil ni el rol', async () => {
    const solicitud = {
      uid: 'docA',
      rol: 'docente',
      nombre: 'Docente',
      institucion: 'Colegio Nuevo',
      estado: 'pendiente',
      fechaSolicitud: serverTimestamp(),
    };
    await assertSucceeds(setDoc(doc(como('docA'), 'solicitudes_actualizacion_perfil/docA'), solicitud));
    await assertFails(setDoc(doc(como('est1'), 'solicitudes_actualizacion_perfil/est1'), {
      ...solicitud,
      uid: 'est1',
      rol: 'docente',
    }));
    await assertFails(updateDoc(doc(como('docA'), 'usuarios/docA'), { institucion: 'Colegio Nuevo' }));
  });

  it('permite registro docente de prueba y conserva la validación del código administrativo', async () => {
    const crearDocente = (uid, institucion, codigo = CODIGO_DOCENTE) => {
      const db = como(uid);
      const perfilRef = doc(db, `usuarios/${uid}`);
      const codigoRef = doc(db, `codigos_invitacion/${codigo}`);
      return runTransaction(db, async (transaction) => {
        const codigoActual = await transaction.get(codigoRef);
        transaction.update(codigoRef, { usos: codigoActual.data().usos + 1 });
        transaction.set(perfilRef, {
          uid, nombre: 'Docente Nuevo', rol: 'docente', institucion, codigoInvitacion: codigo,
          fechaActualizacion: new Date().toISOString(),
        });
      });
    };

    await assertSucceeds(crearDocente('doc-nuevo', INSTITUCION));
    await assertSucceeds(setDoc(doc(como('doc-prueba'), 'usuarios/doc-prueba'), {
      uid: 'doc-prueba', nombre: 'Docente de prueba', rol: 'docente', institucion: 'Institución ficticia',
      modoPrueba: true,
    }));
    await assertFails(setDoc(doc(como('doc-sin-marca'), 'usuarios/doc-sin-marca'), {
      uid: 'doc-sin-marca', nombre: 'Docente', rol: 'docente', institucion: INSTITUCION,
    }));
    await assertFails(crearDocente('doc-otra', 'Otra institución', CODIGO_DOCENTE_PRUEBA));
    await assertFails(crearDocente('doc-inactivo', INSTITUCION, 'colegio-central-DESACTIVADO'));
    await assertFails(crearDocente('doc-segundo-uso', INSTITUCION));
    await assertFails(setDoc(doc(como('estudiante-prueba'), 'usuarios/estudiante-prueba'), {
      uid: 'estudiante-prueba', nombre: 'Estudiante', rol: 'estudiante', institucion: '',
      modoPrueba: true,
    }));
  });

  it('permite cambiar el nombre, pero no rol ni institución académica', async () => {
    await assertSucceeds(updateDoc(doc(como('est1'), 'usuarios/est1'), {
      nombre: 'Nombre actualizado', fechaActualizacion: new Date().toISOString(),
    }));
    await assertFails(updateDoc(doc(como('est1'), 'usuarios/est1'), { rol: 'docente' }));
    await assertFails(updateDoc(doc(como('est-vinculado'), 'usuarios/est-vinculado'), { institucion: 'Otra institución' }));
    await assertFails(updateDoc(doc(como('est-vinculado'), 'usuarios/est-vinculado'), { grupo: 'Otro grupo' }));
  });

  it('cada usuario solo puede consultar su propio perfil', async () => {
    await assertSucceeds(getDoc(doc(como('est1'), 'usuarios/est1')));
    await assertFails(getDoc(doc(como('est1'), 'usuarios/est2')));
    await assertFails(getDocs(collection(como('docA'), 'usuarios')));
  });
});

describe('vinculación de estudiantes con código de grupo', () => {
  it('rechaza códigos vencidos, revocados o sin cupos', async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      const base = {
        codigo: 'ABCDEF123456', grupoId: GRUPO_ID, grupo: '901-A', grado: 9, institucion: INSTITUCION,
        creadoPor: 'docA', usos: 0, maxUsos: 30, fechaCreacion: Timestamp.now(),
      };
      await Promise.all([
        setDoc(doc(db, 'codigos_vinculacion/ABCDEF123456'), {
          ...base, estado: 'activo', venceEn: Timestamp.fromDate(new Date(Date.now() - 60_000)),
        }),
        setDoc(doc(db, 'codigos_vinculacion/ABCDEF123457'), {
          ...base, codigo: 'ABCDEF123457', estado: 'revocado',
          venceEn: Timestamp.fromDate(new Date(Date.now() + 60_000)),
        }),
        setDoc(doc(db, 'codigos_vinculacion/ABCDEF123458'), {
          ...base, codigo: 'ABCDEF123458', estado: 'activo', usos: 30,
          venceEn: Timestamp.fromDate(new Date(Date.now() + 60_000)),
        }),
      ]);
    });

    await assertFails(getDoc(doc(como('est1'), 'codigos_vinculacion/ABCDEF123456')));
    await assertFails(getDoc(doc(como('est1'), 'codigos_vinculacion/ABCDEF123457')));
    await assertFails(getDoc(doc(como('est1'), 'codigos_vinculacion/ABCDEF123458')));
  });

  it('actualiza perfil y uso del código en una única transacción validada', async () => {
    const db = como('est1');
    const perfilRef = doc(db, 'usuarios/est1');
    const codigoRef = doc(db, `codigos_vinculacion/${CODIGO_GRUPO}`);
    await assertSucceeds(runTransaction(db, async (transaction) => {
      const [perfil, codigo] = await Promise.all([transaction.get(perfilRef), transaction.get(codigoRef)]);
      assert.equal(perfil.exists(), true);
      assert.equal(codigo.exists(), true);
      transaction.update(perfilRef, {
        institucion: INSTITUCION, grupo: '901-A', grupoId: GRUPO_ID, grado: 9,
        codigoVinculacion: CODIGO_GRUPO, fechaActualizacion: new Date().toISOString(),
      });
      transaction.update(codigoRef, { usos: codigo.data().usos + 1 });
    }));
    const perfilActualizado = await getDoc(perfilRef);
    assert.equal(perfilActualizado.data().institucion, INSTITUCION);
    assert.equal(perfilActualizado.data().grupoId, GRUPO_ID);
  });

  it('rechaza vincularse con otro grupo o usar dos veces un código agotado', async () => {
    const db = como('est1');
    const perfilRef = doc(db, 'usuarios/est1');
    const codigoRef = doc(db, `codigos_vinculacion/${CODIGO_GRUPO}`);
    await assertFails(runTransaction(db, async (transaction) => {
      await Promise.all([transaction.get(perfilRef), transaction.get(codigoRef)]);
      transaction.update(perfilRef, {
        institucion: INSTITUCION, grupo: 'Grupo falsificado', grupoId: GRUPO_ID, grado: 9,
        codigoVinculacion: CODIGO_GRUPO, fechaActualizacion: new Date().toISOString(),
      });
      transaction.update(codigoRef, { usos: 1 });
    }));

    await runTransaction(db, async (transaction) => {
      const [perfil, codigo] = await Promise.all([transaction.get(perfilRef), transaction.get(codigoRef)]);
      transaction.update(perfilRef, {
        institucion: INSTITUCION, grupo: '901-A', grupoId: GRUPO_ID, grado: 9,
        codigoVinculacion: CODIGO_GRUPO, fechaActualizacion: new Date().toISOString(),
      });
      transaction.update(codigoRef, { usos: codigo.data().usos + 1 });
      assert.equal(perfil.exists(), true);
    });

    await assertFails(runTransaction(db, async (transaction) => {
      const [perfil, codigo] = await Promise.all([transaction.get(perfilRef), transaction.get(codigoRef)]);
      transaction.update(perfilRef, {
        institucion: INSTITUCION, grupo: '901-A', grupoId: GRUPO_ID, grado: 9,
        codigoVinculacion: CODIGO_GRUPO, fechaActualizacion: new Date().toISOString(),
      });
      transaction.update(codigoRef, { usos: codigo.data().usos + 1 });
    }));
  });

  it('permite a un docente crear un grupo y su código de invitación juntos', async () => {
    const db = como('docA');
    const nuevoGrupoId = 'b'.repeat(64);
    const nuevoCodigo = '112233AABBCC';
    const grupoRef = doc(db, `grupos/${nuevoGrupoId}`);
    const codigoRef = doc(db, `codigos_vinculacion/${nuevoCodigo}`);
    await assertSucceeds(runTransaction(db, async (transaction) => {
      await transaction.get(grupoRef);
      transaction.set(grupoRef, {
        institucion: INSTITUCION, grupo: '1001-B', grado: 10, profesores: ['docA'], fechaActualizacion: Timestamp.now(),
      });
      transaction.set(codigoRef, {
        codigo: nuevoCodigo, grupoId: nuevoGrupoId, grupo: '1001-B', grado: 10, institucion: INSTITUCION,
        creadoPor: 'docA', estado: 'activo', usos: 0, maxUsos: 30,
        venceEn: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)), fechaCreacion: Timestamp.now(),
      });
    }));
  });

  it('limita la lista de grupos del docente a los de su institución', async () => {
    const db = como('docA');
    await assertSucceeds(getDocs(query(
      collection(db, 'grupos'),
      where('profesores', 'array-contains', 'docA'),
      where('institucion', '==', INSTITUCION),
    )));
    await assertFails(getDocs(query(
      collection(db, 'grupos'),
      where('profesores', 'array-contains', 'docA'),
    )));
  });
});

describe('resultados agregados y privacidad', () => {
  it('guarda el resultado por ejercicio en la cuenta y lo mantiene privado', async () => {
    const resultadoRef = doc(como('est1'), 'usuarios/est1/resultados/phishing-beca');
    await assertSucceeds(setDoc(resultadoRef, {
      escenarioId: 'phishing-beca', eje: 'fraude', aciertos: 1, decisiones: 1,
      porcentajeAciertos: 100, puntos: 100, fechaActualizacion: new Date().toISOString(),
    }));
    await assertSucceeds(updateDoc(resultadoRef, {
      aciertos: 1, decisiones: 2, porcentajeAciertos: 50, puntos: 125,
      fechaActualizacion: new Date().toISOString(),
    }));
    await assertFails(getDoc(doc(como('est2'), 'usuarios/est1/resultados/phishing-beca')));
    await assertFails(getDoc(doc(como('docA'), 'usuarios/est1/resultados/phishing-beca')));
  });

  it('rechaza resultados de ejercicio inconsistentes o de cuentas ajenas', async () => {
    await assertFails(setDoc(doc(como('est1'), 'usuarios/est1/resultados/phishing-beca'), {
      escenarioId: 'otro-ejercicio', eje: 'fraude', aciertos: 1, decisiones: 1,
      porcentajeAciertos: 100, puntos: 100, fechaActualizacion: new Date().toISOString(),
    }));
    await assertFails(setDoc(doc(como('est2'), 'usuarios/est1/resultados/phishing-beca'), {
      escenarioId: 'phishing-beca', eje: 'fraude', aciertos: 0, decisiones: 1,
      porcentajeAciertos: 0, puntos: 25, fechaActualizacion: new Date().toISOString(),
    }));
  });

  it('el docente consulta resultados agregados de su institución', async () => {
    const db = como('docA');
    await assertSucceeds(getDoc(doc(db, `resultados_agregados/${GRUPO_ID}_fraude`)));
    await assertSucceeds(getDocs(query(collection(db, 'resultados_agregados'), where('institucion', '==', INSTITUCION))));
    await assertFails(getDoc(doc(como('docB'), `resultados_agregados/${GRUPO_ID}_fraude`)));
  });

  it('un estudiante solo lee su propio agregado y nunca los participantes de otro usuario', async () => {
    await assertSucceeds(getDoc(doc(como('est-vinculado'), `resultados_agregados/${GRUPO_ID}_fraude`)));
    await assertFails(getDoc(doc(como('est-vinculado'), `resultados_agregados/${GRUPO_ID}_fraude/participantes/est1`)));
    await assertFails(getDoc(doc(como('est1'), `resultados_agregados/${GRUPO_ID}_fraude`)));
  });

  it('no se exponen decisiones individuales ni se permite escribirlas', async () => {
    await assertFails(setDoc(doc(como('est1'), 'decisiones/nueva'), { uid: 'est1' }));
    await assertFails(getDoc(doc(como('docA'), 'decisiones/privada')));
  });
});
