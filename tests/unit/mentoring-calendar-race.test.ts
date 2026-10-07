// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Firestore palsu dalam memori dengan transaksi sederhana.
// In-memory fake Firestore with a simple transaction.
const store = new Map<string, Record<string, unknown>>();
const ref = (path: string) => ({
  path,
  get: async () => ({ exists: store.has(path), data: () => store.get(path) }),
  update: async (d: Record<string, unknown>) => void store.set(path, { ...store.get(path), ...d }),
});
vi.mock('../../src/lib/firebase/admin', () => ({
  getAdminDb: () => ({
    collection: (c: string) => ({ doc: (id: string) => ref(`${c}/${id}`) }),
    runTransaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        get: (r: { get: () => unknown }) => r.get(),
        set: (r: { path: string }, d: Record<string, unknown>) => void store.set(r.path, { ...d }),
        update: (r: { path: string }, d: Record<string, unknown>) => void store.set(r.path, { ...store.get(r.path), ...d }),
      }),
  }),
}));
vi.mock('../../src/features/assignments/service', () => ({
  getStudentAssignment: async () => ({ mentorId: 'm1' }),
}));

const cancelled: string[] = [];
let duringCreate: () => void = () => {};
vi.mock('../../src/features/calendar/client', () => ({
  isCalendarConfigured: () => true,
  createCalendarEvent: async () => {
    duringCreate();
    return { eventId: 'evt-A', meetUrl: 'https://meet.google.com/aaa-aaaa-aaa', conferenceStatus: 'success' };
  },
  cancelCalendarEvent: async (id: string) => void cancelled.push(id),
}));

import { bookMentoringSlot } from '../../src/features/mentoring/service';

const student = { uid: 'sA', email: 'a@x.id', name: 'Peserta A', role: 'student' as const, classId: 'k1' };

beforeEach(() => {
  store.clear();
  cancelled.length = 0;
  duringCreate = () => {};
  store.set('mentoringSlots/slot1', {
    id: 'slot1', classId: 'k1', phase: 'bootcamp', mentorId: 'm1', mentorName: 'Mentor', date: '2999-01-01',
    startTime: '10:00', endTime: '10:45', startsAt: '2999-01-01T03:00:00.000Z', endsAt: '2999-01-01T03:45:00.000Z',
    status: 'available', bookingId: null, studentId: null, studentName: null, meetUrl: null, calendarEventId: null,
    createdAt: '2998-12-31T00:00:00.000Z', updatedAt: '',
  });
  store.set('users/m1', { email: 'mentor@x.id' });
});

describe('event kalender mentoring dan pembatalan yang bersamaan', () => {
  it('menyimpan tautan Meet bila booking masih aktif', async () => {
    const { meetUrl } = await bookMentoringSlot(student, { slotId: 'slot1' });
    expect(meetUrl).toBe('https://meet.google.com/aaa-aaaa-aaa');
    expect(store.get('mentoringSlots/slot1')?.meetUrl).toBe('https://meet.google.com/aaa-aaaa-aaa');
    expect(cancelled).toEqual([]);
  });

  it('tidak menempelkan tautan ke slot yang sudah diambil peserta lain, dan membatalkan event yatim', async () => {
    // Selama event dibuat, booking A dibatalkan dan slotnya diambil peserta B.
    // While the event is being created, A's booking is cancelled and B takes the slot.
    duringCreate = () => {
      for (const [path, doc] of store) {
        if (path.startsWith('bookings/')) store.set(path, { ...doc, status: 'cancelled' });
      }
      store.set('mentoringSlots/slot1', { ...store.get('mentoringSlots/slot1'), bookingId: 'booking-B', studentId: 'sB', meetUrl: null });
    };

    const { meetUrl } = await bookMentoringSlot(student, { slotId: 'slot1' });
    expect(meetUrl).toBeNull();
    expect(store.get('mentoringSlots/slot1')?.meetUrl).toBeNull();
    expect(cancelled).toEqual(['evt-A']);
  });
});
