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
  //
  // Google membalas halaman HTML, bukan JSON, bila skripnya tidak sempat
  // berjalan: izin belum disetujui, deployment berubah, atau batas eksekusi.
  // Judul halamannya yang dilaporkan, bukan galat penguraian JSON yang tidak
  // memberi tahu apa pun.
  // Google replies with an HTML page rather than JSON when the script never
  // got to run: permission not granted, deployment changed, or an execution
  // limit. Its title is reported, not a JSON parse error that says nothing.
  const text = await response.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    const title = text.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim();
    const body = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
    throw new Error(`Apps Script membalas halaman error, bukan JSON: ${title || body || 'tanpa isi'}. Coba lagi beberapa saat lagi.`);
  }
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

/**
 * Mengganti ruang Meet event yang sudah ada dengan ruang yang mentornya
 * co-host, tanpa mengirim email kepada tamu.
 *
 * Replaces an existing event's Meet space with one where the mentor is
 * co-host, without emailing the guests.
 */
export async function refreshMeetSpace(input: { eventId: string; mentorEmail: string; studentEmail: string }): Promise<{ meetUrl: string }> {
  return callBridge('refreshMeet', { ...input }) as Promise<{ meetUrl: string }>;
}
