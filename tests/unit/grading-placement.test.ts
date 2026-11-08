import { describe, expect, it } from 'vitest';
import { combinedScore, comparePlacementRank, decidePlacement } from '../../src/features/grading/placement';
import { countAbsent, performanceScore } from '../../src/features/grading/policy';

describe('penentuan skema magang', () => {
  const p = (spa: number, capstone: number, tasks: number, absent: number) => decidePlacement({ spa, capstone, tasks, absent });
  it('nilai TPM + capstone berbobot capstone 60, TPM 40', () => {
    expect(combinedScore(80, 60)).toBe(72);
    expect(combinedScore(75, 64)).toBe(71);
  });
  it('SPA ≥ 70, nilai TPM + capstone ≥ 60, absen paling banyak 1: Full Internship', () => {
    expect(p(70, 60, 60, 1)).toEqual({ placement: 'full', reasons: [] });
  });
  it('SPA 50–69 atau nilai 50–59, absen paling banyak 3: Project Based', () => {
    expect(p(69, 59, 59, 3)).toEqual({ placement: 'project', reasons: ['SPA di bawah 70', 'Nilai TPM + capstone di bawah 60'] });
    expect(p(85, 55, 55, 0)).toEqual({ placement: 'project', reasons: ['Nilai TPM + capstone di bawah 60'] });
    expect(p(50, 50, 50, 0).placement).toBe('project');
  });
  it('absen menurunkan satu tingkat: nilai Full dengan absen 2–3 kali menjadi Project Based', () => {
    expect(p(90, 90, 90, 2)).toEqual({ placement: 'project', reasons: ['2× absen'] });
  });
  it('nilai Full dengan absen lebih dari 3 kali tetap Project Based, tidak gugur', () => {
    expect(p(82, 83, 86, 4)).toEqual({ placement: 'project', reasons: ['4× absen'] });
  });
  it('nilai Project dengan absen lebih dari 3 kali tidak ditempatkan; izin dan sakit ikut dihitung', () => {
    expect(p(60, 55, 55, 4)).toEqual({ placement: 'none', reasons: ['4× absen, batas 3 untuk Project Based'] });
  });
  it('SPA atau nilai TPM + capstone di bawah 50 tidak ditempatkan', () => {
    expect(p(49, 90, 90, 0)).toEqual({ placement: 'none', reasons: ['SPA di bawah 50'] });
    expect(p(60, 40, 50, 0)).toEqual({ placement: 'none', reasons: ['Nilai TPM + capstone di bawah 50'] });
  });
  it('capstone yang belum dinilai menunda penentuan, bukan menolak', () => {
    expect(decidePlacement({ spa: 25, capstone: 0, tasks: 0, absent: 0, capstoneGraded: false })).toEqual({ placement: 'pending', reasons: ['Capstone belum dinilai'] });
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

describe('hitungan absen', () => {
  const sessions = [
    { id: 's1', endsAt: '2026-09-01T10:00:00Z', title: 'Pertemuan 1' },
    { id: 's2', endsAt: '2026-09-08T10:00:00Z', title: 'Pertemuan 2' },
    { id: 's3', endsAt: '2026-09-15T10:00:00Z', title: 'Pertemuan 3' },
    { id: 's4', endsAt: '2026-09-22T10:00:00Z', title: 'Pertemuan 4' },
    { id: 's5', endsAt: '2026-09-23T10:00:00Z', title: 'Pertemuan 5' },
    { id: 'k', endsAt: '2026-09-09T10:00:00Z', title: 'Kelas Karier' },
    { id: 'f', endsAt: '2026-12-01T10:00:00Z', title: 'Pertemuan 6' },
  ];
  const status: Record<string, string> = { s1: 'present', s2: 'excused', s3: 'absent', s5: 'sick' };
  it('izin, sakit, absen, dan pertemuan tanpa catatan dihitung; sesi non-pertemuan dan pertemuan mendatang tidak', () => {
    expect(countAbsent({
      sessions, joinIso: '', nowIso: '2026-10-29T00:00:00Z',
      status: (id) => status[id] as never,
    })).toBe(4);
  });
  it('pertemuan tanpa catatan sebelum peserta bergabung tidak dihitung', () => {
    expect(countAbsent({
      sessions, joinIso: '2026-09-16T00:00:00Z', nowIso: '2026-10-29T00:00:00Z',
      status: (id) => (id === 's1' ? 'present' : undefined),
    })).toBe(2);
  });
});

describe('rubrik Performance Terbaik', () => {
  it('kehadiran 40%, TPM 40%, kuis 20%, tanpa capstone; yang tidak dikerjakan bernilai 0', () => {
    expect(performanceScore({ meetings: 12, attended: 11, taskScores: [80, null], quizScores: [70] }))
      .toEqual({ score: 66.7, attendance: 91.7, tasks: 40, quiz: 70 });
  });
  it('komponen tidak dibulatkan sebelum dijumlah, agar urutan juara tidak tertukar', () => {
    const nabila = performanceScore({ meetings: 12, attended: 12, taskScores: [93, 100], quizScores: [100, 100] });
    const zalfa = performanceScore({ meetings: 12, attended: 12, taskScores: [100, 95], quizScores: [100, 60, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100] });
    expect(nabila.score).toBeGreaterThan(zalfa.score);
  });
});
