'use client';

import React, { useEffect, useState } from 'react';
import { countdownParts } from './model';

/**
 * Spanduk biru Portal Karier dengan kotak hitung mundur ke penutupan terjauh.
 *
 * The Portal Karier blue banner with countdown boxes to the latest closing time.
 */
export function CountdownBanner({ closesAt }: { closesAt: string | null }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  const p = closesAt && now ? countdownParts(closesAt, now) : null;
  const boxes: [number, string][] = p ? [[p.days, 'Hari'], [p.hours, 'Jam'], [p.minutes, 'Menit'], [p.seconds, 'Detik']] : [];
  return (
    <section style={{ backgroundColor: '#0072CE', color: '#ffffff', borderRadius: '16px', padding: '26px 28px', display: 'flex', gap: '20px', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ maxWidth: '520px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <span style={{ alignSelf: 'flex-start', backgroundColor: '#FFD200', color: '#243c4b', fontSize: '12px', fontWeight: 700, padding: '3px 10px', borderRadius: '999px' }}>Rekrutmen Mitra</span>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '24px', fontWeight: 700, margin: 0, lineHeight: 1.25 }}>Lamar posisi dari mitra Future Makers</h2>
        <p style={{ margin: 0, fontSize: '14px', opacity: 0.92 }}>Lamaran dikirim langsung ke PIC perusahaan. Pastikan CV kamu sudah siap sebelum periode ditutup.</p>
      </div>
      {p && !p.ended && (
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>Periode lamaran ditutup dalam</div>
          <div role="timer" aria-label="Sisa waktu periode lamaran" style={{ display: 'flex', gap: '8px' }}>
            {boxes.map(([n, l], i) => (
              <div key={l} style={{ width: '64px', padding: '8px 0', borderRadius: '10px', textAlign: 'center', backgroundColor: i === 3 ? '#FFD200' : '#ffffff', color: i === 3 ? '#7a4b00' : '#243c4b' }}>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: '24px', fontWeight: 700, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>{String(n).padStart(2, '0')}</div>
                <div style={{ fontSize: '11px' }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
