import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { cancelBookingByAdmin } from '@/features/mentoring/service';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan membatalkan sesi mentoring' }, { status: 403 });
  }

  const { bookingId } = await params;
  try {
    await cancelBookingByAdmin(actor, bookingId);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
