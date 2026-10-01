import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { createExam, listExamsForClass, listExamsForStudent } from '@/features/exams/service';

/**
 * Daftar ujian. Admin melihat ujian satu kelas, peserta melihat ujiannya
 * sendiri beserta sisa kesempatannya.
 *
 * Lists exams. An admin sees one class's exams, a participant sees their own
 * along with their remaining attempts.
 */
export async function GET(request: Request) {
  const actor = await getSessionActor();
  if (!actor) {
    return NextResponse.json({ error: 'Masuk terlebih dahulu' }, { status: 401 });
  }

  try {
    if (actor.role === 'student') {
      return NextResponse.json({ exams: await listExamsForStudent(actor) });
    }

    if (actor.role !== 'admin') {
      return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
    }

    const classId = new URL(request.url).searchParams.get('classId');
    if (!classId) {
      return NextResponse.json({ error: 'classId wajib disertakan' }, { status: 400 });
    }
    return NextResponse.json({ exams: await listExamsForClass(classId) });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }

  try {
    return NextResponse.json(await createExam(actor, await request.json()));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
