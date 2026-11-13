// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeDb, reset, selects } from './careers-fake-db';

const getSnapshot = vi.fn();
const getSessionActor = vi.fn();
vi.mock('../../src/lib/firebase/admin', () => ({ getAdminDb: () => fakeDb }));
vi.mock('../../src/features/dashboard/snapshot-service', () => ({ getSnapshot: (a: unknown) => getSnapshot(a) }));
vi.mock('../../src/features/auth/session', () => ({ getSessionActor: () => getSessionActor() }));

import { exportApplicants } from '../../src/features/careers/export-service';
import { GET } from '../../src/app/api/karier/export/route';

const admin = { uid: 'adm', role: 'admin', name: 'Admin' } as never;
const app = (studentId: string, jobId: string, over: Record<string, unknown> = {}) => ({
  studentId, jobId, cvId: `cv-${studentId}`, personal: { fullName: `Nama ${studentId}`, email: `${studentId}@x.id`, phone: '08' }, answers: { q: 'panjang' }, ...over,
});

beforeEach(() => {
  reset({
    jobs: { j1: { title: 'Web Developer', partnerName: 'Ioda' }, j2: { title: 'Social Media', partnerName: 'Dynamic Buzz' }, j3: { title: 'Lain', partnerName: 'X' } },
    jobApplications: {
      a1: app('s1', 'j1', { interview: { date: '2026-11-13', start: '10:00', durationMin: 45 } }),
      a2: app('s2', 'j2'),
      a3: app('s3', 'j3'),
    },
  });
  getSnapshot.mockResolvedValue({ ranking: [{ studentId: 's1', capstone: 85, pending: [] }, { studentId: 's2', capstone: 0, pending: ['capstone'] }] });
  getSessionActor.mockResolvedValue({ uid: 'adm', role: 'admin' });
});

describe('ekspor pelamar beberapa lowongan', () => {
  it('satu tabel berisi pelamar dari lowongan terpilih saja, dengan kolom yang diminta', async () => {
    const rows = await exportApplicants(admin, ['j1', 'j2']);
    expect(rows).toEqual([
      // Urut menurut perusahaan, lalu role, lalu nama / Ordered by company, then role, then name
      { name: 'Nama s2', email: 's2@x.id', capstone: null, cvId: 'cv-s2', role: 'Social Media', company: 'Dynamic Buzz', interview: null },
      { name: 'Nama s1', email: 's1@x.id', capstone: 85, cvId: 'cv-s1', role: 'Web Developer', company: 'Ioda', interview: { date: '2026-11-13', start: '10:00', durationMin: 45 } },
    ]);
    expect(selects.jobApplications.flat()).not.toContain('answers');
  });

  it('daftar lowongan wajib diisi dan hanya admin yang boleh', async () => {
    await expect(exportApplicants(admin, [])).rejects.toThrow('Pilih minimal satu lowongan');
    getSessionActor.mockResolvedValue({ uid: 'u1', role: 'student' });
    expect((await GET(new Request('http://x/api/karier/export?jobs=j1'))).status).toBe(403);
  });
});
