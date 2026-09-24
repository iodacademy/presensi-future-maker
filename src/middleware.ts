import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME } from './features/auth/constants';

// Middleware penjaga rute berbasis sesi / Route guard middleware based on session
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  const isProtectedPath =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/app') ||
    pathname.startsWith('/mentor');

  if (isProtectedPath && !sessionCookie) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('returnUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/app/:path*', '/mentor/:path*', '/login'],
};
