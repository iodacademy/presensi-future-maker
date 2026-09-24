import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { getQrMonitorData, setSessionAttendanceOverride } from '@/features/attendance/service';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan memantau monitor QR' }, { status: 403 });
  }

  const { sessionId } = await params;
  try {
    const data = await getQrMonitorData(actor, sessionId);
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan mengubah status presensi' }, { status: 403 });
  }

  const { sessionId } = await params;
  try {
    const body = await request.json();
    await setSessionAttendanceOverride(actor, sessionId, body.override);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
