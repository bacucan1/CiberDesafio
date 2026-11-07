import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';

export type Rol = 'estudiante' | 'docente';
export interface Perfil { rol: Rol; institucion: string; }
export type Eje = 'fraude' | 'relación de riesgo' | 'higiene';

export interface DecisionEntrada {
  escenarioId: string;
  nodoId: string;
  opcionElegida: string;
  correcta: boolean;
  puntuacion?: number;
  situacion?: string;
  resultado?: string;
  eje?: Eje;
}

/** Todo lo que la API necesita del exterior (Firebase Auth y Firestore). Se inyecta para poder probarla. */
export interface Dependencias {
  verificarIdToken(token: string): Promise<{ uid: string }>;
  obtenerPerfil(uid: string): Promise<Perfil | null>;
  listarEscenarios(): Promise<unknown[]>;
  obtenerEscenario(id: string): Promise<unknown | null>;
  guardarDecision(decision: DecisionEntrada & { uid: string; fecha: string }): Promise<string>;
  resultadosPorGrupo(institucion: string, grupo: string): Promise<unknown[]>;
}

export interface AuthRequest extends Request { uid?: string; perfil?: Perfil; }

const EJES: Eje[] = ['fraude', 'relación de riesgo', 'higiene'];

function texto(valor: unknown, max: number): valor is string {
  return typeof valor === 'string' && valor.length > 0 && valor.length <= max;
}

/** Solo pasan los campos conocidos y con el tipo correcto; cualquier otro campo del cliente se descarta. */
export function validarDecision(cuerpo: unknown): DecisionEntrada | null {
  if (typeof cuerpo !== 'object' || cuerpo === null) return null;
  const b = cuerpo as Record<string, unknown>;
  if (!texto(b.escenarioId, 100) || !texto(b.nodoId, 100) || !texto(b.opcionElegida, 100) || typeof b.correcta !== 'boolean') return null;
  if (b.puntuacion !== undefined && (typeof b.puntuacion !== 'number' || !Number.isFinite(b.puntuacion))) return null;
  if (b.situacion !== undefined && !texto(b.situacion, 1000)) return null;
  if (b.resultado !== undefined && !texto(b.resultado, 1000)) return null;
  if (b.eje !== undefined && !EJES.includes(b.eje as Eje)) return null;
  const decision: DecisionEntrada = { escenarioId: b.escenarioId, nodoId: b.nodoId, opcionElegida: b.opcionElegida, correcta: b.correcta };
  if (b.puntuacion !== undefined) decision.puntuacion = b.puntuacion as number;
  if (b.situacion !== undefined) decision.situacion = b.situacion as string;
  if (b.resultado !== undefined) decision.resultado = b.resultado as string;
  if (b.eje !== undefined) decision.eje = b.eje as Eje;
  return decision;
}

export function crearApp(deps: Dependencias) {
  const app = express();

  // CORS_ORIGINS="https://ciberdesafio.vercel.app,http://localhost:4200". Sin definir, se permite cualquier origen
  // (la API usa tokens Bearer, no cookies); conviene definirlo en produccion.
  const origenes = (process.env.CORS_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean);
  app.use(cors(origenes.length ? { origin: origenes } : undefined));
  app.use(express.json({ limit: '20kb' }));

  // El rol y la institucion se leen SIEMPRE de Firestore con el uid del token verificado.
  // Nada que envie el cliente (cabeceras, cuerpo, query) cambia el rol.
  const verificarToken = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const token = /^Bearer (.+)$/.exec(req.headers.authorization ?? '')?.[1];
    if (!token) { res.status(401).json({ mensaje: 'Token requerido' }); return; }
    let uid: string;
    try { uid = (await deps.verificarIdToken(token)).uid; }
    catch { res.status(401).json({ mensaje: 'Token invalido' }); return; }
    req.uid = uid;
    req.perfil = (await deps.obtenerPerfil(uid)) ?? undefined;
    next();
  };

  const exigirRol = (rol: Rol) => (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.perfil) { res.status(403).json({ mensaje: 'Perfil no encontrado' }); return; }
    if (req.perfil.rol !== rol) { res.status(403).json({ mensaje: 'Rol no autorizado' }); return; }
    next();
  };

  app.get('/escenarios', verificarToken, async (_req, res) => { res.json(await deps.listarEscenarios()); });

  app.get('/escenarios/:id', verificarToken, async (req, res) => {
    const escenario = await deps.obtenerEscenario(req.params.id as string);
    if (escenario) res.json(escenario); else res.status(404).json({ mensaje: 'Escenario no encontrado' });
  });

  app.post('/decisiones', verificarToken, exigirRol('estudiante'), async (req: AuthRequest, res) => {
    if (req.body?.uid !== undefined && req.body.uid !== req.uid) { res.status(403).json({ mensaje: 'La decision no pertenece al usuario' }); return; }
    const decision = validarDecision(req.body);
    if (!decision) { res.status(400).json({ mensaje: 'Decision invalida' }); return; }
    const id = await deps.guardarDecision({ ...decision, uid: req.uid as string, fecha: new Date().toISOString() });
    res.status(201).json({ id });
  });

  app.get('/resultados/:grupo', verificarToken, exigirRol('docente'), async (req: AuthRequest, res) => {
    const grupo = req.params.grupo as string;
    const institucion = req.perfil?.institucion;
    if (!institucion) { res.status(403).json({ mensaje: 'El docente no tiene institucion asignada' }); return; }
    if (!texto(grupo, 20)) { res.status(400).json({ mensaje: 'Grupo invalido' }); return; }
    // La institucion sale del perfil del docente, no de la peticion: no puede consultar otras instituciones.
    res.json(await deps.resultadosPorGrupo(institucion, grupo));
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(error);
    res.status(500).json({ mensaje: 'Error interno' });
  });

  return app;
}
