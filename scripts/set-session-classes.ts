// Menetapkan daftar kelas yang mengikuti sebuah sesi
// Sets the list of classes attending a session
import { getAdminDb } from '../src/lib/firebase/admin';
import type { SessionDocument } from '../src/features/attendance/types';
import type { ClassDocument } from '../src/features/classes/types';

/**
 * Memperbaiki classIds sebuah sesi tanpa menyentuh yang lain.
 *
 * Penggabungan yang terlalu luas menyisakan sesi yang mencantumkan kelas yang
 * sebenarnya tidak menghadirinya, sehingga judul dan alamat sesi itu muncul
 * pada jadwal kelas tersebut. Menyusun ulang lewat skrip penggabungan tidak
 * menolong: yang perlu diubah hanya daftarnya.
 *
 * Repairs one session's classIds without touching anything else.
 *
 * A merge that reached too wide leaves a session listing classes that do not
 * actually attend it, so that session's title and venue appear on their
 * schedules. Re-running the merge script does not help: only the list needs
 * changing.
 */
async function main() {
  const date = process.argv[2];
  const startTime = process.argv[3];
  const apply = process.argv.includes('--apply');
  const onlyArg = process.argv.find((a) => a.startsWith('--classes='));

  if (!date || !startTime) {
    console.error('Sebutkan tanggal dan jam mulai sesinya.');
    console.error('  npm run set-session-classes -- 2026-09-25 09:00');
    console.error('  npm run set-session-classes -- 2026-09-25 09:00 --classes=Semarang\n');
    console.error('Tanpa --classes, sesi dikembalikan ke kelas pemiliknya saja.');
    console.error('Without --classes, the session returns to its owning class alone.\n');
    process.exit(1);
  }

  const db = getAdminDb();
  const classes = new Map<string, ClassDocument>();
  for (const doc of (await db.collection('classes').get()).docs) {
    classes.set(doc.id, doc.data() as ClassDocument);
  }

  const snap = await db.collection('sessions').where('date', '==', date).get();
  const matches = snap.docs.filter((d) => (d.data() as SessionDocument).startTime === startTime);

  if (matches.length === 0) {
    console.log(`\nTidak ada sesi pada ${date} jam ${startTime}.`);
    console.log('Sesi pada tanggal itu:');
    for (const doc of snap.docs) {
      const s = doc.data() as SessionDocument;
      console.log(`  ${s.startTime}-${s.endTime} ${classes.get(s.classId)?.canonicalName ?? s.classId}`);
    }
    console.log('');
    return;
  }

  if (matches.length > 1) {
    // Mengubah beberapa sesi sekaligus berdasarkan jam saja terlalu kasar;
    // admin perlu tahu bahwa jam itu tidak menunjuk satu sesi.
    //
    // Changing several sessions at once by hour alone is too blunt; the admin
    // needs to know that hour does not point at one session.
    console.error(`\n${matches.length} sesi pada ${date} jam ${startTime}. Gabungkan lebih dulu atau perbaiki lewat aplikasi.\n`);
    process.exit(1);
  }

  const doc = matches[0];
  const session = doc.data() as SessionDocument;

  let nextIds: string[];
  if (onlyArg) {
    const wanted = onlyArg
      .slice('--classes='.length)
      .split(',')
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean);

    const resolved: string[] = [];
    for (const term of wanted) {
      const found = [...classes.entries()].find(
        ([, c]) =>
          c.city.toLowerCase() === term ||
          c.canonicalName.toLowerCase() === term ||
          c.canonicalName.toLowerCase().includes(term)
      );
      if (!found) {
        console.error(`\nKelas tidak ditemukan: "${term}"`);
        console.error('Kelas yang ada:');
        for (const c of classes.values()) console.error(`  ${c.canonicalName}`);
        console.error('');
        process.exit(1);
      }
      resolved.push(found[0]);
    }
    // Kelas pemilik selalu ikut; sesi yang tidak mencantumkan kelasnya sendiri
    // akan hilang dari jadwal kelas itu.
    //
    // The owning class always attends; a session omitting its own class would
    // vanish from that class's schedule.
    nextIds = Array.from(new Set([session.classId, ...resolved]));
  } else {
    nextIds = [session.classId];
  }

  const name = (id: string) => classes.get(id)?.canonicalName ?? id;

  console.log(`\n${session.title}`);
  console.log(`  ${date} ${session.startTime}-${session.endTime} (${session.mode})`);
  console.log(`  pemilik  : ${name(session.classId)}`);
  console.log(`  sekarang : ${(session.classIds ?? [session.classId]).map(name).join(', ')}`);
  console.log(`  menjadi  : ${nextIds.map(name).join(', ')}`);

  const hilang = (session.classIds ?? []).filter((id) => !nextIds.includes(id));
  if (hilang.length > 0) {
    console.log(`\n  Kelas yang dilepas: ${hilang.map(name).join(', ')}`);

    // Kehadiran yang sudah tercatat tidak ikut terhapus, tetapi peserta dari
    // kelas yang dilepas tidak akan melihat sesi ini lagi pada jadwalnya.
    //
    // Recorded attendance is not deleted, but participants from the released
    // classes will no longer see this session on their schedule.
    const att = await db.collection('attendance').where('sessionId', '==', doc.id).get();
    const terdampak = att.docs.filter((a) => hilang.includes((a.data() as { classId: string }).classId));
    if (terdampak.length > 0) {
      console.log(`  ${terdampak.length} catatan kehadiran dari kelas itu tetap tersimpan,`);
      console.log('  tetapi sesinya tidak lagi tampil pada jadwal mereka.');
    }
  }

  if (!apply) {
    console.log('\nIni mode pratinjau -- tidak ada yang ditulis.');
    console.log('Jalankan ulang dengan --apply untuk menerapkan.\n');
    return;
  }

  await doc.ref.update({ classIds: nextIds, updatedAt: new Date().toISOString() });
  console.log('\nTersimpan.\n');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Gagal:', err);
    process.exit(1);
  });
