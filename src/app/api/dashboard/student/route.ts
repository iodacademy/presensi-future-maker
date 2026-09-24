import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { getStudentHomeDashboard } from '@/features/dashboard/service';

export async function GET() {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'student') {
    return NextResponse.json({ error: 'Hanya siswa yang diizinkan' }, { status: 403 });
  }

  try {
    const data = await getStudentHomeDashboard(actor);
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
