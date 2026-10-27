'use client';

import React, { useState } from 'react';
import { COH, cohLabel } from '@/features/exhibition/content';
import { safeExternalUrl, type ExhibitionCollection, type GalleryCard } from '@/features/exhibition/model';
import { Hv, css } from '@/features/exhibition/ui';

type Version = GalleryCard & { siteUrl: string };

/**
 * Halaman satu koleksi: satu brief, banyak versi. Iframe baru dimuat setelah
 * pengunjung menekan "Coba langsung", jadi membuka halaman tidak memuat situs orang.
 *
 * One collection page: one brief, many versions. The iframe loads only after the
 * visitor presses "Coba langsung", so opening the page does not load anyone's site.
 */
export function CollectionView({ collection, versions }: { collection: ExhibitionCollection; versions: Version[] }) {
  const [live, setLive] = useState<Version | null>(null);
  const coh = COH[collection.cohort];
  return (
    <>
      <section style={css(`background:${coh.color};color:${coh.fg};padding:calc(80px + clamp(40px,6vw,72px)) 22px 40px`)}>
        <div style={css('max-width:1180px;margin:0 auto;display:flex;flex-direction:column;gap:14px')}>
          <p style={css('font-size:14px;font-weight:700;opacity:.8;margin:0')}>{'Koleksi · ' + cohLabel(coh)}</p>
          <h1 style={css('font-family:var(--font-headline);font-weight:700;font-size:clamp(36px,6vw,64px);line-height:1.05;letter-spacing:-0.02em;margin:0')}>{collection.title}.<br />{'Satu brief, ' + versions.length + ' versi.'}</h1>
          {collection.brief && <p style={css('font-size:18px;line-height:1.5;max-width:640px;margin:0;opacity:.92')}>{collection.brief}</p>}
        </div>
      </section>
      <section style={css('padding:32px 22px clamp(72px,10vw,120px)')}>
        <div style={css('max-width:1180px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:20px')}>
          {versions.map((v) => {
            const url = safeExternalUrl(v.siteUrl);
            return (
            <div key={v.id} style={css('background:#fff;border-radius:18px;overflow:hidden;border:1px solid #ececea;display:flex;flex-direction:column')}>
              <button type="button" onClick={() => url && setLive(v)} aria-label={'Coba langsung versi ' + v.nickname} style={css(`all:unset;cursor:pointer;position:relative;aspect-ratio:16/10;background:${coh.tint};overflow:hidden`)}>
                {v.thumb && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={v.thumb} alt={collection.title + ' versi ' + v.nickname} loading="lazy" style={css('width:100%;height:100%;object-fit:cover;object-position:top')} />
                )}
              </button>
              <div style={css('padding:14px 16px;display:flex;align-items:center;gap:10px')}>
                <span style={css(`width:30px;height:30px;flex:none;border-radius:50%;background:${coh.color};color:${coh.fg};display:flex;align-items:center;justify-content:center;font-family:var(--font-headline);font-weight:700;font-size:11px`)}>{v.nickname[0]?.toUpperCase()}</span>
                <span style={css('flex:1;font-size:15px;font-weight:700;color:var(--dark-blue)')}>{'Versi ' + v.nickname}</span>
                {v.aiAssisted && <span style={css('font-size:11px;font-weight:700;color:var(--text-muted)')}>Dibuat dengan bantuan AI</span>}
                {url && <Hv onClick={() => setLive(v)} s="all:unset;cursor:pointer;padding:7px 12px;border-radius:999px;background:var(--surface-muted);color:var(--dark-blue);font-size:13px;font-weight:700" h="background:#e3eff9">Coba langsung</Hv>}
                {url && <Hv as="a" href={url} target="_blank" rel="noreferrer" s="all:unset;cursor:pointer;padding:7px 12px;border-radius:999px;background:var(--dark-blue);color:#fff;font-size:13px;font-weight:700" h="background:var(--plan-blue)">Buka demo ↗</Hv>}
              </div>
            </div>
            );
          })}
        </div>
      </section>

      {live && safeExternalUrl(live.siteUrl) && (
        <div onClick={() => setLive(null)} style={css('position:fixed;inset:0;z-index:50;background:rgba(10,20,30,.78);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;gap:12px')}>
          <div onClick={(e) => e.stopPropagation()} style={css('width:min(1200px,100%);display:flex;align-items:center;gap:12px;color:#fff')}>
            <span style={css('flex:1;font-weight:700;font-size:16px')}>{collection.title + ' · versi ' + live.nickname}</span>
            <a href={live.siteUrl} target="_blank" rel="noreferrer" style={css('color:#fff;font-weight:700;font-size:14px')}>Buka demo ↗</a>
            <button type="button" onClick={() => setLive(null)} style={css('all:unset;cursor:pointer;font-size:22px;font-weight:700;padding:0 6px')} aria-label="Tutup">×</button>
          </div>
          <iframe src={live.siteUrl} title={collection.title + ' versi ' + live.nickname} sandbox="allow-scripts allow-same-origin allow-forms allow-popups" onClick={(e) => e.stopPropagation()} style={css('width:min(1200px,100%);height:min(78vh,760px);border:0;border-radius:14px;background:#fff')} />
        </div>
      )}
    </>
  );
}
