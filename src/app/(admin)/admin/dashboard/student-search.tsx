'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, MessageSquareText, CalendarClock, UserRound, StickyNote } from 'lucide-react';
import type { RosterRow } from '@/features/dashboard/snapshot-types';
import type { StudentDetail } from '@/features/dashboard/types';
import { HomePerformance } from '@/app/(student)/app/home-performance';
import { formatDateTimeWib, formatLongDateWib } from '@/lib/time';

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

      {/* Dipasang ke body: kotak pencarian berada di header berteks putih, dan modal di dalamnya akan mewarisi warna itu.
          Mounted on body: the search box sits in a white-text header, and a modal inside it would inherit that colour. */}
      {picked && createPortal(<StudentDetailModal row={picked} onClose={() => setPicked(null)} />, document.body)}
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: typeof UserRound; title: string; children: React.ReactNode }) {
  return (
    <section style={{ backgroundColor: '#ffffff', borderRadius: '14px', border: '1px solid var(--color-border)', padding: '16px 18px', minWidth: 0 }}>
      <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', margin: '0 0 12px' }}>
        <Icon size={16} color="var(--color-primary)" /> {title}
      </h3>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: '10px', color: 'var(--color-text-faint)' }}>{label}</div>
      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-main)' }}>{value}</div>
    </div>
  );
}

function StudentDetailModal({ row, onClose }: { row: RosterRow; onClose: () => void }) {
  const [detail, setDetail] = useState<StudentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    fetch(`/api/dashboard/student/${row.studentId}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal memuat detail peserta');
        setDetail(data);
      })
      .catch((e) => setError((e as Error).message));
  }, [row.studentId]);

  const scoreText = (n: number | null) => (n === null ? 'Belum' : String(n));

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 100, backgroundColor: 'rgba(15, 23, 42, 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="student-detail-title"
        onClick={(e) => e.stopPropagation()}
        style={{ backgroundColor: 'var(--color-bg-app)', borderRadius: '16px', width: 'min(1100px, 100%)', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 50px rgba(0,0,0,0.25)', overflow: 'hidden' }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '16px 18px', backgroundColor: '#ffffff', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 id="student-detail-title" style={{ fontSize: '17px', margin: 0 }}>{row.studentName}</h2>
            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
              {row.className} · {row.city}{detail?.student.email ? ` · ${detail.student.email}` : ''}
            </p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Tutup" style={{ border: '1px solid var(--color-border)', background: '#ffffff', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ overflowY: 'auto', padding: '16px 18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Nilai dari baris dashboard tampil seketika, sebelum detailnya selesai dimuat. Kehadiran
              dan mentoring tidak diulang di sini: grafiknya di bawah sudah menyebutnya.
              Scores from the dashboard row show at once, before the detail finishes loading.
              Attendance and mentoring are not repeated here: the charts below already state them. */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(130px, 100%), 1fr))', gap: '10px' }}>
            {[
              ['Pre test', scoreText(row.pretest)],
              ['Post test', scoreText(row.posttest)],
              ['Capstone', scoreText(row.capstone)],
              ['Status', row.status],
            ].map(([label, value]) => (
              <div key={label} style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid var(--color-border)', padding: '10px 12px' }}>
                <div style={{ fontSize: '10px', color: 'var(--color-text-faint)' }}>{label}</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-main)', textTransform: label === 'Status' ? 'capitalize' : undefined }}>{value}</div>
              </div>
            ))}
          </div>

          {error ? (
            <div role="alert" style={{ padding: '12px', borderRadius: '10px', backgroundColor: 'var(--color-danger-light)', color: 'var(--color-danger)', fontSize: '12px' }}>{error}</div>
          ) : !detail ? (
            <div style={{ padding: '30px', textAlign: 'center', fontSize: '12px', color: 'var(--color-text-muted)' }}>Memuat progres belajar...</div>
          ) : (
            <>
              <HomePerformance performance={detail.performance} progress={{ attendanceRatio: '', dailyTasksRatio: '', mentoringRatio: `${Math.min(2, detail.mentoring.used)}/2` }} links={false} />

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: '14px' }}>
                <Section icon={CalendarClock} title={`Mentoring (${detail.mentoring.bookings.filter((b) => b.status === 'confirmed').length} terjadwal)`}>
                  {detail.mentoring.bookings.length === 0 ? (
                    <p style={{ fontSize: '12px', color: 'var(--color-text-faint)', margin: 0 }}>Belum pernah membooking mentoring</p>
                  ) : (
                    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {detail.mentoring.bookings.map((b) => (
                        <li key={b.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '12px', opacity: b.status === 'cancelled' ? 0.55 : 1 }}>
                          <span>
                            <b>{b.mentorName}</b>
                            <span style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-muted)' }}>{formatLongDateWib(b.date)} · {b.startTime} - {b.endTime} WIB</span>
                          </span>
                          {b.status === 'cancelled' && <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)' }}>DIBATALKAN</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>

                <Section icon={UserRound} title="Profil">
                  {detail.profile ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
                      <Field label="Usia" value={detail.profile.age === null ? '-' : `${detail.profile.age} tahun`} />
                      <Field label="Jenis kelamin" value={detail.profile.gender} />
                      <Field label="Status saat mendaftar" value={detail.profile.entryStatus} />
                      <Field label="Disabilitas" value={detail.profile.disability} />
                      <Field label="WhatsApp" value={detail.profile.phone} />
                      <Field label="Jurusan" value={detail.student.programName || '-'} />
                    </div>
                  ) : (
                    <p style={{ fontSize: '12px', color: 'var(--color-text-faint)', margin: 0 }}>Peserta belum mengisi profil</p>
                  )}
                </Section>
              </div>

              {detail.note && (
                <Section icon={StickyNote} title="Catatan admin">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: '10px' }}>
                    <Field label="Catatan" value={detail.note.note || '-'} />
                    <Field label="Tindak lanjut" value={detail.note.followUp || '-'} />
                  </div>
                </Section>
              )}

              <Section icon={MessageSquareText} title={`Feedback (${detail.feedback.length} formulir diisi)`}>
                {detail.feedback.length === 0 ? (
                  <p style={{ fontSize: '12px', color: 'var(--color-text-faint)', margin: 0 }}>Belum mengisi feedback</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {detail.feedback.map((f, i) => (
                      <details key={f.id} open={i === 0} style={{ border: '1px solid var(--color-border)', borderRadius: '10px', padding: '10px 12px' }}>
                        <summary style={{ cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-main)' }}>
                          {f.sessionTitle} <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>· {f.formTitle} · diisi {formatDateTimeWib(f.submittedAt)} WIB</span>
                        </summary>
                        <dl style={{ margin: '10px 0 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {f.answers.map((a, j) => (
                            <div key={j}>
                              <dt style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{a.questionText}</dt>
                              <dd style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--color-text-main)', whiteSpace: 'pre-wrap' }}>{a.value || '-'}</dd>
                            </div>
                          ))}
                        </dl>
                      </details>
                    ))}
                  </div>
                )}
              </Section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
