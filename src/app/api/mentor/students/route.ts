import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { listStudentsForMentor } from '@/features/assignments/service';
import { isValidPhase } from '@/features/assignments/policy';
import { mentoringCounts } from '@/features/mentoring/progress';

export async function GET(request: Request) {
  const actor = await getSessionActor();
  if (!actor || (actor.role !== 'mentor' && actor.role !== 'admin')) {
    return NextResponse.json({ error: 'Hanya mentor atau admin yang diizinkan' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const phase = searchParams.get('phase') || 'bootcamp';

  if (!isValidPhase(phase)) {
    return NextResponse.json({ error: 'Fase tidak valid' }, { status: 400 });
  }

  try {
    const list = await listStudentsForMentor(actor.uid, phase);
    const counts = await mentoringCounts(list.map((a) => a.studentId), phase);
    const students = list.map((a) => ({ ...a, mentoringCount: counts.get(a.studentId) ?? 0 }));
    return NextResponse.json({ students });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
