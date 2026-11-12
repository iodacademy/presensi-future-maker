import { offerOtherJob } from '@/features/careers/partner-service';
import { asPartner } from '../../../../karier/guard';

export const POST = (request: Request, { params }: { params: Promise<{ id: string }> }) =>
  asPartner(async (actor) => {
    const { jobId } = (await request.json().catch(() => ({}))) as { jobId?: unknown };
    await offerOtherJob(actor, (await params).id, jobId);
    return { ok: true };
  });
