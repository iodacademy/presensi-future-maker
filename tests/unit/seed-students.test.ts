// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { normalizeEmail, getEmailHash } from '../../src/features/auth/policy';

const script = readFileSync(resolve(process.cwd(), 'scripts/seed-students.ts'), 'utf-8');

/**
 * Daftar peserta diurai dari sumbernya agar uji di bawah memeriksa data yang
 * benar-benar akan ditulis, bukan salinan yang dapat melenceng.
 *
 * The participant list is parsed from the source so the checks below test the
 * data that will actually be written, not a copy that can drift.
 */
function parseStudents(): { name: string; email: string }[] {
  return [...script.matchAll(/\{ name: '([^']+)', email: '([^']+)' \}/g)].map((m) => ({
    name: m[1],
    email: m[2],
  }));
}

describe('daftar peserta', () => {
  const students = parseStudents();

  it('memuat 19 peserta', () => {
    expect(students).toHaveLength(19);
  });

  it('tidak ada surel ganda', () => {
    // Surel ganda membuat entri indeks kedua menimpa yang pertama, sehingga
    // satu peserta kehilangan akunnya tanpa gejala apa pun.
    //
    // A duplicate address has the second index entry overwrite the first, so
    // one participant silently loses their account.
    const keys = students.map((s) => normalizeEmail(s.email));
    const dup = keys.filter((k, i) => keys.indexOf(k) !== i);
    expect(dup, `surel ganda: ${dup.join(', ')}`).toHaveLength(0);
  });

  it('menghasilkan hash indeks yang berbeda satu sama lain', () => {
    const hashes = students.map((s) => getEmailHash(s.email));
    expect(new Set(hashes).size).toBe(students.length);
  });

  it('setiap nama dan surel terisi', () => {
    for (const s of students) {
      expect(s.name.trim().length, s.email).toBeGreaterThan(2);
      expect(s.email).toMatch(/^[^@\s]+@[^@\s]+\.[^@\s]+$/);
    }
  });

  it('tidak ada nama ganda', () => {
    // Nama ganda bukan galat teknis, tetapi biasanya menandakan satu baris
    // tersalin dua kali saat menyusun daftar.
    //
    // A duplicate name is no technical error, but usually signals a row copied
    // twice while assembling the list.
    const names = students.map((s) => s.name.toLowerCase());
    const dup = names.filter((n, i) => names.indexOf(n) !== i);
    expect(dup, `nama ganda: ${dup.join(', ')}`).toHaveLength(0);
  });
});

describe('skrip seed peserta', () => {
  it('memeriksa surel ganda sebelum menulis apa pun', () => {
    expect(script).toContain('duplicates');
    expect(script).toMatch(/\[BATAL\]/);
  });

  it('menulis entri emailIndex untuk tiap peserta baru', () => {
    // emailIndex adalah satu-satunya jalur login; akun tanpa entri ini tampak
    // ada di daftar pengguna tetapi ditolak saat masuk.
    //
    // emailIndex is the only login path; an account without this entry appears
    // in the user list but is refused at sign-in.
    expect(script).toMatch(/batch\.set\(db\.collection\('emailIndex'\)/);
  });

  it('memakai ulang akun yang surelnya sudah terdaftar', () => {
    expect(script).toContain('indexDoc.exists');
  });

  it('menghitung ulang studentCount dari koleksi, bukan menambahkannya', () => {
    // Menambahkan sebanyak peserta baru akan membawa serta penyimpangan yang
    // sudah ada, sehingga kartu kelas menampilkan jumlah yang keliru.
    //
    // Incrementing by the number of new participants carries any existing
    // drift forward, so the class card shows the wrong number.
    expect(script).toMatch(/\.count\(\)/);
    expect(script).toMatch(/studentCount: total/);
  });

  it('mengikat peserta ke classId kelasnya', () => {
    // Berbeda dari mentor: peserta hanya berada di satu kelas, dan dasbor serta
    // pengumpulan tugasnya membaca field ini.
    //
    // Unlike a mentor, a participant belongs to one class, and both the
    // dashboard and task submission read this field.
    expect(script).toMatch(/classId: cls\.id/);
  });

  it('memecah penulisan agar tidak melampaui batas batch', () => {
    expect(script).toMatch(/BATCH_LIMIT/);
    expect(script).toMatch(/i \+= BATCH_LIMIT/);
  });

  it('memerlukan --apply sebelum menulis', () => {
    expect(script).toMatch(/if \(apply && pending\.length > 0\)/);
  });
});
