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
    // Kurang mentor / Missing mentor
    expect(
      canActivateClass({
        status: 'draft',
        mentorCount: 0,
        dailyTaskCount: 2,
        capstoneTaskCount: 1,
      }).canActivate
    ).toBe(false);

    // Kurang tugas harian / Missing daily tasks
    expect(
      canActivateClass({
        status: 'draft',
        mentorCount: 1,
        dailyTaskCount: 0,
        capstoneTaskCount: 1,
      }).canActivate
    ).toBe(false);

    // Kurang capstone / Missing capstone
    expect(
      canActivateClass({
        status: 'draft',
        mentorCount: 1,
        dailyTaskCount: 4,
        capstoneTaskCount: 0,
      }).canActivate
    ).toBe(false);

    // Lebih dari 1 capstone / More than 1 capstone
    expect(
      canActivateClass({
        status: 'draft',
        mentorCount: 1,
        dailyTaskCount: 4,
        capstoneTaskCount: 2,
      }).canActivate
    ).toBe(false);

    // Siap aktivasi / Ready to activate
    expect(
      canActivateClass({
        status: 'draft',
        mentorCount: 2,
        dailyTaskCount: 4,
        capstoneTaskCount: 1,
      }).canActivate
    ).toBe(true);
  });

  it('determines if Capstone is unlocked for a student', () => {
    const required = ['task-1', 'task-2', 'task-3', 'task-4'];

    // Baru kumpul 3 dari 4 / Only 3 of 4 submitted
    expect(isCapstoneUnlocked(required, ['task-1', 'task-2', 'task-3'])).toBe(false);

    // Sudah kumpul semua 4 / All 4 submitted
    expect(isCapstoneUnlocked(required, ['task-1', 'task-2', 'task-3', 'task-4'])).toBe(true);

    // Syarat kosong tidak membuka capstone / Empty requirements do not unlock
    expect(isCapstoneUnlocked([], [])).toBe(false);
  });
});
