// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildFeedbackReport } from '../../src/features/dashboard/feedback';
import type { SurveyFormDocument, SurveyResponseDocument } from '../../src/features/survey/types';

const form = {
  id: 'f1',
  title: 'Feedback Pasca Training',
  questions: [
    { id: 'q2', kind: 'teks', text: 'Saran', options: [], required: false, order: 2 },
    { id: 'q1', kind: 'skala', text: 'Materi mudah dipahami', options: [], required: true, order: 1 },
  ],
} as unknown as SurveyFormDocument;

const resp = (o: Partial<SurveyResponseDocument>): SurveyResponseDocument =>
  ({
    formId: 'f1', sessionId: 's1', sessionTitle: 'P1', sessionDate: '2026-10-01', classId: 'k1', className: 'Kelas A',
    studentId: 'u', studentName: 'Rahasia', submittedAt: '2026-10-01T10:00:00.000Z', answers: [], ...o,
  }) as SurveyResponseDocument;

describe('laporan feedback kelas', () => {
  const [report] = buildFeedbackReport({
    forms: [form],
    responses: [
      resp({ answers: [{ questionId: 'q1', questionText: 'Materi mudah dipahami', kind: 'skala', value: '5' }, { questionId: 'q2', questionText: 'Saran', kind: 'teks', value: ' Lebih banyak praktik ' }] }),
      resp({ submittedAt: '2026-10-01T11:00:00.000Z', answers: [{ questionId: 'q1', questionText: 'Materi mudah dipahami', kind: 'skala', value: '3' }, { questionId: 'old', questionText: 'Pertanyaan lama', kind: 'rating', value: '4' }] }),
      resp({ classId: 'k2', className: 'Kelas B', answers: [{ questionId: 'q1', questionText: 'Materi mudah dipahami', kind: 'skala', value: '4' }] }),
      resp({ formId: 'lain', answers: [{ questionId: 'q1', questionText: 'x', kind: 'skala', value: '1' }] }),
    ],
    attendeesBySessionClass: new Map([['s1_k1', 4], ['s1_k2', 2]]),
    classCities: new Map([['k1', 'Semarang'], ['k2', 'Surabaya']]),
  });

  it('mengelompokkan per pertemuan dan kelas, dengan jumlah hadirnya', () => {
    expect(report.groups.map((g) => [g.classId, g.city, g.responses, g.attendees])).toEqual([
      ['k1', 'Semarang', 2, 4],
      ['k2', 'Surabaya', 1, 2],
    ]);
  });

  it('menjumlah nilai dan sebarannya, tanpa jawaban formulir lain', () => {
    expect(report.groups[0].tallies.q1).toEqual({ sum: 8, count: 2, dist: { '5': 1, '3': 1 } });
  });

  it('mengurutkan pertanyaan dan tetap memuat pertanyaan yang sudah dihapus', () => {
    expect(report.questions.map((q) => q.id)).toEqual(['q1', 'q2', 'old']);
  });

  it('menyimpan isian bebas beserta nama dan kelas peserta', () => {
    // Admin perlu menindaklanjuti masukan langsung ke orangnya.
    // Admins need to follow up on feedback with the person directly.
    expect(report.texts).toEqual([
      { questionId: 'q2', text: 'Lebih banyak praktik', sessionId: 's1', classId: 'k1', className: 'Kelas A', studentName: 'Rahasia', submittedAt: '2026-10-01T10:00:00.000Z' },
    ]);
    expect(report.textTotal).toBe(1);
  });
});
