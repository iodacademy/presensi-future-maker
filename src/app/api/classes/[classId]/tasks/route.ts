import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { createTask, listTasksForClass } from '@/features/tasks/service';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ classId: string }> }
) {
  // Daftar tugas per kelas dipakai Course Builder admin. Siswa memakai
  // /api/tasks/student yang sudah terikat ke actor.classId.
  //
  // Per-class task list is for the admin Course Builder. Students use
  // /api/tasks/student, which is already scoped to actor.classId.
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }

  const { classId } = await params;
  try {
    const tasks = await listTasksForClass(classId);
    return NextResponse.json({ tasks });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ classId: string }> }
) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }

  const { classId } = await params;
  try {
    const body = await request.json();
    const result = await createTask(actor, { ...body, classId });
    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
