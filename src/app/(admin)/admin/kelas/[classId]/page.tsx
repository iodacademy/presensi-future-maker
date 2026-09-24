'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { Plus, Pencil, Paperclip, Calendar, ArrowLeft, Users, X, Check } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { TaskSummary, TaskKind } from '@/features/tasks/types';
import type { ClassDocument } from '@/features/classes/types';

interface Mentor {
  uid: string;
  name: string;
  email: string;
  currentClassName?: string;
}

export default function CourseBuilderPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const resolvedParams = use(params);
  const classId = resolvedParams.classId;

  const [classData, setClassData] = useState<ClassDocument | null>(null);
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [mentors, setMentors] = useState<Mentor[]>([]);
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
  const [dueAt, setDueAt] = useState('');
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

  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      try {
        await Promise.all([loadClass(), loadTasks(), loadMentors()]);
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
          dueAt: dueAt || null,
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
      setTitle(''); setDescription(''); setDueAt(''); setBriefUrl(''); setBriefFileName('');
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
  const capstoneTask = tasks.find((t) => t.kind === 'capstone');
  const isDraft = classData?.status === 'draft';
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

      {loading ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
          Memuat kurikulum kelas...
        </div>
      ) : (
        /* Layout 2 kolom (node 10:1561): kiri 620px, kanan 396px, gap=16 */
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          {/* KOLOM KIRI: Instruksi Tugas Harian (node 10:1562, w=620) */}
          <div style={{ flex: '1 1 480px', minWidth: '360px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-main)' }}>Instruksi Tugas Harian</h2>
              {isDraft && (
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
                  Belum ada Tugas Harian
                </div>
                <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', maxWidth: '360px', margin: '0 auto 16px' }}>
                  Minimal harus ada 1 tugas harian sebelum kelas dapat diaktifkan.
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-main)' }}>{t.title}</h3>
                      <Pencil size={13} color="var(--color-text-faint)" strokeWidth={2} style={{ cursor: 'pointer', flexShrink: 0 }} />
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
                  </div>
                );
              })
            )}
          </div>

          {/* KOLOM KANAN: Instruksi Capstone (node 10:1609, w=396) */}
          <div style={{ flex: '1 1 340px', minWidth: '320px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-main)' }}>Instruksi Capstone</h2>
              {isDraft && !capstoneTask && (
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
            </div>

            {!capstoneTask ? (
              <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px dashed var(--color-border)', padding: '36px', textAlign: 'center' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '8px' }}>
                  Belum ada Capstone Project
                </div>
                <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', maxWidth: '300px', margin: '0 auto 16px' }}>
                  Wajib ada tepat 1 instruksi Capstone sebelum kelas diaktifkan.
                </p>
                {isDraft && (
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
                    <span style={{ fontSize: '9px', color: 'var(--color-text-muted)' }}>Deadline: {capstoneTask.dueAt}</span>
                  </div>
                )}
              </div>
            )}

            {/* Kotak Aturan Kunci (node 10:1631): bg=#fff8e5 border=#ffd500 text=#7c2d12 */}
            <div style={{ backgroundColor: 'var(--color-warning-light)', border: '1px solid #ffd500', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#7c2d12' }}>Aturan Kunci Capstone</div>
              <div style={{ fontSize: '9px', color: '#7c2d12', lineHeight: 1.4 }}>
                Capstone otomatis terkunci untuk peserta sampai keempat Tugas Harian di kelas ini terkumpul semua.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tambah Tugas */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', width: '100%', maxWidth: '520px', padding: '28px', boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>
              Tambah {kind === 'daily' ? 'Tugas Harian' : 'Capstone Project'}
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
              <Input label="DEADLINE (OPSIONAL)" placeholder="Contoh: 30 September 2026, 23:59 WIB" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
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
