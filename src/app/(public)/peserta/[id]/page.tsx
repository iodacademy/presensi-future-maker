import { notFound } from 'next/navigation';
import { getCatalog, getPersonDetail } from '@/features/exhibition/read';
import { PersonView } from './person-view';

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const person = await getPersonDetail((await params).id);
  if (!person) notFound();
  const { people } = await getCatalog();
  const mates = people.filter((x) => x.cohort === person.cohort).map((x) => ({ uid: x.uid, nickname: x.nickname, workCount: x.workCount }));
  return <PersonView person={person} mates={mates} />;
}
