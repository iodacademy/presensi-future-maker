// Pisahkan penandatanganan Node dari kebijakan yang dipakai browser / Keep Node signing separate from policy used by the browser
import crypto from 'node:crypto';

export const QR_ROTATION_INTERVAL_MS = 30 * 1000;

export function generateQrToken(
  sessionId: string,
  revision: number,
  secret: string,
  nowMs: number = Date.now()
): string {
  const windowStart = Math.floor(nowMs / QR_ROTATION_INTERVAL_MS) * QR_ROTATION_INTERVAL_MS;
  const payload = `${sessionId}:${revision}:${windowStart}`;
  const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return Buffer.from(`${payload}:${hmac}`).toString('base64url');
}

export function verifyQrToken(
  token: string,
  sessionId: string,
  currentRevision: number,
  secret: string,
  nowMs: number = Date.now()
): { isValid: boolean; reason?: string } {
  try {
    const raw = Buffer.from(token, 'base64url').toString('utf-8');
    const parts = raw.split(':');
    if (parts.length !== 4) {
      return { isValid: false, reason: 'Format token QR tidak valid' };
    }

    const [tSessionId, tRevisionStr, tWindowStartStr, tHmac] = parts;
    const tRevision = parseInt(tRevisionStr, 10);
    const tWindowStart = parseInt(tWindowStartStr, 10);

    if (tSessionId !== sessionId) {
      return { isValid: false, reason: 'Token QR bukan untuk sesi ini' };
    }

    if (tRevision !== currentRevision) {
      return { isValid: false, reason: 'Revisi QR tidak cocok (presensi mungkin sudah di-refresh/ditutup)' };
    }

    const expectedPayload = `${tSessionId}:${tRevision}:${tWindowStart}`;
    const expectedHmac = crypto.createHmac('sha256', secret).update(expectedPayload).digest('hex');
    if (tHmac !== expectedHmac) {
      return { isValid: false, reason: 'Tanda tangan token QR tidak sah' };
    }

    // Pertahankan toleransi yang sudah ada; pemisahan modul tidak mengubah format token / Preserve existing grace; module separation does not change token format
    const tokenExpiry = tWindowStart + QR_ROTATION_INTERVAL_MS + 5000;
    if (nowMs > tokenExpiry) {
      return { isValid: false, reason: 'Token QR sudah kedaluwarsa. Silakan scan ulang kode QR terbaru.' };
    }

    return { isValid: true };
  } catch {
    return { isValid: false, reason: 'Gagal memproses token QR' };
  }
}

/**
 * Kode presensi statis sebuah sesi, misalnya "K7M2QX".
 *
 * Berbeda dari token berotasi: kode ini tetap selama revisinya tidak berubah,
 * sehingga QR-nya dapat difoto sekali lalu ditayangkan di layar sepanjang
 * sesi, dan kodenya cukup pendek untuk dibacakan atau diketik peserta saat
 * onboarding daring.
 *
 * Yang menjaganya tetap aman bukan perubahan kode, melainkan jendela presensi:
 * kode hanya berlaku selama admin membuka sesi, dan menutup sesi menaikkan
 * qrRevision sehingga seluruh kode lama mati seketika.
 *
 * A session's static attendance code, e.g. "K7M2QX".
 *
 * Unlike the rotating token this stays put while its revision holds, so its QR
 * can be photographed once and shown on screen for the whole session, and the
 * code itself is short enough to read out or type during remote onboarding.
 *
 * What keeps it safe is not rotation but the attendance window: the code only
 * works while an admin has the session open, and closing it raises qrRevision,
 * killing every old code at once.
 */

// Tanpa I, O, 0, 1: peserta membaca kode ini dari layar dan salah ketik satu
// huruf berarti presensi gagal.
//
// No I, O, 0, 1: participants read this off a screen and one mistyped
// character means a failed check-in.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

export function generateSessionCode(
  sessionId: string,
  revision: number,
  secret: string
): string {
  const digest = crypto
    .createHmac('sha256', secret)
    .update(`code:${sessionId}:${revision}`)
    .digest();

  let code = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += CODE_ALPHABET[digest[i] % CODE_ALPHABET.length];
  }
  return code;
}

/**
 * Memeriksa kode presensi yang diketik peserta.
 *
 * Dibandingkan dengan timingSafeEqual: membandingkan dengan === keluar pada
 * karakter pertama yang berbeda, sehingga lama pembandingan membocorkan berapa
 * banyak karakter awal yang sudah benar.
 *
 * Checks an attendance code typed by a participant.
 *
 * Compared with timingSafeEqual: comparing with === returns at the first
 * differing character, so how long the comparison takes leaks how many leading
 * characters were already right.
 */
export function isSessionCodeShaped(value: string): boolean {
  const typed = value.trim().toUpperCase().replace(/[\s-]/g, '');
  return typed.length === CODE_LENGTH && new RegExp(`^[${CODE_ALPHABET}]+$`).test(typed);
}

export function verifySessionCode(
  input: string,
  sessionId: string,
  currentRevision: number,
  secret: string
): { isValid: boolean; reason?: string } {
  const typed = input.trim().toUpperCase().replace(/[\s-]/g, '');
  if (typed.length !== CODE_LENGTH) {
    return { isValid: false, reason: `Kode presensi terdiri dari ${CODE_LENGTH} karakter` };
  }

  const expected = generateSessionCode(sessionId, currentRevision, secret);
  const a = Buffer.from(typed, 'utf-8');
  const b = Buffer.from(expected, 'utf-8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { isValid: false, reason: 'Kode presensi tidak cocok. Periksa kode yang ditampilkan admin.' };
  }

  return { isValid: true };
}
