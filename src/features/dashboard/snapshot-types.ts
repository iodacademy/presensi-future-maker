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

/**
 * Satu baris pada tabel peserta.
 *
 * Kehadiran disimpan sebagai daftar per pertemuan, bukan hanya jumlahnya:
 * tabelnya menampilkan titik untuk tiap pertemuan, dan angka ringkasnya tidak
 * dapat memberi tahu pertemuan mana yang terlewat.
 *
 * Nilai yang belum ada bernilai null, bukan nol: nol berarti dikerjakan dan
 * salah semua, sedangkan null berarti belum dikerjakan -- keduanya menuntut
 * tindakan yang berbeda dari admin.
 *
 * One row in the participant table.
 *
 * Attendance is stored per meeting rather than as a count alone: the table
 * shows a dot for each meeting, and a summary figure cannot say which ones were
 * missed.
 *
 * A missing score is null rather than zero: zero means attempted and all wrong,
 * while null means not attempted -- the two call for different action from an
 * admin.
 */
export interface RosterRow {
  studentId: string;
  studentName: string;
  className: string;
  /** Nama program kelasnya, dipakai sebagai jurusan / The class's programme name, used as the stream */
  programName: string;
  city: string;
  /** Satu nilai per pertemuan: true hadir, false tidak, null belum berjalan / One value per meeting: true present, false absent, null not yet held */
  attendance: (boolean | null)[];
  attendanceRate: number;
  mentoringUsed: number;
  pretest: number | null;
  posttest: number | null;
  capstone: number | null;
  /** Nilai tiap kuis sesi, urut jadwalnya / Each session quiz's score, in schedule order */
  quizScores: (number | null)[];
  /** Nilai tiap tugas, urut nomornya / Each task's score, in order */
  taskScores: (number | null)[];
  /**
   * Status yang diturunkan dari ambangnya.
   *
   * 'nonaktif' dibedakan dari 'siaga': peserta yang sudah keluar tidak perlu
   * dihubungi, dan menggabungkannya membuat daftar tindak lanjut memuat nama
   * yang tidak dapat ditindaklanjuti.
   *
   * The status derived from the thresholds.
   *
   * 'nonaktif' differs from 'siaga': someone who has left needs no contacting,
   * and merging them would fill the follow-up list with names nothing can be
   * done about.
   */
  status: 'aktif' | 'siaga' | 'nonaktif';
  issueCount: number;
  /** Catatan admin, diketik di tabelnya / The admin's note, typed in the table */
  note: string;
  /** Tindak lanjut yang direncanakan / The planned follow-up */
  followUp: string;
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

/**
 * Rangkuman profil peserta aktif.
 *
 * Jumlah yang belum melengkapi dicatat terpisah, bukan dilebur ke dalam
 * sebarannya: persentase yang dihitung dari tujuh puluh peserta tetapi
 * disajikan seolah dari seratus akan dibaca sebagai gambaran utuh angkatan.
 *
 * A summary of active participants' profiles.
 *
 * How many have not completed theirs is recorded separately rather than folded
 * into the distribution: a percentage computed over seventy participants but
 * presented as if over a hundred would be read as the whole cohort.
 */
export interface ProfileSummary {
  /** Peserta aktif yang sudah melengkapi profilnya / Active participants who completed their profile */
  completed: number;
  /** Peserta aktif yang belum / Active participants who have not */
  pending: number;
  genders: { label: string; count: number }[];
  disabilities: { label: string; count: number }[];
  entryStatuses: { label: string; count: number }[];
  /** Null bila belum ada yang melengkapi / Null when nobody has completed one */
  averageAge: number | null;
  youngest: number | null;
  oldest: number | null;
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
  profile: ProfileSummary;

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
  roster: RosterRow[];
  /** Judul tiap pertemuan, agar titik kehadirannya dapat dilabeli / Each meeting's title, so the attendance dots can be labelled */
  sessionLabels: string[];
  quizLabels: string[];
  taskLabels: string[];
  alerts: AlertStudent[];
  thresholds: AlertThresholds;
}
