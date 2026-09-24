import { redirect } from 'next/navigation';
import { getSessionActor, getRoleRedirectPath } from '@/features/auth/session';

export default async function IndexPage() {
  const actor = await getSessionActor();
  if (!actor) {
    redirect('/login');
  }

  redirect(getRoleRedirectPath(actor.role));
}
