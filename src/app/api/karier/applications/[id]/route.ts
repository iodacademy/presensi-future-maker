import { getApplicationForAdmin, setApplicationStatus } from '@/features/careers/applicants-service';
import { asAdmin } from '../../guard';

type Ctx = { params: Promise<{ id: string }> };

export const GET = (_req: Request, { params }: Ctx) => asAdmin(async () => ({ application: await getApplicationForAdmin((await params).id) }));

export const PATCH = (request: Request, { params }: Ctx) =>
  asAdmin(async () => {
    const body = (await request.json()) as { status?: unknown; rejectReason?: unknown };
    await setApplicationStatus((await params).id, body.status, body.rejectReason);
  });
