import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

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

// App Check : protège la base contre les scripts/bots qui contourneraient le site.
// Remplace "RECAPTCHA_V3_SITE_KEY" par la clé obtenue dans Firebase > App Check.
// Tant que ce n'est pas fait, cette ligne ne bloque rien (elle échoue silencieusement).
try {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider("6LdoQHktAAAAAN-oCl0QbEsFLvk1BnG6rg_P6dTd"),
    isTokenAutoRefreshEnabled: true,
  });
} catch (e) {
  console.warn("App Check non configuré :", e.message);
}
