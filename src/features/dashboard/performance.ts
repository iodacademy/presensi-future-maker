// Penyusun laporan performa peserta untuk grafik beranda / Builds the participant performance report for the home charts
import type { StudentPerformance } from './types';
import type { SessionDocument, AttendanceDocument } from '../attendance/types';
import type { TaskDocument } from '../tasks/types';
import type { SubmissionDocument } from '../tasks/submission-types';
import type { ExamDocument, AttemptDocument } from '../exams/types';
import { countsAfterJoin, effectiveDueAt } from '../users/join-policy';
import { isLateForStudent } from '../tasks/submission-policy';

const ATTENDANCE_STATUS = { present: 'hadir', excused: 'izin', sick: 'sakit', absent: 'alpa' } as const;

/**
 * Fungsi murni: seluruh data sudah dibaca oleh layanan beranda.
 *
 * Pertemuan yang sudah berakhir tanpa catatan dihitung tidak hadir; yang
 * belum berakhir dihitung mendatang, sebab peserta masih dapat memindai.
 * Kuis diurutkan menurut waktu pertemuannya agar grafik nilai terbaca sebagai
 * perjalanan, dan pretest (tanpa pertemuan) berada paling depan.
 *
 * Pure function: all data is already read by the home service.
 *
 * A meeting that has ended with no record counts as absent; one that has not
 * ended counts as upcoming, since the participant can still scan. Quizzes are
 * ordered by their meeting time so the score chart reads as a journey, and the
 * pretest (no meeting) comes first.
 */
export function buildStudentPerformance(input: {
  sessions: Pick<SessionDocument, 'id' | 'title' | 'startsAt' | 'endsAt'>[];
  attendance: Pick<AttendanceDocument, 'sessionId' | 'status'>[];
  exams: Pick<ExamDocument, 'id' | 'title' | 'kind' | 'sessionId' | 'passingScore' | 'questionCount'>[];
  attempts: Pick<AttemptDocument, 'examId' | 'status' | 'score' | 'passed'>[];
  tasks: Pick<TaskDocument, 'id' | 'title' | 'kind' | 'dueAt' | 'order'>[];
  submissions: Pick<SubmissionDocument, 'taskId' | 'score' | 'late'>[];
  nowIso: string;
  /** Saat peserta mulai dihitung (joinMoment); kosong berarti semuanya / When the participant starts counting (joinMoment); empty means everything */
  joinIso?: string;
}): StudentPerformance {
  const { nowIso } = input;
  const joinIso = input.joinIso ?? '';
  const statusBySession = new Map(input.attendance.map((a) => [a.sessionId, a.status ?? 'present']));
  // Pertemuan yang berakhir sebelum peserta bergabung tidak ditampilkan, kecuali
  // ia tercatat di sana. Tugas dan kuisnya tetap tampil, hanya tanpa tenggat.
  // Meetings that ended before the participant joined are left out unless they
  // are recorded there. Their tasks and quizzes still show, only without a deadline.
  // Showcase tidak dihitung kehadirannya dan presensinya tidak diambil, jadi bila tampil selalu merah
  // Showcase attendance is not counted nor taken, so if shown it would always be red
  const sessions = [...input.sessions]
    .filter((s) => !/^Showcase\b/i.test(s.title) && countsAfterJoin(s.endsAt, joinIso, statusBySession.has(s.id)))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  const attendance = sessions.map((s) => {
    const recorded = statusBySession.get(s.id);
    return {
      sessionId: s.id,
      title: s.title,
      startsAt: s.startsAt,
      status: recorded ? ATTENDANCE_STATUS[recorded] : s.endsAt <= nowIso ? ('alpa' as const) : ('mendatang' as const),
    };
  });

  const sessionStart = new Map(input.sessions.map((s) => [s.id, s.startsAt]));
  const attemptsByExam = new Map<string, typeof input.attempts>();
  for (const a of input.attempts) {
    if (!attemptsByExam.has(a.examId)) attemptsByExam.set(a.examId, []);
    attemptsByExam.get(a.examId)!.push(a);
  }

  const quizzes = input.exams
    .filter((e) => e.questionCount > 0)
    .sort((a, b) => (a.sessionId ? sessionStart.get(a.sessionId) ?? '' : '').localeCompare(b.sessionId ? sessionStart.get(b.sessionId) ?? '' : ''))
    .map((e) => {
      const attempts = attemptsByExam.get(e.id) ?? [];
      const finished = attempts.filter((a) => a.status === 'selesai' && a.score !== null);
      return {
        id: e.id,
        title: e.title,
        kind: e.kind,
        bestScore: finished.length > 0 ? Math.max(...finished.map((a) => a.score!)) : null,
        passingScore: e.passingScore,
        passed: attempts.some((a) => a.passed === true),
        attempts: attempts.length,
      };
    });

  const subs = new Map(input.submissions.map((s) => [s.taskId, s]));
  // Hanya Tugas Praktik Mandiri yang dihitung performa; hasil praktik di kelas
  // tidak dinilai dan capstone dinilai terpisah.
  // Only Tugas Praktik Mandiri count toward performance; in-class practice
  // results are not graded and capstones are assessed separately.
  const tasks = input.tasks
    .filter((t) => t.kind === 'daily')
    .map((t) => ({ ...t, dueAt: effectiveDueAt(t.dueAt, joinIso) }))
    .sort((a, b) => (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999') || a.order - b.order)
    .map((t) => {
      const sub = subs.get(t.id);
      const status: StudentPerformance['tasks'][number]['status'] = sub
        ? sub.score !== null
          ? 'dinilai'
          : 'menunggu'
        : t.dueAt && t.dueAt < nowIso
          ? 'lewat'
          : 'belum';
      return { id: t.id, title: t.title, kind: t.kind, dueAt: t.dueAt, status, score: sub?.score ?? null, late: isLateForStudent(sub?.late, t.dueAt, joinIso) };
    });

  return { attendance, quizzes, tasks };
}
