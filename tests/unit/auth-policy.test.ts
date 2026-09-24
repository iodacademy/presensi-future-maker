import { describe, it, expect } from 'vitest';
import { normalizeEmail, isValidRole, getEmailHash } from '../../src/features/auth/policy';

describe('Auth policy', () => {
  it('normalizes email by trimming and lowercasing without stripping plus tags', () => {
    expect(normalizeEmail('  Budi.Santoso+test@Gmail.com ')).toBe('budi.santoso+test@gmail.com');
    expect(normalizeEmail('Admin@PlanIndonesia.org')).toBe('admin@planindonesia.org');
  });

  it('validates allowed roles', () => {
    expect(isValidRole('admin')).toBe(true);
    expect(isValidRole('student')).toBe(true);
    expect(isValidRole('mentor')).toBe(true);
    expect(isValidRole('participant')).toBe(false);
    expect(isValidRole('other')).toBe(false);
    expect(isValidRole('')).toBe(false);
  });

  it('generates consistent sha256 hash for email index', () => {
    const hash1 = getEmailHash('budi@example.com');
    const hash2 = getEmailHash('budi@example.com');
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });
});
