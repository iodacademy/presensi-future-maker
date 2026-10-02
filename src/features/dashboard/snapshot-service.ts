// Penghitungan dan pembacaan ringkasan dashboard / Computing and reading the dashboard snapshot
import { getAdminDb } from '../../lib/firebase/admin';
import type { Actor, UserDocument } from '../auth/types';
import type { ClassDocument } from '../classes/types';
import type { SessionDocument } from '../attendance/types';
import { summariseAnswers } from '../survey/policy';
import { NUMERIC_KINDS } from '../survey/types';
import type { SurveyAnswer, SurveyFormDocument, SurveyResponseDocument } from '../survey/types';
import { ageFrom } from '../users/profile-service';
import { hitungFase } from './phases';
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
  SeriesPoint,
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
    db.collection('attendance').get(),
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

  const students = usersSnap.docs.map((d) => d.data() as UserDocument);
  const aktif = students.filter((s) => s.active);
  const aktifIds = new Set(aktif.map((s) => s.uid));

  // --- status peserta per daerah --------------------------------------
  const perKelas = classes.map((c) => {
    const terdaftar = students.filter((s) => s.classId === c.id);
    const hidup = terdaftar.filter((s) => s.active).length;
    return {
      classId: c.id,
      className: c.canonicalName,
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
  for (const d of attendanceSnap.docs) {
    const a = d.data() as { sessionId: string; studentId: string };
    // Peserta nonaktif tidak dihitung: persentasenya dibagi jumlah peserta
    // aktif, dan menyertakan yang sudah keluar membuat angkanya melampaui
    // seratus.
    //
    // Inactive participants are excluded: the percentage divides by the active
    // count, and including those who left would push it past a hundred.
    if (!aktifIds.has(a.studentId)) continue;
    if (!hadirPerSesi.has(a.sessionId)) hadirPerSesi.set(a.sessionId, new Set());
    hadirPerSesi.get(a.sessionId)!.add(a.studentId);
  }

  const nowIso = new Date().toISOString();
  const attendancePerSession: SeriesPoint[] = sessions.map((s) => ({
    label: s.title,
    // Pertemuan yang belum berlangsung bernilai null, bukan nol: nol berarti
    // tidak ada yang hadir, dan grafiknya akan menunjukkan kemerosotan yang
    // tidak pernah terjadi.
    //
    // A meeting not yet held is null, not zero: zero means nobody attended, and
    // the chart would show a collapse that never happened.
    value: s.startsAt > nowIso ? null : persen(hadirPerSesi.get(s.id)?.size ?? 0, aktif.length),
    detail: s.date,
  }));

  // --- tugas: pengumpulan dan nilainya --------------------------------
  const tasks = tasksSnap.docs
    .map((d) => d.data() as { id: string; title: string; order: number; kind: string })
    .filter((t) => t.kind !== 'capstone')
    .sort((a, b) => a.order - b.order);

  const kumpulPerTugas = new Map<string, number>();
  const nilaiPerTugas = new Map<string, number[]>();
  for (const d of submissionsSnap.docs) {
    const s = d.data() as { taskId: string; studentId: string; score: number | null };
    if (!aktifIds.has(s.studentId)) continue;
    kumpulPerTugas.set(s.taskId, (kumpulPerTugas.get(s.taskId) ?? 0) + 1);
    if (s.score !== null && s.score !== undefined) {
      if (!nilaiPerTugas.has(s.taskId)) nilaiPerTugas.set(s.taskId, []);
      nilaiPerTugas.get(s.taskId)!.push(s.score);
    }
  }

  const submissionPerTask: SeriesPoint[] = tasks.map((t) => ({
    label: t.title,
    value: persen(kumpulPerTugas.get(t.id) ?? 0, aktif.length),
  }));

  const scorePerTask: SeriesPoint[] = tasks.map((t) => {
    const nilai = nilaiPerTugas.get(t.id) ?? [];
    return {
      label: t.title,
      // Tugas yang belum ada nilainya bernilai null: nol akan terbaca sebagai
      // seluruh peserta mendapat nol.
      //
      // A task with no scores yet is null: zero would read as everyone scoring
      // zero.
      value: nilai.length === 0 ? null : Math.round(nilai.reduce((a, b) => a + b, 0) / nilai.length),
      detail: `${nilai.length} dinilai`,
    };
  });

  // --- kuis per sesi dan learning gain --------------------------------
  const exams = examsSnap.docs.map((d) => d.data() as { id: string; title: string; kind: string; classId: string; sessionId: string | null });
  const examById = new Map(exams.map((e) => [e.id, e]));

  const nilaiTertinggi = new Map<string, Map<string, number>>();
  for (const d of attemptsSnap.docs) {
    const a = d.data() as { examId: string; studentId: string; status: string; score: number | null };
    if (a.status !== 'selesai' || a.score === null) continue;
    if (!aktifIds.has(a.studentId)) continue;
    if (!nilaiTertinggi.has(a.examId)) nilaiTertinggi.set(a.examId, new Map());
    const peta = nilaiTertinggi.get(a.examId)!;
    peta.set(a.studentId, Math.max(peta.get(a.studentId) ?? 0, a.score));
  }

  const rataUjian = (examId: string): number | null => {
    const nilai = [...(nilaiTertinggi.get(examId)?.values() ?? [])];
    if (nilai.length === 0) return null;
    return Math.round(nilai.reduce((a, b) => a + b, 0) / nilai.length);
  };

  const quizPerSession: SeriesPoint[] = exams
    .filter((e) => e.kind === 'kuis')
    .map((e) => ({ label: e.title, value: rataUjian(e.id) }));

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
  const sesiPerKelas = new Map<string, number>();
  for (const s of sessions) {
    if (s.startsAt > nowIso) continue;
    for (const cid of s.classIds ?? [s.classId]) {
      sesiPerKelas.set(cid, (sesiPerKelas.get(cid) ?? 0) + 1);
    }
  }

  const hadirPerSiswa = new Map<string, number>();
  for (const [, pesertanya] of hadirPerSesi) {
    for (const uid of pesertanya) hadirPerSiswa.set(uid, (hadirPerSiswa.get(uid) ?? 0) + 1);
  }

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

  const kumpulPerSiswa = new Map<string, number>();
  const nilaiKuisPerSiswa = new Map<string, number[]>();
  for (const d of submissionsSnap.docs) {
    const s = d.data() as { studentId: string };
    if (!aktifIds.has(s.studentId)) continue;
    kumpulPerSiswa.set(s.studentId, (kumpulPerSiswa.get(s.studentId) ?? 0) + 1);
  }
  for (const [examId, peta] of nilaiTertinggi) {
    if (examById.get(examId)?.kind === 'pretest') continue;
    for (const [uid, nilai] of peta) {
      if (!nilaiKuisPerSiswa.has(uid)) nilaiKuisPerSiswa.set(uid, []);
      nilaiKuisPerSiswa.get(uid)!.push(nilai);
    }
  }

  const tugasPerKelas = new Map<string, number>();
  for (const t of tasksSnap.docs) {
    const d = t.data() as { classId: string; kind: string };
    if (d.kind === 'capstone') continue;
    tugasPerKelas.set(d.classId, (tugasPerKelas.get(d.classId) ?? 0) + 1);
  }

  const terukur = aktif.map((s) => {
    const cid = s.classId ?? '';
    const attendanceRate = persen(hadirPerSiswa.get(s.uid) ?? 0, sesiPerKelas.get(cid) ?? 0);
    const taskRate = persen(kumpulPerSiswa.get(s.uid) ?? 0, tugasPerKelas.get(cid) ?? 0);
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

  const ranking = terukur
    .map((t) => ({
      studentId: t.studentId,
      studentName: t.studentName,
      className: t.className,
      city: t.city,
      // Rata-rata tiga angka, sejalan dengan yang ditampilkan daftar siaga.
      // Nilai akhir berbobot ada pada halaman Nilai Akhir; dua angka yang
      // berbeda pada satu layar akan terbaca sebagai kesalahan hitung.
      //
      // The average of three figures, matching what the alert list shows. The
      // weighted final score lives on the Final Score page; two different
      // numbers on one screen would read as a miscalculation.
      score: Math.round((t.attendanceRate + t.taskRate + t.quizAverage) / 3),
    }))
    .sort((a, b) => b.score - a.score);

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
  const kuisUrut = exams.filter((e) => e.kind === 'kuis');
  // Seluruh pertemuan ditampilkan, termasuk yang belum berjalan: tabelnya
  // memperlihatkan jadwal utuh, dan pertemuan yang belum berjalan bernilai null.
  //
  // Every meeting is shown, including ones not yet held: the table displays the
  // whole schedule, and a meeting not yet held carries null.
  const sesiTampil = sessions;

  const roster = aktif
    .concat(students.filter((s) => !s.active))
    .map((s) => {
      const cid = s.classId ?? '';
      const kelas = classes.find((c) => c.id === cid);

      const attendance = sesiTampil.map((sesi) => {
        // Pertemuan yang belum berlangsung bernilai null, bukan false: tidak
        // hadir dan belum berjalan menuntut tindakan yang berbeda.
        //
        // A meeting not yet held is null, not false: absent and not-yet-held
        // call for different action.
        if (sesi.startsAt > nowIso) return null;
        return hadirPerSesi.get(sesi.id)?.has(s.uid) ?? false;
      });

      const sudah = attendance.filter((a) => a !== null).length;
      const hadir = attendance.filter((a) => a === true).length;
      const tugasSiswa = nilaiTugasPerSiswa.get(s.uid);

      const pre = exams.find((e) => e.classId === cid && e.kind === 'pretest');
      const post = exams.find((e) => e.classId === cid && e.kind === 'posttest');

      const taskRate = persen(kumpulPerSiswa.get(s.uid) ?? 0, tugasPerKelas.get(cid) ?? 0);
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
        quizScores: kuisUrut.map((e) => nilaiTertinggi.get(e.id)?.get(s.uid) ?? null),
        taskScores: tasks.map((t) => tugasSiswa?.get(t.id) ?? null),
        taskSubmitted: tasks.map((t) => {
          if (terkumpulPerSiswa.get(s.uid)?.has(t.id)) return true;
          // Tenggat yang belum lewat bernilai null, bukan false: peserta masih
          // punya waktu, dan menandainya sebagai tidak mengumpulkan membuat
          // admin menghubungi orang yang tidak terlambat.
          //
          // A deadline not yet passed is null, not false: the participant still
          // has time, and marking it as missed would have an admin contact
          // someone who is not late.
          const tenggat = tenggatTugas.get(t.id);
          if (!tenggat || tenggat > nowIso) return null;
          return false;
        }),
        status: (!s.active ? 'nonaktif' : issueCount > 0 ? 'siaga' : 'aktif') as 'aktif' | 'siaga' | 'nonaktif',
        issueCount,
        note: c?.note ?? '',
        followUp: c?.followUp ?? '',
      };
    });

  const phases = hitungFase(sessions, nowIso);

  return {
    id: wibDate(),
    generatedAt: nowIso,
    generatedBy: actor.name,
    totalRegistered: students.length,
    totalActive: aktif.length,
    totalDroppedOut: students.length - aktif.length,
    classes: perKelas,
    profiles,
    profilePendingByCity,
    phases,
    attendancePerSession,
    submissionPerTask,
    scorePerTask,
    quizPerSession,
    learningGain,
    mentoring,
    surveys,
    surveyQuestions,
    logins,
    ranking,
    alerts,
    roster,
    sessionLabels: sesiTampil.map((x) => x.title),
    quizLabels: kuisUrut.map((e) => e.title),
    taskLabels: tasks.map((t) => t.title),
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
      if (umur < SNAPSHOT_MAX_AGE_MS) return data;
    }
  }

  const baru = await computeSnapshot(actor);
  await db.collection('dashboardSnapshots').doc(id).set(baru);
  return baru;
}
