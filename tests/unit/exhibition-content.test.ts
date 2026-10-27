import { describe, expect, it } from 'vitest';
import { DATA } from '../../src/features/exhibition/content';

// Nilai acuan diambil dari desain asli yang dibuka di Chrome / Reference values taken from the original design opened in Chrome
describe('data contoh pameran', () => {
  it('sama dengan desain di Chrome, hanya nama panggilan, dan tidak bergantung pada Array.sort mesin JavaScript', () => {
    expect(DATA.people).toHaveLength(126);
    expect(DATA.works).toHaveLength(176);
    const first = DATA.works.slice(0, 3).map((w) => `${w.type}|${w.title}|${DATA.P[w.person].name}`);
    expect(first).toEqual([
      'Aplikasi Web|Platform Les Privat Mahasiswa|Aulia',
      'Aplikasi Web|Sistem Antrean Puskesmas|Joko',
      'Landing Page|Halaman Donasi Bencana|Gita',
    ]);
  });
});

describe('privasi peserta', () => {
  it('nama dan inisial tidak memuat nama belakang', () => {
    for (const p of DATA.people) {
      expect(p.name).not.toContain(' ');
      expect(p.initials).toBe(p.name[0]);
    }
  });
});
