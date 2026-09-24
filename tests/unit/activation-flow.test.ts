// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { canActivateClass, isCapstoneUnlocked } from '../../src/features/tasks/policy';

const service = readFileSync(resolve(process.cwd(), 'src/features/tasks/service.ts'), 'utf-8');

function block(fnName: string): string {
  const start = service.indexOf(`export async function ${fnName}`);
  if (start === -1) throw new Error(`fungsi ${fnName} tidak ditemukan`);
  const next = service.indexOf('\nexport ', start + 1);
  return service.slice(start, next === -1 ? service.length : next);
}

/**
 * Kelas kini dapat diaktifkan berbekal jadwal saja, dengan tugas disusun
 * belakangan. Urutan itu menyentuh tiga aturan yang sebelumnya saling
 * bergantung, dan masing-masing mengunci sesuatu secara permanen bila salah
 * satu tertinggal.
 *
 * A class can now be activated on its schedule alone, with tasks written
 * afterwards. That order touches three rules that previously depended on one
 * another, and each locks something permanently if one is left behind.
 */
describe('aktivasi hanya menuntut jadwal', () => {
  it('menolak kelas tanpa satu pun pertemuan', () => {
    expect(canActivateClass({ status: 'draft', sessionCount: 0 }).canActivate).toBe(false);
  });

  it('menerima kelas berjadwal tanpa mentor, tugas, atau Capstone', () => {
    expect(canActivateClass({ status: 'draft', sessionCount: 13 }).canActivate).toBe(true);
  });

  it('menolak kelas yang sudah aktif atau diarsipkan', () => {
    expect(canActivateClass({ status: 'active', sessionCount: 13 }).canActivate).toBe(false);
    expect(canActivateClass({ status: 'archived', sessionCount: 13 }).canActivate).toBe(false);
  });

  it('menghitung pertemuan dari koleksi sessions', () => {
    expect(block('activateClass')).toMatch(/collection\('sessions'\)[\s\S]{0,120}\.count\(\)/);
  });

  it('tidak lagi menuntut dokumen Capstone', () => {
    // Melemparkan galat ketika Capstone tidak ada akan menggagalkan seluruh
    // aktivasi, padahal Capstone memang disusun belakangan.
    //
    // Throwing when the Capstone is absent would fail the whole activation,
    // while the Capstone is precisely what is written later.
    expect(block('activateClass')).not.toContain('Instruksi Capstone Project tidak ditemukan');
    expect(block('activateClass')).toMatch(/capstoneTask\?\.id \?\? null/);
  });
});

describe('tugas ditambahkan setelah kelas aktif', () => {
  const body = block('createTask');

  it('hanya menolak kelas yang diarsipkan', () => {
    // Menolak kelas non-draft membuat tugas tidak dapat ditambahkan sama sekali
    // setelah aktivasi -- justru urutan yang kini dipakai.
    //
    // Refusing any non-draft class would make tasks unaddable after activation
    // -- exactly the order now in use.
    expect(body).toMatch(/classData\.status === 'archived'/);
    expect(body).not.toMatch(/classData\.status !== 'draft'/);
  });

  it('menerbitkan tugas seketika pada kelas aktif', () => {
    // Peserta sudah berada di dalam kelas; tugas yang tidak terbit tidak
    // terlihat oleh siapa pun dan tidak ada langkah lain yang menerbitkannya.
    //
    // Participants are already inside the class; an unpublished task is
    // invisible to everyone and no later step publishes it.
    expect(body).toMatch(/published: classData\.status === 'active'/);
  });

  it('menambahkan tugas harian baru ke snapshot tugas wajib', () => {
    // Snapshot dibekukan saat aktivasi. Tanpa penambahan ini, tugas yang
    // disusun belakangan tidak pernah dihitung sebagai syarat Capstone.
    //
    // The snapshot is frozen at activation. Without this addition, a task
    // written later never counts toward the Capstone requirement.
    expect(body).toContain('joinsSnapshot');
    expect(body).toMatch(/requiredDailyTaskIds: \[\.\.\.\(classData\.requiredDailyTaskIds \|\| \[\]\), taskId\]/);
  });

  it('mencatat Capstone yang ditambahkan setelah aktivasi', () => {
    // capstoneTaskId dibekukan sebagai null saat aktivasi tanpa Capstone.
    // capstoneTaskId is frozen as null when activating without a Capstone.
    expect(body).toMatch(/capstoneTaskId: taskId/);
  });
});

describe('Capstone pada kelas tanpa tugas harian', () => {
  it('terbuka ketika daftar syaratnya kosong', () => {
    // Kelas yang diaktifkan sebelum tugasnya disusun memiliki snapshot kosong.
    // Mengunci di situ menutup Capstone selamanya, sebab tidak ada tugas yang
    // dapat dikumpulkan untuk membukanya.
    //
    // A class activated before its tasks were written has an empty snapshot.
    // Locking there shuts the Capstone forever, since no task exists to submit
    // and open it.
    expect(isCapstoneUnlocked([], [])).toBe(true);
  });

  it('kembali terkunci setelah tugas harian pertama ditambahkan', () => {
    expect(isCapstoneUnlocked(['t1'], [])).toBe(false);
    expect(isCapstoneUnlocked(['t1'], ['t1'])).toBe(true);
  });
});
