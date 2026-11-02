// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { data, fakeDb, fakeStorage, reset } from './careers-fake-db';

const getSessionActor = vi.fn();
vi.mock('../../src/features/auth/session', () => ({ getSessionActor: () => getSessionActor() }));
vi.mock('../../src/lib/firebase/admin', () => ({ getAdminDb: () => fakeDb, getAdminStorage: () => fakeStorage }));

import { submitApplication } from '../../src/features/careers/apply-service';
import { POST as lamarPost } from '../../src/app/api/karier/lamar/route';

const now = new Date('2026-11-05T00:00:00Z');
const actor = (uid: string, classId = 'k1') => ({ uid, role: 'student', classId }) as never;
const job = {
  partnerId: 'p1', partnerName: 'PT DIPSI', title: 'UI/UX Intern', employment: 'magang-3', category: 'desain', location: 'Jakarta',
  workMode: 'hybrid', quota: 2, description: '', qualifications: [], eligibility: { mode: 'all' },
  opensAt: '2026-11-03T01:00:00.000Z', closesAt: '2026-11-12T16:59:00.000Z',
  documents: { portfolio: 'optional', works: 'optional', coverLetter: 'off' },
  questions: [{ id: 'q1', label: 'Kenapa?', kind: 'long', options: [], required: true }], status: 'published', applicantCount: 0,
};
const personal = { fullName: 'Andi Pratama', email: 'andi@x.id', phone: '0812', city: 'Semarang', school: 'SMK 1', major: 'RPL', linkedin: '' };
const body = (over: Record<string, unknown> = {}) => ({ jobId: 'j1', personal, cvId: 'cv1', workIds: ['w1'], submissionIds: ['t1_u1'], answers: { q1: 'Suka' }, ...over });

beforeEach(() => {
  reset({
    jobs: { j1: job, j2: { ...job, eligibility: { mode: 'classes', classIds: ['k9'] } } },
    jobApplications: {},
    counters: {},
    careerProfiles: {},
    studentCvs: {
      cv1: { ownerUid: 'u1', kind: 'cv', fileName: 'CV Andi.pdf', deleted: false, uploadedAt: '1' },
      cv2: { ownerUid: 'u2', kind: 'cv', fileName: 'CV Budi.pdf', deleted: false, uploadedAt: '1' },
    },
    exhibitionWorks: {
      w1: { personUid: 'u1', status: 'published', title: 'Griya', type: 'Capstone', cover: { thumb: 'https://x/c.webp' } },
      w9: { personUid: 'u2', status: 'published', title: 'Punya Budi', type: 'TPM', cover: { thumb: '' } },
    },
    submissions: { t1_u1: { studentId: 'u1', taskTitle: 'TPM 1', taskKind: 'daily', fileId: 'submissions/k1/t1/u1/a.pdf', url: null } },
    dashboardSnapshots: { '2026-11-04': { generatedAt: '2026-11-04T01:00:00Z', version: 17, ranking: [{ studentId: 'u1', score: 82, pending: ['capstone'] }] } },
  });
  getSessionActor.mockResolvedValue({ uid: 'u1', role: 'student', classId: 'k1' });
});

describe('kirim lamaran', () => {
  it('lamaran sah tersimpan dengan nomor berurutan dan salinan lampiran', async () => {
    const r = await submitApplication(actor('u1'), body(), now);
    expect(r).toEqual({ id: 'j1_u1', number: 'FM-JOB-0001' });
    expect(data.jobApplications.j1_u1).toMatchObject({
      jobId: 'j1', partnerId: 'p1', studentId: 'u1', classId: 'k1', status: 'baru', rejectReason: '', cvFileName: 'CV Andi.pdf',
      works: [{ id: 'w1', title: 'Griya', type: 'Capstone', cover: 'https://x/c.webp' }],
      tasks: [{ submissionId: 't1_u1', title: 'TPM 1', kind: 'daily', url: '' }],
      finalScore: 82, finalScorePending: true, finalScoreAt: '2026-11-04',
    });
    expect(data.jobs.j1.applicantCount).toBe(1);
    data.studentCvs.cv3 = { ownerUid: 'u3', kind: 'cv', fileName: 'c.pdf', deleted: false, uploadedAt: '1' };
    const r2 = await submitApplication(actor('u3'), body({ cvId: 'cv3', workIds: [], submissionIds: [] }), now);
    expect(r2.number).toBe('FM-JOB-0002');
    expect(data.jobs.j1.applicantCount).toBe(2);
  });

  it('data diri disimpan untuk lamaran berikutnya', async () => {
    await submitApplication(actor('u1'), body(), now);
    expect(data.careerProfiles.u1).toMatchObject({ city: 'Semarang', school: 'SMK 1', major: 'RPL' });
  });

  it('melamar dua kali ditolak dan jumlah pelamar tidak bertambah', async () => {
    await submitApplication(actor('u1'), body(), now);
    await expect(submitApplication(actor('u1'), body(), now)).rejects.toThrow('Kamu sudah melamar lowongan ini');
    expect(data.jobs.j1.applicantCount).toBe(1);
  });

  it('lowongan yang sudah tutup ditolak', async () => {
    await expect(submitApplication(actor('u1'), body(), new Date('2026-11-13T00:00:00Z'))).rejects.toThrow('Lowongan sudah ditutup');
  });

  it('CV dan karya milik orang lain ditolak', async () => {
    await expect(submitApplication(actor('u1'), body({ cvId: 'cv2' }), now)).rejects.toThrow('CV tidak ditemukan');
    await expect(submitApplication(actor('u1'), body({ workIds: ['w9'] }), now)).rejects.toThrow('Lampiran bukan milikmu');
  });

  it('siswa yang tidak memenuhi syarat ditolak', async () => {
    await expect(submitApplication(actor('u1'), body({ jobId: 'j2' }), now)).rejects.toThrow('Kamu belum memenuhi syarat lowongan ini');
  });

  it('mentor tidak bisa memakai rute lamaran', async () => {
    getSessionActor.mockResolvedValue({ uid: 'm1', role: 'mentor' });
    const res = await lamarPost(new Request('http://x', { method: 'POST', body: JSON.stringify(body()) }));
    expect(res.status).toBe(403);
  });
});
