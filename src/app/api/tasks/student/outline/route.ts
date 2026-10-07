import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { listStudentTaskOutline } from '@/features/tasks/submission-service';

// Ringkasan tugas peserta untuk course player jadwal / Participant task outline for the schedule course player
export async function GET() {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'student') {
    return NextResponse.json({ error: 'Hanya siswa yang diizinkan' }, { status: 403 });
  }

  try {
    const tasks = await listStudentTaskOutline(actor);
    return NextResponse.json({ tasks });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
