// Skrip bootstrap akun admin pertama / First admin bootstrap script
import crypto from 'crypto';
import { getAdminDb, getAdminAuth } from '../src/lib/firebase/admin';
import { normalizeEmail, getEmailHash } from '../src/features/auth/policy';
import type { UserDocument } from '../src/features/auth/types';

export interface BootstrapArgs {
  email: string;
  name: string;
}

/**
 * Parsing argumen CLI untuk bootstrap admin.
 *
 * Parses CLI arguments for admin bootstrap.
 */
export function parseBootstrapArgs(argv: string[]): BootstrapArgs {
  let email = '';
  let name = '';

  for (const arg of argv) {
    if (arg.startsWith('--email=')) {
      email = arg.substring('--email='.length);
    } else if (arg.startsWith('--name=')) {
      name = arg.substring('--name='.length);
    }
  }

  if (!email || !name) {
    throw new Error('Email dan Nama wajib diisi (contoh: --email=admin@test.com --name="Super Admin") / Email and Name are required');
  }

  return {
    email: normalizeEmail(email),
    name: name.trim(),
  };
}

/**
 * Mendaftarkan akun admin pertama ke Firestore dan Auth.
 *
 * Enrolls the initial admin account in Firestore and Auth.
 */
export async function bootstrapAdmin(args: BootstrapArgs): Promise<{ uid: string }> {
  const db = getAdminDb();
  const auth = getAdminAuth();

  const normalized = normalizeEmail(args.email);
  const emailHash = getEmailHash(normalized);

  const indexDoc = await db.collection('emailIndex').doc(emailHash).get();
  let uid = crypto.randomUUID();
  const now = new Date().toISOString();

  if (indexDoc.exists) {
    uid = indexDoc.data()?.uid || uid;
  }

  const userDoc: UserDocument = {
    uid,
    email: args.email,
    normalizedEmail: normalized,
    name: args.name,
    role: 'admin',
    active: true,
    classId: null,
    createdAt: now,
    updatedAt: now,
  };

  // Tulis ke Firestore dalam batch / Write to Firestore atomically
  const batch = db.batch();
  batch.set(db.collection('users').doc(uid), userDoc, { merge: true });
  batch.set(db.collection('emailIndex').doc(emailHash), {
    uid,
    normalizedEmail: normalized,
    role: 'admin',
    createdAt: now,
  }, { merge: true });

  await batch.commit();

  // Pastikan akun auth ada / Ensure auth account exists
  try {
    await auth.getUser(uid);
    await auth.updateUser(uid, {
      displayName: args.name,
      email: args.email,
    });
  } catch (err: any) {
    if (err.code === 'auth/user-not-found') {
      await auth.createUser({
        uid,
        email: args.email,
        displayName: args.name,
      });
    } else {
      throw err;
    }
  }

  return { uid };
}

// Eksekusi CLI jika dipanggil langsung / CLI execution if invoked directly
if (process.argv[1] && process.argv[1].endsWith('bootstrap-admin.ts')) {
  try {
    const args = parseBootstrapArgs(process.argv.slice(2));
    bootstrapAdmin(args)
      .then(({ uid }) => {
        console.log(`[BOOTSTRAP SUKSES] Admin terdaftar dengan UID: ${uid}`);
        process.exit(0);
      })
      .catch((err) => {
        console.error(`[BOOTSTRAP GAGAL]`, err);
        process.exit(1);
      });
  } catch (err: any) {
    console.error(err.message);
    process.exit(1);
  }
}
