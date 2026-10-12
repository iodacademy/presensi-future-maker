// Detail progres belajar satu peserta untuk admin / One participant's learning progress for admins
import { getAdminDb } from '../../lib/firebase/admin';
import type { Actor, UserDocument } from '../auth/types';
import type { ClassDocument } from '../classes/types';
import type { SessionDocument, AttendanceDocument } from '../attendance/types';
import type { TaskDocument } from '../tasks/types';
import type { SubmissionDocument } from '../tasks/submission-types';
import type { ExamDocument, AttemptDocument } from '../exams/types';
import type { MentoringBookingDocument } from '../mentoring/types';
import type { SurveyResponseDocument } from '../survey/types';
import { DISABILITY_LABELS, ENTRY_STATUS_LABELS, GENDER_LABELS, type StudentProfileDocument } from '../users/profile-types';
import { ageFrom } from '../users/profile-service';
import { buildStudentPerformance } from './performance';
import { isMenteeOf } from '../mentoring/service';
import type { StudentDetail } from './types';

/**
 * Membaca seluruh progres satu peserta: presensi, tugas, kuis, pre/post test,
 * mentoring, profil, feedback, dan catatan admin.
 *
 * Setiap kueri disaring ke peserta atau kelasnya dan hanya mengambil kolom
 * yang ditampilkan, sehingga biayanya tetap belasan dokumen per pertemuan,
 * bukan seluruh koleksi seperti ringkasan dashboard. Dibaca saat dibuka, bukan
 * disimpan di ringkasan: tiap peserta jarang dibuka, dan ringkasan yang memuat
 * jawaban feedback seluruh angkatan akan mendekati batas ukuran dokumen.
 *
 * Reads everything about one participant: attendance, tasks, quizzes, pre/post
 * tests, mentoring, profile, feedback, and admin notes.
 *
 * Every query is filtered to the participant or their class and fetches only
 * the displayed fields, so the cost stays at tens of documents per meeting
 * rather than whole collections like the dashboard snapshot. Read on open
 * rather than stored in the snapshot: any one participant is rarely opened,
 * and a snapshot carrying the whole cohort's feedback answers would approach
 * the document size limit.
 */
export async function getStudentDetail(actor: Actor, uid: string): Promise<StudentDetail> {
  if (actor.role !== 'admin' && actor.role !== 'mentor') {
    throw new Error('Hanya admin atau mentor yang diizinkan melihat detail peserta');
  }
  // Mentor hanya melihat peserta bimbingannya; uid di URL mudah diganti.
  // A mentor only sees their own mentees; the uid in the URL is easy to swap.
  if (actor.role === 'mentor' && !(await isMenteeOf(actor.uid, uid))) {
    throw new Error('Peserta ini bukan peserta bimbingan Anda');
  }
  const isAdmin = actor.role === 'admin';

  const db = getAdminDb();
  const userSnap = await db.collection('users').doc(uid).get();
  const user = userSnap.data() as UserDocument | undefined;
  if (!user || user.role !== 'student') {
    throw new Error('Peserta tidak ditemukan');
  }
  const classId = user.classId ?? '';

  // Kueri berbasis kelas dilewati bila peserta tidak berkelas: Firestore
  // menolak where dengan nilai kosong, dan memang tidak ada yang perlu dibaca.
  // Class-based queries are skipped when the participant has no class:
  // Firestore rejects a where on an empty value, and there is nothing to read.
  const empty = Promise.resolve({ docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] });
  const [classSnap, ownSessions, sharedSessions, tasksSnap, examsSnap, attendSnap, subsSnap, attemptsSnap, bookingsSnap, responsesSnap, profileSnap, noteSnap] = await Promise.all([
    classId ? db.collection('classes').doc(classId).get() : Promise.resolve(null),
    classId ? db.collection('sessions').where('classId', '==', classId).select('id', 'title', 'startsAt', 'endsAt').get() : empty,
    // Pertemuan gabungan menyimpan kelas tambahannya di classIds / A joint meeting stores its extra classes in classIds
    classId ? db.collection('sessions').where('classIds', 'array-contains', classId).select('id', 'title', 'startsAt', 'endsAt').get() : empty,
    classId ? db.collection('tasks').where('classId', '==', classId).where('published', '==', true).select('id', 'title', 'kind', 'dueAt', 'order').get() : empty,
    classId ? db.collection('exams').where('classId', '==', classId).where('published', '==', true).select('id', 'title', 'kind', 'sessionId', 'passingScore', 'questionCount').get() : empty,
    db.collection('attendance').where('studentId', '==', uid).select('sessionId', 'status').get(),
    db.collection('submissions').where('studentId', '==', uid).select('taskId', 'score', 'late').get(),
    db.collection('examAttempts').where('studentId', '==', uid).select('examId', 'status', 'score', 'passed').get(),
    db.collection('bookings').where('studentId', '==', uid).select('mentorName', 'date', 'startTime', 'endTime', 'status', 'phase').get(),
    // Feedback dan catatan admin tidak dibaca untuk mentor: feedback ditujukan
    // kepada penyelenggara, dan peserta menulisnya tanpa mengira mentornya ikut
    // membaca.
    // Feedback and admin notes are not read for mentors: feedback is addressed
    // to the organisers, and participants write it without expecting their
    // mentor to read along.
    isAdmin ? db.collection('surveyResponses').where('studentId', '==', uid).select('formTitle', 'sessionTitle', 'sessionDate', 'submittedAt', 'answers').get() : empty,
    db.collection('studentProfiles').doc(uid).get(),
    isAdmin ? db.collection('studentNotes').doc(uid).get() : Promise.resolve(null),
  ]);

  const kelas = classSnap?.exists ? (classSnap.data() as ClassDocument) : null;

  const sessions = new Map<string, Pick<SessionDocument, 'id' | 'title' | 'startsAt' | 'endsAt'>>();
  for (const d of [...ownSessions.docs, ...sharedSessions.docs]) {
    sessions.set(d.id, { ...(d.data() as SessionDocument), id: d.id });
  }

  const performance = buildStudentPerformance({
    sessions: [...sessions.values()],
    attendance: attendSnap.docs.map((d) => d.data() as AttendanceDocument),
    exams: examsSnap.docs.map((d) => ({ ...(d.data() as ExamDocument), id: d.id })),
    attempts: attemptsSnap.docs.map((d) => d.data() as AttemptDocument),
    tasks: tasksSnap.docs.map((d) => ({ ...(d.data() as TaskDocument), id: d.id })),
    submissions: subsSnap.docs.map((d) => d.data() as SubmissionDocument),
    nowIso: new Date().toISOString(),
  });

  const bookings = bookingsSnap.docs
    .map((d) => ({ ...(d.data() as MentoringBookingDocument), id: d.id }))
    .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));

  const profile = profileSnap.exists ? (profileSnap.data() as StudentProfileDocument) : null;
  const note = noteSnap?.exists ? (noteSnap.data() as { note?: string; followUp?: string }) : null;

  return {
    student: {
      uid,
      name: user.name,
      email: user.email,
      className: kelas?.canonicalName ?? '',
      city: kelas?.city ?? '',
      programName: kelas?.programName ?? '',
      active: user.active,
    },
    profile: profile
      ? {
          age: ageFrom(profile.birthDate),
          gender: GENDER_LABELS[profile.gender] ?? profile.gender,
          disability: profile.disability === 'lainnya' && profile.disabilityNote
            ? `Lainnya: ${profile.disabilityNote}`
            : DISABILITY_LABELS[profile.disability] ?? profile.disability,
          entryStatus: ENTRY_STATUS_LABELS[profile.entryStatus] ?? profile.entryStatus,
          phone: profile.phone,
        }
      : null,
    performance,
    mentoring: {
      used: bookings.filter((b) => b.status === 'confirmed' && b.phase === 'bootcamp').length,
      bookings: bookings.map((b) => ({ id: b.id, mentorName: b.mentorName, date: b.date, startTime: b.startTime, endTime: b.endTime, status: b.status })),
    },
    feedback: !isAdmin ? null : responsesSnap.docs
      .map((d) => {
        const r = d.data() as SurveyResponseDocument;
        return {
          id: d.id,
          formTitle: r.formTitle,
          sessionTitle: r.sessionTitle,
          sessionDate: r.sessionDate,
          submittedAt: r.submittedAt,
          answers: (r.answers ?? []).map((a) => ({ questionText: a.questionText, kind: a.kind, value: a.value })),
        };
      })
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)),
    note: note && (note.note || note.followUp) ? { note: note.note ?? '', followUp: note.followUp ?? '' } : null,
  };
}
