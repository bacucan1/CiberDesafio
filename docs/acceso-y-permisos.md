# Acceso y permisos

## Modelo
- El **rol** (`estudiante` | `docente`) vive en `usuarios/{uid}` de Firestore. El navegador nunca decide el rol: ya no se guarda en `localStorage`.
- Un usuario nuevo siempre empieza como **estudiante**. Para ser **docente** necesita un **código de invitación** vigente.
- Las reglas impiden que un usuario cambie su `rol`, su `uid` o (si es docente) su `institucion`.
- La API lee el rol desde Firestore con el `uid` del token verificado; nada que envíe el cliente lo cambia.
- Los guards de Angular solo mejoran la experiencia; la seguridad real la imponen `firestore.rules` y la API.

## Cómo crear un código docente (administrador)
1. Firebase Console → Firestore → colección `codigos_invitacion`.
2. Crear un documento cuyo **ID** sea `<institucion>-<secreto>`, por ejemplo `colegiosur-K7P2Q9ZX`
   (institución en minúsculas y números, 2–30 caracteres; secreto de 6–32 letras/números).
3. Agregar el campo `activo` (boolean) = `true`.
4. Entregar el código completo al docente. Para revocarlo: `activo = false` o borrar el documento.
5. La institución del docente queda fijada por el prefijo (`colegiosur`). Es la misma clave que usa `resultados_agregados.institucion`.

## Antes de desplegar
- Revisar la colección `usuarios` en producción: hasta ahora cualquiera podía escribirse `rol: 'docente'`. Corregir a mano los docentes no legítimos.
- Desplegar: `firebase deploy --only firestore:rules`.
- Definir `CORS_ORIGINS` en la API (lista separada por comas); sin definir acepta cualquier origen.
- Volver a compilar la API (`cd backend && npm run build`) si se edita `backend/src`.

## Pruebas
| Qué | Comando | Estado |
|---|---|---|
| API (roles, institución, validación) | `cd backend && npm test` | 13 pruebas |
| Guard de rutas | `npm test` (ng test) | 8 pruebas |
| Reglas de Firestore (emulador) | `cd tests/rules && npm install && npm test` (requiere Java) | 27 pruebas (no ejecutadas aún) |

## Decisiones pendientes con el equipo
- **Institución y grupo del estudiante:** hoy se guardan vacíos (`institucion: ''`). Sin esto, los resultados agregados no se pueden asociar a un docente. Lo más seguro es un código de grupo/institución que entregue el docente (como el de invitación). Es decisión conjunta con Andrés.
- **Modelo de `resultados_agregados`:** el docente solo puede leer con consulta filtrada por `where('institucion','==', <la suya>)`.
- **Puntuación en el cliente:** `correcta` y `puntuacion` los envía el navegador; un estudiante podría falsearlos. Validarlos en el servidor contra los escenarios es un siguiente paso.
