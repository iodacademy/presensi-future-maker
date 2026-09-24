import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { addSessionRecording, removeSessionRecording } from '@/features/attendance/service';

// Menambah satu rekaman ke sesi / Adds one recording to a session
export async function POST(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }

  const { sessionId } = await params;
  try {
    const body = await request.json();
    await addSessionRecording(actor, {
      sessionId,
      label: body.label ?? '',
      url: body.url ?? '',
    });
    return NextResponse.json({ added: true }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

// Menghapus satu rekaman dari sesi / Removes one recording from a session
export async function DELETE(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }

  const { sessionId } = await params;
  const recordingId = new URL(request.url).searchParams.get('recordingId');
  if (!recordingId) {
    return NextResponse.json({ error: 'recordingId wajib disertakan' }, { status: 400 });
  }

  try {
    await removeSessionRecording(actor, { sessionId, recordingId });
    return NextResponse.json({ removed: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
