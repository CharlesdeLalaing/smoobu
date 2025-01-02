import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyC3b4kut2R0hnK3Nwdsnd271Uy-cEcAuKo",
  authDomain: "ferme-de-basseilles-9c7ff.firebaseapp.com",
  projectId: "ferme-de-basseilles-9c7ff",
  storageBucket: "ferme-de-basseilles-9c7ff.firebasestorage.app",
  messagingSenderId: "159647254828",
  appId: "1:159647254828:web:7b461d976e3e3fb5914489",
  measurementId: "G-EKS75CPLKR"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };

