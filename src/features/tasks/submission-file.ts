// Unggahan berkas tugas peserta ke Storage / Participants' task file uploads to Storage
import crypto from 'crypto';
import { getAdminDb, getAdminStorage } from '../../lib/firebase/admin';
import type { Actor } from '../auth/types';
import { isMenteeOf } from '../mentoring/service';
import { MAX_FILE_SIZE_BYTES, SUBMISSION_FILE_PREFIX, isStoredSubmissionFile } from './submission-policy';
import { submitTask } from './submission-service';
import type { SubmissionDocument } from './submission-types';

/**
 * Jenis berkas yang diterima, menurut ekstensinya.
 *
 * Jenis isinya ditentukan dari ekstensi, bukan dari contentType kiriman
 * peramban: Windows mengirim ZIP dan CSV dengan nama jenis yang berbeda-beda,
 * dan jenis kiriman dapat dipalsukan menjadi text/html yang lalu dijalankan
 * saat berkasnya dibuka.
 *
 * The accepted file types, by extension.
 *
 * The content type comes from the extension, not the browser's contentType:
 * Windows sends ZIP and CSV under varying type names, and a submitted type can
 * be forged as text/html that would then run when the file is opened.
 */
export const SUBMISSION_FILE_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  csv: 'text/csv',
  zip: 'application/zip',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
};

export function submissionFileExtension(fileName: string): string | null {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  return ext in SUBMISSION_FILE_TYPES ? ext : null;
}

export function validateSubmissionFile(input: { fileName: string; size: number }): string {
  const ext = submissionFileExtension(input.fileName);
  if (!ext) {
    throw new Error('Jenis berkas tidak didukung. Gunakan PDF, Word, Excel, PowerPoint, CSV, ZIP, JPG, atau PNG.');
  }
  if (input.size <= 0) throw new Error('Berkas kosong');
  if (input.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`Ukuran berkas maksimal ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB`);
  }
  return ext;
}

/** Nama berkas aman untuk ditampilkan dan diunduh / A file name safe to show and download */
function cleanFileName(name: string): string {
  return name.replace(/[\\/\r\n"]/g, '_').slice(0, 120) || 'berkas';
}

/**
 * Mengunggah berkas tugas lalu mencatat pengumpulannya.
 *
 * Berkas disimpan lebih dulu, baru pengumpulannya dicatat. Bila pencatatan
 * ditolak (tugas sudah dinilai, capstone terkunci), berkasnya dihapus lagi agar
 * tidak ada berkas yatim yang terus memakan kuota penyimpanan. Berkas lama
 * dihapus setelah yang baru tercatat.
 *
 * Uploads a task file and then records the submission.
 *
 * The file is stored first, then the submission recorded. If recording is
 * refused (task already graded, capstone locked), the file is deleted again so
 * no orphan keeps eating storage quota. The old file is deleted after the new
 * one is recorded.
 */
export async function uploadSubmissionFile(
  actor: Actor,
  taskId: string,
  file: { buffer: Buffer; fileName: string }
): Promise<SubmissionDocument> {
  if (actor.role !== 'student' || !actor.classId) {
    throw new Error('Hanya peserta yang dapat mengunggah tugas');
  }
  const ext = validateSubmissionFile({ fileName: file.fileName, size: file.buffer.length });
  const fileName = cleanFileName(file.fileName);

  const db = getAdminDb();
  const previous = (await db.collection('submissions').doc(`${taskId}_${actor.uid}`).get()).data() as SubmissionDocument | undefined;

  // Nama di Storage dibuat ulang: nama kiriman dapat memuat garis miring yang
  // memindahkan berkasnya ke folder lain.
  // The Storage name is generated: a submitted name can carry slashes that
  // move the file into another folder.
  const path = `${SUBMISSION_FILE_PREFIX}${actor.classId}/${taskId}/${actor.uid}/${crypto.randomUUID()}.${ext}`;
  const blob = getAdminStorage().bucket().file(path);
  await blob.save(file.buffer, {
    contentType: SUBMISSION_FILE_TYPES[ext],
    metadata: { metadata: { uploadedBy: actor.uid, taskId, originalName: fileName } },
  });

  let saved: SubmissionDocument;
  try {
    saved = await submitTask(actor, { taskId, fileId: path, fileName, url: null });
  } catch (err) {
    await blob.delete().catch(() => undefined);
    throw err;
  }

  if (previous?.fileId && isStoredSubmissionFile(previous.fileId) && previous.fileId !== path) {
    await getAdminStorage().bucket().file(previous.fileId).delete().catch(() => undefined);
  }
  return saved;
}

/**
 * Membaca berkas sebuah pengumpulan untuk yang berhak melihatnya: admin,
 * pesertanya sendiri, atau mentor peserta itu.
 *
 * Berkasnya tidak diberi tautan publik. Tugas peserta bersifat pribadi, dan
 * tautan bertoken akan tetap terbuka bagi siapa pun yang menerima salinannya.
 *
 * Reads a submission's file for whoever may see it: an admin, the participant
 * themselves, or that participant's mentor.
 *
 * The file gets no public link. Participants' work is private, and a tokenised
 * link would stay open to anyone handed a copy of it.
 */
export async function readSubmissionFile(
  actor: Actor,
  submissionId: string
): Promise<{ buffer: Buffer; contentType: string; fileName: string }> {
  const db = getAdminDb();
  const sub = (await db.collection('submissions').doc(submissionId).get()).data() as SubmissionDocument | undefined;
  if (!sub) throw new Error('Pengumpulan tidak ditemukan');

  const allowed =
    actor.role === 'admin' ||
    (actor.role === 'student' && actor.uid === sub.studentId) ||
    (actor.role === 'mentor' && (await isMenteeOf(actor.uid, sub.studentId)));
  if (!allowed) throw new Error('Anda tidak berhak membuka berkas ini');

  if (!isStoredSubmissionFile(sub.fileId)) throw new Error('Berkas pengumpulan ini tidak tersimpan');

  const ext = sub.fileId!.split('.').pop()!.toLowerCase();
  const [buffer] = await getAdminStorage().bucket().file(sub.fileId!).download();
  return { buffer, contentType: SUBMISSION_FILE_TYPES[ext] ?? 'application/octet-stream', fileName: sub.fileName || `tugas.${ext}` };
}

/** Tautan aplikasi untuk membuka berkas pengumpulan / The app link that opens a submission's file */
export function submissionFileUrl(submissionId: string): string {
  return `/api/submissions/${encodeURIComponent(submissionId)}/file`;
}
