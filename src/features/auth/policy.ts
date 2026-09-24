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
  return role === 'admin' || role === 'student' || role === 'mentor';
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
