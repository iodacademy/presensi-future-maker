// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { computeExamLocks, lockMessage, type SequenceExam } from '../../src/features/exams/sequence';

const sessions = [
  { id: 's1', startsAt: '2026-10-01T12:00:00.000Z' },
  { id: 's2', startsAt: '2026-10-05T12:00:00.000Z' },
  { id: 's3', startsAt: '2026-10-20T12:00:00.000Z' },
];
const exams: SequenceExam[] = [
  { id: 'post', title: 'Postest', kind: 'posttest', sessionId: null, questionCount: 10 },
  { id: 'k2', title: 'Kuis Sesi 2', kind: 'kuis', sessionId: 's2', questionCount: 5 },
  { id: 'pre', title: 'Pretest', kind: 'pretest', sessionId: null, questionCount: 10 },
  { id: 'k1', title: 'Kuis Sesi 1', kind: 'kuis', sessionId: 's1', questionCount: 5 },
  { id: 'k3', title: 'Kuis Sesi 3', kind: 'kuis', sessionId: 's3', questionCount: 5 },
];
const now = '2026-10-12T00:00:00.000Z';
const locks = (done: string[], nowIso = now) => computeExamLocks({ exams, sessions, finishedExamIds: new Set(done), nowIso });

describe('urutan dan jadwal kuis', () => {
  it('membuka pretest lebih dulu dan mengunci kuis sesi sampai pretest selesai', () => {
    const l = locks([]);
    expect(l.get('pre')).toEqual({ locked: false });
    expect(l.get('k1')).toEqual({ locked: true, reason: 'urutan', waitingFor: 'Pretest' });
    expect(l.get('k2')).toEqual({ locked: true, reason: 'urutan', waitingFor: 'Pretest' });
  });

  it('membuka kuis berikutnya hanya setelah kuis sebelumnya dikerjakan', () => {
    const l = locks(['pre']);
    expect(l.get('k1')).toEqual({ locked: false });
    expect(l.get('k2')).toEqual({ locked: true, reason: 'urutan', waitingFor: 'Kuis Sesi 1' });
    expect(locks(['pre', 'k1']).get('k2')).toEqual({ locked: false });
  });

  it('mengunci kuis pertemuan yang belum dimulai beserta tanggal bukanya', () => {
    expect(locks(['pre', 'k1', 'k2']).get('k3')).toEqual({ locked: true, reason: 'jadwal', availableFrom: '2026-10-20T12:00:00.000Z' });
  });

  it('membuka postest setelah pretest dikerjakan dan pertemuan terakhir dimulai', () => {
    expect(locks([]).get('post')).toMatchObject({ locked: true, reason: 'pretest' });
    expect(locks(['pre']).get('post')).toEqual({ locked: true, reason: 'jadwal', availableFrom: '2026-10-20T12:00:00.000Z' });
    expect(locks(['pre'], '2026-10-20T13:00:00.000Z').get('post')).toEqual({ locked: false });
  });

  it('tidak menjadikan kuis tanpa soal sebagai syarat', () => {
    const l = computeExamLocks({
      exams: [...exams.filter((e) => e.id !== 'k1'), { id: 'k1', title: 'Kuis kosong', kind: 'kuis', sessionId: 's1', questionCount: 0 }],
      sessions,
      finishedExamIds: new Set(['pre']),
      nowIso: now,
    });
    expect(l.get('k2')).toEqual({ locked: false });
  });

  it('menulis pesan yang menyebut alasan dan tanggal', () => {
    const fmt = () => 'Selasa, 20 Oktober 2026';
    expect(lockMessage({ locked: true, reason: 'jadwal', availableFrom: 'x' }, fmt)).toBe('Dapat dikerjakan mulai Selasa, 20 Oktober 2026.');
    expect(lockMessage({ locked: true, reason: 'urutan', waitingFor: 'Kuis Sesi 1' }, fmt)).toBe('Selesaikan "Kuis Sesi 1" lebih dulu.');
    expect(lockMessage({ locked: false }, fmt)).toBeNull();
  });

  it('tidak membiarkan kuis yang lewat batas waktu mengunci kuis sesudahnya', () => {
    // Kuis Sesi 1 sudah tidak dapat dikerjakan; Kuis Sesi 2 harus tetap terbuka.
    // Kuis Sesi 1 can no longer be done; Kuis Sesi 2 must stay open.
    const l = computeExamLocks({
      exams: exams.map((e) => (e.id === 'k1' ? { ...e, dueAt: '2026-10-02T00:00:00.000Z' } : e)),
      sessions,
      finishedExamIds: new Set(['pre']),
      nowIso: now,
    });
    expect(l.get('k2')).toEqual({ locked: false });
  });
});
