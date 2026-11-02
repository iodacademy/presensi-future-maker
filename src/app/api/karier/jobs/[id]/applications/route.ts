import { listApplicants } from '@/features/careers/applicants-service';
import { asAdmin } from '../../../guard';

export const GET = (_req: Request, { params }: { params: Promise<{ id: string }> }) =>
  asAdmin(async () => ({ applicants: await listApplicants((await params).id) }));
