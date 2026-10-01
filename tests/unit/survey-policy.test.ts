// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  validateSurveyQuestion,
  canPublishForm,
  validateResponses,
  summariseAnswers,
} from '@/features/survey/policy';
import type { SurveyQuestion } from '@/features/survey/types';

const soal = (over: Partial<SurveyQuestion> = {}): SurveyQuestion => ({
  id: 'q1',
  kind: 'skala',
  text: 'Materi hari ini mudah dipahami?',
  options: [],
  required: true,
  order: 1,
  ...over,
});

describe('validasi pertanyaan survei', () => {
  it('menolak pertanyaan kosong', () => {
    expect(() => validateSurveyQuestion({ kind: 'skala', text: '  ', options: [] })).toThrow(/wajib diisi/);
  });

  it('menuntut dua pilihan pada pertanyaan pilihan', () => {
    expect(() => validateSurveyQuestion({ kind: 'pilihan', text: 'Pilih?', options: ['A'] })).toThrow(/minimal dua/);
  });

  it('membuang pilihan kosong sebelum menghitungnya', () => {
    expect(() =>
      validateSurveyQuestion({ kind: 'pilihan', text: 'Pilih?', options: ['A', '  ', ''] })
    ).toThrow(/minimal dua/);
  });

  it('mengosongkan pilihan pada jenis yang tidak memakainya', () => {
    // Pilihan yang tersimpan lalu jenisnya diganti akan muncul kembali bila
    // jenisnya dikembalikan, padahal admin mengira sudah menghapusnya.
    //
    // Options kept after switching kind reappear if the kind is switched back,
    // although the admin believed they were gone.
    expect(validateSurveyQuestion({ kind: 'skala', text: 'Nilai?', options: ['A', 'B'] }).options).toEqual([]);
    expect(validateSurveyQuestion({ kind: 'teks', text: 'Masukan?', options: ['A'] }).options).toEqual([]);
  });
});

describe('penerbitan formulir', () => {
  it('menolak formulir tanpa pertanyaan', () => {
    // Formulir kosong yang terbit menagih peserta mengisi layar kosong.
    // A published empty form asks participants to fill in an empty screen.
    const hasil = canPublishForm([]);
    expect(hasil.allowed).toBe(false);
    expect(hasil.reason).toContain('tanpa pertanyaan');
  });

  it('menerima formulir yang sudah berisi', () => {
    expect(canPublishForm([soal()]).allowed).toBe(true);
  });
});

/**
 * Formulirnya satu dan dipakai berbulan-bulan, sehingga pertanyaannya pasti
 * berubah di tengah jalan.
 *
 * Tanpa salinan teks pertanyaan pada jawabannya, jawaban lama akan tampil di
 * bawah pertanyaan yang tidak pernah dibaca orang yang menjawabnya.
 *
 * There is one form used over months, so its questions will change partway
 * through.
 *
 * Without a copy of the question text on the answer, an old answer would
 * appear beneath a question its author never read.
 */
describe('penyalinan pertanyaan ke jawabannya', () => {
  it('menyalin teks pertanyaannya, bukan hanya id-nya', () => {
    const hasil = validateResponses([soal()], { q1: '4' });
    expect(hasil[0].questionText).toBe('Materi hari ini mudah dipahami?');
    expect(hasil[0].questionId).toBe('q1');
  });

  it('menyimpan jenisnya agar rekapnya tahu cara membacanya', () => {
    // Angka 4 pada skala dirata-rata; angka 4 pada isian bebas adalah teks.
    // A 4 on a scale is averaged; a 4 in free text is just text.
    expect(validateResponses([soal()], { q1: '4' })[0].kind).toBe('skala');
  });
});

describe('pemeriksaan jawaban peserta', () => {
  it('menolak pertanyaan wajib yang kosong', () => {
    // Tombol yang dinonaktifkan tidak menahan siapa pun yang memanggil
    // endpointnya langsung.
    //
    // A disabled button holds back nobody who calls the endpoint directly.
    expect(() => validateResponses([soal()], {})).toThrow(/wajib dijawab/);
    expect(() => validateResponses([soal()], { q1: '   ' })).toThrow(/wajib dijawab/);
  });

  it('melewatkan pertanyaan tidak wajib yang kosong', () => {
    expect(validateResponses([soal({ required: false })], {})).toEqual([]);
  });

  it('menolak skala di luar satu sampai lima', () => {
    for (const nilai of ['0', '6', '-1', '3.5', 'empat']) {
      expect(() => validateResponses([soal()], { q1: nilai }), nilai).toThrow(/angka 1 sampai 5/);
    }
  });

  it('menerima seluruh nilai skala yang sah', () => {
    for (const nilai of ['1', '2', '3', '4', '5']) {
      expect(validateResponses([soal()], { q1: nilai })[0].value).toBe(nilai);
    }
  });

  it('menolak jawaban di luar daftar pilihannya', () => {
    // Jawaban di luar daftar membuat rekapnya memuat kategori yang tidak
    // pernah ditawarkan kepada peserta lain.
    //
    // An answer outside the list leaves the report holding a category never
    // offered to anyone else.
    const q = soal({ kind: 'pilihan', options: ['Ya', 'Tidak'] });
    expect(() => validateResponses([q], { q1: 'Mungkin' })).toThrow(/tidak ada di antara pilihannya/);
    expect(validateResponses([q], { q1: 'Ya' })[0].value).toBe('Ya');
  });

  it('menerima isian bebas apa adanya', () => {
    const q = soal({ kind: 'teks' });
    expect(validateResponses([q], { q1: '  Materinya terlalu cepat  ' })[0].value).toBe('Materinya terlalu cepat');
  });

  it('mengabaikan jawaban atas pertanyaan yang tidak ada di formulir', () => {
    // Muatan dapat memuat id lama dari formulir versi sebelumnya.
    // A payload can carry old ids from an earlier form version.
    const hasil = validateResponses([soal()], { q1: '3', 'q-lama': '5' });
    expect(hasil).toHaveLength(1);
  });
});

describe('rangkuman rekap', () => {
  const jawaban = (text: string, value: string, kind: 'skala' | 'pilihan' | 'teks' = 'skala') => ({
    questionId: 'q1',
    questionText: text,
    kind,
    value,
  });

  it('merata-rata pertanyaan skala', () => {
    const hasil = summariseAnswers([jawaban('Mudah?', '4'), jawaban('Mudah?', '5'), jawaban('Mudah?', '3')]);
    expect(hasil[0].average).toBe(4);
    expect(hasil[0].count).toBe(3);
  });

  it('membulatkan rata-rata ke satu angka di belakang koma', () => {
    const hasil = summariseAnswers([jawaban('Mudah?', '4'), jawaban('Mudah?', '5')]);
    expect(hasil[0].average).toBe(4.5);
  });

  it('mengurutkan sebaran skala menurut angkanya', () => {
    const hasil = summariseAnswers([jawaban('Mudah?', '5'), jawaban('Mudah?', '1'), jawaban('Mudah?', '3')]);
    expect(hasil[0].distribution.map((d) => d.label)).toEqual(['1', '3', '5']);
  });

  it('memisahkan pertanyaan yang teksnya berbeda', () => {
    // Menggabungkan jawaban atas dua kalimat berbeda menyembunyikan bahwa
    // keduanya menanyakan hal berbeda.
    //
    // Merging answers to two different sentences hides that they asked
    // different things.
    const hasil = summariseAnswers([jawaban('Materi mudah?', '4'), jawaban('Materi sesi ini mudah?', '5')]);
    expect(hasil).toHaveLength(2);
  });

  it('tidak merata-rata isian bebas', () => {
    const hasil = summariseAnswers([jawaban('Masukan?', 'Terlalu cepat', 'teks')]);
    expect(hasil[0].average).toBe(null);
    expect(hasil[0].texts).toEqual(['Terlalu cepat']);
  });

  it('mengurutkan sebaran pilihan menurut jumlahnya', () => {
    const hasil = summariseAnswers([
      jawaban('Ikut lagi?', 'Ya', 'pilihan'),
      jawaban('Ikut lagi?', 'Tidak', 'pilihan'),
      jawaban('Ikut lagi?', 'Ya', 'pilihan'),
    ]);
    expect(hasil[0].distribution[0]).toEqual({ label: 'Ya', count: 2 });
  });
});
