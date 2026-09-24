import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { recordStudentAttendance } from '@/features/attendance/service';

export async function POST(request: Request) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'student') {
    return NextResponse.json({ error: 'Hanya siswa yang diizinkan mencatat kehadiran' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const result = await recordStudentAttendance(actor, body.token, body.source || 'scan');
    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
