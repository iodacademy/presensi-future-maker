import { markContacted } from '@/features/careers/offer-service';
import { asPartner } from '../../../../karier/guard';

export const POST = (_req: Request, { params }: { params: Promise<{ id: string }> }) =>
  asPartner(async (actor) => markContacted(actor, (await params).id, new Date()));
