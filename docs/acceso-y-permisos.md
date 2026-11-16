# Acceso y permisos

## Modelo
- El **rol** (`estudiante` | `docente`) vive en `usuarios/{uid}` de Firestore. El navegador nunca decide el rol: ya no se guarda en `localStorage`.
- Un usuario nuevo siempre empieza como **estudiante**. Para ser **docente** necesita un **código de invitación** vigente.
- Las reglas impiden que un usuario cambie su `rol`, su `uid` o (si es docente) su `institucion`.
- La API lee el rol desde Firestore con el `uid` del token verificado; nada que envíe el cliente lo cambia.
- Los guards de Angular solo mejoran la experiencia; la seguridad real la imponen `firestore.rules` y la API.
- El roster vive en `grupos/{grupoId}/estudiantes/{uid}`. El estudiante puede escribir su propio resumen de progreso y los docentes asignados al grupo pueden leerlo; no se guarda ni se muestra el correo.
- El docente puede quitar a un estudiante de su grupo. La cuenta y el progreso personal del estudiante permanecen, y los agregados históricos del grupo no se recalculan.

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

## Límites conocidos
- **Alta de estudiantes:** el vínculo al grupo se hace mediante el código de invitación. La búsqueda por correo y la importación de listas requieren un servicio administrativo seguro para localizar cuentas; no se deben resolver permitiendo a docentes consultar perfiles globales.
- **Puntuación en el cliente:** la lógica de juego se ejecuta en el navegador; las métricas son educativas y no deben usarse como calificación verificada.
