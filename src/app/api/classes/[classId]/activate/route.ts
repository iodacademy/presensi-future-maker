import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { activateClass } from '@/features/tasks/service';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ classId: string }> }
) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }

  const { classId } = await params;
  try {
    await activateClass(actor, classId);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
