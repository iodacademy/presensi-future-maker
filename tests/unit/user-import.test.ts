import { describe, it, expect } from 'vitest';
import {
  normalizeImportRow,
  validateImportRows,
  parseImportRole,
} from '../../src/features/users/import-policy';
import type { ImportRow } from '../../src/features/users/import-types';

describe('User Import Policy', () => {
  it('parses import role synonyms correctly', () => {
    expect(parseImportRole('student')).toBe('student');
    expect(parseImportRole('siswa')).toBe('student');
    expect(parseImportRole('peserta')).toBe('student');
    expect(parseImportRole('mentor')).toBe('mentor');
    // Peran berasal dari pilihan dialog, bukan isi berkas / The role comes from the dialog choice, not the file
    expect(parseImportRole('admin')).toBe('admin');
    expect(parseImportRole('unknown')).toBeNull();
  });

  it('normalizes row keys regardless of casing', () => {
    const raw = {
      Nama: 'Budi Santoso',
      EMAIL: 'budi@example.com',
      Role: 'Siswa',
      kELAS: 'Web Programming - Semarang',
    };
    const normalized = normalizeImportRow(raw);
    expect(normalized.name).toBe('Budi Santoso');
    expect(normalized.email).toBe('budi@example.com');
    expect(normalized.role).toBe('student');
    expect(normalized.className).toBe('Web Programming - Semarang');
  });

  it('flags errors and rejects batch if any row is invalid (all-or-nothing)', () => {
    const rows: ImportRow[] = [
      { name: 'Budi', email: 'budi@example.com', role: 'student', className: 'Web Programming - Semarang' },
      { name: 'Andi', email: 'invalid-email', role: 'student', className: 'Web Programming - Semarang' },
    ];
    const result = validateImportRows(rows, ['web programming - semarang']);
    expect(result.isValid).toBe(false);
    expect(result.rowErrors[1]).toBeDefined();
    expect(result.rowErrors[1].some((e) => e.includes('Email tidak valid'))).toBe(true);
  });

  it('flags duplicate email within the imported file', () => {
    const rows: ImportRow[] = [
      { name: 'User 1', email: 'duplicate@example.com', role: 'student', className: 'Web Programming - Semarang' },
      { name: 'User 2', email: 'DUPLICATE@example.com', role: 'student', className: 'Web Programming - Semarang' },
    ];
    const result = validateImportRows(rows, ['web programming - semarang']);
    expect(result.isValid).toBe(false);
    expect(result.rowErrors[1].some((e) => e.includes('Duplikat email'))).toBe(true);
  });

  it('flags unknown class name in global import', () => {
    const rows: ImportRow[] = [
      { name: 'User 1', email: 'user@example.com', role: 'student', className: 'Kelas Tidak Ada' },
    ];
    const result = validateImportRows(rows, ['web programming - semarang']);
    expect(result.isValid).toBe(false);
    expect(result.rowErrors[0].some((e) => e.includes('Kelas tidak ditemukan'))).toBe(true);
  });

  it('passes when all rows are valid and classes exist', () => {
    const rows: ImportRow[] = [
      { name: 'Budi', email: 'budi@example.com', role: 'student', className: 'Web Programming - Semarang' },
      { name: 'Rama', email: 'rama@example.com', role: 'mentor', className: 'Web Programming - Semarang' },
    ];
    const result = validateImportRows(rows, ['web programming - semarang']);
    expect(result.isValid).toBe(true);
    expect(Object.keys(result.rowErrors)).toHaveLength(0);
  });
});
