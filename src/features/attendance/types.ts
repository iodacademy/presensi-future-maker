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

/**
 * Status kehadiran seorang peserta pada satu pertemuan.
 *
 * Izin dan sakit disimpan sebagai catatan tersendiri, bukan sebagai
 * ketiadaan catatan, agar admin dapat membedakan peserta yang berhalangan
 * dengan alasan dari peserta yang menghilang tanpa kabar. Keduanya tidak
 * dihitung hadir pada rasio kehadiran.
 *
 * A participant's status for one meeting.
 *
 * Excused and sick are stored as records of their own rather than as the
 * absence of a record, so an admin can tell someone who was excused apart from
 * someone who vanished without word. Neither counts as present in the
 * attendance ratio.
 */
export type AttendanceStatus = 'present' | 'excused' | 'sick' | 'absent';

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: 'Hadir',
  excused: 'Izin',
  sick: 'Sakit',
  absent: 'Tidak hadir',
};

export interface AttendanceDocument {
  id: string; // ${sessionId}_${studentId}
  sessionId: string;
  sessionTitle: string;
  classId: string;
  studentId: string;
  studentName: string;
  sessionEndsAt: string;
  recordedAt: string;
  // 'scan' dan 'camera' berasal dari pemindaian peserta sendiri; 'manual'
  // dicatat admin. Perbedaannya penting saat menelusuri rekap yang dipertanyakan.
  //
  // 'scan' and 'camera' come from the participant's own scan; 'manual' is
  // recorded by an admin. The distinction matters when a disputed record is
  // traced back.
  source: 'scan' | 'camera' | 'manual';
  // Dokumen lama tidak memuat field ini dan seluruhnya berasal dari pemindaian,
  // sehingga ketiadaannya berarti hadir.
  //
  // Older documents lack this field and all came from a scan, so its absence
  // means present.
  status?: AttendanceStatus;
  note?: string | null;
  recordedBy?: string | null;
}

export interface SetAttendanceInput {
  sessionId: string;
  studentId: string;
  status: AttendanceStatus;
  note?: string | null;
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
