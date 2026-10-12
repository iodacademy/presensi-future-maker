import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { getMenteeProfile } from '@/features/mentoring/service';

// Profil peserta bagi mentor yang dibookingnya / A participant's profile for the mentor they booked
export async function GET(_request: Request, { params }: { params: Promise<{ studentId: string }> }) {
  const actor = await getSessionActor();
  if (!actor || (actor.role !== 'mentor' && actor.role !== 'admin')) {
    return NextResponse.json({ error: 'Hanya mentor atau admin yang diizinkan' }, { status: 403 });
  }
  const { studentId } = await params;
  try {
    return NextResponse.json({ profile: await getMenteeProfile(actor, studentId) });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 403 });
  }
}
