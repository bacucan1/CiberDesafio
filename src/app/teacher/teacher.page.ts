import { Component, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonBadge, IonButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonContent, IonHeader, IonIcon, IonInput, IonItem, IonLabel, IonSelect, IonSelectOption, IonText, IonTitle, IonToolbar } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { barChart, people, shieldCheckmark } from 'ionicons/icons';
import { AuthService } from '../core/services/auth.service';
import { GroupInvite, GroupResults, InstitutionalService, TeacherGroup } from '../core/services/institutional.service';

@Component({
  selector: 'app-teacher',
  templateUrl: './teacher.page.html',
  styleUrls: ['./teacher.page.scss'],
  imports: [DatePipe, FormsModule, RouterLink, IonBadge, IonButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonContent, IonHeader, IonIcon, IonInput, IonItem, IonLabel, IonSelect, IonSelectOption, IonText, IonTitle, IonToolbar],
})
export class TeacherPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly institutional = inject(InstitutionalService);

  institucion = '';
  grupos: TeacherGroup[] = [];
  resultados: GroupResults[] = [];
  codigos: GroupInvite[] = [];
  grupoSeleccionado = '';
  nuevoGrupo = '';
  nuevoGrado?: number;
  codigoCreado = '';
  cargando = true;
  generandoCodigo = false;
  error = '';
  mensaje = '';
  private resultadosDelGrupoCache: { clave: string; datos: GroupResults[] } | null = null;

  constructor() {
    addIcons({ barChart, people, shieldCheckmark });
  }

  async ngOnInit(): Promise<void> {
    try {
      const usuario = await this.auth.esperarSesion();
      if (!usuario) return;
      const perfil = await this.auth.obtenerPerfil(usuario);
      if (!perfil || perfil.rol !== 'docente' || !perfil.institucion) {
        this.error = 'Tu cuenta docente aún necesita aprobación institucional. Contacta al administrador de tu institución.';
        return;
      }
      this.institucion = perfil.institucion;
      await this.cargarDatos();
    } catch (error: unknown) {
      console.error('No se pudo cargar el panel institucional docente.', error);
      this.error = 'No se pudo cargar la información institucional. Intenta nuevamente en unos minutos.';
    } finally {
      this.cargando = false;
    }
  }

  async cargarDatos(): Promise<void> {
    const [grupos, resultados, codigos] = await Promise.all([
      this.institutional.listarGrupos(),
      this.institutional.listarResultados(),
      this.institutional.listarCodigos(),
    ]);
    this.grupos = grupos;
    this.resultados = resultados;
    this.codigos = codigos;
    this.resultadosDelGrupoCache = null;
    if (!this.grupoSeleccionado && grupos.length) this.grupoSeleccionado = this.claveGrupo(grupos[0]);
  }

  async crearCodigo(): Promise<void> {
    const grupo = this.nuevoGrupo.trim();
    if (!grupo || this.generandoCodigo) return;
    this.generandoCodigo = true;
    this.error = '';
    this.mensaje = '';
    try {
      const invitacion = await this.institutional.crearCodigo(grupo, this.nuevoGrado);
      this.codigoCreado = invitacion.codigo;
      this.grupoSeleccionado = this.claveGrupo(invitacion);
      this.nuevoGrupo = '';
      this.nuevoGrado = undefined;
      await this.cargarDatos();
      this.mensaje = `Código creado para ${invitacion.grupo}. Compártelo únicamente con los estudiantes de ese grupo.`;
    } catch (error: unknown) {
      console.error('No se pudo crear el código de vinculación del grupo.', error);
      this.error = this.mensajeServicio(error, 'No se pudo crear el código. Intenta nuevamente.');
    } finally {
      this.generandoCodigo = false;
    }
  }

  async revocarCodigo(invitacion: GroupInvite): Promise<void> {
    if (invitacion.estado !== 'activo' || !window.confirm(`¿Revocar el código del grupo ${invitacion.grupo}? Quienes todavía no lo hayan usado ya no podrán vincularse.`)) return;
    this.error = '';
    this.mensaje = '';
    try {
      await this.institutional.revocarCodigo(invitacion.codigo);
      await this.cargarDatos();
      this.mensaje = `El código para ${invitacion.grupo} fue revocado.`;
    } catch (error: unknown) {
      console.error('No se pudo revocar el código de vinculación.', error);
      this.error = this.mensajeServicio(error, 'No se pudo revocar el código. Intenta nuevamente.');
    }
  }

  async copiarCodigo(codigo: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(codigo);
      this.mensaje = 'Código copiado al portapapeles.';
      this.error = '';
    } catch (error: unknown) {
      console.error('No se pudo copiar el código de vinculación.', error);
      this.error = 'No se pudo copiar automáticamente. Selecciona el código para copiarlo.';
    }
  }

  get resultadosDelGrupo(): GroupResults[] {
    const cache = this.resultadosDelGrupoCache;
    if (cache && cache.clave === this.grupoSeleccionado) {
      return cache.datos;
    }
    const grupo = this.grupos.find((item) => this.claveGrupo(item) === this.grupoSeleccionado);
    const datos = grupo
      ? this.resultados.filter((resultado) => resultado.grupo === grupo.grupo && resultado.grado === grupo.grado)
      : [];
    this.resultadosDelGrupoCache = { clave: this.grupoSeleccionado, datos };
    return datos;
  }

  get promedio(): number | null {
    const datos = this.resultadosDelGrupo;
    return datos.length
      ? Math.round(datos.reduce((suma, resultado) => suma + resultado.porcentajeAciertos, 0) / datos.length)
      : null;
  }

  get cantidadEstudiantes(): number {
    return Math.max(0, ...this.resultadosDelGrupo.map((resultado) => resultado.estudiantes));
  }

  get etiquetaGrupoSeleccionado(): string {
    const grupo = this.grupos.find((item) => this.claveGrupo(item) === this.grupoSeleccionado);
    return grupo ? `${grupo.grupo}${grupo.grado ? ` · ${grupo.grado}.º` : ''}` : '';
  }

  get temaPrioritario(): string {
    const prioridad = [...this.resultadosDelGrupo].sort((a, b) => a.porcentajeAciertos - b.porcentajeAciertos)[0];
    return prioridad?.eje ?? 'Sin datos';
  }

  claveGrupo(grupo: TeacherGroup): string {
    return `${grupo.grupo}::${grupo.grado ?? ''}`;
  }

  private mensajeServicio(error: unknown, predeterminado: string): string {
    if (error && typeof error === 'object' && 'code' in error) {
      const code = String(error.code);
      if (code.includes('permission-denied')) return 'Tu cuenta aún no tiene permisos docentes aprobados y una institución asignada.';
      if (code.includes('failed-precondition')) return 'El grupo o el código ya no están disponibles.';
      if (code.includes('invalid-argument')) return 'Revisa el nombre del grupo y el grado.';
      if (code.includes('unavailable')) return 'El servicio no está disponible. Intenta de nuevo en unos minutos.';
    }
    return predeterminado;
  }
}
