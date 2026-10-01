// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf-8');
const runner = read('src/app/(student)/app/ujian/[examId]/page.tsx');
const review = read('src/app/(student)/app/ujian/[examId]/hasil/[attemptId]/page.tsx');
const service = read('src/features/exams/service.ts');
const types = read('src/features/exams/types.ts');

describe('kerangka layar pengerjaan', () => {
  it('menahan kepala dan navigasi, menggulirkan isinya saja', () => {
    // Penghitung waktu dan tombol kumpul harus tetap terlihat; keduanya ikut
    // tergulir bila seluruh halaman yang bergulir.
    //
    // The clock and the submit button must stay in view; both scroll away if
    // the whole page scrolls.
    expect(runner).toContain("height: '100vh'");
    expect(runner).toContain("overflow: 'hidden'");
    expect(runner).toMatch(/overflowY: 'auto'/);
  });

  it('menampilkan satu soal per layar', () => {
    // Seluruh soal dalam satu gulungan membuat peserta kehilangan tempatnya.
    // Every question in one scroll loses a participant's place.
    expect(runner).toContain('state.questions[index]');
  });

  it('menyembunyikan jam pada ujian tanpa batas', () => {
    // Jam yang selalu ada membuat peserta mengira waktunya sedang berjalan.
    // An ever-present clock makes participants think time is running.
    expect(runner).toMatch(/remaining !== null && \(/);
  });

  it('menandai satu menit terakhir', () => {
    expect(runner).toMatch(/mendesak = remaining !== null && remaining <= 30/);
    expect(runner).toContain("aria-live={mendesak ? 'assertive' : 'off'}");
  });
});

/**
 * Urutan warna palet menentukan apa yang dicari peserta saat meninjau ulang.
 *
 * Soal yang sudah dijawab tetapi ditandai ragu harus terbaca sebagai ragu;
 * bila warna terjawab menang, penanda ragunya hilang justru pada soal yang
 * ingin ia periksa lagi.
 *
 * The palette's colour order decides what a participant finds when reviewing.
 *
 * A question that is answered but flagged must read as flagged; if the
 * answered colour wins, the flag disappears on exactly the question they meant
 * to revisit.
 */
describe('palet nomor soal', () => {
  const blok = runner.slice(runner.indexOf('function cellStyle'), runner.indexOf('const paletteCell'));

  it('mendahulukan soal yang sedang dibuka', () => {
    expect(blok.indexOf('i === index')).toBeLessThan(blok.indexOf('doubtful[qid]'));
  });

  it('mendahulukan ragu daripada sudah terjawab', () => {
    expect(blok.indexOf('doubtful[qid]')).toBeLessThan(blok.indexOf('answers[qid]'));
  });

  it('memakai empat keadaan yang berbeda', () => {
    const warna = blok.match(/backgroundColor: '[^']+'/g) ?? [];
    expect(new Set(warna).size).toBe(4);
  });

  it('melipat ke bawah, bukan bergulir ke samping', () => {
    // Strip yang bergulir menyembunyikan justru nomor yang sedang dicari.
    // A scrolling strip hides the very number being hunted for.
    expect(runner).toMatch(/flexWrap: 'wrap', justifyContent: 'center'/);
  });

  it('menyebutkan keadaannya bagi pembaca layar', () => {
    expect(runner).toContain('belum dijawab');
    expect(runner).toContain('ditandai ragu');
  });
});

describe('penanda ragu', () => {
  it('tersimpan bersama jawabannya', () => {
    // Penanda yang hanya di layar hilang begitu halaman dimuat ulang.
    // A marker that lives only on screen vanishes on reload.
    expect(types).toContain('isDoubtful: boolean');
    expect(service).toMatch(/isDoubtful = false/);
  });

  it('dipulihkan saat percobaan dilanjutkan', () => {
    expect(service).toContain('savedDoubts');
    expect(runner).toContain('data.savedDoubts');
  });

  it('bertahan melewati penilaian', () => {
    // Penanda itu milik peserta, bukan hasil penilaian; halaman pembahasan
    // menampilkannya kembali.
    //
    // The marker is the participant's own rather than a grading result; the
    // review page shows it again.
    expect(service).toMatch(/isDoubtful: ragu\[q\.id\] === true/);
  });

  it('dapat ditandai pada soal yang sudah dijawab', () => {
    // Soal yang sudah dijawab pun dapat diragukan.
    // An answered question can still be doubted.
    expect(runner).toMatch(/persist\(questionId, answers\[questionId\] \?\? null, next\)/);
  });
});

describe('navigasi bawah', () => {
  it('tidak pernah menyisakan tombol kanan yang mati', () => {
    // Soal terakhir dengan lembar belum penuh mengantar ke soal kosong
    // pertama, bukan berhenti pada tombol yang tidak merespons.
    //
    // A last question with an incomplete sheet jumps to the first gap rather
    // than stopping on a button that does nothing.
    expect(runner).toMatch(/setIndex\(belumDijawab\[0\]\)/);
    expect(runner).toMatch(/belumDijawab\.length\} belum/);
  });

  it('membuka pengumpulan dari soal mana pun bila lembarnya penuh', () => {
    expect(runner).toMatch(/belumDijawab\.length === 0 \?/);
  });

  it('menyediakan tombol ragu di tengah', () => {
    expect(runner).toMatch(/onClick=\{\(\) => soal && toggleDoubt\(soal\.id\)\}/);
  });
});

describe('keadaan penyimpanan terlihat peserta', () => {
  it('membedakan menyimpan, tersimpan, dan gagal', () => {
    // Tanpa keterangan, peserta tidak tahu jawabannya sudah aman atau belum.
    // Without it, a participant cannot tell whether their answers are safe.
    expect(runner).toContain("saveState === 'saving'");
    expect(runner).toContain("saveState === 'saved'");
    expect(runner).toContain("saveState === 'offline'");
  });

  it('menjelaskan bahwa gagal simpan bukan kehilangan jawaban', () => {
    expect(runner).toContain('tetap terkirim saat dikumpulkan');
  });
});

describe('layar hasil dan pembahasan', () => {
  it('memakai warna peringatan untuk belum lulus, bukan bahaya', () => {
    // Percobaan yang gagal adalah ajakan mengulang, bukan kesalahan.
    // A failed attempt is an invitation to retry, not an error.
    expect(runner).toMatch(/result\.passed \? 'var\(--color-success-light\)' : 'var\(--color-warning-light\)'/);
    expect(review).toMatch(/data\.passed \? 'var\(--color-success\)' : 'var\(--color-warning\)'/);
  });

  it('menempatkan status pada strip kepala tiap soal', () => {
    // Satu tempat tetap untuk mencari benar atau salah saat menggulir daftar
    // panjang.
    //
    // One fixed place to look for right or wrong while scrolling a long list.
    expect(review).toContain('Soal {i + 1}');
    expect(review).toContain("'Tidak dijawab'");
  });

  it('menampilkan seluruh soal dalam satu gulungan', () => {
    // Berbeda dari layar pengerjaan: saat meninjau, membandingkan antar-soal
    // lebih berguna daripada berfokus pada satu soal.
    //
    // Unlike the runner: when reviewing, comparing across questions is more
    // useful than focusing on one.
    expect(review).toMatch(/data\.questions\.map\(\(q, i\) =>/);
    expect(review).not.toContain('setIndex');
  });
});
