import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { updatePerson } from '@/features/exhibition/admin-content';

// Hanya admin / Admin only
async function isAdmin() {
  const actor = await getSessionActor();
  return !!actor && actor.role === 'admin';
}
const forbidden = () => NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
const fail = (err: unknown) => NextResponse.json({ error: (err as Error).message }, { status: 400 });

export async function PATCH(request: Request, { params }: { params: Promise<{ uid: string }> }) {
  if (!(await isAdmin())) return forbidden();
  try {
    await updatePerson((await params).uid, await request.json());
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err);
  }
}
