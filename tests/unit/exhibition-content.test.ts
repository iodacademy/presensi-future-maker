import { describe, expect, it } from 'vitest';
import { DATA } from '../../src/features/exhibition/content';

// Nilai acuan diambil dari desain asli yang dibuka di Chrome / Reference values taken from the original design opened in Chrome
describe('data contoh pameran', () => {
  it('sama dengan desain di Chrome, tidak bergantung pada Array.sort mesin JavaScript', () => {
    expect(DATA.people).toHaveLength(126);
    expect(DATA.works).toHaveLength(176);
    const first = DATA.works.slice(0, 3).map((w) => `${w.type}|${w.title}|${DATA.P[w.person].name}`);
    expect(first).toEqual([
      'Landing Page|Profil Komunitas Literasi|Aulia M.',
      'Landing Page|Landing Page Kedai Kopi|Joko R.',
      'Aplikasi Web|Pencatat Keuangan UMKM|Gita T.',
    ]);
  });
});
