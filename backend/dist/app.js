"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validarDecision = validarDecision;
exports.crearApp = crearApp;
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const EJES = ['fraude', 'relación de riesgo', 'higiene'];
function texto(valor, max) {
    return typeof valor === 'string' && valor.length > 0 && valor.length <= max;
}
/** Solo pasan los campos conocidos y con el tipo correcto; cualquier otro campo del cliente se descarta. */
function validarDecision(cuerpo) {
    if (typeof cuerpo !== 'object' || cuerpo === null)
        return null;
    const b = cuerpo;
    if (!texto(b.escenarioId, 100) || !texto(b.nodoId, 100) || !texto(b.opcionElegida, 100) || typeof b.correcta !== 'boolean')
        return null;
    if (b.puntuacion !== undefined && (typeof b.puntuacion !== 'number' || !Number.isFinite(b.puntuacion)))
        return null;
    if (b.situacion !== undefined && !texto(b.situacion, 1000))
        return null;
    if (b.resultado !== undefined && !texto(b.resultado, 1000))
        return null;
    if (b.eje !== undefined && !EJES.includes(b.eje))
        return null;
    const decision = { escenarioId: b.escenarioId, nodoId: b.nodoId, opcionElegida: b.opcionElegida, correcta: b.correcta };
    if (b.puntuacion !== undefined)
        decision.puntuacion = b.puntuacion;
    if (b.situacion !== undefined)
        decision.situacion = b.situacion;
    if (b.resultado !== undefined)
        decision.resultado = b.resultado;
    if (b.eje !== undefined)
        decision.eje = b.eje;
    return decision;
}
function crearApp(deps) {
    const app = (0, express_1.default)();
    // CORS_ORIGINS="https://ciberdesafio.vercel.app,http://localhost:4200". Sin definir, se permite cualquier origen
    // (la API usa tokens Bearer, no cookies); conviene definirlo en produccion.
    const origenes = (process.env.CORS_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean);
    app.use((0, cors_1.default)(origenes.length ? { origin: origenes } : undefined));
    app.use(express_1.default.json({ limit: '20kb' }));
    // El rol y la institucion se leen SIEMPRE de Firestore con el uid del token verificado.
    // Nada que envie el cliente (cabeceras, cuerpo, query) cambia el rol.
    const verificarToken = async (req, res, next) => {
        const token = /^Bearer (.+)$/.exec(req.headers.authorization ?? '')?.[1];
        if (!token) {
            res.status(401).json({ mensaje: 'Token requerido' });
            return;
        }
        let uid;
        try {
            uid = (await deps.verificarIdToken(token)).uid;
        }
        catch {
            res.status(401).json({ mensaje: 'Token invalido' });
            return;
        }
        req.uid = uid;
        req.perfil = (await deps.obtenerPerfil(uid)) ?? undefined;
        next();
    };
    const exigirRol = (rol) => (req, res, next) => {
        if (!req.perfil) {
            res.status(403).json({ mensaje: 'Perfil no encontrado' });
            return;
        }
        if (req.perfil.rol !== rol) {
            res.status(403).json({ mensaje: 'Rol no autorizado' });
            return;
        }
        next();
    };
    app.get('/escenarios', verificarToken, async (_req, res) => { res.json(await deps.listarEscenarios()); });
    app.get('/escenarios/:id', verificarToken, async (req, res) => {
        const escenario = await deps.obtenerEscenario(req.params.id);
        if (escenario)
            res.json(escenario);
        else
            res.status(404).json({ mensaje: 'Escenario no encontrado' });
    });
    app.post('/decisiones', verificarToken, exigirRol('estudiante'), async (req, res) => {
        if (req.body?.uid !== undefined && req.body.uid !== req.uid) {
            res.status(403).json({ mensaje: 'La decision no pertenece al usuario' });
            return;
        }
        const decision = validarDecision(req.body);
        if (!decision) {
            res.status(400).json({ mensaje: 'Decision invalida' });
            return;
        }
        const id = await deps.guardarDecision({ ...decision, uid: req.uid, fecha: new Date().toISOString() });
        res.status(201).json({ id });
    });
    app.get('/resultados/:grupo', verificarToken, exigirRol('docente'), async (req, res) => {
        const grupo = req.params.grupo;
        const institucion = req.perfil?.institucion;
        if (!institucion) {
            res.status(403).json({ mensaje: 'El docente no tiene institucion asignada' });
            return;
        }
        if (!texto(grupo, 20)) {
            res.status(400).json({ mensaje: 'Grupo invalido' });
            return;
        }
        // La institucion sale del perfil del docente, no de la peticion: no puede consultar otras instituciones.
        res.json(await deps.resultadosPorGrupo(institucion, grupo));
    });
    app.use((error, _req, res, _next) => {
        console.error(error);
        res.status(500).json({ mensaje: 'Error interno' });
    });
    return app;
}
