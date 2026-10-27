'use client';

import React from 'react';
import Link from 'next/link';
import { COH, TRACKS, cohLabel } from '@/features/exhibition/content';
import { safeExternalUrl, toCardData } from '@/features/exhibition/model';
import type { PersonDetail, PublicPerson } from '@/features/exhibition/read';
import { Hv, WorkCard, css } from '@/features/exhibition/ui';
import { PersonTile } from '../people-view';

/**
 * Profil satu peserta dalam bahasa visual pameran: blok warna kelas, foto
 * bergaya polaroid yang sedikit miring, nama besar, dan pil keahlian. Bagian
 * karya hanya tampil bila ada karya terbit; tautan LinkedIn dan portofolio
 * hanya dirender bila http(s).
 *
 * One participant profile in the exhibition's visual language: a class-colour
 * block, a slightly tilted polaroid-style photo, a large name, and skill pills.
 * The works section shows only when there are published works; the LinkedIn
 * and portfolio links render only when http(s).
 */
export function PersonView({ person, mates }: { person: PersonDetail; mates: PublicPerson[] }) {
  const coh = COH[person.cohort], track = TRACKS[coh.track];
  const photo = safeExternalUrl(person.photoUrl);
  const linkedin = safeExternalUrl(person.linkedinUrl), portfolio = safeExternalUrl(person.portfolioUrl);
  const works = person.works.map(toCardData);
  const mi = mates.findIndex((x) => x.uid === person.uid), nM = mates.length;
  const others = mates.filter((x) => x.uid !== person.uid).slice(0, 12);
  const fg = coh.fg;
  const pill = `padding:8px 16px;border-radius:999px;font-size:14px;font-weight:700;border:2px solid ${fg};color:${fg}`;

  return (
    <>
      <section style={css(`position:relative;overflow:hidden;background:${coh.color};color:${fg};padding:104px 22px clamp(56px,8vw,96px)`)}>
        <span aria-hidden="true" style={css(`position:absolute;right:-6vw;bottom:-8vw;font-family:var(--font-headline);font-weight:700;font-size:clamp(220px,34vw,520px);line-height:.8;letter-spacing:-0.06em;opacity:.12;pointer-events:none;white-space:nowrap`)}>{person.nickname}</span>
        <div style={css('position:relative;max-width:1180px;margin:0 auto')}>
          <div style={css('display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between')}>
            <Link href="/peserta" style={css(`font-weight:700;font-size:14px;color:${fg}`)}>← Semua peserta</Link>
            {mi >= 0 && nM > 1 && <div style={css('display:flex;align-items:center;gap:8px')}>
              <span style={css('font-size:13px;font-weight:700;margin-right:4px')}>{(mi + 1) + ' / ' + nM}</span>
              <Link href={'/peserta/' + mates[(mi - 1 + nM) % nM].uid} aria-label="Peserta sebelumnya" style={css('width:40px;height:40px;border-radius:50%;background:#fff;color:var(--dark-blue);display:flex;align-items:center;justify-content:center;font-size:17px;text-decoration:none')}>←</Link>
              <Link href={'/peserta/' + mates[(mi + 1) % nM].uid} aria-label="Peserta berikutnya" style={css('width:40px;height:40px;border-radius:50%;background:#fff;color:var(--dark-blue);display:flex;align-items:center;justify-content:center;font-size:17px;text-decoration:none')}>→</Link>
            </div>}
          </div>
          <div style={css('display:flex;flex-wrap:wrap;gap:clamp(32px,5vw,72px);align-items:center;margin-top:clamp(28px,4vw,48px)')}>
            <figure style={css('flex:0 1 320px;min-width:220px;margin:0;padding:12px 12px 18px;background:#fff;border-radius:6px;box-shadow:0 18px 40px rgba(0,0,0,.18);transform:rotate(-3deg)')}>
              <div style={css(`position:relative;aspect-ratio:4/5;overflow:hidden;background:${coh.tint};color:var(--dark-blue)`)}>
                {photo
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={photo} alt={'Foto ' + person.nickname} style={css('position:absolute;inset:0;width:100%;height:100%;object-fit:cover')} />
                  : <span aria-hidden="true" style={css('position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:var(--font-headline);font-weight:700;font-size:clamp(96px,12vw,160px)')}>{person.nickname[0]?.toUpperCase() ?? '?'}</span>}
              </div>
              <figcaption style={css('margin-top:12px;text-align:center;font-family:var(--font-caption);font-style:italic;font-size:15px;color:var(--dark-blue)')}>{person.nickname + ' · ' + coh.city}</figcaption>
            </figure>
            <div style={css('flex:1 1 420px;min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:18px')}>
              <span style={css('padding:6px 14px;border-radius:999px;background:#fff;color:var(--dark-blue);font-size:14px;font-weight:700')}>{cohLabel(coh)}</span>
              <h1 style={css('font-family:var(--font-headline);font-weight:700;font-size:clamp(52px,8vw,112px);line-height:.9;letter-spacing:-0.05em;margin:0')}>{person.nickname}</h1>
              <p style={css('margin:0;font-size:19px;line-height:1.55;max-width:560px;white-space:pre-line;text-wrap:pretty')}>
                {person.bio || `Peserta kelas ${track.name} di ${coh.city}, Bootcamp Future Innovators 2026.`}
              </p>
              {person.skills.length > 0 && (
                <div style={css('display:flex;flex-wrap:wrap;gap:8px')}>
                  {person.skills.map((sk) => <span key={sk} style={css(pill)}>{sk}</span>)}
                </div>
              )}
              {(linkedin || portfolio) && (
                <div style={css('display:flex;flex-wrap:wrap;gap:10px;margin-top:4px')}>
                  {linkedin && <a href={linkedin} target="_blank" rel="noreferrer" style={css('padding:12px 22px;border-radius:999px;background:#fff;color:var(--dark-blue);font-weight:700;font-size:15px;text-decoration:none')}>LinkedIn</a>}
                  {portfolio && <a href={portfolio} target="_blank" rel="noreferrer" style={css(`padding:10px 20px;border-radius:999px;border:2px solid ${fg};color:${fg};font-weight:700;font-size:15px;text-decoration:none`)}>{coh.track === 'web' ? 'GitHub' : 'Portofolio'}</a>}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {works.length > 0 && (
        <section style={css('padding:clamp(48px,7vw,88px) 22px')}>
          <div style={css('max-width:1180px;margin:0 auto')}>
            <span style={css('font-size:15px;font-weight:700;color:var(--text-muted)')}>{'Karya ' + person.nickname}</span>
            <h2 style={css('font-family:var(--font-headline);font-weight:700;font-size:clamp(32px,4.4vw,52px);line-height:1;letter-spacing:-0.03em;margin:6px 0 0;display:flex;align-items:center;gap:14px;color:var(--dark-blue)')}>Karya <span style={css(`font-size:0.5em;padding:6px 14px;border-radius:999px;background:${coh.color};color:${fg};letter-spacing:0`)}>{works.length}</span></h2>
            <div style={css('display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,320px),1fr));gap:20px;margin-top:32px')}>
              {works.map((w) => <WorkCard key={w.href} w={w} />)}
            </div>
          </div>
        </section>
      )}

      {others.length > 0 && (
        <section style={css(`padding:clamp(48px,7vw,80px) 22px clamp(72px,10vw,120px);background:${coh.tint}`)}>
          <div style={css('max-width:1180px;margin:0 auto')}>
            <div style={css('display:flex;flex-wrap:wrap;gap:12px;align-items:baseline;justify-content:space-between;margin-bottom:24px')}>
              <h2 style={css('font-family:var(--font-headline);font-weight:700;font-size:clamp(26px,3vw,36px);line-height:1.1;letter-spacing:-0.025em;margin:0;color:var(--dark-blue)')}>Teman sekelas</h2>
              <Hv as={Link} href={'/peserta?kelas=' + coh.key} s="all:unset;cursor:pointer;font-size:15px;font-weight:700;color:var(--dark-blue)" h="text-decoration:underline">Lihat semua di kelas ini →</Hv>
            </div>
            <div style={css('display:grid;grid-template-columns:repeat(auto-fill,minmax(min(160px,46%),1fr));gap:0;border-radius:20px;overflow:hidden')}>
              {others.map((m) => <PersonTile key={m.uid} u={m} />)}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
