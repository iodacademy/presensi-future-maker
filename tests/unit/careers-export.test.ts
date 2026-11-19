// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeDb, reset, selects } from './careers-fake-db';

const getSnapshot = vi.fn();
const getSessionActor = vi.fn();
vi.mock('../../src/lib/firebase/admin', () => ({ getAdminDb: () => fakeDb }));
vi.mock('../../src/features/dashboard/snapshot-service', () => ({ getSnapshot: (a: unknown) => getSnapshot(a) }));
vi.mock('../../src/features/auth/session', () => ({ getSessionActor: () => getSessionActor() }));

import { exportApplicants, exportPassed } from '../../src/features/careers/export-service';
import { GET } from '../../src/app/api/karier/export/route';
import { GET as getPassed } from '../../src/app/api/karier/export/lolos/route';

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

describe('ekspor peserta intern yang lolos seleksi', () => {
  beforeEach(() => {
    reset({
      partners: { p1: { name: 'Ioda', address: 'Jl. Kemang Raya 1, Jakarta Selatan' }, p2: { name: 'Dynamic Buzz' } },
      jobs: {
        j1: { title: 'Web Developer', partnerId: 'p1', partnerName: 'Ioda', scheme: 'full', salary: 1_000_000, durationMonths: null, location: 'Jakarta Selatan', description: 'Membangun halaman web' },
        j2: { title: 'Social Media', partnerId: 'p2', partnerName: 'Dynamic Buzz', scheme: 'project', salary: 500_000, durationMonths: 2, location: 'Tangerang Selatan', description: 'Membuat konten' },
        j3: { title: 'Webtoon', partnerId: 'p2', partnerName: 'Dynamic Buzz', scheme: 'full', salary: null, location: 'WFH', description: 'Menggambar webtoon' },
        jd: { title: 'Demo', partnerId: 'p1', partnerName: 'Ioda', scheme: 'full', eligibility: { mode: 'classes', classIds: ['demo'] }, description: '' },
      },
      jobApplications: {
        a1: app('s1', 'j1', { status: 'bergabung' }),
        a2: app('s2', 'j2', { status: 'diterima' }),
        a3: app('s3', 'j1', { status: 'interview' }),
        a4: app('s4', 'jd', { status: 'diterima' }),
        // Lamaran lama peserta yang kemudian ditempatkan tidak diulang / An older application of a later-placed participant is not repeated
        a5: app('s5', 'j1', { status: 'diterima' }),
      },
      internshipPlacements: { s5: { studentId: 's5', jobId: 'j3', partnerId: 'p2', partnerName: 'Dynamic Buzz', position: 'Webtoon', scheme: 'full' } },
      users: { s5: { name: 'Nama s5', email: 's5@x.id' } },
      // Nomor WA peserta yang ditempatkan diambil dari profilnya / A placed participant's WhatsApp number comes from their profile
      studentProfiles: { s5: { phone: '0857' } },
    });
  });

  it('satu baris per peserta lolos dengan alamat, gaji, dan tugas dari lowongannya', async () => {
    expect(await exportPassed()).toEqual([
      { name: 'Nama s2', email: 's2@x.id', phone: '08', status: 'Lolos · menunggu jawaban', company: 'Dynamic Buzz', address: 'Tangerang Selatan', role: 'Social Media', salary: 'Rp 500.000 / project · 2 bulan', tasks: 'Membuat konten' },
      { name: 'Nama s5', email: 's5@x.id', phone: '0857', status: 'Ditempatkan', company: 'Dynamic Buzz', address: 'WFH', role: 'Webtoon', salary: 'Tidak dicantumkan', tasks: 'Menggambar webtoon' },
      { name: 'Nama s1', email: 's1@x.id', phone: '08', status: 'Menerima tawaran', company: 'Ioda', address: 'Jl. Kemang Raya 1, Jakarta Selatan', role: 'Web Developer', salary: 'Rp 1.000.000 / bulan', tasks: 'Membangun halaman web' },
    ]);
    expect(selects.jobApplications.flat()).not.toContain('answers');
  });

  it('hanya admin yang boleh mengekspor', async () => {
    getSessionActor.mockResolvedValue({ uid: 'u1', role: 'student' });
    expect((await getPassed()).status).toBe(403);
  });
});
