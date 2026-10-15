import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { uploadSubmissionFile } from '@/features/tasks/submission-file';
import { MAX_FILE_SIZE_BYTES } from '@/features/tasks/submission-policy';

// Peserta mengunggah berkas tugas / A participant uploads a task file
export async function POST(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'student') {
    return NextResponse.json({ error: 'Hanya peserta yang diizinkan' }, { status: 403 });
  }

  const { taskId } = await params;
  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Berkas wajib disertakan' }, { status: 400 });
    }
    // Ukuran diperiksa sebelum dibaca ke memori / The size is checked before reading into memory
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: `Ukuran berkas maksimal ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB` }, { status: 400 });
    }
    const result = await uploadSubmissionFile(actor, taskId, { buffer: Buffer.from(await file.arrayBuffer()), fileName: file.name });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
