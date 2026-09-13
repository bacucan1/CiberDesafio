import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp } from 'firebase-admin/app';

initializeApp();
const db = getFirestore();

export const recalcularResultados = onDocumentCreated('decisiones/{decisionId}', async (evento) => {
  const decision = evento.data?.data();
  if (!decision) return;
  // En produccion, el grupo e institucion se obtienen del documento del usuario.
  const usuario = await db.collection('usuarios').doc(decision.uid).get();
  const datosUsuario = usuario.data();
  if (!datosUsuario) return;
  const decisiones = await db.collection('decisiones').where('uid', '==', decision.uid).get();
  const aciertos = decisiones.docs.filter((doc) => doc.data().correcta).length;
  const porcentaje = decisiones.size ? Math.round((aciertos / decisiones.size) * 100) : 0;
  await db.collection('resultados_agregados').doc(`${datosUsuario.institucion}_${datosUsuario.grupo}_${decision.eje ?? 'fraude'}`).set({
    institucion: datosUsuario.institucion,
    grupo: datosUsuario.grupo ?? 'sin-grupo',
    eje: decision.eje ?? 'fraude',
    porcentajeAciertos: porcentaje,
    estudiantes: 1,
    fechaCalculo: new Date().toISOString(),
  });
});