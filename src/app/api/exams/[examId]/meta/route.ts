import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { getExamById } from '@/features/exams/service';

/**
 * Satu ujian beserta pengaturannya.
 *
 * Terpisah dari daftar per kelas: penyunting soal hanya memegang examId, dan
 * memuat seluruh ujian satu kelas untuk mengambil satu judul berarti membaca
 * data yang tidak ditampilkan.
 *
 * One exam with its settings.
 *
 * Separate from the per-class list: the question editor holds only an examId,
 * and loading a whole class's exams to take one title means reading data that
 * is never shown.
 */
export async function GET(request: Request, { params }: { params: Promise<{ examId: string }> }) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }

  const { examId } = await params;
  const exam = await getExamById(examId);
  if (!exam) {
    return NextResponse.json({ error: 'Ujian tidak ditemukan' }, { status: 404 });
  }
  return NextResponse.json({ exam });
}
