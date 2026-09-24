import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { getMentoringViewForStudent, bookMentoringSlot } from '@/features/mentoring/service';
import { isValidPhase } from '@/features/assignments/policy';

export async function GET(request: Request) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'student') {
    return NextResponse.json({ error: 'Hanya siswa yang diizinkan' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const phase = searchParams.get('phase') || 'bootcamp';

  if (!isValidPhase(phase)) {
    return NextResponse.json({ error: 'Fase tidak valid' }, { status: 400 });
  }

  try {
    const view = await getMentoringViewForStudent(actor, phase);
    return NextResponse.json(view);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'student') {
    return NextResponse.json({ error: 'Hanya siswa yang diizinkan' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const result = await bookMentoringSlot(actor, {
      slotId: body.slotId,
      acknowledgeEarlySecondSession: body.acknowledgeEarlySecondSession,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
