'use client';

import React from 'react';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { DATA, TRACKS, TYPE, card, descFor } from '@/features/exhibition/content';
import { Hv, css } from '@/features/exhibition/ui';

const MEDIA_CAPTION = { shot: 'Tampilan aplikasi. Buka demo untuk mencoba langsung.', dash: 'Dashboard dimuat dari Looker Studio / Tableau Public.', pdf: 'Dokumen lengkap tersedia dalam format PDF.', social: 'Konten dimuat dari Instagram / TikTok peserta.' };

export default function WorkPage() {
  const { id } = useParams<{ id: string }>();
  const w = DATA.W[id];
  if (!w) notFound();
  const t = TRACKS[w.track], T = TYPE[w.type], p = DATA.P[w.person];
  const url = w.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.futuremakers.id';
  const specs = [{ k: 'Peserta', v: p.name }, { k: 'Track', v: t.name }, { k: 'Jenis karya', v: w.type }, { k: 'Tools', v: T.tools.join(', ') }, { k: 'Kota', v: p.city }];
  const related = DATA.works.filter((x) => x.track === w.track && x.id !== w.id && x.type === w.type).slice(0, 4).map(card);

  return (
    <>
      <section style={css('padding:calc(80px + clamp(40px,6vw,72px)) 22px 40px;text-align:center')}>
        <div style={css('max-width:880px;margin:0 auto;display:flex;flex-direction:column;align-items:center;gap:14px')}>
          <Link href={'/galeri?jurusan=' + w.track} style={css('all:unset;cursor:pointer;font-size:15px;font-weight:700;color:var(--plan-blue)')}>{t.name} · {w.type}</Link>
          <h1 style={css('font-family:var(--font-headline);font-weight:700;font-size:clamp(36px,5.6vw,64px);line-height:1.06;letter-spacing:-0.035em;margin:0;text-wrap:balance')}>{w.title}</h1>
          <Hv as={Link} href={'/peserta/' + p.id} s="all:unset;cursor:pointer;font-size:19px;color:var(--text-muted)" h="color:var(--dark-blue)">oleh {p.name} ›</Hv>
          <div style={css('display:flex;flex-wrap:wrap;gap:20px;align-items:center;justify-content:center;margin-top:12px')}>
            {T.links.map((label, i) => i === 0
              ? <a key={label} href="#" style={css('display:inline-flex;align-items:center;justify-content:center;gap:8px;font-family:var(--font-body);font-weight:700;line-height:1;padding:12px 24px;font-size:16px;color:var(--white);background:var(--plan-blue);border:2px solid var(--plan-blue);border-radius:var(--radius-pill);cursor:pointer;text-decoration:none;transition:filter var(--duration) var(--ease-standard), transform var(--duration-fast) var(--ease-standard);-webkit-tap-highlight-color:transparent')}>{label}</a>
              : <a key={label} href="#" style={css('font-size:17px')}>{label} ›</a>)}
          </div>
        </div>
      </section>
      <section style={css('padding:0 22px')}>
        <div style={css('max-width:1180px;margin:0 auto')}>
          {T.kind === 'shot' && (
            <div style={css('background:var(--surface-muted);border-radius:24px;padding:clamp(24px,5vw,64px) clamp(16px,5vw,64px) 0;overflow:hidden')}>
              <div style={css('max-width:960px;margin:0 auto;background:#fff;border-radius:12px 12px 0 0;box-shadow:var(--shadow-md);overflow:hidden')}>
                <div style={css('display:flex;gap:6px;align-items:center;padding:10px 14px;border-bottom:1px solid #ececea')}>
                  {[0, 1, 2].map((i) => <span key={i} style={css('width:10px;height:10px;border-radius:50%;background:var(--light-grey)')} />)}
                  <span style={css('flex:1;text-align:center;font-size:12px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap')}>{url}</span>
                </div>
                <div style={css('aspect-ratio:16/9;display:flex;align-items:center;justify-content:center')}>
                  <span style={css('font-family:var(--font-caption);font-style:italic;font-size:15px;color:var(--text-muted)')}>Screenshot aplikasi</span>
                </div>
              </div>
            </div>
          )}
          {T.kind === 'dash' && (
            <div style={css('aspect-ratio:16/9;background:var(--surface-muted);border-radius:24px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:24px;text-align:center')}>
              <span style={css('font-family:var(--font-headline);font-weight:600;font-size:19px')}>Embed dashboard interaktif</span>
              <span style={css('font-family:var(--font-caption);font-style:italic;font-size:14px;color:var(--text-muted)')}>Looker Studio / Tableau Public dimuat di sini</span>
            </div>
          )}
          {T.kind === 'pdf' && (
            <div style={css('background:var(--surface-muted);border-radius:24px;padding:clamp(32px,6vw,80px) 22px;display:flex;justify-content:center')}>
              <div style={css('width:min(100%,400px);aspect-ratio:1/1.414;background:#fff;border-radius:6px;box-shadow:var(--shadow-lg);display:flex;flex-direction:column;padding:32px;gap:10px')}>
                <span style={css('font-size:11px;font-weight:700;color:var(--plan-blue)')}>{t.name}</span>
                <span style={css('font-family:var(--font-headline);font-weight:700;font-size:20px;line-height:1.2;letter-spacing:-0.01em')}>{w.title}</span>
                <span style={css('flex:1;display:flex;align-items:center;justify-content:center;font-family:var(--font-caption);font-style:italic;font-size:14px;color:var(--text-muted);text-align:center')}>Pratinjau PDF · {w.pdfPages} halaman</span>
              </div>
            </div>
          )}
          {T.kind === 'social' && (
            <div style={css('background:var(--surface-muted);border-radius:24px;padding:clamp(24px,5vw,64px)')}>
              <div style={css(`max-width:${T.socialW || '720px'};margin:0 auto;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px`)}>
                {Array.from({ length: T.slots || 0 }, (_, i) => (
                  <div key={i} style={css(`aspect-ratio:${T.ratio || '1'};background:#fff;border-radius:12px;display:flex;align-items:flex-end;padding:12px`)}>
                    <span style={css('font-family:var(--font-caption);font-style:italic;font-size:12px;color:var(--text-muted)')}>{T.slotLabel + ' ' + (i + 1)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <p style={css('text-align:center;font-family:var(--font-caption);font-style:italic;font-size:13px;color:var(--text-muted);margin:14px 0 0')}>{MEDIA_CAPTION[T.kind]}</p>
        </div>
      </section>
      <section style={css('padding:clamp(56px,8vw,96px) 22px')}>
        <div style={css('max-width:880px;margin:0 auto;display:flex;flex-wrap:wrap;gap:48px')}>
          <p style={css('flex:1 1 380px;margin:0;font-family:var(--font-headline);font-weight:500;font-size:clamp(19px,2vw,22px);line-height:1.45;letter-spacing:-0.01em;text-wrap:pretty')}>{descFor(w)}</p>
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
              {related.map((r) => (
                <Hv key={r.id} as={Link} href={r.href} s="all:unset;cursor:pointer;display:flex;flex-direction:column;gap:14px;background:#fff;border-radius:18px;padding:14px 14px 20px;transition:transform 240ms ease" h="transform:scale(1.015)">
                  <div style={css(`aspect-ratio:4/3;border-radius:12px;background:${r.tint};display:flex;align-items:center;justify-content:center`)}>
                    <span style={css('font-family:var(--font-caption);font-style:italic;font-size:13px;color:var(--text-muted)')}>{r.thumbLabel}</span>
                  </div>
                  <div style={css('display:flex;flex-direction:column;gap:4px;padding:0 4px')}>
                    <span style={css('font-family:var(--font-headline);font-weight:600;font-size:16px;line-height:1.25')}>{r.title}</span>
                    <span style={css('font-size:14px;color:var(--text-muted)')}>{r.personName}</span>
                  </div>
                </Hv>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
