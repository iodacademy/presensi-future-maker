// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { data, fakeDb, fakeStorage, reset } from './careers-fake-db';

const getSessionActor = vi.fn();
vi.mock('../../src/features/auth/session', () => ({ getSessionActor: () => getSessionActor() }));
vi.mock('next/cache', () => ({ unstable_cache: (fn: () => unknown) => fn }));
vi.mock('../../src/lib/firebase/admin', () => ({ getAdminDb: () => fakeDb, getAdminStorage: () => fakeStorage }));

import { markRejectionsSeen, rejectionNotice } from '../../src/features/careers/rejection-notice';
import { GET, POST } from '../../src/app/api/karier/penolakan/route';

const now = new Date('2026-11-05T00:00:00Z');
const andi = { uid: 'u1', role: 'student', classId: 'k1', name: 'Andi', email: 'andi@x.id' } as never;
const job = {
  partnerId: 'p1', partnerName: 'PT DIPSI', title: 'UI/UX Intern', employment: 'magang-3', category: 'desain', scheme: 'project', location: 'Jakarta',
  workMode: 'hybrid', quota: 2, description: '', qualifications: [], eligibility: { mode: 'all' }, salary: null, durationMonths: 2,
  opensAt: '2026-11-03T01:00:00.000Z', closesAt: '2026-11-12T16:59:00.000Z',
  documents: { portfolio: 'optional', works: 'optional', coverLetter: 'off' }, questions: [], status: 'published', applicantCount: 0,
};
const app = (jobId: string, status: string, studentId = 'u1', extra: Record<string, unknown> = {}) => ({ jobId, partnerId: 'p1', studentId, status, scheme: 'project', ...extra });

beforeEach(() => {
  reset({
    settings: { careers: { applicationsOpen: true } },
    partners: { p1: { name: 'PT DIPSI', logo: null } },
    jobs: {
      ditolak: { ...job, title: 'Graphic Designer' },
      sudah: { ...job, title: 'Sudah Dilamar' },
      desain: { ...job, title: 'Desain Konten', closesAt: '2026-11-10T16:59:00.000Z' },
      tekno: { ...job, title: 'Web Proyek', category: 'teknologi', closesAt: '2026-11-08T16:59:00.000Z' },
      penuh: { ...job, title: 'Sudah Penuh', quota: 1 },
      tutup: { ...job, title: 'Sudah Tutup', closesAt: '2026-11-04T00:00:00.000Z' },
    },
    jobApplications: {
      a1: app('ditolak', 'tidak-lolos'),
      a2: app('sudah', 'baru'),
      x1: app('penuh', 'bergabung', 'u9'),
      x2: app('ditolak', 'tidak-lolos', 'u9'),
    },
    users: { u1: { name: 'Andi Pratama', email: 'andi@x.id', classId: 'k1' } },
    dashboardSnapshots: {
      '2026-11-04': { generatedAt: '2026-11-04T01:00:00Z', version: 17, ranking: [{ studentId: 'u1', score: 82, pending: [], placement: 'project' }] },
    },
  });
  getSessionActor.mockResolvedValue({ uid: 'u1', role: 'student', classId: 'k1' });
});

describe('pemberitahuan lamaran tidak lolos di beranda', () => {
  it('menampilkan lamaran yang belum dilihat dan menyarankan lowongan terbuka yang masih ada kursinya', async () => {
    const n = await rejectionNotice(andi, now);
    expect(n.rejections).toEqual([{ id: 'a1', jobTitle: 'Graphic Designer', partnerName: 'PT DIPSI' }]);
    // Bidang yang sama didahulukan; yang sudah dilamar, penuh, atau tutup tidak disarankan
    // Same field first; jobs already applied to, full, or closed are not suggested
    expect(n.suggestions.map((s) => s.id)).toEqual(['desain', 'tekno']);
    expect(n.blocked).toBeNull();
  });

  it('lamaran yang sudah dilihat tidak muncul lagi, dan hanya lamaran milik sendiri yang bisa ditandai', async () => {
    await markRejectionsSeen(andi, ['a1', 'x2', 'a2'], now);
    expect(data.jobApplications.a1.rejectSeenAt).toBe(now.toISOString());
    expect(data.jobApplications.x2.rejectSeenAt).toBeUndefined();
    expect(data.jobApplications.a2.rejectSeenAt).toBeUndefined();
    expect((await rejectionNotice(andi, now)).rejections).toEqual([]);
  });

  it('peserta yang sudah menerima tawaran Full Internship tidak diberi pemberitahuan', async () => {
    data.jobApplications.a3 = { ...app('desain', 'bergabung'), scheme: 'full' };
    expect((await rejectionNotice(andi, now)).rejections).toEqual([]);
  });

  it('jatah lamaran penuh: tidak ada saran, diganti alasannya', async () => {
    data.jobApplications.a4 = app('tekno', 'ditinjau');
    const n = await rejectionNotice(andi, now);
    expect(n.suggestions).toEqual([]);
    expect(n.blocked).toMatch(/Jatah proyekmu sedang penuh/);
  });

  it('rute API hanya untuk peserta dan menandai lamaran sudah dilihat', async () => {
    expect((await (await GET()).json()).rejections).toHaveLength(1);
    await POST(new Request('http://x/api/karier/penolakan', { method: 'POST', body: JSON.stringify({ ids: ['a1'] }) }));
    expect(data.jobApplications.a1.rejectSeenAt).toBeTruthy();
    getSessionActor.mockResolvedValue({ uid: 'r1', role: 'partner', partnerId: 'p1' });
    expect((await GET()).status).toBe(403);
  });
});
