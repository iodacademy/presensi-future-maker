import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { getExamRoster } from '@/features/exams/service';

// Rekap pengerjaan satu ujian / One exam's completion roster
export async function GET(request: Request, { params }: { params: Promise<{ examId: string }> }) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }

  const { examId } = await params;
  try {
    return NextResponse.json(await getExamRoster(actor, examId));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 404 });
  }
}
