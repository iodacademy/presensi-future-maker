import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { deleteSession, getSessionDeletionImpact } from '@/features/admin/delete-service';
import { setSessionRecording } from '@/features/attendance/service';

// Ringkasan dampak sebelum penghapusan / Impact summary before deletion
export async function GET(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }

  const { sessionId } = await params;
  try {
    return NextResponse.json(await getSessionDeletionImpact(actor, sessionId));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 404 });
  }
}

// Menyimpan tautan rekaman sesi / Stores the session recording link
export async function PATCH(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }

  const { sessionId } = await params;
  try {
    const body = await request.json();
    await setSessionRecording(actor, {
      sessionId,
      recordingUrl: body.recordingUrl ?? null,
      recordingNote: body.recordingNote ?? null,
    });
    return NextResponse.json({ saved: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }

  const { sessionId } = await params;
  try {
    await deleteSession(actor, sessionId);
    return NextResponse.json({ deleted: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
