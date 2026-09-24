import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { getAdminDb } from '@/lib/firebase/admin';
import type { AttendanceDocument } from '@/features/attendance/types';

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

    const headers = ['Nama Siswa', 'Sesi Pertemuan', 'Waktu Hadir (WIB)', 'Metode'];

    const rows = records.map((r) => {
      const sanitize = (val: any) => {
        const str = String(val ?? '');
        if (['=', '+', '-', '@'].includes(str.charAt(0))) {
          return `'${str}`;
        }
        return `"${str.replace(/"/g, '""')}"`;
      };

      return [
        sanitize(r.studentName),
        sanitize(r.sessionTitle),
        sanitize(r.recordedAt),
        sanitize(r.source === 'camera' ? 'Kamera HP' : 'Scan QR'),
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
