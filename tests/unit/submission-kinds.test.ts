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

  it('menyediakan pilihan untuk tiap jenis tugas', () => {
    // Jenisnya diturunkan dari TASK_KIND_LABELS, bukan diketik satu per satu:
    // daftar tertutup inilah yang dulu menyembunyikan hasil praktik, dan
    // jenis keempat kelak akan terlewat dengan cara yang sama.
    //
    // The kinds come from TASK_KIND_LABELS rather than being typed out: that
    // closed list is what once hid practice results, and a fourth kind would
    // be missed the same way.
    expect(page).toMatch(/Object\.keys\(TASK_KIND_LABELS\) as TaskKind\[\]/);
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
    // jenis tugas yang salah.
    //
    // "No submissions yet" does not tell an admin they are looking at the
    // wrong kind of task.
    expect(page).toContain('TASK_KIND_LABELS[kind].toLowerCase()');
  });

  it('memisahkan yang menunggu dinilai dari yang sudah', () => {
    // Daftar gabungan menuntut admin memindai nilainya satu per satu untuk
    // menemukan mana yang masih perlu dikerjakan.
    //
    // A merged list makes an admin scan the scores one by one to find what
    // still needs doing.
    expect(page).toMatch(/\['menunggu', 'Menunggu Dinilai'\]/);
    expect(page).toMatch(/\['dinilai', 'Sudah Dinilai'\]/);
    expect(page).toContain("graded=${gradeTab === 'dinilai'}");
  });

  it('memilih kelas lebih dulu lewat kartu', () => {
    // Admin menilai satu kelas dalam satu duduk; daftar gabungan empat kelas
    // menuntutnya menyaring setiap kali membuka halaman.
    //
    // An admin grades one class in one sitting; a merged list of four classes
    // makes them filter every time they open the page.
    expect(page).toMatch(/if \(!selectedClass\)/);
    expect(page).toContain('Kembali ke Daftar Kelas');
  });

  it('membuka isi pengumpulan dari layar penilaian', () => {
    // Tautan yang hanya tercetak sebagai teks menuntut admin menyalinnya ke
    // bilah alamat untuk setiap peserta.
    //
    // A link printed as plain text makes an admin copy it into the address bar
    // for every participant.
    expect(page).toMatch(/href=\{grading\.url\}/);
    expect(page).toContain('rel="noopener noreferrer"');
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

/**
 * Daftar kosong punya dua sebab yang sangat berbeda.
 *
 * Tidak ada yang mengumpulkan, atau semuanya sudah dinilai. Menyebut keduanya
 * sebagai "sudah dinilai" memberi tahu admin bahwa pekerjaannya selesai
 * padahal belum satu pun peserta mengumpulkan.
 *
 * An empty list has two very different causes.
 *
 * Nobody submitted, or everything is graded. Calling both "everything is
 * graded" tells an admin their work is done when not one participant has
 * submitted.
 */
describe('pesan daftar kosong', () => {
  const page = read('src/app/(admin)/admin/tugas/page.tsx');

  it('membedakan belum ada pengumpulan dari sudah dinilai semua', () => {
    expect(page).toMatch(/totalKind === 0/);
    expect(page).toContain('yang dikumpulkan');
  });

  it('menghitung seluruh pengumpulan, bukan yang tersaring saja', () => {
    // Jumlah yang tersaring selalu nol saat daftarnya kosong, sehingga tidak
    // dapat dipakai membedakan sebabnya.
    //
    // The filtered count is always zero when the list is empty, so it cannot
    // tell the causes apart.
    expect(page).toMatch(/setTotalKind/);
    expect(page).toMatch(/Promise\.all\(\[/);
  });

  it('menunjuk tempat memeriksanya bila belum ada tugas', () => {
    // "Belum ada yang dikumpulkan" tidak memberi tahu admin apa yang dapat ia
    // lakukan; tugas yang belum terbit terlihat persis sama.
    //
    // "Nothing submitted" does not tell an admin what they can do; an
    // unpublished task looks exactly the same.
    expect(page).toContain('menu Kelas');
    expect(page).toContain('sudah dibuat dan terbit');
  });

  it('menyebut jumlahnya pada pesan sudah dinilai', () => {
    // "Semua sudah dinilai" tanpa angka tidak dapat dibedakan dari daftar yang
    // memang kosong sejak awal.
    //
    // "All graded" with no number is indistinguishable from a list that was
    // empty from the start.
    expect(page).toMatch(/Seluruh \$\{totalKind\} pengumpulan/);
  });
});
