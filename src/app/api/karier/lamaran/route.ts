import { listMyApplications } from '@/features/careers/student-service';
import { asStudent } from '../guard';

export const GET = () => asStudent(async (actor) => ({ applications: await listMyApplications(actor.uid) }));
