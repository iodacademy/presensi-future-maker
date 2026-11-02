import { submitApplication } from '@/features/careers/apply-service';
import { getApplyContext } from '@/features/careers/student-service';
import { asStudent } from '../guard';

export const GET = (request: Request) =>
  asStudent(async (actor) => getApplyContext(actor, new URL(request.url).searchParams.get('jobId') ?? '', new Date()));

export const POST = (request: Request) => asStudent(async (actor) => submitApplication(actor, await request.json(), new Date()));
