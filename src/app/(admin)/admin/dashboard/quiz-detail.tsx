'use client';

import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { RosterRow } from '@/features/dashboard/snapshot-types';
import { Modal } from './attendance-detail';
import s from './dashboard.module.css';

const KKM = 70;

const byName = (a: RosterRow, b: RosterRow) => a.studentName.localeCompare(b.studentName, 'id', { numeric: true });

function ScoreCell({ value, title }: { value: number | null; title: string }) {
  if (value === null) {
    return <td className={s.ctr} title={`${title}: belum dikerjakan`} style={{ color: 'var(--color-text-faint)', fontSize: '11px' }}>Belum</td>;
  }
  const lulus = value >= KKM;
  return (
    <td className={s.ctr} title={`${title}: ${value}`}>
      <span style={{ display: 'inline-block', minWidth: '30px', padding: '2px 6px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, backgroundColor: lulus ? 'var(--color-success-light)' : 'var(--color-danger-light)', color: lulus ? '#3f6212' : 'var(--color-danger)' }}>
        {value}
      </span>
    </td>
  );
}

/**
 * Siapa saja yang sudah mengerjakan pretest, kuis tiap sesi, dan postest,
 * beserta nilainya, per kelas (jurusan dan daerah). Diambil dari baris
 * ringkasan yang sudah termuat, sehingga membukanya tidak membaca apa pun.
 *
 * Who has done the pretest, each session quiz and the posttest, with their
 * scores, per class (programme and region). Taken from the snapshot rows
 * already loaded, so opening it reads nothing.
 */
export function QuizDetailModal({ rows, quizLabels, quizTitlesByClass, onClose }: {
  rows: RosterRow[];
  quizLabels: string[];
  quizTitlesByClass?: Record<string, string[]>;
  onClose: () => void;
}) {
  const classes = useMemo(
    () => [...new Set(rows.map((r) => r.className))].sort((a, b) => a.localeCompare(b, 'id')),
    [rows]
  );
  const [kelas, setKelas] = useState(classes[0] ?? '');
  const [query, setQuery] = useState('');

  const inClass = rows.filter((r) => r.className === kelas);
  // Kolom kuis kelas ini saja: kelas lain bisa punya kuis lebih banyak, dan
  // kolom sisanya tidak pernah dapat dikerjakan peserta kelas ini.
  // Only this class's quiz columns: another class may have more quizzes, and
  // the leftover columns could never be done by this class's participants.
  const titles = quizTitlesByClass?.[kelas] ?? quizLabels.slice(0, Math.max(0, ...inClass.map((r) => r.quizScores.length)));
  const columns: { key: string; title: string; score: (r: RosterRow) => number | null }[] = [
    { key: 'pre', title: 'Pretest', score: (r) => r.pretest },
    ...titles.map((t, i) => ({ key: `k${i}`, title: t, score: (r: RosterRow) => r.quizScores[i] ?? null })),
    { key: 'post', title: 'Postest', score: (r) => r.posttest },
  ];

  const needle = query.trim().toLowerCase();
  const shown = inClass.filter((r) => r.studentName.toLowerCase().includes(needle)).sort(byName);

  const ringkasan = columns.map((c) => {
    const nilai = inClass.map(c.score).filter((v): v is number => v !== null);
    return {
      done: nilai.length,
      avg: nilai.length > 0 ? Math.round(nilai.reduce((a, b) => a + b, 0) / nilai.length) : null,
      lulus: nilai.filter((v) => v >= KKM).length,
    };
  });

  return (
    <Modal title="Detail kuis" subtitle={`Pretest, kuis tiap sesi, dan postest per jurusan · ${rows.length} peserta aktif`} width={1180} onClose={onClose}>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px' }}>
        <div role="group" aria-label="Pilih jurusan" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {classes.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={kelas === c}
              onClick={() => setKelas(c)}
              style={{
                padding: '6px 14px', borderRadius: '999px', border: 'none', cursor: 'pointer', fontSize: '12px',
                fontWeight: kelas === c ? 700 : 500,
                backgroundColor: kelas === c ? 'var(--color-primary)' : 'var(--color-border)',
                color: kelas === c ? '#ffffff' : 'var(--color-text-main)',
              }}
            >
              {c}
            </button>
          ))}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '6px 10px', marginLeft: 'auto', minWidth: 'min(240px, 100%)' }}>
          <Search size={14} color="var(--color-text-faint)" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama peserta"
            aria-label="Cari nama peserta"
            style={{ border: 0, outline: 'none', fontSize: '12px', flex: 1, minWidth: 0, background: 'transparent' }}
          />
        </label>
      </div>

      <div className={s.scroll}>
        <table className={s.table} style={{ minWidth: 300 + columns.length * 90 }}>
          <thead>
            <tr>
              <th style={{ width: '36px', textAlign: 'center' }}>No</th>
              <th className={s.stick}>Nama peserta</th>
              {columns.map((c) => (
                <th key={c.key} title={c.title} style={{ textAlign: 'center', maxWidth: '140px', whiteSpace: 'normal', lineHeight: 1.3 }}>{c.title}</th>
              ))}
            </tr>
            {/* Ringkasan tiap kuis di atas daftar: yang dicari pertama adalah
                berapa yang sudah mengerjakan, baru kemudian siapa.
                Each quiz's summary above the list: the first question is how
                many have done it, only then who. */}
            <tr>
              <th />
              <th className={s.stick} style={{ fontWeight: 400, fontSize: '11px' }}>Mengerjakan · rata-rata</th>
              {ringkasan.map((r, i) => (
                <th key={columns[i].key} style={{ textAlign: 'center', fontWeight: 400, fontSize: '11px', whiteSpace: 'nowrap' }}>
                  <b style={{ color: 'var(--color-text-main)' }}>{r.done}/{inClass.length}</b>
                  {r.avg !== null && <> · {r.avg}</>}
                  {r.done > 0 && <div style={{ fontSize: '10px', color: 'var(--color-text-faint)' }}>{r.lulus} lulus KKM</div>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr><td colSpan={columns.length + 2} style={{ textAlign: 'center', color: 'var(--color-text-faint)' }}>Tidak ada peserta yang cocok</td></tr>
            ) : shown.map((r, i) => (
              <tr key={r.studentId}>
                <td className={`${s.ctr} ${s.num}`} style={{ color: 'var(--color-text-muted)' }}>{i + 1}</td>
                <td className={s.stick} style={{ fontWeight: 600 }}>{r.studentName}</td>
                {columns.map((c) => <ScoreCell key={c.key} value={c.score(r)} title={c.title} />)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={s.legend} style={{ marginTop: '10px' }}>
        <span><span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '3px', backgroundColor: 'var(--color-success-light)', border: '1px solid #3f6212', marginRight: '4px' }} />Lulus KKM {KKM}</span>
        <span><span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '3px', backgroundColor: 'var(--color-danger-light)', border: '1px solid var(--color-danger)', marginRight: '4px' }} />Di bawah KKM</span>
        <span>Belum: belum mengerjakan</span>
        <span>Nilai yang tampil adalah nilai tertinggi dari seluruh percobaan</span>
      </div>
    </Modal>
  );
}
