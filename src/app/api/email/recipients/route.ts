import { listRecipients } from '@/features/email/service';
import { asAdmin } from '../../karier/guard';

export const GET = () => asAdmin(async (actor) => ({ recipients: await listRecipients(actor) }));
