// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { data, fakeDb, fakeStorage, reset, selects } from './careers-fake-db';

const getSessionActor = vi.fn();
vi.mock('../../src/features/auth/session', () => ({ getSessionActor: () => getSessionActor() }));
vi.mock('../../src/lib/firebase/admin', () => ({ getAdminDb: () => fakeDb, getAdminStorage: () => fakeStorage }));

import { getApplicationForAdmin, listApplicants, setApplicationStatus } from '../../src/features/careers/applicants-service';
import { GET as listGet } from '../../src/app/api/karier/jobs/[id]/applications/route';

const personal = { fullName: 'Andi Pratama', email: 'andi@x.id', phone: '0812', city: 'Semarang', school: 'SMK 1', major: 'RPL', linkedin: '' };
const app = (jobId: string, uid: string) => ({
  jobId, studentId: uid, classId: 'k1', number: 'FM-JOB-0001', personal, cvId: 'cv1', portfolioUrl: '', status: 'baru', rejectReason: '',
  finalScore: 82, finalScorePending: true, finalScoreAt: '2026-11-04', submittedAt: '2026-11-05T00:00:00Z', statusChangedAt: '2026-11-05T00:00:00Z',
  answers: { q1: 'Suka' }, works: [], tasks: [],
});

beforeEach(() => {
  reset({
    jobApplications: { j1_u1: app('j1', 'u1'), j2_u2: app('j2', 'u2') },
    classes: { k1: { canonicalName: 'Web Programming · Semarang' } },
    jobs: { j1: { questions: [{ id: 'q1', label: 'Kenapa?', kind: 'long', options: [], required: true }] } },
  });
  getSessionActor.mockResolvedValue({ uid: 'a', role: 'admin' });
});

describe('pelamar untuk admin', () => {
  it('hanya pelamar lowongan itu, tanpa membaca jawaban', async () => {
    const rows = await listApplicants('j1');
    expect(rows.map((r) => r.id)).toEqual(['j1_u1']);
    expect(rows[0]).toMatchObject({ fullName: 'Andi Pratama', className: 'Web Programming · Semarang', finalScore: 82, finalScorePending: true });
    expect(selects.jobApplications.flat()).not.toContain('answers');
  });

  it('detail membawa pertanyaan lowongan dan nama kelas', async () => {
    const a = await getApplicationForAdmin('j1_u1');
    expect(a.questions[0].label).toBe('Kenapa?');
    expect(a.className).toBe('Web Programming · Semarang');
  });

  it('status jawaban kandidat tidak bisa dipilih admin, dan lamaran final tidak bisa diubah', async () => {
    await expect(setApplicationStatus('j1_u1', 'bergabung')).rejects.toThrow('Status ini hanya bisa dari jawaban kandidat');
    data.jobApplications.j1_u1.status = 'ditutup';
    await expect(setApplicationStatus('j1_u1', 'ditinjau')).rejects.toThrow('Lamaran ini sudah final');
  });

  it('status tak dikenal ditolak', async () => {
    await expect(setApplicationStatus('j1_u1', 'lolos')).rejects.toThrow('Status lamaran tidak dikenal');
  });

  it('alasan internal hanya disimpan untuk tidak lolos', async () => {
    await setApplicationStatus('j1_u1', 'tidak-lolos', 'Skill belum sesuai');
    expect(data.jobApplications.j1_u1).toMatchObject({ status: 'tidak-lolos', rejectReason: 'Skill belum sesuai' });
    await setApplicationStatus('j1_u1', 'ditinjau', 'abaikan');
    expect(data.jobApplications.j1_u1).toMatchObject({ status: 'ditinjau', rejectReason: '' });
    expect(data.jobApplications.j1_u1.statusChangedAt).not.toBe('2026-11-05T00:00:00Z');
  });

  it('siswa tidak bisa membuka daftar pelamar', async () => {
    getSessionActor.mockResolvedValue({ uid: 'u1', role: 'student' });
    expect((await listGet(new Request('http://x'), { params: Promise.resolve({ id: 'j1' }) })).status).toBe(403);
  });
});
