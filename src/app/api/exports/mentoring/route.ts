import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { listSlotsForClass } from '@/features/mentoring/service';
import { isValidPhase } from '@/features/assignments/policy';

export async function GET(request: Request) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan mengekspor data' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const classId = searchParams.get('classId');
  const phase = searchParams.get('phase') || 'bootcamp';

  if (!classId || !isValidPhase(phase)) {
    return NextResponse.json({ error: 'classId dan phase wajib disertakan' }, { status: 400 });
  }

  try {
    const slots = await listSlotsForClass(classId, phase);

    const headers = ['Tanggal', 'Jam Mulai', 'Jam Selesai', 'Fase', 'Mentor', 'Status', 'Nama Siswa', 'Tautan Meet'];

    const rows = slots.map((s) => {
      const sanitize = (val: any) => {
        const str = String(val ?? '');
        if (['=', '+', '-', '@'].includes(str.charAt(0))) {
          return `'${str}`;
        }
        return `"${str.replace(/"/g, '""')}"`;
      };

      return [
        sanitize(s.date),
        sanitize(s.startTime),
        sanitize(s.endTime),
        sanitize(s.phase),
        sanitize(s.mentorName),
        sanitize(s.status === 'booked' ? 'DIBOOKING' : s.status === 'completed' ? 'SELESAI' : 'TERSEDIA'),
        sanitize(s.studentName || '-'),
        sanitize(s.meetUrl || ''),
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\r\n');

    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="rekap-mentoring-${phase}-${classId}-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
