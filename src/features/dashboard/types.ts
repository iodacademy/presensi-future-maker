// Tipe data agregat beranda siswa / Student home dashboard data types
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
  kind: 'daily' | 'capstone';
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
  progress: StudentHomeProgress;
}
