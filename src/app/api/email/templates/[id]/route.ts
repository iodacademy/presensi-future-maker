import { deleteTemplate, saveTemplate } from '@/features/email/service';
import { asAdmin } from '../../../karier/guard';

type Ctx = { params: Promise<{ id: string }> };

export const PUT = async (request: Request, { params }: Ctx) => {
  const { id } = await params;
  return asAdmin(async () => ({ id: await saveTemplate(id, await request.json()) }));
};
export const DELETE = async (_request: Request, { params }: Ctx) => {
  const { id } = await params;
  return asAdmin(async () => { await deleteTemplate(id); return { ok: true }; });
};
