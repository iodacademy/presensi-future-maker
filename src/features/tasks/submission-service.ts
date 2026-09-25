// Layanan pengumpulan tugas siswa dan penilaian admin di Firestore
// Student task submission and admin grading service in Firestore
import { getAdminDb } from '../../lib/firebase/admin';
import type { Actor } from '../auth/types';
import type {
  SubmissionDocument,
  SubmissionFeedbackDocument,
  SubmitTaskInput,
  GradeSubmissionInput,
  StudentTaskItem,
} from './submission-types';
import type { TaskDocument, TaskSummary } from './types';
import type { ClassDocument } from '../classes/types';
import {
  validateSubmissionInput,
  isSubmissionLate,
  canReplaceSubmission,
  validateGradeInput,
} from './submission-policy';
import { isCapstoneUnlocked } from './policy';
import { listTasksForClass } from './service';

/**
 * Siswa mengumpulkan tugas baru atau mengganti tugas yang belum dinilai.
 *
 * Student submits a new task or replaces an existing ungraded submission.
 */
export async function submitTask(actor: Actor, input: SubmitTaskInput): Promise<SubmissionDocument> {
  if (actor.role !== 'student') {
    throw new Error('Hanya siswa yang diizinkan mengumpulkan tugas');
  }

  if (!actor.classId) {
    throw new Error('Anda belum terdaftar di kelas manapun');
  }

  const { fileId, fileName, url } = validateSubmissionInput(input);
  const db = getAdminDb();

  // 1. Ambil detail tugas / Fetch task details
  const taskRef = db.collection('tasks').doc(input.taskId);
  const taskDoc = await taskRef.get();
  if (!taskDoc.exists) {
    throw new Error('Tugas tidak ditemukan');
  }

  const taskData = taskDoc.data() as TaskDocument;
  if (taskData.classId !== actor.classId) {
    throw new Error('Tugas ini bukan bagian dari kelas Anda');
  }

  // 2. Ambil dokumen kelas untuk memeriksa snapshot Capstone
  // Fetch class document to check Capstone requirements snapshot
  const classRef = db.collection('classes').doc(actor.classId);
  const classDoc = await classRef.get();
  if (!classDoc.exists) {
    throw new Error('Kelas tidak ditemukan');
  }
  const classData = classDoc.data() as ClassDocument;

  // Jika tugas ini adalah Capstone, periksa apakah sudah terbuka
  // If task is Capstone, verify if it is unlocked
  if (taskData.kind === 'capstone') {
    // Ambil seluruh tugas harian yang sudah dikumpulkan oleh siswa ini
    const existingSubsSnap = await db.collection('submissions')
      .where('studentId', '==', actor.uid)
      .where('taskKind', '==', 'daily')
      .get();

    const submittedDailyIds = existingSubsSnap.docs.map((d) => (d.data() as SubmissionDocument).taskId);
    const unlocked = isCapstoneUnlocked(classData.requiredDailyTaskIds || [], submittedDailyIds);

    if (!unlocked) {
      throw new Error('Akses Capstone Project masih terkunci: Kumpulkan seluruh Tugas Harian terlebih dahulu.');
    }
  }

  const submissionId = `${input.taskId}_${actor.uid}`;
  const submissionRef = db.collection('submissions').doc(submissionId);
  const progressRef = db.collection('studentProgress').doc(actor.uid);

  // Transaksi, bukan batch: dua permintaan submit yang berbarengan (klik ganda,
  // retry jaringan) sama-sama membaca counter lama lalu menuliskan nilai yang
  // sama, sehingga dailySubmittedCount menghitung satu tugas sebagai dua.
  // Cek "sudah dinilai" pun harus membaca di dalam transaksi supaya tidak
  // dilewati oleh penilaian yang masuk sepersekian detik sebelumnya.
  //
  // Transaction, not batch: two concurrent submit requests (double click,
  // network retry) both read the stale counter and write the same value, so
  // dailySubmittedCount counts one task twice. The "already graded" check must
  // also read inside the transaction so a grade landing moments earlier is not
  // silently overwritten.
  return db.runTransaction(async (tx) => {
    const [existingSubDoc, progressDoc] = await Promise.all([
      tx.get(submissionRef),
      tx.get(progressRef),
    ]);

    const now = new Date().toISOString();
    let version = 1;
    let firstSubmittedAt = now;

    if (existingSubDoc.exists) {
      const existing = existingSubDoc.data() as SubmissionDocument;
      if (!canReplaceSubmission(existing.score)) {
        throw new Error('Tugas sudah dinilai oleh admin dan tidak dapat diganti lagi.');
      }
      version = (existing.version || 1) + 1;
      firstSubmittedAt = existing.firstSubmittedAt || existing.submittedAt;
    }

    const submissionDoc: SubmissionDocument = {
      id: submissionId,
      taskId: input.taskId,
      taskKind: taskData.kind,
      taskTitle: taskData.title,
      classId: actor.classId!,
      className: classData.canonicalName,
      studentId: actor.uid,
      studentName: actor.name,
      fileId,
      fileName,
      url,
      firstSubmittedAt,
      submittedAt: now,
      late: isSubmissionLate(now, taskData.dueAt),
      version,
      score: null,
      gradedAt: null,
      feedbackPreview: null,
    };

    tx.set(submissionRef, submissionDoc);

    // Counter hanya naik pada pengumpulan pertama, bukan pada penggantian file.
    // Counter only increments on first submission, not on file replacement.
    if (!existingSubDoc.exists && taskData.kind === 'daily') {
      const currentDailyCount = progressDoc.exists ? (progressDoc.data()?.dailySubmittedCount || 0) : 0;
      tx.set(
        progressRef,
        { dailySubmittedCount: currentDailyCount + 1, updatedAt: now },
        { merge: true }
      );
    }

    return submissionDoc;
  });
}

/**
 * Mengambil daftar tugas kelas untuk siswa, beserta status pengumpulan dan feedback masing-masing.
 *
 * Retrieves list of class tasks for a student with their submission status and feedback.
 */
export async function listStudentTasksWithSubmissions(actor: Actor): Promise<StudentTaskItem[]> {
  if (!actor.classId) return [];

  const db = getAdminDb();

  // Daftar tugas, submission siswa, dan dokumen kelas independen satu sama lain
  // -- jalankan paralel.
  // Task list, student submissions, and class document are independent of each
  // other -- run in parallel.
  const [tasks, subsSnap, classDoc] = await Promise.all([
    listTasksForClass(actor.classId),
    db.collection('submissions').where('studentId', '==', actor.uid).get(),
    db.collection('classes').doc(actor.classId).get(),
  ]);

  const subsMap = new Map<string, SubmissionDocument>();
  for (const doc of subsSnap.docs) {
    const sub = doc.data() as SubmissionDocument;
    subsMap.set(sub.taskId, sub);
  }

  const classData = classDoc.data() as ClassDocument;
  const requiredDailyIds = classData?.requiredDailyTaskIds || [];

  const submittedDailyIds = Array.from(subsMap.values())
    .filter((s) => s.taskKind === 'daily')
    .map((s) => s.taskId);

  const capstoneUnlocked = isCapstoneUnlocked(requiredDailyIds, submittedDailyIds);

  const items: StudentTaskItem[] = await Promise.all(
    tasks.map(async (t) => {
      const sub = subsMap.get(t.id) || null;
      let feedback: string | null = null;

      if (sub && sub.score !== null) {
        // Ambil full feedback / Fetch full feedback
        const fbDoc = await db.collection('submissionFeedback').doc(sub.id).get();
        if (fbDoc.exists) {
          feedback = (fbDoc.data() as SubmissionFeedbackDocument).text;
        }
      }

      return {
        task: {
          id: t.id,
          classId: t.classId,
          kind: t.kind,
          title: t.title,
          order: t.order,
          dueAt: t.dueAt,
          briefUrl: t.briefUrl,
          briefFileName: t.briefFileName,
          description: t.description || '',
          // Tanpa baris ini bahan praktik tersimpan tetapi tidak pernah sampai
          // ke peserta, dan typecheck tidak menangkapnya sebab field ini
          // opsional.
          //
          // Without this line practice materials are stored but never reach
          // participants, and typecheck does not catch it since the field is
          // optional.
          materials: t.materials ?? [],
          sessionId: t.sessionId ?? null,
        },
        submission: sub,
        feedback,
        isUnlocked: t.kind === 'daily' ? true : capstoneUnlocked,
      };
    })
  );

  return items;
}

/**
 * Admin memberikan nilai (0-100) dan feedback teks untuk satu tugas siswa.
 *
 * Admin grades (0-100) and gives feedback for a student submission.
 */
export async function gradeSubmission(actor: Actor, input: GradeSubmissionInput): Promise<void> {
  if (actor.role !== 'admin') {
    throw new Error('Hanya admin yang diizinkan memberikan nilai');
  }

  const { score, feedback } = validateGradeInput(input);
  const db = getAdminDb();

  const subRef = db.collection('submissions').doc(input.submissionId);
  const subDoc = await subRef.get();

  if (!subDoc.exists) {
    throw new Error('Submission tidak ditemukan');
  }

  const subData = subDoc.data() as SubmissionDocument;
  const now = new Date().toISOString();
  const feedbackPreview = feedback.slice(0, 160);

  const batch = db.batch();

  // 1. Update dokumen submission / Update submission document
  batch.update(subRef, {
    score,
    feedbackPreview,
    gradedAt: now,
    gradedBy: actor.name,
  });

  // 2. Simpan feedback lengkap di collection terpisah / Store full feedback in dedicated document
  const fbRef = db.collection('submissionFeedback').doc(input.submissionId);
  batch.set(fbRef, {
    id: input.submissionId,
    text: feedback,
    gradedVersion: subData.version,
    gradedBy: actor.name,
    updatedAt: now,
  });

  await batch.commit();
}

/**
 * Mengambil daftar submission tugas untuk admin (diurutkan berdasarkan yang mengumpulkan tercepat).
 *
 * Retrieves submissions list for admin (sorted by fastest submission time asc - Frame D1).
 */
export async function listSubmissionsForAdmin(
  actor: Actor,
  filters: { kind?: 'daily' | 'capstone'; classId?: string }
): Promise<SubmissionDocument[]> {
  if (actor.role !== 'admin') {
    throw new Error('Hanya admin yang diizinkan melihat rekap tugas siswa');
  }

  const db = getAdminDb();
  let query = db.collection('submissions').orderBy('submittedAt', 'asc');

  if (filters.kind) {
    query = query.where('taskKind', '==', filters.kind);
  }

  if (filters.classId) {
    query = query.where('classId', '==', filters.classId);
  }

  const snapshot = await query.limit(50).get();
  return snapshot.docs.map((doc) => doc.data() as SubmissionDocument);
}
