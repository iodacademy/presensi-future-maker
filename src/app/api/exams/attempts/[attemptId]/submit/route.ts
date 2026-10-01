import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { submitAttempt } from '@/features/exams/service';

// Pengumpulan dan penilaian / Submission and grading
export async function POST(request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const actor = await getSessionActor();
  if (!actor) {
    return NextResponse.json({ error: 'Masuk terlebih dahulu' }, { status: 401 });
  }

  const { attemptId } = await params;
  try {
    const body = await request.json();
    return NextResponse.json(
      await submitAttempt(actor, attemptId, body.answers ?? {}, body.autoSubmitted === true)
    );
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
