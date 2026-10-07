import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { moveSessionContent } from '@/features/attendance/service';

// Memindahkan satu isi pertemuan ke golongan lain / Moves one meeting item to another group
export async function PATCH(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }

  const { sessionId } = await params;
  try {
    const body = await request.json();
    await moveSessionContent(actor, { sessionId, itemId: String(body.itemId ?? ''), to: String(body.to ?? '') });
    return NextResponse.json({ moved: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
