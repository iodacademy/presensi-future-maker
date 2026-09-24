import { describe, expect, it } from 'vitest';
import { extractToken } from '../../src/app/(student)/app/presensi/scan/qr-camera';

describe('extractToken', () => {
  it('mengambil token dari URL lengkap hasil scan QR', () => {
    expect(extractToken('https://bootcamp.example.id/presensi?token=abc123')).toBe('abc123');
  });

  it('menerima token telanjang dari input manual', () => {
    expect(extractToken('  abc123  ')).toBe('abc123');
  });

  it('mengambil token dari path relatif tanpa origin', () => {
    expect(extractToken('/presensi?token=abc123')).toBe('abc123');
  });

  it('mengembalikan null untuk masukan kosong', () => {
    expect(extractToken('   ')).toBeNull();
  });
});
