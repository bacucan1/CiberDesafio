import cors from 'cors';
import express, { Request, Response } from 'express';
import { getFirestore } from 'firebase-admin/firestore';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

if (!getApps().length) initializeApp();
const db = getFirestore();
const app = express();
app.use(cors());
app.use(express.json());

interface AuthRequest extends Request { uid?: string; rol?: string; }
async function verificarToken(req: AuthRequest, res: Response, next: () => void): Promise<void> {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) { res.status(401).json({ mensaje: 'Token requerido' }); return; }
  try { const usuario = await getAuth().verifyIdToken(token); req.uid = usuario.uid; req.rol = usuario.rol as string | undefined; next(); }
  catch { res.status(401).json({ mensaje: 'Token invalido' }); }
}
function exigirRol(rol: string) { return (req: AuthRequest, res: Response, next: () => void): void => { if (req.rol === rol) next(); else res.status(403).json({ mensaje: 'Rol no autorizado' }); }; }

app.get('/escenarios', verificarToken, async (_req, res) => res.json((await db.collection('escenarios').get()).docs.map((doc) => ({ id: doc.id, ...doc.data() }))));
app.get('/escenarios/:id', verificarToken, async (req, res) => {
  const doc = await db.collection('escenarios').doc(req.params.id as string).get();
  doc.exists ? res.json({ id: doc.id, ...doc.data() }) : res.status(404).json({ mensaje: 'Escenario no encontrado' });
});
app.post('/decisiones', verificarToken, async (req: AuthRequest, res) => {
  if (req.body.uid !== req.uid) { res.status(403).json({ mensaje: 'La decision no pertenece al usuario' }); return; }
  const referencia = await db.collection('decisiones').add({ ...req.body, fecha: new Date().toISOString() });
  res.status(201).json({ id: referencia.id });
});
app.get('/resultados/:grupo', verificarToken, exigirRol('docente'), async (req, res) => {
  const snapshot = await db.collection('resultados_agregados').where('grupo', '==', req.params.grupo).get();
  res.json(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
});

app.listen(process.env.PORT ?? 3333, () => console.log('API CiberDesafio activa'));