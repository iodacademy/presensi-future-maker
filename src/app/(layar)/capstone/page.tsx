import React from 'react';
import { headers } from 'next/headers';
import QRCode from 'qrcode';
import { COH, TRACKS, cohLabel } from '@/features/exhibition/content';
import { orderGallery } from '@/features/exhibition/gallery-order';
import { getCapstones, getCatalog, todayWib } from '@/features/exhibition/read';
import { CapstoneShow, type CapstoneSlide } from './capstone-show';

/**
 * Halaman layar Karya Capstone: seluruh capstone yang terbit, berputar sendiri.
 * Urutannya mengikuti galeri (berganti harian, kelas bergantian).
 *
 * The Karya Capstone screen page: every published capstone, cycling on its own.
 * Its order follows the gallery (changes daily, classes alternate).
 */
export default async function CapstonePage() {
  const [catalog, caps, h] = await Promise.all([getCatalog(), getCapstones(), headers()]);
  const people = new Map(catalog.people.map((p) => [p.uid, p]));
  const byId = new Map(caps.map((c) => [c.id, c]));
  const order = orderGallery({ people: catalog.people, cards: catalog.cards, collections: [] }, todayWib())
    .flatMap((i) => (i.kind === 'work' && byId.has(i.card.id) ? [byId.get(i.card.id)!] : []));

  // Alamat situs diambil dari permintaan agar QR benar di laptop maupun produksi
  // The site address comes from the request so the QR is right locally and in production
  const origin = `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('x-forwarded-host') ?? h.get('host')}`;

  const slides: CapstoneSlide[] = await Promise.all(order.flatMap((c) => {
    const p = people.get(c.personUid);
    const coh = COH[c.cohort];
    if (!p || !coh) return [];
    // QR membuka aplikasinya langsung; halaman karya hanya bila alamat aplikasi kosong
    // The QR opens the app itself; the work page only when there is no app address
    const target = c.appUrl || `${origin}/karya/${c.id}`;
    return [QRCode.toString(target, { type: 'svg', margin: 0, color: { dark: '#243C4B', light: '#FFFFFF' } }).then((qr) => ({
      id: c.id, title: c.title, cover: c.cover, tools: c.tools, nickname: p.nickname, photo: p.photoUrl,
      cohortLabel: cohLabel(coh), color: TRACKS[coh.track].color, fg: TRACKS[coh.track].fg, qr, isApp: !!c.appUrl,
    }))];
  }));

  return <CapstoneShow slides={slides} />;
}
