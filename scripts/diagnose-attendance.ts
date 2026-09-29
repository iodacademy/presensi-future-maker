/**
 * Mendiagnosis kenapa presensi sebuah sesi ditolak. Hanya membaca.
 *
 * Menjalankan kembali keputusan yang dipakai server -- jendela waktu, kelas
 * yang terdaftar, revisi kode -- terhadap sesi hari ini, sehingga penyebab
 * penolakan terlihat tanpa menebak dari pesan galat peserta.
 *
 * Diagnoses why a session's attendance is refused. Read-only.
 *
 * Replays the decisions the server makes -- the time window, the listed
 * classes, the code revision -- against today's sessions, so the cause shows
 * without guessing from a participant's error message.
 *
 * Jalankan / Run:
 *   npx tsx scripts/diagnose-attendance.ts [kata-kunci-kelas]
 */
import { getAdminDb } from '../src/lib/firebase/admin';
import { isSessionAttendanceActive } from '../src/features/attendance/policy';
import { generateSessionCode } from '../src/features/attendance/qr';
import type { SessionDocument } from '../src/features/attendance/types';

function wibNow(): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    timeZone: 'Asia/Jakarta',
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
}

async function main() {
  const filter = (process.argv[2] ?? '').toLowerCase();
  const db = getAdminDb();
  const now = wibNow();
  const nowIso = new Date().toISOString();

  console.log(`Sekarang WIB: ${now.date} ${now.time}\n`);

  const snap = await db.collection('sessions').where('date', '==', now.date).get();
  if (snap.empty) {
    console.log(`Tidak ada sesi bertanggal ${now.date}.`);
    console.log('Presensi hanya terbuka otomatis pada tanggal sesinya sendiri.');
    return;
  }

  const classNames = new Map<string, string>();
  for (const d of await db.collection('classes').get().then((s) => s.docs)) {
    classNames.set(d.id, (d.data().canonicalName as string) ?? d.id);
  }

  for (const doc of snap.docs) {
    const s = doc.data() as SessionDocument;
    const label = `${s.title} (${classNames.get(s.classId) ?? s.classId})`;
    if (filter && !label.toLowerCase().includes(filter)) continue;

    const aktif = isSessionAttendanceActive(s, nowIso);
    const kelas = s.classIds ?? [s.classId];

    console.log(`${aktif ? '[TERBUKA]' : '[TERTUTUP]'} ${label}`);
    console.log(`  id        : ${doc.id}`);
    console.log(`  jam       : ${s.startTime}-${s.endTime} (${s.mode})`);
    console.log(`  override  : ${s.attendanceOverride}`);
    console.log(`  kelas     : ${kelas.map((c) => classNames.get(c) ?? c).join(', ')}`);
    console.log(`  qrRevision: ${s.qrRevision}`);

    if (aktif && process.env.QR_SECRET) {
      console.log(`  kode      : ${generateSessionCode(doc.id, s.qrRevision, process.env.QR_SECRET)}`);
    }

    if (!aktif) {
      if (s.attendanceOverride === 'closed') {
        console.log('  SEBAB     : ditutup manual oleh admin. Buka lewat monitor QR.');
      } else if (s.mode === 'offline') {
        console.log('  SEBAB     : sesi luring tidak terbuka otomatis; admin harus membukanya.');
      } else if (now.time < s.startTime) {
        console.log(`  SEBAB     : belum masuk jam sesi (mulai ${s.startTime}).`);
      } else if (now.time >= s.endTime) {
        console.log(`  SEBAB     : sudah lewat jam sesi (selesai ${s.endTime}).`);
      }
    }
    console.log();
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
