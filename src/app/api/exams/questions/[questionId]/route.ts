import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { deleteQuestion, updateQuestion } from '@/features/exams/service';

export async function PATCH(request: Request, { params }: { params: Promise<{ questionId: string }> }) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }

  const { questionId } = await params;
  try {
    const body = await request.json();
    await updateQuestion(actor, questionId, body);
    return NextResponse.json({ saved: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ questionId: string }> }) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }

  const { questionId } = await params;
  try {
    await deleteQuestion(actor, questionId);
    return NextResponse.json({ deleted: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
