// Inisialisasi Firebase Client SDK untuk pertukaran token sementara di browser
// Firebase Client SDK initialization for temporary token exchange in browser
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'fake-api-key',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'localhost',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'innov-bootcamp-dev',
};

let clientApp: FirebaseApp | null = null;
let clientAuth: Auth | null = null;

export function getClientApp(): FirebaseApp {
  if (clientApp) return clientApp;

  const existing = getApps();
  if (existing.length > 0) {
    clientApp = existing[0];
  } else {
    clientApp = initializeApp(firebaseConfig);
  }

  return clientApp;
}

export function getClientAuth(): Auth {
  if (!clientAuth) {
    clientAuth = getAuth(getClientApp());
  }
  return clientAuth;
}
