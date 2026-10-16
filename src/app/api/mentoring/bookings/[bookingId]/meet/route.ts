import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { refreshBookingMeet, retryBookingCalendarEvent } from '@/features/mentoring/service';

// Admin membuat link Meet untuk booking yang belum memilikinya, atau dengan
// { refresh: true } mengganti ruang Meet-nya agar mentor menjadi co-host.
// Admins create the Meet link for a booking that has none, or with
// { refresh: true } replace its Meet space so the mentor becomes co-host.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang dapat membuat ulang link Meet' }, { status: 403 });
  }

  const { bookingId } = await params;
  try {
    const body = await request.json().catch(() => ({}));
    const meetUrl = body?.refresh === true
      ? await refreshBookingMeet(actor, bookingId)
      : await retryBookingCalendarEvent(actor, bookingId);
    return NextResponse.json({ meetUrl });
  } catch (err: any) {
    if (err.retryAfter) {
      return NextResponse.json({ error: err.message, retryAfter: err.retryAfter }, { status: 429 });
    }
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
