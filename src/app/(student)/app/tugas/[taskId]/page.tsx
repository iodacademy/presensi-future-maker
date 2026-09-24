'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { FileText, Download, Link as LinkIcon, Upload } from 'lucide-react';
import { StudentShell } from '@/components/student-shell';
import { Button } from '@/components/ui/button';
import type { StudentTaskItem } from '@/features/tasks/submission-types';

export default function StudentTaskSubmitPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = use(params);

  const [taskItem, setTaskItem] = useState<StudentTaskItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeMode, setActiveMode] = useState<'file' | 'url'>('url');
  const [driveUrl, setDriveUrl] = useState('');
  const [selectedFileName, setSelectedFileName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function loadTaskDetail() {
    try {
      setLoading(true);
      const res = await fetch('/api/tasks/student');
      if (res.ok) {
        const data = await res.json();
        const found = (data.tasks || []).find((t: StudentTaskItem) => t.task.id === taskId);
        if (found) {
          setTaskItem(found);
          if (found.submission?.url) { setDriveUrl(found.submission.url); setActiveMode('url'); }
          else if (found.submission?.fileName) { setSelectedFileName(found.submission.fileName); setActiveMode('file'); }
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTaskDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setSubmitting(true);

    try {
      const payload = activeMode === 'url'
        ? { url: driveUrl, fileId: null, fileName: null }
        : { fileId: 'local-file-' + Date.now(), fileName: selectedFileName || 'Tugas_Submission.pdf', url: null };

      const res = await fetch(`/api/tasks/${taskId}/submission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengumpulkan tugas');

      setSuccessMsg(taskItem?.submission ? 'Submission berhasil diperbarui!' : 'Tugas berhasil dikumpulkan!');
      loadTaskDetail();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const task = taskItem?.task;
  const submission = taskItem?.submission;
  const isGraded = submission?.score !== null && submission?.score !== undefined;

  return (
    <StudentShell userName="Peserta">
      {/* Header mobile (node 11:3191) */}
      <div className="student-mobile-header" style={{ padding: '24px 16px', borderBottom: '1px solid #eeeeee' }}>
        <Link href="/app/tugas" style={{ fontSize: '11px', color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'none' }}>Kembali ke Daftar Tugas</Link>
        {task && <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '14px', fontWeight: 700, color: 'var(--color-text-main)', marginTop: '8px' }}>{task.title}</h1>}
      </div>

      {/* Topbar desktop (node 15:477) */}
      <div className="student-topbar" style={{ backgroundColor: '#ffffff', borderBottom: '1px solid var(--color-student-border)', padding: '18px 28px', justifyContent: 'space-between', alignItems: 'center' }}>
        {task ? (
          <>
            <div>
              <Link href="/app/tugas" style={{ fontSize: '11px', color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'none' }}>Kembali ke Daftar Tugas</Link>
              <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 700, color: 'var(--color-text-main)', marginTop: '6px' }}>{task.title}</h1>
              {task.dueAt && <p style={{ fontSize: '11px', color: 'var(--color-warning)', fontWeight: 600, marginTop: '2px' }}>DEADLINE: {task.dueAt}</p>}
            </div>
            {submission && (
              <div style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, backgroundColor: isGraded ? 'var(--color-success-light)' : 'var(--color-primary-light)', color: isGraded ? 'var(--color-success)' : 'var(--color-primary)' }}>
                {isGraded ? `NILAI: ${submission.score} / 100` : `TERKUMPUL ${submission.late ? '(TERLAMBAT)' : ''}`}
              </div>
            )}
          </>
        ) : (
          <Link href="/app/tugas" style={{ fontSize: '11px', color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'none' }}>Kembali ke Daftar Tugas</Link>
        )}
      </div>

      <div style={{ padding: '16px' }}>
        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)' }}>Memuat detail instruksi...</div>
        ) : !task ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-danger)' }}>Tugas tidak ditemukan atau kelas Anda tidak memiliki akses.</div>
        ) : (
          <div className="student-content-grid student-content-grid--task-detail" style={{ gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Instruksi & Deskripsi (node 15:489) */}
              <div style={{ backgroundColor: '#ffffff', borderRadius: '14px', border: '1px solid var(--color-border)', padding: '20px' }}>
                <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '14px', fontWeight: 700, marginBottom: '10px', color: 'var(--color-text-main)' }}>Instruksi & Deskripsi Tugas</h2>
                <p style={{ fontSize: '12px', color: '#4b5563', lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: 0 }}>{task.description || 'Tidak ada deskripsi rinci.'}</p>

                {task.briefUrl && (
                  <div style={{ marginTop: '14px', backgroundColor: 'var(--color-primary-light)', border: '1px solid var(--color-primary)', borderRadius: '10px', padding: '13px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ width: '34px', height: '34px', borderRadius: '8px', backgroundColor: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FileText size={16} color="#ffffff" strokeWidth={2} />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-main)' }}>File Brief Tugas</div>
                      <div style={{ fontSize: '9px', color: 'var(--color-primary)' }}>{task.briefFileName || 'Download Brief PDF'}</div>
                    </div>
                    <a href={task.briefUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 10px', borderRadius: '7px', backgroundColor: 'var(--color-primary)' }}>
                        <Download size={11} color="#ffffff" strokeWidth={2} />
                        <span style={{ fontSize: '9px', fontWeight: 700, color: '#ffffff' }}>Download</span>
                      </span>
                    </a>
                  </div>
                )}
              </div>

              {/* Form Pengumpulan (node 11:3218 / 15:508) */}
              <div style={{ backgroundColor: '#ffffff', borderRadius: '14px', border: '1px solid var(--color-border)', padding: '20px' }}>
                <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '14px', fontWeight: 700, marginBottom: '4px', color: 'var(--color-text-main)' }}>Form Pengumpulan Tugas</h2>
                <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
                  Pilih salah satu: Unggah file dokumen (PDF/ZIP/JPG maks 10MB) ATAU tempelkan tautan Google Drive / GitHub.
                </p>

                {successMsg && <div style={{ padding: '10px 14px', backgroundColor: 'var(--color-success-light)', color: 'var(--color-success)', borderRadius: '8px', marginBottom: '14px', fontSize: '12px', fontWeight: 600 }}>{successMsg}</div>}
                {error && <div style={{ padding: '10px 14px', backgroundColor: 'var(--color-danger-light)', color: 'var(--color-danger)', borderRadius: '8px', marginBottom: '14px', fontSize: '12px', fontWeight: 600 }}>{error}</div>}

                {isGraded ? (
                  <div style={{ padding: '14px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '12px' }}>
                    Tugas sudah dinilai oleh admin. Pengumpulan telah ditutup dan tidak dapat diubah lagi.
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {/* Dropzone upload (node 11:3220) */}
                    <div
                      onClick={() => setActiveMode('file')}
                      style={{
                        padding: '20px', borderRadius: '8px', textAlign: 'center', cursor: 'pointer',
                        border: `1px solid var(--color-primary)`,
                        backgroundColor: activeMode === 'file' ? '#f8fbff' : '#f8fbff',
                        opacity: activeMode === 'file' ? 1 : 0.7,
                      }}
                    >
                      <Upload size={20} color="var(--color-primary)" strokeWidth={2} style={{ margin: '0 auto' }} />
                      <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--color-primary)', marginTop: '6px' }}>Tarik file atau tap untuk pilih</div>
                      <div style={{ fontSize: '9px', color: 'var(--color-text-faint)', marginTop: '2px' }}>PDF, ZIP, JPG - Max 10MB</div>
                      {activeMode === 'file' && (
                        <input
                          type="file"
                          accept=".pdf,.zip,.jpg,.jpeg"
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) setSelectedFileName(f.name); }}
                          style={{ marginTop: '10px', fontSize: '11px' }}
                        />
                      )}
                      {selectedFileName && activeMode === 'file' && (
                        <div style={{ fontSize: '10px', color: 'var(--color-primary)', fontWeight: 600, marginTop: '6px' }}>File terpilih: {selectedFileName}</div>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--color-border)' }} />
                      <span style={{ fontSize: '9px', color: 'var(--color-text-faint)' }}>ATAU</span>
                      <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--color-border)' }} />
                    </div>

                    {/* Tempel link (node 11:3229) */}
                    <div
                      onClick={() => setActiveMode('url')}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', borderRadius: '8px', border: '1px solid var(--color-border)', cursor: 'text' }}
                    >
                      <LinkIcon size={14} color="var(--color-info)" strokeWidth={2} />
                      <input
                        placeholder="Tempel Link Google Drive di sini"
                        value={driveUrl}
                        onChange={(e) => { setDriveUrl(e.target.value); setActiveMode('url'); }}
                        style={{ border: 'none', outline: 'none', flex: 1, fontSize: '11px' }}
                      />
                    </div>

                    <Button type="submit" variant="primary" disabled={submitting} style={{ padding: '10px', fontSize: '12px', marginTop: '6px' }}>
                      {submitting ? 'Mengirimkan...' : submission ? 'Perbarui Submission Tugas' : 'Kirim Tugas'}
                    </Button>
                  </form>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {isGraded && taskItem?.feedback && (
                <div style={{ backgroundColor: '#ffffff', borderRadius: '14px', border: '2px solid var(--color-success)', padding: '18px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-success)', textTransform: 'uppercase', marginBottom: '6px' }}>Nilai & Feedback Resmi</div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: '6px' }}>
                    {submission.score} <span style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>/ 100</span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--color-text-main)', lineHeight: 1.5, margin: 0 }}>&quot;{taskItem.feedback}&quot;</p>
                </div>
              )}

              {/* Kriteria Penilaian (node 15:536) */}
              <div style={{ backgroundColor: '#fff8e5', borderRadius: '14px', border: '1px solid var(--color-highlight-yellow)', padding: '18px' }}>
                <h3 style={{ fontSize: '12px', fontWeight: 700, marginBottom: '10px', color: 'var(--color-highlight-yellow-text)' }}>Kriteria Penilaian Mentor</h3>
                <ul style={{ fontSize: '11px', color: 'var(--color-highlight-yellow-text)', paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '8px', lineHeight: 1.4, margin: 0 }}>
                  <li>Pastikan seluruh fitur sesuai instruksi telah terpenuhi.</li>
                  <li>Gunakan link Google Drive dengan izin sharing publik (view only).</li>
                  <li>Tugas sebelum deadline dinilai maksimal.</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </StudentShell>
  );
}
