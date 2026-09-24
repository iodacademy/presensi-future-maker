import { describe, expect, it } from 'vitest';
import { validateRecordingUrl } from '../../src/features/attendance/policy';

describe('validateRecordingUrl', () => {
  it('menerima tautan HTTPS', () => {
    expect(validateRecordingUrl('https://drive.google.com/file/d/abc/view')).toBe(
      'https://drive.google.com/file/d/abc/view'
    );
  });

  it('memangkas spasi di tepi', () => {
    expect(validateRecordingUrl('  https://youtu.be/abc  ')).toBe('https://youtu.be/abc');
  });

  it('memperlakukan nilai kosong sebagai penghapusan rekaman', () => {
    expect(validateRecordingUrl('')).toBeNull();
    expect(validateRecordingUrl('   ')).toBeNull();
    expect(validateRecordingUrl(null)).toBeNull();
    expect(validateRecordingUrl(undefined)).toBeNull();
  });

  it('menolak http karena peramban peserta akan memperingatkan konten tidak aman', () => {
    expect(() => validateRecordingUrl('http://drive.google.com/x')).toThrow(/HTTPS/);
  });

  it('menolak skema javascript yang akan dieksekusi di peramban peserta', () => {
    // Tautan ini dirender sebagai href pada halaman peserta; skema javascript:
    // berjalan di sesi mereka yang sedang login.
    //
    // This link is rendered as an href on the participant page; a javascript:
    // scheme would run inside their logged-in session.
    expect(() => validateRecordingUrl('javascript:alert(1)')).toThrow();
  });

  it('menolak teks yang bukan URL', () => {
    expect(() => validateRecordingUrl('rekaman sesi 3')).toThrow();
  });
});
