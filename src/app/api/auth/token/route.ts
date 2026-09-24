import { NextResponse } from 'next/server';
import { createCustomTokenForEmail } from '@/features/auth/service';
import { checkRateLimit } from '@/lib/rate-limit';

// Endpoint publik pertukaran email ke custom token / Public endpoint to exchange email for custom token
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

  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email wajib diisi / Email is required' },
        { status: 400 }
      );
    }

    const result = await createCustomTokenForEmail(email);

    return NextResponse.json({
      customToken: result.customToken,
      role: result.role,
      name: result.name,
    });
  } catch (error) {
    // Pesan seragam supaya "email tidak terdaftar" dan "akun dinonaktifkan"
    // tidak bisa dibedakan dari luar; detailnya hanya masuk log server.
    //
    // Uniform message so "email not registered" and "account deactivated" are
    // indistinguishable from outside; the detail goes to the server log only.
    console.error('[auth/token]', error);
    return NextResponse.json(
      { error: 'Email tidak terdaftar atau tidak aktif. Hubungi admin bootcamp.' },
      { status: 401 }
    );
  }
}
