import { applicationsOpen, setApplicationsOpen } from '@/features/careers/apply-gate';
import { asAdmin } from '../guard';

export const GET = () => asAdmin(async () => ({ open: await applicationsOpen() }));

export const POST = (request: Request) => asAdmin(async () => {
  const { open } = (await request.json()) as { open?: unknown };
  if (typeof open !== 'boolean') throw new Error('Status pendaftaran tidak valid');
  await setApplicationsOpen(open);
  return { open };
});
