import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { listStudentSessionsWithAttendance } from '@/features/attendance/service';

export async function GET() {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'student') {
    return NextResponse.json({ error: 'Hanya siswa yang diizinkan' }, { status: 403 });
  }

  try {
    const sessions = await listStudentSessionsWithAttendance(actor);
    return NextResponse.json({ sessions });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
