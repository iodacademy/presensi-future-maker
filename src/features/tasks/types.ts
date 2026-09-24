// Definisi tipe data tugas dan kurikulum / Task and curriculum data type definitions

/**
 * Jenis tugas.
 *
 * 'working-paper' terikat pada satu pertemuan dan dikumpulkan seusai sesi itu,
 * sedangkan 'daily' berdiri sendiri di sepanjang kelas. Keduanya memakai jalur
 * pengumpulan dan penilaian yang sama; yang membedakan hanya keterikatannya
 * pada sesi dan tempat tampilnya bagi peserta.
 *
 * Task kind.
 *
 * 'working-paper' is tied to one meeting and submitted after that session,
 * while 'daily' stands on its own across the class. Both use the same
 * submission and grading path; what differs is the tie to a session and where
 * they appear to participants.
 */
export type TaskKind = 'daily' | 'capstone' | 'working-paper';

export const TASK_KIND_LABELS: Record<TaskKind, string> = {
  daily: 'Tugas Harian',
  capstone: 'Capstone Project',
  'working-paper': 'Working Paper',
};

/**
 * Berkas pendukung sebuah pertemuan atau tugas.
 *
 * Disimpan sebagai tautan, bukan berkas yang diunggah: pengumpulan tugas pun
 * memakai tautan Drive, dan menambahkan penyimpanan berkas hanya untuk materi
 * akan membuat dua cara berbeda menangani hal yang sama.
 *
 * A supporting file for a meeting or task.
 *
 * Stored as a link rather than an uploaded file: submissions already use Drive
 * links, and adding file storage for materials alone would create two different
 * ways of handling the same thing.
 */
export interface MaterialLink {
  id: string;
  label: string;
  url: string;
  /** Jenis berkas untuk ikon dan keterangan / File kind for icon and caption */
  kind: 'pdf' | 'slide' | 'sheet' | 'doc' | 'other';
  addedAt: string;
}

export interface TaskDocument {
  id: string;
  classId: string;
  kind: TaskKind;
  /**
   * Pertemuan yang menjadi induk working paper. Null bagi tugas harian dan
   * capstone, yang tidak terikat satu sesi.
   *
   * The meeting a working paper belongs to. Null for daily tasks and the
   * capstone, which are not tied to one session.
   */
  sessionId?: string | null;
  title: string;
  order: number;
  /**
   * Batas pengumpulan sebagai ISO UTC.
   *
   * Sebelumnya berupa teks bebas seperti "30 September 2026, 23:59 WIB", yang
   * tidak dapat diurai Date sehingga tidak ada pengumpulan yang pernah
   * ditandai terlambat.
   *
   * The submission deadline as ISO UTC.
   *
   * It was previously free text such as "30 September 2026, 23:59 WIB", which
   * Date cannot parse, so no submission was ever marked late.
   */
  dueAt: string | null;
  briefUrl: string | null;
  briefFileName?: string | null;
  /** Bahan praktik yang dapat diunduh peserta / Practice materials participants can download */
  materials?: MaterialLink[];
  published: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskDetailDocument {
  id: string; // sama dengan taskId / same as taskId
  description: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  classId: string;
  kind: TaskKind;
  sessionId?: string | null;
  title: string;
  description: string;
  /** Tanggal WIB "YYYY-MM-DD" / WIB date "YYYY-MM-DD" */
  dueDate?: string | null;
  /** Jam WIB "HH:mm" / WIB time "HH:mm" */
  dueTime?: string | null;
  briefUrl?: string | null;
  briefFileName?: string | null;
  order?: number;
}

export interface AddMaterialInput {
  taskId: string;
  label: string;
  url: string;
  kind?: MaterialLink['kind'];
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  dueAt?: string | null;
  briefUrl?: string | null;
  briefFileName?: string | null;
}

export interface TaskSummary extends TaskDocument {
  description?: string;
}

export interface ClassActivationResult {
  canActivate: boolean;
  reason?: string;
}
