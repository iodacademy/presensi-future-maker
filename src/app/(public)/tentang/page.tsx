'use client';

import React from 'react';
import Link from 'next/link';
import { TRACKS } from '@/features/exhibition/content';
import { Hv, css } from '@/features/exhibition/ui';

export default function AboutPage() {
  return (
    <>
      <section style={css('padding:calc(80px + clamp(56px,9vw,112px)) 22px clamp(56px,8vw,96px);text-align:center;background:var(--yellow);color:var(--dark-blue)')}>
        <div style={css('max-width:880px;margin:0 auto;display:flex;flex-direction:column;align-items:center;gap:16px')}>
          <span style={css('font-size:17px;font-weight:700;color:var(--dark-blue)')}>Tentang bootcamp</span>
          <h1 style={css('font-family:var(--font-headline);font-weight:700;font-size:clamp(44px,7vw,80px);line-height:1.04;letter-spacing:-0.035em;margin:0;text-wrap:balance')}>Belajar dari praktik. Pulang membawa karya.</h1>
          <p style={css('font-family:var(--font-headline);font-weight:500;font-size:clamp(19px,2.2vw,24px);line-height:1.35;margin:8px 0 0;max-width:640px;text-wrap:balance')}>Future Makers adalah bootcamp keterampilan digital untuk kaum muda. Setiap peserta menyelesaikan proyek nyata di akhir program.</p>
        </div>
      </section>
      <section style={css('padding:clamp(48px,7vw,80px) 12px clamp(56px,8vw,96px)')}>
        <div style={css('max-width:1180px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:12px')}>
          {Object.values(TRACKS).map((t) => (
            <div key={t.key} style={css(`background:${t.color};color:${t.fg};border-radius:24px;padding:40px 32px;display:flex;flex-direction:column;gap:14px`)}>
              <h2 style={css('font-family:var(--font-headline);font-weight:700;font-size:28px;line-height:1.1;letter-spacing:-0.025em;margin:0')}>{t.name}</h2>
              <p style={css('margin:0;font-size:17px;line-height:1.45')}>{t.desc}</p>
              <ul style={css('margin:12px 0 0;padding:0;list-style:none;display:flex;flex-direction:column')}>
                {t.outputs.map((o) => <li key={o} style={css(`font-size:15px;font-weight:700;padding:12px 0;border-top:2px solid ${t.fg}`)}>{o}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </section>
      <section style={css('padding:clamp(56px,8vw,96px) 22px clamp(72px,10vw,120px);text-align:center;background:var(--plan-blue);color:#fff')}>
        <div style={css('max-width:720px;margin:0 auto;display:flex;flex-direction:column;align-items:center;gap:14px')}>
          <span style={css('font-size:15px;color:var(--yellow);font-weight:700')}>Diselenggarakan oleh</span>
          <h2 style={css('font-family:var(--font-headline);font-weight:700;font-size:clamp(28px,3.4vw,40px);line-height:1.1;letter-spacing:-0.025em;margin:0')}>Yayasan Plan International Indonesia</h2>
          <p style={css('margin:0;font-size:17px;line-height:1.6;text-wrap:pretty')}>Plan Indonesia bekerja di Indonesia sejak 1969 dan menjalankan program perlindungan anak, kesehatan remaja, ketenagakerjaan dan kewirausahaan kaum muda, serta kesiapsiagaan bencana. Kami tidak akan berhenti sampai semua setara.</p>
          <Hv as={Link} href="/galeri" s="all:unset;cursor:pointer;margin-top:12px;padding:14px 28px;border-radius:999px;background:var(--yellow);color:var(--dark-blue);font-weight:700;font-size:17px" h="transform:translateY(-2px)">Lihat karya peserta</Hv>
        </div>
      </section>
    </>
  );
}
