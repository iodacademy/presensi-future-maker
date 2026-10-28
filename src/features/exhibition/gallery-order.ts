import { WORK_PRIORITY, type CollectionCard, type GalleryCard, type GalleryItem } from './model';

// Hash 32-bit dari teks tanggal / 32-bit hash of the date string
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rank = (type: string) => {
  const i = WORK_PRIORITY.indexOf(type);
  return i < 0 ? WORK_PRIORITY.length : i;
};

/**
 * Urutan galeri publik: putaran ke-r memuat kartu ke-r setiap peserta, diacak
 * dengan benih tanggal WIB agar berganti harian tetapi stabil dalam sehari.
 * Kartu koleksi disisipkan di awal putaran kedua. Seluruh capstone project
 * didahulukan sebelum karya lain, karena itulah karya puncak tiap peserta.
 *
 * Public gallery order: round r holds every person's r-th card, shuffled with a
 * WIB-date seed so it changes daily yet stays stable within a day.
 * Collection cards are inserted at the start of round 2. Every capstone project
 * comes before other works, since it is each participant's culminating work.
 */
export function orderGallery(
  input: { people: { uid: string; mainWorkId: string | null }[]; cards: GalleryCard[]; collections: CollectionCard[] },
  wibDate: string,
): GalleryItem[] {
  const rand = mulberry32(hash(wibDate));

  const perPerson = input.people.map((p) => {
    const sorted = input.cards
      .filter((c) => c.personUid === p.uid)
      .sort((a, b) =>
        Number(b.type === 'Capstone') - Number(a.type === 'Capstone') ||
        Number(b.id === p.mainWorkId) - Number(a.id === p.mainWorkId) ||
        Number(a.collectionId !== null) - Number(b.collectionId !== null) ||
        rank(a.type) - rank(b.type) ||
        a.id.localeCompare(b.id));
    // Anggota koleksi hanya boleh tampil bila karya pertama / Collection members only show when first card
    return sorted.filter((c, i) => i === 0 || c.collectionId === null);
  });

  const rounds: GalleryCard[][] = [];
  for (let r = 0; perPerson.some((l) => l.length > r); r++) {
    const round = perPerson.map((l) => l[r]).filter((c): c is GalleryCard => !!c);
    for (let i = round.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [round[i], round[j]] = [round[j], round[i]];
    }
    const out: GalleryCard[] = [];
    while (round.length) {
      const prev = out[out.length - 1];
      const k = prev ? round.findIndex((c) => c.type !== prev.type && c.cohort !== prev.cohort) : 0;
      out.push(round.splice(k < 0 ? 0 : k, 1)[0]);
    }
    rounds.push(out);
  }

  const toItem = (card: GalleryCard): GalleryItem => ({ kind: 'work', card });
  const collections: GalleryItem[] = [...input.collections]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((collection) => ({ kind: 'collection', collection }));
  const items = rounds.flatMap((round, r) => (r === 1 ? [...collections, ...round.map(toItem)] : round.map(toItem)))
    .concat(rounds.length < 2 ? collections : []);
  const isCapstone = (i: GalleryItem) => i.kind === 'work' && i.card.type === 'Capstone';
  return [...items.filter(isCapstone), ...items.filter((i) => !isCapstone(i))];
}
