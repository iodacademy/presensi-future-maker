import { portalInsights } from '@/features/careers/insights-service';
import { asAdmin } from '../guard';

export const GET = () => asAdmin(async (actor) => ({ insights: await portalInsights(actor) }));
