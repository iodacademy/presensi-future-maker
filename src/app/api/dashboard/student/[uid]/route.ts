import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { getStudentDetailForAdmin } from '@/features/dashboard/student-detail-service';

// Detail progres satu peserta untuk pencarian dashboard / One participant's progress for the dashboard search
export async function GET(_request: Request, { params }: { params: Promise<{ uid: string }> }) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }
  const { uid } = await params;
  try {
    return NextResponse.json(await getStudentDetailForAdmin(actor, uid));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 404 });
  }
}
