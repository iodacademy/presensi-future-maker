// Tipe data agregat beranda siswa / Student home dashboard data types
import type { TaskKind } from '../tasks/types';
import type { ExamKind } from '../exams/types';

export interface StudentHomeSession {
  id: string;
  title: string;
  timeStr: string;
  mode: 'online' | 'offline';
  zoomUrl?: string | null;
  address?: string | null;
  isAttended: boolean;
}

export interface StudentHomeMentoring {
  id: string;
  mentorName: string;
  date: string;
  timeStr: string;
  // null saat event kalender belum terbentuk / null while the calendar event is not yet created
  meetUrl: string | null;
}

export interface StudentHomeTask {
  id: string;
  title: string;
  kind: TaskKind;
  dueAt: string | null;
  isUrgent: boolean;
  deadlineLabel: string;
}

export interface StudentHomeProgress {
  attendanceRatio: string; // e.g. "18/20"
  dailyTasksRatio: string; // e.g. "3/4"
  mentoringRatio: string; // e.g. "1/2"
}

export interface StudentHomeData {
  studentName: string;
  className: string;
  activeSession: StudentHomeSession | null;
  nextSession: StudentHomeSession | null;
  nearestMentoring: StudentHomeMentoring | null;
  remainingMentoringQuota: number;
  nearestTask: StudentHomeTask | null;
  /**
   * Hasil praktik di kelas terdekat yang belum dikumpulkan.
   *
   * Terpisah dari nearestTask karena batasnya jatuh beberapa jam setelah
   * pertemuannya: satu kartu yang sudah terisi tugas mandiri akan
   * menyembunyikan justru yang paling mendesak.
   *
   * The nearest unsubmitted class practice result.
   *
   * Separate from nearestTask because its deadline falls hours after the
   * meeting: a single card already holding a self-study task would hide the
   * most urgent one.
   */
  nearestWorkingPaper: StudentHomeTask | null;
  /**
   * Ujian wajib yang belum dikerjakan, terdekat batasnya lebih dulu.
   *
   * Ditandai di beranda, bukan mengunci apa pun: kuis yang salah setelah
   * terbit tidak boleh menghentikan pengumpulan atau pertemuan berikutnya.
   *
   * Required exams not yet taken, nearest deadline first.
   *
   * Flagged on the home screen rather than locking anything: a quiz published
   * with wrong settings must not halt submissions or the next meeting.
   */
  pendingExams: {
    id: string;
    title: string;
    kind: ExamKind;
    dueAt: string | null;
    isUrgent: boolean;
    deadlineLabel: string;
  }[];
  progress: StudentHomeProgress;
  performance: StudentPerformance;
}

/**
 * Laporan performa peserta untuk grafik beranda. Disusun dari data yang sudah
 * dibaca beranda, sehingga tidak menambah baca Firestore.
 *
 * The participant's performance report for the home charts. Built from data the
 * home already reads, so it adds no Firestore reads.
 */
export interface StudentPerformance {
  /** Satu baris per pertemuan, urut waktu / One row per meeting, in time order */
  attendance: { sessionId: string; title: string; startsAt: string; status: 'hadir' | 'izin' | 'sakit' | 'alpa' | 'mendatang' }[];
  /** Satu baris per kuis terbit, urut waktu pertemuannya / One row per published quiz, in meeting order */
  quizzes: { id: string; title: string; kind: ExamKind; bestScore: number | null; passingScore: number; passed: boolean; attempts: number }[];
  /** Satu baris per tugas terbit / One row per published task */
  tasks: { id: string; title: string; kind: TaskKind; dueAt: string | null; status: 'dinilai' | 'menunggu' | 'belum' | 'lewat'; score: number | null; late: boolean }[];
}

/** Survei dan kuis yang belum dikerjakan peserta / Surveys and quizzes a participant has not done yet */
export interface StudentReminders {
  surveys: { formId: string; formTitle: string; sessionId: string; sessionTitle: string }[];
  exams: { id: string; title: string; dueAt: string | null; sessionTitle: string | null }[];
}

/**
 * Seluruh progres belajar satu peserta untuk pencarian di dashboard admin.
 *
 * Everything about one participant's learning progress, for the admin
 * dashboard search.
 */
export interface StudentDetail {
  student: { uid: string; name: string; email: string; className: string; city: string; programName: string; active: boolean };
  profile: { age: number | null; gender: string; disability: string; entryStatus: string; phone: string } | null;
  performance: StudentPerformance;
  mentoring: { used: number; bookings: { id: string; mentorName: string; date: string; startTime: string; endTime: string; status: 'confirmed' | 'cancelled' }[] };
  feedback: { id: string; formTitle: string; sessionTitle: string; sessionDate: string; submittedAt: string; answers: { questionText: string; kind: string; value: string }[] }[];
  note: { note: string; followUp: string } | null;
}
