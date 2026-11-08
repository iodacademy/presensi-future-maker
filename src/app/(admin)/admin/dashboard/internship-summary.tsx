'use client';

import React, { useState } from 'react';
import { PLACEMENT_LABELS, type Placement } from '@/features/grading/placement';
import type { RankedStudent } from '@/features/dashboard/snapshot-types';
import s from './dashboard.module.css';

const SEG: Placement[] = ['full', 'project', 'none', 'pending'];
const TONE: Record<Placement, string> = { full: s.plFull, project: s.plProject, none: s.plNone, pending: s.plPending };
type Jenis = 'full' | 'project' | null;

/**
 * KPI dan grafik pembanding peserta yang dapat magang (Full Internship ditambah
 * Project Based). Saringan jurusan dan jenis magang mengubah kartu dan grafik;
 * saringan daerah di kepala dashboard sudah berlaku pada baris yang masuk.
 *
 * KPIs and a comparison chart of participants who get an internship (Full
 * Internship plus Project Based). The programme and internship-type filters
 * change both the cards and the chart; the dashboard's region filter already
 * applies to the incoming rows.
 */
export function InternshipSummary({ rows, jurusanKelas }: { rows: RankedStudent[]; jurusanKelas: Map<string, string> }) {
  const [jurusan, setJurusan] = useState<string | null>(null);
  const [jenis, setJenis] = useState<Jenis>(null);

  const jurusanOf = (r: RankedStudent) => jurusanKelas.get(r.className) ?? 'Lainnya';
  // Ringkasan lama belum memuat penempatan / Older snapshots carry no placement
  const siap = rows.filter((r) => r.placement);
  const semuaJurusan = [...new Set(siap.map(jurusanOf))].sort((a, b) => a.localeCompare(b, 'id'));
  if (semuaJurusan.length === 0) return null;

  const dipilih = jurusan ? siap.filter((r) => jurusanOf(r) === jurusan) : siap;
  const magang = (p: Placement) => (jenis ? p === jenis : p === 'full' || p === 'project');
  const hitung = (xs: RankedStudent[], p: Placement) => xs.filter((r) => r.placement === p).length;
  const total = dipilih.filter((r) => magang(r.placement)).length;
  const persen = dipilih.length ? Math.round((total / dipilih.length) * 100) : 0;
  const menunggu = hitung(dipilih, 'pending');

  // Satu jurusan dipilih: pembandingnya per kota / One programme picked: compare per city
  const kelompok = jurusan
    ? [...new Set(dipilih.map((r) => r.city))].sort((a, b) => a.localeCompare(b, 'id')).map((k) => ({ label: k, rows: dipilih.filter((r) => r.city === k) }))
    : semuaJurusan.map((j) => ({ label: j, rows: siap.filter((r) => jurusanOf(r) === j) }));

  return (
    <div className={s.plWrap}>
      <div className={s.chips} role="group" aria-label="Saringan jurusan">
        <button type="button" aria-pressed={jurusan === null} onClick={() => setJurusan(null)}>Semua jurusan</button>
        {semuaJurusan.map((j) => (
          <button key={j} type="button" aria-pressed={jurusan === j} onClick={() => setJurusan(j)}>{j}</button>
        ))}
      </div>
      <div className={s.chips} role="group" aria-label="Saringan jenis magang">
        <button type="button" aria-pressed={jenis === null} onClick={() => setJenis(null)}>Semua jenis</button>
        {(['full', 'project'] as const).map((p) => (
          <button key={p} type="button" aria-pressed={jenis === p} onClick={() => setJenis(p)}>{PLACEMENT_LABELS[p]}</button>
        ))}
      </div>

      <div className={s.kpis}>
        <div className={s.kpi}>
          <p className={s.l}>Total dapat magang</p>
          <p className={s.v}>{total}</p>
          <p className={s.s}>dari {dipilih.length} peserta ({persen}%){menunggu > 0 && `, ${menunggu} menunggu capstone`}</p>
        </div>
        {(['full', 'project'] as const).filter((p) => !jenis || jenis === p).map((p) => (
          <div key={p} className={s.kpi}>
            <p className={s.l}>{PLACEMENT_LABELS[p]}</p>
            <p className={s.v}>{hitung(dipilih, p)}</p>
            <p className={s.s}>{p === 'full' ? 'SPA dan nilai TPM + capstone ≥ 70, absen ≤ 1' : 'SPA dan nilai TPM + capstone ≥ 50, absen ≤ 3'}</p>
          </div>
        ))}
      </div>

      <div>
        <p className={s.sub}>Perbandingan per {jurusan ? 'kota' : 'jurusan'}</p>
        <div className={s.bars}>
          {kelompok.map((g) => {
            const n = g.rows.length || 1;
            return (
              <div key={g.label} className={`${s.row} ${s.inRow}`} role="group" aria-label={g.label}>
                <span title={g.label}>{g.label}</span>
                <div className={s.stack}>
                  {SEG.map((p) => {
                    const c = hitung(g.rows, p);
                    // Jenis yang tidak dipilih ikut dipudarkan agar total kelompok tetap terbaca / Unpicked types are faded so the group total stays readable
                    return c > 0 && (
                      <div key={p} className={`${s.inSeg} ${TONE[p]}`} style={{ width: `${(c / n) * 100}%`, opacity: jenis && jenis !== p && (p === 'full' || p === 'project') ? 0.35 : 1 }} title={`${PLACEMENT_LABELS[p]}: ${c}`}>
                        {c}
                      </div>
                    );
                  })}
                </div>
                <span className={s.num}>{g.rows.filter((r) => magang(r.placement)).length} dari {g.rows.length}</span>
              </div>
            );
          })}
        </div>
        <div className={s.legend}>
          {SEG.map((p) => <span key={p}><span className={`${s.sw} ${s.inSeg} ${TONE[p]}`} />{PLACEMENT_LABELS[p]}</span>)}
          <span>Angka kanan: peserta yang dapat magang</span>
        </div>
      </div>
    </div>
  );
}
