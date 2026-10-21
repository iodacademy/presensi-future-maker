import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { saveBookingRecording } from '@/features/mentoring/service';

/**
 * Apps Script mengirim tautan rekaman sesi mentoring ke sini setelah sesinya
 * selesai. Tidak ada sesi login: pengirimnya dibuktikan lewat secret yang sama
 * dengan jembatan kalender, dibandingkan dalam waktu tetap.
 *
 * Apps Script sends a mentoring session's recording link here once the session
 * is over. There is no login session: the sender is proven through the same
 * secret as the calendar bridge, compared in constant time.
 */
export async function POST(request: Request) {
  const expected = process.env.GOOGLE_CALENDAR_GAS_SECRET;
  if (!expected) {
    return NextResponse.json({ error: 'Belum dikonfigurasi' }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const given = Buffer.from(String(body?.secret ?? ''));
  const want = Buffer.from(expected);
  if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const { shareWith } = await saveBookingRecording(String(body.bookingId ?? ''), String(body.recordingUrl ?? ''));
    return NextResponse.json({ saved: true, shareWith });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
