'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { ATTENDANCE_STATUS_LABELS, type AttendanceStatus } from '@/features/attendance/types';
import type { RosterRow } from '@/features/dashboard/snapshot-types';
import s from './dashboard.module.css';

// Urutan angka ikut dihitung agar "Peserta 2" tidak jatuh di belakang "Peserta 10".
// Numbers count in the order so "Peserta 2" does not land after "Peserta 10".
const byName = (a: RosterRow, b: RosterRow) => a.studentName.localeCompare(b.studentName, 'id', { numeric: true });

const STATUS_STYLE: Record<AttendanceStatus, { bg: string; fg: string; short: string }> = {
  present: { bg: 'var(--color-success-light)', fg: '#4d6e00', short: 'H' },
  excused: { bg: 'var(--color-primary-light)', fg: 'var(--color-primary)', short: 'I' },
  sick: { bg: 'var(--color-warning-light)', fg: '#7c2d12', short: 'S' },
  absent: { bg: 'var(--color-danger-light)', fg: 'var(--color-danger)', short: 'A' },
};

function Modal({ title, subtitle, width, onClose, children }: {
  title: string;
  subtitle: string;
  width: number;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
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
        aria-labelledby="att-modal-title"
        onClick={(e) => e.stopPropagation()}
        style={{ backgroundColor: '#ffffff', borderRadius: '14px', width: `min(${width}px, 100%)`, maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '16px 18px', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 id="att-modal-title" style={{ fontSize: '16px', margin: 0 }}>{title}</h2>
            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: '2px 0 0' }}>{subtitle}</p>
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
        <div style={{ overflow: 'auto', padding: '14px 18px 18px' }}>{children}</div>
      </div>
    </div>
  );
}

/**
 * Siapa yang hadir, izin atau sakit, dan tidak hadir di satu pertemuan.
 * Angkanya dihitung dari baris peserta yang sama dengan sel heatmap-nya,
 * sehingga jumlah di pop-up selalu sama dengan angka yang diklik.
 *
 * Who was present, excused or sick, and absent at one meeting. Computed from
 * the same participant rows as the heatmap cell, so the pop-up's counts always
 * match the figure that was clicked.
 */
export function AttendanceCellModal({ title, subtitle, rows, index, onClose }: {
  title: string;
  subtitle: string;
  rows: RosterRow[];
  index: number;
  onClose: () => void;
}) {
  const groups = useMemo(() => {
    const held = rows.filter((r) => r.attendance[index] != null).sort(byName);
    return [
      { key: 'present', label: 'Hadir', style: STATUS_STYLE.present, rows: held.filter((r) => r.attendance[index] === 'present') },
      { key: 'izin', label: 'Izin / Sakit', style: STATUS_STYLE.excused, rows: held.filter((r) => r.attendance[index] === 'excused' || r.attendance[index] === 'sick') },
      { key: 'absent', label: 'Tidak hadir', style: STATUS_STYLE.absent, rows: held.filter((r) => r.attendance[index] === 'absent') },
    ];
  }, [rows, index]);

  return (
    <Modal title={title} subtitle={subtitle} width={880} onClose={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: '12px' }}>
        {groups.map((g) => (
          <div key={g.key} style={{ border: '1px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', backgroundColor: g.style.bg, color: g.style.fg, fontSize: '13px', fontWeight: 700 }}>
              <span>{g.label}</span>
              <span>{g.rows.length}</span>
            </div>
            {g.rows.length === 0 ? (
              <p style={{ fontSize: '12px', color: 'var(--color-text-faint)', margin: 0, padding: '12px' }}>Tidak ada</p>
            ) : (
              <ol style={{ listStyle: 'none', margin: 0, padding: '4px 0', maxHeight: '50vh', overflowY: 'auto' }}>
                {g.rows.map((r, i) => (
                  <li key={r.studentId} style={{ display: 'flex', gap: '8px', padding: '6px 12px', fontSize: '12px', borderTop: i === 0 ? 'none' : '1px solid var(--color-border)' }}>
                    <span className={s.num} style={{ color: 'var(--color-text-faint)', width: '20px', flexShrink: 0 }}>{i + 1}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontWeight: 600, color: 'var(--color-text-main)' }}>{r.studentName}</span>
                      {r.attendance[index] === 'sick' && (
                        <span style={{ marginLeft: '6px', fontSize: '10px', fontWeight: 700, color: STATUS_STYLE.sick.fg, backgroundColor: STATUS_STYLE.sick.bg, padding: '1px 6px', borderRadius: '8px' }}>Sakit</span>
                      )}
                      <span style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-faint)' }}>{r.className}</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}

/**
 * Rekap presensi lengkap: satu tabel per kelas, satu baris per peserta, satu
 * kolom per pertemuan.
 *
 * The full attendance recap: one table per class, one row per participant,
 * one column per meeting.
 */
export function AttendanceTableModal({ rows, sessionLabels, onClose }: {
  rows: RosterRow[];
  sessionLabels: string[];
  onClose: () => void;
}) {
  const classes = useMemo(
    () => [...new Set(rows.map((r) => r.className))].sort((a, b) => a.localeCompare(b, 'id')),
    [rows]
  );
  const [kelas, setKelas] = useState(classes[0] ?? '');
  const [query, setQuery] = useState('');

  const shown = rows
    .filter((r) => r.className === kelas && r.studentName.toLowerCase().includes(query.trim().toLowerCase()))
    .sort(byName);

  // Kolom di ujung yang belum berjalan bagi seluruh kelas disembunyikan: kelas
  // dengan enam pertemuan tidak perlu delapan kolom kosong.
  // Trailing columns not yet held for the whole class are hidden: a class with
  // six meetings needs no eight empty columns.
  const inClass = rows.filter((r) => r.className === kelas);
  let columnCount = sessionLabels.length;
  while (columnCount > 0 && inClass.every((r) => r.attendance[columnCount - 1] == null)) columnCount -= 1;
  const columns = sessionLabels.slice(0, columnCount);

  return (
    <Modal title="Detail presensi" subtitle={`Per pertemuan, per kelas, per peserta · ${rows.length} peserta aktif`} width={1180} onClose={onClose}>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px' }}>
        <div role="group" aria-label="Pilih kelas" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
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

      {columns.length === 0 ? (
        <div className={s.empty}>Belum ada pertemuan yang berjalan di kelas ini</div>
      ) : (
        <div className={s.scroll}>
          <table className={s.table} style={{ minWidth: 260 + columns.length * 44 }}>
            <thead>
              <tr>
                <th style={{ width: '36px', textAlign: 'center' }}>No</th>
                <th className={s.stick}>Nama peserta</th>
                {columns.map((label, i) => (
                  <th key={i} title={label} style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>Day {i + 1}</th>
                ))}
                <th style={{ textAlign: 'center' }}>Hadir</th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 ? (
                <tr><td colSpan={columns.length + 3} style={{ textAlign: 'center', color: 'var(--color-text-faint)' }}>Tidak ada peserta yang cocok</td></tr>
              ) : shown.map((r, i) => {
                const held = r.attendance.filter((a) => a != null).length;
                const present = r.attendance.filter((a) => a === 'present').length;
                return (
                  <tr key={r.studentId}>
                    <td className={`${s.ctr} ${s.num}`} style={{ color: 'var(--color-text-muted)' }}>{i + 1}</td>
                    <td className={s.stick} style={{ fontWeight: 600 }}>{r.studentName}</td>
                    {columns.map((label, j) => {
                      const a = r.attendance[j];
                      if (a == null) {
                        return <td key={j} className={s.ctr} style={{ color: 'var(--color-text-faint)' }} title={`${label}: belum berjalan`}>·</td>;
                      }
                      const st = STATUS_STYLE[a];
                      return (
                        <td key={j} className={s.ctr} title={`${label}: ${ATTENDANCE_STATUS_LABELS[a]}`}>
                          <span style={{ display: 'inline-block', minWidth: '22px', padding: '2px 0', borderRadius: '6px', fontSize: '11px', fontWeight: 700, backgroundColor: st.bg, color: st.fg }}>
                            {st.short}
                          </span>
                        </td>
                      );
                    })}
                    <td className={`${s.ctr} ${s.num}`} style={{ whiteSpace: 'nowrap' }}>
                      <b>{held > 0 ? Math.round((present / held) * 100) : 0}%</b>{' '}
                      <span style={{ color: 'var(--color-text-faint)' }}>{present}/{held}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className={s.legend} style={{ marginTop: '10px' }}>
        {(Object.keys(STATUS_STYLE) as AttendanceStatus[]).map((k) => (
          <span key={k}>
            <span style={{ display: 'inline-block', minWidth: '18px', textAlign: 'center', borderRadius: '5px', fontSize: '10px', fontWeight: 700, backgroundColor: STATUS_STYLE[k].bg, color: STATUS_STYLE[k].fg, marginRight: '4px' }}>{STATUS_STYLE[k].short}</span>
            {ATTENDANCE_STATUS_LABELS[k]}
          </span>
        ))}
        <span>· belum berjalan</span>
      </div>
    </Modal>
  );
}
