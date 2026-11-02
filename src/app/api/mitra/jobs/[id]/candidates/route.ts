import { listCandidates } from '@/features/careers/partner-service';
import { asPartner } from '../../../../karier/guard';

export const GET = (_req: Request, { params }: { params: Promise<{ id: string }> }) =>
  asPartner(async (actor) => ({ candidates: await listCandidates(actor, (await params).id) }));
