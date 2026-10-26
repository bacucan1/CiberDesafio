"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const firestore_1 = require("firebase-admin/firestore");
const app_1 = require("firebase-admin/app");
const auth_1 = require("firebase-admin/auth");
if (!(0, app_1.getApps)().length)
    (0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
const app = (0, express_1.default)();
const origenesPermitidos = (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((origen) => origen.trim())
    .filter(Boolean);
app.use((0, cors_1.default)({ origin: origenesPermitidos.length > 0 ? origenesPermitidos : true }));
app.use(express_1.default.json({ limit: '16kb' }));
async function verificarToken(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        res.status(401).json({ mensaje: 'Token requerido' });
        return;
    }
    let usuarioAutenticado;
    try {
        usuarioAutenticado = await (0, auth_1.getAuth)().verifyIdToken(token);
    }
    catch {
        res.status(401).json({ mensaje: 'Token inválido' });
        return;
    }
    try {
        const perfil = await db.collection('usuarios').doc(usuarioAutenticado.uid).get();
        const datos = perfil.data();
        if (!datos || (datos.rol !== 'estudiante' && datos.rol !== 'docente')) {
            res.status(403).json({ mensaje: 'La cuenta no tiene un perfil autorizado' });
            return;
        }
        req.uid = usuarioAutenticado.uid;
        req.rol = datos.rol;
        req.institucion = typeof datos.institucion === 'string' ? datos.institucion : '';
        next();
    }
    catch (error) {
        next(error);
    }
}
function exigirRol(rol) { return (req, res, next) => { if (req.rol === rol)
    next();
else
    res.status(403).json({ mensaje: 'Rol no autorizado' }); }; }
app.get('/health', (_req, res) => res.json({ estado: 'ok', servicio: 'ciberdesafio-api' }));
app.get('/escenarios', verificarToken, async (_req, res) => res.json((await db.collection('escenarios').get()).docs.map((doc) => ({ id: doc.id, ...doc.data() }))));
app.get('/escenarios/:id', verificarToken, async (req, res) => {
    const doc = await db.collection('escenarios').doc(req.params.id).get();
    doc.exists ? res.json({ id: doc.id, ...doc.data() }) : res.status(404).json({ mensaje: 'Escenario no encontrado' });
});
app.post('/decisiones', verificarToken, exigirRol('estudiante'), (_req, res) => {
    res.status(410).json({ mensaje: 'Registra las decisiones mediante la función de puntuación verificada de Firebase.' });
});
app.get('/resultados/:grupo', verificarToken, exigirRol('docente'), async (req, res) => {
    if (!req.institucion) {
        res.status(403).json({ mensaje: 'El perfil docente no tiene una institución asignada' });
        return;
    }
    const snapshot = await db.collection('resultados_agregados')
        .where('institucion', '==', req.institucion)
        .get();
    const resultados = snapshot.docs
        .filter((doc) => doc.data()?.['grupo'] === req.params.grupo)
        .map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json(resultados);
});
app.use((_req, res) => { res.status(404).json({ mensaje: 'Ruta no encontrada' }); });
const manejarError = (error, _req, res, next) => {
    console.error('Error no controlado en la API CiberDesafio.', error);
    if (res.headersSent) {
        next(error);
        return;
    }
    res.status(500).json({ mensaje: 'Error interno del servidor' });
};
app.use(manejarError);
app.listen(process.env.PORT ?? 3333, () => console.log('API CiberDesafio activa'));
