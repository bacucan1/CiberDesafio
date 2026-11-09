# CiberDesafío

## Una decisión puede cambiar la historia

CiberDesafío es una experiencia educativa interactiva que fortalece las capacidades de estudiantes de 9.º a 11.º frente a amenazas de ciberseguridad.

El proyecto convierte situaciones digitales cotidianas en una aventura narrativa: el estudiante recibe una carta, toma una decisión, observa sus consecuencias y aprende qué podría hacer en la vida real.

> **Situación → Decisión → Consecuencia → Retroalimentación → Nueva situación**

## El problema

Phishing, smishing, ingeniería social, ciberacoso, contraseñas inseguras y problemas de privacidad forman parte de la vida diaria de los estudiantes. Sin embargo, estos riesgos suelen enseñarse como conceptos aislados o cuestionarios tradicionales.

CiberDesafío propone practicar el criterio digital en un entorno seguro, visual y dinámico.

## La experiencia

La interfaz está inspirada conceptualmente en los juegos narrativos de toma de decisiones, con una identidad visual futurista propia.

- Cartas de situación con personajes y contextos cercanos.
- Decisiones mediante clic o gesto de arrastre hacia la izquierda o derecha.
- Consecuencias inmediatas y retroalimentación educativa.
- Historias ramificadas con múltiples caminos.
- Indicadores de seguridad, confianza y reputación.
- Sistema de XP, rachas, niveles y rangos finales.
- Sonido opcional y animaciones sutiles.
- Diseño responsive para computador, tablet y celular.

## Campaña de aprendizaje

El mazo incluye 20 rutas narrativas, cada una con cinco o más decisiones. Los temas principales son:

| Tema | Ejemplo de situación |
| --- | --- |
| Phishing | Un correo anuncia que la cuenta será bloqueada si no verificas tus datos. |
| Smishing | Un SMS informa que tienes un paquete retenido y solicita un pago. |
| Ingeniería social | Una persona que finge ser soporte pide información privada. |
| Ciberacoso | En un grupo se comparte una imagen humillante de otro estudiante. |
| Contraseñas inseguras | Una aplicación solicita crear una contraseña nueva. |
| Privacidad en redes sociales | Una red social pide acceso a ubicación, contactos y fotografías. |

Al finalizar un escenario, el estudiante recibe una evaluación de sus habilidades:

- `0-39`: En riesgo
- `40-59`: Aprendiz digital
- `60-79`: Usuario consciente
- `80-94`: Guardián digital
- `95-100`: Experto en ciberseguridad

## Público objetivo

Estudiantes de 9.º a 11.º de instituciones educativas colombianas, con una experiencia suficientemente clara para aprender y suficientemente atractiva para sentirse como un videojuego educativo, no como un examen.

El docente dispone de un panel con resultados agregados por grupo y tema para identificar qué habilidades necesitan mayor refuerzo.

## Arquitectura

```text
Ionic + Angular + TypeScript
				|
				| Firebase Authentication / Firestore
				|
Node.js + TypeScript + Express
				|
Firebase Hosting
```

### Frontend

- Pantalla de inicio y autenticación.
- Recuperación de contraseña y registro de estudiantes y docentes para pruebas.
- Panel de perfil autenticado con nombre editable, correo, rol, institución, grado y grupo.
- Vinculación de estudiantes mediante códigos de grupo con vencimiento, límite de usos y revocación.
- Flujo de juego narrativo para estudiantes.
- Mazo de escenarios y puntuación calculados localmente en el cliente.
- Persistencia directa en Firestore de métricas agregadas por grupo y eje; no se guarda historial individual de decisiones.
- Panel docente con resultados agregados y sin historial individual de estudiantes.

### Backend y servicios

- API REST protegida con tokens de Firebase.
- Firestore para invitaciones, vinculación y sincronización de métricas; sus reglas limitan operaciones a perfiles y grupos autorizados.
- Las funciones de escritura y cálculo se ejecutan en el cliente; el plan Spark no requiere Cloud Functions.
- Firebase Hosting para el despliegue web.
- Capacitor para empaquetar la misma aplicación en Android e iOS.

## Estructura principal

```text
src/app/
	core/
		data/              Escenarios y rutas narrativas
		guards/            Protección de rutas por rol
		models/            Modelos TypeScript
		services/          Auth, escenarios, decisiones y resultados
	home/                Experiencia de juego del estudiante
	login/               Registro e inicio de sesión
	teacher/             Panel docente
	welcome/             Presentación inicial

shared/                Interfaces compartidas
backend/
	src/                 API Express
	functions/           Fuentes legadas de Cloud Functions (no desplegadas)
```

## Inicio rápido

### Frontend

```bash
npm install
npm start
```

La aplicación estará disponible en `http://localhost:4200` o en el puerto indicado por Ionic.

### Firebase

1. Configura las credenciales de un proyecto Firebase **exclusivo para pruebas** en `src/app/core/firebase.config.ts`.
2. Activa Email/Password y Google en Firebase Authentication.
3. Crea la base de datos de Firestore.
4. Publica `firestore.rules` únicamente en ese proyecto de pruebas.
5. El registro de estudiantes crea perfiles sin institución. En modo de prueba, el docente puede escribir libremente el nombre de una institución ficticia y crear su cuenta sin código; el perfil queda marcado con `modoPrueba: true`. Luego puede crear grupos y compartir sus códigos con estudiantes para probar la vinculación y los resultados.

**No uses estas reglas ni datos reales en producción.** Durante las pruebas, cualquier usuario autenticado puede crear un perfil docente de prueba y declarar una institución; utiliza únicamente datos ficticios. Antes de integrar una institución real, elimina esta vía de autorregistro docente, vuelve obligatorio un mecanismo de autorización administrativa y audita las reglas y los perfiles existentes.

La app determina el rol leyendo el perfil de Firestore; el valor guardado en el navegador no concede permisos. Desde `/docente`, el profesor crea un grupo y un código de hasta 30 usos con vencimiento a 14 días. El estudiante canjea ese código en `/perfil`; una transacción valida grupo, institución declarada, grado, vencimiento y cupo, y actualiza a la vez el perfil y los usos del código. No se puede cambiar de institución mediante una edición de perfil.

La ruta `/perfil` muestra el correo (solo lectura), proveedor de inicio de sesión de Firebase, rol y datos académicos. Cada persona puede actualizar su nombre; se normalizan espacios y se permiten hasta 80 caracteres. Los datos académicos se obtienen del código de grupo validado y no se editan libremente.

### Al integrar instituciones reales

Actualmente no hay instituciones integradas: el alta docente sin código es solo para pruebas y no verifica identidad ni afiliación. No conectes estos datos ficticios con cuentas o registros reales. Para pasar a producción:

1. Define cómo una institución autorizará y administrará a sus docentes.
2. Deshabilita en `firestore.rules` la creación de docentes con `modoPrueba: true`.
3. Habilita solo un flujo de autorización verificable y prueba las reglas en el emulador.
4. Migra/audita los perfiles y códigos existentes, y separa los proyectos Firebase de pruebas y producción.

El proyecto conserva la validación transaccional de códigos administrativos como base para ese futuro flujo, pero el formulario actual de registro no los solicita.

El panel docente muestra resultados agregados por grupo y eje, cantidad de participantes, porcentaje global ponderado y prioridad de refuerzo; permite actualizar la vista manualmente. No muestra nombres, correos ni resultados individuales. Las métricas se calculan en el dispositivo y no deben tratarse como evidencia de evaluación verificada.

### API

```bash
cd backend
npm install
npm run dev
```

La API requiere credenciales de Firebase Admin mediante `GOOGLE_APPLICATION_CREDENTIALS`.

## Endpoints principales

- `GET /escenarios`
- `GET /escenarios/:id`
- `GET /resultados/:grupo`

El juego no llama a Cloud Functions para puntuar. El cliente calcula resultados con el catálogo local y escribe solo los contadores agregados autorizados por las reglas de Firestore. La colección `decisiones` no se usa para guardar el historial de juego.

Los endpoints protegidos requieren un token Bearer de Firebase. Los resultados agregados requieren rol docente.

## Despliegue

### Pruebas de acceso

Las pruebas de rutas Angular comprueban que alterar `localStorage` no concede acceso docente. Las pruebas de reglas verifican que un estudiante no puede crear o promover perfiles docentes, leer decisiones ajenas ni consultar resultados de otra institución:

```bash
npm test -- --watch=false
npm run test:security
```

`test:security` requiere Firebase CLI y Java para iniciar el emulador local de Firestore.

```bash
npm run build
firebase deploy --only hosting,firestore:rules
```

El frontend, Authentication y Firestore se mantienen dentro del plan Firebase Spark sujeto a sus cuotas. Las fuentes antiguas de Cloud Functions bajo `backend/functions` se conservan como referencia, pero ya no están configuradas ni se despliegan desde `firebase.json`.

## Equipo

**CyberShield Team**

Proyecto académico de la Universidad Libre para la asignatura Gestión de Proyectos de Ingeniería.

## Propósito

> Fortalecer las capacidades de estudiantes de 9.º a 11.º frente a amenazas de ciberseguridad mediante simulación de decisiones, gamificación y retroalimentación educativa.