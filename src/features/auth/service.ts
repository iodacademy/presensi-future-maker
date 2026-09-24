// Layanan pembuatan custom token berdasarkan email / Custom token generation service based on email
import { getAdminAuth, getAdminDb } from '../../lib/firebase/admin';
import { normalizeEmail, getEmailHash, isValidRole } from './policy';
import type { Role, UserDocument } from './types';

export interface TokenResult {
  customToken: string;
  role: Role;
  name: string;
}

/**
 * Mencari pengguna berdasarkan email, memverifikasi status aktif dan role,
 * lalu menerbitkan Firebase Custom Token.
 *
 * Looks up user by email, verifies active status and role,
 * then issues a Firebase Custom Token.
 */
export async function createCustomTokenForEmail(rawEmail: string): Promise<TokenResult> {
  const normalized = normalizeEmail(rawEmail);
  if (!normalized) {
    throw new Error('Alamat email wajib diisi / Email address is required');
  }

  const db = getAdminDb();
  const auth = getAdminAuth();

  // Cari di emailIndex / Look up in emailIndex
  const emailHash = getEmailHash(normalized);
  const indexDoc = await db.collection('emailIndex').doc(emailHash).get();

  if (!indexDoc.exists) {
    throw new Error('Email tidak terdaftar / Email not registered');
  }

  const uid = indexDoc.data()?.uid;
  if (!uid) {
    throw new Error('Data indeks tidak valid / Invalid index record');
  }

  // Ambil dokumen user (Firestore) dan cek akun Auth (Firebase Authentication)
  // sekaligus -- keduanya cuma butuh `uid` dari index di atas, tidak saling
  // bergantung satu sama lain, jadi jalankan paralel bukan berurutan. Ini salah
  // satu dari 4 tahap login yang jalan sequential secara arsitektur (token ->
  // sign-in -> idToken -> session cookie), jadi tiap ms yang bisa dihemat di
  // sini langsung terasa oleh pengguna.
  //
  // Fetch user document (Firestore) and check Auth account (Firebase
  // Authentication) simultaneously -- both only need `uid` from the index
  // above, no interdependency, so run in parallel not sequentially. This is
  // one of 4 login steps that are architecturally sequential (token ->
  // sign-in -> idToken -> session cookie), so every ms saved here is directly
  // felt by the user.
  const [userDoc, authUserResult] = await Promise.all([
    db.collection('users').doc(uid).get(),
    auth.getUser(uid).then((u) => ({ found: true as const, user: u })).catch((err) => ({ found: false as const, err })),
  ]);

  if (!userDoc.exists) {
    throw new Error('Dokumen pengguna tidak ditemukan / User document not found');
  }

  const userData = userDoc.data() as UserDocument;
  if (!userData.active) {
    throw new Error('Akun dinonaktifkan / Account is deactivated');
  }

  if (!isValidRole(userData.role)) {
    throw new Error('Peran pengguna tidak valid / Invalid user role');
  }

  // Pastikan akun Auth Firebase ada secara idempoten / Ensure Firebase Auth account exists idempotently
  if (!authUserResult.found) {
    if (authUserResult.err.code === 'auth/user-not-found') {
      await auth.createUser({
        uid,
        email: userData.email,
        displayName: userData.name,
      });
    } else {
      throw authUserResult.err;
    }
  }

  // Buat custom token dengan custom claims role / Create custom token with role claim
  const customToken = await auth.createCustomToken(uid, {
    role: userData.role,
    name: userData.name,
  });

  return {
    customToken,
    role: userData.role,
    name: userData.name,
  };
}
