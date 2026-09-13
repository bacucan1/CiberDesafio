# CiberDesafio

Aplicacion educativa de simulacion de decisiones de ciberseguridad para instituciones educativas colombianas.

## Desarrollo

1. Completa `src/app/core/firebase.config.ts` con las credenciales de Firebase.
2. Ejecuta `npm install` y `npm start` dentro de la carpeta del frontend.
3. Para la API: `cd backend`, `npm install`, `npm run dev`. Requiere credenciales de Firebase Admin mediante `GOOGLE_APPLICATION_CREDENTIALS`.

## Despliegue

```bash
npm run build
firebase deploy --only hosting,firestore:rules,functions
```

La API expone `GET /escenarios`, `GET /escenarios/:id`, `POST /decisiones` y `GET /resultados/:grupo`. Todos requieren un token Bearer de Firebase; resultados requiere rol docente.