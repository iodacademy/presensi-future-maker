// Definisi tipe ringkasan dashboard / Dashboard snapshot type definitions

/**
 * Ringkasan satu daerah pada satu waktu.
 *
 * Disimpan sebagai satu dokumen, bukan dihitung ulang tiap halaman dibuka:
 * menghitungnya menuntut membaca seluruh kehadiran, pengumpulan, percobaan
 * ujian, dan jawaban survei -- sekitar tiga belas ribu dokumen untuk seratus
 * peserta. Dashboard adalah halaman yang paling sering dibuka, dan dua puluh
 * kali buka sehari sudah melampaui kuota baca harian.
 *
 * One region's summary at one moment.
 *
 * Stored as a single document rather than recomputed on each page load:
 * computing it means reading every attendance record, submission, exam
 * attempt, and survey response -- around thirteen thousand documents for a
 * hundred participants. The dashboard is the most-opened page, and twenty
 * opens a day already exceeds the daily read quota.
 */
export interface ClassSnapshot {
  classId: string;
  className: string;
  city: string;
  registered: number;
  active: number;
  droppedOut: number;
}

/** Satu titik pada grafik batang berlabel / One point on a labelled bar chart */
export interface SeriesPoint {
  label: string;
  /** Null berarti belum berjalan, berbeda dari nol / Null means not started yet, distinct from zero */
  value: number | null;
  /** Keterangan tambahan pada tooltip atau sumbu / Extra caption for a tooltip or axis */
  detail?: string;
}

export interface SurveySummaryPoint {
  formId: string;
  formTitle: string;
  /** Rata-rata seluruh pertanyaan bernilai angka / Average across every numeric question */
  average: number | null;
  /** Persentase peserta aktif yang mengisi / Percentage of active participants who responded */
  responseRate: number;
}

/**
 * Peserta yang salah satu angkanya di bawah ambang.
 *
 * Diurutkan dari yang paling banyak masalahnya, bukan dari nilai terendah:
 * peserta yang kehadirannya buruk sekaligus tugasnya tertinggal lebih butuh
 * dihubungi daripada yang hanya satu angkanya rendah.
 *
 * A participant with one of their figures below the threshold.
 *
 * Sorted by how many problems they have rather than by lowest score: someone
 * whose attendance is poor and whose tasks are behind needs contacting more
 * than someone with only one low figure.
 */
export interface AlertStudent {
  studentId: string;
  studentName: string;
  className: string;
  city: string;
  attendanceRate: number;
  taskRate: number;
  quizAverage: number;
  /** Berapa dari tiga angka itu yang di bawah ambang / How many of those three are below threshold */
  issueCount: number;
}

export interface RankedStudent {
  studentId: string;
  studentName: string;
  className: string;
  city: string;
  score: number;
}

/**
 * Ambang yang memunculkan peserta pada daftar siaga.
 *
 * Disimpan pada ringkasannya, bukan hanya di kode: ambang yang berubah
 * membuat daftar lama tidak dapat dibaca ulang dengan aturan yang sama, dan
 * pembaca laporan lama perlu tahu angka mana yang berlaku saat itu.
 *
 * The thresholds that put a participant on the alert list.
 *
 * Stored on the snapshot rather than only in code: a changed threshold makes an
 * older list unreadable under the same rule, and whoever reads an old report
 * needs to know which figures applied at the time.
 */
export interface AlertThresholds {
  attendance: number;
  task: number;
  quiz: number;
}

export interface DashboardSnapshot {
  /** Tanggal WIB "YYYY-MM-DD", sekaligus id dokumennya / WIB date "YYYY-MM-DD", also the document id */
  id: string;
  generatedAt: string;
  /** Admin yang memicu penghitungannya, atau 'otomatis' / The admin who triggered it, or 'otomatis' */
  generatedBy: string;

  totalRegistered: number;
  totalActive: number;
  totalDroppedOut: number;
  classes: ClassSnapshot[];

  /** Kehadiran per pertemuan, dalam persen peserta aktif / Attendance per meeting, as a percentage of active participants */
  attendancePerSession: SeriesPoint[];
  /** Pengumpulan per tugas, dalam persen peserta aktif / Submissions per task, as a percentage of active participants */
  submissionPerTask: SeriesPoint[];
  /** Rata-rata nilai per tugas / Average score per task */
  scorePerTask: SeriesPoint[];
  /** Rata-rata nilai kuis per sesi / Average quiz score per session */
  quizPerSession: SeriesPoint[];

  /** Rata-rata pretest dan postest tiap kelas, untuk learning gain / Each class's pretest and posttest averages, for learning gain */
  learningGain: { className: string; pretest: number | null; posttest: number | null }[];

  /** Sebaran pemakaian kuota mentoring / The spread of mentoring quota use */
  mentoring: { none: number; once: number; twice: number };

  surveys: SurveySummaryPoint[];
  ranking: RankedStudent[];
  alerts: AlertStudent[];
  thresholds: AlertThresholds;
}
