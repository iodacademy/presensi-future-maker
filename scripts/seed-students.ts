// Mendaftarkan peserta dan memasukkannya ke sebuah kelas
// Registers participants and enrols them into a class
import crypto from 'crypto';
import { getAdminDb } from '../src/lib/firebase/admin';
import { normalizeEmail, getEmailHash } from '../src/features/auth/policy';
import type { UserDocument } from '../src/features/auth/types';
import type { ClassDocument } from '../src/features/classes/types';

interface StudentSeed {
  name: string;
  email: string;
}

const COHORTS: { city: string; major: string; students: StudentSeed[] }[] = [
  {
    city: 'Semarang',
    major: 'Web Programming',
    students: [
      { name: 'Norma Zuhrotul Hayati', email: 'normasucicd@gmail.com' },
      { name: 'Zalfaulislam Sayfanah', email: 'zalfaulislam@gmail.com' },
      { name: 'Yulian Dwi Nartriani', email: 'yulinartriani137@gmail.com' },
      { name: 'Zulfa Nurma Novita Sari', email: 'zulfanurma114@gmail.com' },
      { name: 'Veronica Regina Mambu', email: 'veronicaregmambu@gmail.com' },
      { name: 'Roihatul Azizah', email: 'jongroihatulazizah1201@gmail.com' },
      { name: 'Firsa Adinda Syafira', email: 'firsa.adinda@gmail.com' },
      { name: 'Vanya Intan Amabel Adelia', email: 'vanya.intan11@gmail.com' },
      { name: 'Nurul Izzah', email: 'izzaanrl@gmail.com' },
      { name: 'Salma Afifah Maharani', email: 'salmafifah551@gmail.com' },
      { name: 'Rinanta Indra Dewi', email: 'rinantata74@gmail.com' },
      { name: 'Rossa Livia Monika Harditia', email: 'rossalivia111@gmail.com' },
      { name: 'Selvi Ijayanti', email: 'selviijayanti293@gmail.com' },
      { name: 'Alenda Putri Fatikhah', email: 'alendafatikhah@gmail.com' },
      { name: 'Wientyas Alifia Khairunnisa', email: 'wientyasalifia@gmail.com' },
      { name: 'Ilma Navila', email: 'ilmanavila28@gmail.com' },
      { name: 'Asna Layyinatus Syifa', email: 'asnaayyin@gmail.com' },
      { name: 'Nabila Khairunnisa Dian Pranata', email: 'kdpnabila@gmail.com' },
      { name: 'Ayu Fitriyani Anwar', email: 'ayuaanwar0@gmail.com' },
    ],
  },
];

function normalise(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Batas aman satu batch Firestore / Safe Firestore batch ceiling */
const BATCH_LIMIT = 200;

async function main() {
  const apply = process.argv.includes('--apply');
  const db = getAdminDb();

  const allClasses = (await db.collection('classes').get()).docs.map((d) => d.data() as ClassDocument);

  for (const cohort of COHORTS) {
    const cls = allClasses.find(
      (c) => normalise(c.city) === normalise(cohort.city) && normalise(c.programName) === normalise(cohort.major)
    );

    if (!cls) {
      console.log(`\n[LEWAT] ${cohort.city} - ${cohort.major}: kelas tidak ditemukan`);
      console.log('  Kelas yang ada:');
      for (const c of allClasses) console.log(`    "${c.city}" - "${c.programName}"`);
      continue;
    }

    // Surel ganda dalam daftar yang sama akan membuat entri indeks yang kedua
    // menimpa yang pertama, sehingga satu peserta kehilangan akunnya tanpa
    // gejala apa pun. Diperiksa sebelum menulis apa pun.
    //
    // A duplicate address within the same list would have the second index
    // entry overwrite the first, so one participant silently loses their
    // account. Checked before anything is written.
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const s of cohort.students) {
      const key = normalizeEmail(s.email);
      if (seen.has(key)) duplicates.push(s.email);
      seen.add(key);
    }
    if (duplicates.length > 0) {
      console.error(`\n[BATAL] ${cls.canonicalName}: surel ganda dalam daftar`);
      for (const d of duplicates) console.error(`  ${d}`);
      continue;
    }

    console.log(`\n${cls.canonicalName} (${cohort.students.length} peserta)`);

    let baru = 0;
    let dipakaiUlang = 0;
    const pending: { uid: string; student: StudentSeed; normalized: string; hash: string }[] = [];

    for (const student of cohort.students) {
      const normalized = normalizeEmail(student.email);
      const hash = getEmailHash(normalized);
      const indexDoc = await db.collection('emailIndex').doc(hash).get();

      // Akun yang sudah ada dipakai ulang, bukan dibuat ganda: memberi uid baru
      // pada surel yang sama membuat indeks menunjuk salah satunya saja,
      // sehingga akun lain beserta pengumpulan dan presensinya tidak
      // terjangkau.
      //
      // An existing account is reused rather than duplicated: minting a new uid
      // for the same address leaves the index pointing at one of them, so the
      // other account with its submissions and attendance becomes unreachable.
      if (indexDoc.exists) {
        const uid = indexDoc.data()?.uid as string;
        const userDoc = await db.collection('users').doc(uid).get();
        const existing = userDoc.data() as UserDocument | undefined;

        if (!existing) {
          console.log(`  ! ${student.name}: indeks menunjuk dokumen yang tidak ada, lewati`);
          continue;
        }

        dipakaiUlang += 1;

        if (existing.classId && existing.classId !== cls.id) {
          const lain = allClasses.find((c) => c.id === existing.classId);
          console.log(`  ~ ${student.name}: sudah di kelas "${lain?.canonicalName ?? existing.classId}", akan dipindahkan`);
        } else if (existing.classId === cls.id && existing.role === 'student') {
          console.log(`  = ${student.name}: sudah terdaftar di kelas ini`);
          continue;
        } else {
          console.log(`  ~ ${student.name}: akun sudah ada, akan dimasukkan ke kelas ini`);
        }

        if (apply) {
          await db.collection('users').doc(uid).update({
            role: 'student',
            active: true,
            classId: cls.id,
            updatedAt: new Date().toISOString(),
          });
        }
        continue;
      }

      const uid = crypto.randomUUID();
      pending.push({ uid, student, normalized, hash });
      baru += 1;
      console.log(`  + ${student.name}`);
    }

    if (apply && pending.length > 0) {
      const now = new Date().toISOString();
      for (let i = 0; i < pending.length; i += BATCH_LIMIT) {
        const batch = db.batch();
        for (const { uid, student, normalized, hash } of pending.slice(i, i + BATCH_LIMIT)) {
          const userDoc: UserDocument = {
            uid,
            email: student.email,
            normalizedEmail: normalized,
            name: student.name,
            role: 'student',
            active: true,
            classId: cls.id,
            createdAt: now,
            updatedAt: now,
          };
          batch.set(db.collection('users').doc(uid), userDoc);
          // emailIndex adalah satu-satunya jalur login; tanpa entri ini akun
          // yang sudah dibuat tetap ditolak saat masuk.
          //
          // emailIndex is the only login path; without this entry a created
          // account is still refused at sign-in.
          batch.set(db.collection('emailIndex').doc(hash), {
            uid,
            normalizedEmail: normalized,
            role: 'student',
            createdAt: now,
          });
        }
        await batch.commit();
      }
    }

    // studentCount dihitung ulang dari isi koleksi, bukan ditambah sebanyak
    // peserta baru. Angka yang sudah menyimpang sebelumnya akan ikut terbawa
    // bila hanya ditambahkan, dan kartu kelas menampilkan jumlah yang keliru.
    //
    // studentCount is recomputed from the collection rather than incremented by
    // the number of new participants. A count that already drifted would carry
    // that error forward, and the class card would show the wrong number.
    if (apply) {
      const hitung = await db
        .collection('users')
        .where('classId', '==', cls.id)
        .where('role', '==', 'student')
        .count()
        .get();
      const total = hitung.data().count;
      await db.collection('classes').doc(cls.id).update({
        studentCount: total,
        updatedAt: new Date().toISOString(),
      });
      console.log(`  studentCount: ${cls.studentCount ?? 0} -> ${total}`);
    }

    console.log(`  ${baru} akun baru, ${dipakaiUlang} akun sudah ada`);
  }

  console.log('');
  if (!apply) {
    console.log('Ini mode pratinjau -- tidak ada yang ditulis.');
    console.log('Jalankan ulang dengan --apply untuk menyimpan.\n');
  } else {
    console.log('Selesai.\n');
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Gagal:', err);
    process.exit(1);
  });
