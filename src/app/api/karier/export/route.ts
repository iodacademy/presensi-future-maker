import { exportApplicants } from '@/features/careers/export-service';
import { asAdmin } from '../guard';

// ?jobs=id1,id2 / ?jobs=id1,id2
export const GET = (request: Request) => asAdmin(async (actor) => ({
  rows: await exportApplicants(actor, (new URL(request.url).searchParams.get('jobs') ?? '').split(',')),
}));
