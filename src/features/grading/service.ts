// Layanan nilai capstone, showcase, dan nilai akhir / Capstone, showcase, and final score service
import { getAdminDb } from '../../lib/firebase/admin';
import type { Actor } from '../auth/types';
import type { UserDocument } from '../auth/types';
import { getEmailHash } from '../auth/policy';
import { calculateFinalGrade, averageWithZeros } from './policy';
import { countsAfterJoin, joinMoment } from '../users/join-policy';
import type { AssessmentKind, AssessmentScoreDocument, FinalGrade } from './types';
import type { ParsedScoreRow } from './import-policy';

function requireAdmin(actor: Actor): void {
  if (actor.role !== 'admin') {
    throw new Error('Hanya admin yang diizinkan mengimpor nilai');
  }
}

/**
 * Menyimpan nilai capstone dan showcase dari berkas yang sudah dibaca.
 *
 * Surel dicocokkan lewat emailIndex, bukan dengan memindai seluruh pengguna:
 * indeks itu sudah ada dan dikunci pada hash surelnya, sehingga seratus baris
 * menjadi seratus pembacaan berkunci alih-alih seratus pemindaian penuh.
 *
 * Stores capstone and showcase scores from a sheet already parsed.
 *
 * Emails are matched through emailIndex rather than by scanning every user:
 * that index already exists and is keyed on the email's hash, so a hundred rows
 * become a hundred keyed reads instead of a hundred full scans.
 */
export async function importAssessmentScores(
  actor: Actor,
  rows: ParsedScoreRow[]
): Promise<{ imported: number; skipped: { email: string; reason: string }[] }> {
  requireAdmin(actor);

  if (rows.length === 0) {
    throw new Error('Tidak ada baris nilai yang dapat diimpor');
  }

  const db = getAdminDb();
  const now = new Date().toISOString();

  // Seluruh pencarian diselesaikan lebih dulu, lalu penulisannya dalam satu
  // batch: seratus pemanggilan berurutan dapat berhenti di tengah dan
  // menyisakan separuh kelas bernilai tanpa admin tahu bagian mana yang gagal.
  //
  // Every lookup completes first, then the writes go in one batch: a hundred
  // sequential calls can stop halfway and leave half a class scored with no way
  // for the admin to tell which part failed.
  const ditemukan = await Promise.all(
    rows.map(async (row) => {
      const snap = await db.collection('emailIndex').doc(getEmailHash(row.email)).get();
      return { row, uid: snap.exists ? (snap.data()?.uid as string) : null };
    })
  );

  const skipped: { email: string; reason: string }[] = [];
  const perlu: { row: ParsedScoreRow; user: UserDocument }[] = [];

  const users = await Promise.all(
    ditemukan.map(async (d) => {
      if (!d.uid) return { ...d, user: null };
      const snap = await db.collection('users').doc(d.uid).get();
      return { ...d, user: snap.exists ? (snap.data() as UserDocument) : null };
    })
  );

  for (const { row, user } of users) {
    if (!user) {
      skipped.push({ email: row.email, reason: 'Surel tidak terdaftar' });
      continue;
    }
    if (user.role !== 'student') {
      // Nilai capstone bagi mentor atau admin tidak pernah terbaca di mana
      // pun, dan menyimpannya hanya menyisakan dokumen yang membingungkan saat
      // rekapnya dihitung.
      //
      // A capstone score for a mentor or admin is never read anywhere, and
      // storing it only leaves a document that confuses the report later.
      skipped.push({ email: row.email, reason: 'Bukan akun peserta' });
      continue;
    }
    perlu.push({ row, user });
  }

  const classNames = new Map<string, string>();
  for (const d of (await db.collection('classes').get()).docs) {
    classNames.set(d.id, (d.data().canonicalName as string) ?? d.id);
  }

  const batch = db.batch();
  let imported = 0;

  for (const { row, user } of perlu) {
    for (const kind of ['capstone', 'showcase'] as AssessmentKind[]) {
      const score = kind === 'capstone' ? row.capstone : row.showcase;
      // Kolom yang kosong dilewatkan, bukan ditulis nol: showcase dinilai dua
      // pekan setelah capstone, dan menulis nol pada impor pertama memberi
      // peserta nilai showcase nol selama dua pekan.
      //
      // An empty column is skipped rather than written as zero: showcase is
      // assessed two weeks after the capstone, and writing zero on the first
      // import would give participants a showcase score of zero for two weeks.
      if (score === null) continue;

      const id = `${kind}_${user.uid}`;
      const doc: AssessmentScoreDocument = {
        id,
        kind,
        studentId: user.uid,
        studentName: user.name,
        classId: user.classId ?? '',
        className: user.classId ? (classNames.get(user.classId) ?? '') : '',
        score,
        note: row.note,
        importedBy: actor.name,
        importedAt: now,
      };

      // set, bukan create: impor ulang menimpa nilai sebelumnya, sehingga satu
      // salah ketik diperbaiki dengan mengunggah berkasnya lagi.
      //
      // set, not create: a re-import overwrites the previous score, so one typo
      // is fixed by uploading the file again.
      batch.set(db.collection('assessmentScores').doc(id), doc);
      imported += 1;
    }
  }

  await batch.commit();
  return { imported, skipped };
}

/**
 * Menghitung nilai akhir seluruh peserta sebuah kelas.
 *
 * Seluruh koleksinya dibaca sekali lalu dikelompokkan di memori, bukan satu
 * kueri per peserta: dua puluh satu peserta dikali lima komponen menjadi
 * seratus lima kueri untuk satu halaman.
 *
 * Computes every participant's final score for one class.
 *
 * Each collection is read once and grouped in memory rather than one query per
 * participant: twenty-one participants times five components would be a hundred
 * and five queries for one page.
 */
export async function getFinalGrades(actor: Actor, classId: string): Promise<FinalGrade[]> {
  requireAdmin(actor);

  const db = getAdminDb();
  const [studentsSnap, classSnap, sessionsSnap, sharedSessionsSnap, tasksSnap, submissionsSnap, examsSnap, attemptsSnap, scoresSnap, attendanceSnap] =
    await Promise.all([
      db.collection('users').where('classId', '==', classId).where('role', '==', 'student').where('active', '==', true).get(),
      db.collection('classes').doc(classId).get(),
      db.collection('sessions').where('classId', '==', classId).select('endsAt').get(),
      // Pertemuan gabungan menyimpan kelas tambahannya di classIds / A joint meeting stores its extra classes in classIds
      db.collection('sessions').where('classIds', 'array-contains', classId).select('endsAt').get(),
      db.collection('tasks').where('classId', '==', classId).where('published', '==', true).get(),
      db.collection('submissions').where('classId', '==', classId).get(),
      db.collection('exams').where('classId', '==', classId).where('published', '==', true).get(),
      db.collection('examAttempts').where('classId', '==', classId).get(),
      db.collection('assessmentScores').where('classId', '==', classId).get(),
      db.collection('attendance').where('classId', '==', classId).select('studentId', 'sessionId', 'status').get(),
    ]);

  const className = (classSnap.data()?.canonicalName as string) ?? '';
  const sessionEnd = new Map<string, string>();
  for (const d of [...sessionsSnap.docs, ...sharedSessionsSnap.docs]) sessionEnd.set(d.id, d.data().endsAt as string);

  const tasks = tasksSnap.docs.map((d) => d.data() as { id: string; dueAt?: string | null });
  // Pretest dikecualikan: ia mengukur titik awal sebelum diajar, dan
  // memasukkannya ke nilai akhir menghukum peserta karena belum tahu materi
  // yang memang belum diajarkan.
  //
  // Pretests are excluded: they measure the starting point before teaching, and
  // folding them into the final score punishes participants for not knowing
  // material not yet taught.
  const exams = examsSnap.docs
    .map((d) => d.data() as { id: string; kind: string; sessionId?: string | null })
    .filter((e) => e.kind !== 'pretest');

  // Hanya status hadir yang dihitung hadir; izin dan sakit tersimpan di koleksi
  // yang sama. Catatan apa pun tetap menandai pertemuan itu berlaku baginya.
  // Only a present status counts as present; excused and sick live in the same
  // collection. Any record still marks that meeting as applying to them.
  const hadirPerSiswa = new Map<string, Set<string>>();
  const tercatatPerSiswa = new Map<string, Set<string>>();
  for (const d of attendanceSnap.docs) {
    const a = d.data() as { studentId: string; sessionId: string; status?: string };
    if (!tercatatPerSiswa.has(a.studentId)) tercatatPerSiswa.set(a.studentId, new Set());
    tercatatPerSiswa.get(a.studentId)!.add(a.sessionId);
    if ((a.status ?? 'present') !== 'present') continue;
    if (!hadirPerSiswa.has(a.studentId)) hadirPerSiswa.set(a.studentId, new Set());
    hadirPerSiswa.get(a.studentId)!.add(a.sessionId);
  }

  const nilaiTugas = new Map<string, Map<string, number>>();
  for (const d of submissionsSnap.docs) {
    const s = d.data() as { studentId: string; taskId: string; score: number | null };
    if (s.score === null || s.score === undefined) continue;
    if (!nilaiTugas.has(s.studentId)) nilaiTugas.set(s.studentId, new Map());
    nilaiTugas.get(s.studentId)!.set(s.taskId, s.score);
  }

  // Nilai tertinggi tiap ujian yang dipakai, sejalan dengan aturan remedial:
  // percobaan ulang yang lulus sudah dipatok di KKM saat disimpan.
  //
  // The highest score per exam is used, in line with the remedial rule: a
  // passing retake was already pinned at the mark when it was stored.
  const nilaiKuis = new Map<string, Map<string, number>>();
  for (const d of attemptsSnap.docs) {
    const a = d.data() as { studentId: string; examId: string; status: string; score: number | null };
    if (a.status !== 'selesai' || a.score === null) continue;
    if (!nilaiKuis.has(a.studentId)) nilaiKuis.set(a.studentId, new Map());
    const peta = nilaiKuis.get(a.studentId)!;
    peta.set(a.examId, Math.max(peta.get(a.examId) ?? 0, a.score));
  }

  const penilaian = new Map<string, Map<AssessmentKind, number>>();
  for (const d of scoresSnap.docs) {
    const s = d.data() as AssessmentScoreDocument;
    if (!penilaian.has(s.studentId)) penilaian.set(s.studentId, new Map());
    penilaian.get(s.studentId)!.set(s.kind, s.score);
  }

  return studentsSnap.docs
    .map((doc) => {
      const u = doc.data() as UserDocument;
      // Yang berakhir sebelum peserta bergabung tidak dihitung kecuali ia
      // mengerjakannya. / What ended before the participant joined does not
      // count unless they did it.
      const join = joinMoment(u);
      const tercatat = tercatatPerSiswa.get(u.uid);
      const sesiSiswa = [...sessionEnd].filter(([id, end]) => countsAfterJoin(end, join, tercatat?.has(id) ?? false));
      const totalSessions = sesiSiswa.length;

      const hadir = sesiSiswa.filter(([id]) => hadirPerSiswa.get(u.uid)?.has(id)).length;
      const attendance = totalSessions > 0 ? Math.round((hadir / totalSessions) * 100) : null;

      const tugasSiswa = nilaiTugas.get(u.uid);
      const tasksSiswa = tasks.filter((t) => countsAfterJoin(t.dueAt, join, tugasSiswa?.has(t.id) ?? false));
      const tasksScore = tasksSiswa.length > 0
        ? averageWithZeros(tasksSiswa.map((t) => tugasSiswa?.get(t.id) ?? null), tasksSiswa.length)
        : null;

      const kuisSiswa = nilaiKuis.get(u.uid);
      const examsSiswa = exams.filter((e) => !e.sessionId || countsAfterJoin(sessionEnd.get(e.sessionId), join, kuisSiswa?.has(e.id) ?? false));
      const quiz = examsSiswa.length > 0
        ? averageWithZeros(examsSiswa.map((e) => kuisSiswa?.get(e.id) ?? null), examsSiswa.length)
        : null;

      const nilai = penilaian.get(u.uid);
      const { score, breakdown, pending } = calculateFinalGrade({
        capstone: nilai?.get('capstone') ?? null,
        showcase: nilai?.get('showcase') ?? null,
        tasks: tasksScore,
        attendance,
        quiz,
        details: {
          attendance: totalSessions > 0 ? `${hadir} dari ${totalSessions} pertemuan` : 'Belum ada pertemuan',
          tasks: tasksSiswa.length > 0 ? `${tasksSiswa.filter((t) => tugasSiswa?.has(t.id)).length} dari ${tasksSiswa.length} tugas dinilai` : 'Belum ada tugas',
          quiz: examsSiswa.length > 0 ? `${examsSiswa.filter((e) => kuisSiswa?.has(e.id)).length} dari ${examsSiswa.length} ujian dikerjakan` : 'Belum ada ujian',
        },
      });

      return { studentId: u.uid, studentName: u.name, classId, className, score, breakdown, pending };
    })
    .sort((a, b) => b.score - a.score);
}
