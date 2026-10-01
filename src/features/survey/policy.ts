// Aturan formulir survei / Survey form rules
import { NUMERIC_KINDS, type SurveyAnswer, type SurveyQuestion, type SurveyQuestionKind, type SurveyScope } from './types';

/** Nilai yang sah untuk pertanyaan skala / Valid values for a scale question */
export const SCALE_MIN = 1;
export const SCALE_MAX = 5;

/**
 * Memvalidasi satu pertanyaan survei.
 *
 * Validates one survey question.
 */
export function validateSurveyQuestion(input: {
  kind: SurveyQuestionKind;
  text: string;
  options: string[];
}): { kind: SurveyQuestionKind; text: string; options: string[] } {
  const text = input.text.trim();
  if (!text) {
    throw new Error('Pertanyaan wajib diisi');
  }

  if (input.kind === 'pilihan') {
    const options = input.options.map((o) => o.trim()).filter(Boolean);
    if (options.length < 2) {
      throw new Error('Pertanyaan pilihan membutuhkan minimal dua pilihan');
    }
    return { kind: input.kind, text, options };
  }

  // Skala, bintang, dan isian bebas tidak punya pilihan. Menyimpan pilihan
  // yang pernah diketik lalu jenisnya diganti membuat pilihan itu muncul
  // kembali bila jenisnya dikembalikan, padahal admin mengira sudah
  // menghapusnya.
  //
  // Scale, stars, and free text have no options. Keeping options typed earlier
  // and then switched away from makes them reappear if the kind is switched
  // back, although the admin believed they were gone.
  return { kind: input.kind, text, options: [] };
}

/**
 * Memeriksa apakah formulir layak diterbitkan.
 *
 * Checks whether the form is fit to publish.
 */
export function canPublishForm(questions: SurveyQuestion[]): { allowed: boolean; reason?: string } {
  if (questions.length < 1) {
    return { allowed: false, reason: 'Formulir tanpa pertanyaan tidak dapat diterbitkan' };
  }
  return { allowed: true };
}

/**
 * Memeriksa jawaban peserta terhadap pertanyaan formulir.
 *
 * Pertanyaan wajib yang kosong ditolak di sini, bukan hanya di peramban:
 * tombol yang dinonaktifkan tidak menahan siapa pun yang memanggil endpointnya
 * langsung.
 *
 * Checks a participant's answers against the form's questions.
 *
 * Required questions left blank are refused here, not only in the browser: a
 * disabled button holds back nobody who calls the endpoint directly.
 */
export function validateResponses(
  questions: SurveyQuestion[],
  raw: Record<string, string>
): SurveyAnswer[] {
  const answers: SurveyAnswer[] = [];

  for (const q of questions) {
    const value = (raw[q.id] ?? '').trim();

    if (!value) {
      if (q.required) {
        throw new Error(`Pertanyaan "${q.text}" wajib dijawab`);
      }
      continue;
    }

    if (NUMERIC_KINDS.includes(q.kind)) {
      const angka = Number(value);
      if (!Number.isInteger(angka) || angka < SCALE_MIN || angka > SCALE_MAX) {
        throw new Error(`Jawaban "${q.text}" harus berupa angka ${SCALE_MIN} sampai ${SCALE_MAX}`);
      }
    }

    if (q.kind === 'pilihan' && !q.options.includes(value)) {
      // Jawaban di luar daftar membuat rekapnya memuat kategori yang tidak
      // pernah ditawarkan kepada peserta lain.
      //
      // An answer outside the list leaves the report holding a category never
      // offered to anyone else.
      throw new Error(`Jawaban "${q.text}" tidak ada di antara pilihannya`);
    }

    answers.push({
      questionId: q.id,
      // Teks pertanyaannya disalin ke jawabannya. Formulirnya dipakai
      // berbulan-bulan dan pasti berubah; tanpa salinan ini jawaban lama akan
      // tampil di bawah pertanyaan yang tidak pernah dibaca penjawabnya.
      //
      // The question text is copied onto the answer. The form is used over
      // months and will change; without this copy an old answer would appear
      // beneath a question its author never read.
      questionText: q.text,
      kind: q.kind,
      value,
    });
  }

  return answers;
}

/**
 * Merangkum jawaban sebuah pertanyaan untuk rekap admin.
 *
 * Dikelompokkan menurut teks pertanyaannya, bukan id-nya: pertanyaan yang
 * disunting menghasilkan dua kelompok terpisah, dan itu memang yang
 * dikehendaki -- menggabungkan jawaban atas dua kalimat berbeda menyembunyikan
 * bahwa keduanya menanyakan hal berbeda.
 *
 * Summarises one question's answers for the admin report.
 *
 * Grouped by question text rather than id: an edited question yields two
 * separate groups, which is intended -- merging answers to two different
 * sentences hides that they asked different things.
 */
export function summariseAnswers(answers: SurveyAnswer[]): {
  questionText: string;
  kind: SurveyQuestionKind;
  count: number;
  average: number | null;
  distribution: { label: string; count: number }[];
  texts: string[];
}[] {
  const groups = new Map<string, SurveyAnswer[]>();
  for (const a of answers) {
    const key = `${a.kind}:${a.questionText}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(a);
  }

  return [...groups.values()].map((list) => {
    const { questionText, kind } = list[0];

    if (kind === 'teks') {
      return {
        questionText,
        kind,
        count: list.length,
        average: null,
        distribution: [],
        texts: list.map((a) => a.value),
      };
    }

    const hitung = new Map<string, number>();
    for (const a of list) {
      hitung.set(a.value, (hitung.get(a.value) ?? 0) + 1);
    }

    const distribution = [...hitung.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) =>
        NUMERIC_KINDS.includes(kind) ? Number(a.label) - Number(b.label) : b.count - a.count
      );

    const average = NUMERIC_KINDS.includes(kind)
      ? Math.round((list.reduce((t, a) => t + Number(a.value), 0) / list.length) * 10) / 10
      : null;

    return { questionText, kind, count: list.length, average, distribution, texts: [] };
  });
}

/**
 * Memeriksa apakah sebuah formulir berlaku bagi satu pertemuan.
 *
 * Daftar kosong berarti seluruhnya. Menyimpan seluruh id kelas saat admin
 * memilih "semua kelas" akan membekukan daftarnya pada saat penyimpanan,
 * sehingga kelas yang dibuat kemudian tidak pernah mendapat surveinya --
 * kesalahan yang baru ketahuan berbulan-bulan kemudian saat angkatan
 * berikutnya dibuka.
 *
 * Checks whether a form applies to one meeting.
 *
 * An empty list means all of them. Storing every class id when an admin picks
 * "all classes" would freeze the list at save time, so a class created later
 * would never receive the survey -- a mistake that only surfaces months on,
 * when the next cohort opens.
 */
export function scopeCovers(scope: SurveyScope, classId: string, sessionId: string): boolean {
  const kelasCocok = scope.classIds.length === 0 || scope.classIds.includes(classId);
  const sesiCocok = scope.sessionIds.length === 0 || scope.sessionIds.includes(sessionId);
  return kelasCocok && sesiCocok;
}

/**
 * Menjelaskan cakupan sebuah formulir dalam satu kalimat.
 *
 * Daftar id tidak terbaca siapa pun; admin perlu tahu formulirnya mengenai
 * siapa tanpa membuka pengaturannya satu per satu.
 *
 * Describes a form's scope in one sentence.
 *
 * A list of ids reads to nobody; an admin needs to know who a form covers
 * without opening each one's settings.
 */
export function describeScope(
  scope: SurveyScope,
  classNames: Map<string, string>,
  sessionTitles: Map<string, string>
): string {
  const kelas =
    scope.classIds.length === 0
      ? 'Semua kelas'
      : scope.classIds.map((id) => classNames.get(id) ?? id).join(', ');

  const sesi =
    scope.sessionIds.length === 0
      ? 'semua pertemuan'
      : scope.sessionIds.length <= 2
        ? scope.sessionIds.map((id) => sessionTitles.get(id) ?? id).join(', ')
        : `${scope.sessionIds.length} pertemuan`;

  return `${kelas} - ${sesi}`;
}
