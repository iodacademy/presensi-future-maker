// Penghitungan dan pembacaan ringkasan dashboard / Computing and reading the dashboard snapshot
import { getAdminDb } from '../../lib/firebase/admin';
import type { Actor, UserDocument } from '../auth/types';
import type { ClassDocument } from '../classes/types';
import type { AttendanceStatus, SessionDocument } from '../attendance/types';
import { summariseAnswers } from '../survey/policy';
import { NUMERIC_KINDS } from '../survey/types';
import type { SurveyAnswer, SurveyFormDocument, SurveyResponseDocument } from '../survey/types';
import { ageFrom } from '../users/profile-service';
import { countsAfterJoin, effectiveDueAt, joinMoment } from '../users/join-policy';
import { hitungFase, keteranganFase } from './phases';
import { buildFeedbackReport } from './feedback';
import { countUnexcused, gradeParticipant, gradedMeetings, performanceScore } from '../grading/policy';
import { comparePlacementRank, decidePlacement } from '../grading/placement';
import { wibDate } from '@/lib/time';
import {
  DISABILITY_LABELS,
  ENTRY_STATUS_LABELS,
  GENDER_LABELS,
  type StudentProfileDocument,
} from '../users/profile-types';
import type {
  AlertStudent,
  AlertThresholds,
  DashboardSnapshot,
  ProfileRow,
  SurveyQuestionPoint,
  LoginPoint,
} from './snapshot-types';

/**
 * Ambang yang memunculkan peserta pada daftar siaga.
 *
 * The thresholds that put a participant on the alert list.
 */
export const ALERT_THRESHOLDS: AlertThresholds = {
  attendance: 75,
  task: 70,
  quiz: 70,
};

/**
 * Umur ringkasan sebelum dihitung ulang sendiri, dalam milidetik.
 *
 * Satu jam, bukan sekali sehari: angka yang menua sepanjang hari membuat admin
 * yang baru menilai tugas tidak melihat perubahannya dan mengira penilaiannya
 * gagal. Satu jam cukup jarang untuk menjaga biaya baca, cukup sering untuk
 * terasa menanggapi.
 *
 * How old a snapshot may be before it recomputes itself, in milliseconds.
 *
 * One hour rather than once a day: figures that age all day leave an admin who
 * just graded a task seeing no change and assuming the grading failed. An hour
 * is rare enough to keep the read cost down, frequent enough to feel
 * responsive.
 */
export const SNAPSHOT_MAX_AGE_MS = 60 * 60 * 1000;

/**
 * Versi bentuk ringkasannya. Dinaikkan tiap kali cara menghitungnya berubah
 * sehingga angka lama menjadi salah, bukan tiap kali ada medan baru: medan baru
 * yang kosong hanya membuat satu panel menunggu satu jam, sedangkan angka yang
 * salah dibaca sebagai kebenaran.
 *
 * 2: kolom kehadiran dikelompokkan per kelas. Sebelumnya tiap peserta diberi
 *    kolom untuk sesi seluruh kelas, sehingga kehadirannya jatuh ke angka yang
 *    tidak pernah terjadi.
 * 3: kolom tugas dan kuis dikelompokkan per kelas, dengan alasan yang sama.
 * 4: peringkat dan daftar siaga hanya menghitung peserta yang terdaftar di
 *    kelas; akun tanpa kelas (mis. mentor yang terimpor sebagai peserta)
 *    bernilai nol.
 *
 * The snapshot's shape version. Raised whenever the way figures are computed
 * changes such that old ones become wrong, not whenever a field is added: a new
 * empty field merely leaves one panel waiting an hour, while a wrong figure is
 * read as the truth.
 *
 * 2: attendance columns grouped per class. Previously each participant was given
 *    columns for every class's sessions, dropping their attendance to a figure
 *    that never happened.
 * 3: task and quiz columns grouped per class, for the same reason.
 * 4: ranking and alerts count only participants enrolled in a class; accounts
 *    without one (e.g. a mentor imported as a participant) scored zero.
 * 5: excused, sick and absent records no longer count as present; every
 *    attendance record used to.
 * 6: meetings and tasks that ended before a participant joined no longer count
 *    against them.
 * 7: tasks stay required for late joiners, only without a deadline; meetings
 *    before joining still do not count.
 * 8: only Tugas Praktik Mandiri count as tasks; in-class practice results no
 *    longer do, and capstones get their own submission columns.
 * 9: per-class task counts, so the per-task submission figure divides by every
 *    participant of the class rather than only those submitted or overdue.
 * 10: the ranking uses the weighted final score (capstone, task scores,
 *     attendance, quizzes with untaken ones as zero) instead of the plain
 *     average of attendance, task submission and quizzes taken.
 * 11: the ranking's attendance counts only "Pertemuan N" sessions.
 * 12: the capstone is read from the graded capstone task, not only the import.
 * 13: the ranking carries each participant's internship placement and
 *     breaks SPA ties by capstone, then attendance.
 * 14: the ranking carries every component score for the placement table.
 * 15: the ranking carries the Best Performance score (attendance, TPM,
 *     first quiz attempts; no capstone).
 * 16: the Best Performance score and its components keep one decimal.
 */
export const SNAPSHOT_VERSION = 16;

function persen(bagian: number, dari: number): number {
  if (dari <= 0) return 0;
  return Math.round((bagian / dari) * 100);
}

/**
 * Menghitung ringkasan dari seluruh data yang ada.
 *
 * Tiap koleksi dibaca sekali lalu dikelompokkan di memori. Satu kueri per
 * peserta per angka akan menjadi ratusan kueri untuk satu halaman, dan
 * biayanya ditanggung tiap kali halamannya dibuka.
 *
 * Computes the snapshot from all existing data.
 *
 * Each collection is read once and grouped in memory. One query per participant
 * per figure would be hundreds of queries for one page, and the cost would be
 * paid on every open.
 */
export async function computeSnapshot(actor: Actor): Promise<DashboardSnapshot> {
  if (actor.role !== 'admin') {
    throw new Error('Hanya admin yang diizinkan menghitung ringkasan');
  }

  const db = getAdminDb();
  const [
    classesSnap,
    usersSnap,
    sessionsSnap,
    attendanceSnap,
    tasksSnap,
    submissionsSnap,
    examsSnap,
    attemptsSnap,
    quotasSnap,
    formsSnap,
    responsesSnap,
    capstoneSnap,
    catatanSnap,
    profilesSnap,
    loginsSnap,
  ] = await Promise.all([
    db.collection('classes').get(),
    db.collection('users').where('role', '==', 'student').get(),
    db.collection('sessions').get(),
    db.collection('attendance').select('sessionId', 'studentId', 'status').get(),
    db.collection('tasks').where('published', '==', true).get(),
    db.collection('submissions').get(),
    db.collection('exams').where('published', '==', true).get(),
    db.collection('examAttempts').get(),
    db.collection('mentoringQuotas').get(),
    db.collection('surveyForms').get(),
    db.collection('surveyResponses').get(),
    db.collection('assessmentScores').where('kind', '==', 'capstone').get(),
    db.collection('studentNotes').get(),
    db.collection('studentProfiles').get(),
    // Dibatasi enam puluh hari terakhir, bukan seluruh koleksinya: satu baris
    // per peserta per hari berarti seratus baris sehari, dan dalam dua tahun
    // penghitungan ringkasan akan membaca empat puluh ribu dokumen hanya untuk
    // satu grafik -- hampir seluruh kuota baca harian.
    //
    // Limited to the last sixty days rather than the whole collection: one row per
    // participant per day means a hundred rows a day, and within two years the
    // snapshot would read forty thousand documents for one chart alone -- nearly
    // the entire daily read quota.
    db.collection('lmsLogins').where('date', '>=', wibDate(new Date(Date.now() - 60 * 24 * 60 * 60 * 1000))).get(),
  ]);

  const classes = classesSnap.docs.map((d) => d.data() as ClassDocument);
  const classNames = new Map(classes.map((c) => [c.id, c.canonicalName]));
  const classCities = new Map(classes.map((c) => [c.id, c.city]));

  // Akun test dibuang di sini, sebelum apa pun dihitung: setiap angka di bawah
  // -- presensi, tugas, ujian, feedback, mentoring, login -- disaring lewat
  // daftar ini, sehingga satu saringan menjangkau seluruhnya.
  //
  // Test accounts are dropped here, before anything is computed: every figure
  // below -- attendance, tasks, exams, feedback, mentoring, logins -- filters
  // through this list, so one filter reaches them all.
  const students = usersSnap.docs.map((d) => d.data() as UserDocument).filter((s) => !s.isTest);
  const aktif = students.filter((s) => s.active);
  const aktifIds = new Set(aktif.map((s) => s.uid));
  // Peserta yang bergabung di tengah program tidak dihitung absen pada yang
  // sudah lewat sebelum ia bergabung / Mid-programme joiners are not counted
  // absent for what had passed before they joined
  const joinPerSiswa = new Map(students.map((s) => [s.uid, joinMoment(s)]));

  // --- status peserta per daerah --------------------------------------
  const perKelas = classes.map((c) => {
    const terdaftar = students.filter((s) => s.classId === c.id);
    const hidup = terdaftar.filter((s) => s.active).length;
    return {
      classId: c.id,
      className: c.canonicalName,
      programName: c.programName ?? '',
      city: c.city,
      registered: terdaftar.length,
      active: hidup,
      droppedOut: terdaftar.length - hidup,
    };
  });

  // --- profil peserta ---------------------------------------------------
  // Disimpan sebagai baris mentah, bukan sebagai sebaran yang sudah dijumlah:
  // dashboardnya dapat disaring per daerah, dan sebaran yang sudah dijumlah
  // tidak dapat dipecah lagi.
  //
  // Stored as raw rows rather than a summed distribution: the dashboard can be
  // filtered by region, and a summed distribution cannot be split again.
  const kotaPerSiswa = new Map(aktif.map((s) => [s.uid, classCities.get(s.classId ?? '') ?? '']));

  const profiles: ProfileRow[] = [];
  const sudahLengkap = new Set<string>();
  for (const d of profilesSnap.docs) {
    const pr = d.data() as StudentProfileDocument;
    // Hanya peserta aktif yang dihitung: profil peserta yang sudah keluar tetap
    // tersimpan, dan menyertakannya membuat sebarannya menggambarkan angkatan
    // yang tidak lagi ada.
    //
    // Only active participants count: a departed participant's profile stays
    // stored, and including it would have the distribution describe a cohort
    // that no longer exists.
    if (!aktifIds.has(pr.id)) continue;
    sudahLengkap.add(pr.id);
    profiles.push({
      city: kotaPerSiswa.get(pr.id) ?? '',
      gender: GENDER_LABELS[pr.gender] ?? pr.gender,
      disability: DISABILITY_LABELS[pr.disability] ?? pr.disability,
      entryStatus: ENTRY_STATUS_LABELS[pr.entryStatus] ?? pr.entryStatus,
      age: ageFrom(pr.birthDate),
    });
  }

  const profilePendingByCity: Record<string, number> = {};
  for (const s of aktif) {
    if (sudahLengkap.has(s.uid)) continue;
    const kota = kotaPerSiswa.get(s.uid) ?? '';
    profilePendingByCity[kota] = (profilePendingByCity[kota] ?? 0) + 1;
  }

  // --- kehadiran per pertemuan ----------------------------------------
  const sessions = sessionsSnap.docs
    .map((d) => d.data() as SessionDocument)
    .sort((a, b) => a.date.localeCompare(b.date));

  const hadirPerSesi = new Map<string, Set<string>>();
  const statusPerSesi = new Map<string, Map<string, AttendanceStatus>>();
  for (const d of attendanceSnap.docs) {
    const a = d.data() as { sessionId: string; studentId: string; status?: AttendanceStatus };
    // Peserta nonaktif tidak dihitung: persentasenya dibagi jumlah peserta
    // aktif, dan menyertakan yang sudah keluar membuat angkanya melampaui
    // seratus.
    //
    // Inactive participants are excluded: the percentage divides by the active
    // count, and including those who left would push it past a hundred.
    if (!aktifIds.has(a.studentId)) continue;
    // Dokumen lama tanpa status berasal dari pemindaian, jadi hadir. Izin,
    // sakit, dan tidak hadir juga tercatat sebagai dokumen, sehingga keberadaan
    // dokumen saja tidak berarti hadir.
    //
    // Older documents without a status came from a scan, so present. Excused,
    // sick and absent are records too, so a record alone does not mean present.
    const status = a.status ?? 'present';
    if (!statusPerSesi.has(a.sessionId)) statusPerSesi.set(a.sessionId, new Map());
    statusPerSesi.get(a.sessionId)!.set(a.studentId, status);
    if (status !== 'present') continue;
    if (!hadirPerSesi.has(a.sessionId)) hadirPerSesi.set(a.sessionId, new Set());
    hadirPerSesi.get(a.sessionId)!.add(a.studentId);
  }

  const nowIso = new Date().toISOString();
  // --- tugas: dikelompokkan per kelas ---------------------------------
  // Tiap kelas punya deret tugasnya sendiri, diurutkan menurut nomornya. Kolom
  // ke-n pada tabel adalah tugas ke-n kelas peserta itu. Menyatukan tugas
  // seluruh kelas menjadi satu deret membuat kolom "Tugas 2" milik satu kelas
  // saja, dan peserta kelas lain -- yang tidak mungkin mengumpulkannya --
  // terhitung nol persen begitu tenggatnya lewat.
  //
  // Each class has its own run of tasks, ordered by number. Column n in the table
  // is the nth task of that participant's class. Pooling every class's tasks into
  // one run makes the "Tugas 2" column belong to one class alone, and participants
  // from other classes -- who cannot possibly submit it -- count as zero percent
  // once its deadline passes.
  //
  // Hanya Tugas Praktik Mandiri yang dihitung sebagai tugas. Hasil praktik di
  // kelas tidak dinilai, dan capstone punya kolom pengumpulannya sendiri.
  // Only Tugas Praktik Mandiri count as tasks. In-class practice results are not
  // graded, and capstones get their own submission columns.
  const tugasPerKelasId = new Map<string, { id: string; title: string; order: number }[]>();
  const capstonePerKelasId = new Map<string, { id: string; title: string; order: number }[]>();
  for (const d of tasksSnap.docs) {
    const t = d.data() as { id: string; title: string; order: number; kind: string; classId: string };
    const per = t.kind === 'daily' ? tugasPerKelasId : t.kind === 'capstone' ? capstonePerKelasId : null;
    if (!per) continue;
    if (!per.has(t.classId)) per.set(t.classId, []);
    per.get(t.classId)!.push(t);
  }
  for (const daftar of [...tugasPerKelasId.values(), ...capstonePerKelasId.values()]) daftar.sort((a, b) => a.order - b.order);
  const kolomTugas = Math.max(0, ...[...tugasPerKelasId.values()].map((d) => d.length));
  const kolomCapstone = Math.max(0, ...[...capstonePerKelasId.values()].map((d) => d.length));

  // --- kuis per sesi dan learning gain --------------------------------
  const exams = examsSnap.docs.map((d) => d.data() as { id: string; title: string; kind: string; classId: string; sessionId: string | null });
  const examById = new Map(exams.map((e) => [e.id, e]));

  const nilaiTertinggi = new Map<string, Map<string, number>>();
  // Rubrik Performance Terbaik hanya menghitung percobaan pertama / The Best Performance rubric counts only the first attempt
  const nilaiPertama = new Map<string, Map<string, number>>();
  for (const d of attemptsSnap.docs) {
    const a = d.data() as { examId: string; studentId: string; status: string; score: number | null; attemptNumber?: number };
    if (a.status !== 'selesai' || a.score === null) continue;
    if (!aktifIds.has(a.studentId)) continue;
    if ((a.attemptNumber ?? 1) === 1) {
      if (!nilaiPertama.has(a.examId)) nilaiPertama.set(a.examId, new Map());
      nilaiPertama.get(a.examId)!.set(a.studentId, a.score);
    }
    if (!nilaiTertinggi.has(a.examId)) nilaiTertinggi.set(a.examId, new Map());
    const peta = nilaiTertinggi.get(a.examId)!;
    peta.set(a.studentId, Math.max(peta.get(a.studentId) ?? 0, a.score));
  }

  const rataUjian = (examId: string): number | null => {
    const nilai = [...(nilaiTertinggi.get(examId)?.values() ?? [])];
    if (nilai.length === 0) return null;
    return Math.round(nilai.reduce((a, b) => a + b, 0) / nilai.length);
  };

  const learningGain = classes.map((c) => {
    const pre = exams.find((e) => e.classId === c.id && e.kind === 'pretest');
    const post = exams.find((e) => e.classId === c.id && e.kind === 'posttest');
    return {
      className: c.canonicalName,
      pretest: pre ? rataUjian(pre.id) : null,
      posttest: post ? rataUjian(post.id) : null,
    };
  });

  // --- mentoring -------------------------------------------------------
  const kuota = new Map<string, number>();
  for (const d of quotasSnap.docs) {
    // Id dokumennya "${uid}_${phase}"; yang dihitung pemakaian fase bootcamp.
    // The document id is "${uid}_${phase}"; what counts is the bootcamp phase.
    const [uid, phase] = d.id.split('_');
    if (phase !== 'bootcamp' || !aktifIds.has(uid)) continue;
    kuota.set(uid, (d.data()?.count as number) ?? 0);
  }

  const mentoring = { none: 0, once: 0, twice: 0 };
  for (const s of aktif) {
    const n = kuota.get(s.uid) ?? 0;
    if (n <= 0) mentoring.none += 1;
    else if (n === 1) mentoring.once += 1;
    else mentoring.twice += 1;
  }

  // --- survei -----------------------------------------------------------
  const forms = formsSnap.docs.map((d) => d.data() as SurveyFormDocument).filter((f) => f.published);
  const jawabanPerForm = new Map<string, SurveyAnswer[]>();
  const penjawabPerForm = new Map<string, Set<string>>();
  for (const d of responsesSnap.docs) {
    const r = d.data() as SurveyResponseDocument;
    if (!aktifIds.has(r.studentId)) continue;
    if (!jawabanPerForm.has(r.formId)) jawabanPerForm.set(r.formId, []);
    jawabanPerForm.get(r.formId)!.push(...r.answers);
    if (!penjawabPerForm.has(r.formId)) penjawabPerForm.set(r.formId, new Set());
    penjawabPerForm.get(r.formId)!.add(r.studentId);
  }

  // Jawaban dikelompokkan per kota supaya satu daerah yang ratingnya jatuh
  // tidak tertutupi tiga daerah yang baik.
  //
  // Answers are grouped by city so one region whose rating has dropped is not
  // masked by three good ones.
  const jawabanPerFormKota = new Map<string, Map<string, SurveyAnswer[]>>();
  const penjawabPerFormKota = new Map<string, Map<string, Set<string>>>();
  for (const d of responsesSnap.docs) {
    const r = d.data() as SurveyResponseDocument;
    if (!aktifIds.has(r.studentId)) continue;
    const kota = kotaPerSiswa.get(r.studentId) ?? '';
    if (!jawabanPerFormKota.has(r.formId)) jawabanPerFormKota.set(r.formId, new Map());
    const perKota = jawabanPerFormKota.get(r.formId)!;
    if (!perKota.has(kota)) perKota.set(kota, []);
    perKota.get(kota)!.push(...r.answers);

    if (!penjawabPerFormKota.has(r.formId)) penjawabPerFormKota.set(r.formId, new Map());
    const orangPerKota = penjawabPerFormKota.get(r.formId)!;
    if (!orangPerKota.has(kota)) orangPerKota.set(kota, new Set());
    orangPerKota.get(kota)!.add(r.studentId);
  }

  const aktifPerKota = new Map<string, number>();
  for (const s of aktif) {
    const kota = kotaPerSiswa.get(s.uid) ?? '';
    aktifPerKota.set(kota, (aktifPerKota.get(kota) ?? 0) + 1);
  }

  const rataBerangka = (jawaban: SurveyAnswer[]): number | null => {
    const berangka = summariseAnswers(jawaban).filter((r) => NUMERIC_KINDS.includes(r.kind) && r.average !== null);
    if (berangka.length === 0) return null;
    return Math.round((berangka.reduce((t, r) => t + (r.average ?? 0), 0) / berangka.length) * 10) / 10;
  };

  // Tiap pertanyaan dipecah per kota untuk peta panasnya. Hanya pertanyaan
  // bernilai angka: isian bebas tidak punya angka untuk dirata-rata.
  //
  // Each question is split per city for the heatmap. Numeric questions only:
  // free text has no number to average.
  const surveyQuestions: SurveyQuestionPoint[] = [];
  for (const f of forms) {
    const perKota = jawabanPerFormKota.get(f.id);
    if (!perKota) continue;
    const seluruh = summariseAnswers([...perKota.values()].flat());
    for (const q of seluruh) {
      if (!NUMERIC_KINDS.includes(q.kind)) continue;
      const byCity: Record<string, number | null> = {};
      for (const [kota, jawaban] of perKota) {
        const satu = summariseAnswers(jawaban).find((x) => x.questionText === q.questionText);
        byCity[kota] = satu?.average ?? null;
      }
      surveyQuestions.push({ label: q.questionText, byCity });
    }
  }

  const surveys = forms.map((f) => {
    const ringkas = summariseAnswers(jawabanPerForm.get(f.id) ?? []);
    // Hanya pertanyaan bernilai angka yang dirata-rata; isian bebas dan
    // pilihan ganda tidak punya angka untuk dijumlahkan.
    //
    // Only numeric questions are averaged; free text and multiple choice have
    // no number to add up.
    const berangka = ringkas.filter((r) => NUMERIC_KINDS.includes(r.kind) && r.average !== null);
    const average = berangka.length === 0
      ? null
      : Math.round((berangka.reduce((t, r) => t + (r.average ?? 0), 0) / berangka.length) * 10) / 10;

    return {
      formId: f.id,
      formTitle: f.title,
      average,
      responseRate: persen(penjawabPerForm.get(f.id)?.size ?? 0, aktif.length),
      byCity: Object.fromEntries(
        [...aktifPerKota.keys()].map((kota) => [
          kota,
          {
            average: rataBerangka(jawabanPerFormKota.get(f.id)?.get(kota) ?? []),
            responseRate: persen(
              penjawabPerFormKota.get(f.id)?.get(kota)?.size ?? 0,
              aktifPerKota.get(kota) ?? 0
            ),
          },
        ])
      ),
    };
  });

  // Laporan feedback lengkap dari jawaban yang sama, tanpa baca tambahan.
  // Pembagi tingkat respons adalah peserta aktif kelas itu yang hadir di
  // pertemuannya: survei hanya diminta dari yang hadir.
  //
  // The full feedback report from the same responses, with no extra reads.
  // The response-rate divisor is the class's active participants present at
  // that meeting: the survey is only asked of those who attended.
  const kelasPerSiswa = new Map(aktif.map((st) => [st.uid, st.classId ?? '']));
  const hadirPerSesiKelas = new Map<string, number>();
  for (const [sessionId, hadir] of hadirPerSesi) {
    for (const uid of hadir) {
      const key = `${sessionId}_${kelasPerSiswa.get(uid) ?? ''}`;
      hadirPerSesiKelas.set(key, (hadirPerSesiKelas.get(key) ?? 0) + 1);
    }
  }
  const feedback = buildFeedbackReport({
    forms,
    responses: responsesSnap.docs.map((d) => d.data() as SurveyResponseDocument).filter((r) => aktifIds.has(r.studentId)),
    attendeesBySessionClass: hadirPerSesiKelas,
    classCities,
  });

  // --- login LMS per hari ------------------------------------------------
  // Dikelompokkan per tanggal dan kota. Satu dokumen per peserta per hari sudah
  // menjamin tidak ada yang terhitung dua kali pada hari yang sama.
  //
  // Grouped by date and city. One document per participant per day already
  // guarantees nobody is counted twice on the same day.
  const loginPerTanggal = new Map<string, Record<string, number>>();
  for (const d of loginsSnap.docs) {
    const l = d.data() as { uid: string; date: string };
    if (!aktifIds.has(l.uid)) continue;
    if (!loginPerTanggal.has(l.date)) loginPerTanggal.set(l.date, {});
    const perKota = loginPerTanggal.get(l.date)!;
    const kota = kotaPerSiswa.get(l.uid) ?? '';
    perKota[kota] = (perKota[kota] ?? 0) + 1;
  }
  // Hanya enam puluh hari terakhir yang disimpan. Grafiknya memperlihatkan
  // keaktifan belakangan, dan satu baris per hari tumbuh tanpa batas: empat
  // ratus hari dalam dua tahun akan membuat dokumen ringkasannya menggelembung
  // demi hari-hari yang tidak ada yang menelusuri lagi.
  //
  // ponytail: dipangkas 60 hari, simpan per bulan bila kelak dibutuhkan riwayat
  // yang lebih panjang
  //
  // Only the last sixty days are kept. The chart shows recent activity, and one
  // row per day grows without bound: four hundred days over two years would swell
  // the snapshot document for days nobody scans any more.
  const logins: LoginPoint[] = [...loginPerTanggal.entries()]
    .map(([date, byCity]) => ({ date, byCity }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-60);

  // --- peringkat dan daftar siaga ---------------------------------------
  const sesiDimulaiPerKelas = new Map<string, SessionDocument[]>();
  for (const s of sessions) {
    if (s.startsAt > nowIso) continue;
    for (const cid of s.classIds ?? [s.classId]) {
      if (!sesiDimulaiPerKelas.has(cid)) sesiDimulaiPerKelas.set(cid, []);
      sesiDimulaiPerKelas.get(cid)!.push(s);
    }
  }

  // Pertemuan yang sudah dimulai dan dihitung bagi peserta itu, beserta yang ia hadiri.
  // Meetings already started that count for that participant, and those attended.
  const hadirTerhitung = (uid: string, cid: string): { hadir: number; dari: number } => {
    const join = joinPerSiswa.get(uid) ?? '';
    const terhitung = (sesiDimulaiPerKelas.get(cid) ?? []).filter((x) =>
      countsAfterJoin(x.endsAt, join, statusPerSesi.get(x.id)?.has(uid) ?? false)
    );
    return { hadir: terhitung.filter((x) => hadirPerSesi.get(x.id)?.has(uid)).length, dari: terhitung.length };
  };

  // Nilai tugas per peserta per tugas, untuk kolom tabelnya. Angka ringkas
  // tidak dapat memberi tahu tugas mana yang kosong, dan itulah yang dicari
  // admin saat menindaklanjuti.
  //
  // Per-participant, per-task scores for the table's columns. A summary figure
  // cannot say which task is blank, and that is what an admin looks for when
  // following up.
  const nilaiTugasPerSiswa = new Map<string, Map<string, number | null>>();
  for (const d of submissionsSnap.docs) {
    const sub = d.data() as { studentId: string; taskId: string; score: number | null };
    if (!aktifIds.has(sub.studentId)) continue;
    if (!nilaiTugasPerSiswa.has(sub.studentId)) nilaiTugasPerSiswa.set(sub.studentId, new Map());
    nilaiTugasPerSiswa.get(sub.studentId)!.set(sub.taskId, sub.score ?? null);
  }

  // Terkumpul atau tidak dicatat terpisah dari nilainya: tugas yang terkumpul
  // tetapi belum dinilai bernilai null pada nilainya -- sama dengan tugas yang
  // tidak pernah dikumpulkan, padahal yang pertama menunggu admin dan yang
  // kedua menunggu peserta.
  //
  // Whether it was submitted is recorded apart from its score: a task submitted
  // but not yet graded is null in the score -- the same as one never handed in,
  // though the first waits on the admin and the second on the participant.
  const terkumpulPerSiswa = new Map<string, Set<string>>();
  for (const d of submissionsSnap.docs) {
    const sub = d.data() as { studentId: string; taskId: string };
    if (!aktifIds.has(sub.studentId)) continue;
    if (!terkumpulPerSiswa.has(sub.studentId)) terkumpulPerSiswa.set(sub.studentId, new Set());
    terkumpulPerSiswa.get(sub.studentId)!.add(sub.taskId);
  }

  const tenggatTugas = new Map<string, string | null>();
  for (const t of tasksSnap.docs) {
    const d = t.data() as { id: string; dueAt?: string | null };
    tenggatTugas.set(d.id, d.dueAt ?? null);
  }

  const nilaiCapstone = new Map<string, number>();
  for (const d of capstoneSnap.docs) {
    const a = d.data() as { studentId: string; score: number };
    nilaiCapstone.set(a.studentId, a.score);
  }

  const catatan = new Map<string, { note: string; followUp: string }>();
  for (const d of catatanSnap.docs) {
    const c = d.data() as { note?: string; followUp?: string };
    catatan.set(d.id, { note: c.note ?? '', followUp: c.followUp ?? '' });
  }

  const nilaiKuisPerSiswa = new Map<string, number[]>();
  for (const [examId, peta] of nilaiTertinggi) {
    if (examById.get(examId)?.kind === 'pretest') continue;
    for (const [uid, nilai] of peta) {
      if (!nilaiKuisPerSiswa.has(uid)) nilaiKuisPerSiswa.set(uid, []);
      nilaiKuisPerSiswa.get(uid)!.push(nilai);
    }
  }

  // true terkumpul, false lewat tenggat tanpa dikumpulkan, null belum dibuka.
  // true submitted, false past deadline with nothing handed in, null not yet open.
  const statusKumpul = (uid: string, t: { id: string } | undefined): boolean | null => {
    if (!t) return null;
    if (terkumpulPerSiswa.get(uid)?.has(t.id)) return true;
    // Tenggat yang belum lewat bernilai null, bukan false: peserta masih
    // punya waktu, dan menandainya sebagai tidak mengumpulkan membuat
    // admin menghubungi orang yang tidak terlambat.
    //
    // A deadline not yet passed is null, not false: the participant still
    // has time, and marking it as missed would have an admin contact
    // someone who is not late.
    const tenggat = tenggatTugas.get(t.id);
    if (!tenggat || tenggat > nowIso) return null;
    // Tenggat yang lewat sebelum ia bergabung tidak berlaku baginya: tugasnya
    // masih terbuka, belum terlewat. / A deadline that passed before they
    // joined does not apply: the task is still open, not missed.
    if (!effectiveDueAt(tenggat, joinPerSiswa.get(uid))) return null;
    return false;
  };

  // Tugas tetap wajib bagi peserta yang bergabung belakangan; hanya tenggatnya
  // yang tidak berlaku (lihat statusKumpul).
  // Tasks stay required for late joiners; only their deadline does not apply
  // (see taskSubmitted).
  const tugasTerhitung = (uid: string, cid: string): { kumpul: number; dari: number } => {
    const terkumpul = terkumpulPerSiswa.get(uid);
    const semua = tugasPerKelasId.get(cid) ?? [];
    return { kumpul: semua.filter((t) => terkumpul?.has(t.id)).length, dari: semua.length };
  };

  // Hanya peserta yang terdaftar di kelas yang ada. Akun berperan peserta
  // tanpa kelas -- mis. mentor atau akun uji yang terimpor sebagai peserta --
  // tidak punya pertemuan, tugas, maupun kuis, sehingga selalu bernilai nol:
  // jatuh ke daftar siaga dan dasar peringkat tanpa pernah menjadi peserta.
  //
  // Only participants enrolled in an existing class. A participant-role
  // account without a class -- e.g. a mentor or test account imported as a
  // participant -- has no meetings, tasks or quizzes, so it always scores zero:
  // it lands in the alert list and the bottom of the ranking without ever
  // being a participant.
  const terukur = aktif.filter((s) => s.classId && classNames.has(s.classId)).map((s) => {
    const cid = s.classId ?? '';
    const kehadiran = hadirTerhitung(s.uid, cid);
    const tugas = tugasTerhitung(s.uid, cid);
    const attendanceRate = persen(kehadiran.hadir, kehadiran.dari);
    const taskRate = persen(tugas.kumpul, tugas.dari);
    const nilaiKuis = nilaiKuisPerSiswa.get(s.uid) ?? [];
    const quizAverage = nilaiKuis.length === 0
      ? 0
      : Math.round(nilaiKuis.reduce((a, b) => a + b, 0) / nilaiKuis.length);

    return {
      studentId: s.uid,
      studentName: s.name,
      className: classNames.get(cid) ?? '',
      city: classCities.get(cid) ?? '',
      attendanceRate,
      taskRate,
      quizAverage,
    };
  });

  // Skema magang memakai nilai akhir berbobot yang sama dengan halaman Nilai
  // Akhir, lewat fungsi yang sama, sehingga tidak pernah berbeda dari nilai
  // resminya. Peringkat Performance Terbaik memakai rubriknya sendiri, tanpa
  // capstone (lihat performanceScore).
  //
  // The internship scheme uses the same weighted final score as the Final Score
  // page, through the same function, so it never differs from the official
  // score. The Best Performance ranking uses its own rubric, without the
  // capstone (see performanceScore).
  const sesiPerKelas = new Map<string, { id: string; endsAt: string; title: string }[]>();
  for (const x of sessions) {
    for (const cid of new Set([x.classId, ...(x.classIds ?? [])])) {
      if (!sesiPerKelas.has(cid)) sesiPerKelas.set(cid, []);
      sesiPerKelas.get(cid)!.push({ id: x.id, endsAt: x.endsAt, title: x.title });
    }
  }
  const ranking = aktif
    .filter((st) => st.classId && classNames.has(st.classId))
    .map((st) => {
      const cid = st.classId ?? '';
      const nilaiTugas = nilaiTugasPerSiswa.get(st.uid);
      const joinIso = joinPerSiswa.get(st.uid) ?? '';
      const examIds = exams.filter((e) => e.classId === cid && e.kind !== 'pretest').map((e) => e.id);
      const nilai = gradeParticipant({
        sessions: sesiPerKelas.get(cid) ?? [],
        joinIso,
        recorded: (id) => statusPerSesi.get(id)?.has(st.uid) ?? false,
        present: (id) => hadirPerSesi.get(id)?.has(st.uid) ?? false,
        taskIds: (tugasPerKelasId.get(cid) ?? []).map((t) => t.id),
        taskScore: (id) => nilaiTugas?.get(id) ?? null,
        examIds,
        quizScore: (id) => nilaiTertinggi.get(id)?.get(st.uid) ?? null,
        capstoneTaskIds: (capstonePerKelasId.get(cid) ?? []).map((t) => t.id),
        capstone: nilaiCapstone.get(st.uid) ?? null,
      });
      const komponen = (k: string) => nilai.breakdown.find((b) => b.component === k)?.score ?? 0;
      const unexcused = countUnexcused({
        sessions: sesiPerKelas.get(cid) ?? [],
        joinIso,
        nowIso,
        status: (id) => statusPerSesi.get(id)?.get(st.uid),
      });
      const pertemuan = gradedMeetings(sesiPerKelas.get(cid) ?? [], joinIso, (id) => statusPerSesi.get(id)?.has(st.uid) ?? false);
      const perf = performanceScore({
        meetings: pertemuan.length,
        attended: pertemuan.filter((x) => hadirPerSesi.get(x.id)?.has(st.uid)).length,
        taskScores: (tugasPerKelasId.get(cid) ?? []).map((t) => nilaiTugas?.get(t.id) ?? null),
        quizScores: examIds.map((id) => nilaiPertama.get(id)?.get(st.uid) ?? null),
      });
      const { placement, reasons } = decidePlacement({
        spa: nilai.score, capstone: komponen('capstone'), unexcused, capstoneGraded: !nilai.pending.includes('capstone'),
      });
      return {
        studentId: st.uid,
        studentName: st.name,
        className: classNames.get(cid) ?? '',
        city: classCities.get(cid) ?? '',
        score: nilai.score,
        capstone: komponen('capstone'),
        tasks: komponen('tasks'),
        attendance: komponen('attendance'),
        quiz: komponen('quiz'),
        // Asal tiap angka, mis. "11 dari 12 pertemuan", agar penempatannya dapat diperiksa
        // Where each number comes from, e.g. "11 dari 12 pertemuan", so the placement can be checked
        componentDetails: Object.fromEntries(nilai.breakdown.map((b) => [b.component, b.detail])),
        unexcused,
        perfScore: perf.score,
        perfAttendance: perf.attendance,
        perfTasks: perf.tasks,
        perfQuiz: perf.quiz,
        placement,
        placementReasons: reasons,
      };
    })
    // Bila SPA sama, capstone lalu kehadiran menentukan urutan (skema magang)
    // When SPA ties, capstone then attendance decide the order (internship scheme)
    .sort((a, b) => comparePlacementRank({ ...a, spa: a.score }, { ...b, spa: b.score }));

  const alerts: AlertStudent[] = terukur
    .map((t) => {
      let issueCount = 0;
      if (t.attendanceRate < ALERT_THRESHOLDS.attendance) issueCount += 1;
      if (t.taskRate < ALERT_THRESHOLDS.task) issueCount += 1;
      if (t.quizAverage < ALERT_THRESHOLDS.quiz) issueCount += 1;
      return { ...t, issueCount };
    })
    .filter((t) => t.issueCount > 0)
    .sort((a, b) => b.issueCount - a.issueCount || a.studentName.localeCompare(b.studentName, 'id'));

  // Urutan kuis dan tugas dikunci di sini supaya kolom tabelnya sejajar
  // antar-peserta. Mengurutkannya per peserta membuat kolom "Kuis 3" memuat
  // kuis yang berbeda pada tiap baris.
  //
  // The quiz and task order is fixed here so the table's columns line up across
  // participants. Sorting per participant would have the "Kuis 3" column hold a
  // different quiz on each row.
  // Kuis dikelompokkan per kelas dan diurutkan menurut tanggal pertemuannya,
  // dengan alasan yang sama seperti tugas: kuis pertemuan 3 Surabaya bukan
  // kuis pertemuan 3 Semarang, dan peserta Semarang tidak dapat mengerjakan
  // milik Surabaya.
  //
  // Quizzes are grouped per class and ordered by their meeting's date, for the
  // same reason as tasks: Surabaya's meeting 3 quiz is not Semarang's, and a
  // Semarang participant cannot sit Surabaya's.
  const tanggalSesi = new Map(sessions.map((x) => [x.id, x.date]));
  const kuisPerKelasId = new Map<string, typeof exams>();
  for (const e of exams) {
    if (e.kind !== 'kuis') continue;
    if (!kuisPerKelasId.has(e.classId)) kuisPerKelasId.set(e.classId, []);
    kuisPerKelasId.get(e.classId)!.push(e);
  }
  for (const daftar of kuisPerKelasId.values()) {
    daftar.sort((a, b) => {
      const ta = a.sessionId ? tanggalSesi.get(a.sessionId) ?? '' : '';
      const tb = b.sessionId ? tanggalSesi.get(b.sessionId) ?? '' : '';
      return ta.localeCompare(tb) || a.title.localeCompare(b.title, 'id');
    });
  }
  const kolomKuis = Math.max(0, ...[...kuisPerKelasId.values()].map((d) => d.length));

  /**
   * Label kolom ke-n: judul bersama bila seluruh kelas memakai judul yang sama
   * pada urutan itu, selainnya nomornya saja. Keterangan yang salah lebih buruk
   * daripada tanpa keterangan.
   *
   * Column n's label: the shared title when every class uses the same title at
   * that position, otherwise just its number. A wrong caption is worse than none.
   */
  const labelKolom = (per: Map<string, { title: string }[]>, jumlah: number, awalan: string) =>
    Array.from({ length: jumlah }, (_, i) => {
      const judul = [...per.values()].map((d) => d[i]?.title).filter((t): t is string => Boolean(t));
      return new Set(judul).size === 1 ? judul[0] : `${awalan} ${i + 1}`;
    });
  // Seluruh pertemuan ditampilkan, termasuk yang belum berjalan: tabelnya
  // memperlihatkan jadwal utuh, dan pertemuan yang belum berjalan bernilai null.
  //
  // Every meeting is shown, including ones not yet held: the table displays the
  // whole schedule, and a meeting not yet held carries null.
  // Sesi dikelompokkan per kelas. Satu peserta hanya punya kolom untuk sesi
  // kelasnya sendiri: menyatukan sesi seluruh kelas memberi tiap peserta puluhan
  // kolom yang bukan jadwalnya, dan tiap kolom itu terhitung "tidak hadir"
  // sehingga kehadirannya jatuh ke angka yang tidak pernah terjadi.
  //
  // Sessions are grouped per class. A participant has columns only for their own
  // class's sessions: pooling every class's sessions gives each participant dozens
  // of columns that are not their schedule, and each counts as "absent", dropping
  // their attendance to a figure that never happened.
  const sesiPerKelasId = new Map<string, SessionDocument[]>();
  for (const sesi of sessions) {
    for (const cid of sesi.classIds ?? [sesi.classId]) {
      if (!sesiPerKelasId.has(cid)) sesiPerKelasId.set(cid, []);
      sesiPerKelasId.get(cid)!.push(sesi);
    }
  }

  // Label kolomnya diambil dari kelas dengan sesi terbanyak, sehingga tabelnya
  // punya cukup kolom untuk tiap kelas. Kelas yang sesinya lebih sedikit
  // menyisakan kolom kosong di ujungnya, bukan kolom milik kelas lain.
  //
  // The column labels come from the class with the most sessions, so the table has
  // enough columns for every class. A class with fewer sessions leaves blank
  // columns at the end rather than another class's columns.
  const sesiTampil = [...sesiPerKelasId.values()].reduce<SessionDocument[]>(
    (terpanjang, daftar) => (daftar.length > terpanjang.length ? daftar : terpanjang),
    []
  );

  const roster = aktif
    .concat(students.filter((s) => !s.active))
    .map((s) => {
      const cid = s.classId ?? '';
      const kelas = classes.find((c) => c.id === cid);

      // Hanya sesi kelasnya sendiri, dipadkan sampai sepanjang kolom tabelnya.
      // Only their own class's sessions, padded to the table's column count.
      const sesiKelas = sesiPerKelasId.get(cid) ?? [];
      const attendance = sesiTampil.map((_, i) => {
        const sesi = sesiKelas[i];
        // Kolom di luar jadwal kelasnya bernilai null, bukan false: kelas yang
        // sesinya lebih sedikit tidak boleh terbaca sebagai peserta yang membolos.
        //
        // A column beyond their class's schedule is null, not false: a class with
        // fewer sessions must not read as a participant skipping them.
        if (!sesi) return null;
        // Pertemuan yang belum berlangsung juga bernilai null: tidak hadir dan
        // belum berjalan menuntut tindakan yang berbeda.
        //
        // A meeting not yet held is also null: absent and not-yet-held call for
        // different action.
        if (sesi.startsAt > nowIso) return null;
        const status = statusPerSesi.get(sesi.id)?.get(s.uid);
        // Pertemuan yang berakhir sebelum ia bergabung juga null: ia tidak
        // mungkin hadir. / A meeting that ended before they joined is null too:
        // they could not have attended.
        if (!status && !countsAfterJoin(sesi.endsAt, joinPerSiswa.get(s.uid) ?? '', false)) return null;
        return status ?? 'absent';
      });

      const sudah = attendance.filter((a) => a !== null).length;
      const hadir = attendance.filter((a) => a === 'present').length;
      const tugasSiswa = nilaiTugasPerSiswa.get(s.uid);

      const pre = exams.find((e) => e.classId === cid && e.kind === 'pretest');
      const post = exams.find((e) => e.classId === cid && e.kind === 'posttest');

      const tugas = tugasTerhitung(s.uid, cid);
      const taskRate = persen(tugas.kumpul, tugas.dari);
      const nilaiKuis = nilaiKuisPerSiswa.get(s.uid) ?? [];
      const rataKuis = nilaiKuis.length === 0
        ? 0
        : Math.round(nilaiKuis.reduce((a, b) => a + b, 0) / nilaiKuis.length);
      const attendanceRate = persen(hadir, sudah);

      let issueCount = 0;
      if (attendanceRate < ALERT_THRESHOLDS.attendance) issueCount += 1;
      if (taskRate < ALERT_THRESHOLDS.task) issueCount += 1;
      if (rataKuis < ALERT_THRESHOLDS.quiz) issueCount += 1;

      const c = catatan.get(s.uid);

      return {
        studentId: s.uid,
        studentName: s.name,
        className: classNames.get(cid) ?? '',
        programName: kelas?.programName ?? '',
        city: classCities.get(cid) ?? '',
        attendance,
        attendanceRate,
        mentoringUsed: kuota.get(s.uid) ?? 0,
        pretest: pre ? (nilaiTertinggi.get(pre.id)?.get(s.uid) ?? null) : null,
        posttest: post ? (nilaiTertinggi.get(post.id)?.get(s.uid) ?? null) : null,
        capstone: nilaiCapstone.get(s.uid) ?? null,
        // Hanya kuis dan tugas kelasnya sendiri, dipadkan sampai jumlah kolom
        // terbanyak. Kolom di luar deret kelasnya bernilai null: kelas yang
        // tugasnya lebih sedikit tidak boleh terbaca sebagai yang tidak
        // mengumpulkan.
        //
        // Only their own class's quizzes and tasks, padded to the widest column
        // count. A column beyond their class's run is null: a class with fewer
        // tasks must not read as one that failed to submit.
        quizScores: Array.from({ length: kolomKuis }, (_, i) => {
          const e = kuisPerKelasId.get(cid)?.[i];
          return e ? nilaiTertinggi.get(e.id)?.get(s.uid) ?? null : null;
        }),
        taskScores: Array.from({ length: kolomTugas }, (_, i) => {
          const t = tugasPerKelasId.get(cid)?.[i];
          return t ? tugasSiswa?.get(t.id) ?? null : null;
        }),
        taskSubmitted: Array.from({ length: kolomTugas }, (_, i) => statusKumpul(s.uid, tugasPerKelasId.get(cid)?.[i])),
        capstoneSubmitted: Array.from({ length: kolomCapstone }, (_, i) => statusKumpul(s.uid, capstonePerKelasId.get(cid)?.[i])),
        status: (!s.active ? 'nonaktif' : issueCount > 0 ? 'siaga' : 'aktif') as 'aktif' | 'siaga' | 'nonaktif',
        issueCount,
        note: c?.note ?? '',
        followUp: c?.followUp ?? '',
      };
    });

  const phases = hitungFase(sessions, nowIso);
  const phaseCaption = keteranganFase(sessions, nowIso);

  return {
    id: wibDate(),
    version: SNAPSHOT_VERSION,
    generatedAt: nowIso,
    generatedBy: actor.name,
    totalRegistered: students.length,
    totalActive: aktif.length,
    totalDroppedOut: students.length - aktif.length,
    classes: perKelas,
    profiles,
    profilePendingByCity,
    phases,
    phaseCaption,
    learningGain,
    mentoring,
    surveys,
    surveyQuestions,
    feedback,
    logins,
    ranking,
    alerts,
    roster,
    // Judulnya hanya dipakai bila seluruh kelas memakai judul yang sama pada
    // urutan itu. Kelas yang pertemuan ketiganya "Design Thinking" dan kelas
    // yang ketiganya "Data Cleaning" tidak dapat diwakili satu judul, dan
    // keterangan yang salah lebih buruk daripada tanpa keterangan.
    //
    // The title is used only when every class shares it at that position. A class
    // whose third meeting is "Design Thinking" and one whose third is "Data
    // Cleaning" cannot share one title, and a wrong caption is worse than none.
    sessionLabels: sesiTampil.map((_, i) => {
      const judul = [...sesiPerKelasId.values()]
        .map((daftar) => daftar[i]?.title)
        .filter((t): t is string => Boolean(t));
      return new Set(judul).size === 1 ? judul[0] : `Pertemuan ${i + 1}`;
    }),
    quizLabels: labelKolom(kuisPerKelasId, kolomKuis, 'Kuis'),
    // Judul kuis tiap kelas menurut urutan kolomnya, untuk detail kuis per
    // jurusan: label bersama di atas sering hanya "Kuis n" karena judulnya
    // berbeda antarkelas.
    // Each class's quiz titles in column order, for the per-programme quiz
    // detail: the shared label above is often just "Kuis n" since titles differ
    // between classes.
    quizTitlesByClass: Object.fromEntries(
      [...kuisPerKelasId].map(([cid, daftar]) => [classNames.get(cid) ?? cid, daftar.map((e) => e.title)])
    ),
    taskLabels: labelKolom(tugasPerKelasId, kolomTugas, 'Tugas'),
    capstoneLabels: labelKolom(capstonePerKelasId, kolomCapstone, 'Capstone'),
    taskCountByClass: Object.fromEntries([...tugasPerKelasId].map(([cid, d]) => [classNames.get(cid) ?? cid, d.length])),
    capstoneCountByClass: Object.fromEntries([...capstonePerKelasId].map(([cid, d]) => [classNames.get(cid) ?? cid, d.length])),
    thresholds: ALERT_THRESHOLDS,
  };
}

/**
 * Mengambil ringkasan, menghitungnya ulang bila sudah usang.
 *
 * Yang usang dihitung ulang sendiri, bukan menampilkan angka lama diam-diam:
 * admin yang baru menilai tugas lalu membuka dashboard dan melihat angka yang
 * sama akan mengira penilaiannya gagal.
 *
 * Reads the snapshot, recomputing it when stale.
 *
 * A stale one recomputes itself rather than quietly showing old figures: an
 * admin who just graded a task, opened the dashboard, and saw the same number
 * would assume the grading failed.
 */
export async function getSnapshot(
  actor: Actor,
  options: { force?: boolean } = {}
): Promise<DashboardSnapshot> {
  if (actor.role !== 'admin') {
    throw new Error('Hanya admin yang diizinkan melihat dashboard');
  }

  const db = getAdminDb();
  const id = wibDate();

  if (!options.force) {
    const snap = await db.collection('dashboardSnapshots').doc(id).get();
    if (snap.exists) {
      const data = snap.data() as DashboardSnapshot;
      const umur = Date.now() - new Date(data.generatedAt).getTime();
      // Versinya diperiksa sebelum umurnya: ringkasan berbentuk lama memuat
      // angka yang dihitung dengan aturan yang sudah diperbaiki, dan umurnya
      // yang masih muda justru membuatnya bertahan paling lama.
      //
      // The version is checked before the age: an older-shaped snapshot carries
      // figures computed under rules since fixed, and being freshly written is
      // exactly what would keep it around longest.
      if ((data.version ?? 1) === SNAPSHOT_VERSION && umur < SNAPSHOT_MAX_AGE_MS) return data;
    }
  }

  const baru = await computeSnapshot(actor);
  await db.collection('dashboardSnapshots').doc(id).set(baru);
  return baru;
}
