'use client';

import React from 'react';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { BIO, DATA, SKILLS, card, personCard } from '@/features/exhibition/content';
import { Hv, Photo, WorkCard, css } from '@/features/exhibition/ui';

export default function PersonPage() {
  const { id } = useParams<{ id: string }>();
  const raw = DATA.P[id];
  if (!raw) notFound();
  const p = personCard(raw);
  const mates = DATA.people.filter((x) => x.cohort === p.cohort), mi = mates.indexOf(raw), nM = mates.length;
  const works = p.works.map((wid) => card(DATA.W[wid]));
  const fg = p.cFg;

  return (
    <>
      <section style={css(`background:${p.cColor};color:${fg};padding:104px 22px clamp(56px,8vw,96px)`)}>
        <div style={css('max-width:1180px;margin:0 auto')}>
          <div style={css('display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between')}>
            <Link href="/peserta" style={css('all:unset;cursor:pointer;font-weight:700;font-size:14px;text-decoration:underline')}>← Semua peserta</Link>
            <div style={css('display:flex;align-items:center;gap:8px')}>
              <span style={css('font-size:13px;font-weight:700;margin-right:4px')}>{(mi + 1) + ' / ' + nM}</span>
              <Link href={'/peserta/' + mates[(mi - 1 + nM) % nM].id} aria-label="Peserta sebelumnya" style={css('all:unset;cursor:pointer;width:40px;height:40px;border-radius:50%;background:#fff;color:var(--dark-blue);display:flex;align-items:center;justify-content:center;font-size:17px')}>←</Link>
              <Link href={'/peserta/' + mates[(mi + 1) % nM].id} aria-label="Peserta berikutnya" style={css('all:unset;cursor:pointer;width:40px;height:40px;border-radius:50%;background:#fff;color:var(--dark-blue);display:flex;align-items:center;justify-content:center;font-size:17px')}>→</Link>
            </div>
          </div>
          <div style={css('display:flex;flex-wrap:wrap;gap:clamp(28px,5vw,64px);align-items:center;margin-top:clamp(28px,4vw,48px)')}>
            <div style={css('flex:0 0 auto;width:clamp(160px,22vw,260px);aspect-ratio:1;border-radius:50%;overflow:hidden;background:#fff;border:6px solid #fff;color:var(--dark-blue);position:relative;box-shadow:var(--shadow-lg)')}>
              <Photo id={'foto-' + p.id} placeholder="Foto peserta" circle />
            </div>
            <div style={css('flex:1 1 420px;min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:16px')}>
              <span style={css('padding:6px 14px;border-radius:999px;background:#fff;color:var(--dark-blue);font-size:14px;font-weight:700')}>{p.cLabel}</span>
              <h1 style={css('font-family:var(--font-headline);font-weight:700;font-size:clamp(48px,7vw,96px);line-height:0.95;letter-spacing:-0.045em;margin:0')}>{p.name}</h1>
              <p style={css('margin:0;font-size:19px;line-height:1.5;max-width:580px;text-wrap:pretty')}>{BIO[p.track]}</p>
              <div style={css('display:flex;flex-wrap:wrap;gap:8px')}>
                {SKILLS[p.track].map((sk) => <span key={sk} style={css(`font-size:13px;font-weight:700;padding:6px 12px;border-radius:999px;border:2px solid ${fg}`)}>{sk}</span>)}
              </div>
              <div style={css('display:flex;flex-wrap:wrap;gap:10px;margin-top:6px')}>
                <a href="#" style={css('padding:12px 22px;border-radius:999px;background:#fff;color:var(--dark-blue);font-weight:700;font-size:15px;text-decoration:none')}>LinkedIn</a>
                <a href="#" style={css(`padding:10px 20px;border-radius:999px;border:2px solid ${fg};color:${fg};font-weight:700;font-size:15px;text-decoration:none`)}>{p.track === 'web' ? 'GitHub' : 'Portofolio'}</a>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section style={css('padding:clamp(48px,7vw,88px) 22px')}>
        <div style={css('max-width:1180px;margin:0 auto')}>
          <h2 style={css('font-family:var(--font-headline);font-weight:700;font-size:clamp(32px,4.4vw,52px);line-height:1;letter-spacing:-0.03em;margin:0;display:flex;align-items:center;gap:14px')}>Karya <span style={css(`font-size:0.5em;padding:6px 14px;border-radius:999px;background:${p.cColor};color:${fg};letter-spacing:0`)}>{p.workCount}</span></h2>
          <div style={css('display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,340px),1fr));gap:20px;margin-top:32px')}>
            {works.map((w) => <WorkCard key={w.id} w={w} />)}
          </div>
        </div>
      </section>
      <section style={css(`padding:clamp(48px,7vw,80px) 0 clamp(72px,10vw,120px);background:${p.cTint}`)}>
        <div style={css('max-width:1180px;margin:0 auto;padding:0 22px;display:flex;flex-wrap:wrap;gap:12px;align-items:baseline;justify-content:space-between')}>
          <h2 style={css('font-family:var(--font-headline);font-weight:700;font-size:clamp(26px,3vw,36px);line-height:1.1;letter-spacing:-0.025em;margin:0')}>Teman sekelas</h2>
          <Hv as={Link} href={'/peserta?kelas=' + p.cohort} s="all:unset;cursor:pointer;font-size:15px;font-weight:700;color:var(--dark-blue)" h="text-decoration:underline">Lihat semua di kelas ini →</Hv>
        </div>
        <div style={css('max-width:1180px;margin:0 auto;display:flex;gap:14px;overflow-x:auto;scrollbar-width:none;-ms-overflow-style:none;padding:24px 22px 8px;scroll-snap-type:x mandatory')}>
          {mates.filter((x) => x !== raw).slice(0, 10).map(personCard).map((m) => (
            <Hv key={m.id} as={Link} href={m.href} s="all:unset;cursor:pointer;flex:0 0 160px;scroll-snap-align:start;display:flex;flex-direction:column;align-items:center;text-align:center;gap:10px;padding:20px 12px;border-radius:20px;background:#fff;transition:transform 200ms ease" h="transform:translateY(-4px)">
              <span style={css(`width:72px;height:72px;border-radius:50%;background:${m.cColor};color:${m.cFg};display:flex;align-items:center;justify-content:center;font-family:var(--font-headline);font-weight:700;font-size:22px`)}>{m.initials}</span>
              <span style={css('font-weight:700;font-size:15px;color:var(--dark-blue)')}>{m.name}</span>
              <span style={css('font-size:12px;color:var(--text-muted)')}>{m.workLabel}</span>
            </Hv>
          ))}
        </div>
      </section>
    </>
  );
}
