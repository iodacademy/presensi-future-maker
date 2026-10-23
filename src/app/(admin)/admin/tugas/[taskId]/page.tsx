'use client';

import React, { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Search, ExternalLink, FileText } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Pagination, PAGE_SIZE } from '@/components/ui/pagination';
import type { RosterSubmission } from '@/features/tasks/submission-types';
import { formatLongDateTimeWib } from '@/lib/time';
import { TASK_KIND_LABELS, type TaskKind } from '@/features/tasks/types';

interface Roster {
  task: { id: string; title: string; kind: TaskKind; dueAt: string | null; classId: string };
  submitted: RosterSubmission[];
  pending: { studentId: string; studentName: string; email: string }[];
}

type Filter = 'semua' | 'menunggu' | 'dinilai' | 'belum';

type Row =
  | { status: 'menunggu' | 'dinilai'; studentId: string; studentName: string; sub: RosterSubmission }
  | { status: 'belum'; studentId: string; studentName: string; email: string };

const STATUS_STYLE: Record<Row['status'], { label: string; color: string; bg: string }> = {
  menunggu: { label: 'Menunggu nilai', color: '#b45309', bg: '#fff3c4' },
  dinilai: { label: 'Sudah dinilai', color: '#3d7a00', bg: 'var(--color-success-light)' },
  belum: { label: 'Belum mengumpulkan', color: 'var(--color-text-muted)', bg: '#eef0f2' },
};

/**
 * Pengumpulan satu tugas: seluruh peserta kelas, yang sudah maupun belum
 * mengumpulkan, dan penilaiannya langsung dari sini.
 *
 * One task's submissions: every participant in the class, submitted or not,
 * graded straight from here.
 */
export default function AdminTaskSubmissionsPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = use(params);
  const [roster, setRoster] = useState<Roster | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('semua');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);

  const [grading, setGrading] = useState<RosterSubmission | null>(null);
  const [scoreInput, setScoreInput] = useState('');
  const [feedbackInput, setFeedbackInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [gradeError, setGradeError] = useState<string | null>(null);

  async function load(): Promise<Roster | null> {
    try {
      const res = await fetch(`/api/tasks/${taskId}/roster`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat pengumpulan');
      setRoster(data);
      return data;
    } catch (e) {
      setLoadError((e as Error).message);
      return null;
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  useEffect(() => { setPage(0); }, [filter, query]);

  // Yang menunggu nilai diurutkan paling awal mengumpulkan lebih dulu: yang
  // menunggu paling lama dinilai lebih dulu.
  // Those awaiting a score are ordered earliest submission first: whoever has
  // waited longest is graded first.
  const rows: Row[] = roster
    ? [
        ...roster.submitted.map((sub): Row => ({ status: sub.score === null ? 'menunggu' : 'dinilai', studentId: sub.studentId, studentName: sub.studentName, sub })),
        ...roster.pending.map((p): Row => ({ status: 'belum', studentId: p.studentId, studentName: p.studentName, email: p.email })),
      ]
    : [];
  const counts = {
    semua: rows.length,
    menunggu: rows.filter((r) => r.status === 'menunggu').length,
    dinilai: rows.filter((r) => r.status === 'dinilai').length,
    belum: rows.filter((r) => r.status === 'belum').length,
  };
  // Hasil praktik di kelas tidak dinilai, jadi hanya terkumpul atau belum.
  // In-class practice results are not graded, so only submitted or not.
  const tanpaNilai = roster?.task.kind === 'working-paper';
  const needle = query.trim().toLowerCase();
  const visible = rows.filter((r) => (filter === 'semua' || r.status === filter) && (needle === '' || r.studentName.toLowerCase().includes(needle)));
  const halaman = visible.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function openGrade(sub: RosterSubmission) {
    setGrading(sub);
    setScoreInput(sub.score !== null ? String(sub.score) : '');
    setFeedbackInput(sub.feedbackPreview || '');
    setGradeError(null);
  }

  async function save(next: boolean) {
    if (!grading) return;
    setSaving(true);
    setGradeError(null);
    try {
      const score = Number(scoreInput);
      if (scoreInput.trim() === '' || !Number.isInteger(score) || score < 0 || score > 100) {
        throw new Error('Nilai harus berupa angka bulat antara 0 dan 100');
      }
      const res = await fetch(`/api/submissions/${grading.submissionId}/grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score, feedback: feedbackInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan nilai');

      const fresh = await load();
      // "Simpan & berikutnya" membuka peserta berikutnya yang masih menunggu
      // nilai, agar admin tidak kembali ke tabel di antara setiap penilaian.
      // "Save & next" opens the next participant still awaiting a score, so the
      // admin does not return to the table between every grade.
      const nextSub = next ? fresh?.submitted.find((s) => s.score === null && s.studentId !== grading.studentId) : undefined;
      if (nextSub) openGrade(nextSub);
      else setGrading(null);
    } catch (err) {
      setGradeError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const backHref = roster ? `/admin/tugas?kelas=${encodeURIComponent(roster.task.classId)}` : '/admin/tugas';
  const th: React.CSSProperties = { textAlign: 'left', fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', padding: '10px 12px', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' };
  const td: React.CSSProperties = { fontSize: '12px', color: 'var(--color-text-main)', padding: '11px 12px', borderBottom: '1px solid var(--color-border)', verticalAlign: 'middle' };

  return (
    <AppShell role="admin" userName="Administrator">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <Link href={backHref} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--color-primary)', fontSize: '11px', fontWeight: 600, textDecoration: 'none', alignSelf: 'flex-start' }}>
          <ArrowLeft size={12} strokeWidth={2} /> Kembali ke Daftar Tugas
        </Link>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', fontWeight: 700, color: 'var(--color-text-main)' }}>
          {roster?.task.title ?? 'Memuat tugas...'}
        </h1>
        {roster && (
          <p style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>
            {TASK_KIND_LABELS[roster.task.kind]} · Tenggat {roster.task.dueAt ? formatLongDateTimeWib(roster.task.dueAt) : 'tidak ada'}
          </p>
        )}
      </div>

      {loadError ? (
        <div role="alert" style={{ backgroundColor: 'var(--color-danger-light)', borderRadius: '12px', padding: '20px', textAlign: 'center', fontSize: '12px', color: 'var(--color-danger)' }}>
          <b>Pengumpulan gagal dimuat.</b> {loadError}
        </div>
      ) : !roster ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>Memuat pengumpulan...</div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {([
              ['Terkumpul', `${roster.submitted.length}/${rows.length}`, 'var(--color-primary)'],
              ...(tanpaNilai ? [] : [
                ['Menunggu nilai', String(counts.menunggu), '#b45309'],
                ['Sudah dinilai', String(counts.dinilai), '#3d7a00'],
              ] as const),
              ['Belum mengumpulkan', String(counts.belum), 'var(--color-text-muted)'],
            ] as const).map(([label, value, color]) => (
              <div key={label} style={{ flex: '1 1 150px', backgroundColor: '#ffffff', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '12px 14px' }}>
                <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{label}</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color }}>{value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            {(tanpaNilai
              ? ([['semua', 'Semua'], ['belum', 'Belum mengumpulkan']] as const)
              : ([['semua', 'Semua'], ['menunggu', 'Menunggu nilai'], ['dinilai', 'Sudah dinilai'], ['belum', 'Belum mengumpulkan']] as const)
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                aria-pressed={filter === value}
                style={{
                  padding: '7px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '11px',
                  fontWeight: filter === value ? 700 : 400,
                  backgroundColor: filter === value ? 'var(--color-primary)' : 'var(--color-border)',
                  color: filter === value ? '#ffffff' : 'var(--color-text-main)',
                }}
              >
                {label} ({counts[value]})
              </button>
            ))}
            <div style={{ flex: '1 1 200px', display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: '#ffffff' }}>
              <Search size={13} color="var(--color-text-muted)" strokeWidth={2} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari nama peserta" aria-label="Cari peserta" style={{ border: 'none', outline: 'none', fontSize: '11px', flex: 1 }} />
            </div>
          </div>

          {visible.length === 0 ? (
            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px dashed var(--color-border)', padding: '32px', textAlign: 'center', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
              {needle ? 'Tidak ada peserta yang cocok' : filter === 'menunggu' ? 'Tidak ada pengumpulan yang menunggu nilai' : 'Tidak ada peserta pada saringan ini'}
            </div>
          ) : (
            <>
              <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--color-border)', borderRadius: '12px', overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: '760px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ ...th, width: '44px', textAlign: 'center' }}>No</th>
                      <th style={th}>Nama peserta</th>
                      <th style={th}>Status</th>
                      <th style={th}>Dikumpulkan</th>
                      <th style={th}>Hasil tugas</th>
                      <th style={{ ...th, textAlign: 'center' }}>Nilai</th>
                      <th style={th} />
                    </tr>
                  </thead>
                  <tbody>
                    {halaman.map((r, i) => {
                      const st = tanpaNilai && r.status !== 'belum' ? { label: 'Terkumpul', color: '#3d7a00', bg: 'var(--color-success-light)' } : STATUS_STYLE[r.status];
                      return (
                        <tr key={r.studentId}>
                          <td style={{ ...td, textAlign: 'center', color: 'var(--color-text-muted)' }}>{page * PAGE_SIZE + i + 1}</td>
                          <td style={{ ...td, fontWeight: 600 }}>{r.studentName}</td>
                          <td style={td}>
                            <span style={{ fontSize: '10px', fontWeight: 700, color: st.color, backgroundColor: st.bg, padding: '3px 8px', borderRadius: '10px', whiteSpace: 'nowrap' }}>{st.label}</span>
                          </td>
                          <td style={{ ...td, fontSize: '11px', color: 'var(--color-text-muted)' }}>
                            {r.status === 'belum' ? '-' : formatLongDateTimeWib(r.sub.submittedAt)}
                            {r.status !== 'belum' && r.sub.late && <div style={{ color: 'var(--color-warning)', fontWeight: 700 }}>Terlambat</div>}
                          </td>
                          <td style={td}>
                            {r.status === 'belum' ? (
                              <span style={{ fontSize: '11px', color: 'var(--color-text-faint)' }}>-</span>
                            ) : r.sub.url ? (
                              <a href={r.sub.url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, color: 'var(--color-primary)' }}>
                                <ExternalLink size={12} /> Buka hasil
                              </a>
                            ) : r.sub.fileUrl ? (
                              <a href={r.sub.fileUrl} target="_blank" rel="noopener noreferrer" title={r.sub.fileName ?? undefined} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, color: 'var(--color-primary)' }}>
                                <FileText size={12} /> Buka berkas
                              </a>
                            ) : r.sub.fileLost ? (
                              <span title={`${r.sub.fileName ?? ''} — diunggah lewat formulir lama yang tidak menyimpan berkasnya`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#a16207', fontWeight: 600 }}>
                                <FileText size={12} /> Berkas tidak tersimpan
                              </span>
                            ) : (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                                <FileText size={12} /> {r.sub.fileName || 'Tanpa tautan'}
                              </span>
                            )}
                          </td>
                          <td style={{ ...td, textAlign: 'center', fontSize: '14px', fontWeight: 700, color: 'var(--color-success)' }}>
                            {tanpaNilai ? <span style={{ fontSize: '10px', fontWeight: 400, color: 'var(--color-text-muted)' }}>Tidak dinilai</span> : r.status === 'dinilai' ? r.sub.score : '-'}
                          </td>
                          <td style={{ ...td, textAlign: 'right' }}>
                            {r.status !== 'belum' && !tanpaNilai && (
                              <Button variant={r.status === 'dinilai' ? 'secondary' : 'primary'} onClick={() => openGrade(r.sub)} style={{ fontSize: '11px', padding: '7px 12px' }}>
                                {r.status === 'dinilai' ? 'Ubah nilai' : 'Nilai'}
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} totalItems={visible.length} onChange={setPage} label="peserta" />
            </>
          )}
        </>
      )}

      {grading && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
          <div role="dialog" aria-modal="true" aria-label="Penilaian tugas" style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '15px', fontWeight: 700, color: 'var(--color-text-main)' }}>Penilaian Tugas</h2>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                <strong>{grading.studentName}</strong> - {roster?.task.title}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--color-text-faint)', marginTop: '2px' }}>
                Dikumpulkan {formatLongDateTimeWib(grading.submittedAt)}{grading.late ? ' · terlambat' : ''}
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--color-bg-app)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '12px' }}>
              <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '6px' }}>HASIL PENGUMPULAN</div>
              {grading.url ? (
                <>
                  <a href={grading.url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 12px', borderRadius: '8px', backgroundColor: 'var(--color-primary)', color: '#ffffff', textDecoration: 'none', fontSize: '11px', fontWeight: 700 }}>
                    <ExternalLink size={12} strokeWidth={2} /> Buka {grading.fileName || 'hasil tugas'}
                  </a>
                  <div style={{ fontSize: '9px', color: 'var(--color-text-muted)', marginTop: '6px', wordBreak: 'break-all' }}>{grading.url}</div>
                </>
              ) : grading.fileUrl ? (
                <a href={grading.fileUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 12px', borderRadius: '8px', backgroundColor: 'var(--color-primary)', color: '#ffffff', textDecoration: 'none', fontSize: '11px', fontWeight: 700 }}>
                  <FileText size={12} strokeWidth={2} /> Buka {grading.fileName || 'berkas tugas'}
                </a>
              ) : grading.fileLost ? (
                // Berkas dari formulir lama tidak pernah tersimpan; peserta perlu mengunggah ulang.
                // A file from the old form was never stored; the participant needs to upload it again.
                <div style={{ fontSize: '11px', color: '#a16207', lineHeight: 1.5 }}>
                  <b>{grading.fileName || 'Berkas'}</b> tidak tersimpan karena diunggah lewat formulir lama. Minta peserta mengunggah ulang dari halaman tugasnya.
                </div>
              ) : (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                  <FileText size={12} strokeWidth={2} /> {grading.fileName || 'Peserta tidak melampirkan tautan'}
                </div>
              )}
            </div>

            <form onSubmit={(e) => { e.preventDefault(); save(false); }} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <Input label="SKOR NILAI (0 - 100)" type="number" min="0" max="100" step="1" placeholder="85" value={scoreInput} onChange={(e) => setScoreInput(e.target.value)} required autoFocus />
              <div>
                <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-faint)', display: 'block', marginBottom: '6px' }}>CATATAN UNTUK PESERTA</label>
                <textarea
                  placeholder="Apresiasi dan catatan perbaikan."
                  value={feedbackInput}
                  onChange={(e) => setFeedbackInput(e.target.value)}
                  rows={4}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '11px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
              </div>
              {gradeError && (
                <div role="alert" style={{ backgroundColor: 'var(--color-danger-light)', color: 'var(--color-danger)', padding: '10px', borderRadius: '6px', fontSize: '11px' }}>{gradeError}</div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>
                <Button variant="secondary" type="button" onClick={() => setGrading(null)} disabled={saving}>Tutup</Button>
                <Button variant="secondary" type="submit" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</Button>
                {counts.menunggu > (grading.score === null ? 1 : 0) && (
                  <Button variant="primary" type="button" onClick={() => save(true)} disabled={saving}>
                    {saving ? 'Menyimpan...' : 'Simpan & berikutnya'}
                  </Button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
