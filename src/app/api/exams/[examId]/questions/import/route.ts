import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { importQuestions } from '@/features/exams/service';

/**
 * Impor soal dari berkas yang sudah dibaca peramban.
 *
 * Berkasnya diurai di peramban, bukan dikirim mentah: mengurai di server
 * berarti menerima dan menyimpan berkas unggahan, sedangkan yang dibutuhkan
 * hanya barisnya. Layanannya tetap memvalidasi ulang tiap baris, sebab muatan
 * yang dikirim ke sini dapat diubah sebelum tiba.
 *
 * Imports questions from a sheet the browser has already parsed.
 *
 * The file is parsed in the browser rather than sent raw: parsing on the server
 * would mean accepting and storing an upload, when all that is needed are its
 * rows. The service still revalidates every row, since the payload sent here
 * can be altered before it arrives.
 */
export async function POST(request: Request, { params }: { params: Promise<{ examId: string }> }) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }

  const { examId } = await params;
  try {
    const body = await request.json();
    return NextResponse.json(await importQuestions(actor, examId, body.questions ?? []));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
