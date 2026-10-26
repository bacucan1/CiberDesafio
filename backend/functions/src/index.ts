import { createHash, randomBytes } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { ESCENARIOS } from '../../../shared/escenarios.data';

initializeApp();
const db = getFirestore();
const REGION = 'us-central1';
const INVITATION_DAYS = 14;
const INVITATION_MAX_USES = 30;

interface Profile {
  uid: string;
  nombre?: string;
  rol: 'estudiante' | 'docente';
  institucion: string;
  grado?: number;
  grupo?: string;
}

interface DecisionRecord {
  uid: string;
  correcta: boolean;
  eje?: string;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function institutionDocumentId(institution: string): string {
  const slug = institution.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100);
  return slug || digest(institution);
}

function parseProfile(value: FirebaseFirestore.DocumentData | undefined, uid: string): Profile | null {
  if (!value
    || value.uid !== uid
    || (value.rol !== 'docente' && value.rol !== 'estudiante')
    || typeof value.institucion !== 'string') {
    return null;
  }
  return value as Profile;
}

async function requireProfile(uid: string): Promise<Profile> {
  const snapshot = await db.collection('usuarios').doc(uid).get();
  const profile = parseProfile(snapshot.data(), uid);
  if (!profile) throw new HttpsError('permission-denied', 'La cuenta no tiene un perfil autorizado.');
  return profile;
}

function requireAuthUid(request: { auth?: { uid: string } | null }): string {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Inicia sesión para continuar.');
  return request.auth.uid;
}

function requireObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpsError('invalid-argument', 'Los datos enviados no son válidos.');
  }
  return value as Record<string, unknown>;
}

async function requireTeacher(profile: Profile): Promise<void> {
  if (profile.rol !== 'docente' || !profile.institucion.trim()) {
    throw new HttpsError('permission-denied', 'Se requiere un perfil docente aprobado y con institución asignada.');
  }
  const institution = await db.collection('instituciones').doc(institutionDocumentId(profile.institucion)).get();
  if (!institution.exists
    || institution.data()?.['nombre'] !== profile.institucion
    || institution.data()?.['estado'] !== 'activa') {
    throw new HttpsError('failed-precondition', 'La institución no está registrada y activa en CiberDesafío.');
  }
}

export const crearCodigoGrupo = onCall({ region: REGION }, async (request) => {
  const uid = requireAuthUid(request);
  const profile = await requireProfile(uid);
  await requireTeacher(profile);

  const data = requireObject(request.data);
  const grupo = stringValue(data['grupo']);
  const grado = data['grado'];
  if (grupo.length < 2 || grupo.length > 60) {
    throw new HttpsError('invalid-argument', 'El nombre del grupo debe tener entre 2 y 60 caracteres.');
  }
  if (grado !== undefined && (!Number.isInteger(grado) || Number(grado) < 6 || Number(grado) > 11)) {
    throw new HttpsError('invalid-argument', 'El grado debe estar entre 6 y 11.');
  }

  const code = randomBytes(6).toString('base64url').toUpperCase();
  const codeHash = digest(code);
  const groupId = digest(`${profile.institucion.toLowerCase()}\0${String(grado ?? '')}\0${grupo.toLowerCase()}`);
  const expiresAt = new Date(Date.now() + INVITATION_DAYS * 24 * 60 * 60 * 1000);
  const groupRef = db.collection('grupos').doc(groupId);
  const invitationRef = db.collection('codigos_vinculacion').doc(codeHash);

  await db.runTransaction(async (transaction) => {
    const group = await transaction.get(groupRef);
    transaction.set(groupRef, {
      institucion: profile.institucion,
      grupo,
      ...(typeof grado === 'number' ? { grado } : {}),
      profesores: FieldValue.arrayUnion(uid),
      fechaActualizacion: new Date().toISOString(),
    }, { merge: true });
    if (group.exists && group.data()?.institucion !== profile.institucion) {
      throw new HttpsError('failed-precondition', 'El grupo no pertenece a tu institución.');
    }
    transaction.create(invitationRef, {
      codigo: code,
      creadoPor: uid,
      institucion: profile.institucion,
      grupo,
      ...(typeof grado === 'number' ? { grado } : {}),
      estado: 'activo',
      usos: 0,
      maxUsos: INVITATION_MAX_USES,
      creadoEn: new Date().toISOString(),
      venceEn: expiresAt.toISOString(),
    });
  });

  return { codigo: code, grupo, ...(typeof grado === 'number' ? { grado } : {}), venceEn: expiresAt.toISOString(), maxUsos: INVITATION_MAX_USES };
});

export const listarCodigosGrupo = onCall({ region: REGION }, async (request) => {
  const uid = requireAuthUid(request);
  const profile = await requireProfile(uid);
  await requireTeacher(profile);
  const snapshot = await db.collection('codigos_vinculacion').where('creadoPor', '==', uid).get();
  return {
    codigos: snapshot.docs.map((document) => {
      const data = document.data();
      return {
        codigo: data['codigo'],
        grupo: data['grupo'],
        ...(typeof data['grado'] === 'number' ? { grado: data['grado'] } : {}),
        estado: data['estado'],
        usos: data['usos'],
        maxUsos: data['maxUsos'],
        venceEn: data['venceEn'],
      };
    }),
  };
});

export const revocarCodigoGrupo = onCall({ region: REGION }, async (request) => {
  const uid = requireAuthUid(request);
  const profile = await requireProfile(uid);
  await requireTeacher(profile);
  const data = requireObject(request.data);
  const code = stringValue(data['codigo']).toUpperCase();
  if (!/^[A-Z0-9_-]{8,24}$/.test(code)) {
    throw new HttpsError('invalid-argument', 'El código no tiene un formato válido.');
  }
  const invitationRef = db.collection('codigos_vinculacion').doc(digest(code));
  const invitation = await invitationRef.get();
  const inviteData = invitation.data();
  if (!inviteData || inviteData['creadoPor'] !== uid || inviteData['institucion'] !== profile.institucion) {
    throw new HttpsError('not-found', 'No se encontró un código administrado por tu cuenta.');
  }
  await invitationRef.update({ estado: 'revocado', revocadoEn: new Date().toISOString() });
  return { revocado: true };
});

export const listarGruposDocente = onCall({ region: REGION }, async (request) => {
  const uid = requireAuthUid(request);
  const profile = await requireProfile(uid);
  await requireTeacher(profile);
  const snapshot = await db.collection('grupos').where('profesores', 'array-contains', uid).get();
  return {
    grupos: snapshot.docs.filter((document) => document.data()['institucion'] === profile.institucion).map((document) => {
      const data = document.data();
      return {
        grupo: data['grupo'],
        ...(typeof data['grado'] === 'number' ? { grado: data['grado'] } : {}),
      };
    }),
  };
});

export const listarResultadosAgregadosDocente = onCall({ region: REGION }, async (request) => {
  const uid = requireAuthUid(request);
  const profile = await requireProfile(uid);
  await requireTeacher(profile);
  const snapshot = await db.collection('resultados_agregados')
    .where('institucion', '==', profile.institucion)
    .get();
  return {
    resultados: snapshot.docs.map((document) => {
      const data = document.data();
      return {
        grupo: data['grupo'],
        ...(typeof data['grado'] === 'number' ? { grado: data['grado'] } : {}),
        institucion: data['institucion'],
        eje: data['eje'],
        porcentajeAciertos: data['porcentajeAciertos'] ?? 0,
        estudiantes: data['estudiantes'] ?? 0,
        fechaCalculo: data['fechaCalculo'] ?? '',
      };
    }),
  };
});

export const vincularEstudianteConCodigo = onCall({ region: REGION }, async (request) => {
  const uid = requireAuthUid(request);
  const profile = await requireProfile(uid);
  if (profile.rol !== 'estudiante') {
    throw new HttpsError('permission-denied', 'Los códigos de grupo solo vinculan cuentas de estudiante.');
  }

  const data = requireObject(request.data);
  const code = stringValue(data['codigo']).replace(/\s/g, '').toUpperCase();
  if (!/^[A-Z0-9_-]{8,24}$/.test(code)) {
    throw new HttpsError('invalid-argument', 'Escribe un código de grupo válido.');
  }

  const invitationRef = db.collection('codigos_vinculacion').doc(digest(code));
  const profileRef = db.collection('usuarios').doc(uid);
  const now = Date.now();
  const result = await db.runTransaction(async (transaction) => {
    const [invitation, currentProfile] = await Promise.all([
      transaction.get(invitationRef),
      transaction.get(profileRef),
    ]);
    const invite = invitation.data();
    const current = parseProfile(currentProfile.data(), uid);
    if (!invite || !current) throw new HttpsError('not-found', 'El código o el perfil no son válidos.');
    if (invite['estado'] !== 'activo'
      || typeof invite['venceEn'] !== 'string'
      || Date.parse(invite['venceEn']) <= now
      || Number(invite['usos']) >= Number(invite['maxUsos'])) {
      throw new HttpsError('failed-precondition', 'El código venció, fue revocado o ya alcanzó su límite de usos.');
    }
    if (current.institucion) {
      throw new HttpsError('already-exists', 'Esta cuenta ya está vinculada a una institución. Solicita el cambio a un administrador.');
    }
    transaction.update(profileRef, {
      institucion: invite['institucion'],
      grupo: invite['grupo'],
      ...(typeof invite['grado'] === 'number' ? { grado: invite['grado'] } : {}),
      fechaActualizacion: new Date().toISOString(),
    });
    transaction.update(invitationRef, { usos: FieldValue.increment(1) });
    return {
      institucion: invite['institucion'] as string,
      grupo: invite['grupo'] as string,
      ...(typeof invite['grado'] === 'number' ? { grado: invite['grado'] as number } : {}),
    };
  });
  return result;
});

export const registrarDecisionVerificada = onCall({ region: REGION }, async (request) => {
  const uid = requireAuthUid(request);
  const profile = await requireProfile(uid);
  if (profile.rol !== 'estudiante') {
    throw new HttpsError('permission-denied', 'Solo los estudiantes pueden registrar decisiones.');
  }
  const data = requireObject(request.data);
  const escenarioId = stringValue(data['escenarioId']);
  const nodoId = stringValue(data['nodoId']);
  const opcionElegida = stringValue(data['opcionElegida']);
  const escenario = ESCENARIOS.find((item) => item.id === escenarioId);
  const nodo = escenario?.nodos.find((item) => item.id === nodoId);
  const opcion = nodo?.opciones.find((item) => item.id === opcionElegida);
  if (!escenario || !nodo || !opcion) {
    throw new HttpsError('invalid-argument', 'La decisión no coincide con una opción válida del escenario.');
  }
  const reference = await db.collection('decisiones').add({
    uid,
    escenarioId,
    nodoId,
    opcionElegida,
    situacion: nodo.pregunta,
    correcta: opcion.correcta,
    puntuacion: opcion.correcta ? 100 : 25,
    resultado: opcion.consecuencia,
    eje: escenario.eje,
    fecha: new Date().toISOString(),
  });
  return { id: reference.id, correcta: opcion.correcta, puntuacion: opcion.correcta ? 100 : 25 };
});

async function agregarDecisionAlResumen(id: string, decision: DecisionRecord): Promise<void> {
  const profile = await requireProfile(decision.uid);
  if (profile.rol !== 'estudiante' || !profile.institucion || !profile.grupo) return;
  const eje = ['fraude', 'relación de riesgo', 'higiene'].includes(decision.eje ?? '')
    ? decision.eje!
    : 'fraude';
  const summaryId = digest(`${profile.institucion}\0${profile.grado ?? ''}\0${profile.grupo}\0${eje}`);
  const summaryRef = db.collection('resultados_agregados').doc(summaryId);
  const participantRef = summaryRef.collection('participantes').doc(decision.uid);
  const eventRef = db.collection('eventos_resumen_decision').doc(id);

  await db.runTransaction(async (transaction) => {
    const [event, participant, summary] = await Promise.all([
      transaction.get(eventRef),
      transaction.get(participantRef),
      transaction.get(summaryRef),
    ]);
    if (event.exists) return;

    const participantData = participant.data();
    const summaryData = summary.data();
    const oldCorrect = Number(participantData?.['aciertos'] ?? 0);
    const oldTotal = Number(participantData?.['decisiones'] ?? 0);
    const totalAciertos = Number(summaryData?.['totalAciertos'] ?? 0) + (decision.correcta ? 1 : 0);
    const totalDecisiones = Number(summaryData?.['totalDecisiones'] ?? 0) + 1;
    const tieneContadores = typeof summaryData?.['totalDecisiones'] === 'number';
    const estudiantes = (tieneContadores ? Number(summaryData?.['estudiantes'] ?? 0) : 0)
      + (participant.exists ? 0 : 1);
    const aciertos = oldCorrect + (decision.correcta ? 1 : 0);
    const decisiones = oldTotal + 1;

    transaction.set(participantRef, { aciertos, decisiones });
    transaction.set(summaryRef, {
      institucion: profile.institucion,
      grupo: profile.grupo,
      ...(typeof profile.grado === 'number' ? { grado: profile.grado } : {}),
      eje,
      estudiantes,
      totalAciertos,
      totalDecisiones,
      porcentajeAciertos: Math.round((totalAciertos / totalDecisiones) * 100),
      fechaCalculo: new Date().toISOString(),
    });
    transaction.create(eventRef, { procesadoEn: new Date().toISOString() });
  });
}

export const agregarDecisionAResultados = onDocumentCreated(
  { document: 'decisiones/{decisionId}', region: REGION },
  async (event) => {
    const decision = event.data?.data() as DecisionRecord | undefined;
    if (!decision || typeof decision.uid !== 'string' || typeof decision.correcta !== 'boolean') return;
    await agregarDecisionAlResumen(event.params['decisionId'], decision);
  },
);

async function retirarResultadosEstudiante(uid: string, profile: Profile): Promise<void> {
  if (!profile.institucion || !profile.grupo) return;
  const decisions = await db.collection('decisiones').where('uid', '==', uid).get();
  const ejes = new Map<string, Set<string>>();
  for (const document of decisions.docs) {
    const decision = document.data() as DecisionRecord;
    const eje = ['fraude', 'relación de riesgo', 'higiene'].includes(decision.eje ?? '')
      ? decision.eje!
      : 'fraude';
    if (!ejes.has(eje)) ejes.set(eje, new Set());
    ejes.get(eje)!.add(document.id);
  }

  for (const [eje, decisionIds] of ejes) {
    const summaryId = digest(`${profile.institucion}\0${profile.grado ?? ''}\0${profile.grupo}\0${eje}`);
    const summaryRef = db.collection('resultados_agregados').doc(summaryId);
    const participantRef = summaryRef.collection('participantes').doc(uid);
    await db.runTransaction(async (transaction) => {
      const participant = await transaction.get(participantRef);
      const summary = await transaction.get(summaryRef);
      if (!participant.exists) return;
      const counters = participant.data();
      const summaryData = summary.data();
      for (const decisionId of decisionIds) {
        transaction.delete(db.collection('eventos_resumen_decision').doc(decisionId));
      }
      if (typeof summaryData?.['totalDecisiones'] !== 'number') {
        transaction.delete(participantRef);
        transaction.delete(summaryRef);
        return;
      }
      const totalAciertos = Math.max(0, Number(summaryData['totalAciertos'] ?? 0) - Number(counters?.['aciertos'] ?? 0));
      const totalDecisiones = Math.max(0, Number(summaryData['totalDecisiones']) - Number(counters?.['decisiones'] ?? 0));
      const estudiantes = Math.max(0, Number(summaryData['estudiantes'] ?? 0) - 1);
      transaction.delete(participantRef);
      if (!totalDecisiones || !estudiantes) {
        transaction.delete(summaryRef);
        return;
      }
      transaction.update(summaryRef, {
        estudiantes,
        totalAciertos,
        totalDecisiones,
        porcentajeAciertos: Math.round((totalAciertos / totalDecisiones) * 100),
        fechaCalculo: new Date().toISOString(),
      });
    });
  }
}

export const actualizarResultadosTrasVinculacion = onDocumentUpdated(
  { document: 'usuarios/{uid}', region: REGION },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;
    const uid = event.params['uid'];
    const previousProfile = parseProfile(before, uid);
    const nextProfile = parseProfile(after, uid);
    const previousMembership = previousProfile?.rol === 'estudiante'
      && Boolean(previousProfile.institucion && previousProfile.grupo);
    const membershipChanged = previousProfile?.rol !== nextProfile?.rol
      || previousProfile?.institucion !== nextProfile?.institucion
      || previousProfile?.grupo !== nextProfile?.grupo
      || previousProfile?.grado !== nextProfile?.grado;
    if (!membershipChanged) return;

    if (previousProfile && previousMembership) {
      await retirarResultadosEstudiante(uid, previousProfile);
    }
    if (nextProfile?.rol !== 'estudiante' || !nextProfile.institucion || !nextProfile.grupo) return;

    const decisions = await db.collection('decisiones').where('uid', '==', uid).get();
    for (const document of decisions.docs) {
      const decision = document.data() as DecisionRecord;
      if (typeof decision.correcta === 'boolean') await agregarDecisionAlResumen(document.id, decision);
    }
  },
);
