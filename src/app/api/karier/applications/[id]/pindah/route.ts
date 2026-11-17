import { adminMoveApplication } from '@/features/careers/move-service';
import { asAdmin } from '../../../guard';

export const POST = (request: Request, { params }: { params: Promise<{ id: string }> }) =>
  asAdmin(async () => {
    const { jobId, pass } = (await request.json().catch(() => ({}))) as { jobId?: unknown; pass?: unknown };
    await adminMoveApplication((await params).id, jobId, pass);
    return { ok: true };
  });
