import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { removeSurveyQuestion, updateSurveyQuestion, moveSurveyQuestion } from '@/features/survey/service';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ formId: string; questionId: string }> }
) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }

  const { formId, questionId } = await params;
  try {
    const body = await request.json();

    // Memindahkan dan menyunting dipisahkan. Satu badan yang memuat keduanya
    // membuat tombol naik-turun ikut mengirim teks pertanyaan yang sedang
    // diketik dan belum selesai.
    //
    // Moving and editing are kept apart. One body carrying both would have the
    // up and down buttons also send a question text still being typed.
    if (body.direction === 'up' || body.direction === 'down') {
      await moveSurveyQuestion(actor, formId, questionId, body.direction);
      return NextResponse.json({ moved: true });
    }

    await updateSurveyQuestion(actor, formId, questionId, body);
    return NextResponse.json({ updated: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

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
