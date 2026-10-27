import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { getWork, updateWork } from '@/features/exhibition/admin-works';

// Hanya admin / Admin only
async function isAdmin() {
  const actor = await getSessionActor();
  return !!actor && actor.role === 'admin';
}
const forbidden = () => NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return forbidden();
  try {
    const work = await getWork((await params).id);
    return work ? NextResponse.json({ work }) : NextResponse.json({ error: 'Karya tidak ditemukan' }, { status: 404 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return forbidden();
  try {
    await updateWork((await params).id, await request.json());
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
