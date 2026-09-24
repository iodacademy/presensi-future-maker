import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { addTaskMaterial, removeTaskMaterial } from '@/features/tasks/service';

// Menambah satu bahan praktik pada tugas / Adds one practice material to a task
export async function POST(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }

  const { taskId } = await params;
  try {
    const body = await request.json();
    await addTaskMaterial(actor, {
      taskId,
      label: body.label ?? '',
      url: body.url ?? '',
      kind: body.kind,
    });
    return NextResponse.json({ added: true }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

// Menghapus satu bahan praktik / Removes one practice material
export async function DELETE(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }

  const { taskId } = await params;
  const materialId = new URL(request.url).searchParams.get('materialId');
  if (!materialId) {
    return NextResponse.json({ error: 'materialId wajib disertakan' }, { status: 400 });
  }

  try {
    await removeTaskMaterial(actor, taskId, materialId);
    return NextResponse.json({ removed: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
