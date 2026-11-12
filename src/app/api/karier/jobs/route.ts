import { createJob, listJobs } from '@/features/careers/admin-service';
import { asAdmin } from '../guard';

export const GET = () => asAdmin(async () => {
  return { jobs: await listJobs() };
});
export const POST = (request: Request) => asAdmin(async () => ({ id: await createJob(await request.json()) }));
