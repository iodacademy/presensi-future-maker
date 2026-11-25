import React from 'react';
import { redirect } from 'next/navigation';
import { getSessionActor, getRoleRedirectPath } from '@/features/auth/session';
import { getCatalog, getSiteContent } from '@/features/exhibition/read';
import { homeTesti } from '@/features/exhibition/model';
import HomePage, { type HomeBest, type HomeTesti } from './home-page';

// Capstone pilihan: Zalfaulislam, Afita, Aulia, Aurel, Adinda / Picked capstones: Zalfaulislam, Afita, Aulia, Aurel, Adinda
const BEST_WORK_IDS = ['c0b5fb7e58e668bd8e6f', '9e1b926498dc05745ff3', '433094caffe4b8e6c84b', '2f7050cc711614a46165', 'aa8c70625951abe95672'];

// Pengguna yang sudah login langsung ke dashboard; pengunjung lain melihat pameran / Signed-in users go straight to their dashboard; other visitors see the exhibition
export default async function IndexPage() {
  const actor = await getSessionActor();
  if (actor) redirect(getRoleRedirectPath(actor.role));
  const [catalog, site] = await Promise.all([getCatalog(), getSiteContent()]);
  // Karya terbaik dipilih tim secara manual, urut sesuai tampilan; karya pertama jadi kotak besar
  // Best works are hand-picked by the team, in display order; the first becomes the large tile
  const best: HomeBest[] = BEST_WORK_IDS.flatMap((id) => {
    const w = catalog.cards.find((c) => c.id === id);
    return w ? [{ cohort: w.cohort, title: w.title, nickname: w.nickname, type: w.type, href: '/karya/' + w.id, thumb: w.thumb }] : [];
  });
  const testi: HomeTesti[] = homeTesti(catalog.people, site.testiPeserta);
  return <HomePage people={catalog.people.length} works={catalog.cards.length} best={best} testi={testi} site={site} />;
}
