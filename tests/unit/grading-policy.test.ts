// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  validateRubricScores,
  rubricToPercent,
  averageRubric,
  averageWithZeros,
  calculateFinalGrade,
  aspectsFor,
} from '@/features/grading/policy';
import {
  GRADE_WEIGHTS,
  CAPSTONE_ASPECTS,
  SHOWCASE_ASPECTS,
  RUBRIC_MIN,
  RUBRIC_MAX,
  type RubricScoreDocument,
} from '@/features/grading/types';

const penuh = (kind: 'capstone' | 'showcase', nilai: number) =>
  Object.fromEntries(aspectsFor(kind).map((a) => [a.id, nilai]));

const penilai = (kind: 'capstone' | 'showcase', nilai: number, id = 'm1'): RubricScoreDocument => ({
  id: `${kind}_s1_${id}`,
  kind,
  studentId: 's1',
  studentName: 'Budi',
  classId: 'c1',
  assessorId: id,
  assessorName: 'Mentor',
  scores: penuh(kind, nilai),
  note: '',
  updatedAt: '2026-10-02T00:00:00.000Z',
});

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
 * Skala 1-4 dipetakan sehingga 1 menjadi 0 dan 4 menjadi 100.
 *
 * Memperlakukan 1-4 sebagai persentase langsung membuat penilaian terbaik
 * bernilai empat dari seratus; membaginya dengan empat membuat penilaian
 * terburuk bernilai dua puluh lima, padahal 1 berarti tidak memenuhi sama
 * sekali.
 *
 * A 1-4 scale maps so 1 becomes 0 and 4 becomes 100.
 *
 * Treating 1-4 as a percentage makes the best assessment worth four out of a
 * hundred; dividing by four makes the worst worth twenty-five, although 1 means
 * not met at all.
 */
describe('konversi skala rubrik', () => {
  it('memetakan nilai terendah ke nol', () => {
    expect(rubricToPercent('capstone', penuh('capstone', RUBRIC_MIN))).toBe(0);
  });

  it('memetakan nilai tertinggi ke seratus', () => {
    expect(rubricToPercent('capstone', penuh('capstone', RUBRIC_MAX))).toBe(100);
  });

  it('memetakan nilai tengah ke sepertiga dan duapertiga', () => {
    expect(rubricToPercent('capstone', penuh('capstone', 2))).toBe(33);
    expect(rubricToPercent('capstone', penuh('capstone', 3))).toBe(67);
  });

  it('tidak memperlakukan angkanya sebagai persentase langsung', () => {
    // Penilaian sempurna tidak boleh bernilai empat dari seratus.
    // A perfect assessment must not be worth four out of a hundred.
    expect(rubricToPercent('capstone', penuh('capstone', 4))).not.toBe(4);
  });

  it('berlaku sama untuk rubrik showcase', () => {
    expect(rubricToPercent('showcase', penuh('showcase', RUBRIC_MIN))).toBe(0);
    expect(rubricToPercent('showcase', penuh('showcase', RUBRIC_MAX))).toBe(100);
  });
});

describe('validasi penilaian rubrik', () => {
  it('menuntut seluruh aspeknya dinilai', () => {
    // Aspek yang dilewatkan tidak dapat dibedakan dari aspek bernilai terendah.
    // An aspect left out cannot be told from one scored lowest.
    const kurang = { ...penuh('capstone', 3) };
    delete kurang[CAPSTONE_ASPECTS[0].id];
    expect(() => validateRubricScores('capstone', kurang)).toThrow(/belum dinilai/);
  });

  it('menolak nilai di luar satu sampai empat', () => {
    for (const n of [0, 5, -1, 2.5]) {
      expect(() => validateRubricScores('capstone', penuh('capstone', n)), String(n)).toThrow(
        /bilangan bulat 1 sampai 4/
      );
    }
  });

  it('membuang aspek yang tidak dikenal', () => {
    // Aspek asing pada muatan kiriman tidak boleh ikut tersimpan dan
    // mengubah pembagi rata-ratanya.
    //
    // An unknown aspect in the payload must not be stored and shift the
    // average's divisor.
    const hasil = validateRubricScores('capstone', { ...penuh('capstone', 3), palsu: 4 });
    expect(Object.keys(hasil).sort()).toEqual(CAPSTONE_ASPECTS.map((a) => a.id).sort());
  });

  it('memakai daftar aspek yang berbeda untuk tiap rubrik', () => {
    expect(aspectsFor('capstone')).toHaveLength(5);
    expect(aspectsFor('showcase')).toHaveLength(4);
    expect(SHOWCASE_ASPECTS.map((a) => a.id)).not.toContain('ai');
  });
});

/**
 * Nilai keluar dari penilai yang sudah menilai, bukan menunggu seluruhnya.
 *
 * Menahan nilai sampai ketiga mentor masuk berarti satu mentor yang belum
 * menilai menahan nilai seluruh kelasnya.
 *
 * A score comes from the assessors who have scored, not from waiting for all.
 *
 * Withholding until all three mentors are in would have one mentor who has not
 * assessed hold back their whole class's scores.
 */
describe('rata-rata beberapa penilai', () => {
  it('merata-rata tiga penilai', () => {
    const hasil = averageRubric('capstone', [
      penilai('capstone', 4, 'm1'),
      penilai('capstone', 4, 'm2'),
      penilai('capstone', 1, 'm3'),
    ]);
    // 100, 100, 0 -> 66,67 dibulatkan 67
    expect(hasil).toBe(67);
  });

  it('tetap menghasilkan nilai dari satu penilai saja', () => {
    expect(averageRubric('capstone', [penilai('capstone', 4)])).toBe(100);
  });

  it('mengembalikan null bila belum ada yang menilai', () => {
    // Null dibedakan dari nol: belum dinilai bukan berarti bernilai nol.
    // Null differs from zero: not yet assessed does not mean scored zero.
    expect(averageRubric('capstone', [])).toBe(null);
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
