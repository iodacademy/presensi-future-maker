// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeDb, fakeStorage, reset } from './careers-fake-db';

const getSessionActor = vi.fn();
vi.mock('../../src/features/auth/session', () => ({ getSessionActor: () => getSessionActor() }));
vi.mock('next/cache', () => ({ unstable_cache: (fn: () => unknown) => fn }));
vi.mock('../../src/lib/firebase/admin', () => ({ getAdminDb: () => fakeDb, getAdminStorage: () => fakeStorage }));

import {
  careerAccess, getApplyContext, getJobForStudent, getPartnerProfile, latestFinalScore, listMyApplications, listOpenJobs,
} from '../../src/features/careers/student-service';
import { GET as lowonganGet } from '../../src/app/api/karier/lowongan/route';

const now = new Date('2026-11-05T00:00:00Z');
const andi = { uid: 'u1', role: 'student', classId: 'k1', name: 'Andi', email: 'andi@x.id' } as never;
const job = {
  partnerId: 'p1', partnerName: 'PT DIPSI', title: 'UI/UX Intern', employment: 'magang-3', category: 'desain', scheme: 'project', location: 'Jakarta',
  workMode: 'hybrid', quota: 2, description: 'Panjang', qualifications: ['Figma'], eligibility: { mode: 'all' },
  opensAt: '2026-11-03T01:00:00.000Z', closesAt: '2026-11-12T16:59:00.000Z',
  documents: { portfolio: 'optional', works: 'optional', coverLetter: 'off' }, questions: [], status: 'published', applicantCount: 3,
};

beforeEach(() => {
  reset({
    settings: { careers: { applicationsOpen: true } },
    partners: { p1: { name: 'PT DIPSI', field: 'Software', about: 'Tentang', logo: { thumb: 'https://x/t.webp', full: 'https://x/f.webp' }, website: '', socials: { instagram: '', linkedin: '', tiktok: '', youtube: '' }, pics: [{ name: 'Rina', phone: '1', email: 'r@x.id' }] } },
    jobs: {
      ok: job,
      draft: { ...job, status: 'draft' },
      belum: { ...job, opensAt: '2026-11-06T00:00:00.000Z' },
      tutup: { ...job, closesAt: '2026-11-04T00:00:00.000Z' },
      kelasLain: { ...job, eligibility: { mode: 'classes', classIds: ['k2'] } },
      nilai: { ...job, eligibility: { mode: 'min-score', minScore: 90 } },
      full: { ...job, scheme: 'full' },
    },
    jobApplications: {},
    users: { u1: { name: 'Andi Pratama', email: 'andi@x.id', classId: 'k1' } },
    studentProfiles: { u1: { phone: '0812' } },
    careerProfiles: { u1: { city: 'Semarang', school: 'SMK 1', major: 'RPL', linkedin: '' } },
    classes: { k1: { canonicalName: 'Web Programming · Semarang' } },
    exhibitionWorks: {
      w1: { personUid: 'u1', status: 'published', title: 'Griya', type: 'Capstone', cover: { thumb: 'https://x/c.webp' } },
      w2: { personUid: 'u1', status: 'draft', title: 'Draf', type: 'TPM', cover: { thumb: '' } },
      w3: { personUid: 'u2', status: 'published', title: 'Orang lain', type: 'TPM', cover: { thumb: '' } },
    },
    submissions: {
      t1_u1: { studentId: 'u1', taskTitle: 'TPM 1', taskKind: 'daily', fileId: 'submissions/k1/t1/u1/a.pdf', url: null },
      t2_u1: { studentId: 'u1', taskTitle: 'Kosong', taskKind: 'daily', fileId: null, url: null },
      t3_u1: { studentId: 'u1', taskTitle: 'Tautan', taskKind: 'daily', fileId: null, url: 'https://figma.com/x' },
      t4_u1: { studentId: 'u1', taskTitle: 'Hilang', taskKind: 'daily', fileId: 'local-file-123', url: null },
      t5_u1: { studentId: 'u1', taskTitle: 'Skrip', taskKind: 'daily', fileId: null, url: 'javascript:alert(1)' },
    },
    studentCvs: {},
    dashboardSnapshots: {
      '2026-11-01': { generatedAt: '2026-11-01T01:00:00Z', version: 17, ranking: [{ studentId: 'u1', score: 70, pending: [], placement: 'project' }] },
      '2026-11-04': { generatedAt: '2026-11-04T01:00:00Z', version: 17, ranking: [{ studentId: 'u1', score: 82, pending: ['capstone'], placement: 'project' }, { studentId: 'u7', score: 85, pending: [], placement: 'full' }, { studentId: 'u8', score: 50, pending: [], placement: 'none' }] },
    },
  });
  getSessionActor.mockResolvedValue({ uid: 'u1', role: 'student', classId: 'k1' });
});

describe('bacaan siswa', () => {
  it('nilai akhir diambil dari ringkasan terbaru dan ditandai sementara', async () => {
    expect(await latestFinalScore('u1')).toEqual({ finalScore: 82, finalScorePending: true, finalScoreAt: '2026-11-04' });
    expect(await latestFinalScore('u9')).toEqual({ finalScore: null, finalScorePending: false, finalScoreAt: '2026-11-04' });
  });

  it('ringkasan sebelum versi 17 dianggap sementara karena belum mencatat komponen yang tertunda', async () => {
    const { data } = await import('./careers-fake-db');
    data.dashboardSnapshots['2026-11-05'] = { generatedAt: '2026-11-05T01:00:00Z', ranking: [{ studentId: 'u1', score: 88, placement: 'project' }] };
    expect(await latestFinalScore('u1')).toEqual({ finalScore: 88, finalScorePending: true, finalScoreAt: '2026-11-05' });
  });

  it('hanya lowongan terbuka dan layak yang tampil, dengan logo mitra', async () => {
    const r = await listOpenJobs(andi, now);
    expect(r.jobs.map((j) => j.id)).toEqual(['ok']);
    expect(r.jobs[0].logo).toBe('https://x/t.webp');
    expect(r.bannerClosesAt).toBe('2026-11-12T16:59:00.000Z');
  });

  it('siswa Project Based tidak melihat lowongan Full, siswa Full melihat keduanya', async () => {
    expect((await listOpenJobs(andi, now)).jobs.map((j) => j.id)).not.toContain('full');
    const full = { uid: 'u7', role: 'student', classId: 'k1' } as never;
    expect((await listOpenJobs(full, now)).jobs.map((j) => j.id).sort()).toEqual(['full', 'ok']);
  });

  it('tier dan kuota ikut dikirim; lowongan di atas batas uang saku tier tidak tampil', async () => {
    const { data } = await import('./careers-fake-db');
    data.jobs.mahal = { ...job, salary: 1_500_000 };
    data.jobs.pas = { ...job, salary: 1_000_000 };
    const r = await listOpenJobs(andi, now);
    expect(r.standing).toMatchObject({ track: 'project', tier: 'B', quota: 2, used: 0 });
    expect(r.jobs.map((j) => j.id).sort()).toEqual(['ok', 'pas']);
  });

  it('kuota penuh menghentikan formulir lamaran sebelum diisi', async () => {
    const { data } = await import('./careers-fake-db');
    data.jobApplications.x1_u1 = { jobId: 'x1', studentId: 'u1', status: 'bergabung', scheme: 'project' };
    data.jobApplications.x2_u1 = { jobId: 'x2', studentId: 'u1', status: 'interview', scheme: 'project' };
    await expect(getApplyContext(andi, 'ok', now)).rejects.toThrow('Jatah proyekmu sedang penuh');
  });

  it('proyek yang sudah ditandai selesai berlabel Proyek selesai', async () => {
    const { data } = await import('./careers-fake-db');
    data.jobApplications.ok_u1 = { jobId: 'ok', studentId: 'u1', status: 'bergabung', scheme: 'project', number: 'FM-JOB-0001', submittedAt: '1', completedAt: '2026-11-04T00:00:00Z' };
    expect((await listMyApplications('u1'))[0].statusLabel).toBe('Proyek selesai');
  });

  it('siswa tanpa skema magang tidak punya akses Karier', async () => {
    const r = await listOpenJobs({ uid: 'u8', role: 'student', classId: 'k1' } as never, now);
    expect(r).toMatchObject({ access: false, jobs: [] });
    expect((await listOpenJobs(andi, now)).access).toBe(true);
    expect(await careerAccess('u8')).toBe(false);
    expect(await careerAccess('u1')).toBe(true);
  });

  it('lowongan yang sudah dilamar ditandai', async () => {
    (await import('./careers-fake-db')).data.jobApplications['ok_u1'] = { jobId: 'ok', studentId: 'u1', status: 'baru', number: 'FM-JOB-0001' };
    expect((await listOpenJobs(andi, now)).appliedJobIds).toEqual(['ok']);
  });

  it('detail lowongan memberi tahu alasan tidak bisa melamar bagi peserta yang sudah ditempatkan', async () => {
    const db = (await import('./careers-fake-db')).data;
    expect((await getJobForStudent(andi, 'ok', now))?.blocked).toBeNull();
    db.internshipPlacements = { u1: { studentId: 'u1', partnerName: 'PT Mayar Kernel Supernova', position: 'Digital Marketing Intern', scheme: 'full' } };
    expect((await getJobForStudent(andi, 'ok', now))?.blocked).toBe('Kamu sudah ditempatkan magang, jadi tidak bisa melamar lagi');
  });

  it('selama pendaftaran tutup, lowongan tetap bisa dilihat tetapi formulir lamaran ditolak', async () => {
    const db = (await import('./careers-fake-db')).data;
    expect((await getJobForStudent(andi, 'ok', now))?.applicationsOpen).toBe(true);
    db.settings.careers.applicationsOpen = false;
    expect((await getJobForStudent(andi, 'ok', now))?.applicationsOpen).toBe(false);
    await expect(getApplyContext(andi, 'ok', now)).rejects.toThrow('Pendaftaran lamaran belum dibuka');
  });

  it('detail lowongan tak terlihat kosong, kecuali sudah dilamar', async () => {
    expect(await getJobForStudent(andi, 'draft', now)).toBeNull();
    expect(await getJobForStudent(andi, 'tutup', now)).toBeNull();
    (await import('./careers-fake-db')).data.jobApplications['tutup_u1'] = { jobId: 'tutup', studentId: 'u1', status: 'ditinjau', number: 'FM-JOB-0002' };
    const r = await getJobForStudent(andi, 'tutup', now);
    expect(r?.application).toEqual({ status: 'ditinjau', number: 'FM-JOB-0002' });
  });

  it('profil mitra tidak membawa data PIC', async () => {
    const r = await getPartnerProfile(andi, 'p1', now);
    expect(r?.partner).not.toHaveProperty('pics');
    expect(r?.jobs.map((j) => j.id)).toEqual(['ok']);
  });

  it('konteks formulir mengisi data diri dan hanya karya terbit milik siswa', async () => {
    const c = await getApplyContext(andi, 'ok', now);
    expect(c.personal).toEqual({ fullName: 'Andi Pratama', email: 'andi@x.id', phone: '0812', city: 'Semarang', school: 'SMK 1', major: 'RPL', linkedin: '' });
    expect(c.className).toBe('Web Programming · Semarang');
    expect(c.works).toEqual([{ id: 'w1', title: 'Griya', type: 'Capstone', cover: 'https://x/c.webp' }]);
    // Berkas yang hilang tidak bisa dibuka mitra; tugas bertautan dibawa tautannya / Lost files cannot be opened; link tasks carry their link
    expect(c.tasks).toEqual([
      { submissionId: 't1_u1', title: 'TPM 1', kind: 'daily', url: '' },
      { submissionId: 't3_u1', title: 'Tautan', kind: 'daily', url: 'https://figma.com/x' },
    ]);
  });

  it('konteks formulir menolak lowongan tak terbuka dan yang sudah dilamar', async () => {
    await expect(getApplyContext(andi, 'nilai', now)).rejects.toThrow('Lowongan tidak bisa dilamar');
    (await import('./careers-fake-db')).data.jobApplications['ok_u1'] = { jobId: 'ok', studentId: 'u1', status: 'baru' };
    await expect(getApplyContext(andi, 'ok', now)).rejects.toThrow('Kamu sudah melamar lowongan ini');
  });

  it('lamaran saya tanpa alasan internal, dengan pesan standar bila belum lolos', async () => {
    (await import('./careers-fake-db')).data.jobApplications['ok_u1'] = { jobId: 'ok', studentId: 'u1', status: 'tidak-lolos', rejectReason: 'Skill belum sesuai', number: 'FM-JOB-0003', submittedAt: '2026-11-04T00:00:00Z' };
    const [a] = await listMyApplications('u1');
    expect(a).not.toHaveProperty('rejectReason');
    expect(a).toMatchObject({ jobTitle: 'UI/UX Intern', partnerName: 'PT DIPSI', statusLabel: 'Belum lolos', message: 'Terima kasih sudah melamar. Kali ini kamu belum lolos ke tahap berikutnya.' });
  });

  it('admin tidak memakai rute lowongan siswa', async () => {
    getSessionActor.mockResolvedValue({ uid: 'a', role: 'admin' });
    expect((await lowonganGet()).status).toBe(403);
  });
});
