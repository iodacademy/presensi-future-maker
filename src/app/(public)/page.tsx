import React from 'react';
import { redirect } from 'next/navigation';
import { getSessionActor, getRoleRedirectPath } from '@/features/auth/session';
import HomePage from './home-page';

// Pengguna yang sudah login langsung ke dashboard; pengunjung lain melihat pameran / Signed-in users go straight to their dashboard; other visitors see the exhibition
export default async function IndexPage() {
  const actor = await getSessionActor();
  if (actor) redirect(getRoleRedirectPath(actor.role));
  return <HomePage />;
}
