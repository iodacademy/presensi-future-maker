// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateResponses, summariseAnswers } from '@/features/survey/policy';
import { NUMERIC_KINDS, SURVEY_QUESTION_LABELS } from '@/features/survey/types';
import type { SurveyQuestion } from '@/features/survey/types';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf-8');

const soal = (over: Partial<SurveyQuestion> = {}): SurveyQuestion => ({
  id: 'q1',
  kind: 'rating',
  text: 'Bagaimana pertemuan hari ini?',
  options: [],
  required: true,
  order: 1,
  ...over,
});

/**
 * Bintang dan skala menyimpan angka yang sama.
 *
 * Yang berbeda hanya bentuknya di layar peserta. Memisahkan aturannya akan
 * membuat dua tempat yang harus dijaga tetap sama, dan rekapnya berhenti
 * merata-rata salah satunya begitu yang lain berubah.
 *
 * Stars and scales store the same number.
 *
 * Only their shape on the participant's screen differs. Separating their rules
 * would create two places to keep in step, and the report would stop averaging
 * one of them as soon as the other changed.
 */
describe('rating bintang', () => {
  it('tercatat sebagai jenis tersendiri', () => {
    expect(SURVEY_QUESTION_LABELS.rating).toBe('Bintang 1-5');
  });

  it('memakai aturan angka yang sama dengan skala', () => {
    expect(NUMERIC_KINDS).toContain('rating');
    expect(NUMERIC_KINDS).toContain('skala');
  });

  it('menolak nilai di luar satu sampai lima', () => {
    for (const nilai of ['0', '6', '3.5', 'lima']) {
      expect(() => validateResponses([soal()], { q1: nilai }), nilai).toThrow(/angka 1 sampai 5/);
    }
  });

  it('ikut dirata-rata pada rekap', () => {
    // Bintang yang tidak dirata-rata hanya menghasilkan daftar angka, bukan
    // penilaian atas pertemuannya.
    //
    // Stars that are not averaged yield only a list of numbers rather than a
    // judgement of the meeting.
    const hasil = summariseAnswers([
      { questionId: 'q1', questionText: 'Pertemuan?', kind: 'rating', value: '5' },
      { questionId: 'q1', questionText: 'Pertemuan?', kind: 'rating', value: '4' },
    ]);
    expect(hasil[0].average).toBe(4.5);
  });

  it('mengurutkan sebarannya menurut angkanya', () => {
    const hasil = summariseAnswers([
      { questionId: 'q1', questionText: 'P?', kind: 'rating', value: '5' },
      { questionId: 'q1', questionText: 'P?', kind: 'rating', value: '2' },
    ]);
    expect(hasil[0].distribution.map((d) => d.label)).toEqual(['2', '5']);
  });

  it('tampil sebagai bintang di layar peserta', () => {
    // Lima tombol berangka menuntut peserta menerjemahkan sendiri bahwa 5
    // berarti bagus; bintang sudah berarti itu tanpa penjelasan.
    //
    // Five numbered buttons ask a participant to work out that 5 means good; a
    // star already means that without explanation.
    const halaman = read('src/app/(student)/app/survei/[formId]/[sessionId]/page.tsx');
    expect(halaman).toMatch(/q\.kind === 'rating' && \(/);
    expect(halaman).toMatch(/<Star/);
    expect(halaman).toContain('bintang`}');
  });

  it('mengisi bintang sampai nilai yang dipilih, bukan satu saja', () => {
    // Satu bintang terisi di posisi keempat tidak terbaca sebagai empat dari
    // lima.
    //
    // A single filled star in the fourth position does not read as four out of
    // five.
    const halaman = read('src/app/(student)/app/survei/[formId]/[sessionId]/page.tsx');
    expect(halaman).toMatch(/Number\(answers\[q\.id\] \?\? 0\) >= nilai/);
  });
});

/**
 * Daftar panjang dipotong sepuluh baris, tetapi pencariannya tetap mencakup
 * seluruh baris.
 *
 * Memotong sebelum menyaring akan mencari di dalam sepuluh baris pertama saja,
 * sehingga nama pada halaman ketiga tidak pernah ditemukan.
 *
 * Long lists are cut to ten rows, but the search still covers every row.
 *
 * Slicing before filtering would search only within the first ten rows, so a
 * name on page three would never be found.
 */
describe('paginasi daftar', () => {
  const akun = read('src/app/(admin)/admin/akun/page.tsx');
  const tugas = read('src/app/(admin)/admin/tugas/page.tsx');
  const komponen = read('src/components/ui/pagination.tsx');

  it('memotong sepuluh baris per halaman', () => {
    expect(komponen).toContain('export const PAGE_SIZE = 10');
  });

  it('menyaring lebih dulu, memotong sesudahnya', () => {
    for (const [nama, isi] of [['akun', akun], ['tugas', tugas]] as const) {
      expect(isi, nama).toMatch(/visible\s*(?:\.slice|=[\s\S]{0,400}filter)/);
      expect(isi, nama).toMatch(/\.slice\(page \* PAGE_SIZE, \(page \+ 1\) \* PAGE_SIZE\)/);
    }
  });

  it('kembali ke halaman pertama saat penyaringnya berubah', () => {
    // Pencarian yang menyisakan tiga baris pada halaman tiga menampilkan
    // daftar kosong.
    //
    // A search leaving three rows while on page three shows an empty list.
    expect(akun).toMatch(/useEffect\(\(\) => \{ setPage\(0\); \}, \[tab, query, classFilter\]\)/);
    expect(tugas).toMatch(/useEffect\(\(\) => \{ setPage\(0\); \}, \[selectedClass, kind, gradeTab, query\]\)/);
  });

  it('menyembunyikan navigasinya bila hanya satu halaman', () => {
    // Navigasi satu halaman hanya menambah baris yang tidak dapat ditekan.
    // One-page navigation only adds a row nothing can be done with.
    expect(komponen).toMatch(/if \(totalPages <= 1\) return null/);
  });

  it('menyebut rentang dan totalnya, bukan hanya nomor halaman', () => {
    // "halaman 2" menuntut pembacanya mengalikan sendiri untuk tahu berapa
    // yang tersisa.
    //
    // "page 2" asks the reader to do the multiplication to know how many
    // remain.
    expect(komponen).toContain('{mulai}-{akhir} dari {totalItems}');
  });

  it('memberi label aksesibel pada tombol arahnya', () => {
    expect(komponen).toContain('Halaman sebelumnya');
    expect(komponen).toContain('Halaman berikutnya');
  });
});
