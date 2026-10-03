import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { importQuestionsForClass } from '@/features/exams/service';

/**
 * Impor soal beberapa ujian satu kelas sekaligus.
 *
 * Berkasnya dibaca di peramban dan dikirim sudah terurai, sama seperti impor
 * satu ujian: membaca xlsx di server menuntut memuat pustaka pembacanya pada
 * tiap permintaan, sedangkan peramban sudah memuatnya untuk pratinjau.
 *
 * Imports several of a class's exams' questions at once.
 *
 * The sheet is parsed in the browser and arrives already structured, as in the
 * single-exam import: parsing xlsx on the server would load the reader library on
 * every request, while the browser has already loaded it for the preview.
 */
export async function POST(request: Request) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }

  try {
    const { classId, perExam } = await request.json();
    if (!classId) throw new Error('Kelas wajib disebutkan');
    if (!Array.isArray(perExam)) throw new Error('Daftar soal per ujian wajib berupa daftar');

    return NextResponse.json(await importQuestionsForClass(actor, classId, perExam));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
