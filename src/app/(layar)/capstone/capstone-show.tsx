'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export interface CapstoneSlide {
  /** Sampul dulu; capstone SMM menyertakan slide, carousel, dan video reels / Cover first; SMM capstones add their slides, carousels, and reels videos */
  id: string; title: string; images: string[]; tools: string[]; nickname: string; photo: string;
  cohortLabel: string; color: string; fg: string; qr: string; isApp: boolean;
}

export interface CohortOption { key: string; label: string }

// Lama satu karya tampil / How long one work shows
const SLIDE_MS = 7000;
// Lama satu gambar sorotan tampil / How long one highlight image shows
const IMG_MS = 4000;
// ponytail: video diputar sampai selesai tetapi paling lama 30 detik, agar satu reels panjang tidak menahan layar
// ponytail: a video plays to its end but at most 30 s, so one long reel does not hold the screen
const VIDEO_MAX_MS = 30000;
export const isVideo = (u: string) => /\.mp4(\?|$)/i.test(u);
const itemMs = (s: CapstoneSlide | undefined, k: number) =>
  isVideo(s?.images[k] ?? '') ? VIDEO_MAX_MS : (s?.images.length ?? 1) > 1 ? IMG_MS : SLIDE_MS;
// Data diambil ulang berkala agar capstone yang baru terbit ikut tampil tanpa memuat ulang layar
// Data is refetched periodically so newly published capstones appear without reloading the screen
const REFRESH_MS = 30 * 60 * 1000;
const IDLE_MS = 3000;
// Satuan vmax/vmin: ukuran sama di layar mendatar maupun berdiri / vmax/vmin units: the same size on landscape and portrait screens

const STYLE = `
.cap{position:fixed;inset:0;overflow:hidden;background:#0072CE;color:#fff;font-family:var(--font-body)}
.cap.idle{cursor:none}
.cap-glow{position:absolute;inset:-20%;background:radial-gradient(60% 55% at 22% 45%,rgba(255,255,255,.14) 0%,transparent 70%);pointer-events:none}
.cap-frame{position:absolute;inset:0;display:grid;grid-template-rows:auto 1fr auto;gap:3.2vh;padding:4.2vh 4vw}
.cap-top{position:relative;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:2vw}
.cap-brand{display:flex;align-items:center;gap:1.4vw}
.cap-logo{display:flex}
.cap-logo img{height:6vmin;width:auto;display:block}
.cap-name{display:flex;flex-direction:column;gap:.3vh}
.cap-name b{font-family:var(--font-headline);font-weight:700;font-size:clamp(18px,1.9vmax,40px);letter-spacing:-.02em;line-height:1}
.cap-name span{font-size:clamp(11px,.95vmax,20px);opacity:.7}
.cap-count{font-family:var(--font-headline);font-weight:700;font-size:clamp(16px,1.5vmax,32px);letter-spacing:.02em;opacity:.85}
.cap-stage{position:relative;min-height:0}
.cap-slide{position:absolute;inset:0;display:grid;grid-template-columns:1.55fr 1fr;gap:4vw;align-items:center}
.cap-slide.in{animation:capIn 700ms ease 350ms both}
.cap-slide.out{animation:capOut 350ms ease both;pointer-events:none}
.cap-shot{position:relative;border-radius:1.1vw;overflow:hidden;background:#00427A;box-shadow:0 3vh 8vh rgba(0,30,70,.4);border:1px solid rgba(255,255,255,.08)}
.cap-bar{height:3.6vh;display:flex;align-items:center;gap:.5vw;padding:0 1vw;background:#00427A}
.cap-bar i{width:.75vh;height:.75vh;min-width:6px;min-height:6px;border-radius:50%;background:rgba(255,255,255,.25)}
.cap-img{position:relative;aspect-ratio:16/10;overflow:hidden}
.cap-img img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:top center;transform-origin:50% 0}
.cap-slide.in .cap-img.one img{animation:capZoom ${SLIDE_MS + 1000}ms linear both}
.cap-img.many img{object-fit:contain;object-position:center;opacity:0;transition:opacity .7s ease}
.cap-img video{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#00427A}
.cap-img.many img.on{opacity:1}
.cap-info{display:flex;flex-direction:column;gap:3.2vh;min-width:0}
.cap-chip{align-self:flex-start;background:#fff;color:#0072CE;padding:.8vh 1vw;border-radius:999px;font-weight:700;font-size:clamp(11px,.95vmax,20px);letter-spacing:.02em}
.cap-coh{font-size:clamp(12px,1.05vmax,22px);opacity:.75;margin-top:-1.8vh}
.cap-title{margin:0;font-family:var(--font-headline);font-weight:700;font-size:clamp(28px,3.4vmax,72px);line-height:1.04;letter-spacing:-.03em;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;text-wrap:balance}
.cap-who{display:flex;align-items:center;gap:1.2vw}
.cap-av{position:relative;width:6.4vmax;height:6.4vmax;min-width:56px;min-height:56px;border-radius:50%;overflow:hidden;flex:none;display:flex;align-items:center;justify-content:center;font-family:var(--font-headline);font-weight:700;font-size:2.4vmax;border:.25vmax solid rgba(255,255,255,.9)}
.cap-av img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:top}
.cap-who small{display:block;font-size:clamp(11px,.9vmax,18px);opacity:.7;margin-bottom:.4vh}
.cap-who b{font-family:var(--font-headline);font-weight:700;font-size:clamp(20px,2.1vmax,44px);letter-spacing:-.02em;line-height:1.05}
.cap-label{font-size:clamp(11px,.9vmax,18px);opacity:.7;margin-bottom:1vh}
.cap-tools{display:flex;flex-wrap:wrap;gap:.6vw}
.cap-tools span{padding:.7vh .9vw;border-radius:999px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.16);font-weight:700;font-size:clamp(11px,.95vmax,20px)}
.cap-qr{display:flex;align-items:center;gap:1.4vw;align-self:flex-start;padding:1.4vh 1.6vw 1.4vh 1.4vh;border-radius:1.1vw;background:#fff;color:#243C4B}
.cap-qr div{width:9.5vmin;height:9.5vmin;min-width:72px;min-height:72px}
.cap-qr svg{width:100%;height:100%;display:block}
.cap-qr b{display:block;font-family:var(--font-headline);font-size:clamp(13px,1.1vmax,24px);line-height:1.15}
.cap-qr span{font-size:clamp(11px,.85vmax,18px);opacity:.75}
.cap-foot{display:flex;align-items:center;gap:2vw}
.cap-prog{flex:1;height:.5vh;min-height:4px;border-radius:999px;background:rgba(255,255,255,.14);overflow:hidden}
.cap-prog i{display:block;height:100%;background:#fff;border-radius:999px;animation:capBar linear both}
.cap.paused .cap-prog i{animation-play-state:paused}
.cap-next{font-size:clamp(11px,.95vmax,20px);opacity:.75;white-space:nowrap;max-width:40vw;overflow:hidden;text-overflow:ellipsis}
.cap-ctl{position:absolute;right:4vw;top:12vh;display:flex;gap:10px;transition:opacity .3s ease}
.cap.idle .cap-ctl{opacity:0;pointer-events:none}
.cap-ctl button{all:unset;cursor:pointer;padding:10px 16px;border-radius:999px;background:rgba(255,255,255,.14);font-weight:700;font-size:14px}
.cap-ctl button:hover,.cap-ctl button:focus-visible{background:rgba(255,255,255,.28)}
.cap-ctl .cap-pick{display:flex;gap:4px;padding:4px;border-radius:999px;background:rgba(0,30,70,.3)}
.cap-ctl .cap-pick button{background:none}
.cap-ctl .cap-pick button[aria-pressed="true"]{background:#fff;color:#0072CE}
.cap-empty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:var(--font-headline);font-size:2vmax;opacity:.8}
@keyframes capIn{from{opacity:0;transform:translateY(1.5vh)}to{opacity:1;transform:none}}
@keyframes capOut{from{opacity:1}to{opacity:0}}
@keyframes capZoom{from{transform:scale(1)}to{transform:scale(1.07)}}
@keyframes capBar{from{width:var(--a)}to{width:var(--b)}}
@media (max-aspect-ratio:1/1){.cap-slide{grid-template-columns:1fr;align-content:center;gap:4vh}}
@media (prefers-reduced-motion:reduce){.cap-slide.in .cap-img img{animation:none}.cap-img.many img{transition:none}.cap-slide.in{animation:none}.cap-slide.out{display:none}}
`;

/**
 * Tayangan layar penuh seluruh capstone yang berputar sendiri tanpa henti.
 * Tombol: panah kiri/kanan berpindah, spasi menjeda, F layar penuh. Kontrol dan
 * kursor hanya muncul saat tetikus digerakkan.
 *
 * A full-screen show of every capstone that cycles on its own, endlessly.
 * Keys: left/right arrows move, space pauses, F toggles full screen. Controls
 * and the cursor appear only while the mouse moves.
 */
export function CapstoneShow({ slides, cohorts, kelas }: { slides: CapstoneSlide[]; cohorts: CohortOption[]; kelas: string }) {
  const router = useRouter();
  const n = slides.length;
  const [cur, setCur] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  // Urutan gambar atau video yang sedang tampil di dalam satu karya / Index of the image or video showing within one work
  const [k, setK] = useState(0);
  const [prevK, setPrevK] = useState(0);
  const [paused, setPaused] = useState(false);
  const [idle, setIdle] = useState(true);
  // Dinaikkan tiap kali slide dimulai ulang agar bilah progres ikut mulai dari nol
  // Bumped whenever a slide restarts so the progress bar starts from zero too
  const [run, setRun] = useState(0);

  const go = useCallback((step: number) => {
    if (n < 2) { setK(0); setRun((r) => r + 1); return; }
    setPrevK(k);
    setK(0);
    setCur((c) => { setPrev(c); return (c + step + n) % n; });
    setRun((r) => r + 1);
  }, [n, k]);

  // Gambar atau video berikutnya dalam karya yang sama, atau karya berikutnya setelah yang terakhir
  // The next image or video in the same work, or the next work after the last one
  const advance = useCallback(() => {
    if (k + 1 < (slides[cur % Math.max(n, 1)]?.images.length ?? 1)) setK(k + 1);
    else go(1);
  }, [k, cur, n, slides, go]);

  useEffect(() => {
    const len = slides[cur % Math.max(n, 1)]?.images.length ?? 1;
    if (paused || n === 0 || (n < 2 && len < 2)) return;
    const t = setTimeout(advance, itemMs(slides[cur % n], k));
    return () => clearTimeout(t);
  }, [cur, k, run, paused, n, advance, slides]);

  // Slide lama memudar keluar lebih dulu lalu dilepas; slide baru baru masuk setelahnya agar teks tidak bertumpuk
  // The old slide fades out first and is then dropped; the new one enters afterwards so text never overlaps
  useEffect(() => {
    if (prev === null) return;
    const t = setTimeout(() => setPrev(null), 1000);
    return () => clearTimeout(t);
  }, [prev]);

  useEffect(() => {
    const t = setInterval(() => router.refresh(), REFRESH_MS);
    return () => clearInterval(t);
  }, [router]);

  // Jumlah slide bisa berkurang setelah data diambil ulang / The slide count can shrink after a refetch
  useEffect(() => { if (cur >= n && n > 0) setCur(0); }, [cur, n]);

  const fullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => {});
  }, []);
  const togglePause = useCallback(() => { setPaused((p) => !p); setRun((r) => r + 1); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === ' ') { e.preventDefault(); togglePause(); }
      else if (e.key === 'f' || e.key === 'F') fullscreen();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, togglePause, fullscreen]);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const wake = () => { setIdle(false); clearTimeout(t); t = setTimeout(() => setIdle(true), IDLE_MS); };
    window.addEventListener('mousemove', wake);
    return () => { window.removeEventListener('mousemove', wake); clearTimeout(t); };
  }, []);

  // Layar tidak boleh padam selama tayangan berjalan; peramban tanpa dukungan cukup diabaikan
  // The screen must not sleep while the show runs; browsers without support are simply ignored
  useEffect(() => {
    type Lock = { release: () => Promise<void> };
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<Lock> } };
    let lock: Lock | null = null;
    const ask = () => { if (document.visibilityState === 'visible') nav.wakeLock?.request('screen').then((l) => { lock = l; }).catch(() => {}); };
    ask();
    document.addEventListener('visibilitychange', ask);
    return () => { document.removeEventListener('visibilitychange', ask); lock?.release().catch(() => {}); };
  }, []);

  const s = slides[cur % Math.max(n, 1)];
  const next = n > 1 ? slides[(cur + 1) % n] : null;

  return (
    <div className={`cap${idle ? ' idle' : ''}${paused ? ' paused' : ''}`}>
      <style>{STYLE}</style>
      <div className="cap-glow" />
      <div className="cap-frame">
        <div className="cap-top">
          <div className="cap-brand">
            {/* Halaman ini tanpa menu, jadi logo menjadi jalan kembali ke beranda / This page has no menu, so the logo is the way back home */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <Link href="/" className="cap-logo"><img src="/pameran/logo-plan-indonesia-putih.png" alt="Plan International Indonesia · Beranda" /></Link>
            <div className="cap-name"><b>Karya Capstone</b><span>{cohorts.find((c) => c.key === kelas)?.label ?? 'Bootcamp Future Innovators 2026'}</span></div>
          </div>
          {n > 0 && <div className="cap-count" aria-live="polite">{String(cur + 1).padStart(2, '0')} / {String(n).padStart(2, '0')}</div>}
        </div>

        <div className="cap-stage">
          {n === 0 && <div className="cap-empty">Belum ada karya capstone yang terbit.</div>}
          {prev !== null && slides[prev] && <Slide key={'out-' + slides[prev].id + '-' + run} s={slides[prev]} k={prevK} />}
          {s && <Slide key={s.id + '-' + cur} s={s} k={k} enter paused={paused} onEnded={advance} />}
        </div>

        <div className="cap-foot">
          {/* Bilah maju per gambar atau video, dari posisi item sekarang ke berikutnya / The bar moves per image or video, from this item's position to the next */}
          <div className="cap-prog"><i key={run + '-' + k} style={{ animationDuration: itemMs(s, k) + 'ms', '--a': (k / Math.max(s?.images.length ?? 1, 1)) * 100 + '%', '--b': ((k + 1) / Math.max(s?.images.length ?? 1, 1)) * 100 + '%' } as React.CSSProperties} /></div>
          {next && <div className="cap-next">Berikutnya: {next.title} · {next.nickname}</div>}
        </div>
      </div>

      <div className="cap-ctl">
        {/* Layar bisa dikhususkan untuk satu kelas; pilihannya tersimpan di alamat agar bertahan saat dimuat ulang
            A screen can be set to one class; the choice lives in the address so it survives a reload */}
        {cohorts.length > 1 && (
          <div className="cap-pick" role="group" aria-label="Pilih kelas">
            {[{ key: '', label: 'Semua' }, ...cohorts].map((c) => (
              <button key={c.key} type="button" aria-pressed={c.key === kelas} onClick={() => router.replace(c.key ? `/capstone?kelas=${c.key}` : '/capstone')}>
                {c.key ? c.label.split(' · ').pop() : c.label}
              </button>
            ))}
          </div>
        )}
        <button type="button" onClick={() => go(-1)} aria-label="Karya sebelumnya">←</button>
        <button type="button" onClick={togglePause}>{paused ? 'Lanjutkan' : 'Jeda'}</button>
        <button type="button" onClick={() => go(1)} aria-label="Karya berikutnya">→</button>
        <button type="button" onClick={fullscreen}>Layar penuh</button>
      </div>
      {/* Gambar berikutnya dimuat lebih dulu agar tidak berkedip saat berganti / The next image preloads so it does not flash on change */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {next?.images[0] && <img src={next.images[0]} alt="" aria-hidden style={{ display: 'none' }} />}
    </div>
  );
}

function Slide({ s, k, enter, paused, onEnded }: { s: CapstoneSlide; k: number; enter?: boolean; paused?: boolean; onEnded?: () => void }) {
  const many = s.images.length > 1;
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = video.current;
    if (!v || !enter) return;
    if (paused) v.pause();
    else v.play()?.catch(() => {});
  }, [paused, k, enter]);

  return (
    <div className={`cap-slide ${enter ? 'in' : 'out'}`} aria-hidden={!enter}>
      <div className="cap-shot">
        <div className="cap-bar"><i /><i /><i /></div>
        <div className={`cap-img ${many ? 'many' : 'one'}`}>
          {/* Gambar sorotan ditumpuk dan dipudarkan bergantian; hanya yang berikutnya dimuat lebih dulu.
              Reels diputar tanpa suara karena peramban menolak putar otomatis bersuara.
              Highlight images are stacked and cross-faded; only the next one loads ahead.
              Reels play muted because browsers refuse autoplay with sound. */}
          {s.images.map((src, i) => {
            if (isVideo(src)) {
              return i === k && <video key={src} ref={video} src={src} muted autoPlay={enter} playsInline onEnded={onEnded} aria-label={'Video ' + s.title} />;
            }
            return (i === k || i === (k + 1) % s.images.length) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={src} src={src} className={i === k ? 'on' : ''} alt={i === k ? 'Tampilan ' + s.title : ''} />
            );
          })}
        </div>
      </div>
      <div className="cap-info">
        <span className="cap-chip">Capstone Project</span>
        <span className="cap-coh">{s.cohortLabel}</span>
        <h1 className="cap-title">{s.title}</h1>
        <div className="cap-who">
          <span className="cap-av" style={{ background: s.color, color: s.fg }}>
            {s.nickname[0]?.toUpperCase()}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {s.photo && <img src={s.photo} alt="" />}
          </span>
          <div><small>Dibuat oleh</small><b>{s.nickname}</b></div>
        </div>
        {s.tools.length > 0 && (
          <div>
            <div className="cap-label">Dibangun dengan</div>
            <div className="cap-tools">{s.tools.map((t) => <span key={t}>{t}</span>)}</div>
          </div>
        )}
        <div className="cap-qr">
          <div dangerouslySetInnerHTML={{ __html: s.qr }} />
          <div style={{ width: 'auto', height: 'auto' }}>{s.isApp ? <><b>Pindai untuk mencoba aplikasinya</b><span>langsung dari ponselmu</span></> : <><b>Pindai untuk melihat karya</b><span>di situs pameran</span></>}</div>
        </div>
      </div>
    </div>
  );
}
