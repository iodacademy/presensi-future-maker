import { decideCandidate, getCandidate } from '@/features/careers/partner-service';
import { asPartner } from '../../../karier/guard';

type Ctx = { params: Promise<{ id: string }> };

export const GET = (_req: Request, { params }: Ctx) => asPartner(async (actor) => ({ candidate: await getCandidate(actor, (await params).id) }));

export const PATCH = (request: Request, { params }: Ctx) =>
  asPartner(async (actor) => {
    const body = (await request.json()) as { status?: unknown; rejectReason?: unknown };
    await decideCandidate(actor, (await params).id, body.status, body.rejectReason);
  });
