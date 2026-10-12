// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

// Firestore palsu: tiap koleksi mengembalikan isi yang sudah disaring.
// Fake Firestore: each collection returns pre-filtered contents.
const data: Record<string, object[]> = {
  tasks: [
    { id: 't2', title: 'Tugas 2', kind: 'daily', order: 2, dueAt: null, published: true },
    { id: 't1', title: 'Tugas 1', kind: 'daily', order: 1, dueAt: '2026-10-01T16:59:00.000Z', published: true },
    { id: 't3', title: 'Draf', kind: 'daily', order: 3, dueAt: null, published: false },
  ],
  submissions: [
    { taskId: 't1', studentId: 'a', score: 90, late: false },
    { taskId: 't1', studentId: 'b', score: null, late: true },
    { taskId: 't2', studentId: 'a', score: null, late: false },
  ],
};
vi.mock('../../src/lib/firebase/admin', () => ({
  getAdminDb: () => ({
    collection: (name: string) => {
      const query = {
        where: () => query,
        select: () => query,
        get: async () => ({ docs: (data[name] ?? []).map((d) => ({ data: () => d })) }),
        count: () => ({ get: async () => ({ data: () => ({ count: 30 }) }) }),
      };
      return query;
    },
  }),
}));

import { listClassTaskSummary } from '../../src/features/tasks/submission-service';

const admin = { uid: 'x', email: 'a@x.id', name: 'Admin', role: 'admin' as const, classId: null };

describe('ringkasan pengumpulan per tugas', () => {
  it('menghitung terkumpul, dinilai, dan terlambat per tugas, urut nomornya', async () => {
    const r = await listClassTaskSummary(admin, 'k1');
    expect(r.studentCount).toBe(30);
    expect(r.tasks.map((t) => [t.id, t.submitted, t.graded, t.late, t.published])).toEqual([
      ['t1', 2, 1, 1, true],
      ['t2', 1, 0, 0, true],
      ['t3', 0, 0, 0, false],
    ]);
  });

  it('hanya untuk admin', async () => {
    await expect(listClassTaskSummary({ ...admin, role: 'student' }, 'k1')).rejects.toThrow(/admin/);
  });
});
