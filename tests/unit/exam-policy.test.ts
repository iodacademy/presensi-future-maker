// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  applyRemedialRule,
  canStartAttempt,
  attemptDeadline,
  isSubmissionLate,
  gradeAnswer,
  calculateScore,
  seededShuffle,
  validateQuestion,
  canPublishExam,
  SUBMIT_GRACE_MS,
} from '@/features/exams/policy';
import { MAX_ATTEMPTS } from '@/features/exams/types';

const KKM = 70;

/**
 * Pengulangan memulihkan kesempatan lulus, bukan kesempatan menaikkan angka.
 *
 * Tanpa patokan ini, peserta yang sengaja gagal di percobaan pertama dapat
 * mengejar nilai lebih tinggi daripada yang lulus sekali jalan.
 *
 * A retake restores the chance to pass, not the chance to raise a number.
 *
 * Without this ceiling, someone who deliberately fails their first attempt
 * could chase a higher score than those who passed first time.
 */
describe('aturan nilai remedial', () => {
  it('menilai percobaan pertama apa adanya', () => {
    expect(applyRemedialRule(95, 1, KKM)).toBe(95);
    expect(applyRemedialRule(40, 1, KKM)).toBe(40);
  });

  it('mematok percobaan kedua yang lulus tepat di KKM', () => {
    expect(applyRemedialRule(95, 2, KKM)).toBe(70);
    expect(applyRemedialRule(70, 2, KKM)).toBe(70);
  });

  it('mematok percobaan ketiga yang lulus juga', () => {
    expect(applyRemedialRule(100, 3, KKM)).toBe(70);
  });

  it('membiarkan pengulangan yang tetap gagal memakai nilai aslinya', () => {
    // Memataknya ke KKM justru akan meluluskan yang tidak lulus.
    // Pinning it to the mark would pass someone who did not pass.
    expect(applyRemedialRule(65, 2, KKM)).toBe(65);
    expect(applyRemedialRule(0, 3, KKM)).toBe(0);
  });

  it('tidak pernah menurunkan nilai di bawah aslinya', () => {
    for (let nilai = 0; nilai <= 100; nilai += 5) {
      for (const percobaan of [1, 2, 3]) {
        expect(applyRemedialRule(nilai, percobaan, KKM)).toBeLessThanOrEqual(nilai);
      }
    }
  });

  it('tidak pernah mengubah lulus menjadi gagal', () => {
    // Nilai yang dipatok harus tetap memenuhi KKM-nya sendiri.
    // A pinned score must still meet its own passing mark.
    for (let nilai = KKM; nilai <= 100; nilai += 5) {
      for (const percobaan of [2, 3]) {
        expect(applyRemedialRule(nilai, percobaan, KKM)).toBeGreaterThanOrEqual(KKM);
      }
    }
  });
});

describe('kelayakan mengerjakan', () => {
  const now = '2026-10-01T10:00:00.000Z';

  it('mengizinkan percobaan pertama', () => {
    expect(canStartAttempt({ attempts: [], dueAt: null, nowIso: now }).allowed).toBe(true);
  });

  it('menutup pengulangan setelah lulus', () => {
    // Aturan remedial membuat pengulangan tidak pernah menaikkan nilai, jadi
    // mengulang setelah lulus hanya menghabiskan waktu.
    //
    // The remedial rule means a retake never raises the score, so retaking
    // after a pass only spends time.
    const hasil = canStartAttempt({
      attempts: [{ status: 'selesai', passed: true }],
      dueAt: null,
      nowIso: now,
    });
    expect(hasil.allowed).toBe(false);
    expect(hasil.reason).toContain('sudah lulus');
  });

  it('mengizinkan pengulangan setelah gagal', () => {
    expect(
      canStartAttempt({ attempts: [{ status: 'selesai', passed: false }], dueAt: null, nowIso: now }).allowed
    ).toBe(true);
  });

  it(`berhenti setelah ${MAX_ATTEMPTS} percobaan`, () => {
    const gagal = Array.from({ length: MAX_ATTEMPTS }, () => ({ status: 'selesai' as const, passed: false }));
    const hasil = canStartAttempt({ attempts: gagal, dueAt: null, nowIso: now });
    expect(hasil.allowed).toBe(false);
    expect(hasil.reason).toContain('habis');
  });

  it('melanjutkan percobaan yang sedang berjalan meski batasnya lewat', () => {
    // Menghentikannya di tengah berarti membuang jawaban yang sudah diisi.
    // Cutting it off would throw away answers already filled in.
    expect(
      canStartAttempt({
        attempts: [{ status: 'berlangsung', passed: null }],
        dueAt: '2026-09-01T00:00:00.000Z',
        nowIso: now,
      }).allowed
    ).toBe(true);
  });

  it('melanjutkan percobaan berjalan meski kuotanya sudah penuh', () => {
    // Percobaan ketiga yang sedang dikerjakan tidak boleh ditolak oleh
    // hitungannya sendiri.
    //
    // A third attempt in progress must not be refused by its own count.
    const attempts = [
      { status: 'selesai' as const, passed: false },
      { status: 'selesai' as const, passed: false },
      { status: 'berlangsung' as const, passed: null },
    ];
    expect(canStartAttempt({ attempts, dueAt: null, nowIso: now }).allowed).toBe(true);
  });

  it('menolak memulai setelah batas pengumpulan lewat', () => {
    const hasil = canStartAttempt({ attempts: [], dueAt: '2026-09-30T00:00:00.000Z', nowIso: now });
    expect(hasil.allowed).toBe(false);
    expect(hasil.reason).toContain('Batas pengumpulan');
  });
});

describe('batas waktu pengerjaan', () => {
  const mulai = '2026-10-01T10:00:00.000Z';

  it('mengembalikan null untuk ujian tanpa batas', () => {
    // Nol atau waktu sekarang akan terbaca "sudah habis" oleh pemanggilnya.
    // Zero or the current time would read as "already expired" to its callers.
    expect(attemptDeadline(mulai, null)).toBe(null);
    expect(attemptDeadline(mulai, 0)).toBe(null);
  });

  it('menambahkan durasinya pada waktu mulai', () => {
    expect(attemptDeadline(mulai, 30)).toBe('2026-10-01T10:30:00.000Z');
  });

  it('memberi toleransi untuk pengiriman detik terakhir', () => {
    // Menolak karena selisih beberapa detik menghukum koneksi peserta.
    // Refusing over a few seconds punishes a participant's connection.
    const batasMs = new Date('2026-10-01T10:30:00.000Z').getTime();
    expect(isSubmissionLate(mulai, 30, batasMs + 1000)).toBe(false);
    expect(isSubmissionLate(mulai, 30, batasMs + SUBMIT_GRACE_MS - 1)).toBe(false);
    expect(isSubmissionLate(mulai, 30, batasMs + SUBMIT_GRACE_MS + 1)).toBe(true);
  });

  it('tidak pernah menyebut terlambat pada ujian tanpa batas', () => {
    expect(isSubmissionLate(mulai, null, Date.now() + 10 ** 10)).toBe(false);
  });
});

describe('penilaian', () => {
  it('menilai jawaban yang cocok sebagai benar', () => {
    expect(gradeAnswer('opsi-b', 'opsi-b')).toBe(true);
    expect(gradeAnswer('opsi-a', 'opsi-b')).toBe(false);
  });

  it('menilai soal yang dilewatkan sebagai salah', () => {
    // Pembaginya seluruh soal, sehingga melewatkan soal tidak boleh
    // memperkecil pembagi itu.
    //
    // The divisor is every question, so skipping one must not shrink it.
    expect(gradeAnswer(null, 'opsi-b')).toBe(false);
  });

  it('membagi dengan jumlah seluruh soal, bukan yang dijawab', () => {
    // Memakai jumlah yang dijawab memberi nilai sempurna kepada peserta yang
    // menjawab satu soal lalu mengirimkannya.
    //
    // Using the number answered hands a perfect score to anyone who answered
    // one question and submitted.
    expect(calculateScore(1, 20)).toBe(5);
    expect(calculateScore(14, 20)).toBe(70);
    expect(calculateScore(20, 20)).toBe(100);
  });

  it('membulatkan ke bilangan bulat', () => {
    expect(calculateScore(2, 3)).toBe(67);
    expect(calculateScore(1, 3)).toBe(33);
  });

  it('aman terhadap ujian tanpa soal', () => {
    expect(calculateScore(0, 0)).toBe(0);
  });

  it('tidak pernah melampaui seratus', () => {
    expect(calculateScore(25, 20)).toBe(100);
    expect(calculateScore(-5, 20)).toBe(0);
  });
});

describe('pengacakan urutan soal', () => {
  const soal = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

  it('menghasilkan urutan sama untuk benih sama', () => {
    // Urutannya harus bertahan saat halaman dimuat ulang, agar peserta yang
    // jaringannya terputus tidak kehilangan tempatnya.
    //
    // The order must survive a reload, so a participant whose connection drops
    // does not lose their place.
    expect(seededShuffle(soal, 'percobaan-1')).toEqual(seededShuffle(soal, 'percobaan-1'));
  });

  it('menghasilkan urutan berbeda untuk benih berbeda', () => {
    expect(seededShuffle(soal, 'percobaan-1')).not.toEqual(seededShuffle(soal, 'percobaan-2'));
  });

  it('tidak kehilangan atau menggandakan soal', () => {
    const hasil = seededShuffle(soal, 'apa pun');
    expect([...hasil].sort()).toEqual([...soal].sort());
  });

  it('tidak mengubah daftar aslinya', () => {
    const asli = [...soal];
    seededShuffle(soal, 'benih');
    expect(soal).toEqual(asli);
  });
});

describe('validasi soal', () => {
  const opsi = [
    { id: 'a', text: 'Pilihan A' },
    { id: 'b', text: 'Pilihan B' },
  ];

  it('menerima soal yang lengkap', () => {
    expect(() =>
      validateQuestion({ kind: 'pilihan-ganda', text: 'Pertanyaan?', options: opsi, correctOptionId: 'a' })
    ).not.toThrow();
  });

  it('menolak pertanyaan kosong', () => {
    expect(() =>
      validateQuestion({ kind: 'pilihan-ganda', text: '   ', options: opsi, correctOptionId: 'a' })
    ).toThrow(/Pertanyaan wajib/);
  });

  it('menolak kunci yang tidak ada di antara pilihannya', () => {
    // Tanpa kunci yang sah, soal itu menilai setiap jawaban sebagai salah.
    // With no valid key, the question marks every answer wrong.
    expect(() =>
      validateQuestion({ kind: 'pilihan-ganda', text: 'Soal?', options: opsi, correctOptionId: 'z' })
    ).toThrow(/Jawaban benar wajib dipilih/);
  });

  it('menolak pilihan yang teksnya kosong', () => {
    expect(() =>
      validateQuestion({
        kind: 'pilihan-ganda',
        text: 'Soal?',
        options: [{ id: 'a', text: 'A' }, { id: 'b', text: '  ' }],
        correctOptionId: 'a',
      })
    ).toThrow(/Setiap pilihan wajib/);
  });

  it('menuntut tepat dua pilihan pada soal benar-salah', () => {
    expect(() =>
      validateQuestion({
        kind: 'benar-salah',
        text: 'Soal?',
        options: [...opsi, { id: 'c', text: 'C' }],
        correctOptionId: 'a',
      })
    ).toThrow(/tepat dua pilihan/);
  });

  it('menolak pilihan ganda berisi satu pilihan', () => {
    expect(() =>
      validateQuestion({
        kind: 'pilihan-ganda',
        text: 'Soal?',
        options: [{ id: 'a', text: 'A' }],
        correctOptionId: 'a',
      })
    ).toThrow(/minimal dua pilihan/);
  });
});

describe('penerbitan ujian', () => {
  it('menolak ujian tanpa soal', () => {
    // Ujian kosong yang terbit menolak setiap peserta yang membukanya,
    // sehingga kesalahannya baru ketahuan dari keluhan peserta.
    //
    // A published empty exam turns away everyone who opens it, so the mistake
    // only surfaces through complaints.
    const hasil = canPublishExam({ questionCount: 0 });
    expect(hasil.allowed).toBe(false);
    expect(hasil.reason).toContain('tanpa soal');
  });

  it('menerima ujian yang sudah bersoal', () => {
    expect(canPublishExam({ questionCount: 1 }).allowed).toBe(true);
  });
});
