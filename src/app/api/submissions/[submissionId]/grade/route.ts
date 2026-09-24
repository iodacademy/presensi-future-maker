import { NextResponse } from 'next/server';
import { getSessionActor } from '@/features/auth/session';
import { gradeSubmission } from '@/features/tasks/submission-service';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  const actor = await getSessionActor();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang diizinkan' }, { status: 403 });
  }

  const { submissionId } = await params;

  try {
    const body = await request.json();
    await gradeSubmission(actor, {
      submissionId,
      score: body.score,
      feedback: body.feedback,
      correctionReason: body.correctionReason,
    });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
