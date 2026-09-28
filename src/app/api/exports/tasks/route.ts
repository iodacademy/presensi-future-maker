import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import type { TaskKind } from '@/features/tasks/types';
import { listSubmissionsForAdmin } from '@/features/tasks/submission-service';
import { formatDateTimeWib } from '@/lib/time';

// Endpoint ekspor CSV rekap nilai tugas / CSV export endpoint for task submissions & grades
export async function GET(request: Request) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan mengekspor data' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const kind = searchParams.get('kind') as TaskKind | null;
  const classId = searchParams.get('classId') || undefined;

  try {
    const submissions = await listSubmissionsForAdmin(actor, {
      kind: kind || undefined,
      classId,
    });

    // Susun baris CSV dengan sanitasi formula spreadsheet
    // Build CSV rows with spreadsheet formula injection sanitization
    const headers = ['Nama Siswa', 'Kelas', 'Tugas', 'Jenis', 'Tautan/File', 'Waktu Kumpul', 'Terlambat', 'Nilai', 'Feedback'];

    const rows = submissions.map((s) => {
      const sanitize = (val: any) => {
        const str = String(val ?? '');
        if (['=', '+', '-', '@'].includes(str.charAt(0))) {
          return `'${str}`;
        }
        return `"${str.replace(/"/g, '""')}"`;
      };

      return [
        sanitize(s.studentName),
        sanitize(s.className),
        sanitize(s.taskTitle),
        sanitize(s.taskKind),
        sanitize(s.url || s.fileName || ''),
        sanitize(formatDateTimeWib(s.submittedAt)),
        sanitize(s.late ? 'YA' : 'TIDAK'),
        sanitize(s.score !== null ? s.score : 'BELUM DINILAI'),
        sanitize(s.feedbackPreview || ''),
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\r\n');

    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="rekap-tugas-${kind || 'semua'}-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
