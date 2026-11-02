import { listOpenJobs } from '@/features/careers/student-service';
import { asStudent } from '../guard';

export const GET = () => asStudent(async (actor) => listOpenJobs(actor, new Date()));
