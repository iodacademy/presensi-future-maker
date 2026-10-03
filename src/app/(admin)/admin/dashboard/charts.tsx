'use client';

import React from 'react';
import s from './dashboard.module.css';

/**
 * Grafik dashboard, mengikuti rancangan "Dashboard FutureMakers update".
 *
 * Digambar sebagai SVG sendiri, bukan memakai pustaka grafik: keempatnya
 * sederhana, dan satu pustaka grafik berukuran lebih besar daripada seluruh
 * halaman ini.
 *
 * The dashboard's charts, following the "Dashboard FutureMakers update" design.
 *
 * Drawn as hand-written SVG rather than with a charting library: all four are
 * simple, and one charting library weighs more than this whole page.
 */

/** Warna tiap daerah, dipakai konsisten di seluruh grafik / Each region's colour, used consistently across every chart */
export const CITY_COLORS = ['var(--color-info)', 'var(--color-success)', 'var(--color-highlight-yellow)', 'var(--color-text-main)'];

export function cityColor(cities: string[], city: string): string {
  const i = cities.indexOf(city);
  return CITY_COLORS[(i < 0 ? 0 : i) % CITY_COLORS.length];
}

const W = 560;
const H = 250;
const L = 34;
const RP = 10;
const T = 16;
const B = 28;

function axes(lo: number, hi: number, step: number, y: (v: number) => number) {
  const out: React.ReactNode[] = [];
  for (let v = lo; v <= hi; v += step) {
    out.push(
      <g key={v}>
        <line x1={L} x2={W - RP} y1={y(v)} y2={y(v)} style={{ stroke: 'var(--color-border)' }} strokeWidth={1} />
        <text x={L - 6} y={y(v) + 4} textAnchor="end" fontSize={11} style={{ fill: 'var(--color-text-faint)' }}>
          {v}
        </text>
      </g>
    );
  }
  return out;
}

function refLine(v: number, y: (v: number) => number, txt: string) {
  return (
    <>
      <line x1={L} x2={W - RP} y1={y(v)} y2={y(v)} style={{ stroke: 'var(--color-danger)' }} strokeWidth={1.4} strokeDasharray="5 4" />
      <text x={W - RP} y={y(v) - 6} textAnchor="end" fontSize={11} style={{ fill: 'var(--color-danger)' }}>
        {txt}
      </text>
    </>
  );
}

/**
 * Peta panas: baris per daerah, kolom per pertemuan atau tugas.
 *
 * Baris "Semua" dihitung dari jumlah mentahnya, bukan dari rata-rata
 * persentase tiap daerah: daerah berisi enam belas peserta dan daerah berisi
 * dua puluh delapan tidak boleh berbobot sama.
 *
 * A heatmap: one row per region, one column per meeting or task.
 *
 * The "Semua" row is computed from the raw counts rather than by averaging each
 * region's percentage: a region of sixteen and one of twenty-eight must not carry
 * equal weight.
 */
export function Heatmap({
  cities,
  columnLabel,
  columns,
  valueFor,
  minWidth,
}: {
  cities: string[];
  columnLabel: string;
  columns: string[];
  /** Terhitung dan totalnya, atau null bila belum berjalan / The count and its total, or null when not yet started */
  valueFor: (city: string, index: number) => { hit: number; total: number } | null;
  /** Lebar terkecilnya; bila kosong, dihitung dari jumlah kolomnya / Its minimum width; when absent, derived from the column count */
  minWidth?: number;
}) {
  if (columns.length === 0) {
    return <div className={s.empty}>Belum ada data</div>;
  }

  const kelas = (p: number) => (p >= 85 ? s.ok : p >= 70 ? s.wr : s.bd);
  const baris = cities.length > 1 ? [...cities, 'Semua'] : cities;

  // Lebar terkecilnya tumbuh seiring jumlah kolomnya. Lebar tetap membuat lima
  // puluh kolom diperas menjadi sebelas piksel masing-masing, dan "100%"
  // bertindihan dengan "21/25" di bawahnya sampai keduanya tidak terbaca --
  // lebih baik digulir daripada tidak terbaca.
  //
  // The minimum width grows with the column count. A fixed width squeezes fifty
  // columns into eleven pixels each, and "100%" overlaps the "21/25" beneath it
  // until neither can be read -- better scrolled than unreadable.
  const lebar = minWidth ?? 90 + columns.length * 52;

  return (
    <div className={s.scroll}>
      <div
        className={s.hm}
        style={{ gridTemplateColumns: `90px repeat(${columns.length}, minmax(0, 1fr))`, minWidth: lebar }}
      >
        <div />
        {columns.map((c, i) => (
          <div key={i} className={s.h} title={c}>
            {columnLabel} {i + 1}
          </div>
        ))}

        {baris.map((kota) => (
          <React.Fragment key={kota}>
            <div className={s.lb} style={kota === 'Semua' ? { fontWeight: 600 } : undefined}>
              {kota}
            </div>
            {columns.map((_, i) => {
              const v =
                kota === 'Semua'
                  ? cities.reduce<{ hit: number; total: number } | null>((akum, k) => {
                      const satu = valueFor(k, i);
                      if (!satu) return akum;
                      return { hit: (akum?.hit ?? 0) + satu.hit, total: (akum?.total ?? 0) + satu.total };
                    }, null)
                  : valueFor(kota, i);

              if (!v || v.total === 0) {
                return (
                  <div key={i} className={`${s.c} ${s.na}`} title={`${columns[i]}: belum berjalan`}>
                    ·<small>&nbsp;</small>
                  </div>
                );
              }
              const p = Math.round((v.hit / v.total) * 100);
              return (
                <div key={i} className={`${s.c} ${kelas(p)}`} title={`${kota}, ${columns[i]}: ${v.hit} dari ${v.total}`}>
                  {p}%
                  <small>
                    {v.hit}/{v.total}
                  </small>
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

/** Batang berkelompok: satu kelompok per tugas, satu batang per daerah / Grouped bars: one group per task, one bar per region */
export function GroupedBars({
  cities,
  columns,
  valueFor,
  columnLabel,
  reference,
}: {
  cities: string[];
  columns: string[];
  valueFor: (city: string, index: number) => number | null;
  columnLabel: string;
  reference?: { value: number; label: string };
}) {
  if (columns.length === 0) return <div className={s.empty}>Belum ada data</div>;

  const y = (v: number) => T + ((100 - v) / 100) * (H - T - B);
  const gw = (W - L - RP) / columns.length;
  const bw = Math.min((gw * 0.8) / cities.length, 40);
  const gx0 = (gw - bw * cities.length) / 2;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Rata-rata per ${columnLabel} per daerah`}>
      {axes(0, 100, 25, y)}
      {columns.map((kol, i) => {
        const gx = L + i * gw + gx0;
        const adaIsi = cities.some((k) => valueFor(k, i) !== null);
        return (
          <React.Fragment key={i}>
            <text x={L + i * gw + gw / 2} y={H - 8} textAnchor="middle" fontSize={11} style={{ fill: 'var(--color-text-muted)' }}>
              {columnLabel} {i + 1}
            </text>
            {cities.map((k, j) => {
              const v = valueFor(k, i);
              if (v === null) return null;
              const bx = gx + j * bw;
              return (
                <React.Fragment key={k}>
                  <rect x={bx + 1} y={y(v)} width={bw - 2} height={y(0) - y(v)} rx={2} style={{ fill: cityColor(cities, k) }}>
                    <title>{`${k}, ${kol}: ${v}`}</title>
                  </rect>
                  <text x={bx + bw / 2} y={y(v) - 4} textAnchor="middle" fontSize={9} style={{ fill: 'var(--color-text-muted)' }}>
                    {v}
                  </text>
                </React.Fragment>
              );
            })}
            {/* Kolom tanpa nilai ditandai "belum", bukan dibiarkan kosong: ruang
                kosong terbaca sebagai nilai nol.

                A column with no values is marked "belum" rather than left blank:
                empty space reads as a score of zero. */}
            {!adaIsi && (
              <text x={L + i * gw + gw / 2} y={y(45)} textAnchor="middle" fontSize={11} style={{ fill: 'var(--color-text-faint)' }}>
                belum
              </text>
            )}
          </React.Fragment>
        );
      })}
      {reference && refLine(reference.value, y, reference.label)}
    </svg>
  );
}

/** Garis tren: satu garis per daerah / A trend line: one line per region */
export function TrendLines({
  cities,
  columns,
  valueFor,
  reference,
}: {
  cities: string[];
  columns: string[];
  valueFor: (city: string, index: number) => number | null;
  reference?: { value: number; label: string };
}) {
  if (columns.length === 0) return <div className={s.empty}>Belum ada data</div>;

  const lo = 50;
  const hi = 100;
  const n = Math.max(columns.length, 2);
  const x = (i: number) => L + 8 + (i * (W - L - RP - 16)) / (n - 1);
  const y = (v: number) => T + ((hi - Math.max(lo, Math.min(hi, v))) / (hi - lo)) * (H - T - B);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Tren nilai kuis per sesi per daerah">
      {axes(lo, hi, 10, y)}
      {columns.map((kol, i) => (
        <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize={11} style={{ fill: 'var(--color-text-muted)' }}>
          S{i + 1}
        </text>
      ))}
      {reference && refLine(reference.value, y, reference.label)}
      {cities.map((k) => {
        // Hanya titik yang ada nilainya digambar; menyambung lurus melewati
        // kuis yang belum dikerjakan akan memperlihatkan tren yang tidak pernah
        // terukur.
        //
        // Only points with values are drawn; joining straight through an
        // unattempted quiz would show a trend that was never measured.
        const titik = columns
          .map((_, i) => ({ i, v: valueFor(k, i) }))
          .filter((p): p is { i: number; v: number } => p.v !== null);
        if (titik.length === 0) return null;
        return (
          <React.Fragment key={k}>
            {titik.length > 1 && (
              <polyline
                fill="none"
                style={{ stroke: cityColor(cities, k) }}
                strokeWidth={2.2}
                strokeLinejoin="round"
                points={titik.map((p) => `${x(p.i)},${y(p.v)}`).join(' ')}
              />
            )}
            {titik.map((p, idx) => (
              <circle key={p.i} cx={x(p.i)} cy={y(p.v)} r={idx === titik.length - 1 ? 4.5 : 3} style={{ fill: cityColor(cities, k) }}>
                <title>{`${k}, ${columns[p.i]}: ${p.v}`}</title>
              </circle>
            ))}
          </React.Fragment>
        );
      })}
    </svg>
  );
}

/** Pretest dan postest berpasangan, beserta kenaikannya / Paired pretest and posttest, with the gain */
export function GainChart({ rows }: { rows: { className: string; pretest: number | null; posttest: number | null }[] }) {
  const terisi = rows.filter((r) => r.pretest !== null || r.posttest !== null);
  if (terisi.length === 0) return <div className={s.empty}>Pretest dan postest belum dikerjakan</div>;

  const Hh = 270;
  const Tt = 40;
  const y = (v: number) => Tt + ((100 - v) / 100) * (Hh - Tt - B);
  const gw = (W - L - RP) / terisi.length;
  const bw = Math.min(40, gw * 0.28);

  return (
    <svg viewBox={`0 0 ${W} ${Hh}`} width="100%" role="img" aria-label="Rata-rata pretest dan postest per daerah">
      {[0, 25, 50, 75, 100].map((v) => (
        <g key={v}>
          <line x1={L} x2={W - RP} y1={y(v)} y2={y(v)} style={{ stroke: 'var(--color-border)' }} />
          <text x={L - 6} y={y(v) + 4} textAnchor="end" fontSize={11} style={{ fill: 'var(--color-text-faint)' }}>
            {v}
          </text>
        </g>
      ))}
      {terisi.map((r, i) => {
        const cx = L + i * gw + gw / 2;
        const x1 = cx - bw - 3;
        const x2 = cx + 3;
        return (
          <React.Fragment key={r.className}>
            {r.pretest !== null && (
              <>
                <rect x={x1} y={y(r.pretest)} width={bw} height={y(0) - y(r.pretest)} rx={3} style={{ fill: '#bfd6ec' }} />
                <text x={x1 + bw / 2} y={y(r.pretest) + 15} textAnchor="middle" fontSize={11} style={{ fill: 'var(--color-text-main)' }}>
                  {r.pretest}
                </text>
              </>
            )}
            {r.posttest !== null && (
              <>
                <rect x={x2} y={y(r.posttest)} width={bw} height={y(0) - y(r.posttest)} rx={3} style={{ fill: 'var(--color-primary)' }} />
                <text x={x2 + bw / 2} y={y(r.posttest) + 15} textAnchor="middle" fontSize={11} style={{ fill: '#ffffff' }}>
                  {r.posttest}
                </text>
              </>
            )}
            {/* Kenaikannya hanya ditampilkan bila keduanya ada: selisih dari
                satu angka bukan kenaikan apa pun.

                The gain shows only when both exist: a difference from one number
                is not a gain at all. */}
            {r.pretest !== null && r.posttest !== null && (
              <>
                <rect x={cx - 26} y={y(r.posttest) - 26} width={52} height={20} rx={6} style={{ fill: 'var(--color-success-light)' }} />
                <text x={cx} y={y(r.posttest) - 12} textAnchor="middle" fontSize={12} fontWeight={600} style={{ fill: '#4d6e00' }}>
                  ↑ {r.posttest - r.pretest >= 0 ? '+' : ''}
                  {r.posttest - r.pretest}
                </text>
              </>
            )}
            <text x={cx} y={Hh - 8} textAnchor="middle" fontSize={12} style={{ fill: 'var(--color-text-muted)' }}>
              {r.className}
            </text>
          </React.Fragment>
        );
      })}
    </svg>
  );
}

/** Batang harian: berapa peserta membuka aplikasi tiap hari / Daily bars: how many participants opened the app each day */
export function DailyBars({ points, total }: { points: { date: string; value: number }[]; total: number }) {
  if (points.length === 0 || total === 0) {
    return <div className={s.empty}>Belum ada aktivitas yang tercatat</div>;
  }

  const Wd = 1000;
  const Hd = 240;
  const Ld = 40;
  const Rd = 10;
  const Td = 16;
  const Bd = 34;
  const y = (v: number) => Td + (1 - v / total) * (Hd - Td - Bd);
  const gw = (Wd - Ld - Rd) / points.length;
  const bw = gw * 0.62;

  return (
    <div className={s.scroll}>
      <div style={{ minWidth: Math.max(640, points.length * 34) }}>
        <svg viewBox={`0 0 ${Wd} ${Hd}`} width="100%" role="img" aria-label="Jumlah peserta yang membuka aplikasi per hari">
          {[0, 0.25, 0.5, 0.75, 1].map((p) => {
            const v = Math.round(total * p);
            return (
              <g key={p}>
                <line x1={Ld} x2={Wd - Rd} y1={y(v)} y2={y(v)} style={{ stroke: 'var(--color-border)' }} />
                <text x={Ld - 6} y={y(v) + 4} textAnchor="end" fontSize={11} style={{ fill: 'var(--color-text-faint)' }}>
                  {v}
                </text>
              </g>
            );
          })}
          {points.map((p, i) => {
            const x = Ld + i * gw + (gw - bw) / 2;
            return (
              <React.Fragment key={p.date}>
                <rect x={x} y={y(p.value)} width={bw} height={y(0) - y(p.value)} rx={3} style={{ fill: 'var(--color-primary)' }}>
                  <title>{`${p.date}: ${p.value} dari ${total} peserta`}</title>
                </rect>
                <text x={x + bw / 2} y={y(p.value) - 5} textAnchor="middle" fontSize={10} style={{ fill: 'var(--color-text-muted)' }}>
                  {p.value}
                </text>
                <text x={x + bw / 2} y={Hd - 16} textAnchor="middle" fontSize={11} style={{ fill: 'var(--color-text-muted)' }}>
                  {Number(p.date.slice(8, 10))}
                </text>
              </React.Fragment>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

/** Batang mendatar untuk sebaran profil / Horizontal bars for a profile distribution */
export function ProfileBars({
  rows,
  total,
  color,
}: {
  rows: { label: string; count: number }[];
  total: number;
  color: string;
}) {
  if (rows.length === 0 || total === 0) return <div className={s.empty}>Belum ada data</div>;
  const max = Math.max(...rows.map((r) => r.count));

  return (
    <div className={s.hbar}>
      {rows.map((r) => (
        <div key={r.label} className={s.row}>
          <span>{r.label}</span>
          <div className={s.track}>
            <div className={s.b} style={{ width: `calc((100% - 56px) * ${r.count / max})`, background: color }}>
              {r.count} orang
            </div>
            <div className={s.val}>
              <b>{Math.round((r.count / total) * 100)}%</b>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
