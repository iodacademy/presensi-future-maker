// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const service = readFileSync(resolve(process.cwd(), 'src/features/attendance/service.ts'), 'utf-8');

function block(fnName: string): string {
  const start = service.indexOf(`export async function ${fnName}`);
  if (start === -1) throw new Error(`fungsi ${fnName} tidak ditemukan`);
  const next = service.indexOf('\nexport ', start + 1);
  return service.slice(start, next === -1 ? service.length : next);
}

describe('updateSession', () => {
  const body = block('updateSession');

  it('menolak perubahan waktu bila sudah ada yang hadir', () => {
    // Tiap catatan kehadiran menyimpan salinan sessionEndsAt. Menggeser waktu
    // membuat salinan itu tidak lagi cocok dengan sesinya, sehingga jendela
    // presensi dan rekap kehadiran sama-sama salah.
    //
    // Each attendance record holds a copy of sessionEndsAt. Shifting the time
    // makes that copy disagree with its session, so both the attendance window
    // and the attendance report go wrong.
    expect(body).toContain('timeChanged');
    expect(body).toMatch(/collection\('attendance'\)/);
    expect(body).toMatch(/attended\.empty/);
  });

  it('tetap mengizinkan perbaikan judul, tautan, dan alamat', () => {
    // Pemeriksaan kehadiran hanya berjalan ketika waktunya berubah; salah ketik
    // judul atau tautan Zoom harus tetap dapat diperbaiki kapan saja.
    //
    // The attendance check runs only when the time changes; a typo in the title
    // or Zoom link must stay fixable at any point.
    expect(body).toMatch(/if \(timeChanged\) \{/);
  });

  it('menaikkan nomor revisi QR saat waktu berubah', () => {
    // Token QR terikat pada nomor revisi. Tanpa dinaikkan, token yang sudah
    // terbit untuk jadwal lama tetap berlaku pada jadwal yang baru.
    //
    // QR tokens are bound to the revision number. Without a bump, tokens issued
    // for the old schedule stay valid against the new one.
    expect(body).toMatch(/qrRevision: \(current\.qrRevision \|\| 1\) \+ 1/);
    expect(body).toMatch(/\.\.\.\(timeChanged \?/);
  });

  it('memvalidasi ulang gabungan nilai lama dan baru', () => {
    // Mengubah moda ke offline tanpa alamat harus tetap ditolak, walau
    // alamatnya tidak ikut dikirim dalam permintaan.
    //
    // Switching the mode to offline without an address must still be rejected,
    // even when the address is not part of the request.
    expect(body).toContain('validateSessionInput(merged)');
  });

  it('menuntut peran admin', () => {
    expect(body).toContain("actor.role !== 'admin'");
  });

  it('menghitung ulang startsAt dan endsAt', () => {
    // Keduanya tersimpan sebagai UTC dan dipakai untuk menentukan sesi aktif.
    // Both are stored as UTC and decide which session is currently active.
    expect(body).toContain('toUtcIso(validated.date, validated.startTime)');
    expect(body).toContain('toUtcIso(validated.date, validated.endTime)');
  });
});
