// dynamic-firebase-config.js
// Firebase configuration for Dynamic Smoobu Integration (projetgitesenmasse)
import admin from 'firebase-admin';
import * as dotenv from "dotenv";

dotenv.config();

// Parse the private key from environment variable
const privateKey = process.env.DYNAMIC_FIREBASE_PRIVATE_KEY
  ? process.env.DYNAMIC_FIREBASE_PRIVATE_KEY.split(String.raw`\n`).join('\n')
  : undefined;

const serviceAccount = {
  type: "service_account",
  project_id: process.env.DYNAMIC_FIREBASE_PROJECT_ID,
  private_key_id: process.env.DYNAMIC_FIREBASE_PRIVATE_KEY_ID,
  private_key: privateKey,
  client_email: process.env.DYNAMIC_FIREBASE_CLIENT_EMAIL,
  client_id: process.env.DYNAMIC_FIREBASE_CLIENT_ID,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: process.env.DYNAMIC_FIREBASE_CERT_URL
};

// Initialize the dynamic Firebase app with a unique name
let dynamicDb;

try {
  // Check if the app is already initialized
  const existingApp = admin.apps.find(app => app?.name === 'dynamicSmoobu');

  if (existingApp) {
    dynamicDb = admin.firestore(existingApp);
  } else {
    const dynamicApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    }, 'dynamicSmoobu');

    dynamicDb = admin.firestore(dynamicApp);
  }

  console.log('🔥 Dynamic Firebase (projetgitesenmasse) initialized successfully');
} catch (error) {
  console.error('🔥 Error initializing Dynamic Firebase:', error.message);
  console.error('Service Account Config:', {
    project_id: serviceAccount.project_id,
    client_email: serviceAccount.client_email,
    private_key: serviceAccount.private_key ? 'PRESENT' : 'MISSING'
  });
}

export { dynamicDb };
