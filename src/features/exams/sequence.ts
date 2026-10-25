// Aturan urutan dan jadwal pengerjaan kuis peserta / Participant quiz order and schedule rules
import type { ExamKind } from './types';

export interface SequenceExam {
  id: string;
  title: string;
  kind: ExamKind;
  sessionId: string | null;
  questionCount: number;
  /** Batas pengumpulan ISO, bila ada / Submission deadline as ISO, if any */
  dueAt?: string | null;
}

export type ExamLock =
  | { locked: false }
  /** Pertemuannya belum dimulai / Its meeting has not started yet */
  | { locked: true; reason: 'jadwal'; availableFrom: string }
  /** Kuis sebelumnya belum dikerjakan / An earlier quiz is not done yet */
  | { locked: true; reason: 'urutan'; waitingFor: string }
  /** Postest menunggu pretest / The posttest is waiting on the pretest */
  | { locked: true; reason: 'pretest'; waitingFor: string; availableFrom: string | null };

/**
 * Mengurutkan kuis menjadi satu jalur: pretest, kuis sesi menurut tanggal
 * pertemuannya, lalu postest.
 *
 * Orders quizzes into one path: pretest, session quizzes by their meeting date,
 * then posttest.
 */
export function orderExams<T extends SequenceExam>(exams: T[], sessionStart: Map<string, string>): T[] {
  const rank = (e: T) => (e.kind === 'pretest' ? 0 : e.kind === 'posttest' ? 2 : 1);
  return [...exams].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (sessionStart.get(a.sessionId ?? '') ?? '9999').localeCompare(sessionStart.get(b.sessionId ?? '') ?? '9999') ||
      a.title.localeCompare(b.title, 'id')
  );
}

/**
 * Menentukan kuis mana yang terkunci bagi seorang peserta.
 *
 * - Pretest selalu terbuka: ia mengukur titik awal, jadi harus dapat
 *   dikerjakan paling dulu.
 * - Kuis sesi terbuka sejak pertemuannya dimulai, dan hanya bila seluruh
 *   kuis sebelumnya di jalur sudah dikerjakan. Kuis yang terlewat tetap dapat
 *   dikejar sesudahnya; menguncinya lagi setelah sesi berakhir membuat peserta
 *   yang absen tidak pernah dapat menyelesaikan jalurnya.
 * - Postest terbuka setelah pretest dikerjakan dan pertemuan materi terakhir
 *   ("Pertemuan N" bernomor terbesar) selesai. Showcase dan kelas karier
 *   sesudahnya bukan materi yang diukur postest, jadi tidak perlu ditunggu.
 *   Tanpa pertemuan bernomor, postest terbuka saat pertemuan terakhir dimulai.
 *
 * "Dikerjakan" berarti punya percobaan yang selesai, lulus atau tidak: syarat
 * kelulusan akan mengunci peserta yang kesempatannya sudah habis. Kuis tanpa
 * soal dan kuis yang sudah lewat batas waktunya tidak dapat dikerjakan lagi,
 * sehingga tidak dijadikan syarat: menjadikannya syarat mengunci seluruh kuis
 * sesudahnya selamanya.
 *
 * Determines which quizzes are locked for one participant.
 *
 * - The pretest is always open: it measures the starting point, so it must be
 *   doable first.
 * - A session quiz opens once its meeting starts, and only when every earlier
 *   quiz on the path is done. A missed quiz can still be caught up afterwards;
 *   relocking it after the session ends would leave an absent participant
 *   unable to ever finish the path.
 * - The posttest opens once the pretest is done and the last material meeting
 *   (the highest-numbered "Pertemuan N") has ended. The showcase and career
 *   classes after it are not material the posttest measures, so they are not
 *   waited for. Without numbered meetings, it opens when the last meeting starts.
 *
 * "Done" means having a finished attempt, passed or not: requiring a pass would
 * lock out a participant whose attempts ran out. A quiz with no questions and a
 * quiz past its deadline can no longer be done, so neither is made a
 * prerequisite: doing so would lock every later quiz forever.
 */
export function computeExamLocks(input: {
  exams: SequenceExam[];
  sessions: { id: string; startsAt: string; title?: string; endsAt?: string }[];
  finishedExamIds: Set<string>;
  nowIso: string;
}): Map<string, ExamLock> {
  const { nowIso, finishedExamIds } = input;
  const required = (e: SequenceExam) =>
    e.questionCount > 0 && !finishedExamIds.has(e.id) && !(e.dueAt && e.dueAt < nowIso);
  const sessionStart = new Map(input.sessions.map((s) => [s.id, s.startsAt]));
  const lastStart = input.sessions.map((s) => s.startsAt).sort().at(-1) ?? null;
  const nomor = (s: { title?: string }) => Number(/^Pertemuan\s+(\d+)/i.exec(s.title ?? '')?.[1] ?? 0);
  const materiTerakhir = input.sessions.filter((s) => nomor(s) > 0 && s.endsAt).sort((a, b) => nomor(b) - nomor(a))[0];
  const postestBuka = materiTerakhir?.endsAt ?? lastStart;
  const ordered = orderExams(input.exams, sessionStart);
  const locks = new Map<string, ExamLock>();

  const pretests = ordered.filter((e) => e.kind === 'pretest' && e.questionCount > 0);
  const pendingPretest = pretests.find(required);

  let earlierUnfinished: SequenceExam | undefined = pendingPretest;
  for (const e of ordered) {
    if (e.kind === 'pretest') {
      locks.set(e.id, { locked: false });
      continue;
    }

    if (e.kind === 'posttest') {
      if (pendingPretest) {
        locks.set(e.id, { locked: true, reason: 'pretest', waitingFor: pendingPretest.title, availableFrom: postestBuka });
      } else if (postestBuka && postestBuka > nowIso) {
        locks.set(e.id, { locked: true, reason: 'jadwal', availableFrom: postestBuka });
      } else {
        locks.set(e.id, { locked: false });
      }
      continue;
    }

    const start = e.sessionId ? sessionStart.get(e.sessionId) : undefined;
    if (start && start > nowIso) {
      locks.set(e.id, { locked: true, reason: 'jadwal', availableFrom: start });
    } else if (earlierUnfinished) {
      locks.set(e.id, { locked: true, reason: 'urutan', waitingFor: earlierUnfinished.title });
    } else {
      locks.set(e.id, { locked: false });
    }
    if (!earlierUnfinished && required(e)) earlierUnfinished = e;
  }
  return locks;
}

/** Pesan penolakan untuk kuis yang terkunci / The refusal message for a locked quiz */
export function lockMessage(lock: ExamLock, formatDate: (iso: string) => string): string | null {
  if (!lock.locked) return null;
  if (lock.reason === 'jadwal') return `Dapat dikerjakan mulai ${formatDate(lock.availableFrom)}.`;
  if (lock.reason === 'urutan') return `Selesaikan "${lock.waitingFor}" lebih dulu.`;
  return `Kerjakan "${lock.waitingFor}" lebih dulu${lock.availableFrom ? `; postest dibuka ${formatDate(lock.availableFrom)}` : ''}.`;
}
