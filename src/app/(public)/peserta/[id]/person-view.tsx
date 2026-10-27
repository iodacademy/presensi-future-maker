'use client';

import React from 'react';
import Link from 'next/link';
import { COH, TRACKS, cohLabel } from '@/features/exhibition/content';
import { safeExternalUrl, toCardData } from '@/features/exhibition/model';
import type { PersonDetail, PublicPerson } from '@/features/exhibition/read';
import { Hv, WorkCard, css } from '@/features/exhibition/ui';
import { PersonTile } from '../people-view';

/**
 * Profil satu peserta, bergaya halaman profil tim: potret di kiri, nama dan
 * keahlian di kanan, lalu isi dua kolom dengan kartu ringkas di samping.
 * Bagian karya hanya tampil bila ada karya terbit; tautan LinkedIn dan
 * portofolio hanya dirender bila http(s).
 *
 * One participant profile, styled like a team profile page: portrait on the
 * left, name and skills on the right, then a two-column body with a summary
 * card at the side. The works section shows only when there are published
 * works; the LinkedIn and portfolio links render only when http(s).
 */
export function PersonView({ person, mates }: { person: PersonDetail; mates: PublicPerson[] }) {
  const coh = COH[person.cohort], track = TRACKS[coh.track];
  const photo = safeExternalUrl(person.photoUrl);
  const linkedin = safeExternalUrl(person.linkedinUrl), portfolio = safeExternalUrl(person.portfolioUrl);
  const works = person.works.map(toCardData);
  const mi = mates.findIndex((x) => x.uid === person.uid), nM = mates.length;
  const others = mates.filter((x) => x.uid !== person.uid).slice(0, 12);
  const label = cohLabel(coh);

  return (
    <>
      <section style={css(`background:linear-gradient(135deg,${coh.tint} 0%,#F4F7FB 70%);padding:104px 22px 0`)}>
        <div style={css('max-width:1180px;margin:0 auto;display:flex;flex-wrap:wrap;gap:clamp(28px,5vw,56px);align-items:flex-end')}>
          <div style={css(`flex:0 1 380px;min-width:220px;aspect-ratio:4/5;border-radius:24px 24px 0 0;overflow:hidden;position:relative;background:${coh.color};color:${coh.fg}`)}>
            {photo
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={photo} alt={'Foto ' + person.nickname} style={css('position:absolute;inset:0;width:100%;height:100%;object-fit:cover')} />
              : <span aria-hidden="true" style={css('position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:var(--font-headline);font-weight:700;font-size:clamp(96px,14vw,180px);letter-spacing:-0.05em')}>{person.nickname[0]?.toUpperCase() ?? '?'}</span>}
          </div>
          <div style={css('flex:1 1 380px;min-width:0;display:flex;flex-direction:column;gap:14px;padding-bottom:clamp(32px,5vw,56px)')}>
            <span style={css(`font-size:13px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:${coh.color === '#8AC208' ? '#5E8A00' : coh.color}`)}>Peserta Bootcamp Future Innovators 2026</span>
            <div style={css('display:flex;flex-wrap:wrap;align-items:center;gap:14px')}>
              <h1 style={css('font-family:var(--font-headline);font-weight:700;font-size:clamp(44px,6.4vw,84px);line-height:0.95;letter-spacing:-0.045em;margin:0;color:var(--dark-blue)')}>{person.nickname}</h1>
            </div>
            <span style={css('font-family:var(--font-caption);font-style:italic;font-size:18px;color:var(--text-muted)')}>{label}</span>
            {person.skills.length > 0 && (
              <ul style={css('list-style:none;margin:8px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:10px')}>
                {person.skills.map((sk) => (
                  <li key={sk} style={css('display:flex;align-items:center;gap:10px;padding:8px 16px 8px 8px;border-radius:999px;background:#fff;box-shadow:0 1px 3px rgba(36,60,75,.12);font-size:14px;font-weight:700;color:var(--dark-blue)')}>
                    <span aria-hidden="true" style={css(`width:22px;height:22px;border-radius:50%;background:${coh.color};color:${coh.fg};display:flex;align-items:center;justify-content:center;font-size:12px`)}>✓</span>{sk}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <div style={css('background:var(--dark-blue);color:#fff;text-align:center;padding:20px 22px;font-size:clamp(14px,1.4vw,17px);font-weight:700;letter-spacing:.2em;text-transform:uppercase')}>{'Kelas ' + track.name}</div>

      <section style={css('padding:clamp(40px,6vw,72px) 22px clamp(56px,8vw,96px)')}>
        <div style={css('max-width:1180px;margin:0 auto;display:flex;flex-wrap:wrap;gap:clamp(28px,4vw,56px);align-items:flex-start')}>
          <div style={css('flex:1 1 560px;min-width:0;display:flex;flex-direction:column;gap:clamp(32px,4vw,48px)')}>
            <div style={css('display:flex;flex-direction:column;gap:12px')}>
              <h2 style={css('font-family:var(--font-headline);font-weight:700;font-size:22px;margin:0;color:var(--dark-blue)')}>Tentang</h2>
              <p style={css('margin:0;font-size:17px;line-height:1.65;color:var(--text-body);white-space:pre-line;text-wrap:pretty')}>
                {person.bio || `${person.nickname} adalah peserta kelas ${track.name} di ${coh.city}, bagian dari Bootcamp Future Innovators 2026.`}
              </p>
            </div>
            {works.length > 0 && (
              <div style={css('display:flex;flex-direction:column;gap:20px')}>
                <h2 style={css('font-family:var(--font-headline);font-weight:700;font-size:22px;margin:0;color:var(--dark-blue);display:flex;align-items:center;gap:10px')}>Karya <span style={css(`font-size:13px;padding:4px 10px;border-radius:999px;background:${coh.color};color:${coh.fg}`)}>{works.length}</span></h2>
                <div style={css('display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,280px),1fr));gap:20px')}>
                  {works.map((w) => <WorkCard key={w.href} w={w} />)}
                </div>
              </div>
            )}
          </div>

          <aside style={css('flex:0 1 360px;min-width:260px;position:sticky;top:104px;display:flex;flex-direction:column;gap:14px;padding:24px;border-radius:20px;background:#F4F7FB;border:1px solid #E6ECF2')}>
            <div style={css('display:flex;flex-direction:column;gap:4px')}>
              <span style={css('font-family:var(--font-headline);font-weight:700;font-size:19px;color:var(--dark-blue)')}>{person.nickname}</span>
              <span style={css('font-family:var(--font-caption);font-style:italic;font-size:15px;color:var(--text-muted)')}>{label}</span>
            </div>
            {linkedin && <Hv as="a" href={linkedin} target="_blank" rel="noreferrer" s="all:unset;cursor:pointer;text-align:center;padding:13px 20px;border-radius:999px;background:var(--plan-blue);color:#fff;font-weight:700;font-size:15px" h="background:var(--dark-blue)">LinkedIn</Hv>}
            {portfolio && <Hv as="a" href={portfolio} target="_blank" rel="noreferrer" s="all:unset;cursor:pointer;text-align:center;padding:11px 20px;border-radius:999px;border:2px solid var(--dark-blue);color:var(--dark-blue);font-weight:700;font-size:15px" h="background:#fff">{coh.track === 'web' ? 'GitHub' : 'Portofolio'}</Hv>}
            <Hv as={Link} href={'/galeri?kelas=' + coh.key} s="all:unset;cursor:pointer;text-align:center;padding:11px 20px;border-radius:999px;background:#fff;border:1px solid #E6ECF2;color:var(--dark-blue);font-weight:700;font-size:15px" h="border-color:var(--dark-blue)">Karya kelas ini</Hv>
            <div style={css('display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:4px')}>
              <Link href="/peserta" style={css('font-weight:700;font-size:14px;color:var(--dark-blue);text-decoration:none')}>← Semua peserta</Link>
              {mi >= 0 && nM > 1 && <span style={css('display:flex;align-items:center;gap:6px')}>
                <Link href={'/peserta/' + mates[(mi - 1 + nM) % nM].uid} aria-label="Peserta sebelumnya" style={css('width:34px;height:34px;border-radius:50%;background:#fff;border:1px solid #E6ECF2;color:var(--dark-blue);display:flex;align-items:center;justify-content:center;text-decoration:none')}>←</Link>
                <Link href={'/peserta/' + mates[(mi + 1) % nM].uid} aria-label="Peserta berikutnya" style={css('width:34px;height:34px;border-radius:50%;background:#fff;border:1px solid #E6ECF2;color:var(--dark-blue);display:flex;align-items:center;justify-content:center;text-decoration:none')}>→</Link>
              </span>}
            </div>
          </aside>
        </div>
      </section>

      {others.length > 0 && (
        <section style={css('padding:0 0 clamp(72px,10vw,120px)')}>
          <div style={css('background:var(--dark-blue);color:#fff;text-align:center;padding:20px 22px;font-size:clamp(14px,1.4vw,17px);font-weight:700;letter-spacing:.2em;text-transform:uppercase')}>Teman sekelas</div>
          <div style={css('max-width:1180px;margin:0 auto;padding:clamp(28px,4vw,48px) 22px 0')}>
            <div style={css('display:grid;grid-template-columns:repeat(auto-fill,minmax(min(180px,46%),1fr));gap:0')}>
              {others.map((m) => <PersonTile key={m.uid} u={m} />)}
            </div>
            <div style={css('display:flex;justify-content:center;margin-top:28px')}>
              <Hv as={Link} href={'/peserta?kelas=' + coh.key} s="all:unset;cursor:pointer;font-size:15px;font-weight:700;color:var(--dark-blue)" h="text-decoration:underline">Lihat semua di kelas ini →</Hv>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
