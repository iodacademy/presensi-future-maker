import { describe, it, expect } from 'vitest';
import {
  generateAssignmentId,
  isValidPhase,
  validateAssignmentInput,
} from '../../src/features/assignments/policy';

describe('Assignments Policy', () => {
  it('validates phase enums', () => {
    expect(isValidPhase('bootcamp')).toBe(true);
    expect(isValidPhase('internship')).toBe(true);
    expect(isValidPhase('magang')).toBe(false); // harus dinormalisasi sebelum diproses
    expect(isValidPhase('other')).toBe(false);
  });

  it('generates consistent deterministic assignment ID', () => {
    const id1 = generateAssignmentId('student-123', 'bootcamp');
    const id2 = generateAssignmentId('student-123', 'bootcamp');
    const idIntern = generateAssignmentId('student-123', 'internship');
    expect(id1).toBe('student-123_bootcamp');
    expect(id1).toBe(id2);
    expect(id1).not.toBe(idIntern);
  });

  it('validates assignment input fields', () => {
    expect(() =>
      validateAssignmentInput({
        studentId: '',
        classId: 'c1',
        mentorId: 'm1',
        phase: 'bootcamp',
      })
    ).toThrowError(/Data penugasan mentor tidak lengkap/);

    expect(() =>
      validateAssignmentInput({
        studentId: 's1',
        classId: 'c1',
        mentorId: 'm1',
        phase: 'invalid' as any,
      })
    ).toThrowError(/Fase tidak valid/);

    const valid = validateAssignmentInput({
      studentId: ' s1 ',
      classId: ' c1 ',
      mentorId: ' m1 ',
      phase: 'bootcamp',
    });
    expect(valid.studentId).toBe('s1');
    expect(valid.phase).toBe('bootcamp');
  });
});
