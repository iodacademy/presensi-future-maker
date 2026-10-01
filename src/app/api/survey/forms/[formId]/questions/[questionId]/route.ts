import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { removeSurveyQuestion } from '@/features/survey/service';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ formId: string; questionId: string }> }
) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }

  const { formId, questionId } = await params;
  try {
    await removeSurveyQuestion(actor, formId, questionId);
    return NextResponse.json({ deleted: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
