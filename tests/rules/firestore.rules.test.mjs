// Pruebas de las reglas de Firestore contra el emulador.
// Ejecutar: cd tests/rules && npm install && npm test   (requiere Java 11+ para el emulador)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, it } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';

const CODIGO_VIGENTE = 'colegioa-ABC12345';
const CODIGO_INACTIVO = 'colegioa-INACTIVO1';
let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-ciberdesafio',
    firestore: { rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8') },
  });
});
after(async () => { await env.cleanup(); });

// Datos de partida (se cargan sin reglas, como si los hubiera puesto un administrador o el backend).
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (contexto) => {
    const db = contexto.firestore();
    await setDoc(doc(db, 'usuarios/est1'), { uid: 'est1', nombre: 'Est Uno', rol: 'estudiante', institucion: 'colegioa', grupo: '901-A' });
    await setDoc(doc(db, 'usuarios/est2'), { uid: 'est2', nombre: 'Est Dos', rol: 'estudiante', institucion: 'colegioa' });
    await setDoc(doc(db, 'usuarios/docA'), { uid: 'docA', nombre: 'Doc A', rol: 'docente', institucion: 'colegioa', codigoInvitacion: CODIGO_VIGENTE });
    await setDoc(doc(db, 'usuarios/docB'), { uid: 'docB', nombre: 'Doc B', rol: 'docente', institucion: 'colegiob', codigoInvitacion: 'colegiob-XYZ98765' });
    await setDoc(doc(db, `codigos_invitacion/${CODIGO_VIGENTE}`), { activo: true });
    await setDoc(doc(db, `codigos_invitacion/${CODIGO_INACTIVO}`), { activo: false });
    await setDoc(doc(db, 'resultados_agregados/a1'), { institucion: 'colegioa', grupo: '901-A', eje: 'fraude', porcentajeAciertos: 80 });
    await setDoc(doc(db, 'resultados_agregados/b1'), { institucion: 'colegiob', grupo: '901-A', eje: 'fraude', porcentajeAciertos: 60 });
    await setDoc(doc(db, 'decisiones/d-est2'), { uid: 'est2', escenarioId: 'e1', nodoId: 'n1', opcionElegida: 'o1', correcta: true, fecha: '2026-10-01T00:00:00Z' });
    await setDoc(doc(db, 'escenarios/e1'), { titulo: 'Phishing' });
  });
});

const como = (uid) => env.authenticatedContext(uid).firestore();
const anonimo = () => env.unauthenticatedContext().firestore();
const perfilBase = (uid, extra = {}) => ({ uid, nombre: 'Nuevo', rol: 'estudiante', institucion: '', ...extra });

describe('registro: nadie puede elegir ser docente por su cuenta', () => {
  it('un usuario nuevo puede crear su perfil de estudiante', async () => {
    await assertSucceeds(setDoc(doc(como('nuevo'), 'usuarios/nuevo'), perfilBase('nuevo')));
  });
  it('NO puede crear un perfil docente sin codigo de invitacion', async () => {
    await assertFails(setDoc(doc(como('nuevo'), 'usuarios/nuevo'), perfilBase('nuevo', { rol: 'docente', institucion: 'colegioa' })));
  });
  it('NO puede crear un perfil docente con un codigo que no existe', async () => {
    await assertFails(setDoc(doc(como('nuevo'), 'usuarios/nuevo'), perfilBase('nuevo', { rol: 'docente', institucion: 'colegioa', codigoInvitacion: 'colegioa-NOEXISTE1' })));
  });
  it('NO puede crear un perfil docente con un codigo desactivado', async () => {
    await assertFails(setDoc(doc(como('nuevo'), 'usuarios/nuevo'), perfilBase('nuevo', { rol: 'docente', institucion: 'colegioa', codigoInvitacion: CODIGO_INACTIVO })));
  });
  it('puede crear un perfil docente con un codigo vigente; la institucion sale del codigo', async () => {
    await assertSucceeds(setDoc(doc(como('nuevo'), 'usuarios/nuevo'), perfilBase('nuevo', { rol: 'docente', institucion: 'colegioa', codigoInvitacion: CODIGO_VIGENTE })));
  });
  it('NO puede usar un codigo vigente para fijarse otra institucion', async () => {
    await assertFails(setDoc(doc(como('nuevo'), 'usuarios/nuevo'), perfilBase('nuevo', { rol: 'docente', institucion: 'colegiob', codigoInvitacion: CODIGO_VIGENTE })));
  });
  it('un estudiante no puede traer codigo de invitacion', async () => {
    await assertFails(setDoc(doc(como('nuevo'), 'usuarios/nuevo'), perfilBase('nuevo', { codigoInvitacion: CODIGO_VIGENTE })));
  });
  it('un codigo con segmentos de ruta (inyeccion) se rechaza', async () => {
    await assertFails(setDoc(doc(como('nuevo'), 'usuarios/nuevo'), perfilBase('nuevo', { rol: 'docente', institucion: 'colegioa', codigoInvitacion: `${CODIGO_VIGENTE}/../${CODIGO_VIGENTE}` })));
  });
  it('NO puede crear el perfil de otro uid ni agregar campos extra', async () => {
    await assertFails(setDoc(doc(como('nuevo'), 'usuarios/otro'), perfilBase('otro')));
    await assertFails(setDoc(doc(como('nuevo'), 'usuarios/nuevo'), perfilBase('nuevo', { admin: true })));
    await assertFails(setDoc(doc(anonimo(), 'usuarios/nuevo'), perfilBase('nuevo')));
  });
});

describe('escalada de privilegios sobre un perfil existente', () => {
  it('un estudiante NO puede cambiarse el rol a docente', async () => {
    await assertFails(updateDoc(doc(como('est1'), 'usuarios/est1'), { rol: 'docente' }));
    await assertFails(setDoc(doc(como('est1'), 'usuarios/est1'), { uid: 'est1', nombre: 'Est Uno', rol: 'docente', institucion: 'colegioa' }));
  });
  it('un estudiante SI puede actualizar datos propios como el grupo', async () => {
    await assertSucceeds(updateDoc(doc(como('est1'), 'usuarios/est1'), { grupo: '902-B' }));
  });
  it('un estudiante NO puede agregarse un codigo de invitacion despues', async () => {
    await assertFails(updateDoc(doc(como('est1'), 'usuarios/est1'), { codigoInvitacion: CODIGO_VIGENTE }));
  });
  it('un docente NO puede cambiar su institucion ni su rol', async () => {
    await assertFails(updateDoc(doc(como('docA'), 'usuarios/docA'), { institucion: 'colegiob' }));
    await assertFails(updateDoc(doc(como('docA'), 'usuarios/docA'), { rol: 'estudiante' }));
  });
  it('nadie puede borrar perfiles', async () => {
    await assertFails(deleteDoc(doc(como('est1'), 'usuarios/est1')));
  });
});

describe('privacidad de perfiles y codigos', () => {
  it('cada usuario lee solo su propio perfil', async () => {
    await assertSucceeds(getDoc(doc(como('est1'), 'usuarios/est1')));
    await assertFails(getDoc(doc(como('est1'), 'usuarios/est2')));
  });
  it('un docente NO lee perfiles de estudiantes', async () => {
    await assertFails(getDoc(doc(como('docA'), 'usuarios/est1')));
  });
  it('no se pueden listar usuarios', async () => {
    await assertFails(getDocs(collection(como('docA'), 'usuarios')));
  });
  it('los codigos de invitacion no se pueden leer ni escribir desde el cliente', async () => {
    await assertFails(getDoc(doc(como('docA'), `codigos_invitacion/${CODIGO_VIGENTE}`)));
    await assertFails(setDoc(doc(como('est1'), 'codigos_invitacion/colegioa-MIPROPIO1'), { activo: true }));
  });
});

describe('resultados agregados', () => {
  it('un docente lee los resultados de su institucion', async () => {
    await assertSucceeds(getDoc(doc(como('docA'), 'resultados_agregados/a1')));
    await assertSucceeds(getDocs(query(collection(como('docA'), 'resultados_agregados'), where('institucion', '==', 'colegioa'))));
  });
  it('un docente NO lee resultados de otra institucion', async () => {
    await assertFails(getDoc(doc(como('docA'), 'resultados_agregados/b1')));
    await assertFails(getDocs(query(collection(como('docA'), 'resultados_agregados'), where('institucion', '==', 'colegiob'))));
    await assertFails(getDocs(collection(como('docA'), 'resultados_agregados')));
  });
  it('un estudiante o un visitante NO leen resultados', async () => {
    await assertFails(getDoc(doc(como('est1'), 'resultados_agregados/a1')));
    await assertFails(getDoc(doc(anonimo(), 'resultados_agregados/a1')));
  });
  it('nadie escribe resultados desde el cliente', async () => {
    await assertFails(setDoc(doc(como('docA'), 'resultados_agregados/a1'), { institucion: 'colegioa', porcentajeAciertos: 100 }));
  });
});

describe('decisiones y escenarios', () => {
  const decision = (uid, extra = {}) => ({ uid, escenarioId: 'e1', nodoId: 'n1', opcionElegida: 'o1', correcta: true, fecha: '2026-10-01T00:00:00Z', ...extra });
  it('un estudiante crea decisiones solo a su nombre', async () => {
    await assertSucceeds(addDoc(collection(como('est1'), 'decisiones'), decision('est1')));
    await assertFails(addDoc(collection(como('est1'), 'decisiones'), decision('est2')));
  });
  it('un docente NO crea decisiones', async () => {
    await assertFails(addDoc(collection(como('docA'), 'decisiones'), decision('docA')));
  });
  it('no se aceptan campos extra ni tipos incorrectos', async () => {
    await assertFails(addDoc(collection(como('est1'), 'decisiones'), decision('est1', { rol: 'docente' })));
    await assertFails(addDoc(collection(como('est1'), 'decisiones'), decision('est1', { correcta: 'si' })));
  });
  it('cada estudiante lee solo sus decisiones y no puede editarlas ni borrarlas', async () => {
    await assertSucceeds(getDoc(doc(como('est2'), 'decisiones/d-est2')));
    await assertFails(getDoc(doc(como('est1'), 'decisiones/d-est2')));
    await assertFails(getDoc(doc(como('docA'), 'decisiones/d-est2')));
    await assertFails(updateDoc(doc(como('est2'), 'decisiones/d-est2'), { correcta: false }));
    await assertFails(deleteDoc(doc(como('est2'), 'decisiones/d-est2')));
  });
  it('los escenarios se leen con sesion y no se escriben', async () => {
    await assertSucceeds(getDoc(doc(como('est1'), 'escenarios/e1')));
    await assertFails(getDoc(doc(anonimo(), 'escenarios/e1')));
    await assertFails(setDoc(doc(como('docA'), 'escenarios/e2'), { titulo: 'x' }));
  });
});
