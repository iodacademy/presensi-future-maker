// Inisialisasi singleton Firebase Admin SDK / Firebase Admin SDK singleton initialization
import { getApps, initializeApp, cert, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getEnv } from '../env';
import fs from 'fs';
import path from 'path';

let adminApp: App | null = null;
let adminAuth: Auth | null = null;
let adminDb: Firestore | null = null;

/**
 * Mengambil atau menginisialisasi singleton instance Firebase Admin App.
 *
 * Retrieves or initializes the singleton Firebase Admin App instance.
 */
export function getAdminApp(): App {
  if (adminApp) return adminApp;

  const existingApps = getApps();
  if (existingApps.length > 0) {
    adminApp = existingApps[0];
    return adminApp;
  }

  // 1. Cek apakah ada file service-account.json di root proyek / Check if service-account.json exists in root
  const serviceAccountPath = path.resolve(process.cwd(), 'service-account.json');
  if (fs.existsSync(serviceAccountPath)) {
    try {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
      adminApp = initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id || process.env.FIREBASE_PROJECT_ID,
      });
      return adminApp;
    } catch (err) {
      console.warn('Gagal membaca service-account.json, beralih ke env variables:', err);
    }
  }

  const env = getEnv();

  // serviceAccountId memberi tahu Firebase Admin atas nama akun mana custom
  // token ditandatangani. Nilainya hanya berarti bila tidak ada kunci privat:
  // saat itu createCustomToken menandatangani lewat IAM API. Bila tidak
  // disebutkan, Firebase menebak akun bawaan App Engine lalu gagal dengan
  // "Permission 'iam.serviceAccounts.signBlob' denied" -- menunjuk akun yang
  // keliru, sehingga penyebabnya sulit dilacak.
  //
  // Dibaca sekali di sini agar berlaku untuk setiap jalur tanpa kunci privat di
  // bawah, bukan hanya jalur terakhir.
  //
  // serviceAccountId tells Firebase Admin which account to sign custom tokens
  // as. It only matters when there is no private key: createCustomToken then
  // signs through the IAM API. Left unset, Firebase guesses the default App
  // Engine account and fails with "Permission 'iam.serviceAccounts.signBlob'
  // denied" -- naming the wrong account, which makes the cause hard to trace.
  //
  // Read once here so it applies to every keyless path below, not just the
  // last one.
  const signingAccount = process.env.FIREBASE_SERVICE_ACCOUNT_ID
    ? { serviceAccountId: process.env.FIREBASE_SERVICE_ACCOUNT_ID }
    : {};

  // 2. Jika berjalan di emulator atau mode test / If running in emulator or test mode
  if (process.env.FIRESTORE_EMULATOR_HOST || process.env.NODE_ENV === 'test') {
    adminApp = initializeApp({
      projectId: env.projectId,
      ...signingAccount,
    });
    return adminApp;
  }

  // 3. Jika FIREBASE_PRIVATE_KEY tersedia di env / If FIREBASE_PRIVATE_KEY is present
  if (env.privateKey && env.privateKey.includes('PRIVATE KEY')) {
    adminApp = initializeApp({
      credential: cert({
        projectId: env.projectId,
        clientEmail: env.clientEmail,
        privateKey: env.privateKey,
      }),
      projectId: env.projectId,
    });
    return adminApp;
  }

  // 4. Periksa file gcloud Application Default Credentials di Windows
  // Check gcloud Application Default Credentials on Windows
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && process.env.APPDATA) {
    const adcPath = path.join(process.env.APPDATA, 'gcloud', 'application_default_credentials.json');
    if (fs.existsSync(adcPath)) {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = adcPath;
    }
  }

  // 5. Fallback ke Application Default Credentials / Fallback to Application Default Credentials
  //
  // Di atas Google Cloud (Cloud Run, App Engine, GCE) kredensial datang dari
  // metadata server, jadi ADC selalu tersedia dan tidak ada variabel yang perlu
  // diisi. Di luar itu -- misalnya hosting Node biasa -- ADC tidak ada, dan
  // tanpa penjagaan ini aplikasi tetap menyala lalu gagal pada permintaan
  // pertama dengan galat kredensial yang menyesatkan.
  //
  // K_SERVICE diisi Cloud Run, GAE_ENV diisi App Engine; keduanya penanda resmi
  // runtime Google dan tidak muncul di tempat lain.
  //
  // On Google Cloud (Cloud Run, App Engine, GCE) credentials come from the
  // metadata server, so ADC is always present and no variable needs setting.
  // Elsewhere -- a plain Node host, say -- there is no ADC, and without this
  // guard the app boots and then fails on the first request with a misleading
  // credential error.
  //
  // K_SERVICE is set by Cloud Run and GAE_ENV by App Engine; both are official
  // Google runtime markers that appear nowhere else.
  const onGoogleCloud = Boolean(process.env.K_SERVICE || process.env.GAE_ENV);

  if (process.env.NODE_ENV === 'production' && !onGoogleCloud) {
    throw new Error(
      'Kredensial Firebase Admin tidak ditemukan. Isi FIREBASE_PRIVATE_KEY dan FIREBASE_CLIENT_EMAIL di environment variables.'
    );
  }

  adminApp = initializeApp({
    projectId: env.projectId,
    ...signingAccount,
  });

  return adminApp;
}

/**
 * Mendapatkan instance Firebase Admin Auth.
 *
 * Gets the Firebase Admin Auth instance.
 */
export function getAdminAuth(): Auth {
  if (!adminAuth) {
    adminAuth = getAuth(getAdminApp());
  }
  return adminAuth;
}

/**
 * Mendapatkan instance Firebase Admin Firestore.
 *
 * Gets the Firebase Admin Firestore instance.
 */
export function getAdminDb(): Firestore {
  if (!adminDb) {
    adminDb = getFirestore(getAdminApp());
  }
  return adminDb;
}
