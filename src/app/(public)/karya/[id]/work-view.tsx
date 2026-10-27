'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { COH, SLIDE_INTERVAL_SECONDS, TRACKS, TYPE } from '@/features/exhibition/content';
import { safeExternalUrl, toCardData, type GalleryCard } from '@/features/exhibition/model';
import type { WorkDetail } from '@/features/exhibition/read';
import { Hv, WorkCard, css, media } from '@/features/exhibition/ui';

const CAPTION: Record<string, string> = {
  site: 'Tampilan karya. Tekan "Coba langsung" untuk mencobanya di halaman ini.',
  html: 'Tampilan karya. Tekan "Coba langsung" untuk mencobanya di halaman ini.',
  carousel: 'Geser atau tekan panah untuk melihat semua slide.',
  video: '',
  pdf: 'Dokumen lengkap tersedia dalam format PDF.',
};
const SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-popups';
const PRIMARY = 'display:inline-flex;align-items:center;justify-content:center;gap:8px;font-family:var(--font-body);font-weight:700;line-height:1;padding:12px 24px;font-size:16px;color:var(--white);background:var(--plan-blue);border:2px solid var(--plan-blue);border-radius:var(--radius-pill);cursor:pointer;text-decoration:none;transition:filter var(--duration) var(--ease-standard), transform var(--duration-fast) var(--ease-standard);-webkit-tap-highlight-color:transparent';
const NAV_BTN = 'all:unset;cursor:pointer;position:absolute;top:50%;transform:translateY(-50%);z-index:2;width:44px;height:44px;border-radius:50%;background:#fff;color:var(--dark-blue);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;box-shadow:var(--shadow-sm)';

/**
 * Slide karya: maju sendiri tiap SLIDE_INTERVAL_SECONDS detik, berhenti saat kursor di atasnya, bisa digeser.
 *
 * Work slides: advance by themselves every SLIDE_INTERVAL_SECONDS seconds, pause while hovered, swipeable.
 */
function Carousel({ slides, title }: { slides: string[]; title: string }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);
  const n = slides.length;
  useEffect(() => {
    if (paused || n < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % n), SLIDE_INTERVAL_SECONDS * 1000);
    return () => clearInterval(t);
  }, [paused, n]);
  const go = (d: number) => setI((x) => (x + d + n) % n);
  return (
    <div
      aria-label="Slide karya"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - (touchX.current ?? e.changedTouches[0].clientX);
        touchX.current = null;
        if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
      }}
      style={css('position:relative;aspect-ratio:16/9;background:var(--surface-muted);border-radius:24px;overflow:hidden')}
    >
      {slides.map((src, k) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={src + k} src={src} alt={title + ' slide ' + (k + 1)} aria-current={k === i} loading={k === 0 ? 'eager' : 'lazy'} style={css(`position:absolute;inset:0;width:100%;height:100%;object-fit:contain;opacity:${k === i ? 1 : 0};transition:opacity 400ms ease`)} />
      ))}
      {n > 1 && (
        <>
          <Hv onClick={() => go(-1)} aria-label="Sebelumnya" s={NAV_BTN + ';left:14px'}>‹</Hv>
          <Hv onClick={() => go(1)} aria-label="Berikutnya" s={NAV_BTN + ';right:14px'}>›</Hv>
          <span style={css('position:absolute;left:50%;bottom:12px;transform:translateX(-50%);padding:4px 12px;border-radius:999px;background:rgba(36,60,75,.8);color:#fff;font-size:12px;font-weight:700')}>{(i + 1) + ' / ' + n}</span>
        </>
      )}
    </div>
  );
}

/**
 * Halaman satu karya. Iframe situs/HTML baru dimuat setelah pengunjung menekan "Coba langsung";
 * setiap tautan tersimpan hanya dirender bila http(s).
 *
 * One work page. The site/HTML iframe loads only after the visitor presses "Coba langsung";
 * every stored link renders only when it is http(s).
 */
export function WorkView({ work, related }: { work: WorkDetail; related: GalleryCard[] }) {
  const [live, setLive] = useState(false);
  const t = TRACKS[work.track], coh = COH[work.cohort];
  const kind = work.media.kind;
  const url = safeExternalUrl(work.media.url);
  const cover = safeExternalUrl(work.coverFull);
  const slides = work.media.slides.filter((s) => safeExternalUrl(s));
  const host = (() => { try { return url ? new URL(url).host : ''; } catch { return ''; } })();
  const specs = [
    { k: 'Peserta', v: work.nickname }, { k: 'Track', v: t.name }, { k: 'Jenis karya', v: work.type },
    ...(work.tools.length ? [{ k: 'Tools', v: work.tools.join(', ') }] : []),
    ...(coh ? [{ k: 'Kota', v: coh.city }] : []),
  ];
  const vid = kind === 'video' && url ? media(url) : null;

  return (
    <>
      <section style={css('padding:calc(80px + clamp(40px,6vw,72px)) 22px 40px;text-align:center')}>
        <div style={css('max-width:880px;margin:0 auto;display:flex;flex-direction:column;align-items:center;gap:14px')}>
          <Link href={'/galeri?jurusan=' + work.track} style={css('all:unset;cursor:pointer;font-size:15px;font-weight:700;color:var(--plan-blue)')}>{t.name} · {work.type}</Link>
          <h1 style={css('font-family:var(--font-headline);font-weight:700;font-size:clamp(36px,5.6vw,64px);line-height:1.06;letter-spacing:-0.035em;margin:0;text-wrap:balance')}>{work.title}</h1>
          <Hv as={Link} href={'/peserta/' + work.personUid} s="all:unset;cursor:pointer;font-size:19px;color:var(--text-muted)" h="color:var(--dark-blue)">oleh {work.nickname} ›</Hv>
          <div style={css('display:flex;flex-wrap:wrap;gap:12px 20px;align-items:center;justify-content:center;margin-top:12px')}>
            {work.aiAssisted && <span style={css('padding:6px 12px;border-radius:999px;background:var(--dark-blue);color:#fff;font-size:13px;font-weight:700')}>Dibuat dengan bantuan AI</span>}
            {work.collection && <Link href={'/koleksi/' + work.collection.id} style={css('font-size:15px;font-weight:700')}>{'Bagian dari koleksi ' + work.collection.title + ' ›'}</Link>}
          </div>
          {(kind === 'site' || kind === 'html') && url && (
            <a href={url} target="_blank" rel="noreferrer" style={css(PRIMARY)}>Buka demo</a>
          )}
          {kind === 'pdf' && url && (
            <a href={url} target="_blank" rel="noreferrer" style={css(PRIMARY)}>Buka PDF</a>
          )}
        </div>
      </section>
      <section style={css('padding:0 22px')}>
        <div style={css('max-width:1180px;margin:0 auto')}>
          {(kind === 'site' || kind === 'html') && (
            <div style={css('background:var(--surface-muted);border-radius:24px;padding:clamp(24px,5vw,64px) clamp(16px,5vw,64px) 0;overflow:hidden')}>
              <div style={css('max-width:960px;margin:0 auto;background:#fff;border-radius:12px 12px 0 0;box-shadow:var(--shadow-md);overflow:hidden')}>
                <div style={css('display:flex;gap:6px;align-items:center;padding:10px 14px;border-bottom:1px solid #ececea')}>
                  {[0, 1, 2].map((k) => <span key={k} style={css('width:10px;height:10px;border-radius:50%;background:var(--light-grey)')} />)}
                  <span style={css('flex:1;text-align:center;font-size:12px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap')}>{host}</span>
                </div>
                <div style={css('position:relative;aspect-ratio:16/9;display:flex;align-items:center;justify-content:center')}>
                  {live && url ? (
                    <iframe src={url} title={work.title} sandbox={SANDBOX} style={css('position:absolute;inset:0;width:100%;height:100%;border:0;background:#fff')} />
                  ) : (
                    <>
                      {cover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={cover} alt={work.title} style={css('position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:top')} />
                      ) : (
                        <span style={css('font-family:var(--font-caption);font-style:italic;font-size:15px;color:var(--text-muted)')}>{TYPE[work.type]?.thumb ?? work.type}</span>
                      )}
                      {url && !work.media.noEmbed && <Hv onClick={() => setLive(true)} s="all:unset;cursor:pointer;position:absolute;left:50%;bottom:20px;transform:translateX(-50%);padding:12px 22px;border-radius:999px;background:var(--dark-blue);color:#fff;font-weight:700;font-size:15px;box-shadow:var(--shadow-md)" h="background:var(--plan-blue)">Coba langsung</Hv>}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
          {kind === 'carousel' && (slides.length > 0
            ? <Carousel slides={slides} title={work.title} />
            : <div style={css('aspect-ratio:16/9;background:var(--surface-muted);border-radius:24px;display:flex;align-items:center;justify-content:center;font-family:var(--font-caption);font-style:italic;color:var(--text-muted)')}>Slide belum ditambahkan</div>)}
          {kind === 'video' && (
            <div style={css('position:relative;aspect-ratio:16/9;background:var(--dark-blue);border-radius:24px;overflow:hidden')}>
              {vid?.isEmbed && <iframe src={vid.embed} title={work.title} allow="autoplay; encrypted-media; fullscreen" allowFullScreen style={css('position:absolute;inset:0;width:100%;height:100%;border:0')} />}
              {vid?.isFile && <video src={vid.url} controls playsInline style={css('position:absolute;inset:0;width:100%;height:100%;background:#000')} />}
              {!vid && <span style={css('position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700')}>Video belum tersedia</span>}
            </div>
          )}
          {kind === 'pdf' && (
            <div style={css('background:var(--surface-muted);border-radius:24px;padding:clamp(16px,4vw,48px) 22px;display:flex;justify-content:center')}>
              {url
                ? <iframe src={url} title={work.title} style={css('width:min(100%,900px);height:min(85vh,1100px);border:0;border-radius:6px;background:#fff;box-shadow:var(--shadow-lg)')} />
                : <span style={css('font-family:var(--font-caption);font-style:italic;color:var(--text-muted)')}>Dokumen belum tersedia</span>}
            </div>
          )}
          {CAPTION[kind] && <p style={css('text-align:center;font-family:var(--font-caption);font-style:italic;font-size:13px;color:var(--text-muted);margin:14px 0 0')}>{CAPTION[kind]}</p>}
        </div>
      </section>
      <section style={css('padding:clamp(56px,8vw,96px) 22px')}>
        <div style={css('max-width:880px;margin:0 auto;display:flex;flex-wrap:wrap;gap:48px')}>
          {work.description && <p style={css('flex:1 1 380px;margin:0;font-family:var(--font-headline);font-weight:500;font-size:clamp(19px,2vw,22px);line-height:1.45;letter-spacing:-0.01em;text-wrap:pretty;white-space:pre-line')}>{work.description}</p>}
          <dl style={css('flex:1 1 280px;margin:0;display:flex;flex-direction:column')}>
            {specs.map((sp) => (
              <div key={sp.k} style={css('display:flex;justify-content:space-between;gap:16px;padding:14px 0;border-top:1px solid #ececea;font-size:15px')}>
                <dt style={css('color:var(--text-muted)')}>{sp.k}</dt>
                <dd style={css('margin:0;text-align:right')}>{sp.v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
      {related.length > 0 && (
        <section style={css('padding:clamp(56px,8vw,96px) 22px;background:var(--surface-muted)')}>
          <div style={css('max-width:1180px;margin:0 auto')}>
            <h2 style={css('font-family:var(--font-headline);font-weight:700;font-size:clamp(28px,3.4vw,40px);line-height:1.1;letter-spacing:-0.025em;margin:0;text-align:center')}>Karya serupa.</h2>
            <div style={css('display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:20px;margin-top:40px')}>
              {related.map((r) => <WorkCard key={r.id} w={toCardData(r)} />)}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
