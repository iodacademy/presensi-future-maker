import { inviteToInterview } from '@/features/careers/interview-service';
import { asPartner } from '../../../../karier/guard';

export const POST = (request: Request, { params }: { params: Promise<{ id: string }> }) =>
  asPartner(async (actor) => inviteToInterview(actor, (await params).id, await request.json(), new Date()));
