import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { retryBookingCalendarEvent } from '@/features/mentoring/service';

// Admin membuat ulang link Meet untuk booking yang belum memilikinya.
// Admins recreate the Meet link for a booking that has none.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang dapat membuat ulang link Meet' }, { status: 403 });
  }

  const { bookingId } = await params;
  try {
    const meetUrl = await retryBookingCalendarEvent(actor, bookingId);
    return NextResponse.json({ meetUrl });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
