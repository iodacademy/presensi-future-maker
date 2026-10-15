import { describe, expect, it, vi, afterEach } from 'vitest';

async function loadClient() {
  vi.resetModules();
  return import('../../src/features/calendar/client');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('calendar client', () => {
  it('menyatakan belum terkonfigurasi bila env kosong', async () => {
    vi.stubEnv('GOOGLE_CALENDAR_GAS_URL', '');
    vi.stubEnv('GOOGLE_CALENDAR_GAS_SECRET', '');
    const { isCalendarConfigured } = await loadClient();
    expect(isCalendarConfigured()).toBe(false);
  });

  it('menyatakan terkonfigurasi bila kedua env terisi', async () => {
    vi.stubEnv('GOOGLE_CALENDAR_GAS_URL', 'https://script.google.com/macros/s/x/exec');
    vi.stubEnv('GOOGLE_CALENDAR_GAS_SECRET', 'rahasia');
    const { isCalendarConfigured } = await loadClient();
    expect(isCalendarConfigured()).toBe(true);
  });

  it('mengirim secret di body dan mengembalikan meetUrl', async () => {
    vi.stubEnv('GOOGLE_CALENDAR_GAS_URL', 'https://script.google.com/macros/s/x/exec');
    vi.stubEnv('GOOGLE_CALENDAR_GAS_SECRET', 'rahasia');

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ eventId: 'evt1', meetUrl: 'https://meet.google.com/abc-defg-hij', conferenceStatus: 'success' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { createCalendarEvent } = await loadClient();
    const result = await createCalendarEvent({
      bookingId: 'b1',
      summary: 'Mentoring',
      startsAt: '2026-09-25T02:00:00.000Z',
      endsAt: '2026-09-25T02:45:00.000Z',
      studentEmail: 'siswa@gmail.com',
      mentorEmail: 'mentor@futuremakers.id',
    });

    expect(result.meetUrl).toBe('https://meet.google.com/abc-defg-hij');
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.secret).toBe('rahasia');
    expect(sent.action).toBe('create');
    expect(sent.bookingId).toBe('b1');
  });

  it('melempar error saat Apps Script membalas 200 dengan field error', async () => {
    // Web App Apps Script selalu 200; kegagalan hanya terlihat di body.
    // An Apps Script Web App always returns 200; failures show only in the body.
    vi.stubEnv('GOOGLE_CALENDAR_GAS_URL', 'https://script.google.com/macros/s/x/exec');
    vi.stubEnv('GOOGLE_CALENDAR_GAS_SECRET', 'rahasia');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, text: async () => JSON.stringify({ error: 'unauthorized' }) })
    );

    const { cancelCalendarEvent } = await loadClient();
    await expect(cancelCalendarEvent('evt1')).rejects.toThrow(/unauthorized/);
  });
});
