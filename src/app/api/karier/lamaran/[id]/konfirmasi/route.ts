import { respondInterview } from '@/features/careers/interview-service';
import { asStudent } from '../../../guard';

export const POST = (request: Request, { params }: { params: Promise<{ id: string }> }) =>
  asStudent(async (actor) => {
    const body = (await request.json()) as { response?: unknown; note?: unknown };
    await respondInterview(actor, (await params).id, body.response, body.note);
  });
