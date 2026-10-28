'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { BENTO, COH, SLIDES, SLIDE_INTERVAL_SECONDS, TRACKS } from '@/features/exhibition/content';
import { safeExternalUrl, type SiteContent, type homeTesti } from '@/features/exhibition/model';
import { Hv, Photo, css, media } from '@/features/exhibition/ui';

export interface HomeBest { cohort: string; title: string; nickname: string; type: string; href: string; thumb: string }
export type HomeTesti = ReturnType<typeof homeTesti>[number];
interface Props { people: number; works: number; best: HomeBest[]; testi: HomeTesti[]; site: SiteContent }

// Tautan video tersimpan hanya dipakai bila http(s) / A stored video link is used only when http(s)
const safeVideo = (u: string | undefined) => (u && safeExternalUrl(u) ? u : '');

// Lama satu testimoni tampil sebelum berganti / How long one testimonial shows before advancing
const TESTI_INTERVAL_MS = 7000;
const H2 = 'font-family:var(--font-headline);font-weight:700;font-size:clamp(32px,4.4vw,52px);line-height:1.05;letter-spacing:-0.03em;margin:0';

export default function HomePage({ people, works, best, testi, site }: Props) {
  const [playing, setPlaying] = useState(false);
  const [slide, setSlide] = useState(0);
  const [testiIdx, setTestiIdx] = useState(0);
  const [testiHold, setTestiHold] = useState(false);
  const [modal, setModal] = useState<{ title: string; url: string } | null>(null);

  useEffect(() => {
    if (modal) return;
    const t = setInterval(() => setSlide((s) => (s + 1) % SLIDES.length), SLIDE_INTERVAL_SECONDS * 1000);
    return () => clearInterval(t);
  }, [modal]);

  const hero = media(safeVideo(site.videos.afterMovie));
  const nT = testi.length;
  const testiPeserta = testi.map((p, i) => {
    const c = COH[p.cohort], on = i === testiIdx;
    return { key: p.uid, name: p.nickname, initials: p.nickname[0]?.toUpperCase() ?? '?', cohort: TRACKS[c.track].name + ' · ' + c.city, headline: p.headline, quote: p.quote, photo: p.photoUrl, bg: c.color, fg: c.fg,
      on,
      play: p.video ? () => setModal({ title: 'Testimoni ' + p.nickname, url: p.video ?? '' }) : null, href: '/peserta/' + p.uid };
  });
  const tpA = testiPeserta[testiIdx];

  // Testimoni berganti sendiri dan berulang; berhenti saat kursor atau fokus ada di
  // bagiannya, supaya cerita yang panjang sempat dibaca sampai habis.
  // Testimonials advance on their own and loop; they pause while the pointer or focus
  // is on the section, so a long story can be read to the end.
  useEffect(() => {
    if (nT < 2 || modal || testiHold) return;
    const t = setTimeout(() => setTestiIdx((i) => (i + 1) % nT), TESTI_INTERVAL_MS);
    return () => clearTimeout(t);
  }, [testiIdx, nT, modal, testiHold]);
  const mm = modal ? media(safeVideo(modal.url)) : null;
  const stats = [{ value: people, label: 'peserta' }, { value: works, label: 'karya' }, { value: 3, label: 'jurusan' }, { value: 4, label: 'kota' }];

  return (
    <>
      <section style={css('background:var(--plan-blue);color:#fff;padding:calc(80px + clamp(48px,7vw,88px)) 22px clamp(56px,7vw,88px)')}>
        <div style={css('max-width:880px;margin:0 auto;display:flex;flex-direction:column;align-items:center;text-align:center;gap:14px')}>
          <span style={css('font-size:17px;font-weight:700;color:var(--yellow)')}>Pameran Karya Bootcamp</span>
          <h1 style={css('font-family:var(--font-headline);font-weight:700;font-size:clamp(48px,8vw,96px);line-height:1.04;letter-spacing:-0.035em;margin:0')}>Future Innovators 2026.</h1>
        </div>
        <div style={css('max-width:1180px;margin:clamp(36px,5vw,56px) auto 0;position:relative;aspect-ratio:16/9;border-radius:24px;overflow:hidden;background:var(--dark-blue)')}>
          {!playing && (
            <>
              <Photo src={site.photos['hero-poster']} placeholder="Poster / cuplikan after movie" />
              <div style={css('position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;pointer-events:none')}>
                <Hv onClick={() => setPlaying(true)} aria-label="Putar after movie" s="all:unset;cursor:pointer;pointer-events:auto;width:96px;height:96px;border-radius:50%;background:var(--yellow);display:flex;align-items:center;justify-content:center;box-shadow:var(--shadow-md);transition:transform 160ms ease" h="transform:scale(1.06)" a="transform:scale(.96)"><span style={css('width:0;height:0;border-left:25px solid var(--dark-blue);border-top:15px solid transparent;border-bottom:15px solid transparent;margin-left:7px')} /></Hv>
                <span style={css('font-weight:700;font-size:17px;color:#fff;background:var(--dark-blue);padding:6px 14px;border-radius:999px')}>Putar after movie</span>
              </div>
            </>
          )}
          {playing && hero.isEmbed && (
            <iframe src={hero.embed} title="After movie Bootcamp Future Innovators 2026" allow="autoplay; encrypted-media; fullscreen" allowFullScreen style={css('position:absolute;inset:0;width:100%;height:100%;border:0')} />
          )}
          {playing && hero.isFile && (
            <video src={hero.url} controls autoPlay playsInline style={css('position:absolute;inset:0;width:100%;height:100%;background:#000')} />
          )}
          {playing && !hero.url && (
            <div style={css('position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:24px;text-align:center')}>
              <span style={css('font-family:var(--font-headline);font-weight:700;font-size:22px')}>Video after movie belum ditambahkan</span>
              <span style={css('font-size:15px')}>Video after movie akan diputar di sini.</span>
              <button type="button" onClick={() => setPlaying(false)} style={css('all:unset;cursor:pointer;margin-top:8px;font-size:15px;font-weight:700;color:var(--yellow)')}>Kembali ›</button>
            </div>
          )}
        </div>
        <div style={css('max-width:880px;margin:clamp(40px,5vw,56px) auto 0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));text-align:center')}>
          {stats.map((st) => (
            <div key={st.label} style={css('display:flex;flex-direction:column;gap:4px;padding:0 8px')}>
              <span style={css('font-family:var(--font-headline);font-weight:700;font-size:clamp(32px,4.4vw,52px);line-height:1;letter-spacing:-0.03em')}>{st.value}</span>
              <span style={css('font-size:15px')}>{st.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section style={css('padding:clamp(64px,9vw,112px) 22px')}>
        <div style={css('max-width:1180px;margin:0 auto')}>
          <div style={css('display:flex;flex-wrap:wrap;gap:16px;align-items:flex-end;justify-content:space-between')}>
            <div style={css('display:flex;flex-direction:column;gap:8px')}>
              <span style={css('font-size:15px;font-weight:700;color:var(--magenta)')}>Dokumentasi</span>
              <h2 style={css(H2)}>Selama kegiatan.</h2>
            </div>
            <div style={css('display:flex;gap:10px')}>
              <Hv onClick={() => setSlide((s) => (s - 1 + SLIDES.length) % SLIDES.length)} aria-label="Sebelumnya" s="all:unset;cursor:pointer;width:44px;height:44px;border-radius:50%;background:var(--surface-muted);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700" h="background:var(--light-grey)">‹</Hv>
              <Hv onClick={() => setSlide((s) => (s + 1) % SLIDES.length)} aria-label="Berikutnya" s="all:unset;cursor:pointer;width:44px;height:44px;border-radius:50%;background:var(--surface-muted);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700" h="background:var(--light-grey)">›</Hv>
            </div>
          </div>
          <div style={css('margin-top:32px;border-radius:24px;overflow:hidden')}>
            <div style={css(`display:flex;transform:translateX(${-100 * slide}%);transition:transform 600ms cubic-bezier(.2,.7,.2,1)`)}>
              {SLIDES.map((sl, i) => (
                <div key={i} style={css('flex:0 0 100%;position:relative;aspect-ratio:16/8;min-height:260px;background:var(--surface-muted)')}>
                  <Photo src={site.photos['doc-' + (i + 1)]} placeholder="Foto dokumentasi" />
                  <div style={css('position:absolute;left:24px;bottom:24px;display:flex;flex-direction:column;align-items:flex-start;gap:6px;pointer-events:none')}>
                    <span style={css(`font-family:var(--font-headline);font-weight:700;font-size:clamp(18px,2vw,24px);padding:6px 14px;background:${sl.color};color:${sl.fg}`)}>{site.captions['doc-' + (i + 1)] || sl.caption}</span>
                    <span style={css('font-size:14px;font-weight:700;padding:4px 10px;background:#fff;color:var(--dark-blue)')}>{sl.place}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={css('display:flex;justify-content:center;gap:8px;margin-top:20px')}>
            {SLIDES.map((sl, i) => (
              <button key={i} type="button" onClick={() => setSlide(i)} aria-label={site.captions['doc-' + (i + 1)] || sl.caption} style={css(`all:unset;cursor:pointer;height:8px;width:${i === slide ? '28px' : '8px'};border-radius:999px;background:${i === slide ? (sl.color === '#FFD500' ? '#243C4B' : sl.color) : 'var(--light-grey)'};transition:width 300ms ease,background 300ms ease`)} />
            ))}
          </div>
        </div>
      </section>

      <section style={css('padding:0 22px clamp(64px,9vw,112px)')}>
        <div style={css('max-width:1180px;margin:0 auto')}>
          <div style={css('display:flex;flex-direction:column;gap:8px')}>
            <span style={css('font-size:15px;font-weight:700;color:var(--orange)')}>Galeri foto</span>
            <h2 style={css(H2)}>Momen bersama.</h2>
          </div>
          <div style={css('margin-top:32px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));grid-auto-rows:clamp(110px,16vw,210px);grid-auto-flow:dense;gap:12px')}>
            {BENTO.map((b, i) => (
              <div key={i} style={css(`grid-column:span ${b.cols};grid-row:span ${b.rows};position:relative;border-radius:20px;overflow:hidden;background:${b.bg || 'var(--surface-muted)'};color:${b.fg || 'var(--dark-blue)'}`)}>
                {b.type === 'photo' && <Photo src={site.photos['bento-' + (i + 1)]} placeholder={site.captions['bento-' + (i + 1)] || b.label} />}
                {b.type === 'stat' && (
                  <div style={css('position:absolute;inset:0;padding:clamp(14px,2vw,24px);display:flex;flex-direction:column;justify-content:flex-end;gap:2px')}>
                    <span style={css('font-family:var(--font-headline);font-weight:700;font-size:clamp(32px,5vw,64px);line-height:1;letter-spacing:-0.03em')}>{b.key === 'people' ? people : b.key === 'works' ? works : b.value}</span>
                    <span style={css('font-weight:700;font-size:clamp(13px,1.3vw,16px)')}>{b.label}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {best.length > 0 && (
      <section style={css('padding:clamp(64px,9vw,112px) 22px;background:var(--surface-muted)')}>
        <div style={css('max-width:1180px;margin:0 auto')}>
          <div style={css('display:flex;flex-direction:column;align-items:center;text-align:center;gap:10px')}>
            <span style={css('font-size:15px;font-weight:700;color:var(--plan-blue)')}>Capstone project</span>
            <h2 style={css(H2)}>Contoh Karya Setiap Kelas</h2>
          </div>
          <div style={css('margin-top:40px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr));gap:16px')}>
            {best.map((bw) => {
              const c = COH[bw.cohort], tk = TRACKS[c.track];
              return (
                <div key={bw.href} style={css(`background:${c.color};color:${c.fg};border-radius:24px;padding:22px;display:flex;flex-direction:column;gap:16px`)}>
                  <div style={css('display:flex;flex-direction:column;gap:2px')}>
                    <span style={css('font-size:14px;font-weight:700')}>{tk.name}</span>
                    <span style={css('font-family:var(--font-headline);font-weight:700;font-size:26px;line-height:1.1;letter-spacing:-0.02em')}>{c.city}</span>
                  </div>
                  <div style={css('position:relative;aspect-ratio:4/3;border-radius:14px;overflow:hidden;background:#fff;color:var(--dark-blue)')}>
                    <Photo src={bw.thumb} placeholder={bw.type} />
                  </div>
                  <div style={css('display:flex;flex-direction:column;gap:4px')}>
                    <span style={css('font-family:var(--font-headline);font-weight:700;font-size:19px;line-height:1.2')}>{bw.title}</span>
                    <span style={css('font-size:14px;font-weight:700')}>{bw.nickname} · {bw.type}</span>
                  </div>
                  <Hv as={Link} href={bw.href} s="all:unset;cursor:pointer;margin-top:auto;align-self:flex-start;padding:9px 16px;border-radius:999px;background:#fff;color:var(--dark-blue);font-weight:700;font-size:14px" h="transform:translateY(-1px)">Lihat karya ›</Hv>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      )}

      {tpA && (
      <section style={css('padding:clamp(64px,9vw,112px) 22px')} onMouseEnter={() => setTestiHold(true)} onMouseLeave={() => setTestiHold(false)} onFocus={() => setTestiHold(true)} onBlur={() => setTestiHold(false)}>
        <div style={css('max-width:1180px;margin:0 auto')}>
          <div style={css('display:flex;flex-wrap:wrap;gap:24px;align-items:flex-end;justify-content:space-between')}>
            <div style={css('display:flex;flex-direction:column;gap:8px')}>
              <span style={css('font-size:15px;font-weight:700;color:var(--magenta)')}>Testimoni peserta</span>
              <h2 style={css(H2)}>Apa kata mereka?</h2>
            </div>
            <div style={css('display:flex;align-items:center;gap:10px')}>
              <span style={css('font-family:var(--font-headline);font-weight:700;font-size:15px;min-width:56px')}>{String(testiIdx + 1).padStart(2, '0') + ' / ' + String(nT).padStart(2, '0')}</span>
              <Hv onClick={() => setTestiIdx((i) => (i - 1 + nT) % nT)} aria-label="Sebelumnya" s="all:unset;cursor:pointer;width:44px;height:44px;border-radius:50%;border:1.5px solid var(--dark-blue);display:flex;align-items:center;justify-content:center;font-size:18px" h="background:var(--dark-blue);color:#fff">←</Hv>
              <Hv onClick={() => setTestiIdx((i) => (i + 1) % nT)} aria-label="Berikutnya" s="all:unset;cursor:pointer;width:44px;height:44px;border-radius:50%;background:var(--dark-blue);color:#fff;display:flex;align-items:center;justify-content:center;font-size:18px" h="background:var(--plan-blue)">→</Hv>
            </div>
          </div>
          <div style={css('margin-top:36px;display:flex;flex-wrap:wrap;gap:clamp(24px,4vw,56px);align-items:stretch')}>
            <div style={css(`flex:0 1 380px;min-width:260px;position:relative;aspect-ratio:4/5;border-radius:28px;overflow:hidden;background:${tpA.bg};padding:14px;transition:background 300ms ease`)}>
              <div style={css('position:relative;width:100%;height:100%;border-radius:18px;overflow:hidden;background:var(--surface-muted);color:var(--dark-blue)')}>
                {testiPeserta.map((tp) => (
                  <div key={tp.key} aria-hidden={!tp.on} style={css(`position:absolute;inset:0;opacity:${tp.on ? 1 : 0};transition:opacity 600ms ease`)}>
                    <Photo src={tp.photo} placeholder={tp.name} />
                  </div>
                ))}
                {tpA.play && <Hv onClick={tpA.play} aria-label="Putar video" s="all:unset;cursor:pointer;position:absolute;left:16px;bottom:16px;display:flex;align-items:center;gap:10px;padding:6px 18px 6px 6px;border-radius:999px;background:#fff;color:var(--dark-blue);font-weight:700;font-size:14px;box-shadow:var(--shadow-md)" h="transform:scale(1.04)"><span style={css('width:44px;height:44px;border-radius:50%;background:var(--yellow);display:flex;align-items:center;justify-content:center;box-shadow:var(--shadow-md)')}><span style={css('width:0;height:0;border-left:12px solid var(--dark-blue);border-top:7px solid transparent;border-bottom:7px solid transparent;margin-left:4px')} /></span>Putar video</Hv>}
              </div>
            </div>
            <div style={css('flex:1 1 420px;min-width:0;display:flex;flex-direction:column;gap:28px;padding:clamp(8px,2vw,24px) 0')}>
              <span style={css(`font-family:var(--font-headline);font-weight:700;font-size:clamp(96px,10vw,140px);line-height:0.6;height:0.45em;color:${tpA.bg};transition:color 300ms ease`)}>“</span>
              {/* Semua slide ditumpuk di satu sel grid: tingginya mengikuti cerita terpanjang, jadi halaman tidak melompat saat berganti */}
              {/* Every slide is stacked in one grid cell: its height follows the longest story, so the page does not jump on change */}
              <div style={css('display:grid')}>
                {testiPeserta.map((tp) => (
                  <div key={tp.key} aria-hidden={!tp.on} style={css(`grid-area:1/1;display:flex;flex-direction:column;gap:28px;opacity:${tp.on ? 1 : 0};visibility:${tp.on ? 'visible' : 'hidden'};transition:opacity 600ms ease,visibility 600ms`)}>
                    <p style={css('margin:0;font-family:var(--font-headline);font-weight:700;font-size:clamp(26px,3.2vw,40px);line-height:1.2;letter-spacing:-0.02em;text-wrap:pretty')}>{tp.headline}</p>
                    <p style={css('margin:0;font-size:17px;line-height:1.65;color:var(--text-muted);max-width:60ch;text-wrap:pretty')}>{tp.quote}</p>
                    <Link href={tp.href} tabIndex={tp.on ? 0 : -1} style={css('all:unset;cursor:pointer;display:flex;align-items:center;gap:14px')}>
                      <span style={css(`width:52px;height:52px;border-radius:50%;background:${tp.bg};color:${tp.fg};display:flex;align-items:center;justify-content:center;font-family:var(--font-headline);font-weight:700;font-size:17px`)}>{tp.initials}</span>
                      <span style={css('display:flex;flex-direction:column;gap:2px')}>
                        <span style={css('font-weight:700;font-size:17px')}>{tp.name}</span>
                        <span style={css('font-size:14px;color:var(--text-muted)')}>{tp.cohort} · Lihat profil ›</span>
                      </span>
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
      )}

      <section style={css('padding:clamp(64px,9vw,112px) 22px;background:var(--dark-blue);color:#fff')}>
        <div style={css('max-width:1180px;margin:0 auto')}>
          <div style={css('display:flex;flex-direction:column;gap:8px')}>
            <span style={css('font-size:15px;font-weight:700;color:var(--light-blue)')}>Testimoni trainer &amp; fasilitator</span>
            <h2 style={css(H2)}>Kata Trainer dan Fasilitator</h2>
          </div>
          <div style={css('margin-top:40px;display:grid;grid-template-columns:1fr;gap:clamp(16px,2.4vw,28px)')}>
            {site.testiTrainer.map((t, i) => {
              const tk = TRACKS[t.track];
              const role = t.role || 'Trainer';
              const where = tk.name + (t.cohort && COH[t.cohort] ? ' · ' + COH[t.cohort].city : '');
              const slot = 'trainer-' + (i + 1);
              // Foto kecil di kiri dengan nama di atasnya seperti ubin peserta; tombol putar hanya bila videonya ada
              // A small photo on the left with the name over it like the participant tiles; the play button only when its video exists
              const tile = (
                <>
                  {site.photos[slot]
                    ? <Photo src={site.photos[slot]} placeholder={t.name} />
                    : <span aria-hidden="true" style={css(`position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding-bottom:28px;background:${tk.color};color:${tk.fg};font-family:var(--font-headline);font-weight:700;font-size:56px`)}>{t.name[0]?.toUpperCase()}</span>}
                  <span style={css('position:absolute;left:0;right:0;bottom:0;padding:40px 12px 12px;background:linear-gradient(to top,rgba(36,60,75,.92) 0%,rgba(36,60,75,.55) 55%,rgba(36,60,75,0) 100%);color:#fff;display:flex;flex-direction:column;gap:2px;pointer-events:none')}>
                    <span style={css('font-family:var(--font-headline);font-weight:700;font-size:clamp(14px,1.4vw,17px);line-height:1.15')}>{t.name}</span>
                    <span style={css(`font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${tk.color === '#8AC208' ? '#C6E87A' : '#BFE0F8'}`)}>{role}</span>
                  </span>
                  {t.video && <span style={css('position:absolute;top:10px;right:10px;width:40px;height:40px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:var(--shadow-md);pointer-events:none')}><span style={css('width:0;height:0;border-left:11px solid var(--dark-blue);border-top:7px solid transparent;border-bottom:7px solid transparent;margin-left:3px')} /></span>}
                </>
              );
              const tileCss = 'position:relative;display:block;aspect-ratio:3/4;border-radius:18px;overflow:hidden;background:var(--surface-muted);color:var(--dark-blue)';
              return (
                <figure key={i} className={i % 2 ? 'tr-card flip' : 'tr-card'} style={css('margin:0;padding:clamp(14px,2vw,24px);border-radius:28px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12)')}>
                  {t.video
                    ? <Hv onClick={() => setModal({ title: t.name + ' · ' + role + ' ' + where, url: t.video ?? '' })} aria-label={'Putar video ' + t.name} s={'all:unset;cursor:pointer;grid-area:foto;' + tileCss + ';transition:transform 260ms ease'} h="transform:translateY(-3px)">{tile}</Hv>
                    : <div style={css('grid-area:foto;' + tileCss)}>{tile}</div>}
                  <span aria-hidden="true" style={css(`grid-area:mark;font-family:var(--font-headline);font-weight:700;font-size:64px;line-height:1;height:34px;overflow:hidden;color:${tk.color}`)}>“</span>
                  <p style={css('grid-area:teks;margin:0;font-family:var(--font-headline);font-weight:500;font-size:clamp(15px,1.5vw,19px);line-height:1.65;max-width:62ch;text-wrap:pretty')}>{t.quote}</p>
                  <figcaption style={css('grid-area:info;display:flex;flex-direction:column;gap:2px;font-size:13px')}>
                    <span style={css(`font-weight:700;color:${tk.color === '#8AC208' ? '#C6E87A' : '#BFE0F8'}`)}>{role}</span>
                    <span style={css('opacity:.75')}>{where}</span>
                  </figcaption>
                </figure>
              );
            })}
          </div>
        </div>
      </section>

      <section style={css('padding:clamp(64px,9vw,112px) 12px')}>
        <div style={css('max-width:1180px;margin:0 auto;background:var(--plan-blue);color:#fff;border-radius:32px;padding:clamp(56px,8vw,96px) 24px;display:flex;flex-direction:column;align-items:center;text-align:center;gap:16px')}>
          <div style={css('display:flex;gap:8px')}>
            {['yellow', 'magenta', 'green', 'orange'].map((c) => <span key={c} style={css(`width:14px;height:14px;border-radius:50%;background:var(--${c})`)} />)}
          </div>
          <h2 style={css('font-family:var(--font-headline);font-weight:700;font-size:clamp(36px,5.6vw,68px);line-height:1.04;letter-spacing:-0.035em;margin:0;text-wrap:balance')}>Jelajahi semua karya.</h2>
          <p style={css('font-family:var(--font-headline);font-weight:500;font-size:clamp(18px,2vw,22px);margin:0')}>{works + ' karya dari ' + people + ' peserta di empat kota.'}</p>
          <div style={css('display:flex;flex-wrap:wrap;gap:24px;align-items:center;justify-content:center;margin-top:12px')}>
            <Hv as={Link} href="/galeri" s="all:unset;cursor:pointer;padding:14px 28px;border-radius:999px;background:var(--yellow);color:var(--dark-blue);font-weight:700;font-size:17px" h="transform:translateY(-2px)" a="transform:scale(.97)">Buka galeri</Hv>
            <Hv as={Link} href="/peserta" s="all:unset;cursor:pointer;font-size:17px;font-weight:700;color:#fff" h="text-decoration:underline">Kenali para peserta ›</Hv>
          </div>
        </div>
      </section>

      {modal && mm && (
        <div onClick={() => setModal(null)} style={css('position:fixed;inset:0;z-index:50;background:rgba(36,60,75,.94);display:flex;align-items:center;justify-content:center;padding:24px')}>
          <div onClick={(e) => e.stopPropagation()} style={css('width:min(100%,960px);display:flex;flex-direction:column;gap:14px')}>
            <div style={css('display:flex;justify-content:space-between;align-items:center;gap:16px;color:#fff')}>
              <span style={css('font-family:var(--font-headline);font-weight:700;font-size:18px')}>{modal.title}</span>
              <button type="button" onClick={() => setModal(null)} aria-label="Tutup" style={css('all:unset;cursor:pointer;width:40px;height:40px;border-radius:50%;background:#fff;color:var(--dark-blue);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700')}>×</button>
            </div>
            <div style={css('position:relative;aspect-ratio:16/9;border-radius:16px;overflow:hidden;background:#000')}>
              {mm.isEmbed && <iframe src={mm.embed} title={modal.title} allow="autoplay; encrypted-media; fullscreen" allowFullScreen style={css('position:absolute;inset:0;width:100%;height:100%;border:0')} />}
              {mm.isFile && <video src={mm.url} controls autoPlay playsInline style={css('position:absolute;inset:0;width:100%;height:100%')} />}
              {!mm.url && (
                <div style={css('position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:#fff;text-align:center;padding:24px')}>
                  <span style={css('font-family:var(--font-headline);font-weight:700;font-size:20px')}>Video belum ditambahkan</span>
                  <span style={css('font-size:15px')}>Video testimoni akan diputar di sini.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
