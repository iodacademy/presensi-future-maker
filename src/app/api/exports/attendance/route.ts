import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { getAdminDb } from '@/lib/firebase/admin';
import { ATTENDANCE_STATUS_LABELS, type AttendanceDocument } from '@/features/attendance/types';
import { formatDateTimeWib } from '@/lib/time';

export async function GET(request: Request) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan mengekspor rekap presensi' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const classId = searchParams.get('classId');
  if (!classId) {
    return NextResponse.json({ error: 'classId wajib disertakan' }, { status: 400 });
  }

  try {
    const db = getAdminDb();
    const snap = await db.collection('attendance')
      .where('classId', '==', classId)
      .orderBy('recordedAt', 'asc')
      .get();

    const records = snap.docs.map((d) => d.data() as AttendanceDocument);

    // Kolom status wajib ada. Tanpa itu catatan izin dan sakit terbaca sebagai
    // kehadiran biasa pada rekap yang dipakai untuk penilaian.
    //
    // The status column is required. Without it, excused and sick records read
    // as ordinary attendance on a report used for assessment.
    const headers = ['Nama Siswa', 'Sesi Pertemuan', 'Status', 'Waktu Hadir (WIB)', 'Metode', 'Keterangan'];

    const rows = records.map((r) => {
      const sanitize = (val: any) => {
        const str = String(val ?? '');
        if (['=', '+', '-', '@'].includes(str.charAt(0))) {
          return `'${str}`;
        }
        return `"${str.replace(/"/g, '""')}"`;
      };

      // Dokumen lama tidak memuat status dan seluruhnya berasal dari pemindaian.
      // Older documents carry no status and all came from a scan.
      const status = ATTENDANCE_STATUS_LABELS[r.status ?? 'present'];
      const method =
        r.source === 'manual' ? 'Dicatat admin' : r.source === 'camera' ? 'Kamera HP' : 'Scan QR';

      return [
        sanitize(r.studentName),
        sanitize(r.sessionTitle),
        sanitize(status),
        // Kolom ini berjudul "Waktu Hadir (WIB)"; nilai ISO UTC mentah akan
        // meleset tujuh jam dari jam yang dilihat peserta saat memindai.
        //
        // This column reads "Waktu Hadir (WIB)"; a raw ISO UTC value would be
        // seven hours off from the clock a participant read while scanning.
        sanitize(formatDateTimeWib(r.recordedAt)),
        sanitize(method),
        sanitize(r.note ?? ''),
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\r\n');

    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="rekap-presensi-${classId}-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
