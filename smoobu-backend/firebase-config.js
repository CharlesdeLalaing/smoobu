// firebase-config.js
import admin from 'firebase-admin';
import { initializeApp } from 'firebase/app';
import { getFirestore as getClientFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import * as dotenv from "dotenv";

dotenv.config();

// Admin SDK Configuration
const privateKey = process.env.FIREBASE_PRIVATE_KEY
  ? process.env.FIREBASE_PRIVATE_KEY.split(String.raw`\n`).join('\n')
  : undefined;

const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: privateKey,
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: process.env.FIREBASE_CERT_URL
};

// Client SDK Configuration
const clientConfig = {
  apiKey: "AIzaSyC3b4kut2R0hnK3Nwdsnd271Uy-cEcAuKo",
  authDomain: "ferme-de-basseilles-9c7ff.firebaseapp.com",
  projectId: "ferme-de-basseilles-9c7ff",
  storageBucket: "ferme-de-basseilles-9c7ff.firebasestorage.app",
  messagingSenderId: "159647254828",
  appId: "1:159647254828:web:7b461d976e3e3fb5914489",
  measurementId: "G-EKS75CPLKR"
};

// Initialize both Admin and Client SDKs
let db; // Admin SDK Firestore
let clientDb; // Client SDK Firestore
let auth; // Client SDK Auth

try {
  // Initialize Admin SDK
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  db = admin.firestore();
  
  // Initialize Client SDK
  const clientApp = initializeApp(clientConfig);
  clientDb = getClientFirestore(clientApp);
  auth = getAuth(clientApp);
  
  console.log('✅ Firebase Admin and Client SDKs initialized successfully');
} catch (error) {
  console.error('🔥 Error initializing Firebase:', error);
  console.error('Service Account:', {
    ...serviceAccount,
    private_key: serviceAccount.private_key ? 'PRESENT' : 'MISSING'
  });
}

// Export both Admin and Client instances
export { db, clientDb, auth };