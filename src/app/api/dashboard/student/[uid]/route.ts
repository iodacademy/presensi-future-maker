import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { getStudentDetail } from '@/features/dashboard/student-detail-service';

// Detail progres satu peserta untuk admin dan mentornya / One participant's progress for admins and their mentor
export async function GET(_request: Request, { params }: { params: Promise<{ uid: string }> }) {
  const actor = await getSessionActor();
  if (!actor || (actor.role !== 'admin' && actor.role !== 'mentor')) {
    return NextResponse.json({ error: 'Hanya admin atau mentor yang diizinkan' }, { status: 403 });
  }
  const { uid } = await params;
  try {
    return NextResponse.json(await getStudentDetail(actor, uid));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 404 });
  }
}
