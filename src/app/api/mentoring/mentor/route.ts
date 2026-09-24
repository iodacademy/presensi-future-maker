import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { listMentorSchedule } from '@/features/mentoring/service';

export async function GET() {
  const actor = await getSessionActor();
  if (!actor || (actor.role !== 'mentor' && actor.role !== 'admin')) {
    return NextResponse.json({ error: 'Hanya mentor atau admin yang diizinkan' }, { status: 403 });
  }

  try {
    const slots = await listMentorSchedule(actor);
    return NextResponse.json({ slots });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
