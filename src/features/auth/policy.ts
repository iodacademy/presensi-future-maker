import crypto from 'crypto';
import type { Role } from './types';

/**
 * Melakukan normalisasi alamat email (trim dan lowercase).
 * Tidak menghapus titik atau tag plus.
 *
 * Normalizes email address (trim and lowercase).
 * Does not remove dots or plus tags.
 */
export function normalizeEmail(email: string): string {
  if (!email) return '';
  return email.trim().toLowerCase();
}

/**
 * Memvalidasi apakah role termasuk salah satu dari enum yang sah.
 *
 * Validates if the role is one of the valid enums.
 */
export function isValidRole(role: string): role is Role {
  return role === 'admin' || role === 'student' || role === 'mentor' || role === 'partner';
}

export const ROLE_LABELS: Record<Role, string> = { admin: 'Admin', mentor: 'Mentor', partner: 'PIC Mitra', student: 'Peserta' };

/**
 * Peran yang dimiliki akun: peran utama ditambah peran tambahan. Peran utama
 * tidak pernah berubah, sehingga kueri seperti daftar mentor tetap benar.
 *
 * The roles an account holds: the primary role plus extra roles. The primary
 * role never changes, so queries such as the mentor list stay correct.
 */
export function availableRoles(primary: Role, extra?: readonly string[] | null): Role[] {
  return [...new Set([primary, ...(extra ?? []).filter(isValidRole)])];
}

/** Peran yang sedang dipakai: pilihan pengguna bila akunnya memiliki peran itu / The role in use: the user's choice when the account holds it */
export function activeRole(primary: Role, extra: readonly string[] | null | undefined, requested?: string | null): Role {
  const all = availableRoles(primary, extra);
  return requested && (all as string[]).includes(requested) ? (requested as Role) : primary;
}

/** Mitra yang dipegang akun PIC: mitra utama ditambah mitra lain / The partners a PIC account holds: the primary partner plus others */
export function availablePartners(primary: string | null | undefined, extra?: readonly string[] | null): string[] {
  return [...new Set([primary, ...(extra ?? [])].filter((x): x is string => !!x))];
}

/** Mitra yang sedang dilihat: pilihan pengguna bila ia memegangnya / The partner in view: the user's choice when they hold it */
export function activePartner(primary: string | null | undefined, extra: readonly string[] | null | undefined, requested?: string | null): string | null {
  const all = availablePartners(primary, extra);
  return requested && all.includes(requested) ? requested : all[0] ?? null;
}

/**
 * Menghasilkan hash SHA-256 hex untuk index pencarian email unik di Firestore.
 *
 * Generates SHA-256 hex hash for unique email lookup index in Firestore.
 */
export function getEmailHash(email: string): string {
  const normalized = normalizeEmail(email);
  return crypto.createHash('sha256').update(normalized).digest('hex');
}
