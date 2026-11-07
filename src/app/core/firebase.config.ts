import { FirebaseOptions, initializeApp } from 'firebase/app';
import { environment } from '../../environments/environment';

// Configuracion Firebase inyectada desde los archivos de entorno por build.
export const firebaseConfig: FirebaseOptions = {
  apiKey: environment.firebase.apiKey,
  authDomain: environment.firebase.authDomain,
  databaseURL: environment.firebase.databaseURL,
  projectId: environment.firebase.projectId,
  storageBucket: environment.firebase.storageBucket,
  messagingSenderId: environment.firebase.messagingSenderId,
  appId: environment.firebase.appId,
  measurementId: environment.firebase.measurementId,
};

// La app se inicializa una sola vez y se reutiliza en Auth y Firestore.
export const firebaseApp = initializeApp(firebaseConfig);
