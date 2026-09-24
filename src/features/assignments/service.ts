// Layanan penugasan mentor siswa per fase / Student-mentor assignment per phase service
import { getAdminDb } from '../../lib/firebase/admin';
import type { Actor, UserDocument } from '../auth/types';
import type { AssignmentDocument, AssignMentorInput, Phase } from './types';
import { generateAssignmentId, validateAssignmentInput } from './policy';
import type { ClassDocument } from '../classes/types';

/**
 * Menugaskan mentor ke siswa untuk satu fase tertentu (Bootcamp atau Internship).
 *
 * Assigns a mentor to a student for a specific phase (Bootcamp or Internship).
 */
export async function assignMentorToStudent(actor: Actor, input: AssignMentorInput): Promise<void> {
  if (actor.role !== 'admin') {
    throw new Error('Hanya admin yang diizinkan menugaskan mentor');
  }

  const { studentId, classId, mentorId, phase } = validateAssignmentInput(input);
  const db = getAdminDb();

  // Validasi keberadaan kelas dan keanggotaan mentor di kelas / Validate class and mentor membership
  const classDoc = await db.collection('classes').doc(classId).get();
  if (!classDoc.exists) {
    throw new Error('Kelas tidak ditemukan');
  }
  const classData = classDoc.data() as ClassDocument;
  if (!classData.mentorIds.includes(mentorId)) {
    throw new Error('Mentor yang dipilih tidak terdaftar di kelas ini');
  }

  // Validasi data siswa / Validate student data
  const studentDoc = await db.collection('users').doc(studentId).get();
  if (!studentDoc.exists) {
    throw new Error('Siswa tidak ditemukan');
  }
  const studentData = studentDoc.data() as UserDocument;
  if (studentData.role !== 'student' || studentData.classId !== classId) {
    throw new Error('Pengguna bukan siswa aktif di kelas ini');
  }

  // Validasi mentor / Validate mentor
  const mentorDoc = await db.collection('users').doc(mentorId).get();
  if (!mentorDoc.exists) {
    throw new Error('Mentor tidak ditemukan');
  }
  const mentorData = mentorDoc.data() as UserDocument;

  const assignmentId = generateAssignmentId(studentId, phase);
  const now = new Date().toISOString();

  const assignment: AssignmentDocument = {
    id: assignmentId,
    studentId,
    classId,
    phase,
    mentorId,
    mentorName: mentorData.name,
    studentName: studentData.name,
    updatedAt: now,
  };

  await db.collection('assignments').doc(assignmentId).set(assignment);
}

/**
 * Mengambil assignment mentor seorang siswa untuk fase tertentu.
 *
 * Retrieves a student's mentor assignment for a specific phase.
 */
export async function getStudentAssignment(studentId: string, phase: Phase): Promise<AssignmentDocument | null> {
  const db = getAdminDb();
  const assignmentId = generateAssignmentId(studentId, phase);
  const doc = await db.collection('assignments').doc(assignmentId).get();
  if (!doc.exists) return null;
  return doc.data() as AssignmentDocument;
}

/**
 * Mengambil daftar seluruh siswa yang dibimbing oleh seorang mentor pada fase tertentu.
 *
 * Retrieves all students assigned to a mentor for a specific phase.
 */
export async function listStudentsForMentor(mentorId: string, phase: Phase): Promise<AssignmentDocument[]> {
  const db = getAdminDb();
  const snapshot = await db.collection('assignments')
    .where('mentorId', '==', mentorId)
    .where('phase', '==', phase)
    .get();

  return snapshot.docs.map((doc) => doc.data() as AssignmentDocument);
}

/**
 * Mengambil daftar penugasan siswa di satu kelas untuk tinjauan admin.
 *
 * Retrieves student assignment list in a class for admin review.
 */
export async function listClassStudentsWithAssignment(
  classId: string,
  phase: Phase
): Promise<{ student: UserDocument; assignment: AssignmentDocument | null }[]> {
  const db = getAdminDb();

  // Ambil semua siswa di kelas ini / Fetch all students in this class
  const studentsSnap = await db.collection('users')
    .where('classId', '==', classId)
    .where('role', '==', 'student')
    .where('active', '==', true)
    .get();

  const students = studentsSnap.docs.map((d) => d.data() as UserDocument);

  // Ambil assignment mereka / Fetch their assignments
  return Promise.all(
    students.map(async (student) => {
      const assignment = await getStudentAssignment(student.uid, phase);
      return { student, assignment };
    })
  );
}
