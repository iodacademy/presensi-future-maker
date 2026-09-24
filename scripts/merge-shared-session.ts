// Menggabungkan beberapa sesi serupa menjadi satu sesi bersama
// Merges several parallel sessions into one shared session
import { getAdminDb } from '../src/lib/firebase/admin';
import type { SessionDocument, AttendanceDocument } from '../src/features/attendance/types';
import type { ClassDocument } from '../src/features/classes/types';

/**
 * Onboarding keempat kelas berlangsung serentak dalam satu ruang Zoom, tetapi
 * jadwalnya tersimpan sebagai empat sesi terpisah sehingga menghasilkan empat
 * kode QR. Skrip ini menjadikan satu di antaranya sebagai sesi bersama dan
 * menghapus sisanya.
 *
 * Catatan kehadiran pada sesi yang dihapus dipindahkan lebih dulu; kehadiran
 * tidak dapat disusun ulang karena token QR terikat jendela waktu.
 *
 * The four classes' onboarding runs at the same time in one Zoom room, but the
 * schedule holds four separate sessions and therefore produces four QR codes.
 * This script turns one of them into a shared session and removes the rest.
 *
 * Attendance records on the removed sessions are moved first; attendance cannot
 * be reconstructed since QR tokens are bound to a time window.
 */
async function main() {
  const date = process.argv[2];
  const apply = process.argv.includes('--apply');

  if (!date) {
    console.error('Sebutkan tanggal sesi yang digabungkan (YYYY-MM-DD).');
    console.error('  npm run merge-session -- 2026-09-25\n');
    process.exit(1);
  }

  const db = getAdminDb();
  const snap = await db.collection('sessions').where('date', '==', date).get();

  if (snap.size < 2) {
    console.log(`\nHanya ${snap.size} sesi pada ${date}; tidak ada yang perlu digabungkan.\n`);
    return;
  }

  const sessions = snap.docs.map((d) => d.data() as SessionDocument);
  const classes = new Map<string, string>();
  for (const doc of (await db.collection('classes').get()).docs) {
    classes.set(doc.id, (doc.data() as ClassDocument).canonicalName);
  }

  console.log(`\n${sessions.length} sesi pada ${date}:`);
  for (const s of sessions) {
    const att = await db.collection('attendance').where('sessionId', '==', s.id).count().get();
    console.log(`  ${classes.get(s.classId) ?? s.classId} - ${s.startTime}-${s.endTime} (${att.data().count} kehadiran)`);
    console.log(`    ${s.title}`);
  }

  // Sesi paling awal dibuat menjadi induknya. Memilih yang paling awal, bukan
  // sembarang, membuat hasilnya sama setiap kali skrip dijalankan ulang.
  //
  // The earliest-created session becomes the parent. Choosing the earliest
  // rather than an arbitrary one makes a re-run produce the same result.
  const sorted = [...sessions].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const parent = sorted[0];
  const others = sorted.slice(1);

  const allClassIds = Array.from(new Set(sessions.map((s) => s.classId)));

  console.log(`\nSesi induk : ${classes.get(parent.classId) ?? parent.classId}`);
  console.log(`Kelas ikut : ${allClassIds.map((id) => classes.get(id) ?? id).join(', ')}`);
  console.log(`Dihapus    : ${others.length} sesi`);

  let movedTotal = 0;
  for (const s of others) {
    const att = await db.collection('attendance').where('sessionId', '==', s.id).get();
    movedTotal += att.size;
  }
  console.log(`Kehadiran yang dipindahkan: ${movedTotal}`);

  if (!apply) {
    console.log('\nIni mode pratinjau -- tidak ada yang ditulis.');
    console.log('Jalankan ulang dengan --apply untuk menerapkan.\n');
    return;
  }

  // Kehadiran dipindahkan sebelum sesinya dihapus. Bila urutannya dibalik dan
  // proses terputus, catatan itu menunjuk sesi yang sudah tiada dan tidak
  // muncul pada daftar hadir mana pun.
  //
  // Attendance is moved before its session is deleted. Reversed, an
  // interruption would leave records pointing at a session that no longer
  // exists, appearing on no attendance list at all.
  for (const s of others) {
    const att = await db.collection('attendance').where('sessionId', '==', s.id).get();

    for (const doc of att.docs) {
      const record = doc.data() as AttendanceDocument;
      const newId = `${parent.id}_${record.studentId}`;
      const newRef = db.collection('attendance').doc(newId);

      // ID kehadiran adalah ${sessionId}_${studentId}, sehingga dokumennya
      // dibuat ulang dengan ID baru lalu yang lama dihapus.
      //
      // An attendance ID is ${sessionId}_${studentId}, so the document is
      // recreated under the new ID and the old one deleted.
      const batch = db.batch();
      batch.set(newRef, {
        ...record,
        id: newId,
        sessionId: parent.id,
        sessionTitle: parent.title,
        sessionEndsAt: parent.endsAt,
      });
      batch.delete(doc.ref);
      await batch.commit();
    }

    await db.collection('sessions').doc(s.id).delete();
    console.log(`  dihapus: ${classes.get(s.classId) ?? s.classId} (${att.size} kehadiran dipindahkan)`);
  }

  const attendeeCount = (
    await db.collection('attendance').where('sessionId', '==', parent.id).count().get()
  ).data().count;

  await db.collection('sessions').doc(parent.id).update({
    classIds: allClassIds,
    attendeeCount,
    updatedAt: new Date().toISOString(),
  });

  console.log(`\nSesi induk kini mencakup ${allClassIds.length} kelas, ${attendeeCount} kehadiran.\n`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Gagal:', err);
    process.exit(1);
  });
