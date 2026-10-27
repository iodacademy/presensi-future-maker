import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { getSiteContentAdmin, updateSiteContent } from '@/features/exhibition/admin-content';

// Hanya admin / Admin only
async function isAdmin() {
  const actor = await getSessionActor();
  return !!actor && actor.role === 'admin';
}
const forbidden = () => NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
const fail = (err: unknown) => NextResponse.json({ error: (err as Error).message }, { status: 400 });

export async function GET() {
  if (!(await isAdmin())) return forbidden();
  try {
    return NextResponse.json({ content: await getSiteContentAdmin() });
  } catch (err) {
    return fail(err);
  }
}

export async function PATCH(request: Request) {
  if (!(await isAdmin())) return forbidden();
  try {
    await updateSiteContent(await request.json());
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err);
  }
}
