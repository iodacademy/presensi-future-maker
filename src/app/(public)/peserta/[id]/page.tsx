import { notFound } from 'next/navigation';
import { getCatalog, getPersonDetail } from '@/features/exhibition/read';
import { PersonView } from './person-view';

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const person = await getPersonDetail((await params).id);
  if (!person) notFound();
  const { people } = await getCatalog();
  // Teman sekelas mengikuti daftar Peserta: hanya yang berfoto / Classmates follow the Peserta list: only those with a photo
  const mates = people.filter((x) => x.cohort === person.cohort && x.photoUrl);
  return <PersonView person={person} mates={mates} />;
}
