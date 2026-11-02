import { cookies } from 'next/headers';
import { joinMoment } from '../users/join-policy';
import { getAdminAuth, getAdminDb } from '../../lib/firebase/admin';
import type { Actor, UserDocument } from './types';
import { SESSION_COOKIE_NAME, SESSION_EXPIRES_MS } from './constants';

export { getRoleRedirectPath, isAuthorizedPath } from './paths';
export { SESSION_COOKIE_NAME, SESSION_EXPIRES_DAYS, SESSION_EXPIRES_MS } from './constants';

/**
 * Membuat Firebase session cookie dari ID token klien.
 *
 * Creates a Firebase session cookie from a client ID token.
 */
export async function createSessionCookieFromIdToken(idToken: string): Promise<string> {
  const auth = getAdminAuth();
  return auth.createSessionCookie(idToken, { expiresIn: SESSION_EXPIRES_MS });
}

/**
 * Menukar custom token menjadi session cookie, seluruhnya di server.
 *
 * Penukaran ke ID token dulu dikerjakan peramban lewat Firebase Client SDK,
 * yang menghubungi identitytoolkit.googleapis.com langsung dari laptop
 * peserta. Jaringan kampus, antivirus, atau pemblokir iklan yang menahan
 * googleapis.com menggagalkan login dengan "auth/network-request-failed",
 * padahal situs kita sendiri terjangkau. Dari server, jalurnya selalu tersedia.
 *
 * Exchanges a custom token for a session cookie, entirely on the server.
 *
 * The exchange for an ID token used to happen in the browser through the Firebase
 * Client SDK, calling identitytoolkit.googleapis.com straight from the
 * participant's laptop. A campus network, antivirus, or ad blocker holding back
 * googleapis.com failed the login with "auth/network-request-failed", even though
 * our own site was reachable. From the server that path is always available.
 */
export async function createSessionCookieFromCustomToken(customToken: string): Promise<string> {
  const key = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!key) throw new Error('NEXT_PUBLIC_FIREBASE_API_KEY belum diatur');

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(key)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
      // Dibatasi waktunya: permintaan yang menggantung menahan peserta pada
      // tombol "Memproses..." tanpa pernah diberi tahu apa yang terjadi.
      //
      // Time-limited: a hanging request holds the participant on a "Memproses..."
      // button without ever telling them what happened.
      signal: AbortSignal.timeout(10_000),
    }
  );

  const data = (await res.json().catch(() => ({}))) as { idToken?: string; error?: { message?: string } };
  if (!res.ok || !data.idToken) {
    throw new Error(`Penukaran token ditolak: ${data.error?.message ?? res.status}`);
  }

  return createSessionCookieFromIdToken(data.idToken);
}

// Cache actor per proses server berumur pendek supaya navigasi beruntun (klik
// menu berkali-kali dalam beberapa detik) tidak menembak Firestore tiap kali.
// Fungsi ini dipanggil di 57+ tempat (tiap halaman + tiap API route), jadi
// tanpa cache satu klik menu bisa berarti belasan read berulang untuk data
// yang sama.
//
// Firestore berada di asia-southeast2, satu region dengan Cloud Run: read
// pertama tiap proses ~400ms (termasuk handshake), berikutnya ~80ms.
//
// Short-lived per-process actor cache so rapid navigation (clicking multiple
// menus within seconds) doesn't hit Firestore every time. This function is
// called from 57+ places (every page + every API route), so without the cache
// a single menu click could mean a dozen repeated reads of the same data.
//
// Firestore sits in asia-southeast2, the same region as Cloud Run: the first
// read per process is ~400ms (handshake included), subsequent ones ~80ms.
const actorCache = new Map<string, { actor: Actor; expiresAt: number }>();
const ACTOR_CACHE_TTL_MS = 30_000;

/**
 * Memverifikasi session cookie dan mengambil data aktor dari Firestore.
 * Mengembalikan null jika sesi tidak sah, kedaluwarsa, atau dicabut.
 *
 * Verifies session cookie and loads actor data from Firestore.
 * Returns null if session is invalid, expired, or revoked.
 */
export async function getSessionActor(): Promise<Actor | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionCookie) return null;

  const cached = actorCache.get(sessionCookie);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.actor;
  }

  try {
    const auth = getAdminAuth();
    // checkRevoked=false: verifikasi lokal (~1ms) tanpa network call ke Google.
    // Trade-off yang disengaja: token yang dicabut manual (mis. admin nonaktifkan
    // akun) tetap tervalidasi sampai cookie kedaluwarsa (maks SESSION_EXPIRES_MS),
    // BUKAN langsung ditolak detik itu juga. Untuk aksi sensitif (ganti role,
    // nonaktifkan akun), field `active` di Firestore tetap dicek di bawah --
    // itu levernya, bukan checkRevoked.
    //
    // checkRevoked=false: local verification (~1ms) without a network call to
    // Google. Deliberate trade-off: a manually revoked token (e.g. admin
    // deactivates account) still validates until cookie expiry (max
    // SESSION_EXPIRES_MS), NOT rejected instantly. For sensitive actions
    // (role change, account deactivation), the `active` field in Firestore is
    // still checked below -- that's the real lever, not checkRevoked.
    const decodedClaims = await auth.verifySessionCookie(sessionCookie, false);

    const db = getAdminDb();
    const userDoc = await db.collection('users').doc(decodedClaims.uid).get();

    if (!userDoc.exists) return null;

    const userData = userDoc.data() as UserDocument;
    if (!userData.active) return null;

    const actor: Actor = {
      uid: userData.uid,
      email: userData.email,
      name: userData.name,
      role: userData.role,
      classId: userData.classId || null,
      ...(userData.role === 'partner' ? { partnerId: userData.partnerId ?? null } : {}),
      // Dibawa bersama sesi agar tenggat per peserta tidak perlu baca tambahan.
      // Carried with the session so per-participant deadlines need no extra read.
      ...(userData.role === 'student' ? { joinIso: joinMoment(userData) } : {}),
    };

    actorCache.set(sessionCookie, { actor, expiresAt: Date.now() + ACTOR_CACHE_TTL_MS });
    return actor;
  } catch (error) {
    return null;
  }
}
