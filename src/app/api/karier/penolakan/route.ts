import { markRejectionsSeen, rejectionNotice } from '@/features/careers/rejection-notice';
import { asStudent } from '../guard';

export const GET = () => asStudent((actor) => rejectionNotice(actor, new Date()));

// { ids: string[] } lamaran tidak lolos yang sudah dilihat / { ids: string[] } rejected applications already seen
export const POST = (request: Request) =>
  asStudent(async (actor) => {
    const { ids } = (await request.json().catch(() => ({}))) as { ids?: unknown };
    await markRejectionsSeen(actor, ids, new Date());
    return { ok: true };
  });
