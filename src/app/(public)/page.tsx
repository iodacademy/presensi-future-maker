import React from 'react';
import { redirect } from 'next/navigation';
import { getSessionActor, getRoleRedirectPath } from '@/features/auth/session';
import { COHORTS } from '@/features/exhibition/content';
import { orderGallery } from '@/features/exhibition/gallery-order';
import { getCatalog, getSiteContent, todayWib } from '@/features/exhibition/read';
import HomePage, { type HomeBest, type HomeTesti } from './home-page';

// Pengguna yang sudah login langsung ke dashboard; pengunjung lain melihat pameran / Signed-in users go straight to their dashboard; other visitors see the exhibition
export default async function IndexPage() {
  const actor = await getSessionActor();
  if (actor) redirect(getRoleRedirectPath(actor.role));
  const [catalog, site] = await Promise.all([getCatalog(), getSiteContent()]);
  const items = orderGallery({ people: catalog.people.map((p) => ({ uid: p.uid, mainWorkId: p.mainWorkId })), cards: catalog.cards, collections: catalog.collections }, todayWib());
  // Karya terbaik tiap kelas = item galeri pertama kelas itu; koleksi menautkan ke halaman koleksi / Best work per class = that class's first gallery item; a collection links to its page
  const best = COHORTS.flatMap((c): HomeBest[] => {
    const it = items.find((i) => (i.kind === 'work' ? i.card.cohort : i.collection.cohort) === c.key);
    if (!it) return [];
    return it.kind === 'work'
      ? [{ cohort: c.key, title: it.card.title, nickname: it.card.nickname, type: it.card.type, href: '/karya/' + it.card.id, thumb: it.card.thumb }]
      : [{ cohort: c.key, title: it.collection.title, nickname: it.collection.nicknames[0] ?? '', type: 'Koleksi', href: '/koleksi/' + it.collection.id, thumb: it.collection.coverUrls[0] ?? '' }];
  });
  const testi = COHORTS.flatMap((c): HomeTesti[] => {
    const p = catalog.people.find((x) => x.cohort === c.key);
    return p ? [{ cohort: c.key, uid: p.uid, nickname: p.nickname }] : [];
  });
  return <HomePage people={catalog.people.length} works={catalog.cards.length} best={best} testi={testi} site={site} />;
}
