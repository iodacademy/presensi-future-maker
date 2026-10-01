import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { getSurveyForm, updateSurveyForm, addSurveyQuestion } from '@/features/survey/service';

/**
 * Formulir survei.
 *
 * Peserta ikut membacanya untuk mengisi, sehingga tidak dibatasi admin. Tidak
 * ada yang perlu disembunyikan: survei tidak punya jawaban benar.
 *
 * The survey form.
 *
 * Participants read it to fill it in, so it is not admin-only. There is
 * nothing to withhold: a survey has no correct answers.
 */
export async function GET() {
  const actor = await getSessionActor();
  if (!actor) {
    return NextResponse.json({ error: 'Masuk terlebih dahulu' }, { status: 401 });
  }

  try {
    return NextResponse.json({ form: await getSurveyForm() });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }

  try {
    await updateSurveyForm(actor, await request.json());
    return NextResponse.json({ updated: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }

  try {
    await addSurveyQuestion(actor, await request.json());
    return NextResponse.json({ added: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
