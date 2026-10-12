/**
 * Mengubah nomor WhatsApp Indonesia ke bentuk yang dipakai tautan wa.me
 * (kode negara tanpa "+" atau nol di depan), atau null bila tidak dapat dibaca.
 *
 * Converts an Indonesian WhatsApp number to the form wa.me links use (country
 * code with no "+" or leading zero), or null when it cannot be read.
 */
export function toWhatsAppNumber(phone: string | null | undefined): string | null {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (digits.startsWith('62')) return digits.length >= 10 ? digits : null;
  if (digits.startsWith('0')) return digits.length >= 10 ? `62${digits.slice(1)}` : null;
  if (digits.startsWith('8')) return digits.length >= 9 ? `62${digits}` : null;
  return null;
}

/** Tautan wa.me dengan pesan yang sudah terisi / A wa.me link with a prefilled message */
export function whatsAppLink(phone: string | null | undefined, message: string): string | null {
  const number = toWhatsAppNumber(phone);
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(message)}` : null;
}
