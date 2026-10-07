// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

// Firestore palsu: koleksi slot mengembalikan seluruh slot mentor; penyaringan
// yang diuji adalah milik layanan, bukan kueri.
// Fake Firestore: the slot collection returns every slot of the mentor; the
// filtering under test belongs to the service, not the query.
const future = '2999-01-01T03:00:00.000Z';
const past = '2000-01-01T03:00:00.000Z';
const slots = [
  { id: 'open', status: 'available', studentId: null, studentName: null, meetUrl: null, startsAt: future },
  { id: 'mine', status: 'booked', studentId: 'me', studentName: 'Saya', meetUrl: 'https://meet.google.com/me', startsAt: future },
  { id: 'mine-past', status: 'booked', studentId: 'me', studentName: 'Saya', meetUrl: null, startsAt: past },
  { id: 'other', status: 'booked', studentId: 'x', studentName: 'Peserta Lain', meetUrl: 'https://meet.google.com/other', startsAt: future },
  { id: 'open-past', status: 'available', studentId: null, studentName: null, meetUrl: null, startsAt: past },
];
vi.mock('../../src/lib/firebase/admin', () => ({
  getAdminDb: () => ({
    collection: (name: string) => {
      const query = {
        where: () => query,
        get: async () => ({ docs: (name === 'mentoringSlots' ? slots : []).map((d) => ({ data: () => d })) }),
        doc: (id: string) => ({
          get: async () =>
            name === 'users'
              ? { exists: true, data: () => ({ uid: id, name: 'Mentor', email: 'm@x.id' }) }
              : { exists: false, data: () => undefined },
        }),
      };
      return query;
    },
  }),
}));
vi.mock('../../src/features/assignments/service', () => ({ getStudentAssignment: async () => ({ mentorId: 'm1' }) }));

import { getMentoringViewForStudent } from '../../src/features/mentoring/service';

describe('slot mentoring yang diterima peserta', () => {
  it('hanya slot yang masih bisa dipilih dan booking miliknya sendiri', async () => {
    const view = await getMentoringViewForStudent({ uid: 'me', email: 'me@x.id', name: 'Saya', role: 'student', classId: 'k1' }, 'bootcamp');
    expect(view.slots.map((s) => s.id).sort()).toEqual(['mine', 'mine-past', 'open']);
    // Nama dan tautan Meet peserta lain tidak boleh ikut terkirim.
    // Another participant's name and Meet link must never be sent.
    expect(JSON.stringify(view)).not.toContain('Peserta Lain');
    expect(JSON.stringify(view)).not.toContain('meet.google.com/other');
  });
});
