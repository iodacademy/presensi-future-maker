// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { summarize, type PortalInsights } from '../../src/features/careers/insights';

const app = (id: string, jobId: string, status: string) => ({ id, jobId, status, submittedAt: '2026-11-10T00:00:00Z', interview: null, completedAt: null }) as never;

const data: PortalInsights = {
  programs: ['Digital Marketing', 'Web Programming'],
  jobs: [
    { id: 'j1', title: 'Web Dev', partnerId: 'p1', partnerName: 'PT A', picName: 'Rina', scheme: 'full', quota: 3, programs: ['Web Programming'] },
    { id: 'j2', title: 'KOL', partnerId: 'p2', partnerName: 'PT B', picName: 'Budi', scheme: 'project', quota: 5, programs: ['Digital Marketing'] },
    { id: 'j3', title: 'Admin', partnerId: 'p1', partnerName: 'PT A', picName: 'Rina', scheme: 'full', quota: 4, programs: [] },
  ],
  students: [
    { studentId: 's1', name: 'Andi', className: 'Web Programming - Semarang', program: 'Web Programming', placement: 'full', apps: [app('a1', 'j1', 'bergabung'), app('a2', 'j3', 'ditutup')] },
    { studentId: 's2', name: 'Bela', className: 'Web Programming - Surabaya', program: 'Web Programming', placement: 'project', apps: [] },
    { studentId: 's3', name: 'Caca', className: 'Digital Marketing - Semarang', program: 'Digital Marketing', placement: 'project', apps: [app('a3', 'j2', 'diterima')] },
    { studentId: 's4', name: 'Dodi', className: 'Digital Marketing - Semarang', program: 'Digital Marketing', placement: 'full', apps: [app('a4', 'j2', 'interview')] },
  ],
};

describe('ringkasan Job Portal', () => {
  it('posisi dihitung dari kuota, bukan jumlah lowongan, dan diurutkan dari perusahaan terbanyak', () => {
    const s = summarize(data, null);
    expect(s.partners).toBe(2);
    expect(s.quota).toEqual({ total: 12, full: 7, project: 5 });
    expect(s.byPartner).toEqual([
      { partnerName: 'PT A', full: 7, project: 0, total: 7 },
      { partnerName: 'PT B', full: 0, project: 5, total: 5 },
    ]);
  });

  it('filter jurusan memakai lowongan yang bisa dilamar jurusan itu, termasuk lowongan semua jurusan', () => {
    const s = summarize(data, 'Web Programming');
    expect(s.quota).toEqual({ total: 7, full: 7, project: 0 });
    expect(s.partners).toBe(1);
    expect(s.students.map((x) => x.name)).toEqual(['Andi', 'Bela']);
  });

  it('memisahkan peserta yang sudah dan belum melamar', () => {
    const s = summarize(data, null);
    expect(s.applied.map((x) => x.name)).toEqual(['Andi', 'Caca', 'Dodi']);
    expect(s.notApplied.map((x) => x.name)).toEqual(['Bela']);
  });

  it('diterima mencakup yang lolos menunggu jawaban dan yang sudah bergabung, beserta tempatnya', () => {
    const s = summarize(data, null);
    expect(s.accepted.map((x) => [x.student.name, x.job.partnerName, x.app.status])).toEqual([
      ['Andi', 'PT A', 'bergabung'],
      ['Caca', 'PT B', 'diterima'],
    ]);
  });

  it('progres lamaran menghitung tiap status lamaran', () => {
    const s = summarize(data, null);
    expect(Object.fromEntries(s.funnel.map((f) => [f.status, f.count]))).toMatchObject({ interview: 1, diterima: 1, bergabung: 1, ditutup: 1, baru: 0 });
  });
});
