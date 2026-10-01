'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { Plus, Pencil, Paperclip, Calendar, ArrowLeft, Users, X, Check, Trash2, Video } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DeleteDialog } from '@/components/ui/delete-dialog';
import { SessionMaterials } from './session-materials';
import { SessionWorkingPaper } from './session-working-paper';
import { SubmissionRoster } from './submission-roster';
import { ExamBuilder } from './exam-builder';
import { TASK_KIND_LABELS } from '@/features/tasks/types';
import { formatDateTimeWib } from '@/lib/time';
import type { TaskSummary, TaskKind } from '@/features/tasks/types';
import type { ClassDocument } from '@/features/classes/types';
import type { SessionDocument } from '@/features/attendance/types';

interface Mentor {
  uid: string;
  name: string;
  email: string;
  currentClassName?: string;
}

type BuilderTab = 'rekaman' | 'tugas' | 'capstone' | 'pretest';

const BUILDER_TABS: [BuilderTab, string][] = [
  ['rekaman', 'Materi Sesi'],
  ['tugas', 'Tugas'],
  ['capstone', 'Capstone'],
  ['pretest', 'Pretest'],
];

interface PendingDelete {
  endpoint: string;
  impactQuery?: string;
  label: string;
}

export default function CourseBuilderPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const resolvedParams = use(params);
  const classId = resolvedParams.classId;

  const [tab, setTab] = useState<BuilderTab>('rekaman');
  const [classData, setClassData] = useState<ClassDocument | null>(null);
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [sessions, setSessions] = useState<SessionDocument[]>([]);
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  // Satu sesi bisa punya beberapa rekaman (breakout room), jadi form isiannya
  // disimpan per sesi sebagai pasangan label+tautan.
  //
  // One session can hold several recordings (breakout rooms), so the entry form
  // is kept per session as a label + link pair.
  const [recordingDrafts, setRecordingDrafts] = useState<Record<string, { label: string; url: string }>>({});
  const [savingRecording, setSavingRecording] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMentorModalOpen, setIsMentorModalOpen] = useState(false);
  const [selectedMentorIds, setSelectedMentorIds] = useState<string[]>([]);
  const [savingMentors, setSavingMentors] = useState(false);
  const [activating, setActivating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<TaskKind>('daily');
  const [description, setDescription] = useState('');
  // Tanggal dan jam dipisah agar keduanya dapat diurai. Satu kolom teks bebas
  // menghasilkan batas waktu yang tidak pernah berlaku.
  //
  // Date and time are separate so both can be parsed. A single free-text field
  // produced deadlines that never took effect.
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('23:59');
  const [sessionId, setSessionId] = useState('');
  const [briefUrl, setBriefUrl] = useState('');
  const [briefFileName, setBriefFileName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Fungsi refetch dipecah per endpoint (bukan satu loadData() gabungan) supaya
  // tiap aksi cukup refresh data yang benar-benar berubah -- nambah tugas tidak
  // perlu refetch mentors, ubah mentor tidak perlu refetch tasks, dst. Tiap
  // round-trip browser->API route->Firestore ~500ms, jadi 3 fetch redundan per
  // aksi kecil terasa nyata di halaman yang paling sering dipakai saat setup
  // kelas baru (bisa belasan tugas ditambah berturut-turut).
  //
  // Refetch functions split per endpoint (not one combined loadData()) so each
  // action only refreshes what actually changed -- adding a task doesn't need
  // to refetch mentors, changing mentors doesn't need to refetch tasks, etc.
  // Each round-trip is browser->API route->Firestore ~500ms, so 3 redundant
  // fetches per small action is noticeable on the page most used during class
  // setup (dozens of tasks can be added back-to-back).
  async function loadClass() {
    const res = await fetch(`/api/classes/${classId}`);
    if (res.ok) {
      const data = await res.json();
      setClassData(data.class);
    }
  }

  async function loadTasks() {
    const res = await fetch(`/api/classes/${classId}/tasks`);
    if (res.ok) {
      const data = await res.json();
      setTasks(data.tasks || []);
    }
  }

  async function loadMentors() {
    const res = await fetch('/api/mentors');
    if (res.ok) {
      const data = await res.json();
      setMentors(data.mentors || []);
    }
  }

  // Rekaman memakai jadwal yang sudah dibuat di menu Jadwal; daftar sesinya
  // tidak diketik ulang di sini.
  //
  // Recordings reuse the schedule already created under the Jadwal menu; the
  // session list is not retyped here.
  async function loadSessions() {
    const res = await fetch(`/api/sessions?classId=${encodeURIComponent(classId)}`);
    if (res.ok) {
      const data = await res.json();
      setSessions(data.sessions || []);
    }
  }

  function draftFor(sessionId: string) {
    return recordingDrafts[sessionId] ?? { label: '', url: '' };
  }

  function setDraft(sessionId: string, patch: Partial<{ label: string; url: string }>) {
    setRecordingDrafts((prev) => ({
      ...prev,
      [sessionId]: { ...draftFor(sessionId), ...patch },
    }));
  }

  async function handleAddRecording(sessionId: string) {
    const draft = draftFor(sessionId);
    setSavingRecording(sessionId);
    setActionError(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/recordings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menambah rekaman');
      setRecordingDrafts((prev) => ({ ...prev, [sessionId]: { label: '', url: '' } }));
      await loadSessions();
      setActionSuccess('Rekaman ditambahkan');
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setSavingRecording(null);
    }
  }

  async function handleRemoveRecording(sessionId: string, recordingId: string) {
    setActionError(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/recordings?recordingId=${recordingId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus rekaman');
      await loadSessions();
    } catch (e) {
      setActionError((e as Error).message);
    }
  }

  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      try {
        await Promise.all([loadClass(), loadTasks(), loadMentors(), loadSessions()]);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setActionError(null);

    try {
      const order = kind === 'daily' ? tasks.filter((t) => t.kind === 'daily').length + 1 : 1;
      const res = await fetch(`/api/classes/${classId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, kind, description,
          sessionId: kind === 'working-paper' ? sessionId : null,
          dueDate: dueDate || null,
          dueTime: dueTime || null,
          briefUrl: briefUrl || null,
          briefFileName: briefFileName || null,
          order,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal menambahkan tugas');
      }

      setIsModalOpen(false);
      setTitle(''); setDescription(''); setDueDate(''); setDueTime('23:59'); setSessionId('');
      setBriefUrl(''); setBriefFileName('');
      setActionSuccess('Tugas berhasil ditambahkan ke kurikulum');
      loadTasks(); // hanya tasks yang berubah / only tasks changed
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function openMentorModal() {
    setSelectedMentorIds(classData?.mentorIds || []);
    setIsMentorModalOpen(true);
  }

  function toggleMentorSelection(uid: string) {
    setSelectedMentorIds((prev) => (prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]));
  }

  async function handleSaveMentors() {
    setSavingMentors(true);
    setActionError(null);

    try {
      const res = await fetch(`/api/classes/${classId}/mentors`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mentorIds: selectedMentorIds }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal mengubah mentor kelas');
      }

      setIsMentorModalOpen(false);
      setActionSuccess('Mentor kelas berhasil diperbarui');
      // Mentor kelas ikut ditampilkan di classData.mentorIds, jadi refetch class
      // saja -- daftar mentor global (endpoint /api/mentors) tidak berubah.
      // Class mentor list is shown via classData.mentorIds, so only refetch
      // class -- the global mentor list (/api/mentors) hasn't changed.
      loadClass();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setSavingMentors(false);
    }
  }

  async function handleActivate() {
    if (!confirm('Apakah Anda yakin ingin mengaktifkan kelas ini? Snapshot tugas wajib akan dikunci.')) return;

    setActivating(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch(`/api/classes/${classId}/activate`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal mengaktifkan kelas');
      }
      setActionSuccess('Kelas berhasil diaktifkan! Kurikulum tugas telah dikunci dan dipublikasikan.');
      // Aktivasi mengubah status kelas DAN published flag tiap tugas -- keduanya
      // perlu direfresh, tapi mentors tidak berubah.
      // Activation changes class status AND each task's published flag -- both
      // need refreshing, but mentors are untouched.
      Promise.all([loadClass(), loadTasks()]);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setActivating(false);
    }
  }

  const dailyTasks = tasks.filter((t) => t.kind === 'daily');
  const workingPapers = tasks.filter((t) => t.kind === 'working-paper');
  const capstoneTask = tasks.find((t) => t.kind === 'capstone');
  const isDraft = classData?.status === 'draft';
  // Tugas kini dapat disusun setelah kelas aktif; hanya kelas terarsip yang
  // terkunci. Kelas diaktifkan berbekal jadwal saja agar peserta dapat melihat
  // jadwalnya lebih dulu.
  //
  // Tasks can now be written after a class goes active; only archived classes
  // are closed. A class activates on its schedule alone so participants can see
  // that schedule first.
  const canEditTasks = classData?.status !== 'archived';
  const assignedMentors = mentors.filter((m) => classData?.mentorIds?.includes(m.uid));
  const mentorNames = assignedMentors.length > 0 ? assignedMentors.map((m) => m.name.split(' ')[0]).join(', ') : 'Belum ada mentor';

  return (
    <AppShell role="admin" userName="Administrator">
      {/* Header (node 10:1557): judul Poppins Bold 15px + subjudul 10px #666666 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <Link href="/admin/kelas" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--color-primary)', textDecoration: 'none', fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>
          <ArrowLeft size={12} strokeWidth={2} />
          Kembali ke Daftar Kelas
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '15px', fontWeight: 700, color: 'var(--color-text-main)' }}>
              {classData?.canonicalName || 'Course Builder'}
            </h1>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>
              Course Builder - Mentor: {mentorNames} - {classData?.studentCount || 0} peserta
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span
              style={{
                padding: '4px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: 700,
                backgroundColor: classData?.status === 'active' ? 'var(--color-success-light)' : 'var(--color-border)',
                color: classData?.status === 'active' ? 'var(--color-success)' : 'var(--color-text-main)',
              }}
            >
              {classData?.status === 'active' ? 'KELAS AKTIF' : 'DRAFT'}
            </span>
            <button
              type="button"
              onClick={openMentorModal}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 12px',
                borderRadius: '8px', border: '1px solid var(--color-primary)', backgroundColor: 'transparent',
                color: 'var(--color-primary)', fontSize: '10px', fontWeight: 700, cursor: 'pointer',
              }}
            >
              <Users size={12} strokeWidth={2} />
              Kelola Mentor
            </button>
            {isDraft && (
              <Button variant="primary" onClick={handleActivate} disabled={activating} style={{ fontSize: '11px', padding: '7px 14px' }}>
                {activating ? 'Mengaktifkan...' : 'Aktifkan Kelas'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {actionError && (
        <div style={{ padding: '10px 14px', backgroundColor: 'var(--color-danger-light)', color: 'var(--color-danger)', borderRadius: '8px', fontSize: '11px', fontWeight: 600 }}>
          {actionError}
        </div>
      )}
      {actionSuccess && (
        <div style={{ padding: '10px 14px', backgroundColor: 'var(--color-success-light)', color: 'var(--color-success)', borderRadius: '8px', fontSize: '11px', fontWeight: 600 }}>
          {actionSuccess}
        </div>
      )}

      {!loading && (
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--color-border)' }}>
          {BUILDER_TABS.map(([value, label]) => {
            const active = tab === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                aria-pressed={active}
                style={{
                  padding: '9px 16px',
                  border: 'none',
                  borderBottom: active ? '2px solid var(--color-primary)' : '2px solid transparent',
                  background: 'none',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: active ? 700 : 400,
                  color: active ? 'var(--color-primary)' : 'var(--color-text-muted)',
                }}
              >
                {label}
                {value === 'rekaman' && sessions.length > 0 && ` (${sessions.length})`}
                {value === 'tugas' && tasks.filter((t) => t.kind === 'daily').length > 0 && ` (${tasks.filter((t) => t.kind === 'daily').length})`}
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
          Memuat kurikulum kelas...
        </div>
      ) : tab === 'rekaman' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: 0 }}>
            Daftar pertemuan diambil dari menu Jadwal. Tiap pertemuan memuat rekaman dan bahan
            praktiknya di satu tempat, supaya peserta tidak mencarinya terpisah.
          </p>

          {sessions.length === 0 ? (
            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px dashed var(--color-border)', padding: '36px', textAlign: 'center' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '8px' }}>
                Belum ada pertemuan
              </div>
              <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: '0 auto 16px', maxWidth: '360px' }}>
                Buat jadwal pertemuan lebih dulu, lalu rekamannya dapat ditambahkan di sini.
              </p>
              <Link href={`/admin/jadwal/${classId}`} style={{ textDecoration: 'none' }}>
                <Button variant="primary">Buka Jadwal Kelas</Button>
              </Link>
            </div>
          ) : (
            sessions.map((s) => {
              const recordings = s.recordings || [];
              const draft = draftFor(s.id);
              return (
                <div key={s.id} style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid var(--color-border)', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                    <div>
                      <h3 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-main)', margin: 0 }}>{s.title}</h3>
                      <p style={{ fontSize: '10px', color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
                        {s.date} · {s.startTime}-{s.endTime} · {s.mode === 'online' ? 'Online' : 'Offline'}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={`Hapus pertemuan ${s.title}`}
                      onClick={() => setPendingDelete({ endpoint: `/api/sessions/${s.id}`, label: s.title })}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px', flexShrink: 0 }}
                    >
                      <Trash2 size={14} color="var(--color-danger)" strokeWidth={2} />
                    </button>
                  </div>

                  {recordings.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {recordings.map((r) => (
                        <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderRadius: '8px', backgroundColor: 'var(--color-primary-light)' }}>
                          <Video size={12} color="var(--color-primary)" strokeWidth={2} style={{ flexShrink: 0 }} />
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: '10px', fontWeight: 600, color: 'var(--color-primary)', textDecoration: 'none', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          >
                            {r.label}
                          </a>
                          <button
                            type="button"
                            aria-label={`Hapus rekaman ${r.label}`}
                            onClick={() => handleRemoveRecording(s.id, r.id)}
                            style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '2px', flexShrink: 0 }}
                          >
                            <X size={12} color="var(--color-text-muted)" strokeWidth={2} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)' }}>REKAMAN</div>

                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <input
                      value={draft.label}
                      onChange={(e) => setDraft(s.id, { label: e.target.value })}
                      placeholder="Kelas Utama / Breakout 1"
                      aria-label={`Nama ruang rekaman untuk ${s.title}`}
                      style={{ flex: '0 1 160px', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '11px' }}
                    />
                    <input
                      value={draft.url}
                      onChange={(e) => setDraft(s.id, { url: e.target.value })}
                      placeholder="https://drive.google.com/..."
                      aria-label={`Tautan rekaman untuk ${s.title}`}
                      style={{ flex: '1 1 200px', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '11px' }}
                    />
                    <Button
                      variant="secondary"
                      onClick={() => handleAddRecording(s.id)}
                      disabled={savingRecording === s.id || !draft.url.trim()}
                      style={{ fontSize: '11px', padding: '8px 14px' }}
                    >
                      {savingRecording === s.id ? 'Menyimpan...' : 'Tambah'}
                    </Button>
                  </div>

                  <div style={{ height: '1px', backgroundColor: 'var(--color-border)' }} />

                  {/* Bahan praktik melekat pada pertemuan, bukan pada tugas:
                      peserta mencari berdasarkan pertemuan, sehingga rekaman
                      dan bahannya perlu berada di satu tempat.

                      Practice materials hang off the meeting rather than a
                      task: participants look by meeting, so a recording and its
                      materials belong in one place. */}
                  <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                    BAHAN PRAKTIK
                  </div>
                  <SessionMaterials session={s} onChanged={loadSessions} />

                  <div style={{ height: '1px', backgroundColor: 'var(--color-border)' }} />

                  {/* Working paper melekat pada pertemuan yang sama dengan
                      rekaman dan bahannya; memisahkannya ke tab tersendiri
                      membuat admin maupun peserta memeriksa dua tempat untuk
                      sesi yang sama.

                      The working paper belongs to the same meeting as its
                      recordings and materials; a separate tab would make both
                      admins and participants check two places for one
                      session. */}
                  <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                    HASIL PRAKTIK DI KELAS
                  </div>
                  <SessionWorkingPaper
                    session={s}
                    classId={classId}
                    papers={tasks.filter((t) => t.kind === 'working-paper' && t.sessionId === s.id)}
                    onChanged={loadTasks}
                    onDelete={(t) => setPendingDelete({ endpoint: `/api/tasks/${t.id}`, label: t.title })}
                  />

                  <div style={{ height: '1px', backgroundColor: 'var(--color-border)' }} />

                  {/* Kuis melekat pada pertemuan yang sama dengan rekaman,
                      bahan, dan hasil praktiknya. Peserta mencari berdasarkan
                      pertemuan, bukan berdasarkan jenis kegiatan.

                      The quiz belongs to the same meeting as its recordings,
                      materials, and practice result. Participants look by
                      meeting, not by kind of activity. */}
                  <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                    KUIS SESI
                  </div>
                  <ExamBuilder classId={classId} sessionId={s.id} sessionTitle={s.title} kind="kuis" />
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          {/* Instruksi Tugas Praktik Mandiri (node 10:1562) */}
          <div style={{ flex: '1 1 480px', minWidth: '360px', display: tab === 'tugas' ? 'flex' : 'none', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-main)' }}>Instruksi Tugas Praktik Mandiri</h2>
              {canEditTasks && (
                <button
                  type="button"
                  onClick={() => { setKind('daily'); setIsModalOpen(true); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 12px',
                    borderRadius: '8px', border: 'none', backgroundColor: 'var(--color-primary)',
                    color: '#ffffff', fontSize: '10px', fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  <Plus size={12} strokeWidth={2} />
                  Tambah Tugas
                </button>
              )}
            </div>

            {dailyTasks.length === 0 ? (
              <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px dashed var(--color-border)', padding: '36px', textAlign: 'center' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '8px' }}>
                  Belum ada Tugas Praktik Mandiri
                </div>
                <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', maxWidth: '360px', margin: '0 auto 16px' }}>
                  Tugas dapat ditambahkan kapan saja, termasuk setelah kelas aktif.
                </p>
              </div>
            ) : (
              dailyTasks.map((t, i) => {
                // Tugas terakhir mendapat highlight oranye di Figma (frame 10:1599)
                const isLastHighlighted = i === dailyTasks.length - 1 && dailyTasks.length > 1;
                return (
                  <div
                    key={t.id}
                    style={{
                      backgroundColor: '#ffffff', borderRadius: '12px', padding: '14px',
                      border: isLastHighlighted ? '2px solid var(--color-warning)' : '1px solid var(--color-border)',
                      display: 'flex', flexDirection: 'column', gap: '4px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                      <h3 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-main)' }}>{t.title}</h3>
                      <button
                        type="button"
                        aria-label={`Hapus ${t.title}`}
                        onClick={() => setPendingDelete({ endpoint: `/api/tasks/${t.id}`, label: t.title })}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px', flexShrink: 0 }}
                      >
                        <Trash2 size={13} color="var(--color-danger)" strokeWidth={2} />
                      </button>
                    </div>
                    <p style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                      {t.description || 'Tidak ada deskripsi khusus.'}
                    </p>
                    {t.briefUrl && (
                      <a href={t.briefUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '5px', textDecoration: 'none', marginTop: '2px' }}>
                        <Paperclip size={11} color="var(--color-primary)" strokeWidth={2} />
                        <span style={{ fontSize: '9px', color: 'var(--color-primary)' }}>{t.briefFileName || 'Brief.pdf'}</span>
                      </a>
                    )}

                    {/* Tugas yang belum terbit belum tampak oleh peserta, jadi
                        angka "0 dari 19" hanya akan menyesatkan.

                        An unpublished task is not visible to participants yet,
                        so a "0 of 19" reading would only mislead. */}
                    {t.published && (
                      <>
                        <div style={{ height: '1px', backgroundColor: 'var(--color-border)', margin: '4px 0' }} />
                        <SubmissionRoster taskId={t.id} />
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Instruksi Capstone (node 10:1609) */}
          <div style={{ flex: '1 1 340px', minWidth: '320px', display: tab === 'capstone' ? 'flex' : 'none', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-main)' }}>Instruksi Capstone</h2>
              {canEditTasks && !capstoneTask && (
                <button
                  type="button"
                  onClick={() => { setKind('capstone'); setIsModalOpen(true); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 12px',
                    borderRadius: '8px', border: '1px solid var(--color-primary)', backgroundColor: 'transparent',
                    color: 'var(--color-primary)', fontSize: '10px', fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  <Pencil size={12} strokeWidth={2} />
                  Edit
                </button>
              )}
              {capstoneTask && (
                <button
                  type="button"
                  aria-label={`Hapus ${capstoneTask.title}`}
                  onClick={() => setPendingDelete({ endpoint: `/api/tasks/${capstoneTask.id}`, label: capstoneTask.title })}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 12px',
                    borderRadius: '8px', border: '1px solid var(--color-danger)', backgroundColor: 'transparent',
                    color: 'var(--color-danger)', fontSize: '10px', fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  <Trash2 size={12} strokeWidth={2} />
                  Hapus
                </button>
              )}
            </div>

            {!capstoneTask ? (
              <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px dashed var(--color-border)', padding: '36px', textAlign: 'center' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '8px' }}>
                  Belum ada Capstone Project
                </div>
                <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', maxWidth: '300px', margin: '0 auto 16px' }}>
                  Capstone dapat disusun kapan saja, termasuk setelah kelas aktif.
                </p>
                {canEditTasks && (
                  <Button variant="primary" onClick={() => { setKind('capstone'); setIsModalOpen(true); }}>
                    + Susun Capstone Project
                  </Button>
                )}
              </div>
            ) : (
              /* Card Capstone: border #243c4b radius=12 (node 10:1616) */
              <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid var(--color-text-main)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '13px', fontWeight: 700, color: 'var(--color-text-main)' }}>
                  {capstoneTask.title}
                </h3>
                <p style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{capstoneTask.description}</p>
                {capstoneTask.briefUrl && (
                  <a href={capstoneTask.briefUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '5px', textDecoration: 'none' }}>
                    <Paperclip size={11} color="var(--color-primary)" strokeWidth={2} />
                    <span style={{ fontSize: '9px', color: 'var(--color-primary)' }}>{capstoneTask.briefFileName || 'Brief_Capstone.pdf'}</span>
                  </a>
                )}
                <div style={{ height: '1px', backgroundColor: 'var(--color-border)' }} />
                {capstoneTask.dueAt && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Calendar size={11} color="var(--color-text-muted)" strokeWidth={2} />
                    <span style={{ fontSize: '9px', color: 'var(--color-text-muted)' }}>
                      {/* dueAt adalah ISO UTC; menampilkannya mentah memberi
                          "2026-09-28T16:59:00.000Z" kepada admin.

                          dueAt is ISO UTC; shown raw it hands the admin
                          "2026-09-28T16:59:00.000Z". */}
                      Deadline: {formatDateTimeWib(capstoneTask.dueAt)} WIB
                    </span>
                  </div>
                )}

                {capstoneTask.published && (
                  <>
                    <div style={{ height: '1px', backgroundColor: 'var(--color-border)' }} />
                    <SubmissionRoster taskId={capstoneTask.id} />
                  </>
                )}
              </div>
            )}

            {/* Kotak Aturan Kunci (node 10:1631): bg=#fff8e5 border=#ffd500 text=#7c2d12 */}
            <div style={{ backgroundColor: 'var(--color-warning-light)', border: '1px solid #ffd500', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#7c2d12' }}>Aturan Kunci Capstone</div>
              <div style={{ fontSize: '9px', color: '#7c2d12', lineHeight: 1.4 }}>
                Capstone otomatis terkunci untuk peserta sampai seluruh Tugas Praktik Mandiri di kelas ini terkumpul.
              </div>
            </div>
          </div>

          {/* Pretest berdiri di depan seluruh kelas, bukan milik satu
              pertemuan, sehingga tempatnya bukan pada kartu pertemuan seperti
              kuis.

              A pretest stands in front of the whole class rather than belonging
              to one meeting, so its place is not on a meeting card the way a
              quiz's is. */}
          <div style={{ flex: '1 1 480px', minWidth: '360px', display: tab === 'pretest' ? 'flex' : 'none', flexDirection: 'column', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-main)' }}>Pretest Kelas</h2>
              <p style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                Dikerjakan sebelum materi dimulai, untuk mengukur titik awal peserta.
              </p>
            </div>
            <ExamBuilder classId={classId} sessionId={null} kind="pretest" />
          </div>
        </div>
      )}

      {pendingDelete && (
        <DeleteDialog
          endpoint={pendingDelete.endpoint}
          impactQuery={pendingDelete.impactQuery}
          entityLabel={pendingDelete.label}
          onClose={() => setPendingDelete(null)}
          onDeleted={async () => {
            setPendingDelete(null);
            setActionSuccess('Data berhasil dihapus');
            await Promise.all([loadClass(), loadTasks(), loadSessions()]);
          }}
        />
      )}

      {/* Modal Tambah Tugas */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', width: '100%', maxWidth: '520px', padding: '28px', boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>
              Tambah {TASK_KIND_LABELS[kind]}
            </h2>
            <form onSubmit={handleAddTask} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <Input label="JUDUL TUGAS" placeholder={kind === 'daily' ? 'Contoh: Tugas 1 - Intro React' : 'Contoh: Capstone Project - Final'} value={title} onChange={(e) => setTitle(e.target.value)} required />
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>DESKRIPSI INSTRUKSI</label>
                <textarea
                  placeholder="Jelaskan ringkasan atau instruksi tugas secara ringkas..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '14px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    TANGGAL BATAS (OPSIONAL)
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '12px' }}
                  />
                </div>
                <div style={{ width: '120px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>JAM WIB</label>
                  <input
                    type="time"
                    value={dueTime}
                    onChange={(e) => setDueTime(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '12px' }}
                  />
                </div>
              </div>
              <Input label="LINK BRIEF TUGAS (OPSIONAL - HTTPS)" type="url" placeholder="https://drive.google.com/... atau https://..." value={briefUrl} onChange={(e) => setBriefUrl(e.target.value)} />
              {briefUrl && (
                <Input label="NAMA FILE TAMPILAN BRIEF" placeholder="Contoh: Brief_Tugas1.pdf" value={briefFileName} onChange={(e) => setBriefFileName(e.target.value)} />
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} disabled={submitting}>Batal</Button>
                <Button type="submit" variant="primary" disabled={submitting}>{submitting ? 'Menyimpan...' : 'Simpan Instruksi'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Kelola Mentor Kelas */}
      {isMentorModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '440px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '15px', fontWeight: 700, color: 'var(--color-text-main)' }}>Kelola Mentor Kelas</h2>
              <button type="button" onClick={() => setIsMentorModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
                <X size={18} color="var(--color-text-faint)" strokeWidth={2} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '320px', overflowY: 'auto' }}>
              {mentors.length === 0 && (
                <div style={{ fontSize: '10px', color: 'var(--color-text-faint)', padding: '9px' }}>
                  Belum ada mentor terdaftar. Tambahkan mentor melalui menu Peserta dan Mentor.
                </div>
              )}
              {mentors.map((mentor) => {
                const checked = selectedMentorIds.includes(mentor.uid);
                const isTakenElsewhere = Boolean(mentor.currentClassName) && mentor.currentClassName !== classData?.canonicalName;
                return (
                  <button
                    type="button"
                    key={mentor.uid}
                    onClick={() => toggleMentorSelection(mentor.uid)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px', padding: '9px',
                      borderRadius: '8px', textAlign: 'left', cursor: 'pointer',
                      backgroundColor: checked ? 'var(--color-primary-light)' : 'transparent',
                      border: checked ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                    }}
                  >
                    <span
                      style={{
                        width: '16px', height: '16px', borderRadius: '4px', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        backgroundColor: checked ? 'var(--color-primary)' : 'transparent',
                        border: checked ? 'none' : '2px solid var(--color-border)',
                      }}
                    >
                      {checked && <Check size={11} color="#ffffff" strokeWidth={3} />}
                    </span>
                    <span
                      style={{
                        width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        backgroundColor: checked ? 'var(--color-primary)' : 'var(--color-border)',
                        color: checked ? '#ffffff' : 'var(--color-text-main)',
                        fontSize: '9px', fontWeight: 700,
                      }}
                    >
                      {mentor.name.charAt(0).toUpperCase()}
                    </span>
                    <span style={{ display: 'flex', flexDirection: 'column', gap: '1px', flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-main)' }}>{mentor.name}</span>
                      <span style={{ fontSize: '8px', color: isTakenElsewhere ? 'var(--color-warning)' : 'var(--color-text-muted)' }}>
                        {isTakenElsewhere ? `Juga menangani: ${mentor.currentClassName}` : mentor.email}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            {actionError && (
              <div style={{ backgroundColor: 'var(--color-danger-light)', color: 'var(--color-danger)', padding: '8px 12px', borderRadius: '6px', fontSize: '11px' }}>
                {actionError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
              <Button type="button" variant="secondary" onClick={() => setIsMentorModalOpen(false)} disabled={savingMentors} style={{ flex: 1 }}>Batal</Button>
              <Button type="button" variant="primary" onClick={handleSaveMentors} disabled={savingMentors} style={{ flex: 1 }}>
                {savingMentors ? 'Menyimpan...' : 'Simpan Mentor'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
