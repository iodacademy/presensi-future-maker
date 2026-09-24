// Mengisi jadwal pertemuan keempat kelas dari rencana program
// Seeds the meeting schedule for all four classes from the programme plan
import { getAdminDb } from '../src/lib/firebase/admin';
import { createSession } from '../src/features/attendance/service';
import type { Actor } from '../src/features/auth/types';
import type { ClassDocument } from '../src/features/classes/types';
import type { SessionDocument } from '../src/features/attendance/types';
import { VENUES, SCHEDULE, toIsoDate, type ScheduleRow } from './schedule-data';

/**
 * Jam sesi mengikuti ketentuan program: daring 19.00-22.00, luring 09.00-16.00.
 *
 * Session hours follow the programme terms: online 19:00-22:00, offline
 * 09:00-16:00.
 */
const HOURS = {
  online: { startTime: '19:00', endTime: '22:00' },
  offline: { startTime: '09:00', endTime: '16:00' },
};

/**
 * Menyusun judul pertemuan dari kegiatan dan materinya.
 *
 * Keduanya digabung agar peserta mengenali urutannya sekaligus isinya; judul
 * yang hanya berbunyi "Pertemuan 7" tidak memberi tahu apa pun.
 *
 * Builds the meeting title from its activity and topic.
 *
 * Both are joined so participants recognise the sequence and the content at
 * once; a title reading only "Pertemuan 7" tells them nothing.
 */
function buildTitle(row: ScheduleRow): string {
  return `${row.kegiatan}: ${row.materi}`;
}

async function findClass(city: string, major: string): Promise<ClassDocument | null> {
  const db = getAdminDb();
  const snap = await db.collection('classes').where('city', '==', city).get();
  const match = snap.docs
    .map((d) => d.data() as ClassDocument)
    .find((c) => c.programName.toLowerCase() === major.toLowerCase());
  return match ?? null;
}

/**
 * Memeriksa apakah pertemuan dengan tanggal dan judul yang sama sudah ada.
 *
 * Skrip ini dapat dijalankan ulang setelah sebagian kelas gagal, sehingga
 * pemeriksaan ini mencegah jadwal terduplikasi.
 *
 * Checks whether a meeting with the same date and title already exists.
 *
 * This script may be re-run after some classes failed, so this check keeps the
 * schedule from being duplicated.
 */
async function alreadySeeded(classId: string, date: string, title: string): Promise<boolean> {
  const db = getAdminDb();
  const snap = await db
    .collection('sessions')
    .where('classId', '==', classId)
    .where('date', '==', date)
    .get();
  return snap.docs.some((d) => (d.data() as SessionDocument).title === title);
}

async function main() {
  const apply = process.argv.includes('--apply');

  const actor: Actor = {
    uid: 'seed-script',
    email: 'seed@local',
    name: 'Skrip Seed',
    role: 'admin',
    classId: null,
  };

  const byClass = new Map<string, ScheduleRow[]>();
  for (const row of SCHEDULE) {
    const key = `${row.kota}|${row.jurusan}`;
    if (!byClass.has(key)) byClass.set(key, []);
    byClass.get(key)!.push(row);
  }

  let created = 0;
  let skipped = 0;
  const missing: string[] = [];

  for (const [key, rows] of byClass) {
    const [city, major] = key.split('|');
    const cls = await findClass(city, major);

    if (!cls) {
      missing.push(`${city} - ${major}`);
      console.log(`\n[LEWAT] ${city} - ${major}: kelas belum dibuat di aplikasi`);
      continue;
    }

    const venue = VENUES[city];
    console.log(`\n${cls.canonicalName} (${rows.length} pertemuan)`);

    for (const row of rows) {
      const date = toIsoDate(row.tanggal);
      const title = buildTitle(row);
      const isOnline = row.moda === 'Daring';
      const hours = isOnline ? HOURS.online : HOURS.offline;

      if (await alreadySeeded(cls.id, date, title)) {
        skipped += 1;
        console.log(`  - lewat  ${date} ${title.slice(0, 50)}`);
        continue;
      }

      if (!apply) {
        console.log(`  + ${date} ${isOnline ? 'daring ' : 'luring '} ${title.slice(0, 50)}`);
        created += 1;
        continue;
      }

      try {
        await createSession(actor, {
          classId: cls.id,
          title,
          date,
          startTime: hours.startTime,
          endTime: hours.endTime,
          mode: isOnline ? 'online' : 'offline',
          // Tautan Zoom menyusul; kolomnya opsional sehingga jadwal dapat
          // disusun lebih dulu dan tautannya diisi kemudian.
          //
          // Zoom links come later; the field is optional so the schedule can be
          // laid out first and the links filled in afterwards.
          zoomUrl: null,
          address: isOnline ? null : `${venue.name}, ${venue.address}`,
          mapsUrl: isOnline ? null : venue.mapsUrl,
        });
        created += 1;
        console.log(`  + ${date} ${isOnline ? 'daring ' : 'luring '} ${title.slice(0, 50)}`);
      } catch (err) {
        console.error(`  ! gagal ${date} ${title.slice(0, 40)}: ${(err as Error).message}`);
      }
    }
  }

  console.log('');
  if (!apply) {
    console.log(`Pratinjau: ${created} pertemuan akan dibuat, ${skipped} sudah ada.`);
    if (missing.length > 0) {
      console.log(`\nKelas berikut belum ada di aplikasi dan dilewati:`);
      for (const m of missing) console.log(`  - ${m}`);
      console.log('Buat kelasnya lebih dulu lewat menu Kelas.');
    }
    console.log('\nJalankan ulang dengan --apply untuk menyimpan.\n');
  } else {
    console.log(`${created} pertemuan dibuat, ${skipped} dilewati karena sudah ada.`);
    if (missing.length > 0) {
      console.log(`${missing.length} kelas belum ada: ${missing.join(', ')}`);
    }
    console.log('');
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Gagal:', err);
    process.exit(1);
  });
