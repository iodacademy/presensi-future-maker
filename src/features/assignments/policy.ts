// Aturan assignment mentor dan fase / Mentor assignment and phase policy
import type { Phase, AssignMentorInput } from './types';

/**
 * Memvalidasi apakah fase yang diberikan valid.
 *
 * Validates if the given phase is valid.
 */
export function isValidPhase(phase: string): phase is Phase {
  return phase === 'bootcamp' || phase === 'internship';
}

/**
 * Menghasilkan ID unik deterministik untuk assignment: ${studentId}_${phase}
 *
 * Generates deterministic unique assignment ID: ${studentId}_${phase}
 */
export function generateAssignmentId(studentId: string, phase: Phase): string {
  return `${studentId.trim()}_${phase.trim()}`;
}

/**
 * Memvalidasi input penugasan mentor.
 *
 * Validates mentor assignment input.
 */
export function validateAssignmentInput(input: AssignMentorInput): {
  studentId: string;
  classId: string;
  mentorId: string;
  phase: Phase;
} {
  const studentId = input.studentId ? input.studentId.trim() : '';
  const classId = input.classId ? input.classId.trim() : '';
  const mentorId = input.mentorId ? input.mentorId.trim() : '';
  const phase = input.phase;

  if (!studentId || !classId || !mentorId) {
    throw new Error('Data penugasan mentor tidak lengkap / Incomplete assignment input');
  }

  if (!isValidPhase(phase)) {
    throw new Error('Fase tidak valid (harus bootcamp atau internship) / Invalid phase');
  }

  return {
    studentId,
    classId,
    mentorId,
    phase,
  };
}
