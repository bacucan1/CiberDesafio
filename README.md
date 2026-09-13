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
Firebase Cloud Functions + Firebase Hosting
```

### Frontend

- Pantalla de inicio y autenticación.
- Flujo de juego narrativo para estudiantes.
- Mazo de escenarios y motor de decisiones basado en datos.
- Persistencia de decisiones en Firestore.
- Panel docente con indicadores agregados.

### Backend y servicios

- API REST protegida con tokens de Firebase.
- Cloud Function para recalcular resultados agregados.
- Reglas de seguridad de Firestore por usuario y rol.
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
	functions/           Cloud Functions
```

## Inicio rápido

### Frontend

```bash
npm install
npm start
```

La aplicación estará disponible en `http://localhost:4200` o en el puerto indicado por Ionic.

### Firebase

1. Configura las credenciales del proyecto en `src/app/core/firebase.config.ts`.
2. Activa Email/Password y Google en Firebase Authentication.
3. Crea la base de datos de Firestore.
4. Publica las reglas de seguridad cuando corresponda.

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
- `POST /decisiones`
- `GET /resultados/:grupo`

Los endpoints protegidos requieren un token Bearer de Firebase. Los resultados agregados requieren rol docente.

## Despliegue

```bash
npm run build
firebase deploy --only hosting,firestore:rules,functions
```

## Equipo

**CyberShield Team**

Proyecto académico de la Universidad Libre para la asignatura Gestión de Proyectos de Ingeniería.

## Propósito

> Fortalecer las capacidades de estudiantes de 9.º a 11.º frente a amenazas de ciberseguridad mediante simulación de decisiones, gamificación y retroalimentación educativa.