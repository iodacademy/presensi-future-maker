import { getLogBody } from '@/features/email/service';
import { asAdmin } from '../../../karier/guard';

type Ctx = { params: Promise<{ id: string }> };

export const GET = async (_request: Request, { params }: Ctx) => {
  const { id } = await params;
  return asAdmin(async () => ({ body: await getLogBody(id) }));
};
