import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { updateExam, deleteExam } from '@/features/exams/service';

export async function PATCH(request: Request, { params }: { params: Promise<{ examId: string }> }) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }

  const { examId } = await params;
  try {
    await updateExam(actor, examId, await request.json());
    return NextResponse.json({ updated: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ examId: string }> }) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }

  const { examId } = await params;
  try {
    await deleteExam(actor, examId);
    return NextResponse.json({ deleted: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
