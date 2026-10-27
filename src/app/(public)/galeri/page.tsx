import { getCatalog, todayWib } from '@/features/exhibition/read';
import { orderGallery } from '@/features/exhibition/gallery-order';
import { GalleryView } from './gallery-view';

/**
 * Urutan galeri dihitung di server, berganti harian menurut tanggal WIB.
 * Hanya nickname yang dikirim ke peramban.
 *
 * The gallery order is computed on the server and rotates daily by WIB date.
 * Only the nickname is sent to the browser.
 */
export default async function GalleryPage() {
  const catalog = await getCatalog();
  const items = orderGallery({ people: catalog.people.map((p) => ({ uid: p.uid, mainWorkId: p.mainWorkId })), cards: catalog.cards, collections: catalog.collections }, todayWib());
  const counts: Record<string, number> = {};
  catalog.cards.forEach((c) => { counts[c.cohort] = (counts[c.cohort] ?? 0) + 1; });
  return <GalleryView items={items} members={catalog.cards.filter((c) => c.collectionId)} counts={counts} />;
}
