// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildLearningSummary, type SummaryRow } from '../../src/features/dashboard/learning-summary';

const row = (over: Partial<SummaryRow> = {}): SummaryRow => ({
  score: 82, capstone: 80, tasks: 78, attendance: 92, quiz: 86, combined: 79, absent: 1, placement: 'full', placementReasons: [], pending: false, ...over,
});
const base = { placedAt: null, apps: [], applyUntil: null };

describe('ringkasan belajar siswa', () => {
  it('lulus Full Internship: komponen berbobot, syarat terpenuhi, tahap melamar', () => {
    const s = buildLearningSummary({ ...base, row: row(), apps: [{ status: 'interview', interview: { date: '2026-11-13', start: '10:00' } }, { status: 'baru' }, { status: 'tidak-lolos' }] });
    expect(s.state).toBe('full');
    expect(s.tier).toBe('B');
    expect(s.components.map((c) => [c.key, c.weight, c.contribution])).toEqual([['capstone', 45, 36], ['tasks', 30, 23], ['attendance', 15, 14], ['quiz', 10, 9]]);
    expect(s.requirements).toEqual([
      { label: 'SPA min. 70', value: 82, ok: true },
      { label: 'TPM + capstone min. 60', value: 79, ok: true },
      { label: 'Absen maks. 1 kali', value: 1, ok: true },
    ]);
    expect(s.applications).toEqual({ running: 2, nextInterview: { date: '2026-11-13', start: '10:00' } });
    expect(s.steps.map((x) => x.status)).toEqual(['done', 'done', 'done', 'current', 'todo']);
  });

  it('lulus tetapi tidak ditempatkan menunjukkan syarat Project Based yang gagal', () => {
    const s = buildLearningSummary({ ...base, row: row({ score: 66, combined: 60, absent: 4, placement: 'none', placementReasons: ['4× absen, batas 3 untuk Project Based'] }) });
    expect(s.state).toBe('tidak-ditempatkan');
    expect(s.requirements.find((r) => !r.ok)).toEqual({ label: 'Absen maks. 3 kali', value: 4, ok: false });
  });

  it('SPA di bawah 60 belum lulus, walau aturan skema memberi Project Based', () => {
    expect(buildLearningSummary({ ...base, row: row({ score: 55, placement: 'project' }) }).state).toBe('belum-lulus');
  });

  it('penempatan mitra mengalahkan status lain dan menandai tahap terakhir', () => {
    const s = buildLearningSummary({ ...base, row: row({ score: 60, placement: 'full' }), placedAt: { partnerName: 'Tebby', position: 'Content Creator' } });
    expect(s.state).toBe('ditempatkan');
    expect(s.internship).toEqual({ partnerName: 'Tebby', position: 'Content Creator' });
    expect(s.steps.every((x) => x.status === 'done')).toBe(true);
  });

  it('capstone yang belum dinilai membuat ringkasan menunggu', () => {
    expect(buildLearningSummary({ ...base, row: row({ pending: true, placement: 'pending' }) }).state).toBe('menunggu');
  });
});
