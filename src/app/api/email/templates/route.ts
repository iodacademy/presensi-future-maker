import { listTemplates, saveTemplate } from '@/features/email/service';
import { asAdmin } from '../../karier/guard';

export const GET = () => asAdmin(async () => ({ templates: await listTemplates() }));
export const POST = (request: Request) => asAdmin(async () => ({ id: await saveTemplate(null, await request.json()) }));
