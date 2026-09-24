import { describe, it, expect } from 'vitest';
import {
  formatCanonicalClassName,
  generateClassKey,
  validateClassInput,
} from '../../src/features/classes/policy';

describe('Classes policy', () => {
  it('formats canonical class name as Program - Kota', () => {
    expect(formatCanonicalClassName('Web Programming', 'Semarang')).toBe('Web Programming - Semarang');
    expect(formatCanonicalClassName('  Data Analyst ', ' Jakarta ')).toBe('Data Analyst - Jakarta');
  });

  it('generates consistent normalized class key for uniqueness', () => {
    const key1 = generateClassKey('Semarang', 'Web Programming');
    const key2 = generateClassKey('semarang', 'web programming');
    const key3 = generateClassKey('  SEMARANG  ', '  Web Programming  ');
    expect(key1).toBe('semarang_web programming');
    expect(key1).toBe(key2);
    expect(key1).toBe(key3);
  });

  it('allows same program name in different cities', () => {
    const keySmg = generateClassKey('Semarang', 'Web Programming');
    const keySby = generateClassKey('Surabaya', 'Web Programming');
    expect(keySmg).not.toBe(keySby);
  });

  it('validates class input fields', () => {
    expect(() => validateClassInput({ city: '', programName: 'React' })).toThrowError(/Kota dan Nama Kelas wajib diisi/);
    expect(() => validateClassInput({ city: 'Jakarta', programName: '' })).toThrowError(/Kota dan Nama Kelas wajib diisi/);
    const valid = validateClassInput({ city: 'Jakarta', programName: 'Web Development' });
    expect(valid.city).toBe('Jakarta');
    expect(valid.programName).toBe('Web Development');
  });
});
