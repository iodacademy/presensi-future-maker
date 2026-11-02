import { deleteJob, getJob, updateJob } from '@/features/careers/admin-service';
import { asAdmin, notFound } from '../../guard';

type Ctx = { params: Promise<{ id: string }> };

export const GET = (_req: Request, { params }: Ctx) =>
  asAdmin(async () => {
    const job = await getJob((await params).id);
    return job ? { job } : notFound('Lowongan tidak ditemukan');
  });
export const PATCH = (request: Request, { params }: Ctx) =>
  asAdmin(async () => { await updateJob((await params).id, await request.json()); });
export const DELETE = (_req: Request, { params }: Ctx) =>
  asAdmin(async () => { await deleteJob((await params).id); });
