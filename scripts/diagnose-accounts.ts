// Memetakan di mana data akun benar-benar berada / Maps where account data actually lives
import { getAdminDb, getAdminAuth } from '../src/lib/firebase/admin';
import { normalizeEmail, getEmailHash, isValidRole } from '../src/features/auth/policy';

/**
 * Login membaca Firestore, bukan Firebase Authentication:
 *
 *   email -> sha256 -> emailIndex/{hash} -> uid -> users/{uid}
 *
 * Akun dapat berada di salah satu tempat tanpa berada di tempat lain, dan
 * gejalanya sama saja bagi pengguna: "Email tidak terdaftar". Skrip ini
 * menunjukkan sebaran sesungguhnya supaya perbaikan tidak ditebak.
 *
 * Hanya membaca. Tidak ada yang ditulis, tidak ada alamat surel yang dicetak
 * utuh -- daftar peserta adalah data pribadi, dan keluaran terminal gampang
 * tersalin ke tempat lain.
 *
 * Login reads Firestore, not Firebase Authentication:
 *
 *   email -> sha256 -> emailIndex/{hash} -> uid -> users/{uid}
 *
 * An account can sit in one place and not the other, and the symptom is
 * identical to the user either way: "Email tidak terdaftar". This script shows
 * the real distribution so the fix is not a guess.
 *
 * Read-only. Nothing is written, and no address is printed in full -- a
 * participant roster is personal data, and terminal output travels easily.
 */

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const head = local.slice(0, 2);
  return `${head}${'*'.repeat(Math.max(1, local.length - 2))}@${domain}`;
}

async function main() {
  const db = getAdminDb();
  const auth = getAdminAuth();

  console.log('\n=== KOLEKSI DI FIRESTORE ===');
  const collections = await db.listCollections();
  if (collections.length === 0) {
    console.log('  (tidak ada koleksi sama sekali -- database kosong)');
  }
  for (const col of collections) {
    const count = (await col.count().get()).data().count;
    const expected = ['users', 'emailIndex'].includes(col.id);
    console.log(`  ${col.id.padEnd(20)} ${String(count).padStart(5)} dokumen${expected ? '  <- dipakai login' : ''}`);
  }

  // Nama yang mirip tetapi salah menyebabkan seluruh login gagal tanpa petunjuk
  // apa pun, sebab kode mencari di koleksi yang memang tidak pernah ada.
  //
  // A near-miss name makes every login fail with no clue at all, since the code
  // looks in a collection that simply never existed.
  const names = collections.map((c) => c.id);
  const confusable = names.filter((n) => n !== 'users' && n.toLowerCase().replace(/s$/, '') === 'user');
  if (confusable.length > 0) {
    console.log(`\n  PERHATIAN: ada koleksi bernama "${confusable.join(', ')}".`);
    console.log('  Login hanya membaca "users" (jamak). Isi koleksi itu tidak akan terbaca.');
  }

  console.log('\n=== FIREBASE AUTHENTICATION ===');
  const list = await auth.listUsers(1000);
  console.log(`  ${list.users.length} akun terdaftar`);

  if (list.users.length === 0) {
    console.log('  (kosong)');
  }

  console.log('\n=== SILANG: Auth vs Firestore ===');
  let indexed = 0;
  let missing = 0;
  const missingSample: string[] = [];

  for (const u of list.users) {
    const email = normalizeEmail(u.email ?? '');
    if (!email) continue;
    const idx = await db.collection('emailIndex').doc(getEmailHash(email)).get();
    if (idx.exists) {
      indexed += 1;
    } else {
      missing += 1;
      if (missingSample.length < 5) missingSample.push(maskEmail(email));
    }
  }

  console.log(`  dapat login  : ${indexed}`);
  console.log(`  tidak bisa   : ${missing}`);
  if (missingSample.length > 0) {
    console.log(`  contoh       : ${missingSample.join(', ')}`);
  }

  console.log('\n=== KESIMPULAN ===');
  if (list.users.length > 0 && missing === list.users.length) {
    console.log('  Akun ada di Authentication tetapi tidak satu pun terdaftar di Firestore.');
    console.log('  Authentication hanya menyimpan alamat surel -- tanpa nama, peran, dan kelas,');
    console.log('  sehingga dokumen Firestore tidak dapat dibangun dari sana tanpa sumber lain.');
    console.log('');
    console.log('  Jalur yang dirancang untuk ini: impor Excel di menu Akun pada aplikasi,');
    console.log('  yang menulis users dan emailIndex sekaligus beserta peran dan kelasnya.');
    console.log('  Buat satu admin lebih dulu agar menu itu dapat dibuka:');
    console.log('    npm run bootstrap-admin -- --email=alamat@anda.id --name="Nama Anda"');
  } else if (missing > 0) {
    console.log(`  ${missing} akun Authentication belum punya entri Firestore dan tidak dapat login.`);
    console.log('  Sisanya sudah benar.');
  } else if (indexed > 0) {
    console.log('  Seluruh akun Authentication sudah terhubung ke Firestore.');
  }
  console.log('');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Gagal:', err);
    process.exit(1);
  });
