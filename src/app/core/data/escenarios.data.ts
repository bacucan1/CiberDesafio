import { Escenario, NodoDecision } from '../models/domain.models';

export const ESCENARIO_PHISHING: Escenario = {
  id: 'phishing-beca',
  eje: 'fraude',
  titulo: 'La falsa beca universitaria',
  descripcion: 'Una invitacion promete una beca y solicita tus datos con urgencia.',
  nodos: [
    {
      id: 'inicio',
      pregunta: 'Recibes un correo con el logo de una universidad. ¿Que haces primero?',
      opciones: [
        {
          id: 'abrir-enlace',
          texto: 'Abro el enlace para revisar la oferta.',
          siguienteNodoId: 'enlace',
          correcta: false,
          consecuencia: 'El sitio intenta capturar tu usuario y contraseña.',
          explicacion: 'Los mensajes con urgencia y enlaces no verificados son una señal frecuente de phishing.',
        },
        {
          id: 'verificar-remitente',
          texto: 'Reviso el remitente y busco la oferta en el sitio oficial.',
          siguienteNodoId: 'verificacion',
          correcta: true,
          consecuencia: 'Confirmas que la oferta no aparece en los canales oficiales.',
          explicacion: 'Verificar por un canal independiente evita confiar en un enlace enviado por terceros.',
        },
      ],
    },
    {
      id: 'enlace',
      pregunta: 'La pagina pide tu contraseña institucional para continuar. ¿Como respondes?',
      opciones: [
        {
          id: 'entregar-clave',
          texto: 'Escribo la contraseña porque la pagina parece profesional.',
          siguienteNodoId: 'cierre',
          correcta: false,
          consecuencia: 'Entregas una credencial que puede reutilizarse para entrar a tus cuentas.',
          explicacion: 'El diseño visual no demuestra legitimidad. Ninguna beca debe exigir tu contraseña personal.',
        },
        {
          id: 'cerrar-reportar',
          texto: 'Cierro la pagina y reporto el mensaje al docente o a soporte.',
          siguienteNodoId: 'cierre',
          correcta: true,
          consecuencia: 'Evitas compartir la credencial y ayudas a alertar a otras personas.',
          explicacion: 'Cerrar, reportar y avisar permite contener el intento de fraude.',
        },
      ],
    },
    {
      id: 'verificacion',
      pregunta: 'No encuentras la oferta en el sitio oficial. ¿Cual es el siguiente paso?',
      opciones: [
        {
          id: 'responder-correo',
          texto: 'Respondo el correo para preguntar si es real.',
          siguienteNodoId: 'cierre',
          correcta: false,
          consecuencia: 'Confirmas que tu correo esta activo y mantienes el contacto con el atacante.',
          explicacion: 'No conviene responder ni usar los datos de contacto del mensaje sospechoso.',
        },
        {
          id: 'reportar-mensaje',
          texto: 'Lo marco como phishing y lo elimino sin responder.',
          siguienteNodoId: 'cierre',
          correcta: true,
          consecuencia: 'Cortas el contacto y contribuyes a que el servicio bloquee mensajes similares.',
          explicacion: 'Reportar y eliminar es la respuesta adecuada cuando la informacion no se puede validar.',
        },
      ],
    },
    {
      id: 'cierre',
      pregunta: 'Escenario completado',
      opciones: [],
    },
  ],
};

// Historia ramificada inspirada en juegos de decisiones: cada opcion cambia el estado de la historia.
export const ESCENARIO_REINAS: Escenario = {
  id: 'turno-decisivo',
  eje: 'fraude',
  titulo: 'Turno decisivo',
  descripcion: 'Una mañana normal se convierte en una cadena de decisiones digitales.',
  nodos: [
    {
      id: 'entrada',
      pregunta: 'Antes de entrar a clase recibes un mensaje: “Ganaste una beca. Responde YA”.',
      opciones: [
        { id: 'verificar', texto: 'Busco la convocatoria en el canal oficial.', siguienteNodoId: 'canal-oficial', correcta: true, consecuencia: 'La oferta no existe en los canales oficiales.', explicacion: 'Una pausa y una verificación independiente rompen la urgencia del fraude.', impacto: { seguridad: 12, confianza: 3, reputacion: 4 } },
        { id: 'clic', texto: 'Abro el enlace para no perder la oportunidad.', siguienteNodoId: 'enlace-sospechoso', correcta: false, consecuencia: 'La página pide iniciar sesión para “reservar” tu premio.', explicacion: 'La urgencia y el enlace desconocido intentan empujarte a actuar sin pensar.', impacto: { seguridad: -15, confianza: -4, reputacion: 0 } },
      ],
    },
    {
      id: 'canal-oficial',
      pregunta: 'El coordinador confirma que nadie está ofreciendo becas. ¿Qué haces con el mensaje?',
      opciones: [
        { id: 'reportar', texto: 'Lo reporto y aviso al grupo sin reenviar el enlace.', siguienteNodoId: 'grupo-seguro', correcta: true, consecuencia: 'El grupo evita el enlace y el colegio puede alertar a más estudiantes.', explicacion: 'Reportar sin amplificar el contenido protege a la comunidad.', impacto: { seguridad: 10, confianza: 8, reputacion: 8 } },
        { id: 'reenviar-alerta', texto: 'Lo reenvío al grupo para preguntar si alguien sabe algo.', siguienteNodoId: 'grupo-expuesto', correcta: false, consecuencia: 'El enlace sospechoso llega a más personas.', explicacion: 'Aunque la intención sea alertar, reenviar el enlace aumenta la exposición.', impacto: { seguridad: -5, confianza: -3, reputacion: 2 } },
      ],
    },
    {
      id: 'enlace-sospechoso',
      pregunta: 'La página solicita tu contraseña institucional y un código recibido por SMS.',
      opciones: [
        { id: 'cerrar', texto: 'Cierro la página y reporto el mensaje.', siguienteNodoId: 'grupo-seguro', correcta: true, consecuencia: 'Detienes el intento antes de entregar una credencial.', explicacion: 'Una organización legítima nunca necesita tu contraseña ni códigos privados.', impacto: { seguridad: 8, confianza: 2, reputacion: 4 } },
        { id: 'entregar-codigo', texto: 'Entrego el código: parece la última validación.', siguienteNodoId: 'cuenta-comprometida', correcta: false, consecuencia: 'La sesión se abre en otro dispositivo.', explicacion: 'Los códigos de verificación son tan privados como una contraseña.', impacto: { seguridad: -25, confianza: -12, reputacion: -6 } },
      ],
    },
    {
      id: 'grupo-seguro',
      pregunta: 'Un compañero te escribe en privado: “¿Puedes revisar este enlace por mí?”.',
      opciones: [
        { id: 'explicar', texto: 'Le explico cómo verificarlo y le paso el canal oficial.', siguienteNodoId: 'cierre', correcta: true, consecuencia: 'Tu compañero aprende una forma segura de verificar futuros mensajes.', explicacion: 'Compartir el criterio, no el enlace, convierte una decisión en aprendizaje colectivo.', impacto: { seguridad: 8, confianza: 10, reputacion: 10 } },
        { id: 'revisar-por-el', texto: 'Lo abro yo primero para comprobarlo.', siguienteNodoId: 'cierre', correcta: false, consecuencia: 'Vuelves a exponerte al mismo riesgo.', explicacion: 'La curiosidad no justifica abrir un enlace que ya fue identificado como sospechoso.', impacto: { seguridad: -8, confianza: -4, reputacion: 1 } },
      ],
    },
    {
      id: 'grupo-expuesto',
      pregunta: 'Varios compañeros preguntan si ya hiciste clic. ¿Cómo reparas la situación?',
      opciones: [
        { id: 'admitir-reportar', texto: 'Admito el error, aviso y pido que no abran el enlace.', siguienteNodoId: 'cierre', correcta: true, consecuencia: 'El grupo detiene la cadena antes de que crezca.', explicacion: 'Pedir ayuda a tiempo reduce el impacto de una decisión riesgosa.', impacto: { seguridad: 7, confianza: 9, reputacion: 6 } },
        { id: 'callar', texto: 'No digo nada para evitar quedar mal.', siguienteNodoId: 'cierre', correcta: false, consecuencia: 'El mensaje sigue circulando sin una advertencia clara.', explicacion: 'Ocultar un incidente deja a otras personas sin información para protegerse.', impacto: { seguridad: -12, confianza: -10, reputacion: -8 } },
      ],
    },
    {
      id: 'cuenta-comprometida',
      pregunta: 'La sesión se abrió y el sistema muestra actividad desconocida. ¿Cuál es tu prioridad?',
      opciones: [
        { id: 'pedir-ayuda', texto: 'Aviso a soporte, cambio la contraseña desde el sitio oficial y cierro sesiones.', siguienteNodoId: 'cierre', correcta: true, consecuencia: 'Soporte contiene el incidente y recuperas el control.', explicacion: 'Actuar rápido por canales oficiales limita el daño.', impacto: { seguridad: 12, confianza: 5, reputacion: 4 } },
        { id: 'ignorar', texto: 'Lo ignoro: quizá sea una notificación normal.', siguienteNodoId: 'cierre', correcta: false, consecuencia: 'La actividad extraña continúa durante más tiempo.', explicacion: 'Una señal desconocida merece revisión inmediata, no silencio.', impacto: { seguridad: -14, confianza: -8, reputacion: -4 } },
      ],
    },
    { id: 'cierre', pregunta: 'Tu turno termina. Las decisiones de hoy cambian cómo te recordará tu comunidad.', opciones: [] },
  ],
};

interface RutaConfig {
  id: string;
  titulo: string;
  eje: Escenario['eje'];
  personaje: string;
  icono: string;
  color: string;
  contexto: string;
}

const RUTAS: RutaConfig[] = [
  { id: 'beca-fantasma', titulo: 'La beca fantasma', eje: 'fraude', personaje: 'Lina · grado 10', icono: 'school', color: '#7056c8', contexto: 'Un mensaje promete una beca universitaria exclusiva.' },
  { id: 'premio-digital', titulo: 'El premio inesperado', eje: 'fraude', personaje: 'Mateo · grado 9', icono: 'gift', color: '#e16d57', contexto: 'Una notificación dice que ganaste un teléfono nuevo.' },
  { id: 'falso-soporte', titulo: 'Soporte en línea', eje: 'fraude', personaje: 'Sara · grado 11', icono: 'headset', color: '#278b91', contexto: 'Una cuenta con el logo del colegio pide verificar tu acceso.' },
  { id: 'venta-urgente', titulo: 'La venta relámpago', eje: 'fraude', personaje: 'Nico · grado 10', icono: 'cart', color: '#d58a32', contexto: 'Una tienda ofrece un computador a un precio imposible.' },
  { id: 'cuenta-clonada', titulo: 'La cuenta clonada', eje: 'fraude', personaje: 'Valeria · grado 9', icono: 'copy', color: '#9b568e', contexto: 'Una cuenta idéntica a la de tu amigo empieza a seguirte.' },
  { id: 'grupo-familiar', titulo: 'Alerta familiar', eje: 'relación de riesgo', personaje: 'Tomás · grado 11', icono: 'people', color: '#4675b8', contexto: 'Un familiar escribe desde un número desconocido con mucha urgencia.' },
  { id: 'reto-viral', titulo: 'El reto viral', eje: 'relación de riesgo', personaje: 'Emilia · grado 9', icono: 'videocam', color: '#cc5b7b', contexto: 'Un reto popular pide publicar información privada.' },
  { id: 'captura-privada', titulo: 'La captura privada', eje: 'relación de riesgo', personaje: 'Juan · grado 10', icono: 'chatbubbles', color: '#5a70bf', contexto: 'Alguien comparte una conversación privada en el grupo.' },
  { id: 'perfil-falso', titulo: 'El perfil nuevo', eje: 'relación de riesgo', personaje: 'Ana · grado 11', icono: 'person-add', color: '#ad628d', contexto: 'Una persona desconocida quiere hablar contigo todos los días.' },
  { id: 'rumor-digital', titulo: 'El rumor digital', eje: 'relación de riesgo', personaje: 'Lucas · grado 9', icono: 'megaphone', color: '#c56d4a', contexto: 'Un audio acusa a un compañero y circula por varios chats.' },
  { id: 'clave-repetida', titulo: 'La misma contraseña', eje: 'higiene', personaje: 'Sofía · grado 10', icono: 'key', color: '#378c72', contexto: 'Una aplicación te pide crear una cuenta y piensas reutilizar tu clave.' },
  { id: 'wifi-publico', titulo: 'Wi-Fi abierto', eje: 'higiene', personaje: 'David · grado 11', icono: 'wifi', color: '#4d79a9', contexto: 'Necesitas conectarte a una red pública para entregar una tarea.' },
  { id: 'foto-geolocalizada', titulo: 'La foto del paseo', eje: 'higiene', personaje: 'Mía · grado 9', icono: 'location', color: '#d27d43', contexto: 'Una foto divertida también muestra dónde estás y cuándo volverás.' },
  { id: 'app-desconocida', titulo: 'La aplicación curiosa', eje: 'higiene', personaje: 'Samuel · grado 10', icono: 'phone-portrait', color: '#7a64b9', contexto: 'Una app popular solicita permisos para cámara, contactos y ubicación.' },
  { id: 'respaldo-perdido', titulo: 'El archivo perdido', eje: 'higiene', personaje: 'Laura · grado 11', icono: 'document-lock', color: '#3d8e9a', contexto: 'Tu dispositivo falla justo antes de una entrega importante.' },
  { id: 'suplantacion-docente', titulo: 'El mensaje del docente', eje: 'fraude', personaje: 'Andrés · grado 9', icono: 'person-circle', color: '#7062b5', contexto: 'Un mensaje parece venir de tu docente y pide una acción inmediata.' },
  { id: 'sorteo-redes', titulo: 'El sorteo de redes', eje: 'fraude', personaje: 'Camila · grado 10', icono: 'trophy', color: '#d78a37', contexto: 'Una publicación ofrece un premio por etiquetar a diez amigos.' },
  { id: 'broma-peligrosa', titulo: 'La broma pesada', eje: 'relación de riesgo', personaje: 'Leo · grado 11', icono: 'warning', color: '#d25d5d', contexto: 'El grupo quiere publicar un video de alguien sin permiso.' },
  { id: 'datos-del-equipo', titulo: 'Datos del equipo', eje: 'higiene', personaje: 'Isabella · grado 9', icono: 'desktop', color: '#3a8c85', contexto: 'Un formulario escolar solicita más datos de los necesarios.' },
  { id: 'pantalla-compartida', titulo: 'La pantalla compartida', eje: 'higiene', personaje: 'Felipe · grado 10', icono: 'videocam', color: '#5572b1', contexto: 'Durante una videollamada aparece una notificación privada.' },
];

const PREGUNTAS = [
  ['La historia comienza. ¿Cuál es tu primer movimiento?', 'Busco una fuente oficial antes de actuar.', 'Actúo rápido para no perder la oportunidad.'],
  ['La situación cambia y aparece una solicitud de datos. ¿Qué decides?', 'Pido contexto y comparto solo lo necesario.', 'Entrego la información porque parece una emergencia.'],
  ['Una persona del grupo te pide reenviar el contenido. ¿Cómo respondes?', 'Advierto del riesgo y no amplifico el mensaje.', 'Lo reenvío para que todos puedan opinar.'],
  ['La presión aumenta. ¿Qué protege mejor a tu comunidad?', 'Reporto por un canal confiable y pido ayuda.', 'Guardo silencio para evitar problemas.'],
  ['Tu turno termina. ¿Qué aprendizaje dejas en la historia?', 'Explico el criterio para que otros puedan repetirlo.', 'Sigo adelante sin revisar qué ocurrió.'],
  ['Aparece una nueva notificación en tu dispositivo. ¿Qué haces?', 'Reviso permisos, remitente y contexto antes de responder.', 'Pulso primero y reviso después.'],
  ['Tu equipo te pide una recomendación para evitar el problema.', 'Propongo una acción concreta y un canal oficial de ayuda.', 'Digo que cada persona debe resolverlo por su cuenta.'],
  ['Antes de cerrar el día, ¿qué hábito te llevas?', 'Activo una protección y comparto lo aprendido.', 'Dejo la configuración para otro momento.'],
];

function crearRuta(config: RutaConfig): Escenario {
  const nodos: NodoDecision[] = PREGUNTAS.map((pregunta, index) => ({
    id: `${config.id}-${index + 1}`,
    pregunta: index === 0 ? `${config.contexto} ${pregunta[0]}` : pregunta[0],
    opciones: [
      { id: `${config.id}-segura-${index + 1}`, texto: pregunta[1], siguienteNodoId: index === 4 ? `${config.id}-cierre` : `${config.id}-${index + 2}`, correcta: true, consecuencia: index === 4 ? 'Cierras el ciclo y dejas una comunidad más preparada.' : 'Tu decisión abre una ruta de mayor control y claridad.', explicacion: 'Verificar, pedir ayuda y compartir criterio reduce el impacto del riesgo.', impacto: { seguridad: 9, confianza: 7, reputacion: 8 } },
      { id: `${config.id}-riesgo-${index + 1}`, texto: pregunta[2], siguienteNodoId: index === 4 ? `${config.id}-cierre` : `${config.id}-${index + 2}`, correcta: false, consecuencia: 'La presión gana espacio y la situación se vuelve más difícil de controlar.', explicacion: 'Actuar sin verificar puede afectar tus cuentas y también a quienes te rodean.', impacto: { seguridad: -10, confianza: -7, reputacion: -6 } },
    ],
  }));

  nodos.push({ id: `${config.id}-cierre`, pregunta: 'La historia queda marcada por tus decisiones.', opciones: [] });
  const temas = ['Phishing', 'Smishing', 'Ingeniería social', 'Ciberacoso', 'Contraseñas inseguras', 'Privacidad en redes sociales'];
  return { id: config.id, eje: config.eje, tema: temas[RUTAS.indexOf(config) % temas.length], titulo: config.titulo, descripcion: config.contexto, nodos, icono: config.icono, color: config.color, personaje: config.personaje, capitulo: 'RUTA ' + String(RUTAS.indexOf(config) + 1).padStart(2, '0') };
}

export const RUTAS_CIBERDESAFIO: Escenario[] = RUTAS.map(crearRuta);
export const ESCENARIOS: Escenario[] = [RUTAS_CIBERDESAFIO[0], ...RUTAS_CIBERDESAFIO.slice(1), ESCENARIO_REINAS, ESCENARIO_PHISHING];