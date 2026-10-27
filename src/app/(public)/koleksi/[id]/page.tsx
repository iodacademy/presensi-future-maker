import { notFound } from 'next/navigation';
import { getCollectionDetail } from '@/features/exhibition/read';
import { CollectionView } from './collection-view';

export default async function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const data = await getCollectionDetail((await params).id);
  if (!data) notFound();
  return <CollectionView {...data} />;
}
