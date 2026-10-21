'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, MessageSquareText, CalendarClock, UserRound, StickyNote, ClipboardList, ExternalLink, PlayCircle } from 'lucide-react';
import { TASK_KIND_LABELS } from '@/features/tasks/types';
import type { StudentDetail } from '@/features/dashboard/types';
import { HomePerformance } from '@/app/(student)/app/home-performance';
import { formatDateTimeWib, formatLongDateWib } from '@/lib/time';

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

/**
 * Detail progres belajar satu peserta, dipakai admin di dashboard dan mentor di
 * halaman bimbingannya. Server yang memutuskan isinya: catatan admin dan
 * feedback tidak dikirim kepada mentor, sehingga bagiannya tidak tampil.
 *
 * One participant's learning progress detail, used by admins on the dashboard
 * and by mentors on their guidance pages. The server decides the contents: admin
 * notes and feedback are not sent to mentors, so those sections do not show.
 */
export function StudentDetailModal({ studentId, name, subtitle, summary, onClose }: {
  studentId: string;
  name: string;
  subtitle?: string;
  /** Angka yang sudah diketahui pemanggil, tampil sebelum detail selesai dimuat / Figures the caller already knows, shown before the detail loads */
  summary?: [string, string][];
  onClose: () => void;
}) {
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
    fetch(`/api/dashboard/student/${studentId}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal memuat detail peserta');
        setDetail(data);
      })
      .catch((e) => setError((e as Error).message));
  }, [studentId]);

  const sub = [subtitle || [detail?.student.className, detail?.student.city].filter(Boolean).join(' · '), detail?.student.email].filter(Boolean).join(' · ');

  // Dipasang ke body: pemanggilnya bisa berada di header berteks putih, dan modal di dalamnya akan mewarisi warna itu.
  // Mounted on body: a caller may sit in a white-text header, and a modal inside it would inherit that colour.
  return createPortal(
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
            <h2 id="student-detail-title" style={{ fontSize: '17px', margin: 0 }}>{name}</h2>
            {sub && <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: '2px 0 0' }}>{sub}</p>}
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Tutup" style={{ border: '1px solid var(--color-border)', background: '#ffffff', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ overflowY: 'auto', padding: '16px 18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {summary && summary.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(130px, 100%), 1fr))', gap: '10px' }}>
            {summary.map(([label, value]) => (
              <div key={label} style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid var(--color-border)', padding: '10px 12px' }}>
                <div style={{ fontSize: '10px', color: 'var(--color-text-faint)' }}>{label}</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-main)', textTransform: label === 'Status' ? 'capitalize' : undefined }}>{value}</div>
              </div>
            ))}
          </div>
          )}

          {error ? (
            <div role="alert" style={{ padding: '12px', borderRadius: '10px', backgroundColor: 'var(--color-danger-light)', color: 'var(--color-danger)', fontSize: '12px' }}>{error}</div>
          ) : !detail ? (
            <div style={{ padding: '30px', textAlign: 'center', fontSize: '12px', color: 'var(--color-text-muted)' }}>Memuat progres belajar...</div>
          ) : (
            <>
              <HomePerformance performance={detail.performance} progress={{ attendanceRatio: '', dailyTasksRatio: '', mentoringRatio: `${Math.min(2, detail.mentoring.used)}/2` }} links={false} />

              <SubmittedTasks detail={detail} />

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
                          {b.status !== 'cancelled' && b.recordingUrl && (
                            <a href={b.recordingUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: '#7c3aed', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                              <PlayCircle size={13} /> Rekaman
                            </a>
                          )}
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

              {detail.feedback && (
              <Section icon={MessageSquareText} title={`Feedback (${detail.feedback.length} formulir diisi)`}>
                {detail.feedback.length === 0 ? (
                  <p style={{ fontSize: '12px', color: 'var(--color-text-faint)', margin: 0 }}>Belum mengisi feedback</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {detail.feedback!.map((f, i) => (
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
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

const TASK_STATUS: Record<StudentDetail['performance']['tasks'][number]['status'], { label: string; fg: string; bg: string }> = {
  dinilai: { label: 'Sudah dinilai', fg: '#3f6212', bg: 'var(--color-success-light)' },
  menunggu: { label: 'Menunggu nilai', fg: 'var(--color-primary)', bg: 'var(--color-primary-light)' },
  belum: { label: 'Belum dikumpulkan', fg: '#7c2d12', bg: 'var(--color-warning-light)' },
  lewat: { label: 'Lewat tenggat', fg: 'var(--color-danger)', bg: 'var(--color-danger-light)' },
};

/**
 * Tugas peserta beserta hasil yang ia kumpulkan, agar mentor punya konteks
 * saat sesi mentoring dan admin tidak perlu membuka halaman tiap tugas.
 *
 * The participant's tasks with what they handed in, so a mentor has context in
 * the mentoring session and an admin need not open each task's page.
 */
function SubmittedTasks({ detail }: { detail: StudentDetail }) {
  const subs = new Map(detail.submissions.map((s) => [s.taskId, s]));
  const tasks = detail.performance.tasks;
  const submitted = tasks.filter((t) => subs.has(t.id)).length;

  return (
    <Section icon={ClipboardList} title={`Tugas yang dikumpulkan (${submitted} dari ${tasks.length})`}>
      {tasks.length === 0 ? (
        <p style={{ fontSize: '12px', color: 'var(--color-text-faint)', margin: 0 }}>Belum ada tugas di kelas ini</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {tasks.map((t, i) => {
            const s = subs.get(t.id);
            const st = TASK_STATUS[t.status];
            return (
              <div key={t.id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', flexWrap: 'wrap', padding: '10px 0', borderTop: i === 0 ? 'none' : '1px solid var(--color-border)' }}>
                <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-main)' }}>{t.title}</div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                    {TASK_KIND_LABELS[t.kind]} · {t.dueAt ? `Tenggat ${formatDateTimeWib(t.dueAt)} WIB` : 'Tanpa tenggat'}
                  </div>
                  {s && (
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                      Dikumpulkan {formatDateTimeWib(s.submittedAt)} WIB
                      {s.late && <b style={{ color: 'var(--color-danger)', marginLeft: '6px' }}>Terlambat</b>}
                    </div>
                  )}
                  {s?.feedbackPreview && (
                    <div style={{ fontSize: '11px', color: 'var(--color-text-main)', backgroundColor: 'var(--color-bg-app)', borderRadius: '8px', padding: '6px 9px', marginTop: '6px', whiteSpace: 'pre-wrap' }}>
                      <b>Umpan balik:</b> {s.feedbackPreview}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: st.fg, backgroundColor: st.bg, padding: '3px 8px', borderRadius: '10px', whiteSpace: 'nowrap' }}>
                    {st.label}{s?.score !== null && s?.score !== undefined ? ` · ${s.score}` : ''}
                  </span>
                  {s?.url ? (
                    <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: 'var(--color-primary)', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                      <ExternalLink size={12} /> Buka hasil
                    </a>
                  ) : s?.fileUrl ? (
                    <a href={s.fileUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: 'var(--color-primary)', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                      <ExternalLink size={12} /> Buka berkas
                    </a>
                  ) : s?.fileLost ? (
                    <span title="Diunggah lewat formulir lama yang tidak menyimpan berkasnya" style={{ fontSize: '11px', color: '#a16207' }}>Berkas tidak tersimpan, perlu unggah ulang</span>
                  ) : s?.fileName ? (
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{s.fileName}</span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}
