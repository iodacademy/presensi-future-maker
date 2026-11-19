import { exportPassed } from '@/features/careers/export-service';
import { asAdmin } from '../../guard';

export const GET = () => asAdmin(async () => ({ rows: await exportPassed() }));
