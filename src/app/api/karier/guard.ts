import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';

/**
 * Menjalankan aksi rute karier hanya untuk admin; galat validasi menjadi 400.
 *
 * Runs a careers route action for admins only; validation errors become 400.
 */
export async function asAdmin(action: () => Promise<unknown>): Promise<NextResponse> {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  try {
    const result = await action();
    return result instanceof NextResponse ? result : NextResponse.json(result ?? { ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export const notFound = (error: string) => NextResponse.json({ error }, { status: 404 });
