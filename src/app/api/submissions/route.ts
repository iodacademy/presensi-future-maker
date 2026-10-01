import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import type { TaskKind } from '@/features/tasks/types';
import { listSubmissionsForAdmin } from '@/features/tasks/submission-service';

export async function GET(request: Request) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const kind = searchParams.get('kind') as TaskKind | null;
  const classId = searchParams.get('classId') || undefined;
  // Tanpa parameter graded, keduanya dikembalikan: penyaring yang selalu aktif
  // membuat pemanggil lama kehilangan separuh barisnya tanpa perubahan apa pun
  // di pihaknya.
  //
  // With no graded parameter both come back: an always-on filter would lose
  // existing callers half their rows with no change on their side.
  const gradedParam = searchParams.get('graded');

  try {
    const submissions = await listSubmissionsForAdmin(actor, {
      kind: kind || undefined,
      classId,
      graded: gradedParam === null ? undefined : gradedParam === 'true',
    });
    return NextResponse.json({ submissions });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
