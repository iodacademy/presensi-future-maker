import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { listUsers, setUserActive } from '@/features/users/list-service';

// Daftar seluruh akun untuk panel admin / Full account listing for the admin panel
export async function GET() {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }

  try {
    return NextResponse.json(await listUsers(actor));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

// Mengubah status aktif sebuah akun / Changes an account's active status
export async function PATCH(request: Request) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }

  try {
    const body = await request.json();
    if (typeof body.uid !== 'string' || typeof body.active !== 'boolean') {
      return NextResponse.json({ error: 'uid dan active wajib disertakan' }, { status: 400 });
    }
    await setUserActive(actor, body.uid, body.active);
    return NextResponse.json({ updated: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
