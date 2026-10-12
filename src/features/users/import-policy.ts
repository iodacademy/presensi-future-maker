// Aturan dan validasi baris impor akun / User import row policy and validation
import type { Role } from '../auth/types';
import type { ImportRow, ValidatedImportRow, ImportPreviewResult } from './import-types';
import { normalizeEmail } from '../auth/policy';

/**
 * Mengurai sinonim peran dari dokumen spreadsheet.
 * Admin dilarang diimpor lewat file roster demi keamanan.
 *
 * Parses role synonyms from spreadsheet input.
 *
 * Admin dikenali karena dialog Tambah Akun mengirim peran pilihan admin, bukan
 * isi berkas. Sebelumnya 'admin' tidak dikenali dan jatuh menjadi peserta,
 * sehingga akun admin baru ditolak karena tidak berkelas dan tidak pernah
 * tersimpan.
 *
 * Admin is recognised because the Add Account dialog sends the role the admin
 * picked, not the file's contents. 'admin' used to be unrecognised and fell
 * back to participant, so a new admin account was rejected for having no class
 * and never saved.
 */
export function parseImportRole(roleStr?: string): Role | null {
  if (!roleStr) return null;
  const cleaned = roleStr.trim().toLowerCase();
  if (['student', 'siswa', 'peserta'].includes(cleaned)) {
    return 'student';
  }
  if (['mentor'].includes(cleaned)) {
    return 'mentor';
  }
  if (cleaned === 'admin') {
    return 'admin';
  }
  return null;
}

/**
 * Melakukan normalisasi kunci baris (case-insensitive headers).
 *
 * Normalizes row object keys (case-insensitive headers).
 */
export function normalizeImportRow(raw: Record<string, any>): ImportRow {
  const normalizedKeys: Record<string, any> = {};
  for (const [key, value] of Object.entries(raw)) {
    normalizedKeys[key.trim().toLowerCase()] = value;
  }

  const name = String(normalizedKeys['nama'] || normalizedKeys['name'] || '').trim();
  const email = normalizeEmail(String(normalizedKeys['email'] || ''));
  const roleRaw = String(normalizedKeys['role'] || normalizedKeys['peran'] || 'student');
  const role = parseImportRole(roleRaw) || 'student';
  const className = String(normalizedKeys['kelas'] || normalizedKeys['class'] || normalizedKeys['classname'] || '').trim();

  return { name, email, role, className };
}

/**
 * Memvalidasi seluruh baris impor terhadap aturan all-or-nothing:
 * - Format email
 * - Role harus student atau mentor
 * - Tidak boleh duplikat email di dalam file
 * - Kelas harus terdaftar di daftar kelas valid
 *
 * Validates all import rows against all-or-nothing rules.
 */
export function validateImportRows(
  rows: ImportRow[],
  validClassNamesNormalized: string[]
): { isValid: boolean; rowErrors: Record<number, string[]>; validatedRows: ValidatedImportRow[] } {
  const rowErrors: Record<number, string[]> = {};
  const seenEmails = new Set<string>();

  const validatedRows: ValidatedImportRow[] = rows.map((row, index) => {
    const rowNumber = index + 1;
    const errors: string[] = [];

    // 1. Validasi Nama / Validate Name
    if (!row.name) {
      errors.push('Nama wajib diisi');
    }

    // 2. Validasi Email / Validate Email
    const emailNorm = row.email ? row.email.trim().toLowerCase() : '';
    if (!emailNorm || !emailNorm.includes('@') || !emailNorm.includes('.')) {
      errors.push('Email tidak valid');
    } else if (seenEmails.has(emailNorm)) {
      errors.push(`Duplikat email dalam file: ${row.email}`);
    } else {
      seenEmails.add(emailNorm);
    }

    // 3. Validasi Role / Validate Role
    if (row.role !== 'student' && row.role !== 'mentor' && row.role !== 'admin') {
      errors.push('Role harus siswa, mentor, atau admin');
    }

    // 4. Validasi Kelas / Validate Class
    //
    // Admin tidak terikat kelas mana pun, sehingga mewajibkan kelas baginya
    // membuat akun admin mustahil dibuat sebelum ada satu pun kelas -- padahal
    // admin justru orang yang membuat kelasnya.
    //
    // An admin belongs to no class, so requiring one makes an admin account
    // impossible to create before any class exists -- although the admin is
    // precisely who creates the classes.
    const classNorm = row.className.trim().toLowerCase();
    if (row.role !== 'admin') {
      if (!classNorm) {
        errors.push('Nama kelas wajib diisi');
      } else if (!validClassNamesNormalized.includes(classNorm)) {
        errors.push(`Kelas tidak ditemukan: ${row.className}`);
      }
    }

    if (errors.length > 0) {
      rowErrors[index] = errors;
    }

    return {
      ...row,
      rowNumber,
      status: errors.length === 0 ? 'VALID' : 'DITOLAK',
      errors,
    };
  });

  const isValid = Object.keys(rowErrors).length === 0;

  return {
    isValid,
    rowErrors,
    validatedRows,
  };
}
