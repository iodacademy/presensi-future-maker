'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { FileText, Download, Link as LinkIcon, ArrowLeft, BookOpen, Send, Award, CalendarClock, CheckCircle2, Trophy, ExternalLink, Info, UploadCloud } from 'lucide-react';
import { MAX_FILE_SIZE_BYTES, isLostSubmissionFile, isStoredSubmissionFile } from '@/features/tasks/submission-policy';
import { StudentShell } from '@/components/student-shell';
import type { StudentTaskItem } from '@/features/tasks/submission-types';
import { TASK_KIND_LABELS } from '@/features/tasks/types';
import { formatLongDateTimeWib } from '@/lib/time';

const DAY_MS = 86_400_000;

function countdown(dueAt: string, nowMs: number): { text: string; overdue: boolean; soon: boolean } {
  const diff = new Date(dueAt).getTime() - nowMs;
  const abs = Math.abs(diff);
  const text = abs >= DAY_MS ? `${Math.floor(abs / DAY_MS)} hari` : `${Math.max(1, Math.floor(abs / 3_600_000))} jam`;
  return { text: diff >= 0 ? `Sisa ${text}` : `Lewat ${text}`, overdue: diff < 0, soon: diff >= 0 && diff <= 2 * DAY_MS };
}

function Card({ icon: Icon, color, title, children }: { icon: typeof BookOpen; color: string; title: string; children: React.ReactNode }) {
  return (
    <section style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid var(--color-student-border)', padding: '18px 20px', boxShadow: '0 2px 10px rgba(36, 60, 75, 0.04)' }}>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontFamily: 'var(--font-heading)', fontSize: '14px', fontWeight: 700, color: 'var(--color-text-main)', margin: '0 0 12px' }}>
        <span aria-hidden style={{ width: '32px', height: '32px', borderRadius: '10px', backgroundColor: `color-mix(in srgb, ${color} 14%, white)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={17} color={color} strokeWidth={2.2} />
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function StudentTaskSubmitPage({
  params,
  searchParams,
}: {
  params: Promise<{ taskId: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { taskId } = use(params);
  const { from } = use(searchParams);
  // Tombol kembali mengikuti asal peserta: dari Jadwal kembali ke item tugas
  // itu di course player, dari Beranda kembali ke Beranda. Tanpa asal (atau
  // dari menu Tugas) tetap ke daftar tugas.
  //
  // The back button follows where the participant came from: from Jadwal back
  // to that task's item in the course player, from Home back to Home. With no
  // origin (or from the Tugas menu) it still goes to the task list.
  const back =
    from === 'jadwal'
      ? { href: `/app/jadwal?item=${encodeURIComponent(`tugas.${taskId}`)}`, label: 'Kembali ke Jadwal' }
      : from === 'home'
        ? { href: '/app', label: 'Kembali ke Beranda' }
        : { href: '/app/tugas', label: 'Kembali ke Daftar Tugas' };

  const [taskItem, setTaskItem] = useState<StudentTaskItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [driveUrl, setDriveUrl] = useState('');
  const [mode, setMode] = useState<'file' | 'url'>('file');
  const [pickedFile, setPickedFile] = useState<File | null>(null);
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
          if (found.submission?.url) setDriveUrl(found.submission.url);
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
      let res: Response;
      if (mode === 'file') {
        if (!pickedFile) throw new Error('Pilih berkas terlebih dahulu');
        // Ukuran diperiksa di peramban agar peserta tidak menunggu unggahan
        // besar yang pasti ditolak server.
        // The size is checked in the browser so a participant does not wait for
        // a large upload the server will certainly refuse.
        if (pickedFile.size > MAX_FILE_SIZE_BYTES) throw new Error(`Ukuran berkas maksimal ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB`);
        const form = new FormData();
        form.append('file', pickedFile);
        res = await fetch(`/api/tasks/${taskId}/upload`, { method: 'POST', body: form });
      } else {
        res = await fetch(`/api/tasks/${taskId}/submission`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: driveUrl.trim() }),
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengumpulkan tugas');

      setSuccessMsg(taskItem?.submission ? 'Pengumpulan tugas berhasil diperbarui!' : 'Tugas berhasil dikumpulkan!');
      setPickedFile(null);
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
  // Pengumpulan lama yang hanya berisi nama file tidak dapat dibuka penilai.
  // An old submission holding only a file name cannot be opened by the grader.
  const missingLink = Boolean(submission && !isGraded && isLostSubmissionFile(submission.fileId));
  const storedFileUrl = submission && isStoredSubmissionFile(submission.fileId) ? `/api/submissions/${encodeURIComponent(submission.id)}/file` : null;
  const handedIn = Boolean(submission?.url || storedFileUrl);
  const isCapstone = task?.kind === 'capstone';
  const nowMs = Date.now();
  const sisa = task?.dueAt && !submission ? countdown(task.dueAt, nowMs) : null;

  // Warna sampul mengikuti keadaan tugas; capstone selalu emas agar terbedakan.
  // The cover colour follows the task's state; capstone is always gold to stand apart.
  const cover = isCapstone
    ? 'linear-gradient(135deg, #854d0e 0%, #a16207 45%, #eab308 100%)'
    : isGraded
      ? 'linear-gradient(135deg, #15803d 0%, #22c55e 100%)'
      : sisa?.overdue
        ? 'linear-gradient(135deg, #b91c1c 0%, #f97316 100%)'
        : submission
          ? 'linear-gradient(135deg, #5b21b6 0%, #6366f1 100%)'
          : sisa?.soon
            ? 'linear-gradient(135deg, #c2410c 0%, #f59e0b 100%)'
            : 'linear-gradient(135deg, #0057a3 0%, #0072ce 55%, #22a6d6 100%)';

  const statusText = isGraded
    ? `Dinilai · ${submission?.score} / 100`
    : missingLink
      ? 'Terkumpul · unggah ulang berkas'
      : submission
        ? `Terkumpul${submission.late ? ' · terlambat' : ''}${task?.kind === 'working-paper' ? '' : ' · menunggu nilai'}`
        : sisa?.overdue ? 'Lewat tenggat' : 'Belum dikumpulkan';

  // Langkah pengerjaan: membaca, mengirim tautan, lalu dinilai.
  // The work's steps: read, send the link, then get graded.
  const steps = [
    { label: 'Baca instruksi', done: true },
    { label: 'Kumpulkan tugas', done: handedIn || isGraded },
    // Hasil praktik di kelas tidak dinilai / In-class practice results are not graded
    ...(task?.kind === 'working-paper' ? [] : [{ label: 'Dinilai', done: isGraded }]),
  ];

  return (
    <StudentShell>
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Setinggi tombol profil di pojok kanan atas, agar sampul di bawahnya tidak tertimpa.
            As tall as the profile button in the top-right corner, so the cover below is not covered. */}
        <div style={{ minHeight: '44px', display: 'flex', alignItems: 'center' }}>
          <Link href={back.href} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'none' }}>
            <ArrowLeft size={14} /> {back.label}
          </Link>
        </div>

        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)' }}>Memuat detail tugas...</div>
        ) : !task ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-danger)' }}>Tugas tidak ditemukan atau kelas Anda tidak memiliki akses.</div>
        ) : (
          <>
            {/* Sampul tugas / Task cover */}
            <div style={{ borderRadius: '20px', padding: '22px 22px 18px', background: cover, color: '#ffffff', boxShadow: '0 12px 30px rgba(15, 23, 42, 0.18)', position: 'relative', overflow: 'hidden' }}>
              <span aria-hidden style={{ position: 'absolute', right: '-30px', top: '-30px', width: '160px', height: '160px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.08)' }} />
              <span aria-hidden style={{ position: 'absolute', right: '60px', bottom: '-50px', width: '120px', height: '120px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.06)' }} />
              <div style={{ position: 'relative', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '10px', fontWeight: 700, padding: '3px 10px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.2)' }}>
                  {isCapstone && <Trophy size={12} />} {TASK_KIND_LABELS[task.kind].toUpperCase()}
                </span>
                <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 10px', borderRadius: '10px', backgroundColor: '#ffffff', color: 'var(--color-text-main)' }}>{statusText}</span>
              </div>
              <h1 style={{ position: 'relative', fontFamily: 'var(--font-heading)', fontSize: '20px', fontWeight: 700, margin: '12px 0 6px', lineHeight: 1.3, color: '#ffffff' }}>{task.title}</h1>
              <div style={{ position: 'relative', display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center', fontSize: '12px', opacity: 0.95 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <CalendarClock size={14} /> {task.dueAt ? `Tenggat ${formatLongDateTimeWib(task.dueAt)}` : 'Tanpa tenggat'}
                </span>
                {sisa && <span style={{ fontWeight: 700, padding: '2px 9px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.22)' }}>{sisa.text}</span>}
              </div>

              <ol style={{ position: 'relative', listStyle: 'none', display: 'flex', gap: '6px', margin: '16px 0 0', padding: 0, flexWrap: 'wrap' }}>
                {steps.map((s, i) => (
                  <li key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 600, padding: '5px 10px 5px 6px', borderRadius: '999px', backgroundColor: s.done ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.15)', color: s.done ? 'var(--color-text-main)' : '#ffffff' }}>
                    <span style={{ width: '18px', height: '18px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, backgroundColor: s.done ? '#22c55e' : 'rgba(255,255,255,0.3)', color: '#ffffff' }}>
                      {s.done ? <CheckCircle2 size={12} /> : i + 1}
                    </span>
                    {s.label}
                  </li>
                ))}
              </ol>
            </div>

            <div className="student-content-grid student-content-grid--task-detail" style={{ gap: '14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <Card icon={BookOpen} color={isCapstone ? '#a16207' : '#0072ce'} title="Instruksi tugas">
                  <p style={{ fontSize: '13px', color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0 }}>{task.description || 'Tidak ada deskripsi rinci.'}</p>

                  {task.briefUrl && (
                    <a href={task.briefUrl} target="_blank" rel="noopener noreferrer" style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '12px', textDecoration: 'none', background: 'linear-gradient(90deg, #eff6ff 0%, #ffffff 100%)', border: '1px solid #bfdbfe' }}>
                      <span style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#0072ce', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <FileText size={18} color="#ffffff" strokeWidth={2} />
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--color-text-main)' }}>File brief tugas</span>
                        <span style={{ display: 'block', fontSize: '11px', color: '#0072ce', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.briefFileName || 'Buka brief'}</span>
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '7px 12px', borderRadius: '9px', backgroundColor: '#0072ce', color: '#ffffff', fontSize: '11px', fontWeight: 700 }}>
                        <Download size={13} /> Buka
                      </span>
                    </a>
                  )}
                </Card>

                <Card icon={Send} color={isCapstone ? '#a16207' : '#0e9f6e'} title="Kumpulkan tugas">
                  {successMsg && <div role="status" style={{ padding: '10px 14px', backgroundColor: '#f0fdf4', color: '#15803d', borderRadius: '10px', marginBottom: '12px', fontSize: '12px', fontWeight: 600 }}>{successMsg}</div>}
                  {error && <div role="alert" style={{ padding: '10px 14px', backgroundColor: '#fef2f2', color: '#b91c1c', borderRadius: '10px', marginBottom: '12px', fontSize: '12px', fontWeight: 600 }}>{error}</div>}
                  {missingLink && (
                    <div role="note" style={{ display: 'flex', gap: '8px', padding: '10px 14px', backgroundColor: '#fefce8', color: '#854d0e', border: '1px solid #fde68a', borderRadius: '10px', marginBottom: '12px', fontSize: '12px', lineHeight: 1.55 }}>
                      <Info size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
                      <span>
                        <b>Tugas Anda sudah tercatat terkumpul.</b> Hanya saja, file{submission?.fileName ? ` (${submission.fileName})` : ''} yang diunggah lewat formulir lama tidak tersimpan di sistem, jadi penilai belum dapat membukanya.
                        Agar dapat dinilai, <b>unggah ulang file yang sama</b> di bawah. Status tepat waktu Anda tetap dipertahankan.
                      </span>
                    </div>
                  )}

                  {isGraded ? (
                    <div style={{ padding: '14px', backgroundColor: '#f9fafb', borderRadius: '10px', border: '1px solid var(--color-student-border)', fontSize: '12px' }}>
                      Tugas sudah dinilai, jadi pengumpulannya tidak dapat diubah lagi.
                      {(submission?.url || storedFileUrl) && (
                        <a href={submission?.url || storedFileUrl!} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginLeft: '6px', color: 'var(--color-primary)', fontWeight: 600 }}>
                          <ExternalLink size={12} /> Lihat yang dikumpulkan
                        </a>
                      )}
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {handedIn && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '10px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: '12px', color: '#166534' }}>
                          <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
                          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            Terkumpul: {submission?.url ? submission.url : submission?.fileName}
                          </span>
                          <a href={submission?.url || storedFileUrl!} target="_blank" rel="noopener noreferrer" style={{ color: '#166534', fontWeight: 700, whiteSpace: 'nowrap' }}>Lihat</a>
                        </div>
                      )}

                      <div role="tablist" aria-label="Cara mengumpulkan" style={{ display: 'flex', gap: '6px', padding: '4px', borderRadius: '12px', backgroundColor: '#f1f5f9' }}>
                        {([['file', 'Unggah berkas', UploadCloud], ['url', 'Tempel tautan', LinkIcon]] as const).map(([m, label, Icon]) => (
                          <button
                            key={m}
                            type="button"
                            role="tab"
                            aria-selected={mode === m}
                            onClick={() => setMode(m)}
                            style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px', borderRadius: '9px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700, backgroundColor: mode === m ? '#ffffff' : 'transparent', color: mode === m ? 'var(--color-text-main)' : 'var(--color-text-muted)', boxShadow: mode === m ? '0 1px 3px rgba(0,0,0,0.12)' : 'none' }}
                          >
                            <Icon size={14} /> {label}
                          </button>
                        ))}
                      </div>

                      {mode === 'file' ? (
                        <label
                          htmlFor="task-file"
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) setPickedFile(f); }}
                          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '22px 14px', borderRadius: '14px', border: '2px dashed #93c5fd', backgroundColor: '#f8fbff', cursor: 'pointer', textAlign: 'center' }}
                        >
                          <UploadCloud size={28} color="#0072ce" />
                          <span style={{ fontSize: '13px', fontWeight: 700, color: '#0057a3' }}>{pickedFile ? pickedFile.name : 'Tarik berkas ke sini atau klik untuk memilih'}</span>
                          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                            {pickedFile ? `${(pickedFile.size / 1024 / 1024).toFixed(1)} MB` : 'PDF, Word, Excel, PowerPoint, CSV, ZIP, JPG, PNG · maks 10 MB'}
                          </span>
                          <input
                            id="task-file"
                            type="file"
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.zip,.jpg,.jpeg,.png"
                            onChange={(e) => setPickedFile(e.target.files?.[0] ?? null)}
                            style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0 }}
                          />
                        </label>
                      ) : (
                      <>
                      <label htmlFor="task-url" style={{ fontSize: '12px', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                        Tempel tautan hasil kerja Anda: Google Drive, GitHub, Netlify, Figma, atau lainnya. Pastikan aksesnya terbuka agar mentor dan admin dapat membukanya.
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '11px 12px', borderRadius: '12px', border: '2px solid #bfdbfe', backgroundColor: '#f8fbff' }}>
                        <LinkIcon size={16} color="#0072ce" strokeWidth={2} />
                        <input
                          id="task-url"
                          type="url"
                          inputMode="url"
                          placeholder="https://drive.google.com/..."
                          value={driveUrl}
                          onChange={(e) => setDriveUrl(e.target.value)}
                          style={{ border: 'none', outline: 'none', flex: 1, minWidth: 0, fontSize: '13px', background: 'transparent' }}
                        />
                      </div>
                      </>
                      )}
                      <button
                        type="submit"
                        disabled={submitting || (mode === 'file' ? !pickedFile : !driveUrl.trim())}
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '12px', border: 'none', cursor: submitting ? 'wait' : 'pointer', background: isCapstone ? 'linear-gradient(90deg, #a16207 0%, #eab308 100%)' : 'linear-gradient(90deg, #0072ce 0%, #22a6d6 100%)', color: '#ffffff', fontSize: '13px', fontWeight: 700, opacity: submitting || (mode === 'file' ? !pickedFile : !driveUrl.trim()) ? 0.6 : 1 }}
                      >
                        <Send size={15} /> {submitting ? (mode === 'file' ? 'Mengunggah...' : 'Mengirimkan...') : handedIn ? 'Perbarui pengumpulan' : 'Kirim tugas'}
                      </button>
                    </form>
                  )}
                </Card>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {isGraded && (
                  <div style={{ borderRadius: '16px', padding: '18px 20px', background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', border: '1px solid #86efac' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: '#15803d', textTransform: 'uppercase' }}>
                      <Award size={14} /> Nilai & feedback
                    </div>
                    <div style={{ fontFamily: 'var(--font-heading)', fontSize: '34px', fontWeight: 700, color: '#14532d', margin: '6px 0' }}>
                      {submission?.score} <span style={{ fontSize: '15px', color: '#15803d' }}>/ 100</span>
                    </div>
                    {taskItem?.feedback ? (
                      <p style={{ fontSize: '13px', color: '#14532d', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>&ldquo;{taskItem.feedback}&rdquo;</p>
                    ) : (
                      <p style={{ fontSize: '12px', color: '#15803d', margin: 0 }}>Belum ada catatan dari penilai.</p>
                    )}
                  </div>
                )}

                {/* Kriteria Penilaian (node 15:536) */}
                <div style={{ borderRadius: '16px', padding: '18px 20px', background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)', border: '1px solid #fcd34d' }}>
                  <h3 style={{ fontSize: '13px', fontWeight: 700, margin: '0 0 10px', color: '#92400e' }}>Tips agar nilai maksimal</h3>
                  <ul style={{ fontSize: '12px', color: '#92400e', paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '8px', lineHeight: 1.5, margin: 0 }}>
                    <li>Pastikan seluruh poin instruksi terpenuhi.</li>
                    <li>Bila mengirim tautan Google Drive, atur aksesnya agar dapat dilihat siapa saja yang memiliki link.</li>
                    <li>Kumpulkan sebelum tenggat; pengumpulan masih dapat diperbarui selama belum dinilai.</li>
                  </ul>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </StudentShell>
  );
}
