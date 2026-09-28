// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TASK_KIND_LABELS } from '@/features/tasks/types';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf-8');

/**
 * Nama yang dibaca pengguna berubah; kunci datanya tidak.
 *
 * 'working-paper' dan 'daily' sudah tertulis pada dokumen tugas dan
 * pengumpulan yang ada, sehingga menggantinya berarti memindahkan seluruh data
 * lama hanya demi sebuah label.
 *
 * The names users read changed; the data keys did not.
 *
 * 'working-paper' and 'daily' are already written on existing task and
 * submission documents, so renaming them would mean migrating all the old data
 * merely for a label.
 */
describe('penamaan jenis tugas', () => {
  it('memakai nama baru pada label terpusat', () => {
    expect(TASK_KIND_LABELS['working-paper']).toBe('Hasil Praktik di Kelas');
    expect(TASK_KIND_LABELS.daily).toBe('Tugas Praktik Mandiri');
  });

  it('mempertahankan kunci datanya', () => {
    // Mengganti kunci memutuskan setiap dokumen yang sudah tersimpan.
    // Changing the key breaks every document already stored.
    expect(Object.keys(TASK_KIND_LABELS).sort()).toEqual(['capstone', 'daily', 'working-paper']);
  });

  it('tidak menyisakan nama lama di layar admin', () => {
    for (const path of [
      'src/app/(admin)/admin/kelas/[classId]/page.tsx',
      'src/app/(admin)/admin/kelas/page.tsx',
      'src/app/(admin)/admin/tugas/page.tsx',
      'src/app/(admin)/admin/kelas/[classId]/session-working-paper.tsx',
    ]) {
      // Komentar boleh menyebut istilah lama; yang tampil ke layar tidak.
      // Comments may keep the old term; what reaches the screen may not.
      const tampil = read(path)
        .split('\n')
        .filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//'))
        .join('\n');
      expect(tampil, path).not.toMatch(/Tugas Harian|Working Paper/);
    }
  });

  it('tidak menyisakan nama lama di layar peserta', () => {
    for (const path of ['src/app/(student)/app/page.tsx', 'src/app/(student)/app/tugas/page.tsx', 'src/app/(student)/app/jadwal/page.tsx']) {
      const tampil = read(path)
        .split('\n')
        .filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//'))
        .join('\n');
      expect(tampil, path).not.toMatch(/Tugas Harian|Working Paper/);
    }
  });
});

/**
 * Batas hasil praktik jatuh beberapa jam setelah pertemuannya, jauh lebih
 * cepat daripada tugas mandiri.
 *
 * A practice result's deadline falls hours after its meeting, far sooner than
 * a self-study task's.
 */
describe('hasil praktik terdekat pada beranda peserta', () => {
  const service = read('src/features/dashboard/service.ts');
  const page = read('src/app/(student)/app/page.tsx');

  it('dihitung terpisah dari tugas terdekat', () => {
    // Satu kartu "tugas terdekat" yang sudah terisi tugas lain menyembunyikan
    // justru yang paling mendesak.
    //
    // A single "nearest task" card already holding another task hides the most
    // urgent one.
    expect(service).toContain('nearestWorkingPaper');
    expect(service).toMatch(/find\(\(t\) => t\.kind === 'working-paper'\)/);
  });

  it('memakai daftar yang sudah disaring dan diurutkan', () => {
    // Menyaring ulang dari awal akan melewatkan pengurutan menurut batas waktu
    // dan memunculkan yang sudah dikumpulkan.
    //
    // Filtering again from scratch would skip the deadline sort and surface
    // ones already submitted.
    expect(service).toMatch(/unsubmittedTasks\.find/);
  });

  it('dikembalikan null saat tidak ada kelasnya', () => {
    expect(service).toContain('nearestWorkingPaper: null');
  });

  it('tampil sebagai kartu tersendiri', () => {
    expect(page).toContain('Hasil Praktik di Kelas - belum dikumpulkan');
  });

  it('tidak menampilkan tugas yang sama dua kali', () => {
    // Tugas terdekat yang kebetulan hasil praktik sudah tampil di kartu atas.
    // A nearest task that happens to be a practice result already shows above.
    expect(page).toContain('nearestTask.id !== nearestWorkingPaper?.id');
  });
});
