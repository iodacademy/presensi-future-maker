import { getCatalog } from '@/features/exhibition/read';
import { PeopleView } from './people-view';

// Dibaca saat permintaan (ber-cache 5 menit), bukan saat build / Read at request time (cached for 5 minutes), not at build
export const dynamic = 'force-dynamic';

export default async function PeoplePage() {
  const { people } = await getCatalog();
  // Sementara hanya peserta berfoto yang tampil; sisanya menyusul setelah fotonya ada
  // For now only participants with a photo are listed; the rest follow once their photos arrive
  return <PeopleView people={people.filter((p) => p.photoUrl)} />;
}
