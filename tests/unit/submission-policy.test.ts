import { describe, it, expect } from 'vitest';
import {
  validateSubmissionInput,
  isSubmissionLate,
  canReplaceSubmission,
  validateGradeInput,
  MAX_FILE_SIZE_BYTES,
} from '../../src/features/tasks/submission-policy';

describe('Submission Policy', () => {
  it('enforces exactly one submission source (either file or URL, not both, not empty)', () => {
    // Kosong keduanya / Both empty
    expect(() => validateSubmissionInput({ fileId: '', url: '' })).toThrowError(
      /Pilih salah satu: unggah file atau cantumkan tautan/
    );

    // Keduanya diisi / Both provided
    expect(() =>
      validateSubmissionInput({
        fileId: 'file-123',
        url: 'https://drive.google.com/test',
      })
    ).toThrowError(/Hanya boleh memilih salah satu/);

    // URL tidak HTTPS / Non-HTTPS URL
    expect(() =>
      validateSubmissionInput({
        fileId: '',
        url: 'http://insecure-link.com',
      })
    ).toThrowError(/Tautan harus berupa URL HTTPS/);

    // File saja ditolak: formulir lama hanya mengirim nama file tanpa berkas.
    // A file alone is refused: the old form sent only a file name, no file.
    expect(() => validateSubmissionInput({ fileId: 'file-123', url: '' })).toThrowError(/berupa tautan/);

    // Valid URL
    const withUrl = validateSubmissionInput({
      fileId: '',
      url: 'https://github.com/user/project',
    });
    expect(withUrl.sourceType).toBe('url');
    expect(withUrl.url).toBe('https://github.com/user/project');
  });

  it('determines if submission is late based on UTC timestamps', () => {
    const dueAt = '2026-09-30T16:59:59.000Z'; // 23:59:59 WIB

    // Tepat pada deadline tidak terlambat / Exact deadline is on time
    expect(isSubmissionLate(dueAt, dueAt)).toBe(false);

    // Sebelum deadline / Before deadline
    expect(isSubmissionLate('2026-09-30T10:00:00.000Z', dueAt)).toBe(false);

    // Setelah deadline lewat / After deadline passed
    expect(isSubmissionLate('2026-09-30T17:00:00.000Z', dueAt)).toBe(true);

    // Tanpa deadline / No due date set
    expect(isSubmissionLate('2026-10-01T00:00:00.000Z', null)).toBe(false);
  });

  it('allows replacement before graded and forbids after graded', () => {
    expect(canReplaceSubmission(null)).toBe(true); // Belum dinilai / Not graded yet
    expect(canReplaceSubmission(85)).toBe(false); // Sudah dinilai 85 / Graded 85
    expect(canReplaceSubmission(0)).toBe(false); // Nilai 0 tetap nilai sah / Score 0 is valid score
  });

  it('validates grading score (integer 0 to 100)', () => {
    expect(() => validateGradeInput({ score: -1, feedback: 'Feedback' })).toThrowError(
      /Nilai harus antara 0 dan 100/
    );
    expect(() => validateGradeInput({ score: 101, feedback: 'Feedback' })).toThrowError(
      /Nilai harus antara 0 dan 100/
    );
    expect(() => validateGradeInput({ score: 85.5, feedback: 'Feedback' })).toThrowError(
      /Nilai harus berupa bilangan bulat/
    );

    const validZero = validateGradeInput({ score: 0, feedback: 'Perlu revisi' });
    expect(validZero.score).toBe(0);

    const validHundred = validateGradeInput({ score: 100, feedback: 'Sempurna' });
    expect(validHundred.score).toBe(100);
  });

  it('verifies max file size constant is 10 MiB', () => {
    expect(MAX_FILE_SIZE_BYTES).toBe(10 * 1024 * 1024);
  });
});
