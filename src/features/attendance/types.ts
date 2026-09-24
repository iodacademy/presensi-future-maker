// Definisi tipe data sesi pertemuan dan presensi / Session meeting and attendance data types
export type SessionMode = 'online' | 'offline';
export type AttendanceOverride = 'auto' | 'open' | 'closed';

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
  // Tautan rekaman, diisi admin setelah sesi selesai. Berbeda dari zoomUrl:
  // tautan bergabung tidak memutar apa pun setelah sesi berakhir.
  //
  // Recording link, filled in by an admin after the session ends. Distinct from
  // zoomUrl: a join link plays nothing once the meeting is over.
  recordingUrl?: string | null;
  recordingNote?: string | null;
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

export interface SetRecordingInput {
  sessionId: string;
  recordingUrl: string | null;
  recordingNote?: string | null;
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
