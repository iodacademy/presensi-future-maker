import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { submitTask } from '@/features/tasks/submission-service';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'student') {
    return NextResponse.json({ error: 'Hanya siswa yang diizinkan' }, { status: 403 });
  }

  const { taskId } = await params;

  try {
    const body = await request.json();
    const result = await submitTask(actor, {
      taskId,
      // Berkas hanya dapat dipasang lewat rute unggah, yang menyimpannya lebih dulu.
      // A file can only be attached through the upload route, which stores it first.
      fileId: null,
      fileName: null,
      url: body.url,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
