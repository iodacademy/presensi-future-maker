import { NextResponse } from 'next/server';
import { createCustomTokenForEmail } from '@/features/auth/service';
import {
  createSessionCookieFromCustomToken,
  SESSION_COOKIE_NAME,
  SESSION_EXPIRES_DAYS,
} from '@/features/auth/session';
import { checkRateLimit } from '@/lib/rate-limit';

/**
 * Masuk dengan email, dalam satu permintaan.
 *
 * Email ditukar menjadi custom token, custom token menjadi ID token, lalu ID
 * token menjadi session cookie -- seluruhnya di server. Peramban peserta hanya
 * berbicara dengan situs kita, sehingga jaringan yang memblokir server Google
 * tidak lagi dapat menggagalkan login.
 *
 * Custom token-nya tidak pernah dikirim ke peramban. Token itu adalah
 * kredensial; endpoint lama menyerahkannya kepada siapa pun yang mengetik email
 * terdaftar.
 *
 * Signs in by email, in a single request.
 *
 * The email becomes a custom token, the custom token an ID token, and the ID token
 * a session cookie -- all on the server. The participant's browser only talks to
 * our site, so a network blocking Google's servers can no longer fail the login.
 *
 * The custom token is never sent to the browser. It is a credential; the old
 * endpoint handed it to anyone who typed a registered email.
 */
export async function POST(request: Request) {
  // Email adalah satu-satunya kredensial di sistem ini, jadi endpoint ini adalah
  // seluruh permukaan serangan login. Tanpa pembatasan, penyerang bisa menebak
  // alamat tanpa batas.
  //
  // Email is the only credential in this system, so this endpoint is the entire
  // login attack surface. Without a limit an attacker can guess addresses
  // indefinitely.
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  if (!checkRateLimit(`auth:${ip}`, 10, 60_000)) {
    return NextResponse.json(
      { error: 'Terlalu banyak percobaan masuk. Coba lagi dalam satu menit.' },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const email = (body as { email?: unknown }).email;
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Email wajib diisi' }, { status: 400 });
  }

  let token: Awaited<ReturnType<typeof createCustomTokenForEmail>>;
  try {
    token = await createCustomTokenForEmail(email);
  } catch (error) {
    // Pesan seragam supaya "email tidak terdaftar" dan "akun dinonaktifkan"
    // tidak bisa dibedakan dari luar; detailnya hanya masuk log server.
    //
    // Uniform message so "email not registered" and "account deactivated" are
    // indistinguishable from outside; the detail goes to the server log only.
    console.error('[auth/login] token', error);
    return NextResponse.json(
      { error: 'Email tidak terdaftar atau tidak aktif. Hubungi admin bootcamp.' },
      { status: 401 }
    );
  }

  let sessionCookie: string;
  try {
    sessionCookie = await createSessionCookieFromCustomToken(token.customToken);
  } catch (error) {
    // Kegagalan di sini milik server, bukan email peserta. Menyebutnya "email
    // tidak terdaftar" membuat peserta mengetik ulang alamat yang sudah benar.
    //
    // A failure here belongs to the server, not the participant's email. Calling
    // it "email not registered" would have them retype an address that was right.
    console.error('[auth/login] sesi', error);
    return NextResponse.json(
      { error: 'Layanan masuk sedang bermasalah. Coba lagi beberapa saat lagi.' },
      { status: 502 }
    );
  }

  const response = NextResponse.json({ role: token.role, name: token.name });
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: sessionCookie,
    maxAge: SESSION_EXPIRES_DAYS * 24 * 60 * 60,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
  return response;
}
