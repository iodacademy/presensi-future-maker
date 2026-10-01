import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { submitSurveyResponse } from '@/features/survey/service';

// Pengiriman jawaban survei satu pertemuan / Submitting one meeting's survey response
export async function POST(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const actor = await getSessionActor();
  if (!actor) {
    return NextResponse.json({ error: 'Masuk terlebih dahulu' }, { status: 401 });
  }

  const { sessionId } = await params;
  try {
    const body = await request.json();
    await submitSurveyResponse(actor, sessionId, body.answers ?? {});
    return NextResponse.json({ submitted: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
