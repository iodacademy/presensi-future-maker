import { createPartner, listPartners } from '@/features/careers/admin-service';
import { asAdmin } from '../guard';

export const GET = () => asAdmin(async () => ({ partners: await listPartners() }));
export const POST = (request: Request) => asAdmin(async () => ({ id: await createPartner(await request.json()) }));
