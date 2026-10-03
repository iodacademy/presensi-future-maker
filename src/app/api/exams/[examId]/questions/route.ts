import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { createQuestion, listQuestionsForAdmin, reorderQuestions } from '@/features/exams/service';

/**
 * Soal beserta kunci jawabannya.
 *
 * Khusus admin. Peserta mendapatkan soalnya lewat jalur percobaan, yang tidak
 * pernah membaca koleksi kunci sama sekali.
 *
 * Questions with their answer keys.
 *
 * Admin only. Participants receive questions through the attempt route, which
 * never reads the key collection at all.
 */
export async function GET(request: Request, { params }: { params: Promise<{ examId: string }> }) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }

  const { examId } = await params;
  try {
    return NextResponse.json({ questions: await listQuestionsForAdmin(actor, examId) });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ examId: string }> }) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }

  const { examId } = await params;
  try {
    return NextResponse.json(await createQuestion(actor, examId, await request.json()));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ examId: string }> }) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }

  const { examId } = await params;
  try {
    const { order } = await request.json();
    if (!Array.isArray(order)) throw new Error('Urutan soal wajib berupa daftar id');
    await reorderQuestions(actor, examId, order);
    return NextResponse.json({ saved: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
