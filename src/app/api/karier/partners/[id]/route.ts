import { getPartner, updatePartner } from '@/features/careers/admin-service';
import { asAdmin, notFound } from '../../guard';

type Ctx = { params: Promise<{ id: string }> };

export const GET = (_req: Request, { params }: Ctx) =>
  asAdmin(async () => {
    const partner = await getPartner((await params).id);
    return partner ? { partner } : notFound('Mitra tidak ditemukan');
  });
export const PATCH = (request: Request, { params }: Ctx) =>
  asAdmin(async () => { await updatePartner((await params).id, await request.json()); });
