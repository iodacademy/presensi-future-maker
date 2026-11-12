// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { data, fakeDb, reset } from './careers-fake-db';

const getSessionActor = vi.fn();
const cancel = vi.fn(async (_id: string) => undefined);
vi.mock('../../src/features/auth/session', () => ({ getSessionActor: () => getSessionActor() }));
vi.mock('../../src/lib/firebase/admin', () => ({ getAdminDb: () => fakeDb }));
vi.mock('../../src/features/calendar/client', () => ({ cancelCalendarEvent: (id: string) => cancel(id) }));

import { resetDemoAccounts } from '../../src/features/careers/demo-service';
import { POST } from '../../src/app/api/karier/demo/reset/route';

beforeEach(() => {
  cancel.mockClear();
  reset({
    users: {
      demo1: { role: 'student', classId: 'demo', name: 'Siswa Demo' },
      asli: { role: 'student', classId: 'k1', name: 'Andi' },
    },
    jobs: {
      jd: { title: 'Web (Demo)', applicantCount: 1, eligibility: { mode: 'classes', classIds: ['demo'] } },
      jk: { title: 'Kelas tertentu', applicantCount: 3, eligibility: { mode: 'classes', classIds: ['k1'] } },
      ja: { title: 'Asli', applicantCount: 5, eligibility: { mode: 'all' } },
    },
    jobApplications: {
      jd_demo1: { jobId: 'jd', studentId: 'demo1', status: 'interview', interview: { calendarEventId: 'ev-demo' } },
      ja_asli: { jobId: 'ja', studentId: 'asli', status: 'baru' },
    },
    studentCvs: { cv1: { ownerUid: 'demo1', kind: 'cv' } },
  });
  getSessionActor.mockResolvedValue({ uid: 'adm', role: 'admin' });
});

describe('reset akun demo', () => {
  it('menghapus lamaran akun demo dan membatalkan interviewnya, tanpa menyentuh data asli', async () => {
    expect(await resetDemoAccounts()).toEqual({ applications: 1, jobs: 1 });
    expect(data.jobApplications.jd_demo1).toBeUndefined();
    expect(data.jobApplications.ja_asli).toBeDefined();
    expect(cancel).toHaveBeenCalledWith('ev-demo');
    expect(data.jobs.jd.applicantCount).toBe(0);
    expect(data.jobs.jk.applicantCount).toBe(3);
    expect(data.jobs.ja.applicantCount).toBe(5);
    expect(data.studentCvs.cv1).toBeDefined();
  });

  it('hanya admin yang bisa menjalankannya', async () => {
    getSessionActor.mockResolvedValue({ uid: 'u1', role: 'student', classId: 'demo' });
    expect((await POST()).status).toBe(403);
    expect(data.jobApplications.jd_demo1).toBeDefined();
  });
});
