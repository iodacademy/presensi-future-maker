import { describe, expect, it } from 'vitest';
import { canSeeJob, careerStanding, projectsOngoing, tierOf } from '../../src/features/careers/tier';

const app = (status: string, scheme?: 'full' | 'project', completedAt?: string) => ({ status, scheme, completedAt }) as never;

describe('tier dari SPA', () => {
  it('85 ke atas A, 75 – 84 B, di bawah 75 C', () => {
    expect(tierOf(85)).toBe('A');
    expect(tierOf(98)).toBe('A');
    expect(tierOf(84.9)).toBe('B');
    expect(tierOf(75)).toBe('B');
    expect(tierOf(74.9)).toBe('C');
    // Tanpa nilai diperlakukan paling ketat / No score is treated most strictly
    expect(tierOf(null)).toBe('C');
  });
});

describe('kuota dan jalur peserta', () => {
  it('Full Internship: kuota 5/3/2, hanya lamaran yang masih berjalan yang terhitung', () => {
    const apps = [app('baru'), app('interview'), app('tidak-lolos'), app('menolak')];
    expect(careerStanding('full', 90, apps)).toMatchObject({ track: 'full', tier: 'A', quota: 5, used: 2, locked: false });
    expect(careerStanding('full', 80, apps)).toMatchObject({ quota: 3, used: 2 });
    expect(careerStanding('full', 70, apps)).toMatchObject({ quota: 2, used: 2 });
  });

  it('Project Based: kuota 3/2/1, proyek yang belum selesai ikut terhitung', () => {
    const apps = [app('bergabung', 'project'), app('bergabung', 'project', '2026-12-01T00:00:00Z'), app('baru', 'project'), app('tidak-lolos', 'project')];
    expect(careerStanding('project', 90, apps)).toMatchObject({ track: 'project', quota: 3, used: 2 });
    expect(careerStanding('project', 80, apps).quota).toBe(2);
    expect(careerStanding('project', 60, apps).quota).toBe(1);
    expect(projectsOngoing(apps)).toBe(1);
  });

  it('peserta Full yang menerima proyek pindah permanen ke jalur Project Based', () => {
    const s = careerStanding('full', 80, [app('bergabung', 'project'), app('ditutup', 'full')]);
    expect(s).toMatchObject({ track: 'project', quota: 2, used: 1, locked: false });
  });

  it('peserta yang menerima tawaran Full Internship terkunci; lamaran lama tanpa skema dianggap Full', () => {
    expect(careerStanding('full', 90, [app('bergabung', 'full')]).locked).toBe(true);
    expect(careerStanding('full', 90, [app('bergabung')]).locked).toBe(true);
  });

  it('Tidak ditempatkan dan menunggu tidak punya jalur', () => {
    expect(careerStanding('none', 90, []).track).toBeNull();
    expect(careerStanding(null, 90, []).track).toBeNull();
    expect(careerStanding('pending', 90, []).track).toBeNull();
  });
});

describe('lowongan yang terlihat', () => {
  const full = (spa: number) => careerStanding('full', spa, []);
  const project = (spa: number) => careerStanding('project', spa, []);

  it('batas uang saku Full Internship: A 1,5 jt, B 1 jt, C 750 rb', () => {
    expect(canSeeJob(full(90), { scheme: 'full', salary: 1_500_000 })).toBe(true);
    expect(canSeeJob(full(80), { scheme: 'full', salary: 1_000_000 })).toBe(true);
    expect(canSeeJob(full(80), { scheme: 'full', salary: 1_000_001 })).toBe(false);
    expect(canSeeJob(full(70), { scheme: 'full', salary: 750_000 })).toBe(true);
    expect(canSeeJob(full(70), { scheme: 'full', salary: 800_000 })).toBe(false);
  });

  it('batas nilai Project Based: A 1,5 jt, B 1 jt, C 500 rb, juga bagi peserta Full', () => {
    expect(canSeeJob(project(90), { scheme: 'project', salary: 1_500_000 })).toBe(true);
    expect(canSeeJob(project(80), { scheme: 'project', salary: 1_500_000 })).toBe(false);
    expect(canSeeJob(project(70), { scheme: 'project', salary: 500_000 })).toBe(true);
    expect(canSeeJob(project(70), { scheme: 'project', salary: 800_000 })).toBe(false);
    expect(canSeeJob(full(70), { scheme: 'project', salary: 800_000 })).toBe(false);
    expect(canSeeJob(full(70), { scheme: 'project', salary: 500_000 })).toBe(true);
  });

  it('lowongan tanpa nominal terbuka untuk semua tier; jalur Project Based tidak melihat lowongan Full', () => {
    expect(canSeeJob(full(60), { scheme: 'full', salary: null })).toBe(true);
    expect(canSeeJob(project(95), { scheme: 'full', salary: null })).toBe(false);
    expect(canSeeJob(careerStanding('none', 95, []), { scheme: 'project', salary: null })).toBe(false);
  });
});
