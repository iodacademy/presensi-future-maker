import { markProjectDone } from '@/features/careers/offer-service';
import { asAdmin } from '../../../guard';

export const POST = (_req: Request, { params }: { params: Promise<{ id: string }> }) =>
  asAdmin(async () => markProjectDone((await params).id, new Date()));
