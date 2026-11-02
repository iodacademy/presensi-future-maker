import { partnerMe } from '@/features/careers/partner-service';
import { asPartner } from '../../karier/guard';

export const GET = () => asPartner(async (actor) => partnerMe(actor));
