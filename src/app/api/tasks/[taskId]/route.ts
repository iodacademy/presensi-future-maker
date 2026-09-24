import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { deleteTask, getTaskDeletionImpact } from '@/features/admin/delete-service';

// Ringkasan dampak sebelum penghapusan / Impact summary before deletion
export async function GET(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }

  const { taskId } = await params;
  try {
    return NextResponse.json(await getTaskDeletionImpact(actor, taskId));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 404 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }

  const { taskId } = await params;
  try {
    await deleteTask(actor, taskId);
    return NextResponse.json({ deleted: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
