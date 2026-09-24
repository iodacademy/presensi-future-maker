// Layanan pengelolaan data kelas di Firestore / Class management service in Firestore
import crypto from 'crypto';
import { getAdminDb } from '../../lib/firebase/admin';
import type { Actor } from '../auth/types';
import type { ClassDocument, ClassSummary, CreateClassInput } from './types';
import { formatCanonicalClassName, generateClassKey, validateClassInput } from './policy';

/**
 * Membuat unit Kota+Kelas baru dalam status draft.
 *
 * Creates a new City+Class unit in draft status.
 */
export async function createClass(actor: Actor, input: CreateClassInput): Promise<{ id: string }> {
  if (actor.role !== 'admin') {
    throw new Error('Hanya admin yang berhak membuat kelas / Only admin can create classes');
  }

  const { city, programName, mentorIds } = validateClassInput(input);
  const classKey = generateClassKey(city, programName);
  const canonicalName = formatCanonicalClassName(programName, city);

  const db = getAdminDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  // Transaksi untuk memastikan keunikan Kota + Program Name
  // Transaction to guarantee City + Program Name uniqueness
  await db.runTransaction(async (transaction) => {
    const keyRef = db.collection('classKeys').doc(classKey);
    const keyDoc = await transaction.get(keyRef);

    if (keyDoc.exists) {
      throw new Error(`Kelas ${canonicalName} sudah terdaftar / Class already exists`);
    }

    const classDoc: ClassDocument = {
      id,
      city,
      programName,
      canonicalName,
      classKey,
      status: 'draft',
      mentorIds,
      requiredDailyTaskIds: [],
      capstoneTaskId: null,
      mentorCount: mentorIds.length,
      studentCount: 0,
      dailyTaskCount: 0,
      capstoneTaskCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    transaction.set(keyRef, { classId: id, createdAt: now });
    transaction.set(db.collection('classes').doc(id), classDoc);
  });

  return { id };
}

/**
 * Mengambil daftar seluruh kelas yang terdaftar.
 *
 * Retrieves list of all registered classes.
 */
export async function listClasses(): Promise<ClassSummary[]> {
  const db = getAdminDb();
  const snapshot = await db.collection('classes').orderBy('createdAt', 'desc').get();

  return snapshot.docs.map((doc) => {
    const data = doc.data() as ClassDocument;
    return {
      id: data.id,
      city: data.city,
      programName: data.programName,
      canonicalName: data.canonicalName,
      status: data.status,
      mentorCount: data.mentorCount || 0,
      studentCount: data.studentCount || 0,
      dailyTaskCount: data.dailyTaskCount || 0,
      capstoneTaskCount: data.capstoneTaskCount || 0,
    };
  });
}

/**
 * Mengambil detail satu kelas berdasarkan ID.
 *
 * Retrieves detail of a single class by ID.
 */
export async function getClassById(classId: string): Promise<ClassDocument | null> {
  const db = getAdminDb();
  const doc = await db.collection('classes').doc(classId).get();
  if (!doc.exists) return null;
  return doc.data() as ClassDocument;
}

/**
 * Mengubah daftar mentor yang menangani sebuah kelas (assign/lepas mentor).
 * Menerima daftar mentorIds final (bukan tambahan), lalu memvalidasi tiap
 * mentorId benar-benar milik pengguna dengan role mentor yang aktif.
 *
 * Updates the list of mentors handling a class (assign/unassign mentors).
 * Accepts the final mentorIds list (not a delta), then validates each
 * mentorId actually belongs to an active mentor-role user.
 */
export async function updateClassMentors(
  actor: Actor,
  classId: string,
  mentorIds: string[]
): Promise<void> {
  if (actor.role !== 'admin') {
    throw new Error('Hanya admin yang diizinkan mengubah mentor kelas / Only admin can change class mentors');
  }

  const db = getAdminDb();
  const classRef = db.collection('classes').doc(classId);
  const classDoc = await classRef.get();
  if (!classDoc.exists) {
    throw new Error('Kelas tidak ditemukan / Class not found');
  }

  const uniqueIds = Array.from(new Set(mentorIds.filter(Boolean)));

  if (uniqueIds.length > 0) {
    const mentorDocs = await Promise.all(uniqueIds.map((id) => db.collection('users').doc(id).get()));
    for (let i = 0; i < mentorDocs.length; i++) {
      const doc = mentorDocs[i];
      if (!doc.exists || doc.data()?.role !== 'mentor' || !doc.data()?.active) {
        throw new Error(`Mentor dengan ID ${uniqueIds[i]} tidak valid atau tidak aktif / Invalid or inactive mentor`);
      }
    }
  }

  await classRef.update({
    mentorIds: uniqueIds,
    mentorCount: uniqueIds.length,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Mengambil daftar mentor yang aktif untuk dipilih saat membuat kelas,
 * beserta nama kelas yang sudah ditangani (jika ada) untuk konteks admin.
 *
 * Retrieves active mentors for class creation selection, including
 * their currently assigned class name (if any) for admin context.
 */
export async function listAvailableMentors(): Promise<
  { uid: string; name: string; email: string; currentClassName?: string }[]
> {
  const db = getAdminDb();
  const [mentorsSnap, classesSnap] = await Promise.all([
    db.collection('users').where('role', '==', 'mentor').where('active', '==', true).get(),
    db.collection('classes').select('canonicalName', 'mentorIds').get(),
  ]);

  // Petakan mentorId -> nama kelas pertama yang ditanganinya
  // Map mentorId -> first class name they currently handle
  const mentorClassMap = new Map<string, string>();
  for (const doc of classesSnap.docs) {
    const data = doc.data() as { canonicalName: string; mentorIds: string[] };
    for (const mentorId of data.mentorIds || []) {
      if (!mentorClassMap.has(mentorId)) {
        mentorClassMap.set(mentorId, data.canonicalName);
      }
    }
  }

  return mentorsSnap.docs.map((doc) => {
    const data = doc.data();
    return {
      uid: data.uid,
      name: data.name,
      email: data.email,
      currentClassName: mentorClassMap.get(data.uid),
    };
  });
}
