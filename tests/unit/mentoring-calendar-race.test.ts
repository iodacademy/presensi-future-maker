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
  refreshMeetSpace: async (input: { eventId: string }) => {
    refreshed.push(input.eventId);
    return { meetUrl: 'https://meet.google.com/new-cohost' };
  },
}));
const refreshed: string[] = [];

import { bookMentoringSlot, refreshBookingMeet, retryBookingCalendarEvent } from '../../src/features/mentoring/service';

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

describe('admin membuat ulang link Meet', () => {
  const admin = { uid: 'ad', email: 'admin@x.id', name: 'Admin', role: 'admin' as const, classId: null };
  const seedBooking = (extra: Record<string, unknown> = {}) => {
    store.set('bookings/b1', { id: 'b1', slotId: 'slot1', studentId: 'sA', studentName: 'Peserta A', status: 'confirmed', meetUrl: null, calendarEventId: null, ...extra });
    store.set('mentoringSlots/slot1', { ...store.get('mentoringSlots/slot1'), status: 'booked', bookingId: 'b1' });
    store.set('users/sA', { email: 'a@x.id' });
  };

  it('membuat event untuk booking tanpa tautan', async () => {
    seedBooking();
    await expect(retryBookingCalendarEvent(admin, 'b1')).resolves.toBe('https://meet.google.com/aaa-aaaa-aaa');
    expect(store.get('bookings/b1')?.calendarEventId).toBe('evt-A');
  });

  it('tidak membuat undangan ganda bila percobaan lain sudah mencatat event', async () => {
    // Dua klik bersamaan: yang kedua selesai setelah yang pertama tercatat.
    // Two concurrent clicks: the second finishes after the first was recorded.
    seedBooking();
    duringCreate = () => store.set('bookings/b1', { ...store.get('bookings/b1'), calendarEventId: 'evt-first' });
    await expect(retryBookingCalendarEvent(admin, 'b1')).rejects.toThrow(/belum berhasil/);
    expect(cancelled).toEqual(['evt-A']);
    expect(store.get('bookings/b1')?.calendarEventId).toBe('evt-first');
  });

  it('hanya untuk admin', async () => {
    seedBooking();
    await expect(retryBookingCalendarEvent(student, 'b1')).rejects.toThrow(/admin/);
  });
});

describe('admin memperbarui link Meet booking lama tanpa email', () => {
  const admin = { uid: 'ad', email: 'admin@x.id', name: 'Admin', role: 'admin' as const, classId: null };
  const seed = (extra: Record<string, unknown> = {}) => {
    store.set('bookings/b2', { id: 'b2', slotId: 'slot1', studentId: 'sA', mentorId: 'm1', studentName: 'Peserta A', status: 'confirmed', endsAt: '2999-01-01T03:45:00.000Z', meetUrl: 'https://meet.google.com/old', calendarEventId: 'evt-old', ...extra });
    store.set('mentoringSlots/slot1', { ...store.get('mentoringSlots/slot1'), status: 'booked', bookingId: 'b2', meetUrl: 'https://meet.google.com/old' });
    store.set('users/sA', { email: 'a@x.id' });
  };

  it('memperbarui event yang sama dan menyimpan tautan barunya, tanpa membatalkan apa pun', async () => {
    refreshed.length = 0;
    seed();
    await expect(refreshBookingMeet(admin, 'b2')).resolves.toBe('https://meet.google.com/new-cohost');
    expect(refreshed).toEqual(['evt-old']);
    expect(cancelled).toEqual([]);
    expect(store.get('bookings/b2')?.meetUrl).toBe('https://meet.google.com/new-cohost');
    expect(store.get('bookings/b2')?.calendarEventId).toBe('evt-old');
    expect(store.get('mentoringSlots/slot1')?.meetUrl).toBe('https://meet.google.com/new-cohost');
  });

  it('menolak sesi yang sudah selesai dan booking tanpa undangan', async () => {
    seed({ endsAt: '2000-01-01T00:00:00.000Z' });
    await expect(refreshBookingMeet(admin, 'b2')).rejects.toThrow(/sudah selesai/);
    seed({ calendarEventId: null });
    await expect(refreshBookingMeet(admin, 'b2')).rejects.toThrow(/belum punya undangan/);
  });
});
