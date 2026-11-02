import { getOwnProfile, updateOwnProfile } from '@/features/careers/partner-service';
import { asPartner } from '../../karier/guard';

export const GET = () => asPartner(async (actor) => ({ partner: await getOwnProfile(actor) }));
export const PATCH = (request: Request) => asPartner(async (actor) => { await updateOwnProfile(actor, await request.json()); });
