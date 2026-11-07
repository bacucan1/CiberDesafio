import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { crearApp, Dependencias, Perfil } from '../src/app.js';

// Tokens de prueba -> uid. Los perfiles simulan lo que hay en Firestore (usuarios/{uid}).
const tokens: Record<string, string> = { 'tok-est': 'est1', 'tok-doc-a': 'docA', 'tok-doc-b': 'docB', 'tok-sinperfil': 'fantasma' };
const perfiles: Record<string, Perfil> = {
  est1: { rol: 'estudiante', institucion: 'colegioa' },
  docA: { rol: 'docente', institucion: 'colegioa' },
  docB: { rol: 'docente', institucion: 'colegiob' },
};
const resultados = [
  { institucion: 'colegioa', grupo: '901-A', eje: 'fraude' },
  { institucion: 'colegiob', grupo: '901-A', eje: 'fraude' },
];
const guardadas: unknown[] = [];

const deps: Dependencias = {
  verificarIdToken: async (token) => { if (!(token in tokens)) throw new Error('invalido'); return { uid: tokens[token] }; },
  obtenerPerfil: async (uid) => perfiles[uid] ?? null,
  listarEscenarios: async () => [{ id: 'e1' }],
  obtenerEscenario: async (id) => (id === 'e1' ? { id: 'e1' } : null),
  guardarDecision: async (decision) => { guardadas.push(decision); return 'dec-1'; },
  resultadosPorGrupo: async (institucion, grupo) => resultados.filter((r) => r.institucion === institucion && r.grupo === grupo),
};

let servidor: Server;
let base = '';
before(() => new Promise<void>((resolver) => {
  servidor = crearApp(deps).listen(0, () => { base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`; resolver(); });
}));
after(() => new Promise<void>((resolver) => servidor.close(() => resolver())));

const llamar = (ruta: string, token?: string, init: RequestInit = {}) =>
  fetch(base + ruta, { ...init, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers ?? {}) } });
const decisionValida = { escenarioId: 'e1', nodoId: 'n1', opcionElegida: 'o1', correcta: true, puntuacion: 100, eje: 'fraude' };

describe('autenticacion', () => {
  it('rechaza peticiones sin token (401) en todas las rutas protegidas', async () => {
    for (const [ruta, metodo] of [['/escenarios', 'GET'], ['/escenarios/e1', 'GET'], ['/resultados/901-A', 'GET'], ['/decisiones', 'POST']]) {
      assert.equal((await llamar(ruta, undefined, { method: metodo, body: metodo === 'POST' ? '{}' : undefined })).status, 401, ruta);
    }
  });
  it('rechaza un token invalido (401)', async () => {
    assert.equal((await llamar('/resultados/901-A', 'token-falso')).status, 401);
  });
  it('un usuario autenticado puede ver los escenarios', async () => {
    assert.equal((await llamar('/escenarios', 'tok-est')).status, 200);
  });
});

describe('roles: estudiante vs docente', () => {
  it('el estudiante NO puede consultar resultados (403)', async () => {
    assert.equal((await llamar('/resultados/901-A', 'tok-est')).status, 403);
  });
  it('un estudiante no se vuelve docente enviando rol por cabecera, query o cuerpo', async () => {
    assert.equal((await llamar('/resultados/901-A?rol=docente', 'tok-est', { headers: { 'x-rol': 'docente', rol: 'docente' } })).status, 403);
    const respuesta = await llamar('/decisiones', 'tok-est', { method: 'POST', body: JSON.stringify({ ...decisionValida, rol: 'docente' }) });
    assert.equal(respuesta.status, 201);
    assert.equal('rol' in (guardadas.at(-1) as object), false, 'el campo rol del cliente debe descartarse');
  });
  it('un usuario autenticado pero sin perfil no accede a rutas por rol (403)', async () => {
    assert.equal((await llamar('/resultados/901-A', 'tok-sinperfil')).status, 403);
    assert.equal((await llamar('/decisiones', 'tok-sinperfil', { method: 'POST', body: JSON.stringify(decisionValida) })).status, 403);
  });
  it('el docente SI consulta resultados (200)', async () => {
    assert.equal((await llamar('/resultados/901-A', 'tok-doc-a')).status, 200);
  });
  it('el docente NO puede registrar decisiones de estudiante (403)', async () => {
    assert.equal((await llamar('/decisiones', 'tok-doc-a', { method: 'POST', body: JSON.stringify(decisionValida) })).status, 403);
  });
});

describe('aislamiento por institucion', () => {
  it('cada docente solo ve los resultados de su propia institucion, aunque el grupo se llame igual', async () => {
    const a = (await (await llamar('/resultados/901-A', 'tok-doc-a')).json()) as { institucion: string }[];
    const b = (await (await llamar('/resultados/901-A', 'tok-doc-b')).json()) as { institucion: string }[];
    assert.deepEqual(a.map((r) => r.institucion), ['colegioa']);
    assert.deepEqual(b.map((r) => r.institucion), ['colegiob']);
  });
  it('pasar otra institucion en la query no cambia lo que se devuelve', async () => {
    const r = (await (await llamar('/resultados/901-A?institucion=colegiob', 'tok-doc-a')).json()) as { institucion: string }[];
    assert.deepEqual(r.map((x) => x.institucion), ['colegioa']);
  });
});

describe('POST /decisiones', () => {
  it('guarda la decision con el uid del token, no con el del cuerpo', async () => {
    const r = await llamar('/decisiones', 'tok-est', { method: 'POST', body: JSON.stringify(decisionValida) });
    assert.equal(r.status, 201);
    assert.equal((guardadas.at(-1) as { uid: string }).uid, 'est1');
  });
  it('rechaza una decision a nombre de otro usuario (403)', async () => {
    const r = await llamar('/decisiones', 'tok-est', { method: 'POST', body: JSON.stringify({ ...decisionValida, uid: 'otro' }) });
    assert.equal(r.status, 403);
  });
  it('descarta campos desconocidos y rechaza tipos incorrectos (400)', async () => {
    await llamar('/decisiones', 'tok-est', { method: 'POST', body: JSON.stringify({ ...decisionValida, admin: true, institucion: 'colegiob' }) });
    const guardada = guardadas.at(-1) as Record<string, unknown>;
    assert.equal('admin' in guardada, false);
    assert.equal('institucion' in guardada, false);
    const mala = await llamar('/decisiones', 'tok-est', { method: 'POST', body: JSON.stringify({ ...decisionValida, correcta: 'si' }) });
    assert.equal(mala.status, 400);
  });
});
