// Mendaftarkan mentor dan menugaskannya ke sebuah kelas
// Registers mentors and assigns them to a class
import crypto from 'crypto';
import { getAdminDb } from '../src/lib/firebase/admin';
import { normalizeEmail, getEmailHash } from '../src/features/auth/policy';
import type { UserDocument } from '../src/features/auth/types';
import type { ClassDocument } from '../src/features/classes/types';

interface MentorSeed {
  name: string;
  email: string;
}

/**
 * Mentor per kelas, dikunci pada nama kota dan jurusannya.
 *
 * Mentors per class, keyed by city and major.
 */
const MENTORS: { city: string; major: string; mentors: MentorSeed[] }[] = [
  {
    city: 'Semarang',
    major: 'Web Programming',
    mentors: [
      { name: 'Wahyu Candra Tama', email: 'wahyucandratama@gmail.com' },
      { name: 'Michael Wiryaseputra', email: 'michwirja@gmail.com' },
      { name: 'Imam Syafii', email: 'imam.mct34@gmail.com' },
    ],
  },
];

function normalise(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

async function main() {
  const apply = process.argv.includes('--apply');
  const db = getAdminDb();

  const allClasses = (await db.collection('classes').get()).docs.map((d) => d.data() as ClassDocument);

  for (const group of MENTORS) {
    const cls = allClasses.find(
      (c) => normalise(c.city) === normalise(group.city) && normalise(c.programName) === normalise(group.major)
    );

    if (!cls) {
      console.log(`\n[LEWAT] ${group.city} - ${group.major}: kelas tidak ditemukan`);
      console.log('  Kelas yang ada:');
      for (const c of allClasses) console.log(`    "${c.city}" - "${c.programName}"`);
      continue;
    }

    console.log(`\n${cls.canonicalName}`);
    const mentorUids: string[] = [];

    for (const mentor of group.mentors) {
      const normalized = normalizeEmail(mentor.email);
      const hash = getEmailHash(normalized);
      const indexRef = db.collection('emailIndex').doc(hash);
      const indexDoc = await indexRef.get();

      // Akun yang sudah ada dipakai ulang, bukan dibuat ganda. Membuat uid baru
      // untuk surel yang sama membuat indeks menunjuk salah satunya saja,
      // sehingga akun yang lain beserta riwayatnya menjadi tidak terjangkau.
      //
      // An existing account is reused rather than duplicated. Minting a new uid
      // for the same address leaves the index pointing at just one of them, so
      // the other account and its history become unreachable.
      if (indexDoc.exists) {
        const uid = indexDoc.data()?.uid as string;
        const userDoc = await db.collection('users').doc(uid).get();
        const existing = userDoc.data() as UserDocument | undefined;

        if (!existing) {
          console.log(`  ! ${mentor.name}: indeks menunjuk dokumen yang tidak ada, lewati`);
          continue;
        }

        mentorUids.push(uid);

        if (existing.role !== 'mentor') {
          console.log(`  ~ ${mentor.name}: sudah terdaftar sebagai ${existing.role}, akan diubah menjadi mentor`);
          if (apply) {
            await db.collection('users').doc(uid).update({
              role: 'mentor',
              active: true,
              updatedAt: new Date().toISOString(),
            });
          }
        } else {
          console.log(`  = ${mentor.name}: sudah terdaftar sebagai mentor`);
        }
        continue;
      }

      const uid = crypto.randomUUID();
      const now = new Date().toISOString();
      mentorUids.push(uid);

      console.log(`  + ${mentor.name}`);
      if (!apply) continue;

      const batch = db.batch();
      const userDoc: UserDocument = {
        uid,
        email: mentor.email,
        normalizedEmail: normalized,
        name: mentor.name,
        role: 'mentor',
        active: true,
        // Mentor tidak terikat satu kelas lewat field ini; keanggotaannya
        // tercatat pada mentorIds di dokumen kelas, sebab seorang mentor dapat
        // menangani lebih dari satu kelas.
        //
        // A mentor is not bound to one class through this field; membership
        // lives in mentorIds on the class document, since one mentor may handle
        // more than one class.
        classId: null,
        createdAt: now,
        updatedAt: now,
      };

      batch.set(db.collection('users').doc(uid), userDoc);
      // emailIndex adalah satu-satunya jalur login; tanpa entri ini akun yang
      // sudah dibuat tetap tidak dapat masuk.
      //
      // emailIndex is the only login path; without this entry a created account
      // still cannot sign in.
      batch.set(indexRef, {
        uid,
        normalizedEmail: normalized,
        role: 'mentor',
        createdAt: now,
      });
      await batch.commit();
    }

    const merged = Array.from(new Set([...(cls.mentorIds || []), ...mentorUids]));
    const baru = merged.length - (cls.mentorIds || []).length;

    console.log(`  mentorIds kelas: ${(cls.mentorIds || []).length} -> ${merged.length} (${baru} baru)`);

    if (apply && baru > 0) {
      await db.collection('classes').doc(cls.id).update({
        mentorIds: merged,
        mentorCount: merged.length,
        updatedAt: new Date().toISOString(),
      });
    }
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
