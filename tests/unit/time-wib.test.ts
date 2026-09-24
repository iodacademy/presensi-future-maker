// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { formatTimeWib, formatDateWib, formatDateTimeWib } from '../../src/lib/time';

/**
 * Seluruh stempel waktu disimpan sebagai ISO UTC sedangkan program berjalan di
 * WIB. Memotong string ISO menampilkan angka UTC apa adanya -- tujuh jam
 * meleset dari jam yang dilihat peserta, dan pada rentang tertentu tanggalnya
 * ikut mundur satu hari.
 *
 * Every timestamp is stored as ISO UTC while the programme runs in WIB.
 * Slicing an ISO string shows the raw UTC figure -- seven hours off from the
 * clock a participant read, and within certain ranges the date slips back a day
 * as well.
 */
describe('formatTimeWib', () => {
  it('menggeser jam UTC ke WIB', () => {
    // 14:04 UTC adalah 21:04 WIB. Inilah selisih yang terlihat pada daftar
    // hadir sebelum perbaikan.
    //
    // 14:04 UTC is 21:04 WIB. This is the gap that showed on the attendance
    // list before the fix.
    expect(formatTimeWib('2026-09-24T14:04:00.000Z')).toBe('21.04');
  });

  it('menangani pergantian hari', () => {
    // 23:30 UTC adalah 06:30 WIB keesokan harinya.
    // 23:30 UTC is 06:30 WIB the next day.
    expect(formatTimeWib('2026-10-02T23:30:00.000Z')).toBe('06.30');
  });

  it('memakai jam 00-23, bukan 24', () => {
    // Tanpa hourCycle h23, sebagian lokal menghasilkan "24.30" pada tengah
    // malam.
    //
    // Without hourCycle h23, some locales produce "24.30" at midnight.
    expect(formatTimeWib('2026-10-02T17:00:00.000Z')).toBe('00.00');
  });

  it('mengembalikan tanda hubung untuk nilai kosong atau rusak', () => {
    // Satu stempel waktu yang rusak tidak seharusnya menggagalkan seluruh baris
    // pada daftar hadir.
    //
    // One broken timestamp should not take down an entire attendance row.
    expect(formatTimeWib(null)).toBe('-');
    expect(formatTimeWib(undefined)).toBe('-');
    expect(formatTimeWib('')).toBe('-');
    expect(formatTimeWib('bukan tanggal')).toBe('-');
  });
});

describe('formatDateWib', () => {
  it('memajukan tanggal ketika UTC masih hari sebelumnya', () => {
    // Pengumpulan pukul 06.30 WIB tanggal 3 tersimpan sebagai 23.30 UTC
    // tanggal 2. Menampilkan tanggal UTC dapat mengubah penilaian terlambat.
    //
    // A submission at 06:30 WIB on the 3rd is stored as 23:30 UTC on the 2nd.
    // Showing the UTC date can flip a late/on-time judgement.
    expect(formatDateWib('2026-10-02T23:30:00.000Z')).toContain('3');
    expect(formatDateWib('2026-10-02T23:30:00.000Z')).toContain('Okt');
  });

  it('mempertahankan tanggal ketika keduanya sama', () => {
    expect(formatDateWib('2026-10-02T05:00:00.000Z')).toContain('2');
  });

  it('mengembalikan tanda hubung untuk nilai rusak', () => {
    expect(formatDateWib('entah')).toBe('-');
  });
});

describe('formatDateTimeWib', () => {
  it('menyertakan tanggal dan jam WIB', () => {
    const hasil = formatDateTimeWib('2026-09-24T14:04:00.000Z');
    expect(hasil).toContain('24');
    expect(hasil).toContain('21.04');
  });
});

describe('penyajian stempel waktu di antarmuka', () => {
  const files = [
    'src/app/(admin)/admin/jadwal/attendance-modal.tsx',
    'src/app/(admin)/admin/jadwal/qr-monitor-modal.tsx',
    'src/app/(student)/app/jadwal/page.tsx',
    'src/app/(admin)/admin/tugas/page.tsx',
    'src/app/(student)/app/tugas/page.tsx',
    'src/app/api/exports/attendance/route.ts',
    'src/app/api/exports/tasks/route.ts',
  ];

  it.each(files)('%s tidak memotong string ISO', (file) => {
    // slice(11, 16) mengambil jam UTC dan slice(0, 10) mengambil tanggal UTC;
    // keduanya melewati konversi zona waktu sepenuhnya.
    //
    // slice(11, 16) takes the UTC hour and slice(0, 10) the UTC date; both skip
    // the timezone conversion entirely.
    const source = readFileSync(resolve(process.cwd(), file), 'utf-8');
    expect(source).not.toMatch(/(recordedAt|submittedAt|gradedAt|createdAt)\??\.slice\(/);
  });
});
