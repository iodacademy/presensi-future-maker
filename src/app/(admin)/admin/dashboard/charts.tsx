'use client';

import React from 'react';
import type { SeriesPoint } from '@/features/dashboard/snapshot-types';

/**
 * Ambang warna untuk angka berupa persentase.
 *
 * Hijau, kuning, merah mengikuti ambang yang sama dengan daftar siaga. Memakai
 * ambang yang berbeda antara grafik dan daftarnya membuat satu pertemuan
 * terlihat aman di grafik tetapi memunculkan pesertanya pada daftar siaga.
 *
 * Colour thresholds for percentage figures.
 *
 * Green, amber, red follow the same thresholds as the alert list. Different
 * thresholds between a chart and the list would make one meeting look safe on
 * the chart while putting its participants on the alert list.
 */
export function rateColor(value: number): string {
  if (value >= 85) return 'var(--color-success)';
  if (value >= 70) return 'var(--color-warning)';
  return 'var(--color-danger)';
}

export function scoreColor(value: number, passing = 70): string {
  if (value >= passing + 15) return 'var(--color-success)';
  if (value >= passing) return 'var(--color-warning)';
  return 'var(--color-danger)';
}

/**
 * Grafik batang mendatar berlabel.
 *
 * Mendatar, bukan tegak: label pertemuan dan tugas berupa kalimat yang tidak
 * muat di bawah batang tegak, dan memiringkannya membuat label itu harus
 * dibaca dengan kepala dimiringkan.
 *
 * Titik yang nilainya null digambar sebagai jalur kosong, bukan dilewatkan:
 * pertemuan yang belum berjalan tetap perlu terlihat agar admin tahu jadwalnya
 * masih ada.
 *
 * A labelled horizontal bar chart.
 *
 * Horizontal rather than vertical: meeting and task labels are sentences that
 * do not fit under a vertical bar, and tilting them makes the label something
 * to read with a tilted head.
 *
 * A null point draws as an empty track rather than being skipped: a meeting not
 * yet held still needs showing so an admin knows it is still on the schedule.
 */
export function BarChart({
  points,
  colorFor,
  suffix = '%',
  emptyLabel = 'belum berjalan',
}: {
  points: SeriesPoint[];
  colorFor: (value: number) => string;
  suffix?: string;
  emptyLabel?: string;
}) {
  if (points.length === 0) {
    return <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Belum ada data</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      {points.map((p, i) => (
        <div key={`${p.label}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            title={p.label}
            style={{ width: '150px', flexShrink: 0, fontSize: '10px', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {p.label}
          </span>

          <div style={{ flex: 1, minWidth: 0, height: '16px', borderRadius: '4px', backgroundColor: 'var(--color-bg-app)', position: 'relative' }}>
            {p.value !== null && (
              <div
                style={{
                  width: `${Math.max(0, Math.min(100, p.value))}%`,
                  height: '100%', borderRadius: '4px',
                  backgroundColor: colorFor(p.value),
                }}
              />
            )}
          </div>

          <span style={{ width: '58px', flexShrink: 0, textAlign: 'right', fontSize: '10px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: p.value === null ? 'var(--color-text-faint)' : 'var(--color-text-main)' }}>
            {p.value === null ? emptyLabel : `${p.value}${suffix}`}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Grafik pretest dan postest berdampingan beserta selisihnya.
 *
 * Selisihnya ditampilkan sebagai angka, bukan hanya sebagai jarak dua batang:
 * jarak pada grafik harus diukur mata, sedangkan kenaikan poin adalah yang
 * dilaporkan.
 *
 * Pretest and posttest side by side with their difference.
 *
 * The difference shows as a number rather than only as the gap between two
 * bars: a gap on a chart has to be measured by eye, while the point gain is
 * what gets reported.
 */
export function GainChart({
  rows,
}: {
  rows: { className: string; pretest: number | null; posttest: number | null }[];
}) {
  if (rows.length === 0) {
    return <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Belum ada data</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {rows.map((r) => {
        const gain = r.pretest !== null && r.posttest !== null ? r.posttest - r.pretest : null;

        return (
          <div key={r.className} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '150px', flexShrink: 0, fontSize: '10px', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.className}
            </span>

            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {([['Pretest', r.pretest, 'var(--color-text-faint)'], ['Postest', r.posttest, 'var(--color-primary)']] as const).map(([nama, nilai, warna]) => (
                <div key={nama} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '46px', flexShrink: 0, fontSize: '9px', color: 'var(--color-text-faint)' }}>{nama}</span>
                  <div style={{ flex: 1, minWidth: 0, height: '11px', borderRadius: '3px', backgroundColor: 'var(--color-bg-app)' }}>
                    {nilai !== null && (
                      <div style={{ width: `${Math.max(0, Math.min(100, nilai))}%`, height: '100%', borderRadius: '3px', backgroundColor: warna }} />
                    )}
                  </div>
                  <span style={{ width: '28px', flexShrink: 0, textAlign: 'right', fontSize: '9px', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: nilai === null ? 'var(--color-text-faint)' : 'var(--color-text-main)' }}>
                    {nilai ?? '-'}
                  </span>
                </div>
              ))}
            </div>

            <span
              style={{
                width: '52px', flexShrink: 0, textAlign: 'right', fontSize: '11px', fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                color: gain === null ? 'var(--color-text-faint)' : gain > 0 ? 'var(--color-success)' : 'var(--color-danger)',
              }}
            >
              {gain === null ? '-' : `${gain > 0 ? '+' : ''}${gain}`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Batang bertumpuk untuk sebaran yang berjumlah tetap.
 *
 * Bagian bernilai nol tidak digambar sama sekali, bukan digambar setipis
 * mungkin: potongan setebal satu piksel terbaca sebagai nilai kecil, bukan
 * sebagai ketiadaan.
 *
 * A stacked bar for a distribution with a fixed total.
 *
 * A zero-valued part is not drawn at all rather than drawn as thin as possible:
 * a one-pixel sliver reads as a small value, not as absence.
 */
export function StackedBar({
  parts,
}: {
  parts: { label: string; value: number; color: string }[];
}) {
  const total = parts.reduce((t, p) => t + p.value, 0);

  if (total === 0) {
    return <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Belum ada data</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', height: '22px', borderRadius: '6px', overflow: 'hidden' }}>
        {parts.map((p) =>
          p.value === 0 ? null : (
            <div
              key={p.label}
              title={`${p.label}: ${p.value}`}
              style={{ width: `${(p.value / total) * 100}%`, backgroundColor: p.color }}
            />
          )
        )}
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        {parts.map((p) => (
          <span key={p.label} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: 'var(--color-text-muted)' }}>
            <span style={{ width: '9px', height: '9px', borderRadius: '2px', backgroundColor: p.color, flexShrink: 0 }} />
            {p.label}
            <strong style={{ color: 'var(--color-text-main)' }}>{p.value}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Kartu angka tunggal / A single-figure card */
export function StatCard({
  label,
  value,
  detail,
  tone = 'netral',
}: {
  label: string;
  value: string | number;
  detail?: string;
  tone?: 'netral' | 'baik' | 'buruk';
}) {
  const warna =
    tone === 'baik' ? 'var(--color-success)' : tone === 'buruk' ? 'var(--color-danger)' : 'var(--color-text-main)';

  return (
    <div style={{ flex: '1 1 150px', minWidth: '140px', padding: '14px 16px', borderRadius: '12px', border: '1px solid var(--color-border)', backgroundColor: '#ffffff' }}>
      <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>
        {label.toUpperCase()}
      </div>
      <div style={{ fontSize: '26px', fontWeight: 800, lineHeight: 1.2, marginTop: '2px', color: warna }}>
        {value}
      </div>
      {detail && (
        <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '1px' }}>{detail}</div>
      )}
    </div>
  );
}

/** Kerangka satu bagian dashboard / One dashboard section's frame */
export function Panel({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid var(--color-border)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '13px', fontWeight: 700, color: 'var(--color-text-main)', margin: 0 }}>
          {title}
        </h2>
        {hint && (
          <p style={{ fontSize: '10px', color: 'var(--color-text-muted)', margin: '2px 0 0', lineHeight: 1.5 }}>
            {hint}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}
