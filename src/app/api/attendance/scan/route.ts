import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { recordStudentAttendance } from '@/features/attendance/service';

export async function POST(request: Request) {
  const actor = await getSessionActor();

  // Tanpa sesi dan salah peran dibedakan. Halaman presensi menawarkan pengisian
  // surel pada 401, sedangkan admin atau mentor yang memindai QR perlu tahu
  // bahwa masuk ulang tidak akan menolong -- kehadiran hanya dicatat untuk
  // peserta.
  //
  // No session and wrong role are told apart. The attendance page offers the
  // email form on a 401, while an admin or mentor scanning the QR needs to know
  // that signing in again will not help -- attendance is only recorded for
  // participants.
  if (!actor) {
    return NextResponse.json(
      { error: 'Masuk terlebih dahulu untuk mencatat kehadiran' },
      { status: 401 }
    );
  }

  if (actor.role !== 'student') {
    return NextResponse.json(
      { error: 'Kehadiran hanya dicatat untuk akun peserta. Anda masuk sebagai ' + (actor.role === 'admin' ? 'admin' : 'mentor') + '.' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const result = await recordStudentAttendance(actor, body.token, body.source || 'scan');
    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
