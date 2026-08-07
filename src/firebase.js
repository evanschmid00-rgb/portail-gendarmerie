import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Remplace ces valeurs par celles de TON projet Firebase
// (Console Firebase > Paramètres du projet > Tes applications > Config SDK)
const firebaseConfig = {
  apiKey: "AIzaSyDnqsUFMXchFEoPPUvG6H-pu0qOdQuCN5g",
  authDomain: "gendarmerie-nimes-rp.firebaseapp.com",
  projectId: "gendarmerie-nimes-rp",
  storageBucket: "gendarmerie-nimes-rp.firebasestorage.app",
  messagingSenderId: "447302955269",
  appId: "1:447302955269:web:64250a59414aa8602c876c",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const FIREBASE_API_KEY = firebaseConfig.apiKey;
