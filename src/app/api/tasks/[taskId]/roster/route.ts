import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { getTaskSubmissionRoster } from '@/features/tasks/submission-service';

// Rekap pengumpulan satu tugas / One task's submission roster
export async function GET(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }

  const { taskId } = await params;
  try {
    return NextResponse.json(await getTaskSubmissionRoster(actor, taskId));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 404 });
  }
}
