// Klien jembatan Google Calendar lewat Apps Script / Google Calendar bridge client via Apps Script

export interface CreateEventInput {
  bookingId: string;
  summary: string;
  description?: string;
  startsAt: string;
  endsAt: string;
  studentEmail: string;
  mentorEmail: string;
}

export interface CreateEventResult {
  eventId: string;
  meetUrl: string | null;
  conferenceStatus: 'success' | 'pending' | 'failure';
}

/**
 * Mengembalikan konfigurasi jembatan, atau null bila belum diatur.
 *
 * Mentoring tetap harus bisa dipesan saat Workspace belum tersambung; booking
 * yang gagal hanya karena kalender belum dikonfigurasi akan merugikan peserta.
 *
 * Returns the bridge configuration, or null when it is not set up.
 *
 * Mentoring must remain bookable while Workspace is not yet connected; failing
 * a booking merely because the calendar is unconfigured would penalise the
 * participant.
 */
function getConfig(): { url: string; secret: string } | null {
  const url = process.env.GOOGLE_CALENDAR_GAS_URL;
  const secret = process.env.GOOGLE_CALENDAR_GAS_SECRET;
  if (!url || !secret) return null;
  return { url, secret };
}

export function isCalendarConfigured(): boolean {
  return getConfig() !== null;
}

async function callBridge(action: string, payload: Record<string, unknown>): Promise<any> {
  const config = getConfig();
  if (!config) {
    throw new Error('Jembatan Google Calendar belum dikonfigurasi');
  }

  // Apps Script membalas lambat saat conference masih dibuat; batas waktu
  // mencegah permintaan booking menggantung tanpa akhir. Batasnya longgar karena
  // permintaan yang diputus tidak menghentikan Apps Script: event tetap dibuat
  // dan undangannya terkirim, tetapi tautannya tidak pernah tercatat di sini.
  //
  // Apps Script responds slowly while the conference is still being created; a
  // timeout keeps a booking request from hanging indefinitely. The limit is
  // generous because aborting does not stop Apps Script: the event is still
  // created and its invitation sent, but the link is never recorded here.
  const response = await fetch(config.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, secret: config.secret, ...payload }),
    redirect: 'follow',
    signal: AbortSignal.timeout(45_000),
  });

  if (!response.ok) {
    throw new Error(`Google Calendar HTTP ${response.status}`);
  }

  // Web App Apps Script selalu 200; kegagalan ditandai di dalam body.
  // An Apps Script Web App always returns 200; failures are flagged in the body.
  const data = await response.json();
  if (data.error) {
    throw new Error(`Google Calendar: ${data.error}`);
  }
  return data;
}

export async function createCalendarEvent(input: CreateEventInput): Promise<CreateEventResult> {
  return callBridge('create', { ...input }) as Promise<CreateEventResult>;
}

export async function cancelCalendarEvent(eventId: string): Promise<void> {
  await callBridge('cancel', { eventId });
}
