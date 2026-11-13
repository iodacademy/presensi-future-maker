// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeDb, reset, selects } from './careers-fake-db';

const getSnapshot = vi.fn();
vi.mock('../../src/lib/firebase/admin', () => ({ getAdminDb: () => fakeDb }));
vi.mock('../../src/features/dashboard/snapshot-service', () => ({ getSnapshot: (a: unknown) => getSnapshot(a) }));

import { portalInsights } from '../../src/features/careers/insights-service';

const admin = { uid: 'adm', role: 'admin', name: 'Admin' } as never;
const rank = (studentId: string, className: string, placement: string) => ({ studentId, studentName: `Peserta ${studentId}`, className, city: '', placement });

beforeEach(() => {
  reset({
    classes: { wp: { canonicalName: 'Web Programming - Semarang' }, dm: { canonicalName: 'Digital Marketing - Surabaya' }, demo: { canonicalName: 'Demo' } },
    partners: { p1: { name: 'PT A', pics: [{ name: 'Rina', email: 'rina@a.id', phone: '1' }, { name: 'Budi', email: 'budi@a.id', phone: '2' }] } },
    jobs: {
      j1: { title: 'Web Dev', partnerId: 'p1', partnerName: 'PT A', scheme: 'full', quota: 2, status: 'published', picEmail: 'budi@a.id', eligibility: { mode: 'classes', classIds: ['wp'] } },
      j2: { title: 'Admin', partnerId: 'p1', partnerName: 'PT A', scheme: 'project', quota: 1, status: 'published', eligibility: { mode: 'all' } },
      draf: { title: 'Draf', partnerId: 'p1', partnerName: 'PT A', scheme: 'full', quota: 9, status: 'draft', eligibility: { mode: 'all' } },
      demo: { title: 'Demo', partnerId: 'p1', partnerName: 'PT A', scheme: 'full', quota: 9, status: 'published', eligibility: { mode: 'classes', classIds: ['demo'] } },
    },
    jobApplications: {
      a1: { studentId: 's1', jobId: 'j1', status: 'interview', submittedAt: '2026-11-10T00:00:00Z', interview: { date: '2026-11-13', start: '10:00', durationMin: 30, confirmation: 'hadir', interviewer: 'Budi', url: 'https://meet' } },
      a2: { studentId: 's1', jobId: 'demo', status: 'baru', submittedAt: '2026-11-10T00:00:00Z' },
    },
  });
  getSnapshot.mockResolvedValue({ ranking: [rank('s1', 'Web Programming - Semarang', 'full'), rank('s2', 'Digital Marketing - Surabaya', 'project'), rank('s3', 'Digital Marketing - Surabaya', 'none')] });
});

describe('data ringkasan Job Portal', () => {
  it('hanya lowongan terbit yang bukan demo, dengan jurusan dan PIC lowongannya', async () => {
    const x = await portalInsights(admin);
    expect(x.jobs).toEqual([
      { id: 'j1', title: 'Web Dev', partnerId: 'p1', partnerName: 'PT A', picName: 'Budi', scheme: 'full', quota: 2, programs: ['Web Programming'] },
      { id: 'j2', title: 'Admin', partnerId: 'p1', partnerName: 'PT A', picName: 'Rina', scheme: 'project', quota: 1, programs: [] },
    ]);
    expect(x.programs).toEqual(['Digital Marketing', 'Web Programming']);
  });

  it('hanya peserta yang berhak magang, dengan lamaran ke lowongan sungguhan beserta jadwal interviewnya', async () => {
    const x = await portalInsights(admin);
    expect(x.students.map((s) => [s.studentId, s.program, s.placement, s.apps.map((a) => a.jobId)])).toEqual([
      ['s1', 'Web Programming', 'full', ['j1']],
      ['s2', 'Digital Marketing', 'project', []],
    ]);
    expect(x.students[0].apps[0].interview).toEqual({ date: '2026-11-13', start: '10:00', durationMin: 30, confirmation: 'hadir', interviewer: 'Budi' });
  });

  it('lamaran dibaca tanpa data pribadi dan isian panjang', async () => {
    await portalInsights(admin);
    const fields = selects.jobApplications.flat();
    expect(fields).not.toContain('personal');
    expect(fields).not.toContain('answers');
    expect(fields).not.toContain('interview');
  });

  it('menyertakan dokumen penerimaan terbaru yang belum dihapus', async () => {
    const db = (await import('./careers-fake-db')).data;
    db.studentCvs = {
      d1: { ownerUid: 's1', kind: 'penerimaan', fileName: 'LoA lama.pdf', uploadedAt: '2026-11-12T00:00:00Z', deleted: false },
      d2: { ownerUid: 's1', kind: 'penerimaan', fileName: 'LoA.pdf', uploadedAt: '2026-11-13T00:00:00Z', deleted: false },
      d3: { ownerUid: 's2', kind: 'penerimaan', fileName: 'hapus.pdf', uploadedAt: '2026-11-13T00:00:00Z', deleted: true },
      c1: { ownerUid: 's2', kind: 'cv', fileName: 'CV.pdf', uploadedAt: '2026-11-13T00:00:00Z', deleted: false },
    };
    const x = await portalInsights(admin);
    expect(x.students.map((s) => s.acceptanceDoc?.fileName ?? null)).toEqual(['LoA.pdf', null]);
  });
});

