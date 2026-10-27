/**
 * Bentuk data pameran asli (karya, peserta, koleksi, isi situs) dan fungsi kecil
 * yang dipakai bersama sisi admin dan publik.
 *
 * Shapes of the real exhibition data (works, people, collections, site content)
 * and small helpers shared by the admin and public sides.
 */
import { COH, COHORTS, TYPE, cohLabel, type Cohort, type TrackKey } from './content';

export type WorkStatus = 'draft' | 'published' | 'hidden';
export type MediaKind = 'site' | 'html' | 'carousel' | 'video' | 'pdf';

// url kosong untuk carousel, slides kosong untuk lainnya / url is empty for carousel, slides empty otherwise
export interface WorkMedia { kind: MediaKind; url: string; slides: string[] }
// String kosong bila tidak ada gambar / Empty strings when there is no image
export interface WorkCover { thumb: string; full: string }

export interface ExhibitionWork {
  id: string; personUid: string; classId: string; cohort: string; track: TrackKey; type: string;
  title: string; description: string; tools: string[]; status: WorkStatus; aiAssisted: boolean;
  collectionId: string | null; cover: WorkCover; media: WorkMedia; sourceKey: string | null;
  createdAt: string; updatedAt: string;
}

export interface ExhibitionPerson {
  uid: string; classId: string; cohort: string; track: TrackKey; nickname: string; photoUrl: string;
  bio: string; skills: string[]; linkedinUrl: string; portfolioUrl: string; visible: boolean;
  mainWorkId: string | null; updatedAt: string;
}

export interface ExhibitionCollection {
  id: string; title: string; brief: string; classId: string; cohort: string; type: string; coverUrls: string[];
}

export interface SiteContent {
  photos: Record<string, string>;
  // Id slot foto -> keterangan / Photo slot id -> caption
  captions: Record<string, string>;
  videos: { afterMovie: string; peserta: Record<string, string>; trainer: Record<TrackKey, string>; plan: string };
  testiPeserta: Record<string, string>;
  // Kunci kohor -> uid peserta yang diberi kutipan / Cohort key -> uid of the participant credited with the quote
  testiAuthors: Record<string, string>;
  testiTrainer: { track: TrackKey; name: string; quote: string }[];
  testiPlan: { name: string; role: string; quote: string };
}

export interface GalleryCard {
  id: string; title: string; type: string; cohort: string; track: TrackKey; personUid: string;
  nickname: string; thumb: string; aiAssisted: boolean; collectionId: string | null;
}

export interface CollectionCard {
  id: string; title: string; cohort: string; type: string; coverUrls: string[]; count: number; nicknames: string[];
}

/**
 * Penulis testimoni beranda: hanya kohor yang dipilih admin dan pesertanya tampil di katalog.
 *
 * Homepage testimonial authors: only cohorts an admin picked whose person is visible in the catalog.
 */
export function homeTesti(people: { uid: string; nickname: string }[], authors: Record<string, string>) {
  return COHORTS.flatMap((c) => {
    const p = people.find((x) => x.uid === authors[c.key]);
    return p ? [{ cohort: c.key, uid: p.uid, nickname: p.nickname }] : [];
  });
}

export type GalleryItem = { kind: 'work'; card: GalleryCard } | { kind: 'collection'; collection: CollectionCard };

/**
 * Urutan karya utama; anggota koleksi selalu paling akhir, jadi tidak ada di sini.
 *
 * Main-work priority; collection members always come last, so they are not listed.
 */
export const WORK_PRIORITY: string[] = ['Capstone', 'Landing Page', 'Aplikasi Web', 'Dashboard', 'Konten Feed', 'Reels'];

const TRACK_BY_PROGRAM: Record<string, TrackKey> = {
  'Web Programming': 'web', 'Data Analyst': 'da', 'Social Media Marketing': 'smm',
};

export function cohortOf(cls: { programName: string; city: string }): Cohort | null {
  const track = TRACK_BY_PROGRAM[cls.programName];
  const city = cls.city.trim().toLowerCase();
  return COHORTS.find((c) => c.track === track && c.city.toLowerCase() === city) ?? null;
}

export function nicknameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? '';
}

/**
 * Hanya tautan http(s) yang boleh dirender sebagai href atau src iframe; `javascript:`
 * akan berjalan di origin kita.
 *
 * Only http(s) links may be rendered as an href or iframe src; `javascript:`
 * would run in our origin.
 */
export function safeExternalUrl(u: string): string | null {
  try {
    const p = new URL(u).protocol;
    return p === 'https:' || p === 'http:' ? u : null;
  } catch {
    return null;
  }
}

/**
 * Data kartu karya dari kartu galeri; dipakai galeri, profil, dan karya serupa.
 *
 * Work card data from a gallery card; shared by the gallery, profiles, and related works.
 */
export function toCardData(c: GalleryCard) {
  const coh = COH[c.cohort];
  return {
    href: '/karya/' + c.id, cTint: coh.tint, cColor: coh.color, cFg: coh.fg, cLabel: cohLabel(coh),
    thumbLabel: TYPE[c.type]?.thumb ?? c.type, type: c.type, title: c.title, initials: c.nickname[0]?.toUpperCase() ?? '?',
    personName: c.nickname, thumb: c.thumb, aiAssisted: c.aiAssisted,
  };
}
