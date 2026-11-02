import { listInterviews } from '@/features/careers/interview-service';
import { asPartner } from '../../karier/guard';

export const GET = () => asPartner(async (actor) => ({ interviews: await listInterviews(actor) }));
