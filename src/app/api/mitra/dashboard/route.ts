import { partnerDashboard } from '@/features/careers/partner-service';
import { asPartner } from '../../karier/guard';

export const GET = () => asPartner(async (actor) => partnerDashboard(actor, new Date()));
