import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { listSubmissionsForAdmin } from '@/features/tasks/submission-service';

export async function GET(request: Request) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const kind = searchParams.get('kind') as 'daily' | 'capstone' | null;
  const classId = searchParams.get('classId') || undefined;

  try {
    const submissions = await listSubmissionsForAdmin(actor, {
      kind: kind || undefined,
      classId,
    });
    return NextResponse.json({ submissions });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
