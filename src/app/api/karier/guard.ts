import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import type { Actor, Role } from '@/features/auth/types';

/**
 * Menjalankan aksi rute karier bila peran pemanggil diizinkan; galat validasi menjadi 400.
 *
 * Runs a careers route action when the caller's role is allowed; validation errors become 400.
 */
async function as(roles: Role[] | null, denied: string, action: (actor: Actor) => Promise<unknown>): Promise<NextResponse> {
  const actor = await getSessionActor();
  if (!actor) return NextResponse.json({ error: 'Masuk terlebih dahulu' }, { status: roles ? 403 : 401 });
  if (roles && !roles.includes(actor.role)) return NextResponse.json({ error: denied }, { status: 403 });
  try {
    const result = await action(actor);
    return result instanceof NextResponse ? result : NextResponse.json(result ?? { ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export const asAdmin = (action: (actor: Actor) => Promise<unknown>) => as(['admin'], 'Hanya admin yang diizinkan', action);
export const asStudent = (action: (actor: Actor) => Promise<unknown>) => as(['student'], 'Hanya peserta yang diizinkan', action);
export const asSignedIn = (action: (actor: Actor) => Promise<unknown>) => as(null, '', action);

export const notFound = (error: string) => NextResponse.json({ error }, { status: 404 });
