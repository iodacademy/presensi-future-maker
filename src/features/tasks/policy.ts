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
  const dueAt = parseDueAt(input.dueDate, input.dueTime);
  const briefFileName = input.briefFileName ? input.briefFileName.trim() : null;
  let briefUrl = input.briefUrl ? input.briefUrl.trim() : null;

  if (!classId) {
    throw new Error('ID Kelas wajib diisi / Class ID is required');
  }

  if (!title) {
    throw new Error('Judul tugas wajib diisi / Task title is required');
  }

  if (kind !== 'daily' && kind !== 'capstone' && kind !== 'working-paper') {
    throw new Error('Jenis tugas harus daily, capstone, atau working-paper / Task kind must be daily, capstone, or working-paper');
  }

  // Working paper melekat pada satu pertemuan; tanpa sesi induknya, peserta
  // tidak punya tempat menemukannya dan batas waktunya kehilangan acuan.
  //
  // A working paper hangs off one meeting; with no parent session, participants
  // have nowhere to find it and its deadline loses its reference.
  if (kind === 'working-paper' && !input.sessionId) {
    throw new Error('Working paper harus terikat pada satu pertemuan / A working paper must be tied to one meeting');
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
 * Memvalidasi perubahan sebuah tugas.
 *
 * Hanya field yang dikirim yang diperiksa dan dikembalikan: mengubah judul
 * tidak boleh ikut menghapus batas waktu atau tautannya hanya karena tidak
 * disertakan.
 *
 * Validates a change to a task.
 *
 * Only the fields sent are checked and returned: changing a title must not
 * also wipe the deadline or the link merely because they were not included.
 */
export function validateTaskUpdate(input: {
  title?: string;
  description?: string;
  dueDate?: string | null;
  dueTime?: string | null;
  briefUrl?: string | null;
}): {
  title?: string;
  description?: string;
  dueAt?: string | null;
  briefUrl?: string | null;
} {
  const patch: {
    title?: string;
    description?: string;
    dueAt?: string | null;
    briefUrl?: string | null;
  } = {};

  if (input.title !== undefined) {
    const title = input.title.trim();
    if (!title) {
      throw new Error('Judul tugas wajib diisi / Task title is required');
    }
    patch.title = title;
  }

  if (input.description !== undefined) {
    patch.description = input.description.trim();
  }

  // Tanggal kosong berarti batas dihapus, bukan tidak diubah; keduanya harus
  // dapat dibedakan agar admin dapat mencabut batas yang salah.
  //
  // An empty date means the deadline is cleared, not left alone; the two must
  // stay distinguishable so an admin can lift a wrong deadline.
  if (input.dueDate !== undefined) {
    patch.dueAt = parseDueAt(input.dueDate, input.dueTime);
  }

  if (input.briefUrl !== undefined) {
    const url = input.briefUrl ? input.briefUrl.trim() : '';
    if (!url) {
      patch.briefUrl = null;
    } else {
      // Tautan ini dibuka peserta dari halaman aplikasi: tautan http memicu
      // peringatan konten tidak aman, dan javascript: akan dieksekusi di
      // peramban mereka.
      //
      // Participants open this link from an application page: an http link
      // triggers an insecure-content warning, and javascript: would execute in
      // their browser.
      try {
        if (new URL(url).protocol !== 'https:') throw new Error('bukan https');
      } catch {
        throw new Error('Tautan harus berupa URL HTTPS yang valid / The link must be a valid HTTPS URL');
      }
      patch.briefUrl = url;
    }
  }

  return patch;
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

/**
 * Menyusun batas pengumpulan dari tanggal dan jam WIB menjadi ISO UTC.
 *
 * Batas waktu sebelumnya disimpan sebagai teks bebas seperti "30 September
 * 2026, 23:59 WIB". Date tidak dapat mengurainya, sehingga perbandingan
 * keterlambatan selalu menghasilkan NaN dan tidak ada pengumpulan yang pernah
 * ditandai terlambat.
 *
 * Jam dikosongkan berarti akhir hari: batas "30 September" yang diperlakukan
 * sebagai 00.00 akan menolak seluruh pengumpulan pada hari itu juga.
 *
 * Builds a deadline from a WIB date and time into ISO UTC.
 *
 * Deadlines were previously stored as free text such as "30 September 2026,
 * 23:59 WIB". Date cannot parse that, so the lateness comparison always
 * produced NaN and no submission was ever marked late.
 *
 * An empty time means end of day: a deadline of "30 September" treated as
 * 00:00 would reject every submission made on that very day.
 */
export function parseDueAt(
  dueDate: string | null | undefined,
  dueTime: string | null | undefined
): string | null {
  const date = (dueDate ?? '').trim();
  if (!date) return null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('Tanggal batas harus berformat YYYY-MM-DD / Deadline date must be YYYY-MM-DD');
  }

  const time = (dueTime ?? '').trim() || '23:59';
  if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(time)) {
    throw new Error('Jam batas harus berformat HH:mm / Deadline time must be HH:mm');
  }

  // Penanda +07:00 membuat penguraiannya tidak bergantung pada zona waktu
  // server, yang di Cloud Run berjalan pada UTC.
  //
  // The +07:00 marker makes parsing independent of the server's timezone,
  // which on Cloud Run runs in UTC.
  const parsed = new Date(`${date}T${time}:00+07:00`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Batas pengumpulan tidak dapat dibaca / The deadline could not be read');
  }

  return parsed.toISOString();
}
