// Definisi tipe data sesi pertemuan dan presensi / Session meeting and attendance data types
export type SessionMode = 'online' | 'offline';
export type AttendanceOverride = 'auto' | 'open' | 'closed';

export interface SessionRecording {
  id: string;
  /** Penanda ruang, misalnya "Kelas Utama" atau "Breakout 1" / Room label, e.g. "Main Room" or "Breakout 1" */
  label: string;
  url: string;
  addedAt: string;
}

export interface SessionDocument {
  id: string;
  classId: string;
  className?: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm (WIB)
  endTime: string; // HH:mm (WIB)
  startsAt: string; // ISO UTC
  endsAt: string; // ISO UTC
  mode: SessionMode;
  // Tautan bergabung ke sesi, dipakai sebelum dan selama sesi berlangsung
  // Join link for the session, used before and during the meeting
  zoomUrl: string | null;
  // Rekaman sesi, diisi admin setelah sesi selesai. Berbentuk daftar karena
  // satu sesi dapat pecah menjadi beberapa breakout room yang masing-masing
  // merekam sendiri. Berbeda dari zoomUrl: tautan bergabung tidak memutar apa
  // pun setelah sesi berakhir.
  //
  // Session recordings, filled in by an admin after the session ends. A list
  // because one session may split into several breakout rooms, each recording
  // separately. Distinct from zoomUrl: a join link plays nothing once the
  // meeting is over.
  recordings?: SessionRecording[];
  address: string | null;
  mapsUrl: string | null;
  attendanceOverride: AttendanceOverride;
  qrRevision: number;
  attendeeCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceDocument {
  id: string; // ${sessionId}_${studentId}
  sessionId: string;
  sessionTitle: string;
  classId: string;
  studentId: string;
  studentName: string;
  sessionEndsAt: string;
  recordedAt: string;
  source: 'scan' | 'camera';
}

export interface CreateSessionInput {
  classId: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  mode: SessionMode;
  zoomUrl?: string | null;
  address?: string | null;
  mapsUrl?: string | null;
}

export interface UpdateSessionInput {
  sessionId: string;
  title?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  mode?: SessionMode;
  zoomUrl?: string | null;
  address?: string | null;
  mapsUrl?: string | null;
}

export interface AddRecordingInput {
  sessionId: string;
  label: string;
  url: string;
}

export interface RemoveRecordingInput {
  sessionId: string;
  recordingId: string;
}

export interface QrMonitorData {
  session: SessionDocument;
  serverNow: string;
  isActive: boolean;
  currentToken: string | null;
  nextToken: string | null;
  currentExpiresAt: string | null;
  attendeeCount: number;
  recentAttendees: { studentName: string; recordedAt: string; source: string }[];
}
