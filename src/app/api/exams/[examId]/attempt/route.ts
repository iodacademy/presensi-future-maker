import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { startAttempt } from '@/features/exams/service';

/**
 * Memulai atau melanjutkan percobaan.
 *
 * POST, bukan GET: pemanggilan pertama membuat dokumen percobaan dan mencatat
 * waktu mulainya. GET akan ikut terpicu oleh prefetch peramban dan riwayat
 * navigasi, sehingga kesempatan peserta habis tanpa ia menjawab apa pun.
 *
 * Starts or resumes an attempt.
 *
 * POST, not GET: the first call creates the attempt document and records its
 * start time. A GET would also fire on browser prefetch and history
 * navigation, burning a participant's attempts without them answering
 * anything.
 */
export async function POST(request: Request, { params }: { params: Promise<{ examId: string }> }) {
  const actor = await getSessionActor();
  if (!actor) {
    return NextResponse.json({ error: 'Masuk terlebih dahulu' }, { status: 401 });
  }

  const { examId } = await params;
  try {
    return NextResponse.json(await startAttempt(actor, examId));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
