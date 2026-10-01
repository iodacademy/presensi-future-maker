import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { submitSurveyResponse } from '@/features/survey/service';

// Pengiriman jawaban satu survei untuk satu pertemuan
// Submitting one survey's response for one meeting
export async function POST(
  request: Request,
  { params }: { params: Promise<{ formId: string; sessionId: string }> }
) {
  const actor = await getSessionActor();
  if (!actor) {
    return NextResponse.json({ error: 'Masuk terlebih dahulu' }, { status: 401 });
  }

  const { formId, sessionId } = await params;
  try {
    const body = await request.json();
    await submitSurveyResponse(actor, formId, sessionId, body.answers ?? {});
    return NextResponse.json({ submitted: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
