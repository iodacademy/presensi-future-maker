// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  validateAssessmentScore,
  averageWithZeros,
  calculateFinalGrade,
} from '@/features/grading/policy';
import { GRADE_WEIGHTS } from '@/features/grading/types';

/**
 * Bobot yang jumlahnya tidak seratus membuat nilai tertinggi yang mungkin
 * dicapai berada di bawah atau di atas seratus.
 *
 * Kesalahan itu baru ketahuan setelah peserta membandingkan nilainya dengan
 * hitungannya sendiri.
 *
 * Weights that do not sum to a hundred put the highest achievable score below
 * or above a hundred.
 *
 * That mistake surfaces only once a participant compares their score against
 * their own arithmetic.
 */
describe('bobot komponen', () => {
  it('berjumlah tepat seratus', () => {
    const total = Object.values(GRADE_WEIGHTS).reduce((t, w) => t + w, 0);
    expect(total).toBe(100);
  });

  it('memberi nilai seratus bila seluruh komponennya sempurna', () => {
    const hasil = calculateFinalGrade({
      capstone: 100, showcase: 100, tasks: 100, attendance: 100, quiz: 100,
    });
    expect(hasil.score).toBe(100);
  });

  it('memberi nilai nol bila seluruh komponennya nol', () => {
    const hasil = calculateFinalGrade({
      capstone: 0, showcase: 0, tasks: 0, attendance: 0, quiz: 0,
    });
    expect(hasil.score).toBe(0);
  });
});

/**
 * Nilai capstone dan showcase diimpor sudah berupa angka 0-100.
 *
 * Penilaiannya terjadi sekali, di ruangan, oleh mentor dan juri yang memegang
 * lembar penilaian sendiri. Yang diperiksa aplikasi tinggal kewarasan
 * angkanya.
 *
 * Capstone and showcase scores are imported as finished 0-100 figures.
 *
 * The assessment happens once, in a room, by mentors and judges holding their
 * own score sheets. All the app checks is whether the number is sane.
 */
describe('validasi nilai yang diimpor', () => {
  it('menerima nol sampai seratus', () => {
    expect(validateAssessmentScore(0, 'capstone')).toBe(0);
    expect(validateAssessmentScore(100, 'capstone')).toBe(100);
    expect(validateAssessmentScore(85, 'capstone')).toBe(85);
  });

  it('menerima angka dalam bentuk teks', () => {
    // Excel mengirim selnya sebagai teks pada berkas CSV.
    // Excel sends its cells as text in a CSV file.
    expect(validateAssessmentScore('85', 'capstone')).toBe(85);
    expect(validateAssessmentScore(' 85 ', 'capstone')).toBe(85);
  });

  it('menolak nilai di luar rentangnya', () => {
    // Nilai di luar nol sampai seratus membuat nilai akhirnya melampaui batas
    // atau jatuh di bawah nol.
    //
    // A score outside zero to a hundred would push the final past its limit or
    // below zero.
    expect(() => validateAssessmentScore(101, 'capstone')).toThrow(/antara 0 dan 100/);
    expect(() => validateAssessmentScore(-1, 'capstone')).toThrow(/antara 0 dan 100/);
  });

  it('menolak yang bukan angka', () => {
    for (const v of ['belum dinilai', {}, true]) {
      expect(() => validateAssessmentScore(v, 'capstone'), String(v)).toThrow(/harus berupa angka/);
    }
  });

  it('menolak sel kosong dengan pesannya sendiri', () => {
    // Number('') bernilai nol, bukan NaN, sehingga peserta yang belum dinilai
    // akan tercatat nol -- nilai sah yang terbaca sebagai gagal total, dan
    // tidak dapat dibedakan dari nilai nol yang memang diberikan penilainya.
    //
    // Number('') is zero, not NaN, so a participant not yet assessed would be
    // recorded as zero -- a valid score that reads as total failure,
    // indistinguishable from a zero their assessor actually gave.
    for (const v of ['', '   ', null, undefined]) {
      expect(() => validateAssessmentScore(v, 'capstone'), String(v)).toThrow(/masih kosong/);
    }
  });

  it('membulatkan ke satu angka di belakang koma', () => {
    // Nilai 83,333333 dari pembagian di Excel tidak perlu disimpan seutuhnya,
    // dan angka panjang pada layar terbaca seperti ketelitian yang tidak
    // dimilikinya.
    //
    // An 83.333333 from a division in Excel need not be stored whole, and a
    // long number on screen reads as a precision it does not have.
    expect(validateAssessmentScore(83.333333, 'capstone')).toBe(83.3);
    expect(validateAssessmentScore(83.35, 'capstone')).toBe(83.4);
  });

  it('menyebut komponen yang bermasalah pada pesannya', () => {
    // "Nilai harus antara 0 dan 100" tidak memberi tahu kolom mana yang salah
    // saat dua kolom diimpor sekaligus.
    //
    // "Score must be between 0 and 100" does not say which column is wrong when
    // two are imported at once.
    expect(() => validateAssessmentScore(200, 'showcase')).toThrow(/showcase/);
  });
});

describe('rata-rata dengan nilai nol', () => {
  it('menghitung yang tidak dikumpulkan sebagai nol', () => {
    // Peserta yang melewatkan separuh tugas tidak boleh bernilai sama dengan
    // yang mengerjakan seluruhnya.
    //
    // A participant who skipped half their tasks must not score the same as
    // one who did all of them.
    expect(averageWithZeros([90, null, 90], 3)).toBe(60);
  });

  it('memakai jumlah yang seharusnya sebagai pembagi', () => {
    // Memakai panjang daftarnya membuat peserta yang tugasnya belum dibuka
    // bernilai penuh.
    //
    // Using the list's length would give a participant whose tasks are not yet
    // open a full score.
    expect(averageWithZeros([100], 4)).toBe(25);
  });

  it('memakai panjang daftar bila melebihi jumlah yang diharapkan', () => {
    // Tugas tambahan di luar rencana tidak boleh membuat nilainya melampaui
    // seratus.
    //
    // Extra tasks beyond the plan must not push the score past a hundred.
    expect(averageWithZeros([100, 100, 100], 2)).toBe(100);
  });

  it('aman terhadap daftar kosong', () => {
    expect(averageWithZeros([], 0)).toBe(0);
  });
});

/**
 * Komponen yang belum dinilai dihitung nol tetapi dicatat tertunda.
 *
 * Mengecualikannya dari pembagi membuat nilai sementara terbaca tinggi lalu
 * turun begitu capstone-nya dinilai -- peserta melihat nilainya seolah
 * berkurang karena dinilai.
 *
 * An unassessed component counts as zero but is recorded as pending.
 *
 * Excluding it from the divisor would make a provisional score read high and
 * then fall once the capstone is assessed -- a participant would see their
 * score drop because they were assessed.
 */
describe('nilai akhir', () => {
  it('membobot tiap komponen menurut bobotnya', () => {
    const hasil = calculateFinalGrade({
      capstone: 80, showcase: 60, tasks: 90, attendance: 100, quiz: 70,
    });
    // 80x0,35 + 90x0,25 + 60x0,15 + 100x0,15 + 70x0,10 = 28+22,5+9+15+7 = 81,5
    expect(hasil.score).toBe(82);
  });

  it('mencatat komponen yang belum dinilai', () => {
    const hasil = calculateFinalGrade({
      capstone: null, showcase: null, tasks: 90, attendance: 100, quiz: 70,
    });
    expect(hasil.pending.sort()).toEqual(['capstone', 'showcase']);
  });

  it('tidak menaikkan nilai dengan mengecualikan yang belum dinilai', () => {
    // Nilai sementara yang tinggi lalu turun membuat peserta mengira dinilai
    // merugikannya.
    //
    // A high provisional score that then falls makes a participant think being
    // assessed hurt them.
    const belum = calculateFinalGrade({
      capstone: null, showcase: null, tasks: 100, attendance: 100, quiz: 100,
    });
    const sudah = calculateFinalGrade({
      capstone: 50, showcase: 50, tasks: 100, attendance: 100, quiz: 100,
    });
    expect(sudah.score).toBeGreaterThan(belum.score);
  });

  it('merinci sumbangan tiap komponen', () => {
    const hasil = calculateFinalGrade({
      capstone: 100, showcase: 0, tasks: 0, attendance: 0, quiz: 0,
    });
    const capstone = hasil.breakdown.find((b) => b.component === 'capstone')!;
    expect(capstone.weighted).toBe(35);
    expect(hasil.score).toBe(35);
  });

  it('membatasi nilai komponen pada nol sampai seratus', () => {
    // Nilai di luar rentang membuat nilai akhirnya melampaui seratus atau
    // jatuh di bawah nol.
    //
    // A score outside the range would push the final past a hundred or below
    // zero.
    const hasil = calculateFinalGrade({
      capstone: 150, showcase: -20, tasks: 100, attendance: 100, quiz: 100,
    });
    expect(hasil.score).toBeLessThanOrEqual(100);
    expect(hasil.breakdown.find((b) => b.component === 'showcase')!.score).toBe(0);
  });

  it('merinci seluruh komponen yang berbobot', () => {
    const hasil = calculateFinalGrade({
      capstone: 0, showcase: 0, tasks: 0, attendance: 0, quiz: 0,
    });
    expect(hasil.breakdown).toHaveLength(Object.keys(GRADE_WEIGHTS).length);
  });
});
