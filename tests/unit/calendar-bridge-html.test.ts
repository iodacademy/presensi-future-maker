// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { refreshMeetSpace } from '../../src/features/calendar/client';

afterEach(() => vi.unstubAllGlobals());

describe('jembatan Apps Script yang membalas HTML', () => {
  it('melaporkan judul halaman error, bukan galat penguraian JSON', async () => {
    process.env.GOOGLE_CALENDAR_GAS_URL = 'https://script.google.com/x/exec';
    process.env.GOOGLE_CALENDAR_GAS_SECRET = 's';
    vi.stubGlobal('fetch', async () => new Response('<!DOCTYPE html><html><head><title>Authorization is required</title></head><body>x</body></html>', { status: 200 }));
    await expect(refreshMeetSpace({ eventId: 'e', mentorEmail: 'm@x.id', studentEmail: 's@x.id' })).rejects.toThrow(/halaman error, bukan JSON: Authorization is required/);
  });
});
