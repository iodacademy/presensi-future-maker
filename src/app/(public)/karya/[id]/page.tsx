import { notFound } from 'next/navigation';
import { getCatalog, getWorkDetail } from '@/features/exhibition/read';
import { WorkView } from './work-view';

/**
 * Karya serupa: jurusan dan jenis sama, empat teratas dari katalog ber-cache.
 *
 * Related works: same track and type, the first four from the cached catalog.
 */
export default async function WorkPage({ params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id;
  const work = await getWorkDetail(id);
  if (!work) notFound();
  const { cards } = await getCatalog();
  const related = cards.filter((c) => c.id !== id && c.track === work.track && c.type === work.type).slice(0, 4);
  return <WorkView work={work} related={related} />;
}
