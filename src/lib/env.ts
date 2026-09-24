// Validasi variabel lingkungan server / Validate server environment variables
export interface EnvConfig {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

/**
 * Mengambil dan memvalidasi konfigurasi variabel lingkungan untuk Firebase Admin.
 * Throws error jika variabel wajib tidak ditemukan.
 *
 * Retrieves and validates environment variables required by Firebase Admin.
 * Throws an error if required variables are missing.
 */
export function getEnv(): EnvConfig {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error('Missing FIREBASE_PROJECT_ID in environment variables');
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || 'emulator@example.com';
  let privateKey = process.env.FIREBASE_PRIVATE_KEY || 'emulator-private-key';

  // Perbaiki format baris baru jika string escaped / Normalize newline escaping if present
  if (privateKey.includes('\\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  return { projectId, clientEmail, privateKey };
}
