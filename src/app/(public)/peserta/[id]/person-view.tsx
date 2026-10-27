'use client';

import React from 'react';
import Link from 'next/link';
import { COH, TRACKS, cohLabel } from '@/features/exhibition/content';
import { safeExternalUrl, toCardData } from '@/features/exhibition/model';
import type { PersonDetail, PublicPerson } from '@/features/exhibition/read';
import { Hv, WorkCard, css } from '@/features/exhibition/ui';
import { PersonTile } from '../people-view';

/**
 * Profil satu peserta, gaya modern dan minimalis: latar putih, foto potret,
 * warna kelas hanya sebagai aksen kecil, data singkat dalam satu baris. Bagian
 * karya hanya tampil bila ada karya terbit; tautan LinkedIn dan portofolio
 * hanya dirender bila http(s).
 *
 * One participant profile, modern and minimal: white background, a portrait
 * photo, the class colour only as a small accent, and key facts in one row.
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
  const navBtn = 'width:36px;height:36px;border-radius:50%;border:1px solid #E1E6EB;color:var(--dark-blue);display:flex;align-items:center;justify-content:center;text-decoration:none';

  return (
    <>
      <section style={css('background:#fff;padding:120px 22px clamp(48px,7vw,88px)')}>
        <div style={css('max-width:1080px;margin:0 auto')}>
          <nav aria-label="Navigasi peserta" style={css('display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:14px;color:var(--text-muted)')}>
            <Link href="/peserta" style={css('color:var(--text-muted);text-decoration:none;font-weight:600')}>← Semua peserta</Link>
            {mi >= 0 && nM > 1 && <span style={css('display:flex;align-items:center;gap:6px')}>
              <Link href={'/peserta/' + mates[(mi - 1 + nM) % nM].uid} aria-label="Peserta sebelumnya" style={css(navBtn)}>←</Link>
              <span style={css('min-width:52px;text-align:center;font-variant-numeric:tabular-nums')}>{(mi + 1) + ' / ' + nM}</span>
              <Link href={'/peserta/' + mates[(mi + 1) % nM].uid} aria-label="Peserta berikutnya" style={css(navBtn)}>→</Link>
            </span>}
          </nav>
          <div style={css('display:flex;flex-wrap:wrap;gap:clamp(32px,6vw,80px);align-items:center;margin-top:clamp(28px,4vw,44px)')}>
            <div style={css(`flex:0 1 400px;min-width:240px;position:relative;aspect-ratio:4/5;border-radius:20px;overflow:hidden;background:${coh.tint};color:var(--dark-blue)`)}>
              {photo
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={photo} alt={'Foto ' + person.nickname} style={css('position:absolute;inset:0;width:100%;height:100%;object-fit:cover')} />
                : <span aria-hidden="true" style={css('position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:var(--font-headline);font-weight:700;font-size:clamp(96px,12vw,160px)')}>{person.nickname[0]?.toUpperCase() ?? '?'}</span>}
            </div>
            <div style={css('flex:1 1 380px;min-width:0;display:flex;flex-direction:column;gap:20px')}>
              <span style={css('display:flex;align-items:center;gap:10px;font-size:13px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--text-muted)')}>
                <span aria-hidden="true" style={css(`width:10px;height:10px;border-radius:50%;background:${coh.color}`)} />{cohLabel(coh)}
              </span>
              <h1 style={css('font-family:var(--font-headline);font-weight:700;font-size:clamp(48px,6.4vw,88px);line-height:.95;letter-spacing:-0.045em;margin:0;color:var(--dark-blue)')}>{person.nickname}</h1>
              <p style={css('margin:0;font-size:18px;line-height:1.65;max-width:520px;color:var(--text-muted);white-space:pre-line;text-wrap:pretty')}>
                {person.bio || `Peserta kelas ${track.name} di ${coh.city}, Bootcamp Future Innovators 2026.`}
              </p>
              <dl style={css('display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin:8px 0 0;padding:20px 0;border-top:1px solid #ECEFF2;border-bottom:1px solid #ECEFF2;max-width:520px')}>
                {[['Jurusan', track.name], ['Kota', coh.city], ['Karya', String(works.length)]].map(([k, v]) => (
                  <div key={k} style={css('display:flex;flex-direction:column;gap:4px;min-width:0')}>
                    <dt style={css('font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--text-muted)')}>{k}</dt>
                    <dd style={css('margin:0;font-size:15px;font-weight:700;color:var(--dark-blue)')}>{v}</dd>
                  </div>
                ))}
              </dl>
              {person.skills.length > 0 && (
                <div style={css('display:flex;flex-wrap:wrap;gap:8px')}>
                  {person.skills.map((sk) => <span key={sk} style={css('padding:6px 14px;border-radius:999px;background:#F2F4F6;font-size:13px;font-weight:600;color:var(--dark-blue)')}>{sk}</span>)}
                </div>
              )}
              {(linkedin || portfolio) && (
                <div style={css('display:flex;flex-wrap:wrap;gap:10px')}>
                  {linkedin && <a href={linkedin} target="_blank" rel="noreferrer" style={css('padding:12px 22px;border-radius:999px;background:var(--dark-blue);color:#fff;font-weight:700;font-size:14px;text-decoration:none')}>LinkedIn</a>}
                  {portfolio && <a href={portfolio} target="_blank" rel="noreferrer" style={css('padding:11px 21px;border-radius:999px;border:1px solid #D5DBE1;color:var(--dark-blue);font-weight:700;font-size:14px;text-decoration:none')}>{coh.track === 'web' ? 'GitHub' : 'Portofolio'}</a>}
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
        <section style={css(`padding:clamp(48px,7vw,80px) 22px clamp(72px,10vw,120px);background:#F7F8FA`)}>
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
