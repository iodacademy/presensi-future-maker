import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { getRoleRedirectPath } from '@/features/auth/paths';
import { ROLE_LABELS } from '@/features/auth/policy';
import { ACTIVE_PARTNER_COOKIE, ACTIVE_ROLE_COOKIE, SESSION_EXPIRES_DAYS } from '@/features/auth/constants';
import type { Role } from '@/features/auth/types';
import { asSignedIn } from '../../karier/guard';

/**
 * Peran akun yang sedang masuk, untuk pilihan peran di header. PIC beberapa
 * mitra mendapat satu pilihan per mitra.
 *
 * The signed-in account's roles, for the role picker in the header. A PIC of
 * several partners gets one choice per partner.
 */
export const GET = () => asSignedIn(async (actor) => {
  const roles = actor.roles ?? [actor.role];
  const partnerIds = actor.partnerIds ?? (actor.partnerId ? [actor.partnerId] : []);
  const names = new Map<string, string>();
  if (roles.includes('partner') && partnerIds.length > 1) {
    const docs = await Promise.all(partnerIds.map((id) => getAdminDb().collection('partners').doc(id).get()));
    docs.forEach((d) => names.set(d.id, String(d.get('name') ?? d.id)));
  }
  return {
    role: actor.role,
    ...(actor.role === 'partner' && actor.partnerId ? { partnerId: actor.partnerId } : {}),
    roles: roles.flatMap((role) => role === 'partner' && names.size > 1
      ? partnerIds.map((partnerId) => ({ role, partnerId, label: `${ROLE_LABELS.partner} · ${names.get(partnerId)}` }))
      : [{ role, label: ROLE_LABELS[role] }]),
  };
});

const cookie = (name: string, value: string) => ({
  name, value, maxAge: SESSION_EXPIRES_DAYS * 24 * 60 * 60, httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/',
});

/**
 * Beralih peran, dan mitra bagi PIC beberapa mitra. Pilihan hanya disimpan di
 * cookie; sesi membacanya ulang dan menolak peran atau mitra yang tidak
 * dimiliki akun, jadi cookie yang diubah tangan tidak memberi akses apa pun.
 *
 * Switches role, and partner for a PIC of several partners. The choice only
 * lives in a cookie; the session re-reads it and refuses a role or partner the
 * account lacks, so a hand-edited cookie grants nothing.
 */
export const POST = (request: Request) => asSignedIn(async (actor) => {
  const { role, partnerId } = (await request.json().catch(() => ({}))) as { role?: string; partnerId?: string };
  if (!role || !(actor.roles ?? [actor.role]).includes(role as Role)) throw new Error('Peran ini tidak dimiliki akunmu');
  if (partnerId && !(actor.partnerIds ?? []).includes(partnerId)) throw new Error('Mitra ini tidak dipegang akunmu');
  const res = NextResponse.json({ redirect: getRoleRedirectPath(role as Role) });
  res.cookies.set(cookie(ACTIVE_ROLE_COOKIE, role));
  if (partnerId) res.cookies.set(cookie(ACTIVE_PARTNER_COOKIE, partnerId));
  return res;
});
