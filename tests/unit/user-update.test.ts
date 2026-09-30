// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getEmailHash, normalizeEmail } from '@/features/auth/policy';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf-8');
const service = read('src/features/users/list-service.ts');
const modal = read('src/app/(admin)/admin/akun/edit-user-modal.tsx');
const route = read('src/app/api/users/route.ts');

const body = service.slice(
  service.indexOf('export async function updateUserAccount'),
  service.length
);

/**
 * Surel disimpan pada dokumen pengguna sekaligus sebagai kunci dokumen
 * emailIndex, yang dinamai menurut hash surelnya.
 *
 * Mengganti surel berarti memindahkan dokumen indeks itu, bukan menyuntingnya:
 * kuncinya berubah karena hash-nya berubah.
 *
 * The email lives on the user document and doubles as the key of an emailIndex
 * document, named after the email's hash.
 *
 * Changing the email means moving that index document rather than editing it:
 * its key changes because its hash changes.
 */
describe('mengganti surel memindahkan indeksnya', () => {
  it('surel berbeda menghasilkan kunci indeks berbeda', () => {
    // Inti persoalannya: dokumen indeks tidak dapat disunting di tempat.
    // The crux: the index document cannot be edited in place.
    expect(getEmailHash('lama@contoh.id')).not.toBe(getEmailHash('baru@contoh.id'));
  });

  it('huruf besar-kecil tidak membuat indeks kedua', () => {
    // Tanpa penormalan, "Budi@..." dan "budi@..." menjadi dua akun berbeda.
    // Without normalising, "Budi@..." and "budi@..." become two accounts.
    expect(getEmailHash('Budi@Contoh.ID')).toBe(getEmailHash('budi@contoh.id'));
    expect(normalizeEmail('  Budi@Contoh.ID ')).toBe('budi@contoh.id');
  });

  it('menghapus indeks lama dan menulis yang baru', () => {
    // Indeks lama yang tertinggal membuat surel lama tetap membuka akun ini.
    // A stale index would leave the old address still opening this account.
    expect(body).toMatch(/batch\.delete\(db\.collection\('emailIndex'\)\.doc\(oldHash\)\)/);
    expect(body).toMatch(/batch\.set\(db\.collection\('emailIndex'\)\.doc\(newHash\)/);
  });

  it('menolak surel yang sudah dipakai akun lain', () => {
    // Surel adalah satu-satunya cara masuk; dua akun berbagi satu surel
    // berarti dua akun berebut satu identitas.
    //
    // The email is the only way in; two accounts sharing one means two
    // accounts contesting a single identity.
    expect(body).toContain('sudah dipakai akun lain');
    expect(body).toMatch(/bentrok\.data\(\)\?\.uid !== uid/);
  });

  it('tidak menyentuh indeks bila surelnya tidak berubah', () => {
    // Menulis ulang indeks yang sama hanya menambah risiko tanpa hasil.
    // Rewriting an unchanged index only adds risk for nothing.
    expect(body).toMatch(/if \(email !== normalizeEmail\(user\.email\)\)/);
  });

  it('hanya untuk admin', () => {
    expect(body).toContain("actor.role !== 'admin'");
  });
});

describe('pindah kelas merapikan jejaknya', () => {
  it('menyesuaikan studentCount kedua kelas', () => {
    // studentCount adalah pembagi pada rekap kehadiran dan pengumpulan;
    // dibiarkan, kelas asal tampak kekurangan peserta selamanya.
    //
    // studentCount is the divisor in attendance and submission reports; left
    // alone the source class looks permanently short.
    expect(body).toMatch(/\[user\.classId \?\? null, -1\]/);
    expect(body).toMatch(/\[\(patch\.classId as string \| null\) \?\? null, 1\]/);
  });

  it('tidak membuat hitungan menjadi negatif', () => {
    // Hitungan yang meleset ke bawah nol tidak pernah pulih sendiri.
    // A count that slips below zero never recovers on its own.
    expect(body).toContain('Math.max(0, current + delta)');
  });

  it('melepas penugasan mentoringnya', () => {
    // Mentornya membimbing kelas lama; peserta akan muncul pada daftar
    // bimbingan yang bukan kelasnya.
    //
    // The mentor guides the old class; the participant would appear on a
    // guidance list that is not theirs.
    expect(body).toMatch(/collection\('assignments'\)\.where\('studentId', '==', uid\)/);
    expect(body).toMatch(/batch\.delete\(doc\.ref\)/);
  });

  it('hanya berlaku bagi peserta', () => {
    // Mentor terhubung lewat mentorIds pada dokumen kelas, dan admin tidak
    // terikat kelas mana pun.
    //
    // Mentors are linked through their class's mentorIds, and an admin belongs
    // to no class.
    expect(body).toMatch(/user\.role === 'student'/);
  });

  it('menyelesaikan seluruh pembacaan sebelum menyusun batch', () => {
    // await yang berselang-seling dengan penulisan membuat urutan operasinya
    // sulit ditelusuri saat salah satunya gagal.
    //
    // Awaits interleaved with writes make the order of operations hard to
    // follow when one of them fails.
    expect(body.indexOf('assignmentDocs = (await db')).toBeLessThan(body.indexOf('const batch = db.batch()'));
  });
});

describe('dialog sunting akun', () => {
  it('memperingatkan sebelum surel diganti', () => {
    // Tidak ada kata sandi sebagai cadangan: salah ketik satu huruf mengunci
    // peserta dari akunnya.
    //
    // There is no password to fall back on: one mistyped character locks a
    // participant out.
    expect(modal).toContain('tidak lagi dapat membuka akun ini');
  });

  it('memberi tahu akibat pindah kelas', () => {
    expect(modal).toContain('Penugasan mentoringnya dilepas');
    expect(modal).toContain('tetap pada kelas lamanya');
  });

  it('menyembunyikan pilihan kelas untuk mentor dan admin', () => {
    expect(modal).toMatch(/user\.role === 'student' && \(/);
  });

  it('memberi label aksesibel pada dialognya', () => {
    expect(modal).toContain('role="dialog"');
    expect(modal).toContain('aria-modal="true"');
  });
});

describe('endpoint sunting akun', () => {
  it('memisahkan sakelar aktif dari penyuntingan', () => {
    // Satu badan yang memuat keduanya membuat sakelar aktif pada daftar ikut
    // mengirim nama dan surel yang kebetulan ada di layar.
    //
    // One body carrying both would have the list's active switch also send
    // whatever name and email happened to be on screen.
    expect(route).toMatch(/if \(typeof body\.active === 'boolean'\)/);
    expect(route).toContain('updateUserAccount(actor, body.uid');
  });

  it('tetap khusus admin', () => {
    expect(route.slice(route.indexOf('export async function PATCH'))).toContain("actor.role !== 'admin'");
  });
});
