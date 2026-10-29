import { describe, expect, it } from 'vitest';
import { comparePlacementRank, decidePlacement } from '../../src/features/grading/placement';
import { countUnexcused, performanceScore } from '../../src/features/grading/policy';

describe('penentuan skema magang', () => {
  it('SPA ≥ 80, capstone ≥ 75, tanpa absen tanpa izin: kandidat Full Internship', () => {
    expect(decidePlacement({ spa: 80, capstone: 75, unexcused: 0 })).toEqual({ placement: 'full', reasons: [] });
  });
  it('SPA 65–79 masuk Project Based', () => {
    expect(decidePlacement({ spa: 79, capstone: 90, unexcused: 0 }).placement).toBe('project');
    expect(decidePlacement({ spa: 65, capstone: 90, unexcused: 0 }).placement).toBe('project');
  });
  it('SPA ≥ 80 yang gagal syarat lain turun ke Project Based beserta alasannya', () => {
    expect(decidePlacement({ spa: 88, capstone: 70, unexcused: 2 })).toEqual({
      placement: 'project',
      reasons: ['Capstone di bawah 75', '2× absen tanpa izin'],
    });
  });
  it('SPA di bawah 65 tidak ditempatkan, apa pun nilai lainnya', () => {
    expect(decidePlacement({ spa: 64, capstone: 100, unexcused: 0 })).toEqual({ placement: 'none', reasons: ['SPA di bawah 65'] });
  });
  it('capstone yang belum dinilai menunda penentuan, bukan menolak', () => {
    expect(decidePlacement({ spa: 25, capstone: 0, unexcused: 0, capstoneGraded: false })).toEqual({ placement: 'pending', reasons: ['Capstone belum dinilai'] });
  });
  it('urutan: SPA, lalu capstone, lalu kehadiran', () => {
    const rows = [
      { id: 'a', spa: 80, capstone: 80, attendance: 90 },
      { id: 'b', spa: 85, capstone: 70, attendance: 50 },
      { id: 'c', spa: 80, capstone: 80, attendance: 100 },
      { id: 'd', spa: 80, capstone: 90, attendance: 10 },
    ];
    expect(rows.sort(comparePlacementRank).map((r) => r.id)).toEqual(['b', 'd', 'c', 'a']);
  });
});

describe('absen tanpa izin', () => {
  const sessions = [
    { id: 's1', endsAt: '2026-09-01T10:00:00Z', title: 'Pertemuan 1' },
    { id: 's2', endsAt: '2026-09-08T10:00:00Z', title: 'Pertemuan 2' },
    { id: 's3', endsAt: '2026-09-15T10:00:00Z', title: 'Pertemuan 3' },
    { id: 's4', endsAt: '2026-09-22T10:00:00Z', title: 'Pertemuan 4' },
    { id: 'k', endsAt: '2026-09-09T10:00:00Z', title: 'Kelas Karier' },
    { id: 'f', endsAt: '2026-12-01T10:00:00Z', title: 'Pertemuan 5' },
  ];
  const status: Record<string, string> = { s1: 'present', s2: 'excused', s3: 'absent' };
  it('menghitung status absen dan pertemuan tanpa catatan; izin, sakit, sesi non-pertemuan, dan pertemuan mendatang tidak', () => {
    expect(countUnexcused({
      sessions, joinIso: '', nowIso: '2026-10-29T00:00:00Z',
      status: (id) => status[id] as never,
    })).toBe(2);
  });
  it('pertemuan tanpa catatan sebelum peserta bergabung tidak dihitung', () => {
    expect(countUnexcused({
      sessions, joinIso: '2026-09-16T00:00:00Z', nowIso: '2026-10-29T00:00:00Z',
      status: (id) => (id === 's1' ? 'present' : undefined),
    })).toBe(1);
  });
});

describe('rubrik Performance Terbaik', () => {
  it('kehadiran 40%, TPM 40%, kuis 20%, tanpa capstone', () => {
    expect(performanceScore({ attendance: 92, tasks: 80, quiz: 70 })).toBe(Math.round(92 * 0.4 + 80 * 0.4 + 70 * 0.2));
  });
});
