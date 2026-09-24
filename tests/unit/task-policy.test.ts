import { describe, it, expect } from 'vitest';
import {
  validateTaskInput,
  canActivateClass,
  isCapstoneUnlocked,
} from '../../src/features/tasks/policy';

describe('Tasks Policy', () => {
  it('validates task authoring input', () => {
    expect(() =>
      validateTaskInput({
        classId: 'c1',
        title: '',
        kind: 'daily',
        description: 'Desc',
        order: 1,
      })
    ).toThrowError(/Judul tugas wajib diisi/);

    expect(() =>
      validateTaskInput({
        classId: 'c1',
        title: 'Tugas 1',
        kind: 'invalid' as any,
        description: 'Desc',
        order: 1,
      })
    ).toThrowError(/Jenis tugas harus daily atau capstone/);

    expect(() =>
      validateTaskInput({
        classId: 'c1',
        title: 'Tugas 1',
        kind: 'daily',
        description: 'Desc',
        briefUrl: 'http://insecure-link.com',
        order: 1,
      })
    ).toThrowError(/Tautan brief harus berupa URL HTTPS yang valid/);

    const valid = validateTaskInput({
      classId: 'c1',
      title: ' Tugas 1 - Intro ',
      kind: 'daily',
      description: ' Deskripsi tugas ',
      briefUrl: 'https://drive.google.com/brief1.pdf',
      order: 1,
    });
    expect(valid.title).toBe('Tugas 1 - Intro');
    expect(valid.briefUrl).toBe('https://drive.google.com/brief1.pdf');
  });

  it('checks class activation requirements', () => {
    // Hanya jadwal yang diwajibkan. Mentor, tugas harian, dan Capstone disusun
    // selama program berjalan, sehingga menuntutnya di muka menahan peserta
    // dari melihat jadwal yang sudah pasti.
    //
    // Only the schedule is required. Mentors, daily tasks, and the Capstone are
    // assembled as the programme runs, so demanding them upfront keeps
    // participants from seeing a schedule that is already settled.
    expect(canActivateClass({ status: 'draft', sessionCount: 0 }).canActivate).toBe(false);
    expect(canActivateClass({ status: 'draft', sessionCount: 1 }).canActivate).toBe(true);
    expect(canActivateClass({ status: 'draft', sessionCount: 13 }).canActivate).toBe(true);

    // Kelas yang sudah aktif atau diarsipkan tidak diaktifkan ulang.
    // An already-active or archived class is not reactivated.
    expect(canActivateClass({ status: 'active', sessionCount: 13 }).canActivate).toBe(false);
    expect(canActivateClass({ status: 'archived', sessionCount: 13 }).canActivate).toBe(false);
  });

  it('determines if Capstone is unlocked for a student', () => {
    const required = ['task-1', 'task-2', 'task-3', 'task-4'];

    // Baru kumpul 3 dari 4 / Only 3 of 4 submitted
    expect(isCapstoneUnlocked(required, ['task-1', 'task-2', 'task-3'])).toBe(false);

    // Sudah kumpul semua 4 / All 4 submitted
    expect(isCapstoneUnlocked(required, ['task-1', 'task-2', 'task-3', 'task-4'])).toBe(true);

    // Tanpa tugas harian, tidak ada yang perlu diselesaikan lebih dulu sehingga
    // Capstone terbuka. Mengunci di sini akan menutup Capstone selamanya pada
    // kelas yang diaktifkan sebelum tugasnya disusun -- keadaan yang tidak
    // dapat dipulihkan peserta maupun admin.
    //
    // With no daily tasks there is nothing to finish first, so the Capstone is
    // open. Locking here would shut the Capstone permanently on a class
    // activated before its tasks were written -- a state neither participant
    // nor admin could recover from.
    expect(isCapstoneUnlocked([], [])).toBe(true);

    // Tugas yang belum tercatat di snapshot tidak menghalangi / A task absent
    // from the snapshot does not block
    expect(isCapstoneUnlocked(['task-1'], ['task-1', 'task-baru'])).toBe(true);
  });
});
