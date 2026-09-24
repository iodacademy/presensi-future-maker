import { describe, expect, it, vi, afterEach } from 'vitest';

/**
 * Di Cloud Run tidak ada kunci privat, sehingga createCustomToken menandatangani
 * lewat IAM API dan harus diberi tahu atas nama akun mana. Bila serviceAccountId
 * tidak diteruskan, Firebase menebak akun bawaan App Engine dan seluruh login
 * gagal dengan "Permission 'iam.serviceAccounts.signBlob' denied" -- galat yang
 * menunjuk akun keliru, sehingga penyebabnya sulit dilacak.
 *
 * On Cloud Run there is no private key, so createCustomToken signs through the
 * IAM API and must be told which account it signs as. If serviceAccountId is
 * not forwarded, Firebase guesses the default App Engine account and every
 * login fails with "Permission 'iam.serviceAccounts.signBlob' denied" -- an
 * error naming the wrong account, which makes the cause hard to trace.
 */
const initializeApp = vi.fn((config?: Record<string, unknown>) => ({ name: 'test-app', config }));

vi.mock('firebase-admin/app', () => ({
  getApps: () => [],
  initializeApp,
  cert: vi.fn(),
}));
vi.mock('firebase-admin/auth', () => ({ getAuth: vi.fn() }));
vi.mock('firebase-admin/firestore', () => ({ getFirestore: vi.fn() }));
vi.mock('node:fs', () => ({ default: { existsSync: () => false, readFileSync: vi.fn() } }));
vi.mock('fs', () => ({ default: { existsSync: () => false, readFileSync: vi.fn() } }));

async function initWith(env: Record<string, string | undefined>) {
  vi.resetModules();
  initializeApp.mockClear();
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) vi.stubEnv(k, '');
    else vi.stubEnv(k, v);
  }
  const mod = await import('../../src/lib/firebase/admin');
  mod.getAdminApp();
  return initializeApp.mock.calls[0]?.[0] ?? {};
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('inisialisasi Firebase Admin', () => {
  it('meneruskan serviceAccountId saat variabelnya tersedia', async () => {
    const config = await initWith({
      FIREBASE_PROJECT_ID: 'proyek-uji',
      FIREBASE_SERVICE_ACCOUNT_ID: 'layanan@proyek-uji.iam.gserviceaccount.com',
      K_SERVICE: 'presensi',
      FIREBASE_PRIVATE_KEY: '',
      GOOGLE_APPLICATION_CREDENTIALS: '',
    });
    expect(config.serviceAccountId).toBe('layanan@proyek-uji.iam.gserviceaccount.com');
  });

  it('tidak menyertakan serviceAccountId bila variabelnya kosong', async () => {
    // Menyertakan nilai kosong membuat Firebase menandatangani atas nama ""
    // alih-alih jatuh ke perilaku bawaannya.
    //
    // Passing an empty value would make Firebase sign as "" rather than fall
    // back to its default behaviour.
    const config = await initWith({
      FIREBASE_PROJECT_ID: 'proyek-uji',
      FIREBASE_SERVICE_ACCOUNT_ID: '',
      K_SERVICE: 'presensi',
      FIREBASE_PRIVATE_KEY: '',
      GOOGLE_APPLICATION_CREDENTIALS: '',
    });
    expect('serviceAccountId' in config).toBe(false);
  });
});
