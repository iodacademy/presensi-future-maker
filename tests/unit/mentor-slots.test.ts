// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseBulkSlots } from '@/app/(admin)/admin/mentoring/[classId]/[mentorId]/mentor-slots';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf-8');

/**
 * Jadwal mentoring ditempel berombongan dari spreadsheet.
 *
 * Membuat slot satu per satu berarti mengisi formulir yang sama belasan kali
 * untuk satu mentor, dan admin sudah memegang daftarnya dalam bentuk dua kolom.
 *
 * Mentoring schedules are pasted in bulk from a spreadsheet.
 *
 * Creating slots one at a time means filling the same form a dozen times for
 * one mentor, and the admin already holds the list as two columns.
 */
describe('pengurai jadwal tempelan', () => {
  it('membaca tanggal dan jam yang dipisah koma', () => {
    const { rows, errors } = parseBulkSlots('2026-10-05, 16:00\n2026-10-05, 17:00');
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      { date: '2026-10-05', startTime: '16:00' },
      { date: '2026-10-05', startTime: '17:00' },
    ]);
  });

  it('menerima tab, titik koma, dan spasi ganda', () => {
    // Admin menyalin dari Excel, Sheets, dan catatan biasa; menolak salah
    // satunya hanya memindahkan pekerjaan merapikan ke orangnya.
    //
    // Admins paste from Excel, Sheets, and plain notes; rejecting one of them
    // only moves the tidying work onto the person.
    for (const pemisah of ['\t', ';', '   ']) {
      const { rows, errors } = parseBulkSlots(`2026-10-05${pemisah}16:00`);
      expect(errors, pemisah).toEqual([]);
      expect(rows).toHaveLength(1);
    }
  });

  it('mengabaikan baris kosong', () => {
    const { rows } = parseBulkSlots('\n2026-10-05, 16:00\n\n  \n2026-10-06, 16:00\n');
    expect(rows).toHaveLength(2);
  });

  it('menolak baris kembar dalam satu tempelan', () => {
    // Dua slot pada jam sama tampil dua kali bagi peserta, dan salah satunya
    // pasti tetap kosong.
    //
    // Two slots at the same hour show twice to participants, and one of them
    // is bound to stay empty.
    const { rows, errors } = parseBulkSlots('2026-10-05, 16:00\n2026-10-05, 16:00');
    expect(rows).toHaveLength(1);
    expect(errors[0]).toContain('sudah ada');
  });

  it('menyebut nomor baris pada tanggal yang salah', () => {
    // Tanpa nomor baris, admin harus menebak baris mana yang salah di antara
    // belasan.
    //
    // Without the line number an admin has to guess which of a dozen lines is
    // wrong.
    const { errors } = parseBulkSlots('2026-10-05, 16:00\n5 Oktober 2026, 16:00');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('Baris 2');
  });

  it('menolak jam di luar rentang', () => {
    expect(parseBulkSlots('2026-10-05, 25:00').errors[0]).toContain('HH:mm');
    expect(parseBulkSlots('2026-10-05, 16:75').errors[0]).toContain('HH:mm');
  });

  it('menolak baris tanpa jam', () => {
    expect(parseBulkSlots('2026-10-05').errors[0]).toContain('butuh tanggal dan jam');
  });

  it('tetap menerima baris sah meski ada baris salah', () => {
    // Menolak seluruh tempelan karena satu salah ketik memaksa admin
    // mengulang dari awal.
    //
    // Rejecting a whole paste over one typo forces the admin to start over.
    const { rows, errors } = parseBulkSlots('2026-10-05, 16:00\nngawur\n2026-10-06, 16:00');
    expect(rows).toHaveLength(2);
    expect(errors).toHaveLength(1);
  });
});

describe('jadwal berada pada halaman mentornya', () => {
  const mentorPage = read('src/app/(admin)/admin/mentoring/[classId]/[mentorId]/page.tsx');
  const panel = read('src/app/(admin)/admin/mentoring/[classId]/[mentorId]/mentor-slots.tsx');
  const classPage = read('src/app/(admin)/admin/mentoring/[classId]/page.tsx');

  it('memuat penugasan peserta dan jadwal sekaligus', () => {
    // Halaman slot terpisah menanyakan ulang mentor mana yang dimaksud,
    // padahal admin baru saja memilihnya.
    //
    // A separate slot page asked again which mentor was meant, although the
    // admin had just picked them.
    expect(mentorPage).toContain('<MentorSlots');
    expect(mentorPage).toContain('PESERTA BIMBINGAN');
  });

  it('tidak menyisakan halaman slot terpisah', () => {
    expect(existsSync(resolve(process.cwd(), 'src/app/(admin)/admin/mentoring/[classId]/slot'))).toBe(false);
  });

  it('tidak menyisakan tautan ke halaman itu', () => {
    // Tautan mati mengirim admin ke 404.
    // A dead link sends an admin to a 404.
    expect(classPage).not.toMatch(/mentoring\/\$\{classId\}\/slot/);
  });

  it('menyediakan cara manual dan tempelan', () => {
    expect(panel).toContain('Tambah Satu');
    expect(panel).toContain('Tempel Banyak');
  });

  it('menolak menghapus slot yang sudah dipesan', () => {
    // Menghapusnya membuang sesi peserta tanpa memberitahunya.
    // Deleting it throws away a participant's session without telling them.
    expect(panel).toMatch(/slot\.status !== 'available'/);
  });

  it('membuat slot berurutan, bukan serentak', () => {
    // Tiap slot menulis ke dokumen kelas yang sama; penulisan bersamaan akan
    // saling menimpa.
    //
    // Each slot writes to the same class document; concurrent writes would
    // clobber each other.
    expect(panel).toMatch(/for \(const r of rows\)/);
    expect(panel).not.toMatch(/Promise\.all\(rows/);
  });

  it('memberi label aksesibel pada tombol dan kolom', () => {
    for (const label of ['Tanggal mentoring', 'Jam mulai mentoring', 'Tempel jadwal mentoring', 'Hapus slot']) {
      expect(panel, label).toContain(label);
    }
  });
});
