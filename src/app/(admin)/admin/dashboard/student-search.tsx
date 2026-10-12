'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import type { RosterRow } from '@/features/dashboard/snapshot-types';
import { StudentDetailModal } from '@/components/student-detail-modal';

/**
 * Pencarian peserta di dashboard. Nama dicari dari baris ringkasan yang sudah
 * termuat, sehingga mengetik tidak membaca apa pun; detailnya baru dibaca saat
 * satu peserta dipilih.
 *
 * Participant search on the dashboard. Names are matched against the snapshot
 * rows already loaded, so typing reads nothing; the detail is read only once a
 * participant is picked.
 */
export function StudentSearch({ roster }: { roster: RosterRow[] }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<RosterRow | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const needle = query.trim().toLowerCase();
  const matches = needle
    ? roster
        .filter((r) => r.studentName.toLowerCase().includes(needle) || r.className.toLowerCase().includes(needle))
        .sort((a, b) => a.studentName.localeCompare(b.studentName, 'id', { numeric: true }))
        .slice(0, 8)
    : [];

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const pick = (r: RosterRow) => {
    setPicked(r);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={boxRef} style={{ position: 'relative', width: 'min(320px, 100%)' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#ffffff', borderRadius: '999px', padding: '8px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.12)' }}>
        <Search size={15} color="var(--color-text-faint)" />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && matches[0]) pick(matches[0]);
            if (e.key === 'Escape') setOpen(false);
          }}
          placeholder="Cari peserta untuk melihat progresnya"
          aria-label="Cari peserta"
          style={{ border: 0, outline: 'none', fontSize: '12px', flex: 1, minWidth: 0, background: 'transparent', color: 'var(--color-text-main)' }}
        />
      </label>

      {open && needle && (
        <div role="listbox" style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 60, backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid var(--color-border)', boxShadow: '0 12px 30px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
          {matches.length === 0 ? (
            <p style={{ fontSize: '12px', color: 'var(--color-text-faint)', margin: 0, padding: '12px 14px' }}>Tidak ada peserta yang cocok</p>
          ) : (
            matches.map((r) => (
              <button
                key={r.studentId}
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => pick(r)}
                style={{ display: 'flex', width: '100%', gap: '10px', alignItems: 'center', textAlign: 'left', padding: '9px 14px', border: 0, borderTop: '1px solid var(--color-border)', backgroundColor: '#ffffff', cursor: 'pointer' }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-main)' }}>{r.studentName}</span>
                  <span style={{ display: 'block', fontSize: '10px', color: 'var(--color-text-faint)' }}>{r.className}</span>
                </span>
                {r.status === 'nonaktif' && (
                  <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--color-text-muted)', backgroundColor: 'var(--color-border)', padding: '2px 7px', borderRadius: '8px' }}>NONAKTIF</span>
                )}
              </button>
            ))
          )}
        </div>
      )}

      {picked && (
        <StudentDetailModal
          studentId={picked.studentId}
          name={picked.studentName}
          subtitle={`${picked.className} · ${picked.city}`}
          summary={[
            ['Pre test', scoreText(picked.pretest)],
            ['Post test', scoreText(picked.posttest)],
            ['Capstone', scoreText(picked.capstone)],
            ['Status', picked.status],
          ]}
          onClose={() => setPicked(null)}
        />
      )}
    </div>
  );
}

const scoreText = (n: number | null) => (n === null ? 'Belum' : String(n));
