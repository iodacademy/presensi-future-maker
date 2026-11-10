import { sendTestEmail } from '@/features/email/service';
import { asAdmin } from '../../karier/guard';

export const POST = (request: Request) => asAdmin(async (actor) => sendTestEmail(actor, await request.json()));
