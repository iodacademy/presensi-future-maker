import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { publishExams } from '@/features/exams/service';

// Menerbitkan beberapa ujian satu kelas sekaligus, dipakai setelah impor soal
// Publishes several of one class's exams at once, used after a question import
export async function POST(request: Request) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }

  try {
    const { classId, examIds } = await request.json();
    if (!classId) throw new Error('Kelas wajib disebutkan');
    if (!Array.isArray(examIds)) throw new Error('Daftar ujian wajib berupa daftar');

    return NextResponse.json(await publishExams(actor, classId, examIds));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
