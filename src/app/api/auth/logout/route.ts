import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAdminAuth } from '@/lib/firebase/admin';
import { SESSION_COOKIE_NAME } from '@/features/auth/session';
import { ACTIVE_ROLE_COOKIE } from '@/features/auth/constants';

// Endpoint logout dan pencabutan sesi / Logout and session revocation endpoint
export async function POST() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (sessionCookie) {
    try {
      const auth = getAdminAuth();
      const decodedClaims = await auth.verifySessionCookie(sessionCookie, false);
      // Cabut semua refresh token user / Revoke all user refresh tokens
      await auth.revokeRefreshTokens(decodedClaims.uid);
    } catch (e) {
      // Abaikan jika cookie sudah invalid / Ignore if cookie is already invalid
    }
  }

  const response = NextResponse.json({ success: true });
  response.cookies.delete(SESSION_COOKIE_NAME);
  response.cookies.delete(ACTIVE_ROLE_COOKIE);
  return response;
}
