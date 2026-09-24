import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { listAvailableMentors } from '@/features/classes/service';

// Endpoint daftar mentor aktif untuk multi-select saat membuat kelas (Frame A2)
// Active mentors list endpoint for multi-select when creating a class (Frame A2)
export async function GET() {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }

  try {
    const mentors = await listAvailableMentors();
    return NextResponse.json({ mentors });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
