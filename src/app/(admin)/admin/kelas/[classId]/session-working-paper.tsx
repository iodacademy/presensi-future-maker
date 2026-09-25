'use client';

import React, { useState } from 'react';
import { ClipboardList, Trash2, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDateTimeWib } from '@/lib/time';
import type { SessionDocument } from '@/features/attendance/types';
import type { TaskSummary } from '@/features/tasks/types';

interface SessionWorkingPaperProps {
  session: SessionDocument;
  classId: string;
  /** Working paper yang sudah terikat pada pertemuan ini / Working papers already tied to this meeting */
  papers: TaskSummary[];
  onChanged: () => void;
  onDelete: (task: TaskSummary) => void;
}

/**
 * Working paper sebuah pertemuan.
 *
 * Diletakkan pada kartu pertemuan bersama rekaman dan bahan praktiknya, bukan
 * pada tab tersendiri: seluruhnya melekat pada satu pertemuan, dan memisahkan
 * salah satunya membuat admin maupun peserta memeriksa dua tempat untuk sesi
 * yang sama.
 *
 * A meeting's working paper.
 *
 * It sits on the meeting card alongside its recordings and practice materials
 * rather than on a tab of its own: all of them belong to one meeting, and
 * separating any of them makes both admins and participants check two places
 * for the same session.
 */
export function SessionWorkingPaper({
  session,
  classId,
  papers,
  onChanged,
  onDelete,
}: SessionWorkingPaperProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState(session.date);
  const [dueTime, setDueTime] = useState('23:59');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/classes/${classId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          kind: 'working-paper',
          sessionId: session.id,
          description,
          dueDate: dueDate || null,
          dueTime: dueTime || null,
          order: papers.length + 1,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menambah working paper');

      setTitle('');
      setDescription('');
      setOpen(false);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {papers.map((p) => (
        <div
          key={p.id}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px',
            borderRadius: '8px', backgroundColor: 'var(--color-warning-light)',
          }}
        >
          <ClipboardList size={12} color="#7c2d12" strokeWidth={2} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#7c2d12', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {p.title}
            </div>
            {p.dueAt && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '1px' }}>
                <Calendar size={9} color="#7c2d12" strokeWidth={2} />
                <span style={{ fontSize: '9px', color: '#7c2d12' }}>
                  Batas {formatDateTimeWib(p.dueAt)} WIB
                </span>
              </div>
            )}
          </div>
          <button
            type="button"
            aria-label={`Hapus working paper ${p.title}`}
            onClick={() => onDelete(p)}
            style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '2px', flexShrink: 0 }}
          >
            <Trash2 size={12} color="var(--color-danger)" strokeWidth={2} />
          </button>
        </div>
      ))}

      {open ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Judul working paper"
            aria-label={`Judul working paper untuk ${session.title}`}
            autoFocus
            style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '11px' }}
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Instruksi pengerjaan"
            aria-label={`Instruksi working paper untuk ${session.title}`}
            rows={2}
            style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '11px', resize: 'vertical', fontFamily: 'inherit' }}
          />
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Batas diisi tanggal dan jam terpisah agar keduanya dapat diurai.
                Satu kolom teks bebas menghasilkan batas yang tidak pernah
                berlaku.

                The deadline takes a separate date and time so both can be
                parsed. A single free-text field produced deadlines that never
                took effect. */}
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              aria-label={`Tanggal batas working paper untuk ${session.title}`}
              style={{ flex: '1 1 140px', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '11px' }}
            />
            <input
              type="time"
              value={dueTime}
              onChange={(e) => setDueTime(e.target.value)}
              aria-label={`Jam batas working paper untuk ${session.title}`}
              style={{ width: '104px', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '11px' }}
            />
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy} style={{ fontSize: '11px', padding: '8px 12px' }}>
              Batal
            </Button>
            <Button variant="primary" onClick={handleAdd} disabled={busy || !title.trim()} style={{ fontSize: '11px', padding: '8px 12px' }}>
              {busy ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </div>

          {error && (
            <div role="alert" style={{ fontSize: '10px', color: 'var(--color-danger)' }}>
              {error}
            </div>
          )}
        </div>
      ) : (
        <Button variant="secondary" onClick={() => setOpen(true)} style={{ fontSize: '11px', padding: '8px 14px', alignSelf: 'flex-start' }}>
          Tambah Working Paper
        </Button>
      )}
    </div>
  );
}
