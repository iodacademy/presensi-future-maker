'use client';

import React, { useEffect, useState } from 'react';

/**
 * Grafik beranda peserta, ditulis sebagai SVG/HTML biasa tanpa pustaka grafik:
 * lima bentuk sederhana ini tidak sebanding dengan tambahan ratusan kilobita.
 *
 * Setiap nilai juga tampil sebagai label atau legenda, sehingga tooltip hanya
 * pelengkap dan tidak pernah menjadi satu-satunya jalan membaca angka.
 *
 * Participant home charts, written as plain SVG/HTML with no chart library:
 * these five simple forms are not worth hundreds of extra kilobytes.
 *
 * Every value also shows as a label or legend, so the tooltip only enhances and
 * is never the only way to read a number.
 */

export interface Segment {
  label: string;
  value: number;
  color: string;
}

const SURFACE = '#ffffff';
const GRID = '#eef0f2';
const MUTED = 'var(--color-text-muted)';

interface Tip {
  x: number;
  y: number;
  value: string;
  label: string;
}

/** Tooltip bersama: nilai di depan, label di belakang / Shared tooltip: value first, label after */
function useTip() {
  const [tip, setTip] = useState<Tip | null>(null);
  const node = tip ? (
    <div
      role="tooltip"
      style={{
        position: 'absolute', left: tip.x, top: tip.y, transform: 'translate(-50%, calc(-100% - 8px))', pointerEvents: 'none', zIndex: 5,
        backgroundColor: '#1f2a37', color: '#ffffff', borderRadius: '8px', padding: '6px 10px', whiteSpace: 'nowrap', boxShadow: '0 6px 16px rgba(0,0,0,0.18)',
      }}
    >
      <div style={{ fontSize: '12px', fontWeight: 700 }}>{tip.value}</div>
      <div style={{ fontSize: '10px', opacity: 0.8 }}>{tip.label}</div>
    </div>
  ) : null;
  return { tip: node, setTip };
}

/** Posisi tooltip relatif terhadap pembungkus grafik / Tooltip position relative to the chart wrapper */
function anchor(e: React.SyntheticEvent<Element>, wrapper: HTMLElement | null) {
  const box = (e.currentTarget as Element).getBoundingClientRect();
  const base = wrapper?.getBoundingClientRect();
  return { x: box.left + box.width / 2 - (base?.left ?? 0), y: box.top - (base?.top ?? 0) };
}

export function Legend({ items }: { items: Segment[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
      {items.map((s) => (
        <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: s.color, flexShrink: 0 }} />
          <span style={{ flex: 1, color: MUTED }}>{s.label}</span>
          <span style={{ fontWeight: 700, color: 'var(--color-text-main)', fontVariantNumeric: 'tabular-nums' }}>{s.value}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Donut bagian-dari-keseluruhan. Celah 2px sewarna permukaan memisahkan
 * segmen, bukan garis tepi.
 *
 * Part-to-whole donut. A 2px surface-coloured gap separates segments, not a
 * border.
 */
export function Donut({ segments, centerValue, centerLabel, size = 132 }: { segments: Segment[]; centerValue: string; centerLabel: string; size?: number }) {
  const wrapper = React.useRef<HTMLDivElement>(null);
  const { tip, setTip } = useTip();
  const total = segments.reduce((n, s) => n + s.value, 0);
  const r = 50;
  const stroke = 14;
  const gap = segments.filter((s) => s.value > 0).length > 1 ? 1.2 : 0;
  let offset = 0;

  return (
    <div ref={wrapper} style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg viewBox="0 0 120 120" width={size} height={size} role="img" aria-label={`${centerLabel}: ${centerValue}`}>
        <circle cx="60" cy="60" r={r} fill="none" stroke={GRID} strokeWidth={stroke} />
        {total > 0 &&
          segments.map((s) => {
            if (s.value === 0) return null;
            const len = (s.value / total) * 100;
            const dash = Math.max(len - gap, 0.01);
            const el = (
              <circle
                key={s.label}
                cx="60"
                cy="60"
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={stroke}
                pathLength={100}
                strokeDasharray={`${dash} ${100 - dash}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 60 60)"
                tabIndex={0}
                style={{ cursor: 'default', outline: 'none' }}
                onMouseEnter={(e) => setTip({ ...anchor(e, wrapper.current), value: `${s.value} (${Math.round((s.value / total) * 100)}%)`, label: s.label })}
                onFocus={(e) => setTip({ ...anchor(e, wrapper.current), value: `${s.value} (${Math.round((s.value / total) * 100)}%)`, label: s.label })}
                onMouseLeave={() => setTip(null)}
                onBlur={() => setTip(null)}
              />
            );
            offset += len;
            return el;
          })}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: '22px', fontWeight: 700, color: 'var(--color-text-main)', lineHeight: 1.1 }}>{centerValue}</span>
        <span style={{ fontSize: '10px', color: MUTED }}>{centerLabel}</span>
      </div>
      {tip}
    </div>
  );
}

/**
 * Cincin aktivitas: satu cincin per ukuran 0-100%, lintasannya warna yang
 * sama yang dipudarkan agar sisa target tetap terbaca.
 *
 * Activity rings: one ring per 0-100% measure, its track a faded step of the
 * same colour so the remaining target still reads.
 */
export function Rings({ rings, size = 150 }: { rings: { label: string; percent: number; color: string; detail: string }[]; size?: number }) {
  const wrapper = React.useRef<HTMLDivElement>(null);
  const { tip, setTip } = useTip();
  const stroke = 11;
  return (
    <div ref={wrapper} style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg viewBox="0 0 150 150" width={size} height={size} role="img" aria-label={rings.map((r) => `${r.label} ${r.percent}%`).join(', ')}>
        {rings.map((ring, i) => {
          const r = 66 - i * (stroke + 4);
          const pct = Math.max(0, Math.min(100, ring.percent));
          const show = (e: React.SyntheticEvent<Element>) => setTip({ ...anchor(e, wrapper.current), value: `${ring.percent}%`, label: `${ring.label} · ${ring.detail}` });
          return (
            <g key={ring.label}>
              <circle cx="75" cy="75" r={r} fill="none" stroke={ring.color} strokeOpacity={0.15} strokeWidth={stroke} />
              {pct > 0 && (
                <circle
                  cx="75"
                  cy="75"
                  r={r}
                  fill="none"
                  stroke={ring.color}
                  strokeWidth={stroke}
                  strokeLinecap="round"
                  pathLength={100}
                  strokeDasharray={`${pct} 100`}
                  transform="rotate(-90 75 75)"
                  tabIndex={0}
                  style={{ outline: 'none' }}
                  onMouseEnter={show}
                  onFocus={show}
                  onMouseLeave={() => setTip(null)}
                  onBlur={() => setTip(null)}
                />
              )}
            </g>
          );
        })}
      </svg>
      {tip}
    </div>
  );
}

/**
 * Garis nilai terbaik per kuis dengan garis putus-putus batas lulus. Kuis
 * yang belum dikerjakan tampil sebagai penanda kosong di dasar sumbu, bukan
 * sebagai nilai nol: nol berarti dikerjakan dan salah semua.
 *
 * Best score per quiz as a line, with the pass mark as a dashed line. A quiz
 * not yet taken shows as a hollow marker on the baseline, not as a zero: zero
 * would mean taken and all wrong.
 */
export function ScoreLine({ points, color }: { points: { label: string; score: number | null; passing: number }[]; color: string }) {
  const wrapper = React.useRef<HTMLDivElement>(null);
  const { tip, setTip } = useTip();
  // Digambar pada lebar wadahnya, bukan diskalakan dari viewBox tetap: skala
  // membuat teks sumbu menyusut ke ~7px di layar HP.
  //
  // Drawn at its container's width rather than scaled from a fixed viewBox:
  // scaling shrinks the axis text to ~7px on phone screens.
  const [W, setW] = useState(600);
  useEffect(() => {
    const el = wrapper.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setW(Math.max(260, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = 210;
  const pad = { l: 34, r: 16, t: 14, b: 30 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;
  const x = (i: number) => pad.l + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (v: number) => pad.t + plotH - (v / 100) * plotH;

  const taken = points.map((p, i) => ({ ...p, i })).filter((p) => p.score !== null);
  const line = taken.map((p, n) => `${n === 0 ? 'M' : 'L'}${x(p.i)},${y(p.score!)}`).join(' ');
  const area = taken.length > 1 ? `${line} L${x(taken[taken.length - 1].i)},${y(0)} L${x(taken[0].i)},${y(0)} Z` : '';
  const band = points.length > 1 ? plotW / (points.length - 1) : plotW;
  // Batas lulus digambar per kuis, bukan disambung: tiap kuis punya batasnya
  // sendiri, dan garis sambung dari pretest (tanpa batas) ke kuis berikutnya
  // tampak seperti batas yang naik perlahan.
  //
  // The pass mark is drawn per quiz, not joined: each quiz has its own mark,
  // and a joined line from the pretest (no mark) to the next quiz reads as a
  // mark that slowly rises.
  const passMarks = points
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p.passing > 0)
    .map(({ p, i }) => {
      const half = Math.min(band / 2 - 4, 40);
      return `M${Math.max(pad.l, x(i) - half)},${y(p.passing)} L${Math.min(W - pad.r, x(i) + half)},${y(p.passing)}`;
    })
    .join(' ');

  return (
    <div ref={wrapper} style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Nilai terbaik per kuis" style={{ display: 'block', maxWidth: '100%' }}>
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke={GRID} strokeWidth={1} />
            <text x={pad.l - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#999999" style={{ fontVariantNumeric: 'tabular-nums' }}>{v}</text>
          </g>
        ))}
        {taken.length === 0 && (
          <text x={pad.l + plotW / 2} y={pad.t + plotH * 0.62} textAnchor="middle" fontSize="12" fill="#999999">Belum ada kuis yang dikerjakan</text>
        )}
        {passMarks && <path d={passMarks} fill="none" stroke="#d40d15" strokeWidth={1.5} strokeDasharray="5 4" />}
        {area && <path d={area} fill={color} fillOpacity={0.1} />}
        {taken.length > 1 && <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
        {points.map((p, i) => (
          <g key={i}>
            {p.score !== null ? (
              <circle cx={x(i)} cy={y(p.score)} r={5} fill={color} stroke={SURFACE} strokeWidth={2} />
            ) : (
              <circle cx={x(i)} cy={y(0)} r={4.5} fill={SURFACE} stroke="#b0b5bb" strokeWidth={1.5} />
            )}
            {p.score !== null && (
              <text x={x(i)} y={p.score < p.passing ? y(p.score) + 20 : y(p.score) - 10} textAnchor="middle" fontSize="11" fontWeight={700} fill="#243c4b">{p.score}</text>
            )}
            <text x={x(i)} y={H - 10} textAnchor="middle" fontSize="11" fill="#999999">{`K${i + 1}`}</text>
            {/* Area sentuh selebar satu kolom: pembaca membidik kuisnya, bukan titik 10px.
                A touch area one column wide: readers aim at the quiz, not a 10px dot. */}
            <rect
              x={Math.max(0, x(i) - band / 2)}
              y={pad.t}
              width={Math.min(W, x(i) + band / 2) - Math.max(0, x(i) - band / 2)}
              height={plotH}
              fill="transparent"
              tabIndex={0}
              style={{ outline: 'none' }}
              onMouseEnter={(e) => setTip({ ...anchor(e, wrapper.current), y: y(p.score ?? 0), value: p.score !== null ? `Nilai ${p.score}` : 'Belum dikerjakan', label: `K${i + 1} · ${p.label}${p.passing > 0 ? ` · lulus ${p.passing}` : ''}` })}
              onFocus={(e) => setTip({ ...anchor(e, wrapper.current), y: y(p.score ?? 0), value: p.score !== null ? `Nilai ${p.score}` : 'Belum dikerjakan', label: `K${i + 1} · ${p.label}${p.passing > 0 ? ` · lulus ${p.passing}` : ''}` })}
              onMouseLeave={() => setTip(null)}
              onBlur={() => setTip(null)}
            />
          </g>
        ))}
      </svg>
      {tip}
    </div>
  );
}

/**
 * Batang horizontal nilai per butir, nilai di ujung batang. Bentuk horizontal
 * dipilih karena judul tugas panjang dan tidak muat di bawah kolom.
 *
 * Horizontal bars of a score per item, value at the bar tip. Horizontal
 * because task titles are long and do not fit under columns.
 */
export function ScoreBars({ items, color }: { items: { label: string; score: number }[]; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 40%) 1fr 32px', alignItems: 'center', gap: '10px' }} title={`${it.label}: ${it.score}`}>
          <span style={{ fontSize: '11px', color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.label}</span>
          <span style={{ height: '10px', borderRadius: '0 4px 4px 0', backgroundColor: GRID, overflow: 'hidden' }}>
            <span style={{ display: 'block', width: `${Math.max(0, Math.min(100, it.score))}%`, height: '100%', borderRadius: '0 4px 4px 0', backgroundColor: color }} />
          </span>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-main)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{it.score}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Strip satu kotak per pertemuan, bernomor, diwarnai menurut status. Pola
 * absen beruntun langsung terlihat tanpa membaca daftar.
 *
 * A strip of one numbered square per meeting, coloured by status. A run of
 * absences shows at a glance without reading a list.
 */
export function StatusStrip({ cells }: { cells: { label: string; title: string; color: string; ink: string; status: string }[] }) {
  const wrapper = React.useRef<HTMLDivElement>(null);
  const { tip, setTip } = useTip();
  return (
    <div ref={wrapper} style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
      {cells.map((c, i) => {
        const show = (e: React.SyntheticEvent<Element>) => setTip({ ...anchor(e, wrapper.current), value: c.status, label: c.title });
        return (
          <span
            key={i}
            tabIndex={0}
            aria-label={`${c.title}: ${c.status}`}
            onMouseEnter={show}
            onFocus={show}
            onMouseLeave={() => setTip(null)}
            onBlur={() => setTip(null)}
            style={{
              width: '26px', height: '26px', borderRadius: '6px', backgroundColor: c.color, color: c.ink, outline: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, cursor: 'default',
            }}
          >
            {c.label}
          </span>
        );
      })}
      {tip}
    </div>
  );
}
