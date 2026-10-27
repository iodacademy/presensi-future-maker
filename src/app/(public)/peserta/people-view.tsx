'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { COH, cohLabel } from '@/features/exhibition/content';
import { safeExternalUrl } from '@/features/exhibition/model';
import type { PublicPerson } from '@/features/exhibition/read';
import { CohortHead, Field, Hv, css } from '@/features/exhibition/ui';

const STEP = 30;

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
          <div style={css('display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:20px')}>
            {filtered.slice(0, limit).map((u) => {
              const c = COH[u.cohort], photo = safeExternalUrl(u.photoUrl);
              const p = { name: u.nickname, initials: u.nickname[0]?.toUpperCase() ?? '?', cColor: c.color, cFg: c.fg, cTint: c.tint, cLabel: cohLabel(c), workLabel: u.workCount + ' karya' };
              return (
              <Hv key={u.uid} as={Link} href={'/peserta/' + u.uid} s="all:unset;cursor:pointer;display:flex;flex-direction:column;background:#fff;border-radius:24px;overflow:hidden;border:1px solid #ececea;transition:transform 240ms ease,box-shadow 240ms ease" h="transform:translateY(-6px);box-shadow:var(--shadow-lg)">
                <div style={css(`position:relative;height:104px;background:${p.cColor};color:${p.cFg}`)}>
                  <span style={css('position:absolute;top:14px;right:16px;font-size:12px;font-weight:700')}>{p.workLabel}</span>
                  <span style={css(`position:absolute;left:18px;bottom:-38px;width:84px;height:84px;border-radius:50%;background:${p.cTint};border:4px solid #fff;box-shadow:var(--shadow-sm);display:flex;align-items:center;justify-content:center;font-family:var(--font-headline);font-weight:700;font-size:26px;color:var(--dark-blue);overflow:hidden`)}>{photo
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={photo} alt={p.name} loading="lazy" style={css('width:100%;height:100%;object-fit:cover')} />
                    : p.initials}</span>
                </div>
                <div style={css('padding:50px 18px 20px;display:flex;flex-direction:column;gap:4px;flex:1')}>
                  <span style={css('font-family:var(--font-headline);font-weight:700;font-size:19px;line-height:1.15;color:var(--dark-blue)')}>{p.name}</span>
                  <span style={css('font-size:13px;color:var(--text-muted)')}>{p.cLabel}</span>
                  <span style={css('margin-top:14px;font-size:14px;font-weight:700;color:var(--dark-blue)')}>Lihat profil →</span>
                </div>
              </Hv>
              );
            })}
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
