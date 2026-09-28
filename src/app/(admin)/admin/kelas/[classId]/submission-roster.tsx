'use client';

import React, { useEffect, useState } from 'react';
import { Users, Clock } from 'lucide-react';

interface Roster {
  submitted: { studentId: string; studentName: string; submittedAt: string; late: boolean; score: number | null; url: string | null }[];
  pending: { studentId: string; studentName: string; email: string }[];
}

/**
 * Rekap pengumpulan sebuah working paper.
 *
 * Diambil saat kartunya dibuka, bukan bersama daftar tugas: satu pertemuan
 * dapat memuat beberapa working paper dan tiap rekap membaca seluruh peserta
 * kelas, sehingga memuat semuanya di muka berarti puluhan pembacaan untuk
 * kartu yang mungkin tidak pernah dibuka.
 *
 * A working paper's submission roster.
 *
 * Fetched when its card opens rather than alongside the task list: one meeting
 * may hold several working papers and each roster reads the whole class, so
 * loading them all up front means dozens of reads for cards that may never be
 * opened.
 */
export function SubmissionRoster({ taskId }: { taskId: string }) {
  const [roster, setRoster] = useState<Roster | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPending, setShowPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/tasks/${taskId}/roster`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) { setRoster(d); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [taskId]);

  if (loading) {
    return <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Memuat rekap pengumpulan...</div>;
  }
  if (!roster) return null;

  const total = roster.submitted.length + roster.pending.length;
  const terlambat = roster.submitted.filter((s) => s.late).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: '#7c2d12' }}>
          <Users size={11} strokeWidth={2} />
          {roster.submitted.length} dari {total} sudah mengumpulkan
        </span>
        {terlambat > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '9px', fontWeight: 600, color: 'var(--color-warning)' }}>
            <Clock size={9} strokeWidth={2} />
            {terlambat} terlambat
          </span>
        )}
      </div>

      {roster.pending.length > 0 ? (
        <>
          <button
            type="button"
            onClick={() => setShowPending((v) => !v)}
            aria-expanded={showPending}
            style={{
              alignSelf: 'flex-start', border: 'none', background: 'none', cursor: 'pointer',
              padding: 0, fontSize: '10px', fontWeight: 600, color: 'var(--color-primary)',
              textDecoration: 'underline',
            }}
          >
            {showPending ? 'Sembunyikan' : 'Lihat'} {roster.pending.length} peserta yang belum
          </button>

          {showPending && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', padding: '8px 10px', borderRadius: '8px', backgroundColor: '#ffffff' }}>
              {roster.pending.map((p) => (
                <div key={p.studentId} style={{ fontSize: '10px', color: 'var(--color-text-main)' }}>
                  {p.studentName}
                  <span style={{ color: 'var(--color-text-muted)' }}> - {p.email}</span>
                </div>
              ))}
            </div>
          )}
        </>
      ) : total > 0 ? (
        <span style={{ fontSize: '10px', color: 'var(--color-success)', fontWeight: 600 }}>
          Seluruh peserta sudah mengumpulkan.
        </span>
      ) : (
        <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
          Kelas ini belum punya peserta aktif.
        </span>
      )}
    </div>
  );
}

