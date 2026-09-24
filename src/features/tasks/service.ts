// Layanan Course Builder dan pengelolaan tugas kelas / Course Builder and task management service
import crypto from 'crypto';
import { getAdminDb } from '../../lib/firebase/admin';
import type { Actor } from '../auth/types';
import type { MaterialLink, AddMaterialInput, TaskDocument, TaskDetailDocument, CreateTaskInput, UpdateTaskInput, TaskSummary } from './types';
import type { ClassDocument } from '../classes/types';
import { validateTaskInput, canActivateClass } from './policy';

/**
 * Menambahkan tugas baru (Harian atau Capstone) ke dalam kelas yang masih berstatus draft.
 *
 * Adds a new task (Daily or Capstone) to a draft class.
 */
export async function createTask(actor: Actor, input: CreateTaskInput): Promise<{ id: string }> {
  if (actor.role !== 'admin') {
    throw new Error('Hanya admin yang diizinkan menyusun kurikulum tugas');
  }

  const validated = validateTaskInput(input);
  const db = getAdminDb();

  // Validasi status kelas / Validate class status
  const classRef = db.collection('classes').doc(validated.classId);
  const classDoc = await classRef.get();
  if (!classDoc.exists) {
    throw new Error('Kelas tidak ditemukan');
  }

  const classData = classDoc.data() as ClassDocument;
  if (classData.status === 'archived') {
    throw new Error('Tugas tidak dapat ditambahkan pada kelas yang diarsipkan');
  }

  if (validated.kind === 'capstone' && (classData.capstoneTaskCount || 0) >= 1) {
    throw new Error('Kelas hanya boleh memiliki 1 instruksi Capstone Project');
  }

  const taskId = crypto.randomUUID();
  const now = new Date().toISOString();

  const taskDoc: TaskDocument = {
    id: taskId,
    classId: validated.classId,
    kind: validated.kind,
    sessionId: input.sessionId ?? null,
    title: validated.title,
    order: validated.order,
    dueAt: validated.dueAt,
    briefUrl: validated.briefUrl,
    briefFileName: validated.briefFileName,
    // Tugas pada kelas yang sudah aktif langsung terbit; peserta sudah berada
    // di dalam kelas dan menunggu tugasnya. Pada kelas draft, penerbitan
    // menunggu aktivasi.
    //
    // A task on an already-active class publishes at once; participants are
    // inside the class and waiting for it. On a draft class, publishing waits
    // for activation.
    published: classData.status === 'active',
    version: 1,
    createdAt: now,
    updatedAt: now,
  };

  const taskDetail: TaskDetailDocument = {
    id: taskId,
    description: validated.description,
    updatedAt: now,
  };

  // Simpan dalam batch dan update hitungan di kelas / Write in batch and update class counters
  const batch = db.batch();
  batch.set(db.collection('tasks').doc(taskId), taskDoc);
  batch.set(db.collection('taskDetails').doc(taskId), taskDetail);

  // Working paper tidak menambah penghitung mana pun: keduanya mengukur tugas
  // harian dan capstone, yang menentukan kesiapan kelas dan syarat Capstone.
  // Memasukkan working paper ke dalamnya akan mengubah arti angka itu.
  //
  // A working paper increments neither counter: both measure daily tasks and
  // the capstone, which decide class readiness and the Capstone requirement.
  // Folding working papers in would change what those numbers mean.
  const deltaField =
    validated.kind === 'daily'
      ? 'dailyTaskCount'
      : validated.kind === 'capstone'
        ? 'capstoneTaskCount'
        : null;
  const currentCount = deltaField ? classData[deltaField] || 0 : 0;

  // Snapshot tugas wajib ikut diperbarui pada kelas yang sudah aktif. Capstone
  // terbuka hanya bila setiap ID dalam snapshot itu sudah dikumpulkan, sehingga
  // tugas baru yang tidak tercatat di sana tidak pernah dihitung -- dan tugas
  // yang tidak tercatat tidak menghalangi Capstone, tetapi tugas yang tercatat
  // tanpa pernah terbit akan mengunci Capstone selamanya.
  //
  // The required-task snapshot is updated too on an already-active class. The
  // Capstone unlocks only when every ID in that snapshot has been submitted, so
  // a new task missing from it is never counted -- and while an unlisted task
  // does not block the Capstone, a listed task that never publishes would lock
  // it forever.
  const joinsSnapshot = validated.kind === 'daily' && classData.status === 'active';

  batch.update(classRef, {
    ...(deltaField ? { [deltaField]: currentCount + 1 } : {}),
    ...(joinsSnapshot
      ? { requiredDailyTaskIds: [...(classData.requiredDailyTaskIds || []), taskId] }
      : {}),
    ...(validated.kind === 'capstone' && classData.status === 'active'
      ? { capstoneTaskId: taskId }
      : {}),
    updatedAt: now,
  });

  await batch.commit();

  return { id: taskId };
}

/**
 * Mengambil daftar seluruh tugas di suatu kelas beserta detail deskripsinya.
 *
 * Retrieves list of all tasks for a class including description details.
 */
export async function listTasksForClass(classId: string): Promise<TaskSummary[]> {
  const db = getAdminDb();
  const tasksSnap = await db.collection('tasks')
    .where('classId', '==', classId)
    .get();

  const tasks = tasksSnap.docs.map((doc) => doc.data() as TaskDocument);

  // Ambil detail deskripsi masing-masing tugas / Fetch description details for each task
  const summaries: TaskSummary[] = await Promise.all(
    tasks.map(async (t) => {
      const detailDoc = await db.collection('taskDetails').doc(t.id).get();
      const description = detailDoc.exists ? (detailDoc.data()?.description || '') : '';
      return {
        ...t,
        description,
      };
    })
  );

  // Urutkan: Daily tasks berdasarkan order menaik, lalu Capstone di akhir
  // Sort: Daily tasks by order asc, then Capstone at the end
  return summaries.sort((a, b) => {
    if (a.kind === b.kind) {
      return a.order - b.order;
    }
    return a.kind === 'daily' ? -1 : 1;
  });
}

/**
 * Mengambil detail satu tugas beserta instruksi deskripsinya.
 *
 * Retrieves a single task and its description instructions.
 */
export async function getTaskById(taskId: string): Promise<TaskSummary | null> {
  const db = getAdminDb();
  const taskDoc = await db.collection('tasks').doc(taskId).get();
  if (!taskDoc.exists) return null;

  const taskData = taskDoc.data() as TaskDocument;
  const detailDoc = await db.collection('taskDetails').doc(taskId).get();
  const description = detailDoc.exists ? (detailDoc.data()?.description || '') : '';

  return {
    ...taskData,
    description,
  };
}

/**
 * Mengaktifkan kelas dan mengunci snapshot tugas harian wajib (Aktivasi Course Builder).
 *
 * Activates a class and locks the required daily tasks snapshot (Course Builder Activation).
 */
export async function activateClass(actor: Actor, classId: string): Promise<void> {
  if (actor.role !== 'admin') {
    throw new Error('Hanya admin yang diizinkan mengaktifkan kelas');
  }

  const db = getAdminDb();
  const classRef = db.collection('classes').doc(classId);
  const classDoc = await classRef.get();

  if (!classDoc.exists) {
    throw new Error('Kelas tidak ditemukan');
  }

  const classData = classDoc.data() as ClassDocument;

  const sessionsSnap = await db.collection('sessions').where('classId', '==', classId).count().get();

  const check = canActivateClass({
    status: classData.status,
    sessionCount: sessionsSnap.data().count,
  });

  if (!check.canActivate) {
    throw new Error(`Kelas belum dapat diaktifkan: ${check.reason}`);
  }

  const tasksSnap = await db.collection('tasks').where('classId', '==', classId).get();
  const tasks = tasksSnap.docs.map((d) => d.data() as TaskDocument);

  const dailyTasks = tasks.filter((t) => t.kind === 'daily').sort((a, b) => a.order - b.order);
  const capstoneTask = tasks.find((t) => t.kind === 'capstone');

  const requiredDailyTaskIds = dailyTasks.map((t) => t.id);
  const now = new Date().toISOString();

  const batch = db.batch();

  // Snapshot tugas wajib tidak lagi terkunci di sini. Kelas dapat diaktifkan
  // tanpa satu pun tugas, dan tugas yang ditambahkan kemudian bergabung ke
  // snapshot lewat createTask; bila daftarnya dibekukan saat ini, Capstone
  // tidak akan pernah terbuka pada kelas yang tugasnya disusun belakangan.
  //
  // The required-task snapshot is no longer frozen here. A class may be
  // activated with no tasks at all, and tasks added later join the snapshot via
  // createTask; freezing the list now would leave the Capstone permanently shut
  // on any class whose tasks are written afterwards.
  batch.update(classRef, {
    status: 'active',
    requiredDailyTaskIds,
    capstoneTaskId: capstoneTask?.id ?? null,
    updatedAt: now,
  });

  // Publikasikan seluruh tugas kelas / Publish all class tasks
  for (const t of tasks) {
    batch.update(db.collection('tasks').doc(t.id), {
      published: true,
      updatedAt: now,
    });
  }

  await batch.commit();
}

/**
 * Menebak jenis berkas dari tautannya.
 *
 * Dipakai hanya untuk memilih ikon dan keterangan; tebakan yang meleset tidak
 * menghalangi peserta membuka tautannya.
 *
 * Guesses a file's kind from its link.
 *
 * Used only to pick an icon and caption; a wrong guess does not stop a
 * participant opening the link.
 */
function guessMaterialKind(url: string): MaterialLink['kind'] {
  const lower = url.toLowerCase();
  if (lower.includes('/presentation/') || lower.endsWith('.ppt') || lower.endsWith('.pptx')) return 'slide';
  if (lower.includes('/spreadsheets/') || lower.endsWith('.xls') || lower.endsWith('.xlsx') || lower.endsWith('.csv')) return 'sheet';
  if (lower.includes('/document/') || lower.endsWith('.doc') || lower.endsWith('.docx')) return 'doc';
  if (lower.endsWith('.pdf')) return 'pdf';
  return 'other';
}

/**
 * Admin menambahkan satu bahan praktik pada sebuah tugas.
 *
 * Transaksi dipakai, bukan pembaruan larik biasa: dua admin yang menambah bahan
 * hampir bersamaan sama-sama membaca daftar lama, dan yang menulis belakangan
 * menghapus bahan yang baru saja ditambahkan yang lain.
 *
 * An admin adds one practice material to a task.
 *
 * A transaction is used rather than a plain array update: two admins adding
 * materials at nearly the same time both read the old list, and whoever writes
 * last erases the material the other just added.
 */
export async function addTaskMaterial(actor: Actor, input: AddMaterialInput): Promise<void> {
  if (actor.role !== 'admin') {
    throw new Error('Hanya admin yang diizinkan menambah bahan praktik');
  }

  const url = (input.url ?? '').trim();
  if (!url) {
    throw new Error('Tautan bahan wajib diisi');
  }

  // HTTPS diwajibkan karena tautan ini dirender sebagai href pada halaman
  // peserta: tautan javascript: akan dieksekusi di peramban mereka.
  //
  // HTTPS is required because this link renders as an href on the participant
  // page: a javascript: link would execute in their browser.
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') throw new Error();
  } catch {
    throw new Error('Tautan bahan harus berupa URL HTTPS yang valid');
  }

  const label = (input.label ?? '').trim().slice(0, 80) || 'Bahan praktik';
  const db = getAdminDb();
  const taskRef = db.collection('tasks').doc(input.taskId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(taskRef);
    if (!snap.exists) {
      throw new Error('Tugas tidak ditemukan');
    }

    const existing = ((snap.data() as TaskDocument).materials || []) as MaterialLink[];
    if (existing.some((m) => m.url === url)) {
      throw new Error('Tautan ini sudah ditambahkan pada tugas tersebut');
    }

    tx.update(taskRef, {
      materials: [
        ...existing,
        {
          id: crypto.randomUUID(),
          label,
          url,
          kind: input.kind ?? guessMaterialKind(url),
          addedAt: new Date().toISOString(),
        },
      ],
      updatedAt: new Date().toISOString(),
    });
  });
}

/**
 * Admin menghapus satu bahan praktik dari sebuah tugas.
 *
 * An admin removes one practice material from a task.
 */
export async function removeTaskMaterial(
  actor: Actor,
  taskId: string,
  materialId: string
): Promise<void> {
  if (actor.role !== 'admin') {
    throw new Error('Hanya admin yang diizinkan menghapus bahan praktik');
  }

  const db = getAdminDb();
  const taskRef = db.collection('tasks').doc(taskId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(taskRef);
    if (!snap.exists) {
      throw new Error('Tugas tidak ditemukan');
    }

    const existing = ((snap.data() as TaskDocument).materials || []) as MaterialLink[];
    tx.update(taskRef, {
      materials: existing.filter((m) => m.id !== materialId),
      updatedAt: new Date().toISOString(),
    });
  });
}
