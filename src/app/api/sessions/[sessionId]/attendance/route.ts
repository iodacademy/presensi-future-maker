import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { listSessionAttendance, setAttendanceStatus } from '@/features/attendance/service';
import type { AttendanceStatus } from '@/features/attendance/types';

const VALID_STATUSES: AttendanceStatus[] = ['present', 'excused', 'sick', 'absent'];

// Daftar peserta sebuah pertemuan beserta status kehadirannya
// A meeting's participant list with their attendance status
export async function GET(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }

  const { sessionId } = await params;
  try {
    return NextResponse.json(await listSessionAttendance(actor, sessionId));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 404 });
  }
}

// Menetapkan status kehadiran seorang peserta / Sets one participant's status
export async function PATCH(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }

  const { sessionId } = await params;
  try {
    const body = await request.json();

    // Status diperiksa di sini agar nilai asing tidak tersimpan; kolom itu
    // menentukan apakah seseorang terhitung hadir pada rekap penilaian.
    //
    // The status is checked here so no foreign value is stored; that field
    // decides whether someone counts as present on an assessment report.
    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json(
        { error: `Status harus salah satu dari: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    if (typeof body.studentId !== 'string' || !body.studentId) {
      return NextResponse.json({ error: 'studentId wajib disertakan' }, { status: 400 });
    }

    await setAttendanceStatus(actor, {
      sessionId,
      studentId: body.studentId,
      status: body.status,
      note: body.note ?? null,
    });

    return NextResponse.json({ updated: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
