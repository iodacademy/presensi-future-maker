// Aturan perhitungan nilai akhir / Final score calculation rules
import { countsAfterJoin } from '../users/join-policy';
import type { AttendanceStatus } from '../attendance/types';
import { GRADE_WEIGHTS, type ComponentBreakdown, type GradeComponent } from './types';

/**
 * Memvalidasi nilai capstone yang diimpor.
 *
 * Diperiksa di sini meski berkasnya sudah diurai di peramban: muatan yang
 * dikirim ke endpoint dapat diubah sebelum tiba, dan nilai di luar nol sampai
 * seratus membuat nilai akhirnya melampaui batas atau jatuh di bawah nol.
 *
 * Validates an imported capstone score.
 *
 * Checked here although the file is parsed in the browser: the payload sent to
 * the endpoint can be altered before it arrives, and a score outside zero to a
 * hundred would push the final past its limit or below zero.
 */
export function validateAssessmentScore(value: unknown, label: string): number {
  // Sel kosong diperiksa lebih dulu. Number('') bernilai nol, bukan NaN,
  // sehingga peserta yang belum dinilai akan tercatat nol -- nilai sah yang
  // terbaca sebagai gagal total, dan tidak dapat dibedakan dari nilai nol yang
  // memang diberikan penilainya.
  //
  // Empty cells are checked first. Number('') is zero, not NaN, so a
  // participant not yet assessed would be recorded as zero -- a valid score
  // that reads as total failure, indistinguishable from a zero their assessor
  // actually gave.
  const mentah = typeof value === 'number' ? value : String(value ?? '').trim();
  if (mentah === '') {
    throw new Error(`Nilai ${label} masih kosong`);
  }

  const angka = typeof mentah === 'number' ? mentah : Number(mentah);

  if (!Number.isFinite(angka)) {
    throw new Error(`Nilai ${label} harus berupa angka`);
  }

  if (angka < 0 || angka > 100) {
    throw new Error(`Nilai ${label} harus antara 0 dan 100`);
  }

  // Dibulatkan ke satu angka di belakang koma: nilai 83,333333 dari pembagian
  // di Excel tidak perlu disimpan seutuhnya, dan angka panjang pada layar
  // terbaca seperti ketelitian yang tidak dimilikinya.
  //
  // Rounded to one decimal: an 83.333333 from a division in Excel need not be
  // stored whole, and a long number on screen reads as a precision it does not
  // have.
  return Math.round(angka * 10) / 10;
}

/**
 * Menghitung nilai sebuah komponen berbasis daftar nilai.
 *
 * Yang tidak dikumpulkan atau tidak dikerjakan dihitung nol, bukan
 * dikecualikan: peserta yang melewatkan separuh tugas tidak boleh bernilai
 * sama dengan yang mengerjakan seluruhnya.
 *
 * Computes a list-based component's score.
 *
 * What was never submitted or taken counts as zero rather than being excluded:
 * a participant who skipped half their tasks must not score the same as one who
 * did all of them.
 */
export function averageWithZeros(scores: (number | null)[], expectedCount: number): number {
  // Pembaginya jumlah yang seharusnya ada, bukan jumlah yang ada. Memakai
  // panjang daftarnya membuat peserta yang tugasnya belum dibuka bernilai
  // penuh.
  //
  // The divisor is how many there should be, not how many there are. Using the
  // list's length would give a participant whose tasks are not yet open a full
  // score.
  const pembagi = Math.max(expectedCount, scores.length);
  if (pembagi === 0) return 0;

  const total = scores.reduce<number>((t, s) => t + (s ?? 0), 0);
  return Math.round(total / pembagi);
}

/**
 * Menyusun nilai akhir dari seluruh komponennya.
 *
 * Komponen yang belum punya nilai dihitung nol tetapi dicatat sebagai
 * tertunda. Mengecualikannya dari pembagi akan membuat nilai sementara terbaca
 * tinggi lalu turun begitu capstone-nya dinilai -- peserta melihat nilainya
 * seolah berkurang karena dinilai.
 *
 * Assembles the final score from its components.
 *
 * A component with no score counts as zero but is recorded as pending.
 * Excluding it from the divisor would make a provisional score read high and
 * then fall once the capstone is assessed -- a participant would see their
 * score drop because they were assessed.
 */
export function calculateFinalGrade(input: {
  capstone: number | null;
  tasks: number | null;
  attendance: number | null;
  quiz: number | null;
  details?: Partial<Record<GradeComponent, string>>;
}): { score: number; breakdown: ComponentBreakdown[]; pending: GradeComponent[] } {
  const nilai: Record<GradeComponent, number | null> = {
    capstone: input.capstone,
    tasks: input.tasks,
    attendance: input.attendance,
    quiz: input.quiz,
  };

  const pending: GradeComponent[] = [];
  const breakdown: ComponentBreakdown[] = [];
  let total = 0;

  for (const komponen of Object.keys(GRADE_WEIGHTS) as GradeComponent[]) {
    const weight = GRADE_WEIGHTS[komponen];
    const n = nilai[komponen];

    if (n === null) pending.push(komponen);

    const score = Math.max(0, Math.min(100, n ?? 0));
    const weighted = (score * weight) / 100;
    total += weighted;

    breakdown.push({
      component: komponen,
      score,
      weight,
      weighted: Math.round(weighted * 10) / 10,
      detail: input.details?.[komponen] ?? '',
    });
  }

  return { score: Math.round(total), breakdown, pending };
}

/**
 * Nilai akhir satu peserta dari data mentahnya.
 *
 * Dipakai halaman Nilai Akhir dan peringkat dashboard. Keduanya membaca data
 * dengan bentuk berbeda, tetapi aturannya harus satu: peringkat yang dihitung
 * terpisah lambat laun menunjukkan angka yang berbeda dari nilai resminya.
 *
 * One participant's final score from their raw data.
 *
 * Used by the Final Score page and the dashboard ranking. Each reads its data
 * in a different shape, but the rules must be one: a ranking computed
 * separately drifts into showing figures that differ from the official score.
 */
export function gradeParticipant(input: {
  sessions: { id: string; endsAt: string; title?: string }[];
  joinIso: string;
  recorded: (sessionId: string) => boolean;
  present: (sessionId: string) => boolean;
  taskIds: string[];
  taskScore: (taskId: string) => number | null;
  examIds: string[];
  quizScore: (examId: string) => number | null;
  capstoneTaskIds: string[];
  /** Nilai capstone dari impor Excel / The capstone score from the Excel import */
  capstone: number | null;
}): { score: number; breakdown: ComponentBreakdown[]; pending: GradeComponent[] } {
  // Pertemuan yang berakhir sebelum peserta bergabung tidak dihitung kecuali
  // ia tercatat di sana. / Meetings that ended before the participant joined
  // do not count unless they are recorded there.
  //
  // Hanya sesi berjudul "Pertemuan N" yang dinilai: onboarding, kelas karier,
  // dan showcase bukan pertemuan materi. Di Semarang onboarding digabung dengan
  // "Pertemuan 1" dalam satu sesi, jadi judulnya dicari di mana saja.
  //
  // Only sessions titled "Pertemuan N" are graded: onboarding, career classes
  // and the showcase are not material meetings. In Semarang onboarding shares
  // one session with "Pertemuan 1", so the title is matched anywhere.
  const sesi = gradedMeetings(input.sessions, input.joinIso, input.recorded);
  const hadir = sesi.filter((s) => input.present(s.id)).length;

  // Tugas dan kuis tetap wajib bagi peserta yang bergabung belakangan.
  // Tasks and quizzes stay required for late joiners.
  const tugas = input.taskIds.map(input.taskScore);
  const kuis = input.examIds.map(input.quizScore);

  // Capstone dinilai seperti tugas di LMS. Impor Excel hanya dipakai bila tugas
  // capstone-nya belum dinilai sama sekali, supaya nilai lama hasil impor tidak
  // menimpa penilaian yang dilakukan sesudahnya.
  //
  // The capstone is graded like a task in the LMS. The Excel import is used only
  // when the capstone task has no grade at all, so an older imported score never
  // overrides grading done afterwards.
  const cap = input.capstoneTaskIds.map(input.taskScore);
  const capDinilai = cap.some((n) => n !== null);

  return calculateFinalGrade({
    capstone: capDinilai ? averageWithZeros(cap, cap.length) : input.capstone,
    attendance: sesi.length > 0 ? Math.round((hadir / sesi.length) * 100) : null,
    tasks: tugas.length > 0 ? averageWithZeros(tugas, tugas.length) : null,
    quiz: kuis.length > 0 ? averageWithZeros(kuis, kuis.length) : null,
    details: {
      capstone: capDinilai ? 'Dari penilaian tugas capstone' : input.capstone !== null ? 'Dari impor nilai' : 'Belum dinilai',
      attendance: sesi.length > 0 ? `${hadir} dari ${sesi.length} pertemuan` : 'Belum ada pertemuan',
      tasks: tugas.length > 0 ? `${tugas.filter((n) => n !== null).length} dari ${tugas.length} tugas dinilai` : 'Belum ada tugas',
      quiz: kuis.length > 0 ? `${kuis.filter((n) => n !== null).length} dari ${kuis.length} ujian dikerjakan` : 'Belum ada ujian',
    },
  });
}

/**
 * Pertemuan yang dinilai bagi satu peserta; dipakai bersama nilai kehadiran
 * dan hitungan absen tanpa izin supaya keduanya tidak pernah berbeda pertemuan.
 *
 * The meetings graded for one participant; shared by the attendance score and
 * the unexcused-absence count so both always look at the same meetings.
 */
export function gradedMeetings<T extends { id: string; endsAt: string; title?: string }>(
  sessions: T[], joinIso: string, recorded: (sessionId: string) => boolean
): T[] {
  return sessions.filter((s) => /\bPertemuan\s+\d+/i.test(s.title ?? '') && countsAfterJoin(s.endsAt, joinIso, recorded(s.id)));
}

/**
 * Jumlah pertemuan yang sudah lewat tanpa hadir, izin, atau sakit. Pertemuan
 * tanpa catatan presensi dihitung absen, sama seperti nilai kehadiran.
 *
 * How many past meetings had no attendance, leave, or sick record. A meeting
 * with no record counts as absent, as it does for the attendance score.
 */
export function countUnexcused(input: {
  sessions: { id: string; endsAt: string; title?: string }[];
  joinIso: string;
  nowIso: string;
  status: (sessionId: string) => AttendanceStatus | undefined;
}): number {
  const ok = new Set<AttendanceStatus | undefined>(['present', 'excused', 'sick']);
  return gradedMeetings(input.sessions, input.joinIso, (id) => input.status(id) !== undefined)
    .filter((s) => s.endsAt <= input.nowIso && !ok.has(input.status(s.id))).length;
}

/** Bobot rubrik Performance Terbaik / Weights of the Best Performance rubric */
export const PERFORMANCE_WEIGHTS = { attendance: 40, tasks: 40, quiz: 20 } as const;
/** Menit setelah sesi mulai yang masih dihitung tepat waktu / Minutes after start still counted on time */
export const LATE_AFTER_MIN = 15;

/**
 * Nilai Performance Terbaik: kehadiran 40%, rerata TPM 40%, rerata kuis 20%.
 * Capstone sengaja tidak ikut agar penghargaan ini tidak jatuh ke juara
 * capstone yang sama. Skema magang tetap memakai nilai akhir.
 *
 * Kehadiran: tiap pertemuan bernilai satu, setengah bila terlambat lebih dari
 * 15 menit.
 *
 * The Best Performance score: attendance 40%, TPM average 40%, quiz average
 * 20%. The capstone is left out on purpose so this award does not go to the
 * same capstone winners. The internship scheme still uses the final score.
 *
 * Attendance: each meeting is worth one, half when more than 15 minutes late.
 */
export function performanceScore(input: {
  meetings: { id: string }[];
  present: (sessionId: string) => boolean;
  late: (sessionId: string) => boolean;
  tasks: number;
  quiz: number;
}): { score: number; attendance: number; attendanceDetail: string } {
  let poin = 0;
  let telat = 0;
  for (const m of input.meetings) {
    if (!input.present(m.id)) continue;
    if (input.late(m.id)) { poin += 0.5; telat += 1; } else poin += 1;
  }
  const n = input.meetings.length;
  const attendance = n > 0 ? Math.round((poin / n) * 100) : 0;
  const w = PERFORMANCE_WEIGHTS;
  const score = Math.round((attendance * w.attendance + input.tasks * w.tasks + input.quiz * w.quiz) / 100);
  const hadir = input.meetings.filter((m) => input.present(m.id)).length;
  return {
    score,
    attendance,
    attendanceDetail: n > 0 ? `${hadir} dari ${n} pertemuan${telat > 0 ? `, ${telat} terlambat` : ''}` : 'Belum ada pertemuan',
  };
}

/**
 * Peserta yang memindai lebih dari 15 menit setelah sesi mulai, per sesi.
 * Catatan manual dari admin tidak punya jam kedatangan, jadi dianggap tepat
 * waktu. Sesi yang lebih dari separuh pemindaiannya terlambat dilewati: di sesi
 * seperti itu QR-nya baru ditampilkan belakangan, bukan pesertanya yang telat.
 *
 * Participants who scanned more than 15 minutes after a session started, per
 * session. Manual admin records carry no arrival time, so they count as on
 * time. A session where more than half the scans were late is skipped: there
 * the QR was shown late, not the participants.
 */
export function lateArrivals(
  records: { sessionId: string; studentId: string; recordedAt: string; source?: string }[],
  startsAt: (sessionId: string) => string | undefined
): Map<string, Set<string>> {
  const scan = new Map<string, { studentId: string; late: boolean }[]>();
  for (const r of records) {
    const mulai = startsAt(r.sessionId);
    if (!mulai || r.source === 'manual' || !r.recordedAt) continue;
    const late = Date.parse(r.recordedAt) - Date.parse(mulai) > LATE_AFTER_MIN * 60_000;
    if (!scan.has(r.sessionId)) scan.set(r.sessionId, []);
    scan.get(r.sessionId)!.push({ studentId: r.studentId, late });
  }
  const hasil = new Map<string, Set<string>>();
  for (const [sid, xs] of scan) {
    const telat = xs.filter((x) => x.late);
    if (telat.length * 2 > xs.length) continue;
    hasil.set(sid, new Set(telat.map((x) => x.studentId)));
  }
  return hasil;
}
