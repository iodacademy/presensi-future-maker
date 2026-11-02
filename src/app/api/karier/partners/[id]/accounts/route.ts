import { createPicAccounts } from '@/features/careers/admin-service';
import { asAdmin } from '../../../guard';

export const POST = (_req: Request, { params }: { params: Promise<{ id: string }> }) =>
  asAdmin(async () => createPicAccounts((await params).id));
