// Penyusun laporan feedback kelas untuk dashboard admin / Builds the class feedback report for the admin dashboard
import type { SurveyFormDocument, SurveyQuestionKind, SurveyResponseDocument } from '../survey/types';

export interface FeedbackQuestion {
  id: string;
  text: string;
  kind: SurveyQuestionKind;
}

/** Jumlah jawaban satu pertanyaan dalam satu kelompok / One question's answer tallies within one group */
export interface FeedbackTally {
  sum: number;
  count: number;
  /** Banyaknya tiap nilai atau pilihan / How often each value or option was given */
  dist: Record<string, number>;
}

/**
 * Satu kelompok = satu formulir pada satu pertemuan di satu kelas.
 *
 * Disimpan per kelompok, bukan sudah dijumlah, agar dashboard dapat menyaring
 * per daerah, kelas, dan pertemuan di peramban tanpa membaca ulang jawaban:
 * jumlah yang sudah digabung tidak dapat dipecah lagi.
 *
 * One group = one form at one meeting in one class.
 *
 * Kept per group rather than pre-summed so the dashboard can filter by region,
 * class and meeting in the browser without re-reading responses: a merged
 * total cannot be split again.
 */
export interface FeedbackGroup {
  sessionId: string;
  sessionTitle: string;
  sessionDate: string;
  classId: string;
  className: string;
  city: string;
  responses: number;
  /** Peserta aktif kelas ini yang hadir di pertemuan itu / Active participants of this class present at that meeting */
  attendees: number;
  tallies: Record<string, FeedbackTally>;
}

export interface FeedbackText {
  questionId: string;
  text: string;
  sessionId: string;
  classId: string;
  className: string;
  studentName: string;
  submittedAt: string;
}

export interface FeedbackForm {
  formId: string;
  formTitle: string;
  questions: FeedbackQuestion[];
  groups: FeedbackGroup[];
  texts: FeedbackText[];
  /** Jumlah seluruh masukan tertulis sebelum dipotong batas / Every written answer before the cap */
  textTotal: number;
}

// Batas isian bebas per formulir dan panjang tiap isian: ringkasan disimpan
// sebagai satu dokumen Firestore (batas 1 MB), dan ratusan esai panjang dapat
// menembusnya. Yang terbaru yang disimpan.
//
// Caps on free-text answers per form and each answer's length: the snapshot is
// stored as one Firestore document (1 MB limit), and hundreds of long essays
// could break it. The newest are kept.
const MAX_TEXTS = 300;
const MAX_TEXT_LENGTH = 500;

/**
 * Fungsi murni: seluruh jawaban sudah dibaca oleh penghitung ringkasan.
 *
 * Jawaban isian bebas disimpan beserta nama peserta dan kelasnya, agar admin
 * dapat menindaklanjuti masukan langsung ke orangnya.
 *
 * Pure function: every response is already read by the snapshot computation.
 *
 * Free-text answers are stored with the participant's name and class, so an
 * admin can follow up on a piece of feedback with the person directly.
 */
export function buildFeedbackReport(input: {
  forms: SurveyFormDocument[];
  responses: SurveyResponseDocument[];
  attendeesBySessionClass: Map<string, number>;
  classCities: Map<string, string>;
}): FeedbackForm[] {
  return input.forms.map((form) => {
    const questions: FeedbackQuestion[] = [...form.questions]
      .sort((a, b) => a.order - b.order)
      .map((q) => ({ id: q.id, text: q.text, kind: q.kind }));
    const known = new Set(questions.map((q) => q.id));

    const groups = new Map<string, FeedbackGroup>();
    const texts: FeedbackText[] = [];

    for (const r of input.responses) {
      if (r.formId !== form.id) continue;
      const key = `${r.sessionId}_${r.classId}`;
      let g = groups.get(key);
      if (!g) {
        g = {
          sessionId: r.sessionId,
          sessionTitle: r.sessionTitle,
          sessionDate: r.sessionDate,
          classId: r.classId,
          className: r.className,
          city: input.classCities.get(r.classId) ?? '',
          responses: 0,
          attendees: input.attendeesBySessionClass.get(key) ?? 0,
          tallies: {},
        };
        groups.set(key, g);
      }
      g.responses += 1;

      for (const a of r.answers) {
        // Pertanyaan yang sudah dihapus dari formulir tetap dihitung di bawah
        // teks lamanya, agar jawaban yang terkumpul tidak hilang diam-diam.
        //
        // A question since removed from the form still counts under its old
        // text, so collected answers never vanish quietly.
        if (!known.has(a.questionId)) {
          known.add(a.questionId);
          questions.push({ id: a.questionId, text: a.questionText, kind: a.kind });
        }
        if (a.kind === 'teks') {
          const text = (a.value ?? '').trim();
          if (text) texts.push({ questionId: a.questionId, text: text.slice(0, MAX_TEXT_LENGTH), sessionId: r.sessionId, classId: r.classId, className: r.className, studentName: r.studentName, submittedAt: r.submittedAt });
          continue;
        }
        const t = (g.tallies[a.questionId] ??= { sum: 0, count: 0, dist: {} });
        t.count += 1;
        const n = Number(a.value);
        if (Number.isFinite(n)) t.sum += n;
        t.dist[a.value] = (t.dist[a.value] ?? 0) + 1;
      }
    }

    return {
      formId: form.id,
      formTitle: form.title,
      questions,
      groups: [...groups.values()].sort((a, b) => a.sessionDate.localeCompare(b.sessionDate) || a.className.localeCompare(b.className)),
      texts: texts.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).slice(0, MAX_TEXTS),
      textTotal: texts.length,
    };
  });
}
