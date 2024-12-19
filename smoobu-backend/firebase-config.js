import admin from 'firebase-admin';
import * as dotenv from "dotenv";

dotenv.config();

// More explicit private key formatting
const formatPrivateKey = (key) => {
  if (!key) return undefined;
  // Add line breaks
  const header = '-----BEGIN PRIVATE KEY-----\n';
  const footer = '\n-----END PRIVATE KEY-----\n';
  const bodyLength = 64; // Standard PEM line length
  
  // Remove existing headers/footers and spaces
  let cleanKey = key
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
    
  // Add newlines every 64 characters
  const body = cleanKey.match(new RegExp(`.{${bodyLength}}`, 'g')).join('\n');
  return `${header}${body}${footer}`;
};

const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: formatPrivateKey(process.env.FIREBASE_PRIVATE_KEY),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: process.env.FIREBASE_CERT_URL
};

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (error) {
    console.error('Error initializing Firebase:', error);
    console.error('Service Account:', {
      ...serviceAccount,
      private_key: serviceAccount.private_key ? 'PRESENT' : 'MISSING'
    });
  }
}

export const db = admin.firestore();