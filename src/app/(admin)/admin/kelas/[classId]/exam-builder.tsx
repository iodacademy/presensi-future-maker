'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ClipboardCheck, ChevronRight, Plus, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TemplateDownloadButton } from './question-template';
import { EXAM_KIND_LABELS, type ExamDocument, type ExamKind } from '@/features/exams/types';


interface ExamBuilderProps {
  classId: string;
  /** Null untuk pretest kelas; diisi untuk kuis sebuah pertemuan / Null for a class pretest; set for a meeting's quiz */
  sessionId: string | null;
  sessionTitle?: string;
  kind: ExamKind;
}

/**
 * Ujian sebuah pertemuan, atau pretest sebuah kelas.
 *
 * Diletakkan pada kartu pertemuannya bersama rekaman dan bahan praktiknya,
 * sebab seluruhnya melekat pada satu pertemuan.
 *
 * A meeting's exam, or a class's pretest.
 *
 * Placed on the meeting card alongside its recordings and materials, since all
 * of them belong to one meeting.
 */
export function ExamBuilder({ classId, sessionId, sessionTitle, kind }: ExamBuilderProps) {
  const router = useRouter();
  const [exams, setExams] = useState<ExamDocument[]>([]);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch(`/api/exams?classId=${encodeURIComponent(classId)}`);
      if (!res.ok) return;
      const all: ExamDocument[] = (await res.json()).exams || [];
      setExams(all.filter((e) => e.kind === kind && e.sessionId === sessionId));
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, sessionId, kind]);


  async function create(judul: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId,
          kind,
          sessionId,
          title: judul.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membuat ujian');
      setCreating(false);
      // Langsung masuk ke penyuntingnya. Ujian baru tidak punya soal, dan
      // kembali ke daftar berarti admin harus menekannya lagi untuk
      // melanjutkan apa yang baru saja ia mulai.
      //
      // Straight into its editor. A new exam has no questions, and returning to
      // the list would have the admin tap it again to continue what they just
      // started.
      router.push(`/admin/ujian/${data.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }




  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {error && <div role="alert" style={{ fontSize: '10px', color: 'var(--color-danger)' }}>{error}</div>}

      {exams.map((exam) => (
        <Link key={exam.id} href={`/admin/ujian/${exam.id}`} style={{ textDecoration: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '10px', backgroundColor: 'var(--color-primary-light)' }}>
            <ClipboardCheck size={13} color="var(--color-primary)" strokeWidth={2} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {exam.title}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px', flexWrap: 'wrap', fontSize: '9px', color: 'var(--color-primary)' }}>
                <span>{exam.questionCount} soal</span>
                {exam.durationMinutes !== null && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    <Clock size={9} strokeWidth={2} />{exam.durationMinutes} menit
                  </span>
                )}
                <span>KKM {exam.passingScore}</span>
              </div>
            </div>

            <span
              style={{
                fontSize: '8px', fontWeight: 700, padding: '3px 8px', borderRadius: '10px', whiteSpace: 'nowrap',
                backgroundColor: exam.published ? 'var(--color-success)' : 'var(--color-border)',
                color: exam.published ? '#ffffff' : 'var(--color-text-muted)',
              }}
            >
              {exam.published ? 'TERBIT' : 'DRAF'}
            </span>

            <ChevronRight size={14} color="var(--color-primary)" strokeWidth={2} style={{ flexShrink: 0 }} />
          </div>
        </Link>
      ))}

      {creating && (
        <NewExamDialog
          defaultTitle={kind === 'kuis' ? `Kuis ${sessionTitle ?? 'Sesi'}` : `${EXAM_KIND_LABELS[kind]} Kelas`}
          kindLabel={EXAM_KIND_LABELS[kind]}
          busy={busy}
          error={error}
          onCancel={() => { setCreating(false); setError(null); }}
          onCreate={create}
        />
      )}

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <Button variant="secondary" onClick={() => setCreating(true)} style={{ fontSize: '11px', padding: '8px 14px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <Plus size={12} strokeWidth={2} />
            Tambah {EXAM_KIND_LABELS[kind]}
          </Button>

          {/* Contoh Excel dapat diunduh sebelum ujiannya ada: admin menyiapkan
              soalnya lebih dulu, dan tombol yang hanya ada di dalam kartu
              ujian menuntut ujian dibuat dulu untuk sekadar melihat
              kolomnya.

              The Excel template downloads before the exam exists: an admin
              prepares the questions first, and a button only inside an exam
              card demands creating an exam just to see the columns. */}
        <TemplateDownloadButton compact showColumns />
      </div>
    </div>
  );
}

/**
 * Dialog judul ujian baru.
 *
 * Judulnya saja yang diminta. Durasi dan KKM diatur di penyuntingnya bersama
 * pengaturan lain, dan menanyakan tiga hal sebelum ujiannya ada menunda admin
 * dari pekerjaan sebenarnya: menyusun soalnya.
 *
 * The new exam's title dialog.
 *
 * Only the title is asked. Duration and the passing score are set in the editor
 * alongside the other settings, and asking three things before the exam exists
 * delays the admin from the real work: composing its questions.
 */
function NewExamDialog({
  defaultTitle,
  kindLabel,
  busy,
  error,
  onCancel,
  onCreate,
}: {
  defaultTitle: string;
  kindLabel: string;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onCreate: (judul: string) => void;
}) {
  const [judul, setJudul] = useState(defaultTitle);

  // Escape menutupnya. Dialog yang hanya dapat ditutup lewat tombolnya memaksa
  // mencari sasaran kecil untuk membatalkan sesuatu yang belum terjadi.
  //
  // Escape closes it. A dialog that closes only through its button forces hunting
  // for a small target to cancel something that has not happened yet.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);

  const siap = judul.trim().length > 0 && !busy;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-exam-title"
      onClick={() => !busy && onCancel()}
      style={{
        position: 'fixed', inset: 0, zIndex: 100, padding: '16px',
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ backgroundColor: 'var(--color-surface)', borderRadius: '12px', padding: '22px', width: '100%', maxWidth: '400px' }}
      >
        <h2 id="new-exam-title" style={{ fontFamily: 'var(--font-heading)', fontSize: '15px', fontWeight: 700, margin: '0 0 4px', color: 'var(--color-text-main)' }}>
          {kindLabel} baru
        </h2>
        <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: '0 0 14px' }}>
          Durasi dan KKM diatur di penyuntingnya.
        </p>

        <label htmlFor="new-exam-input" style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '5px' }}>
          JUDUL
        </label>
        <input
          id="new-exam-input"
          value={judul}
          onChange={(e) => setJudul(e.target.value)}
          // Enter membuatnya, sebagaimana kolom tunggal lain. Memindahkan tangan
          // ke tetikus untuk satu kolom adalah langkah yang tidak perlu.
          //
          // Enter creates it, as any single field would. Moving a hand to the
          // mouse for one field is a step that need not exist.
          onKeyDown={(e) => { if (e.key === 'Enter' && siap) onCreate(judul); }}
          autoFocus
          style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '12px', fontFamily: 'inherit' }}
        />

        {error && (
          <p role="alert" style={{ fontSize: '11px', color: 'var(--color-danger)', margin: '10px 0 0' }}>{error}</p>
        )}

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
          <Button variant="secondary" onClick={onCancel} disabled={busy} style={{ fontSize: '11px', padding: '9px 14px' }}>
            Batal
          </Button>
          <Button variant="primary" onClick={() => onCreate(judul)} disabled={!siap} style={{ fontSize: '11px', padding: '9px 14px' }}>
            {busy ? 'Membuat...' : 'Buat dan Susun Soal'}
          </Button>
        </div>
      </div>
    </div>
  );
}
