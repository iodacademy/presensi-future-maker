import { listLogs } from '@/features/email/service';
import { asAdmin } from '../../karier/guard';

export const GET = () => asAdmin(async () => ({ logs: await listLogs() }));
