import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { getFinalGrades } from '@/features/grading/service';

export async function GET(request: Request) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }

  const classId = new URL(request.url).searchParams.get('classId');
  if (!classId) {
    return NextResponse.json({ error: 'classId wajib disertakan' }, { status: 400 });
  }

  try {
    return NextResponse.json({ grades: await getFinalGrades(actor, classId) });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
