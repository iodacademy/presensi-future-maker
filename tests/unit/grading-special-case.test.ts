// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { withSpecialCases } from '../../src/features/grading/special-case';
import { gradeParticipant } from '../../src/features/grading/policy';

describe('nilai kasus khusus', () => {
  it('menggantikan nilai tugas yang ditetapkan saja, tanpa mengubah peta aslinya', () => {
    const asli = new Map([['s1', new Map<string, number | null>([['t1', 25], ['t2', 0], ['c1', 40]])]]);
    const hasil = withSpecialCases(asli, [{ studentId: 's1', scores: { t1: 75 } }, { studentId: 's2', scores: { t1: 60 } }]);
    expect([...hasil.get('s1')!]).toEqual([['t1', 75], ['t2', 0], ['c1', 40]]);
    expect([...hasil.get('s2')!]).toEqual([['t1', 60]]);
    expect(asli.get('s1')!.get('t1')).toBe(25);
  });

  it('nilai akhir menandai komponen tugas dan capstone sebagai kasus khusus', () => {
    const hasil = gradeParticipant({
      sessions: [], joinIso: '', recorded: () => false, present: () => false,
      taskIds: ['t1'], taskScore: () => 75, examIds: [], quizScore: () => null,
      capstoneTaskIds: ['c1'], capstone: null, specialCase: true,
    });
    expect(hasil.breakdown.find((b) => b.component === 'tasks')!.detail).toMatch(/kasus khusus/);
    expect(hasil.breakdown.find((b) => b.component === 'capstone')!.detail).toMatch(/kasus khusus/);
  });
});
