import { FirebaseOptions } from 'firebase/app';

// Completar estos valores con la configuracion del proyecto Firebase.
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
export const firebaseConfig: FirebaseOptions = {
  apiKey: "AIzaSyAJqSkReTiHQZBKqyFAgIBIig4G7z1E70M",
  authDomain: "ciberdesafio.firebaseapp.com",
  databaseURL: "https://ciberdesafio-default-rtdb.firebaseio.com",
  projectId: "ciberdesafio",
  storageBucket: "ciberdesafio.firebasestorage.app",
  messagingSenderId: "88269993579",
  appId: "1:88269993579:web:44c449c57eda30e4bbe32e",
  measurementId: "G-EHBDCWXSRV"
};

// La app se inicializa una sola vez y se reutiliza en Auth y Firestore.
export const firebaseApp = initializeApp(firebaseConfig);