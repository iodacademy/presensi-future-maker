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
