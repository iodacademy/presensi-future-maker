import { describe, expect, it } from 'vitest';
import { normalizeEmail, getEmailHash } from '../../src/features/auth/policy';

/**
 * Skrip perbaikan indeks menghitung ulang hash email dan harus menghasilkan ID
 * dokumen yang persis sama dengan yang dicari saat login. Bila keduanya
 * berbeda, perbaikan akan menulis entri di alamat yang tidak pernah dibaca dan
 * login tetap gagal tanpa pesan yang menjelaskan apa pun.
 *
 * The index repair script recomputes the email hash and must produce exactly
 * the document ID that login looks up. If the two diverge, the repair writes
 * entries at an address nothing ever reads and login keeps failing with no
 * message that explains anything.
 */
describe('emailIndex addressing', () => {
  it('menghasilkan hash yang sama untuk email dengan huruf dan spasi berbeda', () => {
    const variants = ['Admin@IODacademy.ID', '  admin@iodacademy.id  ', 'admin@iodacademy.id'];
    const hashes = variants.map((v) => getEmailHash(v));
    expect(new Set(hashes).size).toBe(1);
  });

  it('memberi hash berbeda untuk email berbeda', () => {
    expect(getEmailHash('a@example.id')).not.toBe(getEmailHash('b@example.id'));
  });

  it('menghasilkan ID dokumen Firestore yang sah', () => {
    const hash = getEmailHash('admin@iodacademy.id');
    // ID dokumen Firestore tidak boleh memuat garis miring dan dibatasi 1500 byte.
    // Firestore document IDs may not contain slashes and are capped at 1500 bytes.
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain('/');
  });

  it('tidak menghapus titik atau tag plus', () => {
    // Gmail memperlakukan a.b@ dan ab@ sebagai kotak surat yang sama, tetapi
    // penyelenggara lain tidak. Menyamakannya akan menggabungkan dua orang
    // berbeda ke dalam satu akun.
    //
    // Gmail treats a.b@ and ab@ as the same mailbox, but other providers do
    // not. Normalising them together would merge two different people into one
    // account.
    expect(normalizeEmail('a.b@example.id')).toBe('a.b@example.id');
    expect(getEmailHash('a.b@example.id')).not.toBe(getEmailHash('ab@example.id'));
    expect(getEmailHash('a+tag@example.id')).not.toBe(getEmailHash('a@example.id'));
  });
});
