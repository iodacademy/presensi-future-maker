// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Firestore dan Storage palsu dalam memori.
// In-memory fake Firestore and Storage.
const store = new Map<string, Record<string, unknown>>();
const files = new Map<string, Buffer>();
const doc = (path: string) => ({
  path,
  get: async () => ({ exists: store.has(path), data: () => store.get(path) }),
});
vi.mock('../../src/lib/firebase/admin', () => ({
  getAdminDb: () => ({
    collection: (c: string) => ({
      doc: (id: string) => doc(`${c}/${id}`),
      where: () => ({ get: async () => ({ docs: [] }) }),
    }),
    runTransaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        get: (r: { get: () => unknown }) => r.get(),
        set: (r: { path: string }, d: Record<string, unknown>) => void store.set(r.path, { ...d }),
        update: (r: { path: string }, d: Record<string, unknown>) => void store.set(r.path, { ...store.get(r.path), ...d }),
      }),
  }),
  getAdminStorage: () => ({
    bucket: () => ({
      file: (p: string) => ({
        save: async (b: Buffer) => void files.set(p, b),
        delete: async () => void files.delete(p),
        download: async () => [files.get(p)!],
      }),
    }),
  }),
}));
vi.mock('../../src/features/mentoring/service', () => ({
  isMenteeOf: async (mentorId: string) => mentorId === 'mentorA',
}));

import { readSubmissionFile, uploadSubmissionFile, validateSubmissionFile } from '../../src/features/tasks/submission-file';
import { submitTask } from '../../src/features/tasks/submission-service';
import { isLostSubmissionFile, isStoredSubmissionFile } from '../../src/features/tasks/submission-policy';

const student = { uid: 's1', email: 's@x.id', name: 'Ani', role: 'student' as const, classId: 'k1' };

beforeEach(() => {
  store.clear();
  files.clear();
  store.set('tasks/t1', { id: 't1', classId: 'k1', kind: 'working-paper', title: 'Praktik 1', dueAt: '2000-01-01T00:00:00.000Z' });
  store.set('classes/k1', { canonicalName: 'Kelas 1' });
});

describe('unggahan berkas tugas', () => {
  it('menerima jenis kantor umum dan menolak yang lain atau terlalu besar', () => {
    expect(validateSubmissionFile({ fileName: 'Laporan.XLSX', size: 1000 })).toBe('xlsx');
    expect(() => validateSubmissionFile({ fileName: 'virus.exe', size: 1000 })).toThrow(/tidak didukung/);
    expect(() => validateSubmissionFile({ fileName: 'besar.pdf', size: 11 * 1024 * 1024 })).toThrow(/maksimal 10 MB/);
  });

  it('menyimpan berkas di Storage lalu mencatatnya sebagai pengumpulan', async () => {
    const saved = await uploadSubmissionFile(student, 't1', { buffer: Buffer.from('isi'), fileName: 'laporan/../akhir.pdf' });
    expect(isStoredSubmissionFile(saved.fileId)).toBe(true);
    expect(saved.fileId).toMatch(/^submissions\/k1\/t1\/s1\/[0-9a-f-]+\.pdf$/);
    expect(saved.fileName).toBe('laporan_.._akhir.pdf');
    expect(files.has(saved.fileId!)).toBe(true);
  });

  it('menolak berkas yang menunjuk folder peserta lain', async () => {
    await expect(submitTask(student, { taskId: 't1', fileId: 'submissions/k1/t1/s2/x.pdf', fileName: 'x.pdf', url: null })).rejects.toThrow(/tidak sah/);
  });

  it('mempertahankan status tepat waktu saat berkas formulir lama diunggah ulang', async () => {
    // Tenggatnya sudah lewat, tetapi pengumpulan pertama tercatat tepat waktu.
    // The deadline has passed, but the first submission was on time.
    store.set('submissions/t1_s1', { id: 't1_s1', taskId: 't1', studentId: 's1', fileId: 'local-file-123', fileName: 'praktik.pdf', url: null, late: false, score: null, version: 1, submittedAt: '1999-12-31T00:00:00.000Z', firstSubmittedAt: '1999-12-31T00:00:00.000Z' });
    expect(isLostSubmissionFile('local-file-123')).toBe(true);
    const saved = await uploadSubmissionFile(student, 't1', { buffer: Buffer.from('isi'), fileName: 'praktik.pdf' });
    expect(saved.late).toBe(false);
    expect(saved.firstSubmittedAt).toBe('1999-12-31T00:00:00.000Z');
  });
});

describe('membuka berkas pengumpulan', () => {
  beforeEach(() => {
    store.set('submissions/t1_s1', { id: 't1_s1', studentId: 's1', fileId: 'submissions/k1/t1/s1/a.pdf', fileName: 'a.pdf' });
    files.set('submissions/k1/t1/s1/a.pdf', Buffer.from('pdf'));
  });

  it('terbuka bagi admin, pesertanya, dan mentornya', async () => {
    await expect(readSubmissionFile({ ...student, role: 'admin', uid: 'ad' }, 't1_s1')).resolves.toMatchObject({ contentType: 'application/pdf', fileName: 'a.pdf' });
    await expect(readSubmissionFile(student, 't1_s1')).resolves.toBeTruthy();
    await expect(readSubmissionFile({ ...student, role: 'mentor', uid: 'mentorA' }, 't1_s1')).resolves.toBeTruthy();
  });

  it('tertutup bagi peserta lain dan mentor lain', async () => {
    await expect(readSubmissionFile({ ...student, uid: 's2' }, 't1_s1')).rejects.toThrow(/tidak berhak/);
    await expect(readSubmissionFile({ ...student, role: 'mentor', uid: 'mentorB' }, 't1_s1')).rejects.toThrow(/tidak berhak/);
  });
});
