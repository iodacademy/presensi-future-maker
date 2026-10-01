'use client';

import React, { useEffect, useState } from 'react';
import { Users } from 'lucide-react';

/**
 * Rekap pengerjaan sebuah ujian.
 *
 * Yang belum mengerjakan tidak berbentuk dokumen apa pun, sehingga nama-nama
 * itu hanya muncul dengan membandingkan daftar peserta kelas terhadap
 * percobaan yang ada.
 *
 * One exam's completion roster.
 *
 * Who has not taken it is no document at all, so those names only surface by
 * comparing the class roster against the attempts that exist.
 */
export function ExamRoster({ examId }: { examId: string }) {
  const [data, setData] = useState<{
    taken: { studentId: string; studentName: string; score: number; passed: boolean; attemptNumber: number }[];
    pending: { studentId: string; studentName: string; email: string }[];
  } | null>(null);
  const [showPending, setShowPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/exams/${examId}/roster`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [examId]);

  if (!data) {
    return <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Memuat rekap...</div>;
  }

  const total = data.taken.length + data.pending.length;
  const lulus = data.taken.filter((t) => t.passed).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 700, color: 'var(--color-text-main)' }}>
          <Users size={12} strokeWidth={2} />
          {data.taken.length} dari {total} sudah mengerjakan
        </span>
        {data.taken.length > 0 && (
          <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--color-success)' }}>{lulus} lulus</span>
        )}
      </div>

      {data.taken.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {data.taken.map((t) => (
            <div key={t.studentId} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t.studentName}
              </span>
              {/* Nomor percobaan ikut ditampilkan: nilai yang sama dengan KKM
                  pada percobaan kedua adalah hasil patokan remedial, bukan
                  nilai mentahnya.

                  The attempt number is shown too: a score equal to the pass
                  mark on a second attempt is the remedial ceiling, not a raw
                  score. */}
              {t.attemptNumber > 1 && (
                <span style={{ fontSize: '9px', color: 'var(--color-text-muted)' }}>percobaan {t.attemptNumber}</span>
              )}
              <span style={{ fontWeight: 700, color: t.passed ? 'var(--color-success)' : 'var(--color-danger)' }}>
                {t.score}
              </span>
            </div>
          ))}
        </div>
      )}

      {data.pending.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowPending((v) => !v)}
            aria-expanded={showPending}
            style={{ alignSelf: 'flex-start', border: 'none', background: 'none', cursor: 'pointer', padding: 0, fontSize: '11px', fontWeight: 600, color: 'var(--color-primary)', textDecoration: 'underline' }}
          >
            {showPending ? 'Sembunyikan' : 'Lihat'} {data.pending.length} peserta yang belum
          </button>
          {showPending && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '9px 11px', borderRadius: '8px', backgroundColor: 'var(--color-bg-app)' }}>
              {data.pending.map((p) => (
                <div key={p.studentId} style={{ fontSize: '11px' }}>
                  {p.studentName}
                  <span style={{ color: 'var(--color-text-muted)' }}> - {p.email}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
