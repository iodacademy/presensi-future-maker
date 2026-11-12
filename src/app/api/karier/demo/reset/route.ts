import { resetDemoAccounts } from '@/features/careers/demo-service';
import { asAdmin } from '../../guard';

export const POST = () => asAdmin(() => resetDemoAccounts());
