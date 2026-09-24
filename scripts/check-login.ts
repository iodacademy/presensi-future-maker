// Menelusuri satu alamat surel melalui seluruh tahap login
// Traces a single email address through every login step
import { getAdminDb, getAdminAuth } from '../src/lib/firebase/admin';
import { normalizeEmail, getEmailHash, isValidRole } from '../src/features/auth/policy';
import type { UserDocument } from '../src/features/auth/types';

/**
 * Login menolak dengan satu pesan yang sama untuk setiap kemungkinan kegagalan,
 * supaya penyerang tidak dapat membedakan alamat yang terdaftar dari yang
 * tidak. Sikap itu benar bagi pengguna, tetapi menyembunyikan penyebabnya dari
 * admin yang sedang memperbaiki. Skrip ini menampilkan tahap mana yang gagal.
 *
 * Login refuses with one identical message for every possible failure, so an
 * attacker cannot tell a registered address from an unregistered one. That is
 * right for users, but it hides the cause from the admin doing the fixing.
 * This script shows which step failed.
 */
async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Sebutkan alamat surel yang diperiksa.');
    console.error('  npm run check-login -- alamat@contoh.id\n');
    process.exit(1);
  }

  const normalized = normalizeEmail(email);
  const db = getAdminDb();
  const auth = getAdminAuth();

  console.log(`\nMemeriksa: ${normalized}\n`);

  // Tahap 1: indeks surel / Step 1: email index
  const hash = getEmailHash(normalized);
  const indexDoc = await db.collection('emailIndex').doc(hash).get();

  if (!indexDoc.exists) {
    console.log('  [GAGAL] emailIndex   : tidak ada entri untuk alamat ini');
    console.log('\n  Alamat ini belum terdaftar. Tambahkan lewat salah satu cara berikut:');
    console.log('    - sebagai admin : npm run bootstrap-admin -- --email=' + normalized + ' --name="Nama"');
    console.log('    - sebagai peserta atau mentor: impor Excel di menu Akun pada aplikasi\n');
    return;
  }
  console.log('  [OK]   emailIndex   : ditemukan');

  const uid = indexDoc.data()?.uid;
  if (!uid) {
    console.log('  [GAGAL] uid          : entri indeks tidak memuat uid');
    console.log('\n  Entri indeks rusak. Jalankan: npm run repair-index\n');
    return;
  }

  // Tahap 2: dokumen pengguna / Step 2: user document
  const userDoc = await db.collection('users').doc(uid).get();
  if (!userDoc.exists) {
    console.log(`  [GAGAL] users/${uid} : dokumen tidak ada`);
    console.log('\n  Indeks menunjuk dokumen yang sudah terhapus.\n');
    return;
  }
  console.log('  [OK]   users        : dokumen ditemukan');

  const data = userDoc.data() as UserDocument;

  // Tahap 3: status aktif / Step 3: active flag
  if (data.active !== true) {
    console.log(`  [GAGAL] active       : bernilai ${data.active}, seharusnya true`);
    console.log('\n  Akun dinonaktifkan. Ubah field active menjadi true untuk mengaktifkan kembali.\n');
    return;
  }
  console.log('  [OK]   active       : true');

  // Tahap 4: peran / Step 4: role
  if (!isValidRole(data.role)) {
    console.log(`  [GAGAL] role         : "${data.role}" bukan peran yang sah`);
    console.log('\n  Peran harus salah satu dari: admin, mentor, student.\n');
    return;
  }
  console.log(`  [OK]   role         : ${data.role}`);

  // Tahap 5: akun Authentication / Step 5: Authentication account
  // Akun ini dibuat otomatis saat login pertama, jadi ketiadaannya bukan
  // kegagalan -- hanya menandakan orang tersebut belum pernah masuk.
  //
  // This account is created automatically on first login, so its absence is not
  // a failure -- it only means the person has never signed in yet.
  try {
    await auth.getUser(uid);
    console.log('  [OK]   Auth         : akun sudah ada');
  } catch {
    console.log('  [INFO] Auth         : belum ada, akan dibuat saat login pertama');
  }

  console.log(`\n  Alamat ini dapat masuk sebagai ${data.role}.\n`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Gagal:', err);
    process.exit(1);
  });
