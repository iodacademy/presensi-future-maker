import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { updateClassMentors } from '@/features/classes/service';

// Endpoint ubah daftar mentor yang menangani sebuah kelas
// Endpoint to update the list of mentors handling a class
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ classId: string }> }
) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }

  const { classId } = await params;
  try {
    const body = await request.json();
    const mentorIds = Array.isArray(body.mentorIds) ? body.mentorIds : [];
    await updateClassMentors(actor, classId, mentorIds);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
