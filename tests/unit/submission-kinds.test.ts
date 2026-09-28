// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TASK_KIND_LABELS } from '@/features/tasks/types';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf-8');

/**
 * Rekap pengumpulan harus mengenal setiap jenis tugas.
 *
 * Penyaring jenis selalu terisi, sehingga jenis yang tidak punya tab tidak
 * pernah terpilih: working paper yang dikumpulkan peserta tersimpan utuh
 * tetapi tidak terlihat oleh admin mana pun.
 *
 * The submission report must know every task kind.
 *
 * The kind filter is always set, so a kind with no tab is never selected:
 * working papers participants submitted were stored intact but invisible to
 * every admin.
 */
describe('rekap pengumpulan mengenal seluruh jenis tugas', () => {
  const page = read('src/app/(admin)/admin/tugas/page.tsx');
  const service = read('src/features/tasks/submission-service.ts');

  it('menyediakan tab untuk tiap jenis tugas', () => {
    for (const kind of Object.keys(TASK_KIND_LABELS)) {
      expect(page, `tab ${kind} hilang`).toContain(`'${kind}'`);
    }
  });

  it('tidak membatasi penyaring pada dua jenis saja', () => {
    // Daftar tertutup inilah yang menyembunyikan working paper.
    // This closed list is what hid working papers.
    const body = service.slice(service.indexOf('export async function listSubmissionsForAdmin'));
    expect(body.slice(0, 400)).not.toMatch(/kind\?: 'daily' \| 'capstone'/);
    expect(body.slice(0, 600)).toContain('kind?: TaskKind');
  });

  it('meneruskan jenis apa pun dari endpoint', () => {
    for (const path of ['src/app/api/submissions/route.ts', 'src/app/api/exports/tasks/route.ts']) {
      expect(read(path), path).not.toMatch(/as 'daily' \| 'capstone' \| null/);
    }
  });

  it('memakai label terpusat, bukan nama yang diketik ulang', () => {
    // Label yang diketik ulang di tiap halaman akan menyimpang begitu salah
    // satunya berubah.
    //
    // Labels retyped on each page drift apart as soon as one of them changes.
    expect(page).toContain('TASK_KIND_LABELS');
  });

  it('menyebut jenis yang sedang dilihat pada pesan kosong', () => {
    // "Belum ada submission" tidak memberi tahu admin bahwa ia sedang melihat
    // tab yang salah.
    //
    // "No submissions yet" does not tell an admin they are on the wrong tab.
    expect(page).toContain('TASK_KIND_LABELS[activeTab]');
  });
});

describe('pengumpulan working paper tetap terpisah dari syarat kelas', () => {
  const service = read('src/features/tasks/submission-service.ts');

  it('hitungan tugas harian tidak ikut menghitung working paper', () => {
    // Capstone terbuka setelah tugas harian selesai; memasukkan working paper
    // ke hitungan itu akan mengubah syarat yang sudah berjalan.
    //
    // The Capstone unlocks once daily tasks are done; folding working papers
    // into that count would change a requirement already in force.
    expect(service).toContain("where('taskKind', '==', 'daily')");
    expect(service).toContain("filter((s) => s.taskKind === 'daily')");
  });
});
