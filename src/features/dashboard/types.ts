// Tipe data agregat beranda siswa / Student home dashboard data types
import type { TaskKind } from '../tasks/types';

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
    kind: 'pretest' | 'kuis';
    dueAt: string | null;
    isUrgent: boolean;
    deadlineLabel: string;
  }[];
  progress: StudentHomeProgress;
}
