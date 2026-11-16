import type { EjeRiesgo } from '../models/domain.models';

export interface AxisPerformance {
  eje: EjeRiesgo;
  totalAciertos: number;
  totalDecisiones: number;
}

export interface ImprovementInsight extends AxisPerformance {
  porcentajeAciertos: number;
  nivel: 'Requiere práctica' | 'En desarrollo' | 'Fortaleza';
  recomendacion: string;
  actividad: string;
}

const RECOMENDACIONES: Record<EjeRiesgo, { recomendacion: string; actividad: string }> = {
  fraude: {
    recomendacion: 'Verifica el remitente y el dominio; entra a los servicios desde su sitio o aplicación oficial y reporta los mensajes sospechosos.',
    actividad: 'Practica identificar señales de urgencia, enlaces extraños y solicitudes de datos.',
  },
  'relación de riesgo': {
    recomendacion: 'Confirma solicitudes sensibles por otro canal y evita compartir datos o imágenes cuando alguien te presiona.',
    actividad: 'Ensaya cómo poner límites y pedir ayuda ante una situación incómoda en línea.',
  },
  higiene: {
    recomendacion: 'Usa contraseñas únicas, activa la autenticación multifactor y revisa los permisos antes de instalar aplicaciones.',
    actividad: 'Revisa la seguridad de tus cuentas, dispositivos y permisos de aplicaciones.',
  },
};

export function crearPuntosMejora(performance: AxisPerformance[]): ImprovementInsight[] {
  const porEje = new Map<EjeRiesgo, { totalAciertos: number; totalDecisiones: number }>();

  for (const resultado of performance) {
    if (!Number.isSafeInteger(resultado.totalAciertos)
      || !Number.isSafeInteger(resultado.totalDecisiones)
      || resultado.totalDecisiones <= 0
      || resultado.totalAciertos < 0
      || resultado.totalAciertos > resultado.totalDecisiones) continue;

    const previo = porEje.get(resultado.eje) ?? { totalAciertos: 0, totalDecisiones: 0 };
    porEje.set(resultado.eje, {
      totalAciertos: previo.totalAciertos + resultado.totalAciertos,
      totalDecisiones: previo.totalDecisiones + resultado.totalDecisiones,
    });
  }

  return [...porEje.entries()]
    .map(([eje, totals]) => {
      const porcentajeAciertos = Math.round((totals.totalAciertos / totals.totalDecisiones) * 100);
      return {
        eje,
        ...totals,
        porcentajeAciertos,
        nivel: porcentajeAciertos < 60
          ? 'Requiere práctica' as const
          : porcentajeAciertos < 80
            ? 'En desarrollo' as const
            : 'Fortaleza' as const,
        ...RECOMENDACIONES[eje],
      };
    })
    .sort((a, b) => a.porcentajeAciertos - b.porcentajeAciertos || b.totalDecisiones - a.totalDecisiones);
}
