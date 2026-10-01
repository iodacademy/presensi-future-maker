import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { addSurveyQuestion } from '@/features/survey/service';

export async function POST(request: Request, { params }: { params: Promise<{ formId: string }> }) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }

  const { formId } = await params;
  try {
    await addSurveyQuestion(actor, formId, await request.json());
    return NextResponse.json({ added: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
