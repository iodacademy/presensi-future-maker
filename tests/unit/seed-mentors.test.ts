// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { normalizeEmail, getEmailHash } from '../../src/features/auth/policy';

const script = readFileSync(resolve(process.cwd(), 'scripts/seed-mentors.ts'), 'utf-8');

describe('skrip seed mentor', () => {
  it('menulis entri emailIndex untuk tiap mentor baru', () => {
    // emailIndex adalah satu-satunya jalur login. Akun yang dibuat tanpa entri
    // ini tampak ada di daftar pengguna tetapi ditolak saat masuk, dengan pesan
    // yang menyatakan surelnya tidak terdaftar.
    //
    // emailIndex is the only login path. An account created without this entry
    // appears in the user list but is refused at sign-in, with a message saying
    // the address is not registered.
    expect(script).toContain('batch.set(indexRef');
    expect(script).toContain("collection('users').doc(uid)");
  });

  it('memakai ulang akun yang surelnya sudah terdaftar', () => {
    // Membuat uid baru untuk surel yang sama membuat indeks menunjuk salah satu
    // saja, sehingga akun lain beserta riwayatnya tidak terjangkau.
    //
    // Minting a new uid for the same address leaves the index pointing at one
    // of them, so the other account and its history become unreachable.
    expect(script).toContain('indexDoc.exists');
    expect(script).toMatch(/mentorUids\.push\(uid\)/);
  });

  it('menggabungkan mentorIds, bukan menimpanya', () => {
    // Menimpa daftar akan melepaskan mentor yang sudah ditugaskan sebelumnya
    // tanpa peringatan apa pun.
    //
    // Overwriting the list would drop previously assigned mentors with no
    // warning at all.
    expect(script).toMatch(/new Set\(\[\.\.\.\(cls\.mentorIds \|\| \[\]\), \.\.\.mentorUids\]\)/);
  });

  it('menyelaraskan mentorCount dengan panjang mentorIds', () => {
    // Keduanya dibaca terpisah di antarmuka; angka yang berbeda dari isinya
    // membuat kartu kelas menampilkan jumlah mentor yang keliru.
    //
    // Both are read separately in the UI; a count that disagrees with the list
    // makes the class card show the wrong number of mentors.
    expect(script).toMatch(/mentorCount: merged\.length/);
  });

  it('membiarkan classId mentor kosong', () => {
    // Keanggotaan mentor tercatat pada mentorIds di dokumen kelas, sebab satu
    // mentor dapat menangani lebih dari satu kelas.
    //
    // Mentor membership lives in mentorIds on the class document, since one
    // mentor may handle more than one class.
    expect(script).toMatch(/classId: null/);
  });

  it('memerlukan --apply sebelum menulis', () => {
    expect(script).toMatch(/if \(!apply\) continue;/);
  });
});

describe('alamat surel mentor', () => {
  const emails = ['wahyucandratama@gmail.com', 'michwirja@gmail.com', 'imam.mct34@gmail.com'];

  it('seluruhnya tercantum pada skrip', () => {
    for (const email of emails) {
      expect(script, email).toContain(email);
    }
  });

  it('menghasilkan hash indeks yang berbeda satu sama lain', () => {
    // Hash yang bertabrakan akan membuat satu mentor menimpa entri mentor lain.
    // Colliding hashes would have one mentor overwrite another's entry.
    const hashes = emails.map((e) => getEmailHash(e));
    expect(new Set(hashes).size).toBe(emails.length);
  });

  it('tidak berubah oleh perbedaan huruf besar-kecil', () => {
    expect(normalizeEmail('  Imam.MCT34@Gmail.com ')).toBe('imam.mct34@gmail.com');
    expect(getEmailHash('IMAM.MCT34@GMAIL.COM')).toBe(getEmailHash('imam.mct34@gmail.com'));
  });

  it('memperlakukan titik sebagai bagian alamat', () => {
    // Gmail menganggap a.b@ dan ab@ satu kotak surat, penyelenggara lain tidak.
    // Menyamakannya akan menggabungkan dua orang berbeda ke satu akun.
    //
    // Gmail treats a.b@ and ab@ as one mailbox, other providers do not.
    // Normalising them together would merge two different people into one
    // account.
    expect(getEmailHash('imam.mct34@gmail.com')).not.toBe(getEmailHash('imammct34@gmail.com'));
  });
});
