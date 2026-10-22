import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { crearApp, Dependencias, Perfil } from './app.js';

if (!getApps().length) initializeApp();
const db = getFirestore();

const dependencias: Dependencias = {
  verificarIdToken: async (token) => ({ uid: (await getAuth().verifyIdToken(token)).uid }),
  obtenerPerfil: async (uid) => {
    const datos = (await db.collection('usuarios').doc(uid).get()).data();
    if (!datos || (datos.rol !== 'estudiante' && datos.rol !== 'docente')) return null;
    return { rol: datos.rol, institucion: typeof datos.institucion === 'string' ? datos.institucion : '' } satisfies Perfil;
  },
  listarEscenarios: async () => (await db.collection('escenarios').get()).docs.map((doc) => ({ id: doc.id, ...doc.data() })),
  obtenerEscenario: async (id) => {
    const doc = await db.collection('escenarios').doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  },
  guardarDecision: async (decision) => (await db.collection('decisiones').add(decision)).id,
  resultadosPorGrupo: async (institucion, grupo) =>
    (await db.collection('resultados_agregados').where('institucion', '==', institucion).where('grupo', '==', grupo).get())
      .docs.map((doc) => ({ id: doc.id, ...doc.data() })),
};

if (!process.env.CORS_ORIGINS) console.warn('CORS_ORIGINS no esta definido: la API acepta peticiones de cualquier origen.');
crearApp(dependencias).listen(process.env.PORT ?? 3333, () => console.log('API CiberDesafio activa'));
