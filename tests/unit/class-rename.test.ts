// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { formatCanonicalClassName, generateClassKey } from '../../src/features/classes/policy';

const script = readFileSync(resolve(process.cwd(), 'scripts/rename-class-city.ts'), 'utf-8');

describe('penamaan kelas', () => {
  it('kunci kelas mengikuti kota dan programnya', () => {
    expect(generateClassKey('Jakarta', 'Data Analyst')).toBe('jakarta_data analyst');
    expect(generateClassKey('DKI Jakarta', 'Data Analyst')).toBe('dki jakarta_data analyst');
  });

  it('mengubah kota berarti mengubah kuncinya juga', () => {
    // Kunci inilah yang menjaga keunikan Kota+Program. Mengubah kota tanpa
    // memperbarui kunci membuat dokumen kelas dan indeks keunikannya menunjuk
    // dua kombinasi berbeda.
    //
    // This key guards City+Program uniqueness. Changing the city without
    // updating the key leaves the class document and its uniqueness index
    // pointing at two different combinations.
    expect(generateClassKey('Jakarta', 'Data Analyst')).not.toBe(
      generateClassKey('DKI Jakarta', 'Data Analyst')
    );
  });

  it('nama kanonis ikut berubah bersama kotanya', () => {
    expect(formatCanonicalClassName('Data Analyst', 'DKI Jakarta')).toBe('Data Analyst - DKI Jakarta');
  });
});

describe('skrip rename-class-city', () => {
  it('memperbarui keempat tempat nama kota tersimpan', () => {
    for (const field of ['city:', 'canonicalName:', 'classKey:', "collection('classKeys')"]) {
      expect(script, field).toContain(field);
    }
  });

  it('menghapus entri classKeys yang lama', () => {
    // ID dokumen Firestore tidak dapat diubah, sehingga entri baru dibuat dan
    // yang lama dihapus. Bila yang lama tertinggal, kombinasi Kota+Program itu
    // terkunci selamanya.
    //
    // A Firestore document ID cannot be changed, so a new entry is created and
    // the old deleted. Left behind, that City+Program combination stays locked
    // forever.
    expect(script).toMatch(/tx\.delete\(db\.collection\('classKeys'\)\.doc\(cls\.classKey\)\)/);
  });

  it('menulis keempatnya dalam satu transaksi', () => {
    // Pembaruan yang terputus di tengah menyisakan kelas yang kuncinya tidak
    // cocok dengan indeksnya, dan kelas itu tidak dapat dibuat ulang maupun
    // diperbaiki lewat aplikasi.
    //
    // A half-finished update leaves a class whose key disagrees with its index,
    // and that class can neither be recreated nor repaired through the app.
    expect(script).toContain('runTransaction');
  });

  it('menolak bila kunci barunya sudah dipakai kelas lain', () => {
    expect(script).toMatch(/bentrok\.exists && bentrok\.data\(\)\?\.classId !== cls\.id/);
  });

  it('memerlukan --apply sebelum menulis', () => {
    expect(script).toMatch(/if \(!apply\) continue;/);
  });
});
