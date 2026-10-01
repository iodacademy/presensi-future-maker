import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { getAttemptReview } from '@/features/exams/service';

/**
 * Pembahasan sebuah percobaan.
 *
 * Penjagaannya ada di layanan, bukan di sini: menahan tombolnya saja tidak
 * menahan siapa pun yang memanggil endpoint ini langsung.
 *
 * An attempt's review.
 *
 * The guard lives in the service, not here: hiding the button alone holds back
 * nobody who calls this endpoint directly.
 */
export async function GET(request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const actor = await getSessionActor();
  if (!actor) {
    return NextResponse.json({ error: 'Masuk terlebih dahulu' }, { status: 401 });
  }

  const { attemptId } = await params;
  try {
    return NextResponse.json(await getAttemptReview(actor, attemptId));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
