import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { listClassTaskSummary } from '@/features/tasks/submission-service';

// Ringkasan pengumpulan per tugas di satu kelas / Per-task submission summary for one class
export async function GET(request: Request) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }

  const classId = new URL(request.url).searchParams.get('classId');
  if (!classId) {
    return NextResponse.json({ error: 'classId wajib disertakan' }, { status: 400 });
  }

  try {
    return NextResponse.json(await listClassTaskSummary(actor, classId));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
