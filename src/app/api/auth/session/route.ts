import { NextResponse } from 'next/server';
import {
  createSessionCookieFromIdToken,
  SESSION_COOKIE_NAME,
  SESSION_EXPIRES_DAYS,
} from '@/features/auth/session';

// Endpoint pertukaran ID token ke session cookie HttpOnly
// Endpoint to exchange client ID token for HttpOnly session cookie
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { idToken } = body;

    if (!idToken || typeof idToken !== 'string') {
      return NextResponse.json(
        { error: 'ID token wajib disertakan / ID token is required' },
        { status: 400 }
      );
    }

    const sessionCookie = await createSessionCookieFromIdToken(idToken);

    const isProd = process.env.NODE_ENV === 'production';
    const response = NextResponse.json({ success: true });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: sessionCookie,
      maxAge: SESSION_EXPIRES_DAYS * 24 * 60 * 60,
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Gagal membuat sesi / Failed to create session' },
      { status: 401 }
    );
  }
}
