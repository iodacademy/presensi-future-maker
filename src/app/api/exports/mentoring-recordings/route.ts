import * as XLSX from 'xlsx';
import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { getAdminDb } from '@/lib/firebase/admin';
import { formatLongDateWib, wibDate } from '@/lib/time';

/**
 * Ekspor Excel sesi mentoring 1-on-1 yang sudah selesai dan punya rekaman, satu
 * sheet per kelas, urut tanggal.
 *
 * Hanya booking yang punya recordingUrl yang dibaca, bukan seluruh booking:
 * rekaman ada pada sebagian kecil booking, dan yang lain tidak dipakai.
 *
 * An Excel export of finished 1-on-1 mentoring sessions that have a recording,
 * one sheet per class, in date order.
 *
 * Only bookings carrying a recordingUrl are read, not every booking: a
 * recording exists on a small share of bookings, and the rest go unused.
 */
export async function GET() {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan mengekspor data' }, { status: 403 });
  }

  const db = getAdminDb();
  const [bookingsSnap, classesSnap] = await Promise.all([
    db.collection('bookings')
      .where('recordingUrl', '>', '')
      .select('classId', 'date', 'startTime', 'endTime', 'endsAt', 'mentorName', 'studentName', 'recordingUrl', 'status')
      .get(),
    db.collection('classes').select('canonicalName').get(),
  ]);
  const namaKelas = new Map(classesSnap.docs.map((d) => [d.id, (d.data().canonicalName as string) ?? d.id]));

  const nowIso = new Date().toISOString();
  type Baris = { classId: string; date: string; startTime: string; endTime: string; mentorName: string; studentName: string; recordingUrl: string };
  const perKelas = new Map<string, Baris[]>();
  for (const d of bookingsSnap.docs) {
    const b = d.data() as Baris & { status: string; endsAt: string };
    if (b.status !== 'confirmed' || !b.endsAt || b.endsAt > nowIso) continue;
    if (!perKelas.has(b.classId)) perKelas.set(b.classId, []);
    perKelas.get(b.classId)!.push(b);
  }

  const wb = XLSX.utils.book_new();
  const kelas = [...perKelas.keys()].sort((a, b) => (namaKelas.get(a) ?? a).localeCompare(namaKelas.get(b) ?? b, 'id'));
  for (const cid of kelas) {
    const baris = perKelas.get(cid)!.sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));
    const ws = XLSX.utils.aoa_to_sheet([
      ['Tanggal', 'Nama Mentor', 'Nama Mentee', 'Link Rekaman'],
      ...baris.map((b) => [`${formatLongDateWib(b.date)}, ${b.startTime}–${b.endTime} WIB`, b.mentorName, b.studentName, b.recordingUrl]),
    ]);
    baris.forEach((b, j) => {
      ws[XLSX.utils.encode_cell({ r: j + 1, c: 3 })].l = { Target: b.recordingUrl };
    });
    ws['!cols'] = [{ wch: 38 }, { wch: 28 }, { wch: 30 }, { wch: 60 }];
    ws['!autofilter'] = { ref: `A1:D${baris.length + 1}` };
    // Nama sheet paling panjang 31 karakter, tanpa : \ / ? * [ ].
    // A sheet name is at most 31 characters, without : \ / ? * [ ].
    XLSX.utils.book_append_sheet(wb, ws, (namaKelas.get(cid) ?? cid).replace(/[:\\/?*[\]]/g, ' ').slice(0, 31).trim());
  }
  if (kelas.length === 0) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Tanggal', 'Nama Mentor', 'Nama Mentee', 'Link Rekaman'], ['Belum ada sesi yang selesai dan punya rekaman']]), 'Mentoring');
  }

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="Rekaman_Mentoring_${wibDate()}.xlsx"`,
    },
  });
}
