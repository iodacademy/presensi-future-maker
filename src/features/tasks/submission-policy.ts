// Aturan validasi pengumpulan tugas, batas ukuran, keterlambatan dan penilaian
// Policy for task submissions, size boundaries, lateness, and grading
import type { GradeSubmissionInput } from './submission-types';

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MiB (10.485.760 bytes)

/** Awalan jalur berkas tugas di Storage / The Storage path prefix for task files */
export const SUBMISSION_FILE_PREFIX = 'submissions/';

/** Berkas yang benar-benar tersimpan di Storage / A file actually stored in Storage */
export function isStoredSubmissionFile(fileId: string | null | undefined): boolean {
  return Boolean(fileId && fileId.startsWith(SUBMISSION_FILE_PREFIX));
}

/**
 * Pengumpulan dari formulir lama yang hanya menyimpan nama berkas, tanpa isinya.
 * A submission from the old form that stored only the file's name, not its contents.
 */
export function isLostSubmissionFile(fileId: string | null | undefined): boolean {
  return Boolean(fileId && fileId.startsWith('local-file-'));
}

export interface ValidatedSubmissionInput {
  sourceType: 'file' | 'url';
  fileId: string | null;
  fileName: string | null;
  url: string | null;
}

/**
 * Memvalidasi sumber pengumpulan tugas:
 * Harus tepat SATU: file (fileId) ATAU link URL (HTTPS).
 * Tidak boleh keduanya, dan tidak boleh kosong keduanya.
 *
 * Validates submission source: exactly ONE of file or HTTPS URL.
 */
export function validateSubmissionInput(input: {
  fileId?: string | null;
  fileName?: string | null;
  url?: string | null;
}): ValidatedSubmissionInput {
  const fileId = input.fileId ? input.fileId.trim() : null;
  const fileName = input.fileName ? input.fileName.trim() : null;
  const rawUrl = input.url ? input.url.trim() : null;

  const hasFile = Boolean(fileId);
  const hasUrl = Boolean(rawUrl);

  if (!hasFile && !hasUrl) {
    throw new Error('Pilih salah satu: unggah file atau cantumkan tautan proyek / Choose either file or URL');
  }

  // Hanya berkas yang benar-benar tersimpan di Storage yang diterima. Formulir
  // lama mengirim nama file dengan fileId buatan ("local-file-..."), sehingga
  // tidak ada berkas yang dapat dibuka penilai, padahal peserta mengira tugasnya
  // sudah terkirim.
  //
  // Only files actually stored in Storage are accepted. The old form sent a
  // file name with a made-up fileId ("local-file-..."), so there was nothing for
  // a grader to open, while the participant believed the task was handed in.
  if (hasFile && !hasUrl && !isStoredSubmissionFile(fileId)) {
    throw new Error('Unggah file lewat tombol unggah, atau tempel tautan hasil kerja Anda.');
  }

  if (hasFile && hasUrl) {
    throw new Error('Hanya boleh memilih salah satu: unggah file ATAU cantumkan tautan / Choose either file OR URL');
  }

  if (hasUrl && rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol !== 'https:') {
        throw new Error('Tautan harus berupa URL HTTPS yang valid / URL must be valid HTTPS');
      }
    } catch {
      throw new Error('Tautan harus berupa URL HTTPS yang valid / URL must be valid HTTPS');
    }

    return {
      sourceType: 'url',
      fileId: null,
      fileName: null,
      url: rawUrl,
    };
  }

  return {
    sourceType: 'file',
    fileId,
    fileName,
    url: null,
  };
}

/**
 * Menentukan apakah pengumpulan tugas terlambat berdasarkan timestamp UTC.
 * Tepat pada detik deadline dihitung tepat waktu.
 *
 * Checks if a submission is late compared to deadline in UTC.
 */
export function isSubmissionLate(submittedAt: string, dueAt: string | null): boolean {
  if (!dueAt) return false;

  const submitTime = new Date(submittedAt).getTime();
  const dueTime = new Date(dueAt).getTime();

  if (isNaN(dueTime) || isNaN(submitTime)) return false;

  // Lewat dari deadline dianggap terlambat / Past due time is late
  return submitTime > dueTime;
}

/**
 * Siswa diizinkan mengganti submission HANYA JIKA belum dinilai oleh admin.
 * Begitu dinilai (score !== null), penggantian submission ditolak.
 *
 * Students can replace submission ONLY BEFORE graded.
 */
export function canReplaceSubmission(currentScore: number | null): boolean {
  return currentScore === null || currentScore === undefined;
}

/**
 * Memvalidasi masukan penilaian tugas dari admin:
 * Skor harus bilangan bulat 0 sampai 100.
 *
 * Validates grading score (integer 0 to 100).
 */
export function validateGradeInput(input: {
  score: number;
  feedback: string;
}): { score: number; feedback: string } {
  const { score, feedback } = input;

  if (typeof score !== 'number' || isNaN(score)) {
    throw new Error('Nilai harus berupa angka / Score must be a number');
  }

  if (!Number.isInteger(score)) {
    throw new Error('Nilai harus berupa bilangan bulat (tanpa pecahan) / Score must be an integer');
  }

  if (score < 0 || score > 100) {
    throw new Error('Nilai harus antara 0 dan 100 / Score must be between 0 and 100');
  }

  return {
    score,
    feedback: feedback ? feedback.trim() : '',
  };
}
