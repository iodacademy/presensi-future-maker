'use client';

import React, { useState } from 'react';
import { PLACEMENT_LABELS, PLACEMENT_RULES, type Placement } from '@/features/grading/placement';
import { GRADE_WEIGHTS, type GradeComponent } from '@/features/grading/types';
import type { RankedStudent } from '@/features/dashboard/snapshot-types';
import s from './dashboard.module.css';

const ORDER: Placement[] = ['full', 'project', 'none', 'pending'];
const TONE: Record<Placement, string> = { full: s.plFull, project: s.plProject, none: s.plNone, pending: s.plPending };
const { full, project, weights } = PLACEMENT_RULES;
const NOTE: Record<Placement, string> = {
  full: `SPA ≥ ${full.spa}, nilai TPM + capstone ≥ ${full.combined}, absen ≤ ${full.maxAbsent}× (termasuk izin dan sakit). Masih menunggu seleksi CV dan wawancara mitra.`,
  project: `SPA ${project.spa}–${full.spa - 1} atau nilai TPM + capstone ${project.combined}–${full.combined - 1}, absen ≤ ${project.maxAbsent}×; juga nilai Full dengan absen lebih dari ${full.maxAbsent}×.`,
  none: `SPA atau nilai TPM + capstone di bawah ${project.spa}, atau nilai level Project dengan absen lebih dari ${project.maxAbsent}×.`,
  pending: 'Skemanya ditentukan setelah capstone dinilai.',
};
const COLS: { key: GradeComponent; label: string }[] = [
  { key: 'capstone', label: 'Capstone' },
  { key: 'tasks', label: 'Tugas' },
  { key: 'attendance', label: 'Kehadiran' },
  { key: 'quiz', label: 'Kuis' },
];

interface Group { key: string; jurusan: string; city: string; rows: RankedStudent[] }

/**
 * Skema magang per jurusan dan kota, satu tab per kelompok. Peringkatnya
 * disusun terpisah per lokasi (SPA, lalu capstone, lalu kehadiran), dan tiap
 * baris memuat seluruh nilai komponennya supaya penempatan dapat diperiksa.
 *
 * Internship scheme per programme and city, one tab per group. Rankings are
 * kept separate per location (SPA, then capstone, then attendance), and each
 * row carries every component score so the placement can be checked.
 */
export function PlacementGroups({ rows, jurusanKelas }: { rows: RankedStudent[]; jurusanKelas: Map<string, string> }) {
  const [tab, setTab] = useState<string | null>(null);
  const [filter, setFilter] = useState<Placement | null>(null);

  // Ringkasan lama sebelum versi 14 belum memuat penempatan / Snapshots older than version 14 carry no placement yet
  const siap = rows.filter((r) => r.placement && r.componentDetails);
  const groups = new Map<string, Group>();
  for (const r of siap) {
    const jurusan = jurusanKelas.get(r.className) ?? 'Lainnya';
    const key = `${jurusan}|${r.city}`;
    if (!groups.has(key)) groups.set(key, { key, jurusan, city: r.city, rows: [] });
    groups.get(key)!.rows.push(r);
  }
  const list = [...groups.values()].sort((a, b) => a.jurusan.localeCompare(b.jurusan, 'id') || a.city.localeCompare(b.city, 'id'));
  if (list.length === 0) return <div className={s.empty}>Belum ada data</div>;

  // Tab awal: kelompok pertama yang skemanya sudah dapat ditentukan / First tab: the first group whose scheme is decided
  const awal = list.find((x) => x.rows.some((r) => r.placement !== 'pending')) ?? list[0];
  const g = (tab && groups.get(tab)) || awal;
  const count = (p: Placement) => g.rows.filter((r) => r.placement === p).length;
  const ranked = g.rows.map((r, i) => ({ r, rank: i + 1 }));
  const shown = filter ? ranked.filter((x) => x.r.placement === filter) : ranked;

  return (
    <div className={s.plWrap}>
      <div role="tablist" aria-label="Kelompok jurusan dan kota" className={s.plTabs}>
        {list.map((x) => (
          <button
            key={x.key}
            type="button"
            role="tab"
            aria-selected={x.key === g.key}
            className={s.plTab}
            onClick={() => { setTab(x.key); setFilter(null); }}
          >
            {x.jurusan}
            <small>{x.city} · {x.rows.length}</small>
          </button>
        ))}
      </div>

      <div role="tabpanel" className={s.plWrap}>
        <div className={s.plSum}>
          {ORDER.filter((p) => p !== 'pending' || count(p) > 0).map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={filter === p}
              className={`${s.plStat} ${TONE[p]}`}
              onClick={() => setFilter(filter === p ? null : p)}
            >
              <b className={s.num}>{count(p)}</b>
              <span>{PLACEMENT_LABELS[p]}</span>
              <small>{NOTE[p]}</small>
            </button>
          ))}
        </div>

        {count('pending') === g.rows.length && (
          <div className={`${s.plWait} ${s.plPending}`}>
            Capstone kelas ini belum dinilai, jadi skema magangnya belum bisa ditentukan. Nilai capstone di menu Tugas, lalu muat ulang dashboard.
          </div>
        )}

        <div className={s.plTableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th className={s.ctr}>#</th>
                <th>Nama</th>
                <th className={s.ctr}>SPA</th>
                <th className={s.ctr}>TPM + Capstone <small>{weights.tasks}/{weights.capstone}</small></th>
                {COLS.map((c) => <th key={c.key} className={s.ctr}>{c.label} <small>{GRADE_WEIGHTS[c.key]}%</small></th>)}
                <th className={s.ctr}>Absen <small>termasuk izin, sakit</small></th>
                <th>Skema</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(({ r, rank }) => (
                <tr key={r.studentId}>
                  <td className={s.ctr}><span className={s.rkn}>{rank}</span></td>
                  <td>{r.studentName}<div className={s.plSub}>{r.className}</div>{r.capstoneMissing && <div className={s.plMiss}>Tidak mengumpulkan capstone</div>}</td>
                  <td className={`${s.ctr} ${s.num}`}><b className={s.plSpa}>{r.score}</b></td>
                  <td className={`${s.ctr} ${s.num}`}><b className={s.plSpa}>{r.combined ?? '–'}</b></td>
                  {COLS.map((c) => (
                    <td key={c.key} className={`${s.ctr} ${s.num}`}>
                      {r[c.key]}
                      {/* Asal capstone hanya ditulis bila bukan dari penilaian di LMS, agar tidak berulang di tiap baris
                          The capstone source is written only when it is not the LMS grading, so it does not repeat on every row */}
                      {(c.key !== 'capstone' || r.capstone === 0 || !/tugas capstone/.test(r.componentDetails.capstone ?? '')) && (
                        <div className={s.plSub}>{r.componentDetails[c.key]}</div>
                      )}
                    </td>
                  ))}
                  <td className={`${s.ctr} ${s.num}`} style={r.absent > full.maxAbsent ? { color: 'var(--color-danger)', fontWeight: 600 } : undefined}>{r.absent ?? '–'}</td>
                  <td>
                    <span className={`${s.plBadge} ${TONE[r.placement]}`}>{PLACEMENT_LABELS[r.placement]}</span>
                    {r.placementReasons.length > 0 && <div className={s.plSub}>{r.placementReasons.join(' · ')}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
