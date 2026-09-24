// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseDueAt } from '../../src/features/tasks/policy';
import { isSubmissionLate } from '../../src/features/tasks/submission-policy';

const service = readFileSync(resolve(process.cwd(), 'src/features/tasks/service.ts'), 'utf-8');

function block(fnName: string): string {
  const start = service.indexOf(`export async function ${fnName}`);
  if (start === -1) throw new Error(`fungsi ${fnName} tidak ditemukan`);
  const next = service.indexOf('\nexport ', start + 1);
  return service.slice(start, next === -1 ? service.length : next);
}

/**
 * Batas pengumpulan sebelumnya disimpan sebagai teks bebas seperti
 * "30 September 2026, 23:59 WIB" -- persis yang diminta contoh pada formulir
 * admin. Date tidak dapat mengurainya, sehingga perbandingannya menghasilkan
 * NaN dan tidak ada pengumpulan yang pernah ditandai terlambat.
 *
 * Deadlines were previously stored as free text such as "30 September 2026,
 * 23:59 WIB" -- exactly what the admin form's example asked for. Date cannot
 * parse that, so the comparison produced NaN and no submission was ever marked
 * late.
 */
describe('parseDueAt', () => {
  it('mengubah tanggal dan jam WIB menjadi ISO UTC', () => {
    // 23.59 WIB adalah 16.59 UTC pada hari yang sama.
    // 23:59 WIB is 16:59 UTC on the same day.
    expect(parseDueAt('2026-09-30', '23:59')).toBe('2026-09-30T16:59:00.000Z');
  });

  it('memakai akhir hari ketika jamnya dikosongkan', () => {
    // Batas "30 September" yang diperlakukan sebagai 00.00 akan menolak seluruh
    // pengumpulan pada hari itu juga.
    //
    // A deadline of "30 September" treated as 00:00 would reject every
    // submission made on that very day.
    expect(parseDueAt('2026-09-30', null)).toBe('2026-09-30T16:59:00.000Z');
    expect(parseDueAt('2026-09-30', '')).toBe('2026-09-30T16:59:00.000Z');
  });

  it('mengembalikan null bila tanggalnya kosong', () => {
    // Tugas tanpa batas waktu adalah keadaan yang sah.
    // A task with no deadline is a valid state.
    expect(parseDueAt(null, null)).toBeNull();
    expect(parseDueAt('', '23:59')).toBeNull();
  });

  it('menolak format yang tidak dapat diurai', () => {
    expect(() => parseDueAt('30 September 2026', '23:59')).toThrow(/YYYY-MM-DD/);
    expect(() => parseDueAt('2026-09-30', '23.59 WIB')).toThrow(/HH:mm/);
    expect(() => parseDueAt('2026-09-30', '25:00')).toThrow(/HH:mm/);
  });

  it('tidak bergantung pada zona waktu server', () => {
    // Cloud Run berjalan pada UTC sedangkan admin menulis jam WIB; tanpa
    // penanda +07:00, hasilnya berbeda antara mesin lokal dan produksi.
    //
    // Cloud Run runs in UTC while admins write WIB times; without the +07:00
    // marker the result differs between a local machine and production.
    const hasil = parseDueAt('2026-09-30', '23:59')!;
    expect(hasil.endsWith('Z')).toBe(true);
    expect(new Date(hasil).getUTCHours()).toBe(16);
  });
});

describe('keterlambatan dengan batas hasil parseDueAt', () => {
  it('menandai terlambat pengumpulan setelah batas', () => {
    const due = parseDueAt('2026-09-30', '23:59')!;
    expect(isSubmissionLate('2026-10-01T05:00:00.000Z', due)).toBe(true);
  });

  it('tidak menandai terlambat pengumpulan tepat sebelum batas', () => {
    const due = parseDueAt('2026-09-30', '23:59')!;
    // 16.58 UTC adalah 23.58 WIB, satu menit sebelum batas.
    // 16:58 UTC is 23:58 WIB, one minute before the deadline.
    expect(isSubmissionLate('2026-09-30T16:58:00.000Z', due)).toBe(false);
  });

  it('teks bebas lama tidak pernah menandai terlambat', () => {
    // Inilah keadaan yang diperbaiki: batas yang ditulis sesuai contoh pada
    // formulir tidak pernah berlaku sama sekali.
    //
    // This is the state being fixed: a deadline written as the form's example
    // asked never took effect at all.
    expect(isSubmissionLate('2026-10-05T10:00:00.000Z', '30 September 2026, 23:59 WIB')).toBe(false);
  });
});

describe('working paper', () => {
  const policy = readFileSync(resolve(process.cwd(), 'src/features/tasks/policy.ts'), 'utf-8');

  it('menuntut pertemuan induk', () => {
    // Tanpa sesi induknya, peserta tidak punya tempat menemukannya dan batas
    // waktunya kehilangan acuan.
    //
    // With no parent session, participants have nowhere to find it and its
    // deadline loses its reference.
    expect(policy).toMatch(/kind === 'working-paper' && !input\.sessionId/);
  });

  it('tidak menambah penghitung tugas harian maupun capstone', () => {
    // Keduanya mengukur tugas harian dan capstone, yang menentukan kesiapan
    // kelas dan syarat Capstone; memasukkan working paper akan mengubah arti
    // angka itu.
    //
    // Both measure daily tasks and the capstone, which decide class readiness
    // and the Capstone requirement; folding working papers in would change what
    // those numbers mean.
    const body = block('createTask');
    expect(body).toMatch(/: null;/);
    expect(body).toMatch(/\.\.\.\(deltaField \? \{ \[deltaField\]: currentCount \+ 1 \} : \{\}\)/);
  });

  it('menyimpan sessionId pada dokumen tugas', () => {
    expect(block('createTask')).toMatch(/sessionId: input\.sessionId \?\? null/);
  });
});

describe('bahan praktik', () => {
  const body = block('addTaskMaterial');

  it('memakai transaksi, bukan pembaruan larik biasa', () => {
    // Dua admin yang menambah bahan hampir bersamaan sama-sama membaca daftar
    // lama; yang menulis belakangan menghapus bahan yang baru ditambahkan yang
    // lain.
    //
    // Two admins adding materials at nearly the same time both read the old
    // list; whoever writes last erases the material the other just added.
    expect(body).toContain('runTransaction');
    expect(body).toMatch(/tx\.get\(taskRef\)/);
  });

  it('membaca sebelum menulis di dalam transaksi', () => {
    const stripped = body.replace(/\/\/[^\n]*/g, '');
    const read = stripped.indexOf('tx.get(');
    const write = stripped.indexOf('tx.update(');
    expect(read).toBeGreaterThan(-1);
    expect(write).toBeGreaterThan(read);
  });

  it('mewajibkan HTTPS', () => {
    // Tautan ini dirender sebagai href pada halaman peserta; skema javascript:
    // akan dieksekusi di peramban mereka.
    //
    // This link renders as an href on the participant page; a javascript:
    // scheme would execute in their browser.
    expect(body).toMatch(/parsed\.protocol !== 'https:'/);
  });

  it('menolak tautan yang sudah ada pada tugas yang sama', () => {
    expect(body).toMatch(/existing\.some\(\(m\) => m\.url === url\)/);
  });

  it('menuntut peran admin pada penambahan dan penghapusan', () => {
    expect(body).toContain("actor.role !== 'admin'");
    expect(block('removeTaskMaterial')).toContain("actor.role !== 'admin'");
  });
});
