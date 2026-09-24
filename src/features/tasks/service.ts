// Layanan Course Builder dan pengelolaan tugas kelas / Course Builder and task management service
import crypto from 'crypto';
import { getAdminDb } from '../../lib/firebase/admin';
import type { Actor } from '../auth/types';
import type { TaskDocument, TaskDetailDocument, CreateTaskInput, UpdateTaskInput, TaskSummary } from './types';
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
  if (classData.status !== 'draft') {
    throw new Error('Tugas hanya dapat ditambahkan pada kelas yang berstatus draft');
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
    title: validated.title,
    order: validated.order,
    dueAt: validated.dueAt,
    briefUrl: validated.briefUrl,
    briefFileName: validated.briefFileName,
    published: false,
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

  const deltaField = validated.kind === 'daily' ? 'dailyTaskCount' : 'capstoneTaskCount';
  const currentCount = classData[deltaField] || 0;

  batch.update(classRef, {
    [deltaField]: currentCount + 1,
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

  // Evaluasi kelayakan aktivasi / Evaluate activation eligibility
  const check = canActivateClass({
    status: classData.status,
    mentorCount: classData.mentorCount || classData.mentorIds?.length || 0,
    dailyTaskCount: classData.dailyTaskCount || 0,
    capstoneTaskCount: classData.capstoneTaskCount || 0,
  });

  if (!check.canActivate) {
    throw new Error(`Kelas belum dapat diaktifkan: ${check.reason}`);
  }

  // Ambil semua tugas untuk merekam snapshot ID tugas harian wajib
  // Fetch all tasks to record the snapshot of required daily tasks
  const tasksSnap = await db.collection('tasks').where('classId', '==', classId).get();
  const tasks = tasksSnap.docs.map((d) => d.data() as TaskDocument);

  const dailyTasks = tasks.filter((t) => t.kind === 'daily').sort((a, b) => a.order - b.order);
  const capstoneTask = tasks.find((t) => t.kind === 'capstone');

  if (!capstoneTask) {
    throw new Error('Instruksi Capstone Project tidak ditemukan');
  }

  const requiredDailyTaskIds = dailyTasks.map((t) => t.id);
  const now = new Date().toISOString();

  const batch = db.batch();

  // Kunci snapshot di dokumen kelas / Lock snapshot on class document
  batch.update(classRef, {
    status: 'active',
    requiredDailyTaskIds,
    capstoneTaskId: capstoneTask.id,
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
