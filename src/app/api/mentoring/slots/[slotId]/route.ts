import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { deleteMentoringSlot, getSlotDeletionImpact } from '@/features/admin/delete-service';

// Ringkasan dampak sebelum penghapusan / Impact summary before deletion
export async function GET(request: Request, { params }: { params: Promise<{ slotId: string }> }) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }

  const { slotId } = await params;
  try {
    return NextResponse.json(await getSlotDeletionImpact(actor, slotId));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 404 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ slotId: string }> }) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }

  const { slotId } = await params;
  try {
    await deleteMentoringSlot(actor, slotId);
    return NextResponse.json({ deleted: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
