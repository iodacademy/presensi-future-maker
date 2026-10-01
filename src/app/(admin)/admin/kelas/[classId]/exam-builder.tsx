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
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState('30');
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


  async function create() {
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
          title: title.trim(),
          durationMinutes: duration ? Number(duration) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membuat ujian');
      setTitle('');
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

      {creating ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', padding: '12px', borderRadius: '10px', border: '1px solid var(--color-border)' }}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={kind === 'kuis' ? `Kuis ${sessionTitle ?? 'Sesi'}` : `${EXAM_KIND_LABELS[kind]} Kelas`}
            aria-label="Judul ujian"
            autoFocus
            style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '11px' }}
          />
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ fontSize: '10px', color: 'var(--color-text-muted)' }} htmlFor="exam-duration">Durasi</label>
            <input
              id="exam-duration"
              type="number"
              min={0}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              style={{ width: '70px', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '11px' }}
            />
            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>menit, kosongkan untuk tanpa batas</span>
          </div>
          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setCreating(false)} disabled={busy} style={{ fontSize: '11px', padding: '8px 12px' }}>Batal</Button>
            <Button variant="primary" onClick={create} disabled={busy || !title.trim()} style={{ fontSize: '11px', padding: '8px 12px' }}>
              {busy ? 'Membuat...' : 'Buat'}
            </Button>
          </div>
        </div>
      ) : (
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
      )}
    </div>
  );
}
