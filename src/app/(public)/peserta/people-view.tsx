'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { COH, TRACKS, cohLabel } from '@/features/exhibition/content';
import { safeExternalUrl } from '@/features/exhibition/model';
import type { PublicPerson } from '@/features/exhibition/read';
import { CohortHead, Field, Hv, css } from '@/features/exhibition/ui';

const STEP = 30;

/**
 * Ubin potret ala halaman tim: foto memenuhi ubin, nama panggilan dan jurusan
 * ditulis tegak di pita gelap tepi kiri. Peserta tanpa foto memakai warna
 * kelasnya dengan huruf awal besar, supaya grid tetap rapat tanpa lubang.
 *
 * Team-page style portrait tile: the photo fills the tile, the nickname and
 * track run vertically in a dark band on the left edge. Participants without a
 * photo get their class colour with a large initial, so the grid stays solid.
 */
export function PersonTile({ u }: { u: PublicPerson }) {
  const c = COH[u.cohort], photo = safeExternalUrl(u.photoUrl);
  return (
    <Hv as={Link} href={'/peserta/' + u.uid} aria-label={`${u.nickname}, ${cohLabel(c)}`} s={`all:unset;cursor:pointer;position:relative;display:block;aspect-ratio:3/4;overflow:hidden;background:${c.tint}`} h="filter:brightness(1.04)">
      {photo
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={photo} alt="" loading="lazy" style={css('position:absolute;inset:0;width:100%;height:100%;object-fit:cover')} />
        : <span aria-hidden="true" style={css(`position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding-left:32px;background:${c.color};color:${c.fg};font-family:var(--font-headline);font-weight:700;font-size:clamp(64px,9vw,112px);letter-spacing:-0.04em;opacity:.92`)}>{u.nickname[0]?.toUpperCase() ?? '?'}</span>}
      <span style={css('position:absolute;left:0;bottom:0;max-height:86%;background:var(--dark-blue);color:#fff;writing-mode:vertical-rl;transform:rotate(180deg);padding:14px 7px;display:flex;align-items:center;gap:8px;white-space:nowrap;overflow:hidden')}>
        <span style={css('font-family:var(--font-caption);font-weight:700;font-size:clamp(14px,1.4vw,17px)')}>{u.nickname}</span>
        <span style={css(`font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:${c.color === '#8AC208' ? '#C6E87A' : '#9FD0F5'}`)}>{TRACKS[c.track].name}</span>
      </span>
    </Hv>
  );
}

export function PeopleView({ people }: { people: PublicPerson[] }) {
  return (
    <Suspense>
      <PeopleFromParams people={people} />
    </Suspense>
  );
}

function PeopleFromParams({ people }: { people: PublicPerson[] }) {
  const params = useSearchParams();
  const kelas = params.get('kelas') ?? '';
  return <People people={people} key={params.toString()} initialCohort={COH[kelas] ? kelas : 'all'} />;
}

function People({ people, initialCohort }: { people: PublicPerson[]; initialCohort: string }) {
  const [cohort, setCohort] = useState(initialCohort);
  const [pq, setPq] = useState('');
  const [limit, setLimit] = useState(STEP);

  const q = pq.trim().toLowerCase();
  const filtered = people.filter((p) => (cohort === 'all' || p.cohort === cohort) && (!q || p.nickname.toLowerCase().includes(q)));

  return (
    <>
      <CohortHead
        cohort={cohort} track="all" allColor="#8AC208" allFg="#243C4B" eyebrowAll="Bootcamp Future Innovators 2026" allLabel="Empat kota"
        title="Para peserta" intro="Kenali peserta dari setiap kelas. Klik kartu untuk melihat profil dan karyanya."
        count={(k) => (k === 'all' ? people.length : people.filter((p) => p.cohort === k).length) + ' peserta'}
        pick={(k) => { setCohort(k); setLimit(STEP); }}
      />
      <div style={css('background:#fff;border-bottom:1px solid #ececea')}>
        <div style={css('max-width:1180px;margin:0 auto;padding:12px 22px;display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between')}>
          <span style={css('font-size:15px;font-weight:700')}>{filtered.length + ' peserta'}</span>
          <div style={css('flex:0 1 320px;min-width:220px')}><Field placeholder="Cari nama peserta" value={pq} onChange={(v) => { setPq(v); setLimit(STEP); }} /></div>
        </div>
      </div>
      <section style={css('padding:32px 22px clamp(72px,10vw,120px)')}>
        <div style={css('max-width:1180px;margin:0 auto')}>
          <div style={css('display:grid;grid-template-columns:repeat(auto-fill,minmax(min(180px,46%),1fr));gap:0')}>
            {filtered.slice(0, limit).map((u) => <PersonTile key={u.uid} u={u} />)}
          </div>
          {filtered.length === 0 && (
            <div style={css('padding:72px 22px;border-radius:24px;background:var(--surface-muted);text-align:center;font-family:var(--font-headline);font-weight:700;font-size:22px')}>Tidak ada peserta dengan nama itu.</div>
          )}
          {filtered.length > limit && (
            <div style={css('display:flex;justify-content:center;margin-top:56px')}>
              <Hv onClick={() => setLimit(limit + STEP)} s="all:unset;cursor:pointer;padding:14px 28px;border-radius:999px;background:var(--dark-blue);color:#fff;font-weight:700;font-size:16px" h="background:var(--plan-blue)">Tampilkan lebih banyak</Hv>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
