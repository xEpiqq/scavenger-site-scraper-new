import { initializeApp } from "firebase/app";
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyBBONc6lNwoYQRL_N43dQ41yA2DmAfRRkI",
    authDomain: "scavenger-46b64.firebaseapp.com",
    projectId: "scavenger-46b64",
    storageBucket: "scavenger-46b64.appspot.com",
    messagingSenderId: "849221874864",
    appId: "1:849221874864:web:515d5f3ec8d3a41ed97775",
    measurementId: "G-3CX5EEW2P2"
  }
  
export const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)