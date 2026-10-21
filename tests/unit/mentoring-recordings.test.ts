// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, Record<string, unknown>>();
const ref = (path: string) => ({ path, get: async () => ({ exists: store.has(path), data: () => store.get(path) }) });
vi.mock('../../src/lib/firebase/admin', () => ({
  getAdminDb: () => ({
    collection: (c: string) => ({ doc: (id: string) => ref(`${c}/${id}`) }),
    batch: () => {
      const ops: [string, Record<string, unknown>][] = [];
      return {
        update: (r: { path: string }, d: Record<string, unknown>) => void ops.push([r.path, d]),
        commit: async () => ops.forEach(([p, d]) => store.set(p, { ...store.get(p), ...d })),
      };
    },
  }),
}));

import { saveBookingRecording } from '../../src/features/mentoring/service';
import { POST } from '../../src/app/api/mentoring/recordings/route';

beforeEach(() => {
  store.clear();
  store.set('bookings/b1', { id: 'b1', slotId: 'slot1' });
  store.set('mentoringSlots/slot1', { id: 'slot1', bookingId: 'b1' });
  process.env.GOOGLE_CALENDAR_GAS_SECRET = 'rahasia';
});

describe('rekaman sesi mentoring', () => {
  it('menyimpan tautan Google Drive ke booking dan slotnya', async () => {
    await saveBookingRecording('b1', 'https://drive.google.com/file/d/F1/view');
    expect(store.get('bookings/b1')?.recordingUrl).toBe('https://drive.google.com/file/d/F1/view');
    expect(store.get('mentoringSlots/slot1')?.recordingUrl).toBe('https://drive.google.com/file/d/F1/view');
  });

  it('menolak tautan selain Google Drive', async () => {
    // Tautan ini ditampilkan kepada mentor dan peserta / This link is shown to mentors and participants
    await expect(saveBookingRecording('b1', 'javascript:alert(1)')).rejects.toThrow(/Google Drive/);
    await expect(saveBookingRecording('b1', 'https://evil.example/drive.google.com')).rejects.toThrow(/Google Drive/);
  });

  it('endpoint hanya menerima secret yang benar', async () => {
    const call = (secret: string) =>
      POST(new Request('http://x/api/mentoring/recordings', { method: 'POST', body: JSON.stringify({ secret, bookingId: 'b1', recordingUrl: 'https://drive.google.com/file/d/F1/view' }) }));
    expect((await call('salah')).status).toBe(401);
    expect((await call('rahasia')).status).toBe(200);
  });
});
