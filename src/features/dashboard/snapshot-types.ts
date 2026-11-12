import type { GradeComponent } from '../grading/types';
import type { Placement } from '../grading/placement';
import type { FeedbackForm } from './feedback';
import type { AttendanceStatus } from '../attendance/types';
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
  /** Jurusannya, mis. "AI Web Programming" / Its stream, e.g. "AI Web Programming" */
  programName: string;
  city: string;
  registered: number;
  active: number;
  droppedOut: number;
}

export interface SurveySummaryPoint {
  formId: string;
  formTitle: string;
  /** Rata-rata seluruh pertanyaan bernilai angka / Average across every numeric question */
  average: number | null;
  /** Persentase peserta aktif yang mengisi / Percentage of active participants who responded */
  responseRate: number;
  /** Rata-rata dan persentase pengisi, per kota / The average and response share, per city */
  byCity: Record<string, { average: number | null; responseRate: number }>;
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
  /** Satu status per pertemuan, null bila belum berjalan / One status per meeting, null when not yet held */
  attendance: (AttendanceStatus | null)[];
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
   * Terkumpul atau tidak, urut nomornya: true terkumpul, false lewat tenggat
   * tanpa dikumpulkan, null belum dibuka.
   *
   * Dibedakan dari nilainya karena tugas yang terkumpul tetapi belum dinilai
   * bernilai null pada taskScores -- sama dengan tugas yang tidak pernah
   * dikumpulkan, padahal keduanya menuntut tindakan yang berbeda.
   *
   * Submitted or not, in order: true submitted, false past deadline with nothing
   * handed in, null not yet opened.
   *
   * Kept apart from the score because a task submitted but not yet graded is
   * null in taskScores -- the same as one never handed in, though the two call
   * for different action.
   */
  taskSubmitted: (boolean | null)[];
  /** Sama dengan taskSubmitted, untuk capstone; kosong pada ringkasan lama / Same as taskSubmitted, for capstones; absent on older snapshots */
  capstoneSubmitted?: (boolean | null)[];
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
  /** Nilai komponen capstone dan kehadiran, penentu urutan bila SPA sama / Capstone and attendance component scores, the tie-breakers when SPA is equal */
  capstone: number;
  tasks: number;
  attendance: number;
  quiz: number;
  /** Keterangan asal tiap nilai komponen / Where each component score comes from */
  componentDetails: Partial<Record<GradeComponent, string>>;
  /** Nilai gabungan capstone 60% dan TPM 40%, syarat skema magang / Combined capstone 60% and TPM 40% score, an internship requirement */
  combined: number;
  /** Pertemuan yang lewat tanpa hadir, termasuk izin dan sakit / Past meetings not attended, leave and sick included */
  absent: number;
  /** Nilai Performance Terbaik tanpa capstone, satu angka desimal / The Best Performance score without the capstone, one decimal */
  perfScore: number;
  perfAttendance: number;
  perfTasks: number;
  /** Rerata kuis percobaan pertama / Average of first quiz attempts */
  perfQuiz: number;
  placement: Placement;
  /** Syarat skema yang belum terpenuhi / Scheme requirements not met */
  placementReasons: string[];
  /** Komponen yang belum dinilai; tidak ada pada ringkasan sebelum versi 17 / Components not yet graded; absent before version 17 */
  pending?: GradeComponent[];
  /** Semua tenggat capstone lewat tanpa kiriman; capstone dihitung 0 / Every capstone deadline passed unsubmitted; the capstone counts as 0 */
  capstoneMissing?: boolean;
  /** Alasan nilai kasus khusus yang ditetapkan admin / The reason for admin-set special-case grades */
  specialCase?: string;
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
 * Satu profil peserta aktif, tanpa namanya.
 *
 * Disimpan sebagai baris mentah, bukan sebagai sebaran yang sudah dihitung:
 * dashboard dapat disaring per daerah, dan sebaran yang sudah dijumlah tidak
 * dapat dipecah lagi. Seratus baris sekecil ini jauh lebih murah daripada
 * menyimpan satu sebaran per daerah per pertanyaan.
 *
 * Namanya tidak disertakan: tidak ada panel yang menyebut siapa yang
 * disabilitas atau berapa usianya, dan menyertakannya hanya menambah data
 * pribadi yang beredar tanpa ada yang memakainya.
 *
 * One active participant's profile, without their name.
 *
 * Stored as a raw row rather than a precomputed distribution: the dashboard can
 * be filtered by region, and a summed distribution cannot be split again. A
 * hundred rows this small cost far less than storing one distribution per region
 * per question.
 *
 * The name is left out: no panel names who has a disability or how old they are,
 * and including it would only put personal data in circulation with nothing
 * using it.
 */
export interface ProfileRow {
  city: string;
  gender: string;
  disability: string;
  entryStatus: string;
  /** Dihitung saat ringkasannya dibuat; null bila tanggalnya tidak terbaca / Computed when the snapshot is built; null when the date cannot be read */
  age: number | null;
}

/**
 * Satu pertanyaan survei beserta rata-ratanya per daerah.
 *
 * Dipecah per daerah karena satu angka gabungan menyembunyikan daerah yang
 * ratingnya jatuh: rata-rata 4,2 dapat berarti seluruh daerah baik, atau tiga
 * daerah sangat baik menutupi satu daerah yang buruk.
 *
 * One survey question with its average per region.
 *
 * Split by region because a single combined figure hides the region whose rating
 * has dropped: an average of 4.2 can mean every region is fine, or three very
 * good regions masking one bad one.
 */
export interface SurveyQuestionPoint {
  label: string;
  /** Rata-rata per kota; kota tanpa jawaban tidak muncul / Average per city; a city with no answers is absent */
  byCity: Record<string, number | null>;
}

export interface LoginPoint {
  /** Tanggal WIB "YYYY-MM-DD" / WIB date "YYYY-MM-DD" */
  date: string;
  /** Peserta aktif yang membuka aplikasi, per kota / Active participants who opened the app, per city */
  byCity: Record<string, number>;
}

/**
 * Satu fase program beserta tanggalnya.
 *
 * Onboarding dan bootcamp diturunkan dari jadwal sesi yang sudah ada; sisanya
 * ditulis di kode karena belum ada tempat untuk mengisinya.
 *
 * One programme phase with its dates.
 *
 * Onboarding and the bootcamp derive from the existing session schedule; the
 * rest are written in code because there is nowhere to enter them yet.
 */
export interface PhasePoint {
  name: string;
  /** Rentangnya sebagaimana ditampilkan, mis. "14 Sep sampai 9 Okt" / The range as displayed, e.g. "14 Sep sampai 9 Okt" */
  range: string;
  status: 'selesai' | 'berjalan' | 'akan-datang';
  /** Persentase kemajuan, hanya untuk fase yang berjalan / Progress percentage, only for the running phase */
  progress: number | null;
}

export interface DashboardSnapshot {
  /** Tanggal WIB "YYYY-MM-DD", sekaligus id dokumennya / WIB date "YYYY-MM-DD", also the document id */
  id: string;
  /**
   * Versi bentuk ringkasannya.
   *
   * Ringkasan yang versinya tertinggal dihitung ulang sendiri, tanpa menunggu
   * umurnya habis: ringkasan yang dibuat kode lama memuat angka yang dihitung
   * dengan aturan yang sudah diperbaiki, dan menampilkannya berarti perbaikan
   * yang sudah tayang tidak terlihat sampai ada yang menekan Hitung Ulang --
   * beban yang dipikul admin untuk kesalahan yang bukan miliknya.
   *
   * The snapshot's shape version.
   *
   * A snapshot on an older version recomputes itself rather than waiting out its
   * age: one built by older code carries figures computed under rules that have
   * since been fixed, and showing it means a deployed fix stays invisible until
   * somebody presses Hitung Ulang -- a burden carried by an admin for a mistake
   * that is not theirs.
   */
  version: number;
  generatedAt: string;
  /** Admin yang memicu penghitungannya, atau 'otomatis' / The admin who triggered it, or 'otomatis' */
  generatedBy: string;

  totalRegistered: number;
  totalActive: number;
  totalDroppedOut: number;
  classes: ClassSnapshot[];

  /** Satu baris per peserta aktif yang sudah melengkapi profilnya / One row per active participant who completed their profile */
  profiles: ProfileRow[];
  /**
   * Yang belum melengkapi, per kota.
   *
   * Dicatat terpisah dari sebarannya: persentase yang dihitung dari tujuh puluh
   * peserta tetapi disajikan seolah dari seratus akan dibaca sebagai gambaran
   * utuh angkatan.
   *
   * Those who have not completed theirs, per city.
   *
   * Recorded apart from the distribution: a percentage computed over seventy
   * participants but presented as if over a hundred would be read as the whole
   * cohort.
   */
  profilePendingByCity: Record<string, number>;

  /** Fase program beserta tanggalnya / The programme phases with their dates */
  phases: PhasePoint[];
  /**
   * Keterangan di sebelah judul fase, mis. "Per 3 Okt 2026: bootcamp minggu
   * ke-3 dari 4".
   *
   * Dihitung bersama fasenya, bukan di peramban: keduanya diturunkan dari
   * jadwal sesi yang sama, dan menghitungnya di dua tempat membuat keterangan
   * dan kotaknya dapat menyebut minggu yang berbeda.
   *
   * The caption beside the phase heading, e.g. "Per 3 Okt 2026: bootcamp minggu
   * ke-3 dari 4".
   *
   * Computed with the phases rather than in the browser: both derive from the same
   * session schedule, and computing it in two places would let the caption and the
   * cards name different weeks.
   */
  phaseCaption: string;


  /** Rata-rata pretest dan postest tiap kelas, untuk learning gain / Each class's pretest and posttest averages, for learning gain */
  learningGain: { className: string; pretest: number | null; posttest: number | null }[];

  /** Sebaran pemakaian kuota mentoring / The spread of mentoring quota use */
  mentoring: { none: number; once: number; twice: number };

  surveys: SurveySummaryPoint[];
  /** Rata-rata tiap pertanyaan survei per daerah, untuk peta panasnya / Each survey question's average per region, for the heatmap */
  surveyQuestions: SurveyQuestionPoint[];
  /**
   * Laporan feedback lengkap per formulir. Opsional: ringkasan yang dihitung
   * sebelum field ini ada tidak memuatnya sampai dihitung ulang.
   *
   * The full feedback report per form. Optional: a snapshot computed before this
   * field existed lacks it until recomputed.
   */
  feedback?: FeedbackForm[];
  /** Jumlah peserta yang membuka aplikasi per hari / How many participants opened the app each day */
  logins: LoginPoint[];
  ranking: RankedStudent[];
  roster: RosterRow[];
  /** Judul tiap pertemuan, agar titik kehadirannya dapat dilabeli / Each meeting's title, so the attendance dots can be labelled */
  sessionLabels: string[];
  quizLabels: string[];
  /** Judul kuis per nama kelas, urut kolom quizScores; kosong pada ringkasan lama / Quiz titles per class name, in quizScores column order; absent on older snapshots */
  quizTitlesByClass?: Record<string, string[]>;
  taskLabels: string[];
  /** Judul kolom capstone; kosong pada ringkasan lama / Capstone column titles; absent on older snapshots */
  capstoneLabels?: string[];
  /**
   * Jumlah tugas tiap kelas menurut nama kelasnya, agar pengumpulan per tugas
   * dibagi seluruh peserta kelas yang punya tugas itu; kosong pada ringkasan lama.
   *
   * Each class's task count by class name, so per-task submission divides by
   * every participant whose class has that task; absent on older snapshots.
   */
  taskCountByClass?: Record<string, number>;
  capstoneCountByClass?: Record<string, number>;
  alerts: AlertStudent[];
  thresholds: AlertThresholds;
}
