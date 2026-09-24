import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { listStudentTasksWithSubmissions } from '@/features/tasks/submission-service';

// Endpoint daftar tugas untuk siswa yang sedang login
// Endpoint for currently logged-in student to fetch their tasks & submissions
export async function GET() {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'student') {
    return NextResponse.json({ error: 'Hanya siswa yang diizinkan' }, { status: 403 });
  }

  try {
    const tasks = await listStudentTasksWithSubmissions(actor);
    return NextResponse.json({ tasks });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
