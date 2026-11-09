// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { data, fakeDb, fakeStorage, reset } from './careers-fake-db';

const getSessionActor = vi.fn();
vi.mock('../../src/features/auth/session', () => ({ getSessionActor: () => getSessionActor() }));
vi.mock('next/cache', () => ({ unstable_cache: (fn: () => unknown) => fn }));
vi.mock('../../src/lib/firebase/admin', () => ({ getAdminDb: () => fakeDb, getAdminStorage: () => fakeStorage }));

import { submitApplication } from '../../src/features/careers/apply-service';
import { applicationsOpen, setApplicationsOpen } from '../../src/features/careers/apply-gate';
import { GET as pendaftaranGet, POST as pendaftaranPost } from '../../src/app/api/karier/pendaftaran/route';
import { POST as lamarPost } from '../../src/app/api/karier/lamar/route';

const now = new Date('2026-11-05T00:00:00Z');
const actor = (uid: string, classId = 'k1') => ({ uid, role: 'student', classId }) as never;
const job = {
  partnerId: 'p1', partnerName: 'PT DIPSI', title: 'UI/UX Intern', employment: 'magang-3', category: 'desain', scheme: 'project', location: 'Jakarta',
  workMode: 'hybrid', quota: 2, description: '', qualifications: [], eligibility: { mode: 'all' },
  opensAt: '2026-11-03T01:00:00.000Z', closesAt: '2026-11-12T16:59:00.000Z',
  documents: { portfolio: 'optional', works: 'optional', coverLetter: 'off' },
  questions: [{ id: 'q1', label: 'Kenapa?', kind: 'long', options: [], required: true }], status: 'published', applicantCount: 0,
};
const personal = { fullName: 'Andi Pratama', email: 'andi@x.id', phone: '0812', city: 'Semarang', school: 'SMK 1', major: 'RPL', linkedin: '' };
const body = (over: Record<string, unknown> = {}) => ({ jobId: 'j1', personal, cvId: 'cv1', workIds: ['w1'], submissionIds: ['t1_u1'], answers: { q1: 'Suka' }, ...over });

beforeEach(() => {
  reset({
    jobs: { j1: job, j2: { ...job, eligibility: { mode: 'classes', classIds: ['k9'] } }, j3: { ...job, scheme: 'full' } },
    jobApplications: {},
    counters: {},
    careerProfiles: {},
    settings: { careers: { applicationsOpen: true } },
    studentCvs: {
      cv1: { ownerUid: 'u1', kind: 'cv', fileName: 'CV Andi.pdf', deleted: false, uploadedAt: '1' },
      cv2: { ownerUid: 'u2', kind: 'cv', fileName: 'CV Budi.pdf', deleted: false, uploadedAt: '1' },
    },
    exhibitionWorks: {
      w1: { personUid: 'u1', status: 'published', title: 'Griya', type: 'Capstone', cover: { thumb: 'https://x/c.webp' } },
      w9: { personUid: 'u2', status: 'published', title: 'Punya Budi', type: 'TPM', cover: { thumb: '' } },
    },
    submissions: { t1_u1: { studentId: 'u1', taskTitle: 'TPM 1', taskKind: 'daily', fileId: 'submissions/k1/t1/u1/a.pdf', url: null } },
    dashboardSnapshots: { '2026-11-04': { generatedAt: '2026-11-04T01:00:00Z', version: 17, ranking: [{ studentId: 'u1', score: 82, pending: ['capstone'], placement: 'project' }, { studentId: 'u3', score: 75, pending: [], placement: 'project' }] } },
  });
  getSessionActor.mockResolvedValue({ uid: 'u1', role: 'student', classId: 'k1' });
});

describe('pendaftaran lamaran dibuka dan ditutup admin', () => {
  it('tanpa pengaturan, pendaftaran dianggap belum dibuka', async () => {
    delete data.settings;
    expect(await applicationsOpen()).toBe(false);
    await expect(submitApplication(actor('u1'), body(), now)).rejects.toThrow('Pendaftaran lamaran belum dibuka');
    expect(data.jobApplications.j1_u1).toBeUndefined();
    expect(data.jobs.j1.applicantCount).toBe(0);
  });
  it('admin menutup lalu membuka pendaftaran lewat rute', async () => {
    await setApplicationsOpen(false);
    await expect(submitApplication(actor('u1'), body(), now)).rejects.toThrow('Pendaftaran lamaran belum dibuka');
    getSessionActor.mockResolvedValue({ uid: 'a1', role: 'admin' });
    const res = await pendaftaranPost(new Request('http://x', { method: 'POST', body: JSON.stringify({ open: true }) }));
    expect(await res.json()).toEqual({ open: true });
    expect(await (await pendaftaranGet()).json()).toEqual({ open: true });
    expect((await submitApplication(actor('u1'), body(), now)).number).toBe('FM-JOB-0001');
  });
  it('siswa tidak dapat mengubah pendaftaran', async () => {
    const res = await pendaftaranPost(new Request('http://x', { method: 'POST', body: JSON.stringify({ open: false }) }));
    expect(res.status).toBe(403);
    expect(await applicationsOpen()).toBe(true);
  });
});

describe('satu peserta, satu tempat magang', () => {
  it('peserta yang sudah menerima tawaran tidak bisa melamar lagi', async () => {
    data.jobApplications.j9_u1 = { jobId: 'j9', studentId: 'u1', status: 'bergabung' };
    await expect(submitApplication(actor('u1'), body(), now)).rejects.toThrow('Kamu sudah menerima tawaran magang');
  });
  it('akun demo tetap bisa melamar lowongan demo selama pendaftaran ditutup', async () => {
    delete data.settings;
    data.jobs.jd = { ...job, eligibility: { mode: 'classes', classIds: ['demo'] }, scheme: 'full' };
    data.studentCvs.cvd = { ownerUid: 'ud', kind: 'cv', fileName: 'CV Demo.pdf', deleted: false, uploadedAt: '1' };
    const r = await submitApplication(actor('ud', 'demo'), body({ jobId: 'jd', cvId: 'cvd', workIds: [], submissionIds: [] }), now);
    expect(r.id).toBe('jd_ud');
    await expect(submitApplication(actor('u1'), body({ jobId: 'jd' }), now)).rejects.toThrow('Pendaftaran lamaran belum dibuka');
  });
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

  it('siswa Project Based tidak bisa melamar lowongan Full Internship', async () => {
    await expect(submitApplication(actor('u1'), body({ jobId: 'j3' }), now)).rejects.toThrow('Kamu belum memenuhi syarat lowongan ini');
  });

  it('skema lowongan disimpan di lamaran', async () => {
    await submitApplication(actor('u1'), body(), now);
    expect(data.jobApplications.j1_u1.scheme).toBe('project');
  });

  it('mentor tidak bisa memakai rute lamaran', async () => {
    getSessionActor.mockResolvedValue({ uid: 'm1', role: 'mentor' });
    const res = await lamarPost(new Request('http://x', { method: 'POST', body: JSON.stringify(body()) }));
    expect(res.status).toBe(403);
  });
});

describe('tier: kuota lamaran dan batas uang saku', () => {
  // u5 Full tier C (SPA 70), u6 Project Based tier B (SPA 80) / u5 Full tier C (SPA 70), u6 Project Based tier B (SPA 80)
  beforeEach(() => {
    const snap = data.dashboardSnapshots['2026-11-04'] as { ranking: unknown[] };
    snap.ranking.push({ studentId: 'u5', score: 70, pending: [], placement: 'full' }, { studentId: 'u6', score: 80, pending: [], placement: 'project' });
    data.studentCvs.cv5 = { ownerUid: 'u5', kind: 'cv', fileName: 'c.pdf', deleted: false, uploadedAt: '1' };
    data.studentCvs.cv6 = { ownerUid: 'u6', kind: 'cv', fileName: 'c.pdf', deleted: false, uploadedAt: '1' };
  });
  const bare = (jobId: string, cvId: string) => body({ jobId, cvId, workIds: [], submissionIds: [] });

  it('kuota Full tier C dua lamaran berjalan; lamaran tidak lolos mengembalikan jatah', async () => {
    data.jobApplications.x1_u5 = { jobId: 'x1', studentId: 'u5', status: 'interview', scheme: 'full' };
    data.jobApplications.x2_u5 = { jobId: 'x2', studentId: 'u5', status: 'baru', scheme: 'full' };
    await expect(submitApplication(actor('u5'), bare('j3', 'cv5'), now)).rejects.toThrow('Kuota lamaranmu sedang penuh');
    data.jobApplications.x2_u5.status = 'tidak-lolos';
    expect((await submitApplication(actor('u5'), bare('j3', 'cv5'), now)).id).toBe('j3_u5');
  });

  it('uang saku di atas batas tier ditolak', async () => {
    data.jobs.j4 = { ...job, scheme: 'full', salary: 800_000 };
    await expect(submitApplication(actor('u5'), bare('j4', 'cv5'), now)).rejects.toThrow('Kamu belum memenuhi syarat lowongan ini');
    data.jobs.j4.salary = 750_000;
    expect((await submitApplication(actor('u5'), bare('j4', 'cv5'), now)).id).toBe('j4_u5');
  });

  it('Project Based tier B: proyek yang belum selesai memakai jatah sampai ditandai selesai', async () => {
    data.jobApplications.p1_u6 = { jobId: 'p1', studentId: 'u6', status: 'bergabung', scheme: 'project' };
    data.jobApplications.p2_u6 = { jobId: 'p2', studentId: 'u6', status: 'bergabung', scheme: 'project' };
    await expect(submitApplication(actor('u6'), bare('j1', 'cv6'), now)).rejects.toThrow('Jatah proyekmu sedang penuh');
    data.jobApplications.p1_u6.completedAt = '2026-11-04T00:00:00Z';
    expect((await submitApplication(actor('u6'), bare('j1', 'cv6'), now)).id).toBe('j1_u6');
  });

  it('peserta Full yang sudah menerima proyek hanya bisa melamar Project Based', async () => {
    data.jobApplications.p1_u5 = { jobId: 'p1', studentId: 'u5', status: 'bergabung', scheme: 'project', completedAt: '2026-11-04T00:00:00Z' };
    data.jobs.j1.salary = 500_000;
    await expect(submitApplication(actor('u5'), bare('j3', 'cv5'), now)).rejects.toThrow('Kamu belum memenuhi syarat lowongan ini');
    expect((await submitApplication(actor('u5'), bare('j1', 'cv5'), now)).id).toBe('j1_u5');
  });
});
