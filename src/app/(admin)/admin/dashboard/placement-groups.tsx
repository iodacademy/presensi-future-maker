'use client';

import React from 'react';
import { PLACEMENT_LABELS, PLACEMENT_RULES, type Placement } from '@/features/grading/placement';
import type { RankedStudent } from '@/features/dashboard/snapshot-types';
import s from './dashboard.module.css';

const ORDER: Placement[] = ['full', 'project', 'none'];
const TONE: Record<Placement, string> = { full: s.plFull, project: s.plProject, none: s.plNone, pending: s.plPending };
const { minSpa, fullSpa, fullCapstone } = PLACEMENT_RULES;
const NOTE: Record<Placement, string> = {
  full: `SPA ≥ ${fullSpa}, capstone ≥ ${fullCapstone}, tanpa absen tanpa izin. Masih menunggu seleksi CV dan wawancara mitra.`,
  project: `SPA ${minSpa}–${fullSpa - 1}, atau SPA ≥ ${fullSpa} yang belum memenuhi syarat Full Internship.`,
  none: `SPA di bawah ${minSpa}.`,
  pending: 'Skemanya ditentukan setelah capstone dinilai.',
};

/**
 * Skema magang per jurusan dan kota. Peringkatnya disusun terpisah per lokasi,
 * seperti panel peringkat, dan nomor urut tiap peserta adalah peringkatnya di
 * lokasi itu (SPA, lalu capstone, lalu kehadiran).
 *
 * Internship scheme per programme and city. Rankings are kept separate per
 * location, as in the ranking panel, and each participant's number is their
 * rank in that location (SPA, then capstone, then attendance).
 */
export function PlacementGroups({ rows, jurusanKelas }: { rows: RankedStudent[]; jurusanKelas: Map<string, string> }) {
  // Ringkasan lama sebelum versi 13 belum memuat penempatan / Snapshots older than version 13 carry no placement yet
  const siap = rows.filter((r) => r.placement);
  if (siap.length === 0) return <div className={s.empty}>Belum ada data</div>;

  const groups = new Map<string, { jurusan: string; city: string; rows: RankedStudent[] }>();
  for (const r of siap) {
    const jurusan = jurusanKelas.get(r.className) ?? 'Lainnya';
    const key = `${jurusan}|${r.city}`;
    if (!groups.has(key)) groups.set(key, { jurusan, city: r.city, rows: [] });
    groups.get(key)!.rows.push(r);
  }
  const list = [...groups.values()].sort((a, b) => a.jurusan.localeCompare(b.jurusan, 'id') || a.city.localeCompare(b.city, 'id'));
  const total = (p: Placement) => siap.filter((r) => r.placement === p).length;

  return (
    <div className={s.plWrap}>
      <div className={s.plSum}>
        {[...ORDER, ...(total('pending') > 0 ? (['pending'] as const) : [])].map((p) => (
          <div key={p} className={`${s.plStat} ${TONE[p]}`}>
            <b className={s.num}>{total(p)}</b>
            <span>{PLACEMENT_LABELS[p]}</span>
            <small>{NOTE[p]}</small>
          </div>
        ))}
      </div>

      {list.map((g) => <GroupBox key={g.jurusan + g.city} {...g} />)}
    </div>
  );
}

function GroupBox({ jurusan, city, rows }: { jurusan: string; city: string; rows: RankedStudent[] }) {
  const menunggu = rows.filter((r) => r.placement === 'pending');
  return (
    <div className={s.rkbox}>
      <h3>
        {jurusan}
        <small>{city} · {rows.length} peserta</small>
      </h3>
      {menunggu.length === rows.length ? (
        <div className={`${s.plWait} ${s.plPending}`}>
          Capstone kelas ini belum dinilai, jadi skema magangnya belum bisa ditentukan. Nilai capstone di menu Tugas, lalu muat ulang dashboard.
        </div>
      ) : (
        <>
          <div className={s.plCols}>
            {ORDER.map((p) => {
              const anggota = rows.map((r, i) => ({ r, rank: i + 1 })).filter((x) => x.r.placement === p);
              return (
                <div key={p} className={`${s.plCol} ${TONE[p]}`}>
                  <div className={s.plHead}>
                    <span>{PLACEMENT_LABELS[p]}</span>
                    <b className={s.num}>{anggota.length}</b>
                  </div>
                  {anggota.length === 0 && <div className={s.plEmpty}>Tidak ada</div>}
                  {anggota.map(({ r, rank }) => (
                    <div key={r.studentId} className={s.plRow}>
                      <span className={s.rkn}>{rank}</span>
                      <span className={s.plName}>
                        {r.studentName}
                        {r.placementReasons.length > 0 && p !== 'none' && <small>{r.placementReasons.join(' · ')}</small>}
                      </span>
                      <span className={s.rkscore} title={`Capstone ${r.capstone} · kehadiran ${r.attendance}`}>{r.score}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
          {menunggu.length > 0 && (
            <div className={`${s.plWait} ${s.plPending}`}>
              <b>Menunggu nilai capstone ({menunggu.length}):</b> {menunggu.map((r) => r.studentName).join(', ')}
            </div>
          )}
        </>
      )}
    </div>
  );
}
