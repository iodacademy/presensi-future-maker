import { respondOffer } from '@/features/careers/offer-service';
import { asStudent } from '../../../guard';

export const POST = (request: Request, { params }: { params: Promise<{ id: string }> }) =>
  asStudent(async (actor) => {
    const body = (await request.json()) as { response?: unknown };
    await respondOffer(actor, (await params).id, body.response, new Date());
  });
