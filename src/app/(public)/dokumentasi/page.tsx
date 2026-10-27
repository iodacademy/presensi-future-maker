import { getSiteContent } from '@/features/exhibition/read';
import { DocsView } from './docs-view';

// Dibaca saat permintaan (ber-cache 5 menit), bukan saat build / Read at request time (cached for 5 minutes), not at build
export const dynamic = 'force-dynamic';

export default async function DocsPage() {
  const site = await getSiteContent();
  return <DocsView photos={site.photos} />;
}
