import { getCatalog } from '@/features/exhibition/read';
import { AboutView } from './about-view';

// Dibaca saat permintaan (ber-cache 5 menit), bukan saat build / Read at request time (cached for 5 minutes), not at build
export const dynamic = 'force-dynamic';

export default async function AboutPage() {
  const { people, cards } = await getCatalog();
  return <AboutView people={people.length} works={cards.length} />;
}
