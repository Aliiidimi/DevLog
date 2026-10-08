import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAv0YFMP9qvXbP42G1alF82GE6xoevkO20",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "gen-lang-client-0805169799.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "gen-lang-client-0805169799",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "gen-lang-client-0805169799.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "850487526669",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:850487526669:web:c3f4670252317b1e0a9c44",
};

// Firebase'i başlat
const app = initializeApp(firebaseConfig);

// Auth ve veritabanı örneklerini dışa aktar
export const auth = getAuth(app);
export const db = getFirestore(app);
