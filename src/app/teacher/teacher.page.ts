import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonBadge, IonButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonContent, IonHeader, IonIcon, IonInput, IonItem, IonLabel, IonSelect, IonSelectOption, IonText, IonTitle, IonToolbar } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { barChart, logOut, people, shieldCheckmark } from 'ionicons/icons';
import type { Unsubscribe } from 'firebase/firestore';
import { AuthService } from '../core/services/auth.service';
import { GroupInvite, GroupResults, InstitutionalService, TeacherGroup } from '../core/services/institutional.service';
import { OperationTimeoutError, remainingTime, withTimeout } from '../core/utils/async.utils';

const TIMEOUT_CARGA_MS = 8_000;

@Component({
  selector: 'app-teacher',
  templateUrl: './teacher.page.html',
  styleUrls: ['./teacher.page.scss'],
  imports: [DatePipe, FormsModule, RouterLink, IonBadge, IonButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonContent, IonHeader, IonIcon, IonInput, IonItem, IonLabel, IonSelect, IonSelectOption, IonText, IonTitle, IonToolbar],
})
export class TeacherPage implements OnDestroy, OnInit {
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
  private cancelarObservacionResultados?: Unsubscribe;
  private timeoutObservacionResultados?: ReturnType<typeof setTimeout>;
  actualizando = false;
  cerrandoSesion = false;

  constructor() {
    addIcons({ barChart, logOut, people, shieldCheckmark });
  }

  async cerrarSesion(): Promise<void> {
    if (this.cerrandoSesion) return;
    this.cerrandoSesion = true;
    this.error = '';
    try {
      await this.auth.salir();
    } catch (error: unknown) {
      console.error('No se pudo cerrar la sesión docente.', error);
      this.error = 'No se pudo cerrar la sesión. Intenta nuevamente.';
      this.cerrandoSesion = false;
    }
  }

  async ngOnInit(): Promise<void> {
    const inicioCarga = Date.now();
    try {
      const usuario = await withTimeout(
        this.auth.esperarSesion(),
        remainingTime(inicioCarga, TIMEOUT_CARGA_MS),
        'La conexión con Firebase está tardando demasiado. Revisa tu conexión e intenta cargar de nuevo.',
      );
      if (!usuario) return;
      const perfil = await withTimeout(
        this.auth.obtenerPerfil(),
        remainingTime(inicioCarga, TIMEOUT_CARGA_MS),
        'La información de tu perfil tardó más de 8 segundos. Revisa tu conexión e intenta cargar de nuevo.',
      );
      if (!perfil || perfil.rol !== 'docente' || !perfil.institucion) {
        this.error = 'Falta completar o validar la institución de tu perfil. Abre “Mi perfil” para enviar los datos a revisión.';
        return;
      }
      this.institucion = perfil.institucion;
      await this.cargarDatos(remainingTime(inicioCarga, TIMEOUT_CARGA_MS));
      this.cancelarObservacionResultados = this.institutional.observarResultados(
        (resultados) => {
          this.limpiarTimeoutObservacion();
          this.resultados = resultados;
          this.resultadosDelGrupoCache = null;
        },
        (error) => {
          this.limpiarTimeoutObservacion();
          console.error('No se pudo sincronizar en tiempo real el panel docente.', error);
          this.error = 'No se pudieron sincronizar los resultados. Intenta actualizar en unos minutos.';
        },
      );
      this.timeoutObservacionResultados = setTimeout(() => {
        this.cancelarObservacionResultados?.();
        this.cancelarObservacionResultados = undefined;
        this.timeoutObservacionResultados = undefined;
        this.error = 'La sincronización de resultados tardó más de 8 segundos. Puedes actualizar los datos e intentarlo de nuevo.';
      }, TIMEOUT_CARGA_MS);
    } catch (error: unknown) {
      console.error('No se pudo cargar el panel institucional docente.', error);
      this.error = error instanceof OperationTimeoutError
        ? error.message
        : 'No se pudo cargar la información institucional. Intenta nuevamente en unos minutos.';
    } finally {
      this.cargando = false;
    }
  }

  ngOnDestroy(): void {
    this.limpiarTimeoutObservacion();
    this.cancelarObservacionResultados?.();
  }

  async cargarDatos(timeoutMs = TIMEOUT_CARGA_MS): Promise<void> {
    const [grupos, resultados, codigos] = await withTimeout(
      Promise.all([
        this.institutional.listarGrupos(),
        this.institutional.listarResultados(),
        this.institutional.listarCodigos(),
      ]),
      timeoutMs,
      'La consulta de datos tardó más de 8 segundos. Revisa tu conexión e intenta actualizar.',
    );
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

  async actualizarDatos(): Promise<void> {
    if (this.actualizando) return;
    this.actualizando = true;
    this.error = '';
    this.mensaje = '';
    try {
      await this.cargarDatos();
      this.mensaje = 'Los resultados y códigos se actualizaron.';
    } catch (error: unknown) {
      console.error('No se pudieron actualizar los datos del panel docente.', error);
      this.error = this.mensajeServicio(error, 'No se pudieron actualizar los datos. Intenta nuevamente.');
    } finally {
      this.actualizando = false;
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
    const decisiones = datos.reduce((suma, resultado) => suma + resultado.totalDecisiones, 0);
    return decisiones > 0
      ? Math.round(datos.reduce((suma, resultado) => suma + resultado.totalAciertos, 0) / decisiones * 100)
      : null;
  }

  get ultimaActualizacion(): Date | null {
    const fechas = this.resultadosDelGrupo
      .map((resultado) => new Date(resultado.fechaCalculo))
      .filter((fecha) => !Number.isNaN(fecha.getTime()));
    return fechas.length ? new Date(Math.max(...fechas.map((fecha) => fecha.getTime()))) : null;
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
    if (error instanceof OperationTimeoutError) return error.message;
    if (error && typeof error === 'object' && 'code' in error) {
      const code = String(error.code);
      if (code.includes('permission-denied')) return 'Tu cuenta aún no tiene permisos docentes aprobados y una institución asignada.';
      if (code.includes('failed-precondition')) return 'El grupo o el código ya no están disponibles.';
      if (code.includes('invalid-argument')) return 'Revisa el nombre del grupo y el grado.';
      if (code.includes('unavailable')) return 'El servicio no está disponible. Intenta de nuevo en unos minutos.';
    }
    return predeterminado;
  }

  private limpiarTimeoutObservacion(): void {
    if (this.timeoutObservacionResultados === undefined) return;
    clearTimeout(this.timeoutObservacionResultados);
    this.timeoutObservacionResultados = undefined;
  }
}
