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
    expect(service).toMatch(/\.select\('uid', 'name', 'email', 'role', 'active', 'classId', 'isTest'\)/);
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
    // active kini opsional: badan tanpa active berarti penyuntingan akun,
    // bukan sakelar aktif. Yang tetap wajib hanyalah uid.
    //
    // active is now optional: a body without it means an account edit rather
    // than the active switch. Only uid stays required.
    expect(route).toMatch(/typeof body\.uid !== 'string'/);
    expect(route).toMatch(/if \(typeof body\.active === 'boolean'\)/);
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

  it('menawarkan ketiga peran, termasuk admin', () => {
    // Tanpa jalur ini, admin baru hanya dapat dibuat lewat skrip bootstrap di
    // mesin pengembang, dan satu-satunya admin yang kehilangan aksesnya tidak
    // punya jalan kembali.
    //
    // Without this path a new admin can only be made through the bootstrap
    // script on a developer machine, and the only admin who loses access has
    // no way back.
    expect(modal).toContain("'admin', 'Admin'");
  });

  it('menyebutkan kuasa admin sebelum akunnya dibuat', () => {
    // Admin yang dibuat di sini memegang kuasa yang sama dengan yang
    // membuatnya, termasuk membuat admin berikutnya dan menonaktifkan akun
    // siapa pun. Menyebutkannya di muka lebih baik daripada membiarkannya
    // ditemukan belakangan.
    //
    // An admin created here holds the same powers as whoever created them,
    // including making further admins and deactivating anyone's account.
    // Saying so up front beats leaving it to be discovered later.
    expect(modal).toContain('Admin memegang kuasa penuh');
  });

  it('melewati pemilihan kelas bagi admin', () => {
    // Admin tidak terikat kelas mana pun; dibiarkan, tombol lanjutnya mati
    // menunggu kelas yang tidak pernah relevan baginya -- termasuk sebelum
    // ada satu pun kelas dibuat.
    //
    // An admin belongs to no class; left in place, the continue button stays
    // dead waiting for a class that never applies -- including before any
    // class exists at all.
    expect(modal).toMatch(/role !== 'admin' && \(/);
    const policy = readFileSync(
      resolve(process.cwd(), 'src/features/users/import-policy.ts'),
      'utf-8'
    );
    expect(policy).toMatch(/if \(row\.role !== 'admin'\) \{/);
  });

  it('menahan tombol simpan sampai pratinjau dinyatakan sah', () => {
    expect(modal).toMatch(/disabled=\{!preview\?\.isValid \|\| submitting\}/);
  });
});
