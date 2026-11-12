// Konstanta sesi autentikasi / Authentication session constants
export const SESSION_COOKIE_NAME = '__session';
export const SESSION_EXPIRES_DAYS = 5;
export const SESSION_EXPIRES_MS = SESSION_EXPIRES_DAYS * 24 * 60 * 60 * 1000;
/** Peran yang dipilih akun berperan ganda / The role chosen by a multi-role account */
export const ACTIVE_ROLE_COOKIE = '__peran';
/** Mitra yang dipilih PIC beberapa mitra / The partner chosen by a PIC of several partners */
export const ACTIVE_PARTNER_COOKIE = '__mitra';
