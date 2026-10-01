import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { getSurveyReport } from '@/features/survey/service';

export async function GET(request: Request) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  try {
    return NextResponse.json(
      await getSurveyReport(actor, {
        classId: params.get('classId') || undefined,
        sessionId: params.get('sessionId') || undefined,
      })
    );
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
