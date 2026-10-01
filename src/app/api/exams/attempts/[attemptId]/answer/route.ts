import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { saveDraftAnswer } from '@/features/exams/service';

// Simpanan otomatis satu jawaban / Autosave for one answer
export async function POST(request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const actor = await getSessionActor();
  if (!actor) {
    return NextResponse.json({ error: 'Masuk terlebih dahulu' }, { status: 401 });
  }

  const { attemptId } = await params;
  try {
    const body = await request.json();
    await saveDraftAnswer(actor, attemptId, body.questionId, body.selectedOptionId ?? null, body.isDoubtful === true);
    return NextResponse.json({ saved: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
