import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { listSurveyForms, createSurveyForm } from '@/features/survey/service';

/**
 * Daftar formulir survei.
 *
 * Peserta ikut membacanya untuk mengisi, sehingga tidak dibatasi admin. Tidak
 * ada yang perlu disembunyikan: survei tidak punya jawaban benar.
 *
 * The survey forms.
 *
 * Participants read them to fill them in, so this is not admin-only. There is
 * nothing to withhold: a survey has no correct answers.
 */
export async function GET() {
  const actor = await getSessionActor();
  if (!actor) {
    return NextResponse.json({ error: 'Masuk terlebih dahulu' }, { status: 401 });
  }

  try {
    return NextResponse.json({ forms: await listSurveyForms() });
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
    return NextResponse.json(await createSurveyForm(actor, await request.json()));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
