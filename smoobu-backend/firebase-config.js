import admin from 'firebase-admin';
import * as dotenv from "dotenv";

dotenv.config();

// Format the private key properly
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

// Add error checking and debugging
console.log('Private Key present:', !!privateKey);
console.log('Project ID:', process.env.FIREBASE_PROJECT_ID);

let db;
try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  db = admin.firestore();
} catch (error) {
  console.error('Error initializing Firebase:', error);
  console.error('Service Account:', {
    ...serviceAccount,
    private_key: serviceAccount.private_key ? 'PRESENT' : 'MISSING'
  });
}

export { db };