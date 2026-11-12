// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { data, fakeDb, fakeStorage, reset } from './careers-fake-db';

const getSessionActor = vi.fn();
vi.mock('next/cache', () => ({ unstable_cache: (fn: () => unknown) => fn, revalidateTag: vi.fn() }));
vi.mock('../../src/features/auth/session', () => ({ getSessionActor: () => getSessionActor() }));
vi.mock('../../src/lib/firebase/admin', () => ({ getAdminDb: () => fakeDb, getAdminStorage: () => fakeStorage }));
const cancel = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock('../../src/features/calendar/client', () => ({ cancelCalendarEvent: cancel, isCalendarConfigured: () => true, createCalendarEvent: vi.fn() }));

import { decideCandidate, getCandidate, listCandidates, partnerDashboard, partnerMe, updateOwnProfile } from '../../src/features/careers/partner-service';
import { GET as dashGet } from '../../src/app/api/mitra/dashboard/route';

const now = new Date('2026-11-05T00:00:00Z');
const rina = { uid: 'r1', role: 'partner', partnerId: 'p1', email: 'rina@dipsi.co.id', name: 'Rina' } as never;
const lain = { uid: 'r2', role: 'partner', partnerId: 'p2', email: 'x@lain.id', name: 'X' } as never;
const job = { partnerId: 'p1', title: 'UI/UX Intern', employment: 'magang-3', scheme: 'project', quota: 2, status: 'published', opensAt: '2026-11-01T00:00:00Z', closesAt: '2026-11-12T00:00:00Z', applicantCount: 2, questions: [] };
const app = (status: string, partnerId = 'p1', jobId = 'j1') => ({
  jobId, partnerId, studentId: 'u1', classId: 'k1', number: 'FM-JOB-0001', status, rejectReason: '', answers: {}, works: [], tasks: [],
  personal: { fullName: 'Andi', email: 'a@x.id', phone: '0812', city: 'Semarang', school: '', major: '', linkedin: '' },
  cvId: 'cv1', portfolioUrl: '', finalScore: 80, finalScorePending: false, finalScoreAt: '2026-11-04', submittedAt: '2026-11-04T00:00:00Z', statusChangedAt: '2026-11-04T00:00:00Z',
});

beforeEach(() => {
  reset({
    partners: { p1: { name: 'PT DIPSI', nameKey: 'pt dipsi', field: 'Software', about: '', logo: null, website: '', socials: { instagram: '', linkedin: '', tiktok: '', youtube: '' }, pics: [{ name: 'Rina', phone: '1', email: 'rina@dipsi.co.id' }], active: true } },
    jobs: { j1: job, j9: { ...job, partnerId: 'p2' } },
    jobApplications: { a1: app('baru'), a2: app('shortlist'), a3: app('interview'), a9: app('baru', 'p2', 'j9') },
    classes: { k1: { canonicalName: 'Web Programming · Semarang' } },
  });
  getSessionActor.mockResolvedValue({ uid: 'r1', role: 'partner', partnerId: 'p1' });
});

describe('PIC hanya melihat lowongan yang di-assign kepadanya', () => {
  const budi = { uid: 'b1', role: 'partner', partnerId: 'p1', email: 'budi@dipsi.co.id', name: 'Budi' } as never;
  const nabila = { uid: 'n1', role: 'partner', partnerId: 'p1', email: 'nabila@dipsi.co.id', name: 'Nabila' } as never;
  beforeEach(() => {
    data.jobs.j1 = { ...job, picEmails: ['rina@dipsi.co.id'] };
    data.jobs.j2 = { ...job, title: 'Web Dev', picEmails: ['budi@dipsi.co.id', 'rina@dipsi.co.id'] };
    data.jobs.j3 = { ...job, title: 'Admin', picEmails: ['budi@dipsi.co.id'] };
    data.jobApplications.b1 = app('baru', 'p1', 'j3');
  });

  it('dashboard dan daftar kandidat hanya dari lowongan miliknya', async () => {
    expect((await partnerDashboard(rina, now)).jobs.map((j) => j.id).sort()).toEqual(['j1', 'j2']);
    expect((await partnerDashboard(budi, now)).jobs.map((j) => j.id).sort()).toEqual(['j2', 'j3']);
    expect((await partnerDashboard(budi, now)).stats.newCount).toBe(1);
    await expect(listCandidates(rina, 'j3')).rejects.toThrow('Lowongan tidak ditemukan');
    await expect(getCandidate(rina, 'b1')).rejects.toThrow('Lamaran tidak ditemukan');
    await expect(decideCandidate(rina, 'b1', 'ditinjau')).rejects.toThrow('Lamaran tidak ditemukan');
  });

  it('PIC yang tidak di-assign ke lowongan mana pun (mis. HR) melihat semua lowongan perusahaannya', async () => {
    expect((await partnerDashboard(nabila, now)).jobs.map((j) => j.id).sort()).toEqual(['j1', 'j2', 'j3']);
    expect((await getCandidate(nabila, 'b1')).id).toBe('b1');
  });
});

describe('layanan PIC', () => {
  it('dashboard menghitung kandidat perusahaannya saja', async () => {
    const d = await partnerDashboard(rina, now);
    expect(d.partnerName).toBe('PT DIPSI');
    expect(d.stats).toEqual({ newCount: 1, shortlist: 1, interviews: 1, activeJobs: 1 });
    expect(d.jobs).toEqual([expect.objectContaining({ id: 'j1', title: 'UI/UX Intern', applicantCount: 2, newCount: 1 })]);
  });

  it('kandidat lowongan perusahaan lain tidak bisa dibaca', async () => {
    await expect(listCandidates(rina, 'j9')).rejects.toThrow('Lowongan tidak ditemukan');
    expect((await listCandidates(rina, 'j1')).map((r) => r.id).sort()).toEqual(['a1', 'a2', 'a3']);
    await expect(getCandidate(lain, 'a1')).rejects.toThrow('Lamaran tidak ditemukan');
  });

  it('membuka kandidat baru mengubahnya menjadi ditinjau', async () => {
    const c = await getCandidate(rina, 'a1');
    expect(c.status).toBe('ditinjau');
    expect(data.jobApplications.a1.status).toBe('ditinjau');
  });

  it('PIC hanya bisa memilih status yang menjadi haknya', async () => {
    await expect(decideCandidate(rina, 'a2', 'baru')).rejects.toThrow('Status ini tidak bisa dipilih');
    await expect(decideCandidate(rina, 'a2', 'interview')).rejects.toThrow('Status ini tidak bisa dipilih');
    await expect(decideCandidate(lain, 'a2', 'diterima')).rejects.toThrow('Lamaran tidak ditemukan');
    await decideCandidate(rina, 'a2', 'tidak-lolos', 'Kuota sudah terpenuhi');
    expect(data.jobApplications.a2).toMatchObject({ status: 'tidak-lolos', rejectReason: 'Kuota sudah terpenuhi' });
  });

  it('PIC mengubah profil tanpa bisa mengganti nama dan PIC', async () => {
    await updateOwnProfile(rina, { name: 'PT Lain', field: 'Konsultan', about: 'Baru', website: 'https://dipsi.co.id', socials: { instagram: '', linkedin: '', tiktok: '', youtube: '' }, logo: null, pics: [] });
    expect(data.partners.p1).toMatchObject({ name: 'PT DIPSI', field: 'Konsultan', about: 'Baru', website: 'https://dipsi.co.id' });
    expect((data.partners.p1.pics as unknown[]).length).toBe(1);
  });

  it('menolak kandidat yang sudah diundang ikut membatalkan acara kalendernya', async () => {
    data.jobApplications.a3.interview = { calendarEventId: 'ev-1', date: '2026-11-12', start: '10:00', durationMin: 45 };
    await decideCandidate(rina, 'a3', 'tidak-lolos', 'Skill belum sesuai');
    expect(cancel).toHaveBeenCalledWith('ev-1');
    expect((data.jobApplications.a3.interview as { calendarEventId: string | null }).calendarEventId).toBeNull();
  });

  it('logo profil hanya boleh dari unggahan portal ke folder mitra sendiri', async () => {
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = 'bkt';
    const base = { field: '', about: '', website: '', socials: { instagram: '', linkedin: '', tiktok: '', youtube: '' } };
    await expect(updateOwnProfile(rina, { ...base, logo: { thumb: 'https://pelacak.example/x.png', full: 'https://pelacak.example/x.png' } })).rejects.toThrow('Logo harus diunggah lewat portal');
    const own = 'https://firebasestorage.googleapis.com/v0/b/bkt/o/' + encodeURIComponent('pameran/mitra/p1/abc.webp') + '?alt=media';
    await updateOwnProfile(rina, { ...base, logo: { thumb: own, full: own } });
    expect((data.partners.p1.logo as { thumb: string }).thumb).toBe(own);
  });

  it('nama PIC dan perusahaan dibaca tanpa memindai lamaran', async () => {
    expect(await partnerMe(rina)).toEqual({ picName: 'Rina', partnerName: 'PT DIPSI' });
  });

  it('siswa tidak bisa membuka dashboard mitra', async () => {
    getSessionActor.mockResolvedValue({ uid: 'u1', role: 'student' });
    expect((await dashGet()).status).toBe(403);
  });
});
