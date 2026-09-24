// Aturan validasi tugas dan aktivasi kurikulum / Task validation and curriculum activation policy
import type { CreateTaskInput, ClassActivationResult, TaskKind } from './types';
import type { ClassStatus } from '../classes/types';

/**
 * Memvalidasi masukan pembuatan tugas baru di Course Builder.
 *
 * Validates new task input in Course Builder.
 */
export function validateTaskInput(input: CreateTaskInput): {
  classId: string;
  kind: TaskKind;
  title: string;
  description: string;
  dueAt: string | null;
  briefUrl: string | null;
  briefFileName: string | null;
  order: number;
} {
  const classId = input.classId ? input.classId.trim() : '';
  const title = input.title ? input.title.trim() : '';
  const description = input.description ? input.description.trim() : '';
  const kind = input.kind;
  const order = typeof input.order === 'number' && input.order > 0 ? input.order : 1;
  const dueAt = input.dueAt ? input.dueAt.trim() : null;
  const briefFileName = input.briefFileName ? input.briefFileName.trim() : null;
  let briefUrl = input.briefUrl ? input.briefUrl.trim() : null;

  if (!classId) {
    throw new Error('ID Kelas wajib diisi / Class ID is required');
  }

  if (!title) {
    throw new Error('Judul tugas wajib diisi / Task title is required');
  }

  if (kind !== 'daily' && kind !== 'capstone') {
    throw new Error('Jenis tugas harus daily atau capstone / Task kind must be daily or capstone');
  }

  if (briefUrl) {
    // Validasi URL harus HTTPS / Validate URL must be HTTPS
    try {
      const parsed = new URL(briefUrl);
      if (parsed.protocol !== 'https:') {
        throw new Error('Tautan brief harus berupa URL HTTPS yang valid / Brief link must be a valid HTTPS URL');
      }
    } catch {
      throw new Error('Tautan brief harus berupa URL HTTPS yang valid / Brief link must be a valid HTTPS URL');
    }
  }

  return {
    classId,
    kind,
    title,
    description,
    dueAt,
    briefUrl,
    briefFileName,
    order,
  };
}

/**
 * Mengecek apakah sebuah kelas memenuhi syarat untuk diaktifkan:
 * 1. Status saat ini harus draft
 * 2. Memiliki minimal 1 mentor
 * 3. Memiliki minimal 1 tugas harian
 * 4. Memiliki tepat 1 tugas Capstone
 *
 * Checks if a class meets activation criteria.
 */
export function canActivateClass(params: {
  status: ClassStatus;
  sessionCount: number;
}): ClassActivationResult {
  if (params.status !== 'draft') {
    return { canActivate: false, reason: 'Kelas sudah aktif atau diarsipkan' };
  }

  // Hanya jadwal yang diwajibkan. Mentor, tugas harian, dan Capstone disusun
  // selama program berjalan, sehingga menuntutnya di muka menahan peserta dari
  // melihat jadwal yang sudah pasti.
  //
  // Only the schedule is required. Mentors, daily tasks, and the Capstone are
  // assembled as the programme runs, so demanding them upfront keeps
  // participants from seeing a schedule that is already settled.
  if (params.sessionCount < 1) {
    return { canActivate: false, reason: 'Kelas harus memiliki minimal 1 jadwal pertemuan' };
  }

  return { canActivate: true };
}

/**
 * Menentukan apakah Capstone terbuka untuk seorang siswa:
 * Capstone terbuka HANYA JIKA semua tugas harian wajib dalam snapshot kelas telah dikumpulkan.
 *
 * Determines whether Capstone is unlocked for a student.
 */
export function isCapstoneUnlocked(
  requiredDailyTaskIds: string[],
  submittedDailyTaskIds: string[]
): boolean {
  // Tanpa tugas harian, tidak ada yang perlu diselesaikan lebih dulu sehingga
  // Capstone terbuka. Mengembalikan false di sini akan mengunci Capstone
  // selamanya pada kelas yang diaktifkan sebelum tugasnya disusun -- keadaan
  // yang tidak dapat dipulihkan peserta maupun admin.
  //
  // With no daily tasks there is nothing to finish first, so the Capstone is
  // open. Returning false here would shut the Capstone permanently on a class
  // activated before its tasks were written -- a state neither participant nor
  // admin could recover from.
  if (!requiredDailyTaskIds || requiredDailyTaskIds.length === 0) {
    return true;
  }

  const submittedSet = new Set(submittedDailyTaskIds);
  return requiredDailyTaskIds.every((id) => submittedSet.has(id));
}
