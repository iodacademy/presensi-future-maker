import { NextResponse } from 'next/server';
import { getRoleRedirectPath } from '@/features/auth/paths';
import { ROLE_LABELS } from '@/features/auth/policy';
import { ACTIVE_ROLE_COOKIE, SESSION_EXPIRES_DAYS } from '@/features/auth/constants';
import type { Role } from '@/features/auth/types';
import { asSignedIn } from '../../karier/guard';

/**
 * Peran akun yang sedang masuk, untuk pilihan peran di header.
 *
 * The signed-in account's roles, for the role picker in the header.
 */
export const GET = () => asSignedIn(async (actor) => ({
  role: actor.role,
  roles: (actor.roles ?? [actor.role]).map((role) => ({ role, label: ROLE_LABELS[role] })),
}));

/**
 * Beralih peran. Pilihan hanya disimpan di cookie; sesi membacanya ulang dan
 * menolak peran yang tidak dimiliki akun, jadi cookie yang diubah tangan tidak
 * memberi akses apa pun.
 *
 * Switches role. The choice only lives in a cookie; the session re-reads it and
 * refuses a role the account lacks, so a hand-edited cookie grants nothing.
 */
export const POST = (request: Request) => asSignedIn(async (actor) => {
  const { role } = (await request.json().catch(() => ({}))) as { role?: string };
  if (!role || !(actor.roles ?? [actor.role]).includes(role as Role)) throw new Error('Peran ini tidak dimiliki akunmu');
  const res = NextResponse.json({ redirect: getRoleRedirectPath(role as Role) });
  res.cookies.set({
    name: ACTIVE_ROLE_COOKIE, value: role, maxAge: SESSION_EXPIRES_DAYS * 24 * 60 * 60,
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/',
  });
  return res;
});
