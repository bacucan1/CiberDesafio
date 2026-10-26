import { Injectable, inject } from '@angular/core';
import { getAuth } from 'firebase/auth';
import {
  Timestamp,
  arrayUnion,
  collection,
  doc,
  deleteField,
  getDoc,
  getDocs,
  getFirestore,
  increment,
  query,
  runTransaction,
  updateDoc,
  where,
} from 'firebase/firestore';
import { AuthService } from './auth.service';
import { firebaseApp } from '../firebase.config';

export interface TeacherGroup {
  grupo: string;
  grado?: number;
  grupoId?: string;
}

export interface GroupInvite {
  codigo: string;
  grupo: string;
  grado?: number;
  estado: 'activo' | 'revocado';
  usos: number;
  maxUsos: number;
  venceEn: string;
}

export interface GroupResults {
  grupo: string;
  grado?: number;
  institucion: string;
  eje: string;
  porcentajeAciertos: number;
  estudiantes: number;
  fechaCalculo: string;
}

@Injectable({ providedIn: 'root' })
export class InstitutionalService {
  private readonly firestore = getFirestore(firebaseApp);
  private readonly auth = getAuth(firebaseApp);
  private readonly authService = inject(AuthService);

  async crearCodigo(grupo: string, grado?: number): Promise<GroupInvite> {
    const nombreGrupo = grupo.trim();
    if (nombreGrupo.length < 2 || nombreGrupo.length > 60 || nombreGrupo.includes('/')) {
      throw new Error('El nombre del grupo debe tener entre 2 y 60 caracteres y no contener "/".');
    }
    if (grado !== undefined && (!Number.isInteger(grado) || grado < 9 || grado > 11)) {
      throw new Error('El grado debe estar entre 9 y 11.');
    }

    const uid = this.usuarioId();
    const perfil = await getDoc(doc(this.firestore, 'usuarios', uid));
    const datosPerfil = perfil.data();
    if (!perfil.exists() || datosPerfil?.['rol'] !== 'docente' || typeof datosPerfil['institucion'] !== 'string' || !datosPerfil['institucion']) {
      throw new Error('Se requiere un perfil docente aprobado y una institución asignada.');
    }

    const institucion = datosPerfil['institucion'];
    const grupoId = await this.idGrupo(institucion, nombreGrupo, grado);
    const groupRef = doc(this.firestore, 'grupos', grupoId);
    const codigo = this.generarCodigo();
    const inviteRef = doc(this.firestore, 'codigos_vinculacion', codigo);
    const vence = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    await runTransaction(this.firestore, async (transaction) => {
      const group = await transaction.get(groupRef);
      if (group.exists()) {
        const existente = group.data();
        if (existente['institucion'] !== institucion
          || String(existente['grupo']).toLowerCase() !== nombreGrupo.toLowerCase()
          || (typeof existente['grado'] === 'number' ? existente['grado'] : undefined) !== grado) {
          throw new Error('Ya existe un grupo con una identidad incompatible.');
        }
      }

      transaction.set(groupRef, {
        institucion,
        grupo: group.exists() ? group.data()['grupo'] : nombreGrupo,
        ...(grado !== undefined ? { grado } : {}),
        profesores: arrayUnion(uid),
        fechaActualizacion: Timestamp.now(),
      }, { merge: true });
      transaction.set(inviteRef, {
        codigo,
        grupoId,
        grupo: group.exists() ? group.data()['grupo'] : nombreGrupo,
        institucion,
        ...(grado !== undefined ? { grado } : {}),
        creadoPor: uid,
        estado: 'activo',
        usos: 0,
        maxUsos: 30,
        venceEn: Timestamp.fromDate(vence),
        fechaCreacion: Timestamp.now(),
      });
    });

    return {
      codigo,
      grupo: nombreGrupo,
      ...(grado !== undefined ? { grado } : {}),
      estado: 'activo',
      usos: 0,
      maxUsos: 30,
      venceEn: vence.toISOString(),
    };
  }

  async listarCodigos(): Promise<GroupInvite[]> {
    const uid = this.usuarioId();
    const snapshot = await getDocs(query(
      collection(this.firestore, 'codigos_vinculacion'),
      where('creadoPor', '==', uid),
    ));
    return snapshot.docs.map((item) => {
      const data = item.data();
      return {
        codigo: data['codigo'],
        grupo: data['grupo'],
        ...(typeof data['grado'] === 'number' ? { grado: data['grado'] } : {}),
        estado: data['estado'],
        usos: data['usos'],
        maxUsos: data['maxUsos'],
        venceEn: (data['venceEn'] as Timestamp).toDate().toISOString(),
      };
    });
  }

  async revocarCodigo(codigo: string): Promise<void> {
    await updateDoc(doc(this.firestore, 'codigos_vinculacion', codigo), {
      estado: 'revocado',
      revocadoEn: Timestamp.now(),
    });
  }

  async vincularConCodigo(codigo: string): Promise<TeacherGroup & { institucion: string }> {
    const uid = this.usuarioId();
    const codigoNormalizado = codigo.trim().toUpperCase();
    if (!/^[A-F0-9]{12}$/.test(codigoNormalizado)) {
      throw new Error('Escribe un código de invitación válido.');
    }
    const profileRef = doc(this.firestore, 'usuarios', uid);
    const inviteRef = doc(this.firestore, 'codigos_vinculacion', codigoNormalizado);
    let resultado: TeacherGroup & { institucion: string } | undefined;

    await runTransaction(this.firestore, async (transaction) => {
      const [perfil, invitacion] = await Promise.all([
        transaction.get(profileRef),
        transaction.get(inviteRef),
      ]);
      if (!perfil.exists() || !invitacion.exists()) throw new Error('El código no existe o el perfil no está disponible.');
      const datosPerfil = perfil.data();
      const datosInvitacion = invitacion.data();
      if (datosPerfil['rol'] !== 'estudiante' || datosPerfil['institucion']) {
        throw new Error('Esta cuenta ya tiene una institución asignada o no es de estudiante.');
      }
      const venceEn = datosInvitacion['venceEn'] as Timestamp;
      if (datosInvitacion['estado'] !== 'activo'
        || venceEn.toMillis() <= Date.now()
        || datosInvitacion['usos'] >= datosInvitacion['maxUsos']) {
        throw new Error('El código venció, fue revocado o alcanzó su límite de usos.');
      }

      const grado = datosInvitacion['grado'];
      transaction.update(profileRef, {
        institucion: datosInvitacion['institucion'],
        grupo: datosInvitacion['grupo'],
        grupoId: datosInvitacion['grupoId'],
        codigoVinculacion: datosInvitacion['codigo'],
        ...(typeof grado === 'number'
          ? { grado }
          : ('grado' in datosPerfil ? { grado: deleteField() } : {})),
        fechaActualizacion: new Date().toISOString(),
      });
      transaction.update(inviteRef, { usos: increment(1) });
      resultado = {
        grupo: datosInvitacion['grupo'],
        ...(typeof grado === 'number' ? { grado } : {}),
        grupoId: datosInvitacion['grupoId'],
        institucion: datosInvitacion['institucion'],
      };
    });

    this.authService.invalidarCache();
    if (!resultado) throw new Error('No se pudo completar la vinculación al grupo.');
    return resultado;
  }

  async listarGrupos(): Promise<TeacherGroup[]> {
    const uid = this.usuarioId();
    const snapshot = await getDocs(query(
      collection(this.firestore, 'grupos'),
      where('profesores', 'array-contains', uid),
    ));
    return snapshot.docs.map((item) => {
      const data = item.data();
      return {
        grupo: data['grupo'],
        ...(typeof data['grado'] === 'number' ? { grado: data['grado'] } : {}),
        grupoId: item.id,
      };
    });
  }

  async listarResultados(): Promise<GroupResults[]> {
    const uid = this.usuarioId();
    const perfil = await getDoc(doc(this.firestore, 'usuarios', uid));
    const institucion = perfil.data()?.['institucion'];
    if (!perfil.exists() || perfil.data()?.['rol'] !== 'docente' || typeof institucion !== 'string' || !institucion) {
      throw new Error('Se requiere un perfil docente aprobado y una institución asignada.');
    }
    const snapshot = await getDocs(query(
      collection(this.firestore, 'resultados_agregados'),
      where('institucion', '==', institucion),
    ));
    return snapshot.docs.map((item) => {
      const data = item.data();
      return {
        grupo: data['grupo'],
        ...(typeof data['grado'] === 'number' ? { grado: data['grado'] } : {}),
        institucion: data['institucion'],
        eje: data['eje'],
        porcentajeAciertos: data['porcentajeAciertos'],
        estudiantes: data['estudiantes'],
        fechaCalculo: data['fechaCalculo'],
      };
    });
  }

  private usuarioId(): string {
    const uid = this.auth.currentUser?.uid;
    if (!uid) throw new Error('Debes iniciar sesión para realizar esta operación.');
    return uid;
  }

  private generarCodigo(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(6));
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
  }

  private async idGrupo(institucion: string, grupo: string, grado?: number): Promise<string> {
    const contenido = `${institucion.toLowerCase()}\u0000${grado ?? ''}\u0000${grupo.toLowerCase()}`;
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(contenido));
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
}
