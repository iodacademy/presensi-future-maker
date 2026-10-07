import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { cancelBookingByAdmin, cancelBookingByStudent } from '@/features/mentoring/service';

// Admin membatalkan booking siapa pun; peserta hanya booking miliknya sebelum sesi dimulai.
// Admins cancel any booking; participants only their own, before the session starts.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const actor = await getSessionActor();
  if (!actor || (actor.role !== 'admin' && actor.role !== 'student')) {
    return NextResponse.json({ error: 'Anda tidak diizinkan membatalkan sesi mentoring' }, { status: 403 });
  }

  const { bookingId } = await params;
  try {
    if (actor.role === 'admin') await cancelBookingByAdmin(actor, bookingId);
    else await cancelBookingByStudent(actor, bookingId);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
