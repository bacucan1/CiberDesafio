import { Injectable, inject } from '@angular/core';
import { TranslationService } from './translation.service';

export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export interface AiExerciseOption {
  id: string;
  text: string;
  isCorrect: boolean;
  consequence: string;
  feedback: string;
  securityImpact: number;
  trustImpact: number;
  reputationImpact: number;
}

export interface AiExercise {
  id: string;
  vector: string;
  vectorCategory: 'fraude' | 'relación de riesgo' | 'higiene';
  difficulty: DifficultyLevel;
  threatLevel: 'Baja' | 'Media' | 'Alta' | 'Crítica';
  targetRole: string;
  scenarioTitle: string;
  scenarioDescription: string;
  incidentDetails: {
    senderOrSource: string;
    triggerUrgency: string;
    redFlagClue: string;
  };
  options: AiExerciseOption[];
  mitreAttackTechnique: string;
  mitreCode: string;
  cisoRecommendation: string;
}

@Injectable({
  providedIn: 'root',
})
export class AiExerciseService {
  private readonly t = inject(TranslationService);

  private readonly attackVectors = [
    { name: 'Phishing por Correo Electrónico', category: 'fraude' as const, mitre: 'Phishing: Spearphishing Link', code: 'T1566.002' },
    { name: 'Smishing por SMS / Mensajería', category: 'fraude' as const, mitre: 'Phishing: Spearphishing via Service', code: 'T1566.003' },
    { name: 'Ingeniería Social & Pretexting', category: 'relación de riesgo' as const, mitre: 'Social Engineering: Pretexting', code: 'T1598' },
    { name: 'QR Hijacking (Quishing)', category: 'fraude' as const, mitre: 'Drive-by Compromise via QR', code: 'T1189' },
    { name: 'Fatiga de Autenticación MFA (MFA Prompt Bombing)', category: 'higiene' as const, mitre: 'Multi-Factor Authentication Request Generation', code: 'T1621' },
    { name: 'Ataque de Red Wi-Fi Gemela (Evil Twin AP)', category: 'higiene' as const, mitre: 'Adversary-in-the-Middle (AiTM)', code: 'T1557' },
    { name: 'Malware en Mod / Crack de Videojuegos', category: 'higiene' as const, mitre: 'User Execution: Malicious File', code: 'T1204.002' },
    { name: 'Suplantación de Identidad en Redes (Deepfake de Audio)', category: 'relación de riesgo' as const, mitre: 'Impersonation via Synthetic Media', code: 'T1656' },
  ];

  private readonly targets = [
    'Estudiante en semana de exámenes',
    'Administrador de grupo estudiantil',
    'Jugador competitivo en línea',
    'Usuario de banca móvil para jóvenes',
    'Estudiante realizando tareas en biblioteca pública',
  ];

  private readonly templates = [
    {
      templateId: 'phish_grade_portal',
      title: 'Alerta urgente del sistema de notas escolares',
      desc: 'Recibes un correo urgente con el logo de tu colegio: "Aviso final: Se ha detectado una inconsistencia en tu matrícula académica. Debes ingresar tus credenciales en el siguiente enlace antes de las 6:00 PM o tu cuenta será suspendida". El remitente es `soporte-matriculas@colegio-portal-edu.org` (el dominio oficial de tu colegio es `colegio.edu.co`).',
      sender: 'soporte-matriculas@colegio-portal-edu.org',
      urgency: 'Plazo límite de 2 horas bajo amenaza de suspensión de matrícula.',
      clue: 'El dominio remitente no coincide con el oficial (.org vs .edu.co) y exige contraseñas bajo pánico.',
      options: [
        {
          id: 'opt_1',
          text: 'No hacer clic en el enlace, abrir el navegador, entrar directamente al portal oficial de notas y notificar a la secretaría del colegio.',
          isCorrect: true,
          consequence: 'Comprobaste que tus notas y matrícula estaban en orden y el colegio emitió una alerta de seguridad para toda la comunidad.',
          feedback: 'Excelente criterio digital. Nunca accedas a portales sensibles desde enlaces de correos que emplean tácticas de intimidación y urgencia.',
          securityImpact: 20,
          trustImpact: 15,
          reputationImpact: 10,
        },
        {
          id: 'opt_2',
          text: 'Hacer clic de inmediato e ingresar tu correo y contraseña institucional para evitar que te suspendan la cuenta.',
          isCorrect: false,
          consequence: 'Tus credenciales fueron capturadas en un portal clon. Los atacantes cambiaron tu clave y accedieron a tus registros escolares.',
          feedback: 'Caíste en la trampa del sentido de urgencia. Los colegios nunca exigen verificar contraseñas mediante amenazas inmediatas de suspensión.',
          securityImpact: -30,
          trustImpact: -25,
          reputationImpact: -20,
        },
        {
          id: 'opt_3',
          text: 'Responder al correo preguntando si el mensaje es auténtico y enviando una captura de tu documento de identidad.',
          isCorrect: false,
          consequence: 'Confirmaste al atacante que tu dirección está activa y entregaste datos de identidad para futuros fraudes.',
          feedback: 'Nunca respondas a un remitente sospechoso ni facilites documentos personales. Los canales de verificación deben ser independientes.',
          securityImpact: -25,
          trustImpact: -20,
          reputationImpact: -15,
        },
      ],
      recommendation: 'Verifica siempre el nombre de dominio en la barra de direcciones. Utiliza autenticación en dos pasos (2FA) en tus cuentas educativas.',
    },
    {
      templateId: 'smish_package_delivery',
      title: 'SMS de paquete postal retenido con recargo pendiente',
      desc: 'Llega un mensaje SMS a tu celular: "ENVÍOS EXPRESS: Su paquete con guía #CO-98421 no pudo ser entregado por dirección incompleta. Pague $4.500 COP de tasa aduanera en https://rastreo-colombia-envios.top para reprogramar entrega hoy". Recuerdas que compraste algo por internet hace unos días.',
      sender: '+57 312 998 0124 (SMS sin remitente corporativo)',
      urgency: 'Amenaza de devolución del paquete en 24 horas si no se paga en línea.',
      clue: 'Dominio de nivel superior sospechoso (.top), número móvil celular no oficial y solicitud de pago con tarjeta.',
      options: [
        {
          id: 'opt_1',
          text: 'Ingresar a la app o web oficial de la tienda donde compraste para revisar el código de rastreo real, ignorando el SMS.',
          isCorrect: true,
          consequence: 'Confirmaste que tu paquete seguía en tránsito normal y que el número de guía del SMS era falso.',
          feedback: 'Impecable. El smishing aprovecha que casi todos esperamos paquetes para robar datos de tarjetas bancarias mediante pasarelas falsas.',
          securityImpact: 20,
          trustImpact: 15,
          reputationImpact: 10,
        },
        {
          id: 'opt_2',
          text: 'Entrar al enlace y digitar el número de tu tarjeta débito para pagar los $4.500 COP y recibir el paquete.',
          isCorrect: false,
          consequence: 'La página falsa clonó los datos de la tarjeta y se registraron compras no autorizadas por cientos de miles de pesos.',
          feedback: 'Grave riesgo financiero. Los servicios de mensajería no cobran recargos aduaneros repentinos por enlaces de SMS no oficiales.',
          securityImpact: -35,
          trustImpact: -30,
          reputationImpact: -15,
        },
        {
          id: 'opt_3',
          text: 'Reenviar el mensaje al grupo de WhatsApp de tus amigos preguntando si a ellos les ha llegado el mismo cobro.',
          isCorrect: false,
          consequence: 'Dos de tus compañeros hicieron clic en el enlace por curiosidad y uno de ellos descargó un archivo malicioso.',
          feedback: 'Evita propagar enlaces sospechosos sin advertir explícitamente sobre el peligro. Podrías convertirte en vector indirecto de ataque.',
          securityImpact: -15,
          trustImpact: -10,
          reputationImpact: -20,
        },
      ],
      recommendation: 'Nunca abras enlaces acortados o con terminaciones no habituales (.top, .xyz, .cc) enviados por SMS. Bloquea y reporta el número.',
    },
    {
      templateId: 'qr_quishing_restaurant',
      title: 'Menú digital y Wi-Fi con código QR sobrepuesto',
      desc: 'En una cafetería con currículo escolar cerca al colegio, observas un código QR pegado en la mesa que dice: "Escanea para ver menú y obtener Wi-Fi gratis de alta velocidad". Al mirar de cerca, notas que hay un sticker de papel pegado exactamente encima del cartel original acrílico.',
      sender: 'Sticker adhesivo físico sobre código QR legítimo',
      urgency: 'Oferta de conexión rápida inmediata sin contraseña.',
      clue: 'Sticker físico alterado (Quishing) superpuesto sobre el soporte original del establecimiento.',
      options: [
        {
          id: 'opt_1',
          text: 'No escanear el sticker sospechoso y avisar al personal del establecimiento que alguien pegó un código sobre el original.',
          isCorrect: true,
          consequence: 'El administrador retiró el sticker falso y agradeció tu intervención antes de que otros clientes fueran infectados.',
          feedback: 'Gran agudeza visual. El "Quishing" o alteración física de códigos QR redirige a los usuarios a portales maliciosos de descarga o robo de sesiones.',
          securityImpact: 25,
          trustImpact: 20,
          reputationImpact: 15,
        },
        {
          id: 'opt_2',
          text: 'Escanear el código QR con la cámara y descargar el archivo `wifi_config.apk` que la página solicita instalar.',
          isCorrect: false,
          consequence: 'Instalaste un troyano bancario/espía con permisos de accesibilidad en tu teléfono móvil.',
          feedback: 'Peligro absoluto. Un código QR legítimo de menú o Wi-Fi nunca requiere instalar aplicaciones APK externas para funcionar.',
          securityImpact: -40,
          trustImpact: -30,
          reputationImpact: -25,
        },
        {
          id: 'opt_3',
          text: 'Escanearlo para ver qué página abre, pero cerrar la pestaña si pide correo o celular.',
          isCorrect: false,
          consequence: 'El navegador ejecutó un script de perfilado de navegador (browser fingerprinting) y geolocalizó tu dispositivo.',
          feedback: 'Escanear un QR malicioso puede activar exploits de navegador o ataques drive-by. La prevención visual previa es la mejor defensa.',
          securityImpact: -15,
          trustImpact: -10,
          reputationImpact: -10,
        },
      ],
      recommendation: 'Revisa siempre que el QR no sea una calcomanía superpuesta. Configura tu lector de QR para que te muestre la URL antes de abrirla.',
    },
    {
      templateId: 'mfa_fatigue_spam',
      title: 'Ataque de saturación de notificaciones MFA a medianoche',
      desc: 'A la 1:30 AM, tu celular empieza a vibrar repetidamente con notificaciones de autenticación: "¿Eres tú intentando iniciar sesión en tu cuenta de Google / Correo institucional desde Moscú, Rusia?". Recibes más de 15 solicitudes en 3 minutos seguidas de un mensaje de WhatsApp que dice: "Disculpa, somos soporte técnico, por favor acepta la notificación para detener el error del servidor".',
      sender: 'Saturación automatizada de push notifications + mensaje fraudulento en WhatsApp',
      urgency: 'Vibraciones incesantes de madrugada diseñadas para agotamiento psicológico.',
      clue: 'Ubicación geográfica ajena (Rusia) y solicitud de "aprobar para detener el error" (táctica clásica de fatiga MFA).',
      options: [
        {
          id: 'opt_1',
          text: 'Presionar "No soy yo", silenciar temporalmente las notificaciones, y a primera hora cambiar la contraseña desde un dispositivo seguro.',
          isCorrect: true,
          consequence: 'Bloqueaste el intento de acceso ilícito. Los atacantes tenían tu contraseña antigua pero no pudieron saltar el segundo factor.',
          feedback: '¡Excelente gestión del incidente! El ataque de fatiga MFA (MFA Prompt Bombing) busca desesperar a la víctima para que pulse "Aprobar" por cansancio.',
          securityImpact: 30,
          trustImpact: 20,
          reputationImpact: 15,
        },
        {
          id: 'opt_2',
          text: 'Presionar "Sí, soy yo" para que el teléfono deje de vibrar y puedas volver a dormir.',
          isCorrect: false,
          consequence: 'El ciberdelincuente obtuvo acceso total a tu cuenta, cambió tus correos de recuperación y descargó tus archivos privados.',
          feedback: 'Nunca apruebes un inicio de sesión que no hayas iniciado tú personalmente. Cambia tu clave de inmediato si esto ocurre.',
          securityImpact: -45,
          trustImpact: -35,
          reputationImpact: -30,
        },
        {
          id: 'opt_3',
          text: 'Contestar el mensaje de WhatsApp explicando que se equivocaron de persona y pidiendo que te saquen de su lista.',
          isCorrect: false,
          consequence: 'El atacante continuó la llamada social intensificando la presión psicológica para engañarte.',
          feedback: 'No interactúes con atacantes. Reporta la cuenta, marca las notificaciones como fraudulentas y renueva credenciales.',
          securityImpact: -20,
          trustImpact: -15,
          reputationImpact: -15,
        },
      ],
      recommendation: 'Configura métodos MFA resistentes al phishing, como claves de seguridad FIDO2 / Passkeys o verificación por coincidencia de números (Number Matching).',
    },
    {
      templateId: 'free_game_mod_cheat',
      title: 'Descarga de hack / monedas gratis para tu juego favorito',
      desc: 'En un servidor de Discord sobre tu videojuego preferido, un usuario con nombre "Admin-FreeDrops" publica: "Exclusivo: Generador de monedas y skins ilimitadas 2026 sin costo. Descarga este instalador .exe, desactiva tu antivirus durante 2 minutos y disfruta". Tres bots en el chat comentan: "¡Funciona al 100%, gracias!".',
      sender: 'Usuario no verificado en Discord con testimonios bot falsos',
      urgency: 'Oferta supuestamente limitada a los primeros 50 usuarios.',
      clue: 'Exige expresamente desactivar el antivirus y ejecutar un binario .exe ejecutable de origen desconocido.',
      options: [
        {
          id: 'opt_1',
          text: 'Ignorar y reportar el mensaje y la cuenta al equipo de moderación del servidor de Discord, sin descargar ningún archivo.',
          isCorrect: true,
          consequence: 'El servidor eliminó al estafador y evitó que cientos de miembros de la comunidad fueran infectados con infostealers.',
          feedback: 'Decisión magistral. "Desactivar el antivirus" es la señal de alarma definitiva. Los supuestos hacks de juegos son la vía #1 de distribución de troyanos como RedLine o Lumma Stealer.',
          securityImpact: 25,
          trustImpact: 20,
          reputationImpact: 15,
        },
        {
          id: 'opt_2',
          text: 'Pausar el antivirus durante 5 minutos y ejecutar el archivo como Administrador para obtener las monedas gratis.',
          isCorrect: false,
          consequence: 'El ejecutable robó todas las cookies de sesión de tu navegador, tus contraseñas guardadas y tus cuentas de Steam y Discord.',
          feedback: 'Desastre digital. Ningún software legítimo te solicitará deshabilitar las defensas del sistema operativo.',
          securityImpact: -50,
          trustImpact: -40,
          reputationImpact: -35,
        },
        {
          id: 'opt_3',
          text: 'Descargar el archivo en tu celular en lugar del computador creyendo que un .exe no puede afectar a Android.',
          isCorrect: false,
          consequence: 'Aunque el .exe no corre nativamente en Android, el enlace también descargó un script web que intentó acceder a tus fotos.',
          feedback: 'No descargues archivos de fuentes maliciosas en ningún dispositivo; suelen estar acompañados de vectores multiplataforma.',
          securityImpact: -20,
          trustImpact: -15,
          reputationImpact: -15,
        },
      ],
      recommendation: 'Los cracks, cheats y generadores de recursos virtuales casi siempre son troyanos diseñados para robar tokens de autenticación y billeteras.',
    },
  ];

  generateRandomExercise(difficulty: DifficultyLevel = 'medium'): AiExercise {
    const templateIndex = Math.floor(Math.random() * this.templates.length);
    const template = this.templates[templateIndex];

    const vectorIndex = Math.floor(Math.random() * this.attackVectors.length);
    const vector = this.attackVectors[vectorIndex];

    const targetIndex = Math.floor(Math.random() * this.targets.length);
    const target = this.targets[targetIndex];

    const threatLevels: ('Baja' | 'Media' | 'Alta' | 'Crítica')[] =
      difficulty === 'easy' ? ['Baja', 'Media'] : difficulty === 'medium' ? ['Media', 'Alta'] : ['Alta', 'Crítica'];
    const threatLevel = threatLevels[Math.floor(Math.random() * threatLevels.length)];

    // Shuffle options to ensure randomness in layout
    const shuffledOptions = [...template.options].sort(() => Math.random() - 0.5);

    return {
      id: `ai_${template.templateId}_${Date.now()}`,
      vector: vector.name,
      vectorCategory: vector.category,
      difficulty,
      threatLevel,
      targetRole: target,
      scenarioTitle: template.title,
      scenarioDescription: template.desc,
      incidentDetails: {
        senderOrSource: template.sender,
        triggerUrgency: template.urgency,
        redFlagClue: template.clue,
      },
      options: shuffledOptions,
      mitreAttackTechnique: vector.mitre,
      mitreCode: vector.code,
      cisoRecommendation: template.recommendation,
    };
  }
}

