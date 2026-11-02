import { createJob, listJobs, portalStats } from '@/features/careers/admin-service';
import { asAdmin } from '../guard';

export const GET = () => asAdmin(async () => {
  const [jobs, stats] = await Promise.all([listJobs(), portalStats(new Date())]);
  return { jobs, stats };
});
export const POST = (request: Request) => asAdmin(async () => ({ id: await createJob(await request.json()) }));
