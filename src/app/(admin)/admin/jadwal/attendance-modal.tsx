'use client';

import React, { useEffect, useState } from 'react';
import { X, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ATTENDANCE_STATUS_LABELS, type AttendanceStatus, type SessionDocument } from '@/features/attendance/types';

interface Entry {
  studentId: string;
  studentName: string;
  status: AttendanceStatus;
  note: string | null;
  recordedAt: string | null;
  source: string | null;
}

interface AttendanceModalProps {
  sessionId: string;
  onClose: () => void;
}

const STATUS_ORDER: AttendanceStatus[] = ['present', 'excused', 'sick', 'absent'];

const STATUS_COLORS: Record<AttendanceStatus, { bg: string; fg: string }> = {
  present: { bg: 'var(--color-success-light)', fg: 'var(--color-success)' },
  excused: { bg: 'var(--color-primary-light)', fg: 'var(--color-primary)' },
  sick: { bg: 'var(--color-warning-light)', fg: '#7c2d12' },
  absent: { bg: 'var(--color-border)', fg: 'var(--color-text-muted)' },
};

/**
 * Daftar hadir sebuah pertemuan yang dapat disunting admin.
 *
 * Seluruh peserta kelas ditampilkan, termasuk yang belum punya catatan, sebab
 * yang dicari admin justru siapa yang belum tercatat.
 *
 * A meeting's attendance list, editable by an admin.
 *
 * Every participant in the class is listed, including those without a record,
 * since what an admin looks for is precisely who is still unaccounted for.
 */
export function AttendanceModal({ sessionId, onClose }: AttendanceModalProps) {
  const [session, setSession] = useState<SessionDocument | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  async function load() {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/attendance`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat daftar hadir');
      setSession(data.session);
      setEntries(data.entries || []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  async function save(studentId: string, status: AttendanceStatus, note: string | null) {
    setSavingId(studentId);
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/attendance`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, status, note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingId(null);
    }
  }

  const needle = query.trim().toLowerCase();
  const visible = entries.filter((e) => needle === '' || e.studentName.toLowerCase().includes(needle));
  const counts = STATUS_ORDER.reduce(
    (acc, s) => ({ ...acc, [s]: entries.filter((e) => e.status === s).length }),
    {} as Record<AttendanceStatus, number>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="attendance-modal-title"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 60,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#ffffff', borderRadius: '12px', width: '100%', maxWidth: '620px',
          maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{ padding: '20px 22px 14px', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
            <div>
              <h2 id="attendance-modal-title" style={{ fontFamily: 'var(--font-heading)', fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--color-text-main)' }}>
                Daftar Hadir
              </h2>
              <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: '3px 0 0' }}>
                {session?.title} · {session?.date}
              </p>
            </div>
            <button type="button" onClick={onClose} aria-label="Tutup" style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px' }}>
              <X size={16} color="var(--color-text-muted)" strokeWidth={2} />
            </button>
          </div>

          {!loading && (
            <div style={{ display: 'flex', gap: '6px', marginTop: '12px', flexWrap: 'wrap' }}>
              {STATUS_ORDER.map((s) => (
                <span
                  key={s}
                  style={{
                    fontSize: '9px', fontWeight: 700, padding: '3px 9px', borderRadius: '10px',
                    backgroundColor: STATUS_COLORS[s].bg, color: STATUS_COLORS[s].fg,
                  }}
                >
                  {ATTENDANCE_STATUS_LABELS[s]} {counts[s] ?? 0}
                </span>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '12px', padding: '7px 10px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
            <Search size={13} color="var(--color-text-muted)" strokeWidth={2} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama peserta"
              aria-label="Cari peserta"
              style={{ border: 'none', outline: 'none', fontSize: '11px', flex: 1 }}
            />
          </div>
        </div>

        {error && (
          <div role="alert" style={{ padding: '10px 22px', fontSize: '11px', color: 'var(--color-danger)' }}>
            {error}
          </div>
        )}

        <div style={{ overflowY: 'auto', padding: '8px 0' }}>
          {loading ? (
            <div style={{ padding: '32px', textAlign: 'center', fontSize: '12px', color: 'var(--color-text-muted)' }}>
              Memuat daftar hadir...
            </div>
          ) : visible.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', fontSize: '12px', color: 'var(--color-text-muted)' }}>
              {needle ? 'Tidak ada peserta yang cocok' : 'Kelas ini belum punya peserta'}
            </div>
          ) : (
            visible.map((entry) => (
              <div key={entry.studentId} style={{ padding: '10px 22px', borderBottom: '1px solid var(--color-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-main)' }}>{entry.studentName}</div>
                    <div style={{ fontSize: '9px', color: 'var(--color-text-muted)' }}>
                      {entry.recordedAt
                        ? `${entry.recordedAt.slice(11, 16)} WIB · ${entry.source === 'manual' ? 'dicatat admin' : 'scan QR'}`
                        : 'belum tercatat'}
                      {entry.note ? ` · ${entry.note}` : ''}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {STATUS_ORDER.map((s) => {
                      const active = entry.status === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => {
                            // Izin dan sakit kerap perlu alasan; keduanya membuka
                            // kolom keterangan alih-alih langsung tersimpan.
                            //
                            // Excused and sick usually need a reason; both open
                            // the note field rather than saving straight away.
                            if ((s === 'excused' || s === 'sick') && !active) {
                              setNoteFor(entry.studentId);
                              setNoteText(entry.note ?? '');
                              return;
                            }
                            save(entry.studentId, s, entry.note);
                          }}
                          disabled={savingId === entry.studentId}
                          style={{
                            fontSize: '9px', fontWeight: 700, padding: '5px 9px', borderRadius: '6px',
                            cursor: savingId === entry.studentId ? 'wait' : 'pointer',
                            border: active ? `1px solid ${STATUS_COLORS[s].fg}` : '1px solid var(--color-border)',
                            backgroundColor: active ? STATUS_COLORS[s].bg : '#ffffff',
                            color: active ? STATUS_COLORS[s].fg : 'var(--color-text-muted)',
                          }}
                        >
                          {ATTENDANCE_STATUS_LABELS[s]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {noteFor === entry.studentId && (
                  <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                    <input
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Keterangan, misalnya surat dokter"
                      aria-label={`Keterangan untuk ${entry.studentName}`}
                      autoFocus
                      style={{ flex: 1, padding: '7px 10px', borderRadius: '6px', border: '1px solid var(--color-border)', fontSize: '11px' }}
                    />
                    {(['excused', 'sick'] as const).map((s) => (
                      <Button
                        key={s}
                        variant="secondary"
                        onClick={async () => {
                          setNoteFor(null);
                          await save(entry.studentId, s, noteText);
                        }}
                        style={{ fontSize: '10px', padding: '6px 10px' }}
                      >
                        {ATTENDANCE_STATUS_LABELS[s]}
                      </Button>
                    ))}
                    <Button variant="secondary" onClick={() => setNoteFor(null)} style={{ fontSize: '10px', padding: '6px 10px' }}>
                      Batal
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
