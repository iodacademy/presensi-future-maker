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

  // Satu kueri untuk seluruh penugasan kelas ini, bukan satu pembacaan per
  // siswa. Satu angkatan berisi puluhan peserta, sehingga pembacaan per baris
  // mengulang perjalanan yang sama berkali-kali pada halaman yang paling sering
  // dibuka saat menyusun mentoring.
  //
  // One query for the whole class's assignments rather than a read per student.
  // A cohort holds dozens of participants, so per-row reads repeat the same
  // round trip many times over on the page most used while arranging mentoring.
  const assignmentsSnap = await db
    .collection('assignments')
    .where('classId', '==', classId)
    .where('phase', '==', phase)
    .get();

  const byStudent = new Map<string, AssignmentDocument>();
  for (const doc of assignmentsSnap.docs) {
    const a = doc.data() as AssignmentDocument;
    byStudent.set(a.studentId, a);
  }

  return students.map((student) => ({
    student,
    assignment: byStudent.get(student.uid) ?? null,
  }));
}

/**
 * Menugaskan satu mentor kepada beberapa siswa sekaligus.
 *
 * Tiap penugasan divalidasi sendiri-sendiri dan kegagalannya dikumpulkan, bukan
 * menghentikan seluruh proses: satu siswa yang kelasnya berubah di tengah jalan
 * tidak seharusnya membatalkan penugasan delapan belas siswa lainnya.
 *
 * Assigns one mentor to several students at once.
 *
 * Each assignment is validated on its own and failures are collected rather
 * than halting the run: one student whose class changed midway should not undo
 * the assignment of the other eighteen.
 */
export async function assignMentorToStudents(
  actor: Actor,
  input: { classId: string; mentorId: string; phase: Phase; studentIds: string[] }
): Promise<{ assigned: number; failures: { studentId: string; reason: string }[] }> {
  if (actor.role !== 'admin') {
    throw new Error('Hanya admin yang diizinkan menugaskan mentor');
  }

  if (input.studentIds.length === 0) {
    throw new Error('Pilih minimal satu peserta');
  }

  const failures: { studentId: string; reason: string }[] = [];
  let assigned = 0;

  for (const studentId of input.studentIds) {
    try {
      await assignMentorToStudent(actor, {
        studentId,
        classId: input.classId,
        mentorId: input.mentorId,
        phase: input.phase,
      });
      assigned += 1;
    } catch (err) {
      failures.push({ studentId, reason: (err as Error).message });
    }
  }

  return { assigned, failures };
}
