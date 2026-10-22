"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("firebase-admin/app");
const auth_1 = require("firebase-admin/auth");
const firestore_1 = require("firebase-admin/firestore");
const app_js_1 = require("./app.js");
if (!(0, app_1.getApps)().length)
    (0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
const dependencias = {
    verificarIdToken: async (token) => ({ uid: (await (0, auth_1.getAuth)().verifyIdToken(token)).uid }),
    obtenerPerfil: async (uid) => {
        const datos = (await db.collection('usuarios').doc(uid).get()).data();
        if (!datos || (datos.rol !== 'estudiante' && datos.rol !== 'docente'))
            return null;
        return { rol: datos.rol, institucion: typeof datos.institucion === 'string' ? datos.institucion : '' };
    },
    listarEscenarios: async () => (await db.collection('escenarios').get()).docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    obtenerEscenario: async (id) => {
        const doc = await db.collection('escenarios').doc(id).get();
        return doc.exists ? { id: doc.id, ...doc.data() } : null;
    },
    guardarDecision: async (decision) => (await db.collection('decisiones').add(decision)).id,
    resultadosPorGrupo: async (institucion, grupo) => (await db.collection('resultados_agregados').where('institucion', '==', institucion).where('grupo', '==', grupo).get())
        .docs.map((doc) => ({ id: doc.id, ...doc.data() })),
};
if (!process.env.CORS_ORIGINS)
    console.warn('CORS_ORIGINS no esta definido: la API acepta peticiones de cualquier origen.');
(0, app_js_1.crearApp)(dependencias).listen(process.env.PORT ?? 3333, () => console.log('API CiberDesafio activa'));
