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
app.use((0, cors_1.default)());
app.use(express_1.default.json());
async function verificarToken(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        res.status(401).json({ mensaje: 'Token requerido' });
        return;
    }
    try {
        const usuario = await (0, auth_1.getAuth)().verifyIdToken(token);
        req.uid = usuario.uid;
        req.rol = usuario.rol;
        next();
    }
    catch {
        res.status(401).json({ mensaje: 'Token invalido' });
    }
}
function exigirRol(rol) { return (req, res, next) => { if (req.rol === rol)
    next();
else
    res.status(403).json({ mensaje: 'Rol no autorizado' }); }; }
app.get('/escenarios', verificarToken, async (_req, res) => res.json((await db.collection('escenarios').get()).docs.map((doc) => ({ id: doc.id, ...doc.data() }))));
app.get('/escenarios/:id', verificarToken, async (req, res) => {
    const doc = await db.collection('escenarios').doc(req.params.id).get();
    doc.exists ? res.json({ id: doc.id, ...doc.data() }) : res.status(404).json({ mensaje: 'Escenario no encontrado' });
});
app.post('/decisiones', verificarToken, async (req, res) => {
    if (req.body.uid !== req.uid) {
        res.status(403).json({ mensaje: 'La decision no pertenece al usuario' });
        return;
    }
    const referencia = await db.collection('decisiones').add({ ...req.body, fecha: new Date().toISOString() });
    res.status(201).json({ id: referencia.id });
});
app.get('/resultados/:grupo', verificarToken, exigirRol('docente'), async (req, res) => {
    const snapshot = await db.collection('resultados_agregados').where('grupo', '==', req.params.grupo).get();
    res.json(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
});
app.listen(process.env.PORT ?? 3333, () => console.log('API CiberDesafio activa'));
