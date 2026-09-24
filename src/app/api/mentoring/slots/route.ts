import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { createMentoringSlot, listSlotsForClass } from '@/features/mentoring/service';
import { isValidPhase } from '@/features/assignments/policy';

export async function GET(request: Request) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const classId = searchParams.get('classId');
  const phase = searchParams.get('phase') || 'bootcamp';

  if (!classId || !isValidPhase(phase)) {
    return NextResponse.json({ error: 'classId dan phase wajib diisi' }, { status: 400 });
  }

  try {
    const slots = await listSlotsForClass(classId, phase);
    return NextResponse.json({ slots });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const result = await createMentoringSlot(actor, body);
    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
