export type RolUsuario = 'estudiante' | 'docente';
export type EjeRiesgo = 'fraude' | 'relación de riesgo' | 'higiene';

export interface Usuario { uid: string; nombre: string; rol: RolUsuario; institucion: string; grado?: number; grupo?: string; grupoId?: string; fechaActualizacion?: string; }
export interface OpcionDecision { id: string; texto: string; siguienteNodoId?: string; correcta: boolean; consecuencia: string; explicacion: string; impacto?: { seguridad: number; confianza: number; reputacion: number }; }
export interface NodoDecision { id: string; pregunta: string; opciones: OpcionDecision[]; }
export interface Escenario { id: string; eje: EjeRiesgo; tema?: string; titulo: string; descripcion: string; nodos: NodoDecision[]; icono?: string; color?: string; personaje?: string; capitulo?: string; }
export interface Decision { id?: string; uid: string; escenarioId: string; nodoId: string; situacion?: string; opcionElegida: string; correcta: boolean; puntuacion?: number; resultado?: string; fecha: string; eje?: EjeRiesgo; }
export interface ResultadoAgregado { grupo: string; institucion: string; eje: EjeRiesgo; porcentajeAciertos: number; estudiantes: number; fechaCalculo: string; }