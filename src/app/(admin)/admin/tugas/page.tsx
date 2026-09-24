'use client';

import React, { useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { Input } from '@/components/ui/input';
import type { SubmissionDocument } from '@/features/tasks/submission-types';
import type { ClassSummary } from '@/features/classes/types';
import { formatDateWib } from '@/lib/time';

export default function AdminTugasPage() {
  const [submissions, setSubmissions] = useState<SubmissionDocument[]>([]);
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'daily' | 'capstone'>('daily');
  const [selectedClassId, setSelectedClassId] = useState<string>('');

  const [gradingSubmission, setGradingSubmission] = useState<SubmissionDocument | null>(null);
  const [scoreInput, setScoreInput] = useState<string>('');
  const [feedbackInput, setFeedbackInput] = useState<string>('');
  const [submittingGrade, setSubmittingGrade] = useState(false);
  const [gradeError, setGradeError] = useState<string | null>(null);

  async function loadClasses() {
    try {
      const res = await fetch('/api/classes');
      if (res.ok) { const data = await res.json(); setClasses(data.classes || []); }
    } catch (e) { console.error(e); }
  }

  async function loadSubmissions() {
    setLoading(true);
    try {
      let url = `/api/submissions?kind=${activeTab}`;
      if (selectedClassId) url += `&classId=${encodeURIComponent(selectedClassId)}`;
      const res = await fetch(url);
      if (res.ok) { const data = await res.json(); setSubmissions(data.submissions || []); }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }

  useEffect(() => { loadClasses(); }, []);
  useEffect(() => { loadSubmissions(); }, [activeTab, selectedClassId]);

  function openGradeModal(sub: SubmissionDocument) {
    setGradingSubmission(sub);
    setScoreInput(sub.score !== null && sub.score !== undefined ? String(sub.score) : '');
    setFeedbackInput(sub.feedbackPreview || '');
    setGradeError(null);
  }

  async function handleSaveGrade(e: React.FormEvent) {
    e.preventDefault();
    if (!gradingSubmission) return;
    setSubmittingGrade(true);
    setGradeError(null);
    try {
      const scoreNum = parseInt(scoreInput, 10);
      if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > 100) throw new Error('Nilai harus berupa angka bulat antara 0 dan 100');
      const res = await fetch(`/api/submissions/${gradingSubmission.id}/grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: scoreNum, feedback: feedbackInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan nilai');
      setGradingSubmission(null);
      loadSubmissions();
    } catch (err: any) { setGradeError(err.message); } finally { setSubmittingGrade(false); }
  }

  return (
    <AppShell role="admin" userName="Administrator">
      {/* Header (node 10:2128): judul Poppins Bold 16px + tombol Ekspor outline */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', fontWeight: 700, color: 'var(--color-text-main)' }}>Tugas Siswa</h1>
        <a
          href={`/api/exports/tasks?kind=${activeTab}${selectedClassId ? `&classId=${encodeURIComponent(selectedClassId)}` : ''}`}
          download
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: '#ffffff', color: 'var(--color-text-main)', fontSize: '10px', fontWeight: 600, textDecoration: 'none' }}
        >
          Ekspor Rekap Tugas (CSV)
        </a>
      </div>

      {/* Tab pill (node 10:2132): terisi biru vs abu netral, radius=20 */}
      <div style={{ display: 'flex', gap: '8px' }}>
        {(['daily', 'capstone'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 16px', borderRadius: '20px', border: 'none', fontSize: '11px', fontWeight: activeTab === tab ? 700 : 600, cursor: 'pointer',
              backgroundColor: activeTab === tab ? 'var(--color-primary)' : 'var(--color-border)',
              color: activeTab === tab ? '#ffffff' : 'var(--color-text-main)',
            }}
          >
            {tab === 'daily' ? 'Tugas Mandiri' : 'Capstone'}
          </button>
        ))}
      </div>

      {/* Filter kelas pill (node 10:2137) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Filter kelas:</span>
        <button
          type="button"
          onClick={() => setSelectedClassId('')}
          style={{ padding: '5px 12px', borderRadius: '20px', border: 'none', fontSize: '9px', fontWeight: 700, cursor: 'pointer', backgroundColor: !selectedClassId ? 'var(--color-primary)' : 'var(--color-border)', color: !selectedClassId ? '#ffffff' : 'var(--color-text-main)' }}
        >
          Semua Kelas
        </button>
        {classes.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setSelectedClassId(c.id)}
            style={{ padding: '5px 12px', borderRadius: '20px', border: 'none', fontSize: '9px', fontWeight: selectedClassId === c.id ? 700 : 400, cursor: 'pointer', backgroundColor: selectedClassId === c.id ? 'var(--color-primary)' : 'var(--color-border)', color: selectedClassId === c.id ? '#ffffff' : 'var(--color-text-main)' }}
          >
            {c.canonicalName}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>Memuat submission siswa...</div>
      ) : submissions.length === 0 ? (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid var(--color-border)', padding: '48px', textAlign: 'center' }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: '8px' }}>Belum ada submission tugas yang dikumpulkan</div>
          <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Daftar submission yang dikumpulkan siswa akan otomatis muncul di sini secara berurutan.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Header tabel abu (node 10:2148) */}
          <div style={{ display: 'flex', padding: '10px', borderRadius: '8px', backgroundColor: 'var(--color-border)', fontSize: '9px', fontWeight: 700, color: 'var(--color-text-main)' }}>
            <span style={{ width: '18%' }}>PESERTA</span>
            <span style={{ width: '16%' }}>KELAS</span>
            <span style={{ width: '20%' }}>TUGAS</span>
            <span style={{ width: '14%' }}>DIKUMPUL</span>
            <span style={{ width: '14%' }}>STATUS</span>
            <span style={{ flex: 1, textAlign: 'right' }}>AKSI</span>
          </div>

          {submissions.map((sub, i) => {
            const isGraded = sub.score !== null && sub.score !== undefined;
            return (
              <div
                key={sub.id}
                style={{
                  display: 'flex', alignItems: 'center', padding: '10px 12px', borderRadius: '8px',
                  backgroundColor: isGraded ? 'var(--color-success-light)' : i === 0 ? 'var(--color-primary-light)' : '#ffffff',
                  border: isGraded ? 'none' : i === 0 ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                }}
              >
                <span style={{ width: '18%', fontSize: '10px', fontWeight: 600, color: 'var(--color-text-main)' }}>{sub.studentName}</span>
                <span style={{ width: '16%', fontSize: '9px', color: 'var(--color-text-muted)' }}>{sub.className || '-'}</span>
                <span style={{ width: '20%', fontSize: '10px', color: 'var(--color-text-main)' }}>{sub.taskTitle || sub.taskId}</span>
                <span style={{ width: '14%', fontSize: '9px', color: 'var(--color-text-muted)' }}>
                  {formatDateWib(sub.submittedAt)}
                  {sub.late && <span style={{ color: 'var(--color-warning)', display: 'block', fontWeight: 700 }}>(Terlambat)</span>}
                </span>
                <span style={{ width: '14%' }}>
                  <span
                    style={{
                      padding: '3px 8px', borderRadius: '10px', fontSize: '8px', fontWeight: 700,
                      backgroundColor: isGraded ? 'var(--color-success)' : 'var(--color-primary)',
                      color: '#ffffff',
                    }}
                  >
                    {isGraded ? `DINILAI ${sub.score}` : 'TERKUMPUL'}
                  </span>
                </span>
                <span style={{ flex: 1, textAlign: 'right' }}>
                  <button
                    type="button"
                    onClick={() => openGradeModal(sub)}
                    style={{ fontSize: '9px', padding: '5px 10px', borderRadius: '6px', border: 'none', backgroundColor: 'var(--color-primary)', color: '#ffffff', fontWeight: 700, cursor: 'pointer' }}
                  >
                    {isGraded ? 'Lihat' : 'Nilai'}
                  </button>
                </span>
              </div>
            );
          })}

          <div style={{ textAlign: 'center', fontSize: '9px', color: 'var(--color-text-faint)', marginTop: '4px' }}>
            Diurutkan berdasarkan waktu kumpul tercepat - Menampilkan {submissions.length} submission
          </div>
        </div>
      )}

      {/* Modal Penilaian */}
      {gradingSubmission && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '480px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '15px', fontWeight: 700, color: 'var(--color-text-main)' }}>Penilaian Tugas Siswa</h2>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                Peserta: <strong>{gradingSubmission.studentName}</strong> - {gradingSubmission.taskTitle}
              </div>
            </div>

            <div style={{ backgroundColor: '#f8fafb', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '12px', fontSize: '11px' }}>
              <div style={{ fontWeight: 700, color: 'var(--color-text-faint)', fontSize: '9px', marginBottom: '4px' }}>HASIL PENGUMPULAN SISWA</div>
              {gradingSubmission.url ? (
                <a href={gradingSubmission.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)', fontWeight: 600, wordBreak: 'break-all' }}>
                  {gradingSubmission.url}
                </a>
              ) : (
                <span style={{ color: 'var(--color-text-main)', fontWeight: 600 }}>{gradingSubmission.fileName || 'File Tugas'}</span>
              )}
            </div>

            <form onSubmit={handleSaveGrade} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <Input label="SKOR NILAI (0 - 100)" type="number" min="0" max="100" step="1" placeholder="85" value={scoreInput} onChange={(e) => setScoreInput(e.target.value)} required />
              <div>
                <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-faint)', display: 'block', marginBottom: '6px' }}>FEEDBACK / CATATAN REVIEW</label>
                <textarea
                  placeholder="Berikan apresiasi dan catatan konstruktif untuk perbaikan siswa..."
                  value={feedbackInput}
                  onChange={(e) => setFeedbackInput(e.target.value)}
                  rows={4}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '11px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                  required
                />
              </div>
              {gradeError && <div style={{ backgroundColor: 'var(--color-danger-light)', color: 'var(--color-danger)', padding: '10px', borderRadius: '6px', fontSize: '11px' }}>{gradeError}</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" onClick={() => setGradingSubmission(null)} disabled={submittingGrade} style={{ padding: '9px 16px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--color-border)', color: 'var(--color-text-main)', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>Batal</button>
                <button type="submit" disabled={submittingGrade} style={{ padding: '9px 16px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--color-primary)', color: '#ffffff', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                  {submittingGrade ? 'Menyimpan...' : 'Simpan Nilai'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
