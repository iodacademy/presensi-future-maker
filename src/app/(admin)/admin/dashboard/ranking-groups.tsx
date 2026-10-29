'use client';

import React, { useEffect, useState } from 'react';
import type { RankedStudent } from '@/features/dashboard/snapshot-types';
import s from './dashboard.module.css';

type RankRow = Pick<RankedStudent, 'studentId' | 'studentName' | 'className' | 'city' | 'attendance' | 'tasks' | 'componentDetails' | 'perfScore' | 'perfQuiz'>;

// Seri dipecah oleh kehadiran lalu TPM, dua komponen berbobot terbesar / Ties are broken by attendance then TPM, the two heaviest components
const byPerformance = (a: RankRow, b: RankRow) => b.perfScore - a.perfScore || b.attendance - a.attendance || b.tasks - a.tasks;

/**
 * Peringkat per jurusan dan kota: lima teratas tiap kelompok, sisanya di modal.
 *
 * Dipisah per jurusan karena peserta tiap jurusan dinilai dengan tugas dan
 * kuis yang berbeda, dan per kota karena tiap kota adalah kelas yang berjalan
 * sendiri; satu peringkat gabungan membandingkan hal yang tidak setara.
 *
 * Ranking per programme and city: the top five of each group, the rest in a
 * modal.
 *
 * Split per programme because each programme is scored on different tasks and
 * quizzes, and per city because each city is a class running on its own; one
 * combined ranking compares things that are not equivalent.
 */
export function RankingGroups({ rows, jurusanKelas }: { rows: RankRow[]; jurusanKelas: Map<string, string> }) {
  const [open, setOpen] = useState<string | null>(null);

  const groups = new Map<string, { jurusan: string; city: string; rows: RankRow[] }>();
  for (const r of [...rows].sort(byPerformance)) {
    const jurusan = jurusanKelas.get(r.className) ?? 'Lainnya';
    const key = `${jurusan}|${r.city}`;
    if (!groups.has(key)) groups.set(key, { jurusan, city: r.city, rows: [] });
    groups.get(key)!.rows.push(r);
  }
  const list = [...groups.entries()].sort(
    ([, a], [, b]) => a.jurusan.localeCompare(b.jurusan, 'id') || a.city.localeCompare(b.city, 'id')
  );
  if (list.length === 0) return <div className={s.empty}>Belum ada data</div>;
  const shown = open ? groups.get(open) : undefined;

  return (
    <>
      <div className={s.rk4}>
        {list.map(([key, g]) => (
          <div key={key} className={s.rkbox}>
            <h3>
              {g.jurusan}
              <small>{g.city} · {g.rows.length} peserta</small>
            </h3>
            <div>
              {g.rows.slice(0, 5).map((r, i) => (
                <div key={r.studentId} className={s.rkrow}>
                  <span className={`${s.rkn} ${i < 3 ? s.top : ''}`}>{i + 1}</span>
                  <span>{r.studentName}</span>
                  <span className={s.rkscore}>{r.perfScore}</span>
                </div>
              ))}
            </div>
            {g.rows.length > 5 && (
              <button type="button" className={s.linkbtn} onClick={() => setOpen(key)}>
                Lihat selengkapnya ({g.rows.length} peserta)
              </button>
            )}
          </div>
        ))}
      </div>
      {shown && <RankModal title={shown.jurusan} subtitle={shown.city} rows={shown.rows} onClose={() => setOpen(null)} />}
    </>
  );
}

/**
 * Modal seluruh peringkat satu kelompok. Ditutup dengan tombol, klik di luar,
 * atau Escape; tanpa Escape pengguna papan ketik terkurung di balik lapisan.
 *
 * A modal of one group's full ranking. Closed by its button, an outside click,
 * or Escape; without Escape keyboard users are stuck behind the overlay.
 */
function RankModal({ title, subtitle, rows, onClose }: { title: string; subtitle: string; rows: RankRow[]; onClose: () => void }) {
  const closeRef = React.useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 100, backgroundColor: 'rgba(15, 23, 42, 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rank-modal-title"
        onClick={(e) => e.stopPropagation()}
        style={{ backgroundColor: '#ffffff', borderRadius: '14px', width: 'min(720px, 100%)', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '16px 18px', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 id="rank-modal-title" style={{ fontSize: '16px', margin: 0 }}>Peringkat {title}</h2>
            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: '2px 0 0' }}>{subtitle} · {rows.length} peserta · rubrik Performance Terbaik</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            style={{ border: '1px solid var(--color-border)', background: '#ffffff', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', fontSize: '16px', lineHeight: 1, flexShrink: 0 }}
          >
            ×
          </button>
        </div>
        <div style={{ overflowY: 'auto', padding: '4px 0' }}>
          <table className={s.table} style={{ width: '100%' }}>
            <thead>
              <tr>
                <th className={s.ctr} style={{ width: '64px' }}>Peringkat</th>
                <th>Nama siswa</th>
                <th className={s.ctr}>Kehadiran <small>40%</small></th>
                <th className={s.ctr}>TPM <small>40%</small></th>
                <th className={s.ctr}>Kuis <small>20%</small></th>
                <th className={s.ctr} style={{ width: '64px' }}>Skor</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.studentId}>
                  <td className={s.ctr}><span className={`${s.rkn} ${i < 3 ? s.top : ''}`}>{i + 1}</span></td>
                  <td>{r.studentName}<div className={s.plSub}>{r.className}</div></td>
                  <td className={`${s.ctr} ${s.num}`}>{r.attendance}<div className={s.plSub}>{r.componentDetails.attendance}</div></td>
                  <td className={`${s.ctr} ${s.num}`}>{r.tasks}</td>
                  <td className={`${s.ctr} ${s.num}`}>{r.perfQuiz}</td>
                  <td className={`${s.ctr} ${s.num}`} style={{ fontWeight: 600 }}>{r.perfScore}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
