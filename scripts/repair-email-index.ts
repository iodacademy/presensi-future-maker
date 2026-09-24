// Memperbaiki emailIndex untuk akun yang dibuat di luar aplikasi
// Repairs emailIndex for accounts created outside the application
import { getAdminDb } from '../src/lib/firebase/admin';
import { normalizeEmail, getEmailHash, isValidRole } from '../src/features/auth/policy';
import type { UserDocument } from '../src/features/auth/types';

/**
 * Login mencari pengguna lewat emailIndex, bukan dengan menyapu koleksi users:
 *
 *   email -> sha256 -> emailIndex/{hash} -> uid -> users/{uid}
 *
 * Dokumen yang diketik langsung di Firebase Console hanya membuat users/{uid}
 * tanpa entri indeksnya, sehingga login menolak dengan "Email tidak terdaftar"
 * meski akunnya jelas ada. Skrip ini membangun entri yang hilang itu.
 *
 * Peran tidak pernah disentuh. Menyamaratakan role akan memberi seluruh peserta
 * akses admin ke nilai, akun, dan ekspor data.
 *
 * Login resolves users through emailIndex rather than scanning the users
 * collection:
 *
 *   email -> sha256 -> emailIndex/{hash} -> uid -> users/{uid}
 *
 * Documents typed directly into the Firebase Console create only users/{uid}
 * with no index entry, so login refuses with "Email tidak terdaftar" even
 * though the account plainly exists. This script builds the missing entries.
 *
 * Roles are never touched. Flattening roles would hand every participant admin
 * access to grades, accounts, and data exports.
 */

interface Finding {
  docId: string;
  email: string;
  role: string;
  problem: string;
  fixable: boolean;
}

async function scan(): Promise<Finding[]> {
  const db = getAdminDb();
  const snapshot = await db.collection('users').get();
  const findings: Finding[] = [];

  for (const doc of snapshot.docs) {
    const data = doc.data() as Partial<UserDocument>;
    const email = data.email ?? '';
    const normalized = normalizeEmail(email);

    if (!normalized) {
      findings.push({
        docId: doc.id,
        email: '(kosong)',
        role: data.role ?? '(kosong)',
        problem: 'dokumen tidak punya email -- tidak dapat diindeks',
        fixable: false,
      });
      continue;
    }

    if (!data.role || !isValidRole(data.role)) {
      findings.push({
        docId: doc.id,
        email,
        role: data.role ?? '(kosong)',
        problem: `role tidak sah: ${data.role ?? '(kosong)'} -- harus admin, mentor, atau student`,
        fixable: false,
      });
      continue;
    }

    const indexRef = db.collection('emailIndex').doc(getEmailHash(normalized));
    const indexDoc = await indexRef.get();

    if (!indexDoc.exists) {
      findings.push({ docId: doc.id, email, role: data.role, problem: 'emailIndex hilang', fixable: true });
    } else if (indexDoc.data()?.uid !== doc.id) {
      // Indeks menunjuk dokumen lain. Menimpanya dapat memutus akses akun yang
      // ditunjuk sekarang, jadi biarkan manusia yang memutuskan.
      //
      // The index points at a different document. Overwriting could cut off the
      // account it currently points to, so leave this for a human to decide.
      findings.push({
        docId: doc.id,
        email,
        role: data.role,
        problem: `emailIndex menunjuk uid lain (${indexDoc.data()?.uid}) -- perlu diperiksa manual`,
        fixable: false,
      });
    } else if (data.uid !== doc.id) {
      findings.push({
        docId: doc.id,
        email,
        role: data.role,
        problem: `field uid (${data.uid}) tidak cocok dengan ID dokumen`,
        fixable: true,
      });
    } else if (data.active !== true) {
      findings.push({
        docId: doc.id,
        email,
        role: data.role,
        problem: 'active bukan true -- login akan ditolak (tidak diubah otomatis)',
        fixable: false,
      });
    }
  }

  return findings;
}

async function repair(findings: Finding[]): Promise<number> {
  const db = getAdminDb();
  const targets = findings.filter((f) => f.fixable);
  if (targets.length === 0) return 0;

  const batch = db.batch();
  const now = new Date().toISOString();

  for (const f of targets) {
    const normalized = normalizeEmail(f.email);
    batch.set(db.collection('emailIndex').doc(getEmailHash(normalized)), {
      uid: f.docId,
      normalizedEmail: normalized,
      updatedAt: now,
    });
    // merge: melengkapi field yang hilang tanpa menghapus data yang sudah ada.
    // merge: fills in missing fields without dropping existing data.
    batch.set(
      db.collection('users').doc(f.docId),
      { uid: f.docId, normalizedEmail: normalized, updatedAt: now },
      { merge: true }
    );
  }

  await batch.commit();
  return targets.length;
}

async function main() {
  const apply = process.argv.includes('--apply');

  const findings = await scan();

  if (findings.length === 0) {
    console.log('Seluruh akun sudah terindeks dengan benar. Tidak ada yang perlu diperbaiki.');
    return;
  }

  const fixable = findings.filter((f) => f.fixable);
  const manual = findings.filter((f) => !f.fixable);

  console.log(`\nDitemukan ${findings.length} akun bermasalah:\n`);
  for (const f of findings) {
    console.log(`  [${f.fixable ? 'DAPAT DIPERBAIKI' : 'PERLU MANUAL  '}] ${f.role.padEnd(8)} | ${f.problem}`);
  }

  if (!apply) {
    console.log(`\n${fixable.length} dapat diperbaiki otomatis, ${manual.length} perlu ditangani manual.`);
    console.log('Ini mode pratinjau -- tidak ada yang ditulis.');
    console.log('Jalankan ulang dengan --apply untuk menerapkan perbaikan.\n');
    return;
  }

  const count = await repair(findings);
  console.log(`\n${count} entri emailIndex diperbaiki.`);
  if (manual.length > 0) {
    console.log(`${manual.length} akun perlu ditangani manual -- lihat daftar di atas.`);
  }
  console.log('');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Gagal:', err);
    process.exit(1);
  });
