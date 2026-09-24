// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const service = readFileSync(resolve(process.cwd(), 'src/features/users/list-service.ts'), 'utf-8');
const route = readFileSync(resolve(process.cwd(), 'src/app/api/users/route.ts'), 'utf-8');
const modal = readFileSync(resolve(process.cwd(), 'src/app/(admin)/admin/akun/add-user-modal.tsx'), 'utf-8');

describe('listUsers', () => {
  it('membaca kelas sekali, bukan sekali per pengguna', () => {
    // Satu angkatan berisi puluhan peserta pada kelas yang sama; membaca
    // dokumen kelas per baris mengulang permintaan yang sama berkali-kali.
    //
    // A cohort holds dozens of participants in the same class; reading the
    // class document per row repeats the same request many times over.
    expect(service).toMatch(/Promise\.all\(\[/);
    expect(service).toMatch(/collection\('classes'\)\.select\(/);
    expect(service).toContain('new Map<string, string>()');
  });

  it('membatasi kolom yang dibaca', () => {
    // Dokumen pengguna memuat stempel waktu dan surel ternormalisasi yang tidak
    // pernah ditampilkan tabel ini.
    //
    // A user document carries timestamps and a normalised address this table
    // never shows.
    expect(service).toMatch(/\.select\('uid', 'name', 'email', 'role', 'active', 'classId'\)/);
  });

  it('menandai kelas yang sudah terhapus alih-alih menyembunyikannya', () => {
    // classId yang menunjuk kelas terhapus adalah keadaan yang perlu dibereskan
    // admin; menampilkannya seolah tanpa kelas menyembunyikan masalahnya.
    //
    // A classId pointing at a deleted class is a state an admin needs to fix;
    // showing it as having no class at all hides the problem.
    expect(service).toContain('(kelas terhapus)');
  });

  it('menuntut peran admin', () => {
    expect(service).toMatch(/listUsers[\s\S]{0,400}actor\.role !== 'admin'/);
  });
});

describe('setUserActive', () => {
  it('menolak admin menonaktifkan akunnya sendiri', () => {
    // Admin terakhir yang menonaktifkan dirinya sendiri mengunci seluruh panel
    // admin, dan pemulihannya hanya mungkin lewat skrip di luar aplikasi.
    //
    // The last admin deactivating themselves locks the entire admin panel, and
    // recovery is only possible through a script outside the application.
    expect(service).toMatch(/uid === actor\.uid && !active/);
  });

  it('mengubah field active, bukan menghapus dokumennya', () => {
    // Akun memuat pengumpulan tugas dan catatan kehadiran yang tidak punya
    // salinan lain; field active sudah diperiksa saat masuk dan pada tiap
    // pemeriksaan sesi.
    //
    // An account carries submissions and attendance records with no other copy;
    // the active field is already checked at sign-in and on every session check.
    expect(service).toMatch(/ref\.update\(\{ active/);
    expect(service).not.toMatch(/ref\.delete\(\)/);
  });
});

describe('endpoint /api/users', () => {
  it('menolak yang bukan admin pada kedua metode', () => {
    const guards = route.match(/actor\.role !== 'admin'/g) ?? [];
    expect(guards.length).toBe(2);
  });

  it('memeriksa bentuk masukan sebelum menulis', () => {
    expect(route).toMatch(/typeof body\.uid !== 'string' \|\| typeof body\.active !== 'boolean'/);
  });
});

describe('dialog tambah akun', () => {
  it('memakai ulang endpoint impor untuk satu akun maupun banyak', () => {
    // Pemeriksaan surel ganda, pencocokan kelas, dan pembaruan penghitung kelas
    // sudah lengkap di sana; jalur kedua akan membuat dua aturan yang harus
    // dijaga tetap sama.
    //
    // Duplicate-address checks, class matching, and class counter updates are
    // already complete there; a second path would create two sets of rules to
    // keep in step.
    expect(modal).toContain('/api/users/import/preview');
    expect(modal).toContain('/api/users/import/commit');
    expect(modal).not.toMatch(/collection\('users'\)/);
  });

  it('memaksakan peran dan kelas dari pilihan dialog, bukan isi berkas', () => {
    // Berkas yang disusun orang lain kerap memuat kolom peran yang salah eja
    // atau kosong, sedangkan admin sudah menyatakan keduanya di dialog.
    //
    // A file assembled by someone else often carries a misspelt or empty role
    // column, while the admin has already stated both in the dialog.
    expect(modal).toMatch(/rows\.map\(\(r\) => \(\{ \.\.\.r, role, kelas: className \}\)\)/);
  });

  it('hanya menawarkan peran peserta dan mentor', () => {
    // Admin pertama dibuat lewat skrip bootstrap; membuatnya dari antarmuka
    // akan menjadi jalur peningkatan hak yang tidak diawasi.
    //
    // The first admin is created through the bootstrap script; creating one
    // from the UI would be an unsupervised privilege-escalation path.
    expect(modal).toContain("Extract<Role, 'student' | 'mentor'>");
  });

  it('menahan tombol simpan sampai pratinjau dinyatakan sah', () => {
    expect(modal).toMatch(/disabled=\{!preview\?\.isValid \|\| submitting\}/);
  });
});
