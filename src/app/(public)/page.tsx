import React from 'react';
import { redirect } from 'next/navigation';
import { getSessionActor, getRoleRedirectPath } from '@/features/auth/session';
import { COHORTS } from '@/features/exhibition/content';
import { orderGallery } from '@/features/exhibition/gallery-order';
import { getCatalog, getSiteContent, todayWib } from '@/features/exhibition/read';
import { homeTesti } from '@/features/exhibition/model';
import HomePage, { type HomeBest, type HomeTesti } from './home-page';

// Pengguna yang sudah login langsung ke dashboard; pengunjung lain melihat pameran / Signed-in users go straight to their dashboard; other visitors see the exhibition
export default async function IndexPage() {
  const actor = await getSessionActor();
  if (actor) redirect(getRoleRedirectPath(actor.role));
  const [catalog, site] = await Promise.all([getCatalog(), getSiteContent()]);
  const items = orderGallery({ people: catalog.people.map((p) => ({ uid: p.uid, mainWorkId: p.mainWorkId })), cards: catalog.cards, collections: catalog.collections }, todayWib());
  // Contoh karya = capstone project, bergiliran antarkelas, paling banyak 4; kelas tanpa capstone belum tampil
  // Showcase = capstone projects, alternating between classes, at most 4; classes without capstones don't show yet
  const caps = items.flatMap((i) => (i.kind === 'work' && i.card.type === 'Capstone' ? [i.card] : []));
  const byCohort = COHORTS.map((c) => caps.filter((w) => w.cohort === c.key));
  const best: HomeBest[] = [];
  for (let r = 0; best.length < 4 && byCohort.some((l) => l[r]); r++) {
    for (const l of byCohort) if (l[r] && best.length < 4) best.push({ cohort: l[r].cohort, title: l[r].title, nickname: l[r].nickname, type: l[r].type, href: '/karya/' + l[r].id, thumb: l[r].thumb });
  }
  // Kutipan hanya untuk peserta yang dipilih admin dan tampil / Quotes only for the participant an admin picked who is visible
  const testi: HomeTesti[] = homeTesti(catalog.people, site.testiAuthors ?? {});
  return <HomePage people={catalog.people.length} works={catalog.cards.length} best={best} testi={testi} site={site} />;
}
