'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { COH, COHORTS, DOC_BENTO, DOC_DESC, DOC_HERO, DOC_MASONRY, DOC_POLAROID, DOC_RATIOS, DOC_WEEKS, TRACKS, cohLabel, type Cohort } from '@/features/exhibition/content';
import { Expand, Hv, Photo, css } from '@/features/exhibition/ui';

type Item = { slotId: string; cohortLabel: string; city: string; color: string; fg: string; caption: string; idx: number };

const H2 = 'font-family:var(--font-headline);font-weight:700;font-size:clamp(32px,4.4vw,52px);line-height:1.05;letter-spacing:-0.03em;margin:0';

export function DocsView({ photos: sitePhotos, captions = {} }: { photos: Record<string, string>; captions?: Record<string, string> }) {
  const [dc, setDc] = useState('all');
  const [scroll, setScroll] = useState({ p: 0, x: 0, page: 0 });
  const [lb, setLb] = useState<number | null>(null);
  const filmRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const countRef = useRef(0);

  useEffect(() => {
    let raf = 0;
    // Film horizontal digerakkan oleh scroll vertikal selama seksinya tertahan sticky / The horizontal film is driven by vertical scroll while its section is held sticky
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const el = filmRef.current, tr = trackRef.current, d = document.documentElement;
        const page = Math.min(1, Math.max(0, window.scrollY / Math.max(1, d.scrollHeight - window.innerHeight)));
        let p = 0, x = 0;
        if (el && tr) {
          const r = el.getBoundingClientRect();
          p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - window.innerHeight)));
          x = -p * Math.max(0, tr.scrollWidth - window.innerWidth);
        }
        setScroll({ p, x, page });
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); };
  }, []);

  useEffect(() => {
    if (lb == null) return;
    const onKey = (e: KeyboardEvent) => {
      const n = countRef.current || 1;
      if (e.key === 'Escape') setLb(null);
      if (e.key === 'ArrowRight') setLb((i) => ((i ?? 0) + 1) % n);
      if (e.key === 'ArrowLeft') setLb((i) => ((i ?? 0) - 1 + n) % n);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lb]);

  const list: Item[] = [];
  const at = (i: number) => (dc === 'all' ? { co: COHORTS[i % 4], n: Math.floor(i / 4) } : { co: COH[dc], n: i });
  const add = (co: Cohort, sec: string, n: number, caption: string): Item => {
    const slotId = 'doc-' + co.key + '-' + sec + '-' + n;
    // Keterangan tersimpan per slot menggantikan teks bawaan / A caption stored per slot replaces the built-in text
    const it = { slotId, cohortLabel: cohLabel(co), city: co.city, color: co.color, fg: co.fg, caption: captions[slotId] || caption, idx: list.length };
    list.push(it);
    return it;
  };
  const rots = ['-8deg', '-3deg', '2deg', '6deg', '-4deg'], tys = ['10px', '-14px', '6px', '-8px', '14px'];
  const docHero = DOC_HERO.map((cap, i) => { const { co, n } = at(i); return { ...add(co, 'hero', n, cap), rot: rots[i], ty: tys[i], z: i === 2 ? 5 : 5 - Math.abs(2 - i) }; });
  const fi = Math.min(7, Math.round(scroll.p * 7));
  const docFilm = DOC_WEEKS.map(([title, caption], i) => { const { co, n } = at(i); return { ...add(co, 'film', n, caption), title, num: String(i + 1).padStart(2, '0'), op: i === fi ? 1 : 0.55 }; });
  let pi = 0;
  const docBento = DOC_BENTO.map((b) => {
    if (b.word) return { ...b, item: null };
    const { co, n } = at(pi++);
    return { ...b, item: add(co, 'bento', n, b.cap ?? '') };
  });
  const cohs = dc === 'all' ? COHORTS : [COH[dc]];
  const lay = [['1 / 3', '1 / 3'], ['3 / 4', '1 / 2'], ['3 / 4', '2 / 3']];
  const docKelas = cohs.map((co) => ({ co, photos: lay.map(([gc, gr], n) => ({ ...add(co, 'kelas', n, 'Kelas ' + cohLabel(co)), gc, gr })) }));
  const docMasonry = DOC_MASONRY.map((cap, i) => { const { co, n } = at(i); return { ...add(co, 'momen', n, cap), ratio: DOC_RATIOS[i % DOC_RATIOS.length] }; });
  const prot = ['-4deg', '3deg', '-2deg', '5deg', '-3deg', '2deg'], tapes = ['#58CAE7', '#DC0080', '#8AC208', '#ED632F', '#0072CE', '#9900FF'];
  const docPolaroid = DOC_POLAROID.map((cap, i) => { const { co, n } = at(i); return { ...add(co, 'kenangan', n, cap), rot: prot[i], tape: tapes[i] }; });
  countRef.current = list.length;
  const cur = lb != null ? list[lb] : undefined;
  const chips = [{ key: 'all' } as { key: string; city?: string; color?: string; fg?: string }, ...COHORTS].map((c) => {
    const on = dc === c.key, all = c.key === 'all';
    return { key: c.key, label: all ? 'Semua kelas' : c.city, dot: all ? '#FFD500' : c.color, bg: on ? (all ? '#fff' : c.color) : 'transparent', fg: on ? (all ? '#243C4B' : c.fg) : '#fff', border: on ? (all ? '#fff' : c.color) : 'rgba(255,255,255,.5)' };
  });

  return (
    <>
      <div style={css(`position:fixed;top:0;left:0;z-index:50;height:4px;width:${(scroll.page * 100).toFixed(1)}%;background:var(--magenta);transition:width 80ms linear`)} />

      <section style={css('background:var(--dark-blue);color:#fff;padding:calc(80px + clamp(48px,7vw,88px)) 22px clamp(56px,8vw,96px);overflow:hidden')}>
        <div style={css('max-width:1180px;margin:0 auto;display:flex;flex-direction:column;gap:clamp(40px,6vw,72px)')}>
          <div style={css('display:flex;flex-wrap:wrap;gap:24px 48px;align-items:flex-end;justify-content:space-between')}>
            <div style={css('display:flex;flex-direction:column;gap:10px')}>
              <span style={css('font-size:15px;font-weight:700;color:var(--yellow)')}>{dc === 'all' ? 'Empat kelas · Bootcamp Future Innovators 2026' : cohLabel(COH[dc])}</span>
              <h1 style={css('font-family:var(--font-headline);font-weight:700;font-size:clamp(52px,9vw,120px);line-height:0.92;letter-spacing:-0.045em;margin:0')}>Dokumentasi <span style={css('display:inline-block;background:var(--yellow);color:var(--dark-blue);padding:0 0.12em 0.06em')}>kelas</span></h1>
            </div>
            <p style={css('margin:0;font-size:18px;line-height:1.5;max-width:380px;text-wrap:pretty')}>Foto dan momen selama bootcamp, dari hari pertama sampai presentasi akhir. Pilih kelas untuk melihat dokumentasinya.</p>
          </div>
          <div style={css('display:flex;flex-wrap:wrap;gap:8px')}>
            {chips.map((c) => (
              <Hv key={c.key} onClick={() => { setDc(c.key); setLb(null); }} s={`all:unset;cursor:pointer;display:flex;align-items:center;gap:8px;padding:10px 18px;border-radius:999px;font-weight:700;font-size:15px;background:${c.bg};color:${c.fg};border:2px solid ${c.border};transition:background 200ms ease`} a="transform:scale(.97)"><span style={css(`width:10px;height:10px;border-radius:50%;background:${c.dot}`)} />{c.label}</Hv>
            ))}
          </div>
          <div style={css('display:flex;justify-content:center;padding:20px 0 12px')}>
            {docHero.map((h) => (
              <Hv key={h.slotId} as="div" s={`position:relative;flex:0 0 clamp(130px,19vw,250px);aspect-ratio:3/4;margin:0 clamp(-28px,-2.4vw,-14px);transform:rotate(${h.rot}) translateY(${h.ty});background:#fff;padding:8px 8px 34px;box-shadow:var(--shadow-lg);transition:transform 280ms ease;z-index:${h.z}`} h="transform:rotate(0deg) translateY(-12px) scale(1.06);z-index:9">
                <div style={css('position:relative;width:100%;height:100%;background:var(--surface-muted);color:var(--dark-blue);overflow:hidden')}>
                  <Photo src={sitePhotos[h.slotId]} placeholder="Foto kegiatan" />
                  <Expand onClick={() => setLb(h.idx)} />
                </div>
                <span style={css('position:absolute;left:10px;right:10px;bottom:9px;font-family:var(--font-caption);font-style:italic;font-size:13px;color:var(--dark-blue);white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{h.caption}</span>
              </Hv>
            ))}
          </div>
        </div>
      </section>

      <section ref={filmRef} style={css('position:relative;height:360vh;background:var(--plan-blue);color:#fff')}>
        <div style={css('position:sticky;top:0;height:100vh;overflow:hidden;display:flex;flex-direction:column;justify-content:center;gap:clamp(20px,3vw,36px);padding-top:76px')}>
          <div style={css('width:100%;max-width:1180px;margin:0 auto;padding:0 22px;display:flex;flex-wrap:wrap;gap:16px 32px;align-items:flex-end;justify-content:space-between')}>
            <div style={css('display:flex;flex-direction:column;gap:8px')}>
              <span style={css('font-size:15px;font-weight:700;color:var(--yellow)')}>Perjalanan kelas</span>
              <h2 style={css('font-family:var(--font-headline);font-weight:700;font-size:clamp(32px,4.6vw,60px);line-height:1;letter-spacing:-0.035em;margin:0')}>Minggu demi minggu.</h2>
            </div>
            <div style={css('display:flex;align-items:center;gap:16px;min-width:240px')}>
              <span style={css('font-family:var(--font-headline);font-weight:700;font-size:15px;white-space:nowrap')}>{String(fi + 1).padStart(2, '0') + ' / 08'}</span>
              <div style={css('flex:1;height:6px;border-radius:999px;background:rgba(255,255,255,.3);overflow:hidden')}>
                <div style={css(`height:100%;width:${(scroll.p * 100).toFixed(1)}%;background:var(--yellow);border-radius:999px`)} />
              </div>
            </div>
          </div>
          <div ref={trackRef} style={css(`display:flex;gap:clamp(16px,2vw,28px);width:max-content;padding:0 max(22px,calc((100vw - 1180px) / 2));transform:translateX(${Math.round(scroll.x)}px);will-change:transform`)}>
            {docFilm.map((fm) => (
              <div key={fm.slotId} style={css(`flex:0 0 clamp(280px,54vw,760px);display:flex;flex-direction:column;gap:16px;opacity:${fm.op};transition:opacity 300ms ease`)}>
                <div style={css('position:relative;aspect-ratio:16/10;max-height:58vh;border-radius:24px;overflow:hidden;background:var(--surface-muted);color:var(--dark-blue)')}>
                  <Photo src={sitePhotos[fm.slotId]} placeholder="Foto dokumentasi" />
                  <span style={css(`position:absolute;top:14px;left:14px;z-index:2;padding:5px 12px;border-radius:999px;background:${fm.color};color:${fm.fg};font-size:12px;font-weight:700;pointer-events:none`)}>{fm.cohortLabel}</span>
                  <Expand onClick={() => setLb(fm.idx)} />
                </div>
                <div style={css('display:flex;gap:16px;align-items:flex-start')}>
                  <span style={css('font-family:var(--font-headline);font-weight:700;font-size:clamp(36px,4vw,56px);line-height:0.9;letter-spacing:-0.04em;color:var(--yellow)')}>{fm.num}</span>
                  <span style={css('display:flex;flex-direction:column;gap:4px;padding-top:2px')}>
                    <span style={css('font-family:var(--font-headline);font-weight:700;font-size:clamp(18px,1.8vw,24px);line-height:1.15')}>{fm.title}</span>
                    <span style={css('font-size:15px;line-height:1.45;max-width:460px')}>{fm.caption}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={css('padding:clamp(64px,9vw,112px) 22px')}>
        <div style={css('max-width:1180px;margin:0 auto')}>
          <div style={css('display:flex;flex-direction:column;gap:8px;margin-bottom:36px')}>
            <span style={css('font-size:15px;font-weight:700;color:var(--magenta)')}>Sorotan momen</span>
            <h2 style={css(H2)}>Dari kelas ke panggung.</h2>
          </div>
          <div style={css('display:grid;grid-template-columns:repeat(6,minmax(0,1fr));grid-auto-rows:clamp(96px,13vw,170px);grid-auto-flow:dense;gap:clamp(8px,1.2vw,14px)')}>
            {docBento.map((b, i) => (
              <div key={i} style={css(`grid-column:span ${b.c};grid-row:span ${b.r};position:relative;border-radius:20px;overflow:hidden;background:${b.item ? 'var(--surface-muted)' : b.bg};color:${b.item ? 'var(--dark-blue)' : b.fg}`)}>
                {b.item ? (
                  <>
                    <Photo src={sitePhotos[b.item.slotId]} placeholder="Foto kegiatan" />
                    <span style={css('position:absolute;left:12px;bottom:12px;z-index:2;padding:5px 12px;border-radius:999px;background:#fff;color:var(--dark-blue);font-size:12px;font-weight:700;pointer-events:none')}>{b.item.caption}</span>
                    <Expand onClick={() => setLb(b.item!.idx)} />
                  </>
                ) : (
                  <div style={css('position:absolute;inset:0;padding:clamp(12px,1.6vw,20px);display:flex;flex-direction:column;justify-content:flex-end')}>
                    <span style={css('font-family:var(--font-headline);font-weight:700;font-size:clamp(20px,2.6vw,36px);line-height:0.95;letter-spacing:-0.03em')}>{b.word}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {docKelas.map(({ co, photos }) => (
        <section key={co.key} style={css(`background:${co.color};color:${co.fg};padding:clamp(56px,8vw,96px) 22px`)}>
          <div style={css('max-width:1180px;margin:0 auto;display:flex;flex-wrap:wrap;gap:clamp(28px,4vw,56px);align-items:stretch')}>
            <div style={css('flex:1 1 300px;min-width:0;display:flex;flex-direction:column;gap:14px;justify-content:space-between')}>
              <div style={css('display:flex;flex-direction:column;gap:10px')}>
                <span style={css('font-size:15px;font-weight:700')}>{String(COHORTS.indexOf(co) + 1).padStart(2, '0')} · {TRACKS[co.track].name}</span>
                <h2 style={css('font-family:var(--font-headline);font-weight:700;font-size:clamp(40px,5.4vw,80px);line-height:0.92;letter-spacing:-0.045em;margin:0;overflow-wrap:anywhere')}>{co.city}</h2>
                <p style={css('margin:6px 0 0;font-size:17px;line-height:1.5;max-width:360px')}>{DOC_DESC[co.track]}</p>
              </div>
              <div style={css('display:flex;flex-wrap:wrap;gap:10px')}>
                <Hv as={Link} href={'/galeri?kelas=' + co.key} s="all:unset;cursor:pointer;padding:12px 22px;border-radius:999px;background:#fff;color:var(--dark-blue);font-weight:700;font-size:15px" h="transform:translateY(-2px)">Karya kelas ini</Hv>
                <Link href={'/peserta?kelas=' + co.key} style={css(`all:unset;cursor:pointer;padding:10px 20px;border-radius:999px;border:2px solid ${co.fg};font-weight:700;font-size:15px`)}>Peserta</Link>
              </div>
            </div>
            <div style={css('flex:2 1 520px;min-width:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));grid-template-rows:repeat(2,clamp(120px,15vw,200px));gap:12px')}>
              {photos.map((kp) => (
                <div key={kp.slotId} style={css(`grid-column:${kp.gc};grid-row:${kp.gr};position:relative;border-radius:18px;overflow:hidden;background:#fff;color:var(--dark-blue)`)}>
                  <Photo src={sitePhotos[kp.slotId]} placeholder="Foto kelas" />
                  <Expand onClick={() => setLb(kp.idx)} />
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}

      <section style={css('padding:clamp(64px,9vw,112px) 22px')}>
        <div style={css('max-width:1180px;margin:0 auto')}>
          <div style={css('display:flex;flex-direction:column;gap:8px;margin-bottom:36px')}>
            <span style={css('font-size:15px;font-weight:700;color:var(--plan-blue)')}>Momen lainnya</span>
            <h2 style={css(H2)}>Di sela-sela kelas.</h2>
          </div>
          <div style={css('columns:3 260px;column-gap:16px')}>
            {docMasonry.map((m) => (
              <figure key={m.slotId} style={css('break-inside:avoid;margin:0 0 16px;display:flex;flex-direction:column;gap:8px')}>
                <div style={css(`position:relative;aspect-ratio:${m.ratio};border-radius:16px;overflow:hidden;background:var(--surface-muted);color:var(--dark-blue);border-bottom:5px solid ${m.color}`)}>
                  <Photo src={sitePhotos[m.slotId]} placeholder="Foto kegiatan" />
                  <Expand onClick={() => setLb(m.idx)} />
                </div>
                <figcaption style={css('display:flex;justify-content:space-between;gap:12px;padding:0 4px;font-size:13px')}>
                  <span style={css('font-family:var(--font-caption);font-style:italic')}>{m.caption}</span>
                  <span style={css('color:var(--text-muted);white-space:nowrap')}>{m.city}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section style={css('background:var(--yellow);color:var(--dark-blue);padding:clamp(64px,9vw,112px) 22px;overflow:hidden')}>
        <div style={css('max-width:1180px;margin:0 auto;display:flex;flex-direction:column;align-items:center;gap:clamp(32px,5vw,56px)')}>
          <div style={css('display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center')}>
            <span style={css('font-size:15px;font-weight:700')}>Papan kenangan</span>
            <h2 style={css(H2)}>Yang akan selalu diingat.</h2>
          </div>
          <div style={css('display:flex;flex-wrap:wrap;justify-content:center;gap:clamp(12px,2vw,28px)')}>
            {docPolaroid.map((pl) => (
              <Hv key={pl.slotId} as="div" s={`position:relative;flex:0 0 clamp(150px,22vw,250px);background:#fff;padding:10px 10px 0;box-shadow:var(--shadow-md);transform:rotate(${pl.rot});transition:transform 260ms ease`} h="transform:rotate(0deg) scale(1.05)">
                <span style={css(`position:absolute;top:-10px;left:50%;width:64px;height:20px;margin-left:-32px;background:${pl.tape};opacity:.85;transform:rotate(-3deg);z-index:3`)} />
                <div style={css('position:relative;aspect-ratio:1;background:var(--surface-muted);color:var(--dark-blue);overflow:hidden')}>
                  <Photo src={sitePhotos[pl.slotId]} placeholder="Foto" />
                  <Expand onClick={() => setLb(pl.idx)} />
                </div>
                <p style={css('margin:0;padding:12px 4px 16px;text-align:center;font-family:var(--font-caption);font-style:italic;font-size:15px')}>{pl.caption}</p>
              </Hv>
            ))}
          </div>
          <Hv as={Link} href="/galeri" s="all:unset;cursor:pointer;padding:14px 28px;border-radius:999px;background:var(--dark-blue);color:#fff;font-weight:700;font-size:16px" h="background:var(--plan-blue)">Lihat karya peserta</Hv>
        </div>
      </section>

      {cur && lb != null && (
        <div role="dialog" aria-modal="true" aria-label={cur.caption} style={css('position:fixed;inset:0;z-index:60;background:rgba(20,34,43,.94);color:#fff;display:flex;flex-direction:column;padding:20px clamp(16px,3vw,32px)')}>
          <div style={css('display:flex;justify-content:space-between;align-items:center;gap:16px')}>
            <span style={css('display:flex;align-items:center;gap:10px;font-size:14px;font-weight:700')}><span style={css(`width:10px;height:10px;border-radius:50%;background:${cur.color}`)} />{cur.cohortLabel}</span>
            <div style={css('display:flex;align-items:center;gap:12px')}>
              <span style={css('font-family:var(--font-headline);font-weight:700;font-size:14px')}>{(lb + 1) + ' / ' + list.length}</span>
              <button type="button" onClick={() => setLb(null)} aria-label="Tutup" style={css('all:unset;cursor:pointer;width:44px;height:44px;border-radius:50%;background:#fff;color:var(--dark-blue);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700')}>×</button>
            </div>
          </div>
          <div style={css('flex:1;min-height:0;display:flex;align-items:center;justify-content:center;gap:16px;padding:20px 0')}>
            <button type="button" onClick={() => setLb((lb - 1 + list.length) % list.length)} aria-label="Sebelumnya" style={css('all:unset;cursor:pointer;flex:none;width:48px;height:48px;border-radius:50%;border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:20px')}>←</button>
            <div style={css('position:relative;flex:1;max-width:1100px;height:100%;max-height:78vh;border-radius:16px;overflow:hidden;background:var(--surface-muted);color:var(--dark-blue)')}>
              <Photo key={cur.slotId} src={sitePhotos[cur.slotId]} placeholder="Foto dokumentasi" fit="contain" />
            </div>
            <button type="button" onClick={() => setLb((lb + 1) % list.length)} aria-label="Berikutnya" style={css('all:unset;cursor:pointer;flex:none;width:48px;height:48px;border-radius:50%;background:#fff;color:var(--dark-blue);display:flex;align-items:center;justify-content:center;font-size:20px')}>→</button>
          </div>
          <p style={css('margin:0;text-align:center;font-family:var(--font-caption);font-style:italic;font-size:16px')}>{cur.caption}</p>
        </div>
      )}
    </>
  );
}
